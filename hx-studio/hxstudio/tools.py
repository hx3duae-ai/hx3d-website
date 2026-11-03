"""Generators for the non-keyboard tools. Every function returns (parts, info) with honest `info['notes']`."""
from __future__ import annotations
import math, io
import numpy as np, trimesh, cv2
from PIL import Image
from shapely import affinity
from shapely.geometry import box as sbox, Point, Polygon
from shapely.ops import unary_union
from . import textgeo, colors as C, motion
from .config import MATERIALS, DEFAULT_MATERIAL
from .meshutil import Part, extrude, union, diff, inter, circle, rrect, polys


# ----------------------------------------------------------------------------- image analysis
def load_image(src) -> np.ndarray:
    im = Image.open(src if not isinstance(src, (bytes, bytearray)) else io.BytesIO(src)); im = im.convert("RGBA")
    return np.array(im)


def segment(arr, k=4, bg_tol=14.0, max_px=360):
    """Return dict(fg mask, label image, palette[(hex, frac)]) in image coordinates; background = border colour or alpha."""
    h, w = arr.shape[:2]; s = max_px / max(h, w)
    if s < 1: arr = cv2.resize(arr, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    rgb = arr[..., :3].astype(float)
    lab = np.array([[C.rgb_to_lab(px) for px in row] for row in rgb[::1]]) if rgb.size < 60000 * 3 else _lab_fast(rgb)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]); bg = np.median(border, axis=0)
    fg = np.linalg.norm(lab - bg, axis=-1) > bg_tol
    if arr[..., 3].min() < 250: fg = arr[..., 3] > 127
    fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
    if fg.sum() < 30: raise ValueError("no foreground object found (background too similar to the subject?)")
    from sklearn.cluster import KMeans
    km = KMeans(n_clusters=min(k, 8), n_init=4, random_state=0).fit(lab[fg])
    lab_img = np.full(fg.shape, -1); lab_img[fg] = km.labels_
    pal = []
    for i in range(km.n_clusters):
        m = lab_img == i
        if m.sum() < 0.01 * fg.sum(): continue
        pal.append((C.rgb_hex(rgb[m].mean(0)), float(m.sum() / fg.sum()), i))
    return {"fg": fg, "labels": lab_img, "palette": pal, "shape": fg.shape, "bg_lab": bg.tolist()}


def _lab_fast(rgb):
    a = rgb / 255.0; a = np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]); xyz = a @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def color_regions(seg, width_mm, min_area_px=12):
    """-> {hex: shapely geometry (mm, origin = silhouette bbox centre)}, silhouette geometry"""
    H, W = seg["shape"]; ys, xs = np.where(seg["fg"]); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    s = width_mm / (x1 - x0 + 1)
    out = {}
    for hx, frac, idx in seg["palette"]:
        m = (seg["labels"] == idx).astype(np.uint8); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8))
        g = unary_union(textgeo.mask_to_polygons(m, s, eps_px=0.9, min_area_px=min_area_px))
        if not g.is_empty: out[hx] = g
    sil = unary_union(textgeo.mask_to_polygons(seg["fg"].astype(np.uint8), s, eps_px=0.9))
    cx, cy = ((x0 + x1) / 2) * s, (H - (y0 + y1) / 2) * s
    out = {k: affinity.translate(v, -cx, -cy) for k, v in out.items()}
    return out, affinity.translate(sil, -cx, -cy)


def _tile(regions, sil):
    """Make regions disjoint & covering the silhouette (assign slivers to the nearest region) so colour parts tile exactly."""
    keys = list(regions); taken = None; out = {}
    for k in sorted(keys, key=lambda k: -regions[k].area):
        g = regions[k] if taken is None else regions[k].difference(taken)
        g = g.buffer(0); taken = g if taken is None else taken.union(g); out[k] = g
    return {k: v for k, v in out.items() if not v.is_empty}


