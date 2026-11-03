import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { detectFormat } from '@/lib/viewer/formats';
const fx = (n: string) => { const p = `tests/fixtures/${n}`; return detectFormat(n, new Uint8Array(readFileSync(p)).subarray(0, 1024), statSync(p).size); };
describe('detectFormat (real files)', () => {
  it.each([['cube.stl', 'stl'], ['two_parts.obj', 'obj'], ['cube.ply', 'ply'], ['cube.glb', 'glb'], ['two_parts.3mf', '3mf']])('%s -> %s', (f, fmt) => expect(fx(f)).toEqual({ kind: 'model', format: fmt }));
  it('detects PNG by content', () => expect(fx('pic.png')).toEqual({ kind: 'image', format: 'png' }));
  it('rejects a text file renamed .stl', () => expect(fx('fake.stl').kind).toBe('unsupported'));
  it('rejects a truncated binary STL', () => expect(fx('corrupt.stl').kind).toBe('unsupported'));
  it('does not trust the extension: PNG bytes named .stl are an image', () => {
    expect(detectFormat('x.stl', new Uint8Array(readFileSync('tests/fixtures/pic.png')), 100)).toEqual({ kind: 'image', format: 'png' });
  });
});
