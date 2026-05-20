"use client";

import { Leaf } from "lucide-react";
import type { Find, Clover } from "@/types";
import { computeLuck } from "@/lib/luck";

interface LuckIndicatorProps {
  finds: (Find & { clovers: Clover[] })[];
}

type LuckState = "healthy" | "fading" | "bare";

function getLuckState(score: number): LuckState {
  if (score >= 60) return "healthy";
  if (score >= 20) return "fading";
  return "bare";
}

const stateStyles: Record<LuckState, { color: string }> = {
  healthy: { color: "var(--color-accent)" },
  fading: { color: "#B45309" },
  bare: { color: "var(--color-text-secondary)" },
};

export function LuckIndicator({ finds }: LuckIndicatorProps) {
  if (finds.length === 0 || finds.every(f => f.clovers.length === 0)) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1 text-sm text-text-secondary">
        <Leaf size={14} strokeWidth={1.5} />
        No finds yet
      </span>
    );
  }

  const score = Math.round(computeLuck(finds, new Date()));
  const state = getLuckState(score);
  const { color } = stateStyles[state];

  return (
    <span
      className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1 text-sm"
      style={{ color }}
    >
      <Leaf size={14} strokeWidth={1.5} />
      Luck · {score}
    </span>
  );
}
