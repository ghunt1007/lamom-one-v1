/**
 * Monthly Trend — แนวโน้มรายเดือน
 * Route: /analytics/monthly
 */
import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'
import { saleCost } from '../../utils/saleCost.js'

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']


const METRICS = [
  { key: 'sales', label: 'ยอดขาย (คัน)', unit: '', color: 'primary', format: v => v + ' คัน' },
  { key: 'revenue', label: 'รายได้', unit: '฿', color: 'success', format: v => formatCurrency(v) },
  { key: 'service', label: 'รายได้บริการ', unit: '฿', color: 'warning', format: v => formatCurrency(v) },
  { key: 'gross', label: 'Gross Profit', unit: '฿', color: 'secondary', format: v => formatCurrency(v) },
]

export default async function MonthlyTrendPage(container) {
  const myGen = container.__routerGen
  // ทุกปีคำนวณจากใบจองจริง (เดิมมีปี 2023/2024 เป็นตัวเลขตัวอย่าง และยอดจริงของปีอื่นนอกจากปีนี้ถูกทิ้ง)
  const blankYear = () => ({ sales: Array(12).fill(0), revenue: Array(12).fill(0), service: Array(12).fill(0), gross: Array(12).fill(0) })
  let liveData = {}
  let year = Number(todayBangkok().slice(0, 4))
  let metric = 'sales'
  let compareYear = true
  let dataSource = 'demo'
  let liveYear = null

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      liveYear = year
      liveData[year] = blankYear()
      sales.forEach(s => {
        const ds = String(s.bookingDate || s.date || '').slice(0, 10)
        if (!/^\d{4}-\d{2}/.test(ds)) return
        const y = Number(ds.slice(0, 4)), mo = Number(ds.slice(5, 7)) - 1
        if (mo < 0 || mo > 11) return
        if (!liveData[y]) liveData[y] = blankYear()
        {
          liveData[y].sales[mo] = (liveData[y].sales[mo] || 0) + 1
          const rev = s.salePrice || 0
          liveData[y].revenue[mo] = (liveData[y].revenue[mo] || 0) + rev
          // กำไรขั้นต้นจริงต่อคัน (rev - ต้นทุนจริง s.cost) ถ้าไม่มี cost ค่อย fallback ประมาณ 82% ของราคาขาย
          // (pattern เดียวกับ CashFlow.js/VatReport.js) ไม่ใช่ประมาณ margin 12% ตายตัวทุกคันอีกต่อไป
          liveData[y].gross[mo] = (liveData[y].gross[mo] || 0) + (rev - saleCost(s))
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
    // ต่ำสุด: นับเฉพาะเดือนที่ผ่านมาแล้ว (ปีนี้ไม่นับเดือนที่ยังไม่ถึง/เดือนที่ยังไม่จบ)
    const nowY = Number(todayBangkok().slice(0, 4)), nowM = Number(todayBangkok().slice(5, 7)) - 1
    const doneN = year < nowY ? 12 : year === nowY ? nowM : 0
    const past = values.slice(0, doneN)
    const minIdx = past.length ? past.indexOf(Math.min(...past)) : -1

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📈 แนวโน้มรายเดือน</div>
            <div class="page-subtitle">แนวโน้มรายเดือน — เปรียบเทียบปีต่อปี${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="prev-yr">◀ ${year-1+543}</button>
            <button class="btn btn-secondary btn-xs" id="next-yr">${year+1+543} ▶</button>
            <button class="btn btn-primary" id="export-btn">📤 ส่งออก</button>
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
          ${kpi('📊 รวมปี ' + (year + 543), m?.format(total) || total, m?.color || 'primary')}
          ${kpi('📅 สูงสุด', MONTHS[maxIdx], 'success')}
          ${kpi('📅 ต่ำสุด', MONTHS[minIdx] || '—', 'warning')}
          ${kpi('📈 โตเทียบปีก่อน', (growth > 0 ? '+' : '') + growth + '%', growth >= 0 ? 'success' : 'danger', prevTotal ? '' : '(ยังไม่มียอดปีก่อน)')}
        </div>

        <!-- Bar chart -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">📊 ${m?.label} — ${year + 543}${compareYear && prevData ? ' vs ' + (year - 1 + 543) : ''}</div>
          <div style="display:flex;gap:6px;align-items:flex-end;height:120px">
            ${MONTHS.map((mo, i) => {
              const v = values[i]
              const pv = prevValues[i]
              const barH = Math.round(v / maxV * 100)
              const prevH = pv ? Math.round(pv / maxV * 100) : 0
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="display:flex;gap:2px;align-items:flex-end;width:100%;height:110px">
                  <div title="${year + 543}: ${m?.format(v)}" style="flex:1;background:var(--${m?.color});border-radius:3px 3px 0 0;height:${barH/100*110}px;min-height:3px"></div>
                  ${compareYear && pv !== undefined ? `<div title="${year - 1 + 543}: ${m?.format(pv)}" style="flex:1;background:var(--${m?.color})44;border-radius:3px 3px 0 0;height:${prevH/100*110}px;min-height:2px;border:1px solid var(--${m?.color})"></div>` : ''}
                </div>
                <div style="font-size:0.58rem;color:var(--text-muted)">${mo}</div>
              </div>`
            }).join('')}
          </div>
          ${compareYear && prevData ? `<div style="display:flex;gap:12px;margin-top:8px;font-size:0.72rem"><span>■ <span style="color:var(--${m?.color})">${year + 543}</span></span><span>□ <span style="color:var(--text-muted)">${year - 1 + 543}</span></span></div>` : ''}
        </div>

        <!-- Monthly data table -->
        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">เดือน</th>
                <th style="padding:8px 10px;text-align:right">${year + 543}</th>
                ${compareYear && prevData ? `<th style="padding:8px 10px;text-align:right">${year - 1 + 543}</th><th style="padding:8px 10px;text-align:right">±%</th>` : ''}
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
      showToast(`📥 ส่งออกแนวโน้มรายเดือน ปี ${year + 543} แล้ว`, 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c, note) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div>${note ? `<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px">${note}</div>` : ''}</div>` }
