/**
 * Target vs Actual — เป้าหมาย vs ผลจริง รายเดือน / รายทีม
 * Route: /finance/target-actual
 */
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { formatCurrency } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const LS_BUDGET = 'lamom_sales_budget_2025'
const MONTH_LABELS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// Default targets when no SalesBudget data
const DEF_REVENUE = [9000000,8500000,12000000,10000000,13000000,9000000,10000000,11000000,10000000,11000000,13000000,18000000]
const DEF_UNITS   = [8,7,10,9,11,8,9,10,9,10,11,15]

function loadBudget() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_BUDGET) || 'null')
    return { revenue: d?.targets || DEF_REVENUE, units: DEF_UNITS }
  } catch { return { revenue: DEF_REVENUE, units: DEF_UNITS } }
}

function pctColor(pct) {
  return pct >= 100 ? 'var(--success)' : pct >= 80 ? 'var(--warning)' : 'var(--danger)'
}

function pctBadge(pct) {
  const c = pct >= 100 ? 'success' : pct >= 80 ? 'warning' : 'danger'
  return `<span class="badge badge-${c}" style="font-size:0.65rem">${pct}%</span>`
}

function pctBar(actual, target, label, mini) {
  const pct = target > 0 ? Math.min(Math.round(actual / target * 100), 150) : 0
  const col = pctColor(pct)
  const h = mini ? '6px' : '10px'
  const mb = mini ? '6px' : '10px'
  return `<div style="margin-bottom:${mb}">
    <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
      <span>${label}</span>
      <span style="color:${col};font-weight:700">${pct}%</span>
    </div>
    <div style="height:${h};background:var(--surface-2);border-radius:5px;overflow:hidden">
      <div style="height:100%;width:${Math.min(pct,100)}%;background:${col};border-radius:5px;transition:width .4s"></div>
    </div>
  </div>`
}

