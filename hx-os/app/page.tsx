"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MODULES } from "@/components/Nav";
import { PILLARS, type Idea } from "@/lib/content-types";
import { aed, dateTime, monthName } from "@/lib/format";
import { gsap, ScrollTrigger } from "@/lib/motion";
import SplitText from "@/components/motion/SplitText";
import { useGsap } from "@/components/motion/useGsap";

type Activity = { id: string; at: string; module: string; text: string };

export default function Home() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [stats, setStats] = useState<{ current: { month: string; sales: number; orders: number }; pipeline: number; leads: number } | null>(null);
  const [act, setAct] = useState<Activity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const scope = useRef<HTMLDivElement>(null);

  // Hero timeline: runs once on mount.
  useGsap(scope, (el) => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(el.querySelectorAll(".hero-sub"), { opacity: 0, y: 14, duration: 0.7 }, 0.35)
      .from(el.querySelectorAll(".g4 .stat"), { opacity: 0, y: 24, duration: 0.7, stagger: 0.08 }, 0.5);
    // Ambient pink glow behind the hero: transform + opacity only, so it stays GPU-cheap on phones.
    gsap.to(el.querySelector(".hero-glow"), { x: -18, y: 12, scale: 1.06, duration: 9, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }, []);

  // Scroll reveals: re-scan once the async data has rendered the blocks.
  useGsap(scope, (el) => {
    if (!loaded) return; // wait for the async data so the blocks exist and are not revealed twice
    const blocks = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    blocks.forEach((block) => {
      const items = block.hasAttribute("data-reveal-children") ? Array.from(block.children) as HTMLElement[] : [block];
      gsap.set(items, { opacity: 0, y: 24 });
      ScrollTrigger.create({
        trigger: block,
        start: "top 90%",
        once: true,
        onEnter: () =>
          gsap.to(items, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            stagger: items.length > 1 ? 0.07 : 0,
            clearProps: "transform,opacity",
          }),
      });
    });
  }, [loaded]);

  useEffect(() => {
    Promise.all([
      fetch("/api/content/ideas").then((r) => r.json()).then((r) => setIdeas(r.ideas)),
      fetch("/api/crm/stats").then((r) => r.json()).then(setStats),
      fetch("/api/activity").then((r) => r.json()).then(setAct),
    ]).finally(() => setLoaded(true));
  }, []);
  const today = ideas.length ? ideas.reduce((a, i) => (i.date > a ? i.date : a), ideas[0].date) : "";
  const todays = ideas.filter((i) => i.date === today && i.status !== "archived").slice(0, 3);

  return (
    <div ref={scope}>
      <div className="head hero">
        <span className="hero-glow" aria-hidden="true" />
        <div>
          <SplitText as="h1" text="صباح الخير 👋" />
          <p className="hero-sub">HX 3D UAE — نظرة سريعة على اليوم.</p>
        </div>
      </div>
      <div className="grid g4">
        <div className="card stat">
          <div className="label">مبيعات {stats ? monthName(stats.current.month) : ""}</div>
          <div className="value">{stats ? aed(stats.current.sales) : "…"}</div>
        </div>
        <div className="card stat">
          <div className="label">قيد التنفيذ</div>
          <div className="value">{stats ? aed(stats.pipeline) : "…"}</div>
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

      <div className="section-title" data-reveal>أفكار اليوم</div>
      <div className="grid g3" data-reveal data-reveal-children>
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
          <div className="section-title" data-reveal>الوحدات</div>
          <div className="grid g3" data-reveal data-reveal-children>
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
          <div className="section-title" data-reveal>آخر النشاط</div>
          <div className="card" data-reveal style={{ padding: "6px 16px" }}>
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
    </div>
  );
}
