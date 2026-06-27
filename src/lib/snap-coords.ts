import type { Find, Clover } from '@/types'

// Round to nearest grid step — 0.05° ≈ 5.5 km, suburb scale.
const GRID = 0.05

function snap(v: number): number {
  return Math.round(v / GRID) * GRID
}

/**
 * Replace exact lat/lng with a grid-snapped centroid for approximate finds
 * that don't belong to the current viewer. Call server-side before passing
 * finds to any client component.
 */
export function sanitizeFinds<T extends Find & { clovers: Clover[] }>(
  finds: T[],
  viewerUserId: string | null | undefined,
): T[] {
  return finds.map((f) => {
    if (
      f.location_privacy !== 'approximate' ||
      (viewerUserId && f.user_id === viewerUserId)
    ) {
      return f
    }
    return {
      ...f,
      lat: f.lat !== null ? snap(f.lat) : null,
      lng: f.lng !== null ? snap(f.lng) : null,
    }
  })
}
