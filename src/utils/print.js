// Print utility — พิมพ์เอกสาร A4 ที่จัดรูปแบบสวยงาม (ใบจอง/ใบถอนจอง/สลิปเงินเดือน/สลิปคอมฯ)
// ใช้ hidden iframe เพื่อไม่ให้โดน popup blocker และไม่กระทบหน้าจอหลัก

const ORG = {
  name: 'LAMOM ONE',
  sub: 'ศูนย์รถยนต์พลังงานไฟฟ้าครบวงจร',
  owner: 'ทวีศักดิ์ สุขสมบัติเสถียร',
  addr: '',
  phone: '',
  taxId: '',
}

export function getOrgInfo() {
  // อ่านค่าทับจาก localStorage ได้ (ตั้งใน Settings ภายหลัง)
  try {
    const saved = JSON.parse(localStorage.getItem('lamom_org') || '{}')
    return { ...ORG, ...saved }
  } catch (e) { return { ...ORG } }
}

// แปลงเลขเป็นรูปแบบเงินบาท (ไม่มี symbol สำหรับเอกสาร)
export function money(n) {
  if (n == null || n === '') return '0'
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

// แปลงจำนวนเงินเป็นข้อความภาษาไทย (บาทถ้วน)
export function bahtText(num) {
  num = Number(num) || 0
  if (num === 0) return 'ศูนย์บาทถ้วน'
  const txtNum = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const txtPos = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']
  function readGroup(n) {
    let s = ''
    const str = String(n)
    const len = str.length
    for (let i = 0; i < len; i++) {
      const d = Number(str[i])
      const pos = len - i - 1
      if (d === 0) continue
      if (pos === 0 && d === 1 && len > 1) s += 'เอ็ด'
      else if (pos === 1 && d === 2) s += 'ยี่' + txtPos[pos]
      else if (pos === 1 && d === 1) s += txtPos[pos]
      else s += txtNum[d] + txtPos[pos]
    }
    return s
  }
  const baht = Math.floor(num)
  const satang = Math.round((num - baht) * 100)
  let result = ''
  const millions = Math.floor(baht / 1000000)
  const remainder = baht % 1000000
  if (millions > 0) result += readGroup(millions) + 'ล้าน'
  if (remainder > 0) result += readGroup(remainder)
  result += 'บาท'
  if (satang > 0) result += readGroup(satang) + 'สตางค์'
  else result += 'ถ้วน'
  return result
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Sarabun','TH Sarabun New','Tahoma',sans-serif; color:#111; margin:0; padding:0; font-size:13px; line-height:1.45; }
  .doc { width:210mm; min-height:297mm; padding:14mm 14mm 12mm; margin:0 auto; background:#fff; }
  .doc-head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1e293b; padding-bottom:10px; margin-bottom:14px; }
  .org-name { font-size:22px; font-weight:800; color:#1e293b; letter-spacing:.5px; }
  .org-sub { font-size:12px; color:#475569; }
  .org-meta { font-size:11px; color:#64748b; margin-top:2px; }
  .doc-title-box { text-align:right; }
  .doc-title { font-size:18px; font-weight:800; }
  .doc-no { font-size:12px; color:#475569; margin-top:2px; }
  .doc-date { font-size:12px; color:#475569; }
  h3.sec { font-size:13px; font-weight:700; color:#1e293b; background:#f1f5f9; padding:5px 8px; border-left:3px solid #1e293b; margin:12px 0 6px; }
  table.kv { width:100%; border-collapse:collapse; }
  table.kv td { padding:3px 6px; vertical-align:top; font-size:12.5px; }
  table.kv td.lbl { color:#64748b; width:130px; white-space:nowrap; }
  table.kv td.val { color:#111; font-weight:600; }
  table.grid { width:100%; border-collapse:collapse; margin:6px 0; }
  table.grid th, table.grid td { border:1px solid #cbd5e1; padding:6px 8px; font-size:12px; }
  table.grid th { background:#1e293b; color:#fff; font-weight:700; text-align:left; }
  table.grid td.num, table.grid th.num { text-align:right; }
  .total-row td { font-weight:800; background:#f1f5f9; }
  .baht-text { font-style:italic; color:#475569; font-size:12px; margin-top:4px; }
  .watermark { position:fixed; top:42%; left:50%; transform:translate(-50%,-50%) rotate(-22deg); font-size:90px; font-weight:900; color:rgba(220,38,38,.10); letter-spacing:8px; z-index:0; pointer-events:none; }
  .sign-row { display:flex; justify-content:space-around; margin-top:42px; }
  .sign-box { text-align:center; width:40%; }
  .sign-line { border-top:1px dotted #475569; margin-bottom:6px; padding-top:42px; }
  .sign-cap { font-size:12px; color:#475569; }
  .note-box { border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; font-size:12px; margin-top:8px; background:#fafafa; }
  .badge-cancel { display:inline-block; border:2px solid #dc2626; color:#dc2626; font-weight:800; padding:3px 12px; border-radius:6px; font-size:13px; }
  .foot { margin-top:18px; border-top:1px solid #e2e8f0; padding-top:6px; font-size:10.5px; color:#94a3b8; text-align:center; }
  @media print { @page { size:A4; margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .doc { box-shadow:none; } }
`

// printDocument(innerHtml, { title, extraCss }) — เปิด iframe ซ่อน แล้วสั่งพิมพ์
export function printDocument(innerHtml, opts = {}) {
  const old = document.getElementById('__lamom_print_frame')
  if (old) old.remove()

  const frame = document.createElement('iframe')
  frame.id = '__lamom_print_frame'
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)

  const doc = frame.contentWindow.document
  doc.open()
  doc.write(
    '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">' +
    '<title>' + (opts.title || 'เอกสาร') + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + BASE_CSS + (opts.extraCss || '') + '</style></head><body>' +
    innerHtml +
    '</body></html>'
  )
  doc.close()

  const go = () => {
    try {
      frame.contentWindow.focus()
      frame.contentWindow.print()
    } catch (e) {}
    setTimeout(() => frame.remove(), 1500)
  }
  // ให้ font + layout โหลดก่อนพิมพ์
  if (frame.contentWindow.document.readyState === 'complete') setTimeout(go, 350)
  else frame.onload = () => setTimeout(go, 350)
}

// helper สร้าง <head> เอกสารพร้อมโลโก้/ชื่อบริษัท
export function docHeader(title, no, dateStr, opts = {}) {
  const org = getOrgInfo()
  return (
    '<div class="doc-head">' +
      '<div>' +
        '<div class="org-name">' + esc(org.name) + '</div>' +
        '<div class="org-sub">' + esc(org.sub) + '</div>' +
        (org.addr ? '<div class="org-meta">' + esc(org.addr) + '</div>' : '') +
        (org.phone ? '<div class="org-meta">โทร. ' + esc(org.phone) + (org.taxId ? ' · เลขประจำตัวผู้เสียภาษี ' + esc(org.taxId) : '') + '</div>' : '') +
      '</div>' +
      '<div class="doc-title-box">' +
        '<div class="doc-title">' + esc(title) + '</div>' +
        (no ? '<div class="doc-no">เลขที่ ' + esc(no) + '</div>' : '') +
        '<div class="doc-date">วันที่พิมพ์ ' + (dateStr || thaiToday()) + '</div>' +
        (opts.cancelled ? '<div style="margin-top:6px"><span class="badge-cancel">✕ ยกเลิก/ถอนจอง</span></div>' : '') +
      '</div>' +
    '</div>'
  )
}

export function docFooter() {
  return '<div class="foot">เอกสารนี้สร้างโดยระบบ LAMOM ONE · ' + thaiToday() + '</div>'
}

function thaiToday() {
  const d = new Date()
  const m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543)
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
