import type { Find, Clover } from '@/types'

// Luck units lost per day — tuned so a single 4-leaf clover (100 luck) lasts ~23 days.
export const LUCK_DECAY_RATE = 100 / 7

export function luckValue(leafCount: number): number {
  return 100 * Math.pow(3, leafCount - 4)
}

export function computeLuck(finds: (Find & { clovers: Clover[] })[], atTime: Date): number {
  if (finds.length === 0) return 0

  const sorted = [...finds].sort(
    (a, b) => new Date(a.found_at).getTime() - new Date(b.found_at).getTime()
  )

  let pool = 0
  let lastTime: number | null = null

  for (const find of sorted) {
    const findTime = new Date(find.found_at).getTime()
    if (findTime > atTime.getTime()) break
    if (lastTime !== null) {
      const daysBetween = (findTime - lastTime) / 86400000
      pool = Math.max(0, pool - LUCK_DECAY_RATE * daysBetween)
    }
    pool += find.clovers.reduce((s, c) => s + luckValue(c.leaf_count), 0)
    lastTime = findTime
  }

  if (lastTime === null) return 0

  const daysRemaining = (atTime.getTime() - lastTime) / 86400000
  return Math.max(0, pool - LUCK_DECAY_RATE * daysRemaining)
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


export function computeLuckEndDate(finds: (Find & { clovers: Clover[] })[]): string | null {
  if (finds.length === 0) return null;
  const now = new Date();
  now.setHours(23, 59, 59, 0);

  if (computeLuck(finds, now) >= 1) {
    const cursor = new Date(now);
    for (let i = 0; i < 365; i++) {
      cursor.setDate(cursor.getDate() + 1);
      if (computeLuck(finds, cursor) < 1) {
        cursor.setDate(cursor.getDate() - 1);
        return cursor.toISOString();
      }
    }
    return null;
  } else {
    const cursor = new Date(now);
    for (let i = 0; i < 365; i++) {
      cursor.setDate(cursor.getDate() - 1);
      if (computeLuck(finds, cursor) >= 1) {
        return cursor.toISOString();
      }
    }
    return null;
  }
}
