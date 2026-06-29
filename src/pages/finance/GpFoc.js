// GP & FOC Analysis — วิเคราะห์กำไรขั้นต้น (Gross Profit) และของแถม (Free of Charge)
// อ่านจากใบจองกลาง (getSalesData) → ตรงกับ Margin/Commission เสมอ
import { seedDemoData, getSalesData } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// GP = ราคาขาย - ต้นทุน (กำไรขั้นต้น) ; FOC = ของแถม/งบที่ใช้แถม (budgetUsed)
function calcGpFoc(s) {
  const gp = (s.salePrice || 0) - (s.cost || 0)
  const gpPct = s.salePrice ? (gp / s.salePrice) * 100 : 0
  const foc = s.budgetUsed || 0                 // มูลค่าของแถม / FOC
  const focPct = gp ? (foc / gp) * 100 : 0      // FOC กินกำไรกี่ %
  const gpNet = gp - foc                         // GP สุทธิหลังหักของแถม
  return { gp, gpPct, foc, focPct, gpNet }
}

export default async function GpFocPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let sales = []
  let filtered = []
  let monthFilter = 'all'

  async function loadData() {
    try { sales = await getSalesData() } catch {}
    sales = sales.filter(s => s.status !== 'ถอนจอง')
    applyFilter()
  }

  function getMonths() {
    return [...new Set(sales.map(s => (s.date || '').slice(0, 7)).filter(Boolean))].sort().reverse()
  }

  function applyFilter() {
    filtered = sales.filter(s => monthFilter === 'all' || (s.date || '').startsWith(monthFilter))
    renderSummary(); renderTable()
  }

  function renderSummary() {
    const el = document.getElementById('gpfoc-summary')
    if (!el) return
    const totGp = filtered.reduce((t, s) => t + calcGpFoc(s).gp, 0)
    const totFoc = filtered.reduce((t, s) => t + calcGpFoc(s).foc, 0)
    const totGpNet = totGp - totFoc
    const totSale = filtered.reduce((t, s) => t + (s.salePrice || 0), 0)
    const avgGpPct = totSale ? (totGp / totSale * 100) : 0
    const focRatio = totGp ? (totFoc / totGp * 100) : 0

    el.innerHTML =
      card('💎', 'GP รวม (กำไรขั้นต้น)', formatCurrency(totGp), 'success', (avgGpPct).toFixed(1) + '% ของยอดขาย') +
      card('🎁', 'FOC รวม (ของแถม)', formatCurrency(totFoc), 'warning', 'กินกำไร ' + focRatio.toFixed(1) + '%') +
      card('✅', 'GP สุทธิ (หลังหักของแถม)', formatCurrency(totGpNet), 'accent', filtered.length + ' คัน') +
      card('📊', 'GP เฉลี่ย/คัน', formatCurrency(filtered.length ? Math.round(totGp / filtered.length) : 0), 'primary', 'FOC เฉลี่ย ' + formatCurrency(filtered.length ? Math.round(totFoc / filtered.length) : 0))
  }

  function renderTable() {
    const wrap = document.getElementById('gpfoc-table')
    if (!wrap) return
    if (!filtered.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:48px"><div class="empty-icon">💎</div><div class="empty-title">ไม่มีข้อมูล GP/FOC</div></div>'
      return
    }
    wrap.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>วันที่</th><th>ลูกค้า</th><th>รถ</th><th>ราคาขาย</th><th>ต้นทุน</th>' +
        '<th>GP</th><th>GP %</th><th>FOC (ของแถม)</th><th>FOC % ของ GP</th><th>GP สุทธิ</th><th>เซลส์</th>' +
      '</tr></thead><tbody>' +
      filtered.map(s => {
        const g = calcGpFoc(s)
        const gpColor = g.gpPct >= 10 ? 'var(--success)' : g.gpPct >= 5 ? 'var(--warning)' : 'var(--danger)'
        const focColor = g.focPct > 50 ? 'var(--danger)' : g.focPct > 25 ? 'var(--warning)' : 'var(--text-2)'
        return '<tr>' +
          '<td style="font-size:0.78rem;color:var(--text-muted)">' + formatDate(s.date) + '</td>' +
          '<td style="font-weight:600">' + (s.custName ? escHtml(s.custName) : '-') + '</td>' +
          '<td style="font-size:0.82rem">' + escHtml((s.brand || '') + ' ' + (s.model || '')) + '</td>' +
          '<td style="font-weight:600;color:var(--accent)">' + formatCurrency(s.salePrice) + '</td>' +
          '<td style="color:var(--text-2)">' + formatCurrency(s.cost) + '</td>' +
          '<td style="font-weight:700;color:' + gpColor + '">' + formatCurrency(g.gp) + '</td>' +
          '<td style="font-weight:700;color:' + gpColor + '">' + g.gpPct.toFixed(1) + '%</td>' +
          '<td style="color:var(--warning)">' + (g.foc ? formatCurrency(g.foc) : '-') + '</td>' +
          '<td style="color:' + focColor + '">' + g.focPct.toFixed(0) + '%</td>' +
          '<td style="font-weight:800;color:' + (g.gpNet >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + formatCurrency(g.gpNet) + '</td>' +
          '<td style="font-size:0.8rem;color:var(--text-muted)">' + (s.salesName ? escHtml(s.salesName) : '-') + '</td>' +
        '</tr>'
      }).join('') +
      '</tbody></table></div>'
  }

  container.innerHTML =
    '<div class="page-content animate-slide">' +
      '<div class="page-header"><div>' +
        '<div class="page-title">💎 GP & FOC — กำไรขั้นต้น และของแถม</div>' +
        '<div class="page-subtitle">วิเคราะห์ Gross Profit และ Free of Charge ต่อคัน (อิงใบจองกลาง)</div>' +
      '</div><div class="page-actions"><button class="btn btn-secondary btn-sm" id="gpfoc-export">📥 Export</button></div></div>' +
      '<div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:10px">💡 GP = ราคาขาย − ต้นทุน · FOC = มูลค่าของแถม/งบที่ใช้แถม · GP สุทธิ = GP − FOC</div>' +
      '<div id="gpfoc-summary" class="grid-4 mb-6">' + [...Array(4)].map(() => '<div class="skeleton" style="height:88px;border-radius:var(--radius-lg)"></div>').join('') + '</div>' +
      '<div class="card mb-4" style="padding:10px 16px"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
        '<span style="font-size:0.85rem;color:var(--text-muted)">เดือน:</span>' +
        '<button class="btn btn-sm gpf-mf btn-primary" data-mf="all">ทั้งหมด</button>' +
        '<span id="gpf-months" style="display:flex;gap:6px;flex-wrap:wrap"></span>' +
      '</div></div>' +
      '<div id="gpfoc-table">' + [...Array(4)].map(() => '<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>').join('') + '</div>' +
    '</div>'

  function refreshMonths() {
    const wrap = document.getElementById('gpf-months')
    if (!wrap) return
    wrap.innerHTML = getMonths().map(m => '<button class="btn btn-sm gpf-mf ' + (m === monthFilter ? 'btn-primary' : 'btn-secondary') + '" data-mf="' + m + '">' + m + '</button>').join('')
    bindMonths()
  }
  function bindMonths() {
    document.querySelectorAll('.gpf-mf').forEach(btn => btn.onclick = () => {
      monthFilter = btn.dataset.mf
      document.querySelectorAll('.gpf-mf').forEach(b => b.className = 'btn btn-sm gpf-mf ' + (b.dataset.mf === monthFilter ? 'btn-primary' : 'btn-secondary'))
      applyFilter()
    })
  }

  document.getElementById('gpfoc-export').addEventListener('click', () => {
    exportToExcel(filtered.map(s => {
      const g = calcGpFoc(s)
      return { วันที่: s.date, ลูกค้า: s.custName, รถ: (s.brand || '') + ' ' + (s.model || ''), ราคาขาย: s.salePrice, ต้นทุน: s.cost, GP: g.gp, 'GP%': g.gpPct.toFixed(1), FOC: g.foc, 'FOC%ของGP': g.focPct.toFixed(0), GPสุทธิ: g.gpNet, เซลส์: s.salesName }
    }), 'gp-foc-' + new Date().toISOString().slice(0, 10) + '.xlsx', 'GP-FOC')
    showToast('📥 Export แล้ว', 'success')
  })

  if (container.__routerGen === myGen) { await loadData(); refreshMonths() }
}

function card(icon, label, value, color, sub) {
  return '<div class="card" style="padding:16px 18px;border-left:3px solid var(--' + color + ')">' +
    '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">' + icon + ' ' + label + '</div>' +
    '<div style="font-size:1.15rem;font-weight:800;color:var(--' + color + ')">' + value + '</div>' +
    '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px">' + sub + '</div>' +
  '</div>'
}
