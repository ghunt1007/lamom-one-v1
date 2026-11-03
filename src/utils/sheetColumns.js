// (v1.0.954) คอลัมน์ทั้งหมดของไฟล์ "DATA Booking" (แท็บ Booking) เรียงตามลำดับเดียวกับใน Sheet
//
// ใช้ 2 ที่:
// 1) ตารางแบบ Sheet ในหน้า ยอดจอง/ยอดขาย (bookingSheetGrid.js) — โชว์ครบทุกคอลัมน์ แก้ในช่องได้เลย
// 2) การซิงก์/นำเข้าจาก Sheet (bookingImport.js) — ช่องที่เดิมโปรแกรมไม่เก็บ (จองDMS, Allocate, ชุดขาย, แจ้งประกัน,
//    สายชาร์จ, คืนจอง ฯลฯ) ดึงมาเก็บด้วย ข้อมูลจึงครบเท่า Sheet
//
// แต่ละคอลัมน์: h = หัวคอลัมน์ใน Sheet (ต้องตรงตัวอักษร), f = ชื่อฟิลด์ในใบจอง, t = ชนิด
//   text | num | date | yn (Y/N) | status | list (ตัวเลือก + พิมพ์เองได้) | nid
//   ro = อ่านอย่างเดียว (โปรแกรมคำนวณให้), extra = ช่องที่เพิ่งเพิ่ม (นำเข้าจาก Sheet ด้วยตัวอ่านทั่วไป)
//   w = ความกว้างคอลัมน์ (px)
// อยากเพิ่ม/ย้ายคอลัมน์: แก้รายการข้างล่างนี้ที่เดียว ตารางและการซิงก์จะตามเอง

export const SHEET_COLUMNS = [
  { h: 'เลขใบจอง', f: 'bookingNo', t: 'text', w: 110 },
  { h: 'สถานะ', f: 'status', t: 'status', w: 140 },
  { h: 'วันที่จอง', f: 'bookingDate', t: 'date' },
  { h: 'ชื่อลูกค้า-นามสกุล', f: 'custName', t: 'text', w: 190 },
  { h: 'รุ่นรถ', f: 'model', t: 'text', w: 150 },
  { h: 'สีภายนอก', f: 'colorOut', t: 'list', opts: 'colors' },
  { h: 'สีภายใน', f: 'colorIn', t: 'list', opts: 'colors' },
  { h: 'แหล่งที่มา', f: 'source', t: 'list', opts: 'sources' },
  { h: 'เลขประจำตัวประชาชน', f: 'nid', t: 'nid', w: 140 },
  { h: 'ที่อยู่', f: 'address', t: 'text', w: 220 },
  { h: 'หมายเลขโทรศัพท์', f: 'phone', t: 'text', w: 112 },
  { h: 'ชื่อเซลล์', f: 'salesName', t: 'list', opts: 'sales' },
  { h: 'เซลล์', f: 'salesNick', t: 'text', extra: true },
  { h: 'จองDMS', f: 'dmsBooked', t: 'yn', extra: true },
  { h: 'ส่งจอง', f: 'bookingSent', t: 'yn', extra: true },
  { h: 'ราคารถ', f: 'price', t: 'num' },
  { h: 'ส่วนลดตามแคมเปญ', f: 'campaignDiscount', t: 'num', extra: true },
  { h: 'ส่วนลดเพิ่มเติม', f: 'extraDiscount', t: 'num', extra: true },
  { h: 'ดาวน์', f: 'down', t: 'num' },
  { h: 'ไฟแนนซ์', f: 'financeCo', t: 'list', opts: 'finance' },
  { h: 'แคมเปญดอกเบี้ย', f: 'campaign', t: 'list', opts: 'campaigns' },
  { h: 'จังหวัดที่เซ็นต์', f: 'signProvince', t: 'text', extra: true },
  { h: 'สถานะเช่าซื้อ', f: 'finStatus', t: 'list', opts: 'finStatus' },
  { h: 'วันที่ส่งเคส', f: 'submitDate', t: 'date' },
  { h: 'วันที่เซ็นต์', f: 'signDate', t: 'date' },
  { h: 'วันที่ผ่าน', f: 'approveDate', t: 'date' },
  { h: 'กำหนดส่งมอบ', f: 'deliveryDate', t: 'date' },
  { h: 'วันที่ตัดตัวเลข', f: 'cutDate', t: 'date' },
  { h: 'วันที่รับจริง', f: 'actualDeliveryDate', t: 'date' },
  { h: 'ค่าคอม', f: 'comPaid', t: 'yn', extra: true },
  { h: 'มาจิ้น', f: 'margin', t: 'num' },
  { h: 'งบที่ใช้', f: 'budgetUsed', t: 'num' },
  { h: 'มาจิ้นเหลือ', f: 'marginLeft', t: 'num', ro: true },
  { h: 'เงินได้อุปกรณ์', f: 'accessoryAmount', t: 'num' },
  { h: 'รายคัน', f: 'perCarBonus', t: 'num', extra: true },
  { h: 'คอมไฟแนนซ์เซลล์', f: 'comFinance', t: 'num' },
  { h: 'เงินเพิ่มพิเศษ', f: 'extraBonus', t: 'num', extra: true },
  { h: 'เงินได้รวม', f: 'totalIncome', t: 'num', ro: true },
  { h: 'แคมเปญ CODE', f: 'campaignCode', t: 'text', extra: true },
  { h: 'เหตุผลอื่น', f: 'otherReason', t: 'text', w: 200, extra: true },
  { h: 'Allocate', f: 'allocated', t: 'yn', extra: true },
  { h: 'วันที่ Allocate', f: 'allocateDate', t: 'date', extra: true },
  { h: 'ชุดขาย', f: 'salesKit', t: 'yn', extra: true },
  { h: 'แจ้งประกัน', f: 'insuranceNotified', t: 'yn', extra: true },
  { h: 'คันที่', f: 'unitNo', t: 'num', extra: true },
  { h: 'VIN', f: 'vin', t: 'text', w: 170 },
  { h: 'หมายเลขมอเตอร์', f: 'motorNo', t: 'text', w: 140 },
  { h: 'หมายเลขเครื่องยนต์', f: 'engineNo', t: 'text', w: 140 },
  { h: 'หมายเลขแบต', f: 'batNo', t: 'text', w: 140 },
  { h: 'เบิกสายชาร์จ', f: 'chargerRequested', t: 'yn', extra: true },
  { h: 'ให้สายชาร์จ', f: 'chargerGiven', t: 'yn', extra: true },
  { h: 'LifeTime', f: 'lifetime', t: 'text', extra: true },
  { h: 'ฟิล์ม', f: 'film', t: 'text', extra: true },
  { h: 'สถานที่ส่งมอบ', f: 'deliveryPlace', t: 'text', extra: true },
  { h: 'เลขรับแจ้ง', f: 'noticeNo', t: 'text', extra: true },
  { h: 'ป้ายแดง', f: 'redPlate', t: 'text' },
  { h: 'ทำป้ายแดง', f: 'redPlateDone', t: 'yn', extra: true },
  { h: 'การจดทะเบียน', f: 'registration', t: 'text', extra: true },
  { h: 'ป้ายขาว', f: 'whitePlate', t: 'text' },
  { h: 'แจ้งลูกค้า', f: 'customerNotified', t: 'yn', extra: true },
  { h: 'รับป้ายขาว', f: 'whitePlateReceived', t: 'yn', extra: true },
  { h: 'เช็ครายการ', f: 'checklistDone', t: 'yn', extra: true },
  { h: 'ส่งมอบDMS', f: 'dmsDelivered', t: 'yn', extra: true },
  { h: 'คืนจอง', f: 'depositRefunded', t: 'yn', extra: true },
  { h: 'เหตุผล', f: 'refundReason', t: 'text', w: 160, extra: true },
]

