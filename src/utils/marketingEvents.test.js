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

import { eventFacts } from './marketingEvents.js'
describe('eventFacts', () => {
  it('lists ongoing, upcoming and finished events with results', () => {
    const evs = [
      { id: 'a', title: 'บูธ เวสต์เกต', startDate: '2026-11-08', endDate: '2026-11-10', venue: 'เวสต์เกต' },
      { id: 'b', title: 'Motor Expo', startDate: '2026-12-01', endDate: '2026-12-10', venue: 'อิมแพค' },
      { id: 'c', title: 'บูธ ตลาด', startDate: '2026-10-01', endDate: '2026-10-02', spent: 10000, venue: 'ตลาด' },
    ]
    const f = eventFacts(evs, { customers: [{ id: 'x', eventId: 'c' }, { id: 'y', eventId: 'c' }] }, '2026-11-09')
    expect(f.find(l => l.startsWith('กำลังจัด'))).toContain('เวสต์เกต')
    expect(f.find(l => l.startsWith('กำลังจะจัด'))).toContain('Motor Expo')
    expect(f.find(l => l.startsWith('จบแล้ว'))).toContain('Lead 2')
  })
})

describe('เวรบูธ & เช็กลิสต์', () => {
  const days = ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30'] // ศ ส อา จ
  it('จัดเวรอัตโนมัติแบ่งเท่ากัน เสาร์-อาทิตย์เพิ่มคน', async () => {
    const { autoRoster, shiftCounts } = await import('./marketingEvents.js')
    const r = autoRoster(days, ['A', 'B', 'C', 'D'], 2)
    expect(r['2026-11-27']).toHaveLength(2)
    expect(r['2026-11-28']).toHaveLength(3)
    expect(r['2026-11-29']).toHaveLength(3)
    const counts = shiftCounts(r).map(x => x[1])
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    expect(r['2026-11-28']).not.toEqual(expect.arrayContaining(r['2026-11-27']))
    expect(autoRoster(days, [], 2)).toEqual({})
  })
  it('ล้างข้อมูลเวรที่ไม่อยู่ในวันงาน และชื่อซ้ำ', async () => {
    const { normalizeShifts, shiftsOn } = await import('./marketingEvents.js')
    expect(normalizeShifts({ '2026-11-27': ['A', 'A', ' '], '2026-12-25': ['B'], '2026-11-28': [] }, days)).toEqual({ '2026-11-27': ['A'] })
    expect(shiftsOn({ shifts: { '2026-11-27': ['A'] } }, '2026-11-27')).toEqual(['A'])
    expect(shiftsOn({}, '2026-11-27')).toEqual([])
  })
  it('เช็กลิสต์เริ่มต้นตามประเภทงาน', async () => {
    const { defaultChecklist, prepProgress } = await import('./marketingEvents.js')
    const ex = defaultChecklist('expo')
    expect(ex.some(x => /บัตรผ่าน/.test(x.t))).toBe(true)
    expect(defaultChecklist('booth').some(x => /บัตรผ่าน/.test(x.t))).toBe(false)
    expect(prepProgress([{ t: 'a', done: true }, { t: 'b' }, { t: '' }])).toEqual({ done: 1, total: 2 })
  })
})
