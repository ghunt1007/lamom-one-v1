import { describe, it, expect } from 'vitest'
import { parseOpsSpec, payrollAnswer } from './opsQuestions.js'

describe('LAMI สรุปเงินเดือน (v1.0.1540)', () => {
  it('routes payroll questions, not own-salary ones', () => {
    expect(parseOpsSpec('เงินเดือนเดือนนี้รวมเท่าไหร่')).toEqual({ kind: 'payroll', prev: false })
    expect(parseOpsSpec('เงินเดือนเดือนก่อนเท่าไหร่')?.prev).toBe(true)
    expect(parseOpsSpec('เงินเดือนของฉันเท่าไหร่')).toBeNull()
  })
  it('sums saved records only and says so when none', () => {
    expect(payrollAnswer([]).text).toContain('ยังไม่มีการบันทึก')
    const r = payrollAnswer([
      { month: '2026-11', staffName: 'ก', base: 15000, ot: 1000, allowance: 0, deduction: 500, ssf: 750, status: 'paid' },
      { month: '2026-11', staffName: 'ข', base: 12000, ot: 0, allowance: 500, deduction: 0, ssf: 600, status: 'pending' },
    ], { month: '2026-11' })
    expect(r.text).toContain('฿26,650')
    expect(r.text).toContain('ยังไม่จ่าย 1 คน ฿11,900 — ข')
  })
})

import { parseBookingListSpec } from './bookingQuestions.js'
describe('Y/N columns win over delivery appointments (v1.0.1541)', () => {
  it('routes', () => {
    expect(parseOpsSpec('ใครยังไม่ได้เช็ครายการก่อนส่งมอบ')).toBeNull()
    expect(parseBookingListSpec('ใครยังไม่ได้เช็ครายการก่อนส่งมอบ')?.ynCol?.f).toBe('checklistDone')
    expect(parseBookingListSpec('ใบจองที่ยังไม่ส่งจอง')?.ynCol?.f).toBe('bookingSent')
    expect(parseBookingListSpec('ใบจองไหนยังไม่ได้แจ้งลูกค้า')?.ynCol?.f).toBe('customerNotified')
    expect(parseOpsSpec('ใครยังไม่ได้ส่งมอบ')?.kind).toBe('delivery')
  })
})

describe('ลูกค้าใหม่ตามช่องทางแบบสั้น (v1.0.1543)', () => {
  it('routes', () => {
    expect(parseOpsSpec('ลูกค้าแนะนำเดือนนี้')).toMatchObject({ kind: 'newcust', source: 'referral', period: 'month' })
    expect(parseOpsSpec('ลีดเฟสบุ๊คสัปดาห์นี้')).toMatchObject({ kind: 'newcust', source: 'facebook', period: 'week' })
    expect(parseOpsSpec('ลูกค้าที่ควรขอให้แนะนำเพื่อน')?.kind).not.toBe('newcust')
  })
})

describe('รถซ่อมเสร็จรอรับ (v1.0.1544)', () => {
  it('routes', () => {
    for (const q of ['รถลูกค้าซ่อมเสร็จยัง', 'รถซ่อมเสร็จแล้วคันไหน', 'ซ่อมเสร็จหรือยัง']) expect(parseOpsSpec(q)?.kind).toBe('jobready')
    expect(parseOpsSpec('งานซ่อมวันนี้กี่งาน')?.kind).toBe('service')
  })
})

import { afterSalesAnswer } from './opsQuestions.js'
describe('นัดดูแลหลังการขาย (v1.0.1545)', () => {
  it('routes', () => {
    expect(parseOpsSpec('ใครควรโทรหลังส่งมอบ')?.kind).toBe('aftersales')
    expect(parseOpsSpec('ลูกค้าส่งมอบแล้วยังไม่โทรหลังขาย')?.kind).toBe('aftersales')
  })
  it('lists pending after-sales follow-ups due soon', () => {
    const r = afterSalesAnswer([
      { customerName: 'ก', purpose: 'หลังส่งมอบรถ', status: 'pending', dueDate: '2026-11-25', afterSales: true },
      { customerName: 'ข', purpose: 'ตรวจสอบความพึงพอใจ', status: 'pending', dueDate: '2026-12-20', afterSales: true },
      { customerName: 'ค', purpose: 'หลังส่งมอบรถ', status: 'done', dueDate: '2026-11-27' },
      { customerName: 'ง', purpose: 'ติดตาม Lead ใหม่', status: 'pending', dueDate: '2026-11-28' },
    ], { today: '2026-11-28' })
    expect(r.n).toBe(1)
    expect(r.text).toContain('เลยกำหนด 1')
    expect(r.text).toContain('25/11/2569')
    expect(afterSalesAnswer([], { today: '2026-11-28' }).n).toBe(0)
  })
})

