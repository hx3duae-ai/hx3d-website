// Server-side identity and permissions for HX OS.
//
// Business rule (non-negotiable): ONLY the owner calculates, enters, edits,
// approves, rejects or sends prices. Employees, NAJM / AI agents and customers
// never can. Every pricing API route calls requireOwner() — hiding buttons in
// the UI is only cosmetic, this file is the real gate.
//
// Credentials come from environment variables (never from the repo):
//   HX_OWNER_TOKEN      the owner's secret (≥ 24 chars). If missing, every
//                       pricing route fails closed with 503.
//   HX_EMPLOYEE_TOKENS  "name:token,name2:token2"  (employees)
//   HX_AGENT_TOKENS     "najm:token"               (NAJM and other AI agents)
// A request authenticates with `Authorization: Bearer <token>` or the
// httpOnly cookie `hx_session` set by POST /api/auth/login.
import crypto from "node:crypto";

export type Role = "owner" | "employee" | "agent" | "anonymous";
export type Actor = { role: Role; id: string };

export const SESSION_COOKIE = "hx_session";
const MIN_TOKEN = 24;

const sha = (s: string) => crypto.createHash("sha256").update(s).digest();
/** Constant-time comparison of two secrets. */
export function safeEqual(a: string, b: string) {
  return crypto.timingSafeEqual(sha(a), sha(b));
}

function parseList(v: string | undefined): { id: string; token: string }[] {
  return (v ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(":");
      return i > 0 ? { id: p.slice(0, i).trim(), token: p.slice(i + 1).trim() } : { id: "", token: "" };
    })
    .filter((e) => e.id && e.token.length >= MIN_TOKEN);
}

export function ownerConfigured() {
  return (process.env.HX_OWNER_TOKEN ?? "").length >= MIN_TOKEN;
}

/** Map a presented secret to an actor. Unknown / short secrets → anonymous. */
export function actorForToken(token: string | null | undefined): Actor {
  if (!token || token.length < MIN_TOKEN) return { role: "anonymous", id: "anonymous" };
  const owner = process.env.HX_OWNER_TOKEN ?? "";
  if (owner.length >= MIN_TOKEN && safeEqual(token, owner)) return { role: "owner", id: "owner" };
  for (const e of parseList(process.env.HX_EMPLOYEE_TOKENS)) if (safeEqual(token, e.token)) return { role: "employee", id: e.id };
  for (const e of parseList(process.env.HX_AGENT_TOKENS)) if (safeEqual(token, e.token)) return { role: "agent", id: e.id };
  return { role: "anonymous", id: "anonymous" };
}

function cookie(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function presentedToken(req: Request) {
  const h = req.headers.get("authorization");
  if (h?.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return cookie(req, SESSION_COOKIE);
}

export function getActor(req: Request): Actor {
  return actorForToken(presentedToken(req));
}

export const isOwner = (a: Actor) => a.role === "owner";
export const isStaff = (a: Actor) => a.role === "owner" || a.role === "employee";

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Throws unless the caller is the owner. Use on EVERY pricing route. */
export function requireOwner(req: Request): Actor {
  if (!ownerConfigured()) throw new AuthError(503, "صلاحيات المالك غير مفعلة: اضبط HX_OWNER_TOKEN في بيئة الخادم");
  const a = getActor(req);
  if (a.role !== "owner") throw new AuthError(a.role === "anonymous" ? 401 : 403, "التسعير من صلاحية المالك فقط");
  return a;
}

export function requireRole(req: Request, roles: Role[]): Actor {
  const a = getActor(req);
  if (!roles.includes(a.role)) throw new AuthError(a.role === "anonymous" ? 401 : 403, "غير مصرح");
  return a;
}

/** Any key that looks like a money / pricing field. Non-owners may never send these. */
export const PRICE_KEY = /price|amount|total|cost|unit|subtotal|discount|margin|vat|fee|سعر|مبلغ|تكلفة|خصم/i;

export function priceKeysIn(obj: unknown, path = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    if (PRICE_KEY.test(k)) out.push(p);
    else if (v && typeof v === "object") out.push(...priceKeysIn(v, p));
  }
  return out;
}
