import { describe, it, expect } from 'vitest'
import { leadsForCar, leadCountByModel } from './stockLeads.js'

const car = { brand: 'DEEPAL', model: 'S07', color: 'ขาว' }
const cs = [
  { id: 1, stage: 'lead', interestedModel: 'Deepal S07', temperature: 'cold' },
  { id: 2, stage: 'pp', interestedModel: 'S07', temperature: 'hot' },
  { id: 3, stage: 'pp', interestedModel: 'S07', temperature: 'warm', interestedColor: 'ขาว' },
  { id: 4, stage: 'booking', interestedModel: 'S07' },
  { id: 5, stage: 'lead', interestedModel: 'S07', isLost: true },
  { id: 6, stage: 'lead', interestedModel: 'L07' },
  { id: 7, stage: 'lead', interestedModel: 'S07', deleted: true },
  null,
]
describe('stock ↔ interested leads', () => {
  it('matches open leads by model key, colour match first then temperature', () => {
    expect(leadsForCar(car, cs).map(x => x.c.id)).toEqual([3, 2, 1])
  })
  it('counts per model', () => {
    const m = leadCountByModel(cs)
    expect(m.get('s07')).toBe(3)
    expect(m.get('l07')).toBe(1)
  })
  it('no model → none', () => { expect(leadsForCar({ brand: 'DEEPAL' }, cs)).toEqual([]) })
})
