import type { Find, Clover } from '@/types'

export const LUCK_DECAY_DAYS = 12

export function luckValue(leafCount: number): number {
  return 100 * Math.pow(2, leafCount - 4)
}

export function computeLuck(finds: (Find & { clovers: Clover[] })[], atTime: Date): number {
  return finds
    .flatMap(f => f.clovers.map(c => ({ foundAt: f.found_at, leafCount: c.leaf_count })))
    .reduce((sum, { foundAt, leafCount }) => {
      const daysSince = (atTime.getTime() - new Date(foundAt).getTime()) / 86400000
      if (daysSince < 0) return sum
      return sum + luckValue(leafCount) * Math.exp(-daysSince / LUCK_DECAY_DAYS)
    }, 0)
}

export function luckAddedOnDay(finds: (Find & { clovers: Clover[] })[], date: Date): number {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  return finds
    .filter(f => {
      const fd = new Date(f.found_at)
      return fd.getFullYear() === y && fd.getMonth() === m && fd.getDate() === d
    })
    .flatMap(f => f.clovers)
    .reduce((sum, c) => sum + luckValue(c.leaf_count), 0)
}

// Maps luck score to opacity in [0, 1]. luck=100 → 1.0 (full accent), scales linearly below.
export function luckToOpacity(luck: number): number {
  return Math.min(luck / 100, 1)
}

// Maps luck added on a day to a marker size as a fraction of the cell [0, 1].
// luckAdded=100 → ~0.50, 200 → ~0.56, 400 → ~0.65, 800 → ~0.77, 1600 → ~0.85
export function luckAddedToMarkerSize(luckAdded: number): number {
  return Math.min(0.85, 0.35 + Math.sqrt(luckAdded) * 0.015)
}

// Scaling coefficient for find circles — adjust to tune circle growth rate.
export const FIND_CIRCLE_SCALE = 1.0

// Returns the circle diameter as a percentage of cell width.
// Area scales linearly with luckAdded so that equal finds produce equal visual weight.
// At luckAdded=100 (one 4-leaf clover) the radius equals one cell width (diameter=200%).
export function luckAddedToCircleDiameterPct(luckAdded: number): number {
  return 200 * FIND_CIRCLE_SCALE * Math.sqrt(luckAdded / 100) + (luckAdded / 2)
}
