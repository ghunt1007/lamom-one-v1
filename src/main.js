import './styles/themes.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/scifi-fx.css'

import { initAuth, logout } from './core/auth.js'
import { initRouter, navigate } from './core/router.js'
import { getState, on, setTheme } from './core/store.js'
import { seedDemoData } from './core/db.js'
import { initSessionTimeout, destroySessionTimeout } from './utils/sessionTimeout.js'
import { Sidebar } from './components/layout/Sidebar.js'
import { Topbar } from './components/layout/Topbar.js'
import { ToastContainer } from './components/layout/Toast.js'
import { initAutoTableTools } from './utils/tableTools.js'

const app = document.getElementById('app')

// Toast ต้อง mount ครั้งเดียวที่ระดับ app ไม่ใช่ใน bootstrapShell —
// (1) หน้า login ต้องเห็น toast error จาก auth ด้วย (เดิม showToast ก่อน login ล่องหน)
// (2) bootstrapShell ถูกเรียกซ้ำเมื่อ login ใหม่หลัง logout → container ซ้อน → toast เด้งซ้ำ
ToastContainer(document.body)

// Apply saved theme immediately
const savedTheme = localStorage.getItem('lamom_theme') || 'midnight'
document.documentElement.setAttribute('data-theme', savedTheme)

// Loading screen
app.innerHTML = `
  <div class="loading-overlay" id="initial-loader">
    <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px">
      <div style="width:52px;height:52px;border-radius:14px;background:var(--primary);
                  display:flex;align-items:center;justify-content:center;font-size:1.6rem;
                  font-weight:900;color:#fff;box-shadow:0 0 24px var(--primary-glow);
                  animation:pulse 1.5s infinite">L</div>
      <div style="font-size:1.1rem;font-weight:700;background:linear-gradient(135deg,var(--primary),var(--accent));
                  -webkit-background-clip:text;-webkit-text-fill-color:transparent">LAMOM ONE</div>
      <div class="spinner spinner-lg"></div>
      <div style="font-size:0.825rem;color:var(--text-muted)">กำลังเชื่อมต่อ...</div>
    </div>
  </div>
`

// Init auth then bootstrap
initAuth(() => {
  const user = getState('user')
  const loader = document.getElementById('initial-loader')
  if (loader) loader.remove()

  if (!user) {
    initRouter(app)
    return
  }

  bootstrapShell()
})

async function bootstrapShell() {
  // seed demo data (lazy chunk) ให้เสร็จก่อน initRouter — กัน race หน้าแรกอ่านข้อมูลว่าง
  await seedDemoData()
  app.innerHTML = ''
  app.className = 'app-layout'

  const sidebarMount = document.createElement('div')
  app.appendChild(sidebarMount)
  Sidebar(sidebarMount)

  const topbarMount = document.createElement('div')
  app.appendChild(topbarMount)
  Topbar(topbarMount)

  const main = document.createElement('main')
  const collapsed = getState('sidebarCollapsed')
  main.className = `main-wrap ${collapsed ? 'sidebar-collapsed' : ''}`
  main.id = 'main-content'
  app.appendChild(main)

  on('sidebarCollapsed', (v) => {
    main.className = `main-wrap ${v ? 'sidebar-collapsed' : ''}`
  })

  initRouter(main)
  initAutoTableTools()  // เสริม sort+filter แบบ Excel ให้ทุกตารางอัตโนมัติ
  initSessionTimeout(logout)
}

on('user', (user) => {
  const hasShell = !!document.getElementById('main-content')
  if (user && !hasShell) {
    // Remove login page if present
    app.innerHTML = ''
    app.style.cssText = ''
    bootstrapShell()
  } else if (!user && hasShell) {
    // Logged out — back to login
    destroySessionTimeout()
    app.innerHTML = ''
    app.className = ''
    app.style.cssText = ''
    initRouter(app)
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
  }
})

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {}).catch(err => {
      console.warn('[LAMOM ONE] SW registration failed:', err)
    })
  })
}
