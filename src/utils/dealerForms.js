import { carOf } from './carLabel.js'
// (2026-11-02) แบบฟอร์มเอกสารขายรถ ตามตัวอย่างจริงของโชว์รูม (DEEPAL / CHANGAN บางบัวทอง)
// ทุกแผ่นดึงข้อมูลจากใบจอง + bookings.sale (utils/saleDoc.js) และข้อมูลบริษัทจาก org_companies
import { printDocument, money, bahtText, esc } from './print.js'
import { saleOf, saleTotals, addrLine, thaiDateParts, JOB_ORDER_ROWS, DELIVERY_CHECKS, WITHDRAW_MODELS } from './saleDoc.js'

const CSS = `
  .doc { padding:12mm 13mm; font-size:13.5px; }
  .co { display:flex; gap:14px; align-items:center; border-bottom:1.5px solid #333; padding-bottom:8px; margin-bottom:10px; }
  .co img { max-height:22mm; max-width:40mm; object-fit:contain; }
  .co .logo-txt { font-size:26px; letter-spacing:3px; color:#475569; font-weight:300; min-width:36mm; text-align:center; }
  .co-name { font-size:17px; font-weight:800; }
  .co-meta { font-size:12px; color:#222; }
  .ttl { text-align:center; font-size:19px; font-weight:800; margin:8px 0 10px; }
  .ttl.u { text-decoration:underline; }
  .row { display:flex; flex-wrap:wrap; align-items:flex-end; gap:4px 8px; margin:7px 0; line-height:1.5; }
  .lb { white-space:nowrap; font-weight:600; }
  .f { display:inline-block; border-bottom:1px solid #444; min-width:22mm; padding:0 4px; text-align:center; color:#1d4ed8; flex:1 1 auto; }
  .f.l { text-align:left; } .f.r { text-align:right; }
  .band { background:#e8f1fb; text-align:center; font-weight:800; padding:3px; margin:10px 0 4px; }
  table.t { width:100%; border-collapse:collapse; margin:6px 0; }
  table.t th, table.t td { border:1px solid #333; padding:4px 6px; font-size:12.5px; height:7.5mm; }
  table.t th { background:#f3f4f6; font-weight:800; text-align:center; }
  table.t td.n { text-align:right; color:#1d4ed8; } table.t td.c { text-align:center; }
  .sig { display:flex; justify-content:space-between; gap:12px; margin-top:26px; flex-wrap:wrap; }
  .sig > div { flex:1 1 40%; text-align:center; font-size:12.5px; }
  .sig .ln { border-bottom:1px dotted #333; height:12mm; margin-bottom:4px; }
  .stamp { color:#e11d48; font-size:30px; font-weight:800; }
  .small { font-size:11.5px; } .muted { color:#555; }
  .box { border:1px solid #333; padding:8px 10px; }
  .cb { display:inline-block; width:5mm; height:5mm; border:1.5px solid #333; margin-right:8px; text-align:center; line-height:5mm; font-weight:800; }
  .page-break { page-break-after:always; break-after:page; }
  /* แผ่นที่ข้อมูลแน่น (Job Order / สัญญา / ใบส่งมอบ) — บีบให้จบใน A4 แผ่นเดียวเหมือนต้นฉบับ */
  .doc.dense { padding:8mm 11mm; font-size:12px; }
  .dense .co { padding-bottom:4px; margin-bottom:4px; } .dense .co img { max-height:16mm; }
  .dense .co .logo-txt { font-size:21px; } .dense .co-name { font-size:15px; } .dense .co-meta { font-size:11px; }
  .dense .ttl { font-size:16px; margin:3px 0 4px; } .dense .stamp { font-size:22px; }
  .dense .row { margin:2px 0; line-height:1.35; gap:2px 6px; }
  .dense .band { margin:4px 0 2px; padding:1px; }
  .dense table.t { margin:3px 0; } .dense table.t th, .dense table.t td { padding:1px 5px; font-size:11.5px; height:5.6mm; }
  .dense .sig { margin-top:6px; } .dense .sig > div { font-size:11.5px; } .dense .sig .ln { height:8mm; margin-bottom:2px; }
  .dense p { margin:3px 0 !important; line-height:1.45 !important; }
`

const f = (v, w = 30, cls = '') => `<span class="f ${cls}" style="min-width:${w}mm">${esc(v == null || v === '' ? '' : v)}</span>`
const n = v => (v === '' || v == null || Number(v) === 0 ? '-' : money(v))
const nOrBlank = v => (v === '' || v == null ? '' : (isNaN(Number(String(v).replace(/,/g, ''))) ? esc(v) : money(String(v).replace(/,/g, ''))))
const car = b => carOf(b)
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

// ข้อมูลโชว์รูมตามตัวอย่างเอกสารจริงที่คุณกอล์ฟส่งมา (ข้อมูลบริษัท ไม่ใช่ข้อมูลลูกค้า)
// ใช้เมื่อใบจองยังไม่ได้ผูกบริษัท หรือบริษัทที่ผูกยังไม่ได้กรอกช่องนั้น — แก้ทับได้ที่ ระบบ › บริษัทในเครือ
export const SHOWROOM_DEFAULT = {
  name: 'บริษัท เอส.เค.ออโต้ กรุ๊ป จำกัด',
  address: '63/8 หมู่ที่ 13 ต.บางบัวทอง อ.บางบัวทอง จ.นนทบุรี 11110',
  phone: '02-147-4888', taxId: '0125566041271', branchLabel: 'สำนักงานใหญ่',
  brand: 'DEEPAL', logoUrl: '/forms/deepal-logo.png', groupLogoUrl: '/forms/sk-logo.png', slogan: 'Bangbuathong',
  bankName: 'ธนาคารไทยพาณิชย์', bankAccount: '284-248-163-4', bankAccountName: 'บริษัท เอส.เค. ออโต้ กรุ๊ป จำกัด',
  signerName: 'คุณสมโชค โกฎมณี', signerTitle: 'กรรมการบริษัท',
}

