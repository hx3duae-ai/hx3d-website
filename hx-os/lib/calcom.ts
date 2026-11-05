// Cal.com integration — two ways in, same dedupe key (booking uid):
//  1. Webhook  POST /api/webhooks/calcom   (needs a public URL: tunnel or deploy)
//  2. Pull     POST /api/crm/calcom/sync   (works on localhost with CAL_API_KEY)
import crypto from "node:crypto";
import { upsertBooking } from "./crm";

type Attendee = { name?: string; email?: string; phoneNumber?: string };

export function verifySignature(raw: string, signature: string | null) {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) return true; // not configured: accept (local testing). Set a secret before exposing the app.
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Webhook body: { triggerEvent, createdAt, payload: {...booking} } */
export async function handleWebhook(body: Record<string, unknown>) {
  const event = String(body.triggerEvent ?? "");
  const p = (body.payload ?? {}) as Record<string, unknown>;
  if (event === "PING") return "ping";
  const uid = String(p.uid ?? p.bookingId ?? "");
  if (!uid) return "ignored";
  const attendees = (p.attendees as Attendee[] | undefined) ?? [];
  const responses = (p.responses ?? {}) as Record<string, unknown>;
  const r = (k: string) => {
    const v = responses[k] as unknown;
    if (v && typeof v === "object" && "value" in (v as object)) return String((v as { value: unknown }).value ?? "");
    return typeof v === "string" ? v : undefined;
  };
  const a = attendees[0] ?? {};
  return upsertBooking({
    uid,
    name: a.name || r("name") || "",
    email: a.email || r("email"),
    phone: a.phoneNumber || r("attendeePhoneNumber") || r("phone"),
    title: String(p.title ?? p.eventTitle ?? ""),
    start: typeof p.startTime === "string" ? p.startTime : undefined,
    notes: (p.description as string) || r("notes") || undefined,
    cancelled: event === "BOOKING_CANCELLED" || event === "BOOKING_REJECTED",
  });
}

/** Pull bookings via Cal.com / Cal.diy API v2. Set CAL_API_URL for a self-hosted Cal.diy. */
export async function syncFromApi() {
  const key = process.env.CAL_API_KEY;
  if (!key) throw new Error("CAL_API_KEY غير موجود في .env.local");
  const counts = { created: 0, updated: 0, skipped: 0 };
  for (const status of ["upcoming", "past"]) {
    const base = (process.env.CAL_API_URL || "https://api.cal.com").replace(/\/$/, "");
    const url = `${base}/v2/bookings?status=${status}&take=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, "cal-api-version": "2024-08-13" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Cal.com ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    for (const b of json.data ?? []) {
      const attendees = (b.attendees as Attendee[] | undefined) ?? [];
      const a = attendees[0] ?? {};
      const r = await upsertBooking({
        uid: String(b.uid ?? b.id),
        name: a.name ?? "",
        email: a.email,
        phone: a.phoneNumber,
        title: String(b.title ?? ""),
        start: (b.start as string) ?? (b.startTime as string),
        notes: (b.description as string) || undefined,
        cancelled: b.status === "cancelled" || b.status === "rejected",
      });
      counts[r]++;
    }
  }
  return counts;
}
