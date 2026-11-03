"""CAD helpers for the text-to-cad skill.

Safe boolean/finishing operations, instrumentation, and export for build123d
part scripts. Detection patterns (missed-cut check, progressive fillet radius
degradation, GeomType grouping fallback) adapted from the MIT-licensed
Multi-Agent-CAD project: https://github.com/Pan-Chera/Multi-Agent-CAD

Usage in a generated part script:

    import sys
    sys.path.insert(0, r"<SKILL_DIR>")
    from cad_helpers import safe_cut, safe_fuse, safe_fillet, safe_chamfer, measure, finalize
"""

from __future__ import annotations

import json
from pathlib import Path

from build123d import Unit, chamfer, export_step, export_stl, fillet

# Issues accumulated across the build (missed cuts, degraded fillets, ...).
# finalize() writes them into the report so the QA loop can react.
_ISSUES: list[str] = []
_MEASUREMENTS: dict[str, dict] = {}

_DEGRADATION = (1.0, 0.5, 0.25, 0.125)


def safe_cut(body, tool, label: str = ""):
    """Cut tool from body; record an issue if the cut had no effect.

    A cut with zero volume change means the tool missed the body entirely —
    almost always a position error worth fixing, not ignoring.
    """
    try:
        before = body.volume
        result = body - tool
        if abs(result.volume - before) < 0.001:
            _ISSUES.append(
                f"MISSED_CUT: {label} — tool had NO effect on body. Position is wrong."
            )
        return result
    except Exception as exc:
        _ISSUES.append(f"CUT_ERROR: {label} — exception during cut: {exc}")
        return body


def safe_fuse(body, tool, label: str = "", min_fraction: float = 0.5):
    """Union tool into body; detect and repair a SILENTLY FAILED fuse.

    OpenCascade's fuse can give up without raising — it just returns the
    body unchanged (typical triggers: coplanar or tangent faces, helical
    sweeps). The expected volume gain is tool.volume minus the part of the
    tool already inside the body; if the actual gain is below min_fraction
    of that, the fuse is retried without clean(), then with a fuzzy
    tolerance. If everything fails an issue is recorded so QA sees it.
    """
    try:
        before = body.volume
        try:
            overlap = (body & tool).volume
        except Exception:
            overlap = 0.0
        expected = max(tool.volume - overlap, 0.0)
        attempts = (
            ("fuse", lambda: body + tool),
            ("fuse-noclean", lambda: body.fuse(tool)),
            ("fuse-fuzzy", lambda: body.fuse(tool, tol=0.01).clean()),
        )
        last = None
        for name, fn in attempts:
            try:
                res = fn()
            except Exception:
                continue
            last = res
            gain = res.volume - before
            if expected < 0.01 or gain >= min_fraction * expected:
                if name != "fuse":
                    _ISSUES.append(
                        f"FUSE_FALLBACK: {label} — plain fuse dropped the tool; "
                        f"'{name}' recovered it (+{gain:.1f} mm^3)."
                    )
                return res
        _ISSUES.append(
            f"MISSED_FUSE: {label} — expected +{expected:.1f} mm^3, fuse added "
            f"{(last.volume - before) if last is not None else 0.0:.1f}. "
            "Feature is MISSING from the body (coplanar/tangent faces?)."
        )
        return last if last is not None else body
    except Exception as exc:
        _ISSUES.append(f"FUSE_ERROR: {label} — exception during fuse: {exc}")
        return body


def _finishing_op(op, op_name, solid, edges, size, label):
    """Shared driver for safe_fillet / safe_chamfer.

    Stage 1: try the operation on all edges with progressive size reduction.
    Stage 2: group edges by GeomType and apply per-group (mixed Circle+Line
    selections often fail in a single OpenCascade call).
    """
    try:
        if callable(edges):
            edges = edges(solid)
        edges = list(edges)
        if not edges:
            _ISSUES.append(f"{op_name}_FAILED: {label} — no edges matched selector")
            return solid

        before = solid.volume
        sizes = [size * f for f in _DEGRADATION]
        last_err = ""

        for s in sizes:
            try:
                result = op(edges, s)
                if abs(result.volume - before) < 0.001:
                    last_err = f"no volume change at {s}"
                    continue
                if s < size:
                    _ISSUES.append(
                        f"{op_name}_DEGRADED: {label} — {size} failed, succeeded at {s}"
                    )
                return result
            except Exception as exc:
                last_err = str(exc)

        groups: dict[str, list] = {}
        for edge in edges:
            try:
                gt = str(edge.geom_type)
            except Exception:
                gt = "unknown"
            groups.setdefault(gt, []).append(edge)

        result = solid
        ok = 0
        for gt, group in groups.items():
            for s in sizes:
                try:
                    candidate = op(group, s)
                    if candidate is not None and abs(candidate.volume - result.volume) > 0.001:
                        result = candidate
                        ok += 1
                        if s < size:
                            _ISSUES.append(
                                f"{op_name}_DEGRADED: {label} — group {gt}: {size} → {s}"
                            )
                        break
                except Exception:
                    continue

        if ok:
            if ok < len(groups):
                _ISSUES.append(
                    f"{op_name}_PARTIAL: {label} — {ok}/{len(groups)} edge groups succeeded"
                )
            return result

        _ISSUES.append(
            f"{op_name}_FAILED: {label} — all sizes {sizes} failed "
            f"(Stage 1 + GeomType grouping). Last error: {last_err}. "
            "Likely degenerate edges from prior booleans — consider semantic "
            "selectors, or applying this finish BEFORE the boolean that splits "
            "the edge."
        )
        return solid
    except Exception as exc:
        _ISSUES.append(f"{op_name}_FAILED: {label} — {exc}")
        return solid


