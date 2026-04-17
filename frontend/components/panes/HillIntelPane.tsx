"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Landmark, X } from "lucide-react";

export interface HillTrade {
  ticker: string;
  member: string;
  chamber: string;
  party: string;
  state: string;
  side: string; // "buy" | "sell"
  size: string;
  filed: string;
  traded: string;
}

export interface HillIntelData {
  ticker: string;
  trades: HillTrade[];
}

interface Props {
  data: HillIntelData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

/**
 * "Harvey has sources on the Hill." A vintage surveillance-dossier
 * card showing recent Congressional trading in a specific ticker.
 * Each trade styled like a classified file entry.
 */
export function HillIntelPane({ data, paneId, onDismiss }: Props) {
  return (
    <div className="glass-pane relative overflow-hidden rounded-xl p-4">
      {/* Classified-file eyebrow */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark
            className="h-3.5 w-3.5 text-[var(--accent)]"
            strokeWidth={2.2}
          />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.3em] text-[var(--foreground-faint)]">
            Hill intel · {data.ticker}
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

      {/* "Surveillance dossier" stamp row */}
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-[var(--rule-strong)]" />
        <span className="rounded-sm border border-[var(--crimson)]/50 px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.4em] text-[var(--crimson)]">
          STOCK Act · filed
        </span>
        <div className="h-px flex-1 bg-[var(--rule-strong)]" />
      </div>

      {/* Trade list */}
      {data.trades.length === 0 ? (
        <div className="py-4 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-faint)]">
          No recent disclosures on file
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.trades.map((t, i) => {
            const isBuy = t.side.toLowerCase() === "buy";
            const Arrow = isBuy ? ArrowUp : ArrowDown;
            const colorVar = isBuy ? "var(--accent)" : "var(--crimson)";
            return (
              <motion.li
                key={`${paneId}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="relative flex items-start gap-3 border-l-2 border-[var(--rule-strong)] pl-3"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Arrow
                      className="h-3 w-3"
                      strokeWidth={2.5}
                      style={{ color: colorVar }}
                    />
                    <span
                      className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em]"
                      style={{ color: colorVar }}
                    >
                      {t.side}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-[var(--foreground)]">
                      {t.size}
                    </span>
                  </div>
                  <div className="font-display text-[13px] leading-tight text-[var(--foreground)]">
                    {t.member}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--foreground-faint)]">
                    <span>
                      {t.party} · {t.state} · {t.chamber}
                    </span>
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--foreground-faint)]">
                    Traded {t.traded} · filed {t.filed}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* Fine print */}
      <div className="mt-3 border-t border-[var(--rule-strong)] pt-2 font-mono text-[8.5px] uppercase tracking-[0.24em] text-[var(--foreground-faint)]">
        Public disclosure · Not investment advice
      </div>
    </div>
  );
}
