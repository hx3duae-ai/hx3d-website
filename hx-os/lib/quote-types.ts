// Quotation requests. The REQUEST (what the customer wants) and the PRICING
// (what the owner decides) are stored in two separate collections:
//   data/quotes.json   — request details, files, workflow status. Staff + NAJM can read.
//   data/pricing.json  — amounts, approval, sent snapshot. OWNER ONLY.
// A customer only ever sees `sent` — the frozen copy the owner approved and sent.

/** Workflow statuses staff may set (no pricing meaning). */
export const STAFF_STATUS = {
  submitted: "طلب جديد",
  needs_info: "بانتظار معلومات من العميل",
  under_review: "قيد المراجعة",
  ready_for_owner: "جاهز لتسعير المالك",
  cancelled: "ملغي",
} as const;

/** Statuses only the pricing flow (owner) or the customer's reply can reach. */
export const OWNER_STATUS = {
  approved: "معتمد من المالك (لم يُرسل)",
  rejected: "مرفوض من المالك",
  sent: "أُرسل للعميل",
  accepted: "قبله العميل",
  declined: "رفضه العميل",
} as const;

export type StaffStatus = keyof typeof STAFF_STATUS;
export type QuoteStatus = StaffStatus | keyof typeof OWNER_STATUS;
export const QUOTE_STATUS: Record<QuoteStatus, string> = { ...STAFF_STATUS, ...OWNER_STATUS };

export type QuoteFile = { id: string; name: string; size: number; uploadedAt: string; by: string };

export type QuoteDetails = {
  title: string;
  description?: string;
  quantity?: number;
  material?: string;
  colors?: string;
  size?: string;
  deadline?: string;
  delivery?: string;
  notes?: string;
};

export type QuoteRequest = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: QuoteStatus;
  source: "customer" | "najm" | "staff";
  customer: { name: string; phone?: string; email?: string; company?: string };
  details: QuoteDetails;
  missingInfo?: string[];
  files: QuoteFile[];
  clientId?: string;
  createdBy: string; // actor id, or "customer"
  assignedTo: string[]; // employee ids the owner assigned (employees only see these)
  customerKeyHash: string; // sha256 of the customer's private link key
  customerResponse?: { at: string; decision: "accepted" | "declined"; note?: string };
};

export type PriceLine = { desc: string; qty: number; unit: number };

export type PricingSnapshot = {
  version: number;
  currency: "AED";
  lines: PriceLine[];
  total: number;
  vatIncluded: boolean;
  validUntil?: string;
  customerNote?: string;
};

/** OWNER-ONLY record. Never returned by any non-owner route. */
export type Pricing = PricingSnapshot & {
  quoteId: string;
  internalNote?: string;
  decision: "draft" | "approved" | "rejected";
  updatedAt: string;
  decidedAt?: string;
  sent?: PricingSnapshot & { sentAt: string }; // what the customer sees
};
