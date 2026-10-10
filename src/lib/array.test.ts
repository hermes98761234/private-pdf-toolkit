import { expect, it } from 'vitest'
import { move } from './array'

it('moves items forwards and backwards without mutating', () => {
  const a = [1, 2, 3, 4]
  expect(move(a, 0, 2)).toEqual([2, 3, 1, 4])
  expect(move(a, 3, 0)).toEqual([4, 1, 2, 3])
  expect(move(a, 1, 1)).toEqual([1, 2, 3, 4])
  expect(move(a, 9, 0)).toEqual([1, 2, 3, 4])
  expect(a).toEqual([1, 2, 3, 4])
})
