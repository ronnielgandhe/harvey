"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface Props {
  /** When live, show pulsing dot + call timer */
  live?: boolean;
  /** "center" = hero slot (idle); "corner" = bottom-left corner (in-call).
   *  Transitions smoothly between them via framer-motion. */
  variant?: "center" | "corner";
}

// Boot sequence timings (ms) — tuned for a deliberate, cinematic pace.
// 0 → INTRO_FADE       : slash fades up from white; PSL + Bluejay stay hidden
// 900 → 1700           : PSL slides out from behind the slash (left)
// 1400 → 2200          : Bluejay slides out from behind the slash (right)
// INTRO_FADE → HOLD    : full assembly holds centered
// HOLD → END           : long expo-out glide up to the hero slot
const INTRO_FADE = 1400;
const SPLASH_HOLD = 4300;
const TRAVEL_DURATION = 2400;
const OVERLAY_FADE = 1800;

function fmtElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function PearsonHeader({ live = false, variant = "center" }: Props) {
  const [elapsed, setElapsed] = useState(0);
  // `booted` flips at the end of the SPLASH_HOLD; framer-motion then
  // animates the logos from centered-big → final resting slot.
  const [booted, setBooted] = useState(false);
  // `overlayGone` flips after the travel animation finishes so the white
  // overlay is removed from the DOM entirely.
  const [overlayGone, setOverlayGone] = useState(false);

  // Boot kickoff — runs on every mount so the splash plays on every
  // hard-refresh while we iterate.
  useEffect(() => {
    const t1 = setTimeout(() => setBooted(true), SPLASH_HOLD);
    const t2 = setTimeout(
      () => setOverlayGone(true),
      SPLASH_HOLD + TRAVEL_DURATION + 600,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!live) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [live]);

  // Measure the element + viewport and compute ALL positions as pixel
  // offsets from viewport center. Unified unit type = no interpolation
  // jitter. Container is `fixed top: 50%; left: 50%` so translate(0, 0)
  // means "element top-left at screen center" — translate by -w/2, -h/2
  // to center it, then apply per-state offsets.
  const innerRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({
    elW: 500,
    elH: 200,
    vpW: 1440,
    vpH: 900,
  });

  useEffect(() => {
    const update = () => {
      const el = innerRef.current;
      setMetrics({
        elW: el?.offsetWidth ?? 500,
        elH: el?.offsetHeight ?? 200,
        vpW: window.innerWidth,
        vpH: window.innerHeight,
      });
    };
    update();
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => {
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, []);

  // Pose helpers — all in pixels.
  const { elW, elH, vpH } = metrics;
  const CORNER_SCALE = 0.72; // bumped up per request — bigger in corner
  const CORNER_PAD = 28;

  // Splash / center: visually CENTERED horizontally. To center an element
  // anchored at top-left at screen center, translate by -elW/2.
  const splashPose = { x: -elW / 2, y: -elH / 2, scale: 2 };
  // Center pose = 42vh from top. Center at 50vh = y translate of -elH/2;
  // 42vh = 50vh − 0.08 * vpH, so offset upward by 0.08 * vpH.
  const centerPose = {
    x: -elW / 2,
    y: -elH / 2 - 0.08 * vpH,
    scale: 1,
  };
  // Corner pose: the SCALED element's bottom-left sits at (PAD, vpH−PAD).
  // Because the translation origin is top-left of the UN-scaled box,
  // and the scale happens around the element's center, the final
  // bounding box in pixel terms is elW*scale × elH*scale centered at
  // (translate + elW/2, translate + elH/2). Solve for translate so the
  // bottom-left of the scaled box = (PAD, vpH−PAD):
  //   scaled_left = tx + elW/2 - elW*scale/2 = PAD - viewportCenterX
  //   scaled_bot  = ty + elH/2 + elH*scale/2 = (vpH − PAD) - viewportCenterY
  const cornerPose = {
    x: CORNER_PAD - metrics.vpW / 2 - elW / 2 + (elW * CORNER_SCALE) / 2,
    y:
      vpH -
      CORNER_PAD -
      vpH / 2 -
      elH / 2 -
      (elH * CORNER_SCALE) / 2,
    scale: CORNER_SCALE,
  };

  const target = !booted
    ? splashPose
    : variant === "corner"
      ? cornerPose
      : centerPose;

  return (
    <>
      {/* Full-screen white overlay that hides the page during splash, then
          fades out slowly as the logos glide to the header — longer fade
          reinforces the cinematic pace. */}
      <AnimatePresence>
        {!overlayGone && (
          <motion.div
            key="boot-overlay"
            className="fixed inset-0 z-40 bg-white"
            initial={{ opacity: 1 }}
            animate={{ opacity: booted ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: OVERLAY_FADE / 1000,
              ease: [0.19, 1, 0.22, 1],
              delay: booted ? 0.4 : 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* The logo row — fades up from white on mount, holds centered, then
          glides to either the hero slot (idle) or the bottom-left corner
          (in-call) based on `variant`. */}
      <motion.div
        className="pointer-events-none fixed left-1/2 top-1/2 z-50"
        ref={innerRef}
        initial={{ ...splashPose, scale: 1.86, opacity: 0 }}
        animate={{ ...target, opacity: 1 }}
        transition={{
          top: { duration: TRAVEL_DURATION / 1000, ease: [0.19, 1, 0.22, 1] },
          left: { duration: TRAVEL_DURATION / 1000, ease: [0.19, 1, 0.22, 1] },
          bottom: { duration: TRAVEL_DURATION / 1000, ease: [0.19, 1, 0.22, 1] },
          x: { duration: TRAVEL_DURATION / 1000, ease: [0.19, 1, 0.22, 1] },
          y: { duration: TRAVEL_DURATION / 1000, ease: [0.19, 1, 0.22, 1] },
          scale: { duration: TRAVEL_DURATION / 1000, ease: [0.19, 1, 0.22, 1] },
          opacity: { duration: INTRO_FADE / 1000, ease: [0.22, 0.9, 0.25, 1] },
        }}
      >
        {/* Editorial "disjointed" layout — PSL floats high, Bluejay drops
            low, an oversized slash cuts diagonally between them. */}
        <div className="pointer-events-auto -ml-5 flex items-center gap-2">
          {/* PSL appears FIRST, alone — rises up from below while fading
              in. Expo-out curve for a filmic settle. Ends at ~2.0s. */}
          <motion.img
            src="/psl-logo.png"
            alt="Pearson Specter Litt"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{
              duration: 1.4,
              delay: 0.5,
              ease: [0.22, 0.9, 0.25, 1],
            }}
            style={{ filter: "brightness(0)", translateY: 8 }}
            className="h-[148px] w-auto flex-shrink-0"
          />
          {/* Slash + Bluejay reveal TOGETHER, left-to-right, as a single
              "/Bluejay" unit. Starts while PSL is still settling its last
              150ms — keeps the hand-off seamless with no dead beat. */}
          <motion.span
            aria-hidden
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{
              duration: 0.9,
              delay: 1.5,
              ease: [0.22, 0.9, 0.25, 1],
            }}
            className="relative z-20 -ml-[72px] font-display font-thin leading-none text-black"
            style={{
              fontSize: "115px",
              transform: "translateY(6px) skewX(-6deg)",
              letterSpacing: "-0.04em",
              isolation: "isolate",
            }}
          >
            /
          </motion.span>
          <motion.img
            src="/bluejay-head.png?v=black"
            alt="Bluejay"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{
              duration: 1.3,
              delay: 2.0,
              ease: [0.22, 0.9, 0.25, 1],
            }}
            style={{ translateY: 11 }}
            className="h-[64px] w-auto flex-shrink-0"
          />
        </div>
      </motion.div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// LiveIndicator — standalone "● LIVE MM:SS" pill, larger and more
// prominent than the old inline version. Renders in the bottom-right
// corner during a call so the user clearly sees recording is active.
// ────────────────────────────────────────────────────────────────────────
export function LiveIndicator() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[var(--crimson)]/50 bg-[rgba(255,255,255,0.92)] px-5 py-2.5 shadow-[0_6px_32px_-12px_rgba(220,38,38,0.35)] backdrop-blur">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--crimson)] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--crimson)]" />
        </span>
        <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.32em] text-[var(--crimson)]">
          Live
        </span>
        <span className="font-mono text-[13px] tabular-nums text-[var(--crimson)]">
          {fmtElapsed(elapsed)}
        </span>
      </div>
    </div>
  );
}
