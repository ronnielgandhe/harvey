"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, TrendingUp, X } from "lucide-react";

export interface StockCardData {
  query?: string;
  symbol?: string;
  shortName?: string;
  currency?: string;
  price?: number;
  previousClose?: number;
  change?: number;
  changePct?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  exchange?: string;
  error?: string;
  message?: string;
}

interface Props {
  data: StockCardData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

/**
 * Compact financial-terminal-style ticker card. Renders on the LEFT
 * column when Harvey calls `stock_ticker`. Shows symbol, current
 * price, change, day range, 52-week range.
 */
export function StockCardPane({ data, paneId, onDismiss }: Props) {
  if (data.error) {
    return (
      <div className="glass-pane relative overflow-hidden rounded-xl px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
            Market · {data.query}
          </span>
          {onDismiss && (
            <button
              onClick={() => onDismiss(paneId)}
              className="rounded-md p-0.5 text-[var(--foreground-faint)] hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="text-[12px] text-[var(--foreground-muted)]">
          {data.message ?? "No live quote available."}
        </div>
      </div>
    );
  }

  const up = (data.change ?? 0) >= 0;
  const color = up ? "var(--accent)" : "var(--crimson)";
  const Arrow = up ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="glass-pane relative overflow-hidden rounded-xl p-4">
      {/* Header row: symbol + dismiss */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp
            className="h-3.5 w-3.5 text-[var(--accent)]"
            strokeWidth={2.2}
          />
          <div className="flex flex-col">
            <span className="font-mono text-[13px] font-semibold text-[var(--foreground)]">
              {data.symbol}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--foreground-faint)]">
              {data.exchange || "market"}
            </span>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(paneId)}
            className="rounded-md p-0.5 text-[var(--foreground-faint)] hover:bg-black/5"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Company */}
      <div className="mb-2 text-[11px] font-medium leading-tight text-[var(--foreground-muted)]">
        {data.shortName}
      </div>

      {/* Price + change */}
      <div className="mb-3 flex items-baseline gap-2">
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="font-mono text-[22px] font-semibold tabular-nums text-[var(--foreground)]"
        >
          {data.price?.toFixed(2)}
        </motion.span>
        <span className="font-mono text-[10px] uppercase text-[var(--foreground-faint)]">
          {data.currency}
        </span>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-3 flex items-center gap-1.5 font-mono text-[12px] tabular-nums"
        style={{ color }}
      >
        <Arrow className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span className="font-semibold">
          {up ? "+" : ""}
          {data.change?.toFixed(2)}
        </span>
        <span>
          ({up ? "+" : ""}
          {data.changePct?.toFixed(2)}%)
        </span>
      </motion.div>

      {/* Range bar */}
      {data.fiftyTwoWeekLow !== undefined &&
        data.fiftyTwoWeekHigh !== undefined &&
        data.price !== undefined && (
          <RangeBar
            low={data.fiftyTwoWeekLow}
            high={data.fiftyTwoWeekHigh}
            current={data.price}
            label="52-wk"
          />
        )}
      {data.dayLow !== undefined &&
        data.dayHigh !== undefined &&
        data.price !== undefined && (
          <div className="mt-2">
            <RangeBar
              low={data.dayLow}
              high={data.dayHigh}
              current={data.price}
              label="Day"
            />
          </div>
        )}
    </div>
  );
}

function RangeBar({
  low,
  high,
  current,
  label,
}: {
  low: number;
  high: number;
  current: number;
  label: string;
}) {
  const pct =
    high > low ? Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100)) : 50;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.22em] text-[var(--foreground-faint)]">
        <span>{label}</span>
        <span>
          {low.toFixed(2)} – {high.toFixed(2)}
        </span>
      </div>
      <div className="relative h-[3px] rounded-full bg-[var(--rule-strong)]/60">
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.2, 0.9, 0.3, 1] }}
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
        />
        <div
          aria-hidden
          className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-[var(--foreground)] bg-white"
          style={{ left: `calc(${pct}% - 3px)` }}
        />
      </div>
    </div>
  );
}
