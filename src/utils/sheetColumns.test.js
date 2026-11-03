import { describe, it, expect } from 'vitest'
import { SHEET_COLUMNS, EXTRA_COLUMNS, parseCell, displayCell, patchForCell, columnTotals, sortRows } from './sheetColumns.js'
import { mapBookingRow } from './bookingImport.js'

const col = f => SHEET_COLUMNS.find(c => c.f === f)

// หัวคอลัมน์ของไฟล์ DATA Booking (แท็บ Booking แถว 3) ณ 3 พ.ย. 2569 — เรียงตามไฟล์
const SHEET_HEADERS = ['เลขใบจอง', 'สถานะ', 'วันที่จอง', 'ชื่อลูกค้า-นามสกุล', 'รุ่นรถ', 'สีภายนอก', 'สีภายใน', 'แหล่งที่มา',
  'เลขประจำตัวประชาชน', 'ที่อยู่', 'หมายเลขโทรศัพท์', 'ชื่อเซลล์', 'เซลล์', 'จองDMS', 'ส่งจอง', 'ราคารถ', 'ส่วนลดตามแคมเปญ',
  'ส่วนลดเพิ่มเติม', 'ดาวน์', 'ไฟแนนซ์', 'แคมเปญดอกเบี้ย', 'จังหวัดที่เซ็นต์', 'สถานะเช่าซื้อ', 'วันที่ส่งเคส', 'วันที่เซ็นต์',
  'วันที่ผ่าน', 'กำหนดส่งมอบ', 'วันที่ตัดตัวเลข', 'วันที่รับจริง', 'ค่าคอม', 'มาจิ้น', 'งบที่ใช้', 'มาจิ้นเหลือ', 'เงินได้อุปกรณ์',
  'รายคัน', 'คอมไฟแนนซ์เซลล์', 'เงินเพิ่มพิเศษ', 'เงินได้รวม', 'แคมเปญ CODE', 'เหตุผลอื่น', 'Allocate', 'วันที่ Allocate', 'ชุดขาย',
  'แจ้งประกัน', 'คันที่', 'VIN', 'หมายเลขมอเตอร์', 'หมายเลขเครื่องยนต์', 'หมายเลขแบต', 'เบิกสายชาร์จ', 'ให้สายชาร์จ', 'LifeTime',
  'ฟิล์ม', 'สถานที่ส่งมอบ', 'เลขรับแจ้ง', 'ป้ายแดง', 'ทำป้ายแดง', 'การจดทะเบียน', 'ป้ายขาว', 'แจ้งลูกค้า', 'รับป้ายขาว', 'เช็ครายการ',
  'ส่งมอบDMS', 'คืนจอง', 'เหตุผล']

