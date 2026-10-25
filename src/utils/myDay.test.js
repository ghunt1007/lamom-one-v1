import { describe, it, expect } from 'vitest'
import { buildMyDay, bangkokDate, daysBetween } from './myDay.js'

const today = '2026-10-25'

describe('myDay helpers', () => {
  it('bangkokDate converts ISO/Timestamp to Thai date', () => {
    expect(bangkokDate('2026-10-24T18:00:00.000Z')).toBe('2026-10-25')
    expect(bangkokDate({ toDate: () => new Date('2026-10-24T10:00:00Z') })).toBe('2026-10-24')
    expect(bangkokDate('2026-10-20')).toBe('2026-10-20')
    expect(bangkokDate(null)).toBe('')
    expect(daysBetween('2026-10-20', today)).toBe(5)
  })
})

describe('buildMyDay', () => {
  const data = {
    customers: [
      { id: 'c1', firstName: 'ใหม่', stage: 'lead', assignedTo: 'A', createdAt: '2026-10-25T02:00:00Z' },
      { id: 'c2', firstName: 'เก่า', stage: 'pp', assignedTo: 'A', createdAt: '2026-10-10T02:00:00Z', updatedAt: '2026-10-20T02:00:00Z' },
      { id: 'c3', firstName: 'เพิ่งคุย', stage: 'pp', assignedTo: 'A', createdAt: '2026-10-10T02:00:00Z', updatedAt: '2026-10-24T02:00:00Z' },
      { id: 'c4', firstName: 'จองแล้ว', stage: 'booking', assignedTo: 'A', createdAt: '2026-10-01T02:00:00Z' },
      { id: 'c5', firstName: 'เสีย', stage: 'pp', isLost: true, assignedTo: 'A', createdAt: '2026-10-01T02:00:00Z' },
      { id: 'c6', firstName: 'ของ B', stage: 'pp', assignedTo: 'B', createdAt: '2026-10-01T02:00:00Z' },
    ],
    followups: [
      { id: 'f1', status: 'pending', dueDate: '2026-10-23', salesperson: 'A', customerName: 'x' },
      { id: 'f2', status: 'pending', dueDate: '2026-10-25', salesperson: 'A' },
      { id: 'f3', status: 'pending', dueDate: '2026-10-26', salesperson: 'A' },
      { id: 'f4', status: 'done', dueDate: '2026-10-20', salesperson: 'A' },
      { id: 'f5', status: 'pending', dueDate: '2026-10-24', salesperson: 'A', autoLead: true, customerId: 'c4' },
    ],
    bookings: [
      { id: 'b1', status: 'ส่งมอบแล้ว', cutDate: '2026-10-05', salesName: 'A' },
      { id: 'b2', status: 'ส่งมอบแล้ว', cutDate: '2026-10-05', salesName: 'A', totalIncome: 5000 },
      { id: 'b3', status: 'จองแล้ว', bookingDate: '2026-10-01', deliveryDate: '2026-10-27', salesName: 'A' },
      { id: 'b4', status: 'ถอนจอง', bookingDate: '2026-09-01', salesName: 'A' },
      { id: 'b5', status: 'จองแล้ว', bookingDate: '2026-10-20', deliveryDate: '2026-11-10', salesName: 'A' },
    ],
  }

  it('collects today\'s work for one salesperson', () => {
    const d = buildMyDay(data, { today, mine: n => n === 'A' })
    expect(d.followups.map(f => f.id)).toEqual(['f1', 'f2'])
    expect(d.followups[0].late).toBe(2)
    expect(d.newLeads.map(c => c.id)).toEqual(['c1'])
    expect(d.stale.map(c => c.id)).toEqual(['c2'])
    expect(d.stale[0].days).toBe(5)
    expect(d.income.map(b => b.id)).toEqual(['b1'])
    expect(d.stuck.map(b => b.id)).toEqual(['b3'])
    expect(d.deliveries.map(b => b.id)).toEqual(['b3'])
    expect(d.deliveries[0].inDays).toBe(2)
    expect(d.total).toBe(2 + 1 + 1 + 1)
  })

  it('shows everyone when mine is not limited', () => {
    const d = buildMyDay(data, { today })
    expect(d.stale.map(c => c.id).sort()).toEqual(['c2', 'c6'])
  })

  it('lists today\'s test drives in time order', () => {
    const testDrives = [
      { id: 't1', date: today, time: '15:00', status: 'confirmed', staff: 'A' },
      { id: 't2', date: today, time: '10:00', status: 'scheduled', staff: 'A' },
      { id: 't3', date: today, time: '11:00', status: 'done', staff: 'A' },
      { id: 't4', date: '2026-10-26', status: 'scheduled', staff: 'A' },
      { id: 't5', date: today, status: 'scheduled', staff: 'B' },
    ]
    expect(buildMyDay({ testDrives }, { today, mine: n => n === 'A' }).testDrives.map(t => t.id)).toEqual(['t2', 't1'])
  })

  it('flags finance waiting too long or rejected', () => {
    const bookings = [
      { id: 'w1', status: 'รอผลไฟแนนซ์', submitDate: '2026-10-20', salesName: 'A' },
      { id: 'w2', status: 'จองแล้ว', finStatus: 'รอผล', submitDate: '2026-10-24', salesName: 'A' },
      { id: 'r1', status: 'จองแล้ว', finStatus: 'ไม่ผ่าน', bookingDate: '2026-10-22', salesName: 'A' },
      { id: 'r2', status: 'ถอนจอง', finStatus: 'ไม่ผ่าน', salesName: 'A' },
      { id: 'ok', status: 'จองแล้ว', finStatus: 'ผ่าน', submitDate: '2026-10-01', salesName: 'A' },
    ]
    const d = buildMyDay({ bookings }, { today })
    expect(d.finance.map(b => b.id)).toEqual(['r1', 'w1'])
    expect(d.finance[1].days).toBe(5)
  })

  it('works with empty data', () => {
    expect(buildMyDay({}, { today }).total).toBe(0)
  })
})