export const EXTRA_COLUMNS = SHEET_COLUMNS.filter(c => c.extra)
export const YN_OPTIONS = ['', 'Y', 'N']

const DEFAULT_W = { text: 120, num: 96, date: 104, yn: 64, status: 140, list: 110, nid: 140 }
export function colWidth(c) { return c.w || DEFAULT_W[c.t] || 110 }

// ค่าที่พิมพ์ในช่อง → ค่าที่เก็บ (ตัวเลขรับ "1,200,000" หรือ "1.2ล้าน" ไม่ได้ — รับเฉพาะตัวเลขและจุลภาค)
export function parseCell(col, raw) {
  const s = raw == null ? '' : String(raw).trim()
  if (col.t === 'num') {
    if (!s) return 0
    const n = Number(s.replace(/[,฿\s]/g, ''))
    return Number.isFinite(n) ? n : null // null = พิมพ์ผิด ไม่บันทึก
  }
  if (col.t === 'yn') {
    const u = s.toUpperCase()
    if (u === 'Y' || u === 'YES' || s === 'ใช่' || s === '✓') return 'Y'
    if (u === 'N' || u === 'NO' || s === 'ไม่') return 'N'
    return s ? u : ''
  }
  if (col.t === 'date') {
    if (!s) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
    if (m) {
      let y = Number(m[3]); if (y < 100) y += 2000; if (y > 2400) y -= 543
      return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }
    return null
  }
  if (col.f === 'phone') return s.replace(/[^\d]/g, '')
  if (col.t === 'nid') return s.replace(/\D/g, '')
  return s
}

