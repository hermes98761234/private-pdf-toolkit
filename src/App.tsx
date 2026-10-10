import { useEffect, useState } from 'react'
import { LangContext, tr, type Lang } from './i18n'
import { TOOLS, loadSettings, saveSettings, type Settings, type Theme, type ToolId } from './settings'
import Compress from './tools/Compress'
import Images from './tools/Images'
import Merge from './tools/Merge'
import MetadataTool from './tools/Metadata'
import Organize from './tools/Organize'
import Sign from './tools/Sign'
import Split from './tools/Split'
import Watermark from './tools/Watermark'

const NAMES: Record<ToolId, string> = {
  merge: 'Merge',
  split: 'Split',
  organize: 'Organize',
  sign: 'Sign',
  compress: 'Compress',
  watermark: 'Watermark & numbers',
  metadata: 'Metadata',
  images: 'Images to PDF',
}
const VIEWS: Record<ToolId, () => React.JSX.Element> = {
  merge: Merge,
  split: Split,
  organize: Organize,
  sign: Sign,
  compress: Compress,
  watermark: Watermark,
  metadata: MetadataTool,
  images: Images,
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const { lang, theme, tool } = settings
  const t = (s: string, ...a: (string | number)[]) => tr(lang, s, ...a)
  const set = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }))

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = theme
    root.lang = lang
  }, [theme, lang])

  const View = VIEWS[tool]

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <header className="toolbar">
          <span className="brand">{t('Private PDF toolkit')}</span>
          <span className="hint grow">{t('Merge, split, sign and compress PDFs. Your files never leave this device.')}</span>
          <select aria-label={t('Language')} value={lang} onChange={(e) => set({ lang: e.target.value as Lang })}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
          <select aria-label={t('Theme')} value={theme} onChange={(e) => set({ theme: e.target.value as Theme })}>
            <option value="auto">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </header>
        <nav className="tabs" aria-label={t('Tools')}>
          {TOOLS.map((id) => (
            <button key={id} className={id === tool ? 'on' : ''} aria-current={id === tool ? 'page' : undefined} onClick={() => set({ tool: id })}>
              {t(NAMES[id])}
            </button>
          ))}
        </nav>
        <main className="main">
          <View key={tool} />
        </main>
        <p className="hint foot">
          {t('Everything runs in your browser. No uploads, no tracking, works offline.')}{' '}
          <a href="https://github.com/hermes98761234/private-pdf-toolkit">{t('Source on GitHub')}</a>
        </p>
      </div>
    </LangContext.Provider>
  )
}
