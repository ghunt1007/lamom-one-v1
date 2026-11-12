import { describe, it, expect } from 'vitest'
import { parseStockSpec, stockAnswer } from './stockQuestions.js'
import { isMonthQuestion, monthStats, monthBriefText } from './monthBrief.js'
import { parseOpsSpec } from './opsQuestions.js'
import { parseBookingListSpec, bookingTargets, bookingListLabel } from './bookingQuestions.js'

const T = '2026-11-12'
const veh = [
  { id: 'v1', model: 'DEEPAL S07', color: 'ขาว', status: 'available', arrivedAt: '2026-10-01' },
  { id: 'v2', model: 'AION V', color: 'ขาว', status: 'available', arrivedAt: '2026-10-01' },
]
describe('v1.0.1110 LAMI', () => {
  it('ถามรุ่นที่ไม่มีในสต็อก → บอกว่าไม่มี พร้อมสีเดียวกันรุ่นอื่น', () => {
    const spec = parseStockSpec('มีรถ ATTO 3 สีขาวในสต็อกไหม', veh, ['Atto 3', 'X', 'City'])
    expect(spec.missing).toBe('Atto 3')
    const r = stockAnswer({ vehicles: veh, spec, today: T })
    expect(r.text).toContain('ไม่มี Atto 3 สีขาว ในสต็อกตอนนี้')
    expect(r.text).toContain('DEEPAL S07 1 คัน')
  })
  it('รุ่นที่มีในสต็อก ไม่ถือว่า missing · ชื่อรุ่นสั้นเกินไม่จับ', () => {
    expect(parseStockSpec('S07 สีขาวมีไหม', veh, ['DEEPAL S07']).missing).toBeUndefined()
    expect(parseStockSpec('มีรถอะไรพร้อมขาย', veh, ['X']).missing).toBeUndefined()
  })
  it('"ใครปิดการขายได้มากที่สุด" = คำถามยอด/อันดับ', () => {
    expect(isMonthQuestion('ใครปิดการขายได้มากที่สุดเดือนนี้')).toBe(true)
    expect(isMonthQuestion('คนไหนปิดดีลเก่งสุด')).toBe(true)
  })
  it('สีขายดี: เดือนนี้ไม่มีสี → ใช้ 3 เดือนล่าสุด', () => {
    const bookings = [
      { id: 'b1', bookingDate: '2026-11-02', status: 'รอส่งมอบ', model: 'AION V' },
      { id: 'b2', bookingDate: '2026-10-05', status: 'รอส่งมอบ', model: 'AION V', color: 'เทา' },
    ]
    const txt = monthBriefText(monthStats({ bookings, today: T }), { colors: true })
    expect(txt).toContain('สีขายดี 3 เดือนล่าสุด')
    expect(txt).toContain('เทา')
  })
  it('"ยังไม่ได้นัดส่งมอบ" ไม่ใช่นัดส่งมอบวันนี้ → รายการรถพร้อมส่งที่ยังไม่นัด', () => {
    expect(parseOpsSpec('ลูกค้าคนไหนยังไม่ได้นัดส่งมอบ')).toBeNull()
    expect(parseBookingListSpec('ลูกค้าคนไหนยังไม่ได้นัดส่งมอบ').noDate).toBe(true)
    expect(parseOpsSpec('ส่งมอบวันนี้มีใครบ้าง')).toEqual({ kind: 'delivery', day: 'today' })
  })
  it('ใบจองที่ยังไม่ใส่สีรถ', () => {
    const spec = parseBookingListSpec('ใบจองไหนยังไม่ได้ใส่สีรถ')
    expect(bookingListLabel(spec)).toBe('ใบจองที่ยังไม่ได้ใส่สีรถ')
    const customers = [{ id: 'c1', bookingId: 'b1' }, { id: 'c2', bookingId: 'b2' }]
    const bookings = [{ id: 'b1', status: 'รอรถ', bookingDate: '2026-11-01' }, { id: 'b2', status: 'รอรถ', color: 'ขาว', bookingDate: '2026-11-01' }]
    const r = bookingTargets({ customers, bookings, today: T, spec })
    expect(r.list.map(x => x.b.id)).toEqual(['b1'])
  })
  it('ไฟแนนซ์ไม่ผ่าน ≠ ยังไม่ผ่าน · รถที่จองมาถึงหรือยัง = รอรถ · เพิ่งจองเมื่อวาน', () => {
    const f = parseBookingListSpec('ลูกค้าฉันที่ไฟแนนซ์ไม่ผ่าน')
    expect(f.finFail).toBe(true)
    expect(parseBookingListSpec('ใบจองไหนไฟแนนซ์ยังไม่ผ่าน').finFail).toBeUndefined()
    expect(parseOpsSpec('ใบจองไหนไฟแนนซ์ยังไม่ผ่าน')).toBeNull()
    expect(parseOpsSpec('ไฟแนนซ์ไหนอนุมัติเยอะสุด')).toEqual({ kind: 'finbank' })
    expect(parseBookingListSpec('รถที่ลูกค้าฉันจองมาถึงหรือยัง').statuses).toEqual(['รอรถ'])
    expect(bookingListLabel(parseBookingListSpec('รถที่ลูกค้าฉันจองมาถึงหรือยัง'))).toBe('ใบจองที่รถยังไม่มาถึง (รอรถ)')
    expect(parseOpsSpec('ลูกค้าที่เพิ่งจองเมื่อวาน')).toEqual({ kind: 'bookday', day: 'yesterday' })
    const customers = [{ id: 'c1', bookingId: 'b1' }, { id: 'c2', bookingId: 'b2' }]
    const bookings = [{ id: 'b1', status: 'รอผลไฟแนนซ์', finStatus: 'ไม่ผ่าน', bookingDate: '2026-11-01' }, { id: 'b2', status: 'รอผลไฟแนนซ์', finStatus: 'รอผล', bookingDate: '2026-11-01' }]
    expect(bookingTargets({ customers, bookings, today: T, spec: f }).list.map(x => x.b.id)).toEqual(['b1'])
  })
})

