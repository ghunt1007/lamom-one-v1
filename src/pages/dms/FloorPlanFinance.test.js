import { describe, it, expect } from 'vitest'
import { splitFloorPlanDocs } from './FloorPlanFinance.js'

describe('FloorPlanFinance settings doc', () => {
  it('keeps the settings doc out of the unit list', () => {
    const { cfg, units } = splitFloorPlanDocs([
      { id: 'settings-c1', kind: 'settings', creditLine: 1000, rate: 5 },
      { id: 'u1', principal: 500, status: 'active' },
    ])
    expect(cfg.creditLine).toBe(1000)
    expect(units.map(u => u.id)).toEqual(['u1'])
  })
  it('works with no settings yet', () => {
    expect(splitFloorPlanDocs([]).cfg).toBe(null)
  })
})
