import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { MAX_TRIANGLES, type ModelFormat } from './formats';

export type LoadedModel = { root: THREE.Object3D; format: ModelFormat; triangles: number; vertices: number; meshes: number };
const Z_UP: ModelFormat[] = ['stl', 'obj', 'ply', '3mf']; // CAD/print formats are Z-up; three.js is Y-up
const DEFAULT_MAT = () => new THREE.MeshStandardMaterial({ color: 0xcfd2dc, roughness: 0.55, metalness: 0.05 });

export class ModelError extends Error { constructor(public code: 'too-many-triangles' | 'empty' | 'points-only' | 'parse', msg?: string) { super(msg ?? code); } }

export async function loadModel(buf: ArrayBuffer, format: ModelFormat, displayName: string): Promise<LoadedModel> {
  let root: THREE.Object3D;
  try {
    switch (format) {
      case 'stl': { const g = new STLLoader().parse(buf); root = new THREE.Mesh(g, DEFAULT_MAT()); root.name = displayName; break; }
      case 'ply': {
        const g = new PLYLoader().parse(buf);
        if (!g.index && g.getAttribute('position') && g.getAttribute('position').count % 3 !== 0) throw new ModelError('points-only');
        root = new THREE.Mesh(g, DEFAULT_MAT()); root.name = displayName; break;
      }
      case 'obj': root = new OBJLoader().parse(new TextDecoder().decode(buf)); break;
      case '3mf': root = new ThreeMFLoader().parse(buf); break;
      case 'glb': case 'gltf': {
        const gltf = await new Promise<{ scene: THREE.Group }>((ok, bad) =>
          new GLTFLoader().parse(format === 'gltf' ? new TextDecoder().decode(buf) : buf, '', ok as never, bad));
        root = gltf.scene; root.scale.setScalar(1000); // glTF units are metres; the viewer works in mm
        break;
      }
    }
  } catch (e) {
    if (e instanceof ModelError) throw e;
    throw new ModelError('parse', (e as Error).message);
  }

  let triangles = 0, vertices = 0, meshes = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute('position'); if (!pos) return;
    meshes++; vertices += pos.count; triangles += (g.index ? g.index.count : pos.count) / 3;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!m.material) m.material = DEFAULT_MAT();
  });
  if (!meshes) throw new ModelError('empty');
  if (triangles > MAX_TRIANGLES) { root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); }); throw new ModelError('too-many-triangles'); }

  if (Z_UP.includes(format)) { const pivot = new THREE.Group(); root.rotation.x = -Math.PI / 2; pivot.add(root); root = pivot; }
  return { root, format, triangles, vertices, meshes };
}
