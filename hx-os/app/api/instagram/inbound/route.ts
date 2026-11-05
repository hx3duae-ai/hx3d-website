// Entry point for the OOTTO agents (Inbox AI + Comment to DM) or any automation
// (Make, Zapier): POST one comment/DM, get back what HX OS decided.
//   { kind: "comment"|"dm", externalId, text, username?, igUserId?, mediaId? }
// Also accepts { items: [...] } for a batch.
import { handleInbound, type Inbound } from "@/lib/instagram";
import { bad, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

function parse(x: Record<string, unknown>): Inbound | null {
  const kind = x.kind === "dm" ? "dm" : x.kind === "comment" ? "comment" : null;
  const externalId = typeof x.externalId === "string" ? x.externalId.trim() : "";
  const text = typeof x.text === "string" ? x.text : "";
  if (!kind || !externalId || !text.trim()) return null;
  const str = (k: string) => (typeof x[k] === "string" && (x[k] as string).trim() ? (x[k] as string).trim().slice(0, 200) : undefined);
  return { kind, externalId: externalId.slice(0, 200), text, username: str("username"), igUserId: str("igUserId"), mediaId: str("mediaId"), via: x.via === "meta" ? "meta" : x.via === "manual" ? "manual" : "ootto" };
}

export async function POST(req: Request) {
  const b = await body(req);
  const list = Array.isArray(b.items) ? (b.items as Record<string, unknown>[]) : [b];
  if (list.length > 200) return bad("max 200 items");
  const parsed = list.map(parse);
  if (parsed.some((p) => !p)) return bad("كل عنصر يحتاج kind (comment|dm) و externalId و text");
  const out = [];
  for (const p of parsed as Inbound[]) out.push(await handleInbound(p));
  return json(Array.isArray(b.items) ? out : out[0], 201);
}
