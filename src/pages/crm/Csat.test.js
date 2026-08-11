import { describe, it, expect } from 'vitest'
import { npsType, starStr } from './Csat.js'

describe('npsType', () => {
  it('classifies 9-10 as Promoter', () => {
    expect(npsType(9).label).toBe('Promoter')
    expect(npsType(10).label).toBe('Promoter')
  })

  it('classifies 7-8 as Passive', () => {
    expect(npsType(7).label).toBe('Passive')
    expect(npsType(8).label).toBe('Passive')
  })

  it('classifies 0-6 as Detractor', () => {
    expect(npsType(6).label).toBe('Detractor')
    expect(npsType(0).label).toBe('Detractor')
  })
})

describe('starStr', () => {
  it('fills with filled stars up to the score, empty stars for the rest', () => {
    expect(starStr(3, 5)).toBe('★★★☆☆')
  })

  it('shows all filled stars for a perfect score', () => {
    expect(starStr(5, 5)).toBe('★★★★★')
  })

  it('shows all empty stars for a zero score', () => {
    expect(starStr(0, 5)).toBe('☆☆☆☆☆')
  })

  it('defaults max to 5 when not given', () => {
    expect(starStr(2)).toBe('★★☆☆☆')
  })
})
