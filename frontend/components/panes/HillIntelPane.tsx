"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Landmark, X } from "lucide-react";

export interface HillTrade {
  ticker: string;
  member: string;
  chamber: string;
  party: string;
  state?: string;
  side: string; // "buy" | "sell"
  size: string;
  filed: string;
  traded: string;
}

export interface HillIntelData {
  ticker: string;
  trades: HillTrade[];
  /** Optional — "quiver" means live QuiverQuant feed, "curated" = local sample */
  source?: "quiver" | "curated" | string;
}

interface Props {
  data: HillIntelData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

/** 2026-03-05 → "Mar 5" */
function fmtDate(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  if (Number.isNaN(mo) || mo < 0 || mo > 11) return iso;
  return `${months[mo]} ${d}`;
}

/**
 * "Harvey has sources on the Hill." Congressional STOCK Act filings
 * presented as a scannable intel-terminal dossier:
 *
 *   HILL INTEL · NVDA        ● LIVE · QUIVER
 *   ────────────────────────────────
 *   BUY  $1M–$5M                 [D]
 *   NANCY PELOSI
 *   House · traded Mar 5 / filed Mar 12
 *   ────────────────────────────────
 *   SELL $250K–$500K             [R]
 *   TOMMY TUBERVILLE
 *   Senate · traded Feb 28 / filed Mar 8
 */
export function HillIntelPane({ data, paneId, onDismiss }: Props) {
  const isLive = data.source === "quiver";
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--rule-strong)] bg-white/85 shadow-[0_6px_24px_rgba(0,0,0,0.05)] backdrop-blur-sm"
    >
      {/* Header — monospace terminal bar */}
      <div className="flex items-center justify-between border-b border-[var(--rule-strong)] bg-[rgba(20,18,14,0.03)] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Landmark
            className="h-3.5 w-3.5 text-[var(--foreground)]"
            strokeWidth={2.2}
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
            Hill intel
          </span>
          <span className="font-mono text-[11px] font-semibold text-[var(--foreground)]">
            · {data.ticker}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em]">
            <span className="relative flex h-1.5 w-1.5">
              {isLive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--positive)]/70" />
              )}
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: isLive
                    ? "var(--positive)"
                    : "var(--foreground-faint)",
                }}
              />
            </span>
            <span
              style={{
                color: isLive
                  ? "var(--positive)"
                  : "var(--foreground-muted)",
              }}
            >
              {isLive ? "Live · Quiver" : "Curated"}
            </span>
          </span>
          {onDismiss && (
            <button
              onClick={() => onDismiss(paneId)}
              className="rounded-md p-0.5 text-[var(--foreground-faint)] hover:bg-black/5 hover:text-[var(--foreground)]"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Trades */}
      {data.trades.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-[var(--foreground-muted)]">
          No recent disclosures on file
        </div>
      ) : (
        <ul className="divide-y divide-[var(--rule-strong)]">
          {data.trades.map((t, i) => (
            <TradeRow key={`${paneId}-${i}`} trade={t} index={i} />
          ))}
        </ul>
      )}

      {/* Footer — bigger, real-weight labels so the disclosure actually
          reads. Was 9/10px faint; bumping to 11/12px muted. */}
      <div className="flex items-center justify-between border-t border-[var(--rule-strong)] bg-[rgba(20,18,14,0.035)] px-4 py-2.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--foreground-muted)]">
          STOCK Act · Public disclosure
        </span>
        <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--foreground-muted)]">
          Not investment advice
        </span>
      </div>
    </div>
  );
}

function TradeRow({ trade, index }: { trade: HillTrade; index: number }) {
  const isBuy = trade.side.toLowerCase() === "buy";
  const Arrow = isBuy ? ArrowUp : ArrowDown;
  const dirColor = isBuy ? "var(--positive)" : "var(--negative)";
  const dirSoft = isBuy ? "var(--positive-soft)" : "var(--negative-soft)";

  const party = (trade.party || "").trim().toUpperCase();
  const partyStyle =
    party === "D"
      ? {
          color: "#1E50B4",
          background: "rgba(30,80,180,0.10)",
          border: "1px solid rgba(30,80,180,0.32)",
        }
      : party === "R"
        ? {
            color: "var(--negative)",
            background: "rgba(192,32,40,0.08)",
            border: "1px solid rgba(192,32,40,0.32)",
          }
        : {
            color: "var(--foreground-muted)",
            background: "rgba(0,0,0,0.04)",
            border: "1px solid var(--rule-strong)",
          };

  const subtitle = [
    trade.chamber,
    trade.state,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="relative px-4 py-3"
      style={{
        background:
          "linear-gradient(90deg, " + dirSoft + " 0%, transparent 100%)",
      }}
    >
      {/* Colored left edge bar — at-a-glance direction signal */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: dirColor }}
      />

      {/* Top row: direction pill + size + party chip */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: dirColor, background: "white", border: `1px solid ${dirColor}` }}
        >
          <Arrow className="h-3 w-3" strokeWidth={3} />
          {isBuy ? "Buy" : "Sell"}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[12px] font-bold tabular-nums"
            style={{ color: "var(--foreground)" }}
          >
            {trade.size || "—"}
          </span>
          {party && (
            <span
              className="rounded-sm px-1.5 py-[1px] font-mono text-[9.5px] font-bold tracking-[0.06em]"
              style={partyStyle}
            >
              {party}
            </span>
          )}
        </div>
      </div>

      {/* Member name */}
      <div className="mt-1.5 text-[15.5px] font-semibold leading-tight tracking-[-0.005em] text-[var(--foreground)]">
        {trade.member}
      </div>

      {/* Subtitle + dates — bumped from 10/10.5px to 12/12px so the
          trade date is actually legible. Dates are now in the body
          muted color (was faint), so "Traded Jan 9" reads on the card. */}
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[12px] text-[var(--foreground-muted)]">
          {subtitle || "—"}
        </span>
        <span className="whitespace-nowrap font-mono text-[12px] font-medium tabular-nums text-[var(--foreground-muted)]">
          {trade.traded ? `Traded ${fmtDate(trade.traded)}` : ""}
          {trade.filed && (
            <>
              {trade.traded && (
                <span className="mx-1.5 text-[var(--foreground-faint)]">·</span>
              )}
              <span className="text-[var(--foreground-faint)]">
                Filed {fmtDate(trade.filed)}
              </span>
            </>
          )}
        </span>
      </div>
    </motion.li>
  );
}
