import { describe, it, expect } from 'vitest'
import { bookingDataIssues, issueCount, rowLabel } from './bookingDataCheck.js'

const T = '2026-11-16'
const ok = { bookingNo: 'B1', status: 'รอรถ', salesName: 'แอน', bookingDate: '2026-11-01', price: 999000, phone: '081-234-5678' }
const keys = r => r.map(i => i.key)

describe('bookingDataIssues (v1.0.1164)', () => {
  it('clean bookings → nothing', () => {
    expect(bookingDataIssues([ok, { ...ok, bookingNo: 'B2', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-11-10' }], { today: T })).toEqual([])
  })
  it('delivered/cut without a date is the first (most important) issue', () => {
    const r = bookingDataIssues([{ ...ok, status: 'ตัดตัวเลขรอส่งมอบ' }], { today: T })
    expect(keys(r)).toEqual(['noDeliveredDate'])
    expect(r[0].col).toContain('วันที่ตัดตัวเลข')
  })
  it('missing sales / booking date / price, bad status, bad phone', () => {
    const r = bookingDataIssues([{ ...ok, salesName: '', bookingDate: '', price: 0, status: 'รอส่งมอบ ', phone: '12345' }], { today: T })
    expect(keys(r)).toEqual(['noSales', 'noBookingDate', 'badStatus', 'noPrice', 'badPhone'])
  })
  it('future dates (year typo) and duplicate booking numbers', () => {
    const r = bookingDataIssues([{ ...ok, bookingDate: '2027-11-01' }, { ...ok }], { today: T })
    expect(keys(r)).toEqual(['futureDate', 'dupNo'])
    expect(r[1].rows).toHaveLength(2)
  })
  it('cancelled and deleted rows are mostly ignored', () => {
    expect(bookingDataIssues([{ status: 'ถอนจอง', bookingNo: 'X' }, { ...ok, deleted: true, salesName: '' }], { today: T })).toEqual([])
  })
  it('helpers', () => {
    expect(issueCount([{ rows: [1, 2] }, { rows: [3] }])).toBe(3)
    expect(rowLabel({ bookingNo: 'B9', custName: 'มานี', salesName: 'แอน' })).toBe('#B9 มานี (แอน)')
    expect(rowLabel({})).toBe('ใบจองไม่มีเลข')
  })
})
