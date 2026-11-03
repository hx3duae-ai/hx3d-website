"""Minimal ComfyUI HTTP client (local server, default http://127.0.0.1:8188). You supply an API-format workflow JSON exported from ComfyUI
('Save (API Format)'); placeholders {{prompt}}, {{negative}}, {{seed}}, {{width}}, {{height}} are substituted. Official local API only."""
from __future__ import annotations
import json, os, time, urllib.request, urllib.parse, random

URL = lambda: os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")


def _get(path, t=10): return json.loads(urllib.request.urlopen(URL() + path, timeout=t).read())


def status():
    try: s = _get("/system_stats", 3); return {"reachable": True, "info": {"devices": [(d.get("name"), round(d.get("vram_total", 0) / 2**30, 1)) for d in s.get("devices", [])]}}
    except Exception as e: return {"reachable": False, "error": str(e)[:120]}


def fill(workflow: dict, **vals):
    txt = json.dumps(workflow)
    for k, v in vals.items(): txt = txt.replace("{{" + k + "}}", json.dumps(v)[1:-1] if isinstance(v, str) else str(v)).replace('"{{' + k + '}}"', json.dumps(v))
    return json.loads(txt)


def run(workflow: dict, out_dir, timeout=1800, **vals):
    wf = fill(workflow, seed=random.randint(1, 2**31), **vals)
    req = urllib.request.Request(URL() + "/prompt", json.dumps({"prompt": wf}).encode(), {"content-type": "application/json"})
    pid = json.loads(urllib.request.urlopen(req, timeout=30).read())["prompt_id"]; t0 = time.time()
    while time.time() - t0 < timeout:
        h = _get(f"/history/{pid}")
        if pid in h:
            files = []
            for node in h[pid].get("outputs", {}).values():
                for key in ("images", "gifs", "videos"):
                    for f in node.get(key, []):
                        q = urllib.parse.urlencode({"filename": f["filename"], "subfolder": f.get("subfolder", ""), "type": f.get("type", "output")})
                        dst = os.path.join(out_dir, f["filename"]); open(dst, "wb").write(urllib.request.urlopen(URL() + "/view?" + q, timeout=120).read()); files.append(dst)
            return files
        time.sleep(1.5)
    raise TimeoutError("ComfyUI did not finish in time")
