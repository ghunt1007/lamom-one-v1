/**
 * Sales By Model — ยอดขายแยกตามรุ่นรถ
 * Route: /analytics/by-model
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { getSalesData } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTH_LABELS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

const MODELS = [
  { model:'BYD Atto 3',  brand:'BYD', type:'EV',   color:'#3b82f6', icon:'🔵', price:1099000, monthly:[18,22,19,25,28,31,29,26,24,27,31,35], colors:['ขาว','ดำ','ฟ้า','แดง'], margin:8.2 },
  { model:'BYD Seal AWD', brand:'BYD', type:'EV',   color:'#10b981', icon:'🟢', price:1499000, monthly:[12,15,14,18,20,24,22,19,17,20,24,28], colors:['ขาว','ดำ','เทา'], margin:9.5 },
  { model:'MG ZS EV',    brand:'MG',  type:'EV',   color:'#f59e0b', icon:'🟡', price:879000,  monthly:[25,28,24,30,27,32,30,28,25,29,32,36], colors:['ขาว','แดง','ดำ','น้ำเงิน'], margin:7.8 },
  { model:'BYD Dolphin', brand:'BYD', type:'EV',   color:'#8b5cf6', icon:'🟣', price:699000,  monthly:[30,35,38,42,45,50,48,44,40,45,50,55], colors:['ขาว','ฟ้า','เขียว','ส้ม'], margin:7.2 },
  { model:'MG EP',       brand:'MG',  type:'PHEV', color:'#ef4444', icon:'🔴', price:749000,  monthly:[8,10,9,11,12,10,9,8,7,9,10,12], colors:['ขาว','ดำ'], margin:8.8 },
]

export default async function SalesByModelPage(container) {
  const myGen = container.__routerGen
  let sortBy = 'units'
  let periodIdx = new Date().getMonth()
  let allSales = []
  let dataSource = 'demo'
  let realMonthly = {} // { modelKey: [0..11] units, 0..11 revenue }

  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return
    if (sales.length >= 1) {
      allSales = sales
      // Build monthly breakdown per model
      sales.forEach(s => {
        const mo = parseInt((s.date || s.bookingDate || '').slice(5, 7)) - 1
        if (mo < 0 || mo > 11 || isNaN(mo)) return
        const key = ((s.brand || '') + ' ' + (s.model || '')).trim().toLowerCase()
        if (!realMonthly[key]) realMonthly[key] = { units: Array(12).fill(0), revenue: Array(12).fill(0) }
        realMonthly[key].units[mo]++
        realMonthly[key].revenue[mo] += s.salePrice || 0
      })
      dataSource = 'live'
    }
  } catch {}

  // Find real data for a model
  function findReal(m) {
    const key = (m.brand + ' ' + m.model).toLowerCase()
    return realMonthly[key] || null
  }

  // Get units for model at period (real or demo)
  function modelUnits(m, idx) {
    const r = findReal(m)
    if (r) return r.units[idx]
    return m.monthly[idx] || 0
  }
  function modelRevenue(m, idx) {
    const r = findReal(m)
    if (r) return r.revenue[idx]
    return (m.monthly[idx] || 0) * m.price
  }
  function modelYtd(m) {
    const r = findReal(m)
    if (r) return { units: r.units.reduce((a,v) => a+v, 0), revenue: r.revenue.reduce((a,v) => a+v, 0) }
    return { units: m.monthly.reduce((a,v) => a+v, 0), revenue: m.monthly.reduce((a,v,i) => a+v*m.price, 0) }
  }

  function renderPage() {
    const sorted = [...MODELS].sort((a, b) => {
      if (sortBy === 'units') return modelUnits(b, periodIdx) - modelUnits(a, periodIdx)
      if (sortBy === 'revenue') return modelRevenue(b, periodIdx) - modelRevenue(a, periodIdx)
      if (sortBy === 'ytd') return modelYtd(b).units - modelYtd(a).units
      return b.margin - a.margin
    })

    const totalUnits = MODELS.reduce((a, m) => a + modelUnits(m, periodIdx), 0)
    const totalRevenue = MODELS.reduce((a, m) => a + modelRevenue(m, periodIdx), 0)
    const maxUnits = Math.max(...MODELS.map(m => modelUnits(m, periodIdx)), 1)
    const best = sorted[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Sales By Model</div>
            <div class="page-subtitle">ยอดขายแยกตามรุ่นรถ — เปรียบเทียบรายเดือน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚗 รุ่นรถทั้งหมด', MODELS.length + ' รุ่น', 'primary')}
          ${kpi('📦 ยอดขาย ' + MONTH_LABELS[periodIdx], totalUnits + ' คัน', 'success')}
          ${kpi('💰 รายได้รวม', formatCurrency(totalRevenue), 'accent')}
          ${kpi('⭐ Best Seller', best?.model?.split(' ').slice(1).join(' ') || '-', 'warning')}
        </div>

        <!-- Period & Sort -->
        <div style="display:flex;gap:12px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${MONTH_LABELS.map((m, i) => `<button class="btn btn-xs ${periodIdx===i?'btn-primary':'btn-secondary'} period-btn" data-i="${i}">${m}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px;margin-left:auto">
            <span style="font-size:0.75rem;color:var(--text-muted)">เรียงโดย:</span>
            ${[['units','ยอดขาย'],['revenue','รายได้'],['ytd','YTD'],['margin','Margin']].map(([k,l]) =>
              `<button class="btn btn-xs ${sortBy===k?'btn-primary':'btn-secondary'} sort-btn" data-s="${k}">${l}</button>`).join('')}
          </div>
        </div>

        <!-- Bar chart -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">📊 ยอดขาย ${MONTH_LABELS[periodIdx]}</div>
          ${sorted.map(m => {
            const units = modelUnits(m, periodIdx)
            const rev = modelRevenue(m, periodIdx)
            const barPct = Math.round(units / maxUnits * 100)
            const ytd = modelYtd(m)
            return `<div style="margin-bottom:14px" class="model-bar" data-model="${m.model}" style="cursor:pointer">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:0.83rem;cursor:pointer">
                <span><span style="font-size:1rem">${m.icon}</span> <strong>${m.model}</strong> <span style="font-size:0.7rem;color:var(--text-muted)">${m.brand} · ${m.type}</span></span>
                <span style="font-weight:700">${units} คัน · ${formatCurrency(rev)}</span>
              </div>
              <div style="background:var(--surface-2);border-radius:4px;height:10px">
                <div style="width:${barPct}%;background:${m.color};height:10px;border-radius:4px;transition:width 0.3s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-top:3px">
                <span>Margin ${m.margin}%</span>
                <span>YTD ${ytd.units} คัน · ${formatCurrency(ytd.revenue)}</span>
              </div>
            </div>`
          }).join('')}
        </div>

        <!-- Trend table -->
        <div class="card" style="overflow:hidden;margin-bottom:14px">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📈 Trend รายเดือน (คัน)</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:700px">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">รุ่น</th>
                  ${MONTH_LABELS.map((m, i) => `<th style="padding:6px 8px;text-align:right;${i===periodIdx?'color:var(--primary);font-weight:800':''}">${m}</th>`).join('')}
                  <th style="padding:8px 12px;text-align:right">YTD</th>
                  <th style="padding:8px 12px;text-align:right">Margin</th>
                </tr>
              </thead>
              <tbody>
                ${MODELS.map(m => {
                  const ytd = modelYtd(m)
                  return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" class="model-row" data-model="${m.model}">
                    <td style="padding:8px 14px;font-size:0.82rem">
                      <span style="color:${m.color}">${m.icon}</span> ${m.model}
                      <div style="font-size:0.67rem;color:var(--text-muted)">${m.type}</div>
                    </td>
                    ${MONTH_LABELS.map((_, i) => {
                      const v = modelUnits(m, i)
                      const prev = i > 0 ? modelUnits(m, i-1) : v
                      const up = v > prev; const down = v < prev
                      return `<td style="padding:6px 8px;text-align:right;font-size:0.8rem;${i===periodIdx?'font-weight:900;color:'+m.color:''}">${v}${i>0&&v!==prev?`<span style="font-size:0.55rem;color:var(--${up?'success':'danger'})">${up?'▲':'▼'}</span>`:''}</td>`
                    }).join('')}
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--primary)">${ytd.units}</td>
                    <td style="padding:8px 12px;text-align:right;color:var(--success)">${m.margin}%</td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Model cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
          ${sorted.map(m => {
            const units = modelUnits(m, periodIdx)
            const ytd = modelYtd(m)
            return `<div class="card card-lift" style="padding:14px;border-left:4px solid ${m.color};cursor:pointer" data-model="${m.model}">
              <div style="font-size:1.8rem;margin-bottom:6px">${m.icon}</div>
              <div style="font-weight:700;font-size:0.9rem">${m.model}</div>
              <div style="font-size:0.71rem;color:var(--text-muted)">${m.brand} · ${m.type} · Margin ${m.margin}%</div>
              <div style="margin-top:8px;font-size:1.2rem;font-weight:900;color:${m.color}">${units} คัน</div>
              <div style="font-size:0.71rem;color:var(--text-muted)">${formatCurrency(m.price)}/คัน</div>
              <div style="font-size:0.75rem;color:var(--success);margin-top:3px">${formatCurrency(modelRevenue(m, periodIdx))}</div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-top:4px">YTD: ${ytd.units} คัน · ${formatCurrency(ytd.revenue)}</div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.period-btn').forEach(b => b.addEventListener('click', () => { periodIdx = +b.dataset.i; renderPage() }))
    container.querySelectorAll('.sort-btn').forEach(b => b.addEventListener('click', () => { sortBy = b.dataset.s; renderPage() }))
    container.querySelectorAll('[data-model]').forEach(el => el.addEventListener('click', () => {
      const m = MODELS.find(x => x.model === el.dataset.model)
      if (m) openModelDetail(m)
    }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const rows = MODELS.map(m => {
        const ytd = modelYtd(m)
        const mo = modelUnits(m, periodIdx)
        return { รุ่น: m.model, ยี่ห้อ: m.brand, ประเภท: m.type, [`คัน_${MONTH_LABELS[periodIdx]}`]: mo, [`รายได้_${MONTH_LABELS[periodIdx]}`]: modelRevenue(m, periodIdx), YTD_คัน: ytd.units, YTD_รายได้: ytd.revenue, Margin: m.margin + '%', ราคา: m.price }
      })
      exportToExcel(rows, 'sales_by_model')
    })
  }

  function openModelDetail(m) {
    const ytd = modelYtd(m)
    const r = findReal(m)
    openModal({
      title: `${m.icon} ${m.model}`,
      size: 'sm',
      body: `
        <div style="margin-bottom:12px">
          <span class="badge badge-primary">${m.brand}</span>
          <span class="badge badge-secondary" style="margin-left:4px">${m.type}</span>
          ${r ? '<span class="badge badge-success" style="margin-left:4px">● ข้อมูลจริง</span>' : ''}
        </div>
        ${row('ราคา', formatCurrency(m.price))}
        ${row('Margin', m.margin + '%')}
        ${row('ยอดขาย YTD', ytd.units + ' คัน')}
        ${row('รายได้ YTD', formatCurrency(ytd.revenue))}
        <div style="margin-top:12px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">📊 ยอดขายรายเดือน (คัน)</div>
          ${MONTH_LABELS.map((mo, i) => {
            const v = modelUnits(m, i)
            const maxV = Math.max(...MONTH_LABELS.map((_, j) => modelUnits(m, j)), 1)
            const pct = Math.round(v / maxV * 100)
            return `<div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;margin-bottom:4px">
              <div style="width:30px;color:var(--text-muted)">${mo}</div>
              <div style="flex:1;height:7px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${m.color};border-radius:4px"></div>
              </div>
              <div style="width:40px;text-align:right;font-weight:700;color:${m.color}">${v}</div>
            </div>`
          }).join('')}
        </div>
        <div style="margin-top:10px;font-size:0.72rem;color:var(--text-muted)">สีที่มี: ${m.colors.join(' · ')}</div>
      `
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
