import { all, type Activity } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json((await all<Activity>("activity")).slice(0, 50));
}
