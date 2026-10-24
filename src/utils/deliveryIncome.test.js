import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ updateDocData: vi.fn() }))
const { calcIncome, needsIncome } = await import('./deliveryIncome.js')

describe('calcIncome', () => {
  it('uses the booking form formula: (margin − marketing budget) + sales com + finance com', () => {
    expect(calcIncome({ margin: 30000, budgetUsed: 5000, com70: 7000, comFinance: 3000 }))
      .toEqual({ margin: 30000, budgetUsed: 5000, com70: 7000, comFinance: 3000, marginLeft: 25000, totalIncome: 35000 })
  })
  it('treats blank or text inputs from the form as 0', () => {
    expect(calcIncome({ margin: '12000', budgetUsed: '', com70: undefined, comFinance: 'abc' }).totalIncome).toBe(12000)
    expect(calcIncome().totalIncome).toBe(0)
  })
})

describe('needsIncome', () => {
  it('flags delivered or cut bookings with no income, like the daily report does', () => {
    expect(needsIncome({ status: 'ส่งมอบแล้ว', totalIncome: 0 })).toBe(true)
    expect(needsIncome({ status: 'ตัดตัวเลขรอส่งมอบ' })).toBe(true)
  })
  it('skips bookings that already have income, are not delivered yet, or were deleted', () => {
    expect(needsIncome({ status: 'ส่งมอบแล้ว', totalIncome: 15000 })).toBe(false)
    expect(needsIncome({ status: 'รอส่งมอบ', totalIncome: 0 })).toBe(false)
    expect(needsIncome({ status: 'ส่งมอบแล้ว', totalIncome: 0, deleted: true })).toBe(false)
    expect(needsIncome(null)).toBe(false)
  })
})
