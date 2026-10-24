import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ updateDocData: vi.fn() }))
const { summarizeSalesIncome, lastMonths } = await import('./salesIncome.js')

describe('summarizeSalesIncome', () => {
  const bookings = [
    { salesName: 'วิชัย', status: 'ส่งมอบแล้ว', cutDate: '2026-10-05', bookingDate: '2026-09-20', margin: 30000, budgetUsed: 5000, marginLeft: 25000, com70: 7000, comFinance: 3000, totalIncome: 35000 },
    { salesName: 'วิชัย', status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-10-10', bookingDate: '2026-10-01', totalIncome: 0 },
    { salesName: 'วิชัย', status: 'ยอดจองคงค้าง', bookingDate: '2026-10-12' },
    { salesName: 'นภา', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-10-20', bookingDate: '2026-10-02', marginLeft: 50000, com70: 8000, totalIncome: 58000 },
    { salesName: 'นภา', status: 'ถอนจอง', bookingDate: '2026-10-03' },
    { salesName: 'นภา', status: 'ส่งมอบแล้ว', cutDate: '2026-09-28', totalIncome: 99999 },
    { salesName: 'ลบ', status: 'ส่งมอบแล้ว', cutDate: '2026-10-01', totalIncome: 1, deleted: true },
  ]

  it('adds up delivered income per salesperson for the month, richest first', () => {
    const { rows, total } = summarizeSalesIncome(bookings, '2026-10')
    expect(rows.map(r => r.name)).toEqual(['นภา', 'วิชัย'])
    expect(rows[0]).toMatchObject({ booked: 1, delivered: 1, income: 58000, marginLeft: 50000, com70: 8000, missing: 0 })
    expect(rows[1]).toMatchObject({ booked: 2, delivered: 2, income: 35000, com70: 7000, comFinance: 3000, missing: 1 })
    expect(rows[1].cars).toHaveLength(2)
    expect(total).toMatchObject({ booked: 3, delivered: 3, income: 93000, missing: 1 })
  })

  it('ignores cancelled bookings, other months and deleted records', () => {
    const { rows } = summarizeSalesIncome(bookings, '2026-10')
    expect(rows.find(r => r.name === 'ลบ')).toBeUndefined()
    expect(rows.find(r => r.name === 'นภา').income).toBe(58000)
  })
})

describe('lastMonths', () => {
  it('lists recent months newest first across a year boundary', () => {
    expect(lastMonths('2026-02', 4)).toEqual(['2026-02', '2026-01', '2025-12', '2025-11'])
  })
})

describe('summarizeSalesIncome — ถอนจอง', () => {
  it('นับถอนจองตามวันถอนในเดือนนั้น', async () => {
    const { summarizeSalesIncome } = await import('./salesIncome.js')
    const { rows, total } = summarizeSalesIncome([
      { status: 'ถอนจอง', salesName: 'A', bookingDate: '2026-09-20', cancelDate: '2026-10-03' },
      { status: 'ยกเลิก', salesName: 'A', bookingDate: '2026-10-05' },
      { status: 'ถอนจอง', salesName: 'B', bookingDate: '2026-10-01', cancelDate: '2026-11-01' },
    ], '2026-10')
    expect(rows.find(r => r.name === 'A')).toMatchObject({ cancelled: 2, booked: 0 })
    expect(total.cancelled).toBe(2)
  })
})
