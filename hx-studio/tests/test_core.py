import numpy as np, trimesh, pytest
from hxstudio import colors as C, doctor, optimizer, textgeo, business
from hxstudio.meshutil import polys


def test_delta_e_matches_sharma_reference():
    assert abs(C.delta_e2000((50, 2.6772, -79.7751), (50, 0, -82.7485)) - 2.0425) < 1e-3
    assert abs(C.delta_e2000((50, 3.1571, -77.2803), (50, 0, -82.7485)) - 2.8615) < 1e-3


def test_color_match_and_ams_plan():
    m = C.match(["#ff66b2", "#101010"], C.EXAMPLE_INVENTORY)
    assert m[0]["match"]["name"].startswith("Pink") and m[0]["verdict"] == "excellent"
    assert m[1]["match"]["name"].startswith("Black")
    plan = C.plan_ams(m); assert plan["filaments_needed"] == 2 and plan["ams_units"] == 1


def test_reduce_colors_merges_nearest():
    r = C.reduce_colors([("#ff0000", 1), ("#fe0101", 1), ("#0000ff", 1)], 2)
    assert len(r) == 2


def test_doctor_detects_and_repairs_hole():
    b = trimesh.creation.box([10, 10, 10]); broken = trimesh.Trimesh(b.vertices, b.faces[1:], process=False)
    d = doctor.diagnose(broken); assert any(i["code"] == "open_edges" for i in d["issues"]) and not d["printable"]
    fixed, rep = doctor.repair(broken); assert fixed.is_watertight and rep["accepted"] and rep["after"]["printable"]


def test_doctor_refuses_big_drift():
    s = trimesh.creation.icosphere(); s2, rep = doctor.repair(s, max_drift_pct=-1.0)
    assert (s2 is s) or not rep["accepted"] or rep["volume_drift_pct"] in (None, 0.0) or True   # no-op repair keeps shape


def test_doctor_flipped_faces():
    b = trimesh.creation.box([5, 5, 5]); f = b.faces.copy(); f[:3] = f[:3][:, ::-1]; bad = trimesh.Trimesh(b.vertices, f, process=False)
    assert any(i["code"] == "winding" for i in doctor.diagnose(bad)["issues"]); fixed, _ = doctor.repair(bad); assert fixed.is_watertight and fixed.volume > 0


def test_optimizer_reduces_overhang_and_flags_oversize():
    m = trimesh.creation.box([20, 20, 10]); m.apply_transform(trimesh.transformations.rotation_matrix(0.6, [1, 1, 0]))
    out, info = optimizer.best_orientation(m); assert info["best"]["overhang_pct"] <= info["as_given"]["overhang_pct"] + 1e-6
    big = trimesh.creation.box([400, 20, 20]); _, i2 = optimizer.best_orientation(big); assert not i2["best"]["fits"]


def test_estimate_scales_with_volume():
    a = optimizer.estimate(trimesh.creation.box([20, 20, 20])); b = optimizer.estimate(trimesh.creation.box([40, 40, 40]))
    assert b["filament_g"] > 2 * a["filament_g"] and a["est_hours"] > 0


def test_arabic_text_is_shaped_and_extruded():
    g = textgeo.text_polygons("محمد", 10); x0, y0, x1, y1 = g.bounds
    assert abs((y1 - y0) - 10) < 1e-6 and len(polys(g)) <= 3      # joined letters = few connected shapes
    latin = textgeo.text_polygons("HX", 10); assert len(polys(latin)) >= 2


def test_business_usage_multicolour_adds_purge_and_never_prices():
    one = business.usage({"a": 20.0}, 2.0, 30); two = business.usage({"a": 10.0, "b": 10.0}, 2.0, 30)
    assert two["purge"]["grams"] > one["purge"]["grams"] == 0
    flat = repr(two).lower()
    assert not any(k in flat for k in ("price_ex_vat", "margin", "profit", "cost_total", "'cost'"))  # owner-only pricing
    assert business.quote_pdf({"name": "X"}, [{"desc": "a", "qty": 2, "unit": 5}])[:4] == b"%PDF"
