// เอกสารใบจอง / ใบถอนจอง — สร้าง HTML แล้วสั่งพิมพ์ผ่าน print.js
import { printDocument, docHeader, docFooter, money, bahtText, esc } from './print.js'
import { formatDate } from './format.js'

function kv(label, value) {
  return '<tr><td class="lbl">' + esc(label) + '</td><td class="val">' + esc(value == null || value === '' ? '-' : value) + '</td></tr>'
}

function sec(t) { return '<h3 class="sec">' + esc(t) + '</h3>' }

function approvalCell(role) {
  return '<td style="vertical-align:top;height:36mm;padding:8px">' +
    '<div style="font-size:11px;color:#64748b;text-decoration:underline;margin-bottom:4px">ความเห็น</div>' +
    '<div style="border-bottom:1px dotted #cbd5e1;height:8mm"></div>' +
    '<div style="border-bottom:1px dotted #cbd5e1;height:8mm;margin-bottom:6px"></div>' +
    '<div style="font-size:11px;color:#64748b">ลงชื่อ...........................................</div>' +
    '<div style="text-align:center;font-size:11px;color:#64748b;margin-top:2px">(' + esc(role) + ')</div>' +
  '</td>'
}

// ── ใบจองรถ ───────────────────────────────────────────────
export function printBooking(b) {
  if (!b) return
  const isCash = b.finStatus === 'ซื้อสด' || b.financeCo === 'ซื้อสด'
  const car = [b.brand, b.model, b.variant].filter(Boolean).join(' ')

  const html =
    '<div class="doc">' +
    docHeader('ใบจองรถยนต์ / Booking', b.bookingNo, formatDate(b.bookingDate)) +

    sec('👤 ข้อมูลผู้จอง') +
    '<table class="kv"><tbody>' +
      kv('ชื่อ-นามสกุล', b.custName) +
      kv('เลขบัตรประชาชน', b.nid) +
      kv('โทรศัพท์', b.phone) +
      kv('ที่อยู่', [b.address, b.province].filter(Boolean).join(' ')) +
      kv('แหล่งที่มา', b.source) +
    '</tbody></table>' +

    sec('🚗 รายละเอียดรถยนต์') +
    '<table class="kv"><tbody>' +
      kv('ยี่ห้อ / รุ่น', car) +
      kv('สีภายนอก / ภายใน', (b.colorOut || '-') + ' / ' + (b.colorIn || '-')) +
      kv('เลขตัวถัง (VIN)', b.vin) +
      kv('เลขมอเตอร์', b.motorNo) +
      kv('เลขแบตเตอรี่', b.batNo) +
      (b.engineNo ? kv('เลขเครื่องยนต์', b.engineNo) : '') +
      (b.redPlate || b.whitePlate ? kv('ป้ายแดง / ป้ายขาว', (b.redPlate || '-') + ' / ' + (b.whitePlate || '-')) : '') +
    '</tbody></table>' +

    sec('💰 เงื่อนไขการชำระเงิน') +
    '<table class="grid"><tbody>' +
      '<tr><td>ราคารถ</td><td class="num">' + money(b.price) + ' บาท</td></tr>' +
      '<tr><td>เงินจอง / เงินดาวน์</td><td class="num">' + money(b.down) + ' บาท</td></tr>' +
      (isCash
        ? '<tr><td>วิธีชำระ</td><td class="num">ซื้อเงินสด</td></tr>'
        : '<tr><td>บริษัทไฟแนนซ์ / สถานะ</td><td class="num">' + esc(b.financeCo || '-') + ' · ' + esc(b.finStatus || '-') + '</td></tr>' +
          '<tr><td>ยอดจัดไฟแนนซ์</td><td class="num">' + money(b.financeAmount) + ' บาท</td></tr>' +
          '<tr><td>จำนวนงวด / ดอกเบี้ย</td><td class="num">' + (b.installments || 0) + ' งวด · ' + (b.interestRate || 0) + '% ต่อปี</td></tr>' +
          '<tr><td>ค่างวดต่อเดือน</td><td class="num">' + money(b.monthly) + ' บาท</td></tr>') +
      '<tr><td>แคมเปญ / โปรโมชั่น</td><td class="num">' + esc(b.campaign || '-') + '</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">ราคารถ (ตัวอักษร): ' + esc(bahtText(b.price)) + '</div>' +

    sec('📅 กำหนดการ') +
    '<table class="kv"><tbody>' +
      kv('วันที่จอง', formatDate(b.bookingDate)) +
      kv('วันนัดส่งมอบ', formatDate(b.deliveryDate)) +
      kv('พนักงานขาย', b.salesName) +
    '</tbody></table>' +
    (b.notes ? '<div class="note-box">📝 หมายเหตุ: ' + esc(b.notes) + '</div>' : '') +

    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้จอง</div><div class="sign-cap">(' + esc(b.custName || '..............................') + ')</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">พนักงานขาย</div><div class="sign-cap">(' + esc(b.salesName || '..............................') + ')</div></div>' +
    '</div>' +

    docFooter() +
    '</div>'

  printDocument(html, { title: 'ใบจอง ' + (b.bookingNo || '') })
}

