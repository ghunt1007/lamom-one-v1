import { describe, it, expect } from 'vitest'
import { monthlyFilings } from './TaxReport.js'

describe('TaxReport monthlyFilings', () => {
  it('makes 4 filings per period with the right due dates', () => {
    const f = monthlyFilings(['2026-12'])
    expect(f.map(x => x.type)).toEqual(['pp30', 'pnd1', 'pnd3', 'pnd53'])
    expect(f.find(x => x.type === 'pp30').dueDate).toBe('2027-01-15')
    expect(f.find(x => x.type === 'pnd1').dueDate).toBe('2027-01-07')
    expect(f.every(x => x.status === 'pending' && x.id.endsWith('-2026-12'))).toBe(true)
  })
  it('gives each period its own ids', () => {
    const ids = monthlyFilings(['2026-10', '2026-11']).map(x => x.id)
    expect(new Set(ids).size).toBe(8)
  })
})
