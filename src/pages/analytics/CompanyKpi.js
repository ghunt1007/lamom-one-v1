import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getSalesData } from '../../core/db.js'

const PERIODS = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'ทั้งปี 2025']

// All company-wide KPIs with actual vs target
const COMPANY_KPIS = {
  sales: {
    label: '💰 ยอดขาย', color: 'success', icon: '💰',
    kpis: [
      { name: 'ยอดขายรถยนต์', unit: 'บาท', target: 120000000, actual: 134840000, lowerIsBetter: false, format: 'currency' },
      { name: 'จำนวนคันที่ขาย', unit: 'คัน', target: 100, actual: 117, lowerIsBetter: false, format: 'number' },
      { name: 'Gross Margin', unit: '%', target: 15, actual: 16.2, lowerIsBetter: false, format: 'percent' },
      { name: 'Conversion Rate', unit: '%', target: 25, actual: 30, lowerIsBetter: false, format: 'percent' },
      { name: 'Avg Deal Size', unit: 'บาท', target: 1100000, actual: 1152000, lowerIsBetter: false, format: 'currency' },
    ]
  },
  service: {
    label: '🔧 บริการ', color: 'warning', icon: '🔧',
    kpis: [
      { name: 'รายได้ Service', unit: 'บาท', target: 2000000, actual: 2234000, lowerIsBetter: false, format: 'currency' },
      { name: 'จำนวนงานซ่อม', unit: 'งาน', target: 300, actual: 312, lowerIsBetter: false, format: 'number' },
      { name: 'CSAT Score', unit: '/5', target: 4.5, actual: 4.6, lowerIsBetter: false, format: 'decimal' },
      { name: 'Rework Rate', unit: '%', target: 3, actual: 2.4, lowerIsBetter: true, format: 'percent' },
      { name: 'Bay Utilization', unit: '%', target: 80, actual: 76, lowerIsBetter: false, format: 'percent' },
    ]
  },
  crm: {
    label: '👥 CRM', color: 'primary', icon: '👥',
    kpis: [
      { name: 'Lead จำนวนใหม่', unit: 'ราย', target: 500, actual: 542, lowerIsBetter: false, format: 'number' },
      { name: 'Lead Conversion', unit: '%', target: 20, actual: 21.6, lowerIsBetter: false, format: 'percent' },
      { name: 'Customer Satisfaction (NPS)', unit: 'คะแนน', target: 50, actual: 62, lowerIsBetter: false, format: 'number' },
      { name: 'Repeat Customer Rate', unit: '%', target: 15, actual: 12, lowerIsBetter: false, format: 'percent' },
      { name: 'Follow-up Compliance', unit: '%', target: 90, actual: 85, lowerIsBetter: false, format: 'percent' },
    ]
  },
  hr: {
    label: '👤 HR', color: 'accent', icon: '👤',
    kpis: [
      { name: 'อัตราการมาทำงาน', unit: '%', target: 95, actual: 94, lowerIsBetter: false, format: 'percent' },
      { name: 'Turnover Rate', unit: '%', target: 10, actual: 8, lowerIsBetter: true, format: 'percent' },
      { name: 'Training Hours/Person', unit: 'ชม.', target: 20, actual: 18, lowerIsBetter: false, format: 'number' },
      { name: 'Avg KPI Score', unit: '%', target: 80, actual: 82, lowerIsBetter: false, format: 'percent' },
    ]
  },
  finance: {
    label: '💳 การเงิน', color: 'accent', icon: '💳',
    kpis: [
      { name: 'Net Profit Margin', unit: '%', target: 8, actual: 9.2, lowerIsBetter: false, format: 'percent' },
      { name: 'ROI', unit: '%', target: 15, actual: 18.5, lowerIsBetter: false, format: 'percent' },
      { name: 'Cash Flow Net', unit: 'บาท', target: 5000000, actual: 6150000, lowerIsBetter: false, format: 'currency' },
      { name: 'DSO (วันเก็บเงิน)', unit: 'วัน', target: 30, actual: 28, lowerIsBetter: true, format: 'number' },
    ]
  },
  marketing: {
    label: '📣 การตลาด', color: 'danger', icon: '📣',
    kpis: [
      { name: 'Marketing ROI', unit: '%', target: 200, actual: 245, lowerIsBetter: false, format: 'percent' },
      { name: 'CPL (ต้นทุนต่อ Lead)', unit: 'บาท', target: 500, actual: 420, lowerIsBetter: true, format: 'currency' },
      { name: 'Social Reach', unit: 'คน', target: 50000, actual: 68000, lowerIsBetter: false, format: 'number' },
      { name: 'Campaign CTR', unit: '%', target: 3, actual: 3.8, lowerIsBetter: false, format: 'percent' },
    ]
  }
}

