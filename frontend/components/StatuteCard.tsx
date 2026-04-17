"use client";

import { Scale, X } from "lucide-react";

export interface Statute {
  id: string;
  jurisdiction: string;
  section: string;
  title: string;
  quote: string;
}

interface Props {
  statute: Statute;
  onDismiss?: (id: string) => void;
}

export function StatuteCard({ statute, onDismiss }: Props) {
  return (
    <div className="slide-in-right gold-flash relative rounded-md border border-[#d4af37]/40 bg-gradient-to-br from-[#0a0a0a] to-black p-4 shadow-[0_8px_28px_rgba(0,0,0,0.6)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d4af37]/50 bg-black">
            <Scale className="h-4 w-4 text-[#d4af37]" strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#d4af37]/70">
              {statute.jurisdiction}
            </div>
            <div className="font-serif text-sm font-semibold text-[#d4af37]">
              {statute.section}
            </div>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(statute.id)}
            className="text-[#f5f0e1]/30 transition-colors hover:text-[#d4af37]"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <h4 className="mt-3 font-serif text-base text-[#f5f0e1] leading-snug">
        {statute.title}
      </h4>

      <blockquote className="mt-3 border-l-2 border-[#d4af37]/40 pl-3 font-serif italic text-xs text-[#f5f0e1]/70 leading-relaxed">
        &ldquo;{statute.quote}&rdquo;
      </blockquote>

      <div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.25em] text-[#d4af37]/40">
        <span>Cited by counsel</span>
        <span>● Live</span>
      </div>
    </div>
  );
}
