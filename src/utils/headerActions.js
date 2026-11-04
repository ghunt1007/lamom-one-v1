// (v1.0.961) หัวหน้าทุกหน้า: ปุ่มรองเยอะเกิน (≥3 ปุ่ม) รวมไว้ใต้ปุ่มเดียว "⋯ เพิ่มเติม" ให้หัวหน้าโล่ง ดูง่าย
// ปุ่มหลัก (btn-primary) และปุ่มเน้น (secondary/warning/success/danger) ยังอยู่ข้างนอกเหมือนเดิม
// ย้ายปุ่มเดิมทั้งตัวเข้าไปในเมนู (ไม่สร้างใหม่) → ทุกปุ่มยังทำงานเหมือนเดิม (listener / id ติดไปด้วย)
// หน้าที่มีปุ่ม "⋯ อื่นๆ" ของตัวเอง (.pa-more-btn) ใช้ปุ่มที่หน้านั้นติด .pa-more ไว้แทน
// ใช้ MutationObserver แบบเดียวกับ tableTools → ไม่ต้องแก้ทีละหน้า (ทั้งระบบ 330+ หน้า)

const EMPHASIS = ['btn-primary', 'btn-secondary', 'btn-warning', 'btn-success', 'btn-danger', 'pa-more-btn']
const hasCls = (cls, c) => (' ' + String(cls).replace(/\s+/g, ' ') + ' ').includes(' ' + c + ' ')
export const MIN_TO_GROUP = 3

// เลือกปุ่มที่จะย้ายเข้าเมนู (ฟังก์ชันล้วน ทดสอบได้): items = [{ cls, hidden }]
export function pickOverflow(items, { ownMenu = false } = {}) {
  const idx = []
  items.forEach((it, i) => {
    if (it.hidden) return
    if (ownMenu ? hasCls(it.cls, 'pa-more') : !EMPHASIS.some(c => hasCls(it.cls, c))) idx.push(i)
  })
  return idx.length >= MIN_TO_GROUP ? idx : []
}

function closeAll(except) {
  document.querySelectorAll('.pa-menu.open').forEach(m => { if (m !== except) { m.classList.remove('open'); m.querySelector('.pa-menu-btn')?.setAttribute('aria-expanded', 'false') } })
}

export function groupHeaderActions(actions) {
  if (!actions || actions.dataset.paAuto) return
  actions.dataset.paAuto = '1'
  const kids = [...actions.children].filter(el => el.matches('button.btn, a.btn'))
  const ownMenu = kids.some(el => el.classList.contains('pa-more-btn'))
  const pick = pickOverflow(kids.map(el => ({ cls: el.className, hidden: el.hidden || el.style.display === 'none' })), { ownMenu })
  if (!pick.length) return
  const menu = document.createElement('div')
  menu.className = 'pa-menu'
  menu.innerHTML = '<button type="button" class="btn btn-ghost btn-sm pa-menu-btn" aria-haspopup="true" aria-expanded="false" title="เมนูเพิ่มเติม">⋯ เพิ่มเติม</button><div class="pa-menu-list" role="menu"></div>'
  const list = menu.lastElementChild
  // เมนูอยู่ตำแหน่งปุ่มแรกที่ถูกย้าย (ปุ่มเน้น/ปุ่มหลักยังอยู่ขวาสุดเหมือนเดิม)
  actions.insertBefore(menu, kids[pick[0]])
  pick.forEach(i => { const el = kids[i]; el.classList.remove('pa-more'); el.setAttribute('role', 'menuitem'); list.appendChild(el) })
  if (ownMenu) kids.find(el => el.classList.contains('pa-more-btn'))?.remove()
  const btn = menu.firstElementChild
  btn.addEventListener('click', e => {
    e.stopPropagation()
    const open = !menu.classList.contains('open')
    closeAll(menu)
    menu.classList.toggle('open', open)
    btn.setAttribute('aria-expanded', String(open))
  })
  // กดรายการแล้วปิดเมนู (ปุ่มเดิมทำงานต่อเองตามปกติ)
  list.addEventListener('click', () => setTimeout(() => closeAll(), 0))
}

function scan(root) {
  if (root.matches?.('.page-header .page-actions')) groupHeaderActions(root)
  root.querySelectorAll?.('.page-header .page-actions:not([data-pa-auto])').forEach(groupHeaderActions)
}

let observer = null
export function initHeaderActions() {
  if (observer) return
  scan(document.body)
  document.addEventListener('click', () => closeAll())
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll() })
  let pending = false
  observer = new MutationObserver(() => {
    if (pending) return
    pending = true
    requestAnimationFrame(() => { pending = false; scan(document.body) })
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
