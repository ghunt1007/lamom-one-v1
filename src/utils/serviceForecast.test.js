import { describe, it, expect } from 'vitest'
import { serviceForecast } from './serviceForecast.js'

const T = '2026-11-20'
const rem = (due, booked) => ({ dueDate: due, booked })
const hist = [...Array.from({ length: 8 }, () => rem('2026-09-10', true)), ...Array.from({ length: 12 }, () => rem('2026-10-10', false))] // 8/20 = 40%

describe('serviceForecast', () => {
  it('next-month due × past booking rate', () => {
    const f = serviceForecast({ reminders: [...hist, ...Array.from({ length: 10 }, () => rem('2026-12-05', false)), rem('2027-01-01', false)], today: T })
    expect(f).toMatchObject({ next: '2026-12', due: 10, expected: 4, histN: 20 })
    expect(f.rate).toBeCloseTo(0.4)
    expect(f.revenue).toBeNull()
  })
  it('null when too little history', () => {
    expect(serviceForecast({ reminders: hist.slice(0, 5), today: T })).toBeNull()
  })
  it('revenue from average service job of last 3 months', () => {
    const jobs = Array.from({ length: 5 }, (_, i) => ({ type: 'service', total: 2000 + i * 500, m: '2026-10' }))
    const f = serviceForecast({ reminders: [...hist, ...Array.from({ length: 10 }, () => rem('2026-12-05'))], jobs, today: T, amountOf: j => j.total, jobMonthOf: j => j.m })
    expect(f.avg).toBe(3000)
    expect(f.revenue).toBe(12000)
  })
})
