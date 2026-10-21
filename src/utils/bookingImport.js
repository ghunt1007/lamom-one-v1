// (v1.0.540) นำเข้า/อัปเดตใบจองจากไฟล์ Excel "DATA Booking" ของโชว์รูม (แท็บ Booking, หัวตารางอยู่แถว 3)
// เดิมการนำเข้าทำผ่านสคริปต์ภายนอกครั้งเดียว (ส.ค. 2569) — ไฟล์นี้ทำให้เจ้าของ/ผู้จัดการอัปเดตเองได้ในโปรแกรม
// โดยข้อมูลลูกค้าไม่ต้องออกจากเครื่องที่ login อยู่เลย
//
// หลักการ (ปลอดภัยต่อข้อมูลที่แก้ในโปรแกรมแล้ว):
// - จับคู่ใบจองเดิมด้วย "เลขใบจอง" (bookingNo) เท่านั้น
// - ใบจองใหม่ → สร้างใหม่ทั้งใบ
// - ใบจองเดิม → อัปเดตเฉพาะช่องที่ไฟล์มีค่า และค่าต่างจากในโปรแกรม (ช่องว่างในไฟล์ไม่ลบข้อมูลในโปรแกรม)
//   ไม่แตะช่องที่มีแต่ในโปรแกรม (เงินจอง, F&I, ค่าคอม 70%, หมายเหตุ, ลูกค้าที่ผูกไว้ ฯลฯ)
// - แถวที่ไม่มีเลขใบจองจะถูกข้าม และแจ้งจำนวนให้ทราบ (ไม่สร้างเลขชั่วคราวที่ทำให้ซ้ำเมื่อนำเข้ารอบถัดไป)

export const BOOKING_SHEET_NAME = 'Booking'
const KEY_HEADER = 'เลขใบจอง'

// แปลงค่าเซลล์ของ ExcelJS ให้เป็นค่าธรรมดา (สูตร → ผลลัพธ์, rich text → ข้อความ, วันที่ → YYYY-MM-DD)
export function cellValue(v) {
  if (v == null) return null
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result)
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('')
    if ('text' in v) return cellValue(v.text)
    if ('error' in v) return null
    return null
  }
  return v
}

function str(v) {
  const x = cellValue(v)
  return x == null ? '' : String(x).trim()
}
function num(v) {
  const x = cellValue(v)
  if (x == null || x === '') return 0
  const n = typeof x === 'number' ? x : Number(String(x).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
export function fmtDate(v) {
  const x = cellValue(v)
  if (x == null || x === '') return ''
  const s = String(x).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // ตัวเลข serial ของ Excel (วันที่ที่เก็บเป็นตัวเลข)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400000))
    return d.toISOString().slice(0, 10)
  }
  // d/m/yyyy (รองรับ พ.ศ.)
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    let y = Number(m[3]); if (y > 2400) y -= 543
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return ''
}
export function fmtPhone(v) {
  let s = str(v).replace(/\D/g, '')
  if (s && !s.startsWith('0')) s = '0' + s
  return s
}
export function fmtNid(v) {
  const s = str(v).replace(/\D/g, '')
  return s.length >= 12 && s.length <= 13 ? s.padStart(13, '0') : ''
}

export function detectBrandFromModel(model) {
  const m = String(model || '').toUpperCase()
  if (/LUMIN|S05|S07|E07|L07|HUNTER|Q05|DEEPAL/.test(m)) return 'DEEPAL'
  if (/AION|HYPTEC|HYPERTEC/.test(m)) return 'AION'
  if (/OMODA|JAECOO|\bJ5\b|\bJ6\b|\bJ7\b|\bC5\b/.test(m)) return 'OMODA & JAECOO'
  return ''
}

// หาแท็บ Booking + แถวหัวตาราง (แถวที่มีคำว่า "เลขใบจอง") แล้วคืนเป็น array ของ object ตามชื่อหัวคอลัมน์
export function readBookingSheet(workbook) {
  const sheets = workbook.worksheets || []
  const ordered = [...sheets.filter(s => s.name === BOOKING_SHEET_NAME), ...sheets.filter(s => s.name !== BOOKING_SHEET_NAME)]
  for (const ws of ordered) {
    let headerRow = 0
    let headers = []
    for (let r = 1; r <= Math.min(ws.rowCount || 0, 15); r++) {
      const vals = (ws.getRow(r).values || []).map(str)
      if (vals.includes(KEY_HEADER)) { headerRow = r; headers = vals; break }
    }
    if (!headerRow) continue
    const rows = []
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const vals = ws.getRow(r).values || []
      const obj = {}
      let any = false
      headers.forEach((h, i) => {
        if (!h) return
        const v = cellValue(vals[i])
        if (v != null && v !== '') any = true
        if (!(h in obj)) obj[h] = v // หัวคอลัมน์ซ้ำ ใช้คอลัมน์แรก
      })
      if (any) rows.push({ ...obj, __row: r })
    }
    return { sheetName: ws.name, headerRow, headers: headers.filter(Boolean), rows }
  }
  throw new Error('ไม่พบแท็บที่มีหัวตาราง "เลขใบจอง" ในไฟล์นี้')
}

