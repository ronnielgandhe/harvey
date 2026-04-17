"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Scroll,
  FileText,
  Mail,
  Swords,
  Loader2,
  CheckCircle2,
  Copy,
  X,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NewsTickerPane, type NewsTickerData } from "./panes/NewsTickerPane";
import {
  ArticleSpotlightPane,
  type ArticleSpotlightData,
} from "./panes/ArticleSpotlightPane";
import { StockCardPane, type StockCardData } from "./panes/StockCardPane";
import { HillIntelPane, type HillIntelData } from "./panes/HillIntelPane";

// ─────────────────────────────────────────────────────────────────────────────
// Pane types
// ─────────────────────────────────────────────────────────────────────────────

export type Pane =
  | StatutePane
  | ToolCallPane
  | NewsTickerPaneType
  | ArticleSpotlightPaneType
  | StockCardPaneType
  | HillIntelPaneType;

export interface SeeAlsoItem {
  section: string;
  title: string;
  source: string;
  jurisdiction?: string;
  quote?: string;
  fullText?: string;
}

export interface StatutePane {
  kind: "statute";
  id: string;
  jurisdiction: string;
  section: string;
  title: string;
  quote: string;
  fullText?: string;
  /** French counterpart. Canadian federal statutes are bilingual —
   *  both the English and French texts are equally official. */
  frenchQuote?: string;
  frenchFullText?: string;
  confidence?: number;
  seeAlso?: SeeAlsoItem[];
}

export interface ToolCallPane {
  kind: "tool_call";
  id: string;
  name: string;
  status: "running" | "complete" | "error" | string;
}

export interface NewsTickerPaneType {
  kind: "news_ticker";
  id: string;
  data: NewsTickerData;
}

export interface ArticleSpotlightPaneType {
  kind: "article_spotlight";
  id: string;
  data: ArticleSpotlightData;
}

export interface StockCardPaneType {
  kind: "stock_card";
  id: string;
  data: StockCardData;
}

export interface HillIntelPaneType {
  kind: "hill_intel";
  id: string;
  data: HillIntelData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Container
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  panes: Pane[];
  onDismiss?: (id: string) => void;
  onSeeAlsoClick?: (item: SeeAlsoItem) => void;
  /** ID of the pane Harvey has focused / expanded. Gets a scale-up
   *  treatment so voice-commanded "expand X" is visually obvious. */
  focusedId?: string | null;
  /** When true, the focused pane is hidden from the lane stacks — the
   *  parent is rendering it in a centered overlay instead. */
  hideFocused?: boolean;
}

