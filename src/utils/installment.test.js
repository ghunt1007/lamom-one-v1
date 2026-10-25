import { describe, it, expect } from 'vitest'
import { flatMonthly } from './installment.js'

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
