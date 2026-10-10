/** pdf.js rendering helpers (browser only). The worker is bundled and loaded via `?url`, so it works offline. */
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PageSpec } from './pdf'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjs.PDFDocumentProxy

export async function openDoc(bytes: Uint8Array): Promise<PdfDoc> {
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  return pdfjs.getDocument({ data: bytes.slice() }).promise
}

export const destroyDoc = (doc: PdfDoc) => void doc.loadingTask.destroy()

let active = 0
const waiting: (() => void)[] = []
/** At most a few page renders at once, so a long page grid doesn't freeze the tab. */
export async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((r) => waiting.push(r))
  active++
  try {
    return await job()
  } finally {
    active--
    waiting.shift()?.()
  }
}

/** Renders page `index` (0-based) onto `canvas` at `scale` (css px per PDF point), with extra clockwise rotation. */
export async function renderPage(doc: PdfDoc, index: number, canvas: HTMLCanvasElement, scale: number, rotate = 0, isCancelled?: () => boolean) {
  const page = await doc.getPage(index + 1)
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotate + 360) % 360 })
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  if (isCancelled?.()) return viewport
  const task = page.render({ canvas, viewport, background: '#ffffff' })
  try {
    await task.promise
  } catch (e) {
    if (!(e instanceof Error && e.name === 'RenderingCancelledException')) throw e
  }
  return viewport
}

/** Displayed size of a page in PDF points. */
export async function pageSize(doc: PdfDoc, index: number): Promise<{ w: number; h: number }> {
  const vp = (await doc.getPage(index + 1)).getViewport({ scale: 1 })
  return { w: vp.width, h: vp.height }
}

const MAX_SIDE = 8000

/** Re-renders a page to a JPEG at the given DPI and quality (0–1). */
export async function renderJpeg(doc: PdfDoc, index: number, dpi: number, quality: number) {
  const page = await doc.getPage(index + 1)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(dpi / 72, MAX_SIDE / Math.max(base.width, base.height))
  const canvas = document.createElement('canvas')
  await renderPage(doc, index, canvas, scale)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('The browser could not encode the page as JPEG.')
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), widthPt: base.width, heightPt: base.height }
}

export const A4: [number, number] = [595.28, 841.89]

/** Blank-page spec sized like the given page, or A4 when there is none. */
export async function blankLike(docs: PdfDoc[], ref?: Extract<PageSpec, { kind: 'page' }>): Promise<Extract<PageSpec, { kind: 'blank' }>> {
  if (ref && docs[ref.src]) {
    const s = await pageSize(docs[ref.src], ref.index)
    return { kind: 'blank', width: s.w, height: s.h }
  }
  return { kind: 'blank', width: A4[0], height: A4[1] }
}
