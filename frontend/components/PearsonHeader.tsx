"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  /** When live, show pulsing dot + call timer */
  live?: boolean;
  /** "center" = hero slot (idle); "corner" = bottom-left corner (in-call).
   *  Transitions smoothly between them via framer-motion. */
  variant?: "center" | "corner";
  /** If provided, renders a subtle "READ DOCS" link directly beneath
   *  the logo row — but only in the "center" (idle) pose, and only
   *  after the boot splash has finished. Clicking calls this. */
  onOpenDocs?: () => void;
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
// Shortened from 1800ms so the white splash overlay clears quickly
// once the logos start their glide — lets the skyline reveal
// animation (which starts at the same moment) actually be visible
// during the glide window, not hidden under the overlay.
const OVERLAY_FADE = 600;

function fmtElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function PearsonHeader({
  live = false,
  variant = "center",
  onOpenDocs,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  // `booted` flips at the end of the SPLASH_HOLD; framer-motion then
  // animates the logos from centered-big → final resting slot.
  const [booted, setBooted] = useState(false);
  // `overlayGone` flips after the travel animation finishes so the white
  // overlay is removed from the DOM entirely.
  const [overlayGone, setOverlayGone] = useState(false);
  // `initialTravelDone` flips after the FIRST splash→final glide
  // finishes. Subsequent pose changes (e.g. corner→center when a call
  // ends) use a much shorter duration so the page doesn't feel like
  // it's replaying the boot each time.
  const [initialTravelDone, setInitialTravelDone] = useState(false);

  // Boot kickoff — runs on every mount so the splash plays on every
  // hard-refresh while we iterate.
  useEffect(() => {
    const t1 = setTimeout(() => setBooted(true), SPLASH_HOLD);
    const t2 = setTimeout(
      () => setOverlayGone(true),
      SPLASH_HOLD + TRAVEL_DURATION + 600,
    );
    const t3 = setTimeout(
      () => setInitialTravelDone(true),
      SPLASH_HOLD + TRAVEL_DURATION + 200,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
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

  // Initial splash→final glide is slow + cinematic (2.4s). Anything
  // AFTER that (end-of-call return, etc.) should feel snappy: 700ms.
  const poseDurSec = initialTravelDone ? 0.7 : TRAVEL_DURATION / 1000;

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
              // No delay once booted flips — clear the overlay fast
              // so the skyline reveal is visible as the logos glide.
              delay: 0,
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
          top: { duration: poseDurSec, ease: [0.19, 1, 0.22, 1] },
          left: { duration: poseDurSec, ease: [0.19, 1, 0.22, 1] },
          bottom: { duration: poseDurSec, ease: [0.19, 1, 0.22, 1] },
          x: { duration: poseDurSec, ease: [0.19, 1, 0.22, 1] },
          y: { duration: poseDurSec, ease: [0.19, 1, 0.22, 1] },
          scale: { duration: poseDurSec, ease: [0.19, 1, 0.22, 1] },
          opacity: { duration: INTRO_FADE / 1000, ease: [0.22, 0.9, 0.25, 1] },
        }}
      >
        {/* Editorial "disjointed" layout — PSL floats high, Bluejay drops
            low, an oversized slash cuts diagonally between them. */}
        <div className="pointer-events-auto relative -ml-5 flex items-center gap-2">
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

          {/* READ DOCS used to live here, nested inside this motion.div.
              That caused it to glide along with the logo during pose
              changes (splash → center, end-of-call corner → center).
              Now it's a standalone fixed element further down so the
              button never moves — it just fades in/out based on whether
              the logos are in the center pose. */}
        </div>
      </motion.div>

      {/* READ DOCS (standalone). Decoupled from the logo motion group
          so the end-of-call corner→center glide no longer drags the
          button across the screen. Positioned under where the Bluejay
          side of the center-pose logo lands. Fades in only when:
            - The initial splash glide is done
            - The header is in the "center" variant (idle, not in-call)
          Goes to 0 instantly on variant=corner so it vanishes when a
          call starts / reappears only when we return to center. */}
      {onOpenDocs && (
        <motion.button
          type="button"
          onClick={onOpenDocs}
          initial={{ opacity: 0, y: 4 }}
          animate={{
            opacity: initialTravelDone && variant === "center" ? 1 : 0,
            y: initialTravelDone && variant === "center" ? 0 : 4,
          }}
          transition={{
            // Land AFTER MeetHarvey + phone settle on the first load.
            // On subsequent variant swaps (corner→center), keep it
            // snappy — a short 0.35s fade.
            duration: initialTravelDone && variant === "center" ? 0.55 : 0.35,
            delay:
              // First cinematic only: wait for hero signature + phone
              // to finish. Otherwise: immediate.
              initialTravelDone && variant === "center" && !_readDocsShownOnce
                ? 2.3
                : 0.05,
            ease: [0.19, 1, 0.22, 1],
          }}
          onAnimationComplete={() => {
            if (variant === "center" && initialTravelDone) {
              _readDocsShownOnce = true;
            }
          }}
          style={{
            position: "fixed",
            top: "calc(42vh + 68px)",
            left: "calc(50% + 150px)",
            zIndex: 55,
            pointerEvents:
              initialTravelDone && variant === "center" ? "auto" : "none",
          }}
          className="group inline-flex items-center gap-1.5 border-b border-transparent pb-0.5 font-mono text-[10px] uppercase tracking-[0.38em] text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
        >
          Read docs
          <ArrowUpRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={2}
          />
        </motion.button>
      )}
    </>
  );
}

// Module-scoped: true once Read Docs has played its slow "land with
// the hero" reveal once. Subsequent appearances (after a call ends)
// use the snappier fade — no need to re-wait 2.3s every time.
let _readDocsShownOnce = false;

// ────────────────────────────────────────────────────────────────────────
// LiveIndicator — "● LIVE MM:SS" pill pinned bottom-right. Accepts
// optional `elapsedSec` + `paused` so a parent can drive it externally
// (e.g. the OTR toggle in CallInterface). Falls back to an internal
// self-ticking timer if no props are passed.
// ────────────────────────────────────────────────────────────────────────
export function LiveIndicator({
  elapsedSec,
  paused = false,
}: {
  elapsedSec?: number;
  paused?: boolean;
} = {}) {
  const [internal, setInternal] = useState(0);
  useEffect(() => {
    if (elapsedSec !== undefined) return; // parent drives
    const start = Date.now();
    const id = setInterval(
      () => setInternal(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [elapsedSec]);

  const shown = elapsedSec !== undefined ? elapsedSec : internal;
  const borderClass = paused
    ? "border-[var(--foreground-faint)]/50"
    : "border-[var(--crimson)]/50";
  const textClass = paused ? "text-[var(--foreground-muted)]" : "text-[var(--crimson)]";
  const dotBg = paused ? "bg-[var(--foreground-faint)]" : "bg-[var(--crimson)]";
  const shadow = paused
    ? "shadow-[0_6px_32px_-12px_rgba(80,80,80,0.25)]"
    : "shadow-[0_6px_32px_-12px_rgba(220,38,38,0.35)]";

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40">
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-full border bg-[rgba(255,255,255,0.92)] px-5 py-2.5 backdrop-blur ${borderClass} ${shadow}`}
      >
        <span className="relative flex h-2.5 w-2.5">
          {!paused && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotBg} opacity-75`}
            />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotBg}`} />
        </span>
        <span
          className={`font-mono text-[13px] font-semibold uppercase tracking-[0.32em] ${textClass}`}
        >
          {paused ? "Paused" : "Live"}
        </span>
        <span className={`font-mono text-[13px] tabular-nums ${textClass}`}>
          {fmtElapsed(shown)}
        </span>
      </div>
    </div>
  );
}
