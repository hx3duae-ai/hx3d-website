/**
 * Wall-thickness estimate: for sampled triangles, shoot a ray inward along the surface normal
 * and measure the distance to the next surface. This is a sample, not an exhaustive test.
 */
export type WallResult = { sampled: number; hits: number; thin: number; minMm: number | null };

type Node = { mn: number[]; mx: number[]; l?: Node; r?: Node; ids?: number[] };

export function wallThickness(
  wp: Float64Array, tris: [number, number, number][], diag: number, sign: number,
  opts: { maxSamples?: number; minWall?: number } = {},
): WallResult {
  const maxSamples = opts.maxSamples ?? 4000, minWall = opts.minWall ?? 0.8;
  const T = tris.length;
  if (!T) return { sampled: 0, hits: 0, thin: 0, minMm: null };
  // triangle corners in a flat array, 9 numbers per triangle
  const tc = new Float64Array(T * 9), cen = new Float64Array(T * 3);
  for (let i = 0; i < T; i++) {
    const [a, b, c] = tris[i];
    for (let k = 0; k < 3; k++) {
      tc[i * 9 + k] = wp[a * 3 + k]; tc[i * 9 + 3 + k] = wp[b * 3 + k]; tc[i * 9 + 6 + k] = wp[c * 3 + k];
      cen[i * 3 + k] = (tc[i * 9 + k] + tc[i * 9 + 3 + k] + tc[i * 9 + 6 + k]) / 3;
    }
  }
  const root = build(Array.from({ length: T }, (_, i) => i), tc, cen);
  const eps = Math.max(diag * 1e-6, 1e-7);
  const step = Math.max(1, Math.ceil(T / maxSamples));
  let sampled = 0, hits = 0, thin = 0, minMm: number | null = null;
  for (let i = 0; i < T; i += step) {
    sampled++;
    const [a, b, c] = tris[i];
    const ux = wp[b * 3] - wp[a * 3], uy = wp[b * 3 + 1] - wp[a * 3 + 1], uz = wp[b * 3 + 2] - wp[a * 3 + 2];
    const vx = wp[c * 3] - wp[a * 3], vy = wp[c * 3 + 1] - wp[a * 3 + 1], vz = wp[c * 3 + 2] - wp[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz); if (!len) continue;
    nx = (nx / len) * sign; ny = (ny / len) * sign; nz = (nz / len) * sign; // outward
    const ox = cen[i * 3] - nx * eps, oy = cen[i * 3 + 1] - ny * eps, oz = cen[i * 3 + 2] - nz * eps; // just inside
    const t = castInward(root, tc, ox, oy, oz, -nx, -ny, -nz, i);
    if (t === null) continue;
    hits++;
    const thick = t + eps;
    if (minMm === null || thick < minMm) minMm = thick;
    if (thick < minWall) thin++;
  }
  return { sampled, hits, thin, minMm };
}

function build(ids: number[], tc: Float64Array, cen: Float64Array): Node {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const i of ids) for (let k = 0; k < 3; k++) for (let v = 0; v < 3; v++) {
    const x = tc[i * 9 + v * 3 + k]; if (x < mn[k]) mn[k] = x; if (x > mx[k]) mx[k] = x;
  }
  if (ids.length <= 8) return { mn, mx, ids };
  const cmn = [Infinity, Infinity, Infinity], cmx = [-Infinity, -Infinity, -Infinity];
  for (const i of ids) for (let k = 0; k < 3; k++) { cmn[k] = Math.min(cmn[k], cen[i * 3 + k]); cmx[k] = Math.max(cmx[k], cen[i * 3 + k]); }
  const axis = [0, 1, 2].sort((a, b) => (cmx[b] - cmn[b]) - (cmx[a] - cmn[a]))[0];
  const sorted = [...ids].sort((a, b) => cen[a * 3 + axis] - cen[b * 3 + axis]);
  const half = sorted.length >> 1;
  return { mn, mx, l: build(sorted.slice(0, half), tc, cen), r: build(sorted.slice(half), tc, cen) };
}

function hitBox(n: Node, ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, tmax: number) {
  let t0 = 0, t1 = tmax;
  const o = [ox, oy, oz], inv = [ix, iy, iz];
  for (let k = 0; k < 3; k++) {
    let a = (n.mn[k] - o[k]) * inv[k], b = (n.mx[k] - o[k]) * inv[k];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}

/** Smallest positive hit distance along the ray, ignoring the source triangle. */
function castInward(root: Node, tc: Float64Array, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, self: number): number | null {
  const ix = 1 / (dx || 1e-12), iy = 1 / (dy || 1e-12), iz = 1 / (dz || 1e-12);
  let best = Infinity;
  const stack: Node[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (!hitBox(n, ox, oy, oz, ix, iy, iz, best)) continue;
    if (n.ids) {
      for (const i of n.ids) { if (i === self) continue; const t = mollerTrumbore(tc, i, ox, oy, oz, dx, dy, dz); if (t !== null && t < best) best = t; }
    } else { stack.push(n.l!, n.r!); }
  }
  return best === Infinity ? null : best;
}

function mollerTrumbore(tc: Float64Array, i: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number | null {
  const b = i * 9;
  const e1x = tc[b + 3] - tc[b], e1y = tc[b + 4] - tc[b + 1], e1z = tc[b + 5] - tc[b + 2];
  const e2x = tc[b + 6] - tc[b], e2y = tc[b + 7] - tc[b + 1], e2z = tc[b + 8] - tc[b + 2];
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-14) return null;
  const f = 1 / det;
  const sx = ox - tc[b], sy = oy - tc[b + 1], sz = oz - tc[b + 2];
  const u = f * (sx * px + sy * py + sz * pz);
  if (u < 0 || u > 1) return null;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = f * (dx * qx + dy * qy + dz * qz);
  if (v < 0 || u + v > 1) return null;
  const t = f * (e2x * qx + e2y * qy + e2z * qz);
  return t > 1e-9 ? t : null;
}
