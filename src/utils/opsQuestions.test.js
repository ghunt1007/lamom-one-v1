import { describe, it, expect } from 'vitest'
import { parseOpsSpec, testDriveAnswer, showroomAnswer, lineWaitingAnswer, complaintAnswer, newCustomerAnswer, annivAnswer, opsFollowUps, deliveryAnswer, incomeMissingAnswer, lostAnswer, serviceAnswer, unassignedAnswer, reminderAnswer, overdueAnswer } from './opsQuestions.js'

const T = '2026-11-12'

describe('parseOpsSpec', () => {
  it('routes common daily questions', () => {
    expect(parseOpsSpec('นัดทดลองขับวันนี้มีใครบ้าง')).toEqual({ kind: 'testdrive', day: 'today' })
    expect(parseOpsSpec('นัดทดลองขับพรุ่งนี้มีใครบ้าง')).toEqual({ kind: 'testdrive', day: 'tomorrow' })
    expect(parseOpsSpec('พรุ่งนี้มีใครนัดเข้าโชว์รูม')).toEqual({ kind: 'showroom', day: 'tomorrow' })
    expect(parseOpsSpec('มีลูกค้าทัก LINE รอตอบไหม').kind).toBe('line')
    expect(parseOpsSpec('ลูกค้าร้องเรียนค้างอยู่ไหม').kind).toBe('complaint')
    expect(parseOpsSpec('ลูกค้าใหม่เดือนนี้กี่คน')).toEqual({ kind: 'newcust', period: 'month' })
    expect(parseOpsSpec('ลีดใหม่สัปดาห์นี้กี่คน')).toEqual({ kind: 'newcust', period: 'week' })
    expect(parseOpsSpec('ใครเกิดวันนี้')).toEqual({ kind: 'anniv', range: 0 })
    expect(parseOpsSpec('ใครครบรอบซื้อรถเดือนนี้')).toEqual({ kind: 'anniv', range: 30 })
  })
  it('leaves commands and unrelated questions alone', () => {
    expect(parseOpsSpec('นัดทดลองขับสมชายพรุ่งนี้ 10 โมง')).toBeNull()
    expect(parseOpsSpec('ลูกค้าใหม่วันนี้มีใครบ้าง')).toBeNull()
    expect(parseOpsSpec('ราคา S07 เท่าไหร่')).toBeNull()
  })
})

