import { AuthError } from "@/lib/auth";
import { bad, body, guarded, json, type Ctx } from "@/lib/http";
import { customerQuote, customerRespond } from "@/lib/quotes";

export const dynamic = "force-dynamic";

const keyOf = (req: Request) => req.headers.get("x-quote-key") ?? new URL(req.url).searchParams.get("key");

// Customer view via their private link. The amount appears ONLY after the owner approved AND sent it.
export async function GET(req: Request, { params }: Ctx<{ id: string }>) {
  const v = await customerQuote((await params).id, keyOf(req));
  return v ? json(v) : bad("not found", 404);
}

// Customer accepts / declines a sent quotation. Body: { decision: "accepted" | "declined", note? }
// Customers can never change amounts — this endpoint takes no price fields.
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const b = await body(req);
    try {
      await customerRespond((await params).id, keyOf(req), b.decision, b.note);
    } catch (e) {
      if (e instanceof AuthError) return bad(e.message, e.status);
      throw e;
    }
    return json({ ok: true });
  });
}
