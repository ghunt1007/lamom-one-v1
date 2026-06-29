import { listDocs, seedDemoData, getSalesData } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DEMO_SALES = [
  { id:'s1', date:'2025-03-15', custName:'ธีรพงศ์ แสงทอง', brand:'BYD', model:'Seal AWD', plate:'กข-1234 กรุงเทพ', salePrice:1299000, cost:1150000, finance:150000, insurance:28000, accessory:35000, discount:20000, salesName:'อรนุช เซลส์ดี', createdAt:'2025-03-15' },
  { id:'s2', date:'2025-03-20', custName:'อรนุช พรหมมา', brand:'MG', model:'MG4 X', plate:'คง-5678 เชียงใหม่', salePrice:949000, cost:840000, finance:95000, insurance:22000, accessory:15000, discount:10000, salesName:'วิชัย ขายเก่ง', createdAt:'2025-03-20' },
  { id:'s3', date:'2025-04-01', custName:'กิตติพงษ์ วรรณศิลป์', brand:'DEEPAL', model:'S7 Pro', plate:'งจ-9012 ขอนแก่น', salePrice:1479000, cost:1320000, finance:200000, insurance:35000, accessory:60000, discount:30000, salesName:'อรนุช เซลส์ดี', createdAt:'2025-04-01' },
  { id:'s4', date:'2025-04-10', custName:'พิมพ์ชนก ทองสุข', brand:'NETA', model:'V II 400', plate:'จด-3456 กรุงเทพ', salePrice:769000, cost:680000, finance:80000, insurance:18000, accessory:12000, discount:5000, salesName:'วิชัย ขายเก่ง', createdAt:'2025-04-10' },
]

function calcMargin(s) {
  const gross = (s.salePrice || 0) - (s.cost || 0)
  const net = gross + (s.finance || 0) + (s.insurance || 0) + (s.accessory || 0) - (s.discount || 0)
  const pct = s.salePrice ? ((net / s.salePrice) * 100).toFixed(1) : '0'
  return { gross, net, pct }
}