def image_to_relief(image, width_mm=60.0, base_t=1.6, relief_t=2.4, colors=4, mode="flat", frame=False, material=DEFAULT_MATERIAL):
    """2.5-D multicolour relief. mode 'flat' = colour inlay plaque, 'height' = relief height by colour lightness."""
    seg = segment(load_image(image), k=colors)
    regs, sil = color_regions(seg, width_mm); regs = _tile(regs, sil)
    parts = []; lum = {k: C.rgb_to_lab(C.hex_rgb(k))[0] for k in regs}; lo, hi = min(lum.values()), max(lum.values())
    for i, (hx, g) in enumerate(sorted(regs.items(), key=lambda kv: -kv[1].area), 1):
        h = relief_t if mode == "flat" else 0.4 + relief_t * (1.0 - (lum[hx] - lo) / (hi - lo + 1e-9))
        parts.append(Part(f"color{i}_{hx[1:]}", extrude(g, 0, base_t + h), hx, "relief", meta={"role": "color_region"}))
    info = {"size_mm": [round(v, 1) for v in (sil.bounds[2] - sil.bounds[0], sil.bounds[3] - sil.bounds[1], base_t + relief_t)], "colors": [p.color for p in parts],
            "palette_fraction": {h: round(f, 3) for h, f, _ in seg["palette"]},
            "kind": "2.5D relief from ONE view (not a full volumetric reconstruction)",
            "not_inferable": ["back and sides of the subject", "true depth / thickness", "occluded parts", "any detail smaller than ~%.1f mm at this scale" % (width_mm / 360 * 2)],
            "notes": ["Colour regions are tiled (no overlap, no gaps) so each colour prints as its own part.",
                      "For true 3D from photos configure an image-to-3D backend (HX_I23D_CMD) - see /api/capabilities."]}
    return parts, info


def logo_to_3d(image, width_mm=50.0, thickness=3.0, colors=3, base=None):
    parts, info = image_to_relief(image, width_mm, base_t=0.0001, relief_t=thickness, colors=colors, mode="flat")
    for p in parts: p.group = "logo"
    info["kind"] = "logo extrusion (all colour regions same height)"; return parts, info


def sketch_to_3d(image, width_mm=None, height_mm=None, thickness=5.0, threshold=None, invert=False):
    """Hand sketch / line drawing -> filled shape (dark = material). Manual width/height sets the real scale."""
    a = load_image(image); g = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2GRAY)
    if threshold is None: _, m = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else: m = (g < threshold).astype(np.uint8) * 255
    if invert: m = 255 - m
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    ys, xs = np.where(m > 0)
    if len(xs) < 30: raise ValueError("no drawing found")
    bw = xs.max() - xs.min() + 1; bh = ys.max() - ys.min() + 1
    if width_mm and height_mm: sx = width_mm / bw; sy = height_mm / bh
    elif width_mm: sx = sy = width_mm / bw
    elif height_mm: sx = sy = height_mm / bh
    else: sx = sy = 0.2
    geo = unary_union(textgeo.mask_to_polygons(m, 1.0, eps_px=1.2)); geo = affinity.scale(geo, sx, sy, origin=(0, 0))
    x0, y0, x1, y1 = geo.bounds; geo = affinity.translate(geo, -(x0 + x1) / 2, -(y0 + y1) / 2)
    part = Part("sketch_solid", extrude(geo, 0, thickness), "#cccccc", "sketch")
    return [part], {"size_mm": [round(x1 - x0, 2), round(y1 - y0, 2), thickness], "scale_mm_per_px": [round(sx, 4), round(sy, 4)],
                    "dimensions_source": "user-provided" if (width_mm or height_mm) else "ASSUMED 0.2 mm/px - enter real width/height",
                    "kind": "extruded outline of the sketch; interior lines are filled unless they form closed loops (holes)",
                    "not_inferable": ["depth/profile of the object (only a flat extrusion is made)", "dimension annotations in the drawing are NOT read - enter measurements manually"], "notes": []}