describe('answers', () => {
  it('lists today and tomorrow test drives by time', () => {
    const rows = [
      { customerName: 'บี', date: T, time: '14:00', model: 'S07', staff: 'เอ', status: 'scheduled' },
      { customerName: 'เอ', date: T, time: '09:30', status: 'confirmed' },
      { customerName: 'ซี', date: T, status: 'done' },
      { customerName: 'ดี', date: '2026-11-13', status: 'scheduled' },
      { customerName: 'อี', date: T, status: 'scheduled', deleted: true },
    ]
    const r = testDriveAnswer(rows, { today: T })
    expect(r.n).toBe(2)
    expect(r.text.indexOf('09:30 เอ')).toBeLessThan(r.text.indexOf('14:00 บี'))
    expect(testDriveAnswer(rows, { today: T, day: 'tomorrow' }).text).toContain('ดี')
    expect(testDriveAnswer([], { today: T }).text).toContain('ไม่มีนัดทดลองขับ')
  })
  it('lists showroom appointments', () => {
    const r = showroomAnswer([{ custName: 'สมชาย', date: T, time: '10:00', salesperson: 'เอ' }], { today: T })
    expect(r.text).toContain('10:00 สมชาย')
  })
  it('lists LINE chats waiting for a reply', () => {
    const r = lineWaitingAnswer([
      { platform: 'line', unread: true, lastDirection: 'in', userId: 'U1', lastText: 'สนใจ S07' },
      { platform: 'line', unread: false, lastDirection: 'in', userId: 'U2' },
      { platform: 'line', unread: true, lastDirection: 'out', userId: 'U3' },
    ], [{ id: 'c1', firstName: 'มานี', lineUserId: 'U1', assignedTo: 'เอ' }])
    expect(r.n).toBe(1)
    expect(r.text).toContain('มานี: "สนใจ S07"')
    expect(lineWaitingAnswer([], []).text).toContain('ไม่มี')
  })
  it('lists open complaints, critical first, flags unassigned', () => {
    const r = complaintAnswer([
      { custName: 'ก', subject: 'แอร์ไม่เย็น', status: 'open', openDate: '2026-11-10' },
      { custName: 'ข', subject: 'รถช้า', status: 'escalated', priority: 'critical', openDate: '2026-11-11', assignedTo: 'บี' },
      { custName: 'ค', status: 'closed' },
    ], { today: T })
    expect(r.n).toBe(2)
    expect(r.text).toContain('ยังไม่มีผู้รับผิดชอบ 1')
    expect(r.text.indexOf('🔴 ข')).toBeLessThan(r.text.indexOf('ก —'))
    expect(r.text).toContain('ค้าง 2 วัน')
  })
  it('counts new customers this month by source label', () => {
    const r = newCustomerAnswer([
      { createdAt: '2026-11-02T03:00:00Z', source: 'facebook', temperature: 'hot' },
      { createdAt: '2026-11-10T03:00:00Z', source: 'facebook', bookingId: 'b1' },
      { createdAt: '2026-11-11T03:00:00Z', source: 'walk-in' },
      { createdAt: '2026-10-30T03:00:00Z', source: 'walk-in' },
    ], { today: T, sourceLabel: { facebook: 'Facebook', 'walk-in': 'Walk-in' } })
    expect(r.n).toBe(3)
    expect(r.text).toContain('Hot 1 · 📝 จองแล้ว 1')
    expect(r.text).toContain('• Facebook 2 คน')
    expect(newCustomerAnswer([{ createdAt: '2026-10-30T03:00:00Z' }], { today: T, period: 'prevmonth' }).n).toBe(1)
  })
  it('explains birthdays are not stored and shows purchase anniversaries', () => {
    const b = [{ customerName: 'สมใจ', model: 'S05', status: 'ส่งมอบแล้ว', deliveryDate: '2025-11-12' }, { customerName: 'ใหม่', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-01' }]
    const r = annivAnswer(b, { today: T, asked: 'ใครเกิดวันนี้' })
    expect(r.text).toContain('ระบบยังไม่ได้เก็บวันเกิด')
    expect(r.text).toContain('สมใจ · S05 · ครบ 1 ปี')
    expect(annivAnswer(b, { today: T, range: 30 }).n).toBe(1)
  })
  it('suggests follow-ups', () => {
    expect(opsFollowUps({ kind: 'testdrive', day: 'today' })[0]).toBe('นัดทดลองขับพรุ่งนี้มีใครบ้าง')
  })
})

describe('deliveries and missing income', () => {
  it('routes delivery, income and source questions', () => {
    expect(parseOpsSpec('มีนัดส่งมอบพรุ่งนี้ไหม')).toEqual({ kind: 'delivery', day: 'tomorrow' })
    expect(parseOpsSpec('นัดส่งมอบสัปดาห์นี้มีใครบ้าง')).toEqual({ kind: 'delivery', day: 'week' })
    expect(parseOpsSpec('ยอดส่งมอบเดือนนี้')).toBeNull()
    expect(parseOpsSpec('ใครยังไม่กรอกรายได้')).toEqual({ kind: 'income' })
    expect(parseOpsSpec('ลูกค้ามาจากช่องทางไหนมากสุด')).toEqual({ kind: 'newcust', period: 'month' })
  })
  it('lists deliveries in range, skips delivered and cancelled', () => {
    const b = [
      { customerName: 'ก', model: 'S07', status: 'รอส่งมอบ', deliveryDate: '2026-11-13', salesName: 'เอ' },
      { customerName: 'ข', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-13' },
      { customerName: 'ค', status: 'ถอนจอง', deliveryDate: '2026-11-13' },
      { customerName: 'ง', status: 'รอรถ', deliveryDate: '2026-11-16' },
    ]
    expect(deliveryAnswer(b, { today: T, day: 'tomorrow' }).n).toBe(1)
    expect(deliveryAnswer(b, { today: T, day: 'week' }).n).toBe(2)
    expect(deliveryAnswer(b, { today: T }).text).toContain('ไม่มีนัดส่งมอบ')
  })
  it('groups delivered-without-income by salesperson for this month', () => {
    const r = incomeMissingAnswer([
      { status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-11-03', salesName: 'เอ' },
      { status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-11-05', salesName: 'เอ' },
      { status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-11-05', salesName: 'บี', totalIncome: 5000 },
      { status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-10-05', salesName: 'บี' },
    ], { today: T })
    expect(r.n).toBe(2)
    expect(r.text).toContain('• เอ — 2 คัน')
  })
})

describe('lost deals', () => {
  it('summarises this month lost deals by reason and seller', () => {
    expect(parseOpsSpec('เดือนนี้เสียดีลไปกี่ราย เพราะอะไร')).toEqual({ kind: 'lost', prev: false })
    const r = lostAnswer([
      { isLost: true, lostAt: '2026-11-05T03:00:00Z', lostReason: 'ราคา แพงไป', assignedTo: 'เอ' },
      { isLost: true, lostAt: '2026-11-06T03:00:00Z', lostReason: 'ซื้อคู่แข่ง', assignedTo: 'บี' },
      { isLost: true, lostAt: '2026-10-06T03:00:00Z', lostReason: 'ราคา', assignedTo: 'บี' },
    ], { today: T })
    expect(r.n).toBe(2)
    expect(r.text).toContain('• ราคา 1 ราย')
    expect(r.text).toContain('👤 รายเซลส์')
    expect(lostAnswer([], { today: T }).text).toContain('ยังไม่มี')
  })
})

describe('service + unassigned (v1.0.1082)', () => {
  it('parses service and unassigned questions', () => {
    expect(parseOpsSpec('รถเข้าศูนย์วันนี้กี่คัน')).toEqual({ kind: 'service', day: 'today' })
    expect(parseOpsSpec('งานซ่อมค้างอยู่กี่งาน').kind).toBe('service')
    expect(parseOpsSpec('ค่าซ่อมเท่าไหร่')).toBeNull()
    expect(parseOpsSpec('ลูกค้าที่ยังไม่มีผู้ดูแลมีใครบ้าง')).toEqual({ kind: 'unassigned' })
  })
  it('serviceAnswer lists today appointments and open jobs by status', () => {
    const r = serviceAnswer([{ date: T, time: '09:00', custName: 'ก', status: 'scheduled' }, { date: T, custName: 'ข', status: 'cancelled' }],
      [{ status: 'waiting_parts', custName: 'ค', createdAt: '2026-11-01' }, { status: 'delivered', custName: 'ง' }, { status: 'inprogress', custName: 'จ', createdAt: T }], { today: T })
    expect(r.text).toContain('นัดเข้าศูนย์วันนี้')
    expect(r.text).toContain('— 1 คัน')
    expect(r.text).toContain('งานซ่อมที่ยังไม่ส่งคืน 2 งาน')
    expect(r.text).toContain('📦 รออะไหล่ 1 งาน')
    expect(r.text).toContain('ค้างนานเกิน 3 วัน 1 งาน')
    expect(serviceAnswer([], [], { today: T }).text).toContain('ไม่มีงานซ่อมค้าง')
  })
  it('unassignedAnswer skips lost and assigned customers', () => {
    const r = unassignedAnswer([{ firstName: 'A', createdAt: T }, { firstName: 'B', assignedTo: 'x' }, { firstName: 'C', isLost: true }])
    expect(r.n).toBe(1)
    expect(r.text).toContain('• A')
    expect(unassignedAnswer([{ assignedTo: 'x' }]).n).toBe(0)
  })
})

describe('reminder + overdue (v1.0.1086)', () => {
  it('parses', () => {
    expect(parseOpsSpec('เตือนเข้าศูนย์เดือนนี้มีใครบ้าง')).toEqual({ kind: 'reminder', range: 30 })
    expect(parseOpsSpec('งานที่เลยกำหนดมีอะไรบ้าง')).toEqual({ kind: 'overdue' })
    expect(parseOpsSpec('ค่างวดเลยกำหนดผ่อน')).toBeNull()
  })
  it('reminderAnswer lists unbooked reminders due soon or recently late', () => {
    const r = reminderAnswer([{ customer: 'ก', dueDate: '2026-11-20' }, { customer: 'ข', dueDate: '2026-11-01', contacted: true }, { customer: 'ค', dueDate: '2026-11-15', booked: true }, { customer: 'ง', dueDate: '2027-03-01' }], { today: T })
    expect(r.n).toBe(2)
    expect(r.text).toContain('เลยกำหนดแล้ว 1')
    expect(r.text).toContain('✅ ติดต่อแล้ว')
  })
  it('overdueAnswer counts only overdue items', () => {
    const r = overdueAnswer([{ kind: 'task', title: 'โทรหา A', date: '2026-11-10', overdue: true }, { kind: 'task', title: 'B', date: '2026-11-13' }], { today: T, labels: { task: { icon: '✅', label: 'งาน' } } })
    expect(r.n).toBe(1)
    expect(r.text).toContain('เลย 2 วัน')
    expect(overdueAnswer([], { today: T }).text).toContain('ไม่มีงานที่เลยกำหนด')
  })
})
