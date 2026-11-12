import { describe, it, expect } from 'vitest'
import { briefTarget, customerBrief } from './customerBrief.js'
import { parseOpsSpec } from './opsQuestions.js'

const cs = [{ id: 'a', firstName: 'มานะ', lastName: 'สมมติ', phone: '0890000027', stage: 'pp', temperature: 'hot', assignedTo: 'เซลส์ สอง', interestedModel: 'AION V' }]
const today = '2026-11-12'
describe('v1.0.1101 per-customer field questions', () => {
  it('targets', () => {
    for (const q of ['มานะสนใจรุ่นอะไร', 'เบอร์มานะ', 'มานะอยู่กับเซลส์คนไหน', 'ใบจองของมานะ', 'มานะทดลองขับแล้วหรือยัง', 'มานะรอไฟแนนซ์อะไร']) expect(briefTarget(q, cs)?.id, q).toBe('a')
    for (const q of ['มานะเบอร์ 0812345678', 'นัดลองขับ มานะ เสาร์บ่าย 2', 'มานะ ไฟแนนซ์ผ่าน', 'มานะสนใจ AION V']) expect(briefTarget(q, cs), q).toBeNull()
    expect(parseOpsSpec('มานะทดลองขับแล้วหรือยัง')).toBeNull()
    expect(parseOpsSpec('นัดทดลองขับวันนี้มีใครบ้าง').kind).toBe('testdrive')
  })
  it('brief lines', () => {
    const t = customerBrief({ customer: cs[0], followups: [], today, drives: [{ customerName: 'มานะ สมมติ', date: '2026-11-01', model: 'AION V' }] })
    expect(t).toContain('☎️ 0890000027 · 👤 ผู้ดูแล เซลส์ สอง')
    expect(t).toContain('🚗 ทดลองขับแล้ว 01/11/2569 · AION V')
    expect(customerBrief({ customer: cs[0], followups: [], today, drives: [] })).toContain('🚗 ยังไม่เคยทดลองขับ')
  })
})

import { closeRateAnswer } from './opsQuestions.js'
describe('v1.0.1102 close rate with no bookings', () => {
  it('says no bookings', () => {
    expect(closeRateAnswer([], [], { today }).text).toContain('⏱ เดือนนี้ยังไม่มีใบจอง')
  })
})
