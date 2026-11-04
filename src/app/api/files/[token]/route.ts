import { prisma } from '@/lib/db';
import { consumeGrant, readStored } from '@/lib/core/storage';
import { recordActivity } from '@/lib/core/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const notFound = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const g = await consumeGrant(prisma, token);
  if (!g) return notFound();                                    // expired, revoked, used up, unknown: same answer
  let buf: Buffer;
  try { buf = await readStored(g.file); } catch { return notFound(); }
  await recordActivity(prisma, { system: 'core', type: 'file.downloaded', contactId: g.contactId, meta: { fileId: g.fileId, grantId: g.id } });
  const ascii = g.file.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return new Response(new Uint8Array(buf), { headers: {
    'content-type': g.file.mime, 'content-length': String(buf.length), 'cache-control': 'no-store, private', 'x-robots-tag': 'noindex',
    'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(g.file.name)}`,
  } });
}
