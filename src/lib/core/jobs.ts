/**
 * Background Job Queue on Postgres (no extra infrastructure).
 * Claiming uses SELECT … FOR UPDATE SKIP LOCKED, so several workers never take the same job.
 * Failures retry with exponential backoff + jitter; permanent errors or too many attempts → 'dead' + a notification.
 */
import type { Job, Prisma, PrismaClient } from '@prisma/client';
import { HxError, redact, safeError } from './errors';
import { backoffMs } from './retry';
import { notify } from './notifications';

export type JobContext = { db: PrismaClient; job: Job };
export type Handler = (payload: Prisma.JsonValue, ctx: JobContext) => Promise<Prisma.InputJsonValue | void>;
export type Handlers = Record<string, Handler>;

export async function enqueue(db: PrismaClient, type: string, payload: Prisma.InputJsonValue, o: { runAt?: Date; maxAttempts?: number; priority?: number; idempotencyKey?: string } = {}) {
  if (!/^[a-z0-9_.:-]{3,64}$/.test(type)) throw new HxError('invalid_input', 'invalid job type');
  const data = { type, payload, runAt: o.runAt ?? new Date(), maxAttempts: o.maxAttempts ?? 5, priority: o.priority ?? 0, idempotencyKey: o.idempotencyKey ?? null };
  if (!o.idempotencyKey) return db.job.create({ data });
  // same idempotency key → the existing job is returned, nothing is queued twice
  return db.job.upsert({ where: { idempotencyKey: o.idempotencyKey }, create: data, update: {} });
}

export async function claim(db: PrismaClient, workerId: string, types?: string[]): Promise<Job | null> {
  const rows = types?.length
    ? await db.$queryRaw<Job[]>`UPDATE "Job" SET status = 'running'::"JobStatus", "lockedAt" = now(), "lockedBy" = ${workerId}, attempts = attempts + 1, "updatedAt" = now()
        WHERE id = (SELECT id FROM "Job" WHERE status IN ('queued'::"JobStatus", 'failed'::"JobStatus") AND "runAt" <= now() AND type = ANY(${types}::text[])
                    ORDER BY priority DESC, "runAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`
    : await db.$queryRaw<Job[]>`UPDATE "Job" SET status = 'running'::"JobStatus", "lockedAt" = now(), "lockedBy" = ${workerId}, attempts = attempts + 1, "updatedAt" = now()
        WHERE id = (SELECT id FROM "Job" WHERE status IN ('queued'::"JobStatus", 'failed'::"JobStatus") AND "runAt" <= now()
                    ORDER BY priority DESC, "runAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`;
  return rows[0] ?? null;
}

async function markDead(db: PrismaClient, job: Job, error: string) {
  await db.job.update({ where: { id: job.id }, data: { status: 'dead', lastError: error, lockedAt: null, lockedBy: null, finishedAt: new Date() } });
  await notify(db, { level: 'error', source: 'jobs', title: `Job failed permanently: ${job.type}`, body: error, actionRequired: true, dedupeKey: `job.dead:${job.type}` });
}

/** Runs one job. Returns what happened (useful for tests and the worker log). */
export async function runOne(db: PrismaClient, handlers: Handlers, workerId = 'worker', types?: string[]): Promise<null | { id: string; type: string; outcome: 'succeeded' | 'retry' | 'dead' }> {
  const job = await claim(db, workerId, types); if (!job) return null;
  const h = handlers[job.type];
  if (!h) { await markDead(db, job, `no handler registered for "${job.type}"`); return { id: job.id, type: job.type, outcome: 'dead' }; }
  try {
    const result = await h(job.payload, { db, job });
    await db.job.update({ where: { id: job.id }, data: { status: 'succeeded', result: (result ?? undefined) as Prisma.InputJsonValue | undefined, lastError: null, lockedAt: null, lockedBy: null, finishedAt: new Date() } });
    return { id: job.id, type: job.type, outcome: 'succeeded' };
  } catch (e) {
    const msg = redact(`${safeError(e).code}: ${safeError(e).message}`);
    const permanent = e instanceof HxError && !e.retryable;
    if (permanent || job.attempts >= job.maxAttempts) { await markDead(db, job, msg); return { id: job.id, type: job.type, outcome: 'dead' }; }
    await db.job.update({ where: { id: job.id }, data: { status: 'failed', lastError: msg, lockedAt: null, lockedBy: null, runAt: new Date(Date.now() + backoffMs(job.attempts, 2000, 15 * 60_000)) } });
    return { id: job.id, type: job.type, outcome: 'retry' };
  }
}

/** Jobs stuck in 'running' (worker crashed) are handed back to the queue. */
export async function recoverStale(db: PrismaClient, olderThanMs = 10 * 60_000) {
  const r = await db.job.updateMany({ where: { status: 'running', lockedAt: { lt: new Date(Date.now() - olderThanMs) } }, data: { status: 'failed', lockedAt: null, lockedBy: null, lastError: 'worker lost (stale lock recovered)', runAt: new Date() } });
  return r.count;
}

export async function retryDead(db: PrismaClient, id: string) {
  return db.job.update({ where: { id }, data: { status: 'queued', attempts: 0, runAt: new Date(), lastError: null, finishedAt: null } });
}
export async function cancel(db: PrismaClient, id: string) {
  return db.job.updateMany({ where: { id, status: { in: ['queued', 'failed', 'dead'] } }, data: { status: 'cancelled', finishedAt: new Date() } });
}
export async function queueStats(db: PrismaClient) {
  const g = await db.job.groupBy({ by: ['status'], _count: { _all: true } });
  const by = Object.fromEntries(g.map((r) => [r.status, r._count._all])) as Partial<Record<Job['status'], number>>;
  const oldest = await db.job.findFirst({ where: { status: { in: ['queued', 'failed'] }, runAt: { lte: new Date() } }, orderBy: { runAt: 'asc' }, select: { runAt: true } });
  return { queued: by.queued ?? 0, running: by.running ?? 0, failed: by.failed ?? 0, dead: by.dead ?? 0, succeeded: by.succeeded ?? 0, cancelled: by.cancelled ?? 0,
    oldestWaitingSec: oldest ? Math.max(0, Math.round((Date.now() - oldest.runAt.getTime()) / 1000)) : 0 };
}
