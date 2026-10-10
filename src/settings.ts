import type { Lang } from './i18n'

export type Theme = 'auto' | 'light' | 'dark'
export type ToolId = 'merge' | 'split' | 'organize' | 'sign' | 'compress' | 'watermark' | 'metadata' | 'images'
export type Settings = { lang: Lang; theme: Theme; tool: ToolId }

export const TOOLS: ToolId[] = ['merge', 'split', 'organize', 'sign', 'compress', 'watermark', 'metadata', 'images']
const KEY = 'private-pdf-toolkit:settings'

export function defaults(): Settings {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return { lang: nav.toLowerCase().startsWith('uk') ? 'uk' : 'en', theme: 'auto', tool: 'merge' }
}

export function parseSettings(raw: string | null): Settings {
  const d = defaults()
  if (!raw) return d
  try {
    const o = JSON.parse(raw) as Partial<Settings>
    return {
      lang: o.lang === 'uk' || o.lang === 'en' ? o.lang : d.lang,
      theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'auto' ? o.theme : d.theme,
      tool: TOOLS.includes(o.tool as ToolId) ? (o.tool as ToolId) : d.tool,
    }
  } catch {
    return d
  }
}

export const loadSettings = (): Settings => {
  try {
    return parseSettings(localStorage.getItem(KEY))
  } catch {
    return defaults()
  }
}

export const saveSettings = (s: Settings) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}
