"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MODULES } from "@/components/Nav";
import { PILLARS, type Idea } from "@/lib/content-types";
import { dateTime, money, monthName } from "@/lib/format";

type Activity = { id: string; at: string; module: string; text: string };

export default function Home() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [stats, setStats] = useState<{ current: { month: string; sales: number; orders: number }; pipeline: number; leads: number; restricted?: boolean } | null>(null);
  const [act, setAct] = useState<Activity[]>([]);
  useEffect(() => {
    fetch("/api/content/ideas").then((r) => r.json()).then((r) => setIdeas(r.ideas));
    fetch("/api/crm/stats").then((r) => r.json()).then(setStats);
    fetch("/api/activity").then((r) => r.json()).then(setAct);
  }, []);
  const today = ideas.length ? ideas.reduce((a, i) => (i.date > a ? i.date : a), ideas[0].date) : "";
  const todays = ideas.filter((i) => i.date === today && i.status !== "archived").slice(0, 3);

  return (
    <>
      <div className="head">
        <div>
          <h1>صباح الخير 👋</h1>
          <p>HX 3D UAE — نظرة سريعة على اليوم.</p>
        </div>
      </div>
      <div className="grid g4">
        <div className="card stat">
          <div className="label">مبيعات {stats ? monthName(stats.current.month) : ""}</div>
          <div className="value">{stats ? money(stats.current.sales, stats.restricted) : "…"}</div>
        </div>
        <div className="card stat">
          <div className="label">قيد التنفيذ</div>
          <div className="value">{stats ? money(stats.pipeline, stats.restricted) : "…"}</div>
        </div>
        <div className="card stat">
          <div className="label">ليدز مفتوحة</div>
          <div className="value">{stats?.leads ?? "…"}</div>
        </div>
        <div className="card stat">
          <div className="label">أفكار اليوم</div>
          <div className="value">{todays.length}</div>
        </div>
      </div>

      <div className="section-title">أفكار اليوم</div>
      <div className="grid g3">
        {todays.map((i) => (
          <Link key={i.id} href="/content" className="card">
            <span className="chip">
              <span className="dot" style={{ background: `var(--${i.pillar})` }} />
              {PILLARS[i.pillar].label}
            </span>
            <h3 style={{ marginTop: 10 }}>{i.title}</h3>
            <div className="muted small">«{i.hook}»</div>
          </Link>
        ))}
      </div>

      <div className="grid g21" style={{ marginTop: 8 }}>
        <div>
          <div className="section-title">الوحدات</div>
          <div className="grid g3">
            {MODULES.map((m) => (
              <Link key={m.href} href={m.href} className="card">
                <div className="muted small">{m.n}</div>
                <b>{m.label}</b>
                <div className="small" style={{ color: m.ready ? "var(--good)" : "var(--muted)" }}>{m.ready ? "● يعمل" : "○ قريباً"}</div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="section-title">آخر النشاط</div>
          <div className="card" style={{ padding: "6px 16px" }}>
            {act.length === 0 && <div className="empty small">لا نشاط بعد</div>}
            {act.slice(0, 8).map((a) => (
              <div key={a.id} className="small" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                {a.text}
                <div className="muted" style={{ fontSize: 12 }}>{dateTime(a.at)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
