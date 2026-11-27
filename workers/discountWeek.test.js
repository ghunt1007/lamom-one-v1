import { describe, it, expect } from 'vitest'
import { discountWeekLine } from './daily-report.js'

const T = '2026-11-20'
const bk = (d, extra, sales = 'เอ') => ({ bookingDate: d, model: 'ATTO 3', price: '1,099,000', extraDiscount: extra, salesName: sales, status: 'รอรถ' })
describe('discountWeekLine (v1.0.1445)', () => {
  it('avg + this-month outliers with seller, null without data', () => {
    const rows = [bk('2026-09-01', 10000), bk('2026-09-05', 10000), bk('2026-10-01', 12000), bk('2026-10-02', 8000), bk('2026-10-04', 10000), bk('2026-11-02', 50000, 'บี')]
    expect(discountWeekLine(rows, T)).toBe('💸 ส่วนลดเพิ่มเติม 6 เดือน เฉลี่ย ฿16,667/คัน · ⚠️ เดือนนี้เกินปกติ 1 ใบ (บี)')
    expect(discountWeekLine(rows.map(r => ({ ...r, extraDiscount: '' })), T)).toBeNull()
    expect(discountWeekLine([], T)).toBeNull()
  })
})
