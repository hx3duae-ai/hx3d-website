import json, time
from fastapi.testclient import TestClient
from PIL import Image
import io
from hxstudio.server import app

c = TestClient(app)


def wait(jid, t=240):
    for _ in range(int(t / .5)):
        j = c.get(f"/api/jobs/{jid}").json()
        if j["state"] != "running": return j
        time.sleep(.5)
    raise TimeoutError


def test_hardware_models_engines_endpoints():
    assert c.get("/api/media/hardware").json()["tools"]["ffmpeg"]["found"]
    m = c.get("/api/media/models").json(); assert len(m["models"]) >= 5 and "Nothing is downloaded" in m["rule"]
    assert any(e["id"] == "firefly" and e["status"] == "link_only" for e in c.get("/api/media/engines").json()["engines"])


def test_model_install_needs_explicit_approval_and_compatibility():
    assert c.post("/api/media/models/sd_turbo/install", json={}).status_code == 400
    assert c.post("/api/media/models/wan22_ti2v_5b/install", json={"approve": True, "confirm_disk_gb": 24}).status_code in (409,)       # CPU-only build machine
    r = c.post("/api/media/models/sd_turbo/install", json={"approve": True, "confirm_disk_gb": 5}); assert r.status_code == 200 and r.json()["executed"] is False


def test_render_job_end_to_end_and_download():
    sb = c.post("/api/media/storyboard", json={"source": "script", "script": "الطباعة ثلاثية الأبعاد سهلة.\n\nابدأ اليوم بسعر 5 درهم.", "aspect": "9:16"}).json()
    r = c.post("/api/media/render", json={"storyboard": sb, "quality": "draft", "voice": "none", "subtitles": "burn", "name": "t"}).json(); j = wait(r["job_id"]); assert j["state"] == "done", j
    f = c.get(f"/api/media/file/{r['id']}/out.mp4"); assert f.status_code == 200 and len(f.content) > 10000 and f.content[4:8] == b"ftyp"
    it = c.get(f"/api/media/items/{r['id']}").json(); assert it["status"] == "done" and it["manifest"]["verify"]["passed"]
    assert any(i["id"] == r["id"] for i in c.get("/api/media/items").json()); assert c.delete(f"/api/media/items/{r['id']}").status_code == 200


def test_unavailable_voice_is_refused_not_faked():
    sb = c.post("/api/media/storyboard", json={"source": "script", "script": "مرحبا بكم", "aspect": "9:16"}).json()
    r = c.post("/api/media/render", json={"storyboard": sb, "voice": "hx_emirati"}); assert r.status_code == 409 and "not available" in r.json()["detail"]


def test_path_traversal_blocked_and_bad_input_rejected():
    sb = {"aspect": "9:16", "scenes": [{"kind": "image_motion", "image": "/etc/passwd", "elements": []}]}
    assert c.post("/api/media/render", json={"storyboard": sb}).status_code == 400
    assert c.get("/api/media/file/uploads/../../../etc/passwd").status_code in (404, 400)
    assert c.post("/api/media/storyboard", json={"source": "script", "script": "  "}).status_code == 400


def test_image_endpoint_and_upload():
    im = Image.new("RGBA", (200, 100), (0, 150, 80, 255)); b = io.BytesIO(); im.save(b, "PNG")
    m = c.post("/api/media/image", data={"preset": "youtube_thumbnail", "headline": "HX 3D", "cta": "Go"}, files={"product": ("p.png", b.getvalue())}).json()
    assert m["manifest"]["size"] == [1280, 720] and c.get(f"/api/media/file/{m['id']}/out.png").status_code == 200
    assert c.post("/api/media/image", data={"preset": "nope"}).status_code == 400
    assert c.post("/api/media/upload", files={"file": ("x.exe", b"MZ")}).status_code == 400
