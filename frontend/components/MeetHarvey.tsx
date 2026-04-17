"use client";

import { motion } from "framer-motion";

/**
 * Signed "meet Harvey Specter" block. Sits on the LEFT of the idle
 * hero. Each line reveals with a left-to-right clip-path wipe, the
 * same technique the PSL × Bluejay logos use on splash — gives the
 * signature the same cinematic "written in, not faded in" feel. The
 * whole thing is timed to start AFTER the PSL/Bluejay splash has
 * finished its glide to the center pose, so the signature feels like
 * it appears in response to the logos settling.
 *
 * PSL splash timing:
 *   0.0s    mount
 *   4.3s    boot hold ends, logos begin gliding to center
 *   6.7s    glide completes (SPLASH_HOLD + TRAVEL_DURATION)
 *   6.9s    this block starts revealing
 */

// Absolute offsets (seconds from page mount) for each line's reveal
const START = 6.9;

export function MeetHarvey() {
  return (
    <div className="pointer-events-auto relative select-none">
      {/* "meet" — small italic serif lead-in, reveals first */}
      <motion.div
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{
          duration: 0.7,
          delay: START,
          ease: [0.22, 0.9, 0.25, 1],
        }}
        className="font-display italic text-[var(--foreground-muted)]"
        style={{ fontSize: "clamp(26px, 3vw, 36px)", lineHeight: 0.9 }}
      >
        meet
      </motion.div>

      {/* Handwritten signature — two-line stack, each line clip-path
          revealed left-to-right on its own beat. Generous negative
          clip-path inset (top & bottom) keeps the wipe from ever
          slicing a descender. Specter sits only slightly below
          Harvey — tight enough to feel like one hand signature,
          not two stacked lines. */}
      <div
        className="font-signature -mt-1 leading-[0.78] text-[#0e0e0e]"
        style={{ fontSize: "clamp(54px, 6.6vw, 86px)" }}
      >
        <motion.div
          initial={{ clipPath: "inset(-0.5em 100% -0.6em 0)" }}
          animate={{ clipPath: "inset(-0.5em 0% -0.6em 0)" }}
          transition={{
            duration: 1.1,
            delay: START + 0.35,
            ease: [0.22, 0.9, 0.25, 1],
          }}
          className="block"
        >
          <span
            aria-hidden
            className="block"
            style={{
              transform: "rotate(-3deg)",
              transformOrigin: "left bottom",
            }}
          >
            Harvey
          </span>
        </motion.div>

        <motion.div
          initial={{ clipPath: "inset(-0.5em 100% -0.6em 0)" }}
          animate={{ clipPath: "inset(-0.5em 0% -0.6em 0)" }}
          transition={{
            duration: 1.0,
            delay: START + 0.95,
            ease: [0.22, 0.9, 0.25, 1],
          }}
          // A small positive mt keeps the two words fully readable
          // (no letter overlap) but tucks Specter a hair closer to
          // Harvey than before so the signature feels like one hand,
          // not two stacked lines.
          className="mt-[0.05em] block pl-[0.6em]"
        >
          <span
            aria-hidden
            className="block"
            style={{
              fontSize: "0.8em",
              transform: "rotate(-2deg)",
              transformOrigin: "left bottom",
            }}
          >
            Specter
          </span>
        </motion.div>

        {/* Plain name for SR / SEO — the visible spans are aria-hidden */}
        <span className="sr-only">meet Harvey Specter</span>
      </div>
    </div>
  );
}
