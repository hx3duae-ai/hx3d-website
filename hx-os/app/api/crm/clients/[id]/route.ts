import { getActor, isOwner } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { deleteClient, listClients, sanitize, updateClient, withoutPrice } from "@/lib/crm";
import { bad, body, guarded, json, type Ctx } from "@/lib/http";
import { rejectPriceFields } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const id = (await params).id;
    const actor = getActor(req);
    const raw = await body(req);
    if (!isOwner(actor)) await rejectPriceFields(actor, raw, id); // only the owner sets prices
    const before = "price" in raw ? (await listClients()).find((c) => c.id === id)?.price : undefined;
    const c = await updateClient(id, sanitize(raw));
    if (!c) return bad("not found", 404);
    if (isOwner(actor) && "price" in raw && before !== c.price) await audit({ actor, action: "crm_price_set", ref: id, detail: { before, after: c.price } });
    return json(isOwner(actor) ? c : withoutPrice(c));
  });
}

export async function DELETE(_: Request, { params }: Ctx<{ id: string }>) {
  return (await deleteClient((await params).id)) ? json({ ok: true }) : bad("not found", 404);
}
