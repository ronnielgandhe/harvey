"use client";

import { FileText, Briefcase } from "lucide-react";
import type { ReactNode } from "react";
import type { Statute } from "./StatuteCard";
import { StatuteCard } from "./StatuteCard";

export interface CaseFileData {
  [field: string]: string;
}

interface Props {
  data: CaseFileData;
  statutes: Statute[];
  onDismissStatute?: (id: string) => void;
}

const FIELD_ORDER = [
  "client",
  "matter",
  "opposing_party",
  "venue",
  "objective",
  "stakes",
  "strategy",
];

function labelize(field: string) {
  return field.replace(/_/g, " ");
}

export function CaseFile({ data, statutes, onDismissStatute }: Props) {
  const knownFields = FIELD_ORDER.filter((f) => data[f]);
  const otherFields = Object.keys(data).filter((f) => !FIELD_ORDER.includes(f));
  const fields = [...knownFields, ...otherFields];

  return (
    <div className="flex h-full flex-col rounded border border-[#d4af37]/20 bg-black/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 px-5 py-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-[#d4af37]" strokeWidth={1.5} />
          <div className="font-serif text-sm tracking-[0.35em] text-[#d4af37] uppercase">
            Case File
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f5f0e1]/40">
          {String(fields.length).padStart(2, "0")} entries
        </div>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Case file header card */}
        <div className="rounded border border-[#d4af37]/15 bg-[#0a0a0a] p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-[#d4af37]" strokeWidth={1.5} />
            <div className="flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#d4af37]/60">
                File No. {generateFileNo()}
              </div>
              <div className="mt-1 font-serif text-base text-[#f5f0e1]">
                {data.matter || "Matter Pending Discussion"}
              </div>
            </div>
          </div>
        </div>

        {/* Fields */}
        {fields.length === 0 ? (
          <Empty>
            Harvey will populate the file as the conversation develops.
          </Empty>
        ) : (
          <dl className="space-y-4">
            {fields.map((f) => (
              <div key={f} className="fade-up">
                <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#d4af37]/60">
                  {labelize(f)}
                </dt>
                <dd className="mt-1 font-serif text-sm text-[#f5f0e1] leading-relaxed">
                  {data[f]}
                </dd>
                <div className="mt-2 h-px bg-[#d4af37]/10" />
              </div>
            ))}
          </dl>
        )}

        {/* Statutes section */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#d4af37]/20" />
            <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-[#d4af37]/50">
              Authorities Cited
            </div>
            <div className="flex-1 h-px bg-[#d4af37]/20" />
          </div>

          {statutes.length === 0 ? (
            <Empty>No statutes referenced yet.</Empty>
          ) : (
            <div className="space-y-3">
              {statutes.map((s) => (
                <StatuteCard key={s.id} statute={s} onDismiss={onDismissStatute} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-[#d4af37]/15 px-4 py-6 text-center font-serif italic text-xs text-[#f5f0e1]/40">
      {children}
    </div>
  );
}

function generateFileNo() {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `PSL-${year}-${seq}`;
}
