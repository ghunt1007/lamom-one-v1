// (v1.0.1029) วันที่ที่หน้าต่างๆ แสดงเป็นรหัสดิบ 'YYYY-MM-DD' (หลายสิบหน้า เช่น ตารางนัด/ใบแจ้งหนี้/รถยืม)
// → แปลงเป็น DD/MM/YYYY ให้เองตอนแสดงผล ทั้งโปรแกรมใช้รูปแบบเดียว · แตะเฉพาะข้อความบนจอ ไม่แตะข้อมูล/ช่องกรอก
// เวลาที่ติดมาแบบ ISO (2026-11-10T07:30:00Z) แปลงเป็นเวลาไทย 24 ชม. · เลขเอกสารที่มีขีดต่อ (เช่น INV-2026-11-10-01) ไม่แตะ
import { dmy, hm } from './format.js'

const RE = /(^|[^\w\-/.])(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?(?![\w\-/])/g
const QUICK = /\d{4}-\d{2}-\d{2}/

export function isoToDisplay(text) {
  if (!text || !QUICK.test(text)) return text
  return text.replace(RE, (all, pre, y, mo, d, h, mi, zone) => {
    if (+y < 1900 || +y > 2200 || +mo < 1 || +mo > 12 || +d < 1 || +d > 31) return all
    if (h != null && zone) {
      const t = new Date(`${y}-${mo}-${d}T${h}:${mi}:00${zone === 'Z' ? 'Z' : zone}`)
      if (!isNaN(t)) return `${pre}${dmy(t)} ${hm(t)}`
    }
    return `${pre}${dmy(`${y}-${mo}-${d}`)}${h != null ? ` ${h}:${mi}` : ''}`
  })
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'OPTION'])
function skip(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (SKIP.has(e.tagName) || e.isContentEditable || e.hasAttribute?.('data-raw-date')) return true
  }
  return false
}
function fixText(node) {
  const v = node.nodeValue
  if (!v || v.length < 10 || !QUICK.test(v) || skip(node.parentElement)) return
  const next = isoToDisplay(v)
  if (next !== v) node.nodeValue = next
}
function scan(root) {
  if (root.nodeType === 3) { fixText(root); return }
  if (root.nodeType !== 1 || SKIP.has(root.tagName) || !QUICK.test(root.textContent || '')) return
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) fixText(n)
}

let started = false
export function initDateDisplay() {
  if (started || typeof MutationObserver === 'undefined') return
  started = true
  scan(document.body)
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') fixText(m.target)
      else m.addedNodes.forEach(scan)
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
}
