// (v1.0.1326) ใบเสร็จรับเงินจากหน้าจุดรับชำระ (Cashier Desk) — เดิมปุ่ม "รับเงิน + พิมพ์ใบเสร็จ" และปุ่ม 🖨 ใบเสร็จ
// ในรายการ ขึ้นข้อความว่า "พิมพ์ใบเสร็จแล้ว" แต่ไม่มีอะไรพิมพ์ออกมาเลย ตอนนี้สร้างใบเสร็จจริง (หัวบริษัทจากหน้าข้อมูลบริษัท)
import { docHeader, docFooter, money, bahtText, esc, printDocument } from './print.js'
import { formatDateTime } from './format.js'

export const CASHIER_METHOD_LABEL = { cash: 'เงินสด', transfer: 'โอน/PromptPay', card: 'บัตรเครดิต', cheque: 'เช็ค' }

export function receiptNo(p) {
  const id = String(p?.receiptNo || p?.id || '')
  return id ? (p?.receiptNo ? id : 'RC-' + id.slice(-8).toUpperCase()) : ''
}

export function cashierReceiptHtml(p) {
  const amount = Number(p?.amount) || 0
  const row = (a, b) => '<tr><td class="lbl">' + a + '</td><td class="val">' + esc(b == null || b === '' ? '-' : b) + '</td></tr>'
  return '<div class="doc">' +
    docHeader('ใบเสร็จรับเงิน', receiptNo(p)) +
    '<table class="kv"><tbody>' +
      row('ได้รับเงินจาก', p?.customer) +
      row('อ้างอิง', p?.ref && p.ref !== 'MISC' ? p.ref : '') +
      row('ชำระโดย', CASHIER_METHOD_LABEL[p?.method] || p?.method) +
      row('วันที่/เวลา', formatDateTime(p?.time)) +
    '</tbody></table>' +
    '<table class="grid"><thead><tr><th>รายการ</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead><tbody>' +
      '<tr><td>' + esc(p?.desc && p.desc !== '—' ? p.desc : 'รับชำระเงิน') + '</td><td class="num">' + money(amount) + '</td></tr>' +
      '<tr class="total-row"><td>รวมทั้งสิ้น</td><td class="num">' + money(amount) + '</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(amount)) + '</div>' +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ชำระเงิน</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้รับเงิน (' + esc(p?.cashier || '') + ')</div></div>' +
    '</div>' +
    docFooter() + '</div>'
}

export function printCashierReceipt(p) {
  printDocument(cashierReceiptHtml(p), { title: esc('ใบเสร็จรับเงิน ' + receiptNo(p)) })
}
