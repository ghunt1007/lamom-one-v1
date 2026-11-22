// (v1.0.1318) พิมพ์เอกสารจากแม่แบบ (/documents/templates) — เดิมกด "ใช้" แล้วได้แค่นับจำนวนครั้ง ไม่มีเอกสารออกมาเลย
// ตอนนี้ได้เอกสารหัวบริษัท + ช่องข้อมูลตามแม่แบบ + ช่องเซ็นชื่อ → พิมพ์ หรือเลือก "บันทึกเป็น PDF" ในหน้าต่างพิมพ์
// ช่องที่เว้นว่างพิมพ์เป็นเส้นจุดให้เขียนด้วยมือ
import { docHeader, docFooter, esc } from './print.js'

const BLANK = '......................................................'

export function templateDocHtml(t = {}, values = []) {
  const fields = Array.isArray(t.fields) ? t.fields : []
  const rows = fields.map((f, i) => {
    const v = String(values[i] ?? '').trim()
    return '<tr><td class="lbl">' + esc(f) + '</td><td class="val">' + (v ? esc(v).replace(/\n/g, '<br>') : '<span style="color:#94a3b8;font-weight:400">' + BLANK + '</span>') + '</td></tr>'
  }).join('')
  return '<div class="doc">' +
    docHeader(t.name || 'เอกสาร', '', '') +
    '<table class="kv"><tbody>' + rows + '</tbody></table>' +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้รับเอกสาร</div><div class="sign-cap">(..............................)</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ออกเอกสาร</div><div class="sign-cap">(..............................)</div></div>' +
    '</div>' +
    docFooter() +
  '</div>'
}
