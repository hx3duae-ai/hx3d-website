import * as THREE from 'three';
import type { Mesh } from './check';
/** Bakes every mesh's world transform into one indexed mesh, so the checker sees what the viewer shows. */
export function extractMesh(root: THREE.Object3D): Mesh {
  root.updateMatrixWorld(true);
  const chunks: { p: Float32Array; i: Uint32Array }[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position'); if (!pos) return;
    const p = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); p[k * 3] = v.x; p[k * 3 + 1] = v.y; p[k * 3 + 2] = v.z; }
    const i = m.geometry.index ? Uint32Array.from(m.geometry.index.array) : Uint32Array.from({ length: pos.count }, (_, k) => k);
    chunks.push({ p, i });
  });
  let nv = 0, ni = 0; for (const c of chunks) { nv += c.p.length / 3; ni += c.i.length; }
  const positions = new Float32Array(nv * 3), indices = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const c of chunks) {
    positions.set(c.p, vo * 3);
    for (let k = 0; k < c.i.length; k++) indices[io + k] = c.i[k] + vo;
    vo += c.p.length / 3; io += c.i.length;
  }
  return { positions, indices };
}
