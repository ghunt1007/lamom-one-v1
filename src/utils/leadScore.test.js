import { describe, it, expect } from 'vitest'
import { heuristicScore } from './leadScore.js'

const NOW = Date.parse('2026-10-26T03:00:00Z')
describe('heuristicScore', () => {
  it('uses the temperature field customers really have', () => {
    expect(heuristicScore({ temperature: 'hot', interestedModel: 'S07' }, NOW).score).toBeGreaterThanOrEqual(80)
    expect(heuristicScore({ temperature: 'cold' }, NOW).score).toBeLessThan(40)
  })
  it('keeps the old status field working', () => {
    expect(heuristicScore({ status: 'vip' }, NOW).score).toBe(90)
  })
  it('lost deals score 5', () => {
    expect(heuristicScore({ temperature: 'hot', isLost: true }, NOW).score).toBe(5)
  })
  it('recent contact adds, long silence subtracts', () => {
    const fresh = heuristicScore({ temperature: 'warm', lastContactAt: '2026-10-25T03:00:00Z' }, NOW).score
    const old = heuristicScore({ temperature: 'warm', lastContactAt: '2026-09-01T03:00:00Z' }, NOW).score
    expect(fresh).toBe(65)
    expect(old).toBe(50)
  })
  it('clamps to 100', () => {
    expect(heuristicScore({ status: 'vip', stage: 'pp', interestedModel: 'x', budget: 900000, occupation: 'x', monthlyIncome: 100000, lastContactAt: '2026-10-25T03:00:00Z' }, NOW).score).toBe(100)
  })
})
