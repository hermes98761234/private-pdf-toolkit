import { useState } from 'react'
import { useT } from '../i18n'
import { move } from '../lib/array'
import type { PdfDoc } from '../lib/render'
import Thumb from './Thumb'
import { rotateItem, type PageItem } from './pageItems'

type Props = {
  items: PageItem[]
  docs: PdfDoc[]
  onChange: (items: PageItem[]) => void
  onInsertBlank?: (afterIndex: number) => void
  thumbWidth?: number
}

/** Draggable grid of page thumbnails with rotate / delete / insert-blank / move buttons. */
export default function PageGrid({ items, docs, onChange, onInsertBlank, thumbWidth = 120 }: Props) {
  const t = useT()
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const put = (i: number, it: PageItem) => onChange(items.map((x, j) => (j === i ? it : x)))

  return (
    <ul className="pagegrid">
      {items.map((it, i) => (
        <li
          key={it.id}
          className={`pcell${drag === i ? ' dragging' : ''}${over === i && drag !== null && drag !== i ? ' target' : ''}`}
          draggable
          onDragStart={(e) => {
            setDrag(i)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', String(i))
          }}
          onDragOver={(e) => {
            if (drag === null) return
            e.preventDefault()
            setOver(i)
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (drag !== null) onChange(move(items, drag, i))
            setDrag(null)
            setOver(null)
          }}
          onDragEnd={() => {
            setDrag(null)
            setOver(null)
          }}
        >
          <div className="pthumb" style={{ width: thumbWidth, minHeight: thumbWidth * 1.3 }}>
            {it.spec.kind === 'page' ? (
              <Thumb doc={docs[it.spec.src]} index={it.spec.index} width={thumbWidth} rotate={it.spec.rotate ?? 0} />
            ) : (
              <div className="blank" style={{ width: thumbWidth, height: (thumbWidth * it.spec.height) / it.spec.width }}>
                {t('Blank')}
              </div>
            )}
          </div>
          <div className="plabel">{i + 1}</div>
          <div className="pbtns">
            <button className="small" title={t('Move earlier')} aria-label={t('Move earlier')} disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}>
              ◀
            </button>
            {it.spec.kind === 'page' && (
              <>
                <button className="small" title={t('Rotate left')} aria-label={t('Rotate left')} onClick={() => put(i, rotateItem(it, -90))}>
                  ↺
                </button>
                <button className="small" title={t('Rotate right')} aria-label={t('Rotate right')} onClick={() => put(i, rotateItem(it, 90))}>
                  ↻
                </button>
              </>
            )}
            {onInsertBlank && (
              <button className="small" title={t('Insert blank page after')} aria-label={t('Insert blank page after')} onClick={() => onInsertBlank(i)}>
                +
              </button>
            )}
            <button className="small danger" title={t('Delete page')} aria-label={t('Delete page')} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ✕
            </button>
            <button className="small" title={t('Move later')} aria-label={t('Move later')} disabled={i === items.length - 1} onClick={() => onChange(move(items, i, i + 1))}>
              ▶
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
