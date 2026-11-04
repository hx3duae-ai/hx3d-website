import type { PrismaClient } from '@prisma/client';
import { matchKeywords } from '@/lib/files/keyword';

type Db = PrismaClient;
export type Ingest = { created: number; duplicates: number; matched: number };

/** Turns inbound events into pending drafts. Only keyword matches create a draft; duplicates are skipped by message id. */
export async function ingestEvents(db: Db, events: { channel: string; senderRef: string; text: string; mid: string }[]): Promise<Ingest> {
  const files = await db.deliverableFile.findMany({ where: { active: true }, select: { id: true, keyword: true, title: true } });
  const result: Ingest = { created: 0, duplicates: 0, matched: 0 };
  for (const ev of events) {
    const hits = matchKeywords(ev.text, files.map((f) => f.keyword));
    if (hits.length === 0) continue;
    result.matched++;
    const file = files.find((f) => f.keyword === hits[0])!;
    try {
      await db.replyDraft.create({ data: {
        channel: ev.channel, senderRef: ev.senderRef.slice(0, 64), inboundText: ev.text.slice(0, 300), inboundMid: ev.mid,
        keyword: hits[0], fileId: file.id,
        draftText: `أهلاً، تفضّل الملف (${file.title}): {LINK}`,
      } });
      result.created++;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') { result.duplicates++; continue; }
      throw e;
    }
  }
  return result;
}
