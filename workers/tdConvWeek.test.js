import { describe, it, expect } from 'vitest'
import { tdConvWeekLine, buildWeeklyReport } from './daily-report.js'

const T = '2026-11-30'
const td = (i, date) => ({ id: 't' + i, customerId: 'c' + i, date, status: 'done', model: 'S07' })

describe('weekly test-drive line (v1.0.1438)', () => {
  it('rate + chase count, null without data', () => {
    const tds = [...Array.from({ length: 10 }, (_, i) => td(i, '2026-09-01')), td(99, '2026-11-25')]
    const line = tdConvWeekLine(tds, [{ customerId: 'c0', bookingDate: '2026-09-05' }, { customerId: 'c1', bookingDate: '2026-09-20' }], [], T)
    expect(line).toBe('🚙 ทดลองขับ: ขับแล้วจองจริง 20% (2/10) · ขับแล้วยังไม่จอง 1 ราย ควรโทรตาม')
    expect(tdConvWeekLine([], [], [], T)).toBeNull()
  })
  it('appears in Monday report', () => {
    const text = buildWeeklyReport({ bookings: [], customers: [], followups: [], testDrives: [td(1, '2026-11-25')] }, { today: T })
    expect(text).toContain('🚙 ทดลองขับ: ขับแล้วยังไม่จอง 1 ราย')
  })
})
