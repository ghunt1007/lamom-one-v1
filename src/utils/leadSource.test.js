import { describe, it, expect } from 'vitest'
import { sourceConversion, sourceAdjust, heuristicScore } from './leadScore.js'

const NOW = Date.UTC(2026, 10, 20)
const ago = d => new Date(NOW - d * 86400000).toISOString()
const mk = (src, n, won, age = 60) => Array.from({ length: n }, (_, i) => ({ source: src, createdAt: ago(age), stage: i < won ? 'booking' : 'lead' }))

describe('sourceConversion', () => {
  const list = [...mk('Facebook', 20, 2), ...mk('Walk-in', 20, 10), ...mk('TikTok', 5, 5)]
  it('rates per source with enough rows; overall uses all', () => {
    const c = sourceConversion(list, NOW)
    expect(c.overall).toBeCloseTo(17 / 45)
    expect(c.bySource.get('facebook').rate).toBeCloseTo(0.1)
    expect(c.bySource.get('walk-in').rate).toBeCloseTo(0.5)
    expect(c.bySource.has('tiktok')).toBe(false)
  })
  it('skips too new / too old / deleted, null when thin', () => {
    expect(sourceConversion([...mk('A', 40, 5, 10)], NOW)).toBeNull()
    expect(sourceConversion([...mk('A', 40, 5, 400)], NOW)).toBeNull()
    expect(sourceConversion(mk('A', 40, 5).map(c => ({ ...c, deleted: true })), NOW)).toBeNull()
  })
  it('adjusts score up for strong sources, down for weak, capped at 10', () => {
    const c = sourceConversion(list, NOW)
    expect(sourceAdjust({ source: 'walk-in ' }, c).adj).toBe(6)
    expect(sourceAdjust({ source: 'Facebook' }, c).adj).toBe(-10)
    expect(sourceAdjust({ source: 'TikTok' }, c)).toBeNull()
    const base = heuristicScore({ source: 'Walk-in', stage: 'lead' }, NOW).score
    const adj = heuristicScore({ source: 'Walk-in', stage: 'lead' }, NOW, { conv: c })
    expect(adj.score).toBe(base + 6)
    expect(adj.signals.join(' ')).toContain('ปิดได้จริง 50%')
  })
  it('odd input is safe', () => { expect(sourceConversion([null, { source: {} , createdAt: 'x' }], NOW)).toBeNull() })
})
