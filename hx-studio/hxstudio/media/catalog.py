"""Open model catalogue. `license_note` is the AUTHOR'S recollection and is NOT verified (the model hubs are not reachable from the
build environment): always read the model card before commercial use. Nothing here is downloaded without explicit approval."""
MODELS = [
    {"id": "wan22_ti2v_5b", "name": "Wan 2.2 TI2V-5B (text/image→video)", "kind": "video", "disk_gb": 24, "min_vram_gb": 16, "min_ram_gb": 32,
     "tiers": ["gpu_high"], "runner": "comfyui|diffusers", "license_note": "believed Apache-2.0 - VERIFY on the model card", "license_verified": False,
     "hub": "https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B", "caveat": "720p/24fps clips of a few seconds; minutes per clip on a 24 GB GPU"},
    {"id": "ltx_video", "name": "LTX-Video (text/image→video)", "kind": "video", "disk_gb": 12, "min_vram_gb": 12, "min_ram_gb": 24,
     "tiers": ["gpu_mid", "gpu_high"], "runner": "comfyui|diffusers", "license_note": "custom open-weights licence with revenue limits - VERIFY", "license_verified": False,
     "hub": "https://huggingface.co/Lightricks/LTX-Video", "caveat": "fast for its class; quality varies with prompt"},
    {"id": "cogvideox_2b", "name": "CogVideoX-2B (text→video)", "kind": "video", "disk_gb": 14, "min_vram_gb": 8, "min_ram_gb": 24,
     "tiers": ["gpu_mid", "gpu_high"], "runner": "diffusers|comfyui", "license_note": "2B believed Apache-2.0 (5B has a separate licence) - VERIFY", "license_verified": False,
     "hub": "https://huggingface.co/THUDM/CogVideoX-2b", "caveat": "6 s, 720x480 clips; low motion quality vs newer models"},
    {"id": "svd_xt", "name": "Stable Video Diffusion XT (image→video)", "kind": "video", "disk_gb": 10, "min_vram_gb": 12, "min_ram_gb": 24,
     "tiers": ["gpu_mid", "gpu_high"], "runner": "diffusers|comfyui", "license_note": "Stability community licence (commercial use limited by revenue) - VERIFY", "license_verified": False,
     "hub": "https://huggingface.co/stabilityai/stable-video-diffusion-img2vid-xt", "caveat": "image→video only, ~4 s"},
    {"id": "flux_schnell", "name": "FLUX.1 [schnell] (text→image)", "kind": "image", "disk_gb": 24, "min_vram_gb": 12, "min_ram_gb": 32,
     "tiers": ["gpu_mid", "gpu_high"], "runner": "comfyui|diffusers", "license_note": "believed Apache-2.0 - VERIFY", "license_verified": False,
     "hub": "https://huggingface.co/black-forest-labs/FLUX.1-schnell", "caveat": "quantised variants need less VRAM"},
    {"id": "sd_turbo", "name": "SD-Turbo (text→image, 1-4 steps)", "kind": "image", "disk_gb": 5, "min_vram_gb": 0, "min_ram_gb": 12,
     "tiers": ["cpu", "gpu_low", "gpu_mid", "gpu_high"], "runner": "diffusers", "license_note": "Stability licence terms apply - VERIFY (non-commercial limits possible)", "license_verified": False,
     "hub": "https://huggingface.co/stabilityai/sd-turbo", "caveat": "can run on CPU at 512px in ~1-2 min per image (estimate)"},
]
VOICES = [{"id": "piper_ar", "name": "Piper (local TTS, Arabic MSA voices)", "disk_gb": 0.1, "license_note": "engine MIT/GPL depending on package; voice licences vary - VERIFY", "dialect": "MSA, NOT Emirati", "license_verified": False}]


def plan(model_id: str, hw: dict):
    m = next((x for x in MODELS if x["id"] == model_id), None)
    if not m: raise KeyError(model_id)
    vram = max([g["vram_gb"] or 0 for g in hw["gpus"]], default=0); problems = []
    if hw["tier"] not in m["tiers"]: problems.append(f"tier '{hw['tier']}' is not supported by this model (needs one of {m['tiers']})")
    if vram < m["min_vram_gb"]: problems.append(f"needs {m['min_vram_gb']} GB VRAM, found {vram}")
    if (hw["ram_gb"] or 0) < m["min_ram_gb"]: problems.append(f"needs {m['min_ram_gb']} GB RAM, found {hw['ram_gb']}")
    if hw["disk_free_gb"] < m["disk_gb"] * 1.3: problems.append(f"needs ~{m['disk_gb']} GB disk (+30% margin), only {hw['disk_free_gb']} GB free")
    return {**m, "compatible": not problems, "problems": problems, "requires_user_approval": True,
            "install": f"huggingface-cli download {m['hub'].split('huggingface.co/')[1]}  # ~{m['disk_gb']} GB; run only after you read the licence"}
