import { describe, it, expect } from 'vitest'
import { suggestNextDue } from './nextFollowup.js'
const T = '2026-10-26' // จันทร์
describe('suggestNextDue', () => {
  it('skips lost customers', () => { expect(suggestNextDue('ลูกค้าไม่สนใจแล้ว', T)).toEqual({ skip: true }) })
  it('tomorrow / day after', () => {
    expect(suggestNextDue('ให้โทรพรุ่งนี้', T).dueDate).toBe('2026-10-27')
    expect(suggestNextDue('มะรืนค่อยคุย', T).dueDate).toBe('2026-10-28')
  })
  it('weekday', () => { expect(suggestNextDue('นัดทดลองขับเสาร์นี้', T).dueDate).toBe('2026-10-31') })
  it('same weekday goes to next week', () => { expect(suggestNextDue('ว่างวันจันทร์', T).dueDate).toBe('2026-11-02') })
  it('next week and N days', () => {
    expect(suggestNextDue('อาทิตย์หน้าค่อยว่า', T).dueDate).toBe('2026-11-02')
    expect(suggestNextDue('ขอคิด 5 วัน', T).dueDate).toBe('2026-10-31')
  })
  it('default 3 days', () => { expect(suggestNextDue('สนใจ ส่งราคาแล้ว', T).dueDate).toBe('2026-10-29') })
  it('explicit dates', () => {
    expect(suggestNextDue('นัดวันที่ 5', T).dueDate).toBe('2026-11-05')
    expect(suggestNextDue('ว่างวันที่ 28', T).dueDate).toBe('2026-10-28')
    expect(suggestNextDue('เข้ามาดูรถ 3 พ.ย.', T).dueDate).toBe('2026-11-03')
    expect(suggestNextDue('โอนเงิน 15 มกราคม', T).dueDate).toBe('2027-01-15')
    expect(suggestNextDue('นัด 2/11', T).dueDate).toBe('2026-11-02')
    expect(suggestNextDue('เงินออกสิ้นเดือน', T).dueDate).toBe('2026-10-31')
    expect(suggestNextDue('ต้นเดือนหน้าค่อยคุย', T).dueDate).toBe('2026-11-01')
  })
  it('numbers that are not dates keep old behaviour', () => {
    expect(suggestNextDue('ขอคิด 5 วัน', T).dueDate).toBe('2026-10-31')
    expect(suggestNextDue('งบ 900000 บาท', T).dueDate).toBe('2026-10-29')
    expect(suggestNextDue('S07 พยายามโทรแล้ว', T).dueDate).toBe('2026-10-29')
  })
})
