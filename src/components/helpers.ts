import { useCallback, useState } from 'react'
import { loadPdf, type Bytes } from '../lib/pdf'
import { openDoc, destroyDoc, type PdfDoc } from '../lib/render'

export function download(name: string, data: Uint8Array<ArrayBuffer>, mime = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export type LoadedPdf = { name: string; bytes: Bytes; doc: PdfDoc; pages: number }

export async function readPdfFile(f: File): Promise<LoadedPdf> {
  const bytes = new Uint8Array(await f.arrayBuffer())
  const pages = (await loadPdf(bytes)).getPageCount() // friendly error for damaged/encrypted files
  return { name: f.name, bytes, doc: await openDoc(bytes), pages }
}

/** Holds one opened PDF. */
export function usePdfFile() {
  const [file, setFile] = useState<LoadedPdf | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async (f: File) => {
    setBusy(true)
    setError('')
    try {
      const loaded = await readPdfFile(f)
      setFile((old) => {
        if (old) destroyDoc(old.doc)
        return loaded
      })
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }, [])
  const clear = useCallback(() => {
    setFile((old) => {
      if (old) destroyDoc(old.doc)
      return null
    })
    setError('')
  }, [])
  return { file, error, busy, load, clear }
}

