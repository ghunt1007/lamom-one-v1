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

describe('statusCounts / pickPrevCounts (v1.0.1393)', () => {
  it('counts open bookings per group', async () => {
    const { statusCounts } = await import('./statusBoard.js')
    const c = statusCounts([
      { status: 'รอส่งมอบ', bookingDate: '2026-11-01' }, { status: 'รอรถ', bookingDate: '2026-11-01' },
      { status: 'รอรถ', bookingDate: '2026-11-02' }, { status: 'ส่งมอบแล้ว', cutDate: '2026-11-03' }, { status: 'แปลกๆ' },
    ], '2026-11-20')
    expect(c).toEqual({ pending: 4, ready: 1, release: 0, wait: 2, finance: 0, other: 1 })
  })
  it('prefers a snapshot at least 7 days old, else the latest earlier one', async () => {
    const { pickPrevCounts } = await import('./statusBoard.js')
    const L = [
      { date: '2026-11-20', sb_pending: 9 }, { date: '2026-11-19', sb_pending: 8, sb_wait: 3 },
      { date: '2026-11-12', sb_pending: 5, sb_ready: 2 }, { date: '2026-11-10', sb_pending: 4 }, { date: '2026-11-11' },
    ]
    const p = pickPrevCounts(L, '2026-11-20')
    expect(p.date).toBe('2026-11-12'); expect(p.weekAgo).toBe(true); expect(p.counts.ready).toBe(2); expect(p.counts.pending).toBe(5)
    const q = pickPrevCounts(L.slice(0, 2), '2026-11-20')
    expect(q.date).toBe('2026-11-19'); expect(q.weekAgo).toBe(false); expect(q.counts.wait).toBe(3)
    expect(pickPrevCounts([{ date: '2026-11-20', sb_pending: 1 }], '2026-11-20')).toBeNull()
    expect(pickPrevCounts([], '2026-11-20')).toBeNull()
  })
})
