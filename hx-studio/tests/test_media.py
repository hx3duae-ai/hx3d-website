import json, os, subprocess, threading, time, wave, io
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import numpy as np, pytest
from PIL import Image, ImageDraw
from hxstudio.media import hardware, catalog, storyboard as SB, montage as M, imagestudio, prompts, voice as V, comfy, engines, sfx, render as R, icons


def probe(path):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], capture_output=True, text=True).stdout)
    return j


def frame_at(path, t, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(path), "-frames:v", "1", str(out)], check=True); return np.array(Image.open(out).convert("RGB"))


SCRIPT = "هل تعلم أن الطباعة ثلاثية الأبعاد تبني المجسم طبقة فوق طبقة؟\n\nكل طبقة بسماكة 0.2 مم.\n\n- اختر فيلمنت مناسب\n- اضبط حرارة الفوهة\n\nتكلفة قطعة صغيرة قد تبدأ من 5 درهم."


def test_hardware_and_tiering_are_consistent():
    h = hardware.detect(); assert h["tier"] in ("cpu", "gpu_low", "gpu_mid", "gpu_high") and h["ram_gb"] and h["tools"]["ffmpeg"]["found"]
    assert (h["tier"] == "cpu") == (not h["gpus"])


def test_catalog_blocks_unsuitable_models_and_never_claims_verified_licences():
    hw = {"tier": "cpu", "gpus": [], "ram_gb": 16, "disk_free_gb": 100}
    assert not catalog.plan("wan22_ti2v_5b", hw)["compatible"] and catalog.plan("sd_turbo", hw)["compatible"]
    assert all(m["license_verified"] is False and m["requires_user_approval"] is True for m in [catalog.plan(x["id"], hw) for x in catalog.MODELS])


def test_storyboard_rules():
    sb = SB.from_script(SCRIPT); kinds = [s["kind"] for s in sb["scenes"]]
    assert kinds[0] == "title_card" and kinds[-1] == "title_card" and kinds.count("vox") == 4
    els = [e["type"] for s in sb["scenes"] for e in s["elements"]]
    assert "bullets" in els and "stat" in els and "icon" in els
    assert all(s["narration"] == s["caption"] for s in sb["scenes"][1:-1]) and "-" not in sb["scenes"][3]["caption"][:2]
    assert icons.suggest("سعر الطابعة")[:2] == ["printer3d", "money"]


@pytest.fixture(scope="module")
def vox_video(tmp_path_factory):
    d = tmp_path_factory.mktemp("vox"); sb = SB.from_script(SCRIPT); man = M.build(sb, d, quality="draft", voice="none", subtitles="burn"); return d, sb, man


def test_vox_video_is_valid_h264_with_audio_and_expected_size(vox_video):
    d, sb, man = vox_video; assert man["verify"]["passed"] and man["size"] == [540, 960] and man["fps"] == 15 and man["watermark"] is False and man["ai_generated_pixels"] is False
    j = probe(d / "out.mp4"); assert {s["codec_type"] for s in j["streams"]} == {"video", "audio"}
    assert abs(float(j["format"]["duration"]) - sum(s["_dur"] - s["_trd"] for s in sb["scenes"]) - sb["scenes"][-1]["_trd"]) < 0.7
    assert man["warnings"] and "no voice provider" in man["warnings"][0]


def test_vox_look_paper_grid_yellow_marker_pink_accent(vox_video):
    d, _, _ = vox_video; f = frame_at(d / "out.mp4", 4.0, d / "f.png")
    near = lambda c, tol=30: (np.abs(f.astype(int) - np.array(c)).sum(2) < tol).sum()
    assert near((251, 251, 247), 20) > f.shape[0] * f.shape[1] * .5        # paper
    assert near((255, 225, 77)) > 300 and near((255, 102, 178)) > 100        # yellow marker, pink accents
    assert (f.std(axis=(0, 1)) > 5).all()


def test_srt_and_subtitles_exist_and_are_ordered(vox_video):
    d, _, _ = vox_video; srt = (d / "out.srt").read_text(encoding="utf-8"); assert srt.count("-->") >= 4 and "طبقة" in srt
    ts = [l.split(" --> ")[0] for l in srt.splitlines() if "-->" in l]; assert ts == sorted(ts)


def test_narration_sync_and_audio_mix(tmp_path, monkeypatch):
    monkeypatch.setenv("HX_ALLOW_TEST_VOICE", "1"); sb = SB.from_script(SCRIPT, intro=True) if False else SB.from_script(SCRIPT)
    man = M.build(sb, tmp_path, quality="draft", voice="test_tone", subtitles="none")
    nar = [s for s in sb["scenes"] if s.get("_audio")]; assert len(nar) == man["narrated_scenes"] == 4
    assert all(s["_dur"] >= s["_adur"] + .35 for s in nar)                               # scene always long enough for its narration
    a = sfx.read_wav(tmp_path / "mix.wav"); assert abs(len(a) / sfx.SR - man["duration_s"]) < 1.0 and np.abs(a).max() > .05
    assert not man["warnings"]


def test_images_to_video_ken_burns_moves(tmp_path):
    ps = []
    for i, c in enumerate([(200, 60, 60), (60, 60, 200)]):
        im = Image.new("RGB", (1600, 1000), c); d = ImageDraw.Draw(im); d.ellipse([300, 100, 900, 700], fill="white"); d.rectangle([50, 50, 250, 250], fill="black"); p = tmp_path / f"i{i}.png"; im.save(p); ps.append(str(p))
    sb = SB.from_images([{"path": p, "caption": "x"} for p in ps], "16:9"); man = M.build(sb, tmp_path / "o", quality="draft", voice="none", subtitles="none")
    assert man["verify"]["passed"] and man["size"] == [960, 540]
    a, b = frame_at(tmp_path / "o" / "out.mp4", 0.3, tmp_path / "a.png"), frame_at(tmp_path / "o" / "out.mp4", 2.4, tmp_path / "b.png")
    assert np.abs(a.astype(int) - b.astype(int)).mean() > 1.0                          # camera actually moved


