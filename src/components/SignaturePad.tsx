import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { SIGNATURE_FONTS, imageStamp, textStamp, toStamp, type Stamp } from '../lib/stamp'

type Props = { onCreate: (s: Stamp) => void }
type Tab = 'draw' | 'type' | 'upload'

const INKS = ['#111827', '#1d4ed8', '#b91c1c']

/** Three ways to make a signature image: draw, type, upload. */
export default function SignaturePad({ onCreate }: Props) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('draw')
  const [ink, setInk] = useState(INKS[1])
  const [name, setName] = useState('')
  const [font, setFont] = useState<string>(SIGNATURE_FONTS[0].css)
  const [transparent, setTransparent] = useState(true)
  const [msg, setMsg] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const [typed, setTyped] = useState<Stamp | null>(null)

  useEffect(() => {
    let dead = false
    void textStamp(name, font, ink, 72).then((s) => !dead && setTyped(s))
    return () => {
      dead = true
    }
  }, [name, font, ink])

  const pos = (e: React.PointerEvent) => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }
  const down = (e: React.PointerEvent) => {
    const c = canvas.current!
    c.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = c.getContext('2d')!
    const p = pos(e)
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = 4
    ctx.lineCap = ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    dirty.current = true
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const p = pos(e)
    const ctx = canvas.current!.getContext('2d')!
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
  const clear = () => {
    const c = canvas.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    dirty.current = false
  }

  return (
    <div className="sigpad">
      <div className="seg" role="tablist">
        {(['draw', 'type', 'upload'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setMsg('') }}>
            {k === 'draw' ? t('Draw') : k === 'type' ? t('Type') : t('Upload image')}
          </button>
        ))}
      </div>
      {tab !== 'upload' && (
        <div className="row">
          <span className="hint">{t('Ink')}</span>
          {INKS.map((c) => (
            <button key={c} className={`swatch${ink === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => setInk(c)} />
          ))}
        </div>
      )}
      {tab === 'draw' && (
        <>
          <canvas
            ref={canvas}
            className="sigcanvas"
            width={640}
            height={220}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => (drawing.current = false)}
            onPointerCancel={() => (drawing.current = false)}
          />
          <div className="row">
            <button onClick={clear}>{t('Clear')}</button>
            <button
              className="primary"
              onClick={async () => {
                const s = dirty.current ? await toStamp(canvas.current!) : null
                if (s) {
                  setMsg('')
                  onCreate(s)
                } else setMsg('Draw your signature first.')
              }}
            >
              {t('Use this signature')}
            </button>
          </div>
        </>
      )}
      {tab === 'type' && (
        <>
          <div className="field">
            <label htmlFor="signame">{t('Your name')}</label>
            <input id="signame" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fontlist">
            {SIGNATURE_FONTS.map((f) => (
              <button key={f.id} className={font === f.css ? 'on' : ''} style={{ fontFamily: f.css, fontSize: 24 }} onClick={() => setFont(f.css)}>
                {name || t('Signature')}
              </button>
            ))}
          </div>
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                if (typed) {
                  setMsg('')
                  onCreate(typed)
                } else setMsg('Type your name first.')
              }}
            >
              {t('Use this signature')}
            </button>
          </div>
        </>
      )}
      {tab === 'upload' && (
        <>
          <div className="field">
            <label htmlFor="sigimg">{t('Image of your signature')}</label>
            <input
              id="sigimg"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const s = await imageStamp(f, transparent)
                  if (s) {
                    setMsg('')
                    onCreate(s)
                  } else setMsg('The image is empty.')
                } catch {
                  setMsg('Cannot read this image.')
                }
              }}
            />
          </div>
          <label className="check">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> {t('Make the white background transparent')}
          </label>
        </>
      )}
      {msg && <p className="err-text">{t(msg)}</p>}
    </div>
  )
}
