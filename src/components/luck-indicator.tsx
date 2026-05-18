"use client";

import { Leaf } from "lucide-react";

interface LuckIndicatorProps {
  lastFindAt: string | null;
}

function computeLuck(lastFindAt: string): number {
  const daysSince =
    (Date.now() - new Date(lastFindAt).getTime()) / 86400000;
  const luck = Math.round(100 * Math.exp(-daysSince / 12));
  return Math.max(0, Math.min(100, luck));
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

export function LuckIndicator({ lastFindAt }: LuckIndicatorProps) {
  if (!lastFindAt) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1 text-sm text-text-secondary">
        <Leaf size={14} strokeWidth={1.5} />
        No finds yet
      </span>
    );
  }

  const score = computeLuck(lastFindAt);
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
