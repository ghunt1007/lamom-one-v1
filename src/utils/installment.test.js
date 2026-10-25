import { describe, it, expect } from 'vitest'
import { flatMonthly, replanOptions, replanText } from './installment.js'

describe('flatMonthly', () => {
  it('computes Thai flat-rate installments', () => {
    // 799,000 ดาวน์ 20% = 159,800 · ยอดจัด 639,200 · ดอก 2.79% × 5 ปี = 89,168.4 → (639,200+89,168.4)/60
    expect(flatMonthly(799000, 20, 60, 2.79)).toEqual({ down: 159800, loan: 639200, monthly: 12139 })
  })
  it('handles zero/blank input', () => {
    expect(flatMonthly(0, 20, 60, 3).monthly).toBe(0)
    expect(flatMonthly(100000, 0, 10, 0).monthly).toBe(10000)
  })
})

describe('replanOptions', () => {
  it('offers bigger down payments than the current one', () => {
    const r = replanOptions(1000000, 150000, 3)
    expect(r.map(x => x.pct)).toEqual([25, 30, 40])
    expect(r[0]).toMatchObject({ down: 250000, loan: 750000, more: 100000 })
    // 750000 + 750000*3%*6 = 885000 / 72
    expect(r[0].m72).toBe(Math.round(885000 / 72))
    expect(replanText(r, 3)).toContain('ดาวน์ 25%')
  })
  it('empty when no price or already high down', () => {
    expect(replanOptions(0, 0)).toEqual([])
    expect(replanOptions(100, 60)).toEqual([])
  })
})
