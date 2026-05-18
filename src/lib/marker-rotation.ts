// Deterministic rotation per marker. Returns degrees in [-15, +15].
// djb2 hash on the seed string, then XOR with index via Knuth's multiplicative
// constant so sequential indices scatter across the full range.
export function markerRotation(seed: string | number, index: number): number {
  let h = 5381
  const str = String(seed)
  for (let i = 0; i < str.length; i++) {
    h = (((h * 33) ^ str.charCodeAt(i)) >>> 0)
  }
  h = ((h ^ ((index + 1) * 2654435761)) >>> 0)
  return (h % 31) - 15
}