export function GlassPaneStack({
  panes,
  onDismiss,
  onSeeAlsoClick,
  focusedId,
  hideFocused,
}: Props) {
  const visible = hideFocused && focusedId
    ? panes.filter((p) => p.id !== focusedId)
    : panes;
  const toolCalls = visible.filter((p): p is ToolCallPane => p.kind === "tool_call");
  const cards = visible.filter(
    (p) =>
      p.kind !== "tool_call" &&
      p.kind !== "stock_card" &&
      p.kind !== "hill_intel",
  );
  // LEFT stack: market / insider lane (stock + Congress trades)
  const leftPanes = visible.filter(
    (p): p is StockCardPaneType | HillIntelPaneType =>
      p.kind === "stock_card" || p.kind === "hill_intel",
  );

  return (
    <>
      {/* Left stack: stock tickers + Hill intel.
          Only the newest pane is on screen. When a new one comes in,
          the previous one exits left before the new one enters — no
          awkward visual overlap of two different-height cards. */}
      <div className="pointer-events-none fixed left-5 top-32 bottom-24 z-30 w-[320px] max-w-[85vw]">
        <AnimatePresence initial={false} mode="wait">
          {leftPanes.slice(0, 1).map((p) => {
            const isFocused = focusedId === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -80, scale: 0.94 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: isFocused ? 1.06 : 1,
                  boxShadow: isFocused
                    ? "0 24px 60px -18px rgba(15, 23, 42, 0.35)"
                    : "0 0 0 rgba(0,0,0,0)",
                }}
                exit={{ opacity: 0, x: -60, scale: 0.94 }}
                transition={{ duration: 0.45, ease: [0.2, 0.9, 0.3, 1] }}
                className="pointer-events-auto absolute inset-x-0 top-0"
                style={{ transformOrigin: "top left" }}
              >
                {p.kind === "stock_card" ? (
                  <StockCardPane data={p.data} paneId={p.id} onDismiss={onDismiss} />
                ) : (
                  <HillIntelPane data={p.data} paneId={p.id} onDismiss={onDismiss} />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Right stack: tool pills + news + spotlight + legal (existing) */}
      {/* Right rail bottom raised to 240px to clear the StenoBox
          transcript (pinned bottom-[76px] at z-40, ~160px tall).
          Otherwise the bottom of an expanded statute card hides
          behind the transcript. */}
      <div className="pointer-events-none fixed right-5 top-20 bottom-[240px] z-30 flex w-[360px] max-w-[92vw] flex-col gap-3">
      {/* Tool pills row */}
      <div className="pointer-events-auto flex flex-col gap-1.5">
        <AnimatePresence>
          {toolCalls.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.32, ease: [0.2, 0.9, 0.3, 1] }}
            >
              <ToolPill pane={t} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Right lane: only the newest pane visible. Old one exits before
          new one enters — clean swap, no overlap. */}
      <div className="pointer-events-auto relative flex-1">
        <AnimatePresence initial={false} mode="wait">
          {cards.slice(0, 1).map((p) => {
            const isFocused = focusedId === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 100, scale: 0.96 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: isFocused ? 1.06 : 1,
                  boxShadow: isFocused
                    ? "0 24px 60px -18px rgba(15, 23, 42, 0.35)"
                    : "0 0 0 rgba(0,0,0,0)",
                }}
                exit={{ opacity: 0, x: 60, scale: 0.96 }}
                transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1] }}
                className="absolute inset-x-0 top-0"
                style={{ transformOrigin: "top right" }}
              >
                <PaneCard
                  pane={p}
                  onDismiss={onDismiss}
                  onSeeAlsoClick={onSeeAlsoClick}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function PaneCard({
  pane,
  onDismiss,
  onSeeAlsoClick,
}: {
  pane: Pane;
  onDismiss?: (id: string) => void;
  onSeeAlsoClick?: (item: SeeAlsoItem) => void;
}) {
  switch (pane.kind) {
    case "statute":
      return (
        <StatutePaneCard
          pane={pane}
          onDismiss={onDismiss}
          onSeeAlsoClick={onSeeAlsoClick}
        />
      );
    case "news_ticker":
      return (
        <NewsTickerPane data={pane.data} paneId={pane.id} onDismiss={onDismiss} />
      );
    case "article_spotlight":
      return (
        <ArticleSpotlightPane
          data={pane.data}
          paneId={pane.id}
          onDismiss={onDismiss}
        />
      );
    case "hill_intel":
      return (
        <HillIntelPane
          data={pane.data}
          paneId={pane.id}
          onDismiss={onDismiss}
        />
      );
    default:
      return null;
  }
}

