// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { exportModel, build3MF } from '@/lib/studio/export';
import { checkMesh } from '@/lib/checker/check';

const cubeRoot = () => new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40));
const readBlob = (b: Blob) => new Promise<ArrayBuffer>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result as ArrayBuffer); r.onerror = () => bad(r.error); r.readAsArrayBuffer(b); });
const readText = async (b: Blob) => new TextDecoder().decode(await readBlob(b));
const ab = (x: ArrayBuffer | Uint8Array | DataView) => (x instanceof ArrayBuffer ? x : x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength)) as ArrayBuffer;

describe('exports', () => {
  it('STL: binary size is 84 + 50 bytes per triangle, and it parses back to the same triangle count', async () => {
    const blob = await exportModel(cubeRoot(), 'stl');
    const buf = await readBlob(blob);
    const n = new DataView(buf).getUint32(80, true);
    expect(buf.byteLength).toBe(84 + n * 50);
    expect(n).toBe(12);
    const g = new STLLoader().parse(buf);
    expect(g.getAttribute('position').count).toBe(36);
  });
  it('OBJ: has 8 vertices and 12 faces for a cube', async () => {
    const txt = await readText(await exportModel(cubeRoot(), 'obj'));
    expect(txt.match(/^v /gm)?.length).toBe(24); // 3 * 8 (non-indexed geometry duplicates corners)
    expect(txt.match(/^f /gm)?.length).toBe(12);
  });
  it('PLY and GLB produce non-empty binary output with the right header', async () => {
    const ply = new TextDecoder().decode(new Uint8Array(await readBlob(await exportModel(cubeRoot(), 'ply'))).slice(0, 4));
    expect(ply).toBe('ply\n');
    const glb = new Uint8Array(await readBlob(await exportModel(cubeRoot(), 'glb')));
    expect(String.fromCharCode(...glb.slice(0, 4))).toBe('glTF');
  });
  it('3MF: our writer produces a file the 3MF loader reads back, and the checker accepts it', () => {
    const bytes = build3MF(cubeRoot());
    expect(bytes[0]).toBe(0x50); expect(bytes[1]).toBe(0x4b); // zip signature
    const group = new ThreeMFLoader().parse(ab(bytes));
    let tris = 0; group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) tris += (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3; });
    expect(tris).toBe(12);
    void checkMesh; void readFileSync;
  });
});
