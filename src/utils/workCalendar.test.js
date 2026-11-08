import { describe, it, expect } from 'vitest'
import { buildWorkItems, summarize, groupByDate, OVERDUE_LOOKBACK_DAYS } from './workCalendar.js'

const T = '2026-11-08'
const keys = items => items.map(i => i.key)

describe('workCalendar.buildWorkItems', () => {
  it('appointments, test drives and service skip cancelled / no-show', () => {
    const items = buildWorkItems({
      appointments: [
        { id: 'a1', date: '2026-11-09', time: '10:30', custName: 'ก', status: 'scheduled' },
        { id: 'a2', date: '2026-11-09', custName: 'ข', status: 'cancelled' },
        { id: 'a3', date: '2026-11-09', custName: 'ค', status: 'noshow' },
      ],
      testDrives: [
        { id: 't1', date: '2026-11-10', customerName: 'ง', status: 'scheduled', customerId: 'c9' },
        { id: 't2', date: '2026-11-10', customerName: 'จ', status: 'no_show' },
        { id: 't3', date: '2026-11-01', customerName: 'ฉ', status: 'completed' },
      ],
      serviceAppts: [{ id: 's1', date: '2026-11-11', custName: 'ช', status: 'cancelled' }],
    }, T)
    expect(keys(items)).toEqual(['td:t3', 'appt:a1', 'td:t1'])
    expect(items[0].done).toBe(true)
    expect(items[1].time).toBe('10:30')
    expect(items.find(i => i.key === 'td:t1').nav).toBe('/crm/customers?id=c9')
  })

  it('past appointments are never "overdue" (only past)', () => {
    const [a] = buildWorkItems({ appointments: [{ id: 'a', date: '2026-11-01', status: 'scheduled' }] }, T)
    expect(a.overdue).toBe(false)
  })

  it('only pending follow-ups; overdue flagged within the lookback window', () => {
    const items = buildWorkItems({ followups: [
      { id: 'f1', dueDate: '2026-11-05', status: 'pending', customerName: 'A', customerId: 'c1' },
      { id: 'f2', dueDate: '2026-11-05', status: 'done' },
      { id: 'f3', dueDate: '2026-11-12', status: 'pending' },
      { id: 'f4', dueDate: '2026-01-01', status: 'pending' },
      { id: 'f5', dueDate: '2026-11-06', status: 'pending', deleted: true },
    ] }, T)
    expect(keys(items)).toEqual(['fu:f4', 'fu:f1', 'fu:f3'])
    expect(items.find(i => i.key === 'fu:f1').overdue).toBe(true)
    expect(items.find(i => i.key === 'fu:f4').overdue).toBe(false) // older than OVERDUE_LOOKBACK_DAYS
    expect(OVERDUE_LOOKBACK_DAYS).toBeGreaterThan(30)
    expect(items.find(i => i.key === 'fu:f1').nav).toBe('/crm/customers?id=c1')
  })

  it('delivery + pre-delivery check the day before; none for withdrawn', () => {
    const items = buildWorkItems({ bookings: [
      { id: 'b1', custName: 'ลูกค้า1', model: 'S07', status: 'รอส่งมอบ', deliveryDate: '2026-11-15', finStatus: 'ผ่าน' },
      { id: 'b2', custName: 'ลูกค้า2', status: 'ถอนจอง', deliveryDate: '2026-11-15' },
      { id: 'b3', custName: 'ลูกค้า3', status: 'รอส่งมอบ', deliveryDate: '2026-11-16', pdReady: true, finStatus: 'ผ่าน' },
    ] }, T)
    expect(keys(items)).toEqual(['pdi:b1', 'dlv:b1', 'dlv:b3'])
    expect(items[0].date).toBe('2026-11-14')
    expect(items[0].nav).toBe('/crm/predelivery')
    expect(items[1].nav).toBe('/crm/bookings?id=b1')
    expect(items[2].sub).toContain('ตรวจรถแล้ว')
  })

  it('delivery today/tomorrow → check car today; cut-number bookings still need delivery', () => {
    const items = buildWorkItems({ bookings: [
      { id: 'b1', status: 'ตัดตัวเลขรอส่งมอบ', deliveryDate: T },
      { id: 'b2', status: 'รอส่งมอบ', deliveryDate: '2026-11-09', finStatus: 'ผ่าน' },
    ] }, T)
    expect(items.filter(i => i.kind === 'pdi').map(i => i.date)).toEqual([T, T])
    expect(items.find(i => i.key === 'dlv:b1').done).toBe(false)
  })

  it('handed-over bookings show done on the real delivery date, no pdi/finance', () => {
    const items = buildWorkItems({ bookings: [
      { id: 'b1', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-01', actualDeliveryDate: '2026-11-03', finStatus: 'รอผล', submitDate: '2026-10-01' },
    ] }, T)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ key: 'dlv:b1', date: '2026-11-03', done: true, overdue: false })
  })

  it('missed delivery date is overdue', () => {
    const items = buildWorkItems({ bookings: [{ id: 'b1', status: 'รอส่งมอบ', deliveryDate: '2026-11-06', pdReady: true, finStatus: 'ผ่าน' }] }, T)
    expect(items[0].overdue).toBe(true)
  })

  it('finance: wait for result, send case, rejected, signing; cash and passed skipped', () => {
    const items = buildWorkItems({ bookings: [
      { id: 'w', custName: 'W', status: 'รอผลไฟแนนซ์', finStatus: 'รอผล', submitDate: '2026-11-07', financeCo: 'BAY' },
      { id: 's', custName: 'S', status: 'ยอดจองคงค้าง', finStatus: 'รอส่ง', bookingDate: '2026-11-08' },
      { id: 'r', custName: 'R', status: 'ยอดจองคงค้าง', finStatus: 'ไม่ผ่าน', submitDate: '2026-11-01', approveDate: '2026-11-04' },
      { id: 'g', custName: 'G', status: 'ยอดจองคงค้าง', finStatus: 'รอเซ็นสัญญา', signDate: '2026-11-12' },
      { id: 'c', custName: 'C', status: 'ซื้อสดรอเบิกรถ', finStatus: 'ซื้อสด', bookingDate: '2026-11-01' },
      { id: 'p', custName: 'P', status: 'รอรถ', finStatus: 'รอผล', submitDate: '2026-11-01' },
    ] }, T)
    const by = Object.fromEntries(items.map(i => [i.key, i]))
    expect(by['fin:w']).toMatchObject({ date: '2026-11-10', kind: 'finance' })
    expect(by['fin:w'].title).toContain('ตามผลไฟแนนซ์')
    expect(by['fin:s']).toMatchObject({ date: '2026-11-10' })
    expect(by['fin:s'].title).toContain('ส่งเคส')
    expect(by['fin:r']).toMatchObject({ date: '2026-11-04', overdue: true })
    expect(by['sign:g']).toMatchObject({ date: '2026-11-12', done: false })
    expect(by['fin:c']).toBeUndefined()
    expect(by['fin:p']).toBeUndefined()
  })

  it('accepts Firestore-like timestamps and ISO strings with time', () => {
    const ts = { toDate: () => new Date('2026-11-09T03:00:00Z') }
    const items = buildWorkItems({ tasks: [
      { id: 'x', title: 'A', dueDate: ts, status: 'todo' },
      { id: 'y', title: 'B', dueDate: '2026-11-10T09:00:00+07:00', status: 'done' },
      { id: 'z', title: 'C', dueDate: 'bad', status: 'todo' },
      { id: 'q', title: 'D', dueDate: '2026-11-11', status: 'cancelled' },
    ] }, T)
    expect(items.map(i => [i.key, i.date])).toEqual([['task:x', '2026-11-09'], ['task:y', '2026-11-10']])
  })

  it('sorting: timed first, done last; summary counts', () => {
    const items = buildWorkItems({
      followups: [{ id: 'f', dueDate: T, status: 'pending' }, { id: 'o', dueDate: '2026-11-07', status: 'pending' }],
      appointments: [{ id: 'a', date: T, time: '09:00', status: 'scheduled' }, { id: 'd', date: T, time: '08:00', status: 'done' }],
      events: [{ id: 'e', date: '2026-11-12', title: 'ประชุม' }],
    }, T)
    const todays = groupByDate(items)[T].map(i => i.key)
    expect(todays).toEqual(['appt:a', 'fu:f', 'appt:d'])
    expect(summarize(items, T)).toEqual({ today: 2, week: 3, overdue: 1 })
  })
})

describe('workCalendar time', () => {
  it('pads times so 9:30 sorts before 14:00', () => {
    const items = buildWorkItems({ appointments: [
      { id: 'b', date: '2026-11-08', time: '14:00', status: 'scheduled' },
      { id: 'a', date: '2026-11-08', time: '9.30', status: 'scheduled' },
    ] }, '2026-11-08')
    expect(items.map(i => [i.key, i.time])).toEqual([['appt:a', '09:30'], ['appt:b', '14:00']])
  })
})
