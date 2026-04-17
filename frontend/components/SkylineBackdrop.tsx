"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

interface BuildingSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

// Z-length of one building "block". The block is rendered twice back-to-back,
// and the camera rig snaps back by exactly one block-length when it reaches
// the seam — so the flythrough loops forever without a visible reset.
const BLOCK_LENGTH = 310;

function CityBlock() {
  const groupRef = useRef<THREE.Group>(null!);

  const buildings: BuildingSpec[] = useMemo(() => {
    const out: BuildingSpec[] = [];
    const seed = (n: number) => {
      const x = Math.sin(n) * 10000;
      return x - Math.floor(x);
    };
    let i = 1;

    // Generate one block of buildings spanning z = -BLOCK_LENGTH..0.
    // Two columns per side with jitter, rows at moderately tight gaps along
    // Z for a dense-but-not-oppressive skyline.
    for (let z = -BLOCK_LENGTH; z < 0; z += 14 + seed(i++) * 6) {
      for (let xi = 0; xi < 2; xi++) {
        const x = 56 + xi * 22 + (seed(i++) - 0.5) * 4;
        const w = 7 + seed(i++) * 7;
        const d = 7 + seed(i++) * 7;
        const h = 18 + seed(i++) * 60;
        out.push({ x, z, width: w, depth: d, height: h });
      }
      for (let xi = 0; xi < 2; xi++) {
        const x = -56 - xi * 22 - (seed(i++) - 0.5) * 4;
        const w = 7 + seed(i++) * 7;
        const d = 7 + seed(i++) * 7;
        const h = 18 + seed(i++) * 60;
        out.push({ x, z, width: w, depth: d, height: h });
      }
    }
    return out;
  }, []);

  // Advance the whole rig forward, then wrap by exactly one block-length
  // when we reach the seam — the second block takes over the first's slot
  // seamlessly because both contain identical geometry.
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.z += delta * 6;
    if (groupRef.current.position.z >= BLOCK_LENGTH) {
      groupRef.current.position.z -= BLOCK_LENGTH;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Primary block — occupies z = [-BLOCK_LENGTH, 0] in rig space */}
      <group>
        {buildings.map((b, idx) => (
          <Building key={`a-${idx}`} {...b} />
        ))}
      </group>
      {/* Trailing block — placed one block-length behind so that as the rig
          advances it slides forward into the primary block's position,
          giving an infinite corridor effect. */}
      <group position={[0, 0, -BLOCK_LENGTH]}>
        {buildings.map((b, idx) => (
          <Building key={`b-${idx}`} {...b} />
        ))}
      </group>
    </group>
  );
}

function Building({ x, z, width, depth, height }: BuildingSpec) {
  const geo = useMemo(() => {
    const box = new THREE.BoxGeometry(width, height, depth);
    return new THREE.EdgesGeometry(box);
  }, [width, height, depth]);

  return (
    <lineSegments geometry={geo} position={[x, height / 2, z]}>
      <lineBasicMaterial
        color="#1a1a1a"
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function CameraDrift() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.y = 14 + Math.sin(t * 0.25) * 0.8;
    camera.position.x = Math.sin(t * 0.15) * 0.6;
    camera.lookAt(0, 14, -100);
  });
  return null;
}

/**
 * Rectangular grid strip (not a square gridHelper). Used to place floor grids
 * only under the building clusters so the middle corridor stays clean white.
 */
function SideGrid({
  xCenter,
  width = 180,
  depth = 520,
  cellSize = 10,
}: {
  xCenter: number;
  width?: number;
  depth?: number;
  cellSize?: number;
}) {
  const geo = useMemo(() => {
    const points: number[] = [];
    const xStart = xCenter - width / 2;
    const xEnd = xCenter + width / 2;
    const zStart = -depth / 2;
    const zEnd = depth / 2;
    // Lines parallel to Z
    for (let x = xStart; x <= xEnd + 0.001; x += cellSize) {
      points.push(x, 0, zStart, x, 0, zEnd);
    }
    // Lines parallel to X
    for (let z = zStart; z <= zEnd + 0.001; z += cellSize) {
      points.push(xStart, 0, z, xEnd, 0, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    return g;
  }, [xCenter, width, depth, cellSize]);

  return (
    <lineSegments geometry={geo} position={[0, 0, -100]}>
      <lineBasicMaterial
        color="#1a1a1a"
        transparent
        opacity={0.38}
        depthWrite={false}
      />
    </lineSegments>
  );
}

interface Props {
  dimmed?: boolean;
}

export function SkylineBackdrop({ dimmed = false }: Props) {
  // Radial reveal — the skyline is fully rendered at z=0 from mount
  // but a page-colored overlay sits on top, punched with a growing
  // circular hole at the PSL/Bluejay vanishing point. As the splash
  // logos glide to center, the hole grows outward so buildings
  // "arrive" at the viewer.
  //
  // We animate the circle's `r` via framer-motion (not CSS
  // transitions on SVG attrs — those are browser-flaky) to guarantee
  // a smooth 5-second grow. Radius is computed in pixels from the
  // current viewport so it always clears corners regardless of size.
  const [vpMax, setVpMax] = useState(1920);
  useEffect(() => {
    const update = () =>
      setVpMax(Math.max(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Signals the "go" moment — flips true 4.3s after mount (same
  // instant PearsonHeader unlocks its splash hold). framer-motion
  // sees the `animate.r` change and runs the 5s expo-out transition.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setStarted(true), 4300);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: 0,
        opacity: dimmed ? 0.45 : 0.85,
        transition: "opacity 800ms ease",
      }}
    >
      <Canvas
        camera={{ position: [0, 14, 0], fov: 70, near: 0.1, far: 500 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        }}
        style={{ background: "transparent" }}
      >
        <CameraDrift />
        <CityBlock />
        {/* Floor grids only under building clusters — center corridor stays clean white */}
        <SideGrid xCenter={120} width={170} />
        <SideGrid xCenter={-120} width={170} />
        {/* Heavier fog to fade the recycle pop and add depth */}
        <fog attach="fog" args={["#FAFAF8", 60, 280]} />
      </Canvas>

      {/* Reveal overlay — full-viewport bg-colored rect with a black
          hole at center. SVG mask: the rect is drawn only where the
          mask is white, so the growing black circle progressively
          removes the overlay's coverage.
          NB: SVG `fill` does NOT resolve CSS custom properties, so the
          page background color (--background = #FAFAF8) has to be
          hard-coded here. Keep this in sync with globals.css if it
          ever changes. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="skyline-reveal-mask">
            <rect width="100%" height="100%" fill="white" />
            <motion.circle
              cx="50%"
              cy="48%"
              fill="black"
              initial={{ r: 0 }}
              animate={{ r: started ? vpMax * 1.3 : 0 }}
              transition={{ duration: 5, ease: [0.19, 1, 0.22, 1] }}
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="#FAFAF8"
          mask="url(#skyline-reveal-mask)"
        />
      </svg>
    </div>
  );
}
