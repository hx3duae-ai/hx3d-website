"""Stage 5: export a Bambu Studio multicolour 3MF + combined STL. REFUSES unless verified.

    python export_bambu_3mf.py model.py OUT_DIR --preview-reviewed [--name model]

Gate: verify.json passed AND hash == current geometry AND preview.png generated for the same hash AND
--preview-reviewed given (Claude has looked at preview.png). Layout follows Bambu Studio's multi-part
object format: one assembly object -> one component per colour part, extruder (filament slot) per part.
UNVERIFIED against Bambu Studio itself in the build sandbox: the file is re-read with lib3mf + trimesh here.
"""
import argparse, json, sys, zipfile
from pathlib import Path
from xml.sax.saxutils import escape
import numpy as np
import trimesh
from hx_lib import *


def fail(msg):
    print("EXPORT REFUSED:", msg); sys.exit(2)


def mesh_xml(m, oid, name, pid, pidx):
    v = "".join(f'<vertex x="{x:.5f}" y="{y:.5f}" z="{z:.5f}"/>' for x, y, z in m.vertices)
    t = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in m.faces)
    return (f'<object id="{oid}" name="{escape(name)}" type="model" pid="{pid}" pindex="{pidx}"><mesh>'
            f'<vertices>{v}</vertices><triangles>{t}</triangles></mesh></object>')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("model"); ap.add_argument("out")
    ap.add_argument("--preview-reviewed", action="store_true"); ap.add_argument("--name", default="model")
    a = ap.parse_args(); out = Path(a.out)
    spec = load_model(a.model); meshes = meshes_from_spec(spec); h = mesh_hash(meshes, spec)
    try: v = json.loads((out / "verify.json").read_text())
    except Exception: fail("verify.json missing - run verify.py")
    if not v["passed"]: fail("verification FAILED - fix the model")
    if v["hash"] != h: fail("geometry changed since verification - re-run verify.py")
    try: pm = json.loads((out / "preview_meta.json").read_text())
    except Exception: fail("no preview - run render_preview.py and LOOK at it")
    if pm["hash"] != h or not (out / "preview.png").exists(): fail("preview is stale - re-run render_preview.py")
    if not a.preview_reviewed: fail("pass --preview-reviewed after actually viewing preview.png")

    cols = sorted({p["color"].lower() for p in spec["parts"]}, key=lambda c: -sum(
        meshes[p["name"]].volume for p in spec["parts"] if p["color"].lower() == c))
    slot = {c: i + 1 for i, c in enumerate(cols)}          # filament/extruder index, 1-based
    plist = spec["parts"]
    mat = "".join(f'<base name="filament_{slot[c]}" displaycolor="{c.upper()}FF"/>' for c in cols)
    objs, comps, mparts = [], [], []
    for i, p in enumerate(plist, start=2):
        c = p["color"].lower()
        objs.append(mesh_xml(meshes[p["name"]], i, p["name"], 1, slot[c] - 1))
        comps.append(f'<component objectid="{i}"/>')
        mparts.append(f'<part id="{i}" subtype="normal_part"><metadata key="name" value="{escape(p["name"])}"/>'
                      f'<metadata key="extruder" value="{slot[c]}"/></part>')
    asm_id = len(plist) + 2
    model = ('<?xml version="1.0" encoding="UTF-8"?>'
             '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
             'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">'
             '<metadata name="Application">HX-3D-Image-to-3MF (Bambu Studio compatible layout)</metadata>'
             '<metadata name="BambuStudio:3mfVersion">1</metadata>'
             f'<resources><basematerials id="1">{mat}</basematerials>' + "".join(objs) +
             f'<object id="{asm_id}" name="{escape(a.name)}" type="model"><components>{"".join(comps)}</components></object>'
             f'</resources><build><item objectid="{asm_id}" transform="1 0 0 0 1 0 0 0 1 128 128 0" printable="1"/></build></model>')
    lo, hi = np.vstack([m.vertices for m in meshes.values()]).min(0), np.vstack([m.vertices for m in meshes.values()]).max(0)
    settings = ('<?xml version="1.0" encoding="UTF-8"?><config>'
                f'<object id="{asm_id}"><metadata key="name" value="{escape(a.name)}"/><metadata key="extruder" value="1"/>'
                + "".join(mparts) + '</object>'
                '<plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value=""/>'
                f'<model_instance><metadata key="object_id" value="{asm_id}"/><metadata key="instance_id" value="0"/></model_instance></plate>'
                '</config>')
    proj = {"printer_settings_id": "Bambu Lab P2S 0.4 nozzle", "printer_model": "Bambu Lab P2S",
            "nozzle_diameter": ["0.4"], "filament_colour": [c.upper() for c in cols],
            "filament_type": ["PLA"] * len(cols), "layer_height": "0.16", "wall_loops": "3",
            "sparse_infill_density": "15%", "enable_support": "0",
            "_note": "Presets named by intent; open in Bambu Studio and pick the stock P2S + filament presets, then re-slice."}
    ct = ('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
          '<Default Extension="config" ContentType="text/xml"/><Default Extension="png" ContentType="image/png"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
            '<Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/></Relationships>')
    from PIL import Image
    thumb = out / "_thumb.png"; Image.open(out / "preview.png").convert("RGB").resize((512, 288)).save(thumb)
    f3 = out / f"{a.name}.3mf"
    with zipfile.ZipFile(f3, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct); z.writestr("_rels/.rels", rels)
        z.writestr("3D/3dmodel.model", model); z.writestr("Metadata/model_settings.config", settings)
        z.writestr("Metadata/project_settings.config", json.dumps(proj, indent=2))
        z.write(thumb, "Metadata/plate_1.png")
    thumb.unlink()
    whole = trimesh.util.concatenate(list(meshes.values()))
    (out / f"{a.name}.stl").write_bytes(whole.export(file_type="stl"))

    # --- re-read the artefact we just wrote (independent check)
    import lib3mf
    w = lib3mf.get_wrapper(); m = w.CreateModel(); rd = m.QueryReader("3mf"); rd.ReadFromFile(str(f3))
    it = m.GetMeshObjects(); n_obj = 0; tris = 0
    while it.MoveNext():
        o = it.GetCurrentMeshObject(); n_obj += 1; tris += o.GetTriangleCount()
    exp_tris = sum(len(x.faces) for x in meshes.values())
    ok = n_obj == len(plist) and tris == exp_tris
    with zipfile.ZipFile(f3) as z: cfg_ok = f'extruder' in z.read("Metadata/model_settings.config").decode()
    chk = {"file": str(f3), "lib3mf_mesh_objects": n_obj, "expected": len(plist), "triangles": tris,
           "expected_triangles": exp_tris, "bambu_metadata_present": cfg_ok, "filament_slots": {c: s for c, s in slot.items()},
           "geometry_hash": h, "bambu_studio_opened": False}
    (out / "export_check.json").write_text(json.dumps(chk, indent=2))
    if not (ok and cfg_ok): fail(f"re-read check failed: {chk}")
    print("EXPORT OK", json.dumps(chk, indent=2))

if __name__ == "__main__":
    main()
