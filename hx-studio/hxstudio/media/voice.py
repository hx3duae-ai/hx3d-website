"""Narration providers. Real providers only; nothing pretends to speak Emirati.

HX EMIRATI VOICE STUDIO is not part of this repository, so its interface is unknown. Contract implemented here (set ONE):
  HX_EMIRATI_VOICE_URL   POST JSON {"text","dialect":"emirati","gender":"male"} -> audio bytes (wav/mp3)   [optional HX_EMIRATI_VOICE_KEY as Bearer]
  HX_EMIRATI_VOICE_CMD   shell template with {text_file} and {out} -> writes an audio file
Local fallbacks (only if installed): Piper (PIPER_MODEL=/path/voice.onnx), espeak-ng (robotic, low quality)."""
from __future__ import annotations
import json, os, shutil, subprocess, tempfile, urllib.request
from pathlib import Path


def providers():
    out = []
    url, cmd = os.environ.get("HX_EMIRATI_VOICE_URL"), os.environ.get("HX_EMIRATI_VOICE_CMD")
    out.append({"id": "hx_emirati", "label": "HX Emirati Voice Studio (male, Emirati)", "status": "ready" if (url or cmd) else "needs_backend",
                "requires": "Set HX_EMIRATI_VOICE_URL or HX_EMIRATI_VOICE_CMD (see hxstudio/media/voice.py for the contract). Its real API is unknown to this build."})
    pm = os.environ.get("PIPER_MODEL"); pb = shutil.which("piper")
    out.append({"id": "piper", "label": "Piper (local, offline)", "status": "ready" if (pb and pm and Path(pm).exists()) else "needs_backend",
                "requires": "install piper + download an Arabic voice (.onnx), set PIPER_MODEL. Voice is MSA, NOT Emirati; check the voice licence."})
    out.append({"id": "espeak", "label": "espeak-ng (local, robotic)", "status": "ready" if shutil.which("espeak-ng") else "needs_backend", "requires": "apt install espeak-ng (GPL; called as an external program)"})
    if os.environ.get("HX_ALLOW_TEST_VOICE") == "1": out.append({"id": "test_tone", "label": "TEST ONLY - not speech", "status": "ready", "requires": ""})
    out.append({"id": "none", "label": "No voice (captions + sound effects only)", "status": "ready", "requires": ""})
    return out


def available(pid): return any(p["id"] == pid and p["status"] == "ready" for p in providers())


def synth(provider: str, text: str, out_wav: str, lang="ar") -> float | None:
    """Returns duration seconds, or None when provider == none. Raises with a clear message if the provider is not usable."""
    from . import sfx
    if provider == "none": return None
    if not available(provider): raise RuntimeError(f"voice provider '{provider}' is not available: " + next((p["requires"] for p in providers() if p["id"] == provider), "unknown provider"))
    tmp = Path(tempfile.mkdtemp()); raw = tmp / "raw.bin"
    if provider == "hx_emirati":
        url, cmd = os.environ.get("HX_EMIRATI_VOICE_URL"), os.environ.get("HX_EMIRATI_VOICE_CMD")
        if url:
            h = {"content-type": "application/json"}
            if os.environ.get("HX_EMIRATI_VOICE_KEY"): h["authorization"] = "Bearer " + os.environ["HX_EMIRATI_VOICE_KEY"]
            req = urllib.request.Request(url, json.dumps({"text": text, "dialect": "emirati", "gender": "male"}).encode(), h)
            raw.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        else:
            tf = tmp / "t.txt"; tf.write_text(text, encoding="utf-8"); subprocess.run(cmd.format(text_file=tf, out=raw), shell=True, check=True, timeout=300)
    elif provider == "piper":
        subprocess.run(["piper", "--model", os.environ["PIPER_MODEL"], "--output_file", str(raw)], input=text.encode(), check=True, timeout=300)
    elif provider == "espeak":
        subprocess.run(["espeak-ng", "-v", "ar" if lang == "ar" else "en", "-w", str(raw), text], check=True, timeout=120)
    elif provider == "test_tone":
        import numpy as np, wave
        n = int(max(1.0, len(text.split()) / 2.4) * sfx.SR); t = np.arange(n) / sfx.SR; sig = (np.sin(2 * np.pi * 200 * t) * .1 * 32767).astype(np.int16)
        with wave.open(str(raw), "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sfx.SR); w.writeframes(sig.tobytes())
    sig = sfx.read_wav(raw); import wave, numpy as np
    with wave.open(str(out_wav), "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sfx.SR); w.writeframes((np.clip(sig, -1, 1) * 32767).astype(np.int16).tobytes())
    shutil.rmtree(tmp, ignore_errors=True); return len(sig) / sfx.SR
