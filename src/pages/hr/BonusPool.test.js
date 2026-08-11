import { describe, it, expect } from 'vitest'
import { calcBonus, kpiColor, kpiGrade } from './BonusPool.js'

describe('calcBonus', () => {
  it('pays full rate (100%) at KPI >= 90', () => {
    expect(calcBonus({ base: 30000, multiplier: 1, kpi: 90 })).toBe(30000)
    expect(calcBonus({ base: 30000, multiplier: 1, kpi: 100 })).toBe(30000)
  })

  it('pays 80% rate for KPI in [80, 90)', () => {
    expect(calcBonus({ base: 30000, multiplier: 1, kpi: 80 })).toBe(24000)
    expect(calcBonus({ base: 30000, multiplier: 1, kpi: 89 })).toBe(24000)
  })

  it('pays 60% rate for KPI in [70, 80)', () => {
    expect(calcBonus({ base: 30000, multiplier: 1, kpi: 70 })).toBe(18000)
  })

  it('pays 40% rate for KPI below 70', () => {
    expect(calcBonus({ base: 30000, multiplier: 1, kpi: 0 })).toBe(12000)
    expect(calcBonus({ base: 30000, multiplier: 1, kpi: 69 })).toBe(12000)
  })

  it('scales with multiplier', () => {
    expect(calcBonus({ base: 30000, multiplier: 2, kpi: 90 })).toBe(60000)
  })

  it('rounds to the nearest integer', () => {
    expect(calcBonus({ base: 33333, multiplier: 1, kpi: 70 })).toBe(Math.round(33333 * 0.6))
  })
})

describe('kpiColor', () => {
  it('is success at 90+', () => {
    expect(kpiColor(90)).toBe('var(--success)')
  })
  it('is warning in [75, 90)', () => {
    expect(kpiColor(75)).toBe('var(--warning)')
    expect(kpiColor(89)).toBe('var(--warning)')
  })
  it('is danger below 75', () => {
    expect(kpiColor(74)).toBe('var(--danger)')
    expect(kpiColor(0)).toBe('var(--danger)')
  })
})

describe('kpiGrade', () => {
  it('grades A/B/C/D at the documented thresholds', () => {
    expect(kpiGrade(90)).toBe('A')
    expect(kpiGrade(80)).toBe('B')
    expect(kpiGrade(89)).toBe('B')
    expect(kpiGrade(70)).toBe('C')
    expect(kpiGrade(79)).toBe('C')
    expect(kpiGrade(69)).toBe('D')
    expect(kpiGrade(0)).toBe('D')
  })
})
