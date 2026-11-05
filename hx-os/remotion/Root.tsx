// HX 3D house style (see .claude/skills/hx3d-brand-style/SKILL.md):
// grid paper, white paper scraps with tape, black + white + pink #FF66B2 only,
// Cairo 900/700, Aref Ruqaa notes, pink progress bar on top, small HX 3D logo,
// calm motion (fade/slide up, slow zoom), no camera shake, no text over text.
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Sequence,
  Still,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ---------- shared props (written by lib/render.ts → props.json) ----------
type Slide = { kicker: string; title: string; body: string };
type Scene = { seconds: number; visual: string; onScreen: string; voiceover: string };
export type HXProps = {
  brand: { name: string; handle: string };
  accent: string; // kept for compatibility; the brand always uses PINK
  pillarLabel: string;
  slides: Slide[];
  reel: { title: string; scenes: Scene[]; cta: string; music: string } | null;
  slideIndex?: number;
};

const FPS = 30;
const PINK = "#FF66B2";
const INK = "#111111";
const INK2 = "#4A4A4A";
const PAPER = "#FFFFFF";
const GRID = "#F4F4F4";
const LINE = "#E2E2E2";
const ease = Easing.bezier(0.32, 0.72, 0, 1);

const demo: HXProps = {
  brand: { name: "HX 3D UAE", handle: "@hx3d.uae" },
  accent: PINK,
  pillarLabel: "هدايا الشركات",
  slides: [
    { kicker: "خلف الكواليس", title: "من ملف على الكمبيوتر إلى قطعة بيدك", body: "كيف نصنع مجسم شعار الشركة" },
    { kicker: "HX 3D UAE", title: "جاهز تحول فكرتك لقطعة حقيقية؟", body: "راسلنا على الواتساب\n@hx3d.uae" },
  ],
  reel: {
    title: "demo",
    cta: "اكتب «سعر» في التعليقات",
    music: "",
    scenes: [
      { seconds: 3, visual: "", onScreen: "من فكرة إلى قطعة حقيقية", voiceover: "" },
      { seconds: 3, visual: "", onScreen: "HX 3D UAE — دبي", voiceover: "" },
    ],
  },
};

// Emoji are dropped: they render as colour images (often yellow) and break the palette.
const clean = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️]/gu, "").replace(/\s+/g, " ").trim();
const cleanMulti = (s: string) => s.split("\n").map(clean).join("\n");

// ---------- fonts (bundled in public/fonts, works offline) ----------
function useFonts() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const faces = [
      new FontFace("Cairo", `url(${staticFile("fonts/Cairo.ttf")})`, { weight: "200 1000" }),
      new FontFace("ArefRuqaa", `url(${staticFile("fonts/ArefRuqaa-Bold.ttf")})`, { weight: "700" }),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => loaded.forEach((f) => document.fonts.add(f)))
      .catch((e) => console.error("font load failed", e))
      .finally(() => continueRender(handle));
  }, [handle]);
}

// ---------- building blocks ----------
const Paper: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: GRID,
      backgroundImage: `linear-gradient(${LINE} 2px, transparent 2px), linear-gradient(90deg, ${LINE} 2px, transparent 2px)`,
      backgroundSize: "54px 54px",
    }}
  >
    {/* soft vignette at the edges, like a real sheet */}
    <AbsoluteFill style={{ boxShadow: "inset 0 0 160px rgba(0,0,0,0.10)" }} />
    {children}
  </AbsoluteFill>
);

const Tape: React.FC<{ top: number; right: number; rot?: number }> = ({ top, right, rot = -4 }) => (
  <div style={{ position: "absolute", top, right, width: 190, height: 46, background: "rgba(255,102,178,0.35)", transform: `rotate(${rot}deg)`, borderRadius: 3 }} />
);

const Scrap: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      position: "absolute",
      background: PAPER,
      borderRadius: 6,
      boxShadow: "0 4px 4px rgba(0,0,0,0.05), 0 24px 48px rgba(0,0,0,0.10)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Logo: React.FC = () => (
  <div style={{ position: "absolute", top: 70, left: 64, fontFamily: "Cairo", fontWeight: 900, fontSize: 40, color: INK, direction: "ltr", letterSpacing: 1 }}>
    <span style={{ color: PINK }}>HX</span> 3D
  </div>
);

