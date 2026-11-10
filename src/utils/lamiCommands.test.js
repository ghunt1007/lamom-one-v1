import { describe, it, expect, vi } from 'vitest'
import { parseLamiCommand, runLamiCommand, timeIn } from './lamiCommands.js'

const T = '2026-11-10' // อังคาร
const cs = [
  { id: 'a', firstName: 'สมชาย', lastName: 'ใจดี', phone: '0811111111', stage: 'lead', temperature: 'warm', companyId: 'c1' },
  { id: 'b', firstName: 'มานี', lastName: 'มีสุข', phone: '0822222222', stage: 'pp' },
  { id: 'c', firstName: 'ปิติ', lastName: 'ศรีสุข', stage: 'booking' },
]

describe('LAMI สั่งงาน', () => {
  it('เวลาแบบไทย → 24 ชม.', () => {
    expect(timeIn('พรุ่งนี้ 10 โมง')).toBe('10:00')
    expect(timeIn('บ่าย 2 ครึ่ง')).toBe('14:30')
    expect(timeIn('4 โมงเย็น')).toBe('16:00')
    expect(timeIn('2 ทุ่ม')).toBe('20:00')
    expect(timeIn('เวลา 9.15')).toBe('09:15')
    expect(timeIn('เที่ยง')).toBe('12:00')
    expect(timeIn('พรุ่งนี้')).toBe('')
  })
  it('นัดติดตาม: วัน + เวลา + ช่องทาง', () => {
    const [c] = parseLamiCommand('นัดสมชายพรุ่งนี้ 10 โมง ทักไลน์เรื่องไฟแนนซ์', cs, T)
    expect(c).toMatchObject({ kind: 'fu', dueDate: '2026-11-11', time: '10:00', type: 'line' })
    expect(c.customer.id).toBe('a')
    expect(c.label).toContain('11/11/2569 10:00')
    expect(parseLamiCommand('ตามมานี วันเสาร์', cs, T)[0]).toMatchObject({ kind: 'fu', dueDate: '2026-11-14', type: 'call' })
  })
  it('ปรับความสนใจ', () => {
    expect(parseLamiCommand('มานี hot', cs, T)[0]).toMatchObject({ kind: 'temp', temp: 'hot' })
    expect(parseLamiCommand('ปรับ สมชาย เป็น cold', cs, T)[0]).toMatchObject({ kind: 'temp', temp: 'cold' })
  })
  it('ลองขับ / โทร', () => {
    expect(parseLamiCommand('นัดลองขับ ปิติ เสาร์นี้บ่าย 2', cs, T)[0].kind).toBe('td')
    expect(parseLamiCommand('โทรหา มานี', cs, T)[0]).toMatchObject({ kind: 'tel', phone: '0822222222' })
  })
  it('คำถามทั่วไป/ไม่มีชื่อลูกค้า → ไม่ใช่คำสั่ง (ให้ AI ตอบ)', () => {
    expect(parseLamiCommand('สมชายจองรถหรือยัง?', cs, T)).toEqual([])
    expect(parseLamiCommand('นัดลูกค้าพรุ่งนี้', cs, T)).toEqual([])
    expect(parseLamiCommand('สมชายสนใจรุ่นไหน', cs, T)).toEqual([])
    expect(parseLamiCommand('นัดสมชาย ไม่สนใจแล้ว', cs, T)).toEqual([])
  })
  it('ทำเลย: สร้างนัด / แก้ความสนใจ', async () => {
    const db = { createDoc: vi.fn(async () => 'x'), updateDocData: vi.fn(async () => {}) }
    const [fu] = parseLamiCommand('นัดสมชายพรุ่งนี้ 10 โมง', cs, T)
    const msg = await runLamiCommand(fu, { me: 'เซลส์ หนึ่ง', db, companyId: 'c9' })
    expect(db.createDoc).toHaveBeenCalledWith('followups', expect.objectContaining({ customerId: 'a', dueDate: '2026-11-11', time: '10:00', status: 'pending', companyId: 'c1', purpose: 'ติดตาม Lead ใหม่' }))
    expect(msg).toContain('11/11/2569')
    const [tp] = parseLamiCommand('มานี hot', cs, T)
    await runLamiCommand(tp, { db })
    expect(db.updateDocData).toHaveBeenCalledWith('customers', 'b', { temperature: 'hot' })
  })
})
describe('LAMI สั่งงาน: โทรตอนไหน', () => {
  it('โทรหา X พรุ่งนี้ = นัดติดตาม', () => {
    expect(parseLamiCommand('โทรหา มานี พรุ่งนี้บ่าย 3', [{ id: 'b', firstName: 'มานี', phone: '08' }], '2026-11-10')[0]).toMatchObject({ kind: 'fu', time: '15:00' })
  })
})
