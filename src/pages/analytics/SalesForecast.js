import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getSalesData } from '../../core/db.js'

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// Historical actuals (2025 first half)
const ACTUALS = [
  { month: 0, units: 8,  revenue: 9200000,  leads: 65,  conversion: 12.3 },
  { month: 1, units: 6,  revenue: 6800000,  leads: 52,  conversion: 11.5 },
  { month: 2, units: 11, revenue: 13100000, leads: 88,  conversion: 12.5 },
  { month: 3, units: 9,  revenue: 10200000, leads: 72,  conversion: 12.5 },
  { month: 4, units: 13, revenue: 15400000, leads: 98,  conversion: 13.3 },
  { month: 5, units: 7,  revenue: 8300000,  leads: 64,  conversion: 10.9 },
]

// Simple moving-average forecast for remaining months
function calcForecast(actuals, growthRate) {
  const avg3Units = actuals.slice(-3).reduce((a, d) => a + d.units, 0) / 3
  const avg3Rev = actuals.slice(-3).reduce((a, d) => a + d.revenue, 0) / 3
  const avg3Leads = actuals.slice(-3).reduce((a, d) => a + d.leads, 0) / 3
  // Seasonal multipliers (rough Thai car market pattern)
  const seasonality = [0.85, 0.75, 1.0, 0.9, 1.05, 0.85, 0.9, 0.95, 0.9, 0.95, 1.1, 1.35]
  const forecastStart = actuals.length
  const months = []
  for (let m = forecastStart; m < 12; m++) {
    const growth = 1 + growthRate / 100
    const seasonMult = seasonality[m]
    months.push({
      month: m,
      units: Math.round(avg3Units * growth * seasonMult),
      revenue: Math.round(avg3Rev * growth * seasonMult),
      leads: Math.round(avg3Leads * growth * seasonMult),
      isForecast: true,
    })
  }
  return months
}

// Scenarios
const SCENARIOS = {
  pessimistic: { label: 'แย่', growth: -5, color: 'danger', icon: '📉' },
  base:        { label: 'ปกติ', growth: 5, color: 'warning', icon: '📊' },
  optimistic:  { label: 'ดี', growth: 15, color: 'success', icon: '📈' },
}

