"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Sphere, Float } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

export type OrbState = "idle" | "speaking" | "listening" | "thinking";

interface OrbProps {
  state?: OrbState;
  size?: number;
}

interface ReactiveSphereProps {
  state: OrbState;
}

function ReactiveSphere({ state }: ReactiveSphereProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matRef = useRef<any>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Targets per state
  const targets = useMemo(() => {
    return {
      idle: { distort: 0.28, speed: 1.1, color: new THREE.Color("#c9a961"), emissive: new THREE.Color("#3a2d12"), scale: 1.0 },
      speaking: { distort: 0.55, speed: 3.0, color: new THREE.Color("#e7c889"), emissive: new THREE.Color("#5a3f15"), scale: 1.06 },
      listening: { distort: 0.42, speed: 1.6, color: new THREE.Color("#8eb3c7"), emissive: new THREE.Color("#1a2a36"), scale: 1.02 },
      thinking: { distort: 0.36, speed: 2.0, color: new THREE.Color("#b89a64"), emissive: new THREE.Color("#2c2210"), scale: 1.0 },
    } as const;
  }, []);

  useFrame((_, delta) => {
    const t = targets[state];
    if (matRef.current && t) {
      // Lerp distort/speed
      const distortRef = matRef.current as unknown as { distort: number; speed: number };
      distortRef.distort = THREE.MathUtils.lerp(distortRef.distort ?? 0.3, t.distort, delta * 2.5);
      distortRef.speed = THREE.MathUtils.lerp(distortRef.speed ?? 1, t.speed, delta * 2.5);
      matRef.current.color.lerp(t.color, delta * 2.0);
      matRef.current.emissive.lerp(t.emissive, delta * 2.0);
    }
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.18;
      groupRef.current.rotation.x += delta * 0.06;
      const s = THREE.MathUtils.lerp(groupRef.current.scale.x, t.scale, delta * 3.5);
      groupRef.current.scale.set(s, s, s);
    }
  });

  return (
    <Float floatIntensity={0.6} rotationIntensity={0.3} speed={1.2}>
      <group ref={groupRef}>
        {/* Inner glowing core */}
        <Sphere args={[0.55, 32, 32]}>
          <meshBasicMaterial color="#3a2c12" transparent opacity={0.6} />
        </Sphere>

        {/* Main reactive sphere */}
        <Sphere args={[1, 96, 96]}>
          <MeshDistortMaterial
            ref={matRef}
            color="#c9a961"
            emissive="#3a2d12"
            emissiveIntensity={0.55}
            roughness={0.32}
            metalness={0.65}
            distort={0.3}
            speed={1.2}
          />
        </Sphere>

        {/* Outer halo wireframe */}
        <Sphere args={[1.18, 32, 32]}>
          <meshBasicMaterial
            color="#c9a961"
            wireframe
            transparent
            opacity={0.08}
          />
        </Sphere>
      </group>
    </Float>
  );
}

export function HarveyOrb({ state = "idle", size = 360 }: OrbProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative"
    >
      {/* Glow backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(201,169,97,0.22) 0%, rgba(201,169,97,0.06) 35%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} color="#fff7e2" />
        <directionalLight position={[-4, -2, -3]} intensity={0.55} color="#7a8aa6" />
        <pointLight position={[0, 0, 2.5]} intensity={0.6} color="#c9a961" />
        <Suspense fallback={null}>
          <ReactiveSphere state={state} />
        </Suspense>
      </Canvas>
    </div>
  );
}
