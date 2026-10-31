// หน้าที่ใช้ข้อมูลชุดเดียวกัน (collection เดียวกัน) แต่เดิมแยกเป็นเมนูคนละอัน เช่น "ยื่นไฟแนนซ์" กับ "Finance Tracker"
// รวมเป็นเมนูเดียว (เมนูแรกของแต่ละกลุ่ม) แล้วโชว์แท็บสลับมุมมองใต้หัวหน้าแทน — ทุกหน้ายังเปิดได้ตามลิงก์เดิม
// และค้นเจอใน Ctrl+K เหมือนเดิม แค่ไม่รกแถบเมนูซ้าย
export const LINKED_VIEWS = [
  [{ path: '/crm/testdrive', label: '📋 รายการ/ผล' }, { path: '/dms/testdrive-schedule', label: '🗓 ตารางเวลา' }],
  [{ path: '/finance/application', label: '🏦 ยื่นไฟแนนซ์' }, { path: '/finance/tracker', label: '📋 ติดตามขั้นตอน' }],
  [{ path: '/service/recall', label: '🔔 แคมเปญเรียกคืน' }, { path: '/service/recall-tracker', label: '🚗 รถที่ต้องเรียกคืน' }],
  [{ path: '/service/warranty', label: '🛡 การรับประกัน' }, { path: '/service/warranty-claim', label: '📋 เคลมประกัน' }, { path: '/service/warranty-expiry', label: '⏳ ใกล้หมดประกัน' }],
  [{ path: '/finance/payroll', label: '💳 เงินเดือน' }, { path: '/finance/payroll-detail', label: '🧾 สลิปรายคน' }],
  [{ path: '/finance/commission', label: '🏆 ค่าคอม' }, { path: '/finance/commission-rules', label: '⚙️ กฎค่าคอม' }],
  [{ path: '/marketing/leads', label: '🧲 แคมเปญหา Lead' }, { path: '/marketing/lead-sources', label: '📊 แหล่งที่มา Lead' }],
]

const clean = p => String(p || '').split('?')[0].replace(/\/+$/, '') || '/'

export function viewGroupFor(path) {
  const p = clean(path)
  return LINKED_VIEWS.find(g => g.some(v => v.path === p)) || null
}

// เมนูรองที่ถูกรวมเข้ากับเมนูหลักแล้ว — ซ่อนจากแถบเมนูซ้าย
export function isMergedPath(path) {
  const g = viewGroupFor(path)
  return !!g && g[0].path !== clean(path)
}

export function viewTabsHtml(path, canOpen = () => true) {
  const p = clean(path)
  const g = viewGroupFor(p)
  const views = g ? g.filter(v => v.path === p || canOpen(v.path)) : []
  if (views.length < 2) return ''
  return views.map(v => `<button type="button" class="view-tab${v.path === p ? ' active' : ''}" data-view="${v.path}"${v.path === p ? ' aria-current="page"' : ''}>${v.label}</button>`).join('')
}

let started = false
export function initViewTabs({ navigate, canOpen = () => true } = {}) {
  if (started || typeof MutationObserver === 'undefined') return
  started = true
  const ensure = () => {
    const main = document.getElementById('main-content')
    if (!main) return
    const html = viewTabsHtml(window.location.pathname, canOpen)
    const bar = main.querySelector('.view-tabs')
    if (!html) { bar?.remove(); return }
    if (bar && bar.dataset.for === window.location.pathname) return
    bar?.remove()
    const header = main.querySelector('.page-header')
    if (!header) return
    const div = document.createElement('div')
    div.className = 'view-tabs'
    div.setAttribute('role', 'tablist')
    div.dataset.for = window.location.pathname
    div.innerHTML = html
    div.addEventListener('click', e => {
      const b = e.target.closest('[data-view]')
      if (b && !b.classList.contains('active')) navigate?.(b.dataset.view)
    })
    header.insertAdjacentElement('afterend', div)
  }
  let t = null
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(ensure, 60) })
    .observe(document.body, { childList: true, subtree: true })
}
