import { prisma } from '@/lib/db';
import { receiveWebhook, metaVerifyChallenge } from '@/lib/core/webhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  const raw = await req.text();                       // the signature covers the exact raw bytes
  const r = await receiveWebhook(prisma, source, raw, req.headers);
  return new Response(r.body, { status: r.status, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}

export async function GET(req: Request, { params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  if (source !== 'meta') return new Response('not found', { status: 404 });
  const r = await metaVerifyChallenge(prisma, new URL(req.url).searchParams);
  return new Response(r.body, { status: r.status, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}
