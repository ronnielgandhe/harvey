"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";

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
  /** Optional recent close prices for the sparkline (oldest → newest). */
  closes?: number[];
  error?: string;
  message?: string;
}

interface Props {
  data: StockCardData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

export function StockCardPane({ data, paneId, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

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
    <div className="glass-pane relative overflow-hidden rounded-xl">
      {/* Header — clickable to expand */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full cursor-pointer items-start justify-between p-4 text-left transition-colors hover:bg-black/[0.02]"
      >
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
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-md p-0.5 text-[var(--foreground-faint)]"
            aria-hidden
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.div>
          {onDismiss && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(paneId);
              }}
              className="rounded-md p-0.5 text-[var(--foreground-faint)] hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </div>
      </button>

      <div className="px-4 pb-4">
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

        {/* Sparkline — always visible, this IS the card */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.28em] text-[var(--foreground-faint)]">
            <span>1-month trend</span>
            <span>{data.closes?.length ?? 0} pts</span>
          </div>
          <Sparkline data={data.closes ?? []} up={up} />
        </div>

        {/* Range bars (always visible) */}
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

        {/* Expanded: fundamentals grid (editorial breakdown) */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
              className="mt-4 overflow-hidden"
            >
              <div className="border-t border-[var(--rule-strong)] pt-3">
                <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
                  Fundamentals
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
                  <FactRow label="Prev close" value={fmt(data.previousClose)} />
                  <FactRow
                    label="Day range"
                    value={
                      data.dayLow !== undefined && data.dayHigh !== undefined
                        ? `${fmt(data.dayLow)} – ${fmt(data.dayHigh)}`
                        : "—"
                    }
                  />
                  <FactRow label="52wk high" value={fmt(data.fiftyTwoWeekHigh)} />
                  <FactRow label="52wk low" value={fmt(data.fiftyTwoWeekLow)} />
                </dl>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function fmt(n?: number): string {
  return typeof n === "number" ? n.toFixed(2) : "—";
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="uppercase tracking-[0.24em] text-[var(--foreground-faint)]">
        {label}
      </dt>
      <dd className="text-right tabular-nums text-[var(--foreground)]">
        {value}
      </dd>
    </>
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

/**
 * Lightweight SVG sparkline. Maps an array of closes to a scaled
 * polyline; area below is filled faintly in the direction color.
 */
function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-[60px] items-center justify-center rounded-sm border border-dashed border-[var(--rule-strong)] font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--foreground-faint)]">
        Chart data pending
      </div>
    );
  }
  const w = 280;
  const h = 60;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  const stroke = up ? "var(--accent)" : "var(--crimson)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[60px] w-full" aria-hidden>
      <polygon
        points={area}
        fill={stroke}
        fillOpacity={0.1}
      />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
