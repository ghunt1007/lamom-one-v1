/**
 * Service Analytics — วิเคราะห์ศูนย์บริการ
 * Route: /analytics/service
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHLY = {
  jobs: [98, 112, 105, 124, 131, 118],
  revenue: [392000, 448000, 420000, 496000, 524000, 472000],
  avgTime: [2.4, 2.2, 2.5, 2.1, 2.0, 2.2], // ชม./งาน
  csat: [4.3, 4.4, 4.5, 4.5, 4.6, 4.7],
}
const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.']

const BY_SERVICE_TYPE = [
  { type: 'เช็คระยะ', jobs: 52, revenue: 182000, avgTicket: 3500, color: '#3b82f6' },
  { type: 'ซ่อมทั่วไป', jobs: 28, revenue: 168000, avgTicket: 6000, color: '#f59e0b' },
  { type: 'EV Diagnostic', jobs: 14, revenue: 70000, avgTicket: 5000, color: '#10b981' },
  { type: 'ยาง/ช่วงล่าง', jobs: 12, revenue: 96000, avgTicket: 8000, color: '#ef4444' },
  { type: 'อื่นๆ (ล้าง/ฟิล์ม)', jobs: 12, revenue: 36000, avgTicket: 3000, color: '#8b5cf6' },
]

const BAY_UTILIZATION = [
  { bay: 'Bay 1 (ทั่วไป)', util: 88 },
  { bay: 'Bay 2 (ทั่วไป)', util: 82 },
  { bay: 'Bay 3 (EV/HV)', util: 64 },
  { bay: 'Bay 4 (ด่วน)', util: 91 },
]

const TOP_TECHS = [
  { name: 'วิทยา ช่างใหญ่', jobs: 34, revenue: 178000, csat: 4.8 },
  { name: 'สุรชัย มือดี', jobs: 31, revenue: 162000, csat: 4.7 },
  { name: 'ชาตรี แข็งแกร่ง', jobs: 28, revenue: 134000, csat: 4.6 },
  { name: 'มานะ ขยัน', jobs: 25, revenue: 98000, csat: 4.4 },
]

export default async function ServiceAnalyticsPage(container) {
  const myGen = container.__routerGen
  let liveMonthly = JSON.parse(JSON.stringify(MONTHLY))
  let dataSource = 'demo'
  let metric = 'jobs'

  try {
    const jobs = await listDocs('job_cards', [], 'createdAt', 'desc', 1000).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (jobs.length >= 2) {
      const now = new Date()
      for (let i = 0; i < 6; i++) {
        const d = new Date(now); d.setMonth(d.getMonth() - (5 - i))
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        const monthJobs = jobs.filter(j => (j.jobDate || j.createdAt?.toDate?.()?.toISOString() || '').startsWith(key))
        if (monthJobs.length) {
          liveMonthly.jobs[i] = monthJobs.length
          liveMonthly.revenue[i] = monthJobs.reduce((a, j) => a + (j.total || j.partsCost || 0), 0) || liveMonthly.revenue[i]
        }
      }
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const li = liveMonthly.jobs.length - 1
    const jobsNow = liveMonthly.jobs[li], jobsPrev = liveMonthly.jobs[li-1]
    const revNow = liveMonthly.revenue[li]
    const jobsChg = Math.round((jobsNow - jobsPrev) / jobsPrev * 100)
    const data = liveMonthly[metric]
    const maxV = Math.max(...data)
    const totalJobs = BY_SERVICE_TYPE.reduce((a, s) => a + s.jobs, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔧 Service Analytics</div>
            <div class="page-subtitle">วิเคราะห์ศูนย์บริการ — 6 เดือนล่าสุด${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔧 งานเดือนนี้', jobsNow + ' งาน (' + (jobsChg>0?'+':'') + jobsChg + '%)', jobsChg >= 0 ? 'success' : 'danger')}
          ${kpi('💰 รายได้', formatCurrency(revNow), 'primary')}
          ${kpi('⏱ เวลาเฉลี่ย/งาน', MONTHLY.avgTime[li] + ' ชม.', MONTHLY.avgTime[li] <= 2.2 ? 'success' : 'warning')}
          ${kpi('⭐ CSAT', MONTHLY.csat[li] + '/5', 'success')}
        </div>

        <!-- Trend chart -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">📈 แนวโน้ม 6 เดือน</div>
            <div style="display:flex;gap:4px">
              ${[['jobs','งาน'],['revenue','รายได้'],['avgTime','เวลา/งาน'],['csat','CSAT']].map(([k,l]) =>
                `<button class="btn btn-xs ${metric===k?'btn-primary':'btn-secondary'} mx-btn" data-m="${k}">${l}</button>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end;height:90px">
            ${data.map((v, i) => {
              const pct = Math.round(v / maxV * 100)
              const isLast = i === data.length - 1
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="font-size:0.62rem;color:var(--${isLast?'primary':'text-muted'});font-weight:${isLast?700:400}">${metric==='revenue'?Math.round(v/1000)+'K':v}</div>
                <div style="width:100%;background:${isLast?'var(--primary)':'var(--surface-2)'};border:1px solid ${isLast?'var(--primary)':'var(--border)'};border-radius:3px 3px 0 0;height:${pct*0.65}px;min-height:4px"></div>
                <div style="font-size:0.6rem;color:var(--text-muted)">${MONTH_LABELS[i]}</div>
              </div>`
            }).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <!-- By service type -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 แยกตามประเภทงาน (เดือนนี้)</div>
            ${BY_SERVICE_TYPE.map(s => {
              const pct = Math.round(s.jobs / totalJobs * 100)
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
                  <span>${s.type}</span>
                  <span style="color:var(--text-muted)">${s.jobs} งาน · ${formatCurrency(s.revenue)}</span>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:9px">
                  <div style="width:${pct}%;background:${s.color};height:9px;border-radius:3px"></div>
                </div>
              </div>`
            }).join('')}
          </div>

          <!-- Bay utilization -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🏗 อัตราใช้งาน Bay</div>
            ${BAY_UTILIZATION.map(b => {
              const color = b.util >= 85 ? 'danger' : b.util >= 70 ? 'warning' : 'success'
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
                  <span>${b.bay}</span><strong style="color:var(--${color})">${b.util}%</strong>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:9px">
                  <div style="width:${b.util}%;background:var(--${color});height:9px;border-radius:3px"></div>
                </div>
              </div>`
            }).join('')}
            <p style="font-size:0.66rem;color:var(--text-muted);margin-top:6px">💡 Bay 4 (ด่วน) ใกล้เต็ม — Bay 3 (EV) ยังว่าง ควรจัดโปรตรวจแบตฟรีดึงงานเข้า</p>
          </div>
        </div>

        <!-- Top techs -->
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">🏆 ผลงานช่าง (เดือนนี้)</div>
          <table style="width:100%;border-collapse:collapse">
            <tbody>
              ${TOP_TECHS.map((t, i) => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px;width:36px">${['🥇','🥈','🥉','4.'][i]}</td>
                  <td style="padding:8px 6px;font-weight:600">${t.name}</td>
                  <td style="padding:8px 10px;text-align:right">${t.jobs} งาน</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--success)">${formatCurrency(t.revenue)}</td>
                  <td style="padding:8px 14px;text-align:right;color:var(--${t.csat>=4.6?'success':'warning'})">⭐ ${t.csat}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.mx-btn').forEach(b => b.addEventListener('click', () => { metric = b.dataset.m; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        MONTH_LABELS.map((m, i) => ({
          'เดือน': m,
          'จำนวนงาน': liveMonthly.jobs[i],
          'รายได้ (บาท)': liveMonthly.revenue[i],
          'เวลาเฉลี่ย (ชม.)': liveMonthly.avgTime[i],
          'CSAT': liveMonthly.csat[i],
        })),
        'Service_Analytics.xlsx',
        'Service'
      )
      showToast('📥 Export Service Analytics แล้ว', 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
