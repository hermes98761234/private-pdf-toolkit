/** Canvas helpers for signatures and text stamps (browser only). */

export const SIGNATURE_FONTS = [
  { id: 'caveat', css: '"Caveat", cursive', label: 'Caveat' },
  { id: 'dancing', css: '"Dancing Script", cursive', label: 'Dancing Script' },
  { id: 'vibes', css: '"Great Vibes", cursive', label: 'Great Vibes' },
] as const

export type Stamp = { png: Uint8Array; url: string; width: number; height: number }

/** Crops transparent margins (with a little padding). Returns null when the canvas is empty. */
export function trim(src: HTMLCanvasElement, pad = 4): HTMLCanvasElement | null {
  const ctx = src.getContext('2d')!
  const { width, height } = src
  const data = ctx.getImageData(0, 0, width, height).data
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(width - 1, x1 + pad)
  y1 = Math.min(height - 1, y1 + pad)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

export async function toStamp(canvas: HTMLCanvasElement): Promise<Stamp | null> {
  const t = trim(canvas)
  if (!t) return null
  const blob = await new Promise<Blob | null>((r) => t.toBlob(r, 'image/png'))
  if (!blob) return null
  return { png: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob), width: t.width, height: t.height }
}

export async function textStamp(text: string, fontCss: string, color: string, px = 96): Promise<Stamp | null> {
  if (!text.trim()) return null
  const weight = fontCss.includes('Caveat') ? 700 : 400
  await document.fonts.load(`${weight} ${px}px ${fontCss}`, text).catch(() => [])
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = `${weight} ${px}px ${fontCss}`
  const w = Math.ceil(ctx.measureText(text).width) + px
  c.width = w
  c.height = Math.ceil(px * 2)
  ctx.font = `${weight} ${px}px ${fontCss}`
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, px / 2, c.height / 2)
  return toStamp(c)
}

/** Loads an image file and optionally turns near-white pixels transparent. */
export async function imageStamp(file: Blob, whiteToAlpha: boolean): Promise<Stamp | null> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * scale))
  c.height = Math.max(1, Math.round(bmp.height * scale))
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  if (whiteToAlpha) {
    const img = ctx.getImageData(0, 0, c.width, c.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      if (lum > 235) d[i + 3] = 0
      else if (lum > 170) d[i + 3] = Math.min(d[i + 3], Math.round(((235 - lum) / 65) * 255))
    }
    ctx.putImageData(img, 0, 0)
  }
  return toStamp(c)
}

/** Any image file → PNG or JPEG bytes that pdf-lib can embed (WebP, GIF, BMP, … are re-encoded as PNG). */
export async function normalizeImage(file: File): Promise<{ bytes: Uint8Array; type: 'png' | 'jpg' }> {
  if (file.type === 'image/png' || file.type === 'image/jpeg') {
    return { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type === 'image/png' ? 'png' : 'jpg' }
  }
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Cannot read this image.')
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: 'png' }
}
