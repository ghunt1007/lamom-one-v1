import { toDate } from './format.js'
// เหตุผลเสียดีล/ถอนจองที่เซลส์พิมพ์เป็นข้อความ (หรือกดปุ่มเลือกในหน้าลูกค้า เช่น "ราคา - อีกร้านลดมากกว่า")
// → จัดเข้ากลุ่มเพื่อนับสถิติในหน้าวิเคราะห์ดีลที่เสีย เดิมทุกข้อความกลายเป็นกลุ่มของตัวเอง กราฟเลยใช้ไม่ได้
export const LOST_REASON_KEYS = ['price', 'competitor', 'model', 'finance', 'timing', 'service', 'location', 'changed_mind', 'no_contact', 'other']

const RULES = [
  ['finance', /ไฟแนนซ์|ไฟแนนท์|กู้ไม่ผ่าน|สินเชื่อ|ผ่อนไม่ไหว|finance/i],
  ['competitor', /คู่แข่ง|ร้านอื่น|ซื้อที่อื่น|ไปซื้อ|ยี่ห้ออื่น|competitor/i],
  ['no_contact', /ติดต่อไม่ได้|ไม่รับสาย|ไม่ตอบ|โทรไม่ติด|บล็อก/],
  ['price', /ราคา|แพง|งบไม่พอ|ส่วนลด|price/i],
  ['model', /ไม่มีรุ่น|ไม่มีสี|รอรถนาน|ไม่มีรถ/],
  ['changed_mind', /เปลี่ยนรุ่น|เปลี่ยนยี่ห้อ|เปลี่ยนใจ/],
  ['timing', /ยังไม่พร้อม|ยังไม่ซื้อ|รอก่อน|ขอคิด|ปีหน้า|timing/i],
  ['service', /บริการ|ไม่พอใจ|service/i],
  ['location', /ไกล|location/i],
]

export function classifyLostReason(text) {
  const s = String(text ?? '').trim()
  if (!s) return 'other'
  if (LOST_REASON_KEYS.includes(s)) return s
  const head = s.split(/\s+[-–—:]\s+/)[0]
  for (const [key, re] of RULES) if (re.test(head)) return key
  for (const [key, re] of RULES) if (re.test(s)) return key
  return 'other'
}

export const LOST_REASON_LABELS = {
  price: 'ราคา', competitor: 'ซื้อคู่แข่ง', model: 'ไม่มีรุ่นที่ต้องการ', finance: 'ไฟแนนซ์ไม่ผ่าน', timing: 'ยังไม่พร้อม',
  service: 'ไม่พอใจบริการ', location: 'ไกล', changed_mind: 'เปลี่ยนใจ/เปลี่ยนรุ่น', no_contact: 'ติดต่อไม่ได้', other: 'อื่นๆ',
}

// เสียดีลในเดือน 'YYYY-MM' (ตามวันที่กดเสียดีล เวลาไทย) แยกตามผู้ดูแล พร้อมเหตุผลที่เจอบ่อยสุด
export function lostBySeller(customers, month) {
  const bkk = v => { const d = toDate(v); return d ? new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 7) : '' }
  const rows = {}
  ;(customers || []).filter(c => c && !c.deleted && c.isLost && bkk(c.lostAt) === month).forEach(c => {
    const name = String(c.assignedTo || '').trim() || '(ไม่มีผู้ดูแล)'
    const r = (rows[name] ||= { name, total: 0, reasons: {} })
    r.total++
    const k = classifyLostReason(c.lostReason)
    r.reasons[k] = (r.reasons[k] || 0) + 1
  })
  return Object.values(rows).map(r => ({
    ...r,
    top: Object.entries(r.reasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ key: k, label: LOST_REASON_LABELS[k] || k, count: v })),
  })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}
