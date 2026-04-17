"use client";

import { motion } from "framer-motion";
import { BookOpen, ExternalLink, X } from "lucide-react";

export interface ArticleSpotlightData {
  query: string;
  title: string;
  source: string;
  published: string;
  link: string;
  summary: string;
}

interface Props {
  data: ArticleSpotlightData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

/**
 * Featured article card — top headline expanded into a hero summary.
 * Opens alongside the news ticker when Harvey calls current_events,
 * giving the UI a multi-layered "spread" effect while he talks.
 */
export function ArticleSpotlightPane({ data, paneId, onDismiss }: Props) {
  return (
    <div className="glass-pane relative overflow-hidden rounded-xl p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen
            className="h-3.5 w-3.5 text-[var(--accent)]"
            strokeWidth={2.2}
          />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
            Top story · {data.source || "source"}
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(paneId)}
            className="rounded-md p-0.5 text-[var(--foreground-faint)] hover:bg-black/5"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Headline */}
      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="font-display text-[17px] leading-tight text-[var(--foreground)]"
      >
        {data.title}
      </motion.h3>

      {/* Summary paragraph */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mt-3 text-[13px] leading-relaxed text-[var(--foreground-muted)]"
      >
        {data.summary}
      </motion.p>

      {/* Meta + link */}
      <div className="mt-4 flex items-center justify-between border-t border-[var(--rule-strong)] pt-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--foreground-faint)]">
          {fmtDate(data.published)}
        </span>
        {data.link && (
          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--accent)] hover:underline"
          >
            Open full article
            <ExternalLink className="h-3 w-3" strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}

function fmtDate(published: string): string {
  const d = new Date(published);
  if (Number.isNaN(d.getTime())) return published.slice(0, 24);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const hr = Math.round(diffMs / 3_600_000);
  if (hr < 1) return "just now";
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}
