import { describe, it, expect } from 'vitest'
import { numOr } from './numInput.js'
describe('numOr', () => {
  it('keeps zero, defaults only blank/invalid', () => {
    expect(numOr('0', 2.99)).toBe(0)
    expect(numOr('', 2.99)).toBe(2.99)
    expect(numOr(undefined, 5)).toBe(5)
    expect(numOr('1,500', 0)).toBe(1500)
    expect(numOr('abc', 7)).toBe(7)
  })
})
