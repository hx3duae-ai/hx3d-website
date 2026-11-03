"""Engine registry: every engine reports an honest status. No engine is 'ready' unless it can run now. Online services are LINK-OUT only
(no unofficial APIs, no subscription circumvention); their terms/limits must be read on the official site."""
from __future__ import annotations
from . import hardware, comfy, voice, catalog


def engines():
    hw = hardware.detect(); cf = comfy.status(); out = []
    out.append({"id": "procedural", "kind": "video+image", "label": "HX Procedural Engine (Pillow/OpenCV/FFmpeg)", "status": "ready" if hw["tools"]["ffmpeg"]["found"] else "needs_backend",
                "free": True, "limits": "Animates what you give it (text, icons, images, 3D models). Does not invent footage or photos.", "credits": "unlimited (local)", "watermark": False,
                "requires": "" if hw["tools"]["ffmpeg"]["found"] else "install FFmpeg"})
    out.append({"id": "comfyui", "kind": "video+image", "label": "ComfyUI (local) - Wan 2.2 / LTX / SD / FLUX workflows", "status": "ready" if cf["reachable"] else "needs_backend", "free": True,
                "limits": "Needs a local ComfyUI server + models you download yourself; workflow JSON supplied by you. Tier of this machine: " + hw["tier"],
                "requires": "" if cf["reachable"] else "Start ComfyUI (default http://127.0.0.1:8188) or set COMFYUI_URL; models: see /api/media/models", "credits": "unlimited (local)", "watermark": False,
                "open_site": "https://github.com/comfyanonymous/ComfyUI", "detail": cf})
    out.append({"id": "wan22", "kind": "video", "label": "Wan 2.2 (via ComfyUI)", "status": "needs_backend", "free": True, "requires": "GPU with >=16 GB VRAM (see catalog) + ComfyUI; this machine: " + hw["tier"], "open_site": "https://github.com/Wan-Video/Wan2.2"})
    out.append({"id": "firefly", "kind": "image+video", "label": "Adobe Firefly", "status": "link_only", "free": "limited free web credits (terms on the site)", "open_site": "https://firefly.adobe.com",
                "requires": "Use the website. Programmatic access is through Adobe's own developer programme (account/terms/possibly paid): not assumed free, not integrated."})
    out.append({"id": "google_flow", "kind": "video", "label": "Google Flow", "status": "link_only", "free": "see site", "open_site": "https://labs.google/flow", "requires": "No public API known to this build: open the site (link may change)."})
    out.append({"id": "google_vids", "kind": "video", "label": "Google Vids", "status": "link_only", "free": "see site", "open_site": "https://workspace.google.com/products/vids/", "requires": "Part of Google Workspace; open the site."})
    return {"hardware_tier": hw["tier"], "engines": out, "voices": voice.providers(), "add_engine": "Implement a runner in hxstudio/media/engines.py + register it in engines(); nothing is shown as ready until its probe passes."}
