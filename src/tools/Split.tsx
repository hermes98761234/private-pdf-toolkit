import { useMemo, useState } from 'react'
import { ErrorBox, FileDrop, ResultBar, Section } from '../components/common'
import { download, errText, usePdfFile } from '../components/helpers'
import Thumb from '../components/Thumb'
import { useT } from '../i18n'
import { baseName } from '../lib/format'
import { splitPdf, type Bytes } from '../lib/pdf'
import { everyN, formatRanges, parseRanges } from '../lib/ranges'
import { makeZip } from '../lib/zip'

type Mode = 'ranges' | 'every' | 'select'
type Part = { name: string; data: Bytes }

export default function Split() {
  const t = useT()
  const { file, error, busy, load } = usePdfFile()
  const [mode, setMode] = useState<Mode>('ranges')
  const [text, setText] = useState('1-2, 4')
  const [separate, setSeparate] = useState(true)
  const [n, setN] = useState(1)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [parts, setParts] = useState<Part[]>([])
  const [err, setErr] = useState('')

  const parsed = useMemo(() => (file && mode === 'ranges' ? parseRanges(text, file.pages) : null), [file, mode, text])
  const rangeErr = parsed && !parsed.ok ? t(parsed.error.msg, ...parsed.error.args) : ''

  const run = async () => {
    if (!file) return
    setErr('')
    setParts([])
    let groups: number[][]
    if (mode === 'ranges') {
      if (!parsed?.ok) return
      groups = separate ? parsed.groups : [parsed.groups.flat()]
    } else if (mode === 'every') {
      groups = everyN(file.pages, n)
    } else {
      if (sel.size === 0) return setErr('Select at least one page.')
      groups = [[...sel].sort((a, b) => a - b)]
    }
    try {
      const outs = await splitPdf(file.bytes, groups)
      const base = baseName(file.name)
      const pad = String(groups.length).length
      setParts(
        outs.map((data, i) => ({
          name: mode === 'every' || groups.length > 1 ? `${base}-${String(i + 1).padStart(pad, '0')}-p${formatRanges(groups[i]).replace(/, /g, '_')}.pdf` : `${base}-p${formatRanges(groups[i]).replace(/, /g, '_')}.pdf`,
          data,
        })),
      )
    } catch (e) {
      setErr(errText(e))
    }
  }

  const reset = () => {
    setParts([])
    setErr('')
  }

  return (
    <div className="tool">
      <Section title="Split a PDF">
        <p className="hint">{t('Cut a PDF into pieces by page ranges, every N pages, or pick the pages you want.')}</p>
        <FileDrop
          accept=".pdf,application/pdf"
          label={file ? t('Choose another PDF') : t('Choose a PDF')}
          onFiles={async ([f]) => {
            setSel(new Set())
            reset()
            await load(f)
          }}
        />
        <ErrorBox error={error} />
        {busy && <p className="hint">{t('Working…')}</p>}
      </Section>
      {file && (
        <Section>
          <div className="row">
            <b className="fname">{file.name}</b>
            <span className="hint">
              {file.pages} {t('pages')}
            </span>
          </div>
          <div className="seg" role="tablist">
            {(['ranges', 'every', 'select'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); reset() }}>
                {m === 'ranges' ? t('By ranges') : m === 'every' ? t('Every N pages') : t('Extract selected')}
              </button>
            ))}
          </div>
          {mode === 'ranges' && (
            <div className="field">
              <label htmlFor="ranges">{t('Page ranges')}</label>
              <input id="ranges" value={text} className={rangeErr ? 'bad' : ''} onChange={(e) => { setText(e.target.value); reset() }} placeholder="1-3, 5, 8-" />
              {rangeErr ? <span className="err-text">{rangeErr}</span> : <span className="hint">{t('Example: 1-3, 5, 8- (8- means page 8 to the end)')}</span>}
              <label className="check">
                <input type="checkbox" checked={separate} onChange={(e) => { setSeparate(e.target.checked); reset() }} /> {t('Save each range as a separate file')}
              </label>
            </div>
          )}
          {mode === 'every' && (
            <div className="field">
              <label htmlFor="everyn">{t('Pages per file')}</label>
              <input id="everyn" type="number" min={1} max={file.pages} value={n} onChange={(e) => { setN(Math.max(1, Math.floor(Number(e.target.value) || 1))); reset() }} />
              <span className="hint">
                {t('{0} files will be created.', everyN(file.pages, n).length)}
              </span>
            </div>
          )}
          {mode === 'select' && (
            <>
              <div className="row">
                <button onClick={() => { setSel(new Set(Array.from({ length: file.pages }, (_, i) => i + 1))); reset() }}>{t('Select all')}</button>
                <button onClick={() => { setSel(new Set()); reset() }}>{t('Select none')}</button>
                <span className="hint">{sel.size ? `${t('Selected')}: ${formatRanges([...sel])}` : t('Click pages to select them.')}</span>
              </div>
              <ul className="pagegrid">
                {Array.from({ length: file.pages }, (_, i) => (
                  <li key={i}>
                    <button
                      className={`pick${sel.has(i + 1) ? ' on' : ''}`}
                      aria-pressed={sel.has(i + 1)}
                      aria-label={`${t('Page')} ${i + 1}`}
                      onClick={() => {
                        const s = new Set(sel)
                        if (!s.delete(i + 1)) s.add(i + 1)
                        setSel(s)
                        reset()
                      }}
                    >
                      <Thumb doc={file.doc} index={i} width={110} />
                      <span className="plabel">{i + 1}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="row">
            <button className="primary" disabled={mode === 'ranges' && !parsed?.ok} onClick={run}>
              {t('Split')}
            </button>
          </div>
          <ErrorBox error={err} />
          {parts.length > 1 && (
            <div className="row">
              <button className="primary" onClick={() => download(`${baseName(file.name)}-split.zip`, makeZip(parts.map((p) => ({ name: p.name, data: p.data }))), 'application/zip')}>
                {t('Download all as ZIP')}
              </button>
            </div>
          )}
          {parts.map((p) => (
            <ResultBar key={p.name} name={p.name} data={p.data} />
          ))}
        </Section>
      )}
    </div>
  )
}