# ----------------------------------------------------------------------------- text / calligraphy
def text_to_3d(text, kind="nameplate", height_mm=12.0, font=None, custom_font=None, color_text="#FFFFFF", color_base="#050505",
               base_t=2.0, text_t=1.6, margin=4.0, keychain_hole=3.5, max_width=None):
    geo = textgeo.text_polygons(text, height_mm, font, custom_font, max_width_mm=max_width)
    x0, y0, x1, y1 = geo.bounds; w, h = x1 - x0, y1 - y0; parts = []
    if kind == "text_only":
        parts.append(Part("text", extrude(geo, 0, text_t), color_text, "text"))
    else:
        plate = rrect(0, 0, w + 2 * margin + (keychain_hole + 4 if kind == "keychain" else 0), h + 2 * margin, 2.0)
        if kind == "keychain":
            hx = plate.bounds[0] + keychain_hole / 2 + 2.0; geo = affinity.translate(geo, (keychain_hole + 4) / 2, 0)
            plate = plate.difference(circle(hx, 0, keychain_hole / 2))
        parts.append(Part("base", extrude(plate, 0, base_t), color_base, "plate"))
        parts.append(Part("text", extrude(geo, base_t - 0.2, base_t + text_t), color_text, "text"))
    info = {"size_mm": [round(float(v), 1) for v in np.ptp(np.vstack([p.mesh.vertices for p in parts]), axis=0)], "arabic": textgeo.is_arabic(text),
            "font": textgeo.font_path(font, text, custom_font).split("/")[-1], "notes": ["Arabic is shaped (joined forms, right-to-left) with libraqm; custom TTF can be supplied for calligraphy styles."]}
    return parts, info


# ----------------------------------------------------------------------------- lithophane
def lithophane(image, width_mm=100.0, min_t=0.8, max_t=3.2, px_mm=0.4, border=3.0, curve_r=None, invert=False):
    """Backlit relief: darker pixel = thicker. Closed, watertight solid with a flat back."""
    a = load_image(image); g = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2GRAY).astype(float) / 255.0
    nx = int(width_mm / px_mm); ny = max(2, int(nx * g.shape[0] / g.shape[1])); g = cv2.resize(g, (nx, ny), interpolation=cv2.INTER_AREA)
    if invert: g = 1 - g
    z = min_t + (1 - g) * (max_t - min_t); z = cv2.GaussianBlur(z, (3, 3), 0.6)
    H = np.full((ny + 2, nx + 2), max_t); H[1:-1, 1:-1] = z; H[0, :] = H[-1, :] = H[:, 0] = H[:, -1] = max_t       # solid frame border
    ny2, nx2 = H.shape; xs = (np.arange(nx2) - (nx2 - 1) / 2) * px_mm; ys = ((ny2 - 1) / 2 - np.arange(ny2)) * px_mm
    X, Y = np.meshgrid(xs, ys); top = np.c_[X.ravel(), Y.ravel(), H.ravel()]; bot = np.c_[X.ravel(), Y.ravel(), np.zeros(X.size)]
    n = nx2 * ny2; idx = np.arange(n).reshape(ny2, nx2); faces = []
    a1, b1, c1, d1 = idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, 1:].ravel(), idx[1:, :-1].ravel()
    faces += [np.c_[a1, d1, b1], np.c_[b1, d1, c1]]; faces += [np.c_[a1 + n, b1 + n, d1 + n], np.c_[b1 + n, c1 + n, d1 + n]]
    for e0, e1 in [(idx[0, :-1], idx[0, 1:]), (idx[-1, 1:], idx[-1, :-1]), (idx[1:, 0], idx[:-1, 0]), (idx[:-1, -1], idx[1:, -1])]:
        faces += [np.c_[e0, e1, e1 + n], np.c_[e0, e1 + n, e0 + n]]
    m = trimesh.Trimesh(np.vstack([top, bot]), np.vstack(faces), process=True); m.merge_vertices(); trimesh.repair.fix_normals(m)
    if m.volume < 0: m.invert()
    ext = m.extents
    return [Part("lithophane", m, "#f5f5f5", "litho")], {"size_mm": ext.round(1).tolist(), "triangles": int(len(m.faces)), "watertight": bool(m.is_watertight),
            "notes": ["Print vertically (flat face on bed), white/very light PLA, 0.08-0.12mm layers, 100% infill, backlight with a warm LED panel.",
                      "Thickness range %.1f-%.1f mm: lighter areas pass more light." % (min_t, max_t)]}


