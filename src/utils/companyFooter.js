// (v1.0.1197) ท้ายป้าย QR ที่พิมพ์ (บูธ/ติดรถ/แนะนำเพื่อน/ฟอร์ม): ชื่อบริษัท + เบอร์โชว์รูม จากหน้า "ข้อมูลบริษัท"
// ลูกค้าที่ไม่อยากสแกนก็โทรได้เลย · โหลดล่วงหน้าตอนเปิดหน้าต่าง QR (prefetchCompanyLine) เพราะปุ่มพิมพ์ต้องเปิดหน้าต่างทันที (กัน pop-up ถูกบล็อก)
// ยังไม่ได้กรอก/อ่านไม่ได้ = ไม่มีบรรทัดท้าย (ไม่ใส่ข้อมูลตัวอย่าง)
import { escHtml as esc } from './escape.js'

let cache = null
let loading = null

export function companyLineFrom(doc) {
  if (!doc) return ''
  const name = String(doc.nameTh || doc.name || '').trim()
  const m = String(doc.phone || '').match(/(?:\+66|0)[\d\s-]{7,13}/)
  let d = m ? m[0].replace(/\D/g, '') : ''
  if (d.startsWith('66')) d = '0' + d.slice(2)
  const tel = /^0\d{9}$/.test(d) ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : /^0\d{8}$/.test(d) ? `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}` : ''
  return [name, tel && `📞 ${tel}`].filter(Boolean).join(' · ')
}

export function prefetchCompanyLine() {
  if (cache !== null || loading) return loading
  loading = import('../core/db.js')
    .then(({ listDocs }) => listDocs('company_profile', [], 'createdAt', 'asc', 10))
    .then(rows => { cache = companyLineFrom((rows || []).find(r => r && !r.deleted)) })
    .catch(() => { cache = null })
    .finally(() => { loading = null })
  return loading
}

export function posterFooter() {
  if (cache === null) prefetchCompanyLine()
  return cache ? `<p style="margin-top:28px;font-size:20px;font-weight:700;color:#111">${esc(cache)}</p>` : ''
}
export function __setCompanyLine(v) { cache = v }