export function companyOf(co = {}) {
  // บริษัทอื่น (ชื่อไม่ตรงโชว์รูม) ใช้ข้อมูลของตัวเองล้วน ไม่เอาบัญชี/ผู้ลงนามของโชว์รูมไปปน
  const own = co?.name && !/เอส\.?\s*เค\.?\s*ออโต้/.test(co.name)
  const d = own ? {} : SHOWROOM_DEFAULT
  const v = k => (co?.[k] || d[k] || '')
  return {
    name: v('name') || 'บริษัท ............................................ จำกัด',
    address: v('address'), phone: v('phone'), taxId: v('taxId'), branch: v('branchLabel') || 'สำนักงานใหญ่',
    logoUrl: v('logoUrl'), groupLogoUrl: v('groupLogoUrl'), brandText: v('brand'), slogan: v('slogan'),
    bankName: v('bankName'), bankAccount: v('bankAccount'), bankAccountName: v('bankAccountName') || v('name'),
    signerName: v('signerName'), signerTitle: v('signerTitle') || 'กรรมการบริษัท',
  }
}

function header(c, right = '') {
  return `<div class="co">
    ${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : `<div class="logo-txt">${esc(c.brandText || '')}</div>`}
    <div style="flex:1">
      <div class="co-name">${esc(c.name)}</div>
      <div class="co-meta">${esc(c.address)}${c.phone ? ` TEL. ${esc(c.phone)}` : ''}</div>
      <div class="co-meta">${c.taxId ? `เลขประจำตัวผู้เสียภาษีอากร ${esc(c.taxId)} /${esc(c.branch)}` : ''}</div>
    </div>${right}</div>`
}
const carNoBox = s => `<div style="text-align:right"><span class="lb">คันที่</span> ${f(s.carNo, 18)}</div>`
const sig = (...labels) => `<div class="sig">${labels.map(([cap, name]) => `<div><div class="ln"></div>${name ? `(${esc(name)})<br>` : '(..............................................)<br>'}${esc(cap)}</div>`).join('')}</div>`
const doc = (inner, breakAfter, dense) => `<div class="doc${dense ? ' dense' : ''}${breakAfter ? ' page-break' : ''}">${inner}</div>`
const print = (html, title) => printDocument(html, { title, extraCss: CSS })

// ── 1. Job Order / Check List สำหรับการออกรถยนต์ใหม่ (ใบสั่งแต่ง) ──
export function jobOrderHtml(b, co) {
  const s = saleOf(b), t = saleTotals(b, s), c = companyOf(co), a = s.addr
  const rows = [...s.items, ...Array.from({ length: Math.max(0, JOB_ORDER_ROWS - s.items.length) }, () => ({}))]
  // แบบจริง: โลโก้กลุ่ม (SK) ซ้าย · ชื่อบริษัทกลาง · โลโก้แบรนด์ขวา
  const head = c.groupLogoUrl
    ? `<div class="co" style="justify-content:space-between">
        <img src="${esc(c.groupLogoUrl)}" alt="" style="max-height:15mm">
        <div style="flex:1;text-align:center" class="co-meta">${esc(c.name)} เลขประจำตัวผู้เสียภาษีอากร ${esc(c.taxId)}<br>${esc(c.address)}${c.phone ? ` TEL. ${esc(c.phone)}` : ''}</div>
        ${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="" style="max-height:15mm">` : ''}</div>${carNoBox(s)}`
    : header(c, carNoBox(s))
  return doc(`${head}
    <div class="ttl" style="color:#1e3a8a">Job Order / Check List สำหรับการออกรถยนต์ใหม่</div>
    <div class="row"><span class="lb">พนักงานขาย</span>${f(b.salesName, 60)}<span class="lb">วันที่</span>${f(thaiDateParts(today()).long, 40)}</div>
    <div class="band">ข้อมูลลูกค้า</div>
    <div class="row"><span class="lb">ชื่อลูกค้า</span>${f(b.custName, 60)}<span class="lb">โทรศัพท์</span>${f(b.phone, 30)}</div>
    <div class="row"><span class="lb">เลขบัตรปชช.</span>${f(b.nid, 40)}<span class="lb">ลูกค้านัดรับรถ</span>${f(thaiDateParts(b.deliveryDate).short, 30)}</div>
    <div class="row"><span class="lb">ที่อยู่ตามบัตรปชช.</span>${f(a.houseNo, 18)}<span class="lb">หมู่</span>${f(a.moo, 12)}<span class="lb">ซอย</span>${f(a.soi || '-', 22)}<span class="lb">ถนน</span>${f(a.road || '-', 22)}</div>
    <div class="row"><span class="lb">แขวง/ตำบล</span>${f(a.subdistrict, 28)}<span class="lb">เขต/อำเภอ</span>${f(a.district, 28)}<span class="lb">จังหวัด</span>${f(a.province, 28)}</div>
    <div class="band">ข้อมูลรถยนต์ ${esc(b.brand || '')}</div>
    <div class="row"><span class="lb">รถยนต์</span>${f(b.brand, 30)}<span class="lb">รุ่น</span>${f(b.model, 28)}<span class="lb">แบบ</span>${f(b.variant, 28)}<span class="lb">สี</span>${f(b.colorOut, 16)}<span class="lb">ภายใน</span>${f(b.colorIn, 14)}</div>
    <div class="row"><span class="lb">ราคารถยนต์</span>${f(t.price ? money(t.price) : '', 28)}<span class="lb">ปีรถ</span>${f(s.year, 16)}<span class="lb">รหัส VIN</span>${f(b.vin, 45)}</div>
    <div class="row"><span class="lb">รหัสมอเตอร์</span>${f(b.motorNo, 55)}<span class="lb">รหัสเครื่องยนต์</span>${f(b.engineNo || '-', 40)}</div>
    <div class="band">รายละเอียดการเช่าซื้อ</div>
    ${t.cash ? `<div class="row"><span class="lb">ซื้อสด</span></div>` : `
    <div class="row"><span class="lb">ชื่อไฟแนนซ์</span>${f(b.financeCo, 55)}<span class="lb">อัตราดอกเบี้ย</span>${f(b.interestRate ? b.interestRate + '%' : '', 16)}<span class="lb">เงินดาวน์</span>${f(t.downPct ? t.downPct + '%' : '', 12)}<span class="lb">เป็นจำนวน</span>${f(n(t.down), 24)}<span>บาท</span></div>
    <div class="row"><span class="lb">ยอดจัด</span>${f(n(t.financeAmount), 28)}<span>บาท</span><span class="lb">จำนวนงวด</span>${f(b.installments, 14)}<span>งวด</span><span class="lb">ผ่อนงวดละ</span>${f(n(b.monthly), 22)}<span>บาท</span><span class="lb">จำนวน</span>${f(b.installments ? Math.round(b.installments / 12 * 10) / 10 : '', 10)}<span>ปี</span></div>`}
    <div style="font-weight:800;text-decoration:underline;margin-top:8px">Purchase Order</div>
    <table class="t"><thead><tr><th style="width:10mm">No.</th><th>รายละเอียดของแถม+ตกแต่งเพิ่มเติม</th><th style="width:27mm">ราคาทุนไม่รวม VAT</th><th style="width:24mm">ราคารวม VAT</th><th style="width:24mm">ราคาขายรวม VAT</th><th style="width:20mm">ผู้ตรวจสอบ</th></tr></thead><tbody>
      ${rows.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${esc(it.name || '')}${it.detail ? `<span style="margin-left:14mm">${esc(it.detail)}</span>` : ''}</td><td class="n">${nOrBlank(it.cost)}</td><td class="n">${it.campaign && !it.giftValue ? 'แคมเปญ' : nOrBlank(it.giftValue)}</td><td class="n">${nOrBlank(it.salePrice)}</td><td></td></tr>`).join('')}
      <tr><td colspan="2" style="text-align:right;font-weight:800">รวมรายการของแต่ง</td><td></td><td class="n">${t.giftUsed ? money(t.giftUsed) : ''}</td><td class="n">${t.itemsSale ? money(t.itemsSale) : ''}</td><td></td></tr>
      <tr><td colspan="2" style="text-align:right;font-weight:800">วงเงินของแถม</td><td class="n">${t.giftBudget ? money(t.giftBudget) : ''}</td><td></td><td></td><td></td></tr>
    </tbody></table>
    <div class="row"><span class="lb" style="text-decoration:underline">หมายเหตุ</span>${f(s.note, 120, 'l')}</div>
    ${sig(['พนักงานขาย', b.salesName], ['ผจก.ฝ่ายขาย'], ['ลูกค้าสัมพันธ์'], ['ฝ่ายตกแต่ง'])}`, false, true)
}
export const printJobOrder = (b, co) => print(jobOrderHtml(b, co), 'Job Order ' + (b.bookingNo || ''))

