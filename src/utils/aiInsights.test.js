import { describe, it, expect } from 'vitest'
import { buildInsights } from './aiInsights.js'

const T = '2026-11-12'
describe('buildInsights (ข้อมูลจริงเท่านั้น)', () => {
  it('ไม่มีข้อมูล → ไม่มีข้อสังเกต (ไม่มีข้อความสมมติ)', () => {
    expect(buildInsights({ today: T })).toEqual([])
  })
  it('HOT ไม่มีนัด · ไฟแนนซ์ค้าง · รถพร้อมส่งไม่มีวัน · รุ่นขายดี', () => {
    const customers = [
      { id: 'c1', firstName: 'ก', stage: 'pp', temperature: 'hot' },
      { id: 'c2', firstName: 'ข', stage: 'pp', temperature: 'hot' },
      { id: 'c3', firstName: 'ค', stage: 'pp', temperature: 'hot', isLost: true },
    ]
    const followups = [{ customerId: 'c2', status: 'pending' }]
    const bookings = [
      { custName: 'ง', status: 'รอผลไฟแนนซ์', bookingDate: '2026-10-01', brand: 'DEEPAL', model: 'S07' },
      { custName: 'จ', status: 'รอส่งมอบ', bookingDate: '2026-11-02', brand: 'DEEPAL', model: 'S07' },
      { custName: 'ฉ', status: 'ถอนจอง', bookingDate: '2026-11-03', brand: 'AION', model: 'V' },
    ]
    const r = buildInsights({ customers, followups, bookings, today: T })
    const by = Object.fromEntries(r.map(i => [i.kind, i]))
    expect(by.hotnofu.n).toBe(1)
    expect(by.hotnofu.id).toBe('hotnofu-2026-11')
    expect(by.finlate.n).toBe(1)
    expect(by.readynodate.n).toBe(1)
    expect(by.topmodel.title).toContain('จองมากสุดเดือนนี้ 1 ใบ จาก 1 ใบ')
    expect(r[0].priority).toBe('high')
  })
})
