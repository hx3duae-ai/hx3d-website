/**
 * HX background worker: `npm run worker`. Runs next to the web server (same DATABASE_URL).
 * Safe to run several copies: jobs are claimed with SKIP LOCKED.
 */
import { PrismaClient } from '@prisma/client';
import { hostname } from 'node:os';
import { runOne, recoverStale, enqueue } from '../src/lib/core/jobs';
import { coreHandlers } from '../src/lib/core/handlers';

const db = new PrismaClient();
const id = `${hostname()}:${process.pid}`;
const handlers = { ...coreHandlers };
let stop = false;
process.on('SIGINT', () => { stop = true; }); process.on('SIGTERM', () => { stop = true; });

async function main() {
  console.log(`[worker ${id}] started; handlers: ${Object.keys(handlers).join(', ')}`);
  let lastHousekeeping = 0;
  while (!stop) {
    if (Date.now() - lastHousekeeping > 60_000) {
      lastHousekeeping = Date.now();
      const n = await recoverStale(db); if (n) console.log(`[worker] recovered ${n} stale job(s)`);
      const slot = Math.floor(Date.now() / (15 * 60_000));               // one health check per 15 minutes, cluster-wide
      await enqueue(db, 'core.health', {}, { idempotencyKey: `core.health:${slot}`, maxAttempts: 1 });
    }
    const r = await runOne(db, handlers, id).catch((e) => { console.error('[worker] loop error', (e as Error).message); return null; });
    if (r) console.log(`[worker] ${r.type} ${r.id} → ${r.outcome}`);
    else await new Promise((res) => setTimeout(res, 1000));
  }
  await db.$disconnect(); console.log('[worker] stopped');
}
main();