function calcScore(kpi) {
  if (kpi.lowerIsBetter) {
    if (kpi.actual <= kpi.target) return 100
    return Math.max(0, Math.round((kpi.target / kpi.actual) * 100))
  }
  return Math.min(150, Math.round((kpi.actual / kpi.target) * 100))
}

function scoreLabel(s) {
  if (s >= 110) return { label: 'เกินเป้า ⭐', color: 'success' }
  if (s >= 90) return { label: 'บรรลุเป้า ✓', color: 'success' }
  if (s >= 70) return { label: 'ใกล้เป้า', color: 'warning' }
  return { label: 'ต่ำกว่าเป้า', color: 'danger' }
}

function fmtVal(kpi, val) {
  if (kpi.format === 'currency') return formatCurrency(val)
  if (kpi.format === 'percent') return val + '%'
  if (kpi.format === 'decimal') return val.toFixed(1)
  return val.toLocaleString()
}

export default async function CompanyKpiPage(container) {
  const myGen = container.__routerGen
  let period = 'Q2 2025'
  let catFilter = 'all'
  let liveKpi = null

  // Load real sales KPIs from bookings
  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return
    if (sales.length) {
      const totalRev = sales.reduce((a, s) => a + (s.salePrice || 0), 0)
      const totalUnits = sales.length
      const avgDeal = totalUnits ? Math.round(totalRev / totalUnits) : 0
      const marginsArr = sales.filter(s => s.margin > 0)
      const marginPct = marginsArr.length && totalRev > 0
        ? Math.round(marginsArr.reduce((a, s) => a + (s.margin || 0), 0) / totalRev * 1000) / 10
        : 0
      const delivered = sales.filter(s => s.delivered).length
      const convRate = totalUnits > 0 ? Math.round(delivered / totalUnits * 1000) / 10 : 0
      liveKpi = { totalRev, totalUnits, avgDeal, marginPct, delivered, convRate }
    }
  } catch {}

  function overallScore() {
    const allKpis = Object.values(COMPANY_KPIS).flatMap(c => c.kpis)
    return Math.round(allKpis.reduce((a, k) => a + calcScore(k), 0) / allKpis.length)
  }

  function catScore(cat) {
    const kpis = COMPANY_KPIS[cat].kpis
    return Math.round(kpis.reduce((a, k) => a + calcScore(k), 0) / kpis.length)
  }

  function renderPage() {
    const overall = overallScore()
    const sl = scoreLabel(overall)
    const cats = catFilter === 'all' ? Object.entries(COMPANY_KPIS) : Object.entries(COMPANY_KPIS).filter(([k]) => k === catFilter)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Company KPI Dashboard</div>
            <div class="page-subtitle">ภาพรวม KPI ระดับองค์กร — ทุกแผนก</div>
          </div>
          <div class="page-actions">
            <select class="input" id="period-sel" style="width:140px">
              ${PERIODS.map(p => `<option value="${p}" ${period===p?'selected':''}>${p}</option>`).join('')}
            </select>
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
          </div>
        </div>

        ${liveKpi ? `
        <div class="card" style="padding:12px 16px;margin-bottom:14px;border-left:3px solid var(--success);background:var(--success-dim)">
          <div style="font-size:0.74rem;font-weight:700;color:var(--success);margin-bottom:8px">● ยอดขายจริง (จากใบจองในระบบ)</div>
          <div style="display:flex;gap:20px;flex-wrap:wrap">
            ${[
              ['💰 ยอดขายรวม', formatCurrency(liveKpi.totalRev)],
              ['🚗 จำนวนคัน', liveKpi.totalUnits + ' คัน'],
              ['✅ ส่งมอบแล้ว', liveKpi.delivered + ' คัน'],
              ['💵 Avg Deal', formatCurrency(liveKpi.avgDeal)],
              liveKpi.marginPct > 0 ? ['📊 Gross Margin', liveKpi.marginPct + '%'] : null,
            ].filter(Boolean).map(([l, v]) => `
              <div style="font-size:0.82rem"><span style="color:var(--text-muted)">${l}:</span> <strong style="color:var(--success)">${v}</strong></div>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- Overall Score -->
        <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;margin-bottom:20px;align-items:start">
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Overall Score</div>
            <div style="font-size:3.5rem;font-weight:900;color:${overall>=90?'var(--success)':overall>=70?'var(--warning)':'var(--danger)'};line-height:1">${overall}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">/100</div>
            <div style="margin:10px 0">
              <span class="badge badge-${sl.color} badge-lg">${sl.label}</span>
            </div>
            <!-- Radial-like progress using CSS -->
            <div style="position:relative;width:100px;height:100px;margin:10px auto">
              <svg viewBox="0 0 100 100" style="transform:rotate(-90deg);width:100px;height:100px">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface-2)" stroke-width="8"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="${overall>=90?'var(--success)':overall>=70?'var(--warning)':'var(--danger)'}" stroke-width="8"
                  stroke-dasharray="${Math.round(overall * 2.513)} 251.3"
                  stroke-linecap="round"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:900;color:${overall>=90?'var(--success)':overall>=70?'var(--warning)':'var(--danger)'}">${overall}%</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted)">ไตรมาส: ${period}</div>
          </div>

          <!-- Category scores -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            ${Object.entries(COMPANY_KPIS).map(([cat, info]) => {
              const score = catScore(cat)
              const sl2 = scoreLabel(score)
              return `<div class="card" style="padding:12px;cursor:pointer${catFilter===cat?';border-color:var(--primary)':''}" onclick="document.getElementById('cat-btn-${cat}').click()">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span style="font-size:1rem">${info.icon}</span>
                  <span class="badge badge-${sl2.color}" style="font-size:0.62rem">${score}%</span>
                </div>
                <div style="font-size:0.8rem;font-weight:700;margin-bottom:4px">${info.label}</div>
                <div style="height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${Math.min(100,score)}%;background:var(--${info.color});border-radius:3px"></div>
                </div>
                <div style="font-size:0.68rem;color:var(--text-muted);margin-top:4px">${info.kpis.length} ตัวชี้วัด</div>
                <button id="cat-btn-${cat}" class="cat-btn" data-c="${cat}" style="display:none"></button>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Filter row -->
        <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
          <button class="btn btn-sm ${catFilter==='all'?'btn-primary':'btn-secondary'} cat-btn" data-c="all">ทุกแผนก</button>
          ${Object.entries(COMPANY_KPIS).map(([k,v]) => `<button class="btn btn-sm ${catFilter===k?'btn-primary':'btn-secondary'} cat-btn" data-c="${k}">${v.icon} ${v.label.replace(/[💰🔧👥👤💳📣]/g,'').trim()}</button>`).join('')}
        </div>

        <!-- KPI detail tables -->
        ${cats.map(([cat, info]) => {
          const score = catScore(cat)
          return `<div style="margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:1.1rem">${info.icon}</span>
              <span style="font-weight:800;font-size:0.92rem">${info.label}</span>
              <span class="badge badge-${scoreLabel(score).color}">${score}% • ${scoreLabel(score).label}</span>
            </div>
            <div class="card" style="padding:0;overflow:hidden">
              <table class="table">
                <thead><tr><th>ตัวชี้วัด</th><th class="text-right">เป้าหมาย</th><th class="text-right">ผลจริง</th><th class="text-right">% บรรลุ</th><th>แนวโน้ม</th><th>สถานะ</th></tr></thead>
                <tbody>
                  ${info.kpis.map(k => {
                    const score = calcScore(k)
                    const sl = scoreLabel(score)
                    const diff = k.actual - k.target
                    const isGood = k.lowerIsBetter ? diff <= 0 : diff >= 0
                    const arrow = isGood ? '↑' : '↓'
                    const arrowColor = isGood ? 'var(--success)' : 'var(--danger)'
                    return `<tr>
                      <td>
                        <div style="font-weight:600;font-size:0.85rem">${k.name}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted)">${k.unit}</div>
                      </td>
                      <td class="text-right" style="font-size:0.83rem">${fmtVal(k, k.target)}</td>
                      <td class="text-right" style="font-size:0.88rem;font-weight:700;color:${isGood?'var(--success)':'var(--danger)'}">${fmtVal(k, k.actual)}</td>
                      <td class="text-right">
                        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
                          <div style="width:60px;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${Math.min(100,score)}%;background:var(--${sl.color});border-radius:3px"></div>
                          </div>
                          <span style="font-size:0.82rem;font-weight:700;color:var(--${sl.color})">${score}%</span>
                        </div>
                      </td>
                      <td style="font-size:1rem;color:${arrowColor}">${arrow}</td>
                      <td><span class="badge badge-${sl.color}" style="font-size:0.68rem">${sl.label}</span></td>
                    </tr>`
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>`
        }).join('')}
      </div>
    `

    document.getElementById('period-sel')?.addEventListener('change', e => { period = e.target.value; renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const rows = []
      Object.entries(COMPANY_KPIS).forEach(([cat, info]) => {
        info.kpis.forEach(k => {
          rows.push({ แผนก: info.label, KPI: k.name, หน่วย: k.unit, เป้าหมาย: k.target, ผลจริง: k.actual, '%บรรลุ': calcScore(k) + '%', สถานะ: scoreLabel(calcScore(k)).label })
        })
      })
      exportToExcel(rows, `company_kpi_${period}`)
      showToast('📥 Export แล้ว!', 'success')
    })
    document.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
  }

  renderPage()
}
