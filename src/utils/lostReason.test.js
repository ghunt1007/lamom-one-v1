import { describe, it, expect } from 'vitest'
import { classifyLostReason } from './lostReason.js'

describe('classifyLostReason', () => {
  it('จัดกลุ่มจากปุ่มเลือกในหน้าลูกค้า', () => {
    expect(classifyLostReason('ราคา - อีกร้านลดมากกว่า')).toBe('price')
    expect(classifyLostReason('ซื้อคู่แข่ง - ได้ของแถมเยอะกว่า')).toBe('competitor')
    expect(classifyLostReason('ไฟแนนซ์ไม่ผ่าน')).toBe('finance')
    expect(classifyLostReason('ยังไม่พร้อม')).toBe('timing')
    expect(classifyLostReason('ติดต่อไม่ได้')).toBe('no_contact')
    expect(classifyLostReason('เปลี่ยนรุ่น/ยี่ห้อ - ไปดูรุ่นใหญ่กว่า')).toBe('changed_mind')
  })
  it('คำนำหน้าสำคัญกว่ารายละเอียด', () => {
    expect(classifyLostReason('ซื้อคู่แข่ง - ราคาถูกกว่า')).toBe('competitor')
    expect(classifyLostReason('ยังไม่พร้อม - รอไฟแนนซ์ปีหน้า')).toBe('timing')
  })
  it('ข้อความพิมพ์เองและค่าเดิมที่เป็นรหัส', () => {
    expect(classifyLostReason('ลูกค้าบอกว่าแพงไป')).toBe('price')
    expect(classifyLostReason('กู้ไม่ผ่านครับ')).toBe('finance')
    expect(classifyLostReason('price')).toBe('price')
    expect(classifyLostReason('other')).toBe('other')
    expect(classifyLostReason('')).toBe('other')
    expect(classifyLostReason(null)).toBe('other')
    expect(classifyLostReason('ย้ายบ้าน')).toBe('other')
  })
})
