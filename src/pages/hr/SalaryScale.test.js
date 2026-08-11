import { describe, it, expect } from 'vitest'
import { compaRatio, marketRatio, SALARY_GRADES } from './SalaryScale.js'

describe('compaRatio', () => {
  it('returns 100 when salary equals the grade midpoint', () => {
    const g2 = SALARY_GRADES.find(g => g.grade === 'G2')
    expect(compaRatio(g2.midpoint, 'G2')).toBe(100)
  })

  it('returns >100 when salary is above midpoint', () => {
    const g3 = SALARY_GRADES.find(g => g.grade === 'G3')
    expect(compaRatio(g3.midpoint * 1.1, 'G3')).toBe(110)
  })

  it('returns <100 when salary is below midpoint', () => {
    const g1 = SALARY_GRADES.find(g => g.grade === 'G1')
    expect(compaRatio(g1.midpoint * 0.8, 'G1')).toBe(80)
  })

  it('falls back to 100 for an unknown grade', () => {
    expect(compaRatio(50000, 'G99')).toBe(100)
  })
})

describe('marketRatio', () => {
  it('returns 100 when salary matches the market reference', () => {
    expect(marketRatio(30000, 30000)).toBe(100)
  })

  it('returns the correct percentage above/below market', () => {
    expect(marketRatio(33000, 30000)).toBe(110)
    expect(marketRatio(27000, 30000)).toBe(90)
  })
})
