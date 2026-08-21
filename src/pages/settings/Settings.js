import { navigate } from '../../core/router.js'
import { getState, setState, setTheme, setMode } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// (v1.0.532) เดิมรายการ Theme ตรงนี้ (default/blue/green/red/orange/teal) เป็นรายการปลอม — ไม่ตรงกับ
// data-theme ตัวไหนใน src/styles/themes.css เลยสักตัว (ธีมจริงมี 33 แบบ คนละชุดกับตรงนี้) และ handler เดิม
// เขียน localStorage key ผิดด้วย ('lamom-theme' ขีดกลาง ทั้งที่ตัวจริงที่ main.js อ่านตอนบูตคือ 'lamom_theme'
// ขีดล่าง) พูดง่ายๆคือปุ่มเลือก Theme ในหน้านี้กดไปก็ไม่มีอะไรเกิดขึ้นจริงมาตั้งแต่สร้าง ส่วนตัวเลือกธีมจริงที่
// ใช้งานได้จริงอยู่ที่ปุ่ม 🎨 บน Topbar (Topbar.js openThemePicker) — แทนที่จะซ้ำรายการ 33 ธีมอีกรอบที่นี่
// เปลี่ยนเป็นปุ่มลิงก์ไปเปิดตัวเลือกจริงแทน ลดจุดที่ต้องดูแลให้ตรงกันเหลือจุดเดียว


const NAV_ITEMS = [
  { icon:'🏢', label:'ข้อมูลบริษัท', path:'/settings/company' },
  { icon:'👥', label:'จัดการผู้ใช้', path:'/settings/users-manage' },
  { icon:'🔐', label:'Role & Permissions', path:'/settings/roles' },
]

export default function SettingsPage(container) {
  const user = getState('user')
  const currentMode = document.documentElement.getAttribute('data-mode') || 'dark'

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
          <button class="btn btn-secondary btn-sm" id="open-theme-picker-btn">🎨 เลือก Theme สี (33 แบบ)</button>
        </div>
        <div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">โหมดสี</div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-sm mode-btn ${currentMode === 'dark' ? 'btn-primary' : 'btn-secondary'}" data-mode="dark">🌙 มืด (Dark)</button>
            <button class="btn btn-sm mode-btn ${currentMode === 'light' ? 'btn-primary' : 'btn-secondary'}" data-mode="light">☀️ สว่าง (Light)</button>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px">⚠️ ตอนนี้โหมดสว่างรองรับเฉพาะ Theme "Midnight" (ค่าเริ่มต้น) เท่านั้น — Theme อื่นจะยังแสดงเป็นโทนมืดต่อไปแม้เปิดโหมดสว่าง</div>
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
            <div style="font-weight:700">${escHtml(user?.displayName || user?.email) || 'ผู้ใช้'}</div>
            <div style="font-size:0.82rem;color:var(--text-muted)">${escHtml(user?.email)}</div>
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

  document.getElementById('open-theme-picker-btn')?.addEventListener('click', () => {
    document.getElementById('theme-btn')?.click()
  })

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode)
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('btn-primary', b.dataset.mode === btn.dataset.mode)
        b.classList.toggle('btn-secondary', b.dataset.mode !== btn.dataset.mode)
      })
      import('../../core/store.js').then(m => m.showToast(btn.dataset.mode === 'light' ? '☀️ เปลี่ยนเป็นโหมดสว่างแล้ว' : '🌙 เปลี่ยนเป็นโหมดมืดแล้ว', 'success')).catch(() => {})
    })
  })
}
