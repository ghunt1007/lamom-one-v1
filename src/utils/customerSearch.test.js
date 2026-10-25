import { describe, it, expect } from 'vitest'
import { matchesSearch, searchTokens } from './customerSearch.js'

const c = { firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678', lineId: '@somchai', interestedModel: 'DEEPAL S07', assignedTo: 'เซลส์ เอ' }

describe('matchesSearch', () => {
  it('empty query matches', () => { expect(matchesSearch(c, '  ')).toBe(true) })
  it('all words must match', () => {
    expect(matchesSearch(c, 's07 สมชาย')).toBe(true)
    expect(matchesSearch(c, 's05 สมชาย')).toBe(false)
  })
  it('phone with dashes or spaces', () => {
    expect(matchesSearch(c, '081-234')).toBe(true)
    expect(matchesSearch(c, '081 234 5678')).toBe(true)
    expect(matchesSearch(c, '+66812345678')).toBe(true)
    expect(matchesSearch(c, '099')).toBe(false)
  })
  it('line id, salesperson', () => {
    expect(matchesSearch(c, '@SOMCHAI')).toBe(true)
    expect(matchesSearch(c, 'เซลส์ เอ')).toBe(true)
  })
  it('tokens', () => { expect(searchTokens(' A  b ')).toEqual(['a', 'b']) })
})
