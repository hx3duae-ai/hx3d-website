"""Export + validation: Bambu-style multicolour 3MF (assembly and print plates), STL, STEP, PDF, parts list. Gate: validate first."""
from __future__ import annotations
import csv, io, json, zipfile, datetime
from pathlib import Path
from xml.sax.saxutils import escape
import numpy as np, trimesh
from .config import PRINTERS, DEFAULT_PRINTER, MATERIALS, BRAND
from .meshutil import Part
from . import doctor


def objects_of(parts):
    obj = {}
    for p in parts: obj.setdefault(p.meta.get("object", p.name), []).append(p)
    return obj


def _flip(m):
    m = m.copy(); m.apply_transform(trimesh.transformations.rotation_matrix(np.pi, [1, 0, 0])); m.apply_translation([0, 0, -m.bounds[0][2]]); return m


def print_layout(parts, printer=DEFAULT_PRINTER, gap=4.0):
    """Orient every object (flip flagged ones, drop to Z=0) and shelf-pack onto plates. Returns [{objects:[(name,[(part,mesh)])],plate}]"""
    P = PRINTERS[printer]; W = P["build_volume"][0] - 2 * P["margin"]; D = P["build_volume"][1] - 2 * P["margin"]
    items = []
    for name, ps in objects_of(parts).items():
        flip = any(p.meta.get("flip") for p in ps)
        ms = [(p, _flip(p.mesh) if False else p.mesh) for p in ps]
        allv = np.vstack([p.mesh.vertices for p in ps])
        if flip:
            T = trimesh.transformations.rotation_matrix(np.pi, [1, 0, 0]); ms = []
            for p in ps: m = p.mesh.copy(); m.apply_transform(T); ms.append((p, m))
        allv = np.vstack([m.vertices for _, m in ms]); mn = allv.min(0)
        for _, m in ms: m.apply_translation([-mn[0], -mn[1], -mn[2]])
        ext = allv.max(0) - mn
        items.append({"name": name, "meshes": ms, "w": float(ext[0]), "d": float(ext[1]), "h": float(ext[2])})
    items.sort(key=lambda i: -i["d"]); plates = []; cur = None
    def new(): return {"x": 0.0, "y": 0.0, "row_h": 0.0, "items": []}
    cur = new(); plates.append(cur); problems = []
    for it in items:
        if it["w"] > W or it["d"] > D or it["h"] > P["build_volume"][2] - P["margin"]:
            problems.append(f"{it['name']} ({it['w']:.0f}x{it['d']:.0f}x{it['h']:.0f} mm) exceeds the usable plate"); 
        if cur["x"] + it["w"] > W:
            cur["x"] = 0.0; cur["y"] += cur["row_h"] + gap; cur["row_h"] = 0.0
        if cur["y"] + it["d"] > D and cur["items"]:
            cur = new(); plates.append(cur)
        it["px"], it["py"] = cur["x"], cur["y"]; cur["items"].append(it); cur["x"] += it["w"] + gap; cur["row_h"] = max(cur["row_h"], it["d"])
    return plates, problems


def _mesh_xml(m, oid, name):
    v = "".join(f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>' for x, y, z in m.vertices)
    t = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in m.faces)
    return f'<object id="{oid}" name="{escape(name)}" type="model"><mesh><vertices>{v}</vertices><triangles>{t}</triangles></mesh></object>'


