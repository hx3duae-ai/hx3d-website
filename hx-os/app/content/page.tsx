"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IDEA_STATUS, PILLARS, type Idea, type IdeaStatus, type RenderJob } from "@/lib/content-types";
import { shortDate } from "@/lib/format";

type Tab = "today" | "all" | "carousels" | "videos";

export default function ContentOS() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [engine, setEngine] = useState<string>("");
  const [note, setNote] = useState<string | undefined>();
  const [tab, setTab] = useState<Tab>("today");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [renders, setRenders] = useState<Record<string, RenderJob>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/content/ideas", { cache: "no-store" }).then((r) => r.json());
    setIdeas(r.ideas);
    setEngine(r.engine);
    if (r.note) setNote(r.note);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // fetch render status for every idea once (cheap: small JSON per idea)
  useEffect(() => {
    ideas.forEach((i) => {
      if (renders[i.id]) return;
      fetch(`/api/content/ideas/${i.id}/render`).then((r) => r.json()).then((s) => setRenders((m) => ({ ...m, [i.id]: s })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas]);

  // keep polling while any render is running (also after the modal is closed)
  const runningIds = Object.entries(renders)
    .filter(([, s]) => s.status === "queued" || s.status === "rendering")
    .map(([id]) => id)
    .join(",");
  useEffect(() => {
    if (!runningIds) return;
    const t = setInterval(() => {
      runningIds.split(",").forEach((id) =>
        fetch(`/api/content/ideas/${id}/render`).then((r) => r.json()).then((s) => setRenders((m) => ({ ...m, [id]: s }))),
      );
    }, 1500);
    return () => clearInterval(t);
  }, [runningIds]);

  const today = ideas.length ? ideas.reduce((a, i) => (i.date > a ? i.date : a), ideas[0].date) : "";
  const todays = ideas.filter((i) => i.date === today && i.status !== "archived");

  async function regenerate() {
    setBusy(true);
    const r = await fetch("/api/content/ideas", { method: "POST", body: JSON.stringify({ action: "regenerate" }) }).then((r) => r.json());
    setIdeas(r.ideas);
    setNote(r.note);
    setBusy(false);
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const updated = await fetch(`/api/content/ideas/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then((r) => r.json());
    setIdeas((xs) => xs.map((x) => (x.id === id ? updated : x)));
    return updated as Idea;
  }

  async function remove(id: string) {
    if (!confirm("حذف الفكرة نهائياً؟")) return;
    await fetch(`/api/content/ideas/${id}`, { method: "DELETE" });
    setIdeas((xs) => xs.filter((x) => x.id !== id));
    setOpen(null);
  }

  const visible = useMemo(() => {
    if (tab === "today") return todays;
    if (tab === "carousels") return ideas.filter((i) => i.carousel && i.status !== "archived");
    if (tab === "videos") return ideas.filter((i) => renders[i.id]?.files?.some((f) => f.kind === "reel") || renders[i.id]?.status === "rendering");
    return ideas;
  }, [tab, ideas, todays, renders]);

  const current = ideas.find((i) => i.id === open) ?? null;
  const counts = {
    today: todays.length,
    all: ideas.length,
    carousels: ideas.filter((i) => i.carousel && i.status !== "archived").length,
    videos: ideas.filter((i) => renders[i.id]?.files?.some((f) => f.kind === "reel")).length,
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Content OS</h1>
          <p>
            3 أفكار كل يوم (هدايا شركات · مجسمات معمارية · منتجات) — كل فكرة تتحول تلقائياً لكاروسيل انستا + سكريبت ريل.
          </p>
        </div>
        <div className="row">
          <span className="chip" title="مصدر الأفكار">
            <span className="dot" style={{ background: engine === "claude" ? "var(--good)" : "var(--muted)" }} />
            {engine === "claude" ? "Claude API" : "المحرك المحلي (بدون إنترنت)"}
          </span>
          <button className="btn primary" onClick={regenerate} disabled={busy}>
            {busy ? "جاري التوليد…" : "↻ أفكار جديدة لليوم"}
          </button>
        </div>
      </div>

      {note && <div className="notice">{note}</div>}

      <div className="tabs" role="tablist">
        {(
          [
            ["today", "أفكار اليوم"],
            ["carousels", "كاروسيلات"],
            ["videos", "فيديوهات AI"],
            ["all", "الأرشيف"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
            {l} <span className="muted small">({counts[k]})</span>
          </button>
        ))}
      </div>

      <div style={{ height: 16 }} />

      {visible.length === 0 ? (
        <div className="card empty">
          {tab === "videos" ? "ما فيه فيديوهات بعد — افتح أي فكرة واضغط «رندر الريل»." : "لا يوجد شيء هنا بعد."}
        </div>
      ) : tab === "carousels" ? (
        <div className="grid g3">
          {visible.map((i) => (
            <CarouselThumb key={i.id} idea={i} render={renders[i.id]} onOpen={() => setOpen(i.id)} />
          ))}
        </div>
      ) : tab === "videos" ? (
        <div className="grid g4">
          {visible.map((i) => (
            <VideoCard key={i.id} idea={i} render={renders[i.id]} onOpen={() => setOpen(i.id)} />
          ))}
        </div>
      ) : (
        <div className="grid g3">
          {visible.map((i) => (
            <IdeaCard key={i.id} idea={i} onOpen={() => setOpen(i.id)} onStatus={(s) => patch(i.id, { status: s })} />
          ))}
        </div>
      )}

      {current && (
        <IdeaModal
          idea={current}
          render={renders[current.id]}
          setRender={(s) => setRenders((m) => ({ ...m, [current.id]: s }))}
          onClose={() => setOpen(null)}
          onPatch={(b) => patch(current.id, b)}
          onDelete={() => remove(current.id)}
        />
      )}
    </>
  );
}

function PillarChip({ idea }: { idea: Idea }) {
  return (
    <span className="chip">
      <span className="dot" style={{ background: `var(--${idea.pillar})` }} />
      {PILLARS[idea.pillar].label}
    </span>
  );
}

function IdeaCard({ idea, onOpen, onStatus }: { idea: Idea; onOpen: () => void; onStatus: (s: IdeaStatus) => void }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <PillarChip idea={idea} />
        <span className="muted small">
          {shortDate(idea.date + "T12:00:00Z")} · {IDEA_STATUS[idea.status]}
        </span>
      </div>
      <h3>{idea.title}</h3>
      <div style={{ fontSize: 15 }}>«{idea.hook}»</div>
      <div className="muted small">
        الزاوية: {idea.angle} · الجمهور: {idea.audience}
        {idea.occasion ? ` · المناسبة: ${idea.occasion}` : ""}
        {idea.source === "crm" ? " · من طلب عميل" : ""}
      </div>
      <div className="row" style={{ marginTop: "auto" }}>
        <button className="btn primary sm" onClick={onOpen}>
          الكاروسيل والريل
        </button>
        {idea.status === "new" && (
          <button className="btn sm" onClick={() => onStatus("approved")}>
            ✓ اعتماد
          </button>
        )}
        {idea.status === "approved" && (
          <button className="btn sm" onClick={() => onStatus("posted")}>
            تم النشر
          </button>
        )}
        {idea.status !== "archived" && (
          <button className="btn ghost sm" onClick={() => onStatus("archived")}>
            أرشفة
          </button>
        )}
      </div>
    </div>
  );
}

function SlidePreview({ idea, index, img }: { idea: Idea; index: number; img?: string }) {
  const s = idea.carousel!.slides[index];
  return (
    <div className="slide">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={s.title} />
      ) : (
        <>
          <span className="k" style={{ color: PILLARS[idea.pillar].color }}>
            {s.kicker}
          </span>
          <div className="tt">{s.title}</div>
          <div className="bd">{s.body}</div>
          <span className="n">
            {index + 1} / {idea.carousel!.slides.length}
          </span>
        </>
      )}
    </div>
  );
}

const mediaUrl = (p: string, v?: string) => `/api/media/${p}${v ? `?v=${encodeURIComponent(v)}` : ""}`;

function CarouselThumb({ idea, render, onOpen }: { idea: Idea; render?: RenderJob; onOpen: () => void }) {
  const first = render?.files?.find((f) => f.kind === "slide");
  return (
    <button className="card" style={{ textAlign: "start", cursor: "pointer", display: "grid", gap: 10 }} onClick={onOpen}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <PillarChip idea={idea} />
        <span className="muted small">{idea.carousel!.slides.length} شرائح</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <SlidePreview idea={idea} index={0} img={first ? mediaUrl(first.path, render?.updatedAt) : undefined} />
      </div>
      <div className="small">{idea.title}</div>
    </button>
  );
}

function VideoCard({ idea, render, onOpen }: { idea: Idea; render?: RenderJob; onOpen: () => void }) {
  const reel = render?.files?.find((f) => f.kind === "reel");
  const thumb = render?.files?.find((f) => f.kind === "thumb");
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      {reel ? (
        <video
          src={mediaUrl(reel.path, render?.updatedAt)}
          poster={thumb ? mediaUrl(thumb.path, render?.updatedAt) : undefined}
          controls
          playsInline
          style={{ width: "100%", aspectRatio: "9/16", background: "#000", borderRadius: 10 }}
        />
      ) : (
        <div className="empty" style={{ aspectRatio: "9/16", display: "grid", placeItems: "center" }}>
          {render?.step ?? "…"}
        </div>
      )}
      <div className="small">{idea.title}</div>
      <button className="btn sm" onClick={onOpen}>
        فتح
      </button>
    </div>
  );
}

function IdeaModal({
  idea,
  render,
  setRender,
  onClose,
  onPatch,
  onDelete,
}: {
  idea: Idea;
  render?: RenderJob;
  setRender: (s: RenderJob) => void;
  onClose: () => void;
  onPatch: (b: Record<string, unknown>) => Promise<Idea>;
  onDelete: () => void;
}) {
  const [view, setView] = useState<"carousel" | "reel">("carousel");
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(idea);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(idea), [idea]);

  const rendering = render?.status === "queued" || render?.status === "rendering";

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function startRender(what: "all" | "reel" | "carousel") {
    if (edit) await save();
    const s = await fetch(`/api/content/ideas/${idea.id}/render`, { method: "POST", body: JSON.stringify({ what }) }).then((r) => r.json());
    setRender(s);
  }
  async function save() {
    await onPatch({ carousel: draft.carousel, reel: draft.reel });
    setEdit(false);
  }
  const slideImgs = (render?.status === "done" || render?.status === "rendering" ? render.files : []).filter((f) => f.kind === "slide");
  const reel = render?.files?.find((f) => f.kind === "reel");
  const c = draft.carousel!;
  const r = draft.reel!;
  const total = r.scenes.reduce((a, s) => a + s.seconds, 0);

  const copyCaption = async () => {
    await navigator.clipboard.writeText(`${c.caption}\n\n${c.hashtags.join(" ")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <PillarChip idea={idea} />
          <button className="btn ghost sm" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <h2 style={{ margin: "6px 0 4px", fontSize: 22 }}>{idea.title}</h2>
        <div className="muted small" style={{ marginBottom: 14 }}>
          {idea.angle} · {idea.audience} · {IDEA_STATUS[idea.status]}
        </div>

        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div className="tabs">
            <button className={view === "carousel" ? "on" : ""} onClick={() => setView("carousel")}>
              كاروسيل انستا
            </button>
            <button className={view === "reel" ? "on" : ""} onClick={() => setView("reel")}>
              سكريبت الريل · {total} ث
            </button>
          </div>
          <div className="row">
            {edit ? (
              <>
                <button className="btn primary sm" onClick={save}>
                  حفظ
                </button>
                <button className="btn sm" onClick={() => (setDraft(idea), setEdit(false))}>
                  إلغاء
                </button>
              </>
            ) : (
              <button className="btn sm" onClick={() => setEdit(true)}>
                ✎ تعديل النص
              </button>
            )}
            <button className="btn sm" onClick={() => onPatch({ action: "rebuild" })} title="إعادة كتابة الكاروسيل والسكريبت بصياغة أخرى">
              ↻ صياغة أخرى
            </button>
          </div>
        </div>

        {view === "carousel" ? (
          <>
            {edit ? (
              <div className="grid" style={{ gap: 10 }}>
                {c.slides.map((s, i) => (
                  <div key={i} className="card" style={{ padding: 12, display: "grid", gap: 6, gridTemplateColumns: "1fr 2fr 2fr" }}>
                    {(["kicker", "title", "body"] as const).map((k) => (
                      <textarea
                        key={k}
                        className="in"
                        rows={2}
                        value={s[k]}
                        aria-label={`شريحة ${i + 1} ${k}`}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            carousel: { ...d.carousel!, slides: d.carousel!.slides.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) },
                          }))
                        }
                      />
                    ))}
                  </div>
                ))}
                <label className="f">
                  الكابشن
                  <textarea
                    className="in"
                    rows={6}
                    value={c.caption}
                    onChange={(e) => setDraft((d) => ({ ...d, carousel: { ...d.carousel!, caption: e.target.value } }))}
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="slides">
                  {c.slides.map((_, i) => (
                    <SlidePreview
                      key={i}
                      idea={draft}
                      index={i}
                      img={slideImgs[i] ? mediaUrl(slideImgs[i].path, render?.updatedAt) : undefined}
                    />
                  ))}
                </div>
                <div className="card" style={{ marginTop: 12, background: "var(--surface-2)" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <b>الكابشن</b>
                    <button className="btn sm" onClick={copyCaption}>
                      {copied ? "✓ تم النسخ" : "نسخ الكابشن + الهاشتاقات"}
                    </button>
                  </div>
                  <div style={{ whiteSpace: "pre-line", marginTop: 6 }}>{c.caption}</div>
                  <div className="muted small row" style={{ marginTop: 8, gap: 8 }}>
                    {c.hashtags.map((h) => (
                      <bdi key={h}>{h}</bdi>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: reel ? "minmax(0,1fr) 220px" : "1fr", gap: 16 }}>
            <div className="card">
              <div className="scene muted small">
                <span>ث</span>
                <span>اللقطة (صوّرها أو ولّدها)</span>
                <span>النص على الشاشة</span>
                <span>التعليق الصوتي</span>
              </div>
              {r.scenes.map((s, i) => (
                <div className="scene" key={i}>
                  <span className="s">{s.seconds}s</span>
                  {edit ? (
                    (["visual", "onScreen", "voiceover"] as const).map((k) => (
                      <textarea
                        key={k}
                        className="in"
                        rows={2}
                        value={s[k]}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, reel: { ...d.reel!, scenes: d.reel!.scenes.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) } }))
                        }
                      />
                    ))
                  ) : (
                    <>
                      <span className="muted">{s.visual}</span>
                      <b>{s.onScreen}</b>
                      <span>{s.voiceover}</span>
                    </>
                  )}
                </div>
              ))}
              <div className="muted small" style={{ marginTop: 10 }}>
                🎵 {r.music} · CTA: {r.cta}
              </div>
            </div>
            {reel && (
              <video
                src={mediaUrl(reel.path, render?.updatedAt)}
                poster={(() => {
                  const t = render?.files?.find((f) => f.kind === "thumb");
                  return t ? mediaUrl(t.path, render?.updatedAt) : undefined;
                })()}
                controls
                playsInline
                style={{ width: "100%", aspectRatio: "9/16", background: "#000", borderRadius: 12 }}
              />
            )}
          </div>
        )}

        <div className="card" style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <b>رندر الفيديو والصور</b>
              <div className="muted small">Remotion يرسم الشرائح (PNG ‏1080×1350) والريل (MP4 ‏1080×1920) — FFmpeg يصدّر بمواصفات HX (H.264 Main 4.1، ‏CRF 19) ويسوي الصورة المصغرة. بدون موسيقى.</div>
            </div>
            <div className="row">
              <button className="btn primary sm" disabled={rendering} onClick={() => startRender("all")}>
                {rendering ? `${render?.step ?? "…"} ${Math.round((render?.progress ?? 0) * 100)}٪` : "▶ رندر الكل"}
              </button>
              <button className="btn sm" disabled={rendering} onClick={() => startRender("carousel")}>
                الشرائح فقط
              </button>
              <button className="btn sm" disabled={rendering} onClick={() => startRender("reel")}>
                الريل فقط
              </button>
            </div>
          </div>
          {render?.status === "error" && (
            <details className="notice">
              <summary>فشل الرندر — اضغط للتفاصيل</summary>
              <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", fontSize: 12 }}>{render.error}</pre>
            </details>
          )}
          {render?.status === "done" && (
            <div className="row small">
              {render.files.map((f) => (
                <a key={f.path} className="chip" href={mediaUrl(f.path)} download>
                  ⬇ {f.path.split("/").pop()}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
          <div className="row">
            {(Object.keys(IDEA_STATUS) as IdeaStatus[]).map((s) => (
              <button key={s} className={`btn sm ${idea.status === s ? "primary" : ""}`} onClick={() => onPatch({ status: s })}>
                {IDEA_STATUS[s]}
              </button>
            ))}
          </div>
          <button className="btn danger sm" onClick={onDelete}>
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}
