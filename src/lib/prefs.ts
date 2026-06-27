export type Orientation = 'right-handed' | 'left-handed'
export type Theme = 'dark' | 'light'

export interface Prefs {
  orientation?: Orientation
  theme?: Theme
  weekStart?: 0 | 1
}

export const PREFS_COOKIE = 'fourag-prefs'

/** Parse a raw `fourag-prefs` value (cookie or localStorage) into a Prefs object. */
export function parsePrefs(raw: string | undefined | null): Prefs {
  if (!raw) return {}
  try {
    const value = JSON.parse(raw)
    return typeof value === 'object' && value !== null ? value : {}
  } catch {
    return {}
  }
}

/**
 * Read prefs on the client. The cookie is the source of truth (the server reads
 * it to set the <html> attributes before paint); localStorage is a fallback for
 * clients that predate the cookie. Only call from the browser.
 */
export function loadPrefs(): Prefs {
  const cookie = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${PREFS_COOKIE}=`))
    ?.slice(PREFS_COOKIE.length + 1)
  if (cookie) return parsePrefs(decodeURIComponent(cookie))
  try {
    return parsePrefs(localStorage.getItem(PREFS_COOKIE))
  } catch {
    return {}
  }
}

/** Merge `update` into the stored prefs, writing both the cookie and localStorage. */
export function savePrefs(update: Prefs) {
  const next = { ...loadPrefs(), ...update }
  const value = JSON.stringify(next)
  document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
  try {
    localStorage.setItem(PREFS_COOKIE, value)
  } catch {
    /* ignore */
  }
}
