"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { ReceiptCounts } from "./CaseReceipt";

/**
 * Compact itemized receipt shown in the LEFT slot (where "Meet Harvey"
 * lives) the moment a call ends. White paper, hairline rules, PSL
 * letterhead — the same billing language as the big modal receipt but
 * sized to sit beside the "Call again" button on the right.
 *
 * This is a read-only panel: the ask / confirm lives on the right side
 * (the "Call again" button in IncomingCall closes this out). Kept
 * deliberately short — it's a pause beat, not a PDF-able deliverable.
 */

interface Props {
  durationSec: number;
  counts: ReceiptCounts;
  /** Optional "go back" handler — surfaces as a small arrow in the
   *  top-left of the receipt. Clicking dismisses the receipt without
   *  starting a new call (returns to the signed Meet Harvey hero). */
  onBack?: () => void;
}

const RATE = {
  consultationPerHour: 1200,
  statute: 400,
  news: 250,
  stock: 500,
  hill: 750,
};

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

export function PostCallReceipt({ durationSec, counts, onBack }: Props) {
  const consultationCost = (durationSec / 3600) * RATE.consultationPerHour;
  const statuteCost = counts.statutes * RATE.statute;
  const newsCost = counts.news * RATE.news;
  const stockCost = counts.stocks * RATE.stock;
  const hillCost = counts.hill * RATE.hill;
  const subtotal =
    consultationCost + statuteCost + newsCost + stockCost + hillCost;
  // 90% off — caller is a Bluejay verified member. Matches the confirm
  // modal's billing so the number the user sees before the End
  // doesn't jump around after they confirm.
  const discount = -subtotal * 0.9;
  const netDue = subtotal + discount;

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const lineItems: Array<{ label: string; qty: string; amount: number }> = [
    {
      label: "Telephone consultation",
      qty: fmtDuration(durationSec),
      amount: consultationCost,
    },
  ];
  if (counts.statutes > 0) {
    lineItems.push({
      label: "Statute research",
      qty: String(counts.statutes),
      amount: statuteCost,
    });
  }
  if (counts.news > 0) {
    lineItems.push({
      label: "News synthesis",
      qty: String(counts.news),
      amount: newsCost,
    });
  }
  if (counts.stocks > 0) {
    lineItems.push({
      label: "Market intelligence",
      qty: String(counts.stocks),
      amount: stockCost,
    });
  }
  if (counts.hill > 0) {
    lineItems.push({
      label: "Hill intel · STOCK Act",
      qty: String(counts.hill),
      amount: hillCost,
    });
  }

  return (
    <div
      // Receipt paper — white, deckle-edged feel with a soft lift. Bit
      // bigger overall so the Back affordance doesn't crowd the
      // letterhead.
      className="relative w-full rounded-[2px] border border-[var(--rule-strong)] bg-white px-8 pb-7 pt-6 shadow-[0_22px_44px_-18px_rgba(20,18,14,0.22),0_2px_6px_rgba(0,0,0,0.04)]"
    >
      {/* Back row — lives ABOVE the letterhead so it has its own
          vertical gutter instead of crowding the PSL wordmark. */}
      {onBack && (
        <div className="mb-5 flex items-center">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Meet Harvey"
            className="flex items-center gap-1.5 rounded-md -ml-1 px-1.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.32em] text-[var(--foreground-faint)] transition-colors hover:bg-black/[0.04] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} />
            Back
          </button>
        </div>
      )}

      {/* Letterhead */}
      <div className="flex items-baseline justify-between border-b-2 border-[var(--foreground)] pb-3">
        <div>
          <div className="font-display text-[18px] font-bold leading-tight text-[var(--foreground)]">
            Pearson Specter Litt
          </div>
          <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.42em] text-[var(--foreground-muted)]">
            Statement of services
          </div>
        </div>
        <div className="text-right font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-muted)]">
          {today}
        </div>
      </div>

      {/* Line items */}
      <table className="mt-4 w-full border-collapse font-mono text-[11.5px]">
        <thead>
          <tr>
            <th className="pb-1.5 text-left uppercase tracking-[0.28em] text-[8.5px] font-medium text-[var(--foreground-faint)]">
              Item
            </th>
            <th className="pb-1.5 text-right uppercase tracking-[0.28em] text-[8.5px] font-medium text-[var(--foreground-faint)]">
              Qty
            </th>
            <th className="pb-1.5 text-right uppercase tracking-[0.28em] text-[8.5px] font-medium text-[var(--foreground-faint)]">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li, i) => (
            <motion.tr
              key={li.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.15 + i * 0.08,
                ease: [0.19, 1, 0.22, 1],
              }}
              className="border-t border-dashed border-[var(--rule-strong)]/70"
            >
              <td className="py-2 pr-2 text-[var(--foreground)]">{li.label}</td>
              <td className="py-2 text-right tabular-nums text-[var(--foreground-muted)]">
                {li.qty}
              </td>
              <td className="py-2 text-right tabular-nums text-[var(--foreground)]">
                {fmtUsd(li.amount)}
              </td>
            </motion.tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--foreground)]">
            <td
              colSpan={2}
              className="pt-3 text-right uppercase tracking-[0.28em] text-[8.5px] text-[var(--foreground-muted)]"
            >
              Subtotal
            </td>
            <td className="pt-3 text-right tabular-nums text-[var(--foreground)]">
              {fmtUsd(subtotal)}
            </td>
          </tr>
          <tr>
            <td
              colSpan={2}
              className="pt-0.5 text-right uppercase tracking-[0.28em] text-[8.5px] text-[var(--crimson)]"
            >
              Bluejay verified member · 90% off
            </td>
            <td className="pt-0.5 text-right tabular-nums text-[var(--crimson)]">
              {fmtUsd(discount)}
            </td>
          </tr>
          <tr className="border-t border-[var(--foreground)]">
            <td
              colSpan={2}
              className="pt-2 text-right font-display text-[12px] italic text-[var(--foreground)]"
            >
              Net due
            </td>
            <td className="pt-2 text-right font-display text-[14px] italic tabular-nums text-[var(--foreground)]">
              {fmtUsd(netDue)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Footer quip + signature */}
      <div className="mt-4 border-t border-[var(--rule-strong)] pt-3 text-center">
        <div className="font-display text-[11.5px] italic leading-snug text-[var(--foreground-muted)]">
          &ldquo;You don&rsquo;t send me a bill, Harvey. I send <em>you</em>{" "}
          one.&rdquo;
        </div>
        <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]">
          Privileged · Confidential
        </div>
      </div>
    </div>
  );
}
