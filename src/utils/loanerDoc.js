// (v1.0.1342) พิมพ์ใบยืมรถสำรอง (A4 หัวบริษัท) จากหน้า Loaner Car — ใช้ให้ลูกค้าเซ็นตอนรับรถและตอนคืนรถ
// l = เอกสาร loaner_loans
import { formatDate } from './format.js'
import { docHeader, docFooter, esc, printDocument } from './print.js'

const m0 = n => Math.round(Number(n) || 0).toLocaleString('th-TH')

export function loanerAgreementHtml(l = {}) {
  const kv = (a, b) => '<tr><td class="lbl">' + a + '</td><td class="val">' + esc(b == null || b === '' ? '-' : b) + '</td></tr>'
  const back = l.status === 'returned'
  return '<div class="doc">' + docHeader('ใบยืมรถสำรอง', l.jobCard ? 'อ้างอิงใบงาน ' + l.jobCard : '') +
    '<h3 class="sec">ผู้ยืม</h3><table class="kv"><tbody>' + kv('ชื่อ-นามสกุล', l.custName) + kv('โทร', l.phone) + '</tbody></table>' +
    '<h3 class="sec">รถสำรอง</h3><table class="kv"><tbody>' + kv('รุ่น', l.carModel) + kv('ทะเบียน', l.carPlate) +
      kv('วันที่ยืม', l.loanDate ? formatDate(l.loanDate) : '') + kv('กำหนดคืน', l.returnDate ? formatDate(l.returnDate) : '') +
      kv('เลขไมล์ตอนออก', l.kmOut != null && l.kmOut !== '' ? m0(l.kmOut) + ' กม.' : '') + kv('แบต/เชื้อเพลิงตอนออก', l.fuelOut != null ? l.fuelOut + '%' : '') +
      kv('เงินมัดจำ', Number(l.deposit) > 0 ? m0(l.deposit) + ' บาท' : 'ไม่มี') + '</tbody></table>' +
    '<h3 class="sec">ตอนคืนรถ</h3><table class="kv"><tbody>' +
      kv('วันที่คืนจริง', back && l.actualReturn ? formatDate(l.actualReturn) : '____/____/______') +
      kv('เลขไมล์ตอนคืน', back && l.kmIn != null ? m0(l.kmIn) + ' กม.' : '________________ กม.') +
      kv('แบต/เชื้อเพลิงตอนคืน', back && l.fuelIn != null ? l.fuelIn + '%' : '________ %') + '</tbody></table>' +
    '<div class="note-box">ผู้ยืมรับว่าได้รับรถในสภาพเรียบร้อย จะใช้รถด้วยความระมัดระวัง ไม่นำไปให้ผู้อื่นใช้ และจะคืนรถตามกำหนด ' +
      'หากเกิดความเสียหาย ค่าปรับจราจร หรือค่าทางด่วนระหว่างยืม ผู้ยืมยินดีรับผิดชอบตามจริง</div>' +
    '<div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ยืม (รับรถ)</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">พนักงานผู้ส่งมอบรถ</div></div></div>' +
    '<div class="sign-row" style="margin-top:24px"><div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ยืม (คืนรถ)</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">พนักงานผู้รับรถคืน</div></div></div>' +
    docFooter() + '</div>'
}

export function printLoanerAgreement(l) {
  printDocument(loanerAgreementHtml(l), { title: esc('ใบยืมรถสำรอง ' + (l?.custName || '')) })
}
