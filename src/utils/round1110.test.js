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

import { lateAnswer } from './opsQuestions.js'
describe('v1.0.1112', () => {
  it('ใครมาสายวันนี้ → สาย/ขาด/ยังไม่ลงเวลา ไม่นับคนลา', () => {
    expect(parseOpsSpec('ใครมาสายวันนี้')).toEqual({ kind: 'late' })
    expect(parseOpsSpec('พนักงานลาวันนี้มีใครบ้าง')).toEqual({ kind: 'leave', day: 'today' })
    const staff = [{ id: 's1', firstName: 'ก', lastName: 'หนึ่ง' }, { id: 's2', firstName: 'ข', lastName: 'สอง' }, { id: 's3', firstName: 'ค', lastName: 'สาม' }]
    const rows = [{ staffId: 's1', staffName: 'ก หนึ่ง', date: T, checkIn: '08:47', status: 'late' }]
    const leaves = [{ staff: 'ค สาม', status: 'approved', from: T, to: T }]
    const r = lateAnswer(rows, staff, leaves, { today: T })
    expect(r.text).toContain('มาสาย 1 คน')
    expect(r.text).toContain('• ก หนึ่ง · เข้า 08:47')
    expect(r.text).toContain('ยังไม่ลงเวลา 1 คน')
    expect(r.text).not.toContain('ค สาม')
  })
})

import { floorPlanAnswer } from './opsQuestions.js'
describe('v1.0.1113 floor plan', () => {
  it('ดอกเบี้ย floor plan เดือนนี้', () => {
    expect(parseOpsSpec('ดอกเบี้ย floor plan เดือนนี้')).toEqual({ kind: 'floorplan' })
    const docs = [{ kind: 'settings', rate: 3.65 }, { status: 'active', principal: 1000000, drawDate: '2026-07-01', model: 'AION V' }, { status: 'paid', principal: 500000, drawDate: '2026-10-01' }]
    const r = floorPlanAnswer(docs, { today: T })
    expect(r.text).toContain('1 คัน · ยอดเงินกู้ ฿1,000,000 (ดอกเบี้ย 3.65% ต่อปี)')
    expect(r.text).toContain('วันละ ฿100')
    expect(r.text).toContain('ดอกเบี้ยเดือนนี้ถึงวันนี้ ฿1,100')
    expect(r.text).toContain('ติดเกิน 120 วัน 1 คัน')
  })
})

import { moneyMonthAnswer } from './opsQuestions.js'
describe('v1.0.1113 per-unit profit', () => {
  it('รถคันไหนขายได้กำไรน้อยสุด', () => {
    expect(parseOpsSpec('รถคันไหนขายได้กำไรน้อยสุด')).toEqual({ kind: 'profit', perUnit: true, low: true, prev: false })
    expect(parseOpsSpec('กำไรเดือนนี้เท่าไหร่').perUnit).toBeUndefined()
    const sales = [{ date: '2026-11-01', salePrice: 1000000, cost: 950000, model: 'A', custName: 'x' }, { date: '2026-11-02', salePrice: 1000000, cost: 800000, model: 'B', custName: 'y' }, { date: '2026-11-03', salePrice: 900000, model: 'C' }]
    const r = moneyMonthAnswer({ sales, today: T, kind: 'profit', perUnit: true, low: true, saleCost: () => 0 })
    expect(r.text).toContain('2 คันที่มีต้นทุนจริง จาก 3 คัน')
    expect(r.text.split('\n')[1]).toContain('A · x — ฿50,000 (5%)')
    expect(parseOpsSpec('รุ่นไหนกำไรดีสุด').byModel).toBe(true)
    const m = moneyMonthAnswer({ sales, today: T, kind: 'profit', perUnit: true, byModel: true, saleCost: () => 0 })
    expect(m.text).toContain('1. B — เฉลี่ย ฿200,000/คัน (20%) · 1 คัน')
  })
})

