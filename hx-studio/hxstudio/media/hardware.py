"""Detect the machine this server runs on and map it to a safe tier. Detection only - nothing is installed or downloaded."""
from __future__ import annotations
import os, platform, shutil, subprocess
from pathlib import Path


def _run(cmd, t=8):
    try: return subprocess.run(cmd, capture_output=True, text=True, timeout=t).stdout.strip()
    except Exception: return ""


def ram_gb():
    try:
        with open("/proc/meminfo") as f:
            for l in f:
                if l.startswith("MemTotal"): return round(int(l.split()[1]) / 1048576, 1)
    except Exception: pass
    try: return round(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 2**30, 1)
    except Exception: return None


def gpus():
    out = _run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
    g = []
    for l in out.splitlines():
        try: n, m = [x.strip() for x in l.split(",")]; g.append({"vendor": "nvidia", "name": n, "vram_gb": round(int(m) / 1024, 1)})
        except Exception: pass
    if not g and platform.system() == "Darwin" and platform.machine() == "arm64":
        g.append({"vendor": "apple", "name": "Apple Silicon (unified memory)", "vram_gb": None})
    return g


def tools():
    t = {}
    for name in ("ffmpeg", "ffprobe", "blender", "piper", "espeak-ng"):
        p = shutil.which(name); t[name] = {"path": p, "found": bool(p)}
    v = _run(["ffmpeg", "-version"]).splitlines()
    if v: t["ffmpeg"]["version"] = v[0][:60]
    for mod in ("torch", "diffusers", "moviepy", "cv2"):
        try: __import__(mod); t[mod] = {"found": True}
        except Exception: t[mod] = {"found": False}
    return t


def detect(path: str | None = None):
    path = path or str(Path.home())
    du = shutil.disk_usage(path); gp = gpus(); ram = ram_gb(); cores = os.cpu_count()
    vram = max([x["vram_gb"] or 0 for x in gp], default=0)
    if gp and gp[0]["vendor"] == "nvidia":
        tier = "gpu_high" if vram >= 16 else "gpu_mid" if vram >= 8 else "gpu_low"
    elif gp: tier = "gpu_mid" if (ram or 0) >= 32 else "gpu_low"
    else: tier = "cpu"
    notes = {"cpu": "No usable GPU: AI video models (Wan/LTX/CogVideoX) are NOT practical here. The procedural engine (animation + FFmpeg montage) works fully and is the default.",
             "gpu_low": "<8 GB VRAM: only small image models / heavily quantised video models; expect long runs. Procedural engine recommended.",
             "gpu_mid": "8-16 GB VRAM: small/quantised video models possible via ComfyUI; check each model's requirements.",
             "gpu_high": "16+ GB VRAM: most open image-to-video models can run locally."}[tier]
    return {"os": f"{platform.system()} {platform.release()}", "python": platform.python_version(), "cpu_cores": cores, "ram_gb": ram,
            "disk_free_gb": round(du.free / 2**30, 1), "gpus": gp, "tier": tier, "note": notes, "tools": tools(),
            "detected_on": "the machine running this server (if you run it on a remote host/container, that host is what is measured)"}