def write_3mf(path, plates, printer=DEFAULT_PRINTER, title="HX 3D", assembly=False):
    """plates = [{items:[{name, meshes:[(Part, mesh)], px, py}]}]. One build item per object; Bambu multi-part object metadata."""
    P = PRINTERS[printer]
    cols = []
    for pl in plates:
        for it in pl["items"]:
            for p, _ in it["meshes"]:
                c = p.color.lower()
                if c not in cols: cols.append(c)
    slot = {c: i + 1 for i, c in enumerate(cols)}
    oid = 1; res = []; build = []; cfg = []; plate_cfg = []
    for pi, pl in enumerate(plates, 1):
        inst = []
        for it in pl["items"]:
            comp = []; parts_cfg = []
            for p, m in it["meshes"]:
                oid += 1; res.append(_mesh_xml(m, oid, p.name)); comp.append(f'<component objectid="{oid}"/>')
                parts_cfg.append(f'<part id="{oid}" subtype="normal_part"><metadata key="name" value="{escape(p.name)}"/><metadata key="extruder" value="{slot[p.color.lower()]}"/></part>')
            oid += 1; aid = oid
            res.append(f'<object id="{aid}" name="{escape(it["name"])}" type="model"><components>{"".join(comp)}</components></object>')
            ox, oy = (it["px"] + P["margin"], it["py"] + P["margin"]) if not assembly else (0, 0)
            build.append(f'<item objectid="{aid}" transform="1 0 0 0 1 0 0 0 1 {ox:.3f} {oy:.3f} 0" printable="1"/>')
            cfg.append(f'<object id="{aid}"><metadata key="name" value="{escape(it["name"])}"/><metadata key="extruder" value="1"/>{"".join(parts_cfg)}</object>')
            inst.append(f'<model_instance><metadata key="object_id" value="{aid}"/><metadata key="instance_id" value="0"/></model_instance>')
        plate_cfg.append(f'<plate><metadata key="plater_id" value="{pi}"/><metadata key="plater_name" value=""/>{"".join(inst)}</plate>')
    model = ('<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
             'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"><metadata name="Application">HX 3D AI Studio</metadata>'
             f'<metadata name="Title">{escape(title)}</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><resources>{"".join(res)}</resources><build>{"".join(build)}</build></model>')
    ct = ('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
    proj = {"printer_model": P["name"], "printer_settings_id": P["name"] + " 0.4 nozzle", "nozzle_diameter": [str(P["nozzle"])],
            "filament_colour": [c.upper() for c in cols], "filament_type": ["PLA"] * len(cols),
            "_note": "HX 3D writes names/colours/extruder mapping only; pick the stock printer + filament presets inside Bambu Studio and re-slice."}
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct); z.writestr("_rels/.rels", rels); z.writestr("3D/3dmodel.model", model)
        z.writestr("Metadata/model_settings.config", f'<?xml version="1.0" encoding="UTF-8"?><config>{"".join(cfg)}{"".join(plate_cfg)}</config>')
        z.writestr("Metadata/project_settings.config", json.dumps(proj, indent=2))
    return {"colors": cols, "filament_slots": slot, "objects": sum(len(p["items"]) for p in plates), "plates": len(plates)}


def validate_3mf(path, parts_expected, printer=DEFAULT_PRINTER, check_bed=True, assembly=False):
    """Independent re-read of the written file."""
    import lib3mf
    res = {"file": str(path), "checks": []}
    def add(i, ok, d): res["checks"].append({"id": i, "ok": bool(ok), "detail": d})
    try:
        w = lib3mf.get_wrapper(); m = w.CreateModel(); m.QueryReader("3mf").ReadFromFile(str(path))
        it = m.GetMeshObjects(); n = 0; tris = 0
        while it.MoveNext(): n += 1; tris += it.GetCurrentMeshObject().GetTriangleCount()
        add("lib3mf_reads", True, f"{n} mesh objects, {tris} triangles")
        add("object_count", n == len(parts_expected), f"{n} vs {len(parts_expected)} expected")
        add("triangle_count", tris == sum(len(p.mesh.faces) for p in parts_expected), f"{tris} triangles")
    except Exception as e:
        add("lib3mf_reads", False, repr(e))
    with zipfile.ZipFile(path) as z:
        add("bambu_metadata", "Metadata/model_settings.config" in z.namelist() and b"extruder" in z.read("Metadata/model_settings.config"), "model_settings.config with extruder mapping")
    res["passed"] = all(c["ok"] for c in res["checks"]); res["bambu_studio_opened"] = False
    return res


def validate_parts(parts, printer=DEFAULT_PRINTER, material="PLA", plates_problems=None):
    P = PRINTERS[printer]; checks = []
    def add(i, ok, d, lvl="fail"): checks.append({"id": i, "ok": bool(ok), "detail": d, "level": lvl})
    for p in parts:
        m = p.mesh
        add(f"mesh_{p.name}", len(m.faces) > 0 and m.is_volume, f"watertight volume={m.volume:.1f} mm3" if len(m.faces) and m.is_volume else "NOT a valid closed volume")
    for plate_problem in (plates_problems or []): add("fits_plate", False, plate_problem)
    return {"passed": all(c["ok"] for c in checks if c["level"] == "fail"), "checks": checks}