import { debtAnswer, refundAnswer } from './opsQuestions.js'
describe('v1.0.1114', () => {
  it('ลูกหนี้ / รอคืนเงิน / ใบสั่งรถ / อุปกรณ์ขายดี', () => {
    expect(parseOpsSpec('ลูกค้าคนไหนค้างจ่าย')).toEqual({ kind: 'debt' })
    expect(parseOpsSpec('ลูกค้าที่รอคืนเงินมัดจำ')).toEqual({ kind: 'refund' })
    expect(parseOpsSpec('ใบสั่งรถที่ยังไม่มา').kind).toBe('incoming')
    expect(isMonthQuestion('อุปกรณ์เสริมขายดีสุด')).toBe(false)
    const d = debtAnswer([{ customer: 'ก', used: 5000, status: 'overdue_7' }, { customer: 'ข', used: 9000, status: 'settled' }])
    expect(d.text).toContain('ลูกหนี้ค้างชำระ 1 ราย · รวม ฿5,000 · เกินกำหนด 1 ราย')
    const r = refundAnswer([{ status: 'ถอนจอง', bookingDeposit: 10000, custName: 'ค' }, { status: 'ถอนจอง', bookingDeposit: 5000, refundStatus: 'คืนแล้ว' }, { status: 'ถอนจอง', bookingDeposit: 3000, rightsOnly: true }])
    expect(r.text).toContain('รอคืนเงินมัดจำ 1 ราย · รวม ฿10,000')
  })
})

import { isCallListQuestion } from './callList.js'
import { parseListSpec } from './listQuestions.js'
import { showroomAnswer } from './opsQuestions.js'
describe('v1.0.1115', () => {
  it('ยังไม่ได้โทรหาวันนี้ → รายการโทร · นัดดูรถสัปดาห์นี้ · ฉันมีลูกค้ากี่คน · เพิ่งได้มา', () => {
    expect(parseListSpec('ลูกค้าที่ยังไม่ได้โทรหาวันนี้')).toBeNull()
    expect(isCallListQuestion('ลูกค้าที่ยังไม่ได้โทรหาวันนี้')).toBe(true)
    expect(parseOpsSpec('ใครนัดดูรถสัปดาห์นี้')).toEqual({ kind: 'showroom', day: 'week' })
    expect(parseOpsSpec('ฉันมีลูกค้ากี่คน')).toEqual({ kind: 'mycust' })
    expect(parseOpsSpec('ลูกค้าที่ฉันเพิ่งได้มาสัปดาห์นี้')).toEqual({ kind: 'newcust', period: 'week' })
    const r = showroomAnswer([{ date: '2026-11-14', time: '10:00', customerName: 'ก' }, { date: '2026-11-25', customerName: 'ข' }], { today: T, day: 'week' })
    expect(r.text).toContain('นัดเข้าโชว์รูม 7 วันนี้ — 1 ราย')
  })
})

import { listTargets } from './listQuestions.js'
describe('v1.0.1115 fuel interest', () => {
  it('ลูกค้าคนไหนสนใจรถไฟฟ้า', () => {
    const spec = parseListSpec('ลูกค้าคนไหนสนใจรถไฟฟ้า')
    expect(spec.fuel).toBe('ev')
    expect(spec.model).toBeNull()
    const customers = [{ id: 'a', stage: 'lead', interestedModel: 'ATTO 3' }, { id: 'b', stage: 'lead', interestedModel: 'Camry' }]
    const r = listTargets({ customers, today: T, spec, catalog: [{ model: 'Atto 3', fuel: 'BEV' }, { model: 'Camry', fuel: 'Hybrid' }] })
    expect(r.list.map(x => x.c.id)).toEqual(['a'])
    expect(parseListSpec('ลูกค้าสนใจ S05 มีใครบ้าง').model).toBe('s05')
  })
})

import { dupAnswer } from './opsQuestions.js'
describe('v1.0.1116', () => {
  it('ลูกค้าซ้ำ / ครบ 1 ปีเดือนหน้า / ขายยาก / ประเมินหลังส่งมอบ', () => {
    expect(parseOpsSpec('ลูกค้าซ้ำมีไหม')).toEqual({ kind: 'dup' })
    expect(parseOpsSpec('ลูกค้าที่รับรถครบ 1 ปีเดือนหน้า')).toMatchObject({ kind: 'anniv', nextMonth: true })
    expect(parseStockSpec('รถคันไหนขายยาก', []).aged).toBe(true)
    expect(parseOpsSpec('ใครยังไม่ได้ประเมินความพึงพอใจหลังส่งมอบ')?.kind).not.toBe('delivery')
    const r = dupAnswer([{ id: 'a', firstName: 'สม', lastName: 'ชาย', phone: '081-234-5678' }, { id: 'b', firstName: 'สมชาย', phone: '0812345678' }, { id: 'c', firstName: 'ก', phone: '0899999999' }])
    expect(r.text).toContain('พบลูกค้าที่น่าจะซ้ำ 1 กลุ่ม')
    expect(r.text).toContain('เบอร์ซ้ำ')
  })
})

