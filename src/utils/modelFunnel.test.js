import { describe, it, expect } from 'vitest'
import { modelFunnel, modelFunnelText } from './modelFunnel.js'
import { parseOpsSpec } from './opsQuestions.js'

const now = Date.parse('2026-11-28T00:00:00Z')
const c = (model, won, created = '2026-08-01T00:00:00Z') => ({ createdAt: created, interestedModel: model, stage: won ? 'booking' : 'lead' })
describe('modelFunnel (v1.0.1447)', () => {
  const list = [
    ...Array.from({ length: 12 }, (_, i) => c(i % 2 ? 'DEEPAL S07' : 'DEEPAL S07 Long Range', i < 6)),
    ...Array.from({ length: 15 }, (_, i) => c('ATTO 3', i < 1)),
    ...Array.from({ length: 5 }, () => c('SEAL', true)),
    c('ATTO 3', true, '2026-11-20T00:00:00Z'),
  ]
  it('groups long names, skips too-new and small models', () => {
    const r = modelFunnel(list, now)
    expect(r.n).toBe(32)
    expect(r.models.map(m => [m.label, m.n, m.won])).toEqual([['ATTO 3', 15, 1], ['DEEPAL S07', 12, 6]])
    const t = modelFunnelText(r)
    expect(t).toContain('• ATTO 3 สนใจ 15 ราย · ปิดได้ 7% ⚠️')
    expect(t).toContain('💡 ATTO 3 คนสนใจ 15 รายแต่ปิดได้แค่ 7%')
  })
  it('null when too few', () => {
    expect(modelFunnel(list.slice(0, 20), now)).toBeNull()
    expect(modelFunnelText(null)).toContain('ยังสรุปไม่ได้')
  })
  it('routes', () => {
    for (const q of ['รุ่นไหนคนสนใจเยอะสุด', 'รุ่นไหนปิดยากสุด', 'ลูกค้าสนใจรุ่นอะไรมากที่สุด']) expect(parseOpsSpec(q)?.kind, q).toBe('modelfunnel')
    expect(parseOpsSpec('รถรุ่นไหนเหลือน้อย')?.kind).toBe('lowstock')
  })
})
