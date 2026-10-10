import { PDFDocument, PDFName, degrees } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  addPageNumbers,
  addWatermark,
  buildPdf,
  formatPageLabel,
  imagesToPdf,
  mergePdfs,
  optimizeLossless,
  pdfFromJpegs,
  placeImages,
  readMetadata,
  splitPdf,
  stripMetadata,
  writeMetadata,
} from './pdf'
import { crc32, makeZip } from './zip'

/** A PDF whose page i has width 100 + i, so pages are identifiable. */
async function sample(pages: number, meta = false, firstWidth = 100): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([firstWidth + i, 200])
  if (meta) {
    doc.setTitle('Secret plan')
    doc.setAuthor('Alice')
    doc.setSubject('Hidden')
    doc.setKeywords(['a', 'b'])
    doc.setCreator('MyTool')
    doc.setProducer('MyProducer')
  }
  return doc.save()
}

const widths = async (b: Uint8Array) => (await PDFDocument.load(b)).getPages().map((p) => Math.round(p.getWidth()))
const text = (b: Uint8Array) => new TextDecoder('latin1').decode(b)

// 1x1 PNG
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

describe('merge', () => {
  it('concatenates pages in file order', async () => {
    const out = await mergePdfs([await sample(2, false, 100), await sample(3, false, 300)])
    expect(await widths(out)).toEqual([100, 101, 300, 301, 302])
  })
})

describe('buildPdf', () => {
  it('reorders, drops, rotates and inserts blank pages', async () => {
    const a = await sample(3)
    const out = await buildPdf(
      [a],
      [
        { kind: 'page', src: 0, index: 2, rotate: 90 },
        { kind: 'blank', width: 50, height: 60 },
        { kind: 'page', src: 0, index: 0 },
      ],
    )
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(3)
    expect(doc.getPage(0).getWidth()).toBe(102)
    expect(doc.getPage(0).getRotation().angle).toBe(90)
    expect(doc.getPage(1).getSize()).toEqual({ width: 50, height: 60 })
    expect(doc.getPage(2).getWidth()).toBe(100)
  })
  it('accumulates rotation modulo 360 including negatives', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([10, 10]).setRotation(degrees(90))
    const out = await buildPdf([await doc.save()], [{ kind: 'page', src: 0, index: 0, rotate: -180 }])
    expect((await PDFDocument.load(out)).getPage(0).getRotation().angle).toBe(270)
  })
  it('rejects garbage input with a readable error', async () => {
    await expect(mergePdfs([new Uint8Array([1, 2, 3])])).rejects.toThrow(/cannot be opened/)
  })
})

describe('split', () => {
  it('produces one PDF per group with the right pages', async () => {
    const parts = await splitPdf(await sample(5), [[1, 2], [5], [3, 4, 5]])
    expect(await Promise.all(parts.map(widths))).toEqual([[100, 101], [104], [102, 103, 104]])
  })
  it('round-trips with merge', async () => {
    const src = await sample(4)
    const parts = await splitPdf(src, [[1, 2], [3, 4]])
    expect(await widths(await mergePdfs(parts))).toEqual(await widths(src))
  })
})

describe('metadata', () => {
  it('reads metadata', async () => {
    const m = await readMetadata(await sample(1, true))
    expect(m.title).toBe('Secret plan')
    expect(m.author).toBe('Alice')
    expect(m.keywords).toBe('a b')
    expect(m.producer).toBe('MyProducer')
  })
  it('strips every trace from the file bytes', async () => {
    const stripped = await stripMetadata(await sample(2, true))
    const doc = await PDFDocument.load(stripped, { updateMetadata: false })
    expect(doc.getTitle()).toBeUndefined()
    expect(doc.getAuthor()).toBeUndefined()
    expect(doc.getProducer()).toBeUndefined()
    const raw = text(stripped)
    for (const s of ['Secret plan', 'Alice', 'Hidden', 'MyTool', 'MyProducer', '/Author']) expect(raw).not.toContain(s)
    expect(doc.getPageCount()).toBe(2)
  })
  it('strips an XMP metadata stream', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const xmp = doc.context.stream('<x:xmpmeta>TopSecretXmp</x:xmpmeta>', { Type: 'Metadata', Subtype: 'XML' })
    doc.catalog.set(PDFName.of('Metadata'), doc.context.register(xmp))
    const before = await doc.save()
    expect(text(before)).toContain('TopSecretXmp')
    expect(text(await stripMetadata(before))).not.toContain('TopSecretXmp')
  })
  it('writes and removes individual fields', async () => {
    const out = await writeMetadata(await sample(1, true), { title: 'New title', author: '' })
    const m = await readMetadata(out)
    expect(m.title).toBe('New title')
    expect(m.author).toBe('')
    expect(m.subject).toBe('Hidden')
    expect(text(out)).not.toContain('Alice')
  })
})

