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
