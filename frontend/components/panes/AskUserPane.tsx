"use client";

import { useEffect } from "react";
import { Quote, X } from "lucide-react";

export interface AskUserData {
  question: string;
  field?: string;
}

interface Props {
  data: AskUserData;
  paneId: string;
  onDismiss?: (id: string) => void;
  /** Auto-dismiss after N ms — 0 disables */
  autoDismissMs?: number;
}

export function AskUserPane({
  data,
  paneId,
  onDismiss,
  autoDismissMs = 12000,
}: Props) {
  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;
    const t = setTimeout(() => onDismiss(paneId), autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, onDismiss, paneId]);

  return (
    <div className="glass-pane attention-pulse relative overflow-hidden rounded-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent"
      />

      <div className="relative px-5 pt-4 pb-5">
        {/* Top row: Q badge + dismiss */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)]">
            <Quote className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.75} />
          </div>
          {onDismiss && (
            <button
              onClick={() => onDismiss(paneId)}
              className="-mr-1 rounded p-1 text-[var(--foreground-faint)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--foreground)]"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Field tag */}
        {data.field && (
          <div className="mt-3 inline-block rounded-full border border-[var(--rule)] bg-[var(--background-elev)] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--foreground-muted)]">
            {data.field.replace(/_/g, " ")}
          </div>
        )}

        {/* Question */}
        <h3 className="mt-3 font-display text-[20px] leading-[1.2] tracking-tight text-[var(--foreground)]">
          {data.question}
        </h3>

        {/* Hint */}
        <div className="mt-4 flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--accent)]">
            Answer aloud →
          </span>
        </div>
      </div>
    </div>
  );
}
