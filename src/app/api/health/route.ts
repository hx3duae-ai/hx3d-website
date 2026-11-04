import { prisma } from '@/lib/db';
import { dbHealth } from '@/lib/core/health';

export const dynamic = 'force-dynamic';
/** Public liveness probe: says only whether the app and its database answer. Details are in the admin area. */
export async function GET() {
  const d = await dbHealth(prisma);
  return Response.json({ ok: d.ok, db: d.ok ? 'ok' : 'down' }, { status: d.ok ? 200 : 503, headers: { 'cache-control': 'no-store' } });
}
