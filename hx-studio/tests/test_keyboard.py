import math, numpy as np, pytest, trimesh
from hxstudio import keyboard as K, keycap as KC, registry as R
from hxstudio.config import PRINTERS

COUNTS = {"60": 61, "65": 67, "75": 83, "tkl": 87, "full": 104}


@pytest.mark.parametrize("lay,n", COUNTS.items())
def test_layout_key_counts(lay, n): assert len(K.layout(lay)) == n


@pytest.mark.parametrize("lay", list(COUNTS))
def test_keyboard_qc_and_p2s_fit(lay):
    parts, info, qc = R.build("keyboard", {"kb": {"layout": lay}, "fit_test": False}, {})
    assert qc["passed"], [c for c in qc["checks"] if not c["ok"]]
    usable = PRINTERS["bambu_p2s"]["build_volume"][0] - 2 * PRINTERS["bambu_p2s"]["margin"]
    for p in parts: assert p.mesh.is_volume and p.mesh.extents[0] <= usable and p.mesh.extents[1] <= usable, p.name


def test_switch_windows_are_14mm_measured():
    parts, info, qc = R.build("keyboard", {"kb": {"layout": "60"}, "fit_test": False}, {})
    assert next(c for c in qc["checks"] if c["id"] == "switch_cutouts")["ok"]
    assert next(c for c in qc["checks"] if c["id"] == "stabilizer_cutouts")["ok"]


def test_qc_catches_wrong_cutout():
    parts, info, qc = R.build("keyboard", {"kb": {"layout": "60"}, "fit_test": False}, {})
    p = K.KbParams(layout="60"); p.cutout_tol = 0.4          # claim a different cutout than what was built
    bad = R.kb_qc(parts, info, p); assert not bad["passed"]


def test_split_and_tilt_and_pcb_profile():
    pcb = {"name": "test-pcb", "holes": [{"x": 10, "y": 10, "d": 2.2}, {"x": 200, "y": 70, "d": 2.2}]}
    parts, info, qc = R.build("keyboard", {"kb": {"layout": "65", "split_angle": 8, "tilt_deg": 6, "pcb": pcb}, "fit_test": False}, {})
    assert qc["passed"] and info["pcb_standoffs"] == 2 and any("wedge" in p.name for p in parts)


def test_no_pcb_profile_is_reported_not_faked():
    parts, info, qc = R.build("keyboard", {"kb": {"layout": "60"}, "fit_test": False}, {})
    assert info["pcb_standoffs"] == 0 and any("NOT generated" in h for h in info["honesty"])
    c = next(c for c in qc["checks"] if c["id"] == "pcb_mounting"); assert c["level"] == "warn" and "NOT VERIFIED" in c["detail"]


def test_keycap_stem_measured_and_negative():
    p = KC.KeycapParams(legend="Q", legend2="ض"); parts, info = KC.build(p); v = KC.verify(parts, p)
    assert v["passed"] and abs(v["measured"]["slot_len"] - 4.2) < 0.06 and abs(v["measured"]["stem_d"] - 5.5) < 0.15
    p.slot_tol = 0.4; assert not KC.verify(parts, p)["passed"]
    assert info["stems"] == 1 and KC.build(KC.KeycapParams(width_u=2.0))[1]["stems"] == 3     # centre + 2 stabilizer stems


def test_keycap_fits_pitch():
    p = KC.KeycapParams(); bw, bd, *_ = KC.dims(p); assert bw <= K.U - 0.8 and bd <= K.U - 0.8


def test_image_keycap_topper(tmp_path):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (120, 120), (240, 240, 240)); d = ImageDraw.Draw(im); d.ellipse([20, 20, 100, 100], fill=(220, 40, 40)); d.ellipse([45, 45, 75, 75], fill=(20, 20, 20)); f = tmp_path / "i.png"; im.save(f)
    parts, info, v = R.build("keycap", {"legend": "", "legend2": "", "colors": 2}, {"image": str(f)})
    tops = [p for p in parts if p.meta.get("role") == "topper"]; assert len(tops) == 2 and v["passed"]
    assert all(p.mesh.is_volume for p in tops)
