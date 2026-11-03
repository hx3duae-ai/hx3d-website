import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export type ExportFormat = 'stl' | 'obj' | 'ply' | 'glb' | 'gltf' | '3mf';
export const EXPORT_FORMATS: ExportFormat[] = ['stl', '3mf', 'obj', 'ply', 'glb', 'gltf'];
export const MIME: Record<ExportFormat, string> = {
  stl: 'model/stl', obj: 'text/plain', ply: 'application/octet-stream', glb: 'model/gltf-binary', gltf: 'model/gltf+json', '3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
};

/** Exports the model in its current state (mm, Z-up for print formats). Caller supplies a mesh-only root. */
export async function exportModel(root: THREE.Object3D, format: ExportFormat): Promise<Blob> {
  root.updateMatrixWorld(true);
  switch (format) {
    case 'stl': { const d = new STLExporter().parse(root, { binary: true }) as DataView; return new Blob([d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) as ArrayBuffer], { type: MIME.stl }); }
    case 'obj': return new Blob([new OBJExporter().parse(root)], { type: MIME.obj });
    case 'ply': return new Blob([await new Promise<ArrayBuffer>((ok) => new PLYExporter().parse(root, (r) => ok(r as ArrayBuffer), { binary: true }))], { type: MIME.ply });
    case 'glb': return new Blob([(await new GLTFExporter().parseAsync(root, { binary: true })) as ArrayBuffer], { type: MIME.glb });
    case 'gltf': return new Blob([JSON.stringify(await new GLTFExporter().parseAsync(root, { binary: false }))], { type: MIME.gltf });
    case '3mf': { const b = build3MF(root); return new Blob([b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer], { type: MIME['3mf'] }); }
  }
}

/** Minimal 3MF (3D Manufacturing Format): a zip with one model part, in millimetres. */
export function build3MF(root: THREE.Object3D): Uint8Array {
  const verts: number[] = []; const tris: number[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const g = m.geometry as THREE.BufferGeometry; const pos = g.getAttribute('position'); const idx = g.index;
    const base = verts.length / 3; const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); verts.push(v.x, v.y, v.z); }
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) tris.push(base + (idx ? idx.getX(i) : i), base + (idx ? idx.getX(i + 1) : i + 1), base + (idx ? idx.getX(i + 2) : i + 2));
  });
  const vx = []; for (let i = 0; i < verts.length; i += 3) vx.push(`<vertex x="${verts[i]}" y="${verts[i + 1]}" z="${verts[i + 2]}"/>`);
  const tx = []; for (let i = 0; i < tris.length; i += 3) tx.push(`<triangle v1="${tris[i]}" v2="${tris[i + 1]}" v3="${tris[i + 2]}"/>`);
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${vx.join('')}</vertices><triangles>${tx.join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  return zipStore([
    { name: '[Content_Types].xml', data: new TextEncoder().encode(contentTypes) },
    { name: '_rels/.rels', data: new TextEncoder().encode(rels) },
    { name: '3D/3dmodel.model', data: new TextEncoder().encode(model) },
  ]);
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (d: Uint8Array) => { let c = 0xffffffff; for (const b of d) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** Zip archive with no compression (method 0), as 3MF readers accept. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name); const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, f.data.length, true); ch.setUint32(24, f.data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}
