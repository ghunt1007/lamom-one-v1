import { describe, it, expect } from 'vitest'
import { getVehicles, getBrands, dealerRank } from './vehicleDatabase.js'

describe('dealer brands first', () => {
  it('ranks showroom brands before others', () => {
    expect(dealerRank('Deepal')).toBe(0)
    expect(dealerRank('OMODA & JAECOO')).toBeLessThan(dealerRank('Toyota'))
  })
  it('getVehicles starts with a showroom brand and keeps every vehicle', () => {
    const vs = getVehicles()
    expect(dealerRank(vs[0].brand)).toBeLessThan(6)
    expect(new Set(vs.map(v => v.id)).size).toBe(vs.length)
    expect(getBrands()[0].toLowerCase()).toContain('deepal')
  })
})
