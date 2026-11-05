import { listPosts, planWeek } from "@/lib/instagram";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await listPosts());
}

// POST: plan the next 7 days (fills only empty days).
export async function POST() {
  const created = await planWeek();
  return json({ created: created.length, posts: await listPosts() });
}
