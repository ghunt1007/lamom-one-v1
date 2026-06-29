import { listDocs, seedDemoData, getSalesData } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { formatCurrency } from '../../utils/format.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const QUICK_LINKS = [
  { icon:'📦', label:'สต็อกรถ', sub:'จัดการสินค้าคงคลัง', path:'/dms/stock', color:'primary' },
  { icon:'🛒', label:'สั่งรถใหม่', sub:'Build & Order', path:'/dms/orders', color:'accent' },
  { icon:'✅', label:'PDI', sub:'ตรวจก่อนส่งมอบ', path:'/dms/pdi', color:'success' },
  { icon:'🔄', label:'Trade-In', sub:'รับรถแลกเปลี่ยน', path:'/dms/tradein', color:'warning' },
  { icon:'🚗', label:'ใบส่งมอบรถ', sub:'Delivery Note', path:'/dms/delivery', color:'primary' },
  { icon:'📦', label:'รับรถเข้าสต็อก', sub:'Vehicle Receiving', path:'/dms/receiving', color:'success' },
  { icon:'💰', label:'Price List', sub:'ราคา & โปรโมชัน', path:'/dms/pricelist', color:'warning' },
  { icon:'🚛', label:'โอนรถ', sub:'Transfer ระหว่างสาขา', path:'/dms/transfer', color:'accent' },
  { icon:'🤝', label:'Suppliers', sub:'ซัพพลายเออร์รถ', path:'/dms/suppliers', color:'primary' },
  { icon:'📦', label:'Stock Valuation', sub:'มูลค่าสต็อก', path:'/dms/stockvalue', color:'success' },
  { icon:'⚖️', label:'เปรียบเทียบรถ', sub:'Compare Models', path:'/dms/compare', color:'accent' },
  { icon:'⏳', label:'Vehicle Aging', sub:'รถอยู่นาน > 90 วัน', path:'/dms/aging', color:'danger' },
  { icon:'🎉', label:'Delivery Calendar', sub:'ตารางส่งมอบ', path:'/dms/delivery-calendar', color:'primary' },
  { icon:'🔑', label:'Key Management', sub:'จัดการกุญแจรถ', path:'/dms/keys', color:'warning' },
  { icon:'🚗', label:'Demo Fleet', sub:'รถทดสอบ', path:'/dms/demo-fleet', color:'accent' },
  { icon:'📊', label:'Stock Audit', sub:'ตรวจนับสต็อก', path:'/dms/stock-audit', color:'success' },
]

const DEMO_ALERTS = [
  { type: 'danger', msg: 'รถ 2 คันอยู่นาน > 6 เดือน (Vehicle Aging) ควรทำโปร' },
  { type: 'warning', msg: 'PDI รอดำเนินการ 3 คัน ก่อนส่งมอบลูกค้า' },
  { type: 'success', msg: 'Trade-In รอประเมินราคา 2 คัน ✅' },
]

