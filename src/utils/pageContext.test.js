import { describe, it, expect } from 'vitest'
import { compactPageText, maskSensitive, pageContextFor, pageAsksFor, PAGE_ASKS } from './pageContext.js'

describe('compactPageText', () => {
  it('drops blank, duplicate and button-noise lines', () => {
    const t = compactPageText('ลูกค้า\n\n  ลูกค้า  \n⋯ อื่นๆ\n🔄 รีเฟรช\nLead 12\nแก้ไข\nProspect   19')
    expect(t).toBe('ลูกค้า\nLead 12\nProspect 19')
  })
  it('caps the length', () => {
    const t = compactPageText(Array.from({ length: 500 }, (_, i) => 'แถวที่ ' + i).join('\n'), 200)
    expect(t.length).toBeLessThan(230)
    expect(t).toMatch(/ตัดส่วนที่เหลือ/)
  })
  it('masks phone, LINE and national id', () => {
    const t = compactPageText('สมชาย 081-234-5678 @somchai99\nบัตร 1 1020 30405 06 7')
    expect(t).not.toMatch(/081|somchai99|30405/)
    expect(t).toMatch(/\[เบอร์\]/)
    expect(t).toMatch(/\[LINE\]/)
    expect(t).toMatch(/\[เลขบัตร\]/)
  })
  it('keeps money and short numbers', () => {
    expect(maskSensitive('ยอด 1,099,000 บาท 12 คัน')).toBe('ยอด 1,099,000 บาท 12 คัน')
  })
})

describe('pageContextFor', () => {
  it('builds context keys with masked text', () => {
    const c = pageContextFor({ title: 'จองรถ', path: '/crm/bookings', text: 'โทร 0812345678' })
    expect(c['หน้าจอที่ผู้ใช้เปิดอยู่']).toBe('จองรถ (/crm/bookings)')
    expect(Object.values(c).join(' ')).not.toMatch(/0812345678/)
  })
  it('has three quick asks', () => {
    expect(PAGE_ASKS.map(a => a.key)).toEqual(['sum', 'next', 'how'])
  })
})

describe('pageAsksFor', () => {
  it('puts the page-specific ask first on daily pages', () => {
    expect(pageAsksFor('/crm/customers').map(a => a.key)).toEqual(['page', 'sum', 'next', 'how'])
    expect(pageAsksFor('/crm/bookings/').map(a => a.key)[0]).toBe('page')
    expect(pageAsksFor('/').map(a => a.key)[0]).toBe('page')
    expect(pageAsksFor('/finance?tab=1')[0].label).toMatch(/กำไร/)
  })
  it('falls back to the general asks', () => {
    expect(pageAsksFor('/settings/roles').map(a => a.key)).toEqual(['sum', 'next', 'how'])
    expect(pageAsksFor('').map(a => a.key)[0]).toBe('page')
  })
})