// แปลง 1 แถวของไฟล์ → ฟิลด์ใบจองในโปรแกรม (ชื่อฟิลด์เดียวกับฟอร์มใบจองใน Bookings.js)
export function mapBookingRow(r) {
  const model = str(r['รุ่นรถ'])
  const price = num(r['ราคารถ'])
  const downRaw = num(r['ดาวน์'])
  // คอลัมน์ "ดาวน์" ในไฟล์เป็นสัดส่วน (0.3 = 30%) ถ้าเกิน 1 ถือว่าเป็นจำนวนเงิน
  const down = downRaw > 0 && downRaw <= 1 ? Math.round(price * downRaw) : Math.round(downRaw)
  const margin = num(r['มาจิ้น'])
  const budgetUsed = num(r['งบที่ใช้'])
  const comFinance = num(r['คอมไฟแนนซ์เซลล์'] ?? r['คอมไฟแนนซ์'])
  return {
    bookingNo: str(r['เลขใบจอง']),
    status: str(r['สถานะ']) || 'ยอดจองคงค้าง',
    custName: str(r['ชื่อลูกค้า-นามสกุล']).replace(/\s+/g, ' '),
    phone: fmtPhone(r['หมายเลขโทรศัพท์']),
    address: str(r['ที่อยู่']),
    source: str(r['แหล่งที่มา']),
    brand: detectBrandFromModel(model),
    model,
    colorOut: str(r['สีภายนอก']),
    colorIn: str(r['สีภายใน']),
    vin: str(r['VIN']),
    motorNo: str(r['หมายเลขมอเตอร์']),
    engineNo: str(r['หมายเลขเครื่องยนต์']),
    batNo: str(r['หมายเลขแบต']),
    redPlate: str(r['ป้ายแดง']),
    whitePlate: str(r['ป้ายขาว']),
    price,
    down,
    financeCo: str(r['ไฟแนนซ์']),
    financeAmount: price ? Math.max(price - down, 0) : 0,
    finStatus: str(r['สถานะเช่าซื้อ']),
    campaign: str(r['แคมเปญดอกเบี้ย']),
    margin,
    budgetUsed,
    marginLeft: margin - budgetUsed,
    comFinance,
    accessoryAmount: num(r['เงินได้อุปกรณ์']),
    bookingDate: fmtDate(r['วันที่จอง']),
    submitDate: fmtDate(r['วันที่ส่งเคส']),
    signDate: fmtDate(r['วันที่เซ็นต์']),
    approveDate: fmtDate(r['วันที่ผ่าน']),
    deliveryDate: fmtDate(r['กำหนดส่งมอบ']),
    cutDate: fmtDate(r['วันที่ตัดตัวเลข']),
    actualDeliveryDate: fmtDate(r['วันที่รับจริง']),
    salesName: str(r['ชื่อเซลล์']),
    nid: fmtNid(r['เลขประจำตัวประชาชน']),
  }
}

// ช่องที่ "อัปเดต" ใบจองเดิมได้ — ไม่รวม nid (เก็บแยก collection) และฟิลด์คำนวณที่ขึ้นกับช่องอื่น
const UPDATABLE = ['status', 'custName', 'phone', 'address', 'source', 'brand', 'model', 'colorOut', 'colorIn', 'vin', 'motorNo',
  'engineNo', 'batNo', 'redPlate', 'whitePlate', 'price', 'down', 'financeCo', 'finStatus', 'campaign', 'margin', 'budgetUsed',
  'comFinance', 'accessoryAmount', 'bookingDate', 'submitDate', 'signDate', 'approveDate', 'deliveryDate', 'cutDate',
  'actualDeliveryDate', 'salesName']

function isEmpty(v) { return v == null || v === '' || v === 0 }
function same(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Math.abs(Number(a || 0) - Number(b || 0)) < 0.005
  return String(a ?? '').trim() === String(b ?? '').trim()
}

