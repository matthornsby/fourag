/**
 * Typographic prettification for user-supplied text displayed in the UI.
 * Converts straight quotes/apostrophes to curly equivalents and fixes
 * common punctuation patterns.
 */
export function prettify(text: string): string {
  return text
    // Em dash: -- → —
    .replace(/--/g, '—')
    // Ellipsis: ... → …
    .replace(/\.\.\./g, '…')
    // Double quotes: "word" → "word"
    .replace(/"([^"]*)"/g, '“$1”')
    // Remaining opening double quote (after space or start)
    .replace(/(^|\s)"/g, '$1“')
    // Remaining closing double quote
    .replace(/"/g, '”')
    // Single quotes / apostrophes
    // Contractions and possessives: n't, it's, don't, word's etc.
    .replace(/(\w)'(\w)/g, '$1’$2')
    // Opening single quote (after space or start)
    .replace(/(^|\s)'/g, '$1‘')
    // Closing single quote / apostrophe
    .replace(/'/g, '’')
}
