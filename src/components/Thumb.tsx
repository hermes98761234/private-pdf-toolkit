import { useEffect, useRef, useState } from 'react'
import { limited, renderPage, type PdfDoc } from '../lib/render'

type Props = { doc: PdfDoc; index: number; width?: number; rotate?: number }

/** Lazily rendered page thumbnail. `rotate` is extra clockwise rotation in degrees. */
export default function Thumb({ doc, index, width = 120, rotate = 0 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true)
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let dead = false
    void limited(async () => {
      if (dead || !canvas.current) return
      const page = await doc.getPage(index + 1)
      const base = page.getViewport({ scale: 1, rotation: (page.rotate + rotate + 360) % 360 })
      const scale = (width * Math.min(2, window.devicePixelRatio || 1)) / base.width
      await renderPage(doc, index, canvas.current, scale, rotate, () => dead)
    }).catch(() => {})
    return () => {
      dead = true
    }
  }, [visible, doc, index, width, rotate])

  return (
    <div ref={box} className="thumb" style={{ width }}>
      <canvas ref={canvas} style={{ width: '100%' }} />
    </div>
  )
}
