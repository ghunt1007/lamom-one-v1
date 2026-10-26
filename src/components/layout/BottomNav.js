// แถบเมนูล่างสำหรับมือถือ (จอแคบกว่า 768px) — เซลส์ใช้มือถือเป็นหลัก ปุ่มที่ใช้บ่อยสุดอยู่ใต้นิ้วโป้ง
// งานวันนี้ · ลูกค้า · ➕ Lead (ปุ่มกลางเด่น) · ใบจอง · LAMI — จอใหญ่ซ่อนด้วย CSS (.bottom-nav ใน layout.css)
import { getState, on } from '../../core/store.js'
import { navigate } from '../../core/router.js'
import { getModuleForPath, hasModuleAccess, loadRolePermissions } from '../../core/permissions.js'

export const BOTTOM_ITEMS = [
  { icon: '☀️', label: 'งานวันนี้', path: '/crm/my-day' },
  { icon: '👥', label: 'ลูกค้า', path: '/crm/customers' },
  { icon: '➕', label: 'Lead', action: 'lead' },
  { icon: '📝', label: 'จองรถ', path: '/crm/bookings' },
  { icon: '🤖', label: 'LAMI', path: '/ai/ask' },
]

export function BottomNav(container) {
  const nav = document.createElement('nav')
  nav.className = 'bottom-nav'
  container.appendChild(nav)
  function render() {
    const route = getState('currentRoute') || window.location.pathname
    const u = getState('user') || {}
    // เมนูตามสิทธิ์เดียวกับ Sidebar — ปุ่ม Lead ใช้สิทธิ์หน้าลูกค้า; เหลือน้อยกว่า 2 ปุ่มก็ไม่ต้องแสดงแถบ
    const ok = it => hasModuleAccess(u.role, getModuleForPath(it.path || '/crm/customers')?.key, u.extraGrants)
    const items = BOTTOM_ITEMS.map((it, i) => ({ it, i })).filter(x => ok(x.it))
    nav.style.visibility = items.length < 2 ? 'hidden' : ''
    nav.innerHTML = items.map(({ it, i }) => it.action
      ? `<button class="bottom-nav-item bottom-nav-main" data-i="${i}" aria-label="เพิ่ม Lead ด่วน"><span class="bottom-nav-plus">${it.icon}</span><span>${it.label}</span></button>`
      : `<button class="bottom-nav-item${route === it.path ? ' active' : ''}" data-i="${i}"><span class="bottom-nav-icon">${it.icon}</span><span>${it.label}</span></button>`).join('')
    nav.querySelectorAll('.bottom-nav-item').forEach(b => b.addEventListener('click', () => {
      const it = BOTTOM_ITEMS[+b.dataset.i]
      if (it.action === 'lead') import('../../utils/quickLead.js').then(m => m.openQuickLead())
      else navigate(it.path)
    }))
  }
  render()
  loadRolePermissions().then(render).catch(() => {})
  on('currentRoute', render)
  on('user', render)
}
