/** Page-range parsing. Pages are 1-based in text and in results. */

export type RangeError = { msg: string; args: (string | number)[] }
export type RangeResult = { ok: true; groups: number[][] } | { ok: false; error: RangeError }

const fail = (msg: string, ...args: (string | number)[]): RangeResult => ({ ok: false, error: { msg, args } })

/**
 * Parses "1-3, 5, 8-" into one group of pages per comma-separated part.
 * Supported parts: `n`, `a-b`, `a-` (to the end), `-b` (from the start).
 */
export function parseRanges(text: string, total: number): RangeResult {
  const parts = text
    .replace(/\s*([-–—])\s*/g, '$1')
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return fail('Enter page numbers, for example 1-3, 5, 8-')
  const groups: number[][] = []
  for (const part of parts) {
    const m = /^(\d*)\s*(?:([-–—])\s*(\d*))?$/.exec(part)
    if (!m || (m[1] === '' && !m[2]) || (m[1] === '' && m[3] === '')) return fail('Cannot read "{0}"', part)
    const hasDash = m[2] !== undefined
    const a = m[1] === '' ? 1 : Number(m[1])
    const b = hasDash ? (m[3] === '' ? total : Number(m[3])) : a
    for (const n of [a, b]) {
      if (n < 1 || n > total) return fail('Page {0} is out of range (1–{1})', n, total)
    }
    if (a > b) return fail('Range "{0}" starts after it ends', part)
    const g: number[] = []
    for (let i = a; i <= b; i++) g.push(i)
    groups.push(g)
  }
  return { ok: true, groups }
}

/** Splits 1..total into consecutive groups of `n` pages (the last may be shorter). */
export function everyN(total: number, n: number): number[][] {
  const size = Math.max(1, Math.floor(n))
  const groups: number[][] = []
  for (let start = 1; start <= total; start += size) {
    const g: number[] = []
    for (let i = start; i < start + size && i <= total; i++) g.push(i)
    groups.push(g)
  }
  return groups
}

/** [1,2,3,5] → "1-3, 5". */
export function formatRanges(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((x, y) => x - y)
  const out: string[] = []
  for (let i = 0; i < sorted.length; ) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    out.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]))
    i = j + 1
  }
  return out.join(', ')
}
