import { describe, it, expect } from 'vitest'
import { orderNeeds, orderNeedsText, needsBooking } from './orderNeeds.js'

const bk = (o) => ({ brand: 'DEEPAL', model: 'S07', colorOut: 'ขาว', status: 'รอรถ', custName: 'สมชาย ใจดี', ...o })
const car = (o) => ({ brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'available', vin: '', ...o })

describe('orderNeeds', () => {
  it('จองรอ 3 มีรถว่าง 1 กำลังมา 1 → ขาด 1', () => {
    const rows = orderNeeds({
      bookings: [bk(), bk({ custName: 'มานี' }), bk({ status: 'รอผลไฟแนนซ์' })],
      vehicles: [car({ vin: 'A1' }), car({ vin: 'A2', status: 'transit' })],
    })
    expect(rows[0]).toMatchObject({ car: 'DEEPAL S07', color: 'ขาว', wait: 3, ready: 1, coming: 1, short: 1 })
    expect(rows[0].waitNames).toContain('มานี')
  })
  it('ไม่นับใบจองที่มีเลขตัวถังแล้ว รถมาแล้ว ถอนจอง หรือส่งมอบแล้ว', () => {
    expect(needsBooking(bk({ vin: 'X' }))).toBe(false)
    expect(needsBooking(bk({ status: 'ได้รถแล้วรอสั่งแต่ง' }))).toBe(false)
    expect(needsBooking(bk({ status: 'ถอนจอง' }))).toBe(false)
    expect(needsBooking(bk({ status: 'ส่งมอบแล้ว' }))).toBe(false)
    expect(needsBooking(bk({ deleted: true }) ) && false).toBe(false)
  })
  it('รถที่ผูกกับใบจองแล้ว (เลขตัวถังตรง) ไม่นับเป็นรถว่าง', () => {
    const rows = orderNeeds({ bookings: [bk(), bk({ vin: 'V9', status: 'ผ่านไฟแนนซ์รอเบิก' })], vehicles: [car({ vin: 'V9' })] })
    expect(rows[0]).toMatchObject({ wait: 1, ready: 0, short: 1 })
  })
  it('ใบสั่งรถที่ส่งแล้วนับตามจำนวน ร่างแยกไว้ ไม่ลดยอดขาด · แยกสี', () => {
    const rows = orderNeeds({
      bookings: [bk(), bk(), bk({ colorOut: 'ดำ' })],
      orders: [{ brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'ordered', qty: 1 }, { brand: 'DEEPAL', model: 'S07', color: 'ดำ', status: 'draft', qty: 2 }, { model: 'S07', color: 'ขาว', status: 'cancelled', qty: 5 }],
    })
    const white = rows.find(r => r.color === 'ขาว'), black = rows.find(r => r.color === 'ดำ')
    expect(white).toMatchObject({ ordered: 1, short: 1 })
    expect(black).toMatchObject({ draft: 2, short: 1 })
  })
  it('ไม่มีสีในใบจอง → ไม่ระบุสี · ข้อความ LAMI', () => {
    const rows = orderNeeds({ bookings: [bk({ colorOut: '' })] })
    expect(rows[0].color).toBe('ไม่ระบุสี')
    expect(orderNeedsText(rows)).toContain('ขาด 1 คัน')
    expect(orderNeedsText(orderNeeds({}))).toBe('')
  })
})

describe('modelKey', () => {
  it('ใบจองเขียน "S07" ไม่มียี่ห้อ ตรงกับสต็อก "DEEPAL S07"', () => {
    const rows = orderNeeds({ bookings: [bk({ brand: '', model: 'S07' })], vehicles: [car({ brand: 'DEEPAL', model: 'DEEPAL S07', vin: 'Z' })] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ car: 'DEEPAL S07', wait: 1, ready: 1, short: 0 })
  })
  it('รุ่นต่างกันไม่ปนกัน (S07 กับ New S07 · Aion V กับ Aion UT)', () => {
    const rows = orderNeeds({ bookings: [bk({ model: 'S07' }), bk({ model: 'New S07' }), bk({ brand: '', model: 'Aion V' }), bk({ brand: '', model: 'Aion UT 500' })] })
    expect(rows).toHaveLength(4)
  })
})

