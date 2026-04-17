"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * DonnaFlash — the "DONAAAA!" secretary-shout overlay.
 *
 * Fires every time Harvey publishes a stock_card or news_ticker pane.
 * A big display-font "DONAAAA!" rips across the center of the screen,
 * the A's stretching wider than normal, then it elastics down into
 * a small corner stamp before fading out.
 *
 * Usage:
 *   <DonnaFlash trigger={stockNewsCount} label="DONAAAA" tag="STOCKS" />
 *
 * The component is stateless about WHY it fires — callers bump a
 * monotonically increasing counter (e.g. length of pane array filtered
 * to stock_card + news_ticker), and every change replays the animation.
 */
export function DonnaFlash({
  trigger,
  label = "DONAAAA",
  tag = "SECRETARY",
}: {
  /** Any changing value — typically a count of secretary-class panes. */
  trigger: number | string;
  /** The shout text. The last character gets elongated via CSS
   *  letter-spacing trick, giving the "DONAAAAAA" stretch effect. */
  label?: string;
  /** Small subtitle below, e.g. "STOCKS" or "NEWS". */
  tag?: string;
}) {
  const [firing, setFiring] = useState(false);
  const lastTriggerRef = useRef<number | string | null>(null);

  useEffect(() => {
    // Skip the initial mount fire — we only want this on CHANGES, not
    // the first render where trigger could legitimately be 0/empty.
    if (lastTriggerRef.current === null) {
      lastTriggerRef.current = trigger;
      return;
    }
    if (trigger === lastTriggerRef.current) return;
    lastTriggerRef.current = trigger;

    setFiring(true);
    const t = setTimeout(() => setFiring(false), 1800);
    return () => clearTimeout(t);
  }, [trigger]);

  // Split "DONAAAA" into base + stretched A tail so we can letter-space
  // only the tail. Any trailing run of the same char gets expanded.
  const { head, tail } = splitStretch(label);

  return (
    <AnimatePresence>
      {firing && (
        <motion.div
          key="donna-flash"
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Soft scrim so the shout pops off whatever's behind it */}
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[rgba(248,246,241,0.35)] backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            className="relative flex flex-col items-center gap-2"
            initial={{ scale: 0.62, rotate: -2.5, y: 18 }}
            animate={{
              scale: [0.62, 1.14, 1.0, 1.0],
              rotate: [-2.5, 1.2, -0.4, 0],
              y: [18, -6, 0, 0],
            }}
            exit={{ scale: 0.92, opacity: 0, y: -10 }}
            transition={{
              duration: 1.5,
              times: [0, 0.25, 0.55, 1],
              ease: [0.19, 1, 0.22, 1],
            }}
          >
            {/* Main shout. font-display gives it the editorial-serif
                Pearson feel; text-[var(--crimson)] makes it feel like
                the Suits brand red. Tail letters get tracked apart so
                "AAAA" literally stretches across the screen. */}
            <div className="flex items-baseline font-display text-[88px] font-black leading-none text-[var(--crimson)] md:text-[128px]">
              <span>{head}</span>
              <motion.span
                initial={{ letterSpacing: "0em" }}
                animate={{ letterSpacing: ["0em", "0.26em", "0.18em"] }}
                transition={{ duration: 1.2, times: [0, 0.5, 1] }}
                className="ml-[2px]"
              >
                {tail}
              </motion.span>
              <motion.span
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 1] }}
                transition={{ duration: 0.8, times: [0, 0.3, 0.6, 1] }}
              >
                !
              </motion.span>
            </div>

            {/* Little "HARVEY → DONNA · {tag}" receipt line */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, delay: 0.3 }}
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.42em] text-[var(--foreground-muted)]"
            >
              <span>Harvey</span>
              <span className="text-[var(--foreground-faint)]">→</span>
              <span>Donna</span>
              <span className="text-[var(--foreground-faint)]">·</span>
              <span className="text-[var(--accent)]">{tag}</span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Split a label into (head, stretched tail) at the final run of the
 *  last character. "DONAAAA" → ("DON", "AAAA"). If no repeated tail,
 *  keep the whole thing as head with empty tail. */
function splitStretch(s: string): { head: string; tail: string } {
  if (!s) return { head: "", tail: "" };
  const lastCh = s[s.length - 1];
  let i = s.length - 1;
  while (i > 0 && s[i - 1] === lastCh) i--;
  const tailLen = s.length - i;
  if (tailLen < 2) return { head: s, tail: "" };
  return { head: s.slice(0, i), tail: s.slice(i) };
}
