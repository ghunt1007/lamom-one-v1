// ไม่ import อะไร — ใช้ได้ทั้งเว็บและ worker
// (v1.0.1539) คอลัมน์ Y/N ของ Sheet ที่ถามได้ว่า "ใบไหนยังไม่ได้…"
const YN_ASK = [
  { re: /ส่ง\s*มอบ\s*(?:ใน|ลง)?\s*dms|(?:ลง|คีย์)\s*(?:ส่งมอบ)?\s*(?:ใน)?\s*dms\s*(?:ว่า)?\s*ส่งมอบ/i, f: 'dmsDelivered', h: 'ส่งมอบDMS', label: 'ส่งมอบใน DMS', delivered: true },
  { re: /เบิก\s*สาย\s*ชาร์จ/, f: 'chargerRequested', h: 'เบิกสายชาร์จ', label: 'เบิกสายชาร์จ' },
  { re: /สาย\s*ชาร์จ/, f: 'chargerGiven', h: 'ให้สายชาร์จ', label: 'ให้สายชาร์จ' },
  { re: /(?:แจ้ง|ทำ|ส่ง)\s*ประกัน/, f: 'insuranceNotified', h: 'แจ้งประกัน', label: 'แจ้งประกัน', not: /ต่อ\s*ประกัน|หมด/ },
  { re: /allocate|อัลโล\S*|แอลโล\S*/i, f: 'allocated', h: 'Allocate', label: ' Allocate' },
  { re: /ชุด\s*ขาย/, f: 'salesKit', h: 'ชุดขาย', label: 'ให้ชุดขาย' },
  { re: /เช็ค\s*รายการ|checklist|เช็คลิสต์/i, f: 'checklistDone', h: 'เช็ครายการ', label: 'เช็ครายการ' },
  { re: /(?:จอง|ลง|คีย์)\s*(?:ใน)?\s*dms/i, f: 'dmsBooked', h: 'จองDMS', label: 'จองใน DMS' },
  { re: /^ส่ง\s*(?:ใบ)?\s*จอง/, f: 'bookingSent', h: 'ส่งจอง', label: 'ส่งจอง' },
  { re: /^แจ้ง\s*ลูกค้า/, f: 'customerNotified', h: 'แจ้งลูกค้า', label: 'แจ้งลูกค้า' },
]
// (v1.0.1554) ช่องที่ควรกรอกแต่ยังว่าง: "ใบจองไหนยังไม่ได้ใส่ราคา" · "ใบจองที่ยังไม่ได้ใส่ไฟแนนซ์"
const MISSING_ASK = [
  { re: /^(?:ใส่|กรอก|มี)\s*ราคา/, f: 'price', h: 'ราคา', label: 'ใส่ราคา' },
  { re: /^(?:ใส่|กรอก|ระบุ|มี)\s*(?:ชื่อ)?\s*(?:ไฟแนนซ์|ไฟแนนท์|บริษัทไฟแนนซ์)/, f: 'financeCo', h: 'ไฟแนนซ์', label: 'ใส่ไฟแนนซ์' },
  { re: /^(?:ใส่|กรอก|ระบุ|มี)\s*(?:ชื่อ)?\s*(?:เซลส์|เซล|ผู้ขาย|คนขาย)/, f: 'salesName', h: 'เซลส์', label: 'ใส่ชื่อเซลส์' },
  { re: /^(?:ใส่|กรอก|ระบุ|มี)\s*วัน\s*(?:ที่)?\s*จอง/, f: 'bookingDate', h: 'วันที่จอง', label: 'ใส่วันที่จอง' },
]
export function bookingYnColumn(s) {
  const m = String(s || '').match(/ยัง\s*ไม่(?:ได้)?\s*(?:มี|ให้|รับ|ได้|ทำ)?\s*(.{0,30})/)
  if (!m) return null
  const raw = String(s).match(/ยัง\s*ไม่(?:ได้)?\s*(.{0,30})/)
  const miss = raw && /จอง/.test(s) && MISSING_ASK.find(x => x.re.test(raw[1]))
  if (miss) return { f: miss.f, h: miss.h, label: miss.label, missing: true }
  const y = YN_ASK.find(x => x.re.test(m[1]) && !(x.not && x.not.test(s)))
  return y ? { f: y.f, h: y.h, label: y.label, ...(y.delivered ? { delivered: true } : {}) } : null
}
