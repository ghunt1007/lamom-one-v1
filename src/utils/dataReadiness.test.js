import { describe, it, expect } from 'vitest'
import { dataReadiness } from './dataReadiness.js'
import { readinessHtml } from './forecastHubView.js'

const now = Date.parse('2026-11-28T00:00:00Z')
describe('dataReadiness (v1.0.1449)', () => {
  it('rates per field, lowest first, skips small samples, price only with money', () => {
    const customers = Array.from({ length: 10 }, (_, i) => ({ createdAt: '2026-11-01T00:00:00Z', interestedModel: i < 4 ? 'S07' : '' }))
    const logs = Array.from({ length: 6 }, (_, i) => ({ type: 'call', createdAt: '2026-11-10T03:00:00Z', note: i < 5 ? 'คุยแล้ว' : 'โทรเอง' }))
    const bookings = Array.from({ length: 5 }, (_, i) => ({ bookingDate: '2026-11-05', price: i ? '1,000,000' : '' }))
    const r = dataReadiness({ customers, logs, bookings, testDrives: [{ date: '2026-11-01', status: 'done' }], now })
    expect(r.map(i => [i.key, i.done, i.n])).toEqual([['model', 4, 10], ['calls', 5, 6]])
    expect(dataReadiness({ customers, logs, bookings, now, money: true }).map(i => i.key)).toEqual(['model', 'price', 'calls'])
    const html = readinessHtml(r)
    expect(html).toContain('40%')
    expect(html).toContain('วิธี: ใส่รุ่นตอนเพิ่มลีด')
    expect(readinessHtml([])).toBe('')
  })
})
