import { describe, it, expect } from 'vitest'
import { avgIncomePerCar, campaignRoiPct } from './campaignRoi.js'

describe('campaignRoi', () => {
  it('averages real income of sold cars only', () => {
    expect(avgIncomePerCar([{ delivered: true, totalIncome: 30000 }, { delivered: true, totalIncome: 50000 }, { delivered: false, totalIncome: 90000 }, { delivered: true, totalIncome: 0 }])).toBe(40000)
    expect(avgIncomePerCar([])).toBe(null)
  })
  it('ROI is null without spend or without known income', () => {
    expect(campaignRoiPct({ spent: 10000, sales: 1 }, 40000)).toBe(300)
    expect(campaignRoiPct({ spent: 0, sales: 1 }, 40000)).toBe(null)
    expect(campaignRoiPct({ spent: 10000, sales: 1 }, null)).toBe(null)
  })
})
