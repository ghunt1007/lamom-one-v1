import { describe, it, expect } from 'vitest'
import { companyLineFrom, posterFooter, __setCompanyLine } from './companyFooter.js'

describe('poster footer from company settings (v1.0.1197)', () => {
  it('name + formatted phone; only what is filled; nothing when empty', () => {
    expect(companyLineFrom({ nameTh: 'บริษัท ทดสอบ จำกัด', phone: '021234567' })).toBe('บริษัท ทดสอบ จำกัด · 📞 02-123-4567')
    expect(companyLineFrom({ name: 'Test Co', phone: '081 234 5678, 02-111-2222' })).toBe('Test Co · 📞 081-234-5678')
    expect(companyLineFrom({ phone: 'ไม่มี' })).toBe('')
    expect(companyLineFrom(null)).toBe('')
  })
  it('escapes and renders only when known', () => {
    __setCompanyLine('<b>x</b>')
    expect(posterFooter()).toContain('&lt;b&gt;x&lt;/b&gt;')
    __setCompanyLine('')
    expect(posterFooter()).toBe('')
  })
})
