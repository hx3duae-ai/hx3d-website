import { AuthError } from "@/lib/auth";
import { bad, json, type Ctx } from "@/lib/http";
import { addFile, customerQuote } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// Customer uploads a 3D file / image to their own request (private link key required).
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  const id = (await params).id;
  const key = req.headers.get("x-quote-key") ?? new URL(req.url).searchParams.get("key");
  if (!(await customerQuote(id, key))) return bad("not found", 404);
  const f = (await req.formData()).get("file");
  if (!(f instanceof File)) return bad("file مطلوب");
  try {
    return json(await addFile(id, f, "customer"), 201);
  } catch (e) {
    if (e instanceof AuthError) return bad(e.message, e.status);
    throw e;
  }
}
