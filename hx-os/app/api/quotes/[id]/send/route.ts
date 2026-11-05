import { requireOwner } from "@/lib/auth";
import { guarded, json, type Ctx } from "@/lib/http";
import { sendQuote } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// OWNER ONLY. Freezes the approved pricing and makes it visible to the customer.
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const actor = requireOwner(req);
    return json(await sendQuote((await params).id, actor));
  });
}