import { isTeamQuestion } from './teamBrief.js'
describe('v1.0.1116 team phrasings', () => {
  it('ลูกทีม / hot ของทีม / ใบจองค้างของทีม', () => {
    expect(isTeamQuestion('ลูกทีมคนไหนมีนัดเลยกำหนดเยอะสุด')).toBe(true)
    expect(isTeamQuestion('ทีมฉันมีใบจองค้างกี่ใบ')).toBe(false)
    expect(parseOpsSpec('ลูกค้า hot ของทีมฉัน')).toEqual({ kind: 'hotbyseller' })
    expect(parseBookingListSpec('ทีมฉันมีใบจองค้างกี่ใบ').allOpen).toBe(true)
  })
})

describe('v1.0.1117 test drive month/week, plate phrasings, month compare', async () => {
  const oq = await import('./opsQuestions.js')
  const mb = await import('./monthBrief.js')
  it('parses', () => {
    expect(oq.parseOpsSpec('เดือนนี้มีเทสไดรฟ์กี่ครั้ง')).toEqual({ kind: 'testdrive', day: 'month' })
    expect(oq.parseOpsSpec('นัดทดลองขับสัปดาห์นี้มีใครบ้าง')).toEqual({ kind: 'testdrive', day: 'week' })
    expect(oq.parseOpsSpec('ป้ายแดงคืนแล้วหรือยัง')).toEqual({ kind: 'plate' })
    expect(oq.parseOpsSpec('ลูกค้าคนไหนยังไม่ได้ป้ายทะเบียน')).toEqual({ kind: 'plate' })
    expect(mb.isMonthQuestion('เทียบยอดเดือนนี้กับเดือนที่แล้ว')).toBe(true)
    expect(mb.isMonthQuestion('เทียบกำไรเดือนนี้กับเดือนที่แล้ว')).toBe(false)
  })
  it('month summary counts done / no-show / models', () => {
    const rows = [
      { date: '2026-11-02', status: 'completed', model: 'S05' }, { date: '2026-11-05', status: 'no_show', model: 'S05' },
      { date: '2026-11-10', status: 'scheduled', model: 'AION V' }, { date: '2026-11-20', status: 'scheduled' },
      { date: '2026-10-30', status: 'completed' }, { date: '2026-11-03', status: 'cancelled' }]
    const r = oq.testDriveAnswer(rows, { today: '2026-11-12', day: 'month' })
    expect(r.n).toBe(3)
    expect(r.text).toContain('ขับแล้ว 1')
    expect(r.text).toContain('ไม่มา 1')
    expect(r.text).toContain('S05 2')
    expect(oq.testDriveAnswer(rows, { today: '2026-11-12', day: 'week' }).n).toBe(0)
    expect(oq.testDriveAnswer(rows, { today: '2026-11-15', day: 'week' }).n).toBe(1)
  })
})

describe('v1.0.1117 rest-of-month deliveries, call list, ปิดได้กี่คัน', async () => {
  const oq = await import('./opsQuestions.js')
  const cl = await import('./callList.js')
  const mb = await import('./monthBrief.js')
  it('parses', () => {
    expect(oq.parseOpsSpec('ใครจะส่งมอบเดือนนี้')).toEqual({ kind: 'delivery', day: 'restmonth' })
    expect(oq.parseOpsSpec('ลูกค้าที่จะออกรถเดือนนี้')).toEqual({ kind: 'delivery', day: 'restmonth' })
    expect(oq.parseOpsSpec('ลูกค้าที่ส่งมอบเดือนนี้').kind).toBe('delivered')
    expect(cl.isCallListQuestion('ลูกค้าที่ฉันต้องตามวันนี้')).toBe(true)
    expect(cl.isCallListQuestion('ลูกค้าที่ต้องตามเอกสาร')).toBe(false)
    expect(mb.isMonthQuestion('ฉันปิดได้กี่คันเดือนนี้')).toBe(true)
  })
  it('lists open bookings due from today to month end', () => {
    const bks = [{ custName: 'ก', deliveryDate: '2026-11-20', status: 'รอส่งมอบ' }, { custName: 'ข', deliveryDate: '2026-12-02', status: 'รอส่งมอบ' },
      { custName: 'ค', deliveryDate: '2026-11-25', status: 'ส่งมอบแล้ว' }, { custName: 'ง', deliveryDate: '2026-11-10', status: 'รอส่งมอบ' }]
    const r = oq.deliveryAnswer(bks, { today: '2026-11-12', day: 'restmonth' })
    expect(r.n).toBe(1)
    expect(r.text).toContain('30/11')
  })
})

