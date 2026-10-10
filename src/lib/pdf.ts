/** PDF editing with pdf-lib. Pure functions over bytes, so they run in the browser and in node tests. */
import { PDFDict, PDFDocument, PDFName, PDFRef, StandardFonts, degrees, rgb, type PDFPage } from 'pdf-lib'

export type Bytes = Uint8Array<ArrayBuffer>

const LOAD = { updateMetadata: false } as const

export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, LOAD)
  } catch {
    throw new Error('This file cannot be opened. It may be damaged or password-protected.')
  }
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await loadPdf(bytes)).getPageCount()
}

const toBytes = (u: Uint8Array): Bytes => new Uint8Array(u)

/* ---------- assembling pages: merge, split, organize ---------- */

export type PageSpec =
  | { kind: 'page'; src: number; index: number; rotate?: number }
  | { kind: 'blank'; width: number; height: number }

/** Builds a new PDF from pages of the given source files (0-based `index`), in order. */
export async function buildPdf(sources: Uint8Array[], pages: PageSpec[]): Promise<Bytes> {
  const docs = await Promise.all(sources.map(loadPdf))
  const out = await PDFDocument.create(LOAD)
  for (const spec of pages) {
    if (spec.kind === 'blank') {
      out.addPage([spec.width, spec.height])
      continue
    }
    const [copied] = await out.copyPages(docs[spec.src], [spec.index])
    if (spec.rotate) copied.setRotation(degrees((((copied.getRotation().angle + spec.rotate) % 360) + 360) % 360))
    out.addPage(copied)
  }
  return toBytes(await out.save())
}

export function mergePdfs(sources: Uint8Array[]): Promise<Bytes> {
  return (async () => {
    const counts = await Promise.all(sources.map(pageCount))
    const pages: PageSpec[] = counts.flatMap((n, src) => Array.from({ length: n }, (_, index) => ({ kind: 'page' as const, src, index })))
    return buildPdf(sources, pages)
  })()
}

/** `groups` hold 1-based page numbers; each group becomes its own PDF. */
export async function splitPdf(src: Uint8Array, groups: number[][]): Promise<Bytes[]> {
  return Promise.all(groups.map((g) => buildPdf([src], g.map((p) => ({ kind: 'page' as const, src: 0, index: p - 1 })))))
}

/* ---------- geometry helpers ---------- */

/** Size of the page as displayed (after /Rotate). */
export function displaySize(page: PDFPage): { w: number; h: number; rot: number } {
  const { width, height } = page.getSize()
  const rot = ((page.getRotation().angle % 360) + 360) % 360
  return rot === 90 || rot === 270 ? { w: height, h: width, rot } : { w: width, h: height, rot }
}

/** Maps a point in displayed coordinates (points from the top-left) to the page's own coordinate system. */
export function toPageSpace(page: PDFPage, u: number, v: number): { x: number; y: number } {
  const { width: W, height: H } = page.getSize()
  switch (((page.getRotation().angle % 360) + 360) % 360) {
    case 90:
      return { x: v, y: u }
    case 180:
      return { x: W - u, y: v }
    case 270:
      return { x: W - v, y: H - u }
    default:
      return { x: u, y: H - v }
  }
}

/* ---------- signatures / stamps ---------- */

export type Placement = {
  /** 0-based page index */
  page: number
  /** position and size as fractions of the displayed page, origin top-left */
  fx: number
  fy: number
  fw: number
  fh: number
  png: Uint8Array
}

export async function placeImages(src: Uint8Array, placements: Placement[]): Promise<Bytes> {
  const doc = await loadPdf(src)
  const pages = doc.getPages()
  const cache = new Map<Uint8Array, Awaited<ReturnType<PDFDocument['embedPng']>>>()
  for (const p of placements) {
    const page = pages[p.page]
    if (!page) continue
    let img = cache.get(p.png)
    if (!img) {
      img = await doc.embedPng(p.png)
      cache.set(p.png, img)
    }
    const { w, h, rot } = displaySize(page)
    const { x, y } = toPageSpace(page, p.fx * w, (p.fy + p.fh) * h) // bottom-left of the image on screen
    page.drawImage(img, { x, y, width: p.fw * w, height: p.fh * h, rotate: degrees(rot) })
  }
  return toBytes(await doc.save())
}

