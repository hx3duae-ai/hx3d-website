"""HTTP API for the Creative Studio (video + image). Mounted by server.py."""
from __future__ import annotations
import json, shutil, time, uuid
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from .media import hardware, catalog, engines, prompts, storyboard as SB, montage, imagestudio, voice as V, comfy
from .media.common import MEDIA, ASPECTS
from .media import icons as ICONS

router = APIRouter(prefix="/api/media")
UP = MEDIA / "uploads"; UP.mkdir(exist_ok=True, parents=True)
_server = {}      # filled by server.py: {"job": fn, "get_build": fn}


def _safe_path(p: str) -> str:
    q = Path(p).resolve()
    if not str(q).startswith(str(UP.resolve())) or not q.is_file(): raise HTTPException(400, "image path must be a file uploaded through /api/media/upload")
    return str(q)


def _check_sb(sb: dict):
    if sb.get("aspect") not in ASPECTS: raise HTTPException(400, f"aspect must be one of {list(ASPECTS)}")
    if not sb.get("scenes"): raise HTTPException(400, "storyboard has no scenes")
    for sc in sb["scenes"]:
        if sc.get("image"): sc["image"] = _safe_path(sc["image"])
        for el in sc.get("elements", []):
            if el.get("type") == "image": el["path"] = _safe_path(el["path"])
    return sb


@router.get("/hardware")
def hw(): return hardware.detect()


@router.get("/models")
def models():
    h = hardware.detect(); return {"hardware": {"tier": h["tier"], "ram_gb": h["ram_gb"], "disk_free_gb": h["disk_free_gb"], "gpus": h["gpus"]}, "models": [catalog.plan(m["id"], h) for m in catalog.MODELS],
            "rule": "Nothing is downloaded automatically. Licences below are unverified recollections: read each model card."}


@router.post("/models/{mid}/install")
def install(mid: str, body: dict):
    h = hardware.detect()
    try: p = catalog.plan(mid, h)
    except KeyError: raise HTTPException(404, "unknown model")
    if not body.get("approve") or body.get("confirm_disk_gb") != p["disk_gb"]: raise HTTPException(400, f"explicit approval required: send {{'approve': true, 'confirm_disk_gb': {p['disk_gb']}}} after reading the licence")
    if not p["compatible"]: raise HTTPException(409, "this machine does not meet the requirements: " + "; ".join(p["problems"]))
    return {"executed": False, "message": "Approved, but this build does not download model weights itself. Run the command below on the machine that will run the model.", "command": p["install"], "plan": p}


@router.get("/engines")
def eng(): return engines.engines()


@router.post("/prompt")
def prompt(body: dict): return prompts.enhance(body["idea"], body.get("kind", "image"), body.get("intent"), body.get("brand", True), body.get("aspect", "9:16"))


@router.get("/icons")
def icon_list(): return sorted(ICONS.ICONS)


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    ext = Path(file.filename or "x.png").suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"): raise HTTPException(400, "images only (png/jpg/webp)")
    name = uuid.uuid4().hex[:12] + ext; (UP / name).write_bytes(await file.read()); return {"path": str(UP / name), "name": name}


@router.post("/storyboard")
def storyboard(body: dict):
    kind = body.get("source", "script")
    if kind == "script":
        if not body.get("script", "").strip(): raise HTTPException(400, "script is empty")
        sb = SB.from_script(body["script"], body.get("template", "vox"), body.get("aspect", "9:16"), body.get("lang"), body.get("intro", True), body.get("outro", True))
    elif kind == "images":
        sb = SB.from_images([{**i, "path": _safe_path(i["path"])} for i in body["items"]], body.get("aspect", "9:16"), body.get("motion", "auto"), body.get("duration", 3.2))
    elif kind == "model":
        sb = SB.from_model(body["project_id"], body.get("title"), body.get("aspect", "9:16"), body.get("seconds", 8.0), body.get("bg", "studio"))
    else: raise HTTPException(400, "source must be script|images|model")
    return sb


def _loader(pid): return [(p.mesh, p.color) for p in _server["get_build"](pid)["parts"]]


