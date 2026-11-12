import { describe, it, expect } from 'vitest'
import { batStatus, latestBatteries } from './evBattery.js'
describe('evBattery', () => {
  it('status', () => { expect(batStatus(97)).toBe('excellent'); expect(batStatus(90)).toBe('good'); expect(batStatus(82)).toBe('fair'); expect(batStatus(70)).toBe('warning') })
  it('latest per VIN, lowest first', () => {
    const r = latestBatteries([
      { vin: 'A1', health: 90, checkDate: '2026-01-01' }, { vin: 'a1', health: 85, checkDate: '2026-06-01' },
      { vin: 'B2', health: 99, checkDate: '2026-05-01' }, { vin: 'C3', health: 50, deleted: true }, { health: 10 },
    ])
    expect(r.map(x => [x.vin, x.health])).toEqual([['a1', 85], ['B2', 99]])
  })
})
