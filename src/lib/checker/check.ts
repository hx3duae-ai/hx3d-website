import { wallThickness } from './walls';
/**
 * HX Model Checker: pure geometry analysis on an indexed triangle mesh (units: mm).
 * Runs in the browser or in tests. It reports only what it actually tested.
 */
export type Mesh = { positions: Float32Array; indices: Uint32Array };
export type Severity = 'error' | 'warning';
export type Issue = { code: string; severity: Severity; count?: number };
export type Verdict = 'ready' | 'warnings' | 'errors';
export type Report = {
  verdict: Verdict;
  triangles: number; vertices: number; parts: number;
  size: { x: number; y: number; z: number } | null;
  closed: boolean; volumeMm3: number | null; holes: number;
  issues: Issue[];
  checked: string[];        // checks that ran
  notChecked: string[];     // checks that were NOT run, so the user is not misled
};
export type Bed = { x: number; y: number; z: number };

const CHECKED = ['structure', 'degenerate triangles', 'open edges and holes', 'non-manifold edges', 'normal orientation',
  'disconnected parts', 'bounding-box overlap between parts', 'size and build volume', 'wall thickness (sampled, 0.8 mm minimum)'];
const NOT_CHECKED = ['exact triangle-triangle intersections', 'every triangle for wall thickness (a sample of up to 4000 is measured)', 'slicer and printer compatibility', 'material and overhang analysis'];

