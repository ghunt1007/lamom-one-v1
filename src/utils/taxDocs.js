// เอกสารภาษี — หนังสือรับรองการหักภาษี ณ ที่จ่าย (ใบ 50 ทวิ)
import { printDocument, docHeader, docFooter, money, bahtText, esc, getOrgInfo } from './print.js'
import { formatDate } from './format.js'

function kv(label, value) {
  return '<tr><td class="lbl">' + esc(label) + '</td><td class="val">' + esc(value == null || value === '' ? '-' : value) + '</td></tr>'
}
function sec(t) { return '<h3 class="sec">' + esc(t) + '</h3>' }

export function printWithholdingTaxCert(c) {
  if (!c) return
  const org = getOrgInfo()
  const html =
    '<div class="doc">' +
    docHeader('หนังสือรับรองการหักภาษี ณ ที่จ่าย', c.certNo, formatDate(c.paymentDate)) +
    '<div class="note-box" style="margin-bottom:10px">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>' +

    sec('🏢 ผู้จ่ายเงิน (ผู้หักภาษี ณ ที่จ่าย)') +
    '<table class="kv"><tbody>' +
      kv('ชื่อ', org.name) +
      kv('เลขประจำตัวผู้เสียภาษี', org.taxId) +
      kv('ที่อยู่', org.addr) +
    '</tbody></table>' +

    sec('👤 ผู้ถูกหักภาษี ณ ที่จ่าย (ผู้รับเงิน)') +
    '<table class="kv"><tbody>' +
      kv('ชื่อ', c.payeeName) +
      kv('เลขประจำตัวผู้เสียภาษี/เลขบัตรประชาชน', c.payeeTaxId) +
      kv('ที่อยู่', c.payeeAddress) +
    '</tbody></table>' +

    sec('💰 รายละเอียดการจ่ายเงินได้') +
    '<table class="grid"><thead><tr><th>ประเภทเงินได้ (มาตรา 40)</th><th class="num">วันที่จ่าย</th><th class="num">จำนวนเงินที่จ่าย</th><th class="num">อัตราภาษี</th><th class="num">ภาษีที่หักไว้</th></tr></thead><tbody>' +
      '<tr><td>' + esc(c.incomeTypeLabel) + '</td><td class="num">' + formatDate(c.paymentDate) + '</td><td class="num">' + money(c.amountPaid) + '</td><td class="num">' + c.taxRate + '%</td><td class="num">' + money(c.taxWithheld) + '</td></tr>' +
      '<tr class="total-row"><td colspan="2">รวม</td><td class="num">' + money(c.amountPaid) + '</td><td></td><td class="num">' + money(c.taxWithheld) + '</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">จำนวนภาษีที่หักไว้ (ตัวอักษร): ' + esc(bahtText(c.taxWithheld)) + '</div>' +

    '<div class="note-box" style="margin-top:12px">☐ หัก ณ ที่จ่าย &nbsp;&nbsp; ☐ ออกให้ตลอดไป &nbsp;&nbsp; ☐ ออกให้ครั้งเดียว</div>' +

    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้จ่ายเงิน / ผู้ออกหนังสือรับรอง</div><div class="sign-cap">(' + esc(c.issuedBy || '') + ')</div></div>' +
    '</div>' +

    docFooter() + '</div>'
  printDocument(html, { title: 'หนังสือรับรองหัก ณ ที่จ่าย ' + (c.certNo || '') })
}
