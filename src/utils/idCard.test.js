import { describe, it, expect } from 'vitest'
import { validThaiId, formatThaiId, normBirthDate, provinceFromAddress, parseIdCardReply } from './idCard.js'

// เลขทดสอบที่สร้างให้ผ่านหลักตรวจสอบ (ไม่ใช่ของคนจริง)
const OK = '1101700203450'

describe('idCard', () => {
  it('ตรวจหลักสุดท้ายของเลขบัตร', () => {
    expect(validThaiId(OK)).toBe(true)
    expect(validThaiId('1-1017-00203-45-0')).toBe(true)
    expect(validThaiId('1101700203453')).toBe(false)
    expect(validThaiId('123')).toBe(false)
    expect(formatThaiId(OK)).toBe('1-1017-00203-45-0')
  })
  it('วันเกิด พ.ศ. → ค.ศ.', () => {
    expect(normBirthDate('2535-03-07')).toBe('1992-03-07')
    expect(normBirthDate('1992-3-7')).toBe('1992-03-07')
    expect(normBirthDate('7 มี.ค. 35')).toBe('')
  })
  it('หาจังหวัดจากที่อยู่', () => {
    expect(provinceFromAddress('99 ม.1 ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี')).toBe('นนทบุรี')
    expect(provinceFromAddress('1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร')).toBe('กรุงเทพมหานคร')
  })
  it('แปลงคำตอบ AI และไม่กรอกเลขบัตรที่หลักตรวจสอบไม่ผ่าน', () => {
    const r = parseIdCardReply('```json\n{"title":"นาย","firstName":"ทดสอบ","lastName":"ระบบ","nid":"1 1017 00203 45 0","address":"99 ม.1 ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี","province":"","birthDate":"2535-03-07"}\n```')
    expect(r).toEqual({ name: 'นาย ทดสอบ ระบบ', nid: OK, nidOk: true, nidRead: OK, address: '99 ม.1 ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี', province: 'นนทบุรี', birthDate: '1992-03-07' })
    const bad = parseIdCardReply('{"firstName":"ก","nid":"1101700203453"}')
    expect(bad.nid).toBe('')
    expect(bad.nidOk).toBe(false)
    expect(parseIdCardReply('{}')).toBe(null)
    expect(parseIdCardReply('ไม่ใช่บัตร')).toBe(null)
  })
})