// ── 2. หนังสือสัญญาซื้อ-ขายรถยนต์ (ต้นฉบับ + สำเนา) ──
function contractPage(b, co, stamp, breakAfter) {
  const s = saleOf(b), t = saleTotals(b, s), c = companyOf(co), a = s.addr
  const d = thaiDateParts(b.deliveryDate || today())
  const dateRow = `<div class="row" style="justify-content:flex-end"><span class="lb">วันที่</span>${f(d.d, 10)}<span class="lb">เดือน</span>${f(d.m, 26)}<span class="lb">พ.ศ.</span>${f(d.y, 16)}</div>`
  return doc(`${header(c, `<div style="text-align:center"><div><span class="lb" style="color:#1d4ed8">คันที่</span> ${f(s.carNo, 18)}</div><div class="stamp">${stamp}</div></div>`)}
    ${c.slogan ? `<div class="small muted" style="margin-left:2mm">${esc(c.slogan)}</div>` : ''}
    <div class="ttl">หนังสือสัญญาซื้อ-ขายรถยนต์</div>
    <div class="row" style="justify-content:flex-end"><span class="lb">เขียนที่</span>${f(c.name, 60)}</div>
    ${dateRow}
    <div class="row"><span>ข้าพเจ้า ${esc(c.name)} ตกลงขายรถยนต์</span>${f(b.brand, 34)}<span class="lb">รุ่น</span>${f(b.model, 24)}<span class="lb">แบบ</span>${f(b.variant, 24)}</div>
    <div class="row"><span class="lb">ปี</span>${f(s.year, 16)}<span class="lb">สี</span>${f(b.colorOut, 18)}<span class="lb">ภายใน</span>${f(b.colorIn, 18)}<span class="lb">ให้แก่</span>${f(b.custName, 60)}</div>
    <div class="row"><span class="lb">อยู่บ้านเลขที่</span>${f(a.houseNo, 22)}<span class="lb">หมู่</span>${f(a.moo, 12)}<span class="lb">ซอย</span>${f(a.soi || '-', 24)}<span class="lb">ถนน</span>${f(a.road || '-', 22)}<span class="lb">แขวง/ตำบล</span>${f(a.subdistrict, 26)}</div>
    <div class="row"><span class="lb">เขต/อำเภอ</span>${f(a.district, 26)}<span class="lb">จังหวัด</span>${f(a.province, 22)}<span class="lb">โทรศัพท์ที่บ้าน</span>${f(s.phoneHome || b.phone, 26)}<span class="lb">โทรศัพท์มือถือ</span>${f(b.phone, 26)}</div>
    <div class="row"><span class="lb">เป็นจำนวนเงิน</span>${f(t.price ? money(t.price) : '', 40)}<span>บาท</span>${f(t.price ? '( ' + bahtText(t.price) + ' )' : '', 80)}</div>
    <div class="row"><span>ข้าพเจ้าได้รับเงินมัดจำไว้เป็นจำนวนเงิน</span>${f(t.deposit ? money(t.deposit) : '', 30)}<span>บาท</span>${f(t.deposit ? '( ' + bahtText(t.deposit) + ' )' : '', 70)}</div>
    <div class="row"><span>ผู้ซื้อยังคงค้างอีกเป็นเงิน</span>${f(t.balance ? money(t.balance) : '', 34)}<span>บาท</span>${f(t.balance > 0 ? '( ' + bahtText(t.balance) + ' )' : '', 70)}</div>
    <div class="row"><span>ผู้ซื้อจะนำเงินมาชำระให้ครบจำนวนตามที่ตกลงภายใน วันที่</span>${f(d.d, 10)}<span class="lb">เดือน</span>${f(d.m, 26)}<span class="lb">พ.ศ.</span>${f(d.y, 16)}</div>
    <p style="line-height:1.9;margin:6px 0">หากผู้ซื้อไม่นำเงินมาชำระให้ตามกำหนด ผู้ซื้อยินยอมให้ริบเงินมัดจำ และ คืนรถให้ทันทีในสภาพที่เรียบร้อยทุกประการ ถ้าหากเกิดความเสียหายใดๆ ก็ดี ผู้ซื้อยินยอมชดใช้ให้ทั้งสิ้นตลอดทั้งคดีแพ่งและคดีอาญาส่วนผู้ขายเมื่อได้รับเงินครบถ้วนตามสัญญาแล้วผู้ขายจะทำการ โอนกรรมสิทธิ์ รถคันนี้ให้แก่ผู้ซื้อทันที อากรแสตมป์ซื้อ-ขาย จะได้คิดให้ครบถ้วนเมื่อวันทำการ โอนทะเบียนยานพาหนะ ผู้ซื้อ และ ผู้ขาย ได้อ่านข้อความ เข้าใจดีแล้ว และตกลงกันทั้งสองฝ่าย จึงได้ลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน</p>
    ${sig(['ผู้ซื้อ', b.custName], ['ผู้ขาย', b.salesName])}
    ${sig(['พยาน'], ['พยาน'])}
    ${dateRow}
    <div class="row"><span class="lb">ข้าพเจ้าผู้ซื้อ</span>${f(b.custName, 55)}<span class="lb">ได้รับรถยนต์</span>${f(b.brand, 30)}<span class="lb">รุ่น</span>${f(b.variant || b.model, 30)}</div>
    <div class="row"><span class="lb">รหัส VIN</span>${f(b.vin, 50)}<span class="lb">รหัสมอเตอร์</span>${f(b.motorNo, 45)}<span class="lb">รหัสเครื่องยนต์</span>${f(b.engineNo || '-', 30)}</div>
    <p style="margin:4px 0">ไปแล้วอยู่ในสภาพพอใจ ทุกประการ ถ้าหากเกิดการเสียหายใดๆ ก็ดี ผู้ซื้อยินยอมชดใช้ให้ทั้งสิ้นตลอดจนคดีแพ่งและคดีอาญาใดๆ</p>
    ${sig(['ผู้ซื้อ', b.custName], ['ผู้รับเงิน'])}
    ${sig(['พยาน'], ['พยาน'])}
    <div class="sig" style="justify-content:center;margin-top:8px"><div style="flex:0 1 45%"><div class="ln"></div>ผู้อนุมัติ</div></div>
    <div class="row"><span class="lb">หมายเหตุ :</span>${f(s.note, 150, 'l')}</div>
    <div class="band" style="border:1px solid #333;background:#e5e7eb">รายละเอียดการเช่าซื้อ</div>
    ${t.cash ? '<div class="row">ซื้อสด</div>' : `
    <div class="row"><span class="lb">ชื่อไฟแนนซ์</span>${f(b.financeCo, 55)}<span class="lb">ดอกเบี้ย</span>${f(b.interestRate ? b.interestRate + '%' : '', 18)}<span class="lb">เงินดาวน์</span>${f(t.downPct ? t.downPct + '%' : '', 12)}<span class="lb">จำนวน</span>${f(n(t.down) + ' ฿', 28)}</div>
    <div class="row"><span class="lb">ยอดจัด</span>${f(n(t.financeAmount) + ' ฿', 32)}<span class="lb">ผ่อนงวดละ</span>${f(n(b.monthly) + ' ฿', 26)}<span class="lb">จำนวนงวด</span>${f(b.installments, 12)}<span>งวด</span></div>`}
    <div style="text-align:center;font-weight:800;margin-top:8px">(อากรแสตมป์ในการซื้อ-ขายจะติดเมื่อไปทำการโอนกรรมสิทธิ์ในครั้งเดียว)</div>`, breakAfter, true)
}
export const contractHtml = (b, co) => contractPage(b, co, 'ต้นฉบับ', true) + contractPage(b, co, 'สำเนา', false)
export const printContract = (b, co) => print(contractHtml(b, co), 'สัญญาซื้อขาย ' + (b.bookingNo || ''))

