import { describe, it, expect } from 'vitest'
import { autoStatus, eventsForLeadTag, eventDays, eventMetrics, normalizeEvent, eventCalendarItems } from './marketingEvents.js'
import { buildWorkItems } from './workCalendar.js'

const ev = o => ({ id: 'e1', title: 'บูธเวสต์เกต', type: 'booth', status: 'confirmed', startDate: '2026-11-10', endDate: '2026-11-12', ...o })

describe('marketing events', () => {
  it('status follows the dates', () => {
    expect(autoStatus(ev(), '2026-11-09')).toBe('confirmed')
    expect(autoStatus(ev(), '2026-11-11')).toBe('ongoing')
    expect(autoStatus(ev(), '2026-11-13')).toBe('done')
    expect(autoStatus(ev({ status: 'cancelled' }), '2026-11-11')).toBe('cancelled')
  })
  it('lead tagging offers ongoing events and ones that ended yesterday', () => {
    const list = [ev(), ev({ id: 'e2', startDate: '2026-11-01', endDate: '2026-11-01' }), ev({ id: 'e3', status: 'cancelled' })]
    expect(eventsForLeadTag(list, '2026-11-11').map(e => e.id)).toEqual(['e1'])
    expect(eventsForLeadTag(list, '2026-11-13').map(e => e.id)).toEqual(['e1'])
    expect(eventsForLeadTag(list, '2026-11-14')).toEqual([])
  })
  it('days across month end', () => {
    expect(eventDays(ev({ startDate: '2026-11-30', endDate: '2026-12-02' }))).toEqual(['2026-11-30', '2026-12-01', '2026-12-02'])
    expect(eventDays(ev({ endDate: '' }))).toEqual(['2026-11-10'])
  })
  it('metrics only count customers tagged with this event', () => {
    const customers = [{ id: 'c1', eventId: 'e1', stage: 'booking' }, { id: 'c2', eventId: 'e1', stage: 'lead' }, { id: 'c3', eventId: 'other' }]
    const bookings = [{ id: 'b1', customerId: 'c1', status: 'ส่งมอบแล้ว', price: 1000000 }, { id: 'b2', customerId: 'c3', price: 900000 }, { id: 'b3', customerId: 'c2', status: 'ถอนจอง', price: 1 }]
    const testDrives = [{ customerId: 'c1' }, { customerId: 'c1' }, { customerId: 'c2', status: 'cancelled' }]
    const m = eventMetrics(ev({ spent: 50000, targetLeads: 4, extraLeads: 2 }), { customers, bookings, testDrives })
    expect([m.leads, m.leadsInSystem, m.prospects, m.testDrives, m.bookings, m.delivered, m.revenue]).toEqual([4, 2, 1, 1, 1, 1, 1000000])
    expect([m.costPerLead, m.costPerBooking, m.leadTargetPct, m.roi]).toEqual([12500, 50000, 100, 20])
  })
  it('normalize swaps dates and splits staff', () => {
    const n = normalizeEvent({ title: ' a ', startDate: '2026-11-12', endDate: '2026-11-10', staff: 'ก, ข,ก', budget: '5000', type: 'zzz' })
    expect([n.startDate, n.endDate, n.staff, n.budget, n.type]).toEqual(['2026-11-10', '2026-11-12', ['ก', 'ข'], 5000, 'booth'])
  })
  it('shows on the work calendar once per day, shared with everyone', () => {
    const items = buildWorkItems({ marketingEvents: [ev(), ev({ id: 'x', deleted: true })] }, '2026-11-11')
    expect(items.map(i => i.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
    expect(items.every(i => i.kind === 'booth' && i.shared && !i.overdue && i.ref === 'marketing_events:e1')).toBe(true)
    expect(eventCalendarItems([ev({ status: 'cancelled' })], '2026-11-11')).toEqual([])
  })
})
