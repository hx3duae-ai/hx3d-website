import { ensureToday, listIdeas, regenerateToday } from "@/lib/content";
import { claudeEnabled } from "@/lib/claude";
import { body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET: list ideas; also creates today's 3 ideas on the first visit of the day.
export async function GET() {
  const { note } = await ensureToday();
  return json({ ideas: await listIdeas(), engine: claudeEnabled() ? "claude" : "local", note });
}

// POST {action:"regenerate"} replaces today's untouched ideas.
export async function POST(req: Request) {
  const b = await body(req);
  if (b.action === "regenerate") {
    const { note } = await regenerateToday();
    return json({ ideas: await listIdeas(), note });
  }
  const { created, note } = await ensureToday();
  return json({ created, note });
}