export function checkMesh(input: Mesh, bed: Bed): Report {
  const issues: Issue[] = [];
  const add = (code: string, severity: Severity, count?: number) => issues.push({ code, severity, count });
  const pos = input.positions, idx = input.indices;
  const nv0 = pos.length / 3;
  if (pos.length % 3 !== 0 || idx.length % 3 !== 0 || idx.length === 0) {
    add('bad_indices', 'error');
    return finish(0, 0, 0, null, false, null, 0, issues);
  }
  // 1) coordinates must be finite and indices in range
  let nan = 0; for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) nan++;
  if (nan) add('nan_coords', 'error', nan);
  let badIdx = 0; for (let i = 0; i < idx.length; i++) if (idx[i] >= nv0) badIdx++;
  if (badIdx) add('bad_indices', 'error', badIdx);
  if (nan || badIdx) return finish(idx.length / 3, nv0, 0, null, false, null, 0, issues);

  // bounding box
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
  const size = { x: mx[0] - mn[0], y: mx[1] - mn[1], z: mx[2] - mn[2] };
  const diag = Math.hypot(size.x, size.y, size.z) || 1;

  // 2) weld coincident vertices (STL and most formats repeat vertices per triangle)
  const eps = Math.max(diag * 1e-7, 1e-9);
  const keyMap = new Map<string, number>(); const canon = new Int32Array(nv0);
  let nv = 0;
  for (let v = 0; v < nv0; v++) {
    const k = `${Math.round(pos[v * 3] / eps)},${Math.round(pos[v * 3 + 1] / eps)},${Math.round(pos[v * 3 + 2] / eps)}`;
    let c = keyMap.get(k); if (c === undefined) { c = nv++; keyMap.set(k, c); }
    canon[v] = c;
  }
  const wp = new Float64Array(nv * 3);
  for (let v = 0; v < nv0; v++) { const c = canon[v] * 3; wp[c] = pos[v * 3]; wp[c + 1] = pos[v * 3 + 1]; wp[c + 2] = pos[v * 3 + 2]; }

  // 3) triangles: drop degenerate ones (repeated vertices or ~zero area)
  const tri: [number, number, number][] = []; let degenerate = 0;
  const areaEps = diag * diag * 1e-12;
  for (let t = 0; t < idx.length; t += 3) {
    const a = canon[idx[t]], b = canon[idx[t + 1]], c = canon[idx[t + 2]];
    if (a === b || b === c || a === c) { degenerate++; continue; }
    const ax = wp[a * 3], ay = wp[a * 3 + 1], az = wp[a * 3 + 2];
    const ux = wp[b * 3] - ax, uy = wp[b * 3 + 1] - ay, uz = wp[b * 3 + 2] - az;
    const vx = wp[c * 3] - ax, vy = wp[c * 3 + 1] - ay, vz = wp[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (Math.hypot(cx, cy, cz) / 2 < areaEps) { degenerate++; continue; }
    tri.push([a, b, c]);
  }
  if (degenerate) add('degenerate', 'warning', degenerate);

  // 4) edges: count how many triangles use each undirected edge, and record direction
  const edges = new Map<number, { n: number; fwd: number; bwd: number }>();
  const N = nv || 1;
  for (const [a, b, c] of tri) for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
    const lo = Math.min(p, q), hi = Math.max(p, q), key = lo * N + hi;
    let e = edges.get(key); if (!e) { e = { n: 0, fwd: 0, bwd: 0 }; edges.set(key, e); }
    e.n++; if (p === lo) e.fwd++; else e.bwd++;
  }
  let open = 0, nonManifold = 0, inconsistent = 0;
  const boundary: [number, number][] = [];
  for (const [key, e] of edges) {
    if (e.n === 1) { open++; boundary.push([Math.floor(key / N), key % N]); }
    else if (e.n >= 3) nonManifold++;
    else if (e.fwd === 2 || e.bwd === 2) inconsistent++; // both faces traverse the edge the same way
  }
  // holes = connected loops of boundary edges
  const holes = countLoops(boundary);
  if (open) add('open_edges', 'error', open);
  if (nonManifold) add('non_manifold_edge', 'error', nonManifold);
  if (inconsistent) add('inconsistent_normals', 'error', inconsistent);

  // 5) signed volume (closed meshes only): negative means the whole surface points inward
  const closed = open === 0;
  let signed = 0;
  for (const [a, b, c] of tri) {
    const ax = wp[a * 3], ay = wp[a * 3 + 1], az = wp[a * 3 + 2];
    const bx = wp[b * 3], by = wp[b * 3 + 1], bz = wp[b * 3 + 2];
    const cx = wp[c * 3], cy = wp[c * 3 + 1], cz = wp[c * 3 + 2];
    signed += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  if (closed && signed < 0 && !inconsistent) add('inverted_normals', 'error');
  const volumeMm3 = closed && !nonManifold ? Math.abs(signed) : null;

  // 6) connected parts (union-find over vertices)
  const parent = new Int32Array(nv); for (let i = 0; i < nv; i++) parent[i] = i;
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const [a, b, c] of tri) { union(parent, find, a, b); union(parent, find, b, c); }
  const compBox = new Map<number, { mn: number[]; mx: number[] }>();
  const used = new Set<number>();
  for (const [a] of tri) used.add(a);
  for (const v of used) {
    const r = find(v); let bx = compBox.get(r);
    if (!bx) { bx = { mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity] }; compBox.set(r, bx); }
    for (let k = 0; k < 3; k++) { bx.mn[k] = Math.min(bx.mn[k], wp[v * 3 + k]); bx.mx[k] = Math.max(bx.mx[k], wp[v * 3 + k]); }
  }
  const parts = compBox.size;
  if (parts > 1) add('disconnected_parts', 'warning', parts);
  const boxes = [...compBox.values()];
  if (boxes.length <= 2000) {
    let overlap = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      if ([0, 1, 2].every((k) => A.mn[k] <= B.mx[k] && B.mn[k] <= A.mx[k])) overlap++;
    }
    if (overlap) add('possible_overlap', 'warning', overlap);
  }

  // 6b) wall thickness: sampled inward rays, only meaningful when the surface is closed
  if (closed && tri.length) {
    const w = wallThickness(wp, tri, diag, signed < 0 ? -1 : 1, { minWall: 0.8 });
    if (w.thin) add('thin_walls', 'warning', w.thin);
  }

  // 7) size and build volume (sorted dims allow for rotating the part on the bed)
  const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
  const bedDims = [bed.x, bed.y, bed.z].sort((a, b) => a - b);
  if (dims[2] > 0 && dims[2] < 1) add('tiny', 'warning');
  if (dims.some((d, i) => d > bedDims[i])) add('exceeds_bed', 'error');
  if (!tri.length) add('empty', 'error');

  return finish(idx.length / 3, nv0, parts, size, closed, volumeMm3, holes, issues);
}

function union(parent: Int32Array, find: (x: number) => number, a: number, b: number) {
  const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb;
}
function countLoops(edges: [number, number][]) {
  const p = new Map<number, number>();
  const f = (x: number): number => { let r = p.get(x) ?? x; if (r !== x) { r = f(r); p.set(x, r); } return r; };
  for (const [a, b] of edges) { p.set(a, p.get(a) ?? a); p.set(b, p.get(b) ?? b); const ra = f(a), rb = f(b); if (ra !== rb) p.set(ra, rb); }
  const roots = new Set<number>(); for (const k of p.keys()) roots.add(f(k));
  return roots.size;
}
function finish(triangles: number, vertices: number, parts: number, size: Report['size'], closed: boolean, volumeMm3: number | null, holes: number, issues: Issue[]): Report {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const verdict: Verdict = errors ? 'errors' : warnings ? 'warnings' : 'ready';
  return { verdict, triangles, vertices, parts, size, closed, volumeMm3, holes, issues, checked: CHECKED, notChecked: NOT_CHECKED };
}
