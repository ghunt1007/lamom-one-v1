import { listDocs, seedDemoData, getSalesData } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { formatCurrency } from '../../utils/format.js'

const QUICK_LINKS = [
  { icon:'👥', label:'ลูกค้า', sub:'ฐานข้อมูลลูกค้า', path:'/crm/customers', color:'primary' },
  { icon:'🧲', label:'Lead/Prospect', sub:'ติดตามลูกค้าใหม่ (รวมใน ลูกค้า)', path:'/crm/customers', color:'accent' },
  { icon:'📋', label:'Pipeline', sub:'Kanban Sales', path:'/crm/pipeline', color:'success' },
  { icon:'📝', label:'จองรถ', sub:'ใบจองและสัญญา', path:'/crm/bookings', color:'warning' },
  { icon:'🗂️', label:'Action Plan', sub:'แผนการขายรายวัน', path:'/crm/action-plan', color:'primary' },
  { icon:'✅', label:'ตรวจรถก่อนส่ง', sub:'Pre-Delivery Inspection', path:'/crm/predelivery', color:'success' },
  { icon:'🚗', label:'Test Drive', sub:'นัด TD & บันทึก', path:'/crm/testdrive', color:'accent' },
  { icon:'📞', label:'Follow-up', sub:'ติดตามลูกค้า', path:'/crm/followup', color:'warning' },
  { icon:'🚶', label:'Walk-In', sub:'ลูกค้าเดินเข้าหน้าร้าน', path:'/crm/walkin', color:'primary' },
  { icon:'📄', label:'ใบเสนอราคา', sub:'Quotation Builder', path:'/crm/quotation', color:'accent' },
  { icon:'📢', label:'ร้องเรียน', sub:'ติดตามข้อร้องเรียน', path:'/crm/complaints', color:'danger' },
  { icon:'💬', label:'Feedback', sub:'รีวิวและ NPS', path:'/crm/feedback', color:'success' },
  { icon:'👑', label:'Loyalty', sub:'คะแนนสะสม', path:'/crm/loyalty', color:'warning' },
  { icon:'📉', label:'Lost Deal', sub:'วิเคราะห์ดีลที่หลุด', path:'/crm/lostdeals', color:'danger' },
  { icon:'🏪', label:'Showroom Appt', sub:'นัดหมายโชว์รูม', path:'/crm/showroom', color:'primary' },
  { icon:'🌐', label:'Customer Portal', sub:'พอร์ทัลลูกค้า', path:'/crm/portal', color:'accent' },
]

