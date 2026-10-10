import { expect, it } from 'vitest'
import { UK } from './i18n'

const holes = (s: string) => [...s.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort().join()

it('keeps placeholders identical in every translation', () => {
  for (const [en, uk] of Object.entries(UK)) expect(holes(uk), en).toBe(holes(en))
})
