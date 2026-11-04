import { matchKeywords } from '@/lib/files/keyword';
import { normalizeKeyword } from '@/lib/files/validate';

export type Candidate = { id: string; keyword: string; mediaId: string | null };
export type Routed =
  | { status: 'pending'; fileId: string; keyword: string }
  | { status: 'needs_choice'; candidateIds: string[]; keyword: string }
  | { status: 'needs_mapping'; keyword: string }
  | { status: 'none' };

/**
 * Decides which file a message gets.
 * - Comment on a known reel: that reel's file for the keyword; else the general file for the keyword.
 * - Comment on a reel with no file for the keyword: needs_mapping (admin attaches a file to that reel).
 * - Direct message or comment without a reel id: one candidate -> pending; several -> needs_choice.
 */
export function route(ev: { text: string; mediaId?: string | null }, files: Candidate[]): Routed {
  const keywords = [...new Set(files.map((f) => normalizeKeyword(f.keyword)))];
  const hits = matchKeywords(ev.text, keywords);
  if (hits.length === 0) return { status: 'none' };
  const normHit = hits[0];
  const fl = files.filter((f) => normalizeKeyword(f.keyword) === normHit);
  const keyword = fl[0].keyword; // report the keyword as stored, not normalised
  if (ev.mediaId) {
    const specific = fl.find((f) => f.mediaId === ev.mediaId);
    if (specific) return { status: 'pending', fileId: specific.id, keyword };
    const general = fl.filter((f) => f.mediaId === null);
    if (general.length === 1) return { status: 'pending', fileId: general[0].id, keyword };
    return { status: 'needs_mapping', keyword };
  }
  if (fl.length === 1) return { status: 'pending', fileId: fl[0].id, keyword };
  return { status: 'needs_choice', candidateIds: fl.map((f) => f.id), keyword };
}