// ค่าที่เก็บ → ข้อความในช่อง
export function displayCell(col, v) {
  if (v == null || v === '') return ''
  if (col.t === 'num') {
    const n = Number(v)
    if (!n) return ''
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  if (col.t === 'date') {
    const s = String(v).slice(0, 10)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? `${Number(m[3])}/${Number(m[2])}/${m[1].slice(2)}` : s
  }
  return String(v)
}

// แก้ช่องเดียว → patch ที่ต้องบันทึก (รวมช่องที่คำนวณต่อจากช่องนี้ ให้ตรงกับฟอร์มเต็ม)
export function patchForCell(b, col, value) {
  const patch = { [col.f]: value }
  const next = { ...b, ...patch }
  if (['margin', 'budgetUsed', 'com70', 'comFinance'].includes(col.f)) {
    const left = (Number(next.margin) || 0) - (Number(next.budgetUsed) || 0)
    patch.marginLeft = left
    patch.totalIncome = left + (Number(next.com70) || 0) + (Number(next.comFinance) || 0)
  }
  if (col.f === 'price' || col.f === 'down') {
    const price = Number(next.price) || 0
    patch.financeAmount = price ? Math.max(price - (Number(next.down) || 0), 0) : 0
  }
  return patch
}

// ผลรวมท้ายตาราง: เฉพาะคอลัมน์ตัวเลขที่เป็นเงิน (ไม่รวม "คันที่")
export function columnTotals(rows, cols = SHEET_COLUMNS) {
  const out = {}
  for (const c of cols) {
    if (c.t !== 'num' || c.f === 'unitNo') continue
    out[c.f] = rows.reduce((s, r) => s + (Number(r[c.f]) || 0), 0)
  }
  return out
}

// เรียงแถวตามคอลัมน์ (ช่องว่างไปท้ายเสมอ ไม่ว่าเรียงขึ้นหรือลง)
export function sortRows(rows, col, dir = 1) {
  if (!col) return rows
  const val = r => r[col.f]
  const empty = v => v == null || v === '' || (col.t === 'num' && !Number(v))
  return [...rows].sort((a, b) => {
    const va = val(a), vb = val(b)
    if (empty(va) && empty(vb)) return 0
    if (empty(va)) return 1
    if (empty(vb)) return -1
    if (col.t === 'num') return (Number(va) - Number(vb)) * dir
    return String(va).localeCompare(String(vb), 'th', { numeric: true }) * dir
  })
}

// ค่าจากไฟล์ (เฉพาะช่องที่เพิ่งเพิ่ม) — ตัวเลข/วันที่/ข้อความ ตามชนิดคอลัมน์
export function mapExtraColumns(r, { str, num, fmtDate }) {
  const out = {}
  for (const c of EXTRA_COLUMNS) {
    if (!(c.h in r)) continue
    if (c.t === 'num') out[c.f] = num(r[c.h])
    else if (c.t === 'date') out[c.f] = fmtDate(r[c.h])
    else out[c.f] = str(r[c.h])
  }
  return out
}

// (v1.0.955) ข้อความที่คัดลอกจาก Google Sheet/Excel → ตาราง [แถว][คอลัมน์]
// Sheet คั่นช่องด้วย Tab คั่นแถวด้วยขึ้นบรรทัดใหม่ ช่องที่มีขึ้นบรรทัด/อัญประกาศจะถูกครอบด้วย "..."
export function parseClipboardGrid(text) {
  const s = String(text ?? '').replace(/\r\n?/g, '\n')
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
    } else if (ch === '"' && cell === '') q = true
    else if (ch === '\t') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

// วางตาราง grid ลงที่แถว startRow คอลัมน์ startCol — ข้ามคอลัมน์ที่อ่านอย่างเดียว (เหมือนวางใน Sheet ที่ช่องตรงกัน)
// คืน { changes:[{row, col, value}], bad:[{row, col, raw}] } — row = index ใน rows, col = object คอลัมน์
export function planPaste(grid, rows, cols, startRow, startCol) {
  const changes = [], bad = []
  grid.forEach((line, di) => {
    const r = rows[startRow + di]
    if (!r) return
    line.forEach((raw, dj) => {
      const c = cols[startCol + dj]
      if (!c || c.ro) return
      const v = parseCell(c, raw)
      if (v === null) { bad.push({ row: startRow + di, col: c, raw }); return }
      const cur = r[c.f]
      const same = c.t === 'num' ? (Number(v) || 0) === (Number(cur) || 0) : String(v ?? '').trim() === String(cur ?? '').trim()
      if (!same) changes.push({ row: startRow + di, col: c, value: v })
    })
  })
  return { changes, bad }
}

// ส่งออก Excel: หัวคอลัมน์และลำดับเหมือนไฟล์ DATA Booking
export function sheetExportRows(rows, cols = SHEET_COLUMNS) {
  return rows.map(r => Object.fromEntries(cols.map(c => {
    const v = r[c.f]
    if (c.t === 'num') return [c.h, Number(v) || '']
    return [c.h, v == null ? '' : String(v)]
  })))
}
