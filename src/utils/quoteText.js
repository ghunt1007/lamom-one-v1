// (v1.0.1072) ข้อความใบเสนอราคาสำหรับส่งลูกค้าทาง LINE — มีแต่ตัวเลขที่ลูกค้าควรเห็น (ไม่มีชื่อเซลส์ภายใน/โน้ต/ไอดีระบบ)
// q = เอกสาร quotations · accessories = รายการที่ normalize แล้ว [{ name, price, free }] · ฟังก์ชันล้วน ทดสอบได้
import { carLabel } from './carLabel.js'
import { formatDate } from './format.js'

const baht = n => Math.round(Number(n) || 0).toLocaleString('en-US') + ' บาท'

export function quoteText(q = {}, accessories = []) {
  const first = String(q.customerName || '').trim().split(/\s+/)[0]
  const car = carLabel(q.brand, String(q.model || '').replace(/\s*\(\d{4}\)\s*$/, ''), q.variant) || q.vehicleLabel || 'รถยนต์'
  const paid = accessories.filter(a => a && !a.free && Number(a.price) > 0)
  const free = accessories.filter(a => a && a.free)
  const lines = [
    `${first ? `เรียนคุณ${first}` : 'เรียนลูกค้า'} ใบเสนอราคา ${car}${q.color ? ` สี${q.color}` : ''}`,
    `• ราคารถ ${baht(q.basePrice)}`,
  ]
  if (q.regFee) lines.push(`• ค่าจดทะเบียน ${baht(q.regFee)}`)
  paid.forEach(a => lines.push(`• ${a.name} ${baht(a.price)}`))
  if (q.discount) lines.push(`• ส่วนลด -${baht(q.discount)}`)
  if (q.tradeIn) lines.push(`• รถเทิร์น -${baht(q.tradeIn)}`)
  lines.push(`รวมสุทธิ ${baht(q.finalPrice)}`)
  if (free.length) lines.push(`🎁 แถม: ${free.map(a => a.name).join(', ')}`)
  if (q.monthlyPayment > 0 && q.term) {
    lines.push(`💳 ${Number(q.downPayment) > 0 ? `ดาวน์ ${baht(q.downPayment)}` : 'ไม่ใช้เงินดาวน์'} · ผ่อน ${baht(q.monthlyPayment)}/เดือน × ${q.term} งวด${q.rate != null ? ` (ดอกเบี้ย ${q.rate}% ต่อปี${q.financeCo ? ` ${q.financeCo}` : ''})` : ''}`)
  }
  if (q.validUntil) lines.push(`ราคานี้ใช้ได้ถึง ${formatDate(q.validUntil)}`)
  lines.push('ค่างวดเป็นการประมาณ ขึ้นกับการอนุมัติของไฟแนนซ์ · สนใจจองหรือนัดดูรถ ทักกลับได้เลยค่ะ/ครับ')
  return lines.join('\n')
}
