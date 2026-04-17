"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";

// ────────────────────────────────────────────────────────────────────────
// StenoBox — court-reporter live transcript pane.
//
// Pinned bottom-right, directly above the LIVE MM:SS pill. Accumulates
// BOTH sides of the conversation in order. Harvey's lines are italic,
// the user's are plain. A tiny timestamp (MM:SS elapsed) prefixes every
// row so you can see the call's cadence at a glance.
//
// Auto-scrolls to the newest line. Older lines fade in contrast so the
// eye lands on the latest one without them scrolling past too fast.
// ────────────────────────────────────────────────────────────────────────

export interface StenoLine {
  who: "You" | "Harvey";
  text: string;
  receivedAt: number; // ms epoch
}

interface Props {
  agent: Array<{ text?: string; firstReceivedTime?: number }>;
  user: Array<{ text?: string; firstReceivedTime?: number }>;
  startMs: number;
}

export function StenoBox({ agent, user, startMs }: Props) {
  // Merge & sort both streams by time. Dedupe consecutive identical
  // (who, text) pairs — LiveKit fires multiple interim updates on the
  // same utterance; we only want the final (or latest) version once.
  const lines = useMemo<StenoLine[]>(() => {
    const raw: StenoLine[] = [];
    for (const a of agent) {
      const t = (a.text ?? "").trim();
      if (!t) continue;
      raw.push({ who: "Harvey", text: t, receivedAt: a.firstReceivedTime ?? 0 });
    }
    for (const u of user) {
      const t = (u.text ?? "").trim();
      if (!t) continue;
      raw.push({ who: "You", text: t, receivedAt: u.firstReceivedTime ?? 0 });
    }
    raw.sort((a, b) => a.receivedAt - b.receivedAt);
    const out: StenoLine[] = [];
    for (const ln of raw) {
      const prev = out[out.length - 1];
      // Same speaker, progressive update (interim → final): replace.
      if (
        prev &&
        prev.who === ln.who &&
        (ln.text.startsWith(prev.text) || prev.text.startsWith(ln.text))
      ) {
        out[out.length - 1] = ln;
      } else {
        out.push(ln);
      }
    }
    return out;
  }, [agent, user]);

  // Auto-scroll to the bottom whenever a new line arrives.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: [0.19, 1, 0.22, 1] }}
      className="pointer-events-none fixed bottom-[76px] right-6 z-40"
    >
      <div
        className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-[var(--rule-strong)] bg-[rgba(255,255,255,0.92)] shadow-[0_12px_40px_-16px_rgba(0,0,0,0.18)] backdrop-blur"
        style={{ width: 440, maxHeight: 280 }}
      >
        {/* Header — typewriter court reporter vibe */}
        <div className="flex items-center justify-between border-b border-[var(--rule)] bg-[var(--accent-soft)]/40 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </span>
            <span
              className="text-[13px] text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-typewriter), 'Courier New', monospace" }}
            >
              Court Stenographer
            </span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
            On the record
          </span>
        </div>

        {/* Transcript body */}
        <div
          ref={scrollRef}
          className="thin-scroll flex-1 overflow-y-auto px-3.5 py-3"
          style={{ scrollbarWidth: "thin" }}
        >
          {lines.length === 0 ? (
            <div className="py-6 text-center font-mono text-[10px] uppercase tracking-[0.38em] text-[var(--foreground-faint)]">
              Awaiting first word
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {lines.map((ln, i) => {
                  const isLast = i === lines.length - 1;
                  const mmss = formatMmss(
                    Math.max(0, Math.floor((ln.receivedAt - startMs) / 1000)),
                  );
                  const whoColor =
                    ln.who === "Harvey" ? "text-[var(--accent)]" : "text-[var(--crimson)]";
                  return (
                    <motion.div
                      key={`${ln.receivedAt}-${ln.who}-${i}`}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: isLast ? 1 : 0.62, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                      className="flex items-start gap-2 leading-[1.45]"
                    >
                      <span className="mt-[2px] w-[34px] shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--foreground-faint)] tabular-nums">
                        {mmss}
                      </span>
                      <span
                        className={`mt-[2px] w-[46px] shrink-0 font-mono text-[9px] uppercase tracking-[0.28em] ${whoColor}`}
                      >
                        {ln.who === "Harvey" ? "Harvey" : "You"}
                      </span>
                      <span
                        className={`flex-1 text-[13px] leading-[1.55] text-[var(--foreground)] ${
                          ln.who === "Harvey" ? "italic" : ""
                        }`}
                        style={{
                          fontFamily:
                            "var(--font-typewriter), 'Courier New', monospace",
                        }}
                      >
                        {ln.text}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function formatMmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
