// (v1.0.1331) พิมพ์เอกสารการเงินจริง — เดิมปุ่ม 🖨 พิมพ์ ในหน้าใบแจ้งหนี้/เอกสารการเงิน และหน้าวางบิล เรียก window.print()
// ซึ่งพิมพ์ทั้งหน้าจอแอป (เมนู/ปุ่ม/กล่องป๊อปอัป) ออกมา ไม่ใช่ตัวเอกสาร ตอนนี้สร้างเอกสาร A4 พร้อมหัวบริษัท
import { docHeader, docFooter, money, bahtText, esc, printDocument } from './print.js'
import { formatDate } from './format.js'

export function calcDoc(doc) {
  const r2 = n => Math.round(n * 100) / 100
  const items = doc?.items || []
  const subtotal = r2(items.reduce((a, i) => a + (+i.qty || 0) * (+i.price || 0), 0))
  const vat = r2(items.reduce((a, i) => a + (+i.qty || 0) * (+i.price || 0) * ((+i.vat || 0) / 100), 0))
  // ราคาจากใบจองรวม VAT แล้ว → ยอดรวม = ราคาเดิมพอดี (ไม่ปัดเศษเพี้ยน)
  return { subtotal, vat, total: doc?.grossTotal != null ? doc.grossTotal : r2(subtotal + vat) }
}

const m2 = n => (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function financeDocHtml(d, title) {
  const { subtotal, vat, total } = calcDoc(d)
  const row = (a, b) => '<tr><td class="lbl">' + a + '</td><td class="val">' + esc(b == null || b === '' ? '-' : b) + '</td></tr>'
  return '<div class="doc">' + docHeader(title || 'เอกสาร', d?.no) +
    '<table class="kv"><tbody>' +
      row('ลูกค้า', d?.custName) + (d?.custTax ? row('เลขประจำตัวผู้เสียภาษี', d.custTax) : '') +
      row('วันที่เอกสาร', d?.date ? formatDate(d.date) : '') +
      (d?.dueDate ? row('ครบกำหนดชำระ', formatDate(d.dueDate)) : '') +
      (d?.paidDate ? row('ชำระแล้ววันที่', formatDate(d.paidDate)) : '') +
    '</tbody></table>' +
    '<table class="grid"><thead><tr><th>รายการ</th><th class="num">จำนวน</th><th class="num">ราคา/หน่วย</th><th class="num">VAT</th><th class="num">รวม (บาท)</th></tr></thead><tbody>' +
      (d?.items || []).map(i => '<tr><td>' + esc(i.desc) + '</td><td class="num">' + esc(i.qty) + '</td><td class="num">' + m2(i.price) + '</td><td class="num">' + esc(i.vat || 0) + '%</td><td class="num">' + m2((+i.qty || 0) * (+i.price || 0) * (1 + (+i.vat || 0) / 100)) + '</td></tr>').join('') +
      '<tr><td colspan="4" class="num">ยอดก่อน VAT</td><td class="num">' + m2(subtotal) + '</td></tr>' +
      '<tr><td colspan="4" class="num">ภาษีมูลค่าเพิ่ม</td><td class="num">' + m2(vat) + '</td></tr>' +
      '<tr class="total-row"><td colspan="4" class="num">รวมทั้งสิ้น</td><td class="num">' + m2(total) + '</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(total)) + '</div>' +
    (d?.note ? '<div class="note-box">หมายเหตุ: ' + esc(d.note) + '</div>' : '') +
    '<div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้รับเอกสาร / ลูกค้า</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้มีอำนาจลงนาม</div></div></div>' +
    docFooter() + '</div>'
}

export function printFinanceDoc(d, title) {
  printDocument(financeDocHtml(d, title), { title: esc((title || 'เอกสาร') + ' ' + (d?.no || '')) })
}

export function billingRunHtml(r, invoices) {
  const rows = (invoices || []).map(i => ({ no: i.no || i.id, date: i.date, due: i.dueDate, total: calcDoc(i).total }))
  const sum = r?.totalAmount != null ? r.totalAmount : rows.reduce((a, x) => a + x.total, 0)
  return '<div class="doc">' + docHeader('ใบวางบิล', r?.runNo) +
    '<table class="kv"><tbody>' +
      '<tr><td class="lbl">ลูกค้า</td><td class="val">' + esc(r?.customerName || '-') + '</td></tr>' +
      (r?.dueDate ? '<tr><td class="lbl">กำหนดชำระ</td><td class="val">' + formatDate(r.dueDate) + '</td></tr>' : '') +
    '</tbody></table>' +
    '<table class="grid"><thead><tr><th>#</th><th>เลขที่ใบแจ้งหนี้</th><th>วันที่</th><th>ครบกำหนด</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead><tbody>' +
      rows.map((x, k) => '<tr><td>' + (k + 1) + '</td><td>' + esc(x.no) + '</td><td>' + (x.date ? formatDate(x.date) : '-') + '</td><td>' + (x.due ? formatDate(x.due) : '-') + '</td><td class="num">' + m2(x.total) + '</td></tr>').join('') +
      '<tr class="total-row"><td colspan="4" class="num">รวมทั้งสิ้น ' + rows.length + ' ฉบับ</td><td class="num">' + m2(sum) + '</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(sum)) + '</div>' +
    '<div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้รับวางบิล</div><div class="sign-cap">วันที่ ......../......../........</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้วางบิล</div></div></div>' +
    docFooter() + '</div>'
}

export function printBillingRun(r, invoices) {
  printDocument(billingRunHtml(r, invoices), { title: esc('ใบวางบิล ' + (r?.runNo || '')) })
}
