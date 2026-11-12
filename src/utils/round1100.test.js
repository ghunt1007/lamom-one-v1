import { describe, it, expect } from 'vitest'
import { parseOpsSpec, csatAnswer } from './opsQuestions.js'

const today = '2026-11-12'
describe('v1.0.1099 LAMI: customer satisfaction, service-check reminders', () => {
  it('parse', () => {
    expect(parseOpsSpec('ความพึงพอใจลูกค้าเดือนนี้')).toEqual({ kind: 'csat', prev: false, low: false })
    expect(parseOpsSpec('ลูกค้าคนไหนให้คะแนนต่ำ')).toEqual({ kind: 'csat', prev: false, low: true })
    expect(parseOpsSpec('มีรีวิวใหม่ไหม').kind).toBe('csat')
    expect(parseOpsSpec('ลูกค้าคนไหนใกล้ครบรอบเช็คระยะ').kind).toBe('reminder')
    expect(parseOpsSpec('เรื่องร้องเรียนค้างอยู่ไหม').kind).toBe('complaint')
  })
  it('answer', () => {
    const rows = [{ customer: 'A', csat: 5, nps: 10, date: '2026-11-02' }, { customer: 'B', csat: 2, nps: 3, comment: 'รอนาน', date: '2026-11-05' }, { customer: 'C', csat: 4, nps: 8, date: '2026-11-06' }]
    const r = csatAnswer(rows, { today })
    expect(r.text).toContain('คะแนนเฉลี่ย 3.7/5 · 📣 NPS 0')
    expect(r.text).toContain('• B · ⭐2/5 NPS 3 · "รอนาน"')
    expect(csatAnswer([], { today }).n).toBe(0)
  })
})
