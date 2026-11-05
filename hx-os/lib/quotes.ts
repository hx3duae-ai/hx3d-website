// Quotation requests + owner-only pricing. Server-side only.
// Every pricing function re-checks that the actor is the owner (defence in
// depth: the routes already call requireOwner()).
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { all, DATA_DIR, logActivity, mutate, newId, now } from "./db";
import { AuthError, type Actor, isOwner, priceKeysIn, safeEqual } from "./auth";
import { audit } from "./audit";
import {
  OWNER_STATUS,
  QUOTE_STATUS,
  STAFF_STATUS,
  type PriceLine,
  type Pricing,
  type QuoteDetails,
  type QuoteFile,
  type QuoteRequest,
  type QuoteStatus,
  type StaffStatus,
} from "./quote-types";

export * from "./quote-types";

export const FILES_DIR = path.join(DATA_DIR, "quote-files");
export const ALLOWED_EXT = [".stl", ".3mf", ".obj", ".step", ".stp", ".png", ".jpg", ".jpeg", ".webp", ".pdf", ".zip"];
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

const hashKey = (k: string) => crypto.createHash("sha256").update(k).digest("hex");

function assertOwner(actor: Actor) {
  if (!isOwner(actor)) throw new AuthError(403, "التسعير من صلاحية المالك فقط");
}

/** Reject any attempt by a non-owner to send pricing fields. */
export async function rejectPriceFields(actor: Actor, input: unknown, ref?: string) {
  const keys = priceKeysIn(input);
  if (!keys.length) return;
  await audit({ actor, action: "denied", ref, detail: { reason: "price fields sent to a non-pricing endpoint", keys } });
  throw new AuthError(403, `الأسعار يحددها المالك فقط — حقول مرفوضة: ${keys.join(", ")}`);
}

// ---------- request sanitising (no price fields exist here by design) ----------
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

export function sanitizeDetails(input: Record<string, unknown>): Partial<QuoteDetails> {
  const out: Partial<QuoteDetails> = {};
  for (const k of ["title", "description", "material", "colors", "size", "deadline", "delivery", "notes"] as const) {
    if (k in input) out[k] = str(input[k]) ?? "";
  }
  if ("quantity" in input) {
    const q = Number(input.quantity);
    out.quantity = Number.isInteger(q) && q > 0 && q < 1_000_000 ? q : undefined;
  }
  return out;
}

function sanitizeCustomer(input: unknown): QuoteRequest["customer"] {
  const c = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return { name: str(c.name, 200) || "", phone: str(c.phone, 50), email: str(c.email, 200), company: str(c.company, 200) };
}

/** What every non-owner sees: the request, never pricing, never the key hash. */
export function publicQuote(q: QuoteRequest) {
  const { customerKeyHash: _k, ...rest } = q;
  return { ...rest, statusLabel: QUOTE_STATUS[q.status] };
}

// ---------- create / read ----------
export async function createQuote(input: Record<string, unknown>, actor: Actor) {
  const customer = sanitizeCustomer(input.customer);
  const details = sanitizeDetails((input.details ?? {}) as Record<string, unknown>);
  if (!customer.name) throw new AuthError(400, "اسم العميل مطلوب");
  if (!customer.phone && !customer.email) throw new AuthError(400, "رقم الهاتف أو البريد مطلوب");
  if (!details.title) throw new AuthError(400, "وصف مختصر للطلب مطلوب");
  const customerKey = crypto.randomBytes(24).toString("base64url");
  const q: QuoteRequest = {
    id: newId("quo"),
    createdAt: now(),
    updatedAt: now(),
    status: "submitted",
    source: actor.role === "agent" ? "najm" : actor.role === "anonymous" ? "customer" : "staff",
    customer,
    details: details as QuoteDetails,
    missingInfo: Array.isArray(input.missingInfo) ? input.missingInfo.map((m) => str(m, 300) ?? "").filter(Boolean).slice(0, 20) : [],
    files: [],
    clientId: str(input.clientId, 40),
    createdBy: actor.role === "anonymous" ? "customer" : actor.id,
    assignedTo: [],
    customerKeyHash: hashKey(customerKey),
  };
  await mutate<QuoteRequest, void>("quotes", (rows) => void rows.push(q));
  await audit({ actor, action: "quote_created", ref: q.id, detail: { source: q.source } });
  await logActivity({ module: "quotes", kind: "quote_created", text: `طلب عرض سعر جديد: ${customer.name} — ${details.title}`, ref: q.id });
  return { quote: q, customerKey };
}

