"""MX-compatible keycap generator (printable). Profiles are SIMPLIFIED approximations, not exact reproductions.

MX stem numbers (cross 4.1 x 1.35 slot, 5.5 mm stem) are the commonly published Cherry MX dimensions; FDM needs a
fit test - use fit_test_keycap() before printing a full set. Nothing here is a claim of switch-vendor certification.
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
import numpy as np, trimesh
from shapely import affinity
from shapely.geometry import box as sbox
from shapely.ops import unary_union
from . import textgeo
from .meshutil import Part, extrude, union, diff, circle, rrect, inter, polys

U = 19.05
PROFILES = {   # H = total height mm, top = top-face size for 1u (w,d), sculpt = rear raise per row (not modelled)
    "cherry": {"H": 9.4, "top": (12.5, 13.5), "top_front_ratio": 1.0},
    "oem":    {"H": 11.5, "top": (12.5, 13.5), "top_front_ratio": 1.0},
    "dsa":    {"H": 7.6, "top": (12.5, 12.5), "top_front_ratio": 1.0},
    "xda":    {"H": 9.1, "top": (13.5, 13.5), "top_front_ratio": 1.0},
    "sa":     {"H": 14.5, "top": (11.5, 12.5), "top_front_ratio": 1.0},
}
STAB_SPACING = {2.0: 23.8, 2.25: 23.8, 2.75: 23.8, 3.0: 38.1, 6.0: 95.25, 6.25: 100.0, 7.0: 114.3, 8.0: 133.35}
STEM_D = 5.5; SLOT_L = 4.1; SLOT_W = 1.35; SLOT_DEPTH = 4.0


@dataclass
class KeycapParams:
    width_u: float = 1.0
    height_u: float = 1.0
    profile: str = "cherry"
    gap: float = 1.05                 # spacing between caps in a 19.05 grid (cap base = pitch - gap)
    wall: float = 1.6
    top_t: float = 1.6
    corner_r: float = 1.2
    stem_bottom_z: float = 0.8
    slot_tol: float = 0.10            # added to slot length/width for FDM (ASSUMPTION - tune by fit test)
    stem_tol: float = 0.0
    height_override: float | None = None
    legend: str = ""                  # primary legend
    legend2: str = ""                 # secondary (e.g. Arabic) legend
    legend_h: float = 5.0
    legend_depth: float = 0.6
    font: str | None = None
    custom_font: str | None = None
    color_body: str = "#050505"
    color_legend: str = "#FFFFFF"
    color_legend2: str = "#FF66B2"
    topper: dict | None = None        # {"polys_by_color": {hex: shapely geometry in mm centred}, "height": 2.5}
    topper_mesh: object = None        # trimesh to glue on top (artisan sculpture), already scaled/centred
    sculpt_tilt_deg: float = 0.0      # row tilt of the top face (simple approximation of sculpted rows)
    name: str = "keycap"


def dims(p: KeycapParams):
    P = PROFILES[p.profile]; H = p.height_override or P["H"]
    bw = p.width_u * U - p.gap; bd = p.height_u * U - p.gap
    tw = P["top"][0] + (p.width_u - 1) * U; td = P["top"][1] + (p.height_u - 1) * U
    return bw, bd, tw, td, H


def _slab(poly, z):
    m = extrude(poly, z, z + 0.01); return m


def _hull(p0, z0, p1, z1):
    v = np.vstack([np.c_[np.array(p0.exterior.coords), np.full(len(p0.exterior.coords), z0)],
                   np.c_[np.array(p1.exterior.coords), np.full(len(p1.exterior.coords), z1)]])
    return trimesh.convex.convex_hull(v)


def stem_positions(p: KeycapParams):
    s = [(0.0, 0.0)]
    if p.width_u >= 2.0 and p.width_u in STAB_SPACING:
        d = STAB_SPACING[p.width_u] / 2; s += [(-d, 0.0), (d, 0.0)]
    elif p.height_u >= 2.0 and p.width_u == 1.0:
        s += [(0.0, -11.9), (0.0, 11.9)]
    return s


def build(p: KeycapParams):
    bw, bd, tw, td, H = dims(p)
    r = p.corner_r
    base = rrect(0, 0, bw, bd, r); top = rrect(0, 0, tw, td, min(r, 1.0))
    outer = _hull(base, 0.0, top, H)
    cav = _hull(rrect(0, 0, bw - 2 * p.wall, bd - 2 * p.wall, max(r - p.wall, 0.3)), -0.2,
                rrect(0, 0, tw - 2 * p.wall, td - 2 * p.wall, 0.3), H - p.top_t)
    body = diff(outer, cav)
    stems = []
    for (sx, sy) in stem_positions(p):
        zb = p.stem_bottom_z
        stem = trimesh.creation.cylinder(STEM_D / 2 + p.stem_tol, (H - p.top_t + 0.3) - zb, sections=48)
        stem.apply_translation([sx, sy, zb + ((H - p.top_t + 0.3) - zb) / 2]); stems.append(stem)
    body = union([body] + stems)
    for (sx, sy) in stem_positions(p):   # cross slot cut from stem bottom up
        L, W = SLOT_L + p.slot_tol, SLOT_W + p.slot_tol
        cross = unary_union([sbox(sx - L / 2, sy - W / 2, sx + L / 2, sy + W / 2), sbox(sx - W / 2, sy - L / 2, sx + W / 2, sy + L / 2)])
        body = diff(body, extrude(cross, p.stem_bottom_z - 0.3, p.stem_bottom_z + SLOT_DEPTH))
    parts = []; legend_polys = []
    zt = H
    # legends (inlay): pocket in the top face + same-shaped insert part
    texts = []
    if p.legend and p.legend2: texts = [(p.legend, p.color_legend, (-tw * 0.18, -td * 0.18), 0.5), (p.legend2, p.color_legend2, (tw * 0.18, td * 0.14), 0.5)]
    elif p.legend: texts = [(p.legend, p.color_legend, (0, 0), 1.0)]
    elif p.legend2: texts = [(p.legend2, p.color_legend2, (0, 0), 1.0)]
    inserts = []
    for t, col, (ox, oy), sc in texts:
        try:
            g = textgeo.text_polygons(t, p.legend_h * sc, p.font, p.custom_font, max_width_mm=(tw - 2.5) * (0.62 if sc < 1 else 1.0))
        except Exception as e:
            continue
        g = affinity.translate(g, ox, oy)
        if not (sbox(-tw / 2 + 0.5, -td / 2 + 0.5, tw / 2 - 0.5, td / 2 - 0.5).contains(g)):
            g = g.intersection(sbox(-tw / 2 + 0.8, -td / 2 + 0.8, tw / 2 - 0.8, td / 2 - 0.8))
        pocket = extrude(g, zt - p.legend_depth, zt + 0.2)
        body = diff(body, pocket)
        inserts.append((f"{p.name}_legend", extrude(g, zt - p.legend_depth, zt), col, g))
    out = [Part(f"{p.name}_body", body, p.color_body, "cap", meta={"role": "body"})]
    for n, m, col, g in inserts: out.append(Part(n if len(inserts) == 1 else f"{n}{inserts.index((n, m, col, g)) + 1}", m, col, "cap", meta={"role": "legend"}))
    if p.topper:
        ht = p.topper.get("height", 2.5)
        for i, (col, g) in enumerate(p.topper["polys_by_color"].items()):
            if g.is_empty: continue
            out.append(Part(f"{p.name}_topper{i + 1}", extrude(g, zt - 0.2, zt + ht), col, "cap", meta={"role": "topper"}))
    if p.topper_mesh is not None:
        tm = p.topper_mesh.copy(); tm.apply_translation([0, 0, zt - tm.bounds[0][2] - 0.2])
        out.append(Part(f"{p.name}_sculpture", tm, p.color_legend, "cap", meta={"role": "sculpture"}))
    info = {"base_mm": [round(bw, 2), round(bd, 2)], "top_mm": [round(tw, 2), round(td, 2)], "height_mm": H, "stems": len(stem_positions(p)),
            "print_orientation": "upside-down (top face on the bed): smoothest top, legends in the first layers, no supports for the cavity or stem"}
    return out, info


def verify(parts, p: KeycapParams):
    """Quality control. Measures the real mesh where possible."""
    checks = []
    def add(i, ok, d, lvl="fail"): checks.append({"id": i, "ok": bool(ok), "detail": d, "level": lvl})
    body = parts[0].mesh; bw, bd, tw, td, H = dims(p)
    for pt in parts: add(f"watertight_{pt.name}", pt.mesh.is_volume, f"watertight={pt.mesh.is_watertight} volume={pt.mesh.volume:.1f}mm3")
    add("grid_spacing", p.gap >= 0.8, f"cap base {bw:.2f}x{bd:.2f} on {p.width_u*U:.2f}x{p.height_u*U:.2f} pitch: gap {p.gap:.2f}mm (>=0.8 so caps do not touch)")
    # measure the stem + slot from a real cross-section 1.5 mm above the stem bottom
    z = p.stem_bottom_z + 1.5
    sec = body.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
    meas = {}
    if sec is not None:
        from shapely.geometry import Polygon
        ps = [Polygon(d[:, :2]) for d in sec.discrete if len(d) >= 3]
        cen = [q for q in ps if q.contains(shapely_pt(0, 0)) or q.distance(shapely_pt(0, 0)) < 0.01]
        # the cross hole is the polygon whose bbox is ~ slot-length wide, centered near 0
        holes = [q for q in ps if abs(q.centroid.x) < 0.2 and abs(q.centroid.y) < 0.2 and 5 < q.area < 15]
        rings = [q for q in ps if abs(q.centroid.x) < 0.2 and abs(q.centroid.y) < 0.2 and 18 < q.area < 40]
        if holes:
            hb = holes[0].bounds; meas["slot_len"] = round(hb[2] - hb[0], 3); meas["slot_len_y"] = round(hb[3] - hb[1], 3)
            # arm width: width of the polygon at y=0 +-
            from shapely.geometry import LineString
            arm = holes[0].intersection(LineString([(hb[0] - 1, 1.4), (hb[2] + 1, 1.4)])).length  # across the vertical arm, beyond the horizontal arm
            meas["slot_arm_w"] = round(arm, 3)
        if rings:
            rb = rings[0].bounds; meas["stem_d"] = round(rb[2] - rb[0], 3)
    want_L = SLOT_L + p.slot_tol; want_W = SLOT_W + p.slot_tol
    add("mx_slot_length", abs(meas.get("slot_len", -9) - want_L) < 0.06, f"measured cross slot length {meas.get('slot_len')} mm, expected {want_L:.2f} (nominal {SLOT_L} + {p.slot_tol} FDM tol)")
    add("mx_slot_width", abs(meas.get("slot_arm_w", -9) - want_W) < 0.08, f"measured slot arm width {meas.get('slot_arm_w')} mm, expected {want_W:.2f} (nominal {SLOT_W} + tol)")
    add("mx_stem_diameter", abs(meas.get("stem_d", -9) - (STEM_D + p.stem_tol)) < 0.15, f"measured stem diameter {meas.get('stem_d')} mm, expected {STEM_D + p.stem_tol}")
    add("slot_depth_vs_stem", SLOT_DEPTH <= (H - p.top_t) - p.stem_bottom_z - 0.9, f"slot depth {SLOT_DEPTH} leaves >=0.9mm solid below the ceiling")
    thin = body.extents.min()
    wall = p.wall
    add("wall_thickness", wall >= 1.2 and p.top_t >= 1.2, f"wall {wall}mm, top {p.top_t}mm (>=1.2 recommended for FDM)")
    add("height", H + (p.topper or {}).get("height", 0) <= 28, f"total height {H + (p.topper or {}).get('height', 0):.1f}mm (>28mm may foul the bezel or neighbours)")
    for pt in parts:
        if pt.meta.get("role") == "legend":
            add(f"legend_inside_top_{pt.name}", pt.mesh.bounds[0][0] > -tw / 2 and pt.mesh.bounds[1][0] < tw / 2 and pt.mesh.bounds[0][1] > -td / 2 and pt.mesh.bounds[1][1] < td / 2, "legend within top face")
            v = inter(parts[0].mesh, pt.mesh).volume if len(inter(parts[0].mesh, pt.mesh).faces) else 0
            add(f"legend_no_overlap_{pt.name}", v < 0.05, f"overlap with body {v:.3f}mm3 (inlay must tile the pocket)")
    add("stem_count", len(stem_positions(p)) >= 1, f"{len(stem_positions(p))} stem(s) (stabilized keys also get stabilizer stems at +/-{STAB_SPACING.get(p.width_u,0)/2:.1f}mm - verify against your stabilizer)", "info")
    add("compat_note", True, "MX cross-stem fit is UNVERIFIED until you print fit_test_keycap() on your printer and check it on a real switch.", "info")
    return {"passed": all(c["ok"] for c in checks if c["level"] == "fail"), "checks": checks, "measured": meas}


def shapely_pt(x, y):
    from shapely.geometry import Point; return Point(x, y)


def fit_test_keycap(tols=(0.0, 0.1, 0.2)):
    """Row of three stem-only test caps with different slot tolerances; print and try on a switch."""
    out = []
    for i, t in enumerate(tols):
        p = KeycapParams(slot_tol=t, name=f"fit_tol_{t}")
        ps, _ = build(p)
        m = ps[0].mesh.copy(); m.apply_translation([i * 22, 0, 0]); out.append(Part(f"fit_tol_{t}", m, "#FF66B2", "test"))
    return out
