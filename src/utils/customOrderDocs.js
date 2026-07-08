// เอกสารระบบสั่งแต่งรถ — PO / ใบเสร็จ / ใบกำกับภาษี / ใบเสร็จชั่วคราว / ใบลดหนี้ / หนังสือสอบถามทะเบียน / หนังสือแจ้งเลขประกัน
import { printDocument, docHeader, docFooter, money, bahtText, esc } from './print.js'
import { formatDate } from './format.js'

function kv(label, value) {
  return '<tr><td class="lbl">' + esc(label) + '</td><td class="val">' + esc(value == null || value === '' ? '-' : value) + '</td></tr>'
}

function sec(t) { return '<h3 class="sec">' + esc(t) + '</h3>' }

function itemsTable(items) {
  const total = (items || []).reduce((a, i) => a + i.qty * i.unitPrice, 0)
  return '<table class="grid"><thead><tr><th>รายการ</th><th class="num">จำนวน</th><th class="num">ราคา/หน่วย</th><th class="num">รวม</th></tr></thead><tbody>' +
    (items || []).map(i => '<tr><td>' + esc(i.name) + '</td><td class="num">' + i.qty + '</td><td class="num">' + money(i.unitPrice) + '</td><td class="num">' + money(i.qty * i.unitPrice) + '</td></tr>').join('') +
    '<tr class="total-row"><td colspan="3">รวมทั้งหมด</td><td class="num">' + money(total) + ' บาท</td></tr>' +
    '</tbody></table>'
}

function orderHeadTable(o) {
  return '<table class="kv"><tbody>' +
    kv('ลูกค้า', o.customerName) +
    kv('โทรศัพท์', o.phone) +
    kv('รุ่นรถ', o.vehicleModel) +
    kv('ทะเบียน/VIN', [o.plate, o.vin].filter(Boolean).join(' / ')) +
    kv('พนักงานขาย', o.salesName) +
    '</tbody></table>'
}

// ── PO สั่งแต่งไปยังซัพพลายเออร์ ──────────────────────────
export function printCustomOrderPO(o) {
  if (!o) return
  const html =
    '<div class="doc">' +
    docHeader('ใบสั่งซื้อ (PO) — งานแต่งรถ', o.poNo, formatDate(o.poIssuedDate)) +
    sec('🏭 ผู้จัดจำหน่าย') +
    '<table class="kv"><tbody>' + kv('ซัพพลายเออร์', o.supplier) + kv('ผู้ติดต่อ', o.supplierContact) + '</tbody></table>' +
    sec('🚗 ข้อมูลรถ / ลูกค้า') + orderHeadTable(o) +
    sec('🎨 รายการสั่งแต่ง') + itemsTable(o.items) +
    (o.discount ? '<div class="note-box">ส่วนลด: ' + money(o.discount) + ' บาท ' + (o.discountNote ? '(' + esc(o.discountNote) + ')' : '') + '</div>' : '') +
    (o.freebies && o.freebies.length ? sec('🎁 ของแถม') + '<ul>' + o.freebies.map(f => '<li>' + esc(f.name) + ' × ' + f.qty + '</li>').join('') + '</ul>' : '') +
    sec('📅 กำหนดการติดตั้ง') +
    '<table class="kv"><tbody>' + kv('วันที่ต้องการติดตั้ง', o.installDate ? formatDate(o.installDate) : 'รอกำหนด') + '</tbody></table>' +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ธุรการขาย (ผู้ออก PO)</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ซัพพลายเออร์ (ผู้รับงาน)</div></div>' +
    '</div>' +
    docFooter() + '</div>'
  printDocument(html, { title: 'PO ' + (o.poNo || '') })
}

// ── ใบเสร็จรับเงิน ─────────────────────────────────────────
export function printCustomReceipt(o, doc) {
  if (!o) return
  const amount = doc?.amount ?? o.total
  const html =
    '<div class="doc">' +
    docHeader('ใบเสร็จรับเงิน', doc?.docNo, formatDate(doc?.issuedAt)) +
    sec('👤 ผู้รับบริการ') + orderHeadTable(o) +
    sec('🎨 รายการ') + itemsTable(o.items) +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(amount)) + '</div>' +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ชำระเงิน</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้รับเงิน (' + esc(doc?.issuedBy || '') + ')</div></div>' +
    '</div>' +
    docFooter() + '</div>'
  printDocument(html, { title: 'ใบเสร็จรับเงิน ' + (doc?.docNo || '') })
}