describe('v1.0.1117 staff phrasings', async () => {
  const oq = await import('./opsQuestions.js')
  const tb = await import('./todayBrief.js')
  it('parses', () => {
    expect(oq.parseOpsSpec('พนักงานคนไหนลางานเดือนนี้')).toEqual({ kind: 'leave', day: 'month' })
    expect(oq.parseOpsSpec('ใบสั่งซื้อรถค้างกี่ใบ').kind).toBe('incoming')
    expect(oq.parseOpsSpec('ลูกค้าที่จองแล้วถอนเดือนนี้').kind).toBe('withdrawn')
    expect(tb.isTodayQuestion('ใครขาดงานวันนี้')).toBe(false)
    expect(oq.parseOpsSpec('ใครขาดงานวันนี้').kind).toBe('late')
  })
  it('leave month covers the whole month', () => {
    const rows = [{ staff: 'ก', status: 'approved', from: '2026-11-03' }, { staff: 'ข', status: 'pending', from: '2026-11-28', to: '2026-12-01' }, { staff: 'ค', status: 'approved', from: '2026-10-20' }]
    const r = oq.leaveAnswer(rows, { today: '2026-11-12', day: 'month' })
    expect(r.n).toBe(2)
    expect(r.text).toContain('30/11')
    expect(oq.leaveAnswer(rows, { today: '2026-11-03' }).n).toBe(1)
  })
})

describe('v1.0.1117 list by seller + manager phrasings', async () => {
  const lq = await import('./listQuestions.js')
  const oq = await import('./opsQuestions.js')
  const tb = await import('./teamBrief.js')
  it('filters list by named seller', () => {
    const spec = lq.parseListSpec('ลูกค้า hot ของเซลส์หนึ่ง')
    expect(spec).toMatchObject({ temp: 'hot', seller: true })
    expect(lq.parseListSpec('ลูกค้า hot ของทีม')).toBe(null)
    spec.sellerName = 'เซลส์ หนึ่ง'
    const cs = [{ id: 1, stage: 'lead', temperature: 'hot', assignedTo: 'เซลส์ หนึ่ง' }, { id: 2, stage: 'lead', temperature: 'hot', assignedTo: 'เซลส์ สอง' }]
    expect(lq.listTargets({ customers: cs, today: '2026-11-12', spec }).total).toBe(1)
    expect(lq.listLabel(spec)).toContain('ของ เซลส์ หนึ่ง')
    expect(lq.listFollowUp(spec, { total: 1 })).toBe('')
  })
  it('manager phrasings', () => {
    expect(oq.parseOpsSpec('ลูกทีมคนไหนยังไม่มียอดจองเดือนนี้').kind).toBe('nobookseller')
    expect(tb.isTeamQuestion('เซลส์คนไหนมีลูกค้าค้างโทรเยอะสุด')).toBe(true)
    expect(tb.isTeamQuestion('ใครในทีมยังไม่ได้อัปเดตลูกค้า')).toBe(true)
  })
})

describe('v1.0.1117 marketing spend', async () => {
  const oq = await import('./opsQuestions.js')
  const sa = await import('./socialAccounts.js')
  const run = (o) => oq.mktSpendAnswer({ today: '2026-11-12', spendSummary: sa.spendSummary, accountResults: sa.accountResults, ...o })
  it('parses', () => {
    expect(oq.parseOpsSpec('ค่าใช้จ่ายการตลาดเดือนนี้')).toEqual({ kind: 'mktspend', prev: false })
    expect(oq.parseOpsSpec('ต้นทุนต่อลีดเท่าไหร่').kind).toBe('mktspend')
    expect(oq.parseOpsSpec('ค่าใช้จ่ายเดือนนี้เท่าไหร่').kind).toBe('expense')
  })
  it('honest when nothing entered; budget-only events not counted', () => {
    const r = run({ events: [{ startDate: '2026-11-05', budget: 20000 }], customers: [{ createdAt: '2026-11-03' }] })
    expect(r.n).toBe(0)
    expect(r.text).toContain('ยังไม่ได้ใส่')
    expect(r.text).toContain('ลูกค้าใหม่เดือนนี้ 1 คน')
  })
  it('sums ad spend and actual event spend, cost per new customer', () => {
    const r = run({ accounts: [{ id: 'p1', spend: { '2026-11': 6000 } }], events: [{ startDate: '2026-11-05', spent: 4000, budget: 9000 }],
      customers: [{ createdAt: '2026-11-03', sourceAccountId: 'p1' }, { createdAt: '2026-11-04', sourceAccountId: 'p1' }, { createdAt: '2026-10-04' }, { createdAt: '2026-11-08' }, { createdAt: '2026-11-09' }, { createdAt: '2026-11-10' }] })
    expect(r.text).toContain('฿10,000')
    expect(r.text).toContain('฿3,000/Lead')
    expect(r.text).toContain('ลูกค้าใหม่ทั้งเดือนนี้ 5 คน → เฉลี่ย ฿2,000/คน')
  })
})

