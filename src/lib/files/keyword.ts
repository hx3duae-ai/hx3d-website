import { normalizeKeyword } from './validate';

/** Finds which deliverable keywords appear as whole words in a comment or message. Used only to draft replies. */
export function matchKeywords(text: string, keywords: string[]): string[] {
  const norm = ' ' + normalizeKeyword(text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
  return keywords.filter((k) => {
    const nk = normalizeKeyword(k);
    return nk.length > 0 && norm.includes(' ' + nk + ' ');
  });
}
