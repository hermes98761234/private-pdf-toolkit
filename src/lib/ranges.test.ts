import { describe, expect, it } from 'vitest'
import { everyN, formatRanges, parseRanges } from './ranges'

const groups = (s: string, n = 10) => {
  const r = parseRanges(s, n)
  if (!r.ok) throw new Error(r.error.msg)
  return r.groups
}

describe('parseRanges', () => {
  it('parses single pages and ranges into groups', () => {
    expect(groups('1-3, 5')).toEqual([[1, 2, 3], [5]])
  })
  it('supports open ends', () => {
    expect(groups('8-')).toEqual([[8, 9, 10]])
    expect(groups('-3')).toEqual([[1, 2, 3]])
  })
  it('accepts spaces, semicolons and en dashes', () => {
    expect(groups(' 2 – 3 ; 7 ')).toEqual([[2, 3], [7]])
  })
  it('rejects out-of-range pages', () => {
    const r = parseRanges('1-11', 10)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.args).toEqual([11, 10])
    expect(parseRanges('0', 10).ok).toBe(false)
  })
  it('rejects reversed ranges, junk and empty input', () => {
    expect(parseRanges('5-2', 10).ok).toBe(false)
    expect(parseRanges('abc', 10).ok).toBe(false)
    expect(parseRanges('1--2', 10).ok).toBe(false)
    expect(parseRanges('-', 10).ok).toBe(false)
    expect(parseRanges('  ', 10).ok).toBe(false)
  })
})

describe('everyN', () => {
  it('splits with a shorter last group', () => {
    expect(everyN(7, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
  })
  it('treats n < 1 as 1 and n > total as one group', () => {
    expect(everyN(2, 0)).toEqual([[1], [2]])
    expect(everyN(3, 10)).toEqual([[1, 2, 3]])
  })
})

describe('formatRanges', () => {
  it('collapses consecutive pages', () => {
    expect(formatRanges([5, 1, 2, 3, 3])).toBe('1-3, 5')
    expect(formatRanges([])).toBe('')
  })
})
