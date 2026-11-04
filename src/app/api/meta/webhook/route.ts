import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySubscription, verifyMetaSignature, parseInbound } from '@/lib/meta/webhook';
import { ingestEvents } from '@/lib/meta/drafts';

export const dynamic = 'force-dynamic';

/** Meta's subscription handshake. */
export async function GET(req: Request) {
  const verifyToken = process.env.META_VERIFY_TOKEN ?? '';
  const challenge = verifySubscription(new URL(req.url).searchParams, verifyToken);
  if (!challenge) return new NextResponse('forbidden', { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

/** Incoming events. The signature is checked on the raw body before anything is parsed or stored. */
export async function POST(req: Request) {
  const secret = process.env.META_APP_SECRET ?? '';
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: 'too large' }, { status: 413 });
  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'), secret)) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const events = parseInbound(payload);
  const result = await ingestEvents(prisma, events);
  return NextResponse.json({ received: events.length, ...result }, { status: 200 });
}
