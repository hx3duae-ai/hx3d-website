"use client";
import { useEffect, useState } from "react";

const ROLE: Record<string, string> = { owner: "المالك", employee: "موظف", agent: "وكيل ذكي (NAJM)", anonymous: "غير مسجل" };

export default function Login() {
  const [me, setMe] = useState<{ role: string; id: string; ownerConfigured: boolean } | null>(null);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => fetch("/api/auth/me").then((r) => r.json()).then(setMe);
  useEffect(() => void load(), []);

  async function login() {
    const r = await fetch("/api/auth/login", { method: "POST", body: JSON.stringify({ token }) });
    setMsg(r.ok ? "✓ تم الدخول" : (await r.json()).error);
    setToken("");
    load();
  }
  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>تسجيل الدخول</h1>
          <p>الصلاحيات تُفحص في الخادم في كل طلب. التسعير واعتماده وإرساله للمالك فقط.</p>
        </div>
      </div>
      {me && !me.ownerConfigured && <div className="notice">⚠️ HX_OWNER_TOKEN غير مضبوط في بيئة الخادم — كل مسارات التسعير مقفلة حتى تضبطه.</div>}
      {msg && <div className="notice">{msg}</div>}
      <div className="card" style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <div>
          الحالة: <b>{me ? ROLE[me.role] ?? me.role : "…"}</b> {me && me.role !== "anonymous" && <span className="muted">({me.id})</span>}
        </div>
        <input className="in" type="password" dir="ltr" placeholder="رمز الدخول" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" />
        <div className="row">
          <button className="btn primary" onClick={login} disabled={!token}>
            دخول
          </button>
          {me && me.role !== "anonymous" && (
            <button className="btn" onClick={logout}>
              خروج
            </button>
          )}
        </div>
      </div>
    </>
  );
}
