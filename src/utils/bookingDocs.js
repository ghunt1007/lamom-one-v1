// เอกสารใบจอง / ใบถอนจอง — สร้าง HTML แล้วสั่งพิมพ์ผ่าน print.js
import { printDocument, docHeader, docFooter, money, bahtText, esc, getOrgInfo } from './print.js'
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
      '<tr><td>เงินจอง</td><td class="num">' + money(b.bookingDeposit || 0) + ' บาท</td></tr>' +
      '<tr><td>เงินดาวน์</td><td class="num">' + money(b.down) + ' บาท</td></tr>' +
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
  const refund = info.refund != null ? info.refund : (Number(b.bookingDeposit) || Number(b.down) || 0)

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
      '<tr><td>เงินจอง/ดาวน์ที่ชำระไว้</td><td class="num">' + money(refund) + ' บาท</td></tr>' +
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

// ── (2026-11-02) เอกสารเพิ่ม: ใบสั่งแต่ง / สัญญาจะซื้อจะขาย / ใบขอจดทะเบียน ──
// ดึงข้อมูลจากใบจองให้อัตโนมัติ ช่องที่ยังไม่มีข้อมูลเว้นเป็นเส้นให้เขียนมือ
// หน้าตาเป็นแบบร่างก่อน — เมื่อได้แบบฟอร์มจริงของบริษัท จะปรับให้ตรงแบบ
const blank = (v, w = 40) => (v == null || v === '' ? '<span style="display:inline-block;min-width:' + w + 'mm;border-bottom:1px dotted #94a3b8">&nbsp;</span>' : esc(v))
const carName = b => [b.brand, b.model, b.variant].filter(Boolean).join(' ')
function signRow(left, leftName, right, rightName) {
  return '<div class="sign-row">' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">' + esc(left) + '</div><div class="sign-cap">(' + esc(leftName || '..............................') + ')</div></div>' +
    '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">' + esc(right) + '</div><div class="sign-cap">(' + esc(rightName || '..............................') + ')</div></div>' +
  '</div>'
}

