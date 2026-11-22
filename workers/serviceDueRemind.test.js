import { describe, it, expect, vi } from 'vitest'
import { pickServiceDue, runServiceDue, serviceDueText } from './serviceDueRemind.js'

const U1 = 'U' + 'a'.repeat(32), U2 = 'U' + 'b'.repeat(32)
const today = '2026-11-22'
const customers = [
  { id: 'c1', firstName: 'สมชาย', phone: '081-234-5678', lineUserId: U1 },
  { id: 'c2', firstName: 'มานี', phone: '0899999999', lineUserId: U2, lineOptOut: true },
  { id: 'c3', firstName: 'ปิติ', phone: '0861111111' },
]

describe('pickServiceDue', () => {
  it('เฉพาะใกล้ครบ 0–7 วัน ยังไม่จองคิว ผูก LINE ไม่เลิกรับ ยังไม่เคยส่งรอบนี้ · คนเดียวส่งข้อความเดียว', () => {
    const send = pickServiceDue({ today, customers, reminders: [
      { id: 'r1', customer: 'สมชาย ใจดี', phone: '0812345678', plate: 'กข 1234', model: 'S07', detail: 'เช็กระยะ 10,000 km', dueDate: '2026-11-25' },
      { id: 'r2', phone: '0812345678', dueDate: '2026-11-26' },
      { id: 'r3', phone: '0812345678', dueDate: '2026-12-10' },
      { id: 'r4', phone: '0812345678', dueDate: '2026-11-21' },
      { id: 'r5', phone: '0812345678', dueDate: '2026-11-24', booked: true },
      { id: 'r6', phone: '0812345678', dueDate: '2026-11-23', lineDueSent: '2026-11-23' },
      { id: 'r7', phone: '0899999999', dueDate: '2026-11-23' },
      { id: 'r8', phone: '0861111111', dueDate: '2026-11-23' },
    ] })
    expect(send).toHaveLength(1)
    expect(send[0]).toMatchObject({ id: 'r1', to: U1, dueDate: '2026-11-25' })
    expect(send[0].text).toContain('สวัสดีครับคุณสมชาย รถ S07 ทะเบียน กข 1234 ถึงกำหนดเข้าศูนย์ (เช็กระยะ 10,000 km) วันที่ 25/11/2569')
  })
  it('ครบวันนี้ = "วันนี้"', () => {
    expect(serviceDueText({ dueDate: today, today })).toMatch(/^สวัสดีครับ รถของคุณ ถึงกำหนดเข้าศูนย์ วันนี้/)
  })
})

describe('runServiceDue', () => {
  const deps = over => ({
    enabled: true, hour: 10, today,
    list: async col => ({ customers, service_reminders: [{ id: 'r1', phone: '0812345678', dueDate: '2026-11-24' }] })[col],
    pushLine: vi.fn(async () => true), mark: vi.fn(async () => true), ...over,
  })
  it('ปิดสวิตช์/ไม่ใช่ 10:00 = ไม่ทำอะไร', async () => {
    expect((await runServiceDue(deps({ enabled: false }))).skipped).toBe('off')
    expect((await runServiceDue(deps({ hour: 17 }))).skipped).toBe('hour')
  })
  it('จดก่อนส่ง · จดไม่ได้ = ไม่ส่ง', async () => {
    const d = deps()
    expect(await runServiceDue(d)).toEqual({ sent: 1, failed: 0 })
    expect(d.mark).toHaveBeenCalledWith('service_reminders', 'r1', { lineDueSent: { stringValue: '2026-11-24' } })
    const d2 = deps({ mark: vi.fn(async () => false) })
    expect((await runServiceDue(d2)).sent).toBe(0)
    expect(d2.pushLine).not.toHaveBeenCalled()
  })
})
