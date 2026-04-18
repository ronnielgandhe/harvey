"use client";

import { motion } from "framer-motion";
import { ArrowRight, Loader2, PhoneCall } from "lucide-react";

/**
 * Four design variants for the idle-page "Take the Call" CTA. Pick one
 * by passing `variant` as a prop. Built to fit the existing Harvey DNA:
 * wireframe skyline + Pearson Specter Litt serif + cream/black palette.
 *
 *   A) "counsel-card"  — a legal business card. Embossed monogram, two
 *                        thin rules, click anywhere on the card.
 *   B) "sonar"         — minimalist. Three expanding sonar rings around
 *                        a small phone icon. Cinematic, breathing.
 *   C) "editorial"     — no button. Giant serif headline that IS the
 *                        call-to-action, with a red underline that
 *                        draws on hover. Magazine vibe.
 *   D) "terminal"      — retro CLI. Mono typography, blinking cursor,
 *                        "LINE OPEN · PICK UP ▶" — like an old dispatch
 *                        terminal.
 */

export type CallCTAVariant = "counsel-card" | "sonar" | "editorial" | "terminal";

interface Props {
  variant: CallCTAVariant;
  onAnswer: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function CallCTA({ variant, onAnswer, loading, disabled }: Props) {
  switch (variant) {
    case "counsel-card":
      return <CounselCard onAnswer={onAnswer} loading={loading} disabled={disabled} />;
    case "sonar":
      return <Sonar onAnswer={onAnswer} loading={loading} disabled={disabled} />;
    case "editorial":
      return <Editorial onAnswer={onAnswer} loading={loading} disabled={disabled} />;
    case "terminal":
      return <Terminal onAnswer={onAnswer} loading={loading} disabled={disabled} />;
  }
}

// ────────────────────────────────────────────────────────────────────────
// A — Counsel card
// ────────────────────────────────────────────────────────────────────────
function CounselCard({
  onAnswer,
  loading,
  disabled,
}: Omit<Props, "variant">) {
  return (
    <motion.button
      onClick={onAnswer}
      disabled={disabled || loading}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 4.1, ease: [0.19, 1, 0.22, 1] }}
      whileHover={{ y: -3, boxShadow: "0 18px 40px -20px rgba(0,0,0,0.25)" }}
      whileTap={{ scale: 0.985 }}
      className="group pointer-events-auto relative flex w-[320px] flex-col items-center gap-3 rounded-sm border border-[var(--rule-strong)] bg-[rgba(255,255,255,0.92)] px-8 py-7 text-center transition-colors hover:border-[var(--foreground)]"
    >
      {/* Top rule */}
      <span className="absolute inset-x-8 top-4 h-px bg-[var(--rule-strong)]" />
      <span className="absolute inset-x-8 bottom-4 h-px bg-[var(--rule-strong)]" />

      <span className="font-mono text-[9px] uppercase tracking-[0.45em] text-[var(--foreground-faint)]">
        Pearson Specter Litt
      </span>
      <span className="font-display text-[28px] leading-[1.1] text-[var(--foreground)]">
        Harvey Specter
      </span>
      <span className="font-display text-[11px] italic text-[var(--foreground-muted)]">
        Senior Partner · On retainer
      </span>
      <span className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--foreground)] transition-colors group-hover:text-[var(--crimson)]">
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
        ) : (
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        )}
        {loading ? "Opening line" : "Take the call"}
      </span>
    </motion.button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// B — Sonar pulse
// ────────────────────────────────────────────────────────────────────────
function Sonar({ onAnswer, loading, disabled }: Omit<Props, "variant">) {
  return (
    <motion.button
      onClick={onAnswer}
      disabled={disabled || loading}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      // Hold until the PSL × Bluejay splash finishes its glide to the
      // center pose (~6.7s) before the phone scales in — keeps the
      // reveal order: logos land → signature writes in → phone appears.
      transition={{ duration: 0.9, delay: 7.0, ease: [0.19, 1, 0.22, 1] }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className="group pointer-events-auto relative flex flex-col items-center gap-4"
    >
      {/* 3 expanding rings using a native CSS keyframe animation
          (sonar-ring in globals.css). Each ring gets a NEGATIVE
          animation-delay so it starts mid-cycle, staggering the three
          rings evenly without the framer-motion keyframe-array pop
          at the loop boundary. Native CSS wraps seamlessly. */}
      <div className="relative flex h-[150px] w-[150px] items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="sonar-ring absolute inset-0 rounded-full border border-[var(--foreground)]"
            style={{ animationDelay: `${-0.9 * i}s` }}
          />
        ))}

        {/* Core — small solid disk */}
        <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[var(--foreground)] text-white transition-colors group-hover:bg-[var(--crimson)]">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
          ) : (
            <PhoneCall className="h-5 w-5" strokeWidth={2} />
          )}
        </div>
      </div>

      {loading && (
        <span className="font-mono text-[10px] uppercase tracking-[0.5em] text-[var(--foreground-muted)]">
          Securing line
        </span>
      )}
    </motion.button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// C — Editorial headline
// ────────────────────────────────────────────────────────────────────────
function Editorial({
  onAnswer,
  loading,
  disabled,
}: Omit<Props, "variant">) {
  return (
    <motion.button
      onClick={onAnswer}
      disabled={disabled || loading}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 4.1, ease: [0.19, 1, 0.22, 1] }}
      className="group pointer-events-auto relative flex flex-col items-center gap-3 px-6 py-3"
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.5em] text-[var(--foreground-faint)]">
        ON THE HOUR · BILLABLE
      </span>
      <span className="relative font-display text-[44px] leading-[1.05] tracking-tight text-[var(--foreground)]">
        {loading ? "Opening line…" : "Take the call."}
        <motion.span
          aria-hidden
          className="absolute -bottom-1 left-0 h-[3px] bg-[var(--crimson)]"
          initial={{ width: 0 }}
          whileHover={{ width: "100%" }}
          transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
          style={{ width: 0 }}
        />
      </span>
      <span className="font-display text-[13px] italic text-[var(--foreground-muted)]">
        “I don’t play the odds. I play the man.”
      </span>
    </motion.button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// D — Terminal prompt
// ────────────────────────────────────────────────────────────────────────
function Terminal({ onAnswer, loading, disabled }: Omit<Props, "variant">) {
  return (
    <motion.button
      onClick={onAnswer}
      disabled={disabled || loading}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 4.1, ease: [0.19, 1, 0.22, 1] }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="group pointer-events-auto flex min-w-[360px] flex-col gap-1.5 rounded-md border border-[var(--foreground)]/70 bg-[var(--foreground)] px-5 py-4 text-left transition-colors hover:bg-[var(--crimson)]"
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/60">
        PSL · DISPATCH
      </span>
      <div className="flex items-center gap-2 font-mono text-[14px] text-white">
        <span className="text-white/60">$</span>
        <span>{loading ? "connecting…" : "call --harvey"}</span>
        <span className="ml-1 inline-block h-[14px] w-[7px] animate-pulse bg-white" />
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
        {loading ? "Securing line" : "Press to pick up ▶"}
      </span>
    </motion.button>
  );
}
