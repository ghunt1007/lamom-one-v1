import { describe, it, expect } from 'vitest'
import { parseStockSpec, stockAnswer, maybeStockQuestion } from './stockQuestions.js'
import { isMonthQuestion } from './monthBrief.js'
import { isTodayQuestion } from './todayBrief.js'
import { parseListSpec } from './listQuestions.js'
import { parseBookingListSpec } from './bookingQuestions.js'

const today = '2026-11-11'
const vs = [
  { brand: 'DEEPAL', model: 'DEEPAL S07', color: 'ขาว', status: 'available', arrivedAt: '2026-07-01', vin: 'SECRETVIN1', cost: 1 },
  { brand: 'DEEPAL', model: 'DEEPAL S07', color: 'ขาว', status: 'available', arrivedAt: '2026-11-01' },
  { brand: 'DEEPAL', model: 'DEEPAL S07', color: 'ดำ', status: 'available', arrivedAt: '2026-10-20' },
  { brand: 'DEEPAL', model: 'DEEPAL S07', color: 'เทา', status: 'transit' },
  { brand: 'DEEPAL', model: 'DEEPAL S07', color: 'ขาว', status: 'reserved' },
  { brand: 'AION', model: 'AION V', color: 'ดำ', status: 'available', arrivedAt: '2026-11-05' },
  { brand: 'AION', model: 'AION V', color: 'ขาว', status: 'sold' },
  { brand: 'AION', model: 'AION V', color: 'ขาว', status: 'available', deleted: true },
]

describe('parseStockSpec', () => {
  it('finds model, brand, colour from real stock', () => {
    expect(parseStockSpec('S07 สีขาวมีไหม', vs)).toEqual({ model: 'DEEPAL S07', brand: '', color: 'ขาว', aged: false })
    expect(parseStockSpec('aion v เหลือกี่คัน?', vs)).toMatchObject({ model: 'AION V', color: '' })
    expect(parseStockSpec('deepal มีรถพร้อมขายไหม', vs)).toMatchObject({ model: '', brand: 'DEEPAL' })
    expect(parseStockSpec('มีรถอะไรพร้อมขาย', vs)).toEqual({ model: '', brand: '', color: '', aged: false })
    expect(parseStockSpec('รถค้างสต็อกนานมีคันไหน', vs)).toMatchObject({ aged: true })
    expect(parseStockSpec('มีสีดำไหม', vs)).toMatchObject({ color: 'ดำ', model: '' })
  })
  it('ignores other questions', () => {
    for (const q of ['มานีมีไหม', 'ลูกค้า hot มีใครบ้าง', 'นัดสมชายพรุ่งนี้', 'ราคา S07 เท่าไหร่', 'ยอดเดือนนี้เป็นไง', 'ใครรอส่งมอบ', 'มูลค่าสต็อกเท่าไหร่', '']) expect(parseStockSpec(q, vs), q).toBeNull()
    expect(maybeStockQuestion('วันนี้มีอะไรบ้าง')).toBe(false)
  })
  it('does not collide with other local answers', () => {
    for (const q of ['S07 สีขาวมีไหม', 'มีรถอะไรพร้อมขาย', 'รถค้างสต็อกนานมีคันไหน', 'DEEPAL S07 มีสีอะไรบ้าง']) {
      expect(parseStockSpec(q, vs), q).toBeTruthy()
      expect(isMonthQuestion(q)).toBe(false); expect(isTodayQuestion(q)).toBe(false); expect(parseListSpec(q)).toBeNull(); expect(parseBookingListSpec(q)).toBeNull()
    }
  })
})

describe('stockAnswer', () => {
  const ans = q => stockAnswer({ vehicles: vs, spec: parseStockSpec(q, vs), today })
  it('answers a model + colour', () => {
    const a = ans('S07 สีขาวมีไหม')
    expect(a.text).toContain('🚗 DEEPAL S07 สีขาว — พร้อมขาย 2 คัน')
    expect(a.text).toContain('📝 จองแล้ว 1 คัน')
    expect(a.text).toContain('คันที่อยู่นานสุด 133 วัน')
    expect(a.query).toBe('DEEPAL S07 ขาว')
  })
  it('lists colours for a model and suggests other colours when one is out', () => {
    expect(ans('S07 เหลือกี่คัน').text).toContain('🎨 ขาว 2 · ดำ 1')
    expect(ans('S07 เหลือกี่คัน').text).toContain('🚢 กำลังขนส่งมา 1 คัน')
    const none = ans('aion v สีขาวมีไหม')
    expect(none.text).toContain('📭 AION V สีขาว ไม่มีพร้อมขายตอนนี้')
    expect(none.text).toContain('AION V สีอื่นที่พร้อมขาย: ดำ 1')
  })
  it('summarises all stock and aged stock without VIN or cost', () => {
    const all = ans('มีรถอะไรพร้อมขาย')
    expect(all.text).toContain('พร้อมขายในสต็อก — 4 คัน')
    expect(all.text).toContain('• DEEPAL S07 3 คัน (ขาว 2 · ดำ 1)')
    expect(all.next[0]).toBe('DEEPAL S07 มีสีอะไรบ้าง')
    const aged = ans('รถค้างสต็อกนานมีคันไหน')
    expect(aged.text).toContain('— 1 คัน')
    expect(aged.text).toContain('• DEEPAL S07 ขาว — 133 วัน')
    expect(all.text + aged.text).not.toContain('SECRETVIN')
    expect(stockAnswer({ vehicles: [], spec: { model: '', brand: '', color: '', aged: false }, today }).text).toContain('ไม่มีรถพร้อมขาย')
  })
})
