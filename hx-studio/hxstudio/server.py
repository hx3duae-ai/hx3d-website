"""HX 3D AI Studio API server (FastAPI). Run:  uvicorn hxstudio.server:app --port 8420"""
from __future__ import annotations
import base64, hashlib, io, json, shutil, threading, time, traceback, uuid, warnings, zipfile
from pathlib import Path
import numpy as np, trimesh
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from . import registry, backends, doctor, optimizer, colors as C, business, export as E
from .config import DATA, ROOT, MATERIALS, PRINTERS, DEFAULT_PRINTER, BRAND

warnings.filterwarnings("ignore")
app = FastAPI(title="HX 3D AI Studio", version="0.1.0")
PROJ = DATA / "projects"; PROJ.mkdir(parents=True, exist_ok=True)
INV = DATA / "inventory.json"
JOBS: dict[str, dict] = {}
CACHE: dict[str, dict] = {}
LOCK = threading.Lock()


def job(fn, *a):
    jid = uuid.uuid4().hex[:10]; JOBS[jid] = {"id": jid, "state": "running", "progress": 0, "stage": "queued", "result": None, "error": None, "t0": time.time()}
    def prog(p, s=""): JOBS[jid].update(progress=round(float(p)), stage=s)
    def run():
        try: JOBS[jid]["result"] = fn(*a, prog); JOBS[jid].update(state="done", progress=100, stage="done")
        except Exception as e:
            JOBS[jid].update(state="error", error=f"{type(e).__name__}: {e}", trace=traceback.format_exc()[-1500:])
    threading.Thread(target=run, daemon=True).start(); return jid


def pdir(pid):
    d = PROJ / pid
    if not d.exists(): raise HTTPException(404, "project not found")
    return d


def meta(pid): return json.loads((pdir(pid) / "project.json").read_text())
def save_meta(pid, m): (PROJ / pid / "project.json").write_text(json.dumps(m, indent=2, default=str, ensure_ascii=False))


def files_of(pid):
    d = PROJ / pid / "files"; return {p.stem if p.stem in ("image", "mesh", "font") else p.stem: str(p) for p in d.glob("*")} if d.exists() else {}


def get_build(pid, force=False, progress=lambda *_: None):
    m = meta(pid); key = hashlib.sha1(json.dumps([m["tool"], m["params"]], sort_keys=True, default=str).encode()).hexdigest()
    with LOCK:
        c = CACHE.get(pid)
        if c and c["key"] == key and not force: return c
    params = dict(m["params"]); params["_workdir"] = str(PROJ / pid / "work")
    parts, info, qc = registry.build(m["tool"], params, files_of(pid), progress)
    info.pop("_workdir", None)
    c = {"key": key, "parts": parts, "info": info, "qc": qc}
    with LOCK: CACHE[pid] = c
    return c


def summarize(c):
    parts = c["parts"]
    if not parts: return {}
    v = np.vstack([p.mesh.vertices for p in parts if len(p.mesh.vertices)])
    ext = (v.max(0) - v.min(0)).round(2).tolist(); P = PRINTERS[DEFAULT_PRINTER]; usable = [x - 2 * P["margin"] for x in P["build_volume"]]
    return {"parts": len(parts), "extents_mm": ext, "colors": sorted({p.color.lower() for p in parts}),
            "fits_printer_as_one_piece": all(a <= b for a, b in zip(ext, usable)), "printer": P["name"], "qc": c["qc"], "info": {k: v for k, v in c["info"].items() if k not in ("keys_geom", "switch_cutouts")}}


# ------------------------------------------------------------------ meta
@app.get("/api/fonts")
def fonts():
    from . import textgeo
    return textgeo.list_fonts()


@app.get("/api/capabilities")
def caps(): return {"brand": BRAND, "printers": PRINTERS, "materials": MATERIALS, "capabilities": backends.capabilities(), "version": "0.1.0"}


# ------------------------------------------------------------------ projects
@app.post("/api/projects")
async def create_project(tool: str = Form(...), name: str = Form("Untitled"), params: str = Form("{}"), image: UploadFile | None = File(None),
                         mesh: UploadFile | None = File(None), font: UploadFile | None = File(None)):
    pid = uuid.uuid4().hex[:10]; d = PROJ / pid; (d / "files").mkdir(parents=True)
    for k, f in (("image", image), ("mesh", mesh), ("font", font)):
        if f and f.filename:
            ext = Path(f.filename).suffix.lower() or ".bin"; (d / "files" / f"{k}{ext}").write_bytes(await f.read())
    m = {"id": pid, "name": name, "tool": tool, "params": json.loads(params), "created": time.time(), "updated": time.time()}
    save_meta(pid, m)
    jid = job(lambda prog: _build_job(pid, prog)); return {"project_id": pid, "job_id": jid}