/** Pink highlight drawn behind the last word of a title (the "important word"). */
const Highlighted: React.FC<{ text: string; progress: number }> = ({ text, progress }) => {
  const words = text.split(" ");
  const last = words.pop() ?? "";
  return (
    <>
      {words.join(" ")}{" "}
      <span style={{ position: "relative", whiteSpace: "nowrap", display: "inline-block" }}>
        <span
          style={{
            position: "absolute",
            insetInline: -10,
            top: "14%",
            bottom: "8%",
            background: PINK,
            borderRadius: 8,
            transformOrigin: "right center",
            transform: `scaleX(${progress})`,
          }}
        />
        <span style={{ position: "relative" }}>{last}</span>
      </span>
    </>
  );
};

// A stylised object that "prints" layer by layer, with a moving nozzle (line drawing, ink + pink).
const PrintedObject: React.FC<{ progress: number; size: number }> = ({ progress, size }) => {
  const layers = 26;
  const shown = Math.max(1, Math.round(layers * progress));
  const lh = size / layers;
  const nozzleY = size - shown * lh;
  return (
    <svg width={size} height={size + 60} viewBox={`0 0 ${size} ${size + 60}`}>
      <ellipse cx={size / 2} cy={size + 30} rx={size * 0.42} ry={12} fill="rgba(0,0,0,0.08)" />
      {Array.from({ length: shown }).map((_, i) => {
        const y = size - (i + 1) * lh;
        const t = i / layers;
        const w = size * (t < 0.15 ? 0.8 : t < 0.85 ? 0.55 - t * 0.2 : 0.22);
        return <rect key={i} x={(size - w) / 2} y={y} width={w} height={lh - 2} rx={3} fill={i === shown - 1 ? PINK : i % 2 ? INK : "#2a2a2a"} />;
      })}
      {progress < 1 && (
        <g transform={`translate(${size / 2 + Math.sin(progress * 50) * size * 0.2}, ${nozzleY - 8})`}>
          <rect x={-22} y={-40} width={44} height={26} rx={5} fill={PAPER} stroke={INK} strokeWidth={4} />
          <polygon points="-10,-14 10,-14 0,0" fill={PINK} stroke={INK} strokeWidth={3} />
        </g>
      )}
    </svg>
  );
};

const Chain: React.FC<{ steps: string[]; bottom: number }> = ({ steps, bottom }) => (
  <div style={{ position: "absolute", bottom, right: 64, left: 64, display: "flex", gap: 14, alignItems: "center", justifyContent: "flex-start", direction: "rtl", flexWrap: "wrap" }}>
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span style={{ fontFamily: "Cairo", fontWeight: 900, fontSize: 34, color: PINK }}>←</span>}
        <span
          style={{
            fontFamily: "Cairo",
            fontWeight: 700,
            fontSize: 30,
            padding: "4px 22px",
            borderRadius: 999,
            border: `3px solid ${i === steps.length - 1 ? PINK : INK}`,
            background: i === steps.length - 1 ? PINK : PAPER,
            color: INK,
          }}
        >
          {s}
        </span>
      </React.Fragment>
    ))}
  </div>
);

// ---------- Carousel slide (still, 1080×1350) ----------
export const CarouselSlide: React.FC<HXProps> = (p) => {
  useFonts();
  const i = p.slideIndex ?? 0;
  const s = p.slides[i] ?? { kicker: "", title: "", body: "" };
  const first = i === 0;
  const last = i === p.slides.length - 1;
  const num = String(i + 1).padStart(2, "0");
  return (
    <Paper>
      <Logo />
      <div style={{ position: "absolute", top: 76, right: 64, fontFamily: "Cairo", fontWeight: 700, fontSize: 30, color: INK2, direction: "ltr" }}>
        {i + 1} / {p.slides.length}
      </div>
      <Scrap style={{ top: 190, right: 64, left: 64, padding: "70px 60px 64px", direction: "rtl" }}>
        <Tape top={-22} right={80} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: "Cairo", fontWeight: 900, fontSize: 32 }}>
          <span style={{ background: INK, color: PAPER, borderRadius: 6, padding: "0 14px", direction: "ltr" }}>{num}</span>
          <span style={{ color: INK }}>{clean(s.kicker)}</span>
        </div>
        <div style={{ fontFamily: "Cairo", fontWeight: 900, fontSize: first ? 86 : 72, lineHeight: 1.4, color: INK, marginTop: 34 }}>
          <Highlighted text={clean(s.title)} progress={1} />
        </div>
        <svg width="260" height="30" viewBox="0 0 260 30" style={{ marginTop: 26, display: "block" }}>
          <path d="M5 15 Q 25 0 45 15 T 85 15 T 125 15 T 165 15 T 205 15 T 255 15" fill="none" stroke={PINK} strokeWidth="7" strokeLinecap="round" />
        </svg>
        <div style={{ fontFamily: "Cairo", fontWeight: 700, fontSize: 42, lineHeight: 1.65, color: INK2, marginTop: 22, whiteSpace: "pre-line", unicodeBidi: "plaintext", textAlign: "right" }}>{cleanMulti(s.body)}</div>
      </Scrap>
      {first && (
        <div style={{ position: "absolute", bottom: 60, left: 70 }}>
          <PrintedObject progress={last ? 1 : 0.62} size={200} />
        </div>
      )}
      {!last ? (
        <div style={{ position: "absolute", bottom: 175, right: 70, fontFamily: "Cairo", fontWeight: 900, fontSize: 44, color: INK, direction: "rtl" }}>
          اسحب <span style={{ color: PINK }}>←</span>
        </div>
      ) : (
        <Chain steps={["فكرتك", "تصميم", "قطعة بيدك"]} bottom={64} />
      )}
      <div style={{ position: "absolute", bottom: last ? 150 : 70, right: 64, fontFamily: "Cairo", fontWeight: 700, fontSize: 28, color: INK2, direction: "ltr" }}>
        {p.brand.handle} · {p.pillarLabel}
      </div>
    </Paper>
  );
};

