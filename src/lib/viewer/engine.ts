import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { LoadedModel } from './load';
import { fitsBed, type Printer } from './printers';

export type ViewName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export type Part = { id: number; name: string; visible: boolean; color: string | null; origColor: string };
const DIRS: Record<ViewName, [number, number, number]> = {
  front: [0, 0.0001, 1], back: [0, 0.0001, -1], right: [1, 0.0001, 0], left: [-1, 0.0001, 0], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001],
};
type Mat = THREE.Material & { color?: THREE.Color; wireframe?: boolean };
const mats = (m: THREE.Mesh): Mat[] => (Array.isArray(m.material) ? m.material : [m.material]) as Mat[];

export class ViewerEngine {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
  private controls: OrbitControls; private raf = 0; private visible = true; private ro: ResizeObserver; private io: IntersectionObserver;
  private placed = new THREE.Group(); private bedGroup = new THREE.Group(); private bounds: THREE.Box3Helper;
  private meshes: THREE.Mesh[] = []; private wire = false; private printer!: Printer; private disposed = false;
  onInteract: () => void = () => {};

  constructor(private el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(200, 400, 300); this.scene.add(sun);
    this.scene.add(this.placed, this.bedGroup);
    this.bounds = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#e86ab3')); this.bounds.visible = false; this.scene.add(this.bounds);
    this.setBackground('#0b0b0f');
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.autoRotateSpeed = 1.2;
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this.onInteract(); });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting)); this.io.observe(el);
    this.resize(); this.loop();
  }

  private resize() { const { clientWidth: w, clientHeight: h } = this.el; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  private loop = () => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return; // pause when off-screen
    this.controls.update(); this.renderer.render(this.scene, this.camera);
  };

  setBackground(hex: string) { this.scene.background = new THREE.Color(hex); }
  setAutoRotate(on: boolean) { this.controls.autoRotate = on; }

  setPrinter(p: Printer) {
    this.printer = p;
    this.bedGroup.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); }); this.bedGroup.clear();
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(p.x, p.y), new THREE.MeshStandardMaterial({ color: 0x15151b, roughness: 0.9, metalness: 0 }));
    plate.rotation.x = -Math.PI / 2; plate.position.y = -0.05; this.bedGroup.add(plate);
    const pts: number[] = []; // 10 mm measuring grid
    for (let x = -p.x / 2; x <= p.x / 2 + 0.01; x += 10) pts.push(x, 0, -p.y / 2, x, 0, p.y / 2);
    for (let z = -p.y / 2; z <= p.y / 2 + 0.01; z += 10) pts.push(-p.x / 2, 0, z, p.x / 2, 0, z);
    const gg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x3a3a46 })); grid.name = 'grid'; this.bedGroup.add(grid);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(p.x, p.z, p.y)), new THREE.LineBasicMaterial({ color: 0xe86ab3, transparent: true, opacity: 0.45 }));
    edge.position.y = p.z / 2; edge.name = 'volume'; this.bedGroup.add(edge);
    if (!this.meshes.length) this.setView('front');
  }
  setGrid(on: boolean) { const g = this.bedGroup.getObjectByName('grid'); if (g) g.visible = on; }
  setBed(on: boolean) { this.bedGroup.visible = on; }
  setBounds(on: boolean) { this.bounds.visible = on; this.updateBounds(); }

  setModel(m: LoadedModel): Part[] {
    this.clearModel();
    const inner = m.root; this.placed.add(inner);
    const box = new THREE.Box3().setFromObject(inner), c = box.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -box.min.y, -c.z); // centre on bed, rest on plate
    inner.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { me.material = Array.isArray(me.material) ? me.material.map((x) => x.clone()) : me.material.clone(); mats(me).forEach((x) => (x.side = THREE.DoubleSide)); this.meshes.push(me); } }); // double-sided: files with flipped normals stay visible
    this.captureOriginals(); this.setWireframe(this.wire); this.updateBounds(); this.setView('front');
    return this.meshes.map((me, i) => { const mm = mats(me)[0]; return { id: i, name: me.name || `Part ${i + 1}`, visible: true, color: null, origColor: '#' + (mm.color?.getHexString() ?? 'cfd2dc') }; });
  }
  clearModel() {
    this.placed.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { me.geometry.dispose(); mats(me).forEach((x) => x.dispose()); } });
    this.placed.clear(); this.placed.position.set(0, 0, 0); this.placed.rotation.set(0, 0, 0); this.meshes = []; this.updateBounds();
  }
  hasModel() { return this.meshes.length > 0; }

  /** Wireframe is a light line overlay on the solid surface, so it stays readable on any colour/background. */
  setWireframe(on: boolean) {
    this.wire = on;
    this.meshes.forEach((m) => {
      const old = m.getObjectByName('wf');
      if (old) { m.remove(old); (old as THREE.LineSegments).geometry.dispose(); ((old as THREE.LineSegments).material as THREE.Material).dispose(); }
      if (on) { const l = new THREE.LineSegments(new THREE.WireframeGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffd3ee })); l.name = 'wf'; m.add(l); }
    });
  }
  setColor(hex: string | null, parts: Part[]) { parts.forEach((p) => this.setPartColor(p.id, hex)); }
  setPartColor(id: number, hex: string | null) { const m = this.meshes[id]; if (!m) return; mats(m).forEach((x) => { if (x.color) x.color.set(hex ?? this.orig(m)); }); }
  private orig(m: THREE.Mesh) { return (m.userData.orig ??= '#' + (mats(m)[0].color?.getHexString() ?? 'cfd2dc')); }
  captureOriginals() { this.meshes.forEach((m) => this.orig(m)); }
  setPartVisible(id: number, v: boolean) { const m = this.meshes[id]; if (m) m.visible = v; this.updateBounds(); }
  setOffset(x: number, z: number) { this.placed.position.set(x, 0, z); this.updateBounds(); }
  setRotationY(deg: number) { this.placed.rotation.y = THREE.MathUtils.degToRad(deg); this.updateBounds(); }

  private box() { this.placed.updateMatrixWorld(true); const b = new THREE.Box3(); this.meshes.forEach((m) => { if (m.visible) b.expandByObject(m); }); return b; }
  private updateBounds() { const b = this.box(); if (!b.isEmpty()) this.bounds.box.copy(b); else this.bounds.box.makeEmpty(); }
  measure() {
    const b = this.box(); if (b.isEmpty()) return null;
    const s = b.getSize(new THREE.Vector3()); const size = { x: s.x, y: s.z, z: s.y }; // W x D x H (print axes)
    const inBed = b.min.x >= -this.printer.x / 2 - 0.01 && b.max.x <= this.printer.x / 2 + 0.01 && b.min.z >= -this.printer.y / 2 - 0.01 && b.max.z <= this.printer.y / 2 + 0.01;
    return { size, volume: fitsBed(size, this.printer), inBed };
  }

  setView(v: ViewName) {
    const b = this.box(); const bed = Math.max(this.printer.x, this.printer.y) * 0.5;
    const c = b.isEmpty() ? new THREE.Vector3(0, bed * 0.2, 0) : b.getCenter(new THREE.Vector3());
    const r = b.isEmpty() ? bed : b.getBoundingSphere(new THREE.Sphere()).radius;
    const dist = (Math.max(r, 20) / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.05;
    const d = new THREE.Vector3(...DIRS[v]).normalize();
    this.controls.target.copy(c); this.camera.position.copy(c).addScaledVector(d, dist); this.camera.near = dist / 100; this.camera.far = dist * 20; this.camera.updateProjectionMatrix(); this.controls.update();
  }
  /** Default 3/4 view */
  resetView() {
    this.setView('front'); const t = this.controls.target, off = this.camera.position.clone().sub(t);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 5).y += off.length() * 0.45; this.camera.position.copy(t).add(off); this.controls.update();
  }
  snapshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }
  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.io.disconnect(); this.controls.dispose(); this.clearModel(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