def _build_job(pid, prog):
    c = get_build(pid, True, prog); s = summarize(c); m = meta(pid); m["summary"] = {k: v for k, v in s.items() if k != "info"}; m["updated"] = time.time(); save_meta(pid, m); return {"project_id": pid, "summary": s}


@app.put("/api/projects/{pid}")
async def update_project(pid: str, body: dict):
    m = meta(pid)
    if "params" in body: m["params"] = body["params"]
    if "name" in body: m["name"] = body["name"]
    save_meta(pid, m); return {"project_id": pid, "job_id": job(lambda prog: _build_job(pid, prog))}


@app.get("/api/projects")
def list_projects():
    out = []
    for d in sorted(PROJ.iterdir(), key=lambda p: -p.stat().st_mtime):
        try: m = json.loads((d / "project.json").read_text()); out.append({k: m.get(k) for k in ("id", "name", "tool", "created", "updated")} | {"summary": m.get("summary", {})})
        except Exception: pass
    return out


@app.get("/api/projects/{pid}")
def get_project(pid: str):
    m = meta(pid)
    try: c = get_build(pid)
    except Exception as e: raise HTTPException(500, f"build failed: {e}")
    return {**m, "summary": summarize(c)}


@app.delete("/api/projects/{pid}")
def delete_project(pid: str): shutil.rmtree(pdir(pid)); CACHE.pop(pid, None); return {"deleted": pid}


def b64(a): return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


@app.get("/api/projects/{pid}/preview")
def preview(pid: str, layout: str = "assembled"):
    c = get_build(pid); out = []
    for p in c["parts"]:
        m = p.mesh; v = m.vertices
        out.append({"name": p.name, "object": p.meta.get("object", p.name), "group": p.group, "color": p.color, "faces": int(len(m.faces)),
                    "v": b64(v.astype(np.float32)), "i": b64(m.faces.astype(np.uint32))})
    return {"parts": out, "extents": summarize(c)["extents_mm"]}


# ------------------------------------------------------------------ analysis
@app.get("/api/jobs/{jid}")
def job_status(jid: str):
    if jid not in JOBS: raise HTTPException(404)
    return JOBS[jid]


@app.get("/api/projects/{pid}/keys")
def keys_geom(pid: str): return get_build(pid)["info"].get("keys_geom", [])


@app.get("/api/projects/{pid}/analysis")
def analysis(pid: str, material: str = "PLA", layer: float = 0.2, infill: float = 0.15):
    c = get_build(pid); per_obj = {}; tips = []
    for name, ps in E.objects_of(c["parts"]).items():
        mm = trimesh.util.concatenate([p.mesh for p in ps]);
        if any(p.meta.get("flip") for p in ps): mm.apply_transform(trimesh.transformations.rotation_matrix(np.pi, [1, 0, 0])); mm.apply_translation([0, 0, -mm.bounds[0][2]])
        per_obj[name] = (mm, ps)
    # keep the report small for big sets: aggregate
    tot_g = 0.0; tot_h = 0.0; colors_g: dict[str, float] = {}; worst = None; ov = []
    mats = {"material": material}
    for name, (mm, ps) in list(per_obj.items()):
        for p in ps:
            e = optimizer.estimate(p.mesh, material, layer=layer, infill=infill); colors_g[p.color.lower()] = colors_g.get(p.color.lower(), 0) + e["filament_g"]; tot_g += e["filament_g"]; tot_h += e["est_hours"]
        a = optimizer.analyse(mm, MATERIALS[material]["max_overhang"]); ov.append((a["overhang_pct"], name))
    ov.sort(reverse=True)
    mech = c["info"].get("joint_sweep") is not None or "hinge" in meta(pid)["tool"] or "gear" in meta(pid)["tool"]
    sample = per_obj[ov[0][1]][0] if ov else None
    orient = optimizer.best_orientation(sample, material)[1] if sample is not None and len(sample.faces) < 60000 else None
    tips = optimizer.recommend(sample, orient, {"filament_g": tot_g}, material, mechanical=mech, colors=len(colors_g)) if orient else []
    return {"filament_g_total": round(tot_g, 1), "est_print_hours": round(tot_h, 1), "per_colour_g": {k: round(v, 1) for k, v in colors_g.items()},
            "worst_overhang_objects": [{"object": n, "overhang_pct": round(p, 1)} for p, n in ov[:5]], "orientation_sample": orient and {"object": ov[0][1], **orient["best"]},
            "recommendations": tips, "printer": PRINTERS[DEFAULT_PRINTER]["name"],
            "honesty": "Filament/time are estimates (+-35%); print orientation of assembly parts is fixed by design (flip flags), the optimiser reports the worst object."}


