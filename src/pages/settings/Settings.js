import { navigate } from '../../core/router.js'
import { getState, setState } from '../../core/store.js'

const THEMES = [
  { key:'default', name:'💜 LAMOM Purple', primary:'#7C3AED' },
  { key:'blue', name:'💙 Ocean Blue', primary:'#2563EB' },
  { key:'green', name:'💚 Forest Green', primary:'#059669' },
  { key:'red', name:'❤️ Ruby Red', primary:'#DC2626' },
  { key:'orange', name:'🧡 Sunset Orange', primary:'#EA580C' },
  { key:'teal', name:'🩵 Teal', primary:'#0891B2' },
]

const NAV_ITEMS = [
  { icon:'🏢', label:'ข้อมูลบริษัท', path:'/settings/company' },
  { icon:'👥', label:'จัดการผู้ใช้', path:'/settings/users' },
  { icon:'🔐', label:'Role & Permissions', path:'/settings/roles' },
]

export default function SettingsPage(container) {
  const user = getState('user')
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'default'

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">⚙️ ตั้งค่า</div>
          <div class="page-subtitle">การตั้งค่าระบบ LAMOM ONE</div>
        </div>
      </div>

      <!-- Quick Nav -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:24px">
        ${NAV_ITEMS.map(n => `
          <div class="card card-lift" data-nav="${n.path}" style="padding:14px;cursor:pointer;display:flex;align-items:center;gap:10px">
            <span style="font-size:1.4rem">${n.icon}</span>
            <span style="font-weight:600;font-size:0.9rem">${n.label}</span>
          </div>
        `).join('')}
      </div>

      <!-- Appearance -->
      <div class="card mb-4" style="padding:20px">
        <div style="font-weight:600;margin-bottom:16px">🎨 Appearance</div>
        <div style="margin-bottom:14px">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Theme สี</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${THEMES.map(t => `
              <div class="theme-swatch ${t.key === currentTheme ? 'active' : ''}" data-theme="${t.key}"
                style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--radius-md);border:2px solid ${t.key === currentTheme ? 'var(--primary)' : 'var(--border)'};cursor:pointer;background:var(--surface-2)">
                <div style="width:14px;height:14px;border-radius:50%;background:${t.primary};flex-shrink:0"></div>
                <span style="font-size:0.82rem">${t.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Profile -->
      <div class="card mb-4" style="padding:20px">
        <div style="font-weight:600;margin-bottom:16px">👤 โปรไฟล์ของฉัน</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
          <div class="avatar" style="width:56px;height:56px;font-size:1.2rem;background:var(--primary-dim);color:var(--primary)">
            ${(user?.displayName||user?.email||'U').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style="font-weight:700">${user?.displayName || user?.email || 'ผู้ใช้'}</div>
            <div style="font-size:0.82rem;color:var(--text-muted)">${user?.email || ''}</div>
            <div style="font-size:0.78rem;color:var(--accent);margin-top:2px">${user?.role || 'Staff'}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="logout-btn">🚪 ออกจากระบบ</button>
      </div>

      <!-- System Info -->
      <div class="card" style="padding:20px">
        <div style="font-weight:600;margin-bottom:12px">ℹ️ ข้อมูลระบบ</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:0.82rem">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">ระบบ</span><span>LAMOM ONE V1</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Tech Stack</span><span>Vite + ES6 + Firebase</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">เจ้าของ</span><span style="color:var(--primary)">ทวีศักดิ์ สุขสมบัติเสถียร</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">พัฒนาโดย</span><span>LAMI AI + Claude</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Version</span><span style="color:var(--success)">1.0.0-alpha</span></div>
        </div>
      </div>
    </div>
  `

  container.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) navigate(nav.dataset.nav)
  })

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    import('../../core/auth.js').catch(() => {})
    setState('user', null)
    navigate('/login')
  })

  document.querySelectorAll('.theme-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const theme = swatch.dataset.theme
      document.documentElement.setAttribute('data-theme', theme)
      try { localStorage.setItem('lamom-theme', theme) } catch {}
      document.querySelectorAll('.theme-swatch').forEach(s => {
        s.style.borderColor = s.dataset.theme === theme ? 'var(--primary)' : 'var(--border)'
        s.classList.toggle('active', s.dataset.theme === theme)
      })
      import('../../core/store.js').then(m => m.showToast(`🎨 เปลี่ยน Theme เป็น ${THEMES.find(t=>t.key===theme)?.name}`, 'success')).catch(() => {})
    })
  })
}
