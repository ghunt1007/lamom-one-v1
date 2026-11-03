import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ listDocs: vi.fn() }))
vi.mock('../core/companyScope.js', () => ({ companyScopeFilters: () => [] }))
import { budgetFromDoc, sumMonths } from './salesBudget.js'

describe('salesBudget', () => {
  it('reads 12-month arrays and ignores bad ones', () => {
    const b = budgetFromDoc({ id: 'x', targets: Array(12).fill(10), units: [1, 2] })
    expect(b.targets.length).toBe(12)
    expect(b.units).toBe(null)
    expect(budgetFromDoc(null).targets).toBe(null)
  })
  it('sums a quarter and returns null when nothing is set', () => {
    const t = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    expect(sumMonths(t, 4, 6)).toBe(15)
    expect(sumMonths(t)).toBe(78)
    expect(sumMonths(null, 1, 3)).toBe(null)
    expect(sumMonths(Array(12).fill(0), 1, 3)).toBe(null)
  })
})