/* ---------- watermark & page numbers ---------- */

function assertEncodable(font: { encodeText(t: string): unknown }, text: string) {
  try {
    font.encodeText(text)
  } catch {
    throw new Error('This text has characters the built-in font cannot draw. Use Latin letters.')
  }
}

export type WatermarkOptions = {
  text: string
  size: number
  opacity: number
  /** degrees, counter-clockwise */
  angle: number
  color: [number, number, number]
}

export async function addWatermark(src: Uint8Array, o: WatermarkOptions): Promise<Bytes> {
  const doc = await loadPdf(src)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  assertEncodable(font, o.text)
  const tw = font.widthOfTextAtSize(o.text, o.size)
  const th = font.heightAtSize(o.size, { descender: false })
  for (const page of doc.getPages()) {
    const { w, h, rot } = displaySize(page)
    const c = toPageSpace(page, w / 2, h / 2)
    const a = ((o.angle + rot) * Math.PI) / 180
    // Rotation is about the text origin; shift it so the text's centre lands on the page centre.
    const x = c.x - (tw / 2) * Math.cos(a) + (th / 2) * Math.sin(a)
    const y = c.y - (tw / 2) * Math.sin(a) - (th / 2) * Math.cos(a)
    page.drawText(o.text, { x, y, size: o.size, font, color: rgb(...o.color), opacity: o.opacity, rotate: degrees(o.angle + rot) })
  }
  return toBytes(await doc.save())
}

export type NumberOptions = {
  /** e.g. "Page {n} of {total}" */
  format: string
  vertical: 'bottom' | 'top'
  horizontal: 'left' | 'center' | 'right'
  size: number
  start: number
  skipFirst: boolean
  margin: number
}

export function formatPageLabel(format: string, n: number, total: number): string {
  return format.replaceAll('{n}', String(n)).replaceAll('{total}', String(total))
}

export async function addPageNumbers(src: Uint8Array, o: NumberOptions): Promise<Bytes> {
  const doc = await loadPdf(src)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  assertEncodable(font, formatPageLabel(o.format, 0, 0))
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return
    const label = formatPageLabel(o.format, o.start + i - (o.skipFirst ? 1 : 0), pages.length)
    const tw = font.widthOfTextAtSize(label, o.size)
    const { w, h, rot } = displaySize(page)
    const u = o.horizontal === 'left' ? o.margin : o.horizontal === 'right' ? w - o.margin - tw : (w - tw) / 2
    const v = o.vertical === 'top' ? o.margin + o.size : h - o.margin
    const { x, y } = toPageSpace(page, u, v)
    page.drawText(label, { x, y, size: o.size, font, color: rgb(0.15, 0.15, 0.15), rotate: degrees(rot) })
  })
  return toBytes(await doc.save())
}

/* ---------- metadata ---------- */

export type Metadata = {
  title: string
  author: string
  subject: string
  keywords: string
  creator: string
  producer: string
}

export const META_KEYS: (keyof Metadata)[] = ['title', 'author', 'subject', 'keywords', 'creator', 'producer']
const INFO_NAME: Record<keyof Metadata, string> = {
  title: 'Title',
  author: 'Author',
  subject: 'Subject',
  keywords: 'Keywords',
  creator: 'Creator',
  producer: 'Producer',
}

function infoDict(doc: PDFDocument): PDFDict | undefined {
  const ref = doc.context.trailerInfo.Info
  if (!ref) return undefined
  const d = ref instanceof PDFRef ? doc.context.lookup(ref) : ref
  return d instanceof PDFDict ? d : undefined
}

function stringOf(doc: PDFDocument, key: string): string {
  const v = infoDict(doc)?.lookup(PDFName.of(key))
  const text = v && 'decodeText' in v && typeof v.decodeText === 'function' ? (v.decodeText() as string) : ''
  return text
}

