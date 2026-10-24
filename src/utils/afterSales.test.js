import { describe, it, expect, vi, beforeEach } from 'vitest'
const calls = []
vi.mock('../core/db.js', () => ({
  createDoc: vi.fn(async (c, d) => { calls.push(['create', c, d]); return 'x' }),
  updateDocData: vi.fn(async (c, id, d) => { calls.push(['update', c, id, d]) }),
}))
vi.mock('../core/companyScope.js', () => ({ myEffectiveCompanyId: () => 'me', companyScopeFilters: () => [] }))
const { buildAfterSalesFollowups, scheduleAfterSales } = await import('./afterSales.js')
beforeEach(() => { calls.length = 0 })

describe('after-sales follow-ups', () => {
  const b = { id: 'B1', customerId: 'C1', custName: 'ก', brand: 'BYD', model: 'Seal', salesName: 'วิชัย', actualDeliveryDate: '2026-10-20', companyId: 'c1' }
  it('plans 7/30/180 days after delivery', () => {
    const f = buildAfterSalesFollowups(b, '2026-10-25')
    expect(f.map(x => x.dueDate)).toEqual(['2026-10-27', '2026-11-19', '2027-04-18'])
    expect(f[0]).toMatchObject({ sourceBookingId: 'B1', customerId: 'C1', salesperson: 'วิชัย', vehicleModel: 'BYD Seal', status: 'pending' })
  })
  it('uses today when no delivery date and skips old or already scheduled deliveries', () => {
    expect(buildAfterSalesFollowups({ id: 'B2' }, '2026-10-25')[0].dueDate).toBe('2026-11-01')
    expect(buildAfterSalesFollowups({ ...b, actualDeliveryDate: '2026-09-01' }, '2026-10-25')).toEqual([])
    expect(buildAfterSalesFollowups({ ...b, afterSalesScheduled: true }, '2026-10-25')).toEqual([])
    expect(buildAfterSalesFollowups(null)).toEqual([])
  })
  it('creates them once and marks the booking', async () => {
    const bk = { id: 'B3', companyId: 'c1' }
    expect(await scheduleAfterSales(bk)).toBe(3)
    expect(calls.filter(c => c[0] === 'create')[0][2].companyId).toBe('c1')
    expect(calls.at(-1)).toEqual(['update', 'bookings', 'B3', { afterSalesScheduled: true }])
    expect(await scheduleAfterSales(bk)).toBe(0)
  })
})
