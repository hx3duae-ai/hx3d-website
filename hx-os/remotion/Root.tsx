import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Composition,
  Sequence,
  Still,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ---------- shared props (written by lib/render.ts → props.json) ----------
type Slide = { kicker: string; title: string; body: string };
type Scene = { seconds: number; visual: string; onScreen: string; voiceover: string };
export type HXProps = {
  brand: { name: string; handle: string };
  accent: string;
  pillarLabel: string;
  slides: Slide[];
  reel: { title: string; scenes: Scene[]; cta: string; music: string } | null;
  slideIndex?: number;
};

const FPS = 30;
const BG = "#0b0d10";
const INK = "#f3f1ec";
const MUTED = "#9aa0a6";

const demo: HXProps = {
  brand: { name: "HX 3D UAE", handle: "@hx3d.uae" },
  accent: "#c8a24a",
  pillarLabel: "هدايا الشركات",
  slides: [
    { kicker: "خلف الكواليس", title: "من ملف على الكمبيوتر إلى قطعة بيدك… شوف كيف 👇", body: "كيف نصنع مجسم شعار الشركة" },
    { kicker: "HX 3D UAE", title: "جاهز تحول فكرتك لقطعة حقيقية؟", body: "راسلنا على الواتساب\n@hx3d.uae" },
  ],
  reel: {
    title: "demo",
    cta: "راسلنا",
    music: "",
    scenes: [
      { seconds: 3, visual: "", onScreen: "من فكرة… إلى قطعة حقيقية", voiceover: "" },
      { seconds: 3, visual: "", onScreen: "HX 3D UAE — دبي", voiceover: "" },
    ],
  },
};

// ---------- fonts (bundled in public/fonts, works offline) ----------
function useFonts() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const faces = [
      new FontFace("ElMessiri", `url(${staticFile("fonts/ElMessiri.ttf")})`),
      new FontFace("ReemKufi", `url(${staticFile("fonts/ReemKufi.ttf")})`),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => loaded.forEach((f) => document.fonts.add(f)))
      .catch((e) => console.error("font load failed", e))
      .finally(() => continueRender(handle));
  }, [handle]);
}

