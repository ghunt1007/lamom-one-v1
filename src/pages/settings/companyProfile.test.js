import { describe, it, expect } from 'vitest'
import { cleanCompany, missingCompanyFields, LEGACY_SAMPLE } from './companyProfile.js'

describe('company profile defaults', () => {
  it('drops old sample values so they are never shown as real', () => {
    const d = cleanCompany({ ...LEGACY_SAMPLE, id: 'x', createdAt: 1 })
    expect(d.taxId).toBe(''); expect(d.phone).toBe(''); expect(d.address).toBe(''); expect(d.brand).toBe('')
    expect(d.id).toBe('x')
  })
  it('keeps values the owner typed', () => {
    const d = cleanCompany({ nameTh: 'บริษัท จริง จำกัด', taxId: '0105512345678', phone: '02-123-4567' })
    expect(d).toMatchObject({ nameTh: 'บริษัท จริง จำกัด', taxId: '0105512345678', phone: '' })
  })
  it('lists the key fields still missing', () => {
    expect(missingCompanyFields(cleanCompany({}))).toEqual(['ชื่อบริษัท (ไทย)', 'เลขผู้เสียภาษี', 'ที่อยู่', 'โทรศัพท์'])
    expect(missingCompanyFields({ nameTh: 'a', taxId: 'b', address: 'c', phone: 'd' })).toEqual([])
  })
})
