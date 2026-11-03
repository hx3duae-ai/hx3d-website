"""3D Model Doctor: diagnose + safe repair of STL/3MF meshes. Never silently changes the design."""
from __future__ import annotations
import numpy as np, trimesh
from .config import MATERIALS, PRINTERS, DEFAULT_PRINTER, DEFAULT_MATERIAL


def load_mesh(path: str) -> trimesh.Trimesh:
    s = trimesh.load(path, force="scene" if str(path).lower().endswith("3mf") else "mesh", process=False)
    if isinstance(s, trimesh.Scene):
        ms = [g for g in s.dump() if isinstance(g, trimesh.Trimesh)]
        if not ms: raise ValueError("no mesh found in file")
        return trimesh.util.concatenate(ms)
    return s


def _thickness_p5(m, n=1200):
    try:
        pts, fi = trimesh.sample.sample_surface(m, n); nr = m.face_normals[fi]
        loc, ir, _ = m.ray.intersects_location(pts - nr * 1e-3, -nr, multiple_hits=False)
        th = np.linalg.norm(loc - pts[ir], axis=1)
        return float(np.percentile(th, 5)) if len(th) else None
    except Exception:
        return None


def diagnose(m: trimesh.Trimesh, printer=DEFAULT_PRINTER, material=DEFAULT_MATERIAL) -> dict:
    P, M = PRINTERS[printer], MATERIALS[material]
    issues = []
    def add(code, sev, msg, n=None, fixable=False): issues.append({"code": code, "severity": sev, "message": msg, "count": n, "auto_fixable": fixable})
    edges = m.edges_sorted; uniq, counts = np.unique(edges, axis=0, return_counts=True)
    boundary = int((counts == 1).sum()); nonman = int((counts > 2).sum())
    if boundary: add("open_edges", "error", f"{boundary} open (boundary) edges: holes / open surfaces", boundary, True)
    if nonman: add("non_manifold", "error", f"{nonman} non-manifold edges (shared by >2 faces)", nonman, False)
    if not m.is_winding_consistent: add("winding", "error", "inconsistent face winding / flipped faces", None, True)
    elif m.is_watertight and m.volume < 0: add("inverted", "error", "mesh is inside-out (negative volume)", None, True)
    deg = int((m.area_faces < 1e-10).sum())
    if deg: add("degenerate", "warn", f"{deg} zero-area faces", deg, True)
    dup = len(m.faces) - len(np.unique(np.sort(m.faces, axis=1), axis=0))
    if dup: add("duplicate_faces", "warn", f"{dup} duplicate faces", dup, True)
    comps = m.split(only_watertight=False)
    vols = [abs(c.volume) if c.is_watertight else 0.0 for c in comps]
    if len(comps) > 1:
        tiny = sum(1 for c, v in zip(comps, vols) if v < 0.5)
        add("multiple_bodies", "info" if tiny == 0 else "warn", f"{len(comps)} disconnected bodies ({tiny} tiny <0.5 mm3 specks)", len(comps), tiny > 0)
    ext = m.extents; vol = np.array(P["build_volume"]) - 2 * P["margin"]
    if (ext > vol).any(): add("exceeds_build_volume", "error", f"size {ext.round(1).tolist()} mm exceeds usable {vol.tolist()} mm of {P['name']}: scale down or split (Multi-Part Assembly tool)", None, False)
    p5 = _thickness_p5(m) if m.is_watertight else None
    if p5 is not None and p5 < M["min_wall"]: add("thin_walls", "warn", f"~5% of the surface is thinner than {M['min_wall']} mm (p5 thickness {p5:.2f} mm)", None, False)
    if m.is_watertight and len(m.faces) and m.volume > 0:
        pass
    return {"faces": int(len(m.faces)), "vertices": int(len(m.vertices)), "watertight": bool(m.is_watertight),
            "volume_mm3": float(m.volume) if m.is_watertight else None, "extents_mm": ext.round(3).tolist(),
            "bodies": len(comps), "thickness_p5_mm": p5, "issues": issues,
            "printable": not any(i["severity"] == "error" for i in issues),
            "note": "Self-intersections between separate shells are not detected here; use the collision tool on assemblies."}


def repair(m: trimesh.Trimesh, remove_specks: bool = False, max_drift_pct: float = 1.0):
    """Safe repair. Returns (mesh, report). Refuses to keep the result if shape drifts > max_drift_pct (volume)."""
    before = diagnose(m); r = m.copy(); log = []
    r.merge_vertices(); r.update_faces(r.nondegenerate_faces()); r.update_faces(r.unique_faces()); r.remove_unreferenced_vertices(); log.append("merged vertices, removed degenerate/duplicate faces")
    trimesh.repair.fix_winding(r); trimesh.repair.fix_normals(r); log.append("fixed winding/normals")
    if not r.is_watertight:
        trimesh.repair.fill_holes(r); log.append("filled simple holes")
    if remove_specks:
        comps = r.split(only_watertight=False); keep = [c for c in comps if (abs(c.volume) if c.is_watertight else c.area) >= 0.5]
        if keep and len(keep) < len(comps): r = trimesh.util.concatenate(keep); log.append(f"removed {len(comps)-len(keep)} tiny specks")
    if r.is_watertight and r.volume < 0: r.invert(); log.append("inverted inside-out mesh")
    after = diagnose(r)
    drift = None
    if before["volume_mm3"] and after["volume_mm3"]:
        drift = abs(after["volume_mm3"] - before["volume_mm3"]) / abs(before["volume_mm3"]) * 100
    accepted = drift is None or drift <= max_drift_pct
    rep = {"before": before, "after": after, "actions": log, "volume_drift_pct": drift, "accepted": accepted,
           "unfixed": [i for i in after["issues"] if i["severity"] == "error"],
           "message": "repaired" if accepted else f"repair changed volume by {drift:.2f}% (> {max_drift_pct}%): NOT applied, needs your approval"}
    return (r if accepted else m), rep
