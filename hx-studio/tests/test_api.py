import io, time, json, trimesh
from fastapi.testclient import TestClient
from hxstudio.server import app

c = TestClient(app)


def wait(jid, t=240):
    for _ in range(int(t / 0.5)):
        j = c.get(f"/api/jobs/{jid}").json()
        if j["state"] != "running": return j
        time.sleep(0.5)
    raise TimeoutError


def test_capabilities_are_honest():
    d = c.get("/api/capabilities").json()["capabilities"]
    assert d["image_to_3d"]["volumetric"]["status"] in ("needs_backend", "ready") and d["text_to_3d"]["free_form_description"]["status"] in ("needs_backend", "ready")
    assert d["toy_designer"]["from_image"]["status"] == "needs_backend"


def test_project_lifecycle_text_tool_export():
    r = c.post("/api/projects", data={"tool": "text_to_3d", "name": "t", "params": json.dumps({"text": "HX 3D", "kind": "nameplate"})}).json()
    j = wait(r["job_id"]); assert j["state"] == "done", j
    pv = c.get(f"/api/projects/{r['project_id']}/preview").json(); assert len(pv["parts"]) == 2
    ex = wait(c.post(f"/api/projects/{r['project_id']}/export").json()["job_id"]); assert ex["state"] == "done" and ex["result"]["result"]["refused"] is None
    assert c.get(f"/api/projects/{r['project_id']}/zip").status_code == 200
    a = c.get(f"/api/projects/{r['project_id']}/analysis").json(); assert a["filament_g_total"] > 0
    assert c.delete(f"/api/projects/{r['project_id']}").status_code == 200


def test_doctor_endpoint_diagnoses_and_repairs():
    b = trimesh.creation.box([10, 10, 10]); bad = trimesh.Trimesh(b.vertices, b.faces[1:], process=False); data = bad.export(file_type="stl")
    rep = c.post("/api/doctor", files={"mesh": ("bad.stl", data)}, data={"repair": "false"}).json()["report"]; assert not rep["printable"]
    fx = c.post("/api/doctor", files={"mesh": ("bad.stl", data)}, data={"repair": "true"}).json(); assert fx["report"]["after"]["printable"] and fx["project_id"]


def test_inventory_colormatch_and_cost():
    assert c.post("/api/inventory/example").status_code == 200
    m = c.post("/api/colors/match", json={"colors": ["#ff66b2"]}).json(); assert m["matches"][0]["verdict"] == "excellent"
    cost = c.post("/api/business/cost", json={"grams_by_color": {"a": 10, "b": 10}, "hours": 2, "height_mm": 30}).json(); assert cost["price_ex_vat"] > cost["cost_total"] > 0
    assert c.post("/api/business/quote", json={"client": {"name": "A"}, "lines": [{"desc": "x", "qty": 1, "unit": 10}]}).content[:4] == b"%PDF"


def test_ui_is_served():
    assert "HX 3D AI Studio" in c.get("/").text and c.get("/web/app.js").status_code == 200
