"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, Torus, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function createParticlePositions(count: number) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }
  return pos;
}

const HERO_SCENE_ITEMS = Array.from({ length: 12 }, (_, index) => ({
  position: [
    (Math.random() - 0.5) * 14,
    (Math.random() - 0.5) * 8,
    (Math.random() - 0.5) * 4 - 2,
  ] as [number, number, number],
  scale: Math.random() * 0.6 + 0.2,
  speed: Math.random() * 0.5 + 0.2,
  type: Math.random() > 0.5 ? "sphere" : "torus",
  index,
}));

function FloatingGeometry() {
  const groupRef = useRef<THREE.Group>(null);
  const items = HERO_SCENE_ITEMS;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {items.map((item, i) => (
        <Float key={i} speed={item.speed} rotationIntensity={0.4} floatIntensity={0.8}>
          {item.type === "sphere" ? (
            <Sphere args={[item.scale, 32, 32]} position={item.position}>
              <MeshDistortMaterial
                color={i % 3 === 0 ? "#6d3ee0" : i % 3 === 1 ? "#3ddaee" : "#e2f72a"}
                roughness={0.3}
                metalness={0.2}
                distort={0.3}
                speed={1.5}
                transparent
                opacity={0.15}
              />
            </Sphere>
          ) : (
            <Torus args={[item.scale * 1.5, item.scale * 0.2, 16, 32]} position={item.position}>
              <meshStandardMaterial
                color={i % 3 === 0 ? "#3ddaee" : i % 3 === 1 ? "#6d3ee0" : "#e43c20"}
                roughness={0.4}
                metalness={0.3}
                transparent
                opacity={0.12}
                wireframe
              />
            </Torus>
          )}
        </Float>
      ))}
    </group>
  );
}

const PARTICLE_POSITIONS = createParticlePositions(200);

function ParticleField() {
  const positions = PARTICLE_POSITIONS;
  const ref = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#6d3ee0" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

export function HeroThreeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 1.5]}
      style={{ background: "transparent" }}
    >
      {/* Local lights only — the previous <Environment preset="city" /> fetched a
          1.5 MB HDR from raw.githubusercontent.com at runtime, which dominated the
          home page's payload and tied its visuals to an external CDN. These
          translucent low-opacity shapes only need soft directional fill. */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} color="#ffffff" />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#6d3ee0" />
      <pointLight position={[-5, -3, -3]} intensity={0.3} color="#3ddaee" />
      <FloatingGeometry />
      <ParticleField />
    </Canvas>
  );
}
