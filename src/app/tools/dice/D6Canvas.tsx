"use client";

import { useRef, useMemo, useEffect, Component, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Pip texture baked onto a canvas ─────────────────────────────────────────
// Uses 512×512 for sharpness and proper 18% inset margins (standard casino die)
function makeFaceTexture(pips: [number, number][], size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // ── Face background ──────────────────────────────────────────────────────
  // Full square fill — 3D geometry handles the shape, texture just needs colour
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#fdfaf4");
  bg.addColorStop(1, "#ede0c8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Very subtle face edge to give depth (not a rounded rect — just a straight inset ring)
  ctx.strokeStyle = "rgba(180,145,90,0.25)";
  ctx.lineWidth = size * 0.025;
  ctx.strokeRect(size * 0.025, size * 0.025, size * 0.95, size * 0.95);

  // ── Pip positions ────────────────────────────────────────────────────────
  // Standard casino die: pips at 20%, 50%, 80% of the face
  const slots = [size * 0.22, size * 0.5, size * 0.78]; // left/centre/right & top/centre/bottom
  const dotR = size * 0.08;  // pip radius = 8% of face

  pips.forEach(([col, row]) => {
    const cx = slots[col];
    const cy = slots[row];

    // Recessed shadow (behind pip, gives "carved" look)
    ctx.beginPath();
    ctx.arc(cx + size * 0.008, cy + size * 0.01, dotR * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fill();

    // Pip body — deep ebony gradient
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    const pg = ctx.createRadialGradient(
      cx - dotR * 0.3, cy - dotR * 0.35, 0,
      cx,              cy,               dotR
    );
    pg.addColorStop(0, "#2a1e0e");
    pg.addColorStop(1, "#0d0c08");
    ctx.fillStyle = pg;
    ctx.fill();

    // Specular highlight — top-left glint
    ctx.beginPath();
    ctx.arc(cx - dotR * 0.36, cy - dotR * 0.38, dotR * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8; // sharpen at oblique angles
  return tex;
}


// Casino pip layouts — [col, row] in 0-indexed 3×3 grid
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

// BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z → die values: right=4, left=3, top=5, bottom=2, front=1, back=6
const FACE_ORDER = [4, 3, 5, 2, 1, 6];

// Target rotation to show each face value facing the camera (+Z axis)
// Verified with Rx(θ) rotation matrix:
//   Rx(+π/2) maps +Y → +Z  ∴ +Y face (pip 5) faces camera  → value 5: [+π/2, 0, 0]
//   Rx(-π/2) maps -Y → +Z  ∴ -Y face (pip 2) faces camera  → value 2: [-π/2, 0, 0]
//   Ry(+π/2) maps -X → +Z  ∴ -X face (pip 3) faces camera  → value 3: [0, +π/2, 0]
//   Ry(-π/2) maps +X → +Z  ∴ +X face (pip 4) faces camera  → value 4: [0, -π/2, 0]
//   Ry(  π ) maps -Z → +Z  ∴ -Z face (pip 6) faces camera  → value 6: [0,   π,  0]
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],  // -Y face (pip 2) → camera
  3: [0, Math.PI / 2, 0],   // -X face (pip 3) → camera
  4: [0, -Math.PI / 2, 0],  // +X face (pip 4) → camera
  5: [Math.PI / 2, 0, 0],   // +Y face (pip 5) → camera
  6: [0, Math.PI, 0],       // -Z face (pip 6) → camera
};


// Very subtle resting tilt — just enough to read as 3D, result face always dominant
const VIEW_TILT: [number, number, number] = [-0.10, 0.14, 0.02];

// Normalize angle to [-π, π] using while loops (handles huge accumulated values)
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// ─── 3-D die mesh with robust animation ──────────────────────────────────────
function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Bake textures once
  const materials = useMemo(() =>
    FACE_ORDER.map((faceVal) =>
      new THREE.MeshStandardMaterial({
        map: makeFaceTexture(PIP_LAYOUTS[faceVal]),
        roughness: 0.25,
        metalness: 0.04,
      })
    ),
  []);

  // Target Euler for this value
  const target = useMemo(() => {
    const [rx, ry, rz] = FACE_ROTATIONS[value] ?? [0, 0, 0];
    return new THREE.Euler(rx + VIEW_TILT[0], ry + VIEW_TILT[1], rz + VIEW_TILT[2]);
  }, [value]);

  // 3-axis tumble velocities
  const rollVel = useRef({ x: 8, y: 12, z: 5 });
  // Spring velocity accumulator
  const springVel = useRef({ x: 0, y: 0, z: 0 });
  // Track transition edge
  const wasRolling = useRef(false);

  useEffect(() => {
    if (rolling) {
      // Randomise 3-axis tumble for each new roll
      rollVel.current = {
        x: (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 8),
        y: (Math.random() > 0.5 ? 1 : -1) * (7 + Math.random() * 10),
        z: (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 5),
      };
      wasRolling.current = true;
    }
  }, [rolling]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dt = Math.min(delta, 0.05);

    if (rolling) {
      // 3-axis chaotic tumble
      mesh.rotation.x += rollVel.current.x * dt;
      mesh.rotation.y += rollVel.current.y * dt;
      mesh.rotation.z += rollVel.current.z * dt;
    } else {
      // ── On the first frame after rolling stops, normalize accumulated rotations ──
      if (wasRolling.current) {
        wasRolling.current = false;
        springVel.current = { x: 0, y: 0, z: 0 };
        // Bring huge angle values back to [-π, π] so spring distance is tiny
        mesh.rotation.x = normalizeAngle(mesh.rotation.x);
        mesh.rotation.y = normalizeAngle(mesh.rotation.y);
        mesh.rotation.z = normalizeAngle(mesh.rotation.z);
      }

      // Spring settle toward target using shortest arc
      const stiffness = 7;
      const damping = 0.70;
      let totalErr = 0;

      (["x", "y", "z"] as const).forEach((axis) => {
        const diff = normalizeAngle(target[axis] - mesh.rotation[axis]);
        springVel.current[axis] = springVel.current[axis] * damping + diff * stiffness * dt;

        // NaN guard — if something went wrong, reset
        if (!isFinite(springVel.current[axis])) {
          springVel.current[axis] = 0;
        }

        mesh.rotation[axis] += springVel.current[axis];
        totalErr += Math.abs(diff);
      });

      // Snap when fully settled
      const velMag = Math.abs(springVel.current.x) + Math.abs(springVel.current.y) + Math.abs(springVel.current.z);
      if (totalErr < 0.01 && velMag < 0.01) {
        mesh.rotation.set(target.x, target.y, target.z);
        springVel.current = { x: 0, y: 0, z: 0 };
      }
    }
  });

  return (
    <mesh ref={meshRef} material={materials}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

// ─── Error boundary — prevents WebGL crash from whitescreening the whole page ─
class DieErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      // Graceful fallback die icon
      return (
        <div style={{
          width: 120, height: 120, display: "flex", alignItems: "center",
          justifyContent: "center", opacity: 0.5,
        }}>
          <svg viewBox="0 0 100 100" width={72} height={72} fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="12" y="12" width="76" height="76" rx="14" fill="rgba(255,255,255,0.08)" />
            <circle cx="50" cy="50" r="7" fill="currentColor" />
          </svg>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Public component ─────────────────────────────────────────────────────────
export default function D6Canvas({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <DieErrorBoundary>
      <div style={{ width: 120, height: 120 }}>
        <Canvas
          camera={{ position: [0, 0, 2.6], fov: 40 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight intensity={0.65} />
          {/* Key — warm from top-left */}
          <directionalLight position={[3, 5, 3]} intensity={1.5} color="#fff8f0" />
          {/* Fill — cool from right */}
          <directionalLight position={[-3, -1, 2]} intensity={0.55} color="#d0e0ff" />
          {/* Rim — warm from behind */}
          <directionalLight position={[0, -5, -5]} intensity={0.35} color="#ffddbb" />
          <Die value={value} rolling={rolling} />
        </Canvas>
      </div>
    </DieErrorBoundary>
  );
}
