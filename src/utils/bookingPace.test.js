import { describe, it, expect } from 'vitest'
import { bookingPace, paceNote } from './bookingPace.js'

const days = (ym, list) => list.map(d => `${ym}-${String(d).padStart(2, '0')}`)

describe('bookingPace', () => {
  it('ประวัติไม่พอ → เส้นตรง', () => {
    const p = bookingPace(days('2026-11', [1, 2, 3, 4, 5]), '2026-11-10')
    expect(p.method).toBe('linear')
    expect(p.expected).toBe(15)
  })
  it('ร้านจองหนักปลายเดือน → คาดสูงกว่าเส้นตรง', () => {
    // 3 เดือนก่อน: 2 ใบช่วงต้น (≤ วันที่ 10) + 8 ใบปลายเดือน
    const hist = ['2026-08', '2026-09', '2026-10'].flatMap(ym => days(ym, [3, 8, 22, 24, 25, 26, 27, 28, 29, 30]))
    const p = bookingPace([...hist, ...days('2026-11', [2, 9])], '2026-11-10')
    expect(p.method).toBe('history')
    expect(p.linear).toBe(6)
    expect(p.share).toBeCloseTo(0.2)
    expect(p.expected).toBe(10)
    expect(p.low).toBeLessThanOrEqual(p.expected)
    expect(p.high).toBeGreaterThanOrEqual(p.expected)
    expect(paceNote(p)).toContain('20%')
  })
  it('ไม่นับใบที่ลงวันที่ล่วงหน้าเกินวันนี้ และไม่ต่ำกว่าที่จองแล้ว', () => {
    const hist = ['2026-08', '2026-09', '2026-10'].flatMap(ym => days(ym, [1, 2, 3, 4]))
    const p = bookingPace([...hist, ...days('2026-11', [1, 2, 3, 4, 5, 6, 25])], '2026-11-20')
    expect(p.soFar).toBe(6)
    expect(p.expected).toBeGreaterThanOrEqual(6)
  })
  it('ยังไม่มีใบเดือนนี้ + ช่วงต้นเดือนก่อนๆ ว่าง → ใช้ค่าเฉลี่ยส่วนที่เหลือ', () => {
    const hist = ['2026-08', '2026-09', '2026-10'].flatMap(ym => days(ym, [20, 21, 22, 23]))
    const p = bookingPace(hist, '2026-11-05')
    expect(p.expected).toBe(4)
  })
  it('วันสุดท้ายของเดือน = ยอดจริง', () => {
    const p = bookingPace(days('2026-11', [1, 30]), '2026-11-30')
    expect(p.method).toBe('done'); expect(p.expected).toBe(2)
  })
})
