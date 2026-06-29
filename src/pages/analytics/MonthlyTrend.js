/**
 * Monthly Trend — แนวโน้มรายเดือน
 * Route: /analytics/monthly
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const YEARLY_DATA = {
  2024: {
    sales: [18, 22, 19, 25, 28, 24, 30, 27, 32, 29, 35, 40],
    revenue: [23382000, 28578000, 24681000, 32475000, 36372000, 31176000, 38970000, 35073000, 41556000, 37659000, 45465000, 51960000],
    service: [420000, 510000, 480000, 560000, 590000, 540000, 620000, 600000, 680000, 650000, 720000, 810000],
    gross: [2806000, 3429000, 2962000, 3897000, 4365000, 3741000, 4677000, 4209000, 4987000, 4519000, 5456000, 6235000],
  },
  2023: {
    sales: [10, 14, 12, 16, 18, 15, 20, 18, 22, 19, 24, 28],
    revenue: [12990000, 18186000, 15588000, 20784000, 23382000, 19485000, 25980000, 23382000, 28578000, 24681000, 31176000, 36372000],
    service: [280000, 340000, 320000, 380000, 410000, 370000, 440000, 420000, 490000, 460000, 530000, 610000],
    gross: [1558000, 2182000, 1871000, 2494000, 2806000, 2338000, 3118000, 2806000, 3429000, 2962000, 3741000, 4365000],
  }
}

const METRICS = [
  { key: 'sales', label: 'ยอดขาย (คัน)', unit: '', color: 'primary', format: v => v + ' คัน' },
  { key: 'revenue', label: 'รายได้', unit: '฿', color: 'success', format: v => formatCurrency(v) },
  { key: 'service', label: 'รายได้บริการ', unit: '฿', color: 'warning', format: v => formatCurrency(v) },
  { key: 'gross', label: 'Gross Profit', unit: '฿', color: 'secondary', format: v => formatCurrency(v) },
]

export default async function MonthlyTrendPage(container) {
  const myGen = container.__routerGen
  let liveData = JSON.parse(JSON.stringify(YEARLY_DATA))
  let year = Math.max(...Object.keys(liveData).map(Number))
  let metric = 'sales'
  let compareYear = true
  let dataSource = 'demo'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const currYear = new Date().getFullYear()
      if (!liveData[currYear]) liveData[currYear] = { sales: Array(12).fill(0), revenue: Array(12).fill(0), service: Array(12).fill(0), gross: Array(12).fill(0) }
      year = currYear
      sales.forEach(s => {
        const d = new Date(s.bookingDate || s.createdAt?.toDate?.() || new Date())
        const y = d.getFullYear(), mo = d.getMonth()
        if (liveData[y]) {
          liveData[y].sales[mo] = (liveData[y].sales[mo] || 0) + 1
          const rev = s.salePrice || 0
          liveData[y].revenue[mo] = (liveData[y].revenue[mo] || 0) + rev
          liveData[y].gross[mo] = (liveData[y].gross[mo] || 0) + Math.round(rev * 0.12)
        }
      })
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const EMPTY_YEAR = { sales: Array(12).fill(0), revenue: Array(12).fill(0), service: Array(12).fill(0), gross: Array(12).fill(0) }
    const data = liveData[year] || EMPTY_YEAR
    const prevData = liveData[year - 1]
    const m = METRICS.find(x => x.key === metric)
    const values = data[metric]
    const prevValues = prevData?.[metric] || []
    const maxV = Math.max(...values, ...(compareYear ? prevValues : []), 1)
    const total = values.reduce((a, v) => a + v, 0)
    const prevTotal = prevValues.reduce((a, v) => a + v, 0)
    const growth = prevTotal > 0 ? Math.round((total - prevTotal) / prevTotal * 100) : 0

    // Best and worst months
    const maxIdx = values.indexOf(Math.max(...values))
    const minIdx = values.indexOf(Math.min(...values))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📈 Monthly Trend</div>
            <div class="page-subtitle">แนวโน้มรายเดือน — เปรียบเทียบปีต่อปี${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="prev-yr">◀ ${year-1}</button>
            <button class="btn btn-secondary btn-xs" id="next-yr">${year+1} ▶</button>
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <!-- Metric picker -->
        <div style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">
          ${METRICS.map(mx => `<button class="btn btn-xs ${metric===mx.key?'btn-'+mx.color:'btn-secondary'} mx-btn" data-m="${mx.key}">${mx.label}</button>`).join('')}
          <button class="btn btn-xs ${compareYear?'btn-secondary':'btn-secondary'}" id="toggle-compare">
            ${compareYear ? '👁 เปรียบเทียบ ON' : '👁 เปรียบเทียบ OFF'}
          </button>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📊 รวม ' + year, m?.format(total) || total, m?.color || 'primary')}
          ${kpi('📅 สูงสุด', MONTHS[maxIdx], 'success')}
          ${kpi('📅 ต่ำสุด', MONTHS[minIdx], 'warning')}
          ${kpi('📈 YoY Growth', (growth > 0 ? '+' : '') + growth + '%', growth >= 0 ? 'success' : 'danger')}
        </div>

        <!-- Bar chart -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">📊 ${m?.label} — ${year}${compareYear && prevData ? ' vs ' + (year-1) : ''}</div>
          <div style="display:flex;gap:6px;align-items:flex-end;height:120px">
            ${MONTHS.map((mo, i) => {
              const v = values[i]
              const pv = prevValues[i]
              const barH = Math.round(v / maxV * 100)
              const prevH = pv ? Math.round(pv / maxV * 100) : 0
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="display:flex;gap:2px;align-items:flex-end;width:100%;height:110px">
                  <div title="${year}: ${m?.format(v)}" style="flex:1;background:var(--${m?.color});border-radius:3px 3px 0 0;height:${barH/100*110}px;min-height:3px"></div>
                  ${compareYear && pv !== undefined ? `<div title="${year-1}: ${m?.format(pv)}" style="flex:1;background:var(--${m?.color})44;border-radius:3px 3px 0 0;height:${prevH/100*110}px;min-height:2px;border:1px solid var(--${m?.color})"></div>` : ''}
                </div>
                <div style="font-size:0.58rem;color:var(--text-muted)">${mo}</div>
              </div>`
            }).join('')}
          </div>
          ${compareYear && prevData ? `<div style="display:flex;gap:12px;margin-top:8px;font-size:0.72rem"><span>■ <span style="color:var(--${m?.color})">${year}</span></span><span>□ <span style="color:var(--text-muted)">${year-1}</span></span></div>` : ''}
        </div>

        <!-- Monthly data table -->
        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">เดือน</th>
                <th style="padding:8px 10px;text-align:right">${year}</th>
                ${compareYear && prevData ? `<th style="padding:8px 10px;text-align:right">${year-1}</th><th style="padding:8px 10px;text-align:right">±%</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${MONTHS.map((mo, i) => {
                const v = values[i]; const pv = prevValues[i]
                const chg = pv ? Math.round((v-pv)/pv*100) : null
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${i===maxIdx?';background:var(--success)08':''}">
                  <td style="padding:6px 14px">${mo}</td>
                  <td style="padding:6px 10px;text-align:right;font-weight:${i===maxIdx?700:400}">${m?.format(v)||v}</td>
                  ${compareYear && prevData ? `
                    <td style="padding:6px 10px;text-align:right;color:var(--text-muted)">${m?.format(pv)||pv}</td>
                    <td style="padding:6px 10px;text-align:right;color:var(--${chg>=0?'success':'danger'})">${chg!==null?(chg>0?'+':'')+chg+'%':'—'}</td>
                  ` : ''}
                </tr>`
              }).join('')}
              <tr style="background:var(--surface-2);font-weight:700;font-size:0.82rem;border-top:2px solid var(--border)">
                <td style="padding:8px 14px">รวม</td>
                <td style="padding:8px 10px;text-align:right">${m?.format(total)||total}</td>
                ${compareYear && prevData ? `
                  <td style="padding:8px 10px;text-align:right;color:var(--text-muted)">${m?.format(prevTotal)||prevTotal}</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--${growth>=0?'success':'danger'})">${growth>0?'+':''}${growth}%</td>
                ` : ''}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.mx-btn').forEach(b => b.addEventListener('click', () => { metric = b.dataset.m; renderPage() }))
    document.getElementById('toggle-compare')?.addEventListener('click', () => { compareYear = !compareYear; renderPage() })
    document.getElementById('prev-yr')?.addEventListener('click', () => { if (liveData[year-1]) { year--; renderPage() } else showToast('ไม่มีข้อมูลปีนั้น','secondary') })
    document.getElementById('next-yr')?.addEventListener('click', () => { if (liveData[year+1]) { year++; renderPage() } else showToast('ยังไม่มีข้อมูลปีหน้า','secondary') })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const d = liveData[year]
      exportToExcel(
        MONTHS.map((m, i) => ({
          'เดือน': m,
          'ยอดขาย (คัน)': d?.sales[i] ?? 0,
          'รายได้ (บาท)': d?.revenue[i] ?? 0,
          'รายได้บริการ (บาท)': d?.service[i] ?? 0,
          'Gross Profit (บาท)': d?.gross[i] ?? 0,
        })),
        `Monthly_Trend_${year}.xlsx`,
        `Trend ${year}`
      )
      showToast(`📥 Export Monthly Trend ${year} แล้ว`, 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
