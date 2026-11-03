"""Multi-part split: cut a mesh by planes along X (or Y) and add alignment pins/sockets where the section allows."""
from __future__ import annotations
import numpy as np, trimesh
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
from .meshutil import union, diff


def _section_region(mesh, axis, c):
    n = np.zeros(3); n[axis] = 1; o = np.zeros(3); o[axis] = c
    sec = mesh.section(plane_origin=o, plane_normal=n)
    if sec is None: return None
    other = [i for i in range(3) if i != axis]
    pts = [np.array([e[:, other] for e in [d]])[0] for d in sec.discrete]
    polys = [Polygon(p) for p in pts if len(p) >= 3]
    polys = [p.buffer(0) for p in polys if p.area > 0.01]
    if not polys: return None
    # even-odd combine (holes are rings inside rings)
    reg = polys[0]
    for p in polys[1:]: reg = reg.symmetric_difference(p)
    return reg, other


def _pin_points(reg, r, k=3, margin=0.8):
    inner = reg.buffer(-(r + margin))
    if inner.is_empty: return []
    x0, y0, x1, y1 = inner.bounds
    cand = [(x, y) for x in np.linspace(x0, x1, 24) for y in np.linspace(y0, y1, 24) if inner.contains(Point(x, y))]
    if not cand: return []
    c = np.array(cand); chosen = [c[0]]
    while len(chosen) < k:
        d = np.min([((c - q) ** 2).sum(1) for q in chosen], axis=0)
        if d.max() < (3 * r) ** 2: break
        chosen.append(c[np.argmax(d)])
    return [tuple(q) for q in chosen]


def split_mesh(mesh: trimesh.Trimesh, cuts: list[float], axis=0, pin_d=2.0, pin_len=5.0, clearance=0.2, pins=3):
    """Returns (pieces, report). report['joints'] lists per cut: pins placed or 'butt (glue)'."""
    pieces, rem, report = [], mesh, []
    for c in sorted(cuts):
        n = np.zeros(3); n[axis] = 1; o = np.zeros(3); o[axis] = c
        left = rem.slice_plane(o, -n, cap=True); right = rem.slice_plane(o, n, cap=True)
        sec = _section_region(rem, axis, c); placed = 0
        if sec:
            reg, other = sec
            for (u, v) in _pin_points(reg, pin_d / 2 + clearance, pins):
                cyl = trimesh.creation.cylinder(pin_d / 2, pin_len + 2.0, sections=32)
                soc = trimesh.creation.cylinder(pin_d / 2 + clearance, pin_len + 0.6, sections=32)
                # cylinders are along Z: rotate to the cut axis
                R = trimesh.geometry.align_vectors([0, 0, 1], n)
                for m, off in ((cyl, c + (pin_len - 2.0) / 2), (soc, c + (pin_len + 0.6) / 2)):
                    m.apply_transform(R)
                    t = np.zeros(3); t[axis] = off; t[other[0]] = u; t[other[1]] = v
                    m.apply_translation(t - m.centroid * 0 if False else t)
                left = union([left, cyl]); right = diff(right, soc); placed += 1
        report.append({"cut_at_mm": round(float(c), 2), "pins": placed,
                       "joint": f"{placed} alignment pin(s) {pin_d}mm, {clearance}mm clearance" if placed else "butt joint: glue required (section too thin for pins)"})
        pieces.append(left); rem = right
    pieces.append(rem)
    return pieces, report


def auto_cuts(length: float, lo: float, max_len: float):
    n = int(np.ceil(length / max_len)); return [lo + length * i / n for i in range(1, n)]
