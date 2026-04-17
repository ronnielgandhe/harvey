"use client";

import { useEffect, useState } from "react";

interface Section {
  id: string;
  label: string;
}

interface Props {
  sections: Section[];
}

export function TableOfContents({ sections }: Props) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Table of contents" className="select-none">
      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
        Contents
      </p>
      <ul className="mt-5 space-y-3">
        {sections.map((s, i) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`group flex items-center gap-3 text-[12px] tracking-tight transition-colors ${
                  isActive
                    ? "text-[var(--foreground)]"
                    : "text-[var(--foreground-faint)] hover:text-[var(--foreground-muted)]"
                }`}
              >
                <span
                  className={`font-mono text-[10px] tabular-nums transition-colors ${
                    isActive
                      ? "text-[var(--accent)]"
                      : "text-[var(--foreground-faint)]"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`h-px transition-all duration-300 ${
                    isActive
                      ? "w-8 bg-[var(--accent)]"
                      : "w-3 bg-[var(--rule-strong)] group-hover:w-5"
                  }`}
                />
                <span>{s.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
