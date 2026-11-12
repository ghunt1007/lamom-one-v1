import { describe, it, expect } from 'vitest'
import { plateRows, plateSummary, filterPlateRows } from './plateList.js'

const T = '2026-11-12'
const bk = [
  { id: 'a', custName: 'ก', status: 'ส่งมอบแล้ว', deliveryDate: '2026-09-01', redPlate: 'ป-1' },
  { id: 'b', custName: 'ข', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-01', redPlate: 'ป 1' },
  { id: 'c', custName: 'ค', status: 'ส่งมอบแล้ว', deliveryDate: '2026-10-01', whitePlate: '1กข 1234', redPlate: 'ป-1' },
  { id: 'd', custName: 'ง', status: 'รอส่งมอบ', deliveryDate: '2026-11-01' },
  { id: 'e', custName: 'จ', status: 'ส่งมอบแล้ว', deliveryDate: '2025-01-01' },
  { id: 'f', custName: 'ฉ', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-10', deleted: true },
]
describe('plateList', () => {
  it('เฉพาะส่งมอบแล้วใน 180 วัน · ยังไม่ได้ป้ายขาวขึ้นก่อน เรียงรอนานสุด', () => {
    const r = plateRows(bk, { today: T })
    expect(r.map(x => x.b.id)).toEqual(['a', 'b', 'c'])
    expect(r[0].late).toBe(true)
    expect(r[1].late).toBe(false)
  })
  it('ป้ายแดงซ้ำ (ไม่สนขีด/เว้นวรรค) เฉพาะคันที่ยังไม่ได้ป้ายขาว', () => {
    const r = plateRows(bk, { today: T })
    expect(r.filter(x => x.dupRed).map(x => x.b.id)).toEqual(['a', 'b'])
    expect(plateSummary(r)).toMatchObject({ pending: 2, late: 1, done: 1, redInUse: 1, dup: 2 })
  })
  it('กรอง + ค้นหา', () => {
    const r = plateRows(bk, { today: T })
    expect(filterPlateRows(r, { view: 'done' }).map(x => x.b.id)).toEqual(['c'])
    expect(filterPlateRows(r, { view: 'late' }).map(x => x.b.id)).toEqual(['a'])
    expect(filterPlateRows(r, { view: 'all', q: '1กข' }).map(x => x.b.id)).toEqual(['c'])
  })
})
