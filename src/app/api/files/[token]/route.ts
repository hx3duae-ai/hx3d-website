import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redeem } from '@/lib/files/links';
import { readDeliverable } from '@/lib/files/storage';

export const dynamic = 'force-dynamic';

const FAIL: Record<string, [number, string]> = {
  not_found: [404, 'Link not found.'], expired: [410, 'This link has expired.'], revoked: [410, 'This link was cancelled.'],
  used_up: [410, 'This link has reached its download limit.'], file_inactive: [404, 'File not available.'],
};

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
  const r = await redeem(prisma, token);
  if (!r.ok) { const [status, msg] = FAIL[r.reason]; return NextResponse.json({ error: msg }, { status }); }
  const { storageName, originalName, mime, size } = r;
  const sha = (await prisma.deliverableFile.findUnique({ where: { storageName }, select: { sha256: true } }))?.sha256;
  const buf = sha ? await readDeliverable(storageName, sha) : null;
  if (!buf) return NextResponse.json({ error: 'File unavailable.' }, { status: 500 });
  const safeName = originalName.replace(/[^A-Za-z0-9._-]/g, '_');
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': mime, 'Content-Length': String(size),
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer',
    },
  });
}