@router.post("/render")
def render(body: dict):
    sb = _check_sb(body["storyboard"]); vid = uuid.uuid4().hex[:10]; d = MEDIA / vid; d.mkdir(); opts = {k: body.get(k) for k in ("quality", "voice", "subtitles", "logo", "font_id", "sfx") if k in body}
    if opts.get("voice", "none") != "none" and not V.available(opts["voice"]): raise HTTPException(409, f"voice provider '{opts['voice']}' is not available: " + next((p['requires'] for p in V.providers() if p['id'] == opts['voice']), ''))
    (d / "project.json").write_text(json.dumps({"id": vid, "type": "video", "name": body.get("name") or "Video", "storyboard": sb, "options": opts, "created": time.time(), "status": "queued"}, ensure_ascii=False, indent=2))
    def run(prog):
        data = json.loads((d / "project.json").read_text()); data["status"] = "rendering"; (d / "project.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
        try:
            man = montage.build(json.loads(json.dumps(sb)), d, opts.get("quality", "draft"), opts.get("voice", "none"), opts.get("subtitles", "burn"), opts.get("logo", True), None, opts.get("font_id"), prog, _loader, opts.get("sfx", True))
            data["status"] = "done" if man["verify"]["passed"] else "verify_failed"; data["manifest"] = man
        except Exception as e:
            data["status"] = "error"; data["error"] = f"{type(e).__name__}: {e}"; (d / "project.json").write_text(json.dumps(data, ensure_ascii=False, indent=2)); raise
        (d / "project.json").write_text(json.dumps(data, ensure_ascii=False, indent=2)); return {"id": vid, "manifest": man}
    return {"id": vid, "job_id": _server["job"](run)}


@router.post("/image")
async def image(preset: str = Form("instagram_post"), bg: str = Form("brand"), headline: str = Form(""), sub: str = Form(""), price: str = Form(""), cta: str = Form(""),
                font_id: str = Form(""), product_card: bool = Form(False), product: UploadFile | None = File(None), project_id: str = Form(""), name: str = Form("Image")):
    if preset not in imagestudio.PRESETS: raise HTTPException(400, f"preset must be one of {list(imagestudio.PRESETS)}")
    iid = uuid.uuid4().hex[:10]; d = MEDIA / iid; d.mkdir(); prod = None
    if product and product.filename: prod = d / ("product" + Path(product.filename).suffix.lower()); prod.write_bytes(await product.read())
    elif project_id:
        im = imagestudio.render_model_still(_loader(project_id), 1600, 1600); prod = d / "product.png"; im.save(prod)
    out, info = imagestudio.compose(preset, bg, headline, sub, price, cta, str(prod) if prod else None, None, font_id or None, True, product_card)
    out.save(d / "out.png"); out.convert("RGB").resize((out.width // 4, out.height // 4)).save(d / "thumb.jpg")
    meta = {"id": iid, "type": "image", "name": name, "params": {"preset": preset, "bg": bg, "headline": headline, "sub": sub, "price": price, "cta": cta, "project_id": project_id}, "created": time.time(), "status": "done", "manifest": info}
    (d / "project.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2)); return meta


@router.get("/items")
def items():
    out = []
    for d in sorted(MEDIA.iterdir(), key=lambda p: -p.stat().st_mtime):
        f = d / "project.json"
        if f.exists():
            try: m = json.loads(f.read_text()); out.append({k: m.get(k) for k in ("id", "type", "name", "status", "created", "error")} | {"manifest": m.get("manifest"), "options": m.get("options")})
            except Exception: pass
    return out


@router.get("/items/{iid}")
def item(iid: str):
    f = MEDIA / iid / "project.json"
    if not f.exists(): raise HTTPException(404)
    return json.loads(f.read_text())


@router.get("/file/{iid}/{name}")
def file(iid: str, name: str):
    f = (MEDIA / iid / name).resolve()
    if not str(f).startswith(str((MEDIA / iid).resolve())) or not f.is_file(): raise HTTPException(404)
    return FileResponse(f, filename=f.name)


@router.delete("/items/{iid}")
def delete(iid: str):
    d = (MEDIA / iid).resolve()
    if d.parent != MEDIA.resolve() or d.name == "uploads" or not (d / "project.json").exists(): raise HTTPException(404)
    shutil.rmtree(d); return {"deleted": iid}


@router.post("/comfy/run")
def comfy_run(body: dict):
    if not comfy.status()["reachable"]: raise HTTPException(503, "ComfyUI is not reachable at " + comfy.URL() + ". Start it (or set COMFYUI_URL). Official site: https://github.com/comfyanonymous/ComfyUI")
    iid = uuid.uuid4().hex[:10]; d = MEDIA / iid; d.mkdir()
    def run(prog):
        prog(10, "queued in ComfyUI"); files = comfy.run(body["workflow"], str(d), prompt=body.get("prompt", ""), negative=body.get("negative", ""), width=body.get("width", 768), height=body.get("height", 768))
        (d / "project.json").write_text(json.dumps({"id": iid, "type": "comfy", "name": body.get("name", "ComfyUI"), "status": "done", "created": time.time(), "manifest": {"engine": "comfyui", "files": files}}, indent=2)); return {"id": iid, "files": files}
    return {"id": iid, "job_id": _server["job"](run)}
