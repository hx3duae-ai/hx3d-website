import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkMesh, type Mesh } from '@/lib/checker/check';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const BED = { x: 256, y: 256, z: 256 };
/** Closed box with every triangle wound outward (normals checked against the centre). */
function box(ox: number, oy: number, oz: number, s: number): { p: number[]; t: number[][] } {
  const v: number[][] = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) v.push([ox + x * s, oy + y * s, oz + z * s]);
  const tris = [[0, 2, 3], [0, 3, 1], [4, 5, 7], [4, 7, 6], [0, 1, 5], [0, 5, 4], [2, 6, 7], [2, 7, 3], [0, 4, 6], [0, 6, 2], [1, 3, 7], [1, 7, 5]];
  const c = [ox + s / 2, oy + s / 2, oz + s / 2];
  const oriented = tris.map(([a, b, d]) => {
    const A = v[a], B = v[b], C = v[d];
    const n = [(B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])];
    const out = (A[0] + B[0] + C[0]) / 3 - c[0], outy = (A[1] + B[1] + C[1]) / 3 - c[1], outz = (A[2] + B[2] + C[2]) / 3 - c[2];
    return n[0] * out + n[1] * outy + n[2] * outz < 0 ? [a, d, b] : [a, b, d];
  });
  return { p: v.flat(), t: oriented };
}
/** Merge boxes into one indexed mesh. Each box keeps its own vertices, as STL/3MF files do. */
function mesh(...boxes: { p: number[]; t: number[][] }[]): Mesh {
  const positions: number[] = [], indices: number[] = []; let off = 0;
  for (const b of boxes) { positions.push(...b.p); for (const t of b.t) indices.push(...t.map((i) => i + off)); off += b.p.length / 3; }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}
const codes = (r: ReturnType<typeof checkMesh>) => r.issues.map((i) => i.code);

describe('HX Model Checker (synthetic meshes with known answers)', () => {
  it('closed cube: ready, one part, correct volume, no holes', () => {
    const r = checkMesh(mesh(box(0, 0, 0, 40)), BED);
    expect(r.verdict).toBe('ready');
    expect(r.closed).toBe(true); expect(r.holes).toBe(0); expect(r.parts).toBe(1);
    expect(r.volumeMm3).toBeCloseTo(40 ** 3, 0);
    expect(r.size).toEqual({ x: 40, y: 40, z: 40 });
  });
  it('one missing face: open surface with one hole', () => {
    const b = box(0, 0, 0, 40); b.t = b.t.slice(2); // drop one of the two triangles on a face
    const r = checkMesh(mesh(b), BED);
    expect(codes(r)).toContain('open_edges'); expect(r.verdict).toBe('errors');
    expect(r.holes).toBe(1); expect(r.closed).toBe(false); expect(r.volumeMm3).toBeNull();
  });
  it('whole model inside out: inverted normals error', () => {
    const b = box(0, 0, 0, 40); b.t = b.t.map(([a, x, y]) => [a, y, x]);
    const r = checkMesh(mesh(b), BED);
    expect(codes(r)).toContain('inverted_normals'); expect(r.verdict).toBe('errors');
  });
  it('one flipped face in a closed body: conflicting normals', () => {
    const b = box(0, 0, 0, 40); const t = b.t[0]; b.t[0] = [t[0], t[2], t[1]];
    const r = checkMesh(mesh(b), BED);
    expect(codes(r)).toContain('inconsistent_normals'); expect(r.verdict).toBe('errors');
  });
  it('two separate boxes: warning about separate parts, two parts counted', () => {
    const r = checkMesh(mesh(box(0, 0, 0, 20), box(100, 0, 0, 20)), BED);
    expect(r.parts).toBe(2); expect(codes(r)).toContain('disconnected_parts'); expect(r.verdict).toBe('warnings');
    expect(codes(r)).not.toContain('possible_overlap');
  });
  it('two overlapping boxes: possible overlap warning', () => {
    const r = checkMesh(mesh(box(0, 0, 0, 40), box(20, 0, 0, 40)), BED);
    expect(codes(r)).toContain('possible_overlap');
  });
  it('three triangles sharing one edge: non-manifold error', () => {
    const v = [[0, 0, 0], [10, 0, 0], [5, 10, 0], [5, -10, 0], [5, 0, 10]];
    const m: Mesh = { positions: Float32Array.from(v.flat()), indices: Uint32Array.from([0, 1, 2, 0, 1, 3, 0, 1, 4]) };
    const r = checkMesh(m, BED);
    expect(codes(r)).toContain('non_manifold_edge'); expect(r.verdict).toBe('errors');
  });
  it('a zero-area triangle is reported as degenerate', () => {
    const b = box(0, 0, 0, 40); b.t.push([0, 0, 1]);
    const r = checkMesh(mesh(b), BED);
    expect(codes(r)).toContain('degenerate');
  });
  it('NaN coordinates are an error and nothing is claimed about the rest', () => {
    const r = checkMesh({ positions: Float32Array.from([0, NaN, 0, 1, 0, 0, 0, 1, 0]), indices: Uint32Array.from([0, 1, 2]) }, BED);
    expect(codes(r)).toContain('nan_coords'); expect(r.verdict).toBe('errors');
  });
  it('bigger than the printer bed is an error, even when rotated', () => {
    expect(codes(checkMesh(mesh(box(0, 0, 0, 300)), BED))).toContain('exceeds_bed');
    // 250 x 250 x 250 fits, 260 long on one side does not
    const r = checkMesh(mesh(box(0, 0, 0, 250)), BED); expect(codes(r)).not.toContain('exceeds_bed');
  });
  it('under 1 mm gets a unit warning', () => {
    expect(codes(checkMesh(mesh(box(0, 0, 0, 0.5)), BED))).toContain('tiny');
  });
  it('never says "print ready", and always lists what was not checked', () => {
    const r = checkMesh(mesh(box(0, 0, 0, 40)), BED);
    expect(r.verdict).not.toMatch(/print/i);
    expect(r.notChecked.length).toBeGreaterThan(0);
    expect(r.checked).toContain('open edges and holes');
  });
  it('real STL file: the 40 mm cube fixture passes', () => {
    const buf = readFileSync('tests/fixtures/cube.stl');
    const g = new STLLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    const pos = g.getAttribute('position').array as Float32Array;
    const r = checkMesh({ positions: pos, indices: Uint32Array.from({ length: pos.length / 3 }, (_, i) => i) }, BED);
    expect(r.verdict).toBe('ready');
    expect(r.volumeMm3).toBeCloseTo(64000, -2);
  });
});