describe('LAMI', () => {
  it('"ต้องสั่งรถรุ่นอะไรสีอะไรบ้าง" → lowstock และตอบแยกสี', async () => {
    const oq = await import('./opsQuestions.js')
    expect(oq.parseOpsSpec('ต้องสั่งรถรุ่นอะไรสีอะไรบ้าง')?.kind).toBe('lowstock')
    expect(oq.parseOpsSpec('สีไหนต้องสั่งเพิ่ม')?.kind).toBe('lowstock')
    const res = oq.lowStockAnswer([], [bk({ colorOut: 'ดำ' })], [])
    expect(res.text).toContain('DEEPAL S07 สีดำ — ขาด 1 คัน')
  })
})

describe('matchReadyCars (v1.0.1238)', () => {
  it('จองก่อนได้ก่อน · รถเข้าก่อนออกก่อน · ไม่เอารถที่ผูกใบจองแล้ว · สีต้องตรง', async () => {
    const { matchReadyCars, matchReadyText } = await import('./orderNeeds.js')
    const pairs = matchReadyCars({
      bookings: [bk({ custName: 'หลัง', bookingDate: '2026-11-10' }), bk({ custName: 'ก่อน', bookingDate: '2026-11-01' }), bk({ custName: 'ดำ', colorOut: 'ดำ' }), bk({ vin: 'V1', status: 'ผ่านไฟแนนซ์รอเบิก' })],
      vehicles: [car({ vin: 'V2', arrivedAt: '2026-11-15' }), car({ vin: 'V3', arrivedAt: '2026-10-01' }), car({ vin: 'V1' })],
    })
    expect(pairs.map(p => [p.booking.custName, p.vehicle.vin])).toEqual([['ก่อน', 'V3'], ['หลัง', 'V2']])
    expect(matchReadyText(pairs)).toContain('ก่อน — DEEPAL S07 สีขาว · ตัวถัง V3')
    expect(matchReadyText([])).toBe('')
  })
})

describe('LAMI จับคู่รถ (v1.0.1241)', () => {
  it('ถามว่ารถว่างให้ใคร → lowstock', async () => {
    const oq = await import('./opsQuestions.js')
    expect(oq.parseOpsSpec('รถว่างคันไหนให้ใคร')?.kind).toBe('lowstock')
    expect(oq.parseOpsSpec('จับคู่รถกับลูกค้า')?.kind).toBe('lowstock')
    expect(oq.parseOpsSpec('ใครได้รถคันไหน')?.kind).toBe('lowstock')
  })
})

describe('etaForBookings (v1.0.1241)', () => {
  it('จองก่อนได้รถว่าง คนถัดไปได้คันขนส่ง แล้วใบสั่งรถตามวันที่ ที่เหลือ none', async () => {
    const { etaForBookings, etaLabel } = await import('./orderNeeds.js')
    const bookings = ['01', '02', '03', '04', '05'].map((d, i) => bk({ id: 'b' + i, bookingDate: '2026-11-' + d }))
    const m = etaForBookings({
      bookings,
      vehicles: [car({ vin: 'R1' }), car({ vin: 'T1', status: 'transit', eta: '2026-12-01' })],
      orders: [{ brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'ordered', qty: 1, expectedDate: '2027-01-10', orderNo: 'O2' }, { brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'confirmed', qty: 1, expectedDate: '2026-12-20', orderNo: 'O1' }],
      today: '2026-11-22',
    })
    expect([...m.values()].map(e => [e.kind, e.ref])).toEqual([['ready', 'R1'], ['transit', 'T1'], ['order', 'O1'], ['order', 'O2'], ['none', '']])
    expect(m.get('b4').ahead).toBe(4)
    expect(etaLabel(m.get('b2'))).toContain('คาดว่าถึง 2026-12-20')
    expect(etaLabel(m.get('b4'))).toContain('ต้องสั่งเพิ่ม')
  })
})

