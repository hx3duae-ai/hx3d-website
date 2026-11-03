# HX 3D AI Studio

Working 3D-design-and-print studio for **Bambu Lab P2S + AMS**: image / text / sketch → editable, verified, multicolour printable models, keyboards & keycaps (Arabic + English), mechanical parts, repair, estimates, business tools.
Black `#050505` / pink `#FF66B2` / white UI, English + Arabic (RTL), responsive.

> **Honesty first.** Everything listed as *ready* runs locally and is covered by tests. Things that need an AI model or service
> are reported as `needs_backend` (see **Status** page / `GET /api/capabilities`) — never faked.
> Nothing is test-printed, and Bambu Studio itself is not available in the build environment: 3MF files are validated by re-reading with lib3mf.

## Easiest: double-click `start.bat` (Windows) or run `./start.sh` (macOS/Linux)
It installs what it needs and opens http://localhost:8420. Online hosting: `Dockerfile` + `../render.yaml`.

## Install & run
```bash
cd hx-studio
pip install -r requirements.txt        # Python 3.11+ (tested on 3.13)
./run.sh                               # http://localhost:8420
pytest tests -q                        # 40+ tests (geometry, QC, export, API)
NODE_PATH=$(npm root -g) node tests/e2e_ui.js   # optional browser end-to-end (needs playwright)
```
Optional backends (environment variables):
| Variable | Enables |
|---|---|
| `HX_I23D_CMD='my-cli --in {image} --out {out_dir}'` | volumetric image→3D (AssetFurnace / TripoSG / TRELLIS / any CLI that writes `mesh.glb|obj|stl|ply` into `{out_dir}`). AssetFurnace's own interface is not publicly documented, so it is **not** pre-wired. |
| `ANTHROPIC_API_KEY` (+ `pip install anthropic`) | free-form description → primitive-assembly spec (Text to 3D, free description). Not exercised by the test-suite (no key). |

## Tools (each = a page, each = a real engine)
| Tool | Engine | Limits (stated in the UI too) |
|---|---|---|
| Image to 3D | k-means colour regions → tiled multicolour **2.5D relief** | one view only; back/sides/depth not inferable; volumetric needs `HX_I23D_CMD` |
| Toy designer | articulated print-in-place robot template, swept-collision joint verification | fixed blocky template; character-from-photo is the `hx-3d-image-to-3mf` skill + backend |
| Smart colour match | CIEDE2000 (matches Sharma reference), inventory, alternatives, AMS slot plan | colours on screen ≠ filament in daylight |
| Mechanical designer | involute gear pair (mesh sweep), print-in-place hinge (motion sweep), mounting plates | revolute joints only |
| Print optimizer | orientation search, overhang/supports, filament + time **estimates**, P2S tips | ±35 %; slicer numbers win |
| Model doctor / repair | diagnose + safe repair, before/after, refuses >1 % shape drift | self-intersections between shells not detected |
| Text to 3D / Arabic calligraphy | Pillow+libraqm shaping (joined letters, RTL), Amiri (OFL) or your TTF | free-form description needs LLM key |
| Sketch to 3D | contour trace → extrusion at **your** real mm size | dimension annotations in drawings are not read |
| **Keyboard designer** | 60/65/75/TKL/Full; plate (14 mm windows, stab windows), bottom case, top bezel, screw posts, USB-C opening, ergonomic split angle, typing-angle wedge, auto-split for the P2S bed with alignment pins / zig-zag plate joints, PCB standoffs **only from a user PCB profile**, fit-test plate, keycaps with Arabic legends, per-key editing | generic MX geometry — **no claim of compatibility with a specific PCB/controller/stabilizer** |
| **Keycap designer** | MX stem (measured on the mesh), 5 simplified profiles, multicolour legends (EN/AR), image topper, artisan mesh upload, stabilizer stems | profiles are approximations; fit-test caps provided |
| Logo to 3D, Lithophane, Jewelry (rings/pendants), Box generator, Multi-part assembly, Custom product (JSON primitives) | see tests | ring size includes +0.3 mm assumption |
| Business | cost (material, purge, electricity, machine, failure), price/margin/VAT, filament inventory, PDF quotes with HX 3D header | all rates are editable assumptions |

## Export (gate: nothing is written unless validation passes)
`Validate & export` writes, per project: `model_print_plates.3mf` (parts oriented/packed on P2S plates, one filament slot per colour), `model_assembly.3mf`, `model_combined.stl`, `stl/<part>.stl`, `step/<part>.step` (true B-rep for extrusion-built parts only — keyboard plate/case/bezel; mesh-built parts get STL/3MF only), `*_assembly_instructions.pdf`, `parts_and_materials.csv`, `parts_to_buy.json` (electronics are **not printed** — listed to buy), `validation.json`.
Refused when: a part is not a closed volume, a part does not fit the plate, the tool's QC fails, or the written 3MF fails the lib3mf re-read.

## Keyboard quality control (all measured on the generated meshes)
key pitch 19.05 mm · every switch window measured = 14.0 × 14.0 mm · stabilizer windows counted/measured · stabilizer width support · part-vs-part collisions · wall/floor/plate thickness · screw posts · USB-C opening fits · PCB mounting (verified only with a profile, otherwise printed as *NOT VERIFIED*) · keycaps: watertight, MX stem Ø5.5 and cross-slot 4.1×1.35 (+FDM tolerance) measured from a mesh cross-section · legend fit · 3MF validity.

