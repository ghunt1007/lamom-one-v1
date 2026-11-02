// (v1.0.922) ปุ่มที่มีแต่ไอคอน (✏️ 🗑 ◀ ▶ ✅ ❌ …) ไม่มีคำอธิบาย → ใส่คำไทยให้เอง (ชี้เมาส์เห็น / โปรแกรมอ่านจออ่านได้)
// ทำอัตโนมัติทุกหน้า ไม่ต้องตามแก้ทีละไฟล์ · ไม่แตะปุ่มที่มีข้อความหรือมี title อยู่แล้ว
// จับเป็นคำใน id/class (คั่นด้วย - _ หรือเว้นวรรค) กัน "model"/"delivery"/"address" ถูกตีเป็น ลบ/เพิ่ม
const w = words => new RegExp(`(^|[\\s_-])(${words})([\\s_-]|$)`, 'i')
const BY_NAME = [
  [w('approve'), 'อนุมัติ'], [w('reject'), 'ไม่อนุมัติ'], [w('skip'), 'ข้าม'], [w('confirm'), 'ยืนยัน'],
  [w('edit'), 'แก้ไข'], [w('del|delete|remove'), 'ลบ/เอาออก'], [w('prev'), 'ก่อนหน้า'], [w('next'), 'ถัดไป'],
  [w('view|detail|open'), 'ดูรายละเอียด'], [w('add'), 'เพิ่ม'],
]
const BY_ICON = {
  '✏️': 'แก้ไข', '✏': 'แก้ไข', '🖊': 'แก้ไข', '🗑': 'ลบ', '🗑️': 'ลบ', '◀': 'ก่อนหน้า', '▶': 'ถัดไป',
  '✕': 'ปิด/เอาออก', '×': 'ปิด/เอาออก', '⏭': 'ข้าม', '⏸': 'พักไว้', '✓': 'ยืนยัน', '+': 'เพิ่ม', '📋': 'ดูรายละเอียด',
}

export function iconTitle(btn) {
  const text = (btn.textContent || '').trim()
  if (!text || /[A-Za-z฀-๿0-9]/.test(text) || btn.title || btn.getAttribute('aria-label')) return ''
  const name = `${btn.id || ''} ${btn.className || ''}`
  for (const [re, label] of BY_NAME) if (re.test(name)) return label
  return BY_ICON[text] || BY_ICON[text.replace(/️/g, '')] || ''
}

function scan() {
  document.querySelectorAll('#main-content button:not([title]):not([aria-label]), .modal-overlay button:not([title]):not([aria-label])').forEach(b => {
    const t = iconTitle(b)
    if (t) { b.title = t; b.setAttribute('aria-label', t) }
  })
}

let started = false
export function initIconTitles() {
  if (started || typeof MutationObserver === 'undefined') return
  started = true
  let t = null
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 250) })
    .observe(document.body, { childList: true, subtree: true })
}
