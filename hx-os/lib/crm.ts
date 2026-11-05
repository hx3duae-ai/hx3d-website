import { all, dubaiDate, logActivity, mutate, newId, now } from "./db";

export * from "./crm-types";
import { CLIENT_STATUS, ORDER_TYPES, type Client, type ClientStatus, type MonthStat, type OrderType } from "./crm-types";

export async function listClients() {
  const rows = await all<Client>("clients");
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function sanitize(input: Record<string, unknown>): Partial<Client> {
  const out: Partial<Client> = {};
  const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string).trim().slice(0, 2000) : undefined);
  for (const k of ["name", "company", "phone", "email", "notes"] as const) {
    if (k in input) out[k] = s(k) ?? "";
  }
  if ("orderType" in input && (input.orderType as string) in ORDER_TYPES) out.orderType = input.orderType as OrderType;
  if ("status" in input && (input.status as string) in CLIENT_STATUS) out.status = input.status as ClientStatus;
  if (typeof input.source === "string" && ["manual", "calcom", "instagram", "whatsapp", "referral"].includes(input.source))
    out.source = input.source as Client["source"];
  if ("price" in input) {
    const p = Number(input.price);
    out.price = Number.isFinite(p) && p >= 0 ? Math.round(p * 100) / 100 : 0;
  }
  if ("deliveredAt" in input && typeof input.deliveredAt === "string" && !Number.isNaN(Date.parse(input.deliveredAt)))
    out.deliveredAt = new Date(input.deliveredAt).toISOString();
  return out;
}

export async function createClient(data: Partial<Client> & { source?: Client["source"] }) {
  const c: Client = {
    id: newId("cli"),
    name: data.name || "بدون اسم",
    company: data.company,
    phone: data.phone,
    email: data.email,
    orderType: data.orderType ?? "other",
    price: data.price ?? 0,
    status: data.status ?? "lead",
    source: data.source ?? "manual",
    notes: data.notes,
    bookingUid: data.bookingUid,
    bookingStart: data.bookingStart,
    createdAt: now(),
    updatedAt: now(),
  };
  if (c.status === "delivered") c.deliveredAt = data.deliveredAt ?? now();
  await mutate<Client, void>("clients", (rows) => void rows.push(c));
  await logActivity({ module: "crm", kind: "client_created", text: `عميل جديد: ${c.name} (${ORDER_TYPES[c.orderType].label})`, ref: c.id });
  return c;
}

export async function updateClient(id: string, patch: Partial<Client>) {
  const res = await mutate<Client, { c: Client; was: ClientStatus } | null>("clients", (rows) => {
    const c = rows.find((r) => r.id === id);
    if (!c) return null;
    const was = c.status;
    Object.assign(c, patch, { updatedAt: now() });
    if (c.status === "delivered" && !c.deliveredAt) c.deliveredAt = now();
    if (c.status !== "delivered" && !patch.deliveredAt) delete c.deliveredAt;
    return { c, was };
  });
  if (res && res.was !== res.c.status)
    await logActivity({ module: "crm", kind: "status", text: `${res.c.name}: ${CLIENT_STATUS[res.was]} ← ${CLIENT_STATUS[res.c.status]}`, ref: id });
  return res?.c ?? null;
}

export async function deleteClient(id: string) {
  return mutate<Client, boolean>("clients", (rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  });
}

/** Insert a Cal.com booking as a lead unless we already have it. */
export async function upsertBooking(b: {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  start?: string;
  notes?: string;
  cancelled?: boolean;
}) {
  const res = await mutate<Client, "created" | "updated" | "skipped">("clients", (rows) => {
    const existing = rows.find((r) => r.bookingUid === b.uid);
    if (existing) {
      if (b.cancelled) {
        existing.notes = `${existing.notes ? existing.notes + "\n" : ""}⚠️ الحجز ألغي (${dubaiDate()})`;
        existing.updatedAt = now();
        return "updated";
      }
      if (b.start && existing.bookingStart !== b.start) {
        existing.bookingStart = b.start;
        existing.updatedAt = now();
        return "updated";
      }
      return "skipped";
    }
    if (b.cancelled) return "skipped";
    rows.push({
      id: newId("cli"),
      name: b.name || b.email || "حجز Cal.com",
      email: b.email,
      phone: b.phone,
      orderType: guessOrderType(`${b.title ?? ""} ${b.notes ?? ""}`),
      price: 0,
      status: "lead",
      source: "calcom",
      notes: [b.title, b.notes].filter(Boolean).join("\n"),
      bookingUid: b.uid,
      bookingStart: b.start,
      createdAt: now(),
      updatedAt: now(),
    });
    return "created";
  });
  if (res === "created") await logActivity({ module: "crm", kind: "booking", text: `حجز جديد من Cal.com: ${b.name}`, ref: b.uid });
  return res;
}

export function guessOrderType(text: string): OrderType {
  const t = text.toLowerCase();
  if (/gift|هدي|award|جائز|درع|trophy/.test(t)) return "corporate_gift";
  if (/archi|model|مجسم|ماكيت|عقار|villa|فيلا|برج|tower/.test(t)) return "architectural_model";
  if (/prototype|نموذج/.test(t)) return "prototype";
  if (/event|فعالي|معرض|expo/.test(t)) return "event";
  if (/product|منتج/.test(t)) return "product";
  return "other";
}

// ---------- stats ----------
export function monthlyStats(rows: Client[], months = 12) {
  const byMonth = new Map<string, MonthStat>();
  const today = dubaiDate();
  // last N months including the current one, oldest first
  const [y, m] = today.split("-").map(Number);
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  for (const k of keys) byMonth.set(k, { month: k, sales: 0, orders: 0 });
  for (const c of rows) {
    if (c.status !== "delivered" || !c.deliveredAt) continue;
    const k = dubaiDate(new Date(c.deliveredAt)).slice(0, 7);
    const s = byMonth.get(k);
    if (s) {
      s.sales += c.price;
      s.orders += 1;
    }
  }
  const current = byMonth.get(keys[keys.length - 1])!;
  const previous = byMonth.get(keys[keys.length - 2])!;
  const pipeline = rows.filter((c) => c.status === "in_progress").reduce((a, c) => a + c.price, 0);
  const leads = rows.filter((c) => c.status === "lead").length;
  return { months: keys.map((k) => byMonth.get(k)!), current, previous, pipeline, leads };
}