describe('optimizeLossless', () => {
  it('uses object streams and keeps pages', async () => {
    const out = await optimizeLossless(await sample(3, true), false)
    expect(text(out)).toContain('/ObjStm')
    expect((await PDFDocument.load(out)).getPageCount()).toBe(3)
    expect((await readMetadata(out)).title).toBe('Secret plan')
  })
  it('can strip metadata at the same time', async () => {
    const out = await optimizeLossless(await sample(1, true), true)
    expect((await readMetadata(out)).title).toBe('')
    expect(text(out)).not.toContain('Secret plan')
  })
})

describe('stamping', () => {
  it('places images, also on rotated pages', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([200, 100])
    doc.addPage([200, 100]).setRotation(degrees(90))
    const out = await placeImages(await doc.save(), [
      { page: 0, fx: 0.1, fy: 0.1, fw: 0.2, fh: 0.2, png: PNG },
      { page: 1, fx: 0, fy: 0, fw: 0.5, fh: 0.5, png: PNG },
      { page: 9, fx: 0, fy: 0, fw: 1, fh: 1, png: PNG },
    ])
    const d = await PDFDocument.load(out)
    expect(d.getPageCount()).toBe(2)
    expect(text(out)).toContain('/Image')
  })
  it('adds a watermark and page numbers', async () => {
    const src = await sample(3)
    const wm = await addWatermark(src, { text: 'DRAFT', size: 40, opacity: 0.3, angle: 45, color: [1, 0, 0] })
    expect(wm.length).toBeGreaterThan(src.length)
    const nums = await addPageNumbers(wm, { format: 'Page {n} of {total}', vertical: 'bottom', horizontal: 'center', size: 10, start: 1, skipFirst: false, margin: 20 })
    expect((await PDFDocument.load(nums)).getPageCount()).toBe(3)
  })
  it('rejects text the built-in font cannot draw', async () => {
    await expect(addWatermark(await sample(1), { text: 'Привіт', size: 20, opacity: 1, angle: 0, color: [0, 0, 0] })).rejects.toThrow(/Latin/)
  })
  it('formats page labels', () => {
    expect(formatPageLabel('{n} / {total}', 2, 9)).toBe('2 / 9')
  })
})

describe('images and raster', () => {
  it('converts images to pages of the requested size', async () => {
    const a4 = await imagesToPdf([{ bytes: PNG, type: 'png' }, { bytes: PNG, type: 'png' }], 'a4', 20)
    const d = await PDFDocument.load(a4)
    expect(d.getPageCount()).toBe(2)
    expect(d.getPage(0).getSize().width).toBeCloseTo(595.28, 1)
    const native = await PDFDocument.load(await imagesToPdf([{ bytes: PNG, type: 'png' }], 'image', 0))
    expect(native.getPage(0).getSize()).toEqual({ width: 0.75, height: 0.75 })
  })
  it('rejects JPEG pages that are not JPEGs', async () => {
    await expect(pdfFromJpegs([{ jpeg: PNG, widthPt: 10, heightPt: 10 }])).rejects.toThrow()
  })
})

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
  it('writes a well-formed archive', () => {
    const z = makeZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }])
    const v = new DataView(z.buffer)
    expect(v.getUint32(0, true)).toBe(0x04034b50)
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50)
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(1)
  })
})
