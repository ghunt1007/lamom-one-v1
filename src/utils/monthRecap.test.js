import { describe, it, expect } from 'vitest'
import { monthRecap, monthRecapLines, thMonthLabel } from './monthRecap.js'

const B = [
  { bookingDate: '2026-11-03', status: 'ส่งมอบแล้ว', cutDate: '2026-11-20' },
  { bookingDate: '2026-11-05', status: 'ส่งมอบแล้ว', cutDate: '2026-11-28' },
  { bookingDate: '2026-11-09', status: 'รอรถ' },
  { bookingDate: '2026-11-10', status: 'ถอนจอง' },
  { bookingDate: '2026-10-10', status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-11-02' },
]
const logs = [
  { date: '2026-11-10', expected: 5, worst: 3, best: 7 },
  { date: '2026-11-19', expected: 3.4, worst: 2, best: 5, bk_exp: 4, bk_lo: 3, bk_hi: 6 },
  { date: '2026-11-26', expected: 3, worst: 3, best: 4, bk_exp: 3 },
]

describe('monthRecap (v1.0.1406)', () => {
  it('วันที่ 1: เทียบที่คาดไว้ใกล้วันที่ 20 กับยอดจริง', () => {
    const r = monthRecap({ bookings: B, logs, today: '2026-12-01' })
    expect(r.label).toBe('พ.ย. 2569')
    expect(r.delivered).toBe(3)
    expect(r.booked).toBe(3)
    expect(r.dlv).toMatchObject({ day: 19, expected: 3, worst: 2, best: 5 })
    expect(r.dlv.verdict).toContain('✅')
    const t = monthRecapLines(r).join('\n')
    expect(t).toContain('สรุปเดือน พ.ย. 2569: ส่งมอบ 3 คัน · จองใหม่ 3 ใบ')
    expect(t).toContain('คาดไว้ (วันที่ 19) ≈ 4 ใบ (3–6)')
  })
  it('หลุดช่วง → ⚠️', () => {
    const r = monthRecap({ bookings: B, logs: [{ date: '2026-11-20', expected: 9, worst: 8, best: 11 }], today: '2026-12-02' })
    expect(r.dlv.verdict).toContain('น้อยกว่า')
    expect(r.bk).toBeNull()
  })
  it('วันอื่นไม่ขึ้น · ไม่มี log บอกแค่ยอดจริง', () => {
    expect(monthRecap({ bookings: B, logs, today: '2026-12-03' })).toBeNull()
    expect(monthRecapLines(monthRecap({ bookings: B, logs: [], today: '2026-12-01' }))).toHaveLength(1)
  })
  it('ป้ายเดือน', () => { expect(thMonthLabel('2027-01')).toBe('ม.ค. 2570') })
})