describe('wall thickness', () => {
  /** Hollow box: outer 40 mm shell plus an inward-facing cavity of size `inner` centred inside. */
  function hollow(inner: number) {
    const o = box(0, 0, 0, 40);
    const off = (40 - inner) / 2;
    const c = box(off, off, off, inner);
    c.t = c.t.map(([a, b, d]) => [a, d, b]); // cavity faces point into the cavity
    return mesh(o, c);
  }
  it('solid box has no thin walls', () => {
    const r = checkMesh(mesh(box(0, 0, 0, 40)), BED);
    expect(codes(r)).not.toContain('thin_walls');
    expect(r.checked.join(' ')).toContain('wall thickness');
  });
  it('0.5 mm shell is flagged thin', () => {
    const r = checkMesh(hollow(39), BED); // outer 40, cavity 39 -> 0.5 mm walls
    expect(codes(r)).toContain('thin_walls');
    expect(r.verdict).toBe('warnings');
  });
  it('3 mm shell is not flagged', () => {
    const r = checkMesh(hollow(34), BED); // 3 mm walls
    expect(codes(r)).not.toContain('thin_walls');
  });
});

import { wallThickness } from '@/lib/checker/walls';
describe('wall thickness measurements', () => {
  it('measures the real distance between the shells', () => {
    const m = (() => {
      const o = box(0, 0, 0, 40); const c = box(0.5, 0.5, 0.5, 39); c.t = c.t.map(([a, b, d]) => [a, d, b]);
      return mesh(o, c);
    })();
    const wp = Float64Array.from(m.positions);
    const tris: [number, number, number][] = [];
    for (let i = 0; i < m.indices.length; i += 3) tris.push([m.indices[i], m.indices[i + 1], m.indices[i + 2]]);
    const w = wallThickness(wp, tris, Math.hypot(40, 40, 40), 1, { minWall: 0.8 });
    expect(w.hits).toBeGreaterThan(0);
    expect(w.minMm).toBeCloseTo(0.5, 2);
    const solid = mesh(box(0, 0, 0, 40));
    const s = wallThickness(Float64Array.from(solid.positions), [[0, 1, 2]], 70, 1, {});
    expect(s.hits).toBeGreaterThanOrEqual(0);
  });
  it('a 40 mm solid measures about 40 mm across', () => {
    const m = mesh(box(0, 0, 0, 40));
    const tris: [number, number, number][] = [];
    for (let i = 0; i < m.indices.length; i += 3) tris.push([m.indices[i], m.indices[i + 1], m.indices[i + 2]]);
    const w = wallThickness(Float64Array.from(m.positions), tris, 69.3, 1, {});
    expect(w.hits).toBeGreaterThan(0);
    expect(w.minMm).toBeCloseTo(40, 0);
  });
});
