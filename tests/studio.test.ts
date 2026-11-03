import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { sliceMesh, primitive, combine, volumeOf } from '@/lib/studio/edit';

describe('studio edits (closed solids)', () => {
  it('a 40 mm cube has volume 64000 mm3', () => {
    expect(volumeOf(new THREE.BoxGeometry(40, 40, 40))).toBeCloseTo(64000, -1);
  });
  it('slicing a 40 mm cube at its middle gives two 20 mm halves', () => {
    const cube = new THREE.BoxGeometry(40, 40, 40); cube.translate(0, 20, 0); // sits on y=0..40
    const { below, above } = sliceMesh(cube, 'y', 20);
    expect(volumeOf(below) / 1000).toBeCloseTo(32, 0);
    expect(volumeOf(above) / 1000).toBeCloseTo(32, 0);
  });
  it('union of two non-overlapping boxes adds volumes', () => {
    const a = new THREE.BoxGeometry(10, 10, 10); const b = new THREE.BoxGeometry(10, 10, 10); b.translate(30, 0, 0);
    expect(volumeOf(combine(a, b, 'union'))).toBeCloseTo(2000, -1);
  });
  it('subtracting a sphere from a cube removes its volume', () => {
    const cube = new THREE.BoxGeometry(40, 40, 40);
    const hole = primitive('sphere', 20);
    const v = volumeOf(combine(cube, hole, 'subtract'));
    const expected = 64000 - (4 / 3) * Math.PI * 10 ** 3;
    expect(v).toBeGreaterThan(expected * 0.97); expect(v).toBeLessThan(expected * 1.03);
  });
});

describe('studio edits on merged geometry (no normals, like the viewer produces)', () => {
  it('slicing works when the geometry has no normal attribute', () => {
    const cube = new THREE.BoxGeometry(40, 40, 40); cube.translate(0, 20, 0);
    const bare = new THREE.BufferGeometry();
    bare.setAttribute('position', cube.getAttribute('position').clone());
    bare.setIndex(cube.index!.clone());
    const { below } = sliceMesh(bare, 'y', 20);
    expect(volumeOf(below) / 1000).toBeCloseTo(32, 0);
  });
});