## Assumptions you must check (all also surfaced in the UI/reports)
* P2S build volume 256³ mm, 5 mm margin (`config.py`) — confirm with Bambu's spec.
* MX switch window 14.0 mm, plate 1.5 mm, plate→PCB 5.0 mm, PCB 1.6 mm, keycap base ≈6 mm above plate — verify with your switch/PCB datasheets.
* Stabilizer spacings (23.8 / 38.1 / 95.25 / 100 / 114.3 / 133.35 mm) and the 6.65×12.3 mm window are the commonly published Cherry-style values; the window is a simplified rectangle (no wire notch). **Print the fit-test plate first.**
* Joint clearances per material (PLA 0.30 / PETG 0.35 / ABS 0.40 mm) are starting estimates.
* Bambu 3MF metadata (`model_settings.config` components + `extruder`) follows Bambu's convention, validated only with lib3mf.

## Architecture
`hxstudio/` — `registry.py` (tool → parts/QC; projects are stored as `{tool, params}` + uploads and regenerated deterministically), `solids.py` (one feature list → manifold mesh **and** build123d STEP), `keyboard.py`, `keycap.py`, `tools.py`, `split.py`, `motion.py`, `doctor.py`, `optimizer.py`, `colors.py`, `business.py`, `export.py`, `backends.py` (pluggable AI backends + capability report), `server.py` (FastAPI + job progress), `web/` (vanilla JS + vendored three.js). Add a new AI model: implement a function in `backends.py`, advertise it in `capabilities()`, call it from a tool in `registry.py`.
Licences: [LICENSES.md](LICENSES.md).

---
## Creative Studio (video + images) — added on top of everything above
Open **Creative** in the top bar (`#/media`). Everything below runs **locally, free, with no credits or subscriptions**; nothing is stamped with a watermark.

| Page | What really happens |
|---|---|
| **AI Video Studio** | script / images / HX 3D project → editable **storyboard** (scenes, narration, duration, camera, transition, icon + visual suggestion) → **MP4** (H.264 + AAC, `faststart`) at 9:16 · 16:9 · 1:1 · 4:5, draft 540p/15fps or **final 1080p/30fps** (≈13 s to render a 17 s 1080×1920 video on a 4-core CPU). Also writes `.srt`, thumbnail and `manifest.json`. |
| **VOX · HX 3D template** | 1080×1920, white graph paper, black text, **yellow marker highlight** wiping in behind titles, pink `#FF66B2` accents, flat 2-D icons (24), stat numbers, bullets, bar charts, smooth top-down pan, elements appear one by one, synthesised SFX (pop/click/marker/whoosh/ding — **no music**), HX 3D wordmark (or your logo PNG, aspect preserved). |
| **Image → video** | each image = Ken-Burns scene (zoom/pan), captions, transitions (crossfade / slide / wipe). |
| **3D → video** | turntable of any HX project using its real geometry and filament colours (own rasteriser; Blender not required). |
| **Narration + sync** | scene length = narration length + padding; subtitles split proportionally; mixed with SFX into one track. Providers: **HX Emirati Voice Studio** (via `HX_EMIRATI_VOICE_URL`/`_CMD`; its real API is unknown here — contract in `media/voice.py`), Piper, espeak-ng, or none. **No Emirati voice exists in this build**; with no provider the video is silent with captions and durations are *estimated* (warning shown). |
| **AI Image Studio** | brand compositor: Instagram post/square/story, YouTube thumbnail, product-white, ad; headline/sub/price/CTA; **your product image is placed unchanged (uniform scale only; test asserts pixel equality)**; or a render of an HX project. Plus the **Smart Prompt Engine** (template-based: style, lighting, background, composition, camera, movement + negative prompt + shot plan). |
| **Engines & hardware** | detects CPU/RAM/disk/GPU, assigns a tier (cpu / gpu_low / gpu_mid / gpu_high), lists engines + open models with disk/VRAM/RAM needs and licence notes, blocks incompatible installs. |
| **Gallery** | all videos/images, in-browser playback, side-by-side compare, edit & re-render (storyboard reloaded), delete. |

### What it is NOT (said plainly)
* It is a **procedural animation/montage engine**: it cannot invent footage, people or photoreal scenes. Text-to-video/image-to-video *AI* needs a GPU model (Wan 2.2, LTX-Video, CogVideoX, SVD…): the machine used to build this has **no GPU**, so those engines are listed as `needs_backend` and were **not run**. The ComfyUI client (`/api/media/comfy/run`) is tested only against a protocol stub, not a real ComfyUI.
* **Nothing is downloaded automatically.** `/api/media/models/{id}/install` needs `{"approve":true,"confirm_disk_gb":N}` **and** a compatible machine, and even then only returns the command (this build does not fetch weights). Licences in the catalogue are *unverified recollections* — model hubs were unreachable from the build environment; read each model card.
* **Adobe Firefly, Google Flow, Google Vids: link-out only.** No unofficial API, no assumption of a free API; each shows an "open official site" button. 
* MoviePy and Blender are not used (FFmpeg is called directly; MoviePy would add a dependency without capability). Blender is only *detected*.
* `HX EMIRATI VOICE STUDIO` is not part of this repository; only a documented integration point exists.

### Tests added (22, all passing)
valid H.264+AAC at the right size/fps/duration (ffprobe + full decode), VOX look (paper/yellow/pink pixel checks), SRT ordering, narration never longer than its scene, audio mix, Ken-Burns actually moves, 3D turntable rotates, `verify_video` rejects bad files, product pixels preserved, prompt engine, honest engine/voice/model status, install approval gate, path-traversal blocked, render job → download → gallery → delete, and a browser E2E (`tests/e2e_media.js`).
Licences: FFmpeg (external process; this build links GPL x264 — do not redistribute the binary with the app without checking), Pillow/OpenCV/NumPy (permissive), icons and SFX are generated in code (no third-party assets).
