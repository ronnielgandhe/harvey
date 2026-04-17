"use client";

import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, useImperativeHandle, useRef } from "react";

export interface EvidenceFact {
  field: string;
  value: string;
}

export const EVIDENCE_SLOTS = [
  { key: "parties", label: "Parties" },
  { key: "location", label: "Location" },
  { key: "matter", label: "Incident" },
  { key: "date", label: "Date" },
  { key: "authority", label: "Authority" },
  { key: "action", label: "Action" },
] as const;

export type SlotKey = (typeof EVIDENCE_SLOTS)[number]["key"];

interface Props {
  /** map slot key -> fact */
  facts: Partial<Record<SlotKey, EvidenceFact>>;
}

export interface EvidenceWallHandle {
  /** Returns viewport-center coordinates of a slot, useful for blade-flight target */
  getSlotCenter: (slot: SlotKey) => { x: number; y: number } | null;
}

export const EvidenceWall = forwardRef<EvidenceWallHandle, Props>(
  function EvidenceWall({ facts }, ref) {
    const slotRefs = useRef<Partial<Record<SlotKey, HTMLDivElement | null>>>({});

    useImperativeHandle(ref, () => ({
      getSlotCenter(slot) {
        const el = slotRefs.current[slot];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
    }));

    return (
      <div className="mx-auto grid w-full max-w-[1080px] grid-cols-3 gap-5 px-6">
        {EVIDENCE_SLOTS.map((slot) => {
          const fact = facts[slot.key];
          return (
            <div
              key={slot.key}
              ref={(el) => {
                slotRefs.current[slot.key] = el;
              }}
              className="relative h-[148px]"
            >
              <AnimatePresence mode="wait">
                {fact ? (
                  <motion.div
                    key="filled"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1], delay: 0.15 }}
                    className="evidence-card absolute inset-0 flex flex-col justify-between p-5"
                  >
                    <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--accent)]">
                      {slot.label}
                    </div>
                    <div className="font-display text-[20px] leading-[1.2] tracking-tight text-[var(--foreground)]">
                      {fact.value}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-[var(--foreground-faint)]">
                      {fact.field.replace(/_/g, " ")}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="evidence-slot-empty absolute inset-0 flex flex-col justify-between p-5"
                  >
                    <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
                      {slot.label}
                    </div>
                    <div className="font-display text-[14px] italic leading-snug text-[var(--foreground-faint)]">
                      pending
                    </div>
                    <div className="h-2 w-12 rounded-full bg-[rgba(0,0,0,0.05)]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  },
);
