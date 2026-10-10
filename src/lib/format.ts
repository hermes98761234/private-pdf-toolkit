export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/** "-37%" style change from `before` to `after`. */
export function formatChange(before: number, after: number): string {
  if (before <= 0) return '0%'
  const pct = Math.round(((after - before) / before) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

export function baseName(file: string): string {
  return file.replace(/\.[^.]+$/, '')
}
