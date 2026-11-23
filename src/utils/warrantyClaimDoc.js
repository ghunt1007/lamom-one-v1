// (v1.0.1344) พิมพ์ใบสรุปเคลมรับประกัน (A4 หัวบริษัท) จากหน้า Warranty Claim — ใช้แนบส่งค่าย/เก็บเข้าแฟ้ม
// c = เอกสาร warranty_claims · laborRate = ค่าแรงต่อชั่วโมงที่หน้าใช้คิดมูลค่าเคลม
import { formatDate } from './format.js'
import { docHeader, docFooter, esc, printDocument } from './print.js'

const m0 = n => Math.round(Number(n) || 0).toLocaleString('th-TH')

export function warrantyClaimValue(c = {}, laborRate = 500) {
  return (Number(c.partCost) || 0) + Math.round((Number(c.laborHrs) || 0) * laborRate)
}

export function warrantyClaimHtml(c = {}, { laborRate = 500, statusLabel = '' } = {}) {
  const kv = (a, b) => '<tr><td class="lbl">' + a + '</td><td class="val">' + esc(b == null || b === '' || b === '—' ? '-' : b) + '</td></tr>'
  const labor = Math.round((Number(c.laborHrs) || 0) * laborRate)
  return '<div class="doc">' + docHeader('ใบสรุปการเคลมรับประกัน', '') +
    '<h3 class="sec">ข้อมูลรถ</h3><table class="kv"><tbody>' + kv('ทะเบียน', c.plate) + kv('รุ่น', c.model) + kv('เลขตัวถัง (VIN)', c.vin) +
      kv('ประเภทการรับประกัน', c.warrantyType) + '</tbody></table>' +
    '<h3 class="sec">รายละเอียดการเคลม</h3><table class="kv"><tbody>' + kv('วันที่ส่งเคลม', c.submitted ? formatDate(c.submitted) : '') +
      kv('สถานะ', statusLabel) + '</tbody></table>' +
    '<div class="note-box" style="white-space:pre-wrap">อาการ/ปัญหา: ' + esc(c.issue || '-') + '</div>' +
    '<table class="grid"><thead><tr><th>รายการเบิก</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead><tbody>' +
      '<tr><td>อะไหล่: ' + esc(c.parts && c.parts !== '—' ? c.parts : '-') + '</td><td class="num">' + m0(c.partCost) + '</td></tr>' +
      '<tr><td>ค่าแรง ' + esc(Number(c.laborHrs) || 0) + ' ชม. × ' + m0(laborRate) + '</td><td class="num">' + m0(labor) + '</td></tr>' +
      '<tr class="total-row"><td>รวมมูลค่าเคลม</td><td class="num">' + m0(warrantyClaimValue(c, laborRate)) + '</td></tr>' +
    '</tbody></table>' +
    '<div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้จัดทำ (ศูนย์บริการ)</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้อนุมัติ</div></div></div>' +
    docFooter() + '</div>'
}

export function printWarrantyClaim(c, opts) {
  printDocument(warrantyClaimHtml(c, opts), { title: esc('เคลมรับประกัน ' + (c?.plate || '')) })
}
