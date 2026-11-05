import { listPosts, planWeek } from "@/lib/instagram";
import { dubaiDate } from "@/lib/db";
import { bad, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const from = new URL(req.url).searchParams.get("from") ?? undefined;
  return json(await listPosts(from));
}

/** { start?: "YYYY-MM-DD" } → fills 7 days of posts from Content OS ideas. */
export async function POST(req: Request) {
  const b = await body(req);
  const start = typeof b.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.start) ? b.start : dubaiDate();
  if (start < dubaiDate()) return bad("ما نقدر نجدول في الماضي");
  return json({ created: await planWeek(start) }, 201);
}
