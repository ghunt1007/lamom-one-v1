import { describe, it, expect } from 'vitest'
import { statusBoard, STATUS_GROUPS, ALL_GROUPED_STATUSES, BOOKING_STATUSES } from './statusBoard.js'

const B = [
  { id: 1, status: 'ส่งมอบแล้ว', bookingDate: '2026-10-05', cutDate: '2026-11-03', price: 100 },
  { id: 2, status: 'ตัดตัวเลขรอส่งมอบ', bookingDate: '2026-11-02', cutDate: '2026-11-10', price: 200 },
  { id: 3, status: 'รอส่งมอบ', bookingDate: '2026-11-05', price: 300 },
  { id: 4, status: 'รอรถ', bookingDate: '2026-09-01', price: 400 },
  { id: 5, status: 'ถอนจอง', bookingDate: '2026-11-04', cancelDate: '2026-11-06' },
  { id: 6, status: 'รอผลไฟแนนซ์', bookingDate: '2026-11-20' },
  { id: 7, status: 'สถานะแปลก', bookingDate: '2026-11-21' },
  { id: 8, status: 'รอส่งมอบ', bookingDate: '2026-11-01', deleted: true },
]

describe('statusBoard', () => {
  it('every Sheet status (except delivered/withdrawn) has a group', () => {
    const grouped = new Set(ALL_GROUPED_STATUSES())
    BOOKING_STATUSES.filter(s => !['ส่งมอบแล้ว', 'ถอนจอง'].includes(s)).forEach(s => expect(grouped.has(s), s).toBe(true))
    expect(STATUS_GROUPS.length).toBe(4)
  })
  it('summary counts for the month', () => {
    const r = statusBoard(B, ['2026-11'], { today: '2026-11-26' })
    expect(r.summary).toMatchObject({ booked: 5, active: 4, delivered: 2, handedOver: 1, cutWaiting: 1, withdrawn: 1 })
  })
  it('open scope = everything still pending, incl. cut-waiting and unknown statuses', () => {
    const r = statusBoard(B, ['2026-11'], { today: '2026-11-26' })
    const by = Object.fromEntries(r.groups.flatMap(g => g.items.map(i => [i.status, i.count])))
    expect(by['รอรถ']).toBe(1)
    expect(by['ตัดตัวเลขรอส่งมอบ']).toBe(1)
    expect(by['รอส่งมอบ']).toBe(1)
    expect(by['สถานะแปลก']).toBe(1)
    expect(r.summary.pending).toBe(5)
    expect(r.groups.find(g => g.key === 'wait').items[0].avgAge).toBe(86)
  })
  it('period scope only counts bookings booked in the months', () => {
    const r = statusBoard(B, ['2026-11'], { today: '2026-11-26', scope: 'period' })
    const by = Object.fromEntries(r.groups.flatMap(g => g.items.map(i => [i.status, i.count])))
    expect(by['รอรถ']).toBe(0)
    expect(r.summary.pending).toBe(4)
  })
  it('no other group when all statuses known', () => {
    expect(statusBoard(B.slice(0, 6), ['2026-11']).groups.map(g => g.key)).toEqual(['ready', 'release', 'wait', 'finance'])
  })
})
