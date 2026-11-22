import { describe, it, expect, vi } from 'vitest'
import { isStatusAsk, statusAskReply, handleStatusAsk, isJobAsk, jobAskReply, isDueAsk, dueAskReply, isApptAsk, apptAskReply } from './statusAsk.js'

const U = 'U' + 'a'.repeat(32)
const today = '2026-11-22'

describe('isStatusAsk', () => {
  it('จับคำถามสถานะรถ ไม่จับข้อความทั่วไป', () => {
    for (const t of ['รถมาเมื่อไหร่ครับ', 'รถของผมจะมาถึงเมื่อไร', 'ได้รถวันไหนคะ', 'สถานะรถ', 'เช็คสถานะ', 'รับรถได้เมื่อไหร่', 'รถมายังครับ', 'รถถึงหรือยังคะ', 'ได้รถยัง', 'รถเข้าโชว์รูมแล้วหรือยัง']) expect(isStatusAsk(t)).toBe(true)
    for (const t of ['สวัสดีครับ', 'ราคา S07 เท่าไหร่', 'มีรถสีขาวไหม', 'รถมายังไงคะ', 'ไปโชว์รูมยังไง', 'ได้รถยังไงบ้าง', '']) expect(isStatusAsk(t)).toBe(false)
  })
})

describe('statusAskReply', () => {
  const mine = [{ id: 'b1', status: 'รอรถ', custName: 'สมชาย ใจดี', brand: 'DEEPAL', model: 'S07', colorOut: 'ขาว', bookingDate: '2026-11-01', salesName: 'บี' }]
  it('รอรถ + มีรถกำลังขนส่ง → บอกวันที่ประมาณ ไม่บอกเลขตัวถัง/คิวคนอื่น', () => {
    const t = statusAskReply({ mine, all: mine, vehicles: [{ id: 'v1', status: 'transit', brand: 'DEEPAL', model: 'DEEPAL S07', color: 'ขาว', vin: 'SECRETVIN', eta: '2026-12-05' }], orders: [], today })
    expect(t).toContain('สวัสดีครับคุณสมชาย')
    expect(t).toContain('ประมาณ 05/12/2569')
    expect(t).not.toContain('SECRETVIN')
    expect(t).not.toContain('รอก่อน')
  })
  it('ยังไม่มีรถรองรับ → ข้อความกลางๆ · ส่งมอบแล้ว/ไม่มีใบจอง → null', () => {
    expect(statusAskReply({ mine, all: mine, today })).toContain('กำลังจัดสรรรถ')
    expect(statusAskReply({ mine: [{ id: 'b2', status: 'ส่งมอบแล้ว' }], today })).toBeNull()
    expect(statusAskReply({ mine: [], today })).toBeNull()
  })
  it('ตัดตัวเลขรอส่งมอบ = ยังตอบ (ลูกค้ายังไม่ได้รับรถ)', () => {
    expect(statusAskReply({ mine: [{ id: 'b4', status: 'ตัดตัวเลขรอส่งมอบ', model: 'S07', vin: 'X', deliveryDate: '2026-11-25' }], today })).toContain('จดทะเบียนเรียบร้อย')
  })
  it('รอส่งมอบ → ใช้ข้อความสถานะเดิม (มีนัดส่งมอบ)', () => {
    expect(statusAskReply({ mine: [{ id: 'b3', status: 'รอส่งมอบ', model: 'L07', vin: 'X', deliveryDate: '2026-11-30' }], today })).toContain('นัดส่งมอบวันที่')
  })
})