# ----------------------------------------------------------------------------- box generator
def box_generator(w=80, d=60, h=40, wall=2.0, r=3.0, lid_h=8.0, material=DEFAULT_MATERIAL, screws=False, latch=True, name="box"):
    clr = MATERIALS[material]["clearance"]
    outer = rrect(0, 0, w, d, r); inner = outer.buffer(-wall)
    body = union([extrude(outer, 0, h), ]); body = diff(body, extrude(inner, wall, h + 0.1))
    lip_out = inner.buffer(-clr); lip_in = lip_out.buffer(-wall * 0.8)
    lid = extrude(outer, 0, wall)
    lid = union([lid, extrude(lip_out.difference(lip_in), wall - 0.01, wall + lid_h * 0.5)])
    posts = []
    if screws:
        for sx in (-1, 1):
            for sy in (-1, 1):
                x, y = sx * (w / 2 - wall - 3.2), sy * (d / 2 - wall - 3.2)
                body = union([body, extrude(circle(x, y, 3.2), wall - 0.1, h)]); body = diff(body, extrude(circle(x, y, 1.0), wall + 1, h + 0.1))
                lid = diff(lid, extrude(circle(x, y, 1.8), -0.1, wall + lid_h * 0.5 + 0.1))
    if latch:
        for sx in (-1, 1):   # small snap bumps on the lid lip and matching dimples in the body wall
            bump = trimesh.creation.icosphere(subdivisions=2, radius=0.7); bump.apply_translation([sx * (w / 2 - wall - clr), 0, wall + lid_h * 0.25])
            lid = union([lid, bump]); dim = trimesh.creation.icosphere(subdivisions=2, radius=0.7 + clr / 2); dim.apply_translation([sx * (w / 2 - wall + 0.05), 0, h - lid_h * 0.25])
            body = diff(body, dim)
    lid.apply_translation([0, 0, 0])
    lid_p = lid.copy(); lid_p.apply_translation([0, d + 10, 0])
    parts = [Part("box_body", body, "#050505", "box"), Part("box_lid", lid_p, "#FF66B2", "box")]
    return parts, {"size_mm": [w, d, h], "lid_clearance_mm": clr, "notes": [f"Lid lip clearance {clr} mm for {material} (estimate; adjust after a test print).", "Lid is laid out flat beside the body, print as shown (no supports)."]}


# ----------------------------------------------------------------------------- jewelry
RING_SIZES = {"US": lambda s: 11.63 + 0.8128 * s, "EU": lambda s: s / math.pi}   # inner diameter mm (US: 11.63+0.8128*size), EU circumference mm


def ring(size=7.0, system="US", band_w=6.0, thickness=2.0, text=None, color="#FF66B2", comfort=True):
    d = RING_SIZES[system](size) + 0.3                # +0.3 mm printing compensation (ASSUMPTION)
    ro, ri = d / 2 + thickness, d / 2
    outer = circle(0, 0, ro, 96); inner = circle(0, 0, ri, 96)
    band = extrude(outer.difference(inner), 0, band_w)
    parts = [Part("ring", band, color, "ring")]
    if text:
        g = textgeo.text_polygons(text, band_w * 0.45, max_width_mm=2 * math.pi * ro * 0.45)
        # wrap text to the outer surface: map x (arc) -> angle; engraved 0.4 mm
        eng = trimesh.Trimesh()
        sol = extrude(g, 0, 1.0)
        v = sol.vertices.copy(); ang = v[:, 0] / ro; rad = ro - 0.4 + v[:, 2]
        wrapped = trimesh.Trimesh(np.c_[rad * np.sin(ang), -rad * np.cos(ang), v[:, 1] + band_w / 2], sol.faces, process=False)
        if wrapped.volume < 0: wrapped.invert()
        try: band = diff(band, wrapped); parts[0] = Part("ring", band, color, "ring")
        except Exception: pass
    return parts, {"inner_diameter_mm": round(d, 2), "outer_diameter_mm": round(2 * ro, 2), "notes": ["Inner diameter includes +0.3 mm printing compensation (assumption) - verify with a ring sizer.", "Not for skin-contact certification: PLA/PETG rings are costume jewelry."]}


