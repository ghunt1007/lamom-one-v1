import { seedDemoData, getSalesData } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { formatCurrency } from '../../utils/format.js'

const QUICK_LINKS = [
  { icon:'📊', label:'Margin', sub:'กำไรต่อคัน', path:'/finance/margin', color:'success' },
  { icon:'🏆', label:'Commission', sub:'ค่าคอมเซลส์', path:'/finance/commission', color:'accent' },
  { icon:'💎', label:'GP & FOC', sub:'กำไรรวมและของแถม', path:'/finance/gp-foc', color:'primary' },
  { icon:'🎯', label:'งบขาย & งบแถม', sub:'ตั้งงบประจำปี', path:'/finance/sales-budget', color:'warning' },
  { icon:'📈', label:'Target vs Actual', sub:'เปรียบเทียบยอดจริง', path:'/finance/target-actual', color:'success' },
  { icon:'📉', label:'P&L', sub:'กำไร-ขาดทุน', path:'/finance/pl', color:'danger' },
  { icon:'💸', label:'Cash Flow', sub:'กระแสเงินสด', path:'/finance/cashflow', color:'primary' },
  { icon:'⚙️', label:'Commission Rules', sub:'กฎคำนวณค่าคอม', path:'/finance/commission-rules', color:'accent' },
  { icon:'💳', label:'Payroll', sub:'เงินเดือนพนักงาน', path:'/finance/payroll', color:'primary' },
  { icon:'🧾', label:'Invoice', sub:'ใบแจ้งหนี้', path:'/finance/invoice', color:'warning' },
  { icon:'🏦', label:'ยื่นไฟแนนซ์', sub:'สินเชื่อรถยนต์', path:'/finance/application', color:'accent' },
  { icon:'📋', label:'Budget Planning', sub:'วางแผนงบประมาณ', path:'/finance/budget', color:'success' },
  { icon:'🧾', label:'Tax Report', sub:'รายงานภาษี', path:'/finance/tax', color:'danger' },
  { icon:'💵', label:'Petty Cash', sub:'เงินสดย่อย', path:'/finance/petty-cash', color:'warning' },
  { icon:'🏦', label:'Bank Recon', sub:'กระทบยอดธนาคาร', path:'/finance/bank-recon', color:'primary' },
  { icon:'⚖️', label:'Break-even', sub:'จุดคุ้มทุน', path:'/finance/breakeven', color:'accent' },
]

export default async function FinanceDashboard(container) {
  const myGen = container.__routerGen
  seedDemoData()

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">💰 Finance Dashboard</div>
          <div class="page-subtitle">ภาพรวมการเงิน กำไร และค่าคอม</div>
        </div>
      </div>

      <!-- KPI skeleton -->
      <div class="kpi-grid" id="fin-kpis" style="margin-bottom:16px">
        ${[...Array(4)].map(() => `<div class="skeleton" style="height:88px;border-radius:var(--radius-lg)"></div>`).join('')}
      </div>

      <!-- Monthly summary (hidden until loaded) -->
      <div class="card" id="fin-monthly" style="padding:13px 16px;margin-bottom:20px;display:none"></div>

      <!-- Quick links -->
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">เมนูหลัก การเงิน</div>
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

  let sales = []
  try { sales = await getSalesData() } catch {}

  if (container.__routerGen !== myGen) return

  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthSales = sales.filter(s => (s.date || '').startsWith(thisMonth))
  const revenue = sales.reduce((t, s) => t + (s.salePrice || 0), 0)
  const net = sales.reduce((t, s) => {
    const g = (s.salePrice || 0) - (s.cost || 0)
    return t + g + (s.finance || 0) + (s.insurance || 0) + (s.accessory || 0) - (s.discount || 0)
  }, 0)
  const avgMargin = sales.length ? (net / revenue * 100).toFixed(1) : '0'
  const thisMonthRevenue = thisMonthSales.reduce((t, s) => t + (s.salePrice || 0), 0)

  const kpiEl = document.getElementById('fin-kpis')
  if (kpiEl) kpiEl.innerHTML = `
    ${kCard('🚗', 'รถขายรวม', `${sales.length} คัน`, 'primary', '/finance/margin')}
    ${kCard('💵', 'ยอดขายรวม', formatCurrency(revenue), 'accent', '/finance/margin')}
    ${kCard('📈', 'กำไรสุทธิรวม', formatCurrency(net), 'success', '/finance/margin')}
    ${kCard('📊', 'Margin เฉลี่ย', `${avgMargin}%`, 'warning', '/finance/margin')}
  `

  const moEl = document.getElementById('fin-monthly')
  if (moEl && thisMonthSales.length > 0) {
    moEl.style.display = 'block'
    moEl.innerHTML = `
      <div style="font-size:0.77rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📅 เดือนนี้ (${thisMonth})</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        ${mini('🚗 ขายได้', thisMonthSales.length + ' คัน')}
        ${mini('💵 ยอดขาย', formatCurrency(thisMonthRevenue))}
        ${mini('📈 Avg Deal', thisMonthSales.length > 0 ? formatCurrency(Math.round(thisMonthRevenue / thisMonthSales.length)) : '—')}
      </div>
    `
  }
}

function kCard(icon, label, value, color, nav) {
  return `
    <div class="card card-lift" data-nav="${nav}" style="padding:16px 18px;cursor:pointer;border-left:3px solid var(--${color})">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:1.3rem">${icon}</span>
        <span style="font-size:${value.length > 10 ? '0.85rem' : '1.5rem'};font-weight:800;color:var(--${color})">${value}</span>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted)">${label}</div>
    </div>
  `
}

function mini(l, v) {
  return `<div style="background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="color:var(--text-muted);font-size:0.68rem">${l}</div><div style="font-weight:700;font-size:0.88rem">${v}</div></div>`
}
