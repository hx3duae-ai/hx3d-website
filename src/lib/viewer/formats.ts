/** Format detection from real file content (magic bytes), not just the extension. */
export type ModelFormat = 'stl' | 'obj' | 'glb' | 'gltf' | 'ply' | '3mf';
export type ImageFormat = 'png' | 'jpg' | 'webp';
export type Detected = { kind: 'model'; format: ModelFormat } | { kind: 'image'; format: ImageFormat } | { kind: 'unsupported'; reason: string };

export const MAX_MODEL_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TRIANGLES = 2_000_000;

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
const ext = (name: string) => name.toLowerCase().split('.').pop() ?? '';

export function detectFormat(name: string, head: Uint8Array, totalSize: number): Detected {
  const e = ext(name);
  if (head.length >= 8 && head[0] === 0x89 && ascii(head, 1, 4) === 'PNG') return { kind: 'image', format: 'png' };
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { kind: 'image', format: 'jpg' };
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return { kind: 'image', format: 'webp' };
  if (ascii(head, 0, 4) === 'glTF') return { kind: 'model', format: 'glb' };
  if (ascii(head, 0, 3) === 'ply') return { kind: 'model', format: 'ply' };
  if (head[0] === 0x50 && head[1] === 0x4b) return e === '3mf' ? { kind: 'model', format: '3mf' } : { kind: 'unsupported', reason: 'zip-not-3mf' };
  const text = ascii(head, 0, Math.min(head.length, 512)).trimStart();
  if (e === 'gltf' && text.startsWith('{')) return { kind: 'model', format: 'gltf' };
  if (e === 'stl') {
    // Binary STL: 80-byte header + uint32 count + 50 bytes/triangle must equal file size exactly.
    if (head.length >= 84) {
      const n = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(80, true);
      if (84 + n * 50 === totalSize) return { kind: 'model', format: 'stl' };
    }
    if (text.toLowerCase().startsWith('solid')) return { kind: 'model', format: 'stl' };
    return { kind: 'unsupported', reason: 'corrupt-stl' };
  }
  if (e === 'obj' && /^(#|v |vn |vt |o |g |mtllib|usemtl|f |s )/m.test(text)) return { kind: 'model', format: 'obj' };
  return { kind: 'unsupported', reason: 'unknown' };
}

export const ACCEPT = '.stl,.3mf,.obj,.glb,.gltf,.ply,.png,.jpg,.jpeg,.webp';
