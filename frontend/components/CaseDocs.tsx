"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Landmark,
  Mic,
  Newspaper,
  Scroll,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect } from "react";

/**
 * Condensed, one-screen "counsel on call" dossier that overlays the
 * idle hero when the user clicks "Read docs". Not a new page. Just a
 * centered panel that sits on top of a blurred version of whatever was
 * on screen, with a single Back button to dismiss.
 *
 * Everything fits above the fold: tagline, stack chips, three capability
 * lines, and the voice pipeline, no scrolling intended.
 */

// Stack is presented as short category/tool pairs so the full list
// fits cleanly in a single row instead of wrapping. Tool names are
// trimmed to their recognisable short forms.
const STACK: Array<{ label: string; tool: string }> = [
  { label: "Voice transport", tool: "LiveKit Cloud" },
  { label: "STT", tool: "Deepgram Nova-3" },
  { label: "LLM", tool: "GPT-4o-mini" },
  { label: "TTS", tool: "ElevenLabs v2.5" },
  { label: "RAG", tool: "Chroma" },
  { label: "Framework", tool: "Next.js 16" },
];

const CAPABILITIES = [
  {
    icon: Scroll,
    title: "Reads Canadian law",
    body: "2,806 chunks across 7 Ontario and federal statutes. When you ask, he pulls the one that covers it and drops the card on screen.",
  },
  {
    icon: Newspaper,
    title: "Pulls live news",
    body: "Google News RSS on anything time-sensitive. Headlines slide in while he talks.",
  },
  {
    icon: TrendingUp,
    title: "Tracks public tickers",
    body: "Yahoo Finance the moment a company comes up. Price, change, 52-week range.",
  },
  {
    icon: Landmark,
    title: "Has sources on the Hill",
    body: "Congressional STOCK Act filings for any ticker he mentions. QuiverQuant if a key is set, bundled dataset otherwise.",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CaseDocs({ open, onClose }: Props) {
  // Close on Escape. Expected modal behavior, keeps the Back button
  // from being the only escape hatch.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="docs-overlay"
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
        >
          {/* Scrim is lightweight: just enough dim to throw focus onto
              the panel without hiding the skyline behind it. No blur
              so the buildings still read through the overlay. */}
          <motion.button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(245,245,240,0.22)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel is dossier style, one screen, center-stage */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-docs-title"
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
            // max-h caps the panel so it never runs past the viewport
            // on short screens. Scrolls internally if the how-to
            // section plus the stack plus the voice credits exceed
            // the cap.
            className="relative w-full max-h-[92vh] w-full max-w-[1180px] overflow-y-auto rounded-sm border border-[var(--rule-strong)] bg-[var(--paper)] shadow-[0_28px_90px_-30px_rgba(0,0,0,0.38)]"
          >
            {/* Header strip: back button + file label */}
            <div className="flex items-center justify-between border-b border-[var(--rule-strong)] bg-[rgba(20,18,14,0.025)] px-5 py-3">
              <button
                onClick={onClose}
                className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
              >
                <ArrowLeft
                  className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
                  strokeWidth={2}
                />
                Back
              </button>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]">
                PSL · Case file · 2026
              </span>
            </div>

            {/* Body has generous vertical padding so the panel feels
                like a full dossier, not a snug popover. */}
            <div className="px-10 pt-12 pb-14">
              {/* The matter */}
              <h2
                id="case-docs-title"
                className="font-display text-[34px] leading-[1.05] text-[var(--foreground)]"
              >
                Harvey, in your pocket.
              </h2>
              <p className="mt-3 max-w-[680px] text-[13.5px] leading-relaxed text-[var(--foreground-muted)]">
                A voice-first legal agent. Call him, speak your situation in
                plain English, and he pulls up the Canadian statute that
                covers it. If you ask about a company, he pulls the live
                quote and any Congressional trades on it. If you ask about
                the news, he pulls the latest headlines.
              </p>

              {/* Capabilities are a 2x2 grid with roomier padding now
                  that the panel has more vertical space to work with. */}
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                {CAPABILITIES.map((c) => (
                  <div
                    key={c.title}
                    className="flex gap-3 rounded-sm border border-[var(--rule-strong)] bg-white/70 p-4"
                  >
                    <c.icon
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
                      strokeWidth={2}
                    />
                    <div className="flex flex-col gap-1">
                      <h3 className="font-display text-[14px] leading-tight text-[var(--foreground)]">
                        {c.title}
                      </h3>
                      <p className="text-[12px] leading-snug text-[var(--foreground-muted)]">
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* How to use Harvey. Quick cheat sheet so a first-time
                  caller knows what to ask and what to expect. Two
                  columns so it reads fast without a wall of text. */}
              <div className="mt-6 rounded-sm border border-[var(--rule-strong)] bg-white/80 px-5 py-4">
                <div className="mb-3 flex items-center gap-3">
                  <Mic
                    className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
                    strokeWidth={2}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.42em] text-[var(--foreground-muted)]">
                    How to talk to Harvey
                  </span>
                  <div className="h-px flex-1 bg-[var(--rule-strong)]" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1 font-display text-[13px] font-semibold text-[var(--foreground)]">
                      What to ask
                    </div>
                    <ul className="space-y-1.5 text-[12px] leading-snug text-[var(--foreground-muted)]">
                      <li className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--foreground)]" />
                        <span>"I got clocked doing 150 on the 401, what am I looking at" gets you the Highway Traffic Act.</span>
                      </li>
                      <li className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--foreground)]" />
                        <span>"My landlord served me an N12" pulls the Residential Tenancies Act.</span>
                      </li>
                      <li className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--foreground)]" />
                        <span>"What's Apple at" gets a live quote. Add "any insider action" for Congressional trades.</span>
                      </li>
                      <li className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--foreground)]" />
                        <span>"What's happening with the Bank of Canada" gets live news.</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 font-display text-[13px] font-semibold text-[var(--foreground)]">
                      <Sparkles className="h-3 w-3 text-[var(--accent)]" strokeWidth={2} />
                      Harvey's tells
                    </div>
                    <ul className="space-y-1.5 text-[12px] leading-snug text-[var(--foreground-muted)]">
                      <li className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--foreground)]" />
                        <span><span className="font-semibold text-[var(--foreground)]">Insult him.</span> He fires back harder, in one sentence.</span>
                      </li>
                      <li className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--foreground)]" />
                        <span><span className="font-semibold text-[var(--foreground)]">Ask for market stuff</span> and you might catch him yelling "DONNAAAAA" before the quote loads.</span>
                      </li>
                      <li className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--foreground)]" />
                        <span><span className="font-semibold text-[var(--foreground)]">Off the record.</span> Flip the OTR toggle and he drops a Suits-world lore line.</span>
                      </li>
                      <li className="flex gap-2">
                        <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--foreground)]" />
                        <span><span className="font-semibold text-[var(--foreground)]">Go silent too long</span> and he'll nudge you. He bills in six-minute increments.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Stack is a proper label/value grid, 3 columns. Each row
                  reads cleanly: SMALL LABEL on top, BOLD TOOL NAME below.
                  Sans + serif mix instead of mono everywhere so the
                  tool names are actually readable. */}
              <div className="mt-6 rounded-sm border border-[var(--rule-strong)] bg-white/80 px-5 py-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.42em] text-[var(--foreground-muted)]">
                    Stack
                  </span>
                  <div className="h-px flex-1 bg-[var(--rule-strong)]" />
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                  {STACK.map((s) => (
                    <div key={s.tool} className="flex flex-col gap-0.5">
                      <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
                        {s.label}
                      </span>
                      <span className="text-[14px] font-semibold text-[var(--foreground)]">
                        {s.tool}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Voice credits, full sentence describing how the voice
                  was actually cloned. Was a one-liner credit before,
                  now it's the "how it works" paragraph. */}
              <div className="mt-5 flex gap-3 border-t border-[var(--rule-strong)] pt-4">
                <BookOpen
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
                  strokeWidth={2}
                />
                <p className="text-[12.5px] leading-snug text-[var(--foreground-muted)]">
                  <span className="font-semibold text-[var(--foreground)]">
                    Voice:
                  </span>{" "}
                  cloned via{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    ElevenLabs Instant Voice Cloning
                  </span>{" "}
                  on a 10-minute sample of Gabriel Macht dialogue from Suits,
                  served through the Turbo v2.5 realtime TTS model. His
                  system prompt carries 37 real show lines as cadence anchors,
                  so he lands a quip every few turns without sounding
                  scripted.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
