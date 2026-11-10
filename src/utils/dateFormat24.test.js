import { describe, it, expect, afterEach } from 'vitest'
import { dmy, dm, hm, formatDate, formatDateTime, setDateEra } from './format.js'
import { toDisplay, fromDisplay, autoMask, parseDate, parseTime } from './dateInputs.js'
import { isoToDisplay } from './dateDisplay.js'

afterEach(() => setDateEra('be'))

describe('DD/MM/YYYY + 24 ชม. ทั้งโปรแกรม', () => {
  it('formatDate / dmy เป็น DD/MM/YYYY (พ.ศ.) และเปลี่ยนเป็น ค.ศ. ได้', () => {
    expect(formatDate('2026-11-05')).toBe('05/11/2569')
    expect(dmy('2026-01-31')).toBe('31/01/2569')
    expect(dm('2026-01-31')).toBe('31/01')
    setDateEra('ce')
    expect(formatDate('2026-11-05')).toBe('05/11/2026')
  })
  it('เวลาเป็น 24 ชม. ตามเวลาไทย ไม่มี AM/PM', () => {
    const t = new Date(Date.UTC(2026, 10, 10, 8, 7, 9)) // 15:07:09 ไทย
    expect(hm(t)).toBe('15:07')
    expect(hm(t, true)).toBe('15:07:09')
    expect(formatDateTime(t)).toBe('10/11/2569 15:07')
    expect(formatDateTime(t)).not.toMatch(/AM|PM/)
  })
  it('ช่องกรอก: แสดง DD/MM/YYYY แต่ค่าจริงยังเป็น YYYY-MM-DD', () => {
    expect(toDisplay('date', '2026-11-10')).toBe('10/11/2569')
    expect(fromDisplay('date', '10/11/2569')).toBe('2026-11-10')
    expect(fromDisplay('date', '10/11/2026')).toBe('2026-11-10')
    expect(fromDisplay('date', '1/2/69')).toBe('2026-02-01')
    expect(fromDisplay('date', '10112569')).toBe('2026-11-10')
    expect(fromDisplay('date', '31/02/2569')).toBe('')
    expect(fromDisplay('date', '10/11')).toBe('')
    expect(toDisplay('datetime-local', '2026-11-10T14:30')).toBe('10/11/2569 14:30')
    expect(fromDisplay('datetime-local', '10/11/2569 14:30')).toBe('2026-11-10T14:30')
    expect(toDisplay('month', '2026-11')).toBe('11/2569')
    expect(fromDisplay('month', '11/2569')).toBe('2026-11')
  })
  it('เวลา: รับ 1430 / 9.05 / 9:5 → HH:MM, เกิน 23:59 ไม่รับ', () => {
    expect(parseTime('1430')).toBe('14:30')
    expect(parseTime('9.05')).toBe('09:05')
    expect(parseTime('9:5')).toBe('09:05')
    expect(parseTime('24:00')).toBe('')
    expect(fromDisplay('time', '18:45')).toBe('18:45')
  })
  it('พิมพ์ตัวเลขล้วน ใส่ / และ : ให้เอง', () => {
    expect(autoMask('date', '1011')).toBe('10/11')
    expect(autoMask('date', '10112569')).toBe('10/11/2569')
    expect(autoMask('date', '05/122569')).toBe('05/12/2569')
    expect(autoMask('date', '5/12/2569')).toBe('5/12/2569')
    expect(autoMask('date', '10')).toBe('10')
    expect(autoMask('time', '090')).toBe('09:0')
    expect(autoMask('time', '930')).toBe('09:30')
    expect(autoMask('time', '1430')).toBe('14:30')
    expect(parseDate('2026-11-10')).toBe('2026-11-10')
  })
  it('วันที่ดิบบนจอ → DD/MM/YYYY แต่เลขเอกสารไม่แตะ', () => {
    expect(isoToDisplay('นัด 2026-11-10 14:00')).toBe('นัด 10/11/2569 14:00')
    expect(isoToDisplay('2026-11-10 – 2026-11-12')).toBe('10/11/2569 – 12/11/2569')
    expect(isoToDisplay('2026-11-10T07:30:00.000Z')).toBe('10/11/2569 14:30')
    expect(isoToDisplay('INV-2026-11-10-001')).toBe('INV-2026-11-10-001')
    expect(isoToDisplay('Daily_Report_2026-11-10.xlsx')).toBe('Daily_Report_2026-11-10.xlsx')
  })
})
