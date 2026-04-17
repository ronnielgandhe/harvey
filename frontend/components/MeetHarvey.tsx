"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

/**
 * Signed "meet Harvey Specter" block. Sits on the LEFT of the idle
 * hero.
 *
 * Two reveal modes:
 *
 *   CINEMATIC (first page load only)
 *     Starts at 6.9s mark, each line wipes in with a clip-path from
 *     left to right — matches the PSL × Bluejay glide-to-center pose
 *     so the signature lands like a sign-off on the logo.
 *
 *   INSTANT (every subsequent remount — e.g. "Back" from receipt)
 *     Just a short opacity fade. The user expects a snappy return, not
 *     another two-second cinematic they just sat through.
 *
 * The cinematic/instant flag is module-scoped so it survives
 * component unmount/remount within the same session.
 */

const FIRST_START = 6.9;
let cinematicHasPlayed = false;

export function MeetHarvey() {
  const mode = useMemo<"cinematic" | "instant">(() => {
    if (cinematicHasPlayed) return "instant";
    cinematicHasPlayed = true;
    return "cinematic";
  }, []);

  // INSTANT mode — short-cinematic reveal (~1.5s total). Same
  // clip-path wipe as the first-load version but compressed and with
  // zero startup delay so "Back" still feels snappy without losing
  // all the handwriting drama. Phone CTA on the right syncs to the
  // same total duration (see CallCTA.tsx).
  if (mode === "instant") {
    return (
      <div className="pointer-events-auto relative select-none">
        <motion.div
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 0.45, delay: 0, ease: [0.22, 0.9, 0.25, 1] }}
          className="font-display italic text-[var(--foreground-muted)]"
          style={{ fontSize: "clamp(26px, 3vw, 36px)", lineHeight: 0.9 }}
        >
          meet
        </motion.div>

        <div
          className="font-signature -mt-1 leading-[0.78] text-[#0e0e0e]"
          style={{ fontSize: "clamp(54px, 6.6vw, 86px)" }}
        >
          <motion.div
            initial={{ clipPath: "inset(-0.5em 100% -0.6em 0)" }}
            animate={{ clipPath: "inset(-0.5em 0% -0.6em 0)" }}
            transition={{
              duration: 0.7,
              delay: 0.25,
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
              duration: 0.65,
              delay: 0.6,
              ease: [0.22, 0.9, 0.25, 1],
            }}
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

          <span className="sr-only">meet Harvey Specter</span>
        </div>
      </div>
    );
  }

  // CINEMATIC mode — first load only.
  const start = FIRST_START;
  return (
    <div className="pointer-events-auto relative select-none">
      <motion.div
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{
          duration: 0.7,
          delay: start,
          ease: [0.22, 0.9, 0.25, 1],
        }}
        className="font-display italic text-[var(--foreground-muted)]"
        style={{ fontSize: "clamp(26px, 3vw, 36px)", lineHeight: 0.9 }}
      >
        meet
      </motion.div>

      <div
        className="font-signature -mt-1 leading-[0.78] text-[#0e0e0e]"
        style={{ fontSize: "clamp(54px, 6.6vw, 86px)" }}
      >
        <motion.div
          initial={{ clipPath: "inset(-0.5em 100% -0.6em 0)" }}
          animate={{ clipPath: "inset(-0.5em 0% -0.6em 0)" }}
          transition={{
            duration: 1.1,
            delay: start + 0.35,
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
            delay: start + 0.95,
            ease: [0.22, 0.9, 0.25, 1],
          }}
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

        <span className="sr-only">meet Harvey Specter</span>
      </div>
    </div>
  );
}