describe('sheetColumns', () => {
  it('มีครบทุกคอลัมน์ของ Sheet เรียงเหมือนไฟล์ และชื่อฟิลด์ไม่ซ้ำ', () => {
    expect(SHEET_COLUMNS.map(c => c.h)).toEqual(SHEET_HEADERS)
    expect(new Set(SHEET_COLUMNS.map(c => c.f)).size).toBe(SHEET_COLUMNS.length)
  })

  it('อ่านค่าที่พิมพ์ได้ตามชนิด', () => {
    expect(parseCell(col('price'), '1,299,000')).toBe(1299000)
    expect(parseCell(col('price'), '')).toBe(0)
    expect(parseCell(col('price'), 'abc')).toBe(null)
    expect(parseCell(col('allocated'), 'y')).toBe('Y')
    expect(parseCell(col('allocated'), 'ไม่')).toBe('N')
    expect(parseCell(col('bookingDate'), '5/11/2569')).toBe('2026-11-05')
    expect(parseCell(col('bookingDate'), '2026-11-05')).toBe('2026-11-05')
    expect(parseCell(col('bookingDate'), 'พรุ่งนี้')).toBe(null)
    expect(parseCell(col('phone'), '081-234-5678')).toBe('0812345678')
  })

  it('แสดงตัวเลขมีจุลภาค วันที่แบบสั้น ช่องศูนย์เป็นค่าว่าง', () => {
    expect(displayCell(col('price'), 1299000)).toBe('1,299,000')
    expect(displayCell(col('price'), 0)).toBe('')
    expect(displayCell(col('bookingDate'), '2026-11-05')).toBe('5/11/26')
  })

  it('แก้มาจิ้น/งบ → คำนวณมาจิ้นเหลือและเงินได้รวมให้ · แก้ราคา/ดาวน์ → ยอดจัด', () => {
    const b = { margin: 20000, budgetUsed: 5000, com70: 3000, comFinance: 2000, price: 1000000, down: 300000 }
    expect(patchForCell(b, col('budgetUsed'), 8000)).toEqual({ budgetUsed: 8000, marginLeft: 12000, totalIncome: 17000 })
    expect(patchForCell(b, col('down'), 200000)).toEqual({ down: 200000, financeAmount: 800000 })
    expect(patchForCell(b, col('vin'), 'X1')).toEqual({ vin: 'X1' })
  })

  it('ผลรวมท้ายตาราง และการเรียง (ช่องว่างไว้ท้าย)', () => {
    const rows = [{ price: 100, unitNo: 5, custName: 'ข' }, { price: 0, custName: '' }, { price: 50, custName: 'ก' }]
    expect(columnTotals(rows).price).toBe(150)
    expect(columnTotals(rows).unitNo).toBeUndefined()
    expect(sortRows(rows, col('price'), 1).map(r => r.price)).toEqual([50, 100, 0])
    expect(sortRows(rows, col('price'), -1).map(r => r.price)).toEqual([100, 50, 0])
    expect(sortRows(rows, col('custName'), 1).map(r => r.custName)).toEqual(['ก', 'ข', ''])
  })

  it('ซิงก์จาก Sheet ดึงช่องที่เพิ่มใหม่มาด้วย', () => {
    const m = mapBookingRow({ 'เลขใบจอง': 'SK1', 'ชื่อลูกค้า-นามสกุล': 'ทดสอบ', 'จองDMS': 'Y', 'Allocate': 'Y', 'วันที่ Allocate': new Date('2026-04-07T00:00:00Z'),
      'คันที่': 523, 'รายคัน': 3000, 'คืนจอง': 'N', 'LifeTime': 1, 'สถานที่ส่งมอบ': 'โชว์รูม' })
    expect(m).toMatchObject({ dmsBooked: 'Y', allocated: 'Y', allocateDate: '2026-04-07', unitNo: 523, perCarBonus: 3000, depositRefunded: 'N', lifetime: '1', deliveryPlace: 'โชว์รูม' })
    // หัวคอลัมน์ที่ไม่มีในไฟล์ → ไม่ใส่ฟิลด์ (ไม่ไปลบค่าที่มีในโปรแกรม)
    expect('salesKit' in m).toBe(false)
    expect(EXTRA_COLUMNS.length).toBe(30)
  })
})

import { parseClipboardGrid, planPaste, sheetExportRows } from './sheetColumns.js'
describe('วางจาก Sheet', () => {
  it('แยกแถว/คอลัมน์ รวมช่องที่มีขึ้นบรรทัดใหม่ในอัญประกาศ', () => {
    expect(parseClipboardGrid('a\tb\nc\td\n')).toEqual([['a', 'b'], ['c', 'd']])
    expect(parseClipboardGrid('"x\ny"\t"he said ""hi"""')).toEqual([['x\ny', 'he said "hi"']])
    expect(parseClipboardGrid('one')).toEqual([['one']])
  })
  it('วางข้ามคอลัมน์อ่านอย่างเดียว ไม่เกินแถวที่มี และแยกค่าที่พิมพ์ผิด', () => {
    const cols = [col('margin'), col('budgetUsed'), col('marginLeft'), col('accessoryAmount')]
    const rows = [{ margin: 1 }, { margin: 0 }]
    const { changes, bad } = planPaste([['10', '2', '9'], ['x', '1'], ['5']], rows, cols, 0, 0)
    expect(changes.map(c => [c.row, c.col.f, c.value])).toEqual([[0, 'margin', 10], [0, 'budgetUsed', 2], [0, 'marginLeft', 9], [1, 'budgetUsed', 1]].filter(x => x[1] !== 'marginLeft'))
    expect(bad.map(b => b.raw)).toEqual(['x'])
  })
  it('ส่งออกหัวคอลัมน์เหมือน Sheet', () => {
    const out = sheetExportRows([{ bookingNo: 'SK1', price: 5 }])
    expect(Object.keys(out[0])).toEqual(SHEET_COLUMNS.map(c => c.h))
    expect(out[0]['ราคารถ']).toBe(5)
  })
})
