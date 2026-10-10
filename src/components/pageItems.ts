import type { PageSpec } from '../lib/pdf'

export type PageItem = { id: number; spec: PageSpec }

let nextId = 1
export const newItem = (spec: PageSpec): PageItem => ({ id: nextId++, spec })

export const rotateItem = (it: PageItem, by: number): PageItem =>
  it.spec.kind === 'page' ? { ...it, spec: { ...it.spec, rotate: (((it.spec.rotate ?? 0) + by) % 360 + 360) % 360 } } : it

