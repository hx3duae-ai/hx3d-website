import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';

/** Mesh editing on closed solids (boolean operations). Results should be re-checked by the Model Checker. */
const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];
evaluator.useGroups = false;

const brush = (g0: THREE.BufferGeometry) => {
  const g = g0.index ? g0 : toIndexed(g0);
  if (!g.getAttribute('normal')) g.computeVertexNormals(); // the CSG evaluator needs normals
  const b = new Brush(g);
  b.updateMatrixWorld();
  return b;
};
function toIndexed(g: THREE.BufferGeometry) { return g.index ? g : (g.clone().toNonIndexed() && mergeVerts(g)); }
function mergeVerts(g: THREE.BufferGeometry) {
  // BufferGeometryUtils.mergeVertices is in three/addons; keep the dependency small and merge here by position.
  const pos = g.getAttribute('position'); const map = new Map<string, number>(); const out: number[] = []; const idx: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    let v = map.get(k); if (v === undefined) { v = out.length / 3; map.set(k, v); out.push(pos.getX(i), pos.getY(i), pos.getZ(i)); }
    idx.push(v);
  }
  const n = new THREE.BufferGeometry();
  n.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  n.setIndex(idx);
  return n;
}

/** Cut a closed mesh with an axis-aligned plane; returns the two halves (below, above). */
export function sliceMesh(geometry: THREE.BufferGeometry, axis: 'x' | 'y' | 'z', at: number) {
  const bb = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
  const size = bb.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) * 4 + 10; // big enough to cover the whole mesh
  const center = bb.getCenter(new THREE.Vector3());
  const halfspace = (above: boolean) => {
    const dims = { x: span, y: span, z: span };
    dims[axis] = span; // slab thickness along the cut axis
    const g = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
    const pos = { x: center.x, y: center.y, z: center.z };
    pos[axis] = above ? at + span / 2 : at - span / 2;
    g.translate(pos.x, pos.y, pos.z);
    return g;
  };
  const a = brush(geometry);
  const lo = evaluator.evaluate(a, brush(halfspace(false)), INTERSECTION).geometry;
  const hi = evaluator.evaluate(a, brush(halfspace(true)), INTERSECTION).geometry;
  return { below: lo, above: hi };
}

export type Primitive = 'box' | 'sphere' | 'cylinder';
export function primitive(kind: Primitive, size: number) {
  if (kind === 'box') return new THREE.BoxGeometry(size, size, size);
  if (kind === 'sphere') return new THREE.SphereGeometry(size / 2, 32, 16);
  return new THREE.CylinderGeometry(size / 2, size / 2, size, 32);
}

export function combine(a: THREE.BufferGeometry, b: THREE.BufferGeometry, op: 'union' | 'subtract') {
  return evaluator.evaluate(brush(a), brush(b), op === 'union' ? ADDITION : SUBTRACTION).geometry;
}

/** Signed volume of a closed triangle mesh, mm^3. */
export function volumeOf(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position'); const idx = g.index; let v = 0;
  const n = idx ? idx.count : pos.count;
  const P = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i);
  for (let i = 0; i < n; i += 3) v += P(i).dot(new THREE.Vector3().crossVectors(P(i + 1), P(i + 2))) / 6;
  return Math.abs(v);
}

/** Single merged BufferGeometry of everything visible in a loaded root, in world mm. */
export function geometryFromRoot(root: THREE.Object3D): THREE.BufferGeometry {
  root.updateMatrixWorld(true);
  const pos: number[] = []; const idx: number[] = []; const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const g = m.geometry as THREE.BufferGeometry; const p = g.getAttribute('position'); const base = pos.length / 3;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); pos.push(v.x, v.y, v.z); }
    const n = g.index ? g.index.count : p.count;
    for (let i = 0; i < n; i++) idx.push(base + (g.index ? g.index.getX(i) : i));
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}

/** Place a geometry so it sits on the bed, centred, the way the viewer shows models. */
export function asRoot(geoms: THREE.BufferGeometry[]): THREE.Group {
  const grp = new THREE.Group();
  for (const g of geoms) { g.computeVertexNormals(); grp.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xcfd2dc, roughness: 0.55 }))); }
  return grp;
}
