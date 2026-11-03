import json, zipfile, numpy as np, trimesh, pytest
from PIL import Image, ImageDraw
from hxstudio import tools as T, export as E, registry as R, solids as S
from hxstudio.meshutil import Part


@pytest.fixture
def img(tmp_path):
    im = Image.new("RGB", (200, 200), (250, 250, 250)); d = ImageDraw.Draw(im); d.ellipse([20, 20, 180, 180], fill=(220, 40, 40)); d.ellipse([70, 70, 130, 130], fill=(30, 30, 200)); f = tmp_path / "x.png"; im.save(f); return str(f)


def test_relief_regions_tile_without_overlap(img):
    parts, info = T.image_to_relief(img, 50, colors=3)
    assert len(parts) >= 2 and all(p.mesh.is_volume for p in parts) and "2.5D" in info["kind"] and info["not_inferable"]
    from hxstudio.meshutil import inter
    for i, a in enumerate(parts):
        for b in parts[i + 1:]:
            x = inter(a.mesh, b.mesh); assert (x.volume if len(x.faces) else 0) < 0.5


def test_lithophane_closed_and_sized(img):
    parts, info = T.lithophane(img, 50); m = parts[0].mesh
    assert m.is_watertight and m.volume > 0 and abs(m.extents[0] - 50) < 2 and m.extents[2] <= 3.3


def test_gears_detect_collision():
    ok = T.gear_pair()[1]["mesh_sweep"]; assert ok["ok"]
    assert not T.gear_pair(center_extra=-1.5)[1]["mesh_sweep"]["ok"]


def test_hinge_motion_sweep_and_clearance():
    parts, info = T.hinge(); assert info["sweep"]["ok"] and info["sweep"]["min_gap_mm"] >= 0.2


def test_box_lid_and_text(img):
    parts, info = T.box_generator(); assert all(p.mesh.is_volume for p in parts)
    p, i = T.text_to_3d("مرحبا", "keychain"); assert i["arabic"] and all(x.mesh.is_volume for x in p)


def test_primitive_spec_cut_and_colors():
    parts, _ = T.from_spec({"parts": [{"name": "a", "shape": "box", "size": [20, 20, 20], "color": "#ff0000"}, {"shape": "cylinder", "size": [6, 40], "op": "cut"}]})
    assert len(parts) == 1 and parts[0].mesh.is_volume and parts[0].mesh.volume < 8000


def test_split_model_creates_pieces_with_pins():
    m = trimesh.creation.box([300, 40, 40]); parts, info = T.split_model(m, "x", 238, 4.0)
    assert len(parts) == 2 and all(p.mesh.extents[0] <= 238 for p in parts) and info["cuts"][0]["pins"] > 0


def test_export_3mf_roundtrip_and_step(tmp_path):
    feats = [S.poly(__import__("shapely.geometry", fromlist=["box"]).box(0, 0, 30, 20), 0, 5), S.cyl(15, 10, 4, -0.1, 5.1, "cut")]
    p1 = Part("plate", S.to_mesh(feats), "#ff66b2", "a", step_shape=feats, meta={"object": "plate"})
    p2 = Part("cap", trimesh.creation.box([10, 10, 10]), "#050505", "b", meta={"object": "cap"})
    r = E.export_all(tmp_path, "t", [p1, p2], {}, "T"); assert r["refused"] is None and r["validation_3mf"][0]["passed"]
    assert "step/plate.step" in r["files"] and "cap" in " ".join(r["step"]["not_available"])
    with zipfile.ZipFile(tmp_path / "t_print_plates.3mf") as z: assert b'extruder' in z.read("Metadata/model_settings.config")
    from build123d import import_step
    solid = import_step(str(tmp_path / "step" / "plate.step")); assert abs(solid.volume - p1.mesh.volume) / p1.mesh.volume < 0.01


def test_export_refuses_invalid_and_oversize(tmp_path):
    bad = Part("open", trimesh.Trimesh(trimesh.creation.box([5, 5, 5]).vertices, trimesh.creation.box([5, 5, 5]).faces[1:], process=False), "#fff", "x")
    r = E.export_all(tmp_path / "a", "t", [bad], {}, "T"); assert r["refused"] and not (tmp_path / "a" / "t_print_plates.3mf").exists()
    big = Part("big", trimesh.creation.box([400, 10, 10]), "#fff", "x"); r2 = E.export_all(tmp_path / "b", "t", [big], {}, "T"); assert r2["refused"]


def test_export_failed_qc_blocks(tmp_path):
    ok = Part("c", trimesh.creation.box([5, 5, 5]), "#fff", "x"); r = E.export_all(tmp_path, "t", [ok], {}, "T", extra_checks={"passed": False}); assert r["refused"]


def test_toy_robot_joints_verified(tmp_path):
    parts, info, qc = R.build("toy_robot", {"_workdir": str(tmp_path), "step": 20.0}, {})
    assert qc["passed"] and len(info["joint_sweep"]) == 5 and all(s["min_gap_mm"] >= 0.25 for s in info["joint_sweep"])


def test_arabic_font_library_all_usable_and_licensed():
    from pathlib import Path
    from hxstudio import textgeo
    from hxstudio.meshutil import extrude
    fs = [f for f in textgeo.list_fonts() if f["id"] != "auto"]
    assert len(fs) >= 14
    for f in fs:
        g = textgeo.text_polygons("فاطمة", 20, f["id"]); assert extrude(g, 0, 2).is_volume, f["id"]
    assert len(list((Path(textgeo.FONTS) / "arabic" / "licenses").glob("OFL-*.txt"))) >= 12


def test_calligraphy_image_trace_warns_about_thin_strokes(img):
    parts, info = T.sketch_to_3d(img, width_mm=20, thickness=2)
    assert parts[0].mesh.is_volume and "thin_stroke_area_pct" in info