export async function getQuote(id: string) {
  return (await all<QuoteRequest>("quotes")).find((q) => q.id === id) ?? null;
}

/** Owner: all. Employee: only assigned. NAJM/agent: only the ones it created. */
export function canSee(actor: Actor, q: QuoteRequest) {
  if (actor.role === "owner") return true;
  if (actor.role === "employee") return q.assignedTo.includes(actor.id);
  if (actor.role === "agent") return q.createdBy === actor.id;
  return false;
}

export async function listQuotesFor(actor: Actor) {
  const rows = await all<QuoteRequest>("quotes");
  return rows.filter((q) => canSee(actor, q)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- update request (no pricing) ----------
const isStaffStatus = (s: string): s is StaffStatus => s in STAFF_STATUS;
const isOwnerStatus = (s: string) => s in OWNER_STATUS;

export async function updateQuote(id: string, input: Record<string, unknown>, actor: Actor) {
  await rejectPriceFields(actor, input, id);
  const current = await getQuote(id);
  if (!current || !canSee(actor, current)) throw new AuthError(404, "not found");
  // Once the owner has decided (approved / rejected / sent / customer replied), only the owner may touch it.
  if (isOwnerStatus(current.status) && !isOwner(actor))
    throw new AuthError(403, "هذا العرض بيد المالك — لا يمكن تعديله أو تغيير حالته");

  const patch: Partial<QuoteRequest> = {};
  if (input.details && typeof input.details === "object") patch.details = { ...current.details, ...sanitizeDetails(input.details as Record<string, unknown>) };
  if (input.customer && typeof input.customer === "object") patch.customer = { ...current.customer, ...sanitizeCustomer({ ...current.customer, ...(input.customer as object) }) };
  if (Array.isArray(input.missingInfo)) patch.missingInfo = input.missingInfo.map((m) => str(m, 300) ?? "").filter(Boolean).slice(0, 20);
  if ("status" in input) {
    const s = String(input.status);
    if (!isStaffStatus(s)) throw new AuthError(403, "الاعتماد والرفض والإرسال من صلاحية المالك فقط (عبر مسارات التسعير)");
    if (actor.role === "agent" && !["submitted", "needs_info", "ready_for_owner"].includes(s)) throw new AuthError(403, "غير مصرح لـ NAJM");
    patch.status = s;
  }
  if ("assignedTo" in input) {
    if (!isOwner(actor)) throw new AuthError(403, "التعيين من صلاحية المالك");
    patch.assignedTo = Array.isArray(input.assignedTo) ? input.assignedTo.map((x) => str(x, 60) ?? "").filter(Boolean).slice(0, 20) : [];
  }

  const q = await mutate<QuoteRequest, QuoteRequest | null>("quotes", (rows) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, patch, { updatedAt: now() });
    return r;
  });
  if (!q) throw new AuthError(404, "not found");
  await audit({
    actor,
    action: patch.status && patch.status !== current.status ? "quote_status" : "quote_updated",
    ref: id,
    detail: { fields: Object.keys(patch), from: current.status, to: q.status },
  });
  return q;
}