// ── ใบเสร็จรับเงินชั่วคราว ───────────────────────────────
export function printCustomTempReceipt(o, doc) {
  if (!o) return
  const amount = doc?.amount ?? o.total
  const html =
    '<div class="doc">' +
    docHeader('ใบเสร็จรับเงินชั่วคราว', doc?.docNo, formatDate(doc?.issuedAt)) +
    '<div class="note-box">เอกสารนี้เป็นหลักฐานการรับเงินชั่วคราว จะออกใบเสร็จรับเงิน/ใบกำกับภาษีฉบับสมบูรณ์ให้ภายหลัง</div>' +
    sec('👤 ผู้ชำระเงิน') + orderHeadTable(o) +
    sec('💰 จำนวนเงินที่รับ') +
    '<table class="grid"><tbody><tr class="total-row"><td>รับเงินชั่วคราว</td><td class="num">' + money(amount) + ' บาท</td></tr></tbody></table>' +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(amount)) + '</div>' +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ชำระเงิน</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้รับเงิน (' + esc(doc?.issuedBy || '') + ')</div></div>' +
    '</div>' +
    docFooter() + '</div>'
  printDocument(html, { title: 'ใบเสร็จชั่วคราว ' + (doc?.docNo || '') })
}

// ── ใบกำกับภาษี ────────────────────────────────────────────
export function printCustomTaxInvoice(o, doc) {
  if (!o) return
  const amount = doc?.amount ?? o.total
  const vat = Math.round(amount / 1.07 * 0.07)
  const beforeVat = amount - vat
  const html =
    '<div class="doc">' +
    docHeader('ใบกำกับภาษี / ใบเสร็จรับเงิน', doc?.docNo, formatDate(doc?.issuedAt)) +
    sec('👤 ผู้ซื้อ') + orderHeadTable(o) +
    sec('🎨 รายการ') + itemsTable(o.items) +
    sec('🧾 สรุปภาษีมูลค่าเพิ่ม') +
    '<table class="grid"><tbody>' +
      '<tr><td>มูลค่าก่อนภาษี</td><td class="num">' + money(beforeVat) + ' บาท</td></tr>' +
      '<tr><td>ภาษีมูลค่าเพิ่ม (VAT 7%)</td><td class="num">' + money(vat) + ' บาท</td></tr>' +
      '<tr class="total-row"><td>รวมทั้งสิ้น</td><td class="num">' + money(amount) + ' บาท</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(amount)) + '</div>' +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ซื้อ</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ออกใบกำกับภาษี (' + esc(doc?.issuedBy || '') + ')</div></div>' +
    '</div>' +
    docFooter() + '</div>'
  printDocument(html, { title: 'ใบกำกับภาษี ' + (doc?.docNo || '') })
}

// ── ใบลดหนี้ ───────────────────────────────────────────────
export function printCustomCreditNote(o, doc) {
  if (!o) return
  const amount = doc?.amount ?? 0
  const html =
    '<div class="doc">' +
    '<div class="watermark">ใบลดหนี้</div>' +
    docHeader('ใบลดหนี้ (Credit Note)', doc?.docNo, formatDate(doc?.issuedAt)) +
    sec('👤 ลูกค้า') + orderHeadTable(o) +
    sec('📝 เหตุผลการลดหนี้') +
    '<div class="note-box">' + esc(doc?.note || '-') + '</div>' +
    sec('💸 จำนวนเงินที่ลด') +
    '<table class="grid"><tbody><tr class="total-row"><td>ยอดลดหนี้</td><td class="num">' + money(amount) + ' บาท</td></tr></tbody></table>' +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(amount)) + '</div>' +
    sec('✅ การอนุมัติ') +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">เจ้าหน้าที่การเงิน</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้อนุมัติ</div></div>' +
    '</div>' +
    docFooter() + '</div>'
  printDocument(html, { title: 'ใบลดหนี้ ' + (doc?.docNo || '') })
}

