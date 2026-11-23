// (v1.0.1341) พิมพ์ผลตรวจสภาพรถ (A4 หัวบริษัท) จากหน้า Vehicle Inspection — เดิมดู checklist ได้แค่บนจอ
// ins = เอกสาร vehicle_inspections · sections = [{ label, items: [{ text, status: pass|fail|na, note }] }]
import { formatDate } from './format.js'
import { docHeader, docFooter, esc, printDocument } from './print.js'

const MARK = { pass: '✔ ผ่าน', fail: '✘ ไม่ผ่าน', na: '—' }

export function inspectionHtml(ins = {}, sections = [], { typeLabel = '' } = {}) {
  const kv = (a, b) => '<tr><td class="lbl">' + a + '</td><td class="val">' + esc(b == null || b === '' ? '-' : b) + '</td></tr>'
  const all = sections.flatMap(s => s.items || [])
  const passN = all.filter(i => i.status === 'pass').length
  const failN = all.filter(i => i.status === 'fail').length
  const result = ins.overallResult === 'pass' ? 'ผ่าน' : ins.overallResult === 'fail' ? 'ไม่ผ่าน' : 'ยังไม่สรุปผล'
  const car = [ins.brand, ins.model].filter(Boolean).join(' ')
  return '<div class="doc">' + docHeader('ใบรายงานผลตรวจสภาพรถ', '') +
    '<table class="kv"><tbody>' + kv('ประเภทการตรวจ', typeLabel || ins.type) + kv('รถ', car) + kv('ทะเบียน', ins.vehiclePlate) + kv('VIN', ins.vin) +
      kv('เลขไมล์', Number(ins.mileage) > 0 ? Math.round(ins.mileage).toLocaleString('th-TH') + ' กม.' : '') + kv('ลูกค้า', ins.customerName) +
      kv('ช่างผู้ตรวจ', ins.techName) + kv('วันที่ตรวจ', ins.date ? formatDate(ins.date) : '') + '</tbody></table>' +
    sections.map(s => '<h3 class="sec">' + esc(s.label) + '</h3><table class="grid"><tbody>' +
      (s.items || []).map(i => '<tr><td>' + esc(i.text) + (i.status === 'fail' && i.note ? '<div style="color:#dc2626;font-size:11px">หมายเหตุ: ' + esc(i.note) + '</div>' : '') + '</td><td class="num" style="width:90px;' + (i.status === 'fail' ? 'color:#dc2626;font-weight:700' : '') + '">' + (MARK[i.status] || '—') + '</td></tr>').join('') +
      '</tbody></table>').join('') +
    '<table class="grid"><tbody><tr class="total-row"><td>สรุปผล: ' + result + '</td><td class="num">ผ่าน ' + passN + ' · ไม่ผ่าน ' + failN + ' · ไม่ได้ตรวจ ' + (all.length - passN - failN) + '</td></tr></tbody></table>' +
    (ins.notes ? '<div class="note-box" style="white-space:pre-wrap">หมายเหตุ: ' + esc(ins.notes) + '</div>' : '') +
    '<div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ช่างผู้ตรวจ' + (ins.techName ? ' (' + esc(ins.techName) + ')' : '') + '</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ลูกค้า / ผู้รับรถ</div></div></div>' +
    docFooter() + '</div>'
}

export function printInspection(ins, sections, labels) {
  printDocument(inspectionHtml(ins, sections, labels), { title: esc('ผลตรวจสภาพรถ ' + (ins?.vehiclePlate || '')) })
}
