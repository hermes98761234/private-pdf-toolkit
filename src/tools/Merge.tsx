import { useMemo, useState } from 'react'
import { ErrorBox, FileDrop, ResultBar, Section } from '../components/common'
import { errText, readPdfFile, type LoadedPdf } from '../components/helpers'
import PageGrid from '../components/PageGrid'
import { newItem, type PageItem } from '../components/pageItems'
import Thumb from '../components/Thumb'
import { useT } from '../i18n'
import { move } from '../lib/array'
import { formatBytes } from '../lib/format'
import { buildPdf, type Bytes } from '../lib/pdf'
import { blankLike } from '../lib/render'

type Entry = LoadedPdf & { id: number }
let nextId = 1

export default function Merge() {
  const t = useT()
  const [files, setFiles] = useState<Entry[]>([])
  const [edited, setEdited] = useState<PageItem[] | null>(null)
  const [view, setView] = useState<'files' | 'pages'>('files')
  const [drag, setDrag] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<Bytes | null>(null)

  // Page items follow the file list until the user edits pages by hand.
  const derived = useMemo(
    () => files.flatMap((f, src) => Array.from({ length: f.pages }, (_, index) => newItem({ kind: 'page', src, index }))),
    [files],
  )
  const items = edited ?? derived

  const changeFiles = (next: Entry[]) => {
    setFiles(next)
    setEdited(null)
    setOut(null)
  }

  const add = async (list: File[]) => {
    setError('')
    setBusy(true)
    try {
      const loaded: Entry[] = []
      for (const f of list) loaded.push({ ...(await readPdfFile(f)), id: nextId++ })
      changeFiles([...files, ...loaded])
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const merge = async () => {
    setBusy(true)
    setError('')
    try {
      setOut(await buildPdf(files.map((f) => f.bytes), items.map((i) => i.spec)))
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const insertBlank = async (after: number) => {
    const prev = items[after]?.spec
    const blank = await blankLike(files.map((f) => f.doc), prev?.kind === 'page' ? prev : undefined)
    const next = [...items]
    next.splice(after + 1, 0, newItem(blank))
    setEdited(next)
    setOut(null)
  }

  return (
    <div className="tool">
      <Section title="Merge PDFs">
        <p className="hint">{t('Add several PDFs, drag to put them in order, optionally rearrange single pages, then merge.')}</p>
        <FileDrop accept=".pdf,application/pdf" multiple label={t('Add PDF files')} onFiles={add} />
        <ErrorBox error={error} />
      </Section>
      {files.length > 0 && (
        <Section>
          <div className="row">
            <div className="seg" role="tablist">
              <button role="tab" aria-selected={view === 'files'} className={view === 'files' ? 'on' : ''} onClick={() => setView('files')}>
                {t('Files')} ({files.length})
              </button>
              <button role="tab" aria-selected={view === 'pages'} className={view === 'pages' ? 'on' : ''} onClick={() => setView('pages')}>
                {t('Pages')} ({items.length})
              </button>
            </div>
            <span className="spacer" />
            <button className="primary" disabled={busy || items.length === 0} onClick={merge}>
              {busy ? t('Working…') : t('Merge')}
            </button>
          </div>
          {view === 'files' ? (
            <ul className="filelist">
              {files.map((f, i) => (
                <li
                  key={f.id}
                  draggable
                  className={drag === i ? 'dragging' : ''}
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => drag !== null && e.preventDefault()}
                  onDrop={() => {
                    if (drag !== null) changeFiles(move(files, drag, i))
                    setDrag(null)
                  }}
                  onDragEnd={() => setDrag(null)}
                >
                  <Thumb doc={f.doc} index={0} width={48} />
                  <div className="grow">
                    <div className="fname">{f.name}</div>
                    <div className="hint">
                      {f.pages} {t('pages')} · {formatBytes(f.bytes.length)}
                    </div>
                  </div>
                  <button className="small" aria-label={t('Move up')} title={t('Move up')} disabled={i === 0} onClick={() => changeFiles(move(files, i, i - 1))}>
                    ▲
                  </button>
                  <button className="small" aria-label={t('Move down')} title={t('Move down')} disabled={i === files.length - 1} onClick={() => changeFiles(move(files, i, i + 1))}>
                    ▼
                  </button>
                  <button className="small danger" aria-label={t('Remove')} title={t('Remove')} onClick={() => changeFiles(files.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="hint">{t('Reordering files again resets page edits.')}</p>
              <PageGrid items={items} docs={files.map((f) => f.doc)} onChange={(n) => { setEdited(n); setOut(null) }} onInsertBlank={insertBlank} />
            </>
          )}
          {out && <ResultBar name="merged.pdf" data={out} />}
        </Section>
      )}
    </div>
  )
}
