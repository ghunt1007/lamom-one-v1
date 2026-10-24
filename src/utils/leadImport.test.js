import { describe, it, expect } from 'vitest'
import { planLeadImport, normalizePhone, mapSource } from './leadImport.js'

describe('normalizePhone', () => {
  it('puts back the leading 0 Excel drops, and converts +66', () => {
    expect(normalizePhone(812345678)).toBe('0812345678')
    expect(normalizePhone('081-234-5678')).toBe('0812345678')
    expect(normalizePhone('+66812345678')).toBe('0812345678')
    expect(normalizePhone('021234567')).toBe('021234567')
    expect(normalizePhone('')).toBe('')
  })
})

describe('mapSource', () => {
  it('maps free-text sources to the customer page keys', () => {
    expect(mapSource('Facebook Ads')).toBe('facebook')
    expect(mapSource('ไลน์ OA')).toBe('line')
    expect(mapSource('ลูกค้าแนะนำ')).toBe('referral')
    expect(mapSource('Walk-in')).toBe('walk-in')
    expect(mapSource('โทรเข้า')).toBe('phone')
    expect(mapSource('งานบูธ')).toBe('other')
    expect(mapSource('')).toBe('other')
  })
})

describe('planLeadImport', () => {
  const existing = [
    { firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678' },
    { firstName: 'มานี', lastName: 'มีนา', lineId: '@manee' },
    { firstName: 'ไม่มี', lastName: 'เบอร์' },
  ]

  it('accepts the old template headers and common alternatives', () => {
    const { creates } = planLeadImport([
      { 'ชื่อ': 'ก', 'นามสกุล': 'หนึ่ง', 'โทรศัพท์': '0811111111', 'รถที่สนใจ': 'Seal', 'ที่มา': 'facebook' },
      { 'ชื่อ-นามสกุล': 'ข สอง', 'เบอร์โทร': 822222222, 'รุ่น': 'Dolphin', 'เซลส์': 'นภา' },
      { 'ชื่อลูกค้า': 'ค สาม' },
    ], [], { assignedTo: 'วิชัย' })
    expect(creates).toHaveLength(3)
    expect(creates[0]).toMatchObject({ firstName: 'ก', lastName: 'หนึ่ง', phone: '0811111111', interestedModel: 'Seal', source: 'facebook', assignedTo: 'วิชัย', stage: 'pp' })
    expect(creates[1]).toMatchObject({ firstName: 'ข', lastName: 'สอง', phone: '0822222222', interestedModel: 'Dolphin', assignedTo: 'นภา' })
    expect(creates[2]).toMatchObject({ firstName: 'ค', lastName: 'สาม', stage: 'lead' })
  })

  it('skips people already in the system by phone, LINE, or (with no contact) full name', () => {
    const { creates, duplicates } = planLeadImport([
      { 'ชื่อ': 'สมชาย', 'โทรศัพท์': '081-234-5678' },
      { 'ชื่อ': 'มานี', 'LINE ID': 'Manee' },
      { 'ชื่อ': 'ไม่มี', 'นามสกุล': 'เบอร์' },
      { 'ชื่อ': 'ใหม่', 'โทรศัพท์': '0899999999' },
    ], existing)
    expect(creates.map(c => c.firstName)).toEqual(['ใหม่'])
    expect(duplicates).toHaveLength(3)
    expect(duplicates[0]).toMatchObject({ row: 2, name: 'สมชาย' })
    expect(duplicates[0].reason).toContain('มีในระบบแล้ว')
  })

  it('skips repeats inside the same file and rows with no name', () => {
    const { creates, duplicates, skipped } = planLeadImport([
      { 'ชื่อ': 'เอ', 'โทรศัพท์': '0811111111' },
      { 'ชื่อ': 'เอ ซ้ำ', 'โทรศัพท์': '0811111111' },
      { 'ชื่อ': '', 'โทรศัพท์': '0833333333' },
    ], [])
    expect(creates).toHaveLength(1)
    expect(duplicates[0].reason).toBe('ซ้ำกับแถวก่อนหน้าในไฟล์')
    expect(skipped).toBe(1)
  })
})
