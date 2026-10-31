import { getState, setState, setActiveCompanyFilter, setLanguage, on } from '../../core/store.js'
import { navigate } from '../../core/router.js'
import { openNotifPanel } from './NotifPanel.js'
import { openGlobalSearch } from './GlobalSearch.js'
import { listDocs, seedDemoData } from '../../core/db.js'
import { t, LANGUAGES } from '../../i18n/index.js'
import { NAV } from '../../data/navMenu.js'
import { breadcrumbFor } from '../../utils/breadcrumb.js'

export async function refreshUnreadCount() {
  try {
    seedDemoData()
    const notifs = await listDocs('notifications', [], 'createdAt', 'desc', 50)
    setState('unreadCount', notifs.filter(n => !n.read).length)
  } catch { /* เงียบไว้ — จุดแจ้งเตือนแค่ไม่อัปเดต ไม่กระทบส่วนอื่น */ }
}

export function Topbar(container) {
  let el = null
  const unsubs = []

  function render() {
    const collapsed = getState('sidebarCollapsed')
    const route = getState('currentRoute')
    const lang = getState('language') || 'th'
    const crumbs = breadcrumbFor(NAV, route, lang)
    const curLangInfo = LANGUAGES.find(l => l.id === lang) || LANGUAGES[0]

    const html = `
      <header class="topbar ${collapsed ? 'sidebar-collapsed' : ''}" id="topbar">
        <button class="topbar-btn topbar-menu-btn" id="mobile-menu-btn" title="${t('menu')}">☰</button>
        <div class="topbar-breadcrumb">
          <span style="color:var(--text-muted);font-size:0.8rem">LAMOM ONE</span>
          ${crumbs.map((c, i) => `
            <span class="sep">›</span>
            <span class="${i === crumbs.length - 1 ? 'current' : ''}">${c}</span>
          `).join('')}
        </div>

        <div class="topbar-search" id="global-search">
          <span style="color:var(--text-muted)">🔍</span>
          <span class="topbar-search-text">${t('searchPlaceholder')}</span>
          <span class="topbar-search-kbd">Ctrl K</span>
        </div>

        <div class="topbar-actions">
          <button class="topbar-btn topbar-search-btn" id="mobile-search-btn" title="ค้นหา / ถาม LAMI">🔍</button>
          ${getState('companies').length > 1 ? `<button class="topbar-btn" id="company-filter-btn" title="${t('filterCompany')}">🏢</button>` : ''}
          <button class="topbar-btn" id="quick-lead-btn" title="เพิ่ม Lead ด่วน" style="width:auto;padding:0 10px;font-size:0.78rem;font-weight:700;white-space:nowrap">🧲 + Lead</button>
          <button class="topbar-btn" id="lang-btn" title="${t('selectLanguage')}">${curLangInfo.flag}</button>
          <button class="topbar-btn" id="theme-btn" title="${t('changeTheme')}">🎨</button>
          <button class="topbar-btn" id="notif-btn" title="${t('notifications')}">
            🔔
            ${getState('unreadCount') > 0 ? '<span class="topbar-notif-dot"></span>' : ''}
          </button>
          <button class="topbar-btn" id="lami-chat-btn" title="LAMI ช่วยเรื่องหน้านี้ (สรุป · ควรทำอะไรต่อ · วิธีใช้)">🤖</button>
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
    document.getElementById('mobile-menu-btn')?.addEventListener('click', toggleMobileMenu)
    document.getElementById('global-search')?.addEventListener('click', openSearch)
    document.getElementById('mobile-search-btn')?.addEventListener('click', openSearch)
    document.getElementById('company-filter-btn')?.addEventListener('click', openCompanyFilter)
    document.getElementById('lang-btn')?.addEventListener('click', openLanguagePicker)
    document.getElementById('theme-btn')?.addEventListener('click', () => import('../ThemeStudio.js').then(m => m.openThemeStudio()))
    document.getElementById('notif-btn')?.addEventListener('click', (e) => openNotifPanel(e.currentTarget))
    // 🤖 = LAMI ช่วยเรื่องหน้าที่เปิดอยู่ (แผงข้าง ไม่ต้องออกจากหน้า) · อยู่หน้าแชท LAMI อยู่แล้วก็แค่โฟกัสช่องพิมพ์
    document.getElementById('lami-chat-btn')?.addEventListener('click', () => {
      if (window.location.pathname === '/ai/ask') { document.getElementById('chat-input')?.focus(); return }
      import('../../utils/lamiPanel.js').then(m => m.openLamiPanel({ navigate }))
    })
    document.getElementById('quick-lead-btn')?.addEventListener('click', () => import('../../utils/quickLead.js').then(m => m.openQuickLead()))
  }

  render()
  refreshUnreadCount()
  unsubs.push(on('sidebarCollapsed', render))
  unsubs.push(on('currentRoute', render))
  unsubs.push(on('currentRoute', closeMobileMenu))
  unsubs.push(on('unreadCount', render))
  unsubs.push(on('companies', render))
  unsubs.push(on('language', render))

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

// เดิมไม่มีทางเปิด sidebar บนมือถือได้เลย — CSS ที่ layout.css ซ่อน .sidebar ไว้นอกจอเสมอที่ ≤768px
// (transform: translateX(-100%)) และรอ class "mobile-open" มาเลื่อนกลับเข้ามา แต่ไม่มีปุ่มไหนในทั้งระบบ
// เคยเพิ่ม class นี้เลย ทำให้เมนูทั้งหมดกดใช้งานไม่ได้บนมือถือถาวร (ต้องพิมพ์ URL เองเท่านั้น) ปุ่ม
// hamburger นี้ + backdrop คือทางเข้าเดียวที่ขาดไป
function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar')
  if (!sidebar) return
  const opening = !sidebar.classList.contains('mobile-open')
  sidebar.classList.toggle('mobile-open', opening)
  if (opening) {
    let backdrop = document.getElementById('sidebar-backdrop')
    if (!backdrop) {
      backdrop = document.createElement('div')
      backdrop.id = 'sidebar-backdrop'
      backdrop.className = 'sidebar-backdrop'
      backdrop.addEventListener('click', closeMobileMenu)
      document.body.appendChild(backdrop)
    }
    backdrop.classList.add('active')
  } else {
    closeMobileMenu()
  }
}

function closeMobileMenu() {
  document.getElementById('sidebar')?.classList.remove('mobile-open')
  document.getElementById('sidebar-backdrop')?.classList.remove('active')
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
    <div style="padding:4px 8px 8px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted)">${t('filterCompany')}</div>
    <button class="company-opt-all" data-all="1"
      style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);
             background:${isAll?'var(--surface-2)':'transparent'};border:none;cursor:pointer;color:var(--text);font-size:0.875rem;
             font-family:var(--font-main);transition:background 150ms;text-align:left">
      <span>${isAll?'✅':'⬜'}</span><span style="flex:1">${t('all')} (${companies.length} ${t('companies')})</span>
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

// (v1.0.353) รองรับหลายภาษา — สลับได้เฉพาะเมนูหลัก/ส่วนกลาง (Sidebar/Topbar/Login/Dashboard) เท่านั้น
// เนื้อหาในแต่ละหน้ายังเป็นภาษาไทยล้วน (ดู src/i18n/index.js สำหรับรายละเอียด)
function openLanguagePicker() {
  const existing = document.getElementById('lang-picker')
  if (existing) { existing.remove(); return }

  const cur = getState('language') || 'th'
  const div = document.createElement('div')
  div.id = 'lang-picker'
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
    <div style="padding:4px 8px 8px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted)">${t('selectLanguage')}</div>
    ${LANGUAGES.map(l => `
      <button class="lang-opt" data-lang="${l.id}"
        style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);
               background:${l.id===cur?'var(--surface-2)':'transparent'};border:none;cursor:pointer;color:var(--text);font-size:0.875rem;
               font-family:var(--font-main);transition:background 150ms;text-align:left">
        <span>${l.flag}</span>
        <span style="flex:1">${l.label}</span>
        ${l.id===cur?'<span>✅</span>':''}
      </button>
    `).join('')}
  `
  function closePicker() { div.remove(); document.removeEventListener('click', onDocClick) }
  function onDocClick(e) { if (!div.contains(e.target) && e.target.id !== 'lang-btn') closePicker() }
  div.querySelectorAll('.lang-opt').forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--surface-2)')
    btn.addEventListener('mouseleave', () => { if (btn.dataset.lang !== cur) btn.style.background = 'transparent' })
    btn.addEventListener('click', () => {
      setLanguage(btn.dataset.lang)
      closePicker()
    })
  })

  document.body.appendChild(div)
  setTimeout(() => document.addEventListener('click', onDocClick), 100)
}
