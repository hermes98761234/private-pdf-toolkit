import { useEffect, useState } from 'react'
import { ErrorBox, FileDrop, ResultBar, Section } from '../components/common'
import { errText, usePdfFile } from '../components/helpers'
import { useT } from '../i18n'
import { baseName } from '../lib/format'
import { META_KEYS, readMetadata, stripMetadata, writeMetadata, type Bytes, type Metadata as Meta } from '../lib/pdf'

const LABEL: Record<keyof Meta, string> = {
  title: 'Title',
  author: 'Author',
  subject: 'Subject',
  keywords: 'Keywords',
  creator: 'Creator',
  producer: 'Producer',
}

export default function MetadataTool() {
  const t = useT()
  const { file, error, busy, load } = usePdfFile()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<{ name: string; data: Bytes } | null>(null)

  const run = async (kind: 'save' | 'strip') => {
    if (!file || !meta) return
    setErr('')
    try {
      const data = kind === 'strip' ? await stripMetadata(file.bytes) : await writeMetadata(file.bytes, meta)
      setOut({ name: `${baseName(file.name)}-${kind === 'strip' ? 'clean' : 'meta'}.pdf`, data })
      if (kind === 'strip') setMeta(Object.fromEntries(META_KEYS.map((k) => [k, ''])) as Meta)
    } catch (e) {
      setErr(errText(e))
    }
  }

  return (
    <div className="tool">
      <Section title="Metadata editor">
        <p className="hint">{t('See what a PDF reveals about you (author, software, title) and edit or remove it.')}</p>
        <FileDrop
          accept=".pdf,application/pdf"
          label={file ? t('Choose another PDF') : t('Choose a PDF')}
          onFiles={async ([f]) => {
            setOut(null)
            setMeta(null)
            await load(f)
          }}
        />
        <ErrorBox error={error} />
        {busy && <p className="hint">{t('Working…')}</p>}
      </Section>
      {file && <Loader key={file.name + file.bytes.length} bytes={file.bytes} onMeta={setMeta} />}
      {file && meta && (
        <Section>
          <div className="grid2 meta">
            {META_KEYS.map((k) => (
              <div className="field" key={k}>
                <label htmlFor={`m-${k}`}>{t(LABEL[k])}</label>
                <input id={`m-${k}`} value={meta[k]} onChange={(e) => { setMeta({ ...meta, [k]: e.target.value }); setOut(null) }} />
              </div>
            ))}
          </div>
          <p className="hint">{t('Empty fields are removed from the file.')}</p>
          <div className="row">
            <button className="primary" onClick={() => run('save')}>
              {t('Save changes')}
            </button>
            <button className="danger" onClick={() => run('strip')}>
              {t('Remove all metadata')}
            </button>
          </div>
          <ErrorBox error={err} />
          {out && <ResultBar name={out.name} data={out.data} before={file.bytes.length} />}
        </Section>
      )}
    </div>
  )
}

function Loader({ bytes, onMeta }: { bytes: Bytes; onMeta: (m: Meta) => void }) {
  useEffect(() => {
    void readMetadata(bytes).then(onMeta)
  }, [bytes, onMeta])
  return null
}
