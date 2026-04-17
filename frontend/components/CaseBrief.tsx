"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import {
  BookOpen,
  ExternalLink,
  Mic,
  Newspaper,
  Scroll,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A "case brief" section that lives BELOW the hero on the idle landing
 * page. Modeled after a legal case file: numbered sections, mono
 * eyebrows, serif headlines, thin rules. Shows off the tech + features
 * without drowning the page in copy.
 *
 * Designed to match the Pearson Specter Litt / Bluejay wireframe vibe
 * — cream background, dark ink, skyline stays visible through it.
 */

const TAGS = [
  "LiveKit Cloud",
  "OpenAI",
  "Deepgram Nova-3",
  "ElevenLabs Turbo v2.5",
  "Chroma",
  "Next.js 16",
];

const FEATURES = [
  {
    icon: Scroll,
    title: "Cites Canadian law",
    body:
      "RAG over 31 federal + Ontario statutes, 12,000+ pages. Specific-fact retrieval grounds every answer in the actual text.",
    example: "“What does HTA §200 say about hit-and-run?”",
  },
  {
    icon: Newspaper,
    title: "Pulls live news",
    body:
      "Google News RSS on every time-sensitive query. Top 5 headlines plus a featured article summary slide in while he talks.",
    example: "“What’s happening with the Bank of Canada rate?”",
  },
  {
    icon: TrendingUp,
    title: "Tracks public tickers",
    body:
      "Yahoo Finance quote the moment a public company comes up. Live price, change, 52-week range — all docked on the left.",
    example: "“How’s Apple doing today?”",
  },
];

const PIPELINE = [
  { step: "STT", tool: "Deepgram Nova-3" },
  { step: "Turn detect", tool: "LiveKit + Silero" },
  { step: "LLM", tool: "GPT-4o-mini" },
  { step: "RAG", tool: "Chroma · text-embedding-3-small" },
  { step: "TTS", tool: "ElevenLabs · Gabriel Macht clone" },
  { step: "Transport", tool: "LiveKit Cloud · WebRTC" },
];

interface Headline {
  title: string;
  source?: string;
  link?: string;
}

function useLatestHeadline(): Headline | null {
  const [h, setH] = useState<Headline | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/headline", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || !data.title) return;
        setH({ title: data.title, source: data.source, link: data.link });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return h;
}

