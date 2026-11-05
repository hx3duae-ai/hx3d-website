export type Pillar = "gifts" | "architecture" | "products";

export const PILLARS: Record<Pillar, { label: string; en: string; color: string }> = {
  gifts: { label: "هدايا الشركات", en: "Corporate Gifts", color: "#FF66B2" },
  architecture: { label: "مجسمات معمارية", en: "Architectural Models", color: "#111111" },
  products: { label: "منتجات ونماذج", en: "Products & Prototypes", color: "#9a9a9a" },
};

export type IdeaStatus = "new" | "approved" | "posted" | "archived";

export const IDEA_STATUS: Record<IdeaStatus, string> = {
  new: "جديدة",
  approved: "معتمدة",
  posted: "منشورة",
  archived: "مؤرشفة",
};

export type Slide = { kicker: string; title: string; body: string };

export type Carousel = {
  slides: Slide[];
  caption: string;
  hashtags: string[];
};

export type ReelScene = {
  seconds: number;
  visual: string; // what the camera shows / B-roll to film or generate
  onScreen: string; // big text on screen
  voiceover: string;
};

export type ReelScript = {
  title: string;
  scenes: ReelScene[];
  cta: string;
  music: string;
};

export type RenderJob = {
  status: "queued" | "rendering" | "done" | "error";
  progress?: number;
  step?: string;
  files: { kind: "reel" | "slide" | "thumb"; path: string }[];
  error?: string;
  updatedAt: string;
};

export type Idea = {
  id: string;
  date: string; // Dubai date the idea belongs to
  pillar: Pillar;
  title: string;
  angle: string;
  hook: string;
  audience: string;
  occasion?: string;
  status: IdeaStatus;
  source: "engine" | "claude" | "crm";
  clientId?: string; // when born from a CRM order (case study)
  carousel?: Carousel;
  reel?: ReelScript;
  render?: RenderJob;
  createdAt: string;
};
