"""Keyboard designer: layouts, switch plate, bottom case, top bezel, tilt wedge. Mechanical (MX plate) geometry only.

HONESTY: nothing here claims compatibility with a specific PCB, controller or stabilizer product.
Geometry follows the widely published Cherry MX plate-cutout conventions (14.0 mm square, 1.5 mm plate, 19.05 mm pitch,
2u stabilizer spacing 23.8 mm...). PCB-specific features (mounting holes, USB position) are created ONLY from
a PCB profile the user supplies, otherwise USB uses a clearly-labelled default position.
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
import numpy as np
from shapely import affinity
from shapely.geometry import box as sbox, Point, Polygon
from shapely.ops import unary_union
from . import solids as S
from .meshutil import Part, polys, rrect

U = 19.05
MX_CUTOUT = 14.0
STAB_SPACING = {2.0: 23.8, 2.25: 23.8, 2.75: 23.8, 3.0: 38.1, 6.0: 95.25, 6.25: 100.0, 7.0: 114.3, 8.0: 133.35}   # mm c-c, widely published; VERIFY vs your stabilizer
STAB_CUTOUT = (6.65, 12.3)   # plate-mount Cherry-style housing window (w,h) - simplified rectangle, no wire notch

SCREWS = {"M2": {"boss_d": 4.6, "pilot": 1.7, "clear": 2.4, "head_d": 4.2}, "M3": {"boss_d": 7.0, "pilot": 2.6, "clear": 3.4, "head_d": 6.0}}


def _row(spec):
    keys = []; x = 0.0
    for t in spec:
        if isinstance(t, (int, float)): x += t; continue
        lab, w = t[0], t[1]; h = t[2] if len(t) > 2 else 1.0
        keys.append({"label": lab, "x": x, "w": w, "h": h}); x += w
    return keys


def _alpha_row(labs, ws=None): return [(l, 1) for l in labs]


def layout(name: str):
    """Returns list of keys {label,x,y,w,h} in key units (x right, y DOWN), ANSI."""
    n = name.lower()
    num = [(c, 1) for c in "1234567890-="]
    r0 = [("`", 1)] + num + [("Bksp", 2)]
    r1 = [("Tab", 1.5)] + [(c, 1) for c in "QWERTYUIOP[]"] + [("\\", 1.5)]
    r2 = [("Caps", 1.75)] + [(c, 1) for c in "ASDFGHJKL;'"] + [("Enter", 2.25)]
    r3 = [("Shift", 2.25)] + [(c, 1) for c in "ZXCVBNM,./"] + [("Shift", 2.75)]
    r4 = [("Ctrl", 1.25), ("Win", 1.25), ("Alt", 1.25), ("Space", 6.25), ("Alt", 1.25), ("Win", 1.25), ("Menu", 1.25), ("Ctrl", 1.25)]
    rows = []
    if n == "60":
        rows = [r0, r1, r2, r3, r4]
    elif n == "65":
        rows = [r0[:-1] + [("Bksp", 2), ("Del", 1)], r1[:-1] + [("\\", 1.5), ("PgUp", 1)], r2[:-1] + [("Enter", 2.25), ("PgDn", 1)],
                r3[:-1] + [("Shift", 1.75), ("Up", 1), ("End", 1)],
                [("Ctrl", 1.25), ("Win", 1.25), ("Alt", 1.25), ("Space", 6.25), ("Alt", 1), ("Fn", 1), ("Left", 1), ("Down", 1), ("Right", 1)]]
    elif n == "75":
        f = [("Esc", 1)] + [(f"F{i}", 1) for i in range(1, 13)] + [("Del", 1), ("PgUp", 1), ("PgDn", 1)]
        rows = [f, r0[:-1] + [("Bksp", 2), ("Home", 1)], r1[:-1] + [("\\", 1.5), ("End", 1)], r2[:-1] + [("Enter", 2.25), ("Ins", 1)],
                r3[:-1] + [("Shift", 1.75), ("Up", 1), ("Fn", 1)],
                [("Ctrl", 1.25), ("Win", 1.25), ("Alt", 1.25), ("Space", 6.25), ("Alt", 1), ("Ctrl", 1), ("Left", 1), ("Down", 1), ("Right", 1)]]
    elif n in ("tkl", "full"):
        f = [("Esc", 1), 1.0] + [(f"F{i}", 1) for i in range(1, 5)] + [0.5] + [(f"F{i}", 1) for i in range(5, 9)] + [0.5] + [(f"F{i}", 1) for i in range(9, 13)] + [0.25, ("PrtSc", 1), ("ScrLk", 1), ("Pause", 1)]
        rows = [f,
                r0 + [0.25, ("Ins", 1), ("Home", 1), ("PgUp", 1)],
                r1 + [0.25, ("Del", 1), ("End", 1), ("PgDn", 1)],
                r2,
                r3 + [1.25, ("Up", 1)],
                r4 + [0.25, ("Left", 1), ("Down", 1), ("Right", 1)]]
    else:
        raise ValueError("layout must be 60, 65, 75, tkl or full")
    keys = []
    for ri, r in enumerate(rows):
        spec = r
        for k in _row(spec): k["y"] = ri; keys.append(k)
    if n == "full":
        nx = 18.5 + 0.25 - 0.25    # numpad starts after nav cluster (x=15.25..18.25) + 0.25 gap
        nx = 18.5
        pad = [("NumLk", 0, 1, 1, 1), ("/", 1, 1, 1, 1), ("*", 2, 1, 1, 1), ("-", 3, 1, 1, 1),
               ("7", 0, 2, 1, 1), ("8", 1, 2, 1, 1), ("9", 2, 2, 1, 1), ("+", 3, 2, 1, 2),
               ("4", 0, 3, 1, 1), ("5", 1, 3, 1, 1), ("6", 2, 3, 1, 1),
               ("1", 0, 4, 1, 1), ("2", 1, 4, 1, 1), ("3", 2, 4, 1, 1), ("Ent", 3, 4, 1, 2),
               ("0", 0, 5, 2, 1), (".", 2, 5, 1, 1)]
        for lab, cx, cy, w, h in pad: keys.append({"label": lab, "x": nx + cx, "y": cy, "w": w, "h": h})
    return keys


def stab_spec(k):
    """(orientation, spacing) for keys that need a stabilizer, else None."""
    if k["h"] >= 2 and k["w"] == 1: return ("v", 23.8)
    if k["w"] >= 2:
        s = STAB_SPACING.get(k["w"]); return ("h", s) if s else ("unsupported", None)
    return None


@dataclass
class KbParams:
    layout: str = "60"
    padding: float = 7.0
    wall: float = 2.4
    floor: float = 2.4
    plate_t: float = 1.5
    internal_depth: float = 12.0       # plate underside -> floor top. ASSUMPTION: 5.0 plate->PCB + 1.6 PCB + clearance; set from your PCB
    plate_to_pcb: float = 5.0
    pcb_t: float = 1.6
    corner_r: float = 3.0
    split_angle: float = 0.0           # ergonomic splay per half (deg), 0 = unibody
    split_col: float | None = None     # x (in key units) where the halves split; default centre
    tilt_deg: float = 0.0              # typing angle, implemented as a separate printed wedge
    screw: str = "M2"
    usb_x: float | None = None         # mm from left outer edge to USB-C centre (back wall); default centre
    usb_z_from_pcb_top: float = 1.7    # ASSUMPTION: connector soldered on PCB top; centre ~ half the 3.26 mm height
    usb_w: float = 10.0
    usb_h: float = 4.2                 # 8.94x3.26 receptacle + ~0.5-1.0 tolerance (USB-C receptacle dims per USB-IF mechanical spec; confirm for your connector)
    bezel_h: float = 3.5               # height of top bezel above plate top
    window_margin: float = 1.0
    cutout_tol: float = 0.0            # +/- on the 14.0 mm switch window
    pcb: dict | None = None            # {"name","holes":[{"x","y","d"}]}  x,y mm from the layout's top-left key corner (y down)
    split_for_bed: bool = True         # auto-split parts longer than the P2S usable bed (see split.py)
    max_piece: float = 238.0
    color_case: str = "#050505"; color_plate: str = "#FF66B2"; color_bezel: str = "#050505"; color_wedge: str = "#050505"


def key_geometry(p: KbParams):
    """Return list of dicts with centre (mm), rotation, footprints. Y is flipped to math orientation (up)."""
    ks = layout(p.layout)
    W = max(k["x"] + k["w"] for k in ks)
    split_x = p.split_col if p.split_col is not None else W / 2
    out = []
    for k in ks:
        cx = (k["x"] + k["w"] / 2) * U; cy = -(k["y"] + k["h"] / 2) * U
        half = 0 if (k["x"] + k["w"] / 2) < split_x else 1
        out.append({**k, "cx": cx, "cy": cy, "half": half, "rot": 0.0})
    if p.split_angle:
        for h, sgn in ((0, 1), (1, -1)):
            hs = [o for o in out if o["half"] == h]
            if not hs: continue
            pivot = (np.mean([o["cx"] for o in hs]), np.mean([o["cy"] for o in hs]))
            for o in hs:
                pt = affinity.rotate(Point(o["cx"], o["cy"]), sgn * p.split_angle, origin=pivot)
                o["cx"], o["cy"], o["rot"] = pt.x, pt.y, sgn * p.split_angle
        gap = 0.0
        left = [o for o in out if o["half"] == 0]; right = [o for o in out if o["half"] == 1]
        if left and right:
            def edge(o): return o["cx"] + o["w"] * U / 2 * math.cos(math.radians(o["rot"]))
            lmax = max(edge(o) for o in left); rmin = min(o["cx"] - o["w"] * U / 2 * math.cos(math.radians(o["rot"])) for o in right)
            shift = (lmax + 8.0) - rmin    # keep >= 8 mm between the halves
            for o in right: o["cx"] += shift
    return out


def _foot(o, w=None, h=None):
    return rrect(o["cx"], o["cy"], w if w is not None else o["w"] * U, h if h is not None else o["h"] * U, 0, angle=o["rot"])


def build(p: KbParams):
    """Returns (parts: list[Part], info: dict). Parts are meshes + step features."""
    keys = key_geometry(p); sc = SCREWS[p.screw]
    cut = MX_CUTOUT + p.cutout_tol
    sw = [_foot(o, cut, cut) for o in keys]
    stabs = []; unsupported = []
    for o in keys:
        sp = stab_spec(o)
        if not sp: continue
        if sp[0] == "unsupported": unsupported.append(o["label"]); continue
        ori, s = sp
        for d in (-s / 2, s / 2):
            cx, cy = (o["cx"] + d, o["cy"]) if ori == "h" else (o["cx"], o["cy"] + d)
            w, h = (STAB_CUTOUT if ori == "h" else (STAB_CUTOUT[0], STAB_CUTOUT[1]))
            pt = affinity.rotate(Point(cx, cy), o["rot"], origin=(o["cx"], o["cy"]))
            stabs.append(rrect(pt.x, pt.y, w if ori == "h" else STAB_CUTOUT[1], h if ori == "h" else STAB_CUTOUT[0], 0, angle=o["rot"]))
    foot = unary_union([_foot(o) for o in keys])
    halves = []
    for h in (0, 1):
        g = [_foot(o) for o in keys if o["half"] == h]
        if g: halves.append(unary_union(g).minimum_rotated_rectangle if p.split_angle else None)
    if p.split_angle:
        base = unary_union([hh.buffer(0) for hh in halves if hh is not None])
        base = unary_union([base, base.convex_hull.buffer(0).intersection(foot.buffer(U / 2)).buffer(0)]) if False else base
        bridge = unary_union(halves).convex_hull
        base = bridge if False else base
    else:
        base = foot.minimum_rotated_rectangle if False else sbox(*foot.bounds)
    outer = base.buffer(p.padding, join_style=1).buffer(-p.corner_r).buffer(p.corner_r, quad_segs=8) if not p.split_angle else \
        unary_union([hh.buffer(p.padding, join_style=1) for hh in halves if hh is not None])
    outer = outer.buffer(0)
    inner = outer.buffer(-p.wall)
    plate_out = outer.buffer(-0.15)     # plate rests on the case wall tops, clamped by the bezel
    z_floor = p.floor; z_plate_bot = z_floor + p.internal_depth; z_plate_top = z_plate_bot + p.plate_t
    pcb_top = z_plate_bot - p.plate_to_pcb; pcb_bot = pcb_top - p.pcb_t

    # screw posts: farthest-point sampling inside the rim zone free of key footprints
    keep_out = unary_union([sbox(*g.bounds).buffer(0) if False else g for g in sw + stabs]).buffer(1.2)
    r_post = sc["boss_d"] / 2
    free = inner.buffer(-0.4).difference(keep_out)
    cands = []
    minx, miny, maxx, maxy = outer.bounds
    for x in np.arange(minx, maxx, 1.0):
        for y in np.arange(miny, maxy, 1.0):
            pt = Point(x, y)
            if free.contains(pt.buffer(r_post + 0.3, quad_segs=4)): cands.append((x, y))
    posts = []
    if cands:
        c = np.array(cands); cen = np.array([[outer.centroid.x, outer.centroid.y]])
        first = c[np.argmax(((c - cen) ** 2).sum(1))]; posts = [first]
        n_target = 8 if max(outer.bounds[2] - outer.bounds[0], 1) > 250 else 6 if (outer.bounds[2] - outer.bounds[0]) > 150 else 4
        while len(posts) < n_target:
            d = np.min([((c - q) ** 2).sum(1) for q in posts], axis=0)
            if d.max() < (25.0) ** 2: break
            posts.append(c[np.argmax(d)])
    posts = [tuple(map(float, q)) for q in posts]

    # ---- plate
    plate_feats = [S.poly(plate_out, z_plate_bot, z_plate_top),
                   S.poly(unary_union(sw + stabs), z_plate_bot - 0.1, z_plate_top + 0.1, "cut")]
    for (x, y) in posts: plate_feats.append(S.cyl(x, y, sc["clear"] / 2 + 0.2, z_plate_bot - 0.1, z_plate_top + 0.1, "cut"))
    # ---- bottom case
    bc = [S.poly(outer, 0, z_plate_bot), S.poly(inner, z_floor, z_plate_bot + 0.1, "cut")]
    for (x, y) in posts:
        bc.append(S.cyl(x, y, r_post, z_floor - 0.1, z_plate_bot - 0.0))
        bc.append(S.cyl(x, y, sc["pilot"] / 2, z_floor + 0.6, z_plate_bot + 0.1, "cut"))
    # split planes (case) + splice ribs under the PCB so alignment pins have material
    case_cuts = []
    if p.split_for_bed and (maxx - minx) > p.max_piece:
        from .split import auto_cuts
        case_cuts = auto_cuts(maxx - minx, minx, p.max_piece)
        for cx_ in case_cuts:
            rib_top = max(z_floor + 1.0, pcb_bot - 3.0)
            bc.append(S.poly(sbox(cx_ - 6, miny + p.wall - 0.1, cx_ + 6, maxy - p.wall + 0.1), z_floor - 0.1, rib_top))
    # USB-C opening in the back (max y) wall
    ux = (minx + (maxx - minx) / 2) if p.usb_x is None else minx + p.usb_x
    uz = pcb_top + p.usb_z_from_pcb_top
    usb = sbox(ux - p.usb_w / 2, maxy - p.wall - 1.0, ux + p.usb_w / 2, maxy + 1.0)
    usb_ok = (uz - p.usb_h / 2) > z_floor and (uz + p.usb_h / 2) < z_plate_bot
    bc_usb = {"shape": ("poly", usb), "z0": uz - p.usb_h / 2, "z1": uz + p.usb_h / 2, "mode": "cut"}
    bc.append(bc_usb)
    pcb_posts = []
    if p.pcb and p.pcb.get("holes"):
        gx0, gy1 = min(o["cx"] - o["w"] * U / 2 for o in keys), max(o["cy"] + o["h"] * U / 2 for o in keys)
        for hdef in p.pcb["holes"]:
            x, y = gx0 + hdef["x"], gy1 - hdef["y"]
            pcb_posts.append((x, y, hdef.get("d", 2.2)))
            bc.append(S.cyl(x, y, max(hdef.get("d", 2.2) / 2 + 1.5, 2.2), z_floor - 0.1, pcb_bot - 0.0))
            bc.append(S.cyl(x, y, 0.9, z_floor + 0.4, pcb_bot + 0.1, "cut"))
    # ---- bezel (top case): ring over the rim, window over the keys
    win = unary_union([g.buffer(U / 2 - MX_CUTOUT / 2 + p.window_margin - 0.0) for g in sw]).buffer(0)
    win = unary_union([_foot(o).buffer(p.window_margin - 0.5) for o in keys]).buffer(0)
    bz = [S.poly(outer, z_plate_top, z_plate_top + p.bezel_h), S.poly(win, z_plate_top - 0.1, z_plate_top + p.bezel_h + 0.1, "cut")]
    for (x, y) in posts: bz.append(S.cyl(x, y, sc["clear"] / 2, z_plate_top - 0.1, z_plate_top + p.bezel_h + 0.1, "cut"))
    # counterbore for screw heads from the top
    for (x, y) in posts: bz.append(S.cyl(x, y, sc["head_d"] / 2 + 0.2, z_plate_top + p.bezel_h - 1.8, z_plate_top + p.bezel_h + 0.1, "cut"))
    parts = [("plate", plate_feats, p.color_plate, "plate"), ("bottom_case", bc, p.color_case, "case"), ("top_bezel", bz, p.color_bezel, "case")]
    wedge = None
    if p.tilt_deg > 0:
        depth_y = maxy - miny; t0 = 2.0; hmax = t0 + depth_y * math.tan(math.radians(p.tilt_deg)) + 0.5
        ring = outer.difference(outer.buffer(-p.wall - 3.0))
        wedge_f = [S.poly(ring, 0, hmax)]
        # sloped top: height(y) = t0 + (y - miny) tan(theta); remove everything above that plane
        th = math.radians(p.tilt_deg); n = (0, -math.sin(th), math.cos(th))
        wedge_f.append(S.cut_above((0, miny, t0), n))
        parts.append(("tilt_wedge", wedge_f, p.color_wedge, "wedge"))
    out = []; split_report = []
    for name, feats, color, group in parts:
        m = S.to_mesh(feats)
        if case_cuts and m.extents[0] > p.max_piece:
            from .split import split_mesh
            if name == "plate":
                rows = max(int(math.ceil(max(-o["cy"] + o["h"] * U / 2 for o in keys) / U)), 1)
                regs, rep, prev = [], [], None
                for c in sorted(case_cuts):
                    reg, w = _stepped_left(c, sw + stabs, rows, minx, maxx, miny, maxy)
                    regs.append(reg if prev is None else reg.difference(prev)); prev = reg if prev is None else prev.union(reg)
                    rep.append({"cut_at_mm": round(c, 2), "pins": 0, "joint": "zig-zag butt joint through window-free gaps: glue (or tape underneath)", "warnings": w})
                regs.append(Polygon([(minx - 60, miny - 60), (maxx + 60, miny - 60), (maxx + 60, maxy + 60), (minx - 60, maxy + 60)]).difference(prev))
                pcs = []
                for reg in regs:
                    pf = [S.poly(plate_out.intersection(reg), z_plate_bot, z_plate_top),
                          S.poly(unary_union(sw + stabs), z_plate_bot - 0.1, z_plate_top + 0.1, "cut")]
                    for (x, y) in posts: pf.append(S.cyl(x, y, sc["clear"] / 2 + 0.2, z_plate_bot - 0.1, z_plate_top + 0.1, "cut"))
                    pcs.append(S.to_mesh(pf))
            else:
                pcs, rep = split_mesh(m, case_cuts, 0, pin_d=2.0, pin_len=5.0)
            split_report.append({"part": name, "cuts": rep})
            for i, pc in enumerate(pcs, 1):
                out.append(Part(f"{name}_{i}of{len(pcs)}", pc, color, group, step_shape=feats if i == 1 else None, meta={"split_from": name}))
        else:
            out.append(Part(name, m, color, group, step_shape=feats))
    nstab = len(stabs) // 2
    info = {"layout": p.layout, "keys": len(keys), "stabilized_keys": nstab, "unsupported_stab_keys": unsupported,
            "outer_size_mm": [round(maxx - minx, 2), round(maxy - miny, 2)], "z": {"floor_top": z_floor, "pcb_top_assumed": round(pcb_top, 2),
            "plate_bottom": round(z_plate_bot, 2), "plate_top": round(z_plate_top, 2), "total_height": round(z_plate_top + p.bezel_h, 2)},
            "screw_posts": posts, "usb": {"x_mm": round(ux - minx, 2), "z_center": round(uz, 2), "fits_in_wall": bool(usb_ok), "default_position": p.usb_x is None},
            "pcb_standoffs": len(pcb_posts), "split": split_report, "case_cuts_x": [round(c, 2) for c in case_cuts], "keys_geom": [{k: (round(v, 3) if isinstance(v, float) else v) for k, v in o.items()} for o in keys],
            "switch_cutouts": [list(g.bounds) for g in sw], "tilt_deg": p.tilt_deg, "split_angle": p.split_angle,
            "honesty": ["No PCB profile supplied: PCB standoffs NOT generated; PCB is held by its switches in the plate." if not pcb_posts else f"PCB standoffs generated from profile '{p.pcb.get('name','?')}' - verify hole coordinates against the PCB's own drawing.",
                        "USB-C opening uses the default position/size - move it to match YOUR PCB/controller." if p.usb_x is None else "USB-C position user-defined.",
                        "Stabilizer windows are a simplified rectangle of the Cherry-style plate-mount housing; print the fit-test plate before the full plate.",
                        "Controller mounting: none generated (depends on the PCB). RGB LED clearance: depends on PCB/switch type, plate-to-PCB distance set to %.1f mm." % p.plate_to_pcb]}
    return out, info


def _stepped_left(c0, windows, rows, xmin, xmax, ymin, ymax):
    """Region left of a zig-zag cut that passes only through window-free gaps. Returns (polygon, warnings)."""
    from shapely.geometry import LineString
    uw = unary_union(windows).buffer(1.5); warns = []; pts = []   # keep >=1.5 mm of plate on both sides of the cut
    bands = [(-(r + 1) * U, -r * U) for r in range(rows)]
    xs = []
    for (y0, y1) in bands:
        found = None
        for dx in np.arange(0, 60, 0.25):
            for sgn in (1, -1):
                x = c0 + sgn * dx
                if not LineString([(x, y0 + 0.3), (x, y1 - 0.3)]).intersects(uw): found = x; break
            if found is not None: break
        if found is None: found = c0; warns.append(f"row band {bands.index((y0, y1))}: no window-free x within 60mm")
        xs.append(found)
    poly = []
    top = bands[0][1] + 50; bot = bands[-1][0] - 50
    poly.append((xmin - 50, top))
    poly.append((xs[0], top))
    for i, (y0, y1) in enumerate(bands):
        poly += [(xs[i], y1), (xs[i], y0)]
        if i + 1 < len(bands): poly += [(xs[i + 1], y0)]
    poly += [(xs[-1], bot), (xmin - 50, bot)]
    reg = Polygon(poly).buffer(0)
    for (x0_, y0_, x1_, y1_) in [(0, 0, 0, 0)]: pass
    # horizontal steps must not cross a window
    steps = unary_union([LineString([(xs[i], bands[i][0]), (xs[i + 1], bands[i][0])]) for i in range(len(bands) - 1) if xs[i] != xs[i + 1]]) if len(bands) > 1 else None
    if steps is not None and not steps.is_empty and steps.intersects(uw): warns.append("a zig-zag step crosses a switch window (tall numpad key near the cut)")
    return reg, warns


def fit_test_plate(p: KbParams | None = None):
    """Small plate: one 1u switch window + one 2u switch with stabilizer windows, for a quick physical fit test."""
    p = p or KbParams()
    sw1 = rrect(0, 0, MX_CUTOUT, MX_CUTOUT)
    c2 = (U * 2.5, 0)
    sw2 = rrect(c2[0], 0, MX_CUTOUT, MX_CUTOUT)
    st = [rrect(c2[0] + d, 0, STAB_CUTOUT[0], STAB_CUTOUT[1]) for d in (-11.9, 11.9)]
    outline = sbox(-U / 2 - 3, -U / 2 - 3, c2[0] + U + 3, U / 2 + 3)
    feats = [S.poly(outline, 0, p.plate_t), S.poly(unary_union([sw1, sw2] + st), -0.1, p.plate_t + 0.1, "cut")]
    return Part("fit_test_plate", S.to_mesh(feats), p.color_plate, "test", step_shape=feats)
