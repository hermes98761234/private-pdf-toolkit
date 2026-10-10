import { useEffect, useRef, useState } from 'react'
import { ErrorBox, FileDrop, ResultBar, Section } from '../components/common'
import { errText, usePdfFile } from '../components/helpers'
import SignaturePad from '../components/SignaturePad'
import { useT } from '../i18n'
import { baseName } from '../lib/format'
import { placeImages, type Bytes } from '../lib/pdf'
import { renderPage } from '../lib/render'
import { textStamp, type Stamp } from '../lib/stamp'

type Overlay = { id: number; page: number; fx: number; fy: number; fw: number; stamp: Stamp }
let nextId = 1

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function Sign() {
  const t = useT()
  const { file, error, busy, load } = usePdfFile()
  const [page, setPage] = useState(0)
  const [stamps, setStamps] = useState<Stamp[]>([])
  const [overlays, setOverlays] = useState<Overlay[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [aspect, setAspect] = useState(0.7) // displayed page width / height
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayISO)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<Bytes | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!file || !canvas.current) return
    let dead = false
    void (async () => {
      const p = await file.doc.getPage(page + 1)
      const base = p.getViewport({ scale: 1 })
      setAspect(base.width / base.height)
      const cssW = Math.min(stage.current?.parentElement?.clientWidth ?? 640, 640)
      await renderPage(file.doc, page, canvas.current!, (cssW * Math.min(2, window.devicePixelRatio || 1)) / base.width, 0, () => dead)
    })().catch(() => {})
    return () => {
      dead = true
    }
  }, [file, page])

  const addStamp = (s: Stamp, widthFrac: number) => {
    const o: Overlay = { id: nextId++, page, fx: 0.5 - widthFrac / 2, fy: 0.5 + 0.1 * (overlays.filter((x) => x.page === page).length % 6), fw: widthFrac, stamp: s }
    setOverlays((l) => [...l, o])
    setSelected(o.id)
    setOut(null)
  }
  const fh = (o: Overlay) => (o.fw * (o.stamp.height / o.stamp.width)) / aspect

  const patch = (id: number, p: Partial<Overlay>) => {
    setOverlays((l) => l.map((o) => (o.id === id ? { ...o, ...p } : o)))
    setOut(null)
  }

  const startDrag = (e: React.PointerEvent, o: Overlay, mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    setSelected(o.id)
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const rect = stage.current!.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    const orig = { ...o }
    const onMove = (m: PointerEvent) => {
      const dx = (m.clientX - sx) / rect.width
      const dy = (m.clientY - sy) / rect.height
      if (mode === 'move') {
        patch(o.id, { fx: Math.min(1 - 0.02, Math.max(0.02 - orig.fw, orig.fx + dx)), fy: Math.min(0.98, Math.max(-0.02, orig.fy + dy)) })
      } else {
        patch(o.id, { fw: Math.min(1, Math.max(0.04, orig.fw + dx)) })
      }
    }
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  const addText = async (value: string) => {
    const s = await textStamp(value, 'system-ui, "Segoe UI", Roboto, Arial, sans-serif', '#111827', 64)
    if (s) addStamp(s, Math.min(0.6, Math.max(0.06, s.width / 3200)))
  }

  const apply = async () => {
    if (!file) return
    setErr('')
    try {
      // Heights depend on each page's own aspect ratio, so measure every page that has overlays.
      const aspects = new Map<number, number>()
      for (const p of new Set(overlays.map((o) => o.page))) {
        const vp = (await file.doc.getPage(p + 1)).getViewport({ scale: 1 })
        aspects.set(p, vp.width / vp.height)
      }
      setOut(
        await placeImages(
          file.bytes,
          overlays.map((o) => ({ page: o.page, fx: o.fx, fy: o.fy, fw: o.fw, fh: (o.fw * (o.stamp.height / o.stamp.width)) / aspects.get(o.page)!, png: o.stamp.png })),
        ),
      )
    } catch (e) {
      setErr(errText(e))
    }
  }

  const here = overlays.filter((o) => o.page === page)

  return (
    <div className="tool">
      <Section title="Sign a PDF">
        <p className="hint">{t('Create a signature, place it on a page, drag and resize it, then download. Nothing is uploaded.')}</p>
        <FileDrop
          accept=".pdf,application/pdf"
          label={file ? t('Choose another PDF') : t('Choose a PDF')}
          onFiles={async ([f]) => {
            setOverlays([])
            setOut(null)
            setPage(0)
            await load(f)
          }}
        />
        <ErrorBox error={error} />
        {busy && <p className="hint">{t('Working…')}</p>}
      </Section>
      {file && (
        <div className="signlayout">
          <div className="signside">
            <Section title="1. Your signature">
              <SignaturePad onCreate={(s) => setStamps((l) => [s, ...l].slice(0, 6))} />
              {stamps.length > 0 && (
                <>
                  <p className="hint">{t('Click a signature to place it on page {0}.', page + 1)}</p>
                  <div className="stamps">
                    {stamps.map((s, i) => (
                      <button key={i} className="stamp" onClick={() => addStamp(s, Math.min(0.35, Math.max(0.12, s.width / 1400)))}>
                        <img src={s.url} alt={t('Signature')} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Section>
            <Section title="2. Date and text">
              <div className="row">
                <input type="date" aria-label={t('Date')} value={date} onChange={(e) => setDate(e.target.value)} />
                <button
                  disabled={!date}
                  onClick={() => {
                    const d = new Date(`${date}T12:00:00`)
                    void addText(d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))
                  }}
                >
                  {t('Add date')}
                </button>
              </div>
              <div className="row">
                <input type="text" aria-label={t('Text')} placeholder={t('Text')} value={text} onChange={(e) => setText(e.target.value)} />
                <button disabled={!text.trim()} onClick={() => void addText(text)}>
                  {t('Add text')}
                </button>
              </div>
            </Section>
          </div>
          <Section title="3. Place it">
            <div className="row">
              <button disabled={page === 0} onClick={() => { setPage(page - 1); setSelected(null) }}>◀</button>
              <span>
                {t('Page')} {page + 1} / {file.pages}
              </span>
              <button disabled={page >= file.pages - 1} onClick={() => { setPage(page + 1); setSelected(null) }}>▶</button>
              <span className="spacer" />
              {selected !== null && overlays.some((o) => o.id === selected && o.page === page) && (
                <button className="danger" onClick={() => { setOverlays((l) => l.filter((o) => o.id !== selected)); setSelected(null); setOut(null) }}>
                  {t('Remove selected')}
                </button>
              )}
              <button className="primary" disabled={overlays.length === 0} onClick={apply}>
                {t('Apply & save')}
              </button>
            </div>
            <div className="pagewrap">
              <div ref={stage} className="stage" onPointerDown={() => setSelected(null)}>
                <canvas ref={canvas} />
                {here.map((o) => (
                  <div
                    key={o.id}
                    className={`ov${selected === o.id ? ' sel' : ''}`}
                    style={{ left: `${o.fx * 100}%`, top: `${o.fy * 100}%`, width: `${o.fw * 100}%`, height: `${fh(o) * 100}%` }}
                    onPointerDown={(e) => startDrag(e, o, 'move')}
                  >
                    <img src={o.stamp.url} alt="" draggable={false} />
                    <span className="grip" onPointerDown={(e) => startDrag(e, o, 'resize')} />
                  </div>
                ))}
              </div>
            </div>
            <ErrorBox error={err} />
            {out && file && <ResultBar name={`${baseName(file.name)}-signed.pdf`} data={out} />}
          </Section>
        </div>
      )}
    </div>
  )
}
