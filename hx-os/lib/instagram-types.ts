import type { Pillar } from "./content-types";

/** Settings for the 4 Instagram agents. Editable from /instagram. */
export type IgSettings = {
  /** Words that trigger the catalog DM when found in a comment or DM. */
  keywords: string[];
  /** DM sent to anyone who comments a keyword. {name} is replaced with their name/handle. */
  catalogMessage: string;
  catalogUrl: string;
  /** Public reply under the comment, so others see we answered. Empty = no public reply. */
  publicReply: string;
  /** Posting time (Dubai, HH:MM) per weekday, Sunday=0 … Saturday=6. */
  slots: string[];
};

export const DEFAULT_IG_SETTINGS: IgSettings = {
  keywords: ["سعر", "السعر", "الاسعار", "بكم", "كم السعر", "info", "price", "details"],
  catalogMessage:
    "هلا {name} 👋 شكراً لتواصلك مع HX 3D Dubai!\n" +
    "هذا كتالوج خدماتنا (هدايا شركات، مجسمات معمارية، منتجات ونماذج أولية) مع الأسعار التقريبية:\n{catalog}\n\n" +
    "قول لي شو تحتاج (الكمية، المقاس، الموعد) وأرسل لك عرض سعر خلال ساعة ✨",
  catalogUrl: "",
  publicReply: "أرسلنا لك التفاصيل في الخاص 📩",
  // Sun..Sat — evenings perform best for UAE audiences; Friday after Jumu'ah.
  slots: ["19:30", "19:30", "20:00", "19:30", "20:00", "15:00", "12:00"],
};

export type IgEventKind = "comment" | "dm";

/** Every inbound comment/DM we processed, plus what we did about it. */
export type IgEvent = {
  id: string;
  kind: IgEventKind;
  externalId: string; // comment id or message id (dedupe key)
  igUserId?: string;
  username?: string;
  text: string;
  mediaId?: string;
  matched?: string; // keyword that matched
  intent: "price" | "order" | "question" | "other";
  clientId?: string; // CRM lead it was attached to
  action: "catalog_sent" | "catalog_queued" | "needs_reply" | "replied" | "ignored";
  reply?: string;
  error?: string;
  via: "ootto" | "meta" | "manual";
  at: string;
};

export type IgPostStatus = "planned" | "ready" | "scheduled" | "posted" | "skipped";

export type IgPost = {
  id: string;
  date: string; // Dubai YYYY-MM-DD
  time: string; // Dubai HH:MM
  format: "reel" | "carousel";
  pillar: Pillar;
  ideaId?: string;
  title: string;
  caption: string;
  status: IgPostStatus;
  externalId?: string; // id returned by OOTTO / Meta once scheduled
  createdAt: string;
  updatedAt: string;
};

export type IgMetrics = {
  id: string;
  at: string;
  period: string; // e.g. "last_7d", "2026-11"
  followers?: number;
  views?: number;
  reach?: number;
  saves?: number;
  shares?: number;
  topReel?: { id?: string; title?: string; url?: string; views?: number };
  notes?: string;
  source: "ootto" | "meta" | "manual";
};
