"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckSquare, Square, ListChecks, X } from "lucide-react";

export interface ActionChecklistData {
  title: string;
  steps: string[];
}

interface Props {
  data: ActionChecklistData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

export function ActionChecklistPane({ data, paneId, onDismiss }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const completedCount = checked.size;
  const total = data.steps.length;

  return (
    <div className="glass-pane relative overflow-hidden rounded-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)]">
            <ListChecks className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--accent)]">
              Action · {completedCount}/{total}
            </span>
            <span className="font-display text-[16px] leading-snug tracking-tight text-[var(--foreground)]">
              {data.title}
            </span>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(paneId)}
            className="-mr-1 -mt-1 rounded p-1 text-[var(--foreground-faint)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--foreground)]"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-3 h-px overflow-hidden rounded-full bg-[var(--rule)]">
        <motion.div
          className="h-full bg-[var(--accent)]"
          initial={{ width: 0 }}
          animate={{ width: total ? `${(completedCount / total) * 100}%` : "0%" }}
          transition={{ duration: 0.45, ease: [0.2, 0.9, 0.3, 1] }}
        />
      </div>

      {/* Steps */}
      <ul className="px-3 pb-3 space-y-1">
        {data.steps.map((step, i) => {
          const isChecked = checked.has(i);
          return (
            <li key={i}>
              <button
                onClick={() => toggle(i)}
                className="group flex w-full items-start gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-[rgba(0,0,0,0.03)]"
              >
                <span className="mt-0.5 shrink-0">
                  {isChecked ? (
                    <motion.span
                      initial={{ scale: 0.6, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      className="block"
                    >
                      <CheckSquare
                        className="h-4 w-4 text-[var(--accent)]"
                        strokeWidth={2}
                      />
                    </motion.span>
                  ) : (
                    <Square
                      className="h-4 w-4 text-[var(--foreground-faint)] group-hover:text-[var(--foreground-muted)]"
                      strokeWidth={1.5}
                    />
                  )}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[9px] tabular-nums text-[var(--accent)]/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`text-[13px] leading-relaxed transition-all ${
                        isChecked
                          ? "text-[var(--foreground-faint)] line-through decoration-[var(--accent)]/40"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
