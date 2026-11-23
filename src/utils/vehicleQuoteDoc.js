// (v1.0.1338) พิมพ์ใบเสนอราคารถ (A4 หัวบริษัท) จากหน้าใบเสนอราคา — เดิมทำได้แค่คัดลอกข้อความส่ง LINE
// ตัวเลขชุดเดียวกับ quoteText() (ไม่มีโน้ตภายใน/ไอดีระบบ) q = เอกสาร quotations · accessories = [{ name, price, free }]
import { carLabel } from './carLabel.js'
import { formatDate } from './format.js'
import { docHeader, docFooter, esc, printDocument } from './print.js'

const m0 = n => Math.round(Number(n) || 0).toLocaleString('th-TH')

export function vehicleQuoteHtml(q = {}, accessories = []) {
  const car = carLabel(q.brand, String(q.model || '').replace(/\s*\(\d{4}\)\s*$/, ''), q.variant) || q.vehicleLabel || 'รถยนต์'
  const paid = accessories.filter(a => a && !a.free && Number(a.price) > 0)
  const free = accessories.filter(a => a && a.free)
  const line = (label, amt, cls = '') => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td><td class="num">' + amt + '</td></tr>'
  const rows = [line('ราคารถ ' + esc(car) + (q.color ? ' สี' + esc(q.color) : '') + ' (รวม VAT)', m0(q.basePrice))]
  if (q.regFee) rows.push(line('ค่าจดทะเบียน', m0(q.regFee)))
  paid.forEach(a => rows.push(line('อุปกรณ์: ' + esc(a.name), m0(a.price))))
  if (q.discount) rows.push(line('ส่วนลด', '-' + m0(q.discount)))
  if (q.tradeIn) rows.push(line('รถเทิร์น', '-' + m0(q.tradeIn)))
  rows.push(line('ราคาสุทธิ', m0(q.finalPrice), 'total-row'))
  const kv = (a, b) => '<tr><td class="lbl">' + a + '</td><td class="val">' + esc(b == null || b === '' ? '-' : b) + '</td></tr>'
  const fin = q.monthlyPayment > 0 && q.term
  return '<div class="doc">' + docHeader('ใบเสนอราคา', q.quoteNo || '') +
    '<table class="kv"><tbody>' + kv('เรียน', q.customerName ? 'คุณ' + q.customerName : 'ลูกค้า') + kv('รถที่เสนอ', car + (q.color ? ' · สี' + q.color : '')) +
      kv('วันที่เสนอ', q.createdDate ? formatDate(q.createdDate) : '') + kv('ราคานี้ใช้ได้ถึง', q.validUntil ? formatDate(q.validUntil) : '') + '</tbody></table>' +
    '<table class="grid"><thead><tr><th>รายการ</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
    (free.length ? '<div class="note-box">🎁 ของแถม: ' + free.map(a => esc(a.name)).join(', ') + '</div>' : '') +
    (fin ? '<h3 class="sec">ตัวอย่างการผ่อนชำระ</h3><table class="kv"><tbody>' +
      kv('เงินดาวน์', Number(q.downPayment) > 0 ? m0(q.downPayment) + ' บาท' : 'ไม่ใช้เงินดาวน์') +
      kv('ผ่อนต่อเดือน', m0(q.monthlyPayment) + ' บาท × ' + q.term + ' งวด') +
      (q.rate != null ? kv('ดอกเบี้ย', q.rate + '% ต่อปี' + (q.financeCo ? ' · ' + q.financeCo : '')) : '') +
      '</tbody></table><div class="baht-text">* ค่างวดเป็นการประมาณ ขึ้นกับการอนุมัติของไฟแนนซ์</div>' : '') +
    '<div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ลูกค้า</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้เสนอราคา' + (q.salesperson ? ' (' + esc(q.salesperson) + ')' : '') + '</div></div></div>' +
    docFooter() + '</div>'
}

export function printVehicleQuote(q, accessories) {
  printDocument(vehicleQuoteHtml(q, accessories), { title: esc('ใบเสนอราคา ' + (q?.customerName || '')) })
}
