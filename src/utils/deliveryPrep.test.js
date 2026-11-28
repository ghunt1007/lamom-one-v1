import { describe, it, expect } from 'vitest'
import { deliveryPrepRows, deliveryPrepText, deliveryPrepMorningLines, usedSteps, PREP_STEPS } from './deliveryPrep.js'
import { parseOpsSpec } from './opsQuestions.js'
import { buildMyDay, topPriorities } from './myDay.js'

const today = '2026-11-28'
const bookings = [
  { id: 'a', status: 'รอส่งมอบ', custName: 'ก', brand: 'DEEPAL', model: 'S07', deliveryDate: '2026-11-29', salesName: 'เอ', allocated: 'Y', vin: 'V1', insuranceNotified: 'Y', noticeNo: '' },
  { id: 'b', status: 'รอส่งมอบ', custName: 'ข', deliveryDate: '2026-11-30', allocated: 'Y', vin: 'V2', insuranceNotified: 'Y', noticeNo: 'N123', checklistDone: 'Y' },
  { id: 'c', status: 'รอรถ', custName: 'ค', deliveryDate: '2026-12-20' },
  { id: 'd', status: 'ส่งมอบแล้ว', custName: 'ง', actualDeliveryDate: '2026-11-20', dmsDelivered: 'Y' },
  { id: 'e', status: 'ถอนจอง', custName: 'จ', deliveryDate: '2026-11-29' },
]

describe('ติดตามงานเตรียมส่งมอบ (v1.0.1557)', () => {
  it('only checks columns the shop actually fills', () => {
    expect(usedSteps(bookings, PREP_STEPS).map(s => s.label)).toEqual(['Allocate', 'เลขตัวถัง', 'แจ้งประกัน', 'เลขรับแจ้ง', 'เช็ครายการ'])
  })
  it('lists cars being prepared with what is missing', () => {
    const { rows, incomplete } = deliveryPrepRows(bookings, { today })
    expect(rows.map(r => r.b.id)).toEqual(['a', 'b'])
    expect(incomplete.map(r => r.b.id)).toEqual(['a'])
    expect(rows[0].missing).toEqual(['เลขรับแจ้ง', 'เช็ครายการ'])
    const t = deliveryPrepText(bookings, { today }).text
    expect(t).toContain('ครบทุกขั้น 1 · ยังขาด 1')
    expect(t).toContain('ขาด: เลขรับแจ้ง, เช็ครายการ')
    expect(t).toContain('ส่งพรุ่งนี้')
  })
  it('focus on one step', () => {
    expect(deliveryPrepText(bookings, { today, focus: 'เลขรับแจ้ง' }).text).toContain('ยังไม่ได้เลขรับแจ้ง 1 จาก 2 คัน')
    expect(deliveryPrepText(bookings, { today, focus: 'แจ้งประกัน' }).text).toContain('ครบทุกคันแล้ว')
    expect(deliveryPrepText([{ status: 'รอส่งมอบ', deliveryDate: '2026-11-29' }], { today }).text).toContain('ยังไม่มีข้อมูลขั้นเตรียมส่งมอบ')
  })
  it('morning LINE lines', () => {
    const l = deliveryPrepMorningLines(bookings, today)
    expect(l[0]).toBe('🚗 เตรียมส่งมอบยังไม่ครบ 1 คัน')
    expect(l[1]).toContain('ขาด: เลขรับแจ้ง, เช็ครายการ')
  })
  it('LAMI routes', () => {
    expect(parseOpsSpec('รถเตรียมส่งมอบถึงขั้นตอนไหนแล้ว')).toEqual({ kind: 'prep' })
    expect(parseOpsSpec('แจ้งประกันหรือยัง')).toEqual({ kind: 'prep', focus: 'แจ้งประกัน' })
    expect(parseOpsSpec('ได้เลขรับแจ้งหรือยัง')).toEqual({ kind: 'prep', focus: 'เลขรับแจ้ง' })
    expect(parseOpsSpec('ประกันใครใกล้หมด')?.kind).toBe('insurance')
  })
  it('My Day shows missing steps and a priority', () => {
    const d = buildMyDay({ bookings }, { today })
    const a = d.deliveries.find(b => b.id === 'a')
    expect(a.prepMissing).toEqual(['เลขรับแจ้ง', 'เช็ครายการ'])
    expect(topPriorities(d, 10).some(p => p.key === 'prep:a')).toBe(true)
  })
})