export async function readMetadata(src: Uint8Array): Promise<Metadata> {
  const doc = await loadPdf(src)
  const m = {} as Metadata
  for (const k of META_KEYS) m[k] = stringOf(doc, INFO_NAME[k])
  return m
}

/** Removes the Info dictionary and the XMP metadata stream. */
function stripAll(doc: PDFDocument) {
  const info = doc.context.trailerInfo.Info
  if (info instanceof PDFRef) doc.context.delete(info)
  delete doc.context.trailerInfo.Info
  const xmp = doc.catalog.get(PDFName.of('Metadata'))
  if (xmp instanceof PDFRef) doc.context.delete(xmp)
  doc.catalog.delete(PDFName.of('Metadata'))
  doc.catalog.delete(PDFName.of('PieceInfo'))
}

export async function stripMetadata(src: Uint8Array): Promise<Bytes> {
  const doc = await loadPdf(src)
  stripAll(doc)
  return toBytes(await doc.save())
}

/** Sets the given fields; an empty string removes that field. Other fields are kept. */
export async function writeMetadata(src: Uint8Array, m: Partial<Metadata>): Promise<Bytes> {
  const doc = await loadPdf(src)
  const setters: Record<keyof Metadata, (v: string) => void> = {
    title: (v) => doc.setTitle(v),
    author: (v) => doc.setAuthor(v),
    subject: (v) => doc.setSubject(v),
    keywords: (v) => doc.setKeywords(v ? [v] : []),
    creator: (v) => doc.setCreator(v),
    producer: (v) => doc.setProducer(v),
  }
  for (const k of META_KEYS) {
    const v = m[k]
    if (v === undefined) continue
    if (v === '') infoDict(doc)?.delete(PDFName.of(INFO_NAME[k]))
    else setters[k](v)
  }
  // The XMP packet may still carry the old values, so drop it whenever metadata is edited.
  const xmp = doc.catalog.get(PDFName.of('Metadata'))
  if (xmp instanceof PDFRef) doc.context.delete(xmp)
  doc.catalog.delete(PDFName.of('Metadata'))
  return toBytes(await doc.save())
}

/** Lossless re-save with object streams; optionally drops all metadata. */
export async function optimizeLossless(src: Uint8Array, strip: boolean): Promise<Bytes> {
  const doc = await loadPdf(src)
  if (strip) stripAll(doc)
  return toBytes(await doc.save({ useObjectStreams: true, addDefaultPage: false }))
}

/* ---------- raster compression and images → PDF ---------- */

export type RasterPage = { jpeg: Uint8Array; widthPt: number; heightPt: number }

/** Builds a PDF where each page is one JPEG scaled to the given page size in points. */
export async function pdfFromJpegs(pages: RasterPage[]): Promise<Bytes> {
  const out = await PDFDocument.create(LOAD)
  for (const p of pages) {
    const img = await out.embedJpg(p.jpeg)
    const page = out.addPage([p.widthPt, p.heightPt])
    page.drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt })
  }
  return toBytes(await out.save())
}

export type ImageInput = { bytes: Uint8Array; type: 'png' | 'jpg' }
export type PageSize = 'image' | 'a4' | 'letter'
const SIZES: Record<'a4' | 'letter', [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }

export async function imagesToPdf(images: ImageInput[], size: PageSize, margin: number): Promise<Bytes> {
  const out = await PDFDocument.create(LOAD)
  for (const im of images) {
    const img = im.type === 'png' ? await out.embedPng(im.bytes) : await out.embedJpg(im.bytes)
    if (size === 'image') {
      const page = out.addPage([img.width * 0.75, img.height * 0.75])
      page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
      continue
    }
    let [pw, ph] = SIZES[size]
    if (img.width > img.height) [pw, ph] = [ph, pw]
    const page = out.addPage([pw, ph])
    const k = Math.min((pw - 2 * margin) / img.width, (ph - 2 * margin) / img.height)
    const w = img.width * k
    const h = img.height * k
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
  }
  return toBytes(await out.save())
}
