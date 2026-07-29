import { getState, setState, setActiveCompanyFilter, on } from '../../core/store.js'
import { navigate } from '../../core/router.js'
import { openNotifPanel } from './NotifPanel.js'
import { openGlobalSearch } from './GlobalSearch.js'
import { listDocs, seedDemoData } from '../../core/db.js'

export async function refreshUnreadCount() {
  try {
    seedDemoData()
    const notifs = await listDocs('notifications', [], 'createdAt', 'desc', 50)
    setState('unreadCount', notifs.filter(n => !n.read).length)
  } catch { /* เงียบไว้ — จุดแจ้งเตือนแค่ไม่อัปเดต ไม่กระทบส่วนอื่น */ }
}

const BREADCRUMBS = {
  '/': 'Dashboard',
  '/crm': 'CRM',
  '/crm/leads': 'CRM / Lead',
  '/crm/pipeline': 'CRM / Pipeline',
  '/crm/customers': 'CRM / ลูกค้า',
  '/crm/bookings': 'CRM / จองรถ',
  '/dms': 'DMS',
  '/dms/stock': 'DMS / สต็อกรถ',
  '/dms/orders': 'DMS / สั่งรถใหม่',
  '/dms/pdi': 'DMS / PDI',
  '/service': 'Service',
  '/service/jobs': 'Service / Job Card',
  '/service/parts': 'Service / อะไหล่',
  '/finance': 'Finance',
  '/finance/margin': 'Finance / Margin',
  '/finance/commission': 'Finance / Commission',
  '/marketing': 'Marketing',
  '/hr': 'HR',
  '/training': 'Training',
  '/analytics': 'Analytics',
  '/gamification': 'Gamification',
  '/settings': 'ตั้งค่า',
}

export function Topbar(container) {
  let el = null
  const unsubs = []

  function render() {
    const collapsed = getState('sidebarCollapsed')
    const route = getState('currentRoute')
    const crumbs = (BREADCRUMBS[route] || '').split(' / ')

    const html = `
      <header class="topbar ${collapsed ? 'sidebar-collapsed' : ''}" id="topbar">
        <div class="topbar-breadcrumb">
          <span style="color:var(--text-muted);font-size:0.8rem">LAMOM ONE</span>
          ${crumbs.map((c, i) => `
            <span class="sep">›</span>
            <span class="${i === crumbs.length - 1 ? 'current' : ''}">${c}</span>
          `).join('')}
        </div>

        <div class="topbar-search" id="global-search">
          <span style="color:var(--text-muted)">🔍</span>
          <span class="topbar-search-text">ค้นหาทุกอย่าง...</span>
          <span class="topbar-search-kbd">Ctrl K</span>
        </div>

        <div class="topbar-actions">
          ${getState('companies').length > 1 ? `<button class="topbar-btn" id="company-filter-btn" title="กรองบริษัท">🏢</button>` : ''}
          <button class="topbar-btn" id="theme-btn" title="เปลี่ยน Theme">🎨</button>
          <button class="topbar-btn" id="notif-btn" title="การแจ้งเตือน">
            🔔
            ${getState('unreadCount') > 0 ? '<span class="topbar-notif-dot"></span>' : ''}
          </button>
          <button class="topbar-btn" id="lami-chat-btn" title="คุยกับ LAMI">🤖</button>
        </div>
      </header>
    `

    if (!el) {
      const wrap = document.createElement('div')
      wrap.innerHTML = html
      el = wrap.firstElementChild
      container.appendChild(el)
    } else {
      const wrap = document.createElement('div')
      wrap.innerHTML = html
      el.replaceWith(wrap.firstElementChild)
      el = container.querySelector('#topbar')
    }

    bindEvents()
  }

  function bindEvents() {
    document.getElementById('global-search')?.addEventListener('click', openSearch)
    document.getElementById('company-filter-btn')?.addEventListener('click', openCompanyFilter)
    document.getElementById('theme-btn')?.addEventListener('click', openThemePicker)
    document.getElementById('notif-btn')?.addEventListener('click', (e) => openNotifPanel(e.currentTarget))
    document.getElementById('lami-chat-btn')?.addEventListener('click', () => navigate('/ai/ask'))
  }

  render()
  refreshUnreadCount()
  unsubs.push(on('sidebarCollapsed', render))
  unsubs.push(on('currentRoute', render))
  unsubs.push(on('unreadCount', render))
  unsubs.push(on('companies', render))

  // Keyboard shortcut
  const keyHandler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch() }
  }
  document.addEventListener('keydown', keyHandler)

  return () => {
    unsubs.forEach(fn => fn())
    document.removeEventListener('keydown', keyHandler)
  }
}

