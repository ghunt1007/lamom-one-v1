import { describe, it, expect } from 'vitest'
import { realSalesStaff, DEMO_SALES_STAFF } from './masterData.js'

describe('realSalesStaff', () => {
  it('keeps names the owner set, minus the old sample names', () => {
    expect(realSalesStaff(['สมชาย จริงใจ', DEMO_SALES_STAFF[0]])).toEqual(['สมชาย จริงใจ'])
  })
  it('falls back to salespeople from real bookings, busiest first', () => {
    const bookings = [{ salesName: 'บี' }, { salesName: 'เอ' }, { salesName: 'บี' }, { salesName: ' ' }, { salesName: 'ซี', deleted: true }, { salesName: DEMO_SALES_STAFF[1] }]
    expect(realSalesStaff(DEMO_SALES_STAFF, bookings)).toEqual(['บี', 'เอ'])
    expect(realSalesStaff([], [])).toEqual([])
  })
})