// ---------- Reel (video, 1080×1920) ----------
const SceneView: React.FC<{ p: HXProps; scene: Scene; index: number; total: number }> = ({ p, scene, index, total }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const isLast = index === total - 1;
  // paper slides up in, then the highlight draws, then leaves upward
  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const draw = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const y = (1 - enter) * 120 - exit * 140;
  const chapter = String(index + 1).padStart(2, "0");
  return (
    <AbsoluteFill style={{ opacity: Math.min(enter, 1 - exit) }}>
      <Scrap style={{ top: 360, right: 72, left: 72, padding: "64px 56px 70px", direction: "rtl", transform: `translateY(${y}px) rotate(${index % 2 ? 0.6 : -0.6}deg)` }}>
        <Tape top={-24} right={90} rot={index % 2 ? 3 : -4} />
        {!isLast && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: "Cairo", fontWeight: 900, fontSize: 36, marginBottom: 26 }}>
            <span style={{ background: INK, color: PAPER, borderRadius: 6, padding: "0 16px", direction: "ltr" }}>{chapter}</span>
            <span>{p.pillarLabel}</span>
          </div>
        )}
        <div style={{ fontFamily: "Cairo", fontWeight: 900, fontSize: isLast ? 104 : 88, lineHeight: 1.4, color: INK }}>
          <Highlighted text={clean(scene.onScreen)} progress={draw} />
        </div>
      </Scrap>
      {isLast && (
        <Scrap style={{ top: 1010, right: 140, left: 140, padding: "34px 40px", direction: "rtl", borderRadius: 40, transform: `translateY(${(1 - draw) * 60}px)`, opacity: draw }}>
          <div style={{ fontFamily: "Cairo", fontWeight: 900, fontSize: 46, color: INK, textAlign: "center" }}>{clean(p.reel?.cta ?? "")}</div>
        </Scrap>
      )}
    </AbsoluteFill>
  );
};

export const Reel: React.FC<HXProps> = (p) => {
  useFonts();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scenes = p.reel?.scenes ?? [];
  const progress = frame / durationInFrames;
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.04]); // slow, calm push-in
  let from = 0;
  return (
    <AbsoluteFill style={{ background: GRID }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Paper />
        <div style={{ position: "absolute", bottom: 300, left: 90 }}>
          <PrintedObject progress={Math.min(1, progress * 1.2)} size={330} />
        </div>
        {scenes.map((s, i) => {
          const len = Math.max(1, Math.round(s.seconds * FPS));
          const el = (
            <Sequence key={i} from={from} durationInFrames={len}>
              <SceneView p={p} scene={s} index={i} total={scenes.length} />
            </Sequence>
          );
          from += len;
          return el;
        })}
      </AbsoluteFill>
      {/* fixed chrome: pink progress bar on top, logo, steps chain above the app buttons area */}
      <div style={{ position: "absolute", top: 0, right: 0, height: 14, width: `${progress * 100}%`, background: PINK }} />
      <Logo />
      <Chain steps={["فكرة", "طباعة", "النتيجة"]} bottom={170} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={150}
      defaultProps={demo}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(30, (props.reel?.scenes ?? []).reduce((a, s) => a + Math.max(1, Math.round(s.seconds * FPS)), 0)),
      })}
    />
    <Still id="Slide" component={CarouselSlide} width={1080} height={1350} defaultProps={{ ...demo, slideIndex: 0 }} />
  </>
);