def pendant(image=None, text=None, size_mm=30.0, thickness=2.5, loop_d=4.0, colors=3):
    if image is not None:
        seg = segment(load_image(image), k=colors); regs, sil = color_regions(seg, size_mm); regs = _tile(regs, sil)
        parts = [Part(f"color_{h[1:]}", extrude(g, 0, thickness), h, "pendant") for h, g in regs.items()]
        top = sil.bounds[3]; cx = (sil.bounds[0] + sil.bounds[2]) / 2
    else:
        g = textgeo.text_polygons(text or "HX", size_mm * 0.5, max_width_mm=size_mm); b = rrect(0, 0, size_mm, size_mm * 0.5 + 8, 3)
        parts = [Part("pendant_base", extrude(b, 0, thickness), "#050505", "pendant"), Part("pendant_text", extrude(g, thickness - 0.2, thickness + 1.0), "#FF66B2", "pendant")]
        top = b.bounds[3]; cx = 0
    loop = extrude(circle(cx, top + loop_d / 2 - 0.5, loop_d / 2 + 1.2).difference(circle(cx, top + loop_d / 2 - 0.5, loop_d / 2 - 0.4)), 0, thickness)
    parts.append(Part("loop", loop, parts[0].color, "pendant"))
    return parts, {"notes": ["Loop hole %.1f mm - check your chain/cord." % (loop_d - 0.8)]}


# ----------------------------------------------------------------------------- gears + hinge (mechanical designer)
def involute_gear_poly(z, module, pressure=20.0, bore=0.0, backlash=0.0):
    rp = module * z / 2; rb = rp * math.cos(math.radians(pressure)); ra = rp + module; rf = max(rp - 1.25 * module, 0.5)
    def inv(a): return math.tan(a) - a
    pts = []
    t_tip = math.sqrt((ra / rb) ** 2 - 1); n = 10
    half_tooth = math.pi / (2 * z) - inv(math.radians(pressure)) - backlash / (2 * rp)
    for i in range(z):
        c = 2 * math.pi * i / z
        flank = [(rb * (math.cos(t) + t * math.sin(t)), rb * (math.sin(t) - t * math.cos(t))) for t in np.linspace(0, t_tip, n)]
        def rotp(p, a): return (p[0] * math.cos(a) - p[1] * math.sin(a), p[0] * math.sin(a) + p[1] * math.cos(a))
        right = [rotp(p, c - half_tooth) for p in flank]
        left = [rotp((p[0], -p[1]), c + half_tooth) for p in flank]
        root_a = [(rf * math.cos(c - half_tooth - 0.02), rf * math.sin(c - half_tooth - 0.02))]
        root_b = [(rf * math.cos(c + half_tooth + 0.02), rf * math.sin(c + half_tooth + 0.02))]
        pts += root_a + right + left[::-1] + root_b
    g = Polygon(pts).buffer(0)
    if bore: g = g.difference(circle(0, 0, bore / 2))
    return g


