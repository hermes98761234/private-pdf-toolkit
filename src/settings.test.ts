import { expect, it } from 'vitest'
import { parseSettings } from './settings'
import { tr } from './i18n'

it('falls back to defaults on junk', () => {
  expect(parseSettings('{{{').theme).toBe('auto')
  expect(parseSettings(JSON.stringify({ lang: 'xx', theme: 'dark', tool: 'nope' }))).toMatchObject({ theme: 'dark', tool: 'merge' })
  expect(parseSettings(JSON.stringify({ lang: 'uk', tool: 'sign' }))).toMatchObject({ lang: 'uk', tool: 'sign' })
})

it('interpolates placeholders and falls back to English', () => {
  expect(tr('en', 'Page {0} of {1}', 2, 5)).toBe('Page 2 of 5')
  expect(tr('uk', 'Not translated {0}', 1)).toBe('Not translated 1')
})
