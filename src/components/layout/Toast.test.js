import { describe, it, expect, vi } from 'vitest'
vi.mock('../../core/store.js', () => ({ on: () => () => {} }))
const { toastParts } = await import('./Toast.js')

describe('toastParts', () => {
  it('ใช้อีโมจินำหน้าข้อความเป็นไอคอน ไม่ซ้อนสองอัน', () => {
    expect(toastParts('success', '✅ บันทึกแล้ว')).toEqual({ icon: '✅', text: 'บันทึกแล้ว' })
    expect(toastParts('success', '📋 คัดลอกแล้ว')).toEqual({ icon: '📋', text: 'คัดลอกแล้ว' })
    expect(toastParts('error', '⚠️ อ่านไม่ได้')).toEqual({ icon: '⚠️', text: 'อ่านไม่ได้' })
  })
  it('ไม่มีอีโมจินำหน้า → ไอคอนตามประเภท', () => {
    expect(toastParts('error', 'บันทึกไม่สำเร็จ')).toEqual({ icon: '❌', text: 'บันทึกไม่สำเร็จ' })
    expect(toastParts('success', '✅')).toEqual({ icon: '✅', text: '✅' })
    expect(toastParts('info', '3 รายการ')).toEqual({ icon: 'ℹ️', text: '3 รายการ' })
  })
})
