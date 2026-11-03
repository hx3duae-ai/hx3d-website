"""Joint motion / clearance verification (swept collision) for moving assemblies."""
from __future__ import annotations
import math, numpy as np, trimesh
from .meshutil import inter


def rot(mesh, origin, axis, deg):
    T = trimesh.transformations.rotation_matrix(math.radians(deg), axis, origin); m = mesh.copy(); m.apply_transform(T); return m


def min_gap(a, b, n=3000):
    if not (a.bounds[0] - 5 < b.bounds[1]).all() or not (b.bounds[0] - 5 < a.bounds[1]).all(): return 99.0
    pa, pb = a.sample(n), b.sample(n)
    return float(min(trimesh.proximity.closest_point(b, pa)[1].min(), trimesh.proximity.closest_point(a, pb)[1].min()))


def sweep(fixed: dict, moving: dict, origin, axis, lo, hi, step=10.0, min_gap_mm=0.15, overlap_tol=0.2, pair_filter=None):
    """fixed/moving = {name: mesh}. Rotates all `moving` about (origin, axis). Returns report dict."""
    angs = sorted(set(list(np.arange(lo, hi + 1e-6, step)) + [lo, hi, 0.0])); worst_v = 0.0; worst_g = 1e9; bad = []
    for a in angs:
        for mn, mm in moving.items():
            r = rot(mm, origin, axis, float(a))
            for fn, fm in fixed.items():
                if pair_filter and not pair_filter(mn, fn): continue
                v = float(inter(r, fm).volume) if len(inter(r, fm).faces) else 0.0
                g = 0.0 if v > 0.01 else min_gap(r, fm, 1200)
                worst_v = max(worst_v, v); worst_g = min(worst_g, g)
                if v > overlap_tol or g < min_gap_mm: bad.append({"angle": float(a), "moving": mn, "fixed": fn, "overlap_mm3": round(v, 3), "gap_mm": round(g, 3)})
    return {"range": [lo, hi], "poses": len(angs), "worst_overlap_mm3": round(worst_v, 3), "min_gap_mm": round(worst_g, 3), "violations": bad[:8], "ok": not bad}
