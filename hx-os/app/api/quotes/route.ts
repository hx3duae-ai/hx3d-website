import { AuthError, getActor, requireRole } from "@/lib/auth";
import { bad, body, guarded, json } from "@/lib/http";
import { createQuote, listQuotesFor, publicQuote, rejectPriceFields } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// List quotation requests. Owner: all · employee: assigned to them · NAJM: its own. Never includes pricing.
export async function GET(req: Request) {
  return guarded(req, async () => {
    const actor = requireRole(req, ["owner", "employee", "agent"]);
    return json((await listQuotesFor(actor)).map(publicQuote));
  });
}

// Submit a quotation request (customer website form, NAJM, or staff).
// Body: { customer: {name, phone?, email?, company?}, details: {title, description?, quantity?, material?, colors?, size?, deadline?, delivery?, notes?}, missingInfo?: string[] }
// Any price/amount field is rejected with 403 — only the owner prices, via /api/quotes/:id/pricing.
export async function POST(req: Request) {
  return guarded(req, async () => {
    const actor = getActor(req);
    const b = await body(req);
    await rejectPriceFields(actor, b);
    try {
      const { quote, customerKey } = await createQuote(b, actor);
      return json({ quote: publicQuote(quote), customerKey, customerUrl: `/quote/${quote.id}?key=${customerKey}` }, 201);
    } catch (e) {
      if (e instanceof AuthError && e.status === 400) return bad(e.message);
      throw e;
    }
  });
}
