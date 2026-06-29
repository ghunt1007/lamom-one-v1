/**
 * Branch Comparison — เปรียบเทียบสาขา
 * Route: /analytics/branches
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

const BRANCHES = [
  { id: 'B01', name: 'สาขาบางนา', manager: 'ประพันธ์ ผู้จัดการ', sales: 22, revenue: 28578000, service: 412000, staff: 16, csat: 4.6, leads: 145, color: '#3b82f6' },
  { id: 'B02', name: 'สาขารามอินทรา', manager: 'สมศรี บริหาร', sales: 18, revenue: 23382000, service: 358000, staff: 14, csat: 4.4, leads: 122, color: '#10b981' },
  { id: 'B03', name: 'สาขารังสิต', manager: 'วิโรจน์ จัดการ', sales: 12, revenue: 15588000, service: 290000, staff: 10, csat: 4.7, leads: 98, color: '#f59e0b' },
]

const METRICS = [
  { key: 'sales', label: '🚗 ยอดขาย (คัน)', fmt: v => v + ' คัน' },
  { key: 'revenue', label: '💰 รายได้', fmt: v => formatCurrency(v) },
  { key: 'service', label: '🔧 รายได้บริการ', fmt: v => formatCurrency(v) },
  { key: 'leads', label: '🧲 Leads', fmt: v => v + ' ราย' },
  { key: 'csat', label: '⭐ CSAT', fmt: v => v + '/5' },
]

export default async function BranchComparisonPage(container) {
  const myGen = container.__routerGen
  let liveBranches = [...BRANCHES].map(b => ({ ...b }))
  let dataSource = 'demo'
  let metric = 'revenue'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const byBranch = {}
      for (const s of sales) {
        const br = s.branch || s.branchName || 'สาขาหลัก'
        if (!byBranch[br]) byBranch[br] = { sales: 0, revenue: 0 }
        byBranch[br].sales++
        byBranch[br].revenue += s.salePrice || 0
      }
      liveBranches = Object.entries(byBranch).map(([name, d], i) => {
        const demo = BRANCHES.find(b => b.name.includes(name)) || BRANCHES[i % BRANCHES.length]
        return { ...demo, name, sales: d.sales, revenue: d.revenue }
      })
      if (liveBranches.length === 0) liveBranches = [...BRANCHES].map(b => ({ ...b }))
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const m = METRICS.find(x => x.key === metric)
    const maxV = Math.max(...liveBranches.map(b => b[metric]))
    const totalRevenue = liveBranches.reduce((a, b) => a + b.revenue, 0)
    const totalSales = liveBranches.reduce((a, b) => a + b.sales, 0)
    const best = [...liveBranches].sort((a, b) => b[metric] - a[metric])[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏢 Branch Comparison</div>
            <div class="page-subtitle">เปรียบเทียบผลงานสาขา — เดือนนี้${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🏢 สาขา', liveBranches.length, 'primary')}
          ${kpi('🚗 ขายรวม', totalSales + ' คัน', 'success')}
          ${kpi('💰 รายได้รวม', formatCurrency(totalRevenue), 'warning')}
          ${kpi('👑 สาขาดีสุด', best?.name.replace('สาขา',''), 'secondary')}
        </div>

        <!-- Metric picker -->
        <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
          ${METRICS.map(mx => `<button class="btn btn-xs ${metric===mx.key?'btn-primary':'btn-secondary'} mx-btn" data-m="${mx.key}">${mx.label}</button>`).join('')}
        </div>

        <!-- Comparison bars -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">${m?.label} — แยกตามสาขา</div>
          ${[...BRANCHES].sort((a,b) => b[metric] - a[metric]).map((b, i) => {
            const pct = Math.round(b[metric] / maxV * 100)
            return `<div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px">
                <span>${i===0?'👑 ':''}${b.name}</span>
                <strong>${m?.fmt(b[metric])}</strong>
              </div>
              <div style="background:var(--surface-2);border-radius:4px;height:16px">
                <div style="width:${pct}%;background:${b.color};height:16px;border-radius:4px;transition:width .3s"></div>
              </div>
            </div>`
          }).join('')}
        </div>

        <!-- Full table -->
        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">สาขา</th>
                <th style="padding:8px 10px;text-align:right">ขาย</th>
                <th style="padding:8px 10px;text-align:right">รายได้</th>
                <th style="padding:8px 10px;text-align:right">บริการ</th>
                <th style="padding:8px 10px;text-align:right">฿/พนักงาน</th>
                <th style="padding:8px 10px;text-align:right">Leads</th>
                <th style="padding:8px 14px;text-align:right">CSAT</th>
              </tr>
            </thead>
            <tbody>
              ${liveBranches.map(b => {
                const perStaff = Math.round(b.revenue / b.staff)
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="width:8px;height:8px;border-radius:50%;background:${b.color}"></div>
                      <div>
                        <div style="font-weight:600">${b.name}</div>
                        <div style="font-size:0.65rem;color:var(--text-muted)">👤 ${b.manager} · ${b.staff} คน</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700">${b.sales}</td>
                  <td style="padding:8px 10px;text-align:right">${formatCurrency(b.revenue)}</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--text-muted)">${formatCurrency(b.service)}</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--text-muted)">${formatCurrency(perStaff)}</td>
                  <td style="padding:8px 10px;text-align:right">${b.leads}</td>
                  <td style="padding:8px 14px;text-align:right;color:var(--${b.csat>=4.5?'success':'warning'});font-weight:700">${b.csat}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.mx-btn').forEach(b => b.addEventListener('click', () => { metric = b.dataset.m; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        liveBranches.map(b => ({
          'สาขา': b.name,
          'ผู้จัดการ': b.manager,
          'ยอดขาย (คัน)': b.sales,
          'รายได้ (บาท)': b.revenue,
          'รายได้บริการ (บาท)': b.service,
          'Leads': b.leads,
          'CSAT': b.csat,
          'พนักงาน (คน)': b.staff,
        })),
        'Branch_Comparison.xlsx',
        'Branches'
      )
      showToast('📥 Export รายงานสาขาแล้ว', 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
