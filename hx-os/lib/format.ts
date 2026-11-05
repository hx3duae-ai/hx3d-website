export const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(n) + " د.إ";

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
export const shortDate = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("ar-AE-u-nu-latn", { day: "numeric", month: "short", timeZone: "Asia/Dubai" }).format(new Date(iso)) : "—";
export const dateTime = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat("ar-AE-u-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dubai" }).format(new Date(iso))
    : "—";

/** Money for display; `locked` → owner-only placeholder. */
export const money = (n: number, locked?: boolean) => (locked ? "🔒 للمالك" : aed(n));
