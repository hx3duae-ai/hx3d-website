import { detectFormat } from '@/lib/viewer/formats';

export const MAX_DELIVERABLE_BYTES = 50 * 1024 * 1024;
export type FileKind = 'model' | 'image' | 'pdf';
export type Checked = { ok: true; kind: FileKind; mime: string } | { ok: false; reason: 'too_large' | 'empty' | 'type' };

const MIME: Record<string, string> = {
  stl: 'model/stl', '3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml', obj: 'model/obj', glb: 'model/gltf-binary',
  gltf: 'model/gltf+json', ply: 'application/octet-stream', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf',
};

/** Decides from the file's real bytes, never from its name alone. */
export function checkDeliverable(name: string, head: Uint8Array, size: number): Checked {
  if (size <= 0) return { ok: false, reason: 'empty' };
  if (size > MAX_DELIVERABLE_BYTES) return { ok: false, reason: 'too_large' };
  if (head.length >= 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return { ok: true, kind: 'pdf', mime: MIME.pdf };
  const d = detectFormat(name, head, size);
  if (d.kind === 'model') return { ok: true, kind: 'model', mime: MIME[d.format] };
  if (d.kind === 'image') return { ok: true, kind: 'image', mime: MIME[d.format] };
  return { ok: false, reason: 'type' };
}

/** Keyword normalisation: case-insensitive, Arabic letter variants folded, diacritics removed. */
export function normalizeKeyword(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase()
    .replace(/[ً-ٰٟ]/g, '')          // tashkeel
    .replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}
