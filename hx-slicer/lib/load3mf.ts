import * as THREE from "three";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

export interface ModelStats {
  name: string;
  fileSize: number;
  meshes: number;
  triangles: number;
  vertices: number;
  size: THREE.Vector3;
}

export interface LoadedModel {
  object: THREE.Group;
  stats: ModelStats;
}

/** Parse a 3MF file into a three.js group, centered on the XY plane and resting on Z=0. */
export async function load3mf(file: File): Promise<LoadedModel> {
  const buffer = await file.arrayBuffer();
  const object = new ThreeMFLoader().parse(buffer);

  let meshes = 0;
  let triangles = 0;
  let vertices = 0;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes++;
      const geo = child.geometry as THREE.BufferGeometry;
      const count = geo.attributes.position?.count ?? 0;
      vertices += count;
      triangles += geo.index ? geo.index.count / 3 : count / 3;
    }
  });
  if (meshes === 0) throw new Error("لا يحتوي الملف على أي مجسّم (mesh)");

  // 3MF is Z-up; keep it Z-up and place the model on the build plate.
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -center.y, -box.min.z);

  return {
    object,
    stats: {
      name: file.name,
      fileSize: file.size,
      meshes,
      triangles,
      vertices,
      size: box.getSize(new THREE.Vector3()),
    },
  };
}
