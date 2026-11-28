import { describe, it, expect } from 'vitest'
import { parseOpsSpec, weekSummaryAnswer, upgradeAnswer, bookDayAnswer, custBySellerAnswer } from './opsQuestions.js'
import { parseListSpec } from './listQuestions.js'
import { periodSpec, periodStats, periodBriefText, isSellerSummaryAsk } from './monthBrief.js'
import { isCallListQuestion } from './callList.js'
import { parseBookingListSpec } from './bookingQuestions.js'
import { isRateQuestion, ratesAnswer } from './payQuestions.js'
import { parseStockSpec } from './stockQuestions.js'

describe('v1.0.1506 LAMI routes', () => {
  it('weekly summary is not a walk-in count', () => {
    expect(parseOpsSpec('สรุปภาพรวมโชว์รูมสัปดาห์นี้')).toEqual({ kind: 'weeksum', prev: false })
    expect(parseOpsSpec('สัปดาห์ที่แล้วเป็นไง')).toEqual({ kind: 'weeksum', prev: true })
    expect(parseOpsSpec('walk in สัปดาห์นี้กี่คน').kind).toBe('walkin')
    expect(parseOpsSpec('นัดส่งมอบสัปดาห์นี้มีใครบ้าง').kind).toBe('delivery')
  })
  it('week summary counts Monday→today and compares with last week', () => {
    const r = weekSummaryAnswer({ bookings: [
      { bookingDate: '2026-11-24', status: 'จองแล้ว', salesName: 'A' },
      { bookingDate: '2026-11-18', status: 'จองแล้ว', salesName: 'B' },
      { bookingDate: '2026-11-25', status: 'ถอนจอง', cancelDate: '2026-11-26' }] }, { today: '2026-11-28' })
    expect(r.text).toContain('จองใหม่ 1 ใบ')
    expect(r.text).toContain('ถอน 1 ใบ')
    expect(r.text).toContain('🏆 จองมากสุด: A 1')
    expect(weekSummaryAnswer({}, { today: '2026-11-28' }).text).toContain('ยังไม่มีการบันทึกงาน')
  })
  it('best month of the year', () => {
    expect(periodSpec('เดือนไหนขายดีที่สุดปีนี้')).toEqual({ period: 'year', prev: false, best: true })
    expect(periodSpec('เดือนไหนขายดีที่สุด').best).toBe(true)
    const t = periodBriefText(periodStats({ bookings: [{ bookingDate: '2026-10-03', status: 'จองแล้ว' }, { bookingDate: '2026-10-05', status: 'จองแล้ว' }, { bookingDate: '2026-09-05', status: 'จองแล้ว' }], today: '2026-11-28', period: 'year' }), { best: true })
    expect(t).toContain('🏅 เดือนที่ขายดีสุด: ต.ค.')
  })
  it('who is worth calling today → call list', () => {
    expect(isCallListQuestion('ลูกค้าคนไหนน่าโทรตามวันนี้มากที่สุด')).toBe(true)
    expect(isCallListQuestion('ควรโทรช่วงไหน')).toBe(false)
  })
  it('upgrade candidates', () => {
    expect(parseOpsSpec('ลูกค้าเก่าที่ควรเสนอเปลี่ยนรถใหม่')).toEqual({ kind: 'upgrade' })
    const r = upgradeAnswer([{ status: 'ส่งมอบแล้ว', deliveryDate: '2026-05-01', customerName: 'ก' }], { today: '2026-11-28' })
    expect(r.n).toBe(0)
    expect(r.text).toContain('ยังไม่มีลูกค้าที่รับรถครบ 2 ปี')
    const r2 = upgradeAnswer([{ status: 'ส่งมอบแล้ว', deliveryDate: '2023-05-01', customerName: 'ข' }], { today: '2026-11-28' })
    expect(r2.n).toBe(1)
    expect(r2.text).toContain('ข')
  })
  it('v1.0.1507 deposit / incoming / delivered via cutDate', () => {
    expect(parseBookingListSpec('ใบจองที่ยังไม่ได้เงินจอง').noDeposit).toBe(true)
    expect(parseBookingListSpec('ลูกค้าที่ยังไม่ได้จอง')).toBeNull()
    expect(parseOpsSpec('รถที่จะมาถึงสัปดาห์หน้า')).toEqual({ kind: 'incoming' })
    const r = upgradeAnswer([{ status: 'ส่งมอบแล้ว', cutDate: '2023-01-10', customerName: 'ค' }], { today: '2026-11-28' })
    expect(r.n).toBe(1)
  })
  it('v1.0.1507 finance rate table', () => {
    expect(isRateQuestion('ดอกเบี้ยไฟแนนซ์เท่าไหร่')).toBe(true)
    expect(isRateQuestion('ผ่อน S07 60 งวด ดอกเบี้ย 2.5%')).toBe(false)
    expect(ratesAnswer([])).toContain('ยังไม่ได้ตั้งเรท')
    const t = ratesAnswer([{ name: 'KK', rates: { 60: 2.5, 72: 2.9 } }, { name: 'TB', rates: { 60: 2.3 } }])
    expect(t).toContain('KK — 60 งวด 2.5% · 72 งวด 2.9%')
    expect(t).toContain('60 งวด 2.3% (TB)')
    expect(parseOpsSpec('ลีดที่ยังไม่มีใครดูแล')).toEqual({ kind: 'unassigned' })
  })
  it('v1.0.1508 month booking list, ad spend, service month', () => {
    expect(parseOpsSpec('ใครจองเดือนนี้บ้าง')).toEqual({ kind: 'bookday', day: 'month' })
    expect(parseOpsSpec('ลูกค้าที่จองเดือนก่อนมีใครบ้าง')).toEqual({ kind: 'bookday', day: 'prevmonth' })
    const r = bookDayAnswer([{ bookingDate: '2026-11-03', customerName: 'ก', salesName: 'A' }, { bookingDate: '2026-10-30', customerName: 'ข' }], { today: '2026-11-28', day: 'month' })
    expect(r.n).toBe(1)
    expect(r.text).toContain('เดือนนี้ (01/11/2569–28/11/2569) 1 ใบ')
    expect(parseOpsSpec('โฆษณาเดือนนี้ใช้เงินเท่าไหร่').kind).toBe('mktspend')
    expect(parseOpsSpec('รถเข้าซ่อมเดือนนี้กี่คัน')).toEqual({ kind: 'service', day: 'month' })
  })
  it('v1.0.1509 unreserved stock, overdue calls, withdrawn to competitor', () => {
    expect(parseStockSpec('รถที่ยังไม่มีคนจอง', [])).toBeTruthy()
    expect(parseOpsSpec('ลูกค้าที่เลยนัดโทร')).toEqual({ kind: 'overdue' })
    expect(parseOpsSpec('ลูกค้าที่ถอนจองไปซื้อยี่ห้ออื่น')).toEqual({ kind: 'wdcomp' })
    expect(parseOpsSpec('ลูกค้าไปซื้อยี่ห้ออื่น').kind).toBe('lost')
  })
  it('v1.0.1510 seller summary, model bookings, no-answer, deliver before month end', () => {
    expect(isSellerSummaryAsk('สรุปยอดของสมชาย')).toBe(true)
    expect(isSellerSummaryAsk('ยอดจองวันนี้')).toBe(false)
    expect(parseBookingListSpec('ลูกค้าที่จองรุ่น S07')).toMatchObject({ modelQ: 'S07', allOpen: true })
    expect(parseBookingListSpec('ลูกค้าที่จองแล้ว')).toBeNull()
    expect(parseOpsSpec('ลูกค้าที่โทรไม่ติด')).toEqual({ kind: 'noanswer' })
    expect(parseOpsSpec('ลูกค้าที่ต้องส่งมอบก่อนสิ้นเดือน')).toEqual({ kind: 'delivery', day: 'restmonth' })
  })
  it('v1.0.1511 customers per seller, trade-in phrasing, no delivery date, model + not booked', () => {
    expect(parseOpsSpec('เซลส์คนไหนมีลูกค้าเยอะสุด')).toEqual({ kind: 'custbyseller' })
    const r = custBySellerAnswer([{ assignedTo: 'A', temperature: 'hot', stage: 'lead' }, { assignedTo: 'A', stage: 'pp' }, { stage: 'lead' }, { assignedTo: 'B', isLost: true }])
    expect(r.text).toContain('1. A — 2 คน · 🔥 HOT 1')
    expect(r.text).toContain('ยังไม่มีผู้ดูแล — 1 คน')
    expect(parseOpsSpec('ลูกค้าที่มีรถเก่าจะขาย')).toEqual({ kind: 'tradein' })
    expect(parseBookingListSpec('ใบจองที่ยังไม่มีวันส่งมอบ').noDate).toBe(true)
    expect(parseBookingListSpec('ใบจองที่ยังไม่ส่งมอบ').noDate).toBe(false)
    expect(parseListSpec('ลูกค้าที่สนใจ S07 แต่ยังไม่จอง').model).toBe('s07')
  })
})
