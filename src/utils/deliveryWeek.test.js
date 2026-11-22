import { describe, it, expect } from 'vitest'
import { deliveryWeekList, deliveryWeekAnswer } from './deliveryWeek.js'

const T = '2026-11-23' // จันทร์
const bk = (o) => ({ status: 'รอส่งมอบ', custName: 'ก', model: 'S07', salesName: 'A', ...o })

describe('deliveryWeek', () => {
  it('upcoming within 7 days sorted by date/time; excludes delivered, cancelled, deleted, no date, other sales', () => {
    const rows = [
      bk({ id: 1, deliveryDate: '2026-11-25', deliveryTime: '14:00' }),
      bk({ id: 2, deliveryDate: '2026-11-25', deliveryTime: '09:30' }),
      bk({ id: 3, deliveryDate: T }),
      bk({ id: 4, deliveryDate: '2026-12-01' }), // +8 days
      bk({ id: 5, deliveryDate: '2026-11-24', status: 'ส่งมอบแล้ว' }),
      bk({ id: 6, deliveryDate: '2026-11-24', status: 'ถอนจอง' }),
      bk({ id: 7, deliveryDate: '2026-11-24', deleted: true }),
      bk({ id: 8, deliveryDate: '' }),
      bk({ id: 9, deliveryDate: '2026-11-24', salesName: 'B' }),
      bk({ id: 10, deliveryDate: '2026-11-30', status: 'ตัดตัวเลขรอส่งมอบ' }),
    ]
    const { upcoming, overdue } = deliveryWeekList(rows, T, b => b.salesName === 'A')
    expect(upcoming.map(x => x.b.id)).toEqual([3, 2, 1, 10])
    expect(overdue).toEqual([])
  })
  it('overdue up to 14 days back', () => {
    const { overdue } = deliveryWeekList([bk({ id: 1, deliveryDate: '2026-11-20' }), bk({ id: 2, deliveryDate: '2026-11-01' })], T)
    expect(overdue.map(x => x.b.id)).toEqual([1])
  })
  it('answer text groups by day with DD/MM/BE and 24h, labels today/tomorrow', () => {
    const txt = deliveryWeekAnswer([
      bk({ custName: 'สมชาย', deliveryDate: T, deliveryTime: '10:00' }),
      bk({ custName: 'สมหญิง', deliveryDate: '2026-11-24' }),
      bk({ custName: 'มานี', deliveryDate: '2026-11-26' }),
      bk({ custName: 'ชูใจ', deliveryDate: '2026-11-20' }),
    ], T)
    expect(txt).toContain('นัดส่งมอบ 7 วันข้างหน้า 3 คัน')
    expect(txt).toContain('📅 วันนี้ 23/11/2569')
    expect(txt).toContain('  - 10:00 สมชาย · S07 (รอส่งมอบ)')
    expect(txt).toContain('📅 พรุ่งนี้ 24/11/2569')
    expect(txt).toContain('📅 พฤ. 26/11/2569')
    expect(txt).toContain('เลยวันนัดส่งมอบ ยังไม่ส่ง 1 คัน')
    expect(txt).toContain('ชูใจ · S07 · นัด 20/11/2569 (เลยมา 3 วัน)')
    expect(txt).not.toMatch(/AM|PM|NaN|undefined/)
  })
  it('empty and cap', () => {
    expect(deliveryWeekAnswer([], T)).toContain('ไม่มีนัดส่งมอบ')
    const many = Array.from({ length: 15 }, (_, i) => bk({ custName: 'c' + i, deliveryDate: '2026-11-24' }))
    expect(deliveryWeekAnswer(many, T, { max: 12 })).toContain('…และอีก 3 คัน')
  })
})
