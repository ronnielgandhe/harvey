"use client";

import { Search, CheckCircle2, AlertTriangle } from "lucide-react";

export interface ToastItem {
  id: string;
  name: string;
  status: string;
}

interface Props {
  toasts: ToastItem[];
}

function iconFor(status: string) {
  if (status === "complete" || status === "success") {
    return <CheckCircle2 className="h-4 w-4 text-[#d4af37]" strokeWidth={1.5} />;
  }
  if (status === "error" || status === "failed") {
    return <AlertTriangle className="h-4 w-4 text-red-400" strokeWidth={1.5} />;
  }
  return (
    <Search
      className="h-4 w-4 text-[#d4af37] animate-pulse"
      strokeWidth={1.5}
    />
  );
}

export function ToastStack({ toasts }: Props) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="slide-in-right pointer-events-auto flex items-center gap-3 rounded-full border border-[#d4af37]/40 bg-black/90 px-4 py-2 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        >
          {iconFor(t.status)}
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f5f0e1]">
            {t.status === "complete" ? "Authority retrieved" : "Pulling case law"}:
            <span className="ml-2 text-[#d4af37]">{t.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