def export_all(outdir, name, parts, info, project_name="HX 3D project", material="PLA", printer=DEFAULT_PRINTER, extra_checks=None, bom=None, kind="generic", client=None):
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True); files = []; log = []
    pv = validate_parts(parts, printer, material)
    plates, problems = print_layout(parts, printer)
    pv2 = validate_parts(parts, printer, material, problems)
    result = {"validation": pv2, "extra": extra_checks or {}, "files": [], "refused": None}
    gate_ok = pv2["passed"] and (extra_checks is None or extra_checks.get("passed", True))
    if not gate_ok:
        result["refused"] = "Export refused: validation failed. Fix the listed problems first."
        (out / "validation.json").write_text(json.dumps(result, indent=2, default=str)); return result
    # 3MF: print plates and an assembled reference
    m1 = write_3mf(out / f"{name}_print_plates.3mf", plates, printer, project_name)
    asm = {"x": 0, "y": 0, "items": [{"name": n, "meshes": [(p, p.mesh) for p in ps], "px": 0, "py": 0} for n, ps in objects_of(parts).items()]}
    m2 = write_3mf(out / f"{name}_assembly.3mf", [asm], printer, project_name, assembly=True)
    v1 = validate_3mf(out / f"{name}_print_plates.3mf", parts, printer); v2 = validate_3mf(out / f"{name}_assembly.3mf", parts, printer)
    result["validation_3mf"] = [v1, v2]
    if not (v1["passed"] and v2["passed"]):
        result["refused"] = "Export refused: written 3MF failed re-validation."; (out / "validation.json").write_text(json.dumps(result, indent=2, default=str)); return result
    # STL (per part + combined) and STEP where a B-rep exists
    (out / "stl").mkdir(exist_ok=True); (out / "step").mkdir(exist_ok=True)
    for p in parts: (out / "stl" / f"{p.name}.stl").write_bytes(p.mesh.export(file_type="stl"))
    (out / f"{name}_combined.stl").write_bytes(trimesh.util.concatenate([p.mesh for p in parts]).export(file_type="stl"))
    step_done, step_skipped = [], []
    for p in parts:
        if p.step_shape is None: step_skipped.append(p.name); continue
        try:
            from build123d import export_step
            from .solids import to_step
            shape = to_step(p.step_shape) if isinstance(p.step_shape, list) else p.step_shape
            export_step(shape, str(out / "step" / f"{p.name}.step")); step_done.append(p.name)
        except Exception as e:
            step_skipped.append(f"{p.name} ({type(e).__name__})")
    result["step"] = {"written": step_done, "not_available": step_skipped,
                      "note": "STEP = true B-rep only for parts built from extrusions/cylinders (keyboard plate/case/bezel, ...); mesh-based parts export STL/3MF only. Split case pieces: STEP is the UNSPLIT part."}
    # parts list (CSV) + materials
    rows = [["part", "colour", "material", "volume_mm3", "est_grams"]]
    dens = MATERIALS[material]["density"]
    for p in parts: rows.append([p.name, p.color, material, round(float(p.mesh.volume), 1), round(float(p.mesh.volume) / 1000 * dens * 0.6, 1)])
    buf = io.StringIO(); csv.writer(buf).writerows(rows); (out / "parts_and_materials.csv").write_text(buf.getvalue())
    if bom: (out / "parts_to_buy.json").write_text(json.dumps(bom, indent=2, ensure_ascii=False))
    _pdf(out / f"{name}_assembly_instructions.pdf", project_name, parts, info, plates, m1, result, bom, material, printer, kind)
    result["files"] = sorted(str(p.relative_to(out)) for p in out.rglob("*") if p.is_file())
    result["plates"] = m1["plates"]; result["colors"] = m1["colors"]
    result["caveats"] = ["Bambu Studio was NOT used to open these files (it is not available here): validated by re-reading with lib3mf.",
                         "Nothing has been test-printed. Clearances and fits are estimates until a physical test.",
                         "Filament/time numbers are estimates; the slicer's numbers override."]
    (out / "validation.json").write_text(json.dumps(result, indent=2, default=str)); return result