// ── 3. เอกสารแนบท้ายหนังสือสัญญาซื้อ-ขาย (รายละเอียดแจ้งการชำระเงิน) ──
export function contractAttachmentHtml(b, co) {
  const s = saleOf(b), t = saleTotals(b, s), c = companyOf(co)
  const line = (label, v, opts = {}) => `<tr><td style="border:none;${opts.red ? 'color:#e11d48' : ''}${opts.bold ? ';font-weight:800' : ''}">${label}</td><td style="border:none">${opts.mid || ''}</td><td class="n" style="border:none;border-bottom:${opts.dbl ? '3px double' : '1px solid'} #333;background:#eef6fb;width:45mm${opts.bold ? ';font-weight:800;color:#111' : ''}">${v}</td><td style="border:none;width:12mm">บาท</td></tr>`
  const sold = s.items.filter(it => Number(String(it.salePrice).replace(/,/g, '')) > 0)
  return doc(`<div style="text-align:right;font-size:16px"><b>คันที่</b> ${f(s.carNo, 20)}</div>
    <div class="ttl u">เอกสารแนบท้ายหนังสือสัญญาซื้อ-ขาย</div>
    <div class="row"><span class="lb">ชื่อลูกค้า</span>${f(b.custName, 120)}</div>
    <div class="box" style="margin-top:10px;padding:0">
      <div style="display:flex;align-items:center;border-bottom:1px solid #333;padding:8px">
        <div style="width:40mm;text-align:center">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" style="max-height:20mm;max-width:38mm">` : `<span class="logo-txt" style="font-size:22px;color:#475569;letter-spacing:3px">${esc(c.brandText)}</span>`}</div>
        <div style="flex:1"><div style="text-align:center;font-weight:800">รายละเอียดแจ้งการชำระเงิน</div>
          <div class="row"><span class="lb">รุ่น</span>${f(b.brand, 30)}${f(b.variant || b.model, 30)}</div>
          <div class="row"><span class="lb">สี</span>${f(b.colorOut, 30)}<span class="lb">ภายใน</span>${f(b.colorIn, 24)}</div></div>
      </div>
      <table class="t" style="margin:8px 0;border:none"><tbody>
        ${line('ราคารถ', n(t.price))}
        ${line('หัก ส่วนลด Cash Back', n(s.cashBack), { red: true })}
        ${line('รวมราคารถ', n(t.carPrice), { dbl: true })}
        ${t.cash ? '' : line(`เงินดาวน์ ${t.downPct ? t.downPct + '%' : ''}`, n(t.down))}
        ${line('ค่าจดทะเบียน', n(s.regFee))}
        ${line('มัดจำป้ายแดง (ได้คืน)', n(s.redPlateDeposit), { mid: esc(b.redPlate || '') })}
        ${line('ค่าจัดส่ง', n(s.deliveryFee))}
        ${sold.map(it => line(esc(it.name), n(it.salePrice))).join('')}
        ${line('ยอดรวม', n(t.gross), { bold: true, dbl: true })}
        ${line('หัก ส่วนลดบริษัท', t.discounts ? '(' + money(t.discounts) + ')' : '-', { red: true })}
        ${line('หัก เงินจอง', t.deposit ? '(' + money(t.deposit) + ')' : '-', { red: true })}
        ${line('ยอดคงเหลือ ณ วันรับรถ', n(t.balance), { bold: true, dbl: true })}
      </tbody></table>
    </div>
    <div class="row" style="margin-top:16px"><span class="lb">ชำระโดย</span>${f('', 150)}</div>
    <div class="row" style="margin-top:14px"><span class="lb">ผู้รับเงิน</span>${f('', 70)}<span class="lb">ผู้อนุมัติ</span>${f('', 60)}</div>`)
}
export const printContractAttachment = (b, co) => print(contractAttachmentHtml(b, co), 'แนบท้ายสัญญา ' + (b.bookingNo || ''))

// ── 4. รายการแจ้งค่าใช้จ่าย ──
export function expenseNoticeHtml(b, co) {
  const s = saleOf(b), t = saleTotals(b, s), c = companyOf(co)
  const lines = [
    [`รถยนต์ <b style="margin-left:10mm">${esc(b.brand || '')}</b> &nbsp; รุ่น <b>${esc(b.model || '')}</b> <b style="margin-left:10mm">${t.cash ? 'ราคารถ' : 'เงินดาวน์'}</b>`, t.cash ? n(t.carPrice) : n(t.down), t.cash ? '' : `ผ่อนเดือนละ <b style="color:#1d4ed8">฿ ${n(b.monthly)}</b> จำนวน <b style="color:#1d4ed8">${esc(b.installments || '')}</b> งวด`],
    ['มัดจำป้ายแดง', n(s.redPlateDeposit), ''],
    [esc(s.insuranceText || 'ประกันภัยชั้น 1 และ พรบ.'), 'แถม', '<span style="color:#16a34a">เลขแจ้งประกัน :</span>'],
    ['ค่าจดทะเบียน', n(s.regFee), ''],
    ['หักส่วนลด', n(s.discount), ''],
    ['หักเงินจองรถ', n(t.deposit), ''],
    ['หักส่วนลดบริษัท', n(s.activityDiscount), ''],
    ...s.items.filter(it => it.name && !/ประกันภัย|พรบ|ค่าจดทะเบียน/.test(it.name) && (it.salePrice !== '' || it.giftValue !== '' || it.campaign))
      .map(it => [esc(it.name + (it.detail ? ' ' + it.detail : '')), Number(it.salePrice) ? n(it.salePrice) : (Number(it.giftValue) || it.campaign ? 'แถม' : '-'), '']),
  ]
  while (lines.length < 12) lines.push(['', '-', ''])
  return doc(`${header(c, '<div class="small muted" style="align-self:flex-start">version dp.1</div>')}
    <div class="ttl">รายการแจ้งค่าใช้จ่าย</div>
    <div class="row" style="justify-content:flex-end"><span class="lb">วันที่</span>${f(thaiDateParts(today()).short, 40)}</div>
    <div class="row"><span class="lb">ชื่อคุณ</span>${f(b.custName, 40)}<span class="lb">จองวันที่</span>${f(thaiDateParts(b.bookingDate).short, 22)}<span class="lb">วันที่รับรถ</span>${f(thaiDateParts(b.deliveryDate).short, 22)}<span class="lb">เบอร์โทร</span>${f(b.phone, 22)}</div>
    <div class="row"><span class="lb">รถยนต์</span>${f(b.brand, 18)}<span class="lb">รุ่น</span>${f(b.model, 16)}<span class="lb">แบบ</span>${f(b.variant, 18)}<span class="lb">สี</span>${f(b.colorOut, 12)}<span class="lb">ภายใน</span>${f(b.colorIn, 12)}<span class="lb">ราคารถ</span>${f(t.price ? money(t.price) + '.00' : '', 24)}<span>บาท</span></div>
    <div class="row"><span class="lb">รหัส VIN</span>${f(b.vin, 45)}<span class="lb">รหัสมอเตอร์</span>${f(b.motorNo, 45)}<span class="lb">รหัสเครื่องยนต์</span>${f(b.engineNo || '-', 18)}<span class="lb">เลขที่ใบจอง</span>${f(b.bookingNo, 28)}</div>
    <table class="t"><thead><tr><th style="width:12mm">ลำดับ</th><th>รายการ</th><th style="width:32mm">ราคา รวมVat</th><th style="width:62mm">หมายเหตุ</th></tr></thead><tbody>
      ${lines.map(([l, v, note], i) => `<tr><td class="c">${i + 1}</td><td>${l}</td><td class="n" style="color:#111">${v}</td><td>${note}</td></tr>`).join('')}
      <tr><td></td><td style="text-align:right;font-weight:800">รวม</td><td class="n" style="font-weight:800;color:#111">${n(t.balance)}</td><td></td></tr>
    </tbody></table>
    <div class="row" style="margin-top:12px"><span class="lb">สรุปรายการค่าใช้จ่ายในการซื้อรถยนต์</span>${f(b.brand, 30)}<span class="lb">สี</span>${f(b.colorOut, 16)}<span class="lb">ภายใน</span>${f(b.colorIn, 14)}<span class="lb">จำนวนเงิน</span><span class="f r" style="min-width:40mm;font-size:20px;font-weight:800;color:#111;background:#eef6fb">${n(t.balance)}</span><span>บาท</span></div>
    <div class="row"><span class="lb">สำหรับการจ่ายเงินค่ารถยนต์</span><span>1</span><span class="lb">โอนเงิน</span>${f(c.bankName, 36)}<span class="lb">เลขที่บัญชี</span>${f(c.bankAccount, 32)}<span class="lb">ชื่อบัญชี</span>${f(c.bankAccountName, 40)}</div>
    <div class="row" style="margin-left:46mm"><span>2</span><span class="lb">สั่งจ่ายเป็น แคชเชียร์เช็ค</span><span class="lb">ในนาม</span>${f(c.name, 70)}</div>
    <div style="margin-left:60mm" class="small"><u>หมายเหตุ</u> 1 &nbsp; ไม่แนะนำการซื้อเช็ควันเสาร์-อาทิตย์<br><span style="margin-left:15mm">2 &nbsp; ในการซื้อเช็ค รบกวนถ่ายรูปส่งให้เซล ก่อนวันรับรถอย่างน้อย 1 วัน</span></div>
    <div style="text-align:right;margin-top:30px"><div style="display:inline-block;text-align:center;min-width:70mm"><div style="color:#1d4ed8;border-bottom:1px solid #333;padding-bottom:2px">${esc(b.salesName || '')}</div>ที่ปรึกษาการขาย ${esc(c.brandText)}</div></div>`)
}
export const printExpenseNotice = (b, co) => print(expenseNoticeHtml(b, co), 'แจ้งค่าใช้จ่าย ' + (b.bookingNo || ''))

// ── 5. ใบส่งมอบรถยนต์ ──
export function deliveryNoteHtml(b, co) {
  const s = saleOf(b), c = companyOf(co), a = s.addr
  const d = thaiDateParts(b.actualDeliveryDate || b.deliveryDate || today())
  return doc(`${header(c)}
    <div class="ttl" style="background:#e8f1fb">ใบส่งมอบรถยนต์</div>
    <div style="text-align:right;font-weight:800">คันที่${esc(s.carNo || '........')}</div>
    <div class="row"><span class="lb">ข้าพเจ้า</span>${f(b.custName, 55)}<span class="lb">ที่อยู่</span>${f(a.houseNo, 14)}<span class="lb">หมู่</span>${f(a.moo, 10)}<span class="lb">ซอย</span>${f(a.soi || '-', 24)}<span class="lb">ถนน</span>${f(a.road || '-', 20)}</div>
    <div class="row"><span class="lb">แขวง/ตำบล</span>${f(a.subdistrict, 40)}<span class="lb">เขต/อำเภอ</span>${f(a.district, 30)}<span class="lb">จังหวัด</span>${f(a.province, 30)}</div>
    <div class="row"><span class="lb">เบอร์โทรศัพท์</span>${f(b.phone, 40)}<span class="lb">เลขบัตรประชาชน</span>${f(String(b.nid || '').replace(/\D/g, ''), 40)}<span>ได้รับรถยนต์ไปจาก${esc(c.name)}</span></div>
    <div class="row"><span class="lb">รถยนต์</span>${f(b.brand, 24)}<span class="lb">รุ่นรถ</span>${f(b.model, 26)}<span class="lb">สี</span>${f(b.colorOut, 28)}<span class="lb">ภายใน</span>${f(b.colorIn, 22)}<span class="lb">เลขทะเบียน</span>${f(b.whitePlate || 'ป้ายแดง', 16)}</div>
    <div class="row">ในสภาพที่เรียบร้อยทุกประการพร้อมตรวจสอบการ ส่งมอบรถใหม่ด้วยรายละเอียดข้างล่าง</div>
    <div class="row"><span class="lb">ตั้งแต่วันที่</span>${f(d.d, 14)}<span class="lb">เดือน</span>${f(d.m, 28)}<span class="lb">พ.ศ.</span>${f(d.y, 22)}<span class="lb">ประกันภัยที่แจ้ง</span>${f(s.insuranceText, 60)}</div>
    <div class="row" style="background:#e8f1fb;padding:4px"><span class="lb">รุ่นรถยนต์</span>${f(car(b), 30)}<span class="lb">หมายเลขตัวถัง</span>${f(b.vin, 40)}<span class="lb">รหัสมอเตอร์</span>${f(b.motorNo, 40)}<span class="lb">รหัสเครื่องยนต์</span>${f(b.engineNo || '-', 20)}</div>
    <table class="t"><thead><tr><th style="width:12mm">ลำดับ</th><th style="width:34mm">รายการตรวจสอบ</th><th>เกณฑ์การตัดสิน</th><th style="width:11mm">ผ่าน</th><th style="width:13mm">ไม่ผ่าน</th><th style="width:24mm">หมายเหตุ</th></tr></thead><tbody>
      ${DELIVERY_CHECKS.map(([k, v], i) => `<tr><td class="c">${i + 1}</td><td class="c">${k}</td><td>${v}</td><td></td><td></td><td></td></tr>`).join('')}
      <tr><td colspan="6" style="height:7mm"></td></tr>
    </tbody></table>
    <p style="line-height:1.8">นับแต่ข้าพเจ้ารับรถไปแล้วข้าพเจ้าจะเป็นผู้รับผิดชอบรถคันดังกล่าวดังระบุข้างต้นทุกประการทั้งทางคดีแพ่ง หรือ คดีอาญา อันอาจเกิดขึ้นโดยเจตนาหรือมิได้เจตนา ทั้งที่เกิดจากตัวข้าพเจ้าเอง หรือบุคคลอื่นๆ โดยข้าพเจ้ารับรู้หรือมิได้รับรู้</p>
    ${sig(['ผู้รับรถยนต์', b.custName], ['ผู้ส่งมอบรถยนต์', b.salesName])}
    <div class="sig"><div style="text-align:left">หมายเหตุ<div class="ln" style="height:8mm"></div><div class="ln" style="height:8mm"></div></div><div><div class="ln"></div>(..............................................)<br>ผู้อนุมัติปล่อยรถ</div></div>
    <div style="text-align:right;color:#e11d48;font-size:11.5px;margin-top:10px">**โปรดตรวจสอบความเรียบร้อยของรถก่อนเซ็นรับรถยนต์**</div>
    <div style="border:1px dashed #999;height:22mm;margin-top:10px;display:flex;align-items:center;justify-content:center;color:#aaa">พื้นที่ลอกลายเลขตัวถัง</div>`, false, true)
}
export const printDeliveryNote = (b, co) => print(deliveryNoteHtml(b, co), 'ใบส่งมอบ ' + (b.bookingNo || ''))

// ── 6. เอกสารแจ้งความประสงค์การแจ้งทะเบียนรถใหม่ ──
export function registrationIntentHtml(b, co) {
  const s = saleOf(b), t = saleTotals(b, s), c = companyOf(co)
  const box = on => `<span class="cb">${on ? '✓' : ''}</span>`
  const opt = (on, label) => `<div style="margin:9px 0 9px 16mm;display:flex;align-items:center">${box(on)}${label}</div>`
  return doc(`<div style="font-size:19px;font-weight:800">เอกสารแจ้งความประสงค์การแจ้งทะเบียนรถใหม่</div>
    <div style="font-weight:800;margin:6px 0">เรื่องการจดทะเบียนรถใหม่</div>
    <div class="row"><span class="lb">ชื่อ-นามสกุลผู้เช่าซื้อ</span>${f(b.custName, 60)}<span class="lb">เบอร์โทร</span>${f(b.phone, 30)}<span class="lb">วันที่</span>${f(thaiDateParts(today()).short, 24)}</div>
    <div class="row"><span class="lb">ยี่ห้อ${esc(b.brand || '')} รุ่นรถ</span>${f([b.model, b.variant].filter(Boolean).join(' '), 60)}<span class="lb">สี</span>${f([b.colorOut, b.colorIn && 'ใน' + b.colorIn].filter(Boolean).join(' '), 30)}</div>
    <div class="row"><span class="lb">หมายเลขตัวถัง</span>${f(b.vin, 60)}<span class="lb">หมายเลขเครื่อง</span>${f(b.motorNo || b.engineNo, 60)}</div>
    ${opt(t.cash, 'ซื้อสด')}${opt(!t.cash, 'ซื้อไฟแนนซ์')}${opt(s.insuranceConsent, 'ยินยอมเผยข้อมูลในการแจ้งประกันรถยนต์')}
    <div style="font-weight:800">รายการจดทะเบียน</div>
    ${opt(s.regOption === 'now', 'จดทะเบียนเลย')}
    ${opt(s.regOption === 'lot', 'ขอเลขจากขนส่ง(ทางอินเตอร์เน็ตและแจ้งผลให้บริษัทฯทราบทันที)')}
    <div class="row" style="margin-left:26mm"><span>อื่นๆระบุ</span>${f(s.regOption === 'other' ? s.regOther : '', 90, 'l')}</div>
    <p>ในกรณีลูกค้ามีความประสงค์ล็อคเลขต้องล็อคเลขภายใน 15 วัน นับจากวันรับรถ ทางแผนกทะเบียนขออนุญาตจดรันเลขตามปกติ</p>
    ${opt(s.regOption === 'self', 'ขอชุดจดทะเบียน เนื่องจากลูกค้านำชุดไปจดเอง')}
    <p><b>****หมายเหตุ</b> กรณีนำชุดจดเอง และยินยอมวางเงินมัดจำชุดจดทะเบียน จำนวน 10,000 บาท</p>
    <p style="line-height:1.9">กรณีลูกค้า มาแจ้งความประสงค์ขอเอกสารจดใหม่เนื่องจากชำรุด-หรือเอกสารสูญหาย จะต้องเสียค่าใช้จ่ายเองทั้งหมด ตามนโยบาย-และกระบวนการทางกฎหมายที่กำหนดของ บริษัทฯเท่านั้น</p>
    <p style="line-height:1.9">****หมายเหตุกรณีลูกค้าจดทะเบียน-นำเลขสงวนมาใส่เป็นป้ายกราฟฟิค เนื่องจากขณะนี้ทางขนส่งได้แจ้งว่าป้ายกราฟฟิค ต้องรอวัสดุในการทำป้ายแบบไม่มีกำหนด จึงมีข้อกำหนดในการขอคัดป้ายขาวชั่วคราวให้ลูกค้าเซ็นต์รับทราบว่าลูกค้าจะทำการคัดป้ายขาว</p>
    <div class="row" style="margin-top:14px"><span class="lb">ลงชื่ออนุญาตคัดป้ายขาว</span>${f('', 70)}</div>
    <div style="text-align:center;margin:26px 0 0 60mm"><div class="ln" style="border-bottom:1px solid #333;height:12mm"></div>${esc(c.signerName || '..............................................')}<br>${esc(c.signerTitle)}</div>
    <div class="row" style="margin-top:22px"><span class="lb">ลงชื่อลูกค้ารับทราบ</span>${f('', 70)}<span class="lb">พนักงานขาย</span>${f(b.salesName, 60)}</div>`)
}
export const printRegistrationIntent = (b, co) => print(registrationIntentHtml(b, co), 'แจ้งจดทะเบียน ' + (b.bookingNo || ''))

// ── 7. ใบรายการจ่ายค่าคอมมิชชั่น (ภายใน) ──
export function commissionSheetHtml(b, co) {
  const s = saleOf(b), t = saleTotals(b, s)
  const left = [
    ['ราคารถ', n(t.price), ''], ['หัก ส่วนลด แคมเปญ', n(s.cashBack), ''], ['หัก ส่วนลดกิจกรรม', '', ''], ['ราคารถ', n(t.carPrice), ''],
    [t.cash ? 'ชำระเต็มจำนวน' : 'เงินดาวน์', n(t.cash ? t.carPrice : t.down), ''], ['ค่าจดทะเบียน', s.regFee ? money(s.regFee) : '', ''], ['มัดจำป้ายแดง', s.redPlateDeposit ? money(s.redPlateDeposit) : '', ''],
    ...s.items.filter(it => it.name && !/^ค่าจดทะเบียน$/.test(it.name) && (it.salePrice !== '' || it.giftValue !== '' || it.campaign))
      .map(it => [esc(it.name + (it.detail ? ` (${it.detail})` : '')), nOrBlank(it.salePrice), it.campaign && !it.giftValue ? 'แคมเปญ' : nOrBlank(it.giftValue)]),
    ...s.items.filter(it => /^ค่าจดทะเบียน$/.test(it.name) && it.giftValue !== '').map(it => ['ค่าจดทะเบียน (แถม)', '', nOrBlank(it.giftValue)]),
  ]
  while (left.length < 15) left.push(['', '', ''])
  const tail = [['ยอดรวม', n(t.gross)], ['หัก ส่วนลด แคมเปญ', n(s.discount)], ['หัก ส่วนลดกิจกรรม', n(s.activityDiscount)], ['หัก จ่ายเงินจองเพิ่ม', ''], ['หักเงินจอง', n(t.deposit)], ['ยอดคงเหลือ ณ วันรับรถ', n(t.balance)]]
  const right = [['มาจิ้นฝ่ายขาย<br>รายคัน', n(t.giftBudget)], ['ยอดที่ใช้ไป', n(t.giftUsed)], ['ยอดคงเหลือ', n(t.giftLeft)], ['ค่าคอม ไฟแนนซ์', n(t.financeCommission)], ['ค่าคอมของแต่ง', s.accessoryCommission ? money(s.accessoryCommission) : '']]
  return doc(`<div class="ttl" style="margin-top:14mm">ใบรายการจ่ายค่าคอมมิชชั่น</div>
    <div class="row"><span class="lb">ชื่อพนักงานขาย</span>${f(b.salesName, 55)}<span class="lb">วันที่</span>${f(thaiDateParts(today()).short, 36)}<span class="lb">คันที่</span>${f(s.carNo, 24)}</div>
    <div class="row"><span class="lb">ชื่อลูกค้า</span>${f(b.custName, 45)}<span class="lb">เลขถัง</span>${f(b.vin, 45)}<span class="lb">ลูกค้านัดรับรถ</span>${f(thaiDateParts(b.deliveryDate).short, 28)}</div>
    <div class="row"><span class="lb">รถยนต์</span>${f(b.brand, 20)}<span class="lb">รุ่น</span>${f(b.model, 22)}<span class="lb">แบบ</span>${f(b.variant, 30)}<span class="lb">สี</span>${f(b.colorOut, 14)}<span class="lb">ภายใน</span>${f(b.colorIn, 14)}</div>
    <div style="display:flex;gap:6px;align-items:flex-start;margin-top:8px">
      <table class="t" style="flex:0 0 58%"><thead><tr><th style="text-align:left">รายละเอียด</th><th style="width:26mm">รายการขาย</th><th style="width:26mm">รายการแถม</th></tr></thead><tbody>
        ${left.map(([a, x, y]) => `<tr><td>${a}</td><td class="n" style="color:#111">${x}</td><td class="n" style="color:#111">${y}</td></tr>`).join('')}
        ${tail.map(([a, x], i) => `<tr><td style="${i === 0 || i === tail.length - 1 ? 'font-weight:800' : ''}">${a}</td><td class="n" style="color:#111">${x}</td><td></td></tr>`).join('')}
      </tbody></table>
      <table class="t" style="flex:1"><thead><tr><th colspan="2" style="text-align:left">รายการคอมมิชชั่น</th></tr></thead><tbody>
        ${right.map(([a, x]) => `<tr><td>${a}</td><td class="n" style="color:#111;width:30mm">${x}</td></tr>`).join('')}
        <tr><td style="height:60mm" colspan="2"></td></tr>
        <tr><td style="font-weight:800">ยอดรวมสุทธิที่ได้</td><td class="n" style="font-weight:800;color:#111">${n(t.netCommission)}</td></tr>
      </tbody></table>
    </div>
    ${sig(['พนักงานขาย', b.salesName], ['ผู้จัดทำ'], ['ผู้ตรวจสอบ'])}`)
}
export const printCommissionSheet = (b, co) => print(commissionSheetHtml(b, co), 'ค่าคอม ' + (b.bookingNo || ''))

// ── 8. ใบคำขอยกเลิกการสั่งจองรถยนต์ ──
export function withdrawRequestHtml(b, co, info = {}) {
  const s = saleOf(b), t = saleTotals(b, s)
  const model = carOf(b).toUpperCase()
  const hit = WITHDRAW_MODELS.find(m => model.includes(m.split(' ').pop()))
  const box = on => `<span class="cb">${on ? '✓' : ''}</span>`
  const approve = (role, wide) => `<td style="vertical-align:top;padding:8px 12px;${wide ? '' : 'width:50%'}" ${wide ? 'colspan="2"' : ''}><u>ความเห็น</u><div class="ln" style="border-bottom:1px dotted #333;height:9mm"></div>${wide ? '' : '<div class="ln" style="border-bottom:1px dotted #333;height:9mm"></div>'}<div style="text-align:center;margin-top:12px">ลงชื่อ.............................................${wide ? role : ''}</div>${wide ? '' : `<div style="text-align:center">(${role})</div>`}</td>`
  const dep = t.deposit
  return doc(`<div class="ttl u" style="margin-top:6mm">ใบคำขอยกเลิกการสั่งจองรถยนต์</div>
    <div class="row" style="justify-content:flex-end"><span class="lb">วันที่</span>${f(thaiDateParts(info.date || today()).long, 50)}</div>
    <div class="row"><span>ข้าพเจ้า นาย / นาง / นางสาว</span>${f(b.custName, 120, 'l')}</div>
    <div class="row"><span>ใบสั่งจองรถยนต์ เล่มที่</span>${f(info.bookNo || '', 34)}<span>เลขที่</span>${f(b.bookingNo, 34)}<span>วันที่</span>${f(thaiDateParts(b.bookingDate).long, 44)}</div>
    <div class="row"><span>สถานที่ติดต่อ</span>${f(addrLine(s) || b.address, 150, 'l')}</div>
    <div class="row"><span>โทรศัพท์ (บ้าน)</span>${f(s.phoneHome, 34)}<span>(ที่ทำงาน)</span>${f('', 30)}<span>(มือถือ)</span>${f(b.phone, 40)}</div>
    <div class="row"><span style="margin-right:6mm">รถยนต์ รุ่นที่สั่งจอง</span>${WITHDRAW_MODELS.map(m => `<span style="margin-right:6mm">${box(hit === m)}${m}</span>`).join('')}</div>
    <div class="row" style="margin-left:42mm">${box(!hit)}<span>รุ่นอื่น</span>${f(!hit ? carOf(b) : '', 60, 'l')}</div>
    <div class="row"><span>แบบรุ่นที่จอง</span>${f(b.variant, 50)}<span>สีที่จอง</span>${f(b.colorOut, 40)}</div>
    <div class="row"><span>โดยได้ชำระเงินมัดจำไว้ จำนวน</span>${f(dep ? money(dep) : '', 34)}<span>บาท (</span>${f(dep ? bahtText(dep) : '', 80)}<span>)</span></div>
    <div class="row"><span>มีความประสงค์ที่จะยกเลิกสัญญาจองรถยนต์ดังกล่าว และขอเงินที่ชำระมัดจำไว้คืน เนื่องจาก</span>${f(info.reason || b.cancelReason || '', 150, 'l')}</div>
    ${sig(['ผู้สั่งจอง', b.custName], ['ที่ปรึกษาการขาย', b.salesName])}
    <table class="t" style="margin-top:14px"><tbody>
      <tr>${approve('เจ้าหน้าที่ไฟแนนซ์')}${approve('ผู้จัดการฝ่ายขาย')}</tr>
      <tr>${approve('ผู้อนุมัติ', true)}</tr>
    </tbody></table>
    <p style="margin-top:10px"><u>หมายเหตุ</u> &nbsp; บริษัทฯ จะรับไว้เพื่อพิจารณาและขอสงวนสิทธ์การคืนเงินมัดจำหากตรวจสอบแล้วพบว่า ไม่มีสาเหตุอันควร หรือข้อมูลที่ให้มา ไม่ถูกต้อง หรือเอกสารอ้างอิงประกอบการพิจารณาไม่ครบถ้วน</p>
    <div class="row" style="justify-content:center;margin-top:20px"><span>ลูกค้าสัมพันธ์</span>${f('', 50)}<span>ตรวจสอบภายใน</span>${f('', 50)}</div>`)
}
export const printWithdrawRequest = (b, co, info) => print(withdrawRequestHtml(b, co, info), 'ใบขอยกเลิกจอง ' + (b.bookingNo || ''))
