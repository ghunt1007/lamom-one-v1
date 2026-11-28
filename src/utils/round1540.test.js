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
