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
import { useEffect, useState } from "react";
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
}

export function GlassPaneStack({ panes, onDismiss, onSeeAlsoClick }: Props) {
  const toolCalls = panes.filter((p): p is ToolCallPane => p.kind === "tool_call");
  const cards = panes.filter(
    (p) =>
      p.kind !== "tool_call" &&
      p.kind !== "stock_card" &&
      p.kind !== "hill_intel",
  );
  // LEFT stack: market / insider lane (stock + Congress trades)
  const leftPanes = panes.filter(
    (p): p is StockCardPaneType | HillIntelPaneType =>
      p.kind === "stock_card" || p.kind === "hill_intel",
  );

  return (
    <>
      {/* Left stack: stock tickers + Hill intel */}
      <div className="pointer-events-none fixed left-5 top-32 bottom-24 z-30 flex w-[320px] max-w-[85vw] flex-col gap-3">
        <AnimatePresence initial={false}>
          {leftPanes.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, x: -80, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -60, scale: 0.94 }}
              transition={{ duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
              className="pointer-events-auto"
            >
              {p.kind === "stock_card" ? (
                <StockCardPane data={p.data} paneId={p.id} onDismiss={onDismiss} />
              ) : (
                <HillIntelPane data={p.data} paneId={p.id} onDismiss={onDismiss} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Right stack: tool pills + news + spotlight + legal (existing) */}
      <div className="pointer-events-none fixed right-5 top-20 bottom-24 z-30 flex w-[360px] max-w-[92vw] flex-col gap-3">
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

      {/* Stacked content cards */}
      <div className="thin-scroll pointer-events-auto flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {cards.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, x: 100, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.96 }}
              transition={{ duration: 0.45, ease: [0.2, 0.9, 0.3, 1] }}
            >
              <PaneCard
                pane={p}
                onDismiss={onDismiss}
                onSeeAlsoClick={onSeeAlsoClick}
              />
            </motion.div>
          ))}
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
          <blockquote className="border-l-[3px] border-[var(--foreground)] bg-[var(--background)]/40 py-1 pl-4 font-display text-[13.5px] leading-[1.55] text-[var(--foreground)]">
            {expanded && pane.fullText ? pane.fullText : pane.quote}
          </blockquote>

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