export default async function MarginPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let sales = []
  let filtered = []
  let monthFilter = 'all'

  async function loadData() {
    try { sales = await getSalesData() } catch {}
    if (!sales.length) DEMO_SALES.forEach(s => sales.push({ ...s }))
    applyFilter()
  }

  function applyFilter() {
    filtered = sales.filter(s => {
      if (monthFilter === 'all') return true
      return (s.date || '').startsWith(monthFilter)
    })
    updateSummary(); renderTable()
  }

  function updateSummary() {
    const totalSales = filtered.reduce((t, s) => t + (s.salePrice || 0), 0)
    const totalCost = filtered.reduce((t, s) => t + (s.cost || 0), 0)
    const totalNet = filtered.reduce((t, s) => t + calcMargin(s).net, 0)
    const avgPct = filtered.length ? (filtered.reduce((t, s) => t + Number(calcMargin(s).pct), 0) / filtered.length).toFixed(1) : '0'

    const fields = { 'sum-sales': totalSales, 'sum-cost': totalCost, 'sum-net': totalNet }
    Object.entries(fields).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.textContent = formatCurrency(v) })
    const pctEl = document.getElementById('sum-pct')
    if (pctEl) { pctEl.textContent = `${avgPct}%`; pctEl.style.color = Number(avgPct) >= 10 ? 'var(--success)' : 'var(--danger)' }
    const cntEl = document.getElementById('sum-count'); if (cntEl) cntEl.textContent = `${filtered.length} คัน`
  }

  function renderTable() {
    const wrap = document.getElementById('margin-table')
    if (!wrap) return

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">📊</div><div class="empty-title">ไม่มีข้อมูล</div></div>`
      return
    }

    wrap.innerHTML = `<div class="table-wrap">
      <table>
        <thead><tr>
          <th>วันที่</th><th>ลูกค้า</th><th>รถ</th><th>ราคาขาย</th><th>ต้นทุนรถ</th>
          <th>กำไรหยาบ</th><th>Finance</th><th>ประกัน</th><th>อุปกรณ์</th><th>ส่วนลด</th>
          <th>กำไรสุทธิ</th><th>%</th><th>เซลส์</th>
        </tr></thead>
        <tbody>${filtered.map(s => {
          const m = calcMargin(s)
          return `
            <tr>
              <td style="font-size:0.78rem;color:var(--text-muted)">${formatDate(s.date)}</td>
              <td style="font-weight:600">${escHtml(s.custName)}</td>
              <td style="font-size:0.82rem">${escHtml(s.brand)} ${escHtml(s.model)}</td>
              <td style="font-weight:600;color:var(--accent)">${formatCurrency(s.salePrice)}</td>
              <td style="color:var(--text-2)">${formatCurrency(s.cost)}</td>
              <td style="color:${m.gross >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600">${formatCurrency(m.gross)}</td>
              <td style="color:var(--accent)">${formatCurrency(s.finance)}</td>
              <td style="color:var(--accent)">${formatCurrency(s.insurance)}</td>
              <td style="color:var(--accent)">${formatCurrency(s.accessory)}</td>
              <td style="color:var(--danger)">-${formatCurrency(s.discount)}</td>
              <td style="font-weight:700;font-size:1rem;color:${m.net >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(m.net)}</td>
              <td style="font-weight:700;color:${Number(m.pct) >= 10 ? 'var(--success)' : 'var(--warning)'}">${m.pct}%</td>
              <td style="font-size:0.8rem;color:var(--text-muted)">${s.salesName ? escHtml(s.salesName) : '-'}</td>
            </tr>`
        }).join('')}</tbody>
      </table>
    </div>`
  }

  // Get unique months
  function getMonths() {
    const months = [...new Set(sales.map(s => (s.date||'').slice(0,7)).filter(Boolean))].sort().reverse()
    return months
  }

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">📊 Margin per Car</div>
          <div class="page-subtitle">กำไรต่อคัน วิเคราะห์ยอดขาย</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="margin-export">📥 Export</button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="grid-4 mb-6">
        <div class="card" style="padding:16px 18px;border-left:3px solid var(--primary)">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">รถที่ขาย</div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--primary)" id="sum-count">-</div>
        </div>
        <div class="card" style="padding:16px 18px;border-left:3px solid var(--accent)">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">ยอดขายรวม</div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--accent)" id="sum-sales">-</div>
        </div>
        <div class="card" style="padding:16px 18px;border-left:3px solid var(--success)">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">กำไรสุทธิรวม</div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--success)" id="sum-net">-</div>
        </div>
        <div class="card" style="padding:16px 18px;border-left:3px solid var(--warning)">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">Margin เฉลี่ย</div>
          <div style="font-size:1.6rem;font-weight:800" id="sum-pct">-</div>
        </div>
      </div>

      <!-- Filter -->
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="font-size:0.85rem;color:var(--text-muted)">เดือน:</span>
          <button class="btn btn-sm mf-btn btn-primary" data-mf="all">ทั้งหมด</button>
          <div id="month-btns" style="display:flex;gap:6px;flex-wrap:wrap"></div>
        </div>
      </div>

      <div id="margin-table">
        ${[...Array(4)].map(() => `<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  document.getElementById('margin-export').addEventListener('click', () => {
    exportToExcel(filtered.map(s => {
      const m = calcMargin(s)
      return { วันที่:s.date, ลูกค้า:s.custName, รถ:`${s.brand} ${s.model}`, ราคาขาย:s.salePrice, ต้นทุน:s.cost, กำไรหยาบ:m.gross, Finance:s.finance, ประกัน:s.insurance, อุปกรณ์:s.accessory, ส่วนลด:s.discount, กำไรสุทธิ:m.net, Margin:m.pct+'%', เซลส์:s.salesName }
    }), `margin-${new Date().toISOString().slice(0,10)}.xlsx`, 'Margin')
    showToast('Export แล้ว', 'success')
  })
  document.querySelector('.mf-btn').addEventListener('click', () => { monthFilter = 'all'; refreshMonthBtns(); applyFilter() })

  function refreshMonthBtns() {
    const wrap = document.getElementById('month-btns')
    if (!wrap) return
    const months = getMonths()
    wrap.innerHTML = months.map(m => `<button class="btn btn-sm mf-btn ${m === monthFilter ? 'btn-primary' : 'btn-secondary'}" data-mf="${m}">${m}</button>`).join('')
    document.getElementById('month-btns').querySelectorAll('.mf-btn').forEach(btn => btn.addEventListener('click', () => {
      monthFilter = btn.dataset.mf; refreshMonthBtns(); applyFilter()
    }))
    document.querySelector('[data-mf="all"]').className = `btn btn-sm mf-btn ${monthFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`
  }

  if (container.__routerGen === myGen) {
    await loadData()
    refreshMonthBtns()
  }
}
