import { describe, it, expect } from 'vitest'
import { parseOpsSpec, staleProspectAnswer, tradeInAnswer, closeRateAnswer } from './opsQuestions.js'
import { parseBookingListSpec, bookingTargets } from './bookingQuestions.js'
import { isMonthQuestion } from './monthBrief.js'

const today = '2026-11-12'
describe('v1.0.1096 LAMI: long prospects, trade-ins, close rate, late deliveries', () => {
  it('parse', () => {
    expect(parseOpsSpec('ลูกค้าคนไหนคุยนานแล้วยังไม่ปิด')).toEqual({ kind: 'stale' })
    expect(parseOpsSpec('ใครมีรถเก่ามาเทิร์น')).toEqual({ kind: 'tradein' })
    expect(parseOpsSpec('รถเทิร์นค้างประเมินกี่คัน')).toEqual({ kind: 'tradein' })
    expect(parseOpsSpec('อัตราปิดการขายเดือนนี้')).toEqual({ kind: 'closerate', prev: false })
    expect(parseOpsSpec('ปิดการขายเฉลี่ยกี่วัน')).toEqual({ kind: 'closerate', prev: false })
    expect(isMonthQuestion('อัตราปิดการขายเดือนนี้')).toBe(false)
    expect(isMonthQuestion('ยอดเดือนนี้เป็นไง')).toBe(true)
    expect(parseOpsSpec('ใครยังไม่ได้รับรถทั้งที่ถึงวันนัด')).toBeNull()
    expect(parseBookingListSpec('ใครยังไม่ได้รับรถทั้งที่ถึงวันนัด').late).toBe(true)
    expect(parseBookingListSpec('ใบจองไหนเลยกำหนดส่งมอบ').late).toBe(true)
  })
  it('late delivery targets', () => {
    const customers = [{ id: 'c1', bookingId: 'b1' }, { id: 'c2', bookingId: 'b2' }]
    const bookings = [{ id: 'b1', status: 'รอส่งมอบ', deliveryDate: '2026-11-01', bookingDate: '2026-10-01' }, { id: 'b2', status: 'รอส่งมอบ', deliveryDate: '2026-11-20', bookingDate: '2026-10-01' }]
    const r = bookingTargets({ customers, bookings, today, spec: parseBookingListSpec('ใบจองไหนเลยกำหนดส่งมอบ') })
    expect(r.total).toBe(1)
  })
  it('answers', () => {
    const cs = [{ id: 1, firstName: 'ก', stage: 'pp', createdAt: '2026-09-01', temperature: 'hot' }, { id: 2, firstName: 'ข', stage: 'pp', createdAt: '2026-11-01' }, { id: 3, firstName: 'ค', stage: 'pp', createdAt: '2026-11-03' }]
    const st = staleProspectAnswer(cs, { today })
    expect(st.n).toBe(1)
    expect(st.text).toContain('คุยมา 72 วัน')
    const ti = tradeInAnswer([{ customer: 'A', oldCar: 'Vios', status: 'appraisal', date: '2026-11-10' }, { customer: 'B', status: 'sold' }], { today })
    expect(ti.n).toBe(1)
    expect(ti.text).toContain('🔍 รอประเมิน 1')
    const cr = closeRateAnswer(cs, [{ customerId: 2, bookingDate: '2026-11-05', status: 'จอง' }], { today })
    expect(cr.text).toContain('ลูกค้าใหม่ 2 คน → จองแล้ว 1 คน (50%)')
    expect(cr.text).toContain('เฉลี่ย 4 วัน')
  })
})