// ---------- files ----------
export async function addFile(id: string, file: File, actor: Actor | "customer") {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) throw new AuthError(400, `نوع الملف غير مدعوم (${ALLOWED_EXT.join(" ")})`);
  if (file.size > MAX_FILE_BYTES) throw new AuthError(413, "الملف أكبر من 100MB");
  const q = await getQuote(id);
  if (!q) throw new AuthError(404, "not found");
  if (isOwnerStatus(q.status) && !(actor !== "customer" && isOwner(actor))) throw new AuthError(403, "لا يمكن إضافة ملفات بعد قرار المالك");
  const f: QuoteFile = {
    id: newId("fil"),
    name: path.basename(file.name).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120),
    size: file.size,
    uploadedAt: now(),
    by: actor === "customer" ? "customer" : actor.id,
  };
  const dir = path.join(FILES_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, f.id + ext), Buffer.from(await file.arrayBuffer()));
  await mutate<QuoteRequest, void>("quotes", (rows) => {
    const r = rows.find((x) => x.id === id);
    if (r) {
      r.files.push(f);
      r.updatedAt = now();
    }
  });
  await audit({ actor: actor === "customer" ? { role: "anonymous", id: "customer" } : actor, action: "quote_file_added", ref: id, detail: { file: f.name, size: f.size } });
  return f;
}

export function filePath(q: QuoteRequest, fileId: string) {
  const f = q.files.find((x) => x.id === fileId);
  if (!f) return null;
  return { file: f, path: path.join(FILES_DIR, q.id, f.id + path.extname(f.name).toLowerCase()) };
}

// ---------- OWNER-ONLY pricing ----------
export async function getPricing(id: string, actor: Actor) {
  assertOwner(actor);
  return (await all<Pricing>("pricing")).find((p) => p.quoteId === id) ?? null;
}

function cleanLines(v: unknown): PriceLine[] {
  if (!Array.isArray(v) || !v.length || v.length > 100) throw new AuthError(400, "أدخل بنداً واحداً على الأقل");
  return v.map((l, i) => {
    const o = (l ?? {}) as Record<string, unknown>;
    const desc = str(o.desc, 300);
    const qty = Number(o.qty);
    const unit = Number(o.unit);
    if (!desc) throw new AuthError(400, `البند ${i + 1}: الوصف مطلوب`);
    if (!Number.isFinite(qty) || qty <= 0) throw new AuthError(400, `البند ${i + 1}: الكمية غير صحيحة`);
    if (!Number.isFinite(unit) || unit < 0) throw new AuthError(400, `البند ${i + 1}: المبلغ غير صحيح`);
    return { desc, qty, unit: Math.round(unit * 100) / 100 };
  });
}

/** The owner enters/edits the amounts. Any edit returns the quote to draft (needs re-approval). */
export async function setPricing(id: string, input: Record<string, unknown>, actor: Actor) {
  assertOwner(actor);
  const q = await getQuote(id);
  if (!q) throw new AuthError(404, "not found");
  const lines = cleanLines(input.lines);
  const before = await getPricing(id, actor);
  const p: Pricing = {
    quoteId: id,
    version: (before?.version ?? 0) + 1,
    currency: "AED",
    lines,
    // plain sum of the owner's own figures — the system never decides an amount
    total: Math.round(lines.reduce((a, l) => a + l.qty * l.unit, 0) * 100) / 100,
    vatIncluded: input.vatIncluded === true,
    validUntil: str(input.validUntil, 30),
    customerNote: str(input.customerNote),
    internalNote: str(input.internalNote),
    decision: "draft",
    updatedAt: now(),
    sent: before?.sent,
  };
  await mutate<Pricing, void>("pricing", (rows) => {
    const i = rows.findIndex((r) => r.quoteId === id);
    if (i >= 0) rows[i] = p;
    else rows.push(p);
  });
  if (q.status === "approved" || q.status === "rejected") await setStatus(id, "ready_for_owner");
  await audit({
    actor,
    action: "pricing_set",
    ref: id,
    detail: { version: p.version, before: before ? { total: before.total, lines: before.lines, decision: before.decision } : null, after: { total: p.total, lines: p.lines } },
  });
  return p;
}