// ใบสั่งแต่ง (อุปกรณ์ตกแต่ง/ของแถม) — แถว F&I ที่ขาย + ช่องว่างให้เขียนเพิ่ม
export function printAccessoryOrder(b) {
  if (!b) return
  const items = (b.fiItems || []).filter(x => x.sold && (x.type === 'accessory' || x.type === 'warranty'))
    .map(x => ({ name: (x.type === 'warranty' ? 'รับประกันเพิ่ม' : 'อุปกรณ์ตกแต่ง') + (x.provider ? ' – ' + x.provider : ''), price: x.price }))
  const rows = items.concat(Array.from({ length: Math.max(0, 10 - items.length) }, () => ({ name: '', price: '' })))
  const total = items.reduce((s, x) => s + (Number(x.price) || 0), 0)
  const html = '<div class="doc">' +
    docHeader('ใบสั่งแต่งรถยนต์', b.bookingNo, '') +
    sec('ข้อมูลลูกค้าและรถ') +
    '<table class="kv"><tbody>' +
      kv('ชื่อลูกค้า', b.custName) + kv('โทรศัพท์', b.phone) +
      kv('รุ่นรถ / สี', carName(b) + (b.colorOut ? ' · ' + b.colorOut : '')) +
      kv('เลขตัวถัง (VIN)', b.vin) + kv('วันนัดส่งมอบ', formatDate(b.deliveryDate)) +
    '</tbody></table>' +
    sec('รายการแต่ง') +
    '<table class="grid"><thead><tr><th style="width:10mm">#</th><th>รายการ</th><th style="width:22mm">แถม / ขาย</th><th style="width:30mm">ราคา (บาท)</th></tr></thead><tbody>' +
      rows.map((r, i) => '<tr style="height:8mm"><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + (r.name ? (Number(r.price) ? 'ขาย' : 'แถม') : '') + '</td><td class="num">' + (r.price !== '' ? money(r.price) : '') + '</td></tr>').join('') +
      '<tr class="total-row"><td colspan="3">รวม</td><td class="num">' + (total ? money(total) : '') + '</td></tr>' +
    '</tbody></table>' +
    signRow('ผู้สั่งแต่ง (พนักงานขาย)', b.salesName, 'ผู้รับงาน (ช่างแต่ง)', '') +
    docFooter() + '</div>'
  printDocument(html, { title: 'ใบสั่งแต่ง ' + (b.bookingNo || '') })
}

// สัญญาจะซื้อจะขายรถยนต์
export function printSaleContract(b) {
  if (!b) return
  const org = getOrgInfo()
  const isCash = b.finStatus === 'ซื้อสด' || b.financeCo === 'ซื้อสด'
  const html = '<div class="doc">' +
    docHeader('สัญญาจะซื้อจะขายรถยนต์', b.bookingNo, '') +
    '<p style="font-size:13px;line-height:1.9;margin:6px 0">สัญญานี้ทำขึ้นระหว่าง <b>' + esc(org.name) + '</b> ซึ่งต่อไปเรียกว่า "ผู้จะขาย" กับ <b>' + blank(b.custName, 60) + '</b> ' +
      'เลขบัตรประชาชน ' + blank(b.nid, 45) + ' ที่อยู่ ' + blank([b.address, b.province].filter(Boolean).join(' '), 90) + ' โทร ' + blank(b.phone, 30) + ' ซึ่งต่อไปเรียกว่า "ผู้จะซื้อ" ทั้งสองฝ่ายตกลงกันดังนี้</p>' +
    '<p style="font-size:13px;line-height:1.9;margin:6px 0"><b>ข้อ 1.</b> ผู้จะขายตกลงจะขายและผู้จะซื้อตกลงจะซื้อรถยนต์ ' + blank(carName(b), 60) + ' สี ' + blank(b.colorOut, 25) + ' เลขตัวถัง ' + blank(b.vin, 50) + ' เลขมอเตอร์ ' + blank(b.motorNo || b.engineNo, 40) + '</p>' +
    '<p style="font-size:13px;line-height:1.9;margin:6px 0"><b>ข้อ 2.</b> ราคารถ ' + blank(b.price ? money(b.price) : '', 30) + ' บาท (' + esc(b.price ? bahtText(b.price) : '...........................................') + ') ผู้จะซื้อได้ชำระเงินจอง ' + blank(b.bookingDeposit ? money(b.bookingDeposit) : '', 25) + ' บาท และจะชำระเงินดาวน์ ' + blank(b.down ? money(b.down) : '', 25) + ' บาท ' +
      (isCash ? 'ส่วนที่เหลือชำระเป็นเงินสดในวันรับรถ' : 'ส่วนที่เหลือชำระผ่านสถาบันการเงิน ' + blank(b.financeCo, 30) + ' ยอดจัด ' + blank(b.financeAmount ? money(b.financeAmount) : '', 25) + ' บาท ' + blank(b.installments, 10) + ' งวด') + '</p>' +
    '<p style="font-size:13px;line-height:1.9;margin:6px 0"><b>ข้อ 3.</b> ผู้จะขายจะส่งมอบรถภายในวันที่ ' + blank(b.deliveryDate ? formatDate(b.deliveryDate) : '', 35) + ' หรือตามที่ตกลงกันภายหลัง</p>' +
    '<p style="font-size:13px;line-height:1.9;margin:6px 0"><b>ข้อ 4.</b> หากผู้จะซื้อยกเลิกการซื้อ หรือไม่ชำระเงินตามกำหนด ผู้จะขายมีสิทธิ์พิจารณาการคืนเงินจองตามเงื่อนไขของบริษัท</p>' +
    '<p style="font-size:13px;line-height:1.9;margin:6px 0"><b>ข้อ 5.</b> เงื่อนไขอื่นๆ ' + blank(b.campaign, 100) + '</p>' +
    '<p style="font-size:13px;margin:10px 0">ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้ดีแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐาน</p>' +
    signRow('ผู้จะซื้อ', b.custName, 'ผู้จะขาย', org.owner) +
    signRow('พยาน', b.salesName, 'พยาน', '') +
    docFooter() + '</div>'
  printDocument(html, { title: 'สัญญา ' + (b.bookingNo || '') })
}

// ใบขอจดทะเบียน (ข้อมูลสำหรับยื่นจดทะเบียนรถใหม่)
export function printRegistrationRequest(b) {
  if (!b) return
  const html = '<div class="doc">' +
    docHeader('ใบขอจดทะเบียนรถยนต์', b.bookingNo, '') +
    sec('ผู้ขอจดทะเบียน (เจ้าของรถ)') +
    '<table class="kv"><tbody>' +
      kv('ชื่อ-นามสกุล', b.custName) + kv('เลขบัตรประชาชน', b.nid) +
      kv('ที่อยู่ตามบัตร', [b.address, b.province].filter(Boolean).join(' ')) + kv('โทรศัพท์', b.phone) +
      kv('ผู้ครอบครอง (ไฟแนนซ์)', b.financeCo && b.financeCo !== 'ซื้อสด' ? b.financeCo : '') +
    '</tbody></table>' +
    sec('รายละเอียดรถ') +
    '<table class="kv"><tbody>' +
      kv('ยี่ห้อ / รุ่น', carName(b)) + kv('สี', b.colorOut) +
      kv('เลขตัวถัง (VIN)', b.vin) + kv('เลขมอเตอร์', b.motorNo || b.engineNo) + kv('เลขแบตเตอรี่', b.batNo) +
      kv('ป้ายแดง', b.redPlate) + kv('ทะเบียนที่ได้ (ป้ายขาว)', b.whitePlate) +
    '</tbody></table>' +
    sec('เอกสารที่ต้องใช้') +
    '<table class="grid"><tbody>' +
      ['สำเนาบัตรประชาชนเจ้าของรถ', 'สำเนาทะเบียนบ้าน', 'ใบกำกับภาษี / ใบเสร็จค่ารถ', 'หนังสือรับรองจากผู้ผลิต / แบบรับรอง', 'กรมธรรม์ พ.ร.บ.', 'หนังสือมอบอำนาจ (ถ้ามี)']
        .map(t => '<tr><td style="width:10mm">☐</td><td>' + t + '</td></tr>').join('') +
    '</tbody></table>' +
    signRow('เจ้าของรถ', b.custName, 'เจ้าหน้าที่ทะเบียน', '') +
    docFooter() + '</div>'
  printDocument(html, { title: 'ใบขอจดทะเบียน ' + (b.bookingNo || '') })
}
