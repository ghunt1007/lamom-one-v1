import { describe, it, expect } from 'vitest'
import { insightWeekLines, MORNING_CUSTOMER_FIELDS } from './daily-report.js'

const lead = (i, gapH, won, model = 'ATTO 3') => {
  const t = Date.parse('2026-08-01T03:00:00Z') + i * 3600000
  return { createdAt: new Date(t).toISOString(), firstContactAt: gapH == null ? null : new Date(t + gapH * 3600000).toISOString(), stage: won ? 'booking' : 'lead', source: 'Facebook', interestedModel: model }
}
describe('insightWeekLines (v1.0.1451)', () => {
  it('speed + hard model lines, nothing without data', () => {
    const list = [lead(-1, 0.1, false, ''), ...Array.from({ length: 15 }, (_, i) => lead(i, 0.5, i < 9, 'DEEPAL S07')), ...Array.from({ length: 15 }, (_, i) => lead(20 + i, null, i < 1))]
    expect(insightWeekLines(list, '2026-11-30')).toEqual([
      '⚡ ลีดที่โทรภายใน 1 ชม. ปิดได้ 60% · ช้ากว่า 24 ชม. 7% (30 ลีด)',
      '🚘 ATTO 3 คนสนใจ 15 ราย ปิดได้ 7% (ร้านเฉลี่ย 33%) — ดูโปร/ทดลองขับรุ่นนี้',
    ])
    expect(insightWeekLines([], '2026-11-30')).toEqual([])
    expect(MORNING_CUSTOMER_FIELDS).toContain('firstContactAt')
  })
})
