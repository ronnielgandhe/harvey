"use client";

import { motion } from "framer-motion";
import { Copy, Mail, Save, Check } from "lucide-react";
import { useMemo, useState } from "react";
import type { EvidenceFact, SlotKey } from "./EvidenceWall";

interface Props {
  facts: Partial<Record<SlotKey, EvidenceFact>>;
  fileNo: string;
}

function fmtDate() {
  const d = new Date();
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function buildMemoText(
  facts: Partial<Record<SlotKey, EvidenceFact>>,
  fileNo: string,
) {
  const f = (k: SlotKey) => facts[k]?.value ?? "—";
  const lines = [
    "PEARSON  SPECTER  LITT",
    "ATTORNEYS AT LAW",
    "",
    `File No.   ${fileNo}`,
    `Date       ${fmtDate()}`,
    `Re:        ${f("matter")} — ${f("location")}`,
    "",
    "FACTS",
    `On ${f("date")}, the matter at issue arose in ${f("location")}, involving ${f("parties")}. The incident: ${f("matter")}.`,
    "",
    "ISSUES",
    `Whether the conduct described constitutes a cognizable claim under ${f("authority")}, and what remedy is most efficient.`,
    "",
    "ANALYSIS",
    `Under ${f("authority")}, the controlling question is one of reasonable conduct and notice. The facts as stated support a strong position; opposing counsel will likely contest the timeline.`,
    "",
    "RECOMMENDATION",
    `Pursue ${f("action")}. Move quickly. Anchor the negotiation; do not concede on the timeline.`,
    "",
    "ACTION ITEMS",
    "1. Preserve all written communication and any photographic evidence.",
    "2. Send the demand letter within 48 hours.",
    "3. Calendar the response window; set escalation triggers at 7 and 14 days.",
    "",
    "Harvey Specter",
    "Senior Partner",
  ];
  return lines.join("\n");
}

const SECTIONS = [
  { id: "facts", label: "FACTS" },
  { id: "issues", label: "ISSUES" },
  { id: "analysis", label: "ANALYSIS" },
  { id: "recommendation", label: "RECOMMENDATION" },
  { id: "actions", label: "ACTION ITEMS" },
] as const;

export function CaseMemo({ facts, fileNo }: Props) {
  const [copied, setCopied] = useState(false);
  const f = (k: SlotKey) => facts[k]?.value ?? "—";

  const memoText = useMemo(() => buildMemoText(facts, fileNo), [facts, fileNo]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[820px] px-6 pb-32">
      {/* Floating action bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="sticky top-6 z-20 mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-[var(--rule-strong)] bg-[rgba(255,255,255,0.85)] px-2 py-1.5 backdrop-blur"
      >
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" strokeWidth={2} /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" strokeWidth={2} /> Copy
            </>
          )}
        </button>
        <span className="h-3 w-px bg-[var(--rule)]" />
        <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--foreground)] hover:bg-[var(--accent-soft)]">
          <Mail className="h-3 w-3" strokeWidth={2} /> Email
        </button>
        <span className="h-3 w-px bg-[var(--rule)]" />
        <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--foreground)] hover:bg-[var(--accent-soft)]">
          <Save className="h-3 w-3" strokeWidth={2} /> Save
        </button>
      </motion.div>

      <motion.article
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.2, 0.9, 0.3, 1] }}
        className="memo-paper px-16 py-16"
      >
        {/* Letterhead */}
        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center"
        >
          <div className="font-display text-[28px] leading-none tracking-[0.42em] text-[var(--foreground)]">
            PEARSON&nbsp;&nbsp;SPECTER&nbsp;&nbsp;LITT
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.5em] text-[var(--foreground-muted)]">
            Attorneys at Law
          </div>
          <div className="memo-rule mt-6" />
        </motion.header>

        {/* Meta */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-8 grid grid-cols-[120px_1fr] gap-y-2 font-mono text-[11px] tracking-wide text-[var(--foreground)]"
        >
          <div className="text-[var(--foreground-muted)]">FILE NO.</div>
          <div>{fileNo}</div>
          <div className="text-[var(--foreground-muted)]">DATE</div>
          <div>{fmtDate()}</div>
          <div className="text-[var(--foreground-muted)]">RE:</div>
          <div className="font-display text-[14px] italic">
            {f("matter")} — {f("location")}
          </div>
          <div className="text-[var(--foreground-muted)]">PARTIES</div>
          <div>{f("parties")}</div>
        </motion.div>

        {/* Body sections */}
        <div className="mt-12 space-y-10">
          {SECTIONS.map((sec, i) => (
            <motion.section
              key={sec.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.18, duration: 0.55 }}
            >
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.42em] text-[var(--foreground)]">
                  {sec.label}
                </h2>
                <div className="memo-section-rule flex-1" />
              </div>
              <div className="mt-4 font-display text-[15px] leading-[1.75] text-[var(--foreground)]">
                {sec.id === "facts" && (
                  <p>
                    On{" "}
                    <em className="not-italic font-medium">{f("date")}</em>, the
                    matter at issue arose in{" "}
                    <em className="not-italic font-medium">{f("location")}</em>,
                    involving{" "}
                    <em className="not-italic font-medium">{f("parties")}</em>.
                    The incident:{" "}
                    <em className="not-italic font-medium">{f("matter")}</em>.
                  </p>
                )}
                {sec.id === "issues" && (
                  <p>
                    Whether the conduct described constitutes a cognizable claim
                    under{" "}
                    <em className="not-italic font-medium">{f("authority")}</em>
                    , and what remedy is most efficient.
                  </p>
                )}
                {sec.id === "analysis" && (
                  <p>
                    Under{" "}
                    <em className="not-italic font-medium">{f("authority")}</em>
                    , the controlling question is one of reasonable conduct and
                    timely notice. The facts as gathered support a strong
                    position; opposing counsel will likely contest the timeline,
                    so we will fix the date in the record at the first
                    opportunity.
                  </p>
                )}
                {sec.id === "recommendation" && (
                  <p>
                    Pursue{" "}
                    <em className="not-italic font-medium">{f("action")}</em>.
                    Move quickly. Anchor the negotiation; do not concede on the
                    timeline.
                  </p>
                )}
                {sec.id === "actions" && (
                  <ol className="list-decimal space-y-2 pl-6">
                    <li>
                      Preserve all written communication and any photographic
                      evidence.
                    </li>
                    <li>Send the demand letter within 48 hours.</li>
                    <li>
                      Calendar the response window; set escalation triggers at
                      7 and 14 days.
                    </li>
                  </ol>
                )}
              </div>
            </motion.section>
          ))}
        </div>

        {/* Signature */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="mt-16"
        >
          <div className="memo-rule" />
          <div className="mt-8 flex items-end justify-between">
            <div>
              <div className="font-display text-[24px] italic tracking-tight text-[var(--foreground)]">
                Harvey Specter
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground-muted)]">
                Senior Partner
              </div>
            </div>
            <div className="text-right font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
              Privileged &amp; Confidential
              <br />
              Attorney Work Product
            </div>
          </div>
        </motion.div>
      </motion.article>
    </div>
  );
}
