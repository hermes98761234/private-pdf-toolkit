import { useMemo, useState } from 'react'
import { ErrorBox, FileDrop, ResultBar, Section } from '../components/common'
import { errText, usePdfFile } from '../components/helpers'
import PageGrid from '../components/PageGrid'
import { newItem, type PageItem } from '../components/pageItems'
import { useT } from '../i18n'
import { baseName } from '../lib/format'
import { buildPdf, type Bytes } from '../lib/pdf'
import { blankLike } from '../lib/render'

export default function Organize() {
  const t = useT()
  const { file, error, busy, load, clear } = usePdfFile()
  const [edited, setEdited] = useState<PageItem[] | null>(null)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<Bytes | null>(null)
  const derived = useMemo(
    () => (file ? Array.from({ length: file.pages }, (_, index) => newItem({ kind: 'page', src: 0, index })) : []),
    [file],
  )
  const items = edited ?? derived
  const change = (n: PageItem[]) => {
    setEdited(n)
    setOut(null)
  }

  const save = async () => {
    if (!file) return
    setErr('')
    try {
      setOut(await buildPdf([file.bytes], items.map((i) => i.spec)))
    } catch (e) {
      setErr(errText(e))
    }
  }

  return (
    <div className="tool">
      <Section title="Organize pages">
        <p className="hint">{t('Rotate, delete, reorder pages or insert blank ones. Drag a page to move it.')}</p>
        <FileDrop
          accept=".pdf,application/pdf"
          label={file ? t('Choose another PDF') : t('Choose a PDF')}
          onFiles={async ([f]) => {
            setEdited(null)
            setOut(null)
            await load(f)
          }}
        />
        <ErrorBox error={error || err} />
        {busy && <p className="hint">{t('Working…')}</p>}
      </Section>
      {file && (
        <Section>
          <div className="row">
            <b className="fname">{file.name}</b>
            <span className="hint">
              {items.length} {t('pages')}
            </span>
            <span className="spacer" />
            <button onClick={() => change(derived)}>{t('Reset')}</button>
            <button onClick={clear}>{t('Close')}</button>
            <button
              onClick={async () => {
                const prev = items[items.length - 1]?.spec
                change([...items, newItem(await blankLike([file.doc], prev?.kind === 'page' ? prev : undefined))])
              }}
            >
              {t('Add blank page at end')}
            </button>
            <button className="primary" disabled={items.length === 0} onClick={save}>
              {t('Apply')}
            </button>
          </div>
          <PageGrid
            items={items}
            docs={[file.doc]}
            onChange={change}
            onInsertBlank={async (after) => {
              const prev = items[after]?.spec
              const blank = await blankLike([file.doc], prev?.kind === 'page' ? prev : undefined)
              const next = [...items]
              next.splice(after + 1, 0, newItem(blank))
              change(next)
            }}
          />
          {out && <ResultBar name={`${baseName(file.name)}-organized.pdf`} data={out} before={file.bytes.length} />}
        </Section>
      )}
    </div>
  )
}