// ── ใบถอนจอง / ยกเลิกการจอง ──────────────────────────────
export function printCancellation(b, info = {}) {
  if (!b) return
  const car = [b.brand, b.model, b.variant].filter(Boolean).join(' ')
  const refund = info.refund != null ? info.refund : (b.down || 0)

  const html =
    '<div class="doc">' +
    '<div class="watermark">ถอนจอง</div>' +
    docHeader('ใบถอนจอง / ยกเลิกการจอง', b.bookingNo, formatDate(b.bookingDate), { cancelled: true }) +

    '<p style="font-size:13px;color:#334155;margin:8px 0 4px">' +
      'ตามที่ <b>' + esc(b.custName || '-') + '</b> ได้ทำการจองรถยนต์ <b>' + esc(car) + '</b> ' +
      'ตามใบจองเลขที่ <b>' + esc(b.bookingNo || '-') + '</b> ลงวันที่ ' + formatDate(b.bookingDate) + ' นั้น ' +
      'บัดนี้ผู้จองมีความประสงค์ขอ<b>ยกเลิก/ถอนการจอง</b>ดังกล่าว โดยมีรายละเอียดดังนี้' +
    '</p>' +

    sec('👤 ข้อมูลผู้จอง') +
    '<table class="kv"><tbody>' +
      kv('ชื่อ-นามสกุล', b.custName) +
      kv('เลขบัตรประชาชน', b.nid) +
      kv('โทรศัพท์', b.phone) +
    '</tbody></table>' +

    sec('🚗 รถที่ถอนจอง') +
    '<table class="kv"><tbody>' +
      kv('ยี่ห้อ / รุ่น', car) +
      kv('สีภายนอก / ภายใน', (b.colorOut || '-') + ' / ' + (b.colorIn || '-')) +
      kv('เลขตัวถัง (VIN)', b.vin) +
    '</tbody></table>' +

    sec('💸 การคืนเงิน') +
    '<table class="grid"><tbody>' +
      '<tr><td>เงินจอง/ดาวน์ที่ชำระไว้</td><td class="num">' + money(b.down) + ' บาท</td></tr>' +
      (info.deduct ? '<tr><td>หักค่าดำเนินการ</td><td class="num">- ' + money(info.deduct) + ' บาท</td></tr>' : '') +
      '<tr class="total-row"><td>ยอดเงินคืนสุทธิ</td><td class="num">' + money(refund - (info.deduct || 0)) + ' บาท</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">ยอดเงินคืน (ตัวอักษร): ' + esc(bahtText(refund - (info.deduct || 0))) + '</div>' +

    sec('📝 เหตุผลในการถอนจอง') +
    '<div class="note-box" style="min-height:38px">' + esc(info.reason || b.cancelReason || b.notes || '-') + '</div>' +

    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ถอนจอง</div><div class="sign-cap">(' + esc(b.custName || '..............................') + ')</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ที่ปรึกษาการขาย</div><div class="sign-cap">(' + esc(b.salesName || '..............................') + ')</div></div>' +
    '</div>' +

    sec('✅ การอนุมัติ') +
    '<table class="grid" style="table-layout:fixed"><tbody><tr>' +
      approvalCell('เจ้าหน้าที่การเงิน') +
      approvalCell('ผู้จัดการฝ่ายขาย') +
      approvalCell('ผู้อนุมัติ') +
    '</tr></tbody></table>' +

    '<div class="note-box" style="font-size:11px;color:#64748b;margin-top:10px">' +
      '<b>หมายเหตุ:</b> บริษัทฯ จะรับเรื่องไว้เพื่อพิจารณา และขอสงวนสิทธิ์ในการคืนเงินมัดจำ ' +
      'หากตรวจสอบแล้วพบว่าไม่มีเหตุอันควร หรือข้อมูล/เอกสารอ้างอิงประกอบการพิจารณาไม่ถูกต้องครบถ้วน' +
    '</div>' +

    docFooter() +
    '</div>'

  printDocument(html, { title: 'ใบถอนจอง ' + (b.bookingNo || '') })
}
