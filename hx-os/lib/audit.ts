// Append-only audit log for pricing and permission events (data/audit.json).
// There is deliberately no API to edit or delete entries; only the owner can read it.
import { all, mutate, newId, now } from "./db";
import type { Actor } from "./auth";

export type AuditEntry = {
  id: string;
  at: string;
  actor: Actor;
  action:
    | "quote_created"
    | "quote_updated"
    | "quote_status"
    | "quote_file_added"
    | "pricing_set"
    | "pricing_approved"
    | "pricing_rejected"
    | "quote_sent"
    | "customer_response"
    | "crm_price_set"
    | "denied";
  ref?: string;
  detail?: Record<string, unknown>;
};

export function audit(e: Omit<AuditEntry, "id" | "at">) {
  return mutate<AuditEntry, void>("audit", (rows) => void rows.push({ id: newId("aud"), at: now(), ...e }));
}

export async function auditFor(ref?: string) {
  const rows = await all<AuditEntry>("audit");
  return (ref ? rows.filter((r) => r.ref === ref) : rows).slice().reverse();
}
