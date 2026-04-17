"use client";

import { motion } from "framer-motion";
import { Scroll, Briefcase, Mail, Swords } from "lucide-react";

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  tools: ("statute" | "case" | "draft" | "play")[];
  jurisdiction?: string;
}

const TOOL_META: Record<
  Scenario["tools"][number],
  { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }
> = {
  statute: { label: "Statute", icon: Scroll },
  case: { label: "Case", icon: Briefcase },
  draft: { label: "Draft", icon: Mail },
  play: { label: "Play", icon: Swords },
};

const SCENARIOS: Scenario[] = [
  {
    id: "fender",
    title: "I hit a parked car.",
    blurb: "No witnesses. Owner left a number.",
    tools: ["statute", "case", "draft"],
    jurisdiction: "Ontario · HTA",
  },
  {
    id: "raise",
    title: "I'm asking for a raise.",
    blurb: "Three years in. Two promos skipped.",
    tools: ["play", "case"],
    jurisdiction: "Negotiation",
  },
  {
    id: "deposit",
    title: "Landlord won't return deposit.",
    blurb: "Moved out clean. 21 days gone.",
    tools: ["statute", "draft"],
    jurisdiction: "Ontario · RTA",
  },
  {
    id: "cofounder",
    title: "Cofounder is screwing me.",
    blurb: "Cliff moved. Term sheet rewritten.",
    tools: ["play", "draft", "case"],
    jurisdiction: "Corporate",
  },
];

interface Props {
  onPick?: (s: Scenario) => void;
  selectedId?: string | null;
}

export function ScenarioCards({ onPick, selectedId }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {SCENARIOS.map((s, i) => {
        const isSelected = selectedId === s.id;
        return (
          <motion.button
            key={s.id}
            onClick={() => onPick?.(s)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 + i * 0.06, ease: [0.2, 0.9, 0.3, 1] }}
            whileHover={{ y: -2 }}
            className={`group relative overflow-hidden rounded-xl border bg-white/[0.02] p-4 text-left transition-all ${
              isSelected
                ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.06] shadow-[0_0_0_1px_rgba(201,169,97,0.25),0_8px_40px_-12px_rgba(201,169,97,0.4)]"
                : "border-white/8 hover:border-white/16"
            }`}
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--accent)]/80">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-1.5">
                {s.tools.map((t) => {
                  const Icon = TOOL_META[t].icon;
                  return (
                    <Icon
                      key={t}
                      className="h-3 w-3 text-[var(--foreground-faint)] group-hover:text-[var(--accent)] transition-colors"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </div>
            </div>
            <h3 className="mt-3 font-display text-[16px] leading-[1.2] tracking-tight text-[var(--foreground)]">
              &ldquo;{s.title}&rdquo;
            </h3>
            <p className="mt-1.5 text-[11px] leading-snug text-[var(--foreground-muted)]">
              {s.blurb}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

export { SCENARIOS };