function GlassShell({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "compact";
}) {
  return (
    <div
      className="glass-pane relative overflow-hidden rounded-xl"
      style={{
        padding: variant === "compact" ? "10px 14px" : "16px 18px",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent"
      />
      {children}
    </div>
  );
}

function HeaderRow({
  icon,
  badge,
  label,
  onDismiss,
  paneId,
}: {
  icon: React.ReactNode;
  badge?: string;
  label?: string;
  onDismiss?: (id: string) => void;
  paneId?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)]">
          {icon}
        </div>
        <div className="flex flex-col">
          {badge && (
            <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--accent)]">
              {badge}
            </span>
          )}
          {label && (
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
              {label}
            </span>
          )}
        </div>
      </div>
      {onDismiss && paneId && (
        <button
          onClick={() => onDismiss(paneId)}
          className="-mr-1 -mt-1 rounded p-1 text-[var(--foreground-faint)] transition-colors hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--foreground)]"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

// ─── Statute card ──────────────────────────────────────────────────────────

export function StatutePaneCard({
  pane,
  onDismiss,
  onSeeAlsoClick,
}: {
  pane: StatutePane;
  onDismiss?: (id: string) => void;
  onSeeAlsoClick?: (item: SeeAlsoItem) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 220);
    return () => clearTimeout(t);
  }, []);

  const hasMore =
    (pane.fullText && pane.fullText.length > (pane.quote?.length ?? 0)) ||
    (pane.seeAlso && pane.seeAlso.length > 0);
  const confPct =
    typeof pane.confidence === "number"
      ? Math.round(pane.confidence * 100)
      : null;
  const matchLabel = confPct === null
    ? null
    : confPct >= 80
      ? "High match"
      : confPct >= 60
        ? "Good match"
        : "Partial match";

  return (
    <GlassShell>
      {/* Eyebrow: "Authority · jurisdiction · match badge" */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Scroll
            className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
            strokeWidth={1.9}
          />
          <span className="truncate font-mono text-[9px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]">
            Authority · {pane.jurisdiction || "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {matchLabel && (
            <span
              className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/[0.08] px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.22em] text-[var(--accent)]"
              title={`Cosine similarity ${confPct}%`}
            >
              {matchLabel} · {confPct}%
            </span>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(pane.id)}
              className="rounded-md p-0.5 text-[var(--foreground-faint)] hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Section number in bigger mono */}
      <div className="mb-2 font-mono text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {pane.section}
      </div>

      {!revealed ? (
        <div className="mt-3 space-y-2">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
        </div>
      ) : (
        <>
          {pane.title && (
            <h4 className="mb-2 font-display text-[15px] font-semibold leading-snug text-[var(--foreground)]">
              {pane.title}
            </h4>
          )}
          {/* EN / (optional) FR blockquotes. English only = full width.
              Each blockquote gets a yellow highlighter sweep on first
              reveal — a marker passes over the text once (450ms, eased)
              then a faint persistent tint stays behind the quote so
              the caller can see at a glance "THIS is the part of the
              law Harvey is pointing at." */}
          {(() => {
            const hasFrench = Boolean(pane.frenchQuote || pane.frenchFullText);
            const enText = expanded && pane.fullText ? pane.fullText : pane.quote;
            const frText = expanded && pane.frenchFullText
              ? pane.frenchFullText
              : pane.frenchQuote ?? "";
            return (
              <div
                className={
                  hasFrench
                    ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                    : "w-full"
                }
              >
                <HighlightedQuote
                  label="English"
                  text={enText}
                  tone="primary"
                />
                {hasFrench && (
                  <HighlightedQuote
                    label="Français"
                    text={frText}
                    tone="accent"
                  />
                )}
              </div>
            );
          })()}

          {/* Expand: full statute + see-also pills */}
          {hasMore && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="mt-2 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            >
              {expanded ? "Collapse" : "Read full statute"}
              <span aria-hidden>{expanded ? "▲" : "▼"}</span>
            </button>
          )}
          {expanded && pane.seeAlso && pane.seeAlso.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
                See also · tap to open
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pane.seeAlso.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSeeAlsoClick?.(s)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--rule-strong)] bg-white/60 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
                    title={s.source}
                  >
                    <span className="text-[var(--foreground)] group-hover:text-[var(--accent)]">
                      {s.section}
                    </span>
                    <span className="text-[var(--foreground-faint)]">·</span>
                    <span className="max-w-[160px] truncate normal-case tracking-normal">
                      {s.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-[var(--rule-strong)] pt-2 font-mono text-[9px] uppercase tracking-[0.28em] text-[var(--foreground-faint)]">
            <span>Harvey, cited</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />
              Statute
            </span>
          </div>
        </>
      )}
    </GlassShell>
  );
}

// ─── Highlighted quote ────────────────────────────────────────────────────
// The blockquote that wraps retrieved statute text. Instead of a full-body
// yellow wash, we identify the KEY LEGAL PHRASES a lawyer would actually
// mark with a highlighter — dollar amounts, prison terms, speeds, section
// numbers, operative verbs ("shall", "guilty", "liable"), and penalty
// words ("fine", "imprisonment", "suspension"). Each match gets its own
// mini "highlighter stroke" animation: a yellow background fades in over
// just that span with a slight stagger so the eye tracks from one marked
// phrase to the next. Feels like watching someone mark up a statute in
// real time, not a wash of yellow over the whole block.

// One ordered regex list. Earlier entries win when they overlap (matches
// that partially cover later patterns are preserved). Order matters —
// multi-word phrases come first so single-word overlaps don't split them.
const HIGHLIGHT_PATTERNS: RegExp[] = [
  // Section / subsection references: "section 172", "s. 172(1)", "subsection (2)"
  /\b(?:sub)?section\s+\d+(?:\.\d+)?(?:\s*\(\d+\))?\b/gi,
  /\bs\.\s*\d+(?:\.\d+)?(?:\s*\(\d+\))?\b/gi,
  // Dollar amounts: $10,000 / $10000 / $5 million
  /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*(?:million|billion|thousand))?/gi,
  // Prison / suspension / impound durations: "14 days", "two years"
  /\b\d+\s*(?:year|month|day|week|hour)s?\b/gi,
  /\b(?:one|two|three|four|five|six|ten|twelve|fourteen|thirty|sixty|ninety|hundred)\s+(?:year|month|day|week)s?\b/gi,
  // Speeds: "50 km/h", "50 km per hour", "50 kilometres per hour"
  /\b\d+\s*(?:km\/h|km\s*per\s*hour|kilometres?\s*per\s*hour|mph)\b/gi,
  // "50 kilometres over" / "50 over" — Ontario stunt-driving language
  /\b\d+\s+(?:kilometres?|km)\s+(?:per\s+hour\s+)?(?:or\s+more\s+)?over\b/gi,
  // Multi-word legal phrases
  /\bcommits?\s+an?\s+offence\b/gi,
  /\bguilty\s+of\s+an?\s+offence\b/gi,
  /\bliable\s+on\s+(?:summary\s+)?conviction\b/gi,
  /\b(?:on\s+)?summary\s+conviction\b/gi,
  /\bby\s+way\s+of\s+indictment\b/gi,
  /\bfor\s+a\s+term\s+of\b/gi,
  /\bimprisonment\s+for\b/gi,
  // Single operative / penalty words
  /\b(?:fine|fines|imprisonment|suspension|suspended|revoked|impound(?:ed)?|conviction|convicted|offence|offences|penalty|penalties|prohibited|prohibit)\b/gi,
  /\b(?:shall|must|may\s+not|no\s+person)\b/gi,
];

