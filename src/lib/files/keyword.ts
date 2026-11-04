import { normalizeKeyword } from './validate';

/** Same cleanup for text and keywords: punctuation becomes a space, so "test-guide" equals "test guide". */
const clean = (s: string) => normalizeKeyword(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

/** Finds which deliverable keywords appear as whole words in a comment or message. Used only to draft replies. */
export function matchKeywords(text: string, keywords: string[]): string[] {
  const norm = ' ' + clean(text) + ' ';
  return keywords.filter((k) => {
    const nk = clean(k);
    return nk.length > 0 && norm.includes(' ' + nk + ' ');
  });
}
