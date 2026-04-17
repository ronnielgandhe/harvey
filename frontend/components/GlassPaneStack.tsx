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
import {
  OpenResourcePane,
  type OpenResourceData,
} from "./panes/OpenResourcePane";
import { AskUserPane, type AskUserData } from "./panes/AskUserPane";
import {
  ActionChecklistPane,
  type ActionChecklistData,
} from "./panes/ActionChecklistPane";
import { NewsTickerPane, type NewsTickerData } from "./panes/NewsTickerPane";
import {
  ArticleSpotlightPane,
  type ArticleSpotlightData,
} from "./panes/ArticleSpotlightPane";
import { StockCardPane, type StockCardData } from "./panes/StockCardPane";

// ─────────────────────────────────────────────────────────────────────────────
// Pane types
// ─────────────────────────────────────────────────────────────────────────────

export type Pane =
  | StatutePane
  | CaseUpdatePane
  | DraftPane
  | PlayPane
  | ToolCallPane
  | OpenResourcePane
  | AskUserPaneType
  | ActionChecklistPaneType
  | NewsTickerPaneType
  | ArticleSpotlightPaneType
  | StockCardPaneType;

export interface StatutePane {
  kind: "statute";
  id: string;
  jurisdiction: string;
  section: string;
  title: string;
  quote: string;
}

export interface CaseUpdatePane {
  kind: "case_update";
  id: string;
  field: string;
  value: string;
}

export interface DraftPane {
  kind: "draft";
  id: string;
  recipient?: string;
  tones?: string[];
  body: string;
}

export interface PlayStep {
  label: string;
  body: string;
}

export interface PlayPane {
  kind: "play";
  id: string;
  title: string;
  steps: PlayStep[];
}

export interface ToolCallPane {
  kind: "tool_call";
  id: string;
  name: string;
  status: "running" | "complete" | "error" | string;
}

export interface OpenResourcePane {
  kind: "open_resource";
  id: string;
  data: OpenResourceData;
}

export interface AskUserPaneType {
  kind: "ask_user";
  id: string;
  data: AskUserData;
}

export interface ActionChecklistPaneType {
  kind: "action_checklist";
  id: string;
  data: ActionChecklistData;
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

// ─────────────────────────────────────────────────────────────────────────────
// Container
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  panes: Pane[];
  onDismiss?: (id: string) => void;
}