@app.get("/api/projects/{pid}/colors")
def project_colors(pid: str, material: str | None = None):
    c = get_build(pid); cols = sorted({p.color.lower() for p in c["parts"]})
    inv = json.loads(INV.read_text()) if INV.exists() else []
    m = C.match(cols, inv, material); plan = C.plan_ams(m)
    return {"colors": cols, "matches": m, "ams": plan, "inventory_size": len(inv)}


# ------------------------------------------------------------------ export
@app.post("/api/projects/{pid}/export")
def export_project(pid: str, body: dict | None = None):
    body = body or {}
    def run(prog):
        prog(5, "building"); c = get_build(pid); m = meta(pid); out = PROJ / pid / "exports"
        if out.exists(): shutil.rmtree(out)
        prog(30, "validating + writing files")
        r = E.export_all(out, "model", c["parts"], c["info"], m["name"], body.get("material", "PLA"), extra_checks=c["qc"], bom=c["info"].get("bom"), kind="keyboard" if m["tool"] == "keyboard" else "generic")
        prog(95, "packing"); return {"result": r}
    return {"job_id": job(run)}


@app.get("/api/projects/{pid}/files/{path:path}")
def get_file(pid: str, path: str):
    f = (PROJ / pid / "exports" / path).resolve()
    if not str(f).startswith(str((PROJ / pid / "exports").resolve())) or not f.is_file(): raise HTTPException(404)
    return FileResponse(f, filename=f.name)


@app.get("/api/projects/{pid}/zip")
def zipall(pid: str):
    d = PROJ / pid / "exports"
    if not d.exists(): raise HTTPException(404, "export first")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in d.rglob("*"):
            if f.is_file(): z.write(f, f.relative_to(d))
    return Response(buf.getvalue(), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="hx3d_{pid}.zip"'})


# ------------------------------------------------------------------ filament inventory + business
def inv_load(): return json.loads(INV.read_text()) if INV.exists() else []


@app.get("/api/inventory")
def inv_get(): return inv_load()


@app.put("/api/inventory")
def inv_put(items: list[dict]): INV.write_text(json.dumps(items, indent=2, ensure_ascii=False)); return {"saved": len(items)}


@app.post("/api/inventory/example")
def inv_example(): INV.write_text(json.dumps(C.EXAMPLE_INVENTORY, indent=2)); return C.EXAMPLE_INVENTORY


@app.post("/api/colors/match")
def colors_match(body: dict):
    inv = body.get("inventory") or inv_load(); m = C.match(body["colors"], inv, body.get("material")); return {"matches": m, "ams": C.plan_ams(m)}


@app.post("/api/business/cost")
def biz_cost(body: dict):
    grams = body.get("grams_by_color")
    if body.get("project_id"):
        a = analysis(body["project_id"], body.get("material", "PLA")); grams = grams or a["per_colour_g"]; hours = body.get("hours") or a["est_print_hours"]
    else: hours = body["hours"]
    h = body.get("height_mm", 30.0)
    return business.cost(grams, hours, h, **{k: body[k] for k in business.DEFAULTS if k in body})


@app.post("/api/business/quote")
def biz_quote(body: dict):
    pdf = business.quote_pdf(body.get("client", {}), body["lines"], body.get("currency", "USD"), body.get("notes", ""))
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="HX3D_quote.pdf"'})


# ------------------------------------------------------------------ model doctor
@app.post("/api/doctor")
async def doctor_api(mesh: UploadFile = File(...), repair: bool = Form(False), remove_specks: bool = Form(False), material: str = Form("PLA")):
    tmp = DATA / "tmp"; tmp.mkdir(exist_ok=True); f = tmp / (uuid.uuid4().hex + Path(mesh.filename).suffix.lower()); f.write_bytes(await mesh.read())
    try:
        m = doctor.load_mesh(str(f))
        if not repair: return {"report": doctor.diagnose(m, material=material)}
        r, rep = doctor.repair(m, remove_specks)
        pid = uuid.uuid4().hex[:10]; (PROJ / pid / "files").mkdir(parents=True); (PROJ / pid / "files" / "mesh.stl").write_bytes(r.export(file_type="stl"))
        save_meta(pid, {"id": pid, "name": "Repaired " + mesh.filename, "tool": "doctor", "params": {}, "created": time.time(), "updated": time.time()})
        return {"report": rep, "project_id": pid if rep["accepted"] else None}
    finally: f.unlink(missing_ok=True)


web = ROOT / "web"
app.mount("/fonts", StaticFiles(directory=str(ROOT / "fonts")), name="fonts")
if web.exists():
    app.mount("/web", StaticFiles(directory=str(web)), name="web")
    @app.get("/")
    def index(): return FileResponse(web / "index.html")