describe('v1.0.1118 trade-ins this month', async () => {
  const oq = await import('./opsQuestions.js')
  it('counts every trade-in dated this month', () => {
    expect(oq.parseOpsSpec('มีรถเทิร์นกี่คันเดือนนี้')).toEqual({ kind: 'tradein', month: true })
    expect(oq.parseOpsSpec('รถเทิร์นคันไหนยังไม่ได้ประเมิน')).toEqual({ kind: 'tradein' })
    const r = oq.tradeInAnswer([{ date: '2026-11-02', status: 'received' }, { date: '2026-11-05', status: 'declined' }, { date: '2026-10-05', status: 'appraisal' }], { today: '2026-11-12', month: true })
    expect(r.n).toBe(2)
    expect(r.text).toContain('ไม่ตกลง 1')
  })
})

describe('v1.0.1118 calls made, next-week brief', async () => {
  const oq = await import('./opsQuestions.js')
  const ab = await import('./aheadBrief.js')
  const cl = await import('./callList.js')
  it('parses', () => {
    expect(oq.parseOpsSpec('วันนี้ฉันโทรไปกี่คนแล้ว')).toEqual({ kind: 'calls', day: 'today', team: false })
    expect(oq.parseOpsSpec('เมื่อวานฉันโทรไปกี่สาย').day).toBe('yesterday')
    expect(oq.parseOpsSpec('ทีมโทรไปกี่สายวันนี้').team).toBe(true)
    expect(oq.parseOpsSpec('วันนี้ควรโทรหาใคร')).toBe(null)
    expect(ab.parseAheadSpec('นัดของฉันสัปดาห์หน้า')).toEqual({ mode: 'nextweek' })
    expect(ab.parseAheadSpec('ช่วยสรุปลูกค้าที่ต้องตามสัปดาห์นี้')).toEqual({ mode: 'week' })
    expect(ab.parseAheadSpec('ลูกค้าที่ต้องตามพรุ่งนี้')).toEqual({ mode: 'tomorrow' })
    expect(cl.isCallListQuestion('ลูกค้าที่ต้องตามพรุ่งนี้')).toBe(false)
    expect(cl.isCallListQuestion('ลูกค้าที่ฉันต้องตามวันนี้')).toBe(true)
  })
  it('next week = next Monday to Sunday', () => {
    const s = ab.aheadStats({ today: '2026-11-12', mode: 'nextweek' })
    expect([s.from, s.to]).toEqual(['2026-11-16', '2026-11-22'])
    expect(ab.aheadBriefText(s)).toContain('งานสัปดาห์หน้า')
  })
  it('counts logged calls with outcomes', () => {
    const logs = [{ type: 'call', createdAt: '2026-11-12T03:00', customerId: 'a', note: 'คุยแล้ว สนใจ', createdBy: 'ก' },
      { type: 'call', createdAt: '2026-11-12T04:00', customerId: 'a', note: 'ไม่รับสาย', createdBy: 'ข' },
      { type: 'call', createdAt: '2026-11-11T04:00', customerId: 'b', note: 'ไม่สนใจ', createdBy: 'ก' }, { type: 'line', createdAt: '2026-11-12' }]
    const r = oq.callsAnswer(logs, { today: '2026-11-12', team: true })
    expect(r.text).toContain('โทรไป 2 สาย · 1 คน')
    expect(r.text).toContain('📵 ไม่รับสาย 1')
    expect(r.text).toContain('1. ก — 1 สาย')
    expect(oq.callsAnswer(logs, { today: '2026-11-12', day: 'yesterday' }).n).toBe(1)
    expect(oq.callsAnswer([], { today: '2026-11-12' }).text).toContain('ยังไม่มีการโทร')
  })
})
