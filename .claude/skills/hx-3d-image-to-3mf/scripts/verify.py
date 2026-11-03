"""Stage 3: verify the model. Writes OUT/verify.json (+ parts/*.stl). Export refuses without a pass.

    python verify.py model.py OUT_DIR [--step 5]
"""
import argparse, itertools, json, math, sys
from pathlib import Path
import numpy as np
import trimesh
from hx_lib import *


def inter_vol(a, b):
    if not (a.bounds[0] < b.bounds[1]).all() or not (b.bounds[0] < a.bounds[1]).all():
        return 0.0
    try:
        r = trimesh.boolean.intersection([a, b], engine="manifold")
        return float(r.volume) if len(r.faces) else 0.0
    except Exception as e:
        return float("nan")


def min_dist(a, b, n=5000):
    if inter_vol(a, b) > 0.01:
        return 0.0
    pa = a.sample(n); pb = b.sample(n)
    da = trimesh.proximity.closest_point(b, pa)[1].min()
    db = trimesh.proximity.closest_point(a, pb)[1].min()
    return float(min(da, db))


class R:
    def __init__(self): self.checks = []
    def add(self, cid, ok, detail, level="fail"):
        self.checks.append({"id": cid, "ok": bool(ok), "level": level, "detail": detail})
    @property
    def passed(self): return all(c["ok"] for c in self.checks if c["level"] == "fail")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("model"); ap.add_argument("out")
    ap.add_argument("--step", type=float, default=5.0)
    a = ap.parse_args()
    out = Path(a.out); (out / "parts").mkdir(parents=True, exist_ok=True)
    spec = load_model(a.model)
    meshes = meshes_from_spec(spec)
    parts = {p["name"]: p for p in spec["parts"]}
    groups = {}
    for n, p in parts.items(): groups.setdefault(p["group"], []).append(n)
    joints = spec.get("joints", [])
    fused = {frozenset(f) for f in spec.get("fused", [])}
    jpairs = {frozenset((j["parent"], j["child"])) for j in joints}
    r = R()

    # --- structure
    r.add("S1_parts_present", len(parts) >= 2, f"{len(parts)} parts, {len(groups)} groups")
    r.add("S2_unique_names", len(parts) == len(spec["parts"]), "part names unique")
    colors = sorted({p["color"].lower() for p in parts.values()})
    r.add("S3_colour_count", len(colors) <= 16, f"{len(colors)} colours ({', '.join(colors)}); 1 AMS=4 slots, up to 4 AMS=16", "fail")
    need = {"head", "torso", "left_arm", "right_arm", "left_leg", "right_leg"}
    miss = need - set(groups)
    r.add("S4_body_regions", not miss, "missing groups: %s (use these names when the character has them)" % sorted(miss) if miss else "head/torso/arms/legs present",
          "warn")
    r.add("S5_has_joints", len(joints) > 0, f"{len(joints)} joints", "fail")

    # --- mesh integrity
    for n, m in meshes.items():
        ok = m.is_watertight and m.is_winding_consistent and m.volume > 1.0
        bodies = len(m.split(only_watertight=False))
        r.add(f"M1_{n}_watertight", ok, f"watertight={m.is_watertight} winding={m.is_winding_consistent} vol={m.volume:.1f}mm3 faces={len(m.faces)}")
        r.add(f"M2_{n}_bodies", bodies == 1, f"{bodies} disconnected shells", "warn")
        deg = int((m.area_faces < 1e-9).sum())
        r.add(f"M3_{n}_degenerate", deg == 0, f"{deg} degenerate faces")
        (out / "parts" / f"{n}.stl").write_bytes(m.export(file_type="stl"))

    # --- static collisions / clearances / connectivity
    names = list(meshes)
    pair_info = []
    for x, y in itertools.combinations(names, 2):
        gx, gy = parts[x]["group"], parts[y]["group"]
        a_, b_ = meshes[x], meshes[y]
        if not ((a_.bounds[0] - 1.0 < b_.bounds[1]).all() and (b_.bounds[0] - 1.0 < a_.bounds[1]).all()):
            continue
        v = inter_vol(a_, b_)
        if gx == gy:
            r.add(f"C1_{x}~{y}_overlap", v <= OVERLAP_TOL_MM3 if v == v else False,
                  f"same-group overlap {v:.2f}mm3 (colour parts must tile, not overlap)")
        elif frozenset((gx, gy)) in fused:
            r.add(f"C2_{x}~{y}_fused_overlap", v <= OVERLAP_TOL_MM3 if v == v else False, f"fused overlap {v:.2f}mm3")
        else:
            d = 0.0 if v > 0.01 else min_dist(a_, b_)
            pair_info.append((x, y, gx, gy, v, d))
            r.add(f"C3_{x}~{y}_collision", (v <= OVERLAP_TOL_MM3) if v == v else False, f"cross-group overlap {v:.2f}mm3")
            if frozenset((gx, gy)) in jpairs:
                ok = MIN_JOINT_CLEARANCE <= d <= MAX_JOINT_CLEARANCE * 3
                r.add(f"C4_{x}~{y}_joint_clearance", d >= MIN_JOINT_CLEARANCE,
                      f"min gap {d:.3f}mm (need >= {MIN_JOINT_CLEARANCE}mm for 0.4mm nozzle, est. +-0.05)")
            else:
                r.add(f"C5_{x}~{y}_gap", d >= MIN_JOINT_CLEARANCE,
                      f"non-joint groups too close: {d:.3f}mm (would fuse)")
    for g, ns in groups.items():
        if len(ns) > 1:   # parts of a group must touch each other
            comp = {ns[0]}; todo = True
            while todo:
                todo = False
                for n in ns:
                    if n in comp: continue
                    if any(min_dist(meshes[n], meshes[c], 1500) < 0.05 for c in comp):
                        comp.add(n); todo = True
            r.add(f"C6_{g}_connected", len(comp) == len(ns), f"group '{g}' parts connected: {sorted(comp)} of {ns}")

    # --- joint motion sweep
    sweep = []
    for j in joints:
        mv = moving_groups(j)
        lo, hi = j["range_deg"]
        angs = sorted(set(list(np.arange(lo, hi + 1e-6, a.step)) + [lo, hi, 0.0]))
        worst_v, worst_d, bad = 0.0, 1e9, []
        mover = [n for n in names if parts[n]["group"] in mv]
        fixed = [n for n in names if parts[n]["group"] not in mv]
        for ang in angs:
            for n in mover:
                m = rotate_mesh(meshes[n], j["origin"], j["axis"], float(ang))
                for f in fixed:
                    if not (m.bounds[0] - 0.3 < meshes[f].bounds[1]).all() or not (meshes[f].bounds[0] - 0.3 < m.bounds[1]).all():
                        continue
                    if frozenset((parts[n]["group"], parts[f]["group"])) in fused: continue
                    v = inter_vol(m, meshes[f])
                    d = 0.0 if v > 0.01 else min_dist(m, meshes[f], 1500)
                    worst_v = max(worst_v, v if v == v else 9e9); worst_d = min(worst_d, d)
                    if (v == v and v > OVERLAP_TOL_MM3) or d < HARD_MIN_GAP:
                        bad.append((float(ang), n, f, round(v, 2), round(d, 3)))
        sweep.append({"joint": j["name"], "range": [lo, hi], "angles": len(angs),
                      "worst_overlap_mm3": worst_v, "min_gap_mm": worst_d, "bad": bad[:6]})
        r.add(f"J1_{j['name']}_sweep", not bad,
              f"{len(angs)} poses {lo}..{hi} deg: worst overlap {worst_v:.2f}mm3, min gap {worst_d:.3f}mm"
              + (f"; first violations {bad[:3]}" if bad else ""))
        r.add(f"J2_{j['name']}_axis", abs(np.linalg.norm(j["axis"]) - 1) < 1e-6 or np.linalg.norm(j["axis"]) > 0,
              f"axis {j['axis']} origin {j['origin']}")

    # --- printability (assembly in print pose)
    allv = np.vstack([m.vertices for m in meshes.values()])
    lo_, hi_ = allv.min(0), allv.max(0)
    ext = hi_ - lo_
    bv = np.array(PRINTER["build_volume_mm"]) - 2 * PRINTER["usable_margin_mm"]
    r.add("P1_fits_build_volume", bool((ext <= bv).all()), f"extents {ext.round(1).tolist()} mm vs usable {bv.tolist()} ({PRINTER['name']})")
    r.add("P2_on_bed", abs(lo_[2]) < 0.05, f"lowest Z = {lo_[2]:.3f} (model must rest on Z=0)")
    th_report = {}
    for n, m in meshes.items():
        try:
            pts, fi = trimesh.sample.sample_surface(m, 1500)
            nrm = m.face_normals[fi]
            org = pts - nrm * 1e-3
            loc, ir, _ = m.ray.intersects_location(org, -nrm, multiple_hits=False)
            th = np.full(len(pts), np.nan); th[ir] = np.linalg.norm(loc - pts[ir], axis=1)
            th = th[np.isfinite(th) & (th > 0)]
            p5 = float(np.percentile(th, 5)) if len(th) else float("nan")
        except Exception:
            p5 = float("nan")
        th_report[n] = p5
        r.add(f"P3_{n}_wall", p5 != p5 or p5 >= 0.8, f"5th-percentile local thickness ~{p5:.2f}mm (>=0.8 recommended, 2 walls)", "warn")
    over = 0.0; tot = 0.0
    for m in meshes.values():
        nz = m.face_normals[:, 2]; ar = m.area_faces
        tot += ar.sum(); over += ar[(nz < -math.cos(math.radians(45))) & (m.triangles_center[:, 2] > 0.2)].sum()
    r.add("P4_overhang", True, f"{100*over/tot:.1f}% of surface is >45deg overhang above the bed (needs supports or bridging)", "info")
    for n, m in meshes.items():
        e = m.extents.min()
        r.add(f"P5_{n}_min_feature", e >= 0.8, f"smallest bbox dimension {e:.2f}mm (>=0.8 for reliable printing)", "warn")

    rec = Path(out / "reconstruction.json")
    ok_rec = False; why = "reconstruction.json missing"
    if rec.exists():
        try:
            d = json.loads(rec.read_text())
            ok_rec = d.get("exact_reconstruction_claimed") is False and all(k in d for k in ("observed", "inferred", "unknown", "confidence"))
            why = "ok" if ok_rec else "needs observed/inferred/unknown/confidence and exact_reconstruction_claimed=false"
        except Exception as e: why = str(e)
    r.add("H1_honesty_record", ok_rec, "reconstruction.json: " + why)

    res = {"passed": r.passed, "hash": mesh_hash(meshes, spec), "printer": PRINTER,
           "extents_mm": ext.round(2).tolist(), "n_parts": len(parts), "colors": colors,
           "groups": groups, "joint_sweep": sweep, "wall_thickness_p5": th_report, "checks": r.checks}
    (out / "verify.json").write_text(json.dumps(res, indent=2, default=float))
    fails = [c for c in r.checks if not c["ok"] and c["level"] == "fail"]
    warns = [c for c in r.checks if not c["ok"] and c["level"] == "warn"]
    print(f"VERIFY {'PASS' if r.passed else 'FAIL'}: {len(r.checks)} checks, {len(fails)} failures, {len(warns)} warnings")
    for c in fails + warns: print(f"  [{c['level'].upper()}] {c['id']}: {c['detail']}")
    sys.exit(0 if r.passed else 1)

if __name__ == "__main__":
    main()
