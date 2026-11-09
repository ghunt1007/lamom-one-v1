import { describe, it, expect } from 'vitest'
import { buildMorningSections, finPassPatch, financePassedWrites } from './daily-report.js'

const today = '2026-10-25'
const bk = (o) => ({ salesName: 'เอ', custName: 'ลูกค้า', bookingDate: '2026-09-01', ...o })

describe('ไฟแนนซ์ผ่านอัตโนมัติ (worker)', () => {
  it('finPassPatch: รอรถ/รอส่งมอบ/ตัดตัวเลข/ส่งมอบแล้ว ที่ยังไม่ผ่าน → ผ่าน, ซื้อสด/ผ่านแล้ว/สถานะอื่น → null', () => {
    for (const status of ['รอรถ', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ', 'ส่งมอบแล้ว']) expect(finPassPatch({ status, finStatus: 'รอผล' })).toEqual({ finStatus: 'ผ่าน' })
    expect(finPassPatch({ status: 'รอรถ', finStatus: '' })).toEqual({ finStatus: 'ผ่าน' })
    expect(finPassPatch({ status: 'รอรถ', finStatus: 'ซื้อสด' })).toBeNull()
    expect(finPassPatch({ status: 'รอรถ', financeCo: 'ซื้อสด' })).toBeNull()
    expect(finPassPatch({ status: 'รอรถ', finStatus: 'ผ่าน' })).toBeNull()
    expect(finPassPatch({ status: 'รอผลไฟแนนซ์', finStatus: 'รอผล' })).toBeNull()
    expect(finPassPatch({ status: 'รอรถ', finStatus: 'รอผล', deleted: true })).toBeNull()
  })
  it('financePassedWrites แตะเฉพาะช่อง finStatus', () => {
    const [w] = financePassedWrites('p1', ['abc'])
    expect(w.update.name).toBe('projects/p1/databases/(default)/documents/bookings/abc')
    expect(w.updateMask.fieldPaths).toEqual(['finStatus'])
    expect(w.currentDocument).toEqual({ exists: true })
  })
  it('รอรถที่ช่องไฟแนนซ์ค้าง "รอผล" ไม่ขึ้นในไฟแนนซ์รอผล', () => {
    const [sec] = buildMorningSections({ bookings: [bk({ status: 'รอรถ', finStatus: 'รอผล', bookingDate: '2026-10-01' })], customers: [], followups: [], testDrives: [] }, { today })
    expect(sec.text).not.toContain('ไฟแนนซ์รอผล')
    expect(sec.text).toContain('ใบจองค้าง')
  })
  it('ใบจองที่ขึ้นในไฟแนนซ์แล้วไม่ขึ้นซ้ำในใบจองค้าง', () => {
    const [sec] = buildMorningSections({ bookings: [bk({ custName: 'อภิชาติ', status: 'รอผลไฟแนนซ์', finStatus: 'รอผล', financeCo: 'TISCO' })], customers: [], followups: [], testDrives: [] }, { today })
    expect(sec.text).toContain('ไฟแนนซ์รอผล')
    expect(sec.text).not.toContain('ใบจองค้าง')
    expect(sec.text.match(/อภิชาติ/g)).toHaveLength(1)
  })
})

describe('เวรบูธในเตือนเช้า', () => {
  it('คนที่มีเวรวันนี้ได้บรรทัดเวรบูธ และขึ้นเป็นเรื่องแรกที่ต้องทำ', async () => {
    const { focusLines } = await import('./daily-report.js')
    const today = '2026-11-28'
    const events = [{ id: 'e1', title: 'Motor Expo', venue: 'อิมแพ็ค', shifts: { [today]: ['เซลส์ เอ'], '2026-11-29': ['เซลส์ บี'] } }]
    const secs = buildMorningSections({ bookings: [], customers: [], followups: [], testDrives: [], events }, { today })
    expect(secs.map(s => s.name)).toEqual(['เซลส์ เอ'])
    expect(secs[0].text).toContain('🗓 เวรออกบูธวันนี้: Motor Expo @ อิมแพ็ค')
  })
})
