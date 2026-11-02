// ขั้นต่อไปของใบจองตามสถานะ + อายุใบจอง + วันส่งมอบ — ให้เซลส์เปิดใบจองแล้วรู้ทันทีว่าต้องทำอะไรต่อ
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล · คืน { text, tone } (tone = danger | warning | info) หรือ null ถ้าจบแล้ว
const DAY = 86400000
const dayDiff = (from, to) => {
  const a = Date.parse(String(from || '').slice(0, 10) + 'T00:00:00Z'), b = Date.parse(String(to || '').slice(0, 10) + 'T00:00:00Z')
  return isNaN(a) || isNaN(b) ? null : Math.round((b - a) / DAY)
}

export function bookingNextStep(b, today) {
  if (!b) return null
  const st = b.status || ''
  if (['ส่งมอบแล้ว', 'ถอนจอง', 'ยกเลิก'].includes(st)) return null
  const age = dayDiff(b.bookingDate, today)
  const toDelivery = dayDiff(today, b.deliveryDate)
  const fin = b.financeCo ? `ไฟแนนซ์ ${b.financeCo}` : 'ไฟแนนซ์'
  if (toDelivery != null && toDelivery < 0) return { tone: 'danger', text: `เลยกำหนดส่งมอบมา ${-toDelivery} วัน — โทรแจ้งลูกค้าและนัดวันส่งมอบใหม่` }
  switch (st) {
    case 'ตัดตัวเลขรอส่งมอบ':
    case 'รอส่งมอบ':
      if (toDelivery != null && toDelivery <= 3) return { tone: 'warning', text: toDelivery === 0 ? 'ส่งมอบวันนี้ — เช็ก PDI เอกสาร และป้ายแดงให้พร้อม' : `ส่งมอบในอีก ${toDelivery} วัน — เตรียม PDI เอกสาร และป้ายแดง` }
      return { tone: 'info', text: b.deliveryDate ? 'นัด PDI ล่วงหน้า และยืนยันวันส่งมอบกับลูกค้า' : 'ยังไม่มีวันส่งมอบ — นัดวันกับลูกค้าแล้วใส่ในใบจอง' }
    case 'รอผลไฟแนนซ์':
      return age > 7 ? { tone: 'warning', text: `รอผล${fin} มา ${age} วันแล้ว — โทรตามผล หรือเตรียมยื่นเจ้าอื่นสำรอง` } : { tone: 'info', text: `ติดตามผลกับ${fin} และแจ้งลูกค้าเป็นระยะ` }
    case 'จัดไฟแนนซ์ก่อนจอง':
      return { tone: 'info', text: 'รวบรวมเอกสารลูกค้าให้ครบ แล้วยื่นไฟแนนซ์' }
    case 'ผ่านไฟแนนซ์รอจอง':
      return { tone: 'warning', text: 'ไฟแนนซ์ผ่านแล้ว — แจ้งลูกค้า นัดวางเงินจองและทำสัญญา' }
    case 'ผ่านไฟแนนซ์รอเบิก':
    case 'ซื้อสดรอเบิกรถ':
      return { tone: 'info', text: b.vin ? 'เบิกรถคันนี้ แล้วนัด PDI และวันส่งมอบ' : 'ยังไม่ผูกเลขตัวถัง — เลือกรถจากสต็อกหรือสั่งรถ' }
    case 'รอรถ':
      return age > 30 ? { tone: 'warning', text: `รอรถมา ${age} วัน — เช็กวันรถเข้ากับโรงงาน แล้วอัปเดตลูกค้า` } : { tone: 'info', text: 'เช็กวันรถเข้า แล้วอัปเดตลูกค้าเป็นระยะ' }
    case 'ยอดจองคงค้าง':
      return { tone: age > 14 ? 'warning' : 'info', text: `${age > 14 ? `ค้างมา ${age} วัน — ` : ''}ถามลูกค้าว่าซื้อสดหรือไฟแนนซ์ แล้วเปลี่ยนสถานะให้เดินต่อ` }
    default:
      return null
  }
}

// (2026-11-02) ปุ่มเดียวทำขั้นต่อไปได้เลย — คืน { key, label } หรือ null
// key: 'print:<ฟอร์ม>' พิมพ์เอกสารจากใบจอง · 'finance' ยื่นไฟแนนซ์ · 'edit' เปิดแก้ใบจอง (ใส่วัน/เลือกรถ)
export function bookingNextAction(b, today) {
  const step = bookingNextStep(b, today)
  if (!step) return null
  const st = b.status || ''
  const toDelivery = dayDiff(today, b.deliveryDate)
  if (toDelivery != null && toDelivery < 0) return { key: 'edit', label: '📅 นัดวันส่งมอบใหม่' }
  switch (st) {
    case 'ตัดตัวเลขรอส่งมอบ':
    case 'รอส่งมอบ':
      if (!b.deliveryDate) return { key: 'edit', label: '📅 ใส่วันส่งมอบ' }
      return toDelivery <= 3 ? { key: 'print:delivery', label: '🚗 พิมพ์ใบส่งมอบ' } : { key: 'print:expense', label: '💵 พิมพ์แจ้งค่าใช้จ่าย' }
    case 'จัดไฟแนนซ์ก่อนจอง':
      return { key: 'finance', label: '🏦 ยื่นไฟแนนซ์' }
    case 'ผ่านไฟแนนซ์รอจอง':
      return { key: 'print:contract', label: '📜 พิมพ์สัญญา' }
    case 'ผ่านไฟแนนซ์รอเบิก':
    case 'ซื้อสดรอเบิกรถ':
      return b.vin ? { key: 'print:joborder', label: '🎨 พิมพ์ใบสั่งแต่ง' } : { key: 'edit', label: '🚗 ใส่เลขตัวถัง' }
    case 'ยอดจองคงค้าง':
      return { key: 'edit', label: '✏️ เลือกซื้อสด/ไฟแนนซ์' }
    default:
      return null
  }
}