type Segment = { text: string; highlight: boolean };

function segmentForHighlights(text: string): Segment[] {
  // Collect every match across every pattern as [start, end) intervals.
  const intervals: Array<[number, number]> = [];
  for (const re of HIGHLIGHT_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (m.index === undefined) continue;
      intervals.push([m.index, m.index + m[0].length]);
    }
  }
  if (intervals.length === 0) {
    return [{ text, highlight: false }];
  }
  // Merge overlapping intervals into maximal ranges.
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of intervals) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    } else {
      merged.push([s, e]);
    }
  }
  // Walk the text producing alternating plain / highlighted segments.
  const out: Segment[] = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor) out.push({ text: text.slice(cursor, s), highlight: false });
    out.push({ text: text.slice(s, e), highlight: true });
    cursor = e;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), highlight: false });
  return out;
}

function HighlightedQuote({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "primary" | "accent";
}) {
  const borderClass =
    tone === "primary"
      ? "border-[var(--foreground)]"
      : "border-[var(--accent)]/60";
  const italic = tone === "accent" ? "italic" : "";
  const labelClass =
    tone === "primary"
      ? "text-[var(--foreground-faint)]"
      : "not-italic text-[var(--accent)]/80";

  const segments = useMemo(() => segmentForHighlights(text), [text]);

  // Stagger each highlight so they appear to be marked one after
  // another, not all at once. Start delay + per-highlight increment.
  let highlightIndex = 0;

  return (
    <blockquote
      className={`relative border-l-[3px] ${borderClass} py-1 pl-4 font-display text-[13.5px] leading-[1.55] text-[var(--foreground)] ${italic}`}
    >
      <div
        className={`mb-1 font-mono text-[8.5px] uppercase tracking-[0.32em] ${labelClass}`}
      >
        {label}
      </div>
      <div>
        {segments.map((seg, i) => {
          if (!seg.highlight) {
            return <span key={i}>{seg.text}</span>;
          }
          const myIndex = highlightIndex++;
          return (
            <motion.span
              key={i}
              initial={{
                backgroundColor: "rgba(255,241,118,0)",
                boxShadow: "inset 0 0 0 rgba(255,241,118,0)",
              }}
              animate={{
                backgroundColor: "rgba(255,241,118,0.62)",
                boxShadow: "inset 0 -0.12em 0 rgba(250,204,21,0.55)",
              }}
              transition={{
                duration: 0.32,
                delay: 0.28 + myIndex * 0.09,
                ease: [0.22, 0.9, 0.25, 1],
              }}
              className="rounded-[2px] px-[1px]"
            >
              {seg.text}
            </motion.span>
          );
        })}
      </div>
    </blockquote>
  );
}

// ─── Tool pill ─────────────────────────────────────────────────────────────

export function ToolPill({ pane }: { pane: ToolCallPane }) {
  const isComplete = pane.status === "complete" || pane.status === "success";
  const isError = pane.status === "error" || pane.status === "failed";
  return (
    <div className="glass-pane flex items-center gap-2.5 rounded-full px-3 py-1.5">
      {isComplete ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={2} />
      ) : isError ? (
        <X className="h-3.5 w-3.5 text-[var(--crimson)]" strokeWidth={2} />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" strokeWidth={2} />
      )}
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--foreground-muted)]">
        {isComplete ? "Retrieved" : isError ? "Failed" : "Pulling"}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--foreground)]">
        {pane.name}
      </span>
    </div>
  );
}