def test_turntable_video_of_real_geometry(tmp_path):
    from hxstudio import tools as T
    parts, _ = T.box_generator(60, 40, 30); sb = SB.from_model("p", "title", seconds=3, aspect="1:1")
    man = M.build(sb, tmp_path, quality="draft", voice="none", model_loader=lambda pid: [(p.mesh, p.color) for p in parts], subtitles="none"); assert man["verify"]["passed"]
    f1, f2 = frame_at(tmp_path / "out.mp4", .2, tmp_path / "1.png"), frame_at(tmp_path / "out.mp4", 2.2, tmp_path / "2.png"); assert np.abs(f1.astype(int) - f2.astype(int)).mean() > 1.0


def test_verify_video_catches_bad_files(tmp_path):
    bad = tmp_path / "bad.mp4"; bad.write_bytes(b"not a video"); v = M.verify_video(bad, 540, 960, 5); assert not v["passed"]
    ok = tmp_path / "ok.mp4"; subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=1", "-pix_fmt", "yuv420p", str(ok)], check=True)
    assert not M.verify_video(ok, 540, 960, 1)["passed"]


def test_image_studio_preserves_product_pixels(tmp_path):
    rng = np.random.RandomState(0); prod = Image.fromarray(rng.randint(0, 255, (300, 500, 3), np.uint8)); p = tmp_path / "p.png"; prod.save(p)
    out, info = imagestudio.compose("instagram_post", "brand", "عنوان", "", "10", "اطلب", str(p)); x, y, w, h = info["product_box"]
    assert out.size == (1080, 1350) and np.array_equal(np.array(out.crop((x, y, x + w, y + h))), np.array(prod.resize((w, h), Image.LANCZOS))) and abs(w / h - 500 / 300) < .02


def test_prompt_engine():
    r = prompts.enhance("إعلان طابعة", "video"); assert "#FF66B2" in r["prompt"] and r["intents"][0] == "ad" and r["shot_plan"] and r["negative_prompt"]
    assert prompts.enhance("how to tips", "image")["intents"][0] == "educational"


def test_engine_registry_is_honest():
    e = {x["id"]: x for x in engines.engines()["engines"]}
    assert e["procedural"]["status"] == "ready" and e["wan22"]["status"] == "needs_backend" and e["firefly"]["status"] == "link_only" and e["firefly"]["open_site"].startswith("https://")
    assert e["comfyui"]["status"] == "needs_backend" or comfy.status()["reachable"]


def test_voice_providers_report_missing_backends_and_errors_are_clear(tmp_path):
    st = {p["id"]: p["status"] for p in V.providers()}; assert st["none"] == "ready" and "test_tone" not in st
    if st["hx_emirati"] != "ready":
        with pytest.raises(RuntimeError, match="not available"): V.synth("hx_emirati", "مرحبا", str(tmp_path / "a.wav"))


class _Voice(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers["content-length"]); body = json.loads(self.rfile.read(n)); assert body["dialect"] == "emirati" and body["gender"] == "male"
        b = io.BytesIO(); w = wave.open(b, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes((np.sin(np.arange(16000) / 5) * 3000).astype(np.int16).tobytes()); w.close()
        self.send_response(200); self.end_headers(); self.wfile.write(b.getvalue())
    def log_message(self, *a): pass


def test_emirati_voice_http_contract_PROTOCOL_ONLY(tmp_path, monkeypatch):
    """Verifies our client against a local stub that follows the documented contract. It does NOT test the real HX Emirati Voice Studio."""
    srv = HTTPServer(("127.0.0.1", 0), _Voice); threading.Thread(target=srv.serve_forever, daemon=True).start()
    monkeypatch.setenv("HX_EMIRATI_VOICE_URL", f"http://127.0.0.1:{srv.server_port}/tts")
    d = V.synth("hx_emirati", "مرحبا بكم", str(tmp_path / "v.wav")); srv.shutdown(); assert abs(d - 1.0) < .05


class _Comfy(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/system_stats"): out = b'{"devices":[{"name":"stub","vram_total":8589934592}]}'
        elif self.path.startswith("/history/"): out = b'{"abc":{"outputs":{"9":{"images":[{"filename":"o.png","subfolder":"","type":"output"}]}}}}'
        elif self.path.startswith("/view"): out = b"PNGDATA"
        else: self.send_response(404); self.end_headers(); return
        self.send_response(200); self.end_headers(); self.wfile.write(out)
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"]))); assert "hello world" in json.dumps(body); self.send_response(200); self.end_headers(); self.wfile.write(b'{"prompt_id":"abc"}')
    def log_message(self, *a): pass


def test_comfyui_client_plumbing_PROTOCOL_ONLY(tmp_path, monkeypatch):
    """Local stub of ComfyUI's HTTP API: checks request/response handling only, NOT any model."""
    srv = HTTPServer(("127.0.0.1", 0), _Comfy); threading.Thread(target=srv.serve_forever, daemon=True).start(); monkeypatch.setenv("COMFYUI_URL", f"http://127.0.0.1:{srv.server_port}")
    assert comfy.status()["reachable"]; files = comfy.run({"3": {"inputs": {"text": "{{prompt}}"}}}, str(tmp_path), prompt="hello world"); srv.shutdown()
    assert Path(files[0]).read_bytes() == b"PNGDATA"
