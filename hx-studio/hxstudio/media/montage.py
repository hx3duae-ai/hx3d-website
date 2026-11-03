"""Storyboard -> MP4. Renders frames in Python, pipes them to FFmpeg, mixes narration + synthesised SFX, burns/exports subtitles, verifies output."""
from __future__ import annotations
import json, math, re, shutil, subprocess, time
from pathlib import Path
import numpy as np
from PIL import Image
from .. import textgeo
from .common import ASPECTS, PAL
from . import render as R, sfx, voice as V, storyboard as SB

QUALITY = {"draft": dict(scale=.5, fps=15, crf=28, preset="veryfast"), "final": dict(scale=1.0, fps=30, crf=18, preset="medium")}


def chunks(text, n=7):
    w = text.split(); return [" ".join(w[i:i + n]) for i in range(0, len(w), n)] or [""]


def _srt_time(s): ms = int(round(s * 1000)); return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def build(sb: dict, out_dir, quality="final", voice="none", subtitles="burn", logo=True, logo_path=None, font_id=None, progress=lambda p, s="": None, model_loader=None, sfx_on=True, voice_lang=None):
    t0 = time.time(); out = Path(out_dir); out.mkdir(parents=True, exist_ok=True); (out / "voice").mkdir(exist_ok=True)
    Q = QUALITY[quality]; W0, H0 = ASPECTS[sb["aspect"]]; W, H = int(W0 * Q["scale"]) // 2 * 2, int(H0 * Q["scale"]) // 2 * 2; fps = Q["fps"]; sc_list = sb["scenes"]; warnings = []
    lang = voice_lang or sb.get("lang", "ar")
    # 1) narration + durations ------------------------------------------------------------
    for i, sc in enumerate(sc_list):
        sc["_audio"] = None; text = (sc.get("narration") or "").strip()
        if text and voice != "none":
            progress(2 + 18 * i / len(sc_list), f"voice {i + 1}/{len(sc_list)}"); wav = out / "voice" / f"{sc.get('id', i)}.wav"
            d = V.synth(voice, text, str(wav), lang); sc["_audio"] = str(wav); sc["_adur"] = d
            sc["_dur"] = max(sc.get("min_duration", 2.0), d + .35 + 0.5)
        else:
            if text and voice == "none" and not warnings: warnings.append("no voice provider selected: durations are ESTIMATED from word count and the video has no narration")
            sc["_dur"] = float(sc.get("duration") or max(sc.get("min_duration", 2.0), SB.est_duration(text) if text else 0))
    # 2) timeline ---------------------------------------------------------------------------
    starts = []; t = 0.0
    for i, sc in enumerate(sc_list):
        starts.append(t); tr = sc.get("transition", {}) if i + 1 < len(sc_list) else {}
        trd = min(tr.get("dur", 0) if tr.get("type", "none") != "none" else 0, sc["_dur"] * .45, sc_list[i + 1]["_dur"] * .45 if i + 1 < len(sc_list) else 9)
        sc["_trd"] = trd; t += sc["_dur"] - trd
    total = starts[-1] + sc_list[-1]["_dur"]
    # 3) prepare scenes -------------------------------------------------------------------
    prep = []
    for i, sc in enumerate(sc_list):
        sp, Vh = R.prepare(sc, W, H, sc["_dur"], font_id); P = {"W": W, "H": H, "dur": sc["_dur"], "sprites": sp, "V": Vh}
        if sc["kind"] == "image_motion":
            im = Image.open(sc["image"]).convert("RGB"); P["img"] = np.array(R.cover(im, W, H))
        if sc["kind"] == "turntable":
            if not model_loader: raise RuntimeError("turntable scene needs a model_loader")
            P["model"] = R.TurntableModel(model_loader(sc["project_id"]))
        prep.append(P)
    # 4) audio ---------------------------------------------------------------------------
    mix = sfx.Mixer(total + 1)
    for i, sc in enumerate(sc_list):
        if sc.get("_audio"): mix.add(sfx.read_wav(sc["_audio"]), starts[i] + .25, 1.0)
        if sfx_on:
            for sp in prep[i]["sprites"]:
                if sp.sfx: mix.add_sfx(sp.sfx, starts[i] + sp.at, .6)
            if i + 1 < len(sc_list) and sc["_trd"] > 0: mix.add_sfx("whoosh", starts[i] + sc["_dur"] - sc["_trd"], .7)
    wav_mix = out / "mix.wav"; mix.save(wav_mix, total)
    # 5) subtitles ---------------------------------------------------------------------------
    subs = []
    for i, sc in enumerate(sc_list):
        cap = (sc.get("caption") or "").strip()
        if not cap: continue
        t_a = starts[i] + .25; t_b = starts[i] + (sc.get("_adur") or sc["_dur"] - .4) + .25; cs = chunks(cap); tot = sum(len(c) for c in cs) or 1; tt = t_a
        for c in cs: d = (t_b - t_a) * len(c) / tot; subs.append((tt, tt + d, c)); tt += d
    (out / "out.srt").write_text("".join(f"{i + 1}\n{_srt_time(a)} --> {_srt_time(b)}\n{c}\n\n" for i, (a, b, c) in enumerate(subs)), encoding="utf-8")
    sub_img = {c: R.subtitle_sprite(c, W, H, font_id) for _, _, c in subs} if subtitles == "burn" else {}
    mark = {}
    # 6) encode ----------------------------------------------------------------------------
    mp4 = out / "out.mp4"; n_frames = int(math.ceil(total * fps))
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-i", str(wav_mix), "-c:v", "libx264", "-preset", Q["preset"], "-crf", str(Q["crf"]),
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", f"{total:.3f}", str(mp4)]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    dark = lambda sc: sc.get("bg") in ("black", "brand") or sc["kind"] in ("title_card", "turntable", "image_motion")
    thumb = None
    try:
        for f in range(n_frames):
            T = f / fps; idx = [i for i, s in enumerate(starts) if s <= T < s + sc_list[i]["_dur"] + 1e-9] or [len(sc_list) - 1]
            i = idx[-1]; a = None
            fr = R.render_scene(sc_list[i], prep[i], T - starts[i])
            if i > 0 and T < starts[i] + sc_list[i - 1]["_trd"]:           # transition from previous scene
                k = (T - starts[i]) / max(sc_list[i - 1]["_trd"], 1e-6); prev = R.render_scene(sc_list[i - 1], prep[i - 1], T - starts[i - 1]); fr = _transition(prev, fr, k, sc_list[i - 1].get("transition", {}).get("type", "crossfade"))
            if logo:
                key = (dark(sc_list[i]), logo_path)
                if key not in mark: mark[key] = R.wordmark(H, key[0], logo_path)
                wm = mark[key]; al = R.ease((T - .3) / .5); R._paste(fr, wm, int(W * .05), int(H * .035), min(1, al) * .95)
            if subtitles == "burn":
                for (a_, b_, c) in subs:
                    if a_ <= T < b_: sp = sub_img[c]; fr.paste(sp, ((W - sp.width) // 2, int(H * (.8 if H > W else .84)) - sp.height // 2), sp); break
            if f == int(fps * 1.2) or (thumb is None and f == n_frames - 1): thumb = fr.copy()
            try: pr.stdin.write(fr.convert("RGB").tobytes())
            except BrokenPipeError: break
            if f % 10 == 0: progress(25 + 70 * f / n_frames, f"frame {f}/{n_frames}")
        pr.stdin.close(); err = pr.stderr.read().decode(); pr.wait()
    finally:
        if pr.poll() is None: pr.kill()
    if pr.returncode: raise RuntimeError("ffmpeg failed: " + err[-400:])
    if thumb: thumb.convert("RGB").save(out / "thumb.jpg", quality=90)
    ver = verify_video(mp4, W, H, total, with_audio=True)
    man = {"engine": "procedural (Pillow + OpenCV + FFmpeg)", "ai_generated_pixels": False, "watermark": False, "size": [W, H], "fps": fps, "duration_s": round(total, 2), "scenes": len(sc_list), "quality": quality,
           "voice_provider": voice, "narrated_scenes": sum(1 for s in sc_list if s.get("_audio")), "subtitles": subtitles, "render_seconds": round(time.time() - t0, 1), "warnings": warnings, "verify": ver,
           "note": "Frames are drawn procedurally (no generative model). It cannot invent footage; AI video engines are listed separately and only run if installed."}
    (out / "manifest.json").write_text(json.dumps(man, indent=2, ensure_ascii=False)); progress(100, "done"); return man


def _transition(a, b, k, kind):
    k = R.ease(k); W, H = a.size
    if kind == "slide_up": o = int(H * (1 - k)); a2 = a.copy(); a2.paste(b, (0, o)); return a2
    if kind == "slide_left": o = int(W * (1 - k)); a2 = a.copy(); a2.paste(b, (o, 0)); return a2
    if kind == "wipe":
        m = Image.new("L", (W, H), 0); m.paste(255, (0, 0, int(W * k), H)); return Image.composite(b, a, m)
    return Image.blend(a, b, k)


def verify_video(path, W, H, expect_dur, with_audio=True):
    """Independent check with ffprobe (resolution, codec, pixel format, audio stream, duration, no decode errors)."""
    p = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], capture_output=True, text=True)
    j = json.loads(p.stdout or "{}"); vs = [s for s in j.get("streams", []) if s["codec_type"] == "video"]; au = [s for s in j.get("streams", []) if s["codec_type"] == "audio"]
    dur = float(j.get("format", {}).get("duration", 0)); dec = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"], capture_output=True, text=True)
    checks = {"video_stream": bool(vs), "resolution": bool(vs) and (vs[0]["width"], vs[0]["height"]) == (W, H), "codec_h264": bool(vs) and vs[0]["codec_name"] == "h264", "pix_fmt_yuv420p": bool(vs) and vs[0].get("pix_fmt") == "yuv420p",
              "audio_stream": bool(au) if with_audio else True, "duration_ok": abs(dur - expect_dur) < 0.6, "decodes_without_errors": dec.returncode == 0 and not dec.stderr.strip()}
    return {"passed": all(checks.values()), "checks": checks, "duration_s": round(dur, 2), "size_bytes": Path(path).stat().st_size}
