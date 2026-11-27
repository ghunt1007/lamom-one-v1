import { describe, it, expect } from 'vitest'
import { discountWatch, discountAnswer, money } from './discountWatch.js'
import { parseOpsSpec } from './opsQuestions.js'

const T = '2026-11-20'
const bk = (d, extra, sales = 'เอ', model = 'ATTO 3') => ({ bookingDate: d, model, price: '1,099,000', extraDiscount: extra, salesName: sales, custName: 'ลูกค้าทดสอบ', status: 'รอรถ' })

describe('discountWatch (v1.0.1443)', () => {
  const rows = [bk('2026-09-01', '10,000'), bk('2026-09-05', 10000), bk('2026-10-01', 12000, 'บี'), bk('2026-10-02', 8000, 'บี'), bk('2026-10-03', 0, 'บี'), bk('2026-10-04', 10000),
    bk('2026-11-02', 50000, 'บี'), bk('2026-11-03', 9000), bk('2026-01-01', 99000), { ...bk('2026-11-04', 90000), status: 'ยกเลิก' }, { ...bk('2026-11-05', 90000), price: '' }]
  it('parses money', () => { expect(money('฿1,200')).toBe(1200); expect(money('x')).toBe(0); expect(money(-5)).toBe(0) })
  it('per-model stats, flags only this-month outliers, skips old/cancelled/no-price', () => {
    const w = discountWatch(rows, T)
    expect(w.n).toBe(8)
    expect(w.models[0]).toMatchObject({ n: 8, median: 10000 })
    expect(w.flags.map(f => f.extra)).toEqual([50000])
    expect(w.bySeller.map(s => s.name)).toEqual([])
  })
  it('null / explain when too few', () => {
    expect(discountWatch(rows.slice(0, 3), T)).toBeNull()
    expect(discountAnswer([], { today: T }).text).toContain('ยังสรุปส่วนลดไม่ได้')
    const t = discountAnswer(rows, { today: T }).text
    expect(t).toContain('⚠️ เดือนนี้ให้ส่วนลดสูงกว่าปกติ 1 ใบ')
    expect(t).toContain('฿50,000 (ปกติ ฿10,000)')
  })
  it('routes discount questions, leaves promo ones', () => {
    for (const q of ['ส่วนลดเฉลี่ยเท่าไหร่', 'ใครให้ส่วนลดเยอะสุด', 'เดือนนี้ให้ส่วนลดเกินไหม']) expect(parseOpsSpec(q)?.kind, q).toBe('discount')
    expect(parseOpsSpec('โปรเดือนนี้มีส่วนลดอะไร')?.kind).not.toBe('discount')
  })
})
