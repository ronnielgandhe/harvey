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
  /** Recent close prices for the sparkline (oldest → newest). */
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
          <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-[var(--foreground-faint)]">
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
  const dirColor = up ? "var(--positive)" : "var(--negative)";
  const dirSoft = up ? "var(--positive-soft)" : "var(--negative-soft)";
  const Arrow = up ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-xl border border-[var(--rule-strong)] shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
      style={{
        // Subtle direction-tinted gradient background — green wash for
        // gainers, red wash for losers. Keeps the card alive without
        // overwhelming the copy.
        background:
          `linear-gradient(180deg, rgba(255,255,255,0.95) 0%, ${dirSoft} 100%)`,
      }}
    >
      {/* Color bar — direction signal at a glance, top edge */}
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{ background: dirColor }}
      />

      {/* Header — clickable to expand */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full cursor-pointer items-start justify-between px-4 pt-3.5 pb-1 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ background: dirSoft, color: dirColor }}
          >
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[14px] font-semibold tracking-tight text-[var(--foreground)]">
              {data.symbol}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--foreground-faint)]">
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
        <div className="mt-0.5 text-[11.5px] font-medium leading-tight text-[var(--foreground-muted)]">
          {data.shortName}
        </div>

        {/* Price + change pill */}
        <div className="mt-3 flex items-baseline gap-2">
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="font-mono text-[26px] font-bold tabular-nums leading-none text-[var(--foreground)]"
          >
            {data.price?.toFixed(2)}
          </motion.span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-faint)]">
            {data.currency}
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[12px] font-semibold tabular-nums"
          style={{ background: dirSoft, color: dirColor }}
        >
          <Arrow className="h-3.5 w-3.5" strokeWidth={2.6} />
          <span>
            {up ? "+" : ""}
            {data.change?.toFixed(2)}
          </span>
          <span className="opacity-70">·</span>
          <span>
            {up ? "+" : ""}
            {data.changePct?.toFixed(2)}%
          </span>
        </motion.div>

        {/* Sparkline — always visible */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-[var(--foreground-muted)]">
            <span className="font-sans font-medium tracking-normal">
              1-month trend
            </span>
            <span className="font-mono tabular-nums text-[var(--foreground-faint)]">
              {data.closes?.length ?? 0} pts
            </span>
          </div>
          <Sparkline data={data.closes ?? []} up={up} />
        </div>

        {/* Range bars — always visible */}
        <div className="mt-4 space-y-2.5">
          {data.dayLow !== undefined &&
            data.dayHigh !== undefined &&
            data.price !== undefined && (
              <RangeBar
                low={data.dayLow}
                high={data.dayHigh}
                current={data.price}
                label="Day"
                currency={data.currency}
              />
            )}
          {data.fiftyTwoWeekLow !== undefined &&
            data.fiftyTwoWeekHigh !== undefined &&
            data.price !== undefined && (
              <RangeBar
                low={data.fiftyTwoWeekLow}
                high={data.fiftyTwoWeekHigh}
                current={data.price}
                label="52-week"
                currency={data.currency}
              />
            )}
        </div>

        {/* Expanded — fundamentals, stacked rows for clarity */}
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
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                  Fundamentals
                </div>
                <dl className="space-y-1.5">
                  <FactRow
                    label="Prev close"
                    value={fmt(data.previousClose)}
                    currency={data.currency}
                  />
                  <FactRow
                    label="Day range"
                    value={
                      data.dayLow !== undefined && data.dayHigh !== undefined
                        ? `${fmt(data.dayLow)} – ${fmt(data.dayHigh)}`
                        : "—"
                    }
                    currency={data.currency}
                  />
                  <FactRow
                    label="52-wk high"
                    value={fmt(data.fiftyTwoWeekHigh)}
                    currency={data.currency}
                  />
                  <FactRow
                    label="52-wk low"
                    value={fmt(data.fiftyTwoWeekLow)}
                    currency={data.currency}
                  />
                </dl>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function fmt(n?: number): string {
  return typeof n === "number" ? n.toFixed(2) : "—";
}

/**
 * One fundamentals row — label left, value right, same baseline. Tight
 * tracking so the label reads as a word, not letters floating apart.
 */
function FactRow({
  label,
  value,
  currency,
}: {
  label: string;
  value: string;
  currency?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--rule-strong)]/80 pb-1 last:border-b-0 last:pb-0">
      <dt className="text-[11.5px] font-medium text-[var(--foreground-muted)]">
        {label}
      </dt>
      <dd className="whitespace-nowrap text-right">
        <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
          {value}
        </span>
        {currency && value !== "—" && (
          <span className="ml-1 font-mono text-[9.5px] text-[var(--foreground-faint)]">
            {currency}
          </span>
        )}
      </dd>
    </div>
  );
}

function RangeBar({
  low,
  high,
  current,
  label,
  currency,
}: {
  low: number;
  high: number;
  current: number;
  label: string;
  currency?: string;
}) {
  const pct =
    high > low
      ? Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100))
      : 50;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-muted)]">
          {label}
        </span>
        <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-[var(--foreground-muted)]">
          {low.toFixed(2)}
          <span className="mx-1 text-[var(--foreground-faint)]">–</span>
          {high.toFixed(2)}
          {currency && (
            <span className="ml-1 text-[9px] text-[var(--foreground-faint)]">
              {currency}
            </span>
          )}
        </span>
      </div>
      <div className="relative h-[5px] overflow-hidden rounded-full bg-[var(--rule-strong)]/60">
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.2, 0.9, 0.3, 1] }}
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--foreground)]/70"
        />
        <div
          aria-hidden
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-[var(--foreground)] bg-white"
          style={{ left: `calc(${pct}% - 4px)` }}
        />
      </div>
    </div>
  );
}

/**
 * Lightweight SVG sparkline with SHARP joints, dotted gridlines, and
 * a data-point dot at every close. Feels like a real chart.
 */
function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-[80px] items-center justify-center rounded-sm border border-dashed border-[var(--rule-strong)] font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--foreground-faint)]">
        Chart data pending
      </div>
    );
  }
  const w = 280;
  const h = 80;
  const padY = 8;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const coords = data.map((v, i) => ({
    x: i * step,
    y: h - ((v - min) / span) * (h - padY * 2) - padY,
  }));
  const points = coords
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  const stroke = up ? "var(--positive)" : "var(--negative)";
  const gridYs = [h * 0.25, h * 0.5, h * 0.75];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[80px] w-full" aria-hidden>
      {gridYs.map((y) => (
        <line
          key={y}
          x1={0}
          x2={w}
          y1={y}
          y2={y}
          stroke="var(--rule-strong)"
          strokeWidth={0.5}
          strokeDasharray="2 3"
          opacity={0.55}
        />
      ))}
      <polygon points={area} fill={stroke} fillOpacity={0.13} />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeMiterlimit={4}
        shapeRendering="geometricPrecision"
      />
      {coords.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={1.6}
          fill={stroke}
          stroke="#ffffff"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
}
