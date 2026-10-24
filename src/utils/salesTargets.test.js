import { describe, it, expect } from 'vitest'
import { targetFor, goalProgress } from './salesTargets.js'

describe('sales targets', () => {
  it('finds a target ignoring titles and spacing', () => {
    const t = { 'วิชัย ใจดี': 5, Napa: '3' }
    expect(targetFor(t, 'คุณวิชัย  ใจดี')).toBe(5)
    expect(targetFor(t, 'napa')).toBe(3)
    expect(targetFor(t, 'ไม่มี')).toBe(0)
    expect(targetFor(null, 'x')).toBe(0)
  })
  it('computes progress', () => {
    expect(goalProgress(3, 5)).toEqual({ done: 3, target: 5, pct: 60, left: 2, color: 'danger' })
    expect(goalProgress(6, 5).color).toBe('success')
    expect(goalProgress(1, 0).pct).toBe(0)
  })
})