def safe_fillet(solid, edges, radius: float, label: str = ""):
    """Fillet with radius auto-degradation and GeomType-group fallback.

    edges may be an edge list or a callable(solid) -> edges.
    """
    return _finishing_op(
        lambda e, s: fillet(e, radius=s), "FILLET", solid, edges, radius, label
    )


def safe_chamfer(solid, edges, length: float, label: str = ""):
    """Chamfer with length auto-degradation and GeomType-group fallback."""
    return _finishing_op(
        lambda e, s: chamfer(e, length=s), "CHAMFER", solid, edges, length, label
    )


def measure(solid, name: str, feature_type: str = "feature") -> None:
    """Record a feature's bbox/volume BEFORE it is merged into the body.

    White-box instrumentation: once features are unioned, their individual
    dimensions can no longer be measured. Call this on each feature solid
    right before the boolean, and the numbers land in the final report.
    """
    try:
        bb = solid.bounding_box()
        entry = {
            "type": feature_type,
            "size_x": round(bb.max.X - bb.min.X, 3),
            "size_y": round(bb.max.Y - bb.min.Y, 3),
            "size_z": round(bb.max.Z - bb.min.Z, 3),
            "min": [round(bb.min.X, 3), round(bb.min.Y, 3), round(bb.min.Z, 3)],
            "max": [round(bb.max.X, 3), round(bb.max.Y, 3), round(bb.max.Z, 3)],
        }
        try:
            entry["volume"] = round(solid.volume, 3)
        except Exception:
            entry["volume"] = None
        _MEASUREMENTS[name] = entry
    except Exception as exc:
        _MEASUREMENTS[name] = {"error": str(exc)}


def finalize(solid, name: str, out_dir: str = "cad_out") -> dict:
    """Validate, export STEP + STL, and write/print the build report.

    Returns the report dict. The report (and stdout) is what the QA loop
    reads: bbox, volume, validity, per-feature measurements, and every
    issue recorded by the safe_* helpers.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    report: dict = {"part": name, "issues": list(_ISSUES)}

    try:
        valid = solid.is_valid
        report["is_valid"] = bool(valid() if callable(valid) else valid)
    except Exception as exc:
        report["is_valid"] = None
        report["issues"].append(f"VALIDITY_CHECK_ERROR: {exc}")

    try:
        bb = solid.bounding_box()
        report["bbox"] = {
            "size_x": round(bb.max.X - bb.min.X, 3),
            "size_y": round(bb.max.Y - bb.min.Y, 3),
            "size_z": round(bb.max.Z - bb.min.Z, 3),
            "min": [round(bb.min.X, 3), round(bb.min.Y, 3), round(bb.min.Z, 3)],
            "max": [round(bb.max.X, 3), round(bb.max.Y, 3), round(bb.max.Z, 3)],
        }
    except Exception as exc:
        report["issues"].append(f"BBOX_ERROR: {exc}")

    try:
        report["volume_mm3"] = round(solid.volume, 3)
    except Exception as exc:
        report["issues"].append(f"VOLUME_ERROR: {exc}")

    step_path = out / f"{name}.step"
    stl_path = out / f"{name}.stl"
    export_step(solid, str(step_path), unit=Unit.MM)
    export_stl(solid, str(stl_path), tolerance=0.01, angular_tolerance=0.1)
    report["step_file"] = str(step_path.resolve())
    report["stl_file"] = str(stl_path.resolve())
    report["measurements"] = _MEASUREMENTS

    report_path = out / f"{name}_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    return report
