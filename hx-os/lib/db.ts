// Local JSON store shared by every HX OS module.
// One file per collection in data/ — easy to back up, read, and index later
// by the Second Brain. Writes are serialized per collection and atomic
// (write to temp file, then rename), so a crash never leaves half a file.
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const DATA_DIR = process.env.HX_DATA_DIR || path.join(process.cwd(), "data");
export const MEDIA_DIR = path.join(DATA_DIR, "media");

export type Collection = "ideas" | "clients" | "activity" | "settings" | "posts" | "metrics";

const queues = new Map<string, Promise<unknown>>();

function file(c: Collection) {
  return path.join(DATA_DIR, `${c}.json`);
}

async function readRaw<T>(c: Collection): Promise<T[]> {
  try {
    const txt = await fs.readFile(file(c), "utf8");
    return JSON.parse(txt) as T[];
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeRaw<T>(c: Collection, rows: T[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file(c)}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
  await fs.rename(tmp, file(c));
}

/** Read-modify-write under a per-collection lock. */
export function mutate<T, R>(c: Collection, fn: (rows: T[]) => R | Promise<R>): Promise<R> {
  const prev = queues.get(c) ?? Promise.resolve();
  const next = prev.then(async () => {
    const rows = await readRaw<T>(c);
    const result = await fn(rows);
    await writeRaw(c, rows);
    return result;
  });
  queues.set(c, next.catch(() => undefined));
  return next;
}

export async function all<T>(c: Collection): Promise<T[]> {
  await (queues.get(c) ?? Promise.resolve());
  return readRaw<T>(c);
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function now() {
  return new Date().toISOString();
}

/** Today's date in Dubai (UTC+4), YYYY-MM-DD. */
export function dubaiDate(d = new Date()) {
  return new Date(d.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
}

// ---- Shared activity log: every module writes here; the Second Brain will index it.
export type Activity = {
  id: string;
  at: string;
  module: "content" | "crm" | "instagram" | "builder" | "video" | "hunter" | "brain";
  kind: string;
  text: string;
  ref?: string;
};

export function logActivity(a: Omit<Activity, "id" | "at">) {
  return mutate<Activity, void>("activity", (rows) => {
    rows.unshift({ id: newId("act"), at: now(), ...a });
    if (rows.length > 2000) rows.length = 2000;
  });
}
