import type { PrismaClient } from '@prisma/client';
import { route, type Candidate } from './route';

type Db = PrismaClient;
export type Ingest = { created: number; duplicates: number; matched: number };
export type InboundForRouting = { channel: string; senderRef: string; text: string; mid: string; mediaId?: string | null };

/** Turns inbound events into drafts. Duplicates are skipped by message id. Nothing is sent here. */
export async function ingestEvents(db: Db, events: InboundForRouting[]): Promise<Ingest> {
  const files = await db.deliverableFile.findMany({ where: { active: true }, select: { id: true, keyword: true, mediaId: true, title: true, kind: true, url: true } });
  const cands: Candidate[] = files.map((f) => ({ id: f.id, keyword: f.keyword, mediaId: f.mediaId }));
  const byId = new Map(files.map((f) => [f.id, f]));
  const result: Ingest = { created: 0, duplicates: 0, matched: 0 };
  for (const ev of events) {
    const r = route({ text: ev.text, mediaId: ev.mediaId ?? null }, cands);
    if (r.status === 'none') continue;
    result.matched++;
    const base = { channel: ev.channel, senderRef: ev.senderRef.slice(0, 64), inboundText: ev.text.slice(0, 300), inboundMid: ev.mid, mediaId: ev.mediaId ?? null };
    let data;
    if (r.status === 'pending') {
      const f = byId.get(r.fileId)!;
      data = { ...base, keyword: r.keyword, fileId: f.id,
        // Links are public and sent as-is. Files get a one-time link only when an admin approves.
        draftText: f.kind === 'link' ? `أهلاً، تفضّل (${f.title}): ${f.url}` : `أهلاً، تفضّل الملف (${f.title}): {LINK}`, status: 'pending' };
    } else if (r.status === 'needs_choice') {
      data = { ...base, keyword: r.keyword, fileId: null, draftText: '', status: 'needs_choice', candidateIds: JSON.stringify(r.candidateIds) };
    } else {
      data = { ...base, keyword: r.keyword, fileId: null, draftText: '', status: 'needs_mapping' };
    }
    try {
      await db.replyDraft.create({ data });
      result.created++;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') { result.duplicates++; continue; }
      throw e;
    }
  }
  return result;
}
