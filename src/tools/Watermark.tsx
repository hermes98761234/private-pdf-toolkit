import { useState } from 'react'
import { ErrorBox, FileDrop, PdfPreview, ResultBar, Section } from '../components/common'
import { errText, usePdfFile } from '../components/helpers'
import { useT } from '../i18n'
import { baseName } from '../lib/format'
import { addPageNumbers, addWatermark, type Bytes, type NumberOptions } from '../lib/pdf'

const hexToRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]

export default function Watermark() {
  const t = useT()
  const { file, error, busy, load } = usePdfFile()
  const [wmOn, setWmOn] = useState(true)
  const [text, setText] = useState('CONFIDENTIAL')
  const [size, setSize] = useState(64)
  const [opacity, setOpacity] = useState(0.25)
  const [angle, setAngle] = useState(45)
  const [color, setColor] = useState('#dc2626')
  const [numOn, setNumOn] = useState(true)
  const [format, setFormat] = useState('Page {n} of {total}')
  const [vertical, setVertical] = useState<NumberOptions['vertical']>('bottom')
  const [horizontal, setHorizontal] = useState<NumberOptions['horizontal']>('center')
  const [start, setStart] = useState(1)
  const [skipFirst, setSkipFirst] = useState(false)
  const [numSize, setNumSize] = useState(11)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<Bytes | null>(null)

  const reset = () => setOut(null)

  const run = async () => {
    if (!file) return
    setErr('')
    try {
      let data: Bytes = file.bytes
      if (wmOn && text.trim()) data = await addWatermark(data, { text, size, opacity, angle, color: hexToRgb(color) })
      if (numOn) data = await addPageNumbers(data, { format, vertical, horizontal, size: numSize, start, skipFirst, margin: 28 })
      setOut(data)
    } catch (e) {
      setErr(errText(e))
    }
  }

  return (
    <div className="tool">
      <Section title="Watermark & page numbers">
        <p className="hint">{t('Stamp a text watermark across every page and/or number the pages.')}</p>
        <FileDrop accept=".pdf,application/pdf" label={file ? t('Choose another PDF') : t('Choose a PDF')} onFiles={async ([f]) => { reset(); await load(f) }} />
        <ErrorBox error={error} />
        {busy && <p className="hint">{t('Working…')}</p>}
      </Section>
      {file && (
        <div className="two">
          <Section>
            <label className="check strong">
              <input type="checkbox" checked={wmOn} onChange={(e) => { setWmOn(e.target.checked); reset() }} /> {t('Text watermark')}
            </label>
            <div className="field">
              <label htmlFor="wmt">{t('Text')}</label>
              <input id="wmt" value={text} onChange={(e) => { setText(e.target.value); reset() }} disabled={!wmOn} />
            </div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="wms">{t('Font size')}</label>
                <input id="wms" type="number" min={8} max={300} value={size} disabled={!wmOn} onChange={(e) => { setSize(Math.max(8, +e.target.value || 8)); reset() }} />
              </div>
              <div className="field">
                <label htmlFor="wma">{t('Angle')}</label>
                <input id="wma" type="number" min={-90} max={90} value={angle} disabled={!wmOn} onChange={(e) => { setAngle(+e.target.value || 0); reset() }} />
              </div>
              <div className="field">
                <label htmlFor="wmo">
                  {t('Opacity')}: {Math.round(opacity * 100)}%
                </label>
                <input id="wmo" type="range" min={0.05} max={1} step={0.05} value={opacity} disabled={!wmOn} onChange={(e) => { setOpacity(+e.target.value); reset() }} />
              </div>
              <div className="field">
                <label htmlFor="wmc">{t('Colour')}</label>
                <input id="wmc" type="color" value={color} disabled={!wmOn} onChange={(e) => { setColor(e.target.value); reset() }} />
              </div>
            </div>
          </Section>
          <Section>
            <label className="check strong">
              <input type="checkbox" checked={numOn} onChange={(e) => { setNumOn(e.target.checked); reset() }} /> {t('Page numbers')}
            </label>
            <div className="field">
              <label htmlFor="nf">{t('Format')}</label>
              <select id="nf" value={format} disabled={!numOn} onChange={(e) => { setFormat(e.target.value); reset() }}>
                <option value="{n}">1</option>
                <option value="Page {n}">Page 1</option>
                <option value="Page {n} of {total}">Page 1 of 10</option>
                <option value="{n} / {total}">1 / 10</option>
                <option value="- {n} -">- 1 -</option>
              </select>
            </div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="nv">{t('Vertical position')}</label>
                <select id="nv" value={vertical} disabled={!numOn} onChange={(e) => { setVertical(e.target.value as NumberOptions['vertical']); reset() }}>
                  <option value="bottom">{t('Bottom')}</option>
                  <option value="top">{t('Top')}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="nh">{t('Horizontal position')}</label>
                <select id="nh" value={horizontal} disabled={!numOn} onChange={(e) => { setHorizontal(e.target.value as NumberOptions['horizontal']); reset() }}>
                  <option value="left">{t('Left')}</option>
                  <option value="center">{t('Center')}</option>
                  <option value="right">{t('Right')}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="ns">{t('Start at')}</label>
                <input id="ns" type="number" min={0} value={start} disabled={!numOn} onChange={(e) => { setStart(Math.floor(+e.target.value) || 0); reset() }} />
              </div>
              <div className="field">
                <label htmlFor="nz">{t('Font size')}</label>
                <input id="nz" type="number" min={6} max={48} value={numSize} disabled={!numOn} onChange={(e) => { setNumSize(Math.max(6, +e.target.value || 6)); reset() }} />
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={skipFirst} disabled={!numOn} onChange={(e) => { setSkipFirst(e.target.checked); reset() }} /> {t('Skip the first page (cover)')}
            </label>
          </Section>
          <Section>
            <div className="row">
              <button className="primary" disabled={!wmOn && !numOn} onClick={run}>
                {t('Apply')}
              </button>
            </div>
            <ErrorBox error={err} />
            {out && (
              <>
                <ResultBar name={`${baseName(file.name)}-stamped.pdf`} data={out} />
                <PdfPreview data={out} />
              </>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}
