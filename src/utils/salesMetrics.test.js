import { describe, it, expect } from 'vitest'
import { computeSalesMetrics, periodRange, buyerType } from './salesMetrics.js'

const today = '2026-11-15'
const bookings = [
  { id: 'b1', bookingDate: '2026-11-02', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-11-10', price: 1000000, cost: 900000, comFinance: 20000, salesName: 'เอ', customerId: 'c1', brand: 'DEEPAL', model: 'S07', accessoryAmount: 15000 },
  { id: 'b2', bookingDate: '2026-11-05', status: 'รอรถ', price: 1200000, salesName: 'บี', custName: 'บริษัท ทดสอบ จำกัด', brand: 'DEEPAL', model: 'S07' },
  { id: 'b3', bookingDate: '2026-11-06', status: 'ถอนจอง', price: 999999, salesName: 'เอ' },
  { id: 'b4', bookingDate: '2026-10-20', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-10-25', price: 800000, salesName: 'เอ', custName: 'เทศบาลเมือง' },
  { id: 'b5', bookingDate: '2025-03-01', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2025-03-10', price: 900000, salesName: 'เอ', phone: '0811111111' },
]
const customers = [
  { id: 'c1', createdAt: '2026-11-01T03:00:00Z', stage: 'delivered', assignedTo: 'เอ', phone: '081', lastContactAt: '2026-11-14' },
  { id: 'c2', createdAt: '2026-11-03T03:00:00Z', stage: 'pp', temperature: 'hot', assignedTo: 'บี', phone: '082', interestedModel: 'S07', budget: 1 },
  { id: 'c3', createdAt: '2026-11-04T03:00:00Z', stage: 'lead', assignedTo: 'เอ' },
  { id: 'c4', createdAt: '2026-08-01T03:00:00Z', stage: 'lead', assignedTo: 'เอ', isLost: true },
]
const src = { bookings, customers, budget: { targets: Array(12).fill(2000000), units: Array(12).fill(4) }, vehicles: [{ brand: 'DEEPAL', model: 'S07', price: 1000000 }], jobCards: [{ phone: '0899999999', createdAt: '2026-10-01', labor: 1000 }], testDrives: [{ staff: 'บี', date: '2026-11-04' }] }

describe('sales metrics', () => {
  const m = computeSalesMetrics(src, { today })
  it('target, GMV and AOV for this month (cancelled excluded)', () => {
    expect(m.units).toEqual({ booked: 2, delivered: 1, cancelled: 1 })
    expect(m.gmv).toBe(2200000)
    expect(m.target).toEqual({ revenue: 2000000, units: 4, revenuePct: 110, unitsPct: 50 })
    expect(m.aov).toBe(1100000)
  })
  it('GP uses real cost and RevShare finance commission', () => {
    expect(m.grossProfit).toMatchObject({ value: 100000, pct: 10, estimated: 0, units: 1 })
    expect(m.revShare.finance).toBe(20000)
  })
  it('pipeline, conversion, cycle, lead/prospect', () => {
    expect(m.pipeline).toMatchObject({ lead: 1, prospect: 1, booking: 1, delivered: 1, lost: 1 })
    expect(m.conversion).toMatchObject({ leads: 3, won: 1 })
    expect(m.conversion.pct).toBe(33.3)
    expect(m.salesCycle.avg).toBe(1)
    expect(m.prospect.hot).toBe(1)
  })
  it('buyer mix, cross-sell, up-sell', () => {
    expect(m.mix.B2B.n).toBe(1)
    expect(m.mix.B2C.n).toBe(1)
    expect(m.crossSell.n).toBe(1)
    expect(m.upSell).toMatchObject({ n: 1, checked: 2 })
  })
  it('KPI per salesperson', () => {
    const b = m.kpi.find(k => k.name === 'บี')
    expect(b).toMatchObject({ leads: 1, testDrives: 1, bookings: 1 })
  })
  it('churn counts buyers who never came back, LTV averages per buyer', () => {
    expect(m.churn).toMatchObject({ cohort: 1, lost: 1, pct: 100 })
    expect(m.ltv.buyers).toBe(4)
  })
  it('forecast is never below what is already booked', () => {
    expect(m.forecast.units).toBeGreaterThanOrEqual(2)
  })
  it('filter by salesperson hides company target', () => {
    const a = computeSalesMetrics(src, { today, who: 'เอ' })
    expect(a.units.booked).toBe(1)
    expect(a.target.revenue).toBe(null)
  })
  it('periods', () => {
    expect(periodRange('prev', '2026-01-10')).toMatchObject({ from: '2025-12-01', to: '2025-12-31' })
    expect(periodRange('quarter', '2026-11-15').months).toEqual([10, 11])
    expect(computeSalesMetrics(src, { today, period: 'prev' }).mix.B2G.n).toBe(1)
  })
  it('buyer type from name', () => {
    expect(buyerType({ custName: 'หจก. รุ่งเรือง' })).toBe('B2B')
    expect(buyerType({ custName: 'องค์การบริหารส่วนตำบลบางบัวทอง' })).toBe('B2G')
    expect(buyerType({ custName: 'สมชาย ใจดี' })).toBe('B2C')
  })
})
