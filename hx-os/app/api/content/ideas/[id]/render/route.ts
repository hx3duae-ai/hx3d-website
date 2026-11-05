import { getIdea } from "@/lib/content";
import { readStatus, startRender } from "@/lib/render";
import { bad, body, json, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  return json((await readStatus((await params).id)) ?? { status: "none", files: [] });
}

// POST {what: "all" | "reel" | "carousel"}
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  const idea = await getIdea((await params).id);
  if (!idea) return bad("not found", 404);
  const b = await body(req);
  const what = b.what === "reel" || b.what === "carousel" ? b.what : "all";
  return json(await startRender(idea, what));
}