export function GlassPaneStack({ panes, onDismiss }: Props) {
  const toolCalls = panes.filter((p): p is ToolCallPane => p.kind === "tool_call");
  const cards = panes.filter(
    (p) => p.kind !== "tool_call" && p.kind !== "stock_card",
  );
  const stocks = panes.filter(
    (p): p is StockCardPaneType => p.kind === "stock_card",
  );

  return (
    <>
      {/* Left stack: stock tickers */}
      <div className="pointer-events-none fixed left-5 top-32 bottom-24 z-30 flex w-[260px] max-w-[85vw] flex-col gap-3">
        <AnimatePresence initial={false}>
          {stocks.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, x: -80, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -60, scale: 0.94 }}
              transition={{ duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
              className="pointer-events-auto"
            >
              <StockCardPane data={p.data} paneId={p.id} onDismiss={onDismiss} />
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
              <PaneCard pane={p} onDismiss={onDismiss} />
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

function PaneCard({ pane, onDismiss }: { pane: Pane; onDismiss?: (id: string) => void }) {
  switch (pane.kind) {
    case "statute":
      return <StatutePaneCard pane={pane} onDismiss={onDismiss} />;
    case "case_update":
      return <CaseUpdateCard pane={pane} onDismiss={onDismiss} />;
    case "draft":
      return <DraftCard pane={pane} onDismiss={onDismiss} />;
    case "play":
      return <PlayCard pane={pane} onDismiss={onDismiss} />;
    case "open_resource":
      return (
        <OpenResourcePane data={pane.data} paneId={pane.id} onDismiss={onDismiss} />
      );
    case "ask_user":
      return <AskUserPane data={pane.data} paneId={pane.id} onDismiss={onDismiss} />;
    case "action_checklist":
      return (
        <ActionChecklistPane
          data={pane.data}
          paneId={pane.id}
          onDismiss={onDismiss}
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

function StatutePaneCard({
  pane,
  onDismiss,
}: {
  pane: StatutePane;
  onDismiss?: (id: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 220);
    return () => clearTimeout(t);
  }, []);

  // Styled like an actual legal-brief callout: small "Authority" eyebrow,
  // § section in monospace, statute body in serif with a heavier left
  // rule, source document attribution at the bottom.
  return (
    <GlassShell>
      {/* Eyebrow: "Authority" + dismiss */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scroll
            className="h-3.5 w-3.5 text-[var(--accent)]"
            strokeWidth={1.9}
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]">
            Authority · {pane.jurisdiction || "—"}
          </span>
        </div>
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

      {/* Section number in bigger mono — looks like a real cite line */}
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
          {/* Heavier left rule + darker serif quote — reads as statute */}
          <blockquote className="border-l-[3px] border-[var(--foreground)] bg-[var(--background)]/40 py-1 pl-4 font-display text-[13.5px] leading-[1.55] text-[var(--foreground)]">
            {pane.quote}
          </blockquote>
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

// ─── Case file update — TINY pill ──────────────────────────────────────────

function CaseUpdateCard({
  pane,
  onDismiss,
}: {
  pane: CaseUpdatePane;
  onDismiss?: (id: string) => void;
}) {
  return (
    <GlassShell variant="compact">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-3 w-3 shrink-0 text-[var(--accent)]" strokeWidth={1.75} />
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.28em] text-[var(--foreground-faint)]">
            {pane.field.replace(/_/g, " ")}
          </span>
          <span className="text-[var(--foreground-faint)]">·</span>
          <span className="truncate font-display text-[13px] leading-snug text-[var(--foreground)]">
            {pane.value}
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(pane.id)}
            className="-mr-1 shrink-0 rounded p-1 text-[var(--foreground-faint)] transition-colors hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--foreground)]"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </GlassShell>
  );
}

// ─── Draft / Letter ────────────────────────────────────────────────────────

function DraftCard({
  pane,
  onDismiss,
}: {
  pane: DraftPane;
  onDismiss?: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(pane.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <GlassShell>
      <HeaderRow
        icon={<Mail className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.75} />}
        badge="DRAFT"
        label={pane.recipient ? `to ${pane.recipient}` : undefined}
        onDismiss={onDismiss}
        paneId={pane.id}
      />
      {pane.tones && pane.tones.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pane.tones.map((tone) => (
            <span
              key={tone}
              className="rounded-full border border-[var(--rule-strong)] bg-[var(--background-elev)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--foreground-muted)]"
            >
              {tone}
            </span>
          ))}
        </div>
      )}
      <div className="thin-scroll mt-3 max-h-[260px] overflow-y-auto rounded-md border border-[var(--rule)] bg-[var(--paper)] p-3 font-display text-[13px] leading-[1.6] text-[var(--foreground)] whitespace-pre-wrap">
        {pane.body}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--foreground-faint)]">
          Draft · Privileged
        </span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/15"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" strokeWidth={2} /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" strokeWidth={2} /> Copy
            </>
          )}
        </button>
      </div>
    </GlassShell>
  );
}

// ─── Negotiation play ──────────────────────────────────────────────────────

function PlayCard({
  pane,
  onDismiss,
}: {
  pane: PlayPane;
  onDismiss?: (id: string) => void;
}) {
  return (
    <GlassShell>
      <HeaderRow
        icon={<Swords className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.75} />}
        badge="PLAY"
        label={pane.title}
        onDismiss={onDismiss}
        paneId={pane.id}
      />
      <ol className="mt-3 space-y-2.5">
        {pane.steps.map((step, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 + 0.1, duration: 0.3 }}
            className="flex gap-3 rounded-md border border-[var(--rule)] bg-[var(--background-elev)] p-2.5"
          >
            <span className="font-mono text-[11px] tabular-nums text-[var(--accent)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex-1">
              <div className="font-display text-[14px] tracking-tight text-[var(--foreground)]">
                {step.label}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--foreground-muted)]">
                {step.body}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>
    </GlassShell>
  );
}

// ─── Tool pill ─────────────────────────────────────────────────────────────

function ToolPill({ pane }: { pane: ToolCallPane }) {
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
