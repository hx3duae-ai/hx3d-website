"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Grid, OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";

// 3MF / slicers use Z-up.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

export default function Scene({
  model,
  wireframe,
}: {
  model: THREE.Group | null;
  wireframe: boolean;
}) {
  useMemo(() => {
    model?.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          m.wireframe = wireframe;
          m.side = THREE.DoubleSide;
        });
      }
    });
  }, [model, wireframe]);

  return (
    <Canvas camera={{ position: [150, -150, 120], up: [0, 0, 1], fov: 45, near: 0.1, far: 5000 }}>
      <color attach="background" args={["#111418"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[100, -100, 200]} intensity={2} />
      <directionalLight position={[-100, 100, 50]} intensity={0.6} />
      <Grid
        rotation={[Math.PI / 2, 0, 0]}
        args={[250, 250]}
        cellSize={10}
        sectionSize={50}
        cellColor="#2a323c"
        sectionColor="#4a5666"
        fadeDistance={600}
        infiniteGrid
      />
      {model && (
        <Bounds fit clip observe margin={2.2}>
          <primitive object={model} />
        </Bounds>
      )}
      <OrbitControls makeDefault enableDamping />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport />
      </GizmoHelper>
    </Canvas>
  );
}