def gear_pair(z1=16, z2=32, module=2.0, thickness=6.0, bore=5.0, material=DEFAULT_MATERIAL, backlash=0.15, center_extra=0.0):
    clr = MATERIALS[material]["clearance"]
    a = module * (z1 + z2) / 2 + backlash + center_extra
    g1 = involute_gear_poly(z1, module, bore=bore, backlash=backlash)
    g2 = involute_gear_poly(z2, module, bore=bore, backlash=backlash)
    # phase so a tooth of g1 meets a gap of g2 on the line of centres
    g2 = affinity.rotate(g2, 180 / z2, origin=(0, 0)); g2 = affinity.translate(g2, a, 0)
    m1, m2 = extrude(g1, 0, thickness), extrude(g2, 0, thickness)
    res = []; ok = True
    # sweep: gear1 turns by theta, gear2 by -theta*z1/z2 about its own centre
    worst = 0.0
    for th in np.linspace(0, 360 / z1 * 2, 13):
        r1 = motion.rot(m1, [0, 0, 0], [0, 0, 1], th); r2 = motion.rot(m2, [a, 0, 0], [0, 0, 1], -th * z1 / z2)
        i = inter(r1, r2); v = float(i.volume) if len(i.faces) else 0.0; worst = max(worst, v)
    ok = worst < 0.5
    gap0 = motion.min_gap(m1, motion.rot(m2, [a, 0, 0], [0, 0, 1], 0), 4000)
    return [Part("gear1", m1, "#FF66B2", "gear"), Part("gear2", m2, "#FFFFFF", "gear")], \
        {"center_distance_mm": round(a, 3), "ratio": f"{z1}:{z2}", "mesh_sweep": {"poses": 13, "worst_overlap_mm3": round(worst, 3), "min_gap_mm": round(gap0, 3), "ok": ok},
         "notes": [f"Backlash {backlash} mm (printing: use >= {clr/2:.2f} mm for {material}).", "Involute profile, 20 deg pressure angle; verify mesh by hand-turning a test print before mounting.",
                   "Gear tooth overlap sweep passed" if ok else "WARNING: teeth collide - increase backlash/center distance"]}


def hinge(length=40.0, leaf_w=20.0, leaf_t=3.0, knuckles=5, pin_d=3.0, material=DEFAULT_MATERIAL, range_deg=(-90, 90)):
    clr = MATERIALS[material]["clearance"]
    kd = pin_d + 5.0; kl = length / knuckles
    A, B = [], []
    for i in range(knuckles):
        z0, z1 = i * kl, (i + 1) * kl - clr
        kn = trimesh.creation.cylinder(kd / 2, z1 - z0, sections=48); kn.apply_translation([0, 0, (z0 + z1) / 2])
        leaf = extrude(sbox(-leaf_w if i % 2 == 0 else 0, -leaf_t / 2, 0 if i % 2 == 0 else leaf_w, leaf_t / 2), z0, z1)
        piece = union([kn, leaf])
        bore = trimesh.creation.cylinder(pin_d / 2 + clr, z1 - z0 + 0.2, sections=48); bore.apply_translation([0, 0, (z0 + z1) / 2])
        (A if i % 2 == 0 else B).append((piece, bore))
    pin = trimesh.creation.cylinder(pin_d / 2, length + 1.0, sections=48); pin.apply_translation([0, 0, length / 2])
    head = trimesh.creation.cylinder(pin_d / 2 + 1.0, 1.2, sections=48); head.apply_translation([0, 0, -0.6])
    # pin is fused to leaf-A knuckles (print-in-place), leaf-B knuckles ride on it with clearance
    leafA = union([p for p, _ in A] + [pin, head])
    leafB = union([diff(p, b) for p, b in B]) if B else trimesh.Trimesh()
    sw = motion.sweep({"leafA": leafA}, {"leafB": leafB}, [0, 0, 0], [0, 0, 1], range_deg[0], range_deg[1], step=15, min_gap_mm=0.1, overlap_tol=0.3,
                      pair_filter=None)
    # leaf B only contacts leaf A at the pin by design: gap measured includes pin clearance
    return [Part("hinge_leaf_A", leafA, "#FF66B2", "hinge"), Part("hinge_leaf_B", leafB, "#FFFFFF", "hinge")], \
        {"clearance_mm": clr, "sweep": sw, "notes": ["Print flat as modelled (axis vertical = knuckle layers stacked); no supports needed.", "Free the hinge by flexing it once after printing."]}


def mounting_plate(w=60, d=40, t=3.0, holes=((-20, -12), (20, -12), (-20, 12), (20, 12)), screw="M3", countersink=True):
    sc = {"M2": 2.4, "M3": 3.4, "M4": 4.5}[screw]
    g = rrect(0, 0, w, d, 3.0); m = extrude(g, 0, t)
    for (x, y) in holes:
        m = diff(m, extrude(circle(x, y, sc / 2), -0.1, t + 0.1))
        if countersink:
            cone = trimesh.creation.cone(sc * 1.0, t * 0.6, sections=48); cone.apply_translation([x, y, t * 0.4 + 0]); m = diff(m, cone) if False else m
    return [Part("mounting_plate", m, "#cccccc", "plate")], {"holes": len(holes), "clearance_hole_mm": sc, "notes": ["Clearance holes (loose fit) sized for %s." % screw]}