import { serviceAnswer } from './opsQuestions.js'
describe('v1.0.1110 service period', () => {
  it('"เดือนนี้ลูกค้าเข้าศูนย์กี่คัน" นับทั้งเดือน', () => {
    expect(parseOpsSpec('เดือนนี้ลูกค้าเข้าศูนย์กี่คัน')).toEqual({ kind: 'service', day: 'month' })
    expect(parseOpsSpec('พรุ่งนี้มีรถเข้าศูนย์กี่คัน')).toEqual({ kind: 'service', day: 'tomorrow' })
    const ap = [{ id: 'a', date: '2026-11-03', customerName: 'ก' }, { id: 'b', date: '2026-11-20', customerName: 'ข' }, { id: 'c', date: '2026-11-21', status: 'cancelled' }, { id: 'd', date: '2026-10-30' }]
    const r = serviceAnswer(ap, [], { today: T, day: 'month' })
    expect(r.n).toBe(2)
    expect(r.text).toContain('เข้ามาแล้ว 1 คัน · ยังไม่ถึงวันนัด 1 คัน')
    expect(r.text).toContain('20/11 ข')
  })
})

import { lostAnswer, sourceOf } from './opsQuestions.js'
describe('v1.0.1111', () => {
  it('เหตุผลที่ลูกค้าไม่ซื้อ → lost · เดือนนี้ไม่มีก็ดูย้อน 3 เดือน', () => {
    expect(parseOpsSpec('เหตุผลที่ลูกค้าไม่ซื้อ')).toEqual({ kind: 'lost', prev: false })
    const r = lostAnswer([{ id: 'x', isLost: true, lostAt: '2026-10-05', lostReason: 'ราคาแพงไป' }], { today: T })
    expect(r.text).toContain('เหตุผลที่เสียดีล 3 เดือนล่าสุด (1 ราย)')
  })
  it('เฟซบุ๊ก (ซ) = facebook', () => {
    expect(sourceOf('ลูกค้าจากเฟซบุ๊ก')).toBe('facebook')
  })
})
