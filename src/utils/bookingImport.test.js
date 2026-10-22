import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { readBookingSheet, mapBookingRow, planBookingImport, newBookingDoc, newCustomerDoc, companyForBrand, fmtDate, fmtPhone, fmtNid, cellValue } from './bookingImport.js'

// ข้อมูลสมมติทั้งหมด — ไม่ใช่ลูกค้าจริง
const HEADERS = ['', 'เลขใบจอง', 'สถานะ', 'วันที่จอง', 'ชื่อลูกค้า-นามสกุล', 'รุ่นรถ', 'สีภายนอก', 'แหล่งที่มา', 'เลขประจำตัวประชาชน',
  'หมายเลขโทรศัพท์', 'ชื่อเซลล์', 'ราคารถ', 'ดาวน์', 'ไฟแนนซ์', 'สถานะเช่าซื้อ', 'มาจิ้น', 'งบที่ใช้', 'วันที่รับจริง', 'VIN']

async function makeWorkbook(rows) {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('สำเนาของ Booking').addRow(['อื่นๆ'])
  const ws = wb.addWorksheet('Booking')
  ws.addRow([]); ws.addRow([])
  ws.addRow(HEADERS)
  rows.forEach(r => ws.addRow(r))
  // round-trip ผ่าน buffer ให้เหมือนอ่านไฟล์จริง
  const out = new ExcelJS.Workbook()
  await out.xlsx.load(await wb.xlsx.writeBuffer())
  return out
}

const ROW_A = [1, 'SK0001', 'ส่งมอบแล้ว', new Date(Date.UTC(2026, 8, 3)), 'นาย ทดสอบ  ตัวอย่าง', 'S07', 'เทา', 'Walk', 1100000000001,
  812345678, 'เซลส์ ทดสอบ', 1000000, 0.3, 'KBANK', 'ผ่าน', { formula: 'A1*2', result: 20000 }, 15000, new Date(Date.UTC(2026, 8, 20)), 'VINTEST0001']
const ROW_B = [2, 'SK0002', 'ยอดจองคงค้าง', new Date(Date.UTC(2026, 9, 1)), 'นางสาว สมมติ ใจดี', 'AION V', 'ขาว', 'Facebook', null,
  '0899999999', 'เซลส์ ทดสอบ', 899000, 100000, '', '', 0, 0, null, '']
const ROW_NO_NUMBER = [3, null, 'ยอดจองคงค้าง', null, 'ลูกค้า ยังไม่มีเลข', 'LUMIN', '', '', null, '', '', 0, 0, '', '', 0, 0, null, '']

describe('cell/format helpers', () => {
  it('normalizes formulas, rich text, dates and phone numbers', () => {
    expect(cellValue({ formula: 'X', result: 5 })).toBe(5)
    expect(cellValue({ richText: [{ text: 'a' }, { text: 'b' }] })).toBe('ab')
    expect(fmtDate('5/10/2569')).toBe('2026-10-05')
    expect(fmtDate(new Date(Date.UTC(2026, 0, 2)))).toBe('2026-01-02')
    expect(fmtPhone(812345678)).toBe('0812345678')
    expect(fmtNid(1100000000001)).toBe('1100000000001')
    expect(fmtNid('123')).toBe('')
  })
})

describe('readBookingSheet', () => {
  it('finds the Booking tab and its header row (row 3)', async () => {
    const wb = await makeWorkbook([ROW_A, ROW_B, ROW_NO_NUMBER])
    const s = readBookingSheet(wb)
    expect(s.sheetName).toBe('Booking')
    expect(s.headerRow).toBe(3)
    expect(s.rows).toHaveLength(3)
    expect(s.rows[0]['เลขใบจอง']).toBe('SK0001')
  })
  it('throws a clear error when no tab has the booking header', async () => {
    const wb = new ExcelJS.Workbook(); wb.addWorksheet('X').addRow(['a', 'b'])
    expect(() => readBookingSheet(wb)).toThrow('เลขใบจอง')
  })
})

describe('mapBookingRow', () => {
  it('maps columns to booking fields', async () => {
    const s = readBookingSheet(await makeWorkbook([ROW_A]))
    const m = mapBookingRow(s.rows[0])
    expect(m).toMatchObject({
      bookingNo: 'SK0001', status: 'ส่งมอบแล้ว', bookingDate: '2026-09-03', custName: 'นาย ทดสอบ ตัวอย่าง', brand: 'DEEPAL',
      phone: '0812345678', price: 1000000, down: 300000, financeAmount: 700000, margin: 20000, budgetUsed: 15000, marginLeft: 5000,
      actualDeliveryDate: '2026-09-20', vin: 'VINTEST0001', nid: '1100000000001',
    })
  })
  it('treats a down payment above 1 as an amount, not a percentage', async () => {
    const s = readBookingSheet(await makeWorkbook([ROW_B]))
    expect(mapBookingRow(s.rows[0]).down).toBe(100000)
    expect(mapBookingRow(s.rows[0]).brand).toBe('AION')
  })
})

