import { getState, on, toggleSidebar } from '../../core/store.js'
import { menuMatches } from '../../utils/menuSearch.js'
import { isMergedPath } from '../../utils/linkedViews.js'
import { buildSimpleNav, readNavMode, writeNavMode, readVisits, recordVisit, countItems } from '../../utils/navSimple.js'
import { navigate } from '../../core/router.js'
import { logout } from '../../core/auth.js'
import { getModuleForPath, hasModuleAccess, loadRolePermissions } from '../../core/permissions.js'
import { isProgramOwner } from '../../core/hierarchy.js'
import { t } from '../../i18n/index.js'

import { NAV } from '../../data/navMenu.js'

// ── Group collapse state (localStorage) ─────────────────────────────────────
const GRP_KEY = 'lamom_sidebar_groups'
function loadGroupState() {
  try { return JSON.parse(localStorage.getItem(GRP_KEY)) || {} } catch { return {} }
}
function saveGroupState(s) {
  try { localStorage.setItem(GRP_KEY, JSON.stringify(s)) } catch {}
}

export function Sidebar(container) {
  let el = null
  const unsubs = []
  // "ใช้บ่อย" คิดจากสถิติตอนเปิดแอป ไม่คำนวณใหม่ทุกคลิก — เมนูจะได้ไม่สลับตำแหน่งไปมาระหว่างใช้งาน
  const visitsAtStart = readVisits()

  loadRolePermissions().then(() => render())

  // (v1.0.469) เพจที่ Firestore Rules บังคับให้เจ้าของโปรแกรมเท่านั้น (isProgramOwner()) ทั้งอ่าน+เขียน —
  // ไม่มีอะไรให้แอดมิน/เจ้าของบริษัทอื่นดูจริงถ้าเปิดเข้าไป (permission-denied ทันที) จึงซ่อนออกจากเมนูไปเลย
  // ต่างจากเพจที่แค่ "บาง action" ถูกจำกัด (เช่น API Keys/Webhook Builder/Security ที่อ่านได้บางส่วน) — พวกนั้น
  // ยังโชว์เมนูตามปกติ แค่ปุ่มแก้ไขจะถูกซ่อน/มีข้อความอธิบายในหน้าเอง
  function visibleNav(role, extraGrants) {
    const ownerOnlyOk = isProgramOwner()
    return NAV
      .map(g => ({ ...g, items: g.items.filter(i => !isMergedPath(i.path) && hasModuleAccess(role, getModuleForPath(i.path)?.key, extraGrants) && (!i.programOwnerOnly || ownerOnlyOk)) }))
      .filter(g => g.items.length > 0)
  }

  function render() {
    // (v1.0.489) sidebarCollapsed เป็นค่าเดียวที่ persist ผ่าน localStorage ใช้ร่วมกันทั้ง desktop (ย่อเหลือ
    // แถบไอคอนแคบๆ) และ mobile (ลิ้นชักเมนูแบบ slide-in ที่ CSS บังคับให้กว้าง min(80vw,300px) เสมออยู่แล้ว —
    // ดู @media max-width:768px ใน layout.css) — เดิมถ้าเคยกดย่อ sidebar จากเครื่อง desktop มาก่อน (หรือกด
    // ปุ่มย่อบนมือถือเองโดยไม่ตั้งใจ) ค่า collapsed=true จะติดค้างข้ามอุปกรณ์ ทำให้เมนูมือถือ (ที่กว้างพอแสดง
    // label อยู่แล้ว) render แค่ไอคอนล้วนไม่มีชื่อเมนูเลยสักตัว (ปุ่มขยายกลับก็เป็นไอคอนเล็กๆหาไม่เจอด้วย) —
    // บังคับ collapsed=false เสมอเมื่อจอแคบ ไม่ให้ state ของ desktop ไปกระทบการแสดงผลบนมือถือ
    const isMobileViewport = window.innerWidth <= 768
    const collapsed = getState('sidebarCollapsed') && !isMobileViewport
    const route = getState('currentRoute')
    const user = getState('user')
    const lang = getState('language') || 'th'
    const grpState = loadGroupState()
    const nav = visibleNav(user?.role, user?.extraGrants)
    const gLabel = g => (lang === 'en' ? g.groupEn : lang === 'zh' ? g.groupZh : null) || g.group
    const iLabel = i => (lang === 'en' ? i.labelEn : lang === 'zh' ? i.labelZh : null) || i.label
    const mode = readNavMode()
    const simpleNav = buildSimpleNav(nav, visitsAtStart)
    const groupsHtml = (groups, cls) => groups.map(group => {
      const isGroupCollapsed = !collapsed && !!grpState[group.group]
      const hasActive = group.items.some(i => i.path === route)
      return `
            <div class="nav-group ${cls}">
              ${!collapsed ? `
                <div class="nav-group-label nav-group-toggle ${hasActive ? 'has-active' : ''}" data-grp="${escHtml(group.group)}">
                  <span>${escHtml(gLabel(group))}</span>
                  <span class="nav-grp-arrow">${isGroupCollapsed ? '▸' : '▾'}</span>
                </div>
              ` : ''}
              <div class="nav-group-items ${isGroupCollapsed ? 'grp-hidden' : ''}">
                ${group.items.map(item => `
                  <div class="nav-item ${route === item.path ? 'active' : ''}"
                       data-path="${item.path}"
                       title="${escHtml(item.fullLabel ? `${iLabel(item)} · ${item.fullLabel}` : iLabel(item))}">
                    <span class="nav-icon">${item.icon}</span>
                    ${!collapsed ? `<span class="nav-label">${escHtml(iLabel(item))}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `}).join('')

    // Auto-expand the group containing the active route
    nav.forEach(g => {
      if (g.items.some(i => i.path === route) && !(g.group in grpState)) {
        grpState[g.group] = false // false = expanded
      }
    })

    // (v1.0.539) ชื่อแบรนด์/โลโก้จากหน้า White-label (core/whiteLabel.js) — เดิม hardcode 'LAMOM ONE' เสมอ
    const brand = getState('brand') || { brandName: 'LAMOM ONE', logoUrl: '' }
    const logoIcon = brand.logoUrl
      ? `<img src="${escHtml(brand.logoUrl)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">`
      : escHtml(brand.brandName.charAt(0) || 'L')
    const html = `
      <aside class="sidebar ${collapsed ? 'collapsed' : ''}" id="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">${logoIcon}</div>
          ${!collapsed ? `<span class="sidebar-logo-text">${escHtml(brand.brandName)}</span>` : ''}
          ${!collapsed && !isMobileViewport ? `<button class="sidebar-toggle" id="sidebar-toggle" title="${t('collapseSidebar')}">◀</button>` : ''}
        </div>

        ${!collapsed ? `<div class="sidebar-find"><input type="search" id="sb-find" placeholder="🔍 หาเมนู…" autocomplete="off" aria-label="หาเมนู"></div>` : ''}
        <nav class="sidebar-nav">
          ${mode === 'simple' ? groupsHtml(simpleNav, 'nav-simple') : ''}
          ${groupsHtml(nav, mode === 'simple' ? 'nav-full nav-full-hidden' : 'nav-full')}
          ${!collapsed ? `<button class="nav-mode-toggle" id="nav-mode" type="button">${mode === 'simple' ? `📂 ดูเมนูทั้งหมด <span class="nav-mode-count">${countItems(nav)}</span>` : '✨ กลับเมนูหลัก'}</button>` : ''}
        </nav>

        <div class="sidebar-footer">
          <div class="lami-widget" id="lami-widget">
            <div class="lami-avatar">🤖</div>
            ${!collapsed ? `
              <div class="lami-info">
                <div class="lami-name">LAMI</div>
                <div class="lami-mood">${t('alwaysHappyToHelp')}</div>
              </div>
            ` : ''}
          </div>
          <div class="user-mini" id="user-mini">
            <div class="user-avatar-mini">${getInitials(user?.displayName || user?.email || 'U')}</div>
            ${!collapsed ? `
              <div style="overflow:hidden">
                <div class="user-name-mini">${escHtml(user?.displayName || user?.email || t('user'))}</div>
                <div class="user-role-mini">${escHtml(roleLabel(user?.role))}</div>
              </div>
            ` : ''}
          </div>
          ${collapsed ? `<button class="sidebar-toggle" id="sidebar-toggle" title="${t('expandSidebar')}">▶</button>` : ''}
        </div>
      </aside>
    `

    if (!el) {
      const wrapper = document.createElement('div')
      wrapper.innerHTML = html
      el = wrapper.firstElementChild
      container.appendChild(el)
      bindEvents()
    } else {
      const scrollTop = el.querySelector('.sidebar-nav')?.scrollTop || 0
      const wrapper = document.createElement('div')
      wrapper.innerHTML = html
      const newEl = wrapper.firstElementChild
      el.replaceWith(newEl)
      el = newEl
      bindEvents()
      const nav = el.querySelector('.sidebar-nav')
      if (nav) nav.scrollTop = scrollTop
    }
  }

  function bindEvents() {
    el.querySelector('#sidebar-toggle')?.addEventListener('click', () => toggleSidebar())

    // Group toggle
    el.querySelectorAll('.nav-group-toggle[data-grp]').forEach(label => {
      label.addEventListener('click', () => {
        const grp = label.dataset.grp
        const s = loadGroupState()
        s[grp] = !s[grp]
        saveGroupState(s)
        render()
      })
    })

    el.querySelectorAll('.nav-item[data-path]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.path))
    })
    el.querySelector('#nav-mode')?.addEventListener('click', () => {
      writeNavMode(readNavMode() === 'simple' ? 'all' : 'simple')
      render()
      el.querySelector('.sidebar-nav')?.scrollTo({ top: 0 })
    })
    // หาเมนูจากชื่อ (เมนูมีหลายร้อยรายการ) — พิมพ์แล้วกรองทันที กด Enter ไปเมนูแรกที่เจอ
    const find = el.querySelector('#sb-find')
    find?.addEventListener('input', () => {
      const q = find.value.trim()
      // เมนูแบบเรียบง่าย: พิมพ์ค้นแล้วค้นจากเมนูทั้งหมด (ทุกหน้ายังหาเจอ) ลบคำค้นแล้วกลับเป็นเมนูหลัก
      el.querySelectorAll('.nav-group.nav-simple').forEach(g => { g.style.display = q ? 'none' : '' })
      el.querySelectorAll('.nav-group.nav-full').forEach(g => {
        if (g.classList.contains('nav-full-hidden') && !q) { g.style.display = ''; return }
        let any = false
        g.querySelectorAll('.nav-item[data-path]').forEach(it => {
          const hit = menuMatches(it.getAttribute('title'), it.dataset.path, find.value)
          it.style.display = hit ? '' : 'none'
          any = any || hit
        })
        g.style.display = any ? 'block' : 'none'
        g.querySelector('.nav-group-items')?.classList.toggle('sb-force-open', !!q)
      })
    })
    find?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return
      const first = [...el.querySelectorAll('.nav-full .nav-item[data-path]')].find(it => it.style.display !== 'none' && it.closest('.nav-group').style.display !== 'none' && it.offsetParent)
      if (first) navigate(first.dataset.path)
    })
    // LAMI widget → ถาม LAMI (ที่เดียวกับปุ่ม 🤖 บนแถบบนและแถบล่างมือถือ — เดิมพาไปคนละหน้า ทำให้ดูเหมือนมี AI หลายตัว)
    el.querySelector('#lami-widget')?.addEventListener('click', () => navigate('/ai/ask'))
    // เมนูผู้ใช้: บัญชีของฉัน / ออกจากระบบ
    el.querySelector('#user-mini')?.addEventListener('click', (e) => {
      e.stopPropagation()
      document.getElementById('user-menu-pop')?.remove()
      const pop = document.createElement('div')
      pop.id = 'user-menu-pop'
      pop.style.cssText = 'position:fixed;bottom:64px;left:14px;z-index:1000;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 30px rgba(0,0,0,0.4);padding:6px;min-width:180px'
      pop.innerHTML = `
        <button id="um-account" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:none;color:var(--text);cursor:pointer;font-size:0.82rem;border-radius:var(--radius-sm);text-align:left">👤 ${t('myAccount')}</button>
        <button id="um-logout" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.82rem;border-radius:var(--radius-sm);text-align:left">🚪 ${t('logout')}</button>
      `
      document.body.appendChild(pop)
      pop.querySelectorAll('button').forEach(b => {
        b.addEventListener('mouseenter', () => b.style.background = 'var(--surface-2)')
        b.addEventListener('mouseleave', () => b.style.background = 'none')
      })
      pop.querySelector('#um-account').addEventListener('click', () => { pop.remove(); navigate('/settings/my-account') })
      pop.querySelector('#um-logout').addEventListener('click', async () => {
        pop.remove()
        try { await logout() } catch { navigate('/login') }
      })
      setTimeout(() => document.addEventListener('click', () => pop.remove(), { once: true }), 50)
    })
  }

  render()

  unsubs.push(on('sidebarCollapsed', render))
  unsubs.push(on('currentRoute', r => { recordVisit(r); render() }))
  unsubs.push(on('user', render))
  unsubs.push(on('language', render))
  unsubs.push(on('brand', render))

  return () => unsubs.forEach(fn => fn())
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getInitials(name) {
  if (!name) return 'U'
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function roleLabel(role) {
  const map = { owner: t('roleOwner'), admin: t('roleAdmin'), manager: t('roleManager'), sales: t('roleSales'), service: t('roleService'), staff: t('roleStaff') }
  return map[role] || role || t('roleStaff')
}
