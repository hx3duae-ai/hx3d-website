import { listClients } from "@/lib/crm";
import { ideaFromClient } from "@/lib/content";
import { bad, json, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

// CRM → Content OS: draft a case-study post from an order.
export async function POST(_: Request, { params }: Ctx<{ id: string }>) {
  const { id } = await params;
  const c = (await listClients()).find((x) => x.id === id);
  if (!c) return bad("not found", 404);
  return json(await ideaFromClient(c), 201);
}
