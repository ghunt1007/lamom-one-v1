import { describe, it, expect } from 'vitest'
import { turnover, marginPct, classify } from './PartsAnalytics.js'

describe('turnover', () => {
  it('computes times-sold-per-month from 90-day sales and current stock', () => {
    // sold90=90 over stock=10 → (90/3)/10 = 3.0x/month
    expect(turnover({ sold90: 90, stock: 10 })).toBe(3)
  })

  it('returns 0 when stock is 0 (avoids divide-by-zero)', () => {
    expect(turnover({ sold90: 50, stock: 0 })).toBe(0)
  })

  it('rounds to 1 decimal place', () => {
    expect(turnover({ sold90: 22, stock: 15 })).toBe(0.5)
  })
})

describe('marginPct', () => {
  it('computes gross margin percentage', () => {
    expect(marginPct({ price: 100, cost: 60 })).toBe(40)
  })

  it('rounds to the nearest integer', () => {
    expect(marginPct({ price: 380, cost: 200 })).toBe(47)
  })
})

describe('classify', () => {
  it('classifies as dead stock when days-in-stock exceeds 120, regardless of turnover', () => {
    expect(classify({ sold90: 90, stock: 10, daysInStock: 160 })).toBe('dead')
  })

  it('classifies as fast-moving when turnover >= 1 and not dead', () => {
    expect(classify({ sold90: 84, stock: 20, daysInStock: 12 })).toBe('fast')
  })

  it('classifies as slow-moving when turnover < 1 and not dead', () => {
    expect(classify({ sold90: 22, stock: 15, daysInStock: 40 })).toBe('slow')
  })
})
