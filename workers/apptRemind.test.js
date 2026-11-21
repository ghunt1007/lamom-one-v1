import { describe, it, expect, vi } from 'vitest'
import { pickApptReminders, runApptRemind, remindText } from './apptRemind.js'

const U1 = 'U' + 'a'.repeat(32), U2 = 'U' + 'b'.repeat(32)
const tomorrow = '2026-11-23'
const customers = [
  { id: 'c1', firstName: 'สมชาย', phone: '081-234-5678', lineUserId: U1 },
  { id: 'c2', firstName: 'มานี', phone: '0899999999', lineUserId: U2, lineOptOut: true },
  { id: 'c3', firstName: 'ปิติ', phone: '0861111111' },
]

describe('pickApptReminders', () => {
  it('นัดรับรถ/ทดลองขับ/โชว์รูมพรุ่งนี้ เฉพาะคนที่ผูก LINE ไม่เลิกรับ · คนเดียวหลายนัดส่งข้อความเดียว', () => {
    const { send, also } = pickApptReminders({
      tomorrow, customers,
      bookings: [
        { id: 'b1', status: 'รอส่งมอบ', customerId: 'c1', custName: 'สมชาย ใจดี', brand: 'DEEPAL', model: 'S07', deliveryDate: tomorrow, deliveryTime: '10:30' },
        { id: 'b2', status: 'ส่งมอบแล้ว', customerId: 'c1', deliveryDate: tomorrow },
        { id: 'b3', status: 'รอส่งมอบ', customerId: 'c2', deliveryDate: tomorrow },
        { id: 'b4', status: 'รอส่งมอบ', customerId: 'c1', deliveryDate: '2026-11-24' },
        { id: 'b5', status: 'รอส่งมอบ', customerId: 'c1', deliveryDate: tomorrow, lineRemindFor: tomorrow },
      ],
      testDrives: [{ id: 't1', date: tomorrow, time: '14:00', status: 'scheduled', phone: '0812345678', model: 'L07' }, { id: 't2', date: tomorrow, status: 'cancelled', customerId: 'c1' }],
      appointments: [{ id: 'a1', date: tomorrow, time: '09:00', status: 'scheduled', phone: '0861111111' }],
    })
    expect(send).toHaveLength(1)
    expect(send[0]).toMatchObject({ col: 'bookings', id: 'b1', to: U1 })
    expect(send[0].text).toContain('สวัสดีครับคุณสมชาย')
    expect(send[0].text).toContain('นัดรับรถ DEEPAL S07 พรุ่งนี้ 23/11/2569 เวลา 10:30 น.')
    expect(also).toEqual([{ col: 'test_drives', id: 't1' }])
  })
  it('ข้อความทดลองขับ/โชว์รูม', () => {
    expect(remindText('testdrive', { name: 'เอ', date: tomorrow, time: '14:00', what: 'L07' })).toContain('นัดทดลองขับ L07 พรุ่งนี้ 23/11/2569 เวลา 14:00 น.')
    expect(remindText('showroom', { date: tomorrow })).toMatch(/^สวัสดีครับ ขอเตือนนัดเข้าโชว์รูม/)
  })
})

describe('runApptRemind', () => {
  const deps = over => ({
    enabled: true, hour: 17, tomorrow,
    list: async col => ({ customers, bookings: [{ id: 'b1', status: 'รอรถ', customerId: 'c1', deliveryDate: tomorrow }], test_drives: [], appointments: [] })[col],
    pushLine: vi.fn(async () => true), mark: vi.fn(async () => true), ...over,
  })
  it('ปิดสวิตช์/ไม่ใช่ 17:00 = ไม่ทำอะไร', async () => {
    expect((await runApptRemind(deps({ enabled: false }))).skipped).toBe('off')
    expect((await runApptRemind(deps({ hour: 9 }))).skipped).toBe('hour')
  })
  it('จดก่อนส่ง · จดไม่ได้ = ไม่ส่ง', async () => {
    const d = deps()
    expect(await runApptRemind(d)).toEqual({ sent: 1, failed: 0 })
    expect(d.mark).toHaveBeenCalledWith('bookings', 'b1', { lineRemindFor: { stringValue: tomorrow } })
    const d2 = deps({ mark: vi.fn(async () => false) })
    expect((await runApptRemind(d2)).sent).toBe(0)
    expect(d2.pushLine).not.toHaveBeenCalled()
  })
})
