"use client";

import { motion } from "framer-motion";
import { Printer, X } from "lucide-react";

/**
 * "Statement of Services Rendered" — an itemized PSL-letterhead receipt
 * shown the moment the user clicks End Call. Theatrical, legally-styled,
 * and prints cleanly via window.print() (print CSS is in globals.css).
 *
 * Dismiss button = cancel end-call.
 * Confirm = actually end the call.
 * Print = open the system print dialog for a "save as PDF" deliverable.
 */

export interface ReceiptCounts {
  statutes: number;
  news: number;
  stocks: number;
  hill: number;
}

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  durationSec: number;
  counts: ReceiptCounts;
}

// Mock billable rates (theatrical — the receipt ends at $0.00 with a
// "retained by Pearson Specter Litt" discount line.)
const RATE = {
  consultationPerHour: 1200, // $/hr
  statute: 400, // per lookup
  news: 250, // per pull
  stock: 500, // per quote
  hill: 750, // per check
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
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function CaseReceipt({
  open,
  onCancel,
  onConfirm,
  durationSec,
  counts,
}: Props) {
  if (!open) return null;

  const consultationCost =
    (durationSec / 3600) * RATE.consultationPerHour;
  const statuteCost = counts.statutes * RATE.statute;
  const newsCost = counts.news * RATE.news;
  const stockCost = counts.stocks * RATE.stock;
  const hillCost = counts.hill * RATE.hill;
  const subtotal =
    consultationCost + statuteCost + newsCost + stockCost + hillCost;
  // 90% off — caller qualifies as a Bluejay verified member.
  const discount = -subtotal * 0.9;
  const netDue = subtotal + discount;

  const caseNo = `PSL-${new Date().getFullYear()}-${Math.floor(
    1000 + Math.random() * 9000,
  )}`;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(20,18,14,0.55)] p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.42, ease: [0.19, 1, 0.22, 1] }}
        role="dialog"
        aria-labelledby="receipt-title"
        className="case-receipt relative max-h-[90vh] w-full max-w-[680px] overflow-y-auto rounded-sm border border-[var(--rule-strong)] bg-white p-10 shadow-[0_30px_80px_-20px_rgba(20,18,14,0.4)]"
      >
        {/* Dismiss X — not printed */}
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="no-print absolute right-4 top-4 rounded p-1 text-[var(--foreground-faint)] transition-colors hover:bg-black/5 hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {/* Letterhead */}
        <div className="border-b-2 border-[var(--foreground)] pb-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-display text-[24px] font-bold tracking-[-0.01em] text-[var(--foreground)]">
                Pearson Specter Litt
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.42em] text-[var(--foreground-muted)]">
                Attorneys at Law · New York · Toronto
              </div>
            </div>
            <div className="text-right font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-muted)]">
              <div>{today}</div>
              <div className="mt-0.5">Case No. {caseNo}</div>
            </div>
          </div>
        </div>

        {/* Title */}
        <h2
          id="receipt-title"
          className="mt-6 text-center font-display text-[18px] italic tracking-wide text-[var(--foreground)]"
        >
          Statement of Services Rendered
        </h2>
        <div className="mx-auto mt-1 h-px w-16 bg-[var(--foreground)]" />

        {/* Meta line */}
        <div className="mt-4 grid grid-cols-3 gap-4 font-mono text-[10px] uppercase tracking-[0.28em]">
          <Meta label="Attorney" value="Harvey Specter" />
          <Meta
            label="Consultation"
            value={fmtDuration(durationSec)}
            mono
          />
          <Meta label="Mode" value="Voice · privileged" />
        </div>

        {/* Line items */}
        <table className="mt-6 w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-b border-[var(--foreground)]">
              <th className="pb-2 text-left uppercase tracking-[0.32em] text-[9px] text-[var(--foreground-muted)]">
                Item
              </th>
              <th className="pb-2 text-right uppercase tracking-[0.32em] text-[9px] text-[var(--foreground-muted)]">
                Qty
              </th>
              <th className="pb-2 text-right uppercase tracking-[0.32em] text-[9px] text-[var(--foreground-muted)]">
                Rate
              </th>
              <th className="pb-2 text-right uppercase tracking-[0.32em] text-[9px] text-[var(--foreground-muted)]">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <LineItem
              label="Telephone consultation"
              qty={fmtDuration(durationSec)}
              rate={`${fmtUsd(RATE.consultationPerHour)} / hr`}
              amount={consultationCost}
            />
            {counts.statutes > 0 && (
              <LineItem
                label="Statute research · RAG over Canadian corpus"
                qty={`${counts.statutes}`}
                rate={`${fmtUsd(RATE.statute)} ea`}
                amount={statuteCost}
              />
            )}
            {counts.news > 0 && (
              <LineItem
                label="News synthesis · wire-service intel"
                qty={`${counts.news}`}
                rate={`${fmtUsd(RATE.news)} ea`}
                amount={newsCost}
              />
            )}
            {counts.stocks > 0 && (
              <LineItem
                label="Market intelligence · live quote"
                qty={`${counts.stocks}`}
                rate={`${fmtUsd(RATE.stock)} ea`}
                amount={stockCost}
              />
            )}
            {counts.hill > 0 && (
              <LineItem
                label="Congressional intel · STOCK Act filings"
                qty={`${counts.hill}`}
                rate={`${fmtUsd(RATE.hill)} ea`}
                amount={hillCost}
              />
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--foreground)]">
              <td colSpan={3} className="pt-3 text-right uppercase tracking-[0.32em] text-[9px] text-[var(--foreground-muted)]">
                Subtotal
              </td>
              <td className="pt-3 text-right tabular-nums text-[var(--foreground)]">
                {fmtUsd(subtotal)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="pt-1 text-right uppercase tracking-[0.32em] text-[9px] text-[var(--crimson)]">
                Bluejay verified member discount · 90% off
              </td>
              <td className="pt-1 text-right tabular-nums text-[var(--crimson)]">
                {fmtUsd(discount)}
              </td>
            </tr>
            <tr className="border-t-2 border-[var(--foreground)]">
              <td colSpan={3} className="pt-3 text-right font-display text-[13px] italic text-[var(--foreground)]">
                Net due
              </td>
              <td className="pt-3 text-right font-display text-[15px] italic tabular-nums text-[var(--foreground)]">
                {fmtUsd(netDue)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer note */}
        <div className="mt-8 border-t border-[var(--rule-strong)] pt-4 text-center font-display text-[12px] italic text-[var(--foreground-muted)]">
          Thank you for using our Bluejay Voice Platform.
        </div>
        <div className="mt-1 text-center font-mono text-[9px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]">
          Privileged · Confidential · © Pearson Specter Litt × Bluejay
        </div>

        {/* Actions */}
        <div className="no-print mt-8 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--rule-strong)] bg-white/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            Keep talking
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--rule-strong)] bg-white/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]"
          >
            <Printer className="h-3 w-3" strokeWidth={2} />
            Print · Save PDF
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--crimson)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-white transition-colors hover:bg-[var(--foreground)]"
          >
            Confirm · End call
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[8.5px] tracking-[0.42em] text-[var(--foreground-faint)]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-[11px] ${
          mono ? "tabular-nums" : ""
        } text-[var(--foreground)]`}
      >
        {value}
      </div>
    </div>
  );
}

function LineItem({
  label,
  qty,
  rate,
  amount,
}: {
  label: string;
  qty: string;
  rate: string;
  amount: number;
}) {
  return (
    <tr className="border-b border-dashed border-[var(--rule-strong)]/70">
      <td className="py-2.5 pr-2 text-[var(--foreground)]">{label}</td>
      <td className="py-2.5 text-right tabular-nums text-[var(--foreground-muted)]">
        {qty}
      </td>
      <td className="py-2.5 text-right text-[var(--foreground-muted)]">
        {rate}
      </td>
      <td className="py-2.5 text-right tabular-nums text-[var(--foreground)]">
        {fmtUsd(amount)}
      </td>
    </tr>
  );
}