async function setStatus(id: string, status: QuoteStatus) {
  await mutate<QuoteRequest, void>("quotes", (rows) => {
    const r = rows.find((x) => x.id === id);
    if (r) Object.assign(r, { status, updatedAt: now() });
  });
}

export async function decide(id: string, decision: "approved" | "rejected", actor: Actor, reason?: string) {
  assertOwner(actor);
  const q = await getQuote(id);
  if (!q) throw new AuthError(404, "not found");
  const p = await getPricing(id, actor);
  if (decision === "approved" && !p) throw new AuthError(409, "أدخل الأسعار أولاً");
  if (p)
    await mutate<Pricing, void>("pricing", (rows) => {
      const r = rows.find((x) => x.quoteId === id);
      if (r) Object.assign(r, { decision, decidedAt: now() });
    });
  await setStatus(id, decision);
  await audit({ actor, action: decision === "approved" ? "pricing_approved" : "pricing_rejected", ref: id, detail: { version: p?.version, total: p?.total, reason: str(reason, 500) } });
  return getPricing(id, actor);
}

export async function sendQuote(id: string, actor: Actor) {
  assertOwner(actor);
  const p = await getPricing(id, actor);
  if (!p || p.decision !== "approved") throw new AuthError(409, "يجب أن يعتمد المالك العرض قبل إرساله");
  const { quoteId: _q, internalNote: _n, decision: _d, updatedAt: _u, decidedAt: _a, sent: _s, ...snap } = p;
  const sent = { ...snap, sentAt: now() };
  await mutate<Pricing, void>("pricing", (rows) => {
    const r = rows.find((x) => x.quoteId === id);
    if (r) r.sent = sent;
  });
  await setStatus(id, "sent");
  await audit({ actor, action: "quote_sent", ref: id, detail: { version: sent.version, total: sent.total } });
  await logActivity({ module: "quotes", kind: "quote_sent", text: `أُرسل عرض السعر للعميل`, ref: id });
  return sent;
}

// ---------- customer (private link key) ----------
export async function customerQuote(id: string, key: string | null) {
  const q = await getQuote(id);
  if (!q || !key || !safeEqual(hashKey(key), q.customerKeyHash)) return null;
  const visible = ["sent", "accepted", "declined"].includes(q.status);
  const sent = visible ? (await all<Pricing>("pricing")).find((p) => p.quoteId === id)?.sent ?? null : null;
  return {
    id: q.id,
    status: visible ? q.status : "under_review",
    statusLabel: visible ? QUOTE_STATUS[q.status] : q.status === "needs_info" ? QUOTE_STATUS.needs_info : "قيد المراجعة",
    missingInfo: q.status === "needs_info" ? q.missingInfo : [],
    details: q.details,
    files: q.files.map((f) => ({ name: f.name, size: f.size })),
    quotation: sent, // null until the owner approves AND sends
    customerResponse: q.customerResponse,
  };
}

export async function customerRespond(id: string, key: string | null, decision: unknown, note?: unknown) {
  const view = await customerQuote(id, key);
  if (!view) throw new AuthError(404, "not found");
  if (view.status !== "sent") throw new AuthError(409, "لا يوجد عرض بانتظار ردك");
  if (decision !== "accepted" && decision !== "declined") throw new AuthError(400, "decision must be accepted | declined");
  await mutate<QuoteRequest, void>("quotes", (rows) => {
    const r = rows.find((x) => x.id === id);
    if (r) Object.assign(r, { status: decision, customerResponse: { at: now(), decision, note: str(note, 1000) }, updatedAt: now() });
  });
  await audit({ actor: { role: "anonymous", id: "customer" }, action: "customer_response", ref: id, detail: { decision } });
  await logActivity({ module: "quotes", kind: "customer_response", text: decision === "accepted" ? "العميل قبل عرض السعر" : "العميل رفض عرض السعر", ref: id });
}
