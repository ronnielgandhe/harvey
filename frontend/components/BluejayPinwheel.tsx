"use client";

import { motion } from "framer-motion";

interface Props {
  size?: number;
  flownBlades?: number[];
  flyingBlade?: { index: number; targetX: number; targetY: number } | null;
  pulse?: boolean;
  /** Per-band microphone volumes (0..1 each). When provided, the
   *  individual wings push outward from center based on their band. */
  micBands?: number[];
}

const WING_COUNT = 6;

/**
 * Wireframe-outline version of the full bluejay logo, rendered in an
 * SVG with an edge-detection filter. Used for each wing's clipped
 * instance (the outline is identical between wings — the clip-path
 * on the wrapper is what gives each wing its unique 60° slice).
 */
function WireframeLogoFull({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 280 280"
      width={size}
      height={size}
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
      className="block"
    >
      <defs>
        <filter
          id="bluejay-wireframe"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius="0.7"
            result="dilated"
          />
          <feMorphology
            in="SourceAlpha"
            operator="erode"
            radius="0.2"
            result="eroded"
          />
          <feComposite
            in="dilated"
            in2="eroded"
            operator="out"
            result="outline"
          />
          <feFlood floodColor="#1a1a1a" result="ink" />
          <feComposite in="ink" in2="outline" operator="in" />
        </filter>
      </defs>
      <image
        href="/bluejay.png"
        width={280}
        height={280}
        filter="url(#bluejay-wireframe)"
      />
    </svg>
  );
}

/**
 * Returns a `clip-path: polygon(...)` string that masks the element to
 * a 60° pie slice whose CENTER ray points in the given math-angle
 * (degrees; 0° = right, 90° = down, -90° = up).
 *
 * Polygon: 3 points (center of element, two far points at ±30° from
 * the ray direction). r=200% ensures the far points are well outside
 * the element's box so the triangular slice fully covers the pie slice.
 */
function wingClipPolygon(angleDeg: number): string {
  const a1 = ((angleDeg - 30) * Math.PI) / 180;
  const a2 = ((angleDeg + 30) * Math.PI) / 180;
  const r = 200; // percentage units — well beyond the 100×100 box
  const x1 = 50 + r * Math.cos(a1);
  const y1 = 50 + r * Math.sin(a1);
  const x2 = 50 + r * Math.cos(a2);
  const y2 = 50 + r * Math.sin(a2);
  return `polygon(50% 50%, ${x1}% ${y1}%, ${x2}% ${y2}%)`;
}

export function BluejayPinwheel({
  size = 280,
  flownBlades = [],
  flyingBlade = null,
  pulse = false,
  micBands,
}: Props) {
  const flownCount = flownBlades.length;
  const baseOpacity = Math.max(0.55, 1 - flownCount * 0.075);
  const isBursting = !!flyingBlade;

  // Average volume drives a very subtle overall breath on the rotor
  // body (NOT per keyframe — a single scalar so there's no flicker
  // between burst and non-burst code paths).
  const avgVol =
    micBands && micBands.length > 0
      ? micBands.reduce((a, b) => a + b, 0) / micBands.length
      : 0;
  const micScale = 1 + Math.min(0.04, avgVol * 0.18);

  // Wing tips point UP at 12 o'clock (math-angle -90°) and step by 60°
  // clockwise around the circle. Each wing reacts to its own FFT band:
  //   - radial push outward (the "throb"), larger than before so it
  //     reads from across the room
  //   - brighter opacity when hot (the "audio wave" glow)
  //   - no uniform scale on the wing body — that was reading as the
  //     wireframe edges thickening, which looked like deformation
  const wings = Array.from({ length: WING_COUNT }, (_, i) => {
    const mathAngle = -90 + i * 60; // -90, -30, 30, 90, 150, 210
    const vol = Math.min(1, (micBands?.[i] ?? 0) * 2.4);
    const push = vol * (size * 0.11);
    const dx = Math.cos((mathAngle * Math.PI) / 180) * push;
    const dy = Math.sin((mathAngle * Math.PI) / 180) * push;
    return {
      clip: wingClipPolygon(mathAngle),
      translate: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
      // Wing fades up with its band. Base 0.82 so idle wings still
      // read, peak 1.0 so hot wings are crisp black.
      opacity: 0.82 + vol * 0.18,
      // Soft drop-shadow brightens on hot bands. Gives the "audio
      // wave" glow without redrawing the wireframe edges.
      filter: `drop-shadow(0 0 ${(vol * 6).toFixed(2)}px rgba(26,26,26,${(
        vol * 0.5
      ).toFixed(2)}))`,
    };
  });

  return (
    <div
      className="relative inline-block select-none"
      style={{ width: size, height: size }}
    >
      {/* The rotor — spins the whole wing assembly. Individual wing
          audio-reactive transforms happen INSIDE this, so they rotate
          with the logo and always push outward relative to the wing's
          current orientation. Scale is a single scalar (not keyframes)
          so there is no glitchy swing between animation states. */}
      <motion.div
        className="absolute inset-0"
        animate={{
          rotate: 360,
          scale: micScale,
        }}
        transition={{
          rotate: {
            duration: pulse ? 5 : 14,
            repeat: Infinity,
            ease: "linear",
          },
          scale: { duration: 0.12, ease: [0.4, 0.0, 0.2, 1] },
        }}
        style={{
          opacity: baseOpacity,
          transition: "opacity 600ms ease",
          willChange: "transform",
          backfaceVisibility: "hidden",
          transformStyle: "preserve-3d",
          contain: "paint",
        }}
      >
        {/* 6 clipped copies of the full logo. Each copy is masked to
            ONE 60° pie slice, so you only see one wing per copy. The
            per-copy transform pushes that wing outward based on its
            mic band's volume. Pure translate, no scale — wireframe
            edges stay the same weight regardless of audio level. */}
        {wings.map((w, i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              clipPath: w.clip,
              WebkitClipPath: w.clip,
              transform: w.translate,
              opacity: w.opacity,
              filter: w.filter,
              transition: "transform 80ms linear, opacity 120ms linear, filter 120ms linear",
              willChange: "transform, opacity, filter",
            }}
          >
            <WireframeLogoFull size={size} />
          </div>
        ))}
      </motion.div>

      {/* Flying detached blade — legacy evidence-wall effect */}
      {flyingBlade && (
        <motion.div
          key={`fly-${flyingBlade.index}-${flyingBlade.targetX}-${flyingBlade.targetY}`}
          className="absolute"
          style={{
            top: "50%",
            left: "50%",
            width: size * 0.28,
            height: size * 0.28,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
          animate={{
            x: flyingBlade.targetX,
            y: flyingBlade.targetY,
            scale: 0.18,
            opacity: 0,
            rotate: 280,
          }}
          transition={{ duration: 0.85, ease: [0.4, 0.0, 0.2, 1] }}
        >
          <WireframeLogoFull size={size * 0.28} />
        </motion.div>
      )}

      {/* Burst glow */}
      {isBursting && (
        <motion.div
          className="absolute inset-0 -z-10 rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.4, 0], scale: 1.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(139,115,85,0.25), transparent 70%)",
          }}
        />
      )}
    </div>
  );
}