describe('LAMI ลูกค้ารอรถ (v1.0.1241)', () => {
  it('จับคำถาม และตอบพร้อมรถจะมาเมื่อไหร่', async () => {
    const oq = await import('./opsQuestions.js')
    expect(oq.parseOpsSpec('ลูกค้าที่รอรถจะได้รถเมื่อไหร่')?.kind).toBe('waiteta')
    expect(oq.parseOpsSpec('ใครรอรถอยู่บ้าง')?.kind).toBe('waiteta')
    expect(oq.parseOpsSpec('รถที่กำลังจะมาถึงมีกี่คัน')?.kind).toBe('incoming')
    const r = oq.waitEtaAnswer([car({ vin: 'R1' })], [bk({ id: 'a', bookingDate: '2026-11-01', custName: 'สมชาย' }), bk({ id: 'b', bookingDate: '2026-11-05', custName: 'มานี' })], [], { today: '2026-11-22' })
    expect(r.n).toBe(2)
    expect(r.text).toContain('ยังไม่มีรถรองรับ 1 คน')
    expect(r.text).toMatch(/สมชาย[\s\S]*มีรถว่างในสต็อก/)
  })
})

describe('stockForModel (v1.0.1243)', () => {
  it('รถว่างหลังหักลูกค้าที่จองรอ แยกสี + กำลังมาที่ยังไม่มีเจ้าของ', async () => {
    const { orderNeeds, stockForModel } = await import('./orderNeeds.js')
    const rows = orderNeeds({
      bookings: [bk()],
      vehicles: [car({ vin: 'A' }), car({ vin: 'B' }), car({ vin: 'C', color: 'ดำ', status: 'transit' }), car({ model: 'L07', vin: 'D' })],
    })
    expect(stockForModel(rows, { brand: 'DEEPAL', model: 'DEEPAL S07' })).toEqual([{ color: 'ขาว', free: 1, coming: 0 }, { color: 'ดำ', free: 0, coming: 1 }])
    expect(stockForModel(rows, { model: '' })).toEqual([])
  })
})

describe('bookingsForOrder (v1.0.1247)', () => {
  it('ลูกค้าที่ได้รถจากใบสั่งนี้ หลังหักรถว่าง/ขนส่ง (จองก่อนได้ก่อน)', async () => {
    const { bookingsForOrder } = await import('./orderNeeds.js')
    const bks = [
      { id: 'b1', status: 'รอรถ', brand: 'DEEPAL', model: 'S07', colorOut: 'ขาว', bookingDate: '2026-11-01', custName: 'หนึ่ง' },
      { id: 'b2', status: 'รอรถ', brand: 'DEEPAL', model: 'S07', colorOut: 'ขาว', bookingDate: '2026-11-03', custName: 'สอง' },
      { id: 'b3', status: 'รอรถ', brand: 'DEEPAL', model: 'S07', colorOut: 'ขาว', bookingDate: '2026-11-05', custName: 'สาม' },
      { id: 'b4', status: 'รอรถ', brand: 'DEEPAL', model: 'S07', colorOut: 'ขาว', bookingDate: '2026-11-07', custName: 'สี่' },
    ]
    const vehicles = [{ id: 'v1', status: 'available', brand: 'DEEPAL', model: 'DEEPAL S07', color: 'ขาว', vin: 'A' }]
    const orders = [
      { id: 'o1', status: 'shipped', brand: 'DEEPAL', model: 'S07', color: 'ขาว', qty: 2, expectedDate: '2026-12-01', orderNo: 'ORD-1' },
      { id: 'o2', status: 'ordered', brand: 'DEEPAL', model: 'S07', color: 'ขาว', qty: 1, expectedDate: '2026-12-20' },
    ]
    expect(bookingsForOrder({ bookings: bks, vehicles, orders }, 'o1').map(b => b.id)).toEqual(['b2', 'b3'])
    expect(bookingsForOrder({ bookings: bks, vehicles, orders }, 'o2').map(b => b.id)).toEqual(['b4'])
    expect(bookingsForOrder({ bookings: bks, vehicles, orders }, '')).toEqual([])
  })
})