# ----------------------------------------------------------------------------- multi-part assembly
def split_model(mesh: trimesh.Trimesh, axis="x", max_len=238.0, pin_d=4.0, material=DEFAULT_MATERIAL):
    from .split import split_mesh, auto_cuts
    ax = "xyz".index(axis); lo = mesh.bounds[0][ax]; L = mesh.extents[ax]
    cuts = auto_cuts(L, lo, max_len) if L > max_len else [lo + L / 2]
    pcs, rep = split_mesh(mesh, cuts, ax, pin_d=pin_d, pin_len=pin_d * 2, clearance=MATERIALS[material]["clearance"] - 0.1, pins=3)
    parts = [Part(f"piece{i + 1}", pc, "#cccccc", "split") for i, pc in enumerate(pcs)]
    return parts, {"cuts": rep, "notes": ["Pieces are glued; pins (where listed) only align them. Cut planes are straight."]}


# ----------------------------------------------------------------------------- primitive-assembly designer (text/description -> JSON spec -> model)
def from_spec(spec: dict):
    """spec = {"parts":[{"name","shape":box|cylinder|sphere|cone|capsule|text,"size":[..],"pos":[x,y,z],"rot":[rx,ry,rz deg],"color":"#hex","op":"add|cut","group"}]}
    Deterministic and safe (no code execution). An LLM backend can emit this schema; so can a human."""
    parts = []; meshes = {}
    for i, s in enumerate(spec.get("parts", [])):
        sh = s["shape"]; sz = s.get("size", [10, 10, 10])
        if sh == "box": m = trimesh.creation.box(sz)
        elif sh == "cylinder": m = trimesh.creation.cylinder(sz[0] / 2, sz[1], sections=48)
        elif sh == "sphere": m = trimesh.creation.icosphere(subdivisions=3, radius=sz[0] / 2); m.apply_scale([1, (sz[1] / sz[0]) if len(sz) > 1 else 1, (sz[2] / sz[0]) if len(sz) > 2 else 1])
        elif sh == "cone": m = trimesh.creation.cone(sz[0] / 2, sz[1], sections=48); m.apply_translation([0, 0, -sz[1] / 2])
        elif sh == "capsule": m = trimesh.creation.capsule(sz[1], sz[0] / 2)
        elif sh == "text": m = extrude(textgeo.text_polygons(s["text"], sz[0], max_width_mm=sz[1] if len(sz) > 1 else None), -sz[2] / 2 if len(sz) > 2 else -0.5, (sz[2] / 2) if len(sz) > 2 else 0.5)
        else: raise ValueError(f"unknown shape {sh}")
        for ax, a in zip("xyz", s.get("rot", [0, 0, 0])):
            if a: m.apply_transform(trimesh.transformations.rotation_matrix(math.radians(a), [1 if ax == "x" else 0, 1 if ax == "y" else 0, 1 if ax == "z" else 0]))
        m.apply_translation(s.get("pos", [0, 0, 0])); meshes[i] = m
    # apply cuts to previous adds in order
    items = []
    for i, s in enumerate(spec.get("parts", [])):
        if s.get("op", "add") == "cut":
            items = [(n, diff(m, meshes[i]), c, g) for (n, m, c, g) in items]
        else: items.append((s.get("name", f"part{i}"), meshes[i], s.get("color", "#cccccc"), s.get("group", "main")))
    zmin = min(m.bounds[0][2] for _, m, _, _ in items)
    for n, m, c, g in items: m = m.copy(); m.apply_translation([0, 0, -zmin]); parts.append(Part(n, m, c, g))
    return parts, {"notes": ["Built from a primitive-shape spec (box/cylinder/sphere/cone/capsule/text) - editable JSON.", "Organic detail beyond primitives needs an image/text-to-3D backend."]}
