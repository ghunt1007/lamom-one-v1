// (v1.0.1339) พิมพ์ใบรับรถ/ใบสั่งงานซ่อม (A4 หัวบริษัท) จากหน้าใบงานศูนย์บริการ — เดิมไม่มีปุ่มพิมพ์เลย
// มีช่องเซ็นลูกค้า (ส่งรถ) / พนักงานรับรถ / ลูกค้ารับรถคืน · j = เอกสาร job_cards
import { carLabel } from './carLabel.js'
import { formatDate } from './format.js'
import { docHeader, docFooter, esc, printDocument } from './print.js'

const m0 = n => Math.round(Number(n) || 0).toLocaleString('th-TH')

export function jobCardHtml(j = {}, { typeLabel = '', statusLabel = '' } = {}) {
  const car = carLabel(j.brand, j.model) || '-'
  const kv = (a, b) => '<tr><td class="lbl">' + a + '</td><td class="val">' + esc(b == null || b === '' ? '-' : b) + '</td></tr>'
  const parts = (j.parts || []).filter(Boolean)
  const strip = s => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim()
  return '<div class="doc">' + docHeader('ใบรับรถ / ใบสั่งงานซ่อม', j.jobNo || '') +
    '<h3 class="sec">ข้อมูลลูกค้าและรถ</h3><table class="kv"><tbody>' +
      kv('ลูกค้า', j.custName) + kv('โทร', j.phone) + kv('รถ', car) + kv('ทะเบียน', j.plate) + kv('เลขตัวถัง (VIN)', j.vin) +
      kv('เลขไมล์', j.mileage ? m0(j.mileage) + ' กม.' : '') + kv('วันที่รับรถ', j.createdAt ? formatDate(j.createdAt) : '') +
    '</tbody></table>' +
    '<h3 class="sec">งานที่สั่ง</h3><table class="kv"><tbody>' +
      kv('ประเภทงาน', strip(typeLabel) || j.type) + kv('สถานะ', strip(statusLabel)) + kv('ช่างผู้รับผิดชอบ', j.techName) + kv('เบย์', j.bay) +
    '</tbody></table>' +
    '<div class="note-box" style="white-space:pre-wrap;min-height:60px">' + esc(j.desc || '-') + '</div>' +
    '<table class="grid"><thead><tr><th>อะไหล่ / ค่าบริการ</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead><tbody>' +
      parts.map(p => '<tr><td>' + esc(p) + '</td><td class="num"></td></tr>').join('') +
      '<tr><td>ค่าแรง</td><td class="num">' + m0(j.labor) + '</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">* ค่าอะไหล่จะแจ้งให้ลูกค้าทราบและยืนยันก่อนดำเนินการ · กรุณานำทรัพย์สินมีค่าออกจากรถ</div>' +
    '<div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ลูกค้า (ผู้ส่งรถ)</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">พนักงานรับรถ</div></div></div>' +
    '<div class="sign-row" style="margin-top:24px"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ลูกค้า (รับรถคืน) วันที่ ____/____/______</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ช่าง / QC</div></div></div>' +
    docFooter() + '</div>'
}

export function printJobCard(j, labels) {
  printDocument(jobCardHtml(j, labels), { title: esc('ใบสั่งงาน ' + (j?.jobNo || '')) })
}
