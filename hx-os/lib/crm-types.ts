import type { Pillar } from "./content-types";

export type ClientStatus = "lead" | "in_progress" | "delivered";
export const CLIENT_STATUS: Record<ClientStatus, string> = {
  lead: "ليد",
  in_progress: "قيد التنفيذ",
  delivered: "تم التسليم",
};

export type OrderType = "corporate_gift" | "architectural_model" | "product" | "prototype" | "event" | "other";
export const ORDER_TYPES: Record<OrderType, { label: string; pillar: Pillar }> = {
  corporate_gift: { label: "هدايا شركات", pillar: "gifts" },
  architectural_model: { label: "مجسم معماري", pillar: "architecture" },
  product: { label: "منتج مخصص", pillar: "products" },
  prototype: { label: "نموذج أولي", pillar: "products" },
  event: { label: "فعاليات ومعارض", pillar: "gifts" },
  other: { label: "أخرى", pillar: "products" },
};

export type Client = {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  orderType: OrderType;
  price: number; // AED
  status: ClientStatus;
  source: "manual" | "calcom" | "instagram" | "whatsapp" | "referral";
  notes?: string;
  bookingUid?: string; // Cal.com booking uid (dedupe key)
  bookingStart?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string; // drives monthly sales
};

// ---------- stats ----------
export type MonthStat = { month: string; sales: number; orders: number };