// เทียบข้อมูลในไฟล์กับใบจองในโปรแกรม → แผนว่าจะสร้าง/อัปเดตอะไรบ้าง (ยังไม่เขียนอะไรทั้งนั้น)
export function planBookingImport(sheetRows, existingBookings) {
  const byNo = new Map()
  existingBookings.filter(b => !b.deleted && b.bookingNo).forEach(b => {
    const k = String(b.bookingNo).trim()
    if (!byNo.has(k)) byNo.set(k, b)
  })
  const creates = [], updates = [], unchanged = [], skippedNoNumber = [], duplicates = []
  const seen = new Set()
  for (const raw of sheetRows) {
    const m = mapBookingRow(raw)
    if (!m.bookingNo) {
      if (m.custName) skippedNoNumber.push({ row: raw.__row, custName: m.custName })
      continue
    }
    if (seen.has(m.bookingNo)) { duplicates.push(m.bookingNo); continue }
    seen.add(m.bookingNo)
    const ex = byNo.get(m.bookingNo)
    if (!ex) { creates.push(m); continue }
    const patch = {}
    const changes = []
    for (const f of UPDATABLE) {
      if (isEmpty(m[f])) continue
      if (same(m[f], ex[f])) continue
      patch[f] = m[f]
      changes.push(f)
    }
    if ('margin' in patch || 'budgetUsed' in patch) {
      const margin = patch.margin ?? ex.margin ?? 0
      const budget = patch.budgetUsed ?? ex.budgetUsed ?? 0
      patch.marginLeft = margin - budget
      patch.totalIncome = (margin - budget) + Number(ex.com70 || 0) + Number(patch.comFinance ?? ex.comFinance ?? 0)
    }
    if ('price' in patch || 'down' in patch) {
      const price = patch.price ?? ex.price ?? 0
      const down = patch.down ?? ex.down ?? 0
      patch.financeAmount = Math.max(price - down, 0)
    }
    const nidChanged = !!m.nid
    if (changes.length) updates.push({ id: ex.id, bookingNo: m.bookingNo, patch, changes, statusFrom: ex.status, nid: m.nid, existing: ex })
    else unchanged.push({ id: ex.id, bookingNo: m.bookingNo, nid: nidChanged ? m.nid : '' })
  }
  return { creates, updates, unchanged, skippedNoNumber, duplicates }
}

// ข้อมูลใบจองใหม่ที่พร้อมบันทึก (เติมฟิลด์ที่ฟอร์มในโปรแกรมใช้ ให้หน้าอื่นอ่านได้เหมือนใบจองที่สร้างในโปรแกรม)
export function newBookingDoc(m, { companyId = null, customerId = null } = {}) {
  const { nid, ...rest } = m
  return {
    ...rest,
    companyId,
    customerId,
    variant: '',
    province: '',
    cost: 0,
    bookingDeposit: 0,
    rightsOnly: false,
    installments: 0,
    interestRate: 0,
    monthly: 0,
    com70: 0,
    insuranceAmount: 0,
    totalIncome: rest.marginLeft + rest.comFinance,
    cancelReason: rest.status === 'ถอนจอง' ? 'other' : '',
    notes: '',
    createdAt: (rest.bookingDate || new Date().toISOString().slice(0, 10)) + 'T00:00:00.000Z',
    importedFromExcel: true,
  }
}

export function newCustomerDoc(m, { companyId = null } = {}) {
  const parts = m.custName.split(' ').filter(Boolean)
  const lastName = parts.length > 1 ? parts.pop() : ''
  const firstName = parts.join(' ') || m.custName || '(ไม่ระบุ)'
  const delivered = m.status === 'ส่งมอบแล้ว'
  const lost = m.status === 'ถอนจอง'
  const at = (m.bookingDate || new Date().toISOString().slice(0, 10)) + 'T00:00:00.000Z'
  return {
    firstName, lastName, phone: m.phone, lineId: '', email: '',
    interestedModel: m.model, budget: m.price, occupation: '', monthlyIncome: 0,
    source: m.source, temperature: null, assignedTo: m.salesName, vip: false, notes: '',
    stage: delivered ? 'delivered' : 'booking', stageChangedAt: at,
    isLost: lost, lostReason: lost ? 'other' : '', lostAt: lost ? at : null,
    companyId, createdAt: at, importedFromExcel: true,
  }
}

// เลือก companyId ตามแบรนด์ของรุ่นรถ — จับคู่กับบริษัทในระบบที่ชื่อ/แบรนด์ตรงกัน (ไม่ hardcode id)
export function companyForBrand(brand, companies, fallback = null) {
  if (!brand) return fallback
  const key = brand.split(' ')[0].toLowerCase()
  const hit = (companies || []).find(c => `${c.brand || ''} ${c.name || ''}`.toLowerCase().includes(key))
  return hit ? hit.id : fallback
}
