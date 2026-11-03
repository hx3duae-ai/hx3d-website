"""Print Optimizer: orientation search, support/overhang analysis, filament+time ESTIMATES, P2S recommendations."""
from __future__ import annotations
import numpy as np, trimesh
from .config import MATERIALS, PRINTERS, DEFAULT_PRINTER, DEFAULT_MATERIAL


def _rot_to_down(n):
    """rotation matrix that maps vector n onto -Z"""
    n = np.asarray(n, float); n /= np.linalg.norm(n)
    return trimesh.geometry.align_vectors(n, [0, 0, -1])


def analyse(m: trimesh.Trimesh, max_overhang_deg=45.0):
    z = m.vertices[:, 2]; zmin = z.min()
    fn = m.face_normals; ar = m.area_faces; cz = m.triangles_center[:, 2]
    on_bed = (cz - zmin < 0.15) & (fn[:, 2] < -0.9)
    cosd = np.cos(np.radians(max_overhang_deg))
    over = (fn[:, 2] < -cosd) & ~on_bed
    ext = m.extents
    return {"bed_contact_mm2": float(ar[on_bed].sum()), "overhang_mm2": float(ar[over].sum()),
            "overhang_pct": float(100 * ar[over].sum() / ar.sum()), "height_mm": float(ext[2]), "footprint": ext[:2].tolist()}


def best_orientation(m: trimesh.Trimesh, material=DEFAULT_MATERIAL, printer=DEFAULT_PRINTER, max_candidates=24):
    M, P = MATERIALS[material], PRINTERS[printer]
    cands = [np.eye(4)]
    for ax in ([1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]):
        cands.append(_rot_to_down(ax))
    try:
        h = m.convex_hull; order = np.argsort(-h.area_faces)[:max_candidates]
        for i in order: cands.append(_rot_to_down(h.face_normals[i]))
    except Exception: pass
    usable = np.array(P["build_volume"]) - 2 * P["margin"]
    res = []
    for T in cands:
        mm = m.copy(); mm.apply_transform(T); mm.apply_translation([0, 0, -mm.bounds[0][2]])
        a = analyse(mm, M["max_overhang"]); fits = bool((mm.extents <= usable).all())
        score = a["overhang_mm2"] - 0.5 * a["bed_contact_mm2"] + 0.8 * a["height_mm"] + (1e6 if not fits else 0)
        res.append({"score": score, "T": T, "fits": fits, **a})
    res.sort(key=lambda r: r["score"]); best = res[0]; base = next(r for r in res if np.allclose(r["T"], np.eye(4)))
    out = m.copy(); out.apply_transform(best["T"]); out.apply_translation([0, 0, -out.bounds[0][2]])
    return out, {"best": {k: v for k, v in best.items() if k != "T"}, "as_given": {k: v for k, v in base.items() if k != "T"},
                 "rotation_matrix": best["T"].tolist(), "candidates_tested": len(res)}


def estimate(m: trimesh.Trimesh, material=DEFAULT_MATERIAL, printer=DEFAULT_PRINTER, layer=0.2, infill=0.15, walls=3):
    """ESTIMATES only (+-30-40%). The slicer's number is authoritative."""
    M, P = MATERIALS[material], PRINTERS[printer]
    vol = abs(m.volume) if m.is_watertight else m.convex_hull.volume
    shell = min(vol, m.area * walls * P["nozzle"] * 1.05 * 0.9 + m.area * layer * 6 * 0.5)   # walls + ~3 top/bottom layers
    filament_mm3 = shell + max(vol - shell, 0) * infill
    grams = filament_mm3 / 1000 * M["density"]
    hours = filament_mm3 / P["speed_mm3_s"] / 3600 * 1.25 + (m.extents[2] / layer) * 2.0 / 3600   # +25% travel/accel, 2 s per layer
    return {"volume_mm3": float(vol), "filament_mm3": float(filament_mm3), "filament_g": float(grams),
            "est_hours": float(hours), "accuracy": "rough estimate (+-35%); slicer value overrides", "infill": infill, "walls": walls, "layer": layer}


def recommend(m, orient_info, est, material=DEFAULT_MATERIAL, printer=DEFAULT_PRINTER, mechanical=False, colors=1):
    P = PRINTERS[printer]; tips = []
    b = orient_info["best"]
    if not b["fits"]: tips.append("DOES NOT FIT the build volume in any tested orientation - scale or split the model.")
    if b["overhang_pct"] < 3: tips.append("Supports not needed in the recommended orientation (<3% overhang).")
    elif b["overhang_pct"] < 12: tips.append("Light supports (tree/auto) recommended on a few overhangs; check the slicer preview.")
    else: tips.append(f"{b['overhang_pct']:.0f}% of surface overhangs >{MATERIALS[material]['max_overhang']} deg: expect heavy supports; consider splitting the part.")
    fine = m.extents.min() < 3
    tips.append(f"Layer height {'0.12-0.16' if fine else '0.16-0.20'} mm, {P['nozzle']} mm nozzle, {3 if mechanical else 2} walls, {'25' if mechanical else '10-15'}% gyroid infill.")
    tips.append("Layer lines run horizontally: parts are weakest when pulled apart along Z; keep thin pins/hinges lying flat on the bed where possible.")
    if mechanical: tips.append("Mechanical/moving parts: PETG is tougher for snap-fits; PLA is stiffer and prints cleaner for tight print-in-place gaps.")
    if material == "ABS": tips.append("ABS warps: needs an enclosed, warm chamber. Confirm your P2S setup supports it before choosing ABS.")
    if colors > 1: tips.append(f"{colors} colours: AMS purge waste can exceed the model's own filament; merge colours or enlarge colour blocks to cut waste.")
    return tips
