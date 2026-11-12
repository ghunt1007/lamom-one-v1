import { describe, it, expect } from 'vitest'
import { parseOpsSpec, claimAnswer, partsLowAnswer, serviceRevAnswer, yesterdayAnswer, referAskAnswer, eventBestAnswer, campaignBestAnswer, annivAnswer, newCustomerAnswer } from './opsQuestions.js'
import { isIncomeQuestion } from './incomeBrief.js'

const today = '2026-11-12'
describe('v1.0.1094 service / marketing questions', () => {
  it('routes', () => {
    expect(parseOpsSpec('เคลมประกันค้างกี่เรื่อง')).toEqual({ kind: 'claim' })
    expect(parseOpsSpec('อะไหล่ไหนใกล้หมด')).toEqual({ kind: 'parts' })
    expect(parseOpsSpec('รถรออะไหล่มีคันไหน').kind).toBe('service')
    expect(parseOpsSpec('รายได้ศูนย์บริการเดือนนี้')).toEqual({ kind: 'servicerev', prev: false })
    expect(isIncomeQuestion('รายได้ศูนย์บริการเดือนนี้')).toBe(false)
    expect(isIncomeQuestion('รายได้เดือนนี้')).toBe(true)
    expect(parseOpsSpec('เมื่อวานมีอะไรเกิดขึ้นบ้าง')).toEqual({ kind: 'yesterday' })
    expect(parseOpsSpec('ลูกค้าที่ควรขอให้แนะนำเพื่อน')).toEqual({ kind: 'referask' })
    expect(parseOpsSpec('ออกบูธครั้งไหนได้ลีดเยอะสุด')).toEqual({ kind: 'eventbest' })
    expect(parseOpsSpec('ลีดจากบูธล่าสุดกี่คน').kind).toBe('newcust')
    expect(parseOpsSpec('แคมเปญไหนได้ลูกค้าเยอะสุด')).toEqual({ kind: 'campaignbest' })
    expect(parseOpsSpec('มีลูกค้าใหม่วันนี้ไหม')).toMatchObject({ kind: 'newcust', period: 'today' })
    expect(parseOpsSpec('ใครครบรอบซื้อรถเดือนหน้า')).toMatchObject({ kind: 'anniv', nextMonth: true })
  })
  it('answers', () => {
    expect(claimAnswer([{ customer: 'ก', status: 'surveying', reported: '2026-10-01' }, { status: 'completed' }], { today }).text).toMatch(/เคลมประกันค้าง 1 เรื่อง[\s\S]*42 วัน/)
    expect(partsLowAnswer([{ name: 'ผ้าเบรก', qty: 0, minQty: 2 }, { name: 'น้ำมัน', qty: 10, minQty: 2 }]).text).toContain('หมดแล้ว 1')
    expect(serviceRevAnswer([{ status: 'done', labor: 1500, updatedAt: '2026-11-05', createdAt: '2026-11-01' }, { status: 'in_progress', createdAt: '2026-11-03' }], { today }).text).toContain('฿1,500')
    const y = yesterdayAnswer({ customers: [{ createdAt: '2026-11-11T05:00:00Z' }], bookings: [{ custName: 'ข', bookingDate: '2026-11-11', status: 'รอรถ' }] }, { today })
    expect(y.text).toContain('🧲 ลูกค้าใหม่ 1 คน'); expect(y.text).toContain('📝 จองใหม่ 1 ใบ')
    const r = referAskAnswer([{ custName: 'ค', status: 'ส่งมอบแล้ว', deliveryDate: '2026-10-01' }, { custName: 'ง', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-10' }, { custName: 'จ', status: 'ส่งมอบแล้ว', deliveryDate: '2026-10-02' }], { today, complainedNames: new Set(['จ']) })
    expect(r.n).toBe(1)
    const e = eventBestAnswer([{ title: 'บูธ A', startDate: '2026-10-01' }, { title: 'บูธ B', startDate: '2026-10-05' }, { title: 'อนาคต', startDate: '2026-12-01' }], ev => ({ leads: ev.title === 'บูธ A' ? 5 : 9, bookings: ev.title === 'บูธ A' ? 2 : 1, cost: 10000, costPerLead: ev.title === 'บูธ A' ? 2000 : 1111 }), { today })
    expect(e.n).toBe(2); expect(e.text).toMatch(/1\. บูธ A/); expect(e.text).toContain('บูธ B ได้ Lead ถูกสุด')
    expect(campaignBestAnswer([{ campaign: 'ฟรีดาวน์', bookingDate: '2026-10-01', status: 'รอรถ' }], { today }).text).toContain('ฟรีดาวน์ — จอง 1')
    const a = annivAnswer([{ custName: 'ฉ', status: 'ส่งมอบแล้ว', deliveryDate: '2025-12-20' }, { custName: 'ช', status: 'ส่งมอบแล้ว', deliveryDate: '2025-11-20' }], { today, nextMonth: true })
    expect(a.text).toContain('01/12/2569–31/12/2569'); expect(a.n).toBe(1)
    expect(newCustomerAnswer([{ createdAt: '2026-11-12' }, { createdAt: '2026-11-11' }], { today, period: 'today' }).text).toContain('ลูกค้าใหม่วันนี้ 1 คน')
  })
})
