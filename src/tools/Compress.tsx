import { useState } from 'react'
import { ErrorBox, FileDrop, ResultBar, Section } from '../components/common'
import { errText, usePdfFile } from '../components/helpers'
import { useT } from '../i18n'
import { baseName, formatBytes, formatChange } from '../lib/format'
import { optimizeLossless, pdfFromJpegs, type Bytes, type RasterPage } from '../lib/pdf'
import { renderJpeg } from '../lib/render'

export default function Compress() {
  const t = useT()
  const { file, error, busy, load } = usePdfFile()
  const [mode, setMode] = useState<'lossy' | 'lossless'>('lossy')
  const [dpi, setDpi] = useState(110)
  const [quality, setQuality] = useState(0.6)
  const [strip, setStrip] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<Bytes | null>(null)

  const run = async () => {
    if (!file) return
    setErr('')
    setOut(null)
    try {
      if (mode === 'lossless') {
        setOut(await optimizeLossless(file.bytes, strip))
        return
      }
      const pages: RasterPage[] = []
      for (let i = 0; i < file.pages; i++) {
        setProgress(i / file.pages)
        pages.push(await renderJpeg(file.doc, i, dpi, quality))
      }
      setProgress(1)
      setOut(await pdfFromJpegs(pages))
    } catch (e) {
      setErr(errText(e))
    } finally {
      setProgress(null)
    }
  }

  const reset = () => setOut(null)

  return (
    <div className="tool">
      <Section title="Compress a PDF">
        <p className="hint">{t('Shrink big scans and photos. Lossy mode re-renders every page as a JPEG; lossless mode only repacks the file.')}</p>
        <FileDrop accept=".pdf,application/pdf" label={file ? t('Choose another PDF') : t('Choose a PDF')} onFiles={async ([f]) => { reset(); await load(f) }} />
        <ErrorBox error={error} />
        {busy && <p className="hint">{t('Working…')}</p>}
      </Section>
      {file && (
        <Section>
          <div className="row">
            <b className="fname">{file.name}</b>
            <span className="hint">
              {file.pages} {t('pages')} · {formatBytes(file.bytes.length)}
            </span>
          </div>
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={mode === 'lossy'} className={mode === 'lossy' ? 'on' : ''} onClick={() => { setMode('lossy'); reset() }}>
              {t('Re-render pages (smaller)')}
            </button>
            <button role="tab" aria-selected={mode === 'lossless'} className={mode === 'lossless' ? 'on' : ''} onClick={() => { setMode('lossless'); reset() }}>
              {t('Lossless')}
            </button>
          </div>
          {mode === 'lossy' ? (
            <>
              <div className="field">
                <label htmlFor="dpi">
                  {t('Resolution')}: {dpi} DPI
                </label>
                <input id="dpi" type="range" min={50} max={220} step={10} value={dpi} onChange={(e) => { setDpi(+e.target.value); reset() }} />
              </div>
              <div className="field">
                <label htmlFor="q">
                  {t('JPEG quality')}: {Math.round(quality * 100)}%
                </label>
                <input id="q" type="range" min={0.2} max={0.95} step={0.05} value={quality} onChange={(e) => { setQuality(+e.target.value); reset() }} />
              </div>
              <p className="hint warn-text">{t('Text becomes part of the page image: it is no longer selectable or searchable.')}</p>
            </>
          ) : (
            <>
              <p className="hint">{t('Repacks objects into compressed object streams. Text and quality stay exactly as they are; savings are usually small.')}</p>
              <label className="check">
                <input type="checkbox" checked={strip} onChange={(e) => { setStrip(e.target.checked); reset() }} /> {t('Also strip metadata (title, author, XMP)')}
              </label>
            </>
          )}
          <div className="row">
            <button className="primary" disabled={progress !== null} onClick={run}>
              {progress !== null ? `${t('Working…')} ${Math.round(progress * 100)}%` : t('Compress')}
            </button>
          </div>
          <ErrorBox error={err} />
          {out && (
            <>
              <table className="data">
                <tbody>
                  <tr>
                    <td>{t('Before')}</td>
                    <td>{formatBytes(file.bytes.length)}</td>
                  </tr>
                  <tr>
                    <td>{t('After')}</td>
                    <td>
                      {formatBytes(out.length)} ({formatChange(file.bytes.length, out.length)})
                    </td>
                  </tr>
                </tbody>
              </table>
              {out.length >= file.bytes.length && <p className="warn-text">{t('The result is not smaller than the original. Try a lower resolution or quality.')}</p>}
              <ResultBar name={`${baseName(file.name)}-compressed.pdf`} data={out} before={file.bytes.length} />
            </>
          )}
        </Section>
      )}
    </div>
  )
}
