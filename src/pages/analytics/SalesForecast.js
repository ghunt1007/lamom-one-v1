import { formatCurrency, toDateStr, todayBangkok } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getSalesData, listDocs } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { kpi } from '../../utils/kpiCard.js'
import { loadSalesBudget, sumMonths } from '../../utils/salesBudget.js'
import { navigate } from '../../core/router.js'
import { loadDeliveryForecast } from '../../utils/deliveryForecastData.js'
import { forecastCards, insightCards } from '../../utils/forecastOverview.js'
import { FH_CSS, forecastHubHtml } from '../../utils/forecastHubView.js'

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']


// Simple moving-average forecast for remaining months
function calcForecast(actuals, growthRate) {
  // เดิมหารด้วย 3 ตรงๆเสมอ แม้ actuals มีข้อมูลจริงไม่ถึง 3 เดือน (เช่นต้นปีที่มีแค่ 1-2 เดือน) ทำให้ค่าเฉลี่ย
  // ที่ใช้พยากรณ์ต่ำกว่าความเป็นจริงไปมาก แก้ให้หารด้วยจำนวนเดือนที่มีจริง (สูงสุด 3) แทน
  const recent = actuals.slice(-3)
  const n = recent.length || 1
  const avg3Units = recent.reduce((a, d) => a + d.units, 0) / n
  const avg3Rev = recent.reduce((a, d) => a + d.revenue, 0) / n
  const avg3Leads = recent.reduce((a, d) => a + d.leads, 0) / n
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
  // ปี/เดือนตามเวลาไทย · ข้อมูลจริง = เดือนที่จบแล้วของปีนี้ (ม.ค. ถึงเดือนก่อน) ครบทุกเดือน แม้เดือนนั้นจะเป็น 0
  // (เดิมรวมยอดทุกปีไว้ในเดือนเดียวกัน เช่น ต.ค. ปีก่อน + ต.ค. ปีนี้ และข้ามเดือนที่ไม่มียอด ทำให้เดือนพยากรณ์เลื่อนผิด)
  const YEAR = Number(todayBangkok().slice(0, 4))
  const NOW_M = Number(todayBangkok().slice(5, 7)) - 1
  let scenario = 'base'
  let viewMetric = 'revenue'
  let actuals = Array.from({ length: NOW_M }, (_, m) => ({ month: m, units: 0, revenue: 0, leads: 0, conversion: 0 }))
  let dataSource = 'demo'
  let annualTarget = 0
  // (v1.0.1439) การ์ดคาดการณ์เดือนนี้/เดือนหน้า จากข้อมูลจริง (คำนวณครั้งเดียว เก็บ HTML ไว้ใช้ตอนวาดหน้าใหม่)
  let hubHtml = '<div class="fh-why" style="margin-bottom:18px">⏳ กำลังคำนวณจากข้อมูลจริงของร้าน…</div>'
  let customersForHub = []

  // Load real monthly sales from bookings
  try {
    const [sales, customersRaw] = await Promise.all([
      getSalesData(),
      listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 2000).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    // softDelete() ไม่ลบเอกสารจริง แค่ตั้ง deleted:true — กรองออกกันลูกค้าที่ลบไปแล้วปนในพยากรณ์ยอดขาย
    const customers = customersRaw.filter(x => !x.deleted)
    customersForHub = customers
    const byMonth = Object.fromEntries(actuals.map(a => [a.month, a]))
    sales.forEach(s => {
      if (String(s.date || '').slice(0, 4) !== String(YEAR)) return
      const mo = parseInt((s.date || '').slice(5, 7)) - 1
      if (isNaN(mo) || !byMonth[mo]) return
      byMonth[mo].units++
      byMonth[mo].revenue += s.salePrice || 0
    })
    // (v1.0.xxx) เดิม byMonth[mo].leads ไม่เคยถูกเพิ่มเลยทั้งไฟล์ ทำให้ตกไปใช้ fallback units*8 เสมอ แม้ label
    // บอกว่าเป็น "● ข้อมูลจริงจากใบจอง" — ดึง Lead จริงจาก customers.createdAt รายเดือน (pattern เดียวกับที่
    // AnalyticsDashboard.js ใช้ดึง Lead จริงจากคอลเลกชัน customers)
    customers.forEach(c => {
      const d = toDateStr(c.stageChangedAt || c.createdAt)
      if (d.slice(0, 4) !== String(YEAR)) return
      const mo = parseInt(d.slice(5, 7), 10) - 1
      if (byMonth[mo]) byMonth[mo].leads++
    })
    actuals.forEach(d => { d.conversion = d.leads ? parseFloat((d.units / d.leads * 100).toFixed(1)) : 0 })
    if (actuals.some(d => d.units)) dataSource = 'live'
  } catch {}

  // ดึงเป้ายอดขายรายปีจริงจาก sales_budgets (ถ้ามี) แทนตัวเลขเป้าที่ hardcode ไว้ตายตัว
  try {
    annualTarget = sumMonths((await loadSalesBudget(YEAR)).targets) || 0
  } catch {}

  async function loadHub() {
    try {
      const today = todayBangkok()
      const [{ fc, next, bookings }, reminders, jobs, testDrives, logs] = await Promise.all([
        loadDeliveryForecast({ today }),
        listDocs('service_reminders', companyScopeFilters(), 'dueDate', 'desc', 3000).catch(() => []),
        listDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
        listDocs('test_drives', companyScopeFilters(), 'date', 'desc', 1000).catch(() => []),
        listDocs('comm_logs', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
      ])
      hubHtml = forecastHubHtml(forecastCards({ fc, next, bookings, customers: customersForHub, reminders, jobs, today }))
        + '<div style="font-weight:700;font-size:0.92rem;margin:4px 0 10px">💡 ข้อมูลจริงที่ช่วยปิดการขาย <span style="font-size:0.72rem;font-weight:400;color:var(--text-muted)">คำนวณจากประวัติร้าน ไม่มีชื่อลูกค้า</span></div>'
        + forecastHubHtml(insightCards({ testDrives, bookings, customers: customersForHub, logs, jobs, today }))
    } catch { hubHtml = '<div class="fh-why" style="margin-bottom:18px">อ่านข้อมูลไม่สำเร็จ — ลองรีเฟรชหน้าอีกครั้ง</div>' }
    if (container.__routerGen !== myGen) return
    const el = container.querySelector('#fh-cards')
    if (el) { el.innerHTML = hubHtml; bindHub() }
  }
  function bindHub() {
    container.querySelectorAll('#fh-cards [data-nav]').forEach(c => c.addEventListener('click', () => navigate(c.dataset.nav)))
  }

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
            <div class="page-title">🔮 ศูนย์คาดการณ์</div>
            <div class="page-subtitle">เดือนนี้ · เดือนหน้า · ทั้งปี — คำนวณจากข้อมูลจริงของร้าน (เรื่องไหนประวัติไม่พอจะบอกว่ายังคาดไม่ได้)</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 ส่งออก</button>
          </div>
        </div>
        <style>${FH_CSS}</style>
        <div style="font-weight:700;font-size:0.92rem;margin-bottom:10px">📌 เดือนนี้และเดือนหน้า <span style="font-size:0.72rem;font-weight:400;color:var(--text-muted)">กดการ์ดเพื่อดูรายละเอียด</span></div>
        <div id="fh-cards">${hubHtml}</div>

        <div style="font-weight:700;font-size:0.92rem;margin:6px 0 4px">📆 ประมาณการทั้งปี ${YEAR + 543} <span style="font-size:0.72rem;font-weight:400;color:var(--text-muted)">แนวทางคร่าวๆ — เฉลี่ย 3 เดือนล่าสุดที่จบแล้ว × ฤดูกาลตลาดรถทั่วไป (ไม่ใช่ของร้าน)
          ${dataSource === 'live' ? '<span style="color:var(--success);margin-left:6px">● ยอดจริงจากใบจอง</span>' : '· ยังไม่มียอดปีนี้'}</span></div>
        <div style="height:10px"></div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi(actuals.length ? `💰 ยอดจริง ม.ค.–${MONTHS_TH[actuals.length - 1]}` : '💰 ยอดจริงปีนี้', formatCurrency(actualRevTotal), 'success')}
          ${kpi(`🔮 คาดการณ์ ${MONTHS_TH[actuals.length] || ''}–ธ.ค.`, formatCurrency(forecastRevTotal), sc.color)}
          ${kpi('📅 รวมทั้งปี', formatCurrency(yearTotal), 'primary')}
          ${kpi('🚗 คาดคัน (ที่เหลือของปี)', forecastUnits + ' คัน', sc.color)}
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
            <span style="font-size:0.72rem;font-weight:400;color:var(--text-muted);margin-left:8px">■ ยอดจริง &nbsp; ░ คาดการณ์</span>
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
          <div class="table-wrap"><table class="table">
            <thead>
              <tr>
                <th>เดือน</th><th>ประเภท</th>
                <th class="text-right">จำนวนคัน</th>
                <th class="text-right">รายได้</th>
                <th class="text-right">มูลค่าเฉลี่ย/ดีล</th>
                <th class="text-right">ลีด</th>
                <th class="text-right">ปิดได้%</th>
              </tr>
            </thead>
            <tbody>
              ${allMonths.map(d => {
                const avgDeal = d.units ? Math.round(d.revenue / d.units) : 0
                const conv = d.isForecast ? (d.leads ? (d.units / d.leads * 100).toFixed(1) : '—') : d.conversion.toFixed(1)
                return `<tr style="${d.isForecast ? 'opacity:0.8' : ''}">
                  <td style="font-weight:600">${MONTHS_TH[d.month]} ${YEAR + 543}</td>
                  <td>
                    ${d.isForecast
                      ? `<span class="badge badge-${sc.color}" style="font-size:0.65rem">${sc.icon} คาดการณ์</span>`
                      : `<span class="badge badge-primary" style="font-size:0.65rem">✅ ยอดจริง</span>`}
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
                <td colspan="2" style="font-weight:800;padding:10px 12px">รวมทั้งปี ${YEAR + 543}</td>
                <td class="text-right" style="font-weight:800">${yearUnits} คัน</td>
                <td class="text-right" style="font-weight:800;color:var(--success)">${formatCurrency(yearTotal)}</td>
                <td class="text-right" style="font-size:0.83rem">${formatCurrency(yearUnits ? Math.round(yearTotal / yearUnits) : 0)}</td>
                <td class="text-right">${allMonths.reduce((a,d)=>a+d.leads,0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table></div>
        </div>

        <!-- Insight box -->
        <div class="card" style="padding:14px 16px;margin-top:14px;border-left:3px solid var(--${sc.color})">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px">💡 สรุป — สถานการณ์ ${sc.label}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.6">
            ${(() => {
              const vsTarget = annualTarget > 0
                ? ` — ${yearTotal >= annualTarget ? 'สูงกว่า' : 'ต่ำกว่า'}เป้าหมายปี (${formatCurrency(annualTarget)}) <strong>${Math.abs(Math.round((yearTotal/annualTarget-1)*100))}%</strong>`
                : ' (ยังไม่ได้ตั้งเป้ายอดขายรายปีไว้ที่หน้า Sales Budget)'
              // (v1.0.1439) เดิมเป็นข้อความสำเร็จรูป (ตลาด EV/Motor Expo) ที่ไม่ได้มาจากข้อมูลร้าน — เหลือเฉพาะตัวเลขที่คำนวณจริง
              const g = SCENARIOS[scenario].growth
              return `ถ้ายอด${g >= 0 ? 'โต' : 'ลด'} ${Math.abs(g)}% จากเฉลี่ย 3 เดือนล่าสุด ทั้งปีจะได้ราว <strong>${formatCurrency(yearTotal)}</strong> (${yearUnits} คัน)${vsTarget} — ตัวเลขเดือนนี้ที่แม่นกว่า ดูการ์ดด้านบน`
            })()}
          </div>
        </div>
      </div>
    `

    bindHub()
    document.querySelectorAll('.sc-btn').forEach(b => b.addEventListener('click', () => { scenario = b.dataset.s; renderPage() }))
    document.querySelectorAll('.vm-btn').forEach(b => b.addEventListener('click', () => { viewMetric = b.dataset.m; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const forecast = calcForecast(actuals, SCENARIOS[scenario].growth)
      exportToExcel([...actuals, ...forecast].map(d => ({
        เดือน: MONTHS_TH[d.month] + ' ' + (YEAR + 543),
        ประเภท: d.isForecast ? 'คาดการณ์' : 'ยอดจริง',
        คัน: d.units, รายได้: d.revenue, Leads: d.leads
      })), `sales_forecast_${YEAR}`)
      showToast('📥 Export แล้ว!', 'success')
    })
  }

  renderPage()
  loadHub()
}
