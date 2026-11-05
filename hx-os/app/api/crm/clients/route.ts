import { getActor, isOwner } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient, listClients, sanitize, withoutPrice } from "@/lib/crm";
import { bad, body, guarded, json } from "@/lib/http";
import { rejectPriceFields } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// Prices are visible to the owner only.
export async function GET(req: Request) {
  const rows = await listClients();
  return json(isOwner(getActor(req)) ? rows : rows.map(withoutPrice));
}

export async function POST(req: Request) {
  return guarded(req, async () => {
    const actor = getActor(req);
    const raw = await body(req);
    if (!isOwner(actor)) await rejectPriceFields(actor, raw); // only the owner sets prices
    const data = sanitize(raw);
    if (!data.name) return bad("الاسم مطلوب");
    const c = await createClient(data);
    if (isOwner(actor) && "price" in raw) await audit({ actor, action: "crm_price_set", ref: c.id, detail: { before: null, after: c.price } });
    return json(c, 201);
  });
}
