import { describe, it, expect } from 'vitest'
import { orderForecast, forecastOrderLines, orderForecastText } from './orderForecast.js'

const today = '2026-11-21'
const bk = (o) => ({ brand: 'DEEPAL', model: 'S07', colorOut: 'ขาว', status: 'ส่งมอบแล้ว', bookingDate: '2026-10-01', custName: 'ลูกค้า', ...o })
const car = (o) => ({ brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'available', vin: '', ...o })

describe('orderForecast', () => {
  it('จอง 9 คันใน 90 วัน (3/เดือน) ช่วงรอรถ 30 วัน → คาดจองเพิ่ม 3 คัน · มีรถว่าง 1 → แนะนำสั่ง 2', () => {
    const bookings = Array.from({ length: 9 }, (_, i) => bk({ bookingDate: `2026-10-${String(i + 1).padStart(2, '0')}` }))
    const fc = orderForecast({ bookings, vehicles: [car({ vin: 'A1' })], today, leadDays: 30 })
    const m = fc.models[0]
    expect(m).toMatchObject({ car: 'DEEPAL S07', sold: 9, perMonth: 3, expected: 3, have: 1, spare: 1, suggest: 2, coverDays: 10 })
    expect(m.colors[0]).toMatchObject({ color: 'ขาว', suggest: 2 })
    expect(fc.total).toBe(2)
  })
  it('ไม่นับใบถอนจอง และใบจองเก่ากว่า 90 วัน', () => {
    const fc = orderForecast({ bookings: [bk({ status: 'ถอนจอง' }), bk({ bookingDate: '2026-01-01' })], today })
    expect(fc.models).toEqual([])
  })
  it('แบ่งสีตามสัดส่วนที่ลูกค้าจอง · ลูกค้าจองรอที่ขาดอยู่ต้องสั่งเสมอ', () => {
    const bookings = [
      ...Array.from({ length: 6 }, () => bk()),
      ...Array.from({ length: 3 }, () => bk({ colorOut: 'ดำ' })),
      bk({ colorOut: 'เทา', status: 'รอรถ', bookingDate: '2026-01-05' }), // จองรอ (เก่า) สีเทา
    ]
    const fc = orderForecast({ bookings, today, leadDays: 30 })
    const by = Object.fromEntries(fc.models[0].colors.map(c => [c.color, c.suggest]))
    expect(by).toEqual({ ขาว: 2, ดำ: 1, เทา: 1 })
  })
  it('ลีดร้อน/อุ่นตามรุ่นที่สนใจ · รุ่นใหม่ไม่มีประวัติสี → ยังไม่รู้สี', () => {
    const customers = [
      ...Array.from({ length: 10 }, () => ({ stage: 'lead', temperature: 'hot', interestedModel: 'AION V' })),
      { stage: 'lead', temperature: 'hot', interestedModel: 'AION V', bookingId: 'x' },
      { stage: 'customer', temperature: 'hot', interestedModel: 'AION V' },
      { stage: 'lead', temperature: 'cold', interestedModel: 'AION V' },
    ]
    const fc = orderForecast({ customers, today })
    expect(fc.models[0]).toMatchObject({ hot: 10, leads: 3, unassigned: 3, suggest: 3 })
    expect(forecastOrderLines(fc)).toEqual([])
    expect(orderForecastText(fc)).toContain('ยังไม่รู้สี 3')
  })
  it('หักร่างใบสั่งที่ทำไว้แล้ว ตอนทำร่างเพิ่ม', () => {
    const bookings = [bk({ status: 'รอรถ' }), bk({ status: 'รอรถ' })]
    const fc = orderForecast({ bookings, orders: [{ brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'draft', qty: 1 }], today, leadDays: 30 })
    const lines = forecastOrderLines(fc)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ model: 'S07', color: 'ขาว' })
    expect(lines[0].qty).toBe(fc.models[0].colors[0].suggest - 1)
  })
  it('พอแล้ว → ข้อความบอกว่าพอ', () => {
    const fc = orderForecast({ bookings: [bk()], vehicles: [car({ vin: 'A' }), car({ vin: 'B' })], today, leadDays: 30 })
    expect(fc.total).toBe(0)
    expect(orderForecastText(fc)).toContain('พอ')
  })
})

describe('LAMI คาดการณ์สั่งรถ', () => {
  it('จับคำถาม forecast ไม่ชนกับ lowstock/incoming', async () => {
    const oq = await import('./opsQuestions.js')
    expect(oq.parseOpsSpec('คาดการณ์สั่งรถเดือนหน้า')?.kind).toBe('forecast')
    expect(oq.parseOpsSpec('เดือนหน้าควรสั่งรถกี่คัน')?.kind).toBe('forecast')
    expect(oq.parseOpsSpec('ต้องสั่งรถรุ่นอะไรสีอะไรบ้าง')?.kind).toBe('lowstock')
    expect(oq.parseOpsSpec('รถที่กำลังจะมาถึงมีกี่คัน')?.kind).toBe('incoming')
    const r = oq.forecastAnswer([], [bk({ status: 'รอรถ' })], [], [], { today, leadDays: 30 })
    expect(r.n).toBeGreaterThan(0)
    expect(r.text).toContain('DEEPAL S07')
  })
})

describe('จับคู่รุ่นของลีด', () => {
  it('ลีดพิมพ์รุ่นยาว นับเข้ารุ่นที่มีอยู่', () => {
    const fc = orderForecast({ bookings: [bk()], customers: [{ stage: 'pp', temperature: 'hot', interestedModel: 'DEEPAL S07 Long Range AWD' }], today })
    expect(fc.models).toHaveLength(1)
    expect(fc.models[0]).toMatchObject({ car: 'DEEPAL S07', hot: 1 })
  })
})