describe('handleStatusAsk', () => {
  const rows = {
    'bookings:lineUserId': [{ id: 'b1', status: 'รอรถ', custName: 'สมชาย', model: 'S07', colorOut: 'ขาว', lineUserId: U }],
  }
  const query = vi.fn(async (col, f, eq) => rows[`${col}:${eq?.[0]}`] || (col === 'bookings' && !eq ? rows['bookings:lineUserId'] : []))
  it('สวิตช์ปิด/ไม่ใช่คำถาม = ไม่ตอบ', async () => {
    const send = vi.fn(async () => true)
    expect(await handleStatusAsk({ enabled: false, userId: U, text: 'รถมาเมื่อไหร่', query, send, today })).toBe(false)
    expect(await handleStatusAsk({ enabled: true, userId: U, text: 'สวัสดี', query, send, today })).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
  it('ตอบ + บันทึกลงแชต', async () => {
    const send = vi.fn(async () => true), record = vi.fn()
    expect(await handleStatusAsk({ enabled: true, userId: U, text: 'รถมาเมื่อไหร่ครับ', query, send, record, today })).toBe(true)
    expect(send.mock.calls[0][0]).toContain('สมชาย')
    expect(record).toHaveBeenCalled()
  })
  it('LINE นี้ไม่มีใบจอง = ปล่อยให้ AI/ทีมตอบ', async () => {
    const send = vi.fn(async () => true)
    expect(await handleStatusAsk({ enabled: true, userId: 'U' + 'b'.repeat(32), text: 'รถมาเมื่อไหร่', query: async () => [], send, today })).toBe(false)
  })
})

describe('ถามงานศูนย์บริการ (v1.0.1266)', () => {
  it('จับคำถาม', () => {
    for (const x of ['รถซ่อมเสร็จยังครับ', 'เช็คระยะเสร็จหรือยัง', 'รถเสร็จยัง', 'ศูนย์ได้รถกี่โมง']) expect(isJobAsk(x)).toBe(true)
    for (const x of ['ไปศูนย์ยังไง', 'ราคาเช็คระยะเท่าไหร่', 'สวัสดี']) expect(isJobAsk(x)).toBe(false)
  })
  it('ตอบจากใบงานล่าสุด · ไม่มีงานค้าง = null', () => {
    const t = jobAskReply({ name: 'สมชาย ใจดี', jobs: [
      { id: 'j1', status: 'done', brand: 'DEEPAL', model: 'S07', plate: 'กข 1', updatedAt: '2026-11-22T03:00:00Z' },
      { id: 'j2', status: 'delivered', updatedAt: '2026-11-22T04:00:00Z' },
    ] })
    expect(t).toContain('สวัสดีครับคุณสมชาย')
    expect(t).toContain('🔧 รถ DEEPAL S07 ทะเบียน กข 1: เสร็จเรียบร้อย พร้อมให้มารับได้เลย')
    expect(jobAskReply({ jobs: [{ id: 'j2', status: 'delivered' }] })).toBe(null)
  })
  it('handleStatusAsk ตอบงานศูนย์ของลูกค้าที่ผูก LINE', async () => {
    const send = vi.fn(async () => true)
    const query = vi.fn(async (col, f, eq) => col === 'customers' ? [{ id: 'c1', firstName: 'สมชาย', phone: '0812345678' }]
      : col === 'job_cards' && eq?.[0] === 'customerId' ? [{ id: 'j1', status: 'waiting_parts', model: 'S07' }] : [])
    expect(await handleStatusAsk({ enabled: true, userId: U, text: 'รถซ่อมเสร็จยัง', today, query, send })).toBe(true)
    expect(send.mock.calls[0][0]).toContain('รออะไหล่')
  })
})

describe('ถามกำหนดเช็คระยะ (v1.0.1282)', () => {
  it('จับคำถาม', () => {
    for (const x of ['เช็คระยะครั้งหน้าเมื่อไหร่ครับ', 'ต้องเข้าศูนย์เมื่อไร', 'ครบกำหนดเช็คระยะยัง', 'รอบหน้าเข้าศูนย์วันไหน']) expect(isDueAsk(x)).toBe(true)
    for (const x of ['เช็คระยะราคาเท่าไหร่', 'รถซ่อมเสร็จยัง', 'สวัสดี']) expect(isDueAsk(x)).toBe(false)
  })
  it('ตอบรายการถัดไป บอกจองแล้ว/เลยกำหนด · ไม่มี = null', () => {
    const t = dueAskReply({ name: 'มานี', today: '2026-11-22', reminders: [
      { dueDate: '2026-12-05', model: 'S07', plate: 'กข 1', detail: '10,000 km', booked: true },
      { dueDate: '2026-11-20', model: 'L07' },
      { dueDate: '2026-01-01', model: 'old' },
    ] })
    expect(t).toContain('สวัสดีครับคุณมานี')
    expect(t.indexOf('L07')).toBeLessThan(t.indexOf('S07'))
    expect(t).toContain('วันที่ 20/11/2569 (เลยกำหนดมา 2 วัน)')
    expect(t).toContain('S07 ทะเบียน กข 1: ถึงกำหนดเข้าศูนย์ (10,000 km) วันที่ 05/12/2569 · จองคิวไว้แล้ว')
    expect(t).not.toContain('old')
    expect(dueAskReply({ reminders: [], today: '2026-11-22' })).toBe(null)
  })
  it('handleStatusAsk จับเบอร์แบบมีขีด', async () => {
    const send = vi.fn(async () => true)
    const query = vi.fn(async col => col === 'customers' ? [{ id: 'c1', firstName: 'มานี', phone: '0812345678' }]
      : col === 'service_reminders' ? [{ phone: '081-234-5678', dueDate: '2026-12-01', model: 'S07' }, { phone: '0899999999', dueDate: '2026-12-02', model: 'X' }] : [])
    expect(await handleStatusAsk({ enabled: true, userId: U, text: 'เช็คระยะครั้งหน้าเมื่อไหร่', today, query, send })).toBe(true)
    expect(send.mock.calls[0][0]).toContain('S07')
    expect(send.mock.calls[0][0]).not.toContain(' X')
  })
})

describe('ถามนัดของตัวเอง (v1.0.1288)', () => {
  it('จับคำถาม', () => {
    for (const x of ['นัดวันไหนนะครับ', 'นัดทดลองขับกี่โมง', 'นัดเข้าศูนย์วันที่เท่าไหร่', 'นัดของผมเมื่อไหร่']) expect(isApptAsk(x)).toBe(true)
    for (const x of ['นัดรับรถวันไหน', 'ขอนัดทดลองขับ', 'สวัสดี']) expect(isApptAsk(x)).toBe(false)
  })
  it('ตอบนัดที่ยังไม่ถึง เรียงตามวันเวลา · ไม่มี = null', () => {
    const t = apptAskReply({ name: 'มานี', today: '2026-11-22', items: [
      { kind: 'service', date: '2026-11-25', time: '09:00', what: 'เช็คระยะ' },
      { kind: 'testdrive', date: '2026-11-22', time: '14:30:00', what: 'S07' },
      { kind: 'showroom', date: '2026-11-01' },
    ] })
    expect(t).toContain('📅 ทดลองขับ (S07): วันนี้ เวลา 14:30 น.')
    expect(t).toContain('📅 เข้าศูนย์บริการ (เช็คระยะ): วันที่ 25/11/2569 เวลา 09:00 น.')
    expect(t.indexOf('ทดลองขับ')).toBeLessThan(t.indexOf('ศูนย์บริการ'))
    expect(t).not.toContain('โชว์รูม')
    expect(apptAskReply({ items: [], today: '2026-11-22' })).toBe(null)
  })
  it('handleStatusAsk ไม่เอานัดที่ยกเลิก/ของคนอื่น', async () => {
    const send = vi.fn(async () => true)
    const query = vi.fn(async col => col === 'customers' ? [{ id: 'c1', firstName: 'มานี', phone: '0812345678' }]
      : col === 'test_drives' ? [{ customerId: 'c1', date: '2026-11-23', model: 'S07' }, { customerId: 'c1', date: '2026-11-24', status: 'cancelled', model: 'X1' }, { customerId: 'zz', date: '2026-11-23', model: 'OTHER' }]
      : col === 'service_appointments' ? [{ phone: '081-234-5678', date: '2026-11-26', type: 'เช็คระยะ' }] : [])
    expect(await handleStatusAsk({ enabled: true, userId: U, text: 'นัดวันไหนครับ', today, query, send })).toBe(true)
    const m = send.mock.calls[0][0]
    expect(m).toContain('S07'); expect(m).toContain('เช็คระยะ'); expect(m).not.toContain('X1'); expect(m).not.toContain('OTHER')
  })
})
