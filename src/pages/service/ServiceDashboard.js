import { listDocs, seedDemoData } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { formatCurrency } from '../../utils/format.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const QUICK_LINKS = [
  { icon:'🗂️', label:'Job Card', sub:'งานซ่อมทุกคัน', path:'/service/jobs', color:'primary' },
  { icon:'🔩', label:'คลังอะไหล่', sub:'สต็อกและสั่งซื้อ', path:'/service/parts', color:'accent' },
  { icon:'📅', label:'นัดหมาย', sub:'Service Appointment', path:'/service/appointment', color:'success' },
  { icon:'📦', label:'สั่งซื้ออะไหล่', sub:'Parts Order', path:'/service/parts-order', color:'warning' },
  { icon:'🛡', label:'การรับประกัน', sub:'Warranty Management', path:'/service/warranty', color:'primary' },
  { icon:'🕒', label:'ประวัติซ่อม', sub:'Service History', path:'/service/history', color:'accent' },
  { icon:'⚡', label:'EV Diagnostic', sub:'วินิจฉัยรถไฟฟ้า', path:'/service/ev-diagnostic', color:'success' },
  { icon:'👨‍🔧', label:'ตารางช่าง', sub:'Technician Schedule', path:'/service/technicians', color:'warning' },
  { icon:'🅿️', label:'Bay Management', sub:'จัดการเบย์ซ่อม', path:'/service/bay', color:'danger' },
  { icon:'📋', label:'Recall', sub:'การเรียกคืนรถ', path:'/service/recall', color:'primary' },
  { icon:'💰', label:'ใบประเมินราคา', sub:'Repair Estimate', path:'/service/estimate', color:'accent' },
  { icon:'🎯', label:'KPI ช่าง', sub:'ผลงานช่างรายคน', path:'/service/tech-kpi', color:'success' },
  { icon:'🚗', label:'รถรับรอง', sub:'Loaner Car', path:'/service/loaner', color:'warning' },
  { icon:'🚿', label:'คิวล้างรถ', sub:'Wash Queue', path:'/service/wash', color:'primary' },
  { icon:'🔔', label:'Service Reminder', sub:'แจ้งเตือนลูกค้า', path:'/service/reminders', color:'accent' },
  { icon:'🔋', label:'EV Battery', sub:'ตรวจสุขภาพแบต', path:'/service/ev-battery', color:'success' },
]

const DEMO_ALERTS = [
  { type: 'danger',  msg: 'อะไหล่ใกล้หมด 3 รายการ — ควรสั่งซื้อทันที' },
  { type: 'warning', msg: 'นัดหมาย Service วันนี้ 5 คัน — ยังไม่เช็คอิน 2 คัน' },
  { type: 'success', msg: 'งาน QC ผ่านพร้อมส่งคืนลูกค้า 1 คัน ✅' },
]

const STATUS_COLORS = {
  waiting: 'primary', checkin: 'accent', diagnosing: 'primary',
  inprogress: 'warning', waiting_parts: 'danger', qc: 'success',
  done: 'success', delivered: 'primary',
}

