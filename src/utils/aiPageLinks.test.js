import { describe, it, expect } from 'vitest'
import { pageLinksFor } from './aiPageLinks.js'

describe('pageLinksFor', () => {
  it('คำถามเรื่องลองขับ → หน้าทดลองขับ', () => {
    expect(pageLinksFor('สัปดาห์นี้มีนัดทดลองขับกี่นัด')[0].path).toBe('/crm/testdrive')
  })
  it('ได้ไม่เกิน 2 ปุ่ม เรียงตามความเฉพาะ', () => {
    const r = pageLinksFor('สต็อกรถเหลือกี่คัน ลูกค้าจองไปกี่คัน ลีดใหม่')
    expect(r.map(x => x.path)).toEqual(['/dms/stock', '/crm/bookings'])
  })
  it('คุยทั่วไป → ไม่มีปุ่ม', () => {
    expect(pageLinksFor('สวัสดีครับ')).toEqual([])
    expect(pageLinksFor('')).toEqual([])
  })
})
