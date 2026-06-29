import { listDocs, seedDemoData, getSalesData } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { formatCurrency } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHLY_DATA = [
  { m:'ม.ค.', sales:4200000, units:3, leads:25, jobs:28, cust:8 },
  { m:'ก.พ.', sales:3800000, units:2, leads:22, jobs:31, cust:6 },
  { m:'มี.ค.', sales:5100000, units:4, leads:34, jobs:26, cust:11 },
  { m:'เม.ย.', sales:4600000, units:3, leads:28, jobs:29, cust:9 },
  { m:'พ.ค.', sales:5300000, units:4, leads:41, jobs:35, cust:14 },
  { m:'มิ.ย.', sales:4900000, units:3, leads:36, jobs:32, cust:10 },
  { m:'ก.ค.', sales:5800000, units:5, leads:45, jobs:38, cust:15 },
  { m:'ส.ค.', sales:5200000, units:4, leads:39, jobs:33, cust:12 },
  { m:'ก.ย.', sales:4700000, units:3, leads:31, jobs:30, cust:9 },
  { m:'ต.ค.', sales:5600000, units:5, leads:43, jobs:36, cust:13 },
  { m:'พ.ย.', sales:6100000, units:5, leads:50, jobs:40, cust:17 },
  { m:'ธ.ค.', sales:6800000, units:6, leads:55, jobs:44, cust:19 },
]

const BRAND_DATA = [
  { brand:'BYD', units:18, revenue:22000000, color:'primary' },
  { brand:'MG', units:11, revenue:12500000, color:'success' },
  { brand:'DEEPAL', units:7, revenue:9800000, color:'accent' },
  { brand:'NETA', units:5, revenue:5100000, color:'warning' },
  { brand:'Others', units:3, revenue:3100000, color:'danger' },
]

const QUICK_LINKS = [
  { icon:'📅', label:'Daily Report', sub:'รายงานประจำวัน', path:'/analytics/daily', color:'primary' },
  { icon:'🚗', label:'By Model', sub:'ยอดขายตามรุ่น', path:'/analytics/by-model', color:'accent' },
  { icon:'📈', label:'Monthly Trend', sub:'แนวโน้มรายเดือน', path:'/analytics/monthly', color:'success' },
  { icon:'🔮', label:'Forecast', sub:'พยากรณ์ยอดขาย', path:'/analytics/forecast', color:'warning' },
  { icon:'🎯', label:'Company KPI', sub:'KPI ภาพรวมบริษัท', path:'/analytics/kpi', color:'primary' },
  { icon:'📋', label:'Report Center', sub:'รายงานสรุปทุกประเภท', path:'/analytics/reports', color:'accent' },
  { icon:'👥', label:'Customer Insights', sub:'วิเคราะห์พฤติกรรมลูกค้า', path:'/analytics/customers', color:'success' },
  { icon:'🔽', label:'Conversion Funnel', sub:'อัตราแปลง Lead', path:'/analytics/funnel', color:'warning' },
  { icon:'💹', label:'Profit Analysis', sub:'วิเคราะห์กำไรเชิงลึก', path:'/analytics/profit', color:'danger' },
  { icon:'⚙️', label:'Operations', sub:'ประสิทธิภาพปฏิบัติการ', path:'/analytics/operations', color:'primary' },
  { icon:'📦', label:'Stock Analysis', sub:'วิเคราะห์สต็อกรถ', path:'/analytics/stock', color:'accent' },
  { icon:'🏆', label:'Executive', sub:'สรุปผู้บริหาร', path:'/analytics/executive', color:'success' },
  { icon:'🏢', label:'Branches', sub:'เปรียบเทียบสาขา', path:'/analytics/branches', color:'warning' },
  { icon:'⚡', label:'EV Adoption', sub:'ยอดขายรถไฟฟ้า', path:'/analytics/ev-adoption', color:'primary' },
  { icon:'🛠', label:'Service Analytics', sub:'วิเคราะห์งานซ่อม', path:'/analytics/service', color:'accent' },
  { icon:'📊', label:'Report Builder', sub:'สร้างรายงานเอง', path:'/analytics/report-builder', color:'success' },
]

