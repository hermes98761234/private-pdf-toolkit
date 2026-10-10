import { useEffect, useRef, useState } from 'react'
import { ErrorBox, FileDrop, ResultBar, Section } from '../components/common'
import { errText } from '../components/helpers'
import { useT } from '../i18n'
import { move } from '../lib/array'
import { formatBytes } from '../lib/format'
import { imagesToPdf, type Bytes, type PageSize } from '../lib/pdf'
import { normalizeImage } from '../lib/stamp'

type Img = { id: number; name: string; bytes: Uint8Array; type: 'png' | 'jpg'; url: string }
let nextId = 1

export default function Images() {
  const t = useT()
  const [imgs, setImgs] = useState<Img[]>([])
  const [size, setSize] = useState<PageSize>('a4')
  const [margin, setMargin] = useState(24)
  const [drag, setDrag] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<Bytes | null>(null)
  const latest = useRef(imgs)
  useEffect(() => {
    latest.current = imgs
  }, [imgs])
  useEffect(() => () => latest.current.forEach((i) => URL.revokeObjectURL(i.url)), [])

  const add = async (files: File[]) => {
    setErr('')
    setOut(null)
    const added: Img[] = []
    for (const f of files) {
      try {
        const n = await normalizeImage(f)
        added.push({ id: nextId++, name: f.name, ...n, url: URL.createObjectURL(new Blob([n.bytes as Uint8Array<ArrayBuffer>], { type: n.type === 'png' ? 'image/png' : 'image/jpeg' })) })
      } catch {
        setErr('Some files could not be read as images.')
      }
    }
    setImgs((l) => [...l, ...added])
  }
  const change = (n: Img[]) => {
    setImgs(n)
    setOut(null)
  }

  const run = async () => {
    setErr('')
    try {
      setOut(await imagesToPdf(imgs, size, margin))
    } catch (e) {
      setErr(errText(e))
    }
  }

  return (
    <div className="tool">
      <Section title="Images to PDF">
        <p className="hint">{t('Combine photos or scans into one PDF, one image per page.')}</p>
        <FileDrop accept="image/*" multiple label={t('Add images')} onFiles={add} />
        <ErrorBox error={err} />
      </Section>
      {imgs.length > 0 && (
        <Section>
          <div className="row">
            <div className="field">
              <label htmlFor="ps">{t('Page size')}</label>
              <select id="ps" value={size} onChange={(e) => { setSize(e.target.value as PageSize); setOut(null) }}>
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="image">{t('Same as image')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pm">{t('Margin (pt)')}</label>
              <input id="pm" type="number" min={0} max={200} value={margin} disabled={size === 'image'} onChange={(e) => { setMargin(Math.max(0, +e.target.value || 0)); setOut(null) }} />
            </div>
            <span className="spacer" />
            <button className="primary" onClick={run}>
              {t('Create PDF')}
            </button>
          </div>
          <ul className="filelist">
            {imgs.map((im, i) => (
              <li
                key={im.id}
                draggable
                className={drag === i ? 'dragging' : ''}
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => drag !== null && e.preventDefault()}
                onDrop={() => {
                  if (drag !== null) change(move(imgs, drag, i))
                  setDrag(null)
                }}
                onDragEnd={() => setDrag(null)}
              >
                <img className="imgthumb" src={im.url} alt="" />
                <div className="grow">
                  <div className="fname">{im.name}</div>
                  <div className="hint">{formatBytes(im.bytes.length)}</div>
                </div>
                <button className="small" aria-label={t('Move up')} title={t('Move up')} disabled={i === 0} onClick={() => change(move(imgs, i, i - 1))}>
                  ▲
                </button>
                <button className="small" aria-label={t('Move down')} title={t('Move down')} disabled={i === imgs.length - 1} onClick={() => change(move(imgs, i, i + 1))}>
                  ▼
                </button>
                <button
                  className="small danger"
                  aria-label={t('Remove')}
                  title={t('Remove')}
                  onClick={() => {
                    URL.revokeObjectURL(im.url)
                    change(imgs.filter((_, j) => j !== i))
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {out && <ResultBar name="images.pdf" data={out} />}
        </Section>
      )}
    </div>
  )
}
