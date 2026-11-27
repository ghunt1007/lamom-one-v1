import { describe, it, expect } from 'vitest'
import { incomePerCar, incomeForecast, incomeForecastLine, incomeForecastNote } from './incomeForecast.js'

const T = '2026-11-20'
const del = (id, cut, inc, com = 0) => ({ id, status: 'ส่งมอบแล้ว', bookingDate: '2026-07-01', cutDate: cut, totalIncome: inc, com70: com })

describe('incomePerCar', () => {
  it('averages filled deliveries of the 3 full months before', () => {
    const p = incomePerCar([del('a', '2026-10-05', 30000, 5000), del('b', '2026-09-05', 10000, 3000), del('c', '2026-08-05', 20000, 1000),
      del('old', '2026-07-05', 999999), del('now', '2026-11-05', 999999), del('empty', '2026-10-06', 0)], T)
    expect(p.n).toBe(3)
    expect(p.income).toBe(20000)
    expect(p.com70).toBe(3000)
  })
  it('ignores deleted and cancelled', () => {
    expect(incomePerCar([{ ...del('a', '2026-10-05', 30000), deleted: true }, { ...del('b', '2026-10-05', 30000), status: 'ถอนจอง' }], T).n).toBe(0)
  })
})

describe('incomeForecast', () => {
  const hist = [del('a', '2026-10-05', 30000, 5000), del('b', '2026-09-05', 10000, 3000), del('c', '2026-08-05', 20000, 1000)]
  it('null when history too thin (no guessing)', () => {
    expect(incomeForecast({ bookings: hist.slice(0, 2), today: T })).toBeNull()
  })
  it('so-far income + missing cars + expected extra cars at avg', () => {
    const fc = { delivered: 2, expectedRaw: 4.5, worst: 3, best: 6 }
    const bk = [...hist, del('m1', '2026-11-03', 50000, 4000), del('m2', '2026-11-04', 0)]
    const x = incomeForecast({ bookings: bk, today: T, fc })
    expect(x.soFar).toBe(50000)
    expect(x.missing).toBe(1)
    expect(x.moreCars).toBe(2.5)
    expect(x.expected).toBe(50000 + 20000 + 2.5 * 20000)
    expect(x.low).toBe(50000 + 20000 + 1 * 20000)
    expect(x.high).toBe(50000 + 20000 + 4 * 20000)
    expect(x.com70).toBe(15000) // 14,500 ปัดหลักพัน
    expect(incomeForecastLine(x)).toContain('฿120,000')
    expect(incomeForecastNote(x)).toContain('ยังไม่กรอกรายได้')
  })
  it('works end to end with the real delivery forecast', () => {
    const x = incomeForecast({ bookings: [...hist, { id: 'o', status: 'รอส่งมอบ', bookingDate: '2026-11-01', deliveryDate: '2026-11-25' }], today: T })
    expect(x).not.toBeNull()
    expect(x.expected).toBeGreaterThanOrEqual(x.low)
    expect(x.high).toBeGreaterThanOrEqual(x.expected)
  })
  it('empty line for null', () => { expect(incomeForecastLine(null)).toBe(''); expect(incomeForecastNote(null)).toBe('') })
})

import { incomeStats, incomeBriefText } from './incomeBrief.js'
describe('LAMI income answer', () => {
  const hist = [del('a', '2026-10-05', 30000, 5000), del('b', '2026-09-05', 10000, 3000), del('c', '2026-08-05', 20000, 1000)]
  it('adds the month-end forecast line for this month only', () => {
    const bk = [...hist, del('m1', '2026-11-03', 50000, 4000)]
    expect(incomeBriefText(incomeStats({ bookings: bk, today: T }))).toContain('🔮 คาดรายได้สิ้นเดือน')
    expect(incomeBriefText(incomeStats({ bookings: bk, today: '2026-12-10', prev: true }))).not.toContain('🔮')
  })
})
