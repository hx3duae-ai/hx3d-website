import { createClient, listClients, sanitize } from "@/lib/crm";
import { bad, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await listClients());
}

export async function POST(req: Request) {
  const data = sanitize(await body(req));
  if (!data.name) return bad("الاسم مطلوب");
  return json(await createClient(data), 201);
}
