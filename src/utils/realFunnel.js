// (2026-11-02) กรวยการขายจากข้อมูลจริงเท่านั้น — เดิม ConversionFunnel / War Room / Customer Journey
// "เดา" ขั้นที่ไม่มีข้อมูล (ติดต่อสำเร็จ = Lead × 0.74, เข้าโชว์รูม × 0.44, รู้จักแบรนด์ = Lead × 3 ฯลฯ)
// ทำให้ตัวเลขดูเหมือนจริงแต่แต่งขึ้น ตอนนี้นับเฉพาะสิ่งที่ระบบบันทึกจริง:
//   Lead = ลูกค้าในระบบ (อย่างน้อยเท่าจำนวนใบจอง) · ลองขับ = ลูกค้าที่มีนัดลองขับ · ใบเสนอราคา = ลูกค้าที่มีใบเสนอราคา
//   จอง = ใบจองที่ไม่ถอน · ส่งมอบ = ใบจองที่ส่งมอบแล้ว
// sales = getSalesData() (ไม่รวมใบถอนจองแล้ว, มี delivered)

export const FUNNEL_META = [
  { key: 'lead', stage: 'ลูกค้า / Lead', icon: '🧲', color: '#3b82f6' },
  { key: 'td', stage: 'ลองขับ', icon: '🚗', color: '#f59e0b' },
  { key: 'quote', stage: 'ใบเสนอราคา', icon: '📄', color: '#f97316' },
  { key: 'booked', stage: 'จอง', icon: '📝', color: '#ef4444' },
  { key: 'delivered', stage: 'ส่งมอบแล้ว', icon: '🏁', color: '#8b5cf6' },
]

const ids = (rows, ...keys) => {
  const s = new Set()
  for (const r of rows || []) {
    if (!r || r.deleted) continue
    const v = keys.map(k => r[k]).find(Boolean)
    if (v) s.add(String(v))
  }
  return s
}

export function realFunnel({ customers = [], sales = [], testDrives = [], quotations = [] } = {}) {
  const live = customers.filter(c => c && !c.deleted)
  const td = ids(testDrives, 'customerId', 'phone', 'customerName')
  live.forEach(c => { if (c.testDrive || c.testDriveDate) td.add(String(c.id)) })
  const q = ids(quotations, 'customerId', 'phone', 'customerName')
  const counts = {
    lead: Math.max(live.length, sales.length),
    td: td.size,
    quote: q.size,
    booked: sales.length,
    delivered: sales.filter(s => s.delivered).length,
  }
  return FUNNEL_META.map(m => ({ ...m, count: counts[m.key] }))
}

// อัตราจากขั้นก่อนหน้า (ไม่เกิน 100% — บางขั้นยังบันทึกไม่ครบ เช่น ลองขับไม่ได้คีย์ทุกครั้ง)
export function stepRate(count, prev) {
  if (!prev) return 0
  return Math.min(100, Math.round(count / prev * 100))
}

// ลูกค้าซื้อซ้ำ (ใบจองมากกว่า 1 ใบ ด้วยเบอร์หรือชื่อเดียวกัน)
export function repeatBuyers(sales = []) {
  const n = {}
  for (const s of sales) {
    const k = String(s.phone || '').replace(/\D/g, '') || String(s.custName || '').trim()
    if (k) n[k] = (n[k] || 0) + 1
  }
  return Object.values(n).filter(v => v > 1).length
}