describe('planBookingImport', () => {
  it('creates new bookings, updates only changed non-empty fields, skips rows with no number', async () => {
    const s = readBookingSheet(await makeWorkbook([ROW_A, ROW_B, ROW_NO_NUMBER, [...ROW_B]]))
    const existing = [
      { id: 'x1', bookingNo: 'SK0001', status: 'ยอดจองคงค้าง', custName: 'นาย ทดสอบ ตัวอย่าง', phone: '0812345678', price: 1000000, down: 300000,
        margin: 20000, budgetUsed: 15000, com70: 1000, comFinance: 0, notes: 'แก้ในโปรแกรม', bookingDeposit: 5000, address: 'มีในโปรแกรม' },
    ]
    const p = planBookingImport(s.rows, existing)
    expect(p.creates.map(c => c.bookingNo)).toEqual(['SK0002'])
    expect(p.updates).toHaveLength(1)
    const u = p.updates[0]
    expect(u.id).toBe('x1')
    expect(u.patch.status).toBe('ส่งมอบแล้ว')
    expect(u.patch.actualDeliveryDate).toBe('2026-09-20')
    // ช่องที่มีแต่ในโปรแกรม / ช่องว่างในไฟล์ ไม่ถูกแตะ
    expect(u.patch).not.toHaveProperty('notes')
    expect(u.patch).not.toHaveProperty('bookingDeposit')
    expect(u.patch).not.toHaveProperty('address')
    expect(u.patch).not.toHaveProperty('price')
    expect(p.skippedNoNumber).toEqual([{ row: 6, custName: 'ลูกค้า ยังไม่มีเลข' }])
    expect(p.duplicates).toEqual(['SK0002'])
  })
  it('reports a booking as unchanged when the sheet matches', async () => {
    const s = readBookingSheet(await makeWorkbook([ROW_B]))
    const m = mapBookingRow(s.rows[0])
    const p = planBookingImport(s.rows, [{ id: 'y', ...m }])
    expect(p.updates).toHaveLength(0)
    expect(p.unchanged).toHaveLength(1)
  })
  it('ignores soft-deleted bookings when matching', async () => {
    const s = readBookingSheet(await makeWorkbook([ROW_B]))
    const p = planBookingImport(s.rows, [{ id: 'd', bookingNo: 'SK0002', deleted: true }])
    expect(p.creates).toHaveLength(1)
  })
})

describe('new docs + company', () => {
  it('builds booking/customer docs without the national ID on the booking', async () => {
    const m = mapBookingRow(readBookingSheet(await makeWorkbook([ROW_A])).rows[0])
    const b = newBookingDoc(m, { companyId: 'c1', customerId: 'k1' })
    expect(b).not.toHaveProperty('nid')
    expect(b).toMatchObject({ companyId: 'c1', customerId: 'k1', importedFromExcel: true, totalIncome: 5000 })
    const c = newCustomerDoc(m, { companyId: 'c1' })
    expect(c).toMatchObject({ firstName: 'นาย ทดสอบ', lastName: 'ตัวอย่าง', stage: 'delivered', phone: '0812345678' })
  })
  it('matches a company by brand name, falling back when none match', () => {
    const cos = [{ id: 'd', name: 'บริษัท ก', brand: 'DEEPAL' }, { id: 'o', name: 'OMODA & JAECOO บางบัวทอง' }]
    expect(companyForBrand('DEEPAL', cos, 'f')).toBe('d')
    expect(companyForBrand('OMODA & JAECOO', cos, 'f')).toBe('o')
    expect(companyForBrand('AION', cos, 'f')).toBe('f')
  })
})

describe('v1.0.543 — company repair', () => {
  it('learns brand -> company from existing (non-imported) bookings', async () => {
    const { brandCompanyMap, companyForBrand } = await import('./bookingImport.js')
    const learned = brandCompanyMap([
      { model: 'S07', companyId: 'deepal-co' }, { model: 'LUMIN', companyId: 'deepal-co' }, { model: 'S05', companyId: 'other' },
      { model: 'AION V', companyId: 'aion-co' }, { model: 'S07', companyId: 'wrong', importedFromExcel: true },
    ])
    expect(learned).toEqual({ DEEPAL: 'deepal-co', AION: 'aion-co' })
    expect(companyForBrand('DEEPAL', [], 'fb', learned)).toBe('deepal-co')
    expect(companyForBrand('OMODA & JAECOO', [{ id: 'om', name: 'OMODA บางบัวทอง' }], 'fb', learned)).toBe('om')
  })
  it('re-import fixes companyId of imported/no-company bookings but not deliberate ones', async () => {
    const s = readBookingSheet(await makeWorkbook([ROW_A, ROW_B]))
    const a = mapBookingRow(s.rows[0]), b = mapBookingRow(s.rows[1])
    const p = planBookingImport(s.rows, [
      { id: '1', ...a, companyId: 'owner-co', importedFromExcel: true },
      { id: '2', ...b, companyId: 'manual-co' },
    ], { companyFor: br => ({ DEEPAL: 'deepal-co', AION: 'aion-co' })[br] })
    expect(p.updates.map(u => [u.id, u.patch.companyId])).toEqual([['1', 'deepal-co']])
    expect(p.unchanged.map(u => u.id)).toEqual(['2'])
  })
})
