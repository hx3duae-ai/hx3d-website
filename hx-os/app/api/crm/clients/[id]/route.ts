import { deleteClient, sanitize, updateClient } from "@/lib/crm";
import { bad, body, json, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx<{ id: string }>) {
  const c = await updateClient((await params).id, sanitize(await body(req)));
  return c ? json(c) : bad("not found", 404);
}

export async function DELETE(_: Request, { params }: Ctx<{ id: string }>) {
  return (await deleteClient((await params).id)) ? json({ ok: true }) : bad("not found", 404);
}
