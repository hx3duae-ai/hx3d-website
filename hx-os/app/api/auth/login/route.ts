import { actorForToken, SESSION_COOKIE } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { bad, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Exchange a role token (owner / employee / agent) for an httpOnly session cookie.
export async function POST(req: Request) {
  const token = String((await body(req)).token ?? "");
  const actor = actorForToken(token);
  if (actor.role === "anonymous") {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    await audit({ actor, action: "denied", detail: { path: "/api/auth/login", reason: "bad token" } });
    return bad("رمز الدخول غير صحيح", 401);
  }
  const secure = new URL(req.url).protocol === "https:" || process.env.NODE_ENV === "production";
  const res = json({ role: actor.role, id: actor.id });
  res.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 12}${secure ? "; Secure" : ""}`,
  );
  return res;
}

export async function DELETE() {
  const res = json({ ok: true });
  res.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  return res;
}
