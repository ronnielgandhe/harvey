"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EyeOff } from "lucide-react";

/**
 * "Off the record" theatrical toggle. When active:
 *   - Parent dims / desaturates the main content (via CSS class)
 *   - Call timer pauses (parent decides)
 *   - A big diagonal "OFF THE RECORD" stamp overlays the screen
 *   - A bottom-center "DESTRUCTING · NOT BILLABLE" stamp appears
 *
 * The component itself renders BOTH the small corner toggle pill AND
 * the stamp overlay, so CallInterface just needs one mount point.
 */

interface Props {
  active: boolean;
  onToggle: () => void;
}

export function OffTheRecord({ active, onToggle }: Props) {
  return (
    <>
      {/* Toggle pill — top-right, under the header */}
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        onClick={onToggle}
        className={`fixed right-5 top-5 z-40 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.32em] backdrop-blur transition-colors ${
          active
            ? "border-[var(--crimson)]/60 bg-[var(--crimson)]/[0.12] text-[var(--crimson)]"
            : "border-[var(--rule-strong)] bg-white/70 text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
        }`}
        aria-pressed={active}
      >
        <span className="relative flex h-1.5 w-1.5">
          {active && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--crimson)]/70" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              active
                ? "bg-[var(--crimson)]"
                : "border border-[var(--foreground-faint)]"
            }`}
          />
        </span>
        <EyeOff className="h-3 w-3" strokeWidth={2} />
        <span>{active ? "Off the record" : "On the record"}</span>
      </motion.button>

      {/* Full-screen stamp overlay + watermark */}
      <AnimatePresence>
        {active && (
          <motion.div
            key="otr-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none fixed inset-0 z-[35]"
          >
            {/* Paper-like darkening layer so dimming reads clearly */}
            <div className="absolute inset-0 bg-[rgba(20,18,14,0.18)]" />

            {/* Big diagonal watermark */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: -12 }}
              transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span
                className="font-display text-[12vw] font-bold uppercase leading-none tracking-[-0.02em]"
                style={{
                  color: "rgba(140, 18, 20, 0.14)",
                  WebkitTextStroke: "1.5px rgba(140, 18, 20, 0.42)",
                }}
              >
                Off the Record
              </span>
            </motion.div>

            {/* Top-center thin rule + "PRIVILEGED" */}
            <div className="absolute left-1/2 top-[14vh] -translate-x-1/2 flex items-center gap-3">
              <span className="h-px w-12 bg-[var(--crimson)]/60" />
              <span className="font-mono text-[9px] uppercase tracking-[0.5em] text-[var(--crimson)]">
                Privileged · Not for the record
              </span>
              <span className="h-px w-12 bg-[var(--crimson)]/60" />
            </div>

            {/* Bottom stamp — shredder / destructing */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="absolute bottom-[14vh] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[var(--crimson)]/40 bg-[rgba(255,255,255,0.85)] px-3 py-1.5 backdrop-blur"
            >
              <motion.span
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-[var(--crimson)]"
              />
              <span className="font-mono text-[9.5px] uppercase tracking-[0.42em] text-[var(--crimson)]">
                Destructing · Not billable · Timer paused
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