export default async function TargetActualPage(container) {
  const myGen = container.__routerGen
  let tab = 'monthly'
  let selMonthIdx = new Date().getMonth()
  let allSales = []
  let dataSource = 'demo'
  let budget = loadBudget()

  // Build monthly data from sales
  function buildMonthly() {
    const rows = MONTH_LABELS.map((label, i) => ({
      label, idx: i,
      revenueTarget: budget.revenue[i] || 0,
      unitsTarget: budget.units[i] || 0,
      revenueActual: 0,
      unitsActual: 0,
    }))
    if (dataSource === 'live') {
      allSales.forEach(s => {
        const d = s.date || s.bookingDate || ''
        const mi = parseInt(d.slice(5, 7)) - 1
        if (mi >= 0 && mi < 12) {
          rows[mi].unitsActual++
          rows[mi].revenueActual += s.salePrice || 0
        }
      })
    } else {
      // Demo fallback data
      const demoUnits  = [10,13,14,17,16,15,0,0,0,0,0,0]
      const demoRev    = [12100000,15600000,16800000,20400000,19200000,17850000,0,0,0,0,0,0]
      rows.forEach((r, i) => { r.unitsActual = demoUnits[i]; r.revenueActual = demoRev[i] })
    }
    return rows
  }

  // Build per-salesperson data
  function buildByPerson() {
    if (!allSales.length) return [
      { name:'อรนุช สายใจ', units:12, revenue:15800000 },
      { name:'วิชาญ มีโชค', units:8, revenue:9200000 },
      { name:'น.ส.ปวีณา', units:6, revenue:7100000 },
      { name:'นาย สมศักดิ์', units:6, revenue:7500000 },
    ]
    const by = {}
    allSales.forEach(s => {
      const n = s.salesperson || s.salesName || 'ไม่ระบุ'
      if (!by[n]) by[n] = { name: n, units: 0, revenue: 0 }
      by[n].units++
      by[n].revenue += s.salePrice || 0
    })
    return Object.values(by).sort((a, b) => b.revenue - a.revenue)
  }

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 1) { allSales = sales; dataSource = 'live' }
  } catch {}

  function render() {
    budget = loadBudget()
    const monthly = buildMonthly()
    const bySales = buildByPerson()
    const curM = monthly[selMonthIdx]
    const now = new Date().getMonth()

    // YTD up to current month
    const ytdSlice = monthly.slice(0, now + 1)
    const ytdRevTarget  = ytdSlice.reduce((a, m) => a + m.revenueTarget, 0)
    const ytdRevActual  = ytdSlice.reduce((a, m) => a + m.revenueActual, 0)
    const ytdUnitTarget = ytdSlice.reduce((a, m) => a + m.unitsTarget, 0)
    const ytdUnitActual = ytdSlice.reduce((a, m) => a + m.unitsActual, 0)
    const ytdRPct = ytdRevTarget > 0 ? Math.round(ytdRevActual / ytdRevTarget * 100) : 0
    const ytdSPct = ytdUnitTarget > 0 ? Math.round(ytdUnitActual / ytdUnitTarget * 100) : 0

    const sPct = curM.unitsTarget > 0 ? Math.round(curM.unitsActual / curM.unitsTarget * 100) : 0
    const rPct = curM.revenueTarget > 0 ? Math.round(curM.revenueActual / curM.revenueTarget * 100) : 0

    const maxPersonRev = Math.max(...bySales.map(p => p.revenue), 1)

    let mainContent = ''
    if (tab === 'monthly') {
      mainContent = `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">
          <!-- Monthly table -->
          <div class="card" style="overflow:hidden">
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📅 ผลรายเดือน — คลิกเพื่อดูรายละเอียด</div>
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:0.76rem">
                <thead>
                  <tr style="border-bottom:1px solid var(--border)">
                    <th style="text-align:left;padding:7px 12px;color:var(--text-muted)">เดือน</th>
                    <th style="text-align:right;padding:7px 8px;color:var(--text-muted)">ขาย (คัน)</th>
                    <th style="text-align:right;padding:7px 8px;color:var(--text-muted)">%</th>
                    <th style="text-align:right;padding:7px 8px;color:var(--text-muted)">รายได้ (฿M)</th>
                    <th style="text-align:right;padding:7px 8px;color:var(--text-muted)">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${monthly.map((m, i) => {
                    const sp = m.unitsTarget > 0 ? Math.round(m.unitsActual / m.unitsTarget * 100) : 0
                    const rp = m.revenueTarget > 0 ? Math.round(m.revenueActual / m.revenueTarget * 100) : 0
                    const isSel = i === selMonthIdx
                    const isFuture = m.unitsActual === 0 && m.revenueActual === 0 && i > now
                    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer;background:${isSel ? 'var(--surface-2)' : 'transparent'}" class="month-row" data-mi="${i}">
                      <td style="padding:7px 12px;font-weight:${isSel ? '700' : '400'};color:${isSel ? 'var(--primary)' : ''}">${m.label}${isFuture ? ' <span style="font-size:0.6rem;color:var(--text-muted)">(ยังไม่ถึง)</span>' : ''}</td>
                      <td style="padding:7px 8px;text-align:right">${isFuture ? '—' : m.unitsActual}<span style="color:var(--text-muted)">/${m.unitsTarget}</span></td>
                      <td style="padding:7px 8px;text-align:right">${isFuture ? '' : pctBadge(sp)}</td>
                      <td style="padding:7px 8px;text-align:right">${isFuture ? '—' : (m.revenueActual/1000000).toFixed(1)}<span style="color:var(--text-muted)">/${(m.revenueTarget/1000000).toFixed(1)}</span></td>
                      <td style="padding:7px 8px;text-align:right">${isFuture ? '' : pctBadge(rp)}</td>
                    </tr>`
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Month detail -->
          <div>
            <div class="card" style="padding:14px;margin-bottom:12px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 ${curM.label} — ความคืบหน้า</div>
              ${pctBar(curM.unitsActual, curM.unitsTarget, `🚗 คัน (${curM.unitsActual}/${curM.unitsTarget})`, false)}
              ${pctBar(curM.revenueActual, curM.revenueTarget, `💰 รายได้ (฿${(curM.revenueActual/1000000).toFixed(1)}M/฿${(curM.revenueTarget/1000000).toFixed(0)}M)`, false)}
              <div style="margin-top:10px;font-size:0.72rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:8px">
                ${curM.unitsActual >= curM.unitsTarget
                  ? `✅ ถึงเป้าแล้ว! เกินมา ${curM.unitsActual - curM.unitsTarget} คัน`
                  : `🎯 ต้องการอีก ${curM.unitsTarget - curM.unitsActual} คันถึงเป้า`}
              </div>
            </div>
            <div class="card" style="padding:14px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📈 YTD (${MONTH_LABELS[now]})</div>
              ${pctBar(ytdUnitActual, ytdUnitTarget, `🚗 ${ytdUnitActual}/${ytdUnitTarget} คัน`, true)}
              ${pctBar(ytdRevActual, ytdRevTarget, `💰 ฿${(ytdRevActual/1000000).toFixed(1)}M/฿${(ytdRevTarget/1000000).toFixed(0)}M`, true)}
            </div>
          </div>
        </div>`
    } else if (tab === 'person') {
      mainContent = `
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">👥 ผลรายเซลส์ (สะสมทั้งปี)</div>
          ${bySales.map((p, i) => {
            const pct = Math.round(p.revenue / maxPersonRev * 100)
            return `<div style="padding:12px 14px;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="display:flex;gap:8px;align-items:center">
                  <span style="font-size:1rem">${['🥇','🥈','🥉'][i] || '·'}</span>
                  <span style="font-size:0.85rem;font-weight:600">${escHtml(p.name)}</span>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:800;font-size:0.9rem;color:var(--success)">${formatCurrency(p.revenue)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${p.units} คัน · Avg ${formatCurrency(p.units > 0 ? Math.round(p.revenue/p.units) : 0)}</div>
                </div>
              </div>
              <div style="background:var(--surface-2);height:6px;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--${i===0?'warning':i===1?'primary':'accent'});border-radius:3px;transition:width 0.4s"></div>
              </div>
            </div>`
          }).join('')}
        </div>`
    } else {
      // YTD full view
      const fullRevTarget = budget.revenue.reduce((a, v) => a + v, 0)
      const fullRevActual = monthly.reduce((a, m) => a + m.revenueActual, 0)
      const fullUnitTarget = budget.units.reduce((a, v) => a + v, 0)
      const fullUnitActual = monthly.reduce((a, m) => a + m.unitsActual, 0)
      const ytdFullRPct = Math.round(fullRevActual / fullRevTarget * 100)
      const ytdFullSPct = Math.round(fullUnitActual / fullUnitTarget * 100)

      mainContent = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">📊 YTD ถึง ${MONTH_LABELS[now]} — ยอดขาย</div>
            ${pctBar(ytdUnitActual, ytdUnitTarget, `🚗 ${ytdUnitActual}/${ytdUnitTarget} คัน`, false)}
            ${pctBar(ytdRevActual, ytdRevTarget, `💰 ฿${(ytdRevActual/1000000).toFixed(1)}M/฿${(ytdRevTarget/1000000).toFixed(0)}M`, false)}
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">🗓️ เป้าทั้งปี 2568</div>
            ${pctBar(fullUnitActual, fullUnitTarget, `🚗 สะสม ${fullUnitActual}/${fullUnitTarget} คัน`, false)}
            ${pctBar(fullRevActual, fullRevTarget, `💰 ฿${(fullRevActual/1000000).toFixed(1)}M/฿${(fullRevTarget/1000000).toFixed(0)}M`, false)}
          </div>
        </div>
        <!-- Trend bar chart -->
        <div class="card" style="padding:16px;margin-top:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">📈 เทรนด์ยอดขาย (คัน/เดือน)</div>
          <div style="display:flex;align-items:flex-end;gap:6px;height:80px">
            ${monthly.map((m, i) => {
              const maxU = Math.max(...monthly.map(x => Math.max(x.unitsActual, x.unitsTarget)), 1)
              const actH = Math.max(3, m.unitsActual / maxU * 70)
              const tarH = Math.max(3, m.unitsTarget / maxU * 70)
              const isFut = m.unitsActual === 0 && i > now
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="width:100%;display:flex;gap:2px;align-items:flex-end;height:70px">
                  <div style="flex:1;background:${isFut ? 'var(--surface-2)' : 'var(--primary)'};height:${actH}px;border-radius:2px 2px 0 0;opacity:${isFut?0.3:0.9}" title="${m.label} จริง: ${m.unitsActual}"></div>
                  <div style="flex:1;background:var(--border);height:${tarH}px;border-radius:2px 2px 0 0" title="${m.label} เป้า: ${m.unitsTarget}"></div>
                </div>
                <div style="font-size:0.55rem;color:var(--text-muted)">${m.label}</div>
              </div>`
            }).join('')}
          </div>
          <div style="display:flex;gap:12px;margin-top:8px;font-size:0.7rem;color:var(--text-muted)">
            <span><span style="display:inline-block;width:10px;height:10px;background:var(--primary);border-radius:2px;margin-right:4px"></span>จริง</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:var(--border);border-radius:2px;margin-right:4px"></span>เป้า</span>
          </div>
        </div>`
    }

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Target vs Actual</div>
            <div class="page-subtitle">เป้าหมาย vs ผลจริง รายเดือน / รายเซลส์${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🚗 ยอดขาย', curM.unitsActual + '/' + curM.unitsTarget + ' คัน', pctColor(sPct))}
          ${sc('📊 Achievement', sPct + '%', pctColor(sPct))}
          ${sc('💰 รายได้จริง', '฿' + (curM.revenueActual/1000000).toFixed(1) + 'M', 'var(--primary)')}
          ${sc('📊 Revenue %', rPct + '%', pctColor(rPct))}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px">
          ${[['monthly','📅 รายเดือน'],['person','👥 รายเซลส์'],['ytd','📊 YTD']].map(([k, l]) =>
            `<button class="btn btn-sm ${tab===k?'btn-primary':'btn-secondary'} tab-btn" data-t="${k}">${l}</button>`).join('')}
        </div>

        ${mainContent}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; render() }))
    container.querySelectorAll('.month-row').forEach(r => r.addEventListener('click', () => { selMonthIdx = parseInt(r.dataset.mi); render() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const monthly = buildMonthly()
      const rows = monthly.map(m => {
        const sp = m.unitsTarget > 0 ? Math.round(m.unitsActual/m.unitsTarget*100) : 0
        const rp = m.revenueTarget > 0 ? Math.round(m.revenueActual/m.revenueTarget*100) : 0
        return { เดือน: m.label, เป้าคัน: m.unitsTarget, จริงคัน: m.unitsActual, 'Achievement%': sp+'%', เป้ารายได้: m.revenueTarget, รายได้จริง: m.revenueActual, 'Revenue%': rp+'%' }
      })
      exportToExcel(rows, 'target_vs_actual')
      showToast('✅ Export สำเร็จ', 'success')
    })
  }

  render()
}

function sc(l, v, c) {
  return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
}