describe('buildMyDay — รอส่งมอบแต่ยังไม่นัดวัน', () => {
  it('รอส่งมอบ/ตัดตัวเลขรอส่งมอบ ที่ไม่มีวันนัดหรือวันนัดผ่านไปแล้ว', () => {
    const today = '2026-10-25'
    const d = buildMyDay({ bookings: [
      { id: 'u1', status: 'รอส่งมอบ' },
      { id: 'u2', status: 'ตัดตัวเลขรอส่งมอบ', deliveryDate: '2026-10-20' },
      { id: 'u3', status: 'รอส่งมอบ', deliveryDate: '2026-10-27' },
      { id: 'u4', status: 'ส่งมอบแล้ว' },
      { id: 'u5', status: 'รอรถ' },
    ] }, { today })
    expect(d.unscheduled.map(b => b.id)).toEqual(['u1', 'u2'])
    expect(d.unscheduled[1].missed).toBe(true)
    expect(d.deliveries.map(b => b.id)).toEqual(['u3'])
  })
})

describe('buildMyDay — ตัดตัวเลขรอส่งมอบที่มีวันนัด', () => {
  it('ขึ้นในนัดส่งมอบที่กำลังจะถึงด้วย', () => {
    const d = buildMyDay({ bookings: [{ id: 'c1', status: 'ตัดตัวเลขรอส่งมอบ', deliveryDate: '2026-10-26', cutDate: '2026-10-20', totalIncome: 1 }, { id: 'c2', status: 'ส่งมอบแล้ว', deliveryDate: '2026-10-26' }] }, { today: '2026-10-25' })
    expect(d.deliveries.map(b => b.id)).toEqual(['c1'])
  })
})

describe('buildMyDay — นัดพรุ่งนี้', () => {
  it('นับนัดค้างที่ครบกำหนดพรุ่งนี้', () => {
    const d = buildMyDay({ followups: [
      { status: 'pending', dueDate: '2026-10-26' }, { status: 'pending', dueDate: '2026-10-26' },
      { status: 'done', dueDate: '2026-10-26' }, { status: 'pending', dueDate: '2026-10-27' },
    ] }, { today: '2026-10-25' })
    expect(d.tomorrow).toBe(2)
    expect(buildMyDay({}, { today: '2026-12-31' }).tomorrow).toBe(0)
  })
})

