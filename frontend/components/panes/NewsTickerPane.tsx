"use client";

import { motion } from "framer-motion";
import { ExternalLink, Newspaper, X } from "lucide-react";

export interface NewsItem {
  title: string;
  source: string;
  published: string;
  link: string;
  summary?: string;
}

export interface NewsTickerData {
  query: string;
  items: NewsItem[];
}

interface Props {
  data: NewsTickerData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

/**
 * Bloomberg-terminal-ish glass pane that materializes when Harvey calls
 * `current_events`. Shows the top headlines Google News returned for
 * the user's query — animated in staggered from the top.
 */
export function NewsTickerPane({ data, paneId, onDismiss }: Props) {
  return (
    <div className="glass-pane relative overflow-hidden rounded-xl p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper
            className="h-3.5 w-3.5 text-[var(--accent)]"
            strokeWidth={2.2}
          />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.3em] text-[var(--foreground-faint)]">
            Live · Current Events
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

      {/* Query echo */}
      <div className="mb-3 font-display text-[13px] italic text-[var(--foreground-muted)]">
        “{data.query}”
      </div>

      {/* Headlines */}
      <ol className="flex flex-col gap-2.5">
        {data.items.map((item, i) => (
          <motion.li
            key={`${paneId}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="group"
          >
            <a
              href={item.link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-l-2 border-[var(--rule-strong)] pl-3 transition-colors hover:border-[var(--accent)]"
            >
              <div className="flex items-start gap-2">
                <span className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--foreground-faint)]">
                  0{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] leading-tight text-[var(--foreground)] group-hover:text-[var(--accent)]">
                    {item.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--foreground-faint)]">
                    <span className="truncate">{item.source || "source"}</span>
                    {item.published && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">
                          {fmtWhen(item.published)}
                        </span>
                      </>
                    )}
                    {item.link && (
                      <ExternalLink
                        className="ml-auto h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        strokeWidth={2}
                      />
                    )}
                  </div>
                </div>
              </div>
            </a>
          </motion.li>
        ))}
      </ol>

      {data.items.length === 0 && (
        <div className="py-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--foreground-faint)]">
          No headlines returned
        </div>
      )}
    </div>
  );
}

function fmtWhen(published: string): string {
  // feedparser usually returns an RFC-822 date — try to show a concise label.
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