export default async function DmsDashboard(container) {
  const myGen = container.__routerGen
  seedDemoData()

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🚗 DMS Dashboard</div>
          <div class="page-subtitle">ภาพรวมโชว์รูมและสต็อกรถ</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" data-nav="/dms/receiving">+ รับรถเข้าสต็อก</button>
        </div>
      </div>

      <!-- KPI skeleton -->
      <div class="kpi-grid" id="dms-kpis" style="margin-bottom:20px">
        ${[...Array(5)].map(() => `<div class="skeleton" style="height:88px;border-radius:var(--radius-lg)"></div>`).join('')}
      </div>

      <!-- Alerts -->
      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px">
        ${DEMO_ALERTS.map(a => `
          <div style="padding:9px 13px;background:var(--surface-2);border-left:3px solid var(--${a.type === 'danger' ? 'danger' : a.type === 'warning' ? 'warning' : 'success'});border-radius:var(--radius-sm);font-size:0.8rem">
            ${a.type === 'danger' ? '🔴' : a.type === 'warning' ? '⚠️' : '✅'} ${a.msg}
          </div>`).join('')}
      </div>

      <!-- Quick links -->
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">เมนูหลัก โชว์รูม</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px;margin-bottom:24px">
        ${QUICK_LINKS.map(q => `
          <div class="card card-lift" data-nav="${q.path}" style="padding:15px 16px;cursor:pointer;border-top:3px solid var(--${q.color})">
            <div style="font-size:1.6rem;margin-bottom:6px">${q.icon}</div>
            <div style="font-weight:700;font-size:0.86rem">${q.label}</div>
            <div style="font-size:0.71rem;color:var(--text-muted)">${q.sub}</div>
          </div>
        `).join('')}
      </div>

      <!-- Recent stock -->
      <div class="card">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600;font-size:0.88rem">📦 สต็อกล่าสุด</div>
          <button class="btn btn-ghost btn-sm" data-nav="/dms/stock">ดูทั้งหมด →</button>
        </div>
        <div id="dms-recent-stock" style="padding:10px 16px">
          ${[...Array(3)].map(() => `<div class="skeleton" style="height:30px;border-radius:4px;margin-bottom:6px"></div>`).join('')}
        </div>
      </div>
    </div>
  `

  container.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) navigate(nav.dataset.nav)
  })

  if (container.__routerGen !== myGen) return

  let stock = [], orders = [], pdis = [], sales = []
  try {
    ;[stock, orders, pdis, sales] = await Promise.all([
      listDocs('vehicles', [], 'arrivedAt', 'desc', 500).catch(() => []),
      listDocs('vehicle_orders', [], 'createdAt', 'desc', 100).catch(() => []),
      listDocs('pdi', [], 'startDate', 'desc', 100).catch(() => []),
      getSalesData().catch(() => []),
    ])
  } catch {}

  if (container.__routerGen !== myGen) return

  const available = stock.filter(v => v.status === 'available').length
  const activeOrders = orders.filter(o => !['cancelled', 'arrived'].includes(o.status)).length
  const pendingPdi = pdis.filter(p => ['pending', 'inprogress'].includes(p.status)).length
  const salesValue = sales.reduce((s, b) => s + (b.salePrice || 0), 0)

  const kpiEl = document.getElementById('dms-kpis')
  if (kpiEl) kpiEl.innerHTML = `
    ${kCard('📦', 'พร้อมขาย', available, 'success', '/dms/stock')}
    ${kCard('📝', 'ใบจอง', sales.length, 'warning', '/crm/bookings')}
    ${kCard('💰', 'ยอดขาย', formatCurrency(salesValue), 'accent', '/crm/bookings')}
    ${kCard('🛒', 'คำสั่งซื้อ', activeOrders, 'primary', '/dms/orders')}
    ${kCard('🔧', 'รอ PDI', pendingPdi, 'danger', '/dms/pdi')}
  `

  const recentEl = document.getElementById('dms-recent-stock')
  if (recentEl) {
    const recent = stock.slice(0, 6)
    if (!recent.length) {
      recentEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:10px 0">ยังไม่มีข้อมูลสต็อก</div>`
      return
    }
    const STATUS_COLOR = { available:'success', reserved:'warning', sold:'primary', pdi:'accent', transit:'warning', demo:'primary' }
    recentEl.innerHTML = recent.map(v => `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer" data-nav="/dms/stock">
        <span style="font-size:1rem">🚗</span>
        <div style="flex:1;min-width:0">
          <span style="font-weight:600;font-size:0.85rem">${escHtml(v.brand)} ${escHtml(v.model)}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);margin-left:6px">${escHtml(v.color || '')}</span>
        </div>
        <span class="badge badge-${STATUS_COLOR[v.status] || 'primary'}" style="font-size:0.68rem">${escHtml(v.status)}</span>
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
