"""CAD helpers for the text-to-cad-color skill (multi-color fork).

Independent fork of text-to-cad's helpers — same safe operations, plus
finalize_parts() for multi-body color exports (per-part STLs + colored 3MF
+ colored STEP). Detection patterns adapted from the MIT-licensed
Multi-Agent-CAD project: https://github.com/Pan-Chera/Multi-Agent-CAD

Usage in a generated part script:

    import sys
    sys.path.insert(0, r"<SKILL_DIR>")
    from cad_helpers import safe_cut, safe_fuse, safe_fillet, safe_chamfer, measure, finalize_parts
"""

from __future__ import annotations

import json
from pathlib import Path

from build123d import Color, Compound, Unit, chamfer, export_step, export_stl, fillet

_ISSUES: list[str] = []
_MEASUREMENTS: dict[str, dict] = {}

_DEGRADATION = (1.0, 0.5, 0.25, 0.125)


def safe_cut(body, tool, label: str = ""):
    """Cut tool from body; record an issue if the cut had no effect."""
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
    """Stage 1: progressive size reduction on all edges.
    Stage 2: per-GeomType groups (mixed Circle+Line selections often fail
    in a single OpenCascade call)."""
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
            f"(Stage 1 + GeomType grouping). Last error: {last_err}."
        )
        return solid
    except Exception as exc:
        _ISSUES.append(f"{op_name}_FAILED: {label} — {exc}")
        return solid


def safe_fillet(solid, edges, radius: float, label: str = ""):
    return _finishing_op(
        lambda e, s: fillet(e, radius=s), "FILLET", solid, edges, radius, label
    )


def safe_chamfer(solid, edges, length: float, label: str = ""):
    return _finishing_op(
        lambda e, s: chamfer(e, length=s), "CHAMFER", solid, edges, length, label
    )


def measure(solid, name: str, feature_type: str = "feature") -> None:
    """Record a feature's bbox/volume BEFORE it is merged into the body."""
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


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _describe(solid, name: str, report: dict) -> dict:
    entry: dict = {}
    try:
        valid = solid.is_valid
        entry["is_valid"] = bool(valid() if callable(valid) else valid)
    except Exception as exc:
        entry["is_valid"] = None
        report["issues"].append(f"VALIDITY_CHECK_ERROR ({name}): {exc}")
    try:
        entry["solid_count"] = len(solid.solids())
    except Exception:
        entry["solid_count"] = None
    try:
        bb = solid.bounding_box()
        entry["bbox"] = {
            "size_x": round(bb.max.X - bb.min.X, 3),
            "size_y": round(bb.max.Y - bb.min.Y, 3),
            "size_z": round(bb.max.Z - bb.min.Z, 3),
            "min": [round(bb.min.X, 3), round(bb.min.Y, 3), round(bb.min.Z, 3)],
            "max": [round(bb.max.X, 3), round(bb.max.Y, 3), round(bb.max.Z, 3)],
        }
    except Exception as exc:
        report["issues"].append(f"BBOX_ERROR ({name}): {exc}")
    try:
        entry["volume_mm3"] = round(solid.volume, 3)
    except Exception as exc:
        report["issues"].append(f"VOLUME_ERROR ({name}): {exc}")
    return entry


def finalize_parts(parts: dict, name: str, out_dir: str = "cad_out") -> dict:
    """Validate and export a multi-color part.

    parts: {"region-name": (solid, "#rrggbb"), ...} — one entry per color
    region. Regions must not overlap (they should be split from one parent
    solid so they mate perfectly).

    Exports:
      - <name>-<region>.stl per region            (Tier 1 — drag all into
        Bambu Studio together, answer YES to "single object with multiple
        parts", assign one filament per part)
      - <name>.3mf with per-object colors         (Tier 2 — colors preloaded)
      - <name>.step colored assembly (best effort)
      - <name>_report.json build report
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    report: dict = {
        "part": name,
        "issues": list(_ISSUES),
        "parts": {},
        "overlaps_mm3": {},
    }

    entries = []  # (stl_path, hex_color, region_name) for the 3MF writer
    for region, (solid, color) in parts.items():
        entry = _describe(solid, region, report)
        entry["color"] = color
        stl_path = out / f"{name}-{region}.stl"
        export_stl(solid, str(stl_path), tolerance=0.01, angular_tolerance=0.1)
        entry["stl_file"] = str(stl_path.resolve())
        report["parts"][region] = entry
        entries.append((str(stl_path), color, region))

    # Pairwise overlap check — color regions must not share volume
    names = list(parts)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            try:
                inter = parts[a][0] & parts[b][0]
                vol = float(inter.volume)
            except Exception:
                vol = 0.0
            report["overlaps_mm3"][f"{a}&{b}"] = round(vol, 4)
            if vol > 0.01:
                report["issues"].append(
                    f"OVERLAP: regions '{a}' and '{b}' share {vol:.3f} mm^3 — "
                    "split them from one parent solid instead."
                )

    # Combined (assembly) bbox from per-part bboxes
    boxes = [p["bbox"] for p in report["parts"].values() if "bbox" in p]
    if boxes:
        mins = [min(b["min"][k] for b in boxes) for k in range(3)]
        maxs = [max(b["max"][k] for b in boxes) for k in range(3)]
        report["assembly_bbox"] = {
            "size_x": round(maxs[0] - mins[0], 3),
            "size_y": round(maxs[1] - mins[1], 3),
            "size_z": round(maxs[2] - mins[2], 3),
            "min": [round(v, 3) for v in mins],
            "max": [round(v, 3) for v in maxs],
        }
    report["assembly_volume_mm3"] = round(
        sum(p.get("volume_mm3", 0) or 0 for p in report["parts"].values()), 3
    )

    # Tier 2: colored 3MF (lib3mf)
    try:
        from export_3mf import write_3mf

        threemf_path = out / f"{name}.3mf"
        write_3mf(entries, str(threemf_path))
        report["threemf_file"] = str(threemf_path.resolve())
    except Exception as exc:
        report["issues"].append(f"3MF_EXPORT_FAILED: {exc}")

    # Colored STEP assembly (best effort — nice for CAD tools, not needed by slicers)
    try:
        children = []
        for region, (solid, color) in parts.items():
            r, g, b = _hex_to_rgb(color)
            solid.color = Color(r / 255, g / 255, b / 255)
            solid.label = region
            children.append(solid)
        assembly = Compound(children=children)
        step_path = out / f"{name}.step"
        export_step(assembly, str(step_path), unit=Unit.MM)
        report["step_file"] = str(step_path.resolve())
    except Exception as exc:
        report["issues"].append(f"STEP_COLOR_WARN: {exc} (STL/3MF unaffected)")

    report["measurements"] = _MEASUREMENTS
    report_path = out / f"{name}_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report