export default async function CrmDashboard(container) {
  const myGen = container.__routerGen
  seedDemoData()

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">👥 CRM Dashboard</div>
          <div class="page-subtitle">บริหารการขายครบวงจร</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" data-nav="/crm/customers">+ ลูกค้าใหม่</button>
        </div>
      </div>

      <!-- KPI skeleton -->
      <div class="kpi-grid" id="crm-kpis" style="margin-bottom:20px">
        ${[...Array(5)].map(() => `<div class="skeleton" style="height:88px;border-radius:var(--radius-lg)"></div>`).join('')}
      </div>

      <!-- Alerts: สแกนจากข้อมูลจริง (ลูกค้า/ใบจอง) — ดูรูปแบบเดียวกับ Intelligence Center ใน Dashboard.js -->
      <div id="crm-alerts" style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px">
        <div class="skeleton" style="height:38px;border-radius:var(--radius-sm)"></div>
        <div class="skeleton" style="height:38px;border-radius:var(--radius-sm)"></div>
      </div>

      <!-- Quick links -->
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">เมนูหลัก CRM</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px">
        ${QUICK_LINKS.map(q => `
          <div class="card card-lift" data-nav="${q.path}" style="padding:15px 16px;cursor:pointer;border-top:3px solid var(--${q.color})">
            <div style="font-size:1.6rem;margin-bottom:6px">${q.icon}</div>
            <div style="font-weight:700;font-size:0.86rem">${q.label}</div>
            <div style="font-size:0.71rem;color:var(--text-muted)">${q.sub}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  container.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) navigate(nav.dataset.nav)
  })

  if (container.__routerGen !== myGen) return

  let customers = [], sales = []
  try {
    ;[customers, sales] = await Promise.all([
      listDocs('customers', [], 'createdAt', 'desc', 500).catch(() => []),
      getSalesData().catch(() => []),
    ])
  } catch {}

  if (container.__routerGen !== myGen) return

  const hot = customers.filter(c => c.temperature === 'hot' && !c.isLost).length
  const activePipeline = customers.filter(c => ['lead', 'pp'].includes(c.stage) && !c.isLost).length
  const bookingValue = sales.reduce((s, b) => s + (b.salePrice || 0), 0)

  const kpiEl = document.getElementById('crm-kpis')
  if (kpiEl) kpiEl.innerHTML = `
    ${kCard('👥', 'ลูกค้าทั้งหมด', customers.length, 'primary', '/crm/customers')}
    ${kCard('🔥', 'ลูกค้า Hot', hot, 'danger', '/crm/customers')}
    ${kCard('🧲', 'Lead/Prospect Active', activePipeline, 'accent', '/crm/customers')}
    ${kCard('📝', 'ใบจอง', sales.length, 'warning', '/crm/bookings')}
    ${kCard('💰', 'ยอดขายรวม', formatCurrency(bookingValue), 'success', '/crm/bookings')}
  `

  renderAlerts(customers, sales)
}

// ── Alerts: สแกนเรื่องค้าง/ด่วนจากข้อมูลจริง (customers + sales) — CRM-scoped version ของ
// Intelligence Center ใน Dashboard.js — กดแล้วพาไปหน้านั้น ──
function renderAlerts(customers, sales) {
  const el = document.getElementById('crm-alerts')
  if (!el) return
  const now = Date.now()
  const daysSince = d => Math.floor((now - new Date(d).getTime()) / 86400000)
  const alerts = []

  // Lead ใหม่ยังไม่ได้ติดตาม (ยังไม่มีเบอร์/LINE) เกิน 3 วัน
  const staleLeads = customers.filter(c => c.stage === 'lead' && !c.isLost && c.createdAt && daysSince(c.createdAt) >= 3)
  if (staleLeads.length) alerts.push({ type: 'danger', icon: '🧲', nav: '/crm/customers', msg: `Lead ใหม่ยังไม่ติดตามเกิน 3 วัน: ${staleLeads.length} ราย` })

  // ลูกค้า Hot ที่ยังไม่ได้ติดต่อต่อเนื่องเกิน 3 วัน
  const staleHot = customers.filter(c => c.temperature === 'hot' && !c.isLost && c.stage !== 'delivered' && c.stageChangedAt && daysSince(c.stageChangedAt) >= 3)
  if (staleHot.length) alerts.push({ type: 'warning', icon: '🔥', nav: '/crm/customers', msg: `ลูกค้า Hot ยังไม่ได้ติดตามเกิน 3 วัน: ${staleHot.length} ราย` })

  // ใบจองค้างสถานะ (ยังไม่ส่งมอบ/ไม่ถอน) เกิน 14 วัน
  const stuckBookings = sales.filter(s => !s.delivered && s.status !== 'ถอนจอง' && s.date && daysSince(s.date) >= 14)
  if (stuckBookings.length) alerts.push({ type: 'warning', icon: '⏳', nav: '/crm/bookings', msg: `ใบจองค้างสถานะเกิน 14 วัน: ${stuckBookings.length} รายการ` })

  el.innerHTML = alerts.length
    ? alerts.map(a => `
      <div data-nav="${a.nav}" style="padding:9px 13px;background:var(--surface-2);border-left:3px solid var(--${a.type});border-radius:var(--radius-sm);font-size:0.8rem;cursor:pointer">
        ${a.icon} ${a.msg}
      </div>`).join('')
    : `<div style="padding:9px 13px;background:var(--surface-2);border-left:3px solid var(--success);border-radius:var(--radius-sm);font-size:0.8rem">✅ ไม่มีเรื่องด่วนตอนนี้</div>`
}

function kCard(icon, label, value, color, nav) {
  const isLong = typeof value === 'string' && value.length > 10
  return `
    <div class="card card-lift" data-nav="${nav}" style="padding:16px 18px;cursor:pointer;border-left:3px solid var(--${color})">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:1.3rem">${icon}</span>
        <span style="font-size:${isLong ? '0.85rem' : '1.6rem'};font-weight:800;color:var(--${color})">${value}</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted)">${label}</div>
    </div>
  `
}
