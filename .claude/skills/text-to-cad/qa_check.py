"""Mesh-level QA for the text-to-cad skill.

Loads an exported STL with trimesh and verifies printability + dimensional
targets. Prints a JSON report and exits 1 if any check fails, so the calling
agent can loop on failures.

Usage:
    python qa_check.py part.stl
    python qa_check.py part.stl --expect-x 120 --expect-y 60 --expect-z 10
    python qa_check.py part.stl --expect-x 120 --tol 0.5 --components 1
    python qa_check.py part.stl --expect-volume 64000 --vol-tol-pct 5
"""

from __future__ import annotations

import argparse
import json
import sys

import trimesh


def main() -> int:
    ap = argparse.ArgumentParser(description="STL printability + dimension QA")
    ap.add_argument("stl", help="Path to the STL file")
    ap.add_argument("--expect-x", type=float, help="Expected overall X size (mm)")
    ap.add_argument("--expect-y", type=float, help="Expected overall Y size (mm)")
    ap.add_argument("--expect-z", type=float, help="Expected overall Z size (mm)")
    ap.add_argument("--tol", type=float, default=0.5, help="Dimension tolerance (mm)")
    ap.add_argument("--expect-volume", type=float, help="Expected volume (mm^3)")
    ap.add_argument("--vol-tol-pct", type=float, default=10.0,
                    help="Volume tolerance (percent)")
    ap.add_argument("--components", type=int, default=1,
                    help="Expected number of connected bodies (default 1)")
    args = ap.parse_args()

    checks: list[dict] = []

    def check(name: str, passed: bool, detail: str) -> None:
        checks.append({"check": name, "pass": bool(passed), "detail": detail})

    try:
        mesh = trimesh.load(args.stl, force="mesh")
    except Exception as exc:
        print(json.dumps({"pass": False, "error": f"Failed to load STL: {exc}"}))
        return 1

    check("loaded", True, f"{len(mesh.faces)} faces, {len(mesh.vertices)} vertices")
    check("watertight", mesh.is_watertight,
          "mesh is watertight" if mesh.is_watertight
          else "mesh has holes/open edges — NOT printable")
    check("winding_consistent", mesh.is_winding_consistent,
          "face winding consistent" if mesh.is_winding_consistent
          else "inconsistent face winding")

    volume = float(mesh.volume) if mesh.is_watertight else None
    if volume is not None:
        check("positive_volume", volume > 0.001, f"volume = {volume:.1f} mm^3")
    else:
        check("positive_volume", False, "volume unavailable (not watertight)")

    bodies = mesh.split(only_watertight=False)
    n_bodies = max(len(bodies), 1)
    check("body_count", n_bodies == args.components,
          f"found {n_bodies} connected bodies, expected {args.components}"
          + ("" if n_bodies == args.components
             else " — disconnected/floating geometry"))

    ext = mesh.bounding_box.extents  # axis-aligned overall size
    dims = {"x": float(ext[0]), "y": float(ext[1]), "z": float(ext[2])}
    for axis in ("x", "y", "z"):
        expected = getattr(args, f"expect_{axis}")
        if expected is not None:
            actual = dims[axis]
            ok = abs(actual - expected) <= args.tol
            check(f"dim_{axis}", ok,
                  f"{axis.upper()} = {actual:.2f} mm, expected {expected:.2f} "
                  f"± {args.tol} mm (delta {actual - expected:+.2f})")

    if args.expect_volume is not None and volume is not None:
        delta_pct = abs(volume - args.expect_volume) / args.expect_volume * 100
        check("volume_target", delta_pct <= args.vol_tol_pct,
              f"volume {volume:.1f} vs expected {args.expect_volume:.1f} mm^3 "
              f"(delta {delta_pct:.1f}%, tol {args.vol_tol_pct}%)")

    all_pass = all(c["pass"] for c in checks)
    print(json.dumps({
        "pass": all_pass,
        "stl": args.stl,
        "overall_dims_mm": {k: round(v, 3) for k, v in dims.items()},
        "volume_mm3": round(volume, 1) if volume is not None else None,
        "checks": checks,
    }, indent=2))
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