describe('buildMyDay — ติดต่อแล้ววันนี้', () => {
  it('นับลูกค้าของฉันที่ติดต่อวันนี้', () => {
    const d = buildMyDay({ customers: [
      { id: 'a', stage: 'booking', assignedTo: 'A', lastContactAt: '2026-10-25T03:00:00Z' },
      { id: 'b', stage: 'pp', assignedTo: 'B', lastContactAt: '2026-10-25T03:00:00Z' },
      { id: 'c', stage: 'pp', assignedTo: 'A', lastContactAt: '2026-10-24T03:00:00Z' },
      { id: 'd', stage: 'pp', assignedTo: 'A', lastContactAt: '2026-10-25T03:00:00Z', deleted: true },
    ] }, { today: '2026-10-25', mine: n => n === 'A' })
    expect(d.contactedToday).toBe(1)
  })
})

describe('buildMyDay — ลองติดต่อใหม่หลังเสียดีล', () => {
  it('เสียดีลเพราะยังไม่พร้อม/ไฟแนนซ์/ราคา 30–120 วันและยังไม่ได้ติดต่อ', () => {
    const d = buildMyDay({ customers: [
      { id: 'r1', isLost: true, lostAt: '2026-09-20T03:00:00Z', lostReason: 'ยังไม่พร้อม - รอโบนัส', assignedTo: 'A' },
      { id: 'r2', isLost: true, lostAt: '2026-08-01T03:00:00Z', lostReason: 'ไฟแนนซ์ไม่ผ่าน', assignedTo: 'A' },
      { id: 'x1', isLost: true, lostAt: '2026-10-10T03:00:00Z', lostReason: 'ราคา', assignedTo: 'A' },
      { id: 'x2', isLost: true, lostAt: '2026-09-01T03:00:00Z', lostReason: 'ซื้อคู่แข่ง', assignedTo: 'A' },
      { id: 'x3', isLost: true, lostAt: '2026-09-01T03:00:00Z', lostReason: 'ราคา', assignedTo: 'A', lastContactAt: '2026-10-01T03:00:00Z' },
      { id: 'x4', isLost: true, lostAt: '2026-05-01T03:00:00Z', lostReason: 'ราคา', assignedTo: 'A' },
      { id: 'x5', isLost: true, lostAt: '2026-09-01T03:00:00Z', lostReason: 'ราคา', assignedTo: 'B' },
      { id: 'x6', isLost: false, lostAt: '2026-09-01T03:00:00Z', lostReason: 'ราคา', assignedTo: 'A' },
    ] }, { today: '2026-10-25', mine: n => n === 'A' })
    expect(d.revisit.map(c => c.id)).toEqual(['r1', 'r2'])
    expect(d.revisit[0].days).toBe(35)
    expect(d.total).toBe(0)
  })
})

describe('buildMyDay — Hot ขึ้นก่อน', () => {
  it('Lead เงียบที่เป็น Hot อยู่บนสุด', () => {
    const d = buildMyDay({ customers: [
      { id: 'a', stage: 'pp', createdAt: '2026-10-01T03:00:00Z' },
      { id: 'b', stage: 'pp', temperature: 'hot', createdAt: '2026-10-20T03:00:00Z' },
    ] }, { today: '2026-10-25' })
    expect(d.stale.map(c => c.id)).toEqual(['b', 'a'])
  })
})

describe('buildMyDay — Hot ที่ยังไม่มีนัด', () => {
  it('เฉพาะ Hot ของฉันที่ไม่มีนัดค้าง', () => {
    const d = buildMyDay({
      customers: [
        { id: 'h1', stage: 'pp', temperature: 'hot', assignedTo: 'A' },
        { id: 'h2', stage: 'pp', temperature: 'hot', assignedTo: 'A' },
        { id: 'h3', stage: 'pp', temperature: 'hot', assignedTo: 'B' },
        { id: 'h4', stage: 'booking', temperature: 'hot', assignedTo: 'A' },
        { id: 'h5', stage: 'lead', temperature: 'warm', assignedTo: 'A' },
      ],
      followups: [{ status: 'pending', customerId: 'h2', dueDate: '2026-10-30', salesperson: 'A' }, { status: 'done', customerId: 'h1', dueDate: '2026-10-20' }],
    }, { today: '2026-10-25', mine: n => n === 'A' })
    expect(d.hotNoPlan.map(c => c.id)).toEqual(['h1'])
  })
})
