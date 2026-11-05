import { promises as fs } from "node:fs";
import { AuthError, requireOwner } from "@/lib/auth";
import { guarded, type Ctx } from "@/lib/http";
import { filePath, getQuote } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// OWNER ONLY. Download an uploaded 3D file / image for review.
export async function GET(req: Request, { params }: Ctx<{ id: string; fileId: string }>) {
  return guarded(req, async () => {
    requireOwner(req);
    const { id, fileId } = await params;
    const q = await getQuote(id);
    const fp = q && filePath(q, fileId);
    if (!fp) throw new AuthError(404, "not found");
    const data = await fs.readFile(fp.path);
    return new Response(data, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fp.file.name)}`,
        "x-content-type-options": "nosniff",
      },
    });
  });
}