def _pdf(path, title, parts, info, plates, m1, result, bom, material, printer, kind):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors as rc
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet
    st = getSampleStyleSheet(); doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    pink = rc.HexColor(BRAND["pink"]); P = PRINTERS[printer]
    S = [Paragraph(f'<font color="#FF66B2" size="22"><b>HX 3D</b></font> &nbsp; AI Studio', st["Normal"]), Spacer(1, 6),
         Paragraph(f"<b>{title}</b> &mdash; assembly &amp; print instructions", st["Title"]), Paragraph(f"Target: {P['name']} + AMS &middot; material {material} &middot; {datetime.date.today()}", st["Normal"]), Spacer(1, 10)]
    S.append(Paragraph("1. Print plates", st["Heading2"]))
    rows = [["Plate", "Objects", "Colours (filament slots)"]]
    for i, pl in enumerate(plates, 1):
        cs = sorted({p.color for it in pl["items"] for p, _ in it["meshes"]})
        rows.append([str(i), ", ".join(it["name"] for it in pl["items"])[:90], " ".join(cs)])
    t = Table(rows, colWidths=[40, 330, 150]); t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.3, rc.grey), ("FONTSIZE", (0, 0), (-1, -1), 7), ("BACKGROUND", (0, 0), (-1, 0), rc.HexColor("#050505")), ("TEXTCOLOR", (0, 0), (-1, 0), rc.white)])); S += [t, Spacer(1, 8)]
    S.append(Paragraph("2. Filament / AMS slots", st["Heading2"]))
    rows = [["Slot", "Colour"]] + [[str(s), c.upper()] for c, s in m1["filament_slots"].items()]
    t = Table(rows, colWidths=[50, 100]); sty = [("GRID", (0, 0), (-1, -1), 0.3, rc.grey)]
    for i, c in enumerate(m1["filament_slots"], 1): sty.append(("BACKGROUND", (1, i), (1, i), rc.HexColor(c)))
    t.setStyle(TableStyle(sty)); S += [t, Spacer(1, 8)]
    if kind == "keyboard":
        S.append(Paragraph("3. Assembly order", st["Heading2"]))
        for i, s in enumerate(["Print all plates. Glue plate and case pieces where the report lists a butt/zig-zag joint (pins align the case pieces).",
                               "Fit-test one switch and one stabilizer in the fit-test plate FIRST, before printing the full plate.",
                               "Mount stabilizers and switches in the plate, solder/seat them in your PCB (your PCB's own instructions).",
                               "Seat the PCB/plate stack on the bottom case posts; connect USB-C to the controller; place the top bezel and fasten with the listed screws.",
                               "Press keycaps on; test every key before closing the case."], 1): S.append(Paragraph(f"{i}. {s}", st["Normal"]))
    S.append(Paragraph("4. Parts list", st["Heading2"]))
    rows = [["Part", "Colour", "Volume mm3"]] + [[p.name, p.color, f"{p.mesh.volume:.0f}"] for p in parts[:60]]
    if len(parts) > 60: rows.append([f"... {len(parts) - 60} more (see parts_and_materials.csv)", "", ""])
    t = Table(rows, colWidths=[300, 80, 100]); t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.3, rc.grey), ("FONTSIZE", (0, 0), (-1, -1), 7)])); S += [t, Spacer(1, 8)]
    if bom:
        S.append(Paragraph("5. Buy separately (NOT printed)", st["Heading2"]))
        rows = [["Item", "Qty", "Note"]] + [[b["item"], str(b["qty"]), b.get("note", "")[:80]] for b in bom]
        t = Table(rows, colWidths=[170, 40, 270]); t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.3, rc.grey), ("FONTSIZE", (0, 0), (-1, -1), 7)])); S += [t, Spacer(1, 8)]
    S.append(Paragraph("Honesty", st["Heading2"]))
    for c in result.get("caveats", ["Bambu Studio not used to open the files", "Not test-printed"]): S.append(Paragraph("&bull; " + c, st["Normal"]))
    for n in (info or {}).get("honesty", []) + (info or {}).get("notes", []): S.append(Paragraph("&bull; " + str(n), st["Normal"]))
    doc.build(S)