const STAFF_PERF = [
  { name:'อรนุช สายใจ', units:12, revenue:15800000, commission:185000 },
  { name:'วิชาญ มีโชค', units:8, revenue:9200000, commission:108000 },
  { name:'น.ส.ปวีณา', units:6, revenue:7100000, commission:83000 },
  { name:'นาย สมศักดิ์', units:6, revenue:7500000, commission:88000 },
]

export default async function AnalyticsDashboard(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let activeTab = 'overview' // overview | forecast | staffperf | report
  let reportMetric = 'sales'

  // Load real data
  let realData = { customers: 0, sales: 0, jobs: 0 }
  try {
    const [c, s, j] = await Promise.all([
      listDocs('customers', [], 'createdAt', 'desc', 100).catch(() => []),
      getSalesData().catch(() => []),
      listDocs('job_cards', [], 'createdAt', 'desc', 100).catch(() => []),
    ])
    realData = { customers: c.length, sales: s.length, jobs: j.length }
    // overlay ยอดขายจริงต่อเดือน (จากใบจองกลาง) ทับเดือนที่มีข้อมูล
    const byMonth = {}
    s.forEach(x => { const mi = parseInt((x.date || '').slice(5, 7), 10) - 1; if (mi >= 0 && mi < 12) { if (!byMonth[mi]) byMonth[mi] = { sales: 0, units: 0 }; byMonth[mi].sales += x.salePrice || 0; byMonth[mi].units += 1 } })
    Object.keys(byMonth).forEach(mi => { MONTHLY_DATA[mi].sales = byMonth[mi].sales; MONTHLY_DATA[mi].units = byMonth[mi].units })
  } catch {}

  if (container.__routerGen !== myGen) return

  const totalSales = MONTHLY_DATA.reduce((a, r) => a + r.sales, 0)
  const totalUnits = MONTHLY_DATA.reduce((a, r) => a + r.units, 0)
  const totalLeads = MONTHLY_DATA.reduce((a, r) => a + r.leads, 0)
  const convRate = ((totalUnits / totalLeads) * 100).toFixed(1)

  // Simple linear forecast for next 3 months
  function forecast(data) {
    const n = data.length
    const last3avg = data.slice(-3).reduce((a, d) => a + d.sales, 0) / 3
    const trend = (data[n - 1].sales - data[0].sales) / n * 0.8
    return [
      { m: 'ม.ค.26', sales: Math.round(last3avg + trend), forecast: true },
      { m: 'ก.พ.26', sales: Math.round(last3avg + trend * 1.1), forecast: true },
      { m: 'มี.ค.26', sales: Math.round(last3avg + trend * 1.2), forecast: true },
    ]
  }
  const forecastData = forecast(MONTHLY_DATA)

  function renderPage() {
    const maxSales = Math.max(...MONTHLY_DATA.map(d => d.sales))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📈 Analytics 360</div>
            <div class="page-subtitle">วิเคราะห์ธุรกิจเชิงลึก + พยากรณ์</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="a-export">📥 Export Report</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="margin-bottom:16px">
          ${kpi('💰 รายได้รวม', formatCurrency(totalSales), 'success', '+22% YoY')}
          ${kpi('🚗 รถที่ขาย', `${totalUnits} คัน`, 'primary', 'ปี 2025')}
          ${kpi('🧲 Conversion', `${convRate}%`, convRate >= 12 ? 'success' : 'warning', `จาก ${totalLeads} Leads`)}
          ${kpi('👥 ลูกค้าใหม่', `${realData.customers || 143}`, 'accent', 'รวมทั้งปี')}
        </div>

        <!-- Quick links -->
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">เมนูหลัก Analytics</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px;margin-bottom:24px">
          ${QUICK_LINKS.map(q => `
            <div class="card card-lift" data-nav="${q.path}" style="padding:15px 16px;cursor:pointer;border-top:3px solid var(--${q.color})">
              <div style="font-size:1.6rem;margin-bottom:6px">${q.icon}</div>
              <div style="font-weight:700;font-size:0.86rem">${q.label}</div>
              <div style="font-size:0.71rem;color:var(--text-muted)">${q.sub}</div>
            </div>
          `).join('')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${[
            ['overview','📊 Overview'],
            ['forecast','🔮 Forecast'],
            ['staffperf','🏆 Staff KPI'],
            ['report','📋 Report Builder'],
          ].map(([t,l]) => `<button class="btn btn-sm ${activeTab===t?'btn-primary':'btn-secondary'} a-tab" data-t="${t}">${l}</button>`).join('')}
        </div>

        <div id="a-tab-content">
          ${renderTab()}
        </div>
      </div>
    `

    document.querySelectorAll('.a-tab').forEach(btn => {
      btn.addEventListener('click', () => { activeTab = btn.dataset.t; renderPage() })
    })
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.nav))
    })
    document.getElementById('a-export')?.addEventListener('click', () => {
      exportToExcel(MONTHLY_DATA.map(d => ({
        'เดือน': d.m, 'รายได้': d.sales, 'คัน': d.units, 'Leads': d.leads, 'งานซ่อม': d.jobs, 'ลูกค้าใหม่': d.cust
      })), 'Analytics_2025')
    })
  }

  function renderTab() {
    if (activeTab === 'overview') return renderOverview()
    if (activeTab === 'forecast') return renderForecast()
    if (activeTab === 'staffperf') return renderStaffPerf()
    if (activeTab === 'report') return renderReportBuilder()
    return ''
  }

  function renderOverview() {
    const maxSales = Math.max(...MONTHLY_DATA.map(d => d.sales))
    const maxUnits = Math.max(...MONTHLY_DATA.map(d => d.units))
    return `
      <div style="display:flex;flex-direction:column;gap:16px">
        <!-- Sales chart -->
        <div class="card" style="padding:20px">
          <div style="font-weight:700;margin-bottom:16px">💰 รายได้รายเดือน 2025</div>
          <div style="display:flex;align-items:flex-end;gap:4px;height:180px;border-bottom:1px solid var(--border);padding-bottom:8px">
            ${MONTHLY_DATA.map(d => {
              const h = Math.round(d.sales / maxSales * 160)
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="font-size:0.62rem;color:var(--text-muted)">${(d.sales/1000000).toFixed(1)}M</div>
                <div style="width:100%;height:${h}px;background:linear-gradient(to top,var(--primary),var(--primary-dim));border-radius:4px 4px 0 0" title="${d.m}: ${formatCurrency(d.sales)}"></div>
                <div style="font-size:0.62rem;color:var(--text-muted);white-space:nowrap">${d.m}</div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Brand breakdown + funnel -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="card" style="padding:20px">
            <div style="font-weight:700;margin-bottom:14px">🚗 ยอดขายตามยี่ห้อ</div>
            ${BRAND_DATA.map(b => {
              const pct = Math.round(b.units / totalUnits * 100)
              return `<div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;font-size:0.83rem;margin-bottom:4px">
                  <span>${b.brand}</span>
                  <span style="color:var(--text-muted)">${b.units} คัน (${pct}%)</span>
                </div>
                <div style="background:var(--surface-3);border-radius:99px;height:8px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:var(--${b.color});border-radius:99px"></div>
                </div>
              </div>`
            }).join('')}
          </div>

          <div class="card" style="padding:20px">
            <div style="font-weight:700;margin-bottom:14px">🔽 Sales Funnel</div>
            ${[
              { label: 'Leads', value: totalLeads, color: 'primary', pct: 100 },
              { label: 'Contacted', value: Math.round(totalLeads * 0.68), color: 'accent', pct: 68 },
              { label: 'Qualified', value: Math.round(totalLeads * 0.35), color: 'warning', pct: 35 },
              { label: 'Test Drive', value: Math.round(totalLeads * 0.22), color: 'accent', pct: 22 },
              { label: 'Booked', value: Math.round(totalLeads * 0.16), color: 'success', pct: 16 },
              { label: 'Sold', value: totalUnits, color: 'success', pct: parseFloat(convRate) },
            ].map(f => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <div style="width:80px;font-size:0.78rem;color:var(--text-muted)">${f.label}</div>
                <div style="flex:1;background:var(--surface-3);border-radius:99px;height:22px;overflow:hidden;position:relative">
                  <div style="height:100%;width:${f.pct}%;background:var(--${f.color});opacity:0.7;border-radius:99px"></div>
                  <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:0.73rem;font-weight:600">${f.value}</span>
                </div>
                <div style="width:36px;font-size:0.73rem;color:var(--text-muted);text-align:right">${f.pct}%</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `
  }

  function renderForecast() {
    const allData = [...MONTHLY_DATA, ...forecastData]
    const maxSales = Math.max(...allData.map(d => d.sales))
    const fTotal = forecastData.reduce((a, d) => a + d.sales, 0)
    return `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card" style="padding:20px;border:1px solid var(--accent)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-weight:700">🔮 Sales Forecast Q1/2026</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">อิง Linear Trend จากข้อมูล 12 เดือน</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
            ${forecastData.map(d => `
              <div style="background:var(--accent-dim);border-radius:var(--radius-lg);padding:14px;border:1px solid var(--accent);text-align:center">
                <div style="font-weight:700;color:var(--accent)">${d.m}</div>
                <div style="font-size:1.2rem;font-weight:700;color:var(--success);margin-top:4px">${formatCurrency(d.sales)}</div>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">คาดการณ์</div>
              </div>
            `).join('')}
          </div>
          <div style="font-size:0.85rem;color:var(--text-muted)">รวม Q1/2026 คาดว่า: <strong style="color:var(--success)">${formatCurrency(fTotal)}</strong></div>
        </div>

        <div class="card" style="padding:20px">
          <div style="font-weight:700;margin-bottom:16px">📊 Historical + Forecast</div>
          <div style="display:flex;align-items:flex-end;gap:3px;height:180px;border-bottom:1px solid var(--border);padding-bottom:8px">
            ${allData.map(d => {
              const h = Math.round(d.sales / maxSales * 160)
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="font-size:0.58rem;color:var(--text-muted)">${(d.sales/1000000).toFixed(1)}M</div>
                <div style="width:100%;height:${h}px;background:${d.forecast ? 'linear-gradient(to top,var(--accent),var(--accent-dim))' : 'linear-gradient(to top,var(--primary),var(--primary-dim))'};border-radius:4px 4px 0 0;${d.forecast?'opacity:0.8;border:1px dashed var(--accent)':''}"></div>
                <div style="font-size:0.55rem;color:var(--text-muted);white-space:nowrap">${d.m}</div>
              </div>`
            }).join('')}
          </div>
          <div style="display:flex;gap:16px;margin-top:10px;font-size:0.75rem">
            <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--primary);display:inline-block;border-radius:2px"></span>Actual</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--accent);display:inline-block;border-radius:2px;opacity:0.8"></span>Forecast</span>
          </div>
        </div>
      </div>
    `
  }

  function renderStaffPerf() {
    const maxRev = Math.max(...STAFF_PERF.map(s => s.revenue))
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px;font-weight:700;border-bottom:1px solid var(--border)">🏆 Staff Performance 2025</div>
        <table class="table">
          <thead>
            <tr>
              <th>อันดับ</th><th>พนักงาน</th>
              <th class="text-right">คันที่ขาย</th>
              <th class="text-right">รายได้</th>
              <th class="text-right">Commission</th>
              <th>Performance Bar</th>
            </tr>
          </thead>
          <tbody>
            ${STAFF_PERF.map((s, i) => {
              const pct = Math.round(s.revenue / maxRev * 100)
              const medals = ['🥇','🥈','🥉','']
              return `<tr>
                <td style="font-size:1.3rem">${medals[i] || i+1}</td>
                <td style="font-weight:600">${s.name}</td>
                <td class="text-right">${s.units} คัน</td>
                <td class="text-right" style="color:var(--success)">${formatCurrency(s.revenue)}</td>
                <td class="text-right" style="color:var(--accent)">${formatCurrency(s.commission)}</td>
                <td>
                  <div style="background:var(--surface-3);border-radius:99px;height:8px;overflow:hidden;min-width:100px">
                    <div style="height:100%;width:${pct}%;background:var(--${['success','primary','accent','warning'][i]});border-radius:99px"></div>
                  </div>
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderReportBuilder() {
    const metrics = {
      sales: MONTHLY_DATA.map(d => ({ label: d.m, value: d.sales })),
      units: MONTHLY_DATA.map(d => ({ label: d.m, value: d.units })),
      leads: MONTHLY_DATA.map(d => ({ label: d.m, value: d.leads })),
      jobs: MONTHLY_DATA.map(d => ({ label: d.m, value: d.jobs })),
    }
    const data = metrics[reportMetric] || metrics.sales
    const maxVal = Math.max(...data.map(d => d.value))
    const fmt = reportMetric === 'sales' ? v => formatCurrency(v) : v => v.toString()
    return `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card" style="padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-weight:700">📋 Report Builder</div>
            <div style="display:flex;gap:6px">
              ${Object.keys(metrics).map(k => `
                <button class="btn btn-sm ${reportMetric===k?'btn-primary':'btn-secondary'} rb-btn" data-k="${k}">
                  ${{ sales:'💰 Revenue', units:'🚗 คัน', leads:'🧲 Leads', jobs:'🔧 Jobs' }[k]}
                </button>
              `).join('')}
              <button class="btn btn-secondary btn-sm" id="rb-export">📥 Export</button>
            </div>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;height:200px;border-bottom:1px solid var(--border);padding-bottom:8px">
            ${data.map(d => {
              const h = Math.round(d.value / maxVal * 180)
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="font-size:0.62rem;color:var(--text-muted);white-space:nowrap">${reportMetric==='sales'?(d.value/1000000).toFixed(1)+'M':d.value}</div>
                <div style="width:100%;height:${h}px;background:linear-gradient(to top,var(--success),var(--success-dim));border-radius:4px 4px 0 0"></div>
                <div style="font-size:0.62rem;color:var(--text-muted)">${d.label}</div>
              </div>`
            }).join('')}
          </div>
          <div style="margin-top:14px">
            <table class="table" style="font-size:0.82rem">
              <thead><tr><th>เดือน</th><th class="text-right">ค่า</th><th class="text-right">% MoM</th></tr></thead>
              <tbody>
                ${data.map((d, i) => {
                  const prev = i > 0 ? data[i-1].value : d.value
                  const mom = prev > 0 ? ((d.value - prev) / prev * 100).toFixed(1) : '0'
                  const pos = parseFloat(mom) >= 0
                  return `<tr>
                    <td>${d.label}</td>
                    <td class="text-right">${fmt(d.value)}</td>
                    <td class="text-right" style="color:var(--${pos?'success':'danger'})">${pos?'+':''}${mom}%</td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `
  }

  renderPage()

  // Re-bind tab events after render
  container.addEventListener('click', e => {
    const rbBtn = e.target.closest('.rb-btn')
    if (rbBtn) { reportMetric = rbBtn.dataset.k; renderPage() }
    const rbExport = e.target.closest('#rb-export')
    if (rbExport) {
      const metricData = {
        sales: MONTHLY_DATA.map(d => ({ เดือน: d.m, รายได้: d.sales })),
        units: MONTHLY_DATA.map(d => ({ เดือน: d.m, คัน: d.units })),
        leads: MONTHLY_DATA.map(d => ({ เดือน: d.m, Leads: d.leads })),
        jobs: MONTHLY_DATA.map(d => ({ เดือน: d.m, Jobs: d.jobs })),
      }
      exportToExcel(metricData[reportMetric] || [], `Report_${reportMetric}_2025`)
    }
  })
}

function kpi(title, value, color, sub = '') {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div>${sub?`<div class="kpi-sub">${sub}</div>`:''}</div>`
}
