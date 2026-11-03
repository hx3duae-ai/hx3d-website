"""Stage 6: assembly_instructions.pdf + print_report.txt from verified artefacts.

    python make_docs.py model.py OUT_DIR [--ref ref.png]
Requires export_check.json (i.e. a successful export).
"""
import argparse, json, sys, textwrap
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors as rc
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from hx_lib import *


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("model"); ap.add_argument("out"); ap.add_argument("--ref")
    a = ap.parse_args(); out = Path(a.out)
    try: ex = json.loads((out / "export_check.json").read_text())
    except Exception: sys.exit("no export_check.json - export first")
    v = json.loads((out / "verify.json").read_text())
    rec = json.loads((out / "reconstruction.json").read_text())
    spec = load_model(a.model)
    pal = (json.loads((out / "palette.json").read_text()) if (out / "palette.json").exists() else None)
    backend = (json.loads((out / "backend_report.json").read_text()) if (out / "backend_report.json").exists()
               else {"status": "not run"})
    slots = ex["filament_slots"]
    by_color = {}
    for p in spec["parts"]: by_color.setdefault(p["color"].lower(), []).append(f'{p["group"]}/{p["name"]}')
    warns = [c for c in v["checks"] if not c["ok"] and c["level"] == "warn"]
    n_ams = -(-len(slots) // 4)

    L = []
    L += ["HX-3D-Image-to-3MF  PRINT REPORT", "=" * 60,
          f"Target: {PRINTER['name']} + AMS   Geometry hash: {v['hash'][:16]}",
          f"Verification: {'PASSED' if v['passed'] else 'FAILED'}  ({len(v['checks'])} checks, {len(warns)} warnings)",
          "Bambu Studio opened this file: NO (not available in the build environment).",
          "Test-printed: NO. Treat joint clearances as unproven until a physical test print.", ""]
    L += ["RECONSTRUCTION HONESTY", "-" * 60, f"Confidence: {rec['confidence']}",
          "This is NOT an exact reconstruction. It is a plausible model built from ONE image.",
          "Observed in the image:"] + [f"  - {x}" for x in rec["observed"]]
    L += ["Inferred (not visible, plausible guess):"] + [f"  - {x}" for x in rec["inferred"]]
    L += ["Unknown / not recoverable from the image:"] + [f"  - {x}" for x in rec["unknown"]]
    L += ["Image-to-3D backend: " + backend.get("status", "?") + (" - " + backend.get("reason", "") if backend.get("reason") else ""), ""]
    L += ["COLOURS / AMS", "-" * 60, f"{len(slots)} colours -> {n_ams} AMS unit(s) of 4 slots. Colours are AMS slot hints; match real filaments."]
    for c, s in sorted(slots.items(), key=lambda kv: kv[1]):
        L.append(f"  Filament slot {s}: {c.upper()}  <- {', '.join(by_color[c])}")
    L += ["", "PARTS & JOINTS", "-" * 60, f"Overall size: {v['extents_mm']} mm (X,Y,Z)"]
    for g, ns in v["groups"].items(): L.append(f"  group {g}: {', '.join(ns)}")
    for s in v["joint_sweep"]:
        L.append(f"  joint {s['joint']}: range {s['range'][0]}..{s['range'][1]} deg, {s['angles']} poses swept, "
                 f"min gap {s['min_gap_mm']:.3f}mm, worst overlap {s['worst_overlap_mm3']:.2f}mm3")
    L += ["", "CHECKS", "-" * 60]
    for c in v["checks"]:
        L.append(f"  [{'PASS' if c['ok'] else c['level'].upper()}] {c['id']}: {c['detail']}")
    L += ["", "RECOMMENDED SETTINGS (starting point, not tested)", "-" * 60,
          "  Bambu Studio: pick stock 'Bambu Lab P2S 0.4 nozzle' + PLA presets for each slot.",
          "  Layer 0.16 mm, 3 walls, 15% gyroid infill, no brim needed if flat base; supports OFF first, then enable",
          "  only if the overhang check below demands it. Print in the supplied pose (print-in-place joints).",
          "  Expect colour-change purge: many colour regions = long print + lots of waste. Consider 'prime tower' settings.",
          "  After printing: twist/flex each joint gently once to break the first-layer bond."]
    (out / "print_report.txt").write_text("\n".join(L) + "\n")

    st = getSampleStyleSheet(); doc = SimpleDocTemplate(str(out / "assembly_instructions.pdf"), pagesize=A4,
                                                        leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    S = [Paragraph("Assembly &amp; Print Instructions", st["Title"]),
         Paragraph(f"{PRINTER['name']} + AMS &middot; verified geometry {v['hash'][:12]}", st["Normal"]), Spacer(1, 8),
         Image(str(out / "preview.png"), width=520, height=520 * 9 / 16), Spacer(1, 8),
         Paragraph("<b>Honesty note.</b> " + f"Confidence: {rec['confidence']}. Built from a single image; unseen sides are inferred. "
                   "Not an exact reconstruction. Not test-printed.", st["Normal"]), PageBreak()]
    S.append(Paragraph("1. Filament / AMS loading", st["Heading2"]))
    rows = [["Slot", "Colour", "Used by"]] + [[str(s), c.upper(), ", ".join(by_color[c])] for c, s in sorted(slots.items(), key=lambda kv: kv[1])]
    t = Table(rows, colWidths=[40, 70, 400]); style = [("GRID", (0, 0), (-1, -1), 0.4, rc.grey), ("FONTSIZE", (0, 0), (-1, -1), 8)]
    for i, (c, s) in enumerate(sorted(slots.items(), key=lambda kv: kv[1]), start=1): style.append(("BACKGROUND", (1, i), (1, i), rc.HexColor(c)))
    t.setStyle(TableStyle(style)); S += [t, Spacer(1, 10)]
    steps = ["Open model.3mf in Bambu Studio; choose the P2S 0.4 nozzle printer and your PLA presets; confirm each part's filament matches the slot table.",
             "Do not rotate the model: it is oriented for print-in-place joints. Check the sliced preview for supports where the report lists overhangs.",
             "Slice, and confirm the plate shows no unexpected colour-merging. Print.",
             "Remove from the plate, strip supports/purge, then move every joint through its range once (see table) to free it.",
             "If a joint is fused: warm it with a hair-dryer, twist gently; if it keeps fusing, increase clearance in the model script and re-verify."]
    S.append(Paragraph("2. Print", st["Heading2"]))
    S += [Paragraph(f"{i}. {s}", st["Normal"]) for i, s in enumerate(steps, 1)]
    S.append(Paragraph("3. Joints", st["Heading2"]))
    rows = [["Joint", "Range (deg)", "Poses checked", "Min gap (mm)"]] + [[s["joint"], f"{s['range'][0]}..{s['range'][1]}", str(s["angles"]), f"{s['min_gap_mm']:.2f}"] for s in v["joint_sweep"]]
    t = Table(rows); t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, rc.grey), ("FONTSIZE", (0, 0), (-1, -1), 8)])); S.append(t)
    S.append(Paragraph("4. What was inferred", st["Heading2"]))
    S += [Paragraph("&bull; " + x, st["Normal"]) for x in rec["inferred"]]
    S.append(Paragraph("5. Unknown", st["Heading2"])); S += [Paragraph("&bull; " + x, st["Normal"]) for x in rec["unknown"]]
    doc.build(S); print("wrote print_report.txt, assembly_instructions.pdf")

if __name__ == "__main__":
    main()
