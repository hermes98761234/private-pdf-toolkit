import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { download } from './helpers'
import { formatBytes } from '../lib/format'
import { destroyDoc, openDoc, renderPage, type PdfDoc } from '../lib/render'

export function ErrorBox({ error }: { error: string }) {
  const t = useT()
  return error ? (
    <p className="err-text" role="alert">
      {t(error)}
    </p>
  ) : null
}

type DropProps = {
  accept: string
  multiple?: boolean
  label: string
  onFiles: (files: File[]) => void
  compact?: boolean
}

/** Click-or-drop file picker. Files never leave the browser. */
export function FileDrop({ accept, multiple, label, onFiles, compact }: DropProps) {
  const t = useT()
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const exts = accept.split(',').map((s) => s.trim().toLowerCase())
  const ok = (f: File) => exts.some((e) => (e.startsWith('.') ? f.name.toLowerCase().endsWith(e) : e.endsWith('/*') ? f.type.startsWith(e.slice(0, -1)) : f.type === e))
  const take = (list: FileList | null) => {
    const files = [...(list ?? [])].filter(ok)
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }
  return (
    <div
      className={`drop${over ? ' over' : ''}${compact ? ' compact' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
    >
      <button type="button" onClick={() => input.current?.click()}>
        {label}
      </button>
      <span className="hint">{t('or drop files here')}</span>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const t = useT()
  return (
    <section className="box">
      {title && <h3>{t(title)}</h3>}
      {children}
    </section>
  )
}

/** Shows the produced file with its size and a download button. */
export function ResultBar({ name, data, before }: { name: string; data: Uint8Array<ArrayBuffer>; before?: number }) {
  const t = useT()
  return (
    <div className="result">
      <span>
        <b>{name}</b> · {formatBytes(data.length)}
        {before !== undefined && ` (${t('was')} ${formatBytes(before)})`}
      </span>
      <button className="primary" onClick={() => download(name, data)}>
        {t('Download')}
      </button>
    </div>
  )
}

/** Renders one page of a PDF given as bytes. */
export function PdfPreview({ data, page = 0, width = 360 }: { data: Uint8Array; page?: number; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let dead = false
    let doc: PdfDoc | undefined
    void (async () => {
      doc = await openDoc(data)
      if (dead || !ref.current) return
      const p = await doc.getPage(page + 1)
      const base = p.getViewport({ scale: 1 })
      await renderPage(doc, page, ref.current, (width * (window.devicePixelRatio || 1)) / base.width, 0, () => dead)
    })().catch(() => {})
    return () => {
      dead = true
      if (doc) destroyDoc(doc)
    }
  }, [data, page, width])
  return <canvas ref={ref} className="preview" style={{ width }} />
}
