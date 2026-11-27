import { describe, it, expect } from 'vitest'
import { parseOpsSpec, closeRateAnswer } from './opsQuestions.js'

describe('LAMI: which source closes best (v1.0.1420)', () => {
  it('routes source-performance questions to closerate', () => {
    for (const q of ['ช่องทางไหนปิดได้ดีสุด', 'ลีดจากไหนปิดได้จริง', 'ลูกค้าจากช่องทางไหนได้ผลที่สุด'])
      expect(parseOpsSpec(q)?.kind, q).toBe('closerate')
    expect(parseOpsSpec('ลูกค้าจากเฟสบุ๊คเดือนนี้กี่คน')?.kind).toBe('newcust')
  })
  it('lists sources with real close rates when there is enough history', () => {
    const today = '2026-11-20'
    const mk = (src, n, won) => Array.from({ length: n }, (_, i) => ({ id: src + i, source: src, createdAt: '2026-09-01T03:00:00Z', stage: i < won ? 'booking' : 'lead' }))
    const r = closeRateAnswer([...mk('Facebook', 20, 2), ...mk('Walk-in', 20, 10)], [], { today })
    expect(r.text).toContain('📣 ช่องทางที่ปิดได้จริง')
    expect(r.text.indexOf('Walk-in 50%')).toBeLessThan(r.text.indexOf('Facebook 10%'))
    expect(closeRateAnswer(mk('Facebook', 5, 1), [], { today }).text).not.toContain('📣')
  })
})