function openSearch() {
  openGlobalSearch()
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// ตัวกรองบริษัท — สำหรับพนักงาน shared-service (HR/บัญชี ฯลฯ) ที่ทำงานหลายบริษัท
// ค่าเริ่มต้นคือ "ทั้งหมด" (เห็นข้อมูลทุกบริษัทพร้อมกัน) กดเลือกเพื่อกรองแคบลงได้
function openCompanyFilter() {
  const companies = getState('companies') || []
  const active = getState('activeCompanyFilter') || []
  const isAll = !active.length || active.length === companies.length

  const existing = document.getElementById('company-filter-panel')
  if (existing) { existing.remove(); return }

  const div = document.createElement('div')
  div.id = 'company-filter-panel'
  div.style.cssText = `
    position:fixed; top:60px; right:12px; z-index:500;
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--radius-lg); padding:8px;
    display:flex; flex-direction:column; gap:4px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    animation: slideDown 150ms ease;
    min-width:200px; max-height:320px; overflow-y:auto;
  `
  div.innerHTML = `
    <div style="padding:4px 8px 8px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted)">กรองบริษัท</div>
    <button class="company-opt-all" data-all="1"
      style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);
             background:${isAll?'var(--surface-2)':'transparent'};border:none;cursor:pointer;color:var(--text);font-size:0.875rem;
             font-family:var(--font-main);transition:background 150ms;text-align:left">
      <span>${isAll?'✅':'⬜'}</span><span style="flex:1">ทั้งหมด (${companies.length} บริษัท)</span>
    </button>
    ${companies.map(c => `
      <button class="company-opt" data-id="${c.id}"
        style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);
               background:transparent;border:none;cursor:pointer;color:var(--text);font-size:0.875rem;
               font-family:var(--font-main);transition:background 150ms;text-align:left">
        <span>${!isAll && active.includes(c.id) ? '✅' : '⬜'}</span><span style="flex:1">${escHtml(c.name || c.id)}</span>
      </button>
    `).join('')}
  `
  div.querySelectorAll('.company-opt-all, .company-opt').forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--surface-2)')
    btn.addEventListener('mouseleave', () => { if (!btn.classList.contains('company-opt-all') || !isAll) btn.style.background = 'transparent' })
  })
  // เดิมปุ่มเลือกบริษัท div.remove() ตรงๆ ไม่เคย removeEventListener('click', handler) เลย ทำให้ listener
  // บน document ค้างอยู่จนกว่าจะมีคนคลิกที่อื่นอีกครั้ง แก้ให้มีจุดปิดเดียวที่เคลียร์ทั้งคู่เสมอ
  function closePanel() { div.remove(); document.removeEventListener('click', onDocClick) }
  function onDocClick(e) { if (!div.contains(e.target) && e.target.id !== 'company-filter-btn') closePanel() }
  div.querySelector('.company-opt-all')?.addEventListener('click', () => {
    setActiveCompanyFilter(companies.map(c => c.id))
    closePanel()
  })
  div.querySelectorAll('.company-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id
      const base = isAll ? [] : [...active]
      const next = base.includes(id) ? base.filter(x => x !== id) : [...base, id]
      setActiveCompanyFilter(next.length ? next : companies.map(c => c.id))
      closePanel()
    })
  })

  document.body.appendChild(div)
  setTimeout(() => document.addEventListener('click', onDocClick), 100)
}

function openThemePicker() {
  const themes = [
    { id: 'midnight', label: 'Midnight', color: '#3B82F6', icon: '🌑' },
    { id: 'neon',     label: 'Neon',     color: '#00F5FF', icon: '⚡' },
    { id: 'ocean',    label: 'Ocean',    color: '#29B6F6', icon: '🌊' },
    { id: 'forest',   label: 'Forest',   color: '#4CAF50', icon: '🌿' },
    { id: 'fire',     label: 'Fire',     color: '#FF6D00', icon: '🔥' },
    { id: 'galaxy',   label: 'Galaxy',   color: '#AA00FF', icon: '🌌' },
    { id: 'scifi',    label: 'Sci-Fi HUD', color: '#00E5FF', icon: '🛸' },
  ]

  const existing = document.getElementById('theme-picker')
  if (existing) { existing.remove(); return }

  const div = document.createElement('div')
  div.id = 'theme-picker'
  div.style.cssText = `
    position:fixed; top:60px; right:12px; z-index:500;
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--radius-lg); padding:8px;
    display:flex; flex-direction:column; gap:4px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    animation: slideDown 150ms ease;
    min-width:160px;
  `
  div.innerHTML = `
    <div style="padding:4px 8px 8px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted)">เลือก Theme</div>
    ${themes.map(t => `
      <button class="theme-opt" data-theme="${t.id}"
        style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);
               background:transparent;border:none;cursor:pointer;color:var(--text);font-size:0.875rem;
               font-family:var(--font-main);transition:background 150ms;text-align:left">
        <span>${t.icon}</span>
        <span style="flex:1">${t.label}</span>
        <span style="width:14px;height:14px;border-radius:50%;background:${t.color};flex-shrink:0"></span>
      </button>
    `).join('')}
  `
  // เดิมเลือก Theme แล้ว div.remove() ตรงๆ ไม่เคย removeEventListener('click', handler) เลย ทำให้ listener
  // บน document ค้างอยู่จนกว่าจะมีคนคลิกที่อื่นอีกครั้ง แก้ให้มีจุดปิดเดียวที่เคลียร์ทั้งคู่เสมอ
  function closePicker() { div.remove(); document.removeEventListener('click', onDocClick) }
  function onDocClick(e) { if (!div.contains(e.target) && e.target.id !== 'theme-btn') closePicker() }
  div.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--surface-2)')
    btn.addEventListener('mouseleave', () => btn.style.background = 'transparent')
    btn.addEventListener('click', () => {
      const { setTheme } = window.__lamomStore || {}
      import('../../core/store.js').then(m => m.setTheme(btn.dataset.theme))
      closePicker()
    })
  })

  document.body.appendChild(div)
  setTimeout(() => document.addEventListener('click', onDocClick), 100)
}
