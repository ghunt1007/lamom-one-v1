import { describe, it, expect, vi } from 'vitest'
import { isStatusAsk, statusAskReply, handleStatusAsk } from './statusAsk.js'

const U = 'U' + 'a'.repeat(32)
const today = '2026-11-22'

describe('isStatusAsk', () => {
  it('จับคำถามสถานะรถ ไม่จับข้อความทั่วไป', () => {
    for (const t of ['รถมาเมื่อไหร่ครับ', 'รถของผมจะมาถึงเมื่อไร', 'ได้รถวันไหนคะ', 'สถานะรถ', 'เช็คสถานะ', 'รับรถได้เมื่อไหร่']) expect(isStatusAsk(t)).toBe(true)
    for (const t of ['สวัสดีครับ', 'ราคา S07 เท่าไหร่', 'มีรถสีขาวไหม', '']) expect(isStatusAsk(t)).toBe(false)
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
