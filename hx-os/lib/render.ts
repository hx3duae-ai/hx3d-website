// Starts Remotion renders in a separate Node process (scripts/render.mjs) so the
// heavy bundler/Chromium work never blocks or bloats the Next.js server.
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { MEDIA_DIR, now } from "./db";
import type { Idea, RenderJob } from "./content-types";
import { BRAND } from "./idea-engine";
import { PILLARS } from "./content-types";

export const mediaDir = (id: string) => path.join(MEDIA_DIR, id.replace(/[^a-z0-9_]/gi, ""));

export async function readStatus(id: string): Promise<RenderJob | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(mediaDir(id), "status.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function startRender(idea: Idea, what: "all" | "reel" | "carousel" = "all") {
  const st = await readStatus(idea.id);
  if (st && (st.status === "queued" || st.status === "rendering") && Date.now() - Date.parse(st.updatedAt) < 10 * 60_000)
    return st;
  const dir = mediaDir(idea.id);
  await fs.mkdir(dir, { recursive: true });
  const props = {
    brand: { name: BRAND.name, handle: BRAND.handle },
    accent: PILLARS[idea.pillar].color,
    pillarLabel: PILLARS[idea.pillar].label,
    slides: idea.carousel?.slides ?? [],
    reel: idea.reel ?? null,
  };
  await fs.writeFile(path.join(dir, "props.json"), JSON.stringify(props, null, 2));
  const job: RenderJob = { status: "queued", files: [], updatedAt: now(), step: "في الطابور" };
  await fs.writeFile(path.join(dir, "status.json"), JSON.stringify(job));
  const child = spawn(process.execPath, [path.join(process.cwd(), "scripts", "render.mjs"), dir, what], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: process.env,
  });
  child.unref();
  return job;
}