export default async function SalesForecastPage(container) {
  const myGen = container.__routerGen
  let scenario = 'base'
  let viewMetric = 'revenue'
  let actuals = [...ACTUALS]
  let dataSource = 'demo'

  // Load real monthly sales from bookings
  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return
    const byMonth = {}
    sales.forEach(s => {
      const mo = parseInt((s.date || '').slice(5, 7)) - 1
      if (isNaN(mo) || mo < 0 || mo > 11) return
      if (!byMonth[mo]) byMonth[mo] = { month: mo, units: 0, revenue: 0, leads: 0, conversion: 0 }
      byMonth[mo].units++
      byMonth[mo].revenue += s.salePrice || 0
    })
    const real = Object.values(byMonth).sort((a, b) => a.month - b.month)
    if (real.length >= 2) {
      real.forEach(d => { d.conversion = parseFloat((d.units / Math.max(d.leads || d.units * 8, 1) * 100).toFixed(1)) })
      actuals = real
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const sc = SCENARIOS[scenario]
    const forecast = calcForecast(actuals, sc.growth)
    const allMonths = [...actuals, ...forecast]

    const actualRevTotal = actuals.reduce((a, d) => a + d.revenue, 0)
    const forecastRevTotal = forecast.reduce((a, d) => a + d.revenue, 0)
    const yearTotal = actualRevTotal + forecastRevTotal
    const actualUnits = actuals.reduce((a, d) => a + d.units, 0)
    const forecastUnits = forecast.reduce((a, d) => a + d.units, 0)
    const yearUnits = actualUnits + forecastUnits

    const chartMax = Math.max(...allMonths.map(d => d[viewMetric]))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔮 Sales Forecast</div>
            <div class="page-subtitle">พยากรณ์ยอดขาย 2025 — Moving Average + Seasonality
              ${dataSource === 'live' ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● ข้อมูลจริงจากใบจอง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:8px">Demo</span>'}
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('💰 Actual H1', formatCurrency(actualRevTotal), 'success')}
          ${kpi('🔮 Forecast H2', formatCurrency(forecastRevTotal), sc.color)}
          ${kpi('📅 รวมทั้งปี', formatCurrency(yearTotal), 'primary')}
          ${kpi('🚗 คาดคัน H2', forecastUnits + ' คัน', sc.color)}
        </div>

        <!-- Scenario selector -->
        <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
          <span style="font-size:0.82rem;color:var(--text-muted);font-weight:600">สถานการณ์:</span>
          ${Object.entries(SCENARIOS).map(([k, s]) => `
            <button class="btn btn-sm ${scenario===k?'btn-'+s.color:'btn-secondary'} sc-btn" data-s="${k}">
              ${s.icon} ${s.label} (${s.growth > 0 ? '+' : ''}${s.growth}%)
            </button>
          `).join('')}
          <div style="margin-left:auto;display:flex;gap:4px">
            ${[['revenue','💰 รายได้'],['units','🚗 คัน'],['leads','🧲 Leads']].map(([k,l]) => `<button class="btn btn-xs ${viewMetric===k?'btn-primary':'btn-secondary'} vm-btn" data-m="${k}">${l}</button>`).join('')}
          </div>
        </div>

        <!-- Main chart -->
        <div class="card" style="padding:16px;margin-bottom:16px">
          <div style="font-weight:700;font-size:0.88rem;margin-bottom:14px">
            📊 พยากรณ์ ${viewMetric === 'revenue' ? 'รายได้' : viewMetric === 'units' ? 'จำนวนคัน' : 'Leads'} รายเดือน
            <span style="font-size:0.72rem;font-weight:400;color:var(--text-muted);margin-left:8px">■ Actual &nbsp; ░ Forecast</span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:4px;height:160px;border-bottom:1px solid var(--border);padding-bottom:8px">
            ${allMonths.map(d => {
              const val = d[viewMetric]
              const pct = chartMax ? Math.max(4, Math.round(val / chartMax * 100)) : 4
              const isForecast = d.isForecast
              const barColor = isForecast ? `var(--${sc.color})` : 'var(--primary)'
              const opacity = isForecast ? 0.55 : 0.9
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="font-size:0.52rem;color:var(--text-muted);writing-mode:vertical-lr;transform:rotate(180deg)">
                  ${viewMetric === 'revenue' ? (val/1000000).toFixed(1)+'M' : val}
                </div>
                <div style="width:100%;height:${pct}px;background:${barColor};border-radius:3px 3px 0 0;opacity:${opacity};${isForecast ? 'border:1px dashed rgba(255,255,255,.3)' : ''}"></div>
              </div>`
            }).join('')}
          </div>
          <div style="display:flex;gap:4px;margin-top:6px">
            ${allMonths.map(d => `<div style="flex:1;text-align:center;font-size:0.6rem;color:${d.isForecast?'var(--'+sc.color+')':'var(--text-muted)'}">${MONTHS_TH[d.month]}</div>`).join('')}
          </div>
        </div>

        <!-- Detailed table -->
        <div class="card" style="padding:0;overflow:hidden;overflow-x:auto">
          <table class="table">
            <thead>
              <tr>
                <th>เดือน</th><th>ประเภท</th>
                <th class="text-right">จำนวนคัน</th>
                <th class="text-right">รายได้</th>
                <th class="text-right">Avg Deal Size</th>
                <th class="text-right">Leads</th>
                <th class="text-right">Conversion%</th>
              </tr>
            </thead>
            <tbody>
              ${allMonths.map(d => {
                const avgDeal = d.units ? Math.round(d.revenue / d.units) : 0
                const conv = d.isForecast ? (d.leads ? (d.units / d.leads * 100).toFixed(1) : '—') : d.conversion.toFixed(1)
                return `<tr style="${d.isForecast ? 'opacity:0.8' : ''}">
                  <td style="font-weight:600">${MONTHS_TH[d.month]} 2025</td>
                  <td>
                    ${d.isForecast
                      ? `<span class="badge badge-${sc.color}" style="font-size:0.65rem">${sc.icon} Forecast</span>`
                      : `<span class="badge badge-primary" style="font-size:0.65rem">✅ Actual</span>`}
                  </td>
                  <td class="text-right" style="font-weight:${d.isForecast ? 400 : 700}">${d.units}</td>
                  <td class="text-right" style="color:var(--${d.isForecast ? sc.color : 'success'});font-weight:600">${formatCurrency(d.revenue)}</td>
                  <td class="text-right" style="font-size:0.83rem">${formatCurrency(avgDeal)}</td>
                  <td class="text-right">${d.leads}</td>
                  <td class="text-right">${conv}%</td>
                </tr>`
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-2)">
                <td colspan="2" style="font-weight:800;padding:10px 12px">รวมทั้งปี 2025</td>
                <td class="text-right" style="font-weight:800">${yearUnits} คัน</td>
                <td class="text-right" style="font-weight:800;color:var(--success)">${formatCurrency(yearTotal)}</td>
                <td class="text-right" style="font-size:0.83rem">${formatCurrency(Math.round(yearTotal / yearUnits))}</td>
                <td class="text-right">${allMonths.reduce((a,d)=>a+d.leads,0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Insight box -->
        <div class="card" style="padding:14px 16px;margin-top:14px;border-left:3px solid var(--${sc.color})">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px">💡 AI Insight — สถานการณ์ ${sc.label}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.6">
            ${scenario === 'optimistic'
              ? `📈 หากตลาด EV ยังเติบโต 15% และแคมเปญ Q3/Q4 ทำได้ดี คาดว่าปีนี้จะปิดที่ <strong>${formatCurrency(yearTotal)}</strong> — สูงกว่าเป้าหมายปี (~${formatCurrency(110000000)}) ถึง <strong>${Math.round((yearTotal/110000000-1)*100)}%</strong> แนะนำเพิ่มสต็อกก่อน Motor Expo ธ.ค.`
              : scenario === 'pessimistic'
              ? `📉 กรณีตลาดชะลอตัว -5% ควรเน้น Service Revenue และ Insurance Commission เพื่อชดเชย คาดรายได้รวม <strong>${formatCurrency(yearTotal)}</strong> — ต่ำกว่าเป้า พิจารณาลดต้นทุน Opex และเร่งปิด Lead ที่ค้างใน Pipeline`
              : `📊 สถานการณ์ปกติ growth 5% คาดรายได้รวม <strong>${formatCurrency(yearTotal)}</strong> ใกล้เคียงเป้าหมาย เน้นรักษา Conversion Rate และทำ Follow-up ลูกค้าที่ยังไม่ตัดสินใจ ช่วง Q4 ควรเพิ่มแคมเปญโปรโมชัน`}
          </div>
        </div>
      </div>
    `

    document.querySelectorAll('.sc-btn').forEach(b => b.addEventListener('click', () => { scenario = b.dataset.s; renderPage() }))
    document.querySelectorAll('.vm-btn').forEach(b => b.addEventListener('click', () => { viewMetric = b.dataset.m; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const forecast = calcForecast(actuals, SCENARIOS[scenario].growth)
      exportToExcel([...actuals, ...forecast].map(d => ({
        เดือน: MONTHS_TH[d.month] + ' 2025',
        ประเภท: d.isForecast ? 'Forecast' : 'Actual',
        คัน: d.units, รายได้: d.revenue, Leads: d.leads
      })), 'sales_forecast_2025')
      showToast('📥 Export แล้ว!', 'success')
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