import { moneyMonthAnswer } from './opsQuestions.js'
import { opexEntries } from './opex.js'
describe('ค่าใช้จ่ายรายหมวด/รายคน (v1.0.1546)', () => {
  it('routes', () => {
    expect(parseOpsSpec('ค่าน้ำมันเดือนนี้')).toMatchObject({ kind: 'expense', cat: 'fuel' })
    expect(parseOpsSpec('ใครเบิกเยอะสุด')).toMatchObject({ kind: 'expense', byWho: true })
    expect(parseOpsSpec('รถรุ่นไหนประหยัดน้ำมัน')?.kind).not.toBe('expense')
    expect(parseOpsSpec('ค่าใช้จ่ายเดือนนี้เท่าไหร่')).toEqual({ kind: 'expense', prev: false })
  })
  it('answers by category and by person', () => {
    const opex = opexEntries([
      { date: '2026-11-03', cat: 'fuel', amount: 500, staffName: 'ก', status: 'approved' },
      { date: '2026-11-05', cat: 'fuel', amount: 300, staffName: 'ข', status: 'paid' },
      { date: '2026-11-06', cat: 'meals', amount: 1000, staffName: 'ข', status: 'approved' },
      { date: '2026-11-07', cat: 'fuel', amount: 999, staffName: 'ค', status: 'pending' },
    ], [])
    const f = moneyMonthAnswer({ opex, today: '2026-11-28', kind: 'expense', cat: 'fuel' })
    expect(f.text).toContain('ค่าน้ำมันเดือนนี้ (11/2569) ฿800 · 2 รายการ')
    const w = moneyMonthAnswer({ opex, today: '2026-11-28', kind: 'expense', byWho: true })
    expect(w.text).toContain('🥇 ข ฿1,300')
    expect(moneyMonthAnswer({ opex: [], today: '2026-11-28', kind: 'expense', cat: 'fuel' }).text).toContain('ยังไม่มีรายการ')
  })
})

import { parseLamiCommand } from './lamiCommands.js'
describe('เปลี่ยนเบอร์ (v1.0.1547)', () => {
  const cs = [{ id: 'a', firstName: 'สมชาย', lastName: 'ดี', phone: '0811111111' }, { id: 'b', firstName: 'วิไล', lastName: 'ใจ' }]
  it('name between เบอร์ and the new number', () => {
    const r = parseLamiCommand('เปลี่ยนเบอร์สมชายเป็น 0899999999', cs, '2026-11-28')
    expect(r[0]).toMatchObject({ kind: 'phone', phone: '0899999999' })
    expect(r[0].customer.id).toBe('a')
    expect(parseLamiCommand('แก้เบอร์ คุณวิไล เป็น 081-234-5678', cs, '2026-11-28')[0]).toMatchObject({ kind: 'phone', phone: '0812345678' })
  })
})

import { commandHref } from './lamiCommands.js'
describe('คำสั่งรถเทิร์น (v1.0.1548)', () => {
  const cs = [{ id: 'a', firstName: 'สมชาย', lastName: 'ดี', interestedModel: 'DEEPAL S07' }]
  it('opens the trade-in form prefilled', () => {
    const r = parseLamiCommand('สมชายมีรถเก่ามาเทิร์น', cs, '2026-11-28')
    expect(r[0].kind).toBe('tradein')
    expect(commandHref(r[0])).toBe('/dms/tradein?new=1&name=' + encodeURIComponent('สมชาย ดี') + '&car=' + encodeURIComponent('DEEPAL S07'))
    expect(parseLamiCommand('มีรถเทิร์นกี่คัน', cs, '2026-11-28')).toEqual([])
  })
})

import { bookingTargets as bt1550 } from './bookingQuestions.js'
describe('ส่งมอบใน DMS (v1.0.1550)', () => {
  it('lists recently delivered bookings without the DMS mark', () => {
    const spec = parseBookingListSpec('ใครยังไม่ได้ส่งมอบใน DMS')
    expect(spec.ynCol).toMatchObject({ f: 'dmsDelivered', delivered: true })
    const bookings = [
      { id: 'a', customerId: 'ca', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-11-20' },
      { id: 'b', customerId: 'cb', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-11-21', dmsDelivered: 'Y' },
      { id: 'c', customerId: 'cc', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-01-01' },
      { id: 'd', customerId: 'cd', status: 'รอส่งมอบ' },
    ]
    const r = bt1550({ customers: ['ca', 'cb', 'cc', 'cd'].map(id => ({ id })), bookings, today: '2026-11-28', spec })
    expect(r.list.map(x => x.b.id)).toEqual(['a'])
  })
})

describe('ใบจองวันนี้ (v1.0.1551)', () => {
  it('routes', () => {
    expect(parseOpsSpec('ใบจองวันนี้มีใครบ้าง')).toMatchObject({ kind: 'bookday', day: 'today' })
    expect(parseOpsSpec('ใบจองเมื่อวาน')).toMatchObject({ kind: 'bookday', day: 'yesterday' })
  })
})
