import { describe, it, expect } from 'vitest'
import { parseOpsSpec, leaveAnswer, incomingAnswer, lowStockAnswer } from './opsQuestions.js'
import { parseBookingListSpec } from './bookingQuestions.js'
import { parseStockSpec } from './stockQuestions.js'
import { isTodayQuestion } from './todayBrief.js'

const today = '2026-11-12'
describe('v1.0.1097 LAMI: staff leave, incoming cars, low stock', () => {
  it('parse', () => {
    expect(parseOpsSpec('ใครลางานวันนี้')).toEqual({ kind: 'leave', day: 'today' })
    expect(parseOpsSpec('พรุ่งนี้มีใครลาบ้าง')).toEqual({ kind: 'leave', day: 'tomorrow' })
    expect(isTodayQuestion('ใครลางานวันนี้')).toBe(false)
    expect(isTodayQuestion('วันนี้มีงานอะไร')).toBe(true)
    expect(parseOpsSpec('รถที่กำลังจะมาถึงมีกี่คัน')).toEqual({ kind: 'incoming' })
    expect(parseOpsSpec('รถรุ่นไหนเหลือน้อย')).toEqual({ kind: 'lowstock' })
    expect(parseOpsSpec('รุ่นไหนควรสั่งเพิ่ม')).toEqual({ kind: 'lowstock' })
    expect(parseStockSpec('มีรถจองแล้วแต่ยังไม่มีในสต็อกกี่คัน', [])).toBeNull()
    expect(parseBookingListSpec('มีรถจองแล้วแต่ยังไม่มีในสต็อกกี่คัน').statuses).toEqual(['รอรถ'])
  })
  it('answers', () => {
    const l = leaveAnswer([{ staff: 'A', type: 'sick', from: '2026-11-12', to: '2026-11-12', status: 'approved' }, { staff: 'B', type: 'annual', from: '2026-11-10', to: '2026-11-14', status: 'pending' }, { staff: 'C', from: '2026-11-12', status: 'rejected' }], { today })
    expect(l.n).toBe(2)
    expect(l.text).toContain('รออนุมัติ 1')
    const inc = incomingAnswer([{ brand: 'AION', model: 'V', status: 'transit' }], [{ model: 'S05', qty: 2, status: 'shipped', expectedDate: '2026-11-01' }, { model: 'X', status: 'draft' }], { today })
    expect(inc.n).toBe(3)
    expect(inc.text).toContain('⚠️ เลยกำหนด')
    const lo = lowStockAnswer([{ model: 'S05', status: 'available' }, { model: 'V', status: 'available' }, { model: 'V', status: 'available' }, { model: 'V', status: 'available' }], [{ model: 'S05', status: 'รอรถ' }, { model: 'S05', status: 'รอรถ' }])
    expect(lo.n).toBe(1)
    expect(lo.text).toContain('S05 — พร้อมขาย 1 · ใบจองรอรถ 2 · ⚠️ ขาด 1 คัน')
  })
})
