// Renders one idea's media with Remotion, then post-processes with FFmpeg.
// Usage: node scripts/render.mjs <mediaDir> [all|reel|carousel]
// Reads <mediaDir>/props.json, writes reel.mp4, slide-N.png, thumb.jpg and status.json.
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [dir, what = "all"] = process.argv.slice(2);
if (!dir) {
  console.error("usage: render.mjs <mediaDir> [all|reel|carousel]");
  process.exit(2);
}
const statusFile = path.join(dir, "status.json");
const files = [];
async function status(s) {
  await fs.writeFile(statusFile, JSON.stringify({ files, ...s, updatedAt: new Date().toISOString() }));
}
const rel = (f) => path.relative(path.join(dir, ".."), f).split(path.sep).join("/");
// Optional: point Remotion at an existing Chrome/Chromium (otherwise it downloads its own headless shell once).
const browserExecutable = process.env.HX_BROWSER_EXECUTABLE || null;
const chromiumOptions = { gl: "swangle" };

try {
  const props = JSON.parse(await fs.readFile(path.join(dir, "props.json"), "utf8"));
  await status({ status: "rendering", step: "تجهيز Remotion", progress: 0 });
  const serveUrl = await bundle({
    entryPoint: path.join(root, "remotion", "index.ts"),
    publicDir: path.join(root, "public"),
  });

  if (what !== "reel" && props.slides?.length) {
    for (let i = 0; i < props.slides.length; i++) {
      await status({ status: "rendering", step: `شريحة ${i + 1}/${props.slides.length}`, progress: i / (props.slides.length + 4) });
      const inputProps = { ...props, slideIndex: i };
      const composition = await selectComposition({ serveUrl, id: "Slide", inputProps, browserExecutable, chromiumOptions });
      const out = path.join(dir, `slide-${i + 1}.png`);
      await renderStill({ composition, serveUrl, output: out, inputProps, browserExecutable, chromiumOptions });
      files.push({ kind: "slide", path: rel(out) });
    }
  }

  if (what !== "carousel" && props.reel?.scenes?.length) {
    await status({ status: "rendering", step: "ريل الفيديو", progress: 0.5 });
    const composition = await selectComposition({ serveUrl, id: "Reel", inputProps: props, browserExecutable, chromiumOptions });
    const raw = path.join(dir, "reel-raw.mp4");
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: raw,
      inputProps: props,
      browserExecutable,
      chromiumOptions,
      onProgress: ({ progress }) => {
        // throttle-free but cheap: tiny file write
        status({ status: "rendering", step: "ريل الفيديو", progress: 0.5 + progress * 0.4 }).catch(() => {});
      },
    });

    // ---- FFmpeg post-processing ----
    await status({ status: "rendering", step: "FFmpeg", progress: 0.92 });
    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    const hasFfmpeg = spawnSync(ffmpeg, ["-version"], { stdio: "ignore" }).status === 0;
    const reel = path.join(dir, "reel.mp4");
    if (hasFfmpeg) {
      // HX 3D export spec: H.264 Main 4.1, 30 fps, keyframe every second, CRF 19, yuv420p, faststart.
      // No music by brand rule; a voiceover track (AAC stereo 44.1 kHz 160k) can be muxed in later.
      const args = ["-y", "-i", raw, "-c:v", "libx264", "-profile:v", "main", "-level", "4.1", "-r", "30", "-g", "30",
        "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", reel];
      const r = spawnSync(ffmpeg, args, { stdio: "ignore" });
      if (r.status !== 0) await fs.copyFile(raw, reel);
      // Thumbnail: designed 9:16 still (Remotion "Thumb"); falls back to a frame grab.
      const thumb = path.join(dir, "thumb.png");
      try {
        const tc = await selectComposition({ serveUrl, id: "Thumb", inputProps: props, browserExecutable, chromiumOptions });
        await renderStill({ composition: tc, serveUrl, output: thumb, inputProps: props, browserExecutable, chromiumOptions });
      } catch {
        spawnSync(ffmpeg, ["-y", "-ss", "1.5", "-i", reel, "-frames:v", "1", thumb], { stdio: "ignore" });
      }
      if (existsSync(thumb)) files.push({ kind: "thumb", path: rel(thumb) });
      await fs.rm(raw, { force: true });
    } else {
      await fs.rename(raw, reel);
    }
    files.unshift({ kind: "reel", path: rel(reel) });
  }

  await status({ status: "done", step: "جاهز", progress: 1 });
  process.exit(0);
} catch (e) {
  await status({ status: "error", error: String(e?.stack || e).slice(0, 2000) });
  process.exit(1);
}