// ── หนังสือสอบถามการจดทะเบียน ──────────────────────────────
export function printRegistrationInquiry(o, doc) {
  if (!o) return
  const html =
    '<div class="doc">' +
    docHeader('หนังสือสอบถามการจดทะเบียนรถยนต์', doc?.docNo, formatDate(doc?.issuedAt)) +
    '<p style="font-size:13px;color:#334155;margin:8px 0 4px">' +
      'เรียน ลูกค้าผู้ซื้อรถยนต์ <b>' + esc(o.customerName || '-') + '</b><br><br>' +
      'ตามที่ท่านได้สั่งซื้อ/สั่งแต่งรถยนต์ รุ่น <b>' + esc(o.vehicleModel || '-') + '</b> ' +
      'เลขตัวถัง (VIN) <b>' + esc(o.vin || '-') + '</b> กับบริษัทฯ นั้น ' +
      'บริษัทฯ ขอสอบถามความประสงค์ในการดำเนินการจดทะเบียนรถยนต์ดังกล่าว โปรดระบุความประสงค์ของท่าน' +
    '</p>' +
    '<table class="grid" style="margin-top:10px"><tbody>' +
      '<tr><td style="width:36px;text-align:center">☐</td><td>ประสงค์ให้บริษัทฯ ดำเนินการจดทะเบียนให้ (มอบอำนาจ)</td></tr>' +
      '<tr><td style="width:36px;text-align:center">☐</td><td>ประสงค์ดำเนินการจดทะเบียนด้วยตนเอง</td></tr>' +
      '<tr><td style="width:36px;text-align:center">☐</td><td>ประสงค์ล็อคเลขทะเบียน (ระบุเลขที่ต้องการ) ................................................</td></tr>' +
    '</tbody></table>' +
    sec('🚗 ข้อมูลรถ / ลูกค้า') + orderHeadTable(o) +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ลูกค้า (' + esc(o.customerName || '..............................') + ')</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ออกหนังสือ (' + esc(doc?.issuedBy || '') + ')</div></div>' +
    '</div>' +
    docFooter() + '</div>'
  printDocument(html, { title: 'หนังสือสอบถามการจดทะเบียน ' + (doc?.docNo || '') })
}

// ── หนังสือแจ้งเลขรับแจ้งประกันภัย ──────────────────────────
export function printInsuranceNotify(o, doc) {
  if (!o) return
  const html =
    '<div class="doc">' +
    docHeader('หนังสือแจ้งเลขที่รับแจ้งประกันภัย', doc?.docNo, formatDate(doc?.issuedAt)) +
    '<p style="font-size:13px;color:#334155;margin:8px 0 4px">' +
      'เรียน ลูกค้าผู้เอาประกันภัย <b>' + esc(o.customerName || '-') + '</b><br><br>' +
      'บริษัทฯ ขอแจ้งให้ทราบว่าได้ดำเนินการแจ้งประกันภัยสำหรับรถยนต์ของท่านเรียบร้อยแล้ว โดยมีรายละเอียดดังนี้' +
    '</p>' +
    sec('🚗 ข้อมูลรถ / ลูกค้า') + orderHeadTable(o) +
    sec('🛡 ข้อมูลการรับแจ้งประกันภัย') +
    '<table class="kv"><tbody>' +
      kv('เลขที่รับแจ้ง', doc?.docNo) +
      kv('บริษัทประกันภัย', doc?.insurer || o.insurer) +
      kv('วันที่แจ้ง', formatDate(doc?.issuedAt)) +
    '</tbody></table>' +
    '<div class="note-box">' + esc(doc?.note || 'กรุณาเก็บเอกสารนี้ไว้เป็นหลักฐานอ้างอิงในการติดต่อกับบริษัทประกันภัย') + '</div>' +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ออกหนังสือ (' + esc(doc?.issuedBy || '') + ')</div></div>' +
    '</div>' +
    docFooter() + '</div>'
  printDocument(html, { title: 'หนังสือแจ้งเลขประกันภัย ' + (doc?.docNo || '') })
}