export function CaseBrief() {
  const headline = useLatestHeadline();
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-linked entrance — the brief's top edge fades its mask from
  // page-bg → transparent as you scroll it into view. Creates a smooth
  // "emerge out of the hero" feel in place of a chevron cue.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "start center"],
  });
  const maskOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <motion.section
      ref={sectionRef}
      aria-label="Case brief"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.9, ease: [0.19, 1, 0.22, 1] }}
      className="relative z-10 mx-auto w-full max-w-[920px] px-6 pt-24 pb-20"
    >
      {/* Soft bg-to-transparent mask at the top edge — fades out as user
          scrolls into the brief, giving the "reveal from the hero" look. */}
      <motion.div
        aria-hidden
        style={{ opacity: maskOpacity }}
        className="pointer-events-none absolute inset-x-0 -top-40 z-10 h-56 bg-gradient-to-b from-[var(--background)] via-[var(--background)]/85 to-transparent"
      />

      {/* "Today at PSL" live headline pill */}
      {headline && (
        <motion.a
          href={headline.link || "#"}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="group mb-10 inline-flex max-w-full items-center gap-3 rounded-full border border-[var(--rule-strong)] bg-white/70 px-4 py-2 transition-colors hover:border-[var(--foreground)]"
        >
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--crimson)]/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--crimson)]" />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]">
              Today at PSL
            </span>
          </span>
          <span className="truncate font-display text-[13px] italic text-[var(--foreground)] group-hover:underline">
            {headline.title}
          </span>
          <ExternalLink
            className="h-3 w-3 shrink-0 text-[var(--foreground-faint)] opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={2}
          />
        </motion.a>
      )}

      {/* 01 — the matter */}
      <Numbered number="01" label="The matter">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-[38px] leading-[1.08] text-[var(--foreground)]">
            Counsel, on call.
          </h2>
          <span className="font-display text-[18px] italic text-[var(--foreground-muted)]">
            Canadian law meets live markets.
          </span>
        </div>
        <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-[var(--foreground-muted)]">
          Harvey is a voice-first legal agent. Call him, speak your situation
          in plain English, and he answers with the relevant Canadian statute
          cited, a live news synthesis, or a real-time market quote — depending
          on what you ask. Not a chatbot. Not a search engine. A lawyer on
          retainer, with a slight attitude problem.
        </p>
      </Numbered>

      {/* 02 — the stack */}
      <Numbered number="02" label="Tech stack">
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rule-strong)] bg-white/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground)]"
            >
              {t}
            </span>
          ))}
        </div>

        {/* Voice pipeline table */}
        <div className="mt-6 overflow-hidden rounded-sm border border-[var(--rule-strong)] bg-white/70">
          <table className="w-full font-mono text-[11px]">
            <tbody>
              {PIPELINE.map((row, i) => (
                <tr
                  key={row.step}
                  className={
                    i < PIPELINE.length - 1
                      ? "border-b border-[var(--rule-strong)]"
                      : ""
                  }
                >
                  <td className="w-[130px] whitespace-nowrap px-4 py-2.5 uppercase tracking-[0.28em] text-[var(--foreground-faint)]">
                    {row.step}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--foreground)]">
                    {row.tool}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Numbered>

      {/* 03 — capabilities */}
      <Numbered number="03" label="What he does">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.19, 1, 0.22, 1] }}
              className="flex flex-col gap-3 rounded-sm border border-[var(--rule-strong)] bg-white/80 p-5"
            >
              <div className="flex items-center gap-2">
                <f.icon
                  className="h-3.5 w-3.5 text-[var(--accent)]"
                  strokeWidth={2}
                />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
                  Capability
                </span>
              </div>
              <h3 className="font-display text-[18px] leading-[1.2] text-[var(--foreground)]">
                {f.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-[var(--foreground-muted)]">
                {f.body}
              </p>
              <div className="mt-auto border-l-2 border-[var(--foreground)] pl-3 font-display text-[12px] italic text-[var(--foreground-muted)]">
                {f.example}
              </div>
            </motion.div>
          ))}
        </div>
      </Numbered>

      {/* 04 — on set (voice + personality) */}
      <Numbered number="04" label="On set">
        <p className="max-w-[640px] text-[15px] leading-relaxed text-[var(--foreground-muted)]">
          Harvey speaks with a cloned voice of{" "}
          <em className="text-[var(--foreground)]">Gabriel Macht</em> — trained
          on 10 minutes of Suits dialogue through ElevenLabs Instant Voice
          Cloning. His system prompt carries 37 real show lines as cadence
          anchors, so he lands a quip every 2-3 turns without it feeling
          forced. A LiveKit Silero VAD keeps the turn-taking natural.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={2} />
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground-muted)]">
              ElevenLabs · Turbo v2.5
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen
              className="h-3.5 w-3.5 text-[var(--accent)]"
              strokeWidth={2}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground-muted)]">
              37 lines of cadence anchors
            </span>
          </div>
        </div>
      </Numbered>

      {/* Disposition / fine print */}
      <div className="mt-20 flex flex-col items-start gap-3 border-t border-[var(--rule-strong)] pt-6 md:flex-row md:items-center md:justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--foreground-faint)]">
          © 2026 · Pearson Specter Litt × Bluejay · Confidential · Privileged
        </div>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
          View the repository
        </a>
      </div>
    </motion.section>
  );
}

// ─── Tiny helper: numbered section header + body slot ────────────────────

function Numbered({
  number,
  label,
  children,
}: {
  number: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.75, ease: [0.19, 1, 0.22, 1] }}
      className="relative mt-20 first:mt-0"
    >
      <div className="mb-6 flex items-center gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
          {number}
        </span>
        <motion.span
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.19, 1, 0.22, 1] }}
          className="h-px flex-1 origin-left bg-[var(--rule-strong)]"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.42em] text-[var(--foreground-muted)]">
          {label}
        </span>
      </div>
      {children}
    </motion.div>
  );
}

// ScrollCue removed — the CaseBrief now fades + rises into view with a
// masked gradient entrance. No chevron was getting covered by the
// NewsCrawl bar anyway.
