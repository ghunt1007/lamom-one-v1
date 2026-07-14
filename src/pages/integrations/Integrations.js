// Integrations Hub — สรุปภาพรวมการเชื่อมต่อระบบภายนอกจากข้อมูลจริง + ทางลัดไปหน้าที่ใช้งานจริง
// เดิมไฟล์นี้เป็น UI จำลอง (localStorage, hardcoded integration list, "Demo Mode" เท่านั้น) ซ้ำซ้อนกับ
// IntegrationSettings.js (Firestore จริง, /integrations/settings) และ WebhookBuilder.js (/integrations/webhooks)
// แก้ให้เป็นหน้ารวมที่ดึงตัวเลขจริงมาสรุป แล้วพาไปหน้าที่ใช้งานจริงแทน ไม่ซ้ำงาน
import { listDocs } from '../../core/db.js'
import { navigate } from '../../core/router.js'

const LINKS = [
  { icon: '⚙️', title: 'ตั้งค่าการเชื่อมต่อ', path: '/integrations/settings', desc: 'เชื่อมต่อ/ตัดการเชื่อม Payment, Messaging, CRM, Accounting, AI, Logistics' },
  { icon: '🔗', title: 'Webhook Builder', path: '/integrations/webhooks', desc: 'สร้าง Webhook รับข้อมูลจาก Platform ภายนอก' },
]

export default async function IntegrationsPage(container) {
  let integrations = []
  try {
    integrations = await listDocs('system_integrations', [], 'name', 'asc', 200)
  } catch (e) {}

  const connected = integrations.filter(i => i.status === 'connected').length
  const errors = integrations.filter(i => i.status === 'error').length
  const disconnected = integrations.filter(i => i.status === 'disconnected').length

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔗 Integrations & Hooks</div>
            <div class="page-subtitle">ภาพรวมการเชื่อมต่อระบบภายนอกจากข้อมูลจริง — เลือกไปยังหน้าที่ต้องการด้านล่าง</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('🔗 ทั้งหมด', integrations.length, 'primary')}
          ${kpi('✅ เชื่อมต่อแล้ว', connected, 'success')}
          ${kpi('⭕ ยังไม่เชื่อม', disconnected, 'secondary')}
          ${kpi('⚠️ มีปัญหา', errors, errors > 0 ? 'danger' : 'secondary')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
          ${LINKS.map(l => `
            <div class="card hub-link-card" data-path="${l.path}" style="padding:18px;cursor:pointer;transition:transform .15s">
              <div style="font-size:1.8rem;margin-bottom:8px">${l.icon}</div>
              <div style="font-weight:700;margin-bottom:4px">${l.title}</div>
              <div style="font-size:0.78rem;color:var(--text-muted)">${l.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    container.querySelectorAll('.hub-link-card').forEach(card => {
      card.addEventListener('click', () => navigate(card.dataset.path))
      card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)' })
      card.addEventListener('mouseleave', () => { card.style.transform = '' })
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
