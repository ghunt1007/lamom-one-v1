// (v1.0.1340) พิมพ์ใบประเมินราคาซ่อม (A4 หัวบริษัท) จากรายการ "ใบประเมินที่ส่งแล้ว" — เดิมดูได้แค่ยอดรวมบนจอ
// ใช้ตัวเลขที่บันทึกไว้ตอนออกใบ (ไม่คำนวณใหม่) · e = เอกสาร repair_estimates
import { formatDate } from './format.js'
import { docHeader, docFooter, esc, printDocument, bahtText } from './print.js'

const m0 = n => Math.round(Number(n) || 0).toLocaleString('th-TH')

export function repairEstimateHtml(e = {}) {
  const items = (e.items || []).filter(Boolean)
  const kv = (a, b) => '<tr><td class="lbl">' + a + '</td><td class="val">' + esc(b == null || b === '' ? '-' : b) + '</td></tr>'
  const sum = (label, amt, cls = '') => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td colspan="3" class="num">' + label + '</td><td class="num">' + amt + '</td></tr>'
  return '<div class="doc">' + docHeader('ใบประเมินราคาซ่อม', '') +
    '<table class="kv"><tbody>' + kv('ลูกค้า', e.customer) + kv('ทะเบียนรถ', e.plate) + kv('โทร', e.phone) +
      kv('วันที่ประเมิน', e.createdAt ? formatDate(e.createdAt) : '') + '</tbody></table>' +
    '<table class="grid"><thead><tr><th>รายการ</th><th class="num">จำนวน</th><th class="num">ราคา/หน่วย</th><th class="num">รวม (บาท)</th></tr></thead><tbody>' +
      items.map(i => '<tr><td>' + esc(i.name) + '</td><td class="num">' + (Number(i.qty) || 1) + '</td><td class="num">' + m0(i.price) + '</td><td class="num">' + m0((Number(i.price) || 0) * (Number(i.qty) || 1)) + '</td></tr>').join('') +
      sum('ค่าอะไหล่', m0(e.partsTotal)) +
      sum('ค่าแรง' + (e.laborHours ? ' (' + esc(e.laborHours) + ' ชม.)' : ''), m0(e.laborTotal)) +
      (Number(e.discountAmt) > 0 ? sum('ส่วนลด' + (e.discount ? ' ' + esc(e.discount) + '%' : ''), '-' + m0(e.discountAmt)) : '') +
      sum('VAT 7%', m0(e.vat)) +
      sum('รวมทั้งสิ้น', m0(e.grand), 'total-row') +
    '</tbody></table>' +
    '<div class="baht-text">(' + bahtText(e.grand) + ')</div>' +
    '<div class="note-box">ราคานี้เป็นการประเมินเบื้องต้น อาจเปลี่ยนแปลงได้หากพบความเสียหายเพิ่มเติมระหว่างซ่อม ศูนย์จะแจ้งและขอความยินยอมจากลูกค้าก่อนทุกครั้ง</div>' +
    '<div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ลูกค้า (อนุมัติให้ซ่อม)</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ประเมินราคา</div></div></div>' +
    docFooter() + '</div>'
}

export function printRepairEstimate(e) {
  printDocument(repairEstimateHtml(e), { title: esc('ใบประเมินราคาซ่อม ' + (e?.customer || '')) })
}
