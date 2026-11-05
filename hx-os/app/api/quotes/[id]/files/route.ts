import { AuthError, requireRole } from "@/lib/auth";
import { guarded, json, type Ctx } from "@/lib/http";
import { addFile, canSee, getQuote } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// Staff / NAJM attach a 3D file or reference image (multipart field "file").
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const actor = requireRole(req, ["owner", "employee", "agent"]);
    const id = (await params).id;
    const q = await getQuote(id);
    if (!q || !canSee(actor, q)) throw new AuthError(404, "not found");
    const f = (await req.formData()).get("file");
    if (!(f instanceof File)) throw new AuthError(400, "file مطلوب");
    return json(await addFile(id, f, actor), 201);
  });
}
