"use client";

export const BRAINS = [
  { id: "opus", label: "Opus 5.5", note: "sharpest" },
  { id: "sonnet", label: "Sonnet 5.5", note: "balanced" },
  { id: "haiku", label: "Haiku 5.5", note: "fastest" },
] as const;

export type BrainId = (typeof BRAINS)[number]["id"];

export function BrainPicker({
  value,
  onChange,
}: {
  value: BrainId;
  onChange: (id: BrainId) => void;
}) {
  return (
    <div
      className="fixed inset-x-0 z-[55] flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.38em] text-[var(--foreground-muted)]"
      style={{ bottom: "7vh" }}
    >
      <span className="opacity-70">Counsel runs on</span>
      <div className="flex items-center gap-5">
        {BRAINS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onChange(b.id)}
            aria-pressed={value === b.id}
            title={b.note}
            className={`border-b pb-0.5 transition-colors hover:text-[var(--foreground)] ${
              value === b.id
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
