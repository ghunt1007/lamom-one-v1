import { describe, it, expect } from 'vitest'
import { parseOpsSpec, vatAnswer } from './opsQuestions.js'

describe('LAMI vat (v1.0.1483)', () => {
  it('routes VAT questions', () => {
    for (const q of ['ภาษีขายเดือนนี้', 'เดือนนี้ต้องจ่าย VAT เท่าไหร่', 'ภาษีที่ต้องชำระเดือนนี้', 'ภพ.30 เดือนนี้', 'ภาษีซื้อเดือนก่อน'])
      expect(parseOpsSpec(q)?.kind, q).toBe('vat')
    expect(parseOpsSpec('ภาษีซื้อเดือนก่อน').prev).toBe(true)
    for (const q of ['ต่อภาษีรถ', 'ราคานี้รวม VAT ไหม', 'ภาษีหัก ณ ที่จ่ายเดือนนี้']) expect(parseOpsSpec(q)?.kind, q).not.toBe('vat')
  })
  it('extracts 7/107 and nets purchase VAT', () => {
    const r = vatAnswer({ today: '2026-11-28', sales: [{ date: '2026-11-03', salePrice: 1070000, cost: 963000 }, { date: '2026-11-10' }, { date: '2026-10-01', salePrice: 999999 }],
      pos: [{ status: 'received', cat: 'parts', amount: 10700, requestDate: '2026-11-05' }] })
    expect(r.text).toContain('ภาษีขาย ฿70,000')
    expect(r.text).toContain('1 คันยังไม่มีราคาขาย')
    expect(r.text).toContain('ภาษีซื้อ ฿63,700')
    expect(r.text).toContain('฿6,300')
  })
  it('no fake ฿0 when nothing priced', () => {
    const r = vatAnswer({ today: '2026-11-28', sales: [{ date: '2026-11-03' }] })
    expect(r.n).toBe(0); expect(r.text).not.toContain('฿0'); expect(r.text).toContain('ยังคำนวณ VAT ไม่ได้')
  })
})

import { apptDate, apptDayAnswer } from './opsQuestions.js'
describe('LAMI weekday appointments (v1.0.1484)', () => {
  it('routes weekday questions', () => {
    expect(parseOpsSpec('ใครมีนัดวันเสาร์นี้')).toMatchObject({ kind: 'apptday', day: 'wd', wd: 6 })
    expect(parseOpsSpec('นัดลูกค้าวันจันทร์มีใครบ้าง')).toMatchObject({ kind: 'apptday', wd: 1 })
    expect(parseOpsSpec('นัดคุณเอ วันจันทร์ 10 โมง')?.kind).not.toBe('apptday')
  })
  it('picks the coming weekday (today counts)', () => {
    // 28/11/2026 = Saturday
    expect(apptDate('2026-11-28', { day: 'wd', wd: 6 })).toBe('2026-11-28')
    expect(apptDate('2026-11-28', { day: 'wd', wd: 1 })).toBe('2026-11-30')
    expect(apptDate('2026-11-28', { day: 'wd', wd: 1, next: true })).toBe('2026-12-07')
    const r = apptDayAnswer([{ date: '2026-11-30', time: '10:00', customerName: 'ก', status: 'scheduled' }], [], { today: '2026-11-28', day: 'wd', wd: 1 })
    expect(r.text).toContain('นัดลูกค้าวันจันทร์ 30/11/2569 — 1 นัด')
  })
})

import { leaveAnswer } from './opsQuestions.js'
describe('leave on a weekday (v1.0.1484)', () => {
  it('ใครลาวันศุกร์ → coming Friday', () => {
    expect(parseOpsSpec('ใครลาวันศุกร์')).toMatchObject({ kind: 'leave', day: 'wd', wd: 5 })
    const r = leaveAnswer([{ staff: 'ก', status: 'approved', from: '2026-12-04', to: '2026-12-04' }], { today: '2026-11-28', day: 'wd', wd: 5 })
    expect(r.text).toContain('วันศุกร์ 04/12/2569')
    expect(r.text).toContain('ก')
  })
})

import { downAvgAnswer } from './opsQuestions.js'
describe('LAMI downavg (v1.0.1485)', () => {
  it('routes and leaves loan calcs alone', () => {
    expect(parseOpsSpec('ยอดดาวน์เฉลี่ยเท่าไหร่')?.kind).toBe('downavg')
    expect(parseOpsSpec('ซื้อสดกี่คน')?.kind).toBe('downavg')
    expect(parseOpsSpec('S07 ดาวน์ 20% เดือนละเท่าไหร่')?.kind).not.toBe('downavg')
  })
  it('summarises real bookings, honest when thin', () => {
    const b = (d, price, down, extra = {}) => ({ bookingDate: d, price, down, ...extra })
    const r = downAvgAnswer([b('2026-11-01', 1000000, 100000, { financeAmount: 900000, installments: '72' }), b('2026-11-02', 1000000, 200000, { installments: 72 }), b('2026-11-03', 1000000, 0, { finStatus: 'ซื้อสด' }), b('2026-11-04', 900000, 0, { status: 'ถอนจอง' }), b('2026-11-05', 800000, 80000, { installments: 60 })], { today: '2026-11-28' })
    expect(r.n).toBe(4)
    expect(r.text).toContain('ดาวน์เฉลี่ย ฿126,667 ≈ 13%')
    expect(r.text).toContain('ผ่อนบ่อยสุด 72 งวด (2 จาก 3 ใบ)')
    expect(r.text).toContain('ซื้อสด 1 ใบ (25%)')
    expect(downAvgAnswer([b('2026-11-01', 1, 0)], { today: '2026-11-28' }).text).not.toContain('฿0')
  })
})

import { arrivedAnswer } from './opsQuestions.js'
describe('routing fixes (v1.0.1486)', () => {
  it('seller with no sales, arrivals yesterday', () => {
    expect(parseOpsSpec('เดือนนี้ใครยังไม่ได้ยอดเลย')?.kind).toBe('nobookseller')
    expect(parseOpsSpec('รถมาถึงเมื่อวานกี่คัน')).toMatchObject({ kind: 'arrived', days: 'yesterday' })
    expect(parseOpsSpec('รถเข้ามาใหม่เดือนนี้')).toMatchObject({ kind: 'arrived', days: 'month' })
    expect(parseOpsSpec('รถจะมาถึงเมื่อไหร่')?.kind).not.toBe('arrived')
    const r = arrivedAnswer([{ arrivedAt: '2026-11-27', model: 'S07' }, { arrivedAt: '2026-11-28', model: 'S05' }], { today: '2026-11-28', days: 'yesterday' })
    expect(r.n).toBe(1); expect(r.text).toContain('เมื่อวาน 1 คัน (27/11/2569)')
  })
})