// ---------- motif: horizontal print layers ----------
const Layers: React.FC<{ accent: string; progress: number; opacity?: number }> = ({ accent, progress, opacity = 0.18 }) => {
  const rows = 60;
  const shown = Math.floor(rows * progress);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", opacity }}>
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 3,
            marginTop: 13,
            background: i === shown - 1 ? accent : "rgba(255,255,255,0.35)",
            width: `${60 + 40 * Math.sin(i * 0.37) ** 2}%`,
            alignSelf: "center",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// A stylised object that "prints" layer by layer, with a moving nozzle.
const PrintedObject: React.FC<{ accent: string; progress: number; size: number }> = ({ accent, progress, size }) => {
  const layers = 28;
  const shown = Math.max(1, Math.round(layers * progress));
  const lh = size / layers;
  const nozzleY = size - shown * lh;
  return (
    <svg width={size} height={size + 40} viewBox={`0 0 ${size} ${size + 40}`}>
      {Array.from({ length: shown }).map((_, i) => {
        const y = size - (i + 1) * lh;
        // tower silhouette: wide base, tapering, with a crown
        const t = i / layers;
        const w = size * (t < 0.15 ? 0.8 : t < 0.85 ? 0.55 - t * 0.2 : 0.22);
        return (
          <rect
            key={i}
            x={(size - w) / 2}
            y={y}
            width={w}
            height={lh - 1.5}
            rx={2}
            fill={i === shown - 1 ? accent : `rgba(243,241,236,${0.55 + 0.4 * t})`}
          />
        );
      })}
      {progress < 1 && (
        <g transform={`translate(${size / 2 + Math.sin(progress * 60) * size * 0.2}, ${nozzleY - 8})`}>
          <rect x={-18} y={-34} width={36} height={22} rx={4} fill="#2a2f36" />
          <polygon points="-8,-12 8,-12 0,0" fill={accent} />
        </g>
      )}
    </svg>
  );
};

const Footer: React.FC<{ p: HXProps; right?: string }> = ({ p, right }) => (
  <div
    style={{
      position: "absolute",
      bottom: 56,
      left: 72,
      right: 72,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: "ReemKufi",
      fontSize: 34,
      color: MUTED,
      direction: "ltr",
    }}
  >
    <span>{p.brand.handle}</span>
    <span style={{ color: INK, letterSpacing: 2 }}>
      <b style={{ color: p.accent }}>HX</b> 3D UAE{right ? `  ·  ${right}` : ""}
    </span>
  </div>
);

// ---------- Carousel slide (still, 1080×1350) ----------
export const CarouselSlide: React.FC<HXProps> = (p) => {
  useFonts();
  const i = p.slideIndex ?? 0;
  const s = p.slides[i] ?? { kicker: "", title: "", body: "" };
  const first = i === 0;
  const last = i === p.slides.length - 1;
  return (
    <AbsoluteFill style={{ background: BG, color: INK, direction: "rtl" }}>
      <Layers accent={p.accent} progress={(i + 1) / p.slides.length} opacity={0.12} />
      <div style={{ position: "absolute", top: 72, right: 72, left: 72, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "ReemKufi", fontSize: 34, color: p.accent, border: `2px solid ${p.accent}`, padding: "6px 22px", borderRadius: 999 }}>
          {s.kicker}
        </span>
        <span style={{ fontFamily: "ReemKufi", fontSize: 32, color: MUTED, direction: "ltr" }}>
          {i + 1} / {p.slides.length}
        </span>
      </div>
      <div style={{ position: "absolute", top: first ? 300 : 260, right: 72, left: 72 }}>
        <div style={{ fontFamily: "ElMessiri", fontWeight: 700, fontSize: first ? 92 : 76, lineHeight: 1.35 }}>{s.title}</div>
        <div style={{ width: 120, height: 8, background: p.accent, borderRadius: 4, margin: "48px 0" }} />
        <div style={{ fontFamily: "ElMessiri", fontSize: 46, lineHeight: 1.6, color: "#cfd3d6", whiteSpace: "pre-line" }}>{s.body}</div>
      </div>
      {(first || last) && (
        <div style={{ position: "absolute", bottom: 150, left: 72 }}>
          <PrintedObject accent={p.accent} progress={last ? 1 : 0.62} size={300} />
        </div>
      )}
      {!last && (
        <div style={{ position: "absolute", bottom: 150, right: 72, fontFamily: "ReemKufi", fontSize: 36, color: p.accent }}>
          اسحب ←
        </div>
      )}
      <Footer p={p} right={p.pillarLabel} />
    </AbsoluteFill>
  );
};

// ---------- Reel (video, 1080×1920) ----------
const SceneView: React.FC<{ p: HXProps; scene: Scene; index: number; total: number }> = ({ p, scene, index, total }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, mass: 0.7 } });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = scene.onScreen.split(" ");
  const isLast = index === total - 1;
  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <div
        style={{
          position: "absolute",
          top: 520,
          right: 80,
          left: 80,
          fontFamily: "ElMessiri",
          fontWeight: 700,
          fontSize: isLast ? 120 : 96,
          lineHeight: 1.35,
          textAlign: "center",
          direction: "rtl",
          transform: `translateY(${(1 - enter) * 60}px)`,
        }}
      >
        {words.map((w, i) => {
          const o = interpolate(frame, [i * 3, i * 3 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={i} style={{ opacity: o, color: i === words.length - 1 && !isLast ? p.accent : INK }}>
              {w}{" "}
            </span>
          );
        })}
      </div>
      {isLast && (
        <div style={{ position: "absolute", top: 1000, width: "100%", textAlign: "center", fontFamily: "ReemKufi", fontSize: 52, color: p.accent, opacity: enter, direction: "rtl" }}>
          {p.reel?.cta}
        </div>
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
  let from = 0;
  return (
    <AbsoluteFill style={{ background: BG, color: INK }}>
      <Layers accent={p.accent} progress={Math.min(1, progress * 1.15)} />
      <div style={{ position: "absolute", bottom: 330, width: "100%", display: "flex", justifyContent: "center" }}>
        <PrintedObject accent={p.accent} progress={Math.min(1, progress * 1.25)} size={380} />
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
      <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center", fontFamily: "ReemKufi", fontSize: 40, color: p.accent, direction: "rtl" }}>
        {p.pillarLabel}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 10, width: `${progress * 100}%`, background: p.accent }} />
      <Footer p={p} />
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
