// มือถือ: แถวปุ่มกรอง/แท็บ (ปุ่มเล็กล้วน 4 ปุ่มขึ้นไป) ที่ล้นลงหลายบรรทัด → เปลี่ยนเป็นแถวเดียวเลื่อนซ้าย-ขวา (.chip-scroll)
// แบบเดียวกับที่ใส่มือให้ 13+ หน้าแล้ว แต่ทำอัตโนมัติทุกหน้า ไม่ต้องตามแก้ทีละหน้า
export function isChipRow(el) {
  if (!el || el.classList.contains('chip-scroll') || el.closest('.modal-overlay, .page-actions, table')) return false
  const kids = [...el.children]
  return kids.length >= 4 && kids.every(c => c.tagName === 'BUTTON' && /\bbtn-(sm|xs)\b/.test(c.className))
}

function wraps(el) {
  const tops = new Set([...el.children].filter(c => c.offsetWidth).map(c => c.offsetTop))
  return tops.size >= 2
}

function scan() {
  if (!window.matchMedia('(max-width: 640px)').matches) return
  document.querySelectorAll('#main-content div').forEach(el => {
    if (isChipRow(el) && wraps(el)) { el.classList.add('chip-scroll'); el.style.overflowX = 'auto' }
  })
}

let started = false
export function initChipRows() {
  if (started || typeof MutationObserver === 'undefined') return
  started = true
  let t = null
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 200) })
    .observe(document.body, { childList: true, subtree: true })
}
