import { promises as fs } from "node:fs";
import path from "node:path";
import { MEDIA_DIR } from "@/lib/db";
import { bad, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

export async function GET(_: Request, { params }: Ctx<{ path: string[] }>) {
  const parts = (await params).path;
  const full = path.resolve(MEDIA_DIR, ...parts);
  if (!full.startsWith(path.resolve(MEDIA_DIR) + path.sep)) return bad("forbidden", 403);
  const type = TYPES[path.extname(full).toLowerCase()];
  if (!type) return bad("unsupported", 415);
  try {
    const data = await fs.readFile(full);
    return new Response(data, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch {
    return bad("not found", 404);
  }
}