export default async function ServiceDashboard(container) {
  const myGen = container.__routerGen
  seedDemoData()

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🔧 Service Dashboard</div>
          <div class="page-subtitle">ภาพรวมงานซ่อม อะไหล่ และนัดหมาย</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" data-nav="/service/jobs">+ เปิด Job Card</button>
        </div>
      </div>

      <!-- KPI skeleton -->
      <div class="kpi-grid" id="svc-kpis" style="margin-bottom:20px">
        ${[...Array(4)].map(() => `<div class="skeleton" style="height:88px;border-radius:var(--radius-lg)"></div>`).join('')}
      </div>

      <!-- Alerts -->
      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px">
        ${DEMO_ALERTS.map(a => `
          <div style="padding:9px 13px;background:var(--surface-2);border-left:3px solid var(--${a.type === 'danger' ? 'danger' : a.type === 'warning' ? 'warning' : 'success'});border-radius:var(--radius-sm);font-size:0.8rem">
            ${a.type === 'danger' ? '🔴' : a.type === 'warning' ? '⚠️' : '✅'} ${a.msg}
          </div>`).join('')}
      </div>

      <!-- Quick links -->
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">เมนูหลัก Service</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px;margin-bottom:24px">
        ${QUICK_LINKS.map(q => `
          <div class="card card-lift" data-nav="${q.path}" style="padding:15px 16px;cursor:pointer;border-top:3px solid var(--${q.color})">
            <div style="font-size:1.6rem;margin-bottom:6px">${q.icon}</div>
            <div style="font-weight:700;font-size:0.86rem">${q.label}</div>
            <div style="font-size:0.71rem;color:var(--text-muted)">${q.sub}</div>
          </div>
        `).join('')}
      </div>

      <!-- Active jobs -->
      <div class="card">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600;font-size:0.88rem">🔧 งานที่กำลังซ่อม</div>
          <button class="btn btn-ghost btn-sm" data-nav="/service/jobs">ดูทั้งหมด →</button>
        </div>
        <div id="svc-active-jobs" style="padding:10px 16px">
          ${[...Array(3)].map(() => `<div class="skeleton" style="height:32px;border-radius:4px;margin-bottom:6px"></div>`).join('')}
        </div>
      </div>
    </div>
  `

  container.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) navigate(nav.dataset.nav)
  })

  if (container.__routerGen !== myGen) return

  let jobs = [], parts = []
  try {
    ;[jobs, parts] = await Promise.all([
      listDocs('job_cards', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('parts', [], 'name', 'asc', 1000).catch(() => []),
    ])
  } catch {}

  if (container.__routerGen !== myGen) return

  const active = jobs.filter(j => !['done', 'delivered'].includes(j.status))
  const done = jobs.filter(j => j.status === 'done' || j.status === 'delivered')
  const revenue = done.reduce((s, j) => s + (j.labor || 0), 0)
  const lowParts = parts.filter(p => (p.qty || 0) <= (p.minQty || 0)).length

  const kpiEl = document.getElementById('svc-kpis')
  if (kpiEl) kpiEl.innerHTML = `
    ${kCard('🔧', 'งาน Active', active.length, 'warning', '/service/jobs')}
    ${kCard('✅', 'เสร็จแล้ว', done.length, 'success', '/service/jobs')}
    ${kCard('💰', 'รายได้ค่าแรง', formatCurrency(revenue), 'accent', '/service/jobs')}
    ${kCard('⚠️', 'อะไหล่ใกล้หมด', lowParts || 3, 'danger', '/service/parts')}
  `

  const activeEl = document.getElementById('svc-active-jobs')
  if (activeEl) {
    if (!active.length) {
      activeEl.innerHTML = `<div style="color:var(--success);font-size:0.85rem;padding:8px">✅ ไม่มีงานค้างอยู่</div>`
      return
    }
    const JOB_STATUS_LABEL = {
      waiting: '⏳ รอรับรถ', checkin: '🔑 รับรถแล้ว', diagnosing: '🔍 วินิจฉัย',
      inprogress: '🔧 กำลังซ่อม', waiting_parts: '📦 รออะไหล่', qc: '✅ QC',
    }
    activeEl.innerHTML = active.slice(0, 6).map(j => `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer" data-nav="/service/jobs">
        <div style="font-size:1rem">🔧</div>
        <div style="flex:1;min-width:0">
          <span style="font-weight:600;font-size:0.85rem">${escHtml(j.custName)}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);margin-left:6px">${escHtml(j.brand)} ${escHtml(j.model)}</span>
        </div>
        <span class="badge badge-${STATUS_COLORS[j.status] || 'primary'}" style="font-size:0.68rem;white-space:nowrap">${JOB_STATUS_LABEL[j.status] || escHtml(j.status)}</span>
      </div>
    `).join('')
  }
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
