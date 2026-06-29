import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getSalesData } from '../../core/db.js'

const CATEGORIES = {
  revenue: {
    label: 'รายได้', color: 'success', icon: '💰',
    items: ['ยอดขายรถยนต์', 'รายได้บริการซ่อม', 'รายได้อะไหล่', 'รายได้ประกันภัย', 'Commission ไฟแนนซ์', 'รายได้อื่นๆ']
  },
  cogs: {
    label: 'ต้นทุนขาย', color: 'warning', icon: '🔧',
    items: ['ต้นทุนรถยนต์', 'ต้นทุนอะไหล่', 'ต้นทุนงานซ่อม', 'Commission พนักงานขาย']
  },
  opex: {
    label: 'ค่าใช้จ่ายดำเนินงาน', color: 'danger', icon: '📋',
    items: ['เงินเดือนพนักงาน', 'ค่าเช่าสำนักงาน', 'ค่าสาธารณูปโภค', 'ค่าการตลาดโฆษณา', 'ค่าเสื่อมราคา', 'ค่าประกันภัยทรัพย์สิน', 'ค่าใช้จ่ายอื่นๆ']
  }
}

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function makeRow(name, budgets, actuals) {
  return { name, budgets: budgets || Array(12).fill(0), actuals: actuals || Array(12).fill(0) }
}

const DEMO_BUDGET = {
  year: 2025,
  revenue: [
    makeRow('ยอดขายรถยนต์', [8000000,7000000,10000000,9000000,12000000,9000000,10000000,11000000,10000000,9500000,11000000,15000000], [9200000,6800000,13100000,10200000,15400000,8300000,0,0,0,0,0,0]),
    makeRow('รายได้บริการซ่อม', [280000,280000,320000,300000,350000,320000,320000,350000,320000,300000,350000,400000], [310000,295000,345000,320000,380000,324000,0,0,0,0,0,0]),
    makeRow('รายได้อะไหล่', [120000,120000,140000,130000,160000,140000,140000,150000,140000,130000,150000,180000], [130000,115000,145000,135000,165000,142000,0,0,0,0,0,0]),
    makeRow('รายได้ประกันภัย', [200000,200000,250000,220000,280000,250000,250000,280000,260000,240000,280000,320000], [220000,180000,265000,230000,290000,268000,0,0,0,0,0,0]),
    makeRow('Commission ไฟแนนซ์', [160000,140000,200000,180000,240000,180000,200000,220000,200000,190000,220000,300000], [184000,136000,262000,204000,308000,166000,0,0,0,0,0,0]),
    makeRow('รายได้อื่นๆ', [40000,40000,40000,40000,40000,40000,40000,40000,40000,40000,40000,40000], [45000,38000,42000,41000,43000,40000,0,0,0,0,0,0]),
  ],
  cogs: [
    makeRow('ต้นทุนรถยนต์', [6800000,5950000,8500000,7650000,10200000,7650000,8500000,9350000,8500000,8075000,9350000,12750000], [7820000,5780000,11135000,8670000,13090000,7055000,0,0,0,0,0,0]),
    makeRow('ต้นทุนอะไหล่', [80000,80000,90000,85000,100000,90000,90000,95000,90000,85000,95000,110000], [85000,75000,92000,88000,105000,93000,0,0,0,0,0,0]),
    makeRow('ต้นทุนงานซ่อม', [140000,140000,160000,150000,175000,160000,160000,175000,160000,150000,175000,200000], [155000,148000,173000,160000,190000,162000,0,0,0,0,0,0]),
    makeRow('Commission พนักงานขาย', [320000,280000,400000,360000,480000,360000,400000,440000,400000,380000,440000,600000], [368000,272000,524000,408000,616000,332000,0,0,0,0,0,0]),
  ],
  opex: [
    makeRow('เงินเดือนพนักงาน', [450000,450000,450000,450000,450000,450000,450000,450000,450000,450000,450000,900000], [450000,450000,450000,450000,450000,450000,0,0,0,0,0,0]),
    makeRow('ค่าเช่าสำนักงาน', [120000,120000,120000,120000,120000,120000,120000,120000,120000,120000,120000,120000], [120000,120000,120000,120000,120000,120000,0,0,0,0,0,0]),
    makeRow('ค่าสาธารณูปโภค', [30000,28000,32000,30000,35000,38000,40000,40000,35000,30000,28000,30000], [31000,27000,33000,31000,36000,39000,0,0,0,0,0,0]),
    makeRow('ค่าการตลาดโฆษณา', [100000,80000,120000,100000,150000,120000,120000,130000,120000,100000,120000,200000], [95000,72000,135000,108000,185000,110000,0,0,0,0,0,0]),
    makeRow('ค่าเสื่อมราคา', [50000,50000,50000,50000,50000,50000,50000,50000,50000,50000,50000,50000], [50000,50000,50000,50000,50000,50000,0,0,0,0,0,0]),
    makeRow('ค่าประกันภัยทรัพย์สิน', [20000,20000,20000,20000,20000,20000,20000,20000,20000,20000,20000,20000], [20000,20000,20000,20000,20000,20000,0,0,0,0,0,0]),
    makeRow('ค่าใช้จ่ายอื่นๆ', [30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000], [28000,27000,31000,29000,32000,29000,0,0,0,0,0,0]),
  ]
}

export default async function BudgetPlanningPage(container) {
  const myGen = container.__routerGen
  let viewMode = 'annual' // annual | monthly
  let selectedMonth = new Date().getMonth() // 0-based
  let catView = 'all'
  const budget = { ...DEMO_BUDGET, revenue: DEMO_BUDGET.revenue.map(r => ({ ...r, actuals: [...r.actuals] })) }
  let dataSource = 'demo'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const byMonth = Array(12).fill(0)
      for (const s of sales) {
        const d = s.bookingDate || s.deliveryDate || ''
        if (!d) continue
        const yr = parseInt(d.slice(0, 4))
        const mo = parseInt(d.slice(5, 7)) - 1
        if (yr === DEMO_BUDGET.year && mo >= 0 && mo < 12) byMonth[mo] += s.salePrice || 0
      }
      for (let mo = 0; mo < 12; mo++) {
        if (byMonth[mo] > 0) budget.revenue[0].actuals[mo] = byMonth[mo]
      }
      dataSource = 'live'
    }
  } catch {}

  function sumRow(row, field) { return row[field].reduce((a, b) => a + b, 0) }
  function sumCat(cat, field, mIdx) {
    return budget[cat].reduce((a, r) => a + (mIdx !== undefined ? r[field][mIdx] : sumRow(r, field)), 0)
  }

  function netProfit(mIdx) {
    const rev = sumCat('revenue', 'budgets', mIdx)
    const cogs = sumCat('cogs', 'budgets', mIdx)
    const opex = sumCat('opex', 'budgets', mIdx)
    return rev - cogs - opex
  }

  function netActual(mIdx) {
    const rev = sumCat('revenue', 'actuals', mIdx)
    const cogs = sumCat('cogs', 'actuals', mIdx)
    const opex = sumCat('opex', 'actuals', mIdx)
    return rev - cogs - opex
  }

  function renderPage() {
    const totalRevBudget = sumCat('revenue', 'budgets')
    const totalRevActual = sumCat('revenue', 'actuals')
    const totalCOGSBudget = sumCat('cogs', 'budgets')
    const totalCOGSActual = sumCat('cogs', 'actuals')
    const totalOpexBudget = sumCat('opex', 'budgets')
    const totalOpexActual = sumCat('opex', 'actuals')
    const totalNetBudget = totalRevBudget - totalCOGSBudget - totalOpexBudget
    const totalNetActual = totalRevActual - totalCOGSActual - totalOpexActual

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Budget Planning ${budget.year}</div>
            <div class="page-subtitle">วางแผนงบประมาณและเปรียบเทียบ Actual vs Budget${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ยอดขายจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm ${viewMode==='annual'?'btn-primary':'btn-secondary'}" id="view-annual">📅 รายปี</button>
              <button class="btn btn-sm ${viewMode==='monthly'?'btn-primary':'btn-secondary'}" id="view-monthly">📆 รายเดือน</button>
            </div>
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
          </div>
        </div>

        <!-- Annual KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('💰 รายได้ Budget', formatCurrency(totalRevBudget), 'primary')}
          ${kpi('💰 รายได้ Actual', formatCurrency(totalRevActual), 'success')}
          ${kpi('📊 Net Profit Budget', formatCurrency(totalNetBudget), 'primary')}
          ${kpi('📊 Net Profit Actual', formatCurrency(totalNetActual), totalNetActual >= totalNetBudget ? 'success' : 'danger')}
        </div>

        ${viewMode === 'annual' ? renderAnnual() : renderMonthly()}
      </div>
    `

    document.getElementById('view-annual')?.addEventListener('click', () => { viewMode = 'annual'; renderPage() })
    document.getElementById('view-monthly')?.addEventListener('click', () => { viewMode = 'monthly'; renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', exportBudget)
    document.getElementById('month-select')?.addEventListener('change', e => { selectedMonth = +e.target.value; renderPage() })
    document.querySelectorAll('.edit-cell').forEach(cell => {
      cell.addEventListener('dblclick', () => {
        const cat = cell.dataset.cat
        const rowIdx = +cell.dataset.row
        const mIdx = +cell.dataset.m
        const field = cell.dataset.field
        const current = budget[cat][rowIdx][field][mIdx]
        const val = prompt(`แก้ไข ${budget[cat][rowIdx].name} ${MONTHS[mIdx]} (${field === 'budgets' ? 'Budget' : 'Actual'}):`, current)
        if (val !== null && !isNaN(+val)) {
          budget[cat][rowIdx][field][mIdx] = +val
          renderPage()
        }
      })
    })
  }

  function renderAnnual() {
    return `
      <div style="overflow-x:auto">
        <table class="table" style="min-width:1200px">
          <thead>
            <tr>
              <th style="min-width:200px">รายการ</th>
              ${MONTHS.map(m => `<th class="text-right" style="min-width:100px;font-size:0.75rem">${m}</th>`).join('')}
              <th class="text-right" style="min-width:120px">รวม</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(CATEGORIES).map(([cat, catInfo]) => {
              const catTotal = budget[cat].reduce((a, r) => a + sumRow(r, 'budgets'), 0)
              const catActual = budget[cat].reduce((a, r) => a + sumRow(r, 'actuals'), 0)
              return `
                <tr style="background:var(--surface-2)">
                  <td colspan="${13 + 1}" style="padding:8px 12px;font-weight:800;font-size:0.82rem;color:var(--${catInfo.color})">
                    ${catInfo.icon} ${catInfo.label}
                  </td>
                </tr>
                ${budget[cat].map((row, ri) => {
                  const rowTotal = sumRow(row, 'budgets')
                  const rowActual = sumRow(row, 'actuals')
                  return `<tr>
                    <td style="font-size:0.82rem;padding-left:20px">${row.name}</td>
                    ${row.budgets.map((b, mi) => {
                      const a = row.actuals[mi]
                      const hasActual = a > 0
                      const diff = hasActual ? a - b : null
                      const isOver = diff !== null && cat !== 'revenue' ? diff > 0 : diff !== null && cat === 'revenue' ? diff < 0 : false
                      return `<td class="text-right edit-cell" data-cat="${cat}" data-row="${ri}" data-m="${mi}" data-field="budgets" style="cursor:pointer;font-size:0.75rem;padding:6px 8px">
                        <div>${(b/1000).toFixed(0)}K</div>
                        ${hasActual ? `<div style="color:${isOver?'var(--danger)':'var(--success)'};font-size:0.65rem">${(a/1000).toFixed(0)}K</div>` : ''}
                      </td>`
                    }).join('')}
                    <td class="text-right" style="font-size:0.78rem;font-weight:700">
                      <div>${formatCurrency(rowTotal)}</div>
                      ${rowActual ? `<div style="color:${rowActual >= rowTotal && cat==='revenue'?'var(--success)':'var(--warning)'};font-size:0.7rem">${formatCurrency(rowActual)}</div>` : ''}
                    </td>
                  </tr>`
                }).join('')}
                <tr style="background:rgba(0,0,0,.15)">
                  <td style="font-weight:700;font-size:0.82rem;padding-left:20px">รวม ${catInfo.label}</td>
                  ${MONTHS.map((_, mi) => {
                    const b = sumCat(cat, 'budgets', mi)
                    const a = sumCat(cat, 'actuals', mi)
                    return `<td class="text-right" style="font-size:0.75rem;font-weight:700">
                      <div style="color:var(--${catInfo.color})">${(b/1000).toFixed(0)}K</div>
                      ${a > 0 ? `<div style="font-size:0.65rem;color:var(--text-muted)">${(a/1000).toFixed(0)}K</div>` : ''}
                    </td>`
                  }).join('')}
                  <td class="text-right" style="font-weight:800;color:var(--${catInfo.color})">${formatCurrency(catTotal)}</td>
                </tr>
              `
            }).join('')}

            <!-- Net Profit row -->
            <tr style="background:var(--surface);border-top:2px solid var(--border)">
              <td style="font-weight:800;font-size:0.88rem">💎 Net Profit</td>
              ${MONTHS.map((_, mi) => {
                const nb = netProfit(mi)
                const na = netActual(mi)
                const hasA = sumCat('revenue', 'actuals', mi) > 0
                return `<td class="text-right" style="font-size:0.75rem;font-weight:700">
                  <div style="color:${nb>=0?'var(--success)':'var(--danger)'}">${(nb/1000).toFixed(0)}K</div>
                  ${hasA ? `<div style="font-size:0.65rem;color:${na>=0?'var(--success)':'var(--danger)'}">${(na/1000).toFixed(0)}K</div>` : ''}
                </td>`
              }).join('')}
              <td class="text-right" style="font-weight:800;font-size:0.9rem;color:${[...Array(12)].reduce((a,_,mi)=>a+netProfit(mi),0)>=0?'var(--success)':'var(--danger)'}">
                ${formatCurrency([...Array(12)].reduce((a,_,mi)=>a+netProfit(mi),0))}
              </td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:8px">💡 ดับเบิ้ลคลิกที่ตัวเลขเพื่อแก้ไข Budget · บรรทัดที่ 2 ในแต่ละช่อง = Actual</div>
      </div>
    `
  }

  function renderMonthly() {
    const m = selectedMonth
    const revB = sumCat('revenue', 'budgets', m)
    const revA = sumCat('revenue', 'actuals', m)
    const cogsB = sumCat('cogs', 'budgets', m)
    const cogsA = sumCat('cogs', 'actuals', m)
    const opexB = sumCat('opex', 'budgets', m)
    const opexA = sumCat('opex', 'actuals', m)
    const gpB = revB - cogsB
    const gpA = revA - cogsA
    const npB = gpB - opexB
    const npA = gpA - opexA

    return `
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <select class="input" id="month-select" style="width:140px">
            ${MONTHS.map((mo, i) => `<option value="${i}" ${i===m?'selected':''}>${mo} ${budget.year}</option>`).join('')}
          </select>
          <div style="font-size:0.85rem;color:var(--text-muted)">Actual vs Budget เดือน ${MONTHS[m]}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 320px;gap:16px">
          <!-- Detailed table -->
          <div class="card" style="padding:0;overflow:hidden">
            <table class="table">
              <thead><tr><th>รายการ</th><th class="text-right">Budget</th><th class="text-right">Actual</th><th class="text-right">+/-</th><th class="text-right">%</th></tr></thead>
              <tbody>
                ${Object.entries(CATEGORIES).map(([cat, catInfo]) => `
                  <tr style="background:var(--surface-2)">
                    <td colspan="5" style="font-weight:800;font-size:0.8rem;color:var(--${catInfo.color});padding:8px 12px">${catInfo.icon} ${catInfo.label}</td>
                  </tr>
                  ${budget[cat].map(row => {
                    const b = row.budgets[m]
                    const a = row.actuals[m]
                    const diff = a - b
                    const pct = b ? (diff / b * 100).toFixed(1) : 0
                    const isGood = cat === 'revenue' ? diff >= 0 : diff <= 0
                    return `<tr>
                      <td style="font-size:0.82rem;padding-left:20px">${row.name}</td>
                      <td class="text-right" style="font-size:0.82rem">${formatCurrency(b)}</td>
                      <td class="text-right" style="font-size:0.82rem;font-weight:600">${a ? formatCurrency(a) : '<span style="color:var(--text-muted)">-</span>'}</td>
                      <td class="text-right" style="font-size:0.82rem;color:${a && !isGood?'var(--danger)':a?'var(--success)':'var(--text-muted)'}">${a ? (diff >= 0 ? '+' : '') + (diff/1000).toFixed(0) + 'K' : '-'}</td>
                      <td class="text-right" style="font-size:0.78rem;color:${a && !isGood?'var(--danger)':a?'var(--success)':'var(--text-muted)'}">${a ? (diff >= 0 ? '+' : '') + pct + '%' : '-'}</td>
                    </tr>`
                  }).join('')}
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Summary card -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="card" style="padding:16px">
              <div style="font-weight:700;font-size:0.88rem;margin-bottom:12px">📊 สรุป ${MONTHS[m]}</div>
              ${summaryRow('💰 รายได้', revB, revA, 'revenue')}
              ${summaryRow('🔧 ต้นทุนขาย', cogsB, cogsA, 'cogs')}
              <div style="border-top:1px solid var(--border);margin:8px 0;padding-top:8px">
              ${summaryRow('📊 Gross Profit', gpB, gpA, 'revenue')}
              </div>
              ${summaryRow('📋 ค่าใช้จ่าย', opexB, opexA, 'cogs')}
              <div style="border-top:2px solid var(--border);margin:8px 0;padding-top:8px">
              ${summaryRow('💎 Net Profit', npB, npA, 'revenue')}
              </div>
            </div>

            <!-- Waterfall chart (simple) -->
            <div class="card" style="padding:16px">
              <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">📈 Profit Waterfall</div>
              ${[['รายได้', revA, 'success'],['ต้นทุน', -cogsA, 'warning'],['ค่าใช้จ่าย', -opexA, 'danger'],['Net Profit', npA, npA>=0?'success':'danger']].map(([label, val, color]) => {
                const maxVal = revA || 1
                const pct = Math.abs(Math.round(val / maxVal * 100))
                return `<div style="margin-bottom:8px">
                  <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                    <span>${label}</span>
                    <span style="color:var(--${color});font-weight:700">${formatCurrency(Math.abs(val))}</span>
                  </div>
                  <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:var(--${color});border-radius:4px;opacity:0.8"></div>
                  </div>
                </div>`
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `
  }

  function summaryRow(label, budget, actual, type) {
    const diff = actual - budget
    const isGood = type === 'revenue' ? diff >= 0 : diff <= 0
    const hasActual = actual > 0
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem">
      <span style="color:var(--text-muted)">${label}</span>
      <div style="text-align:right">
        <div style="font-weight:700">${formatCurrency(budget)}</div>
        ${hasActual ? `<div style="color:${isGood?'var(--success)':'var(--danger)'};font-size:0.75rem">${formatCurrency(actual)} (${diff>=0?'+':''}${(diff/budget*100).toFixed(1)}%)</div>` : ''}
      </div>
    </div>`
  }

  function exportBudget() {
    const rows = []
    Object.entries(CATEGORIES).forEach(([cat, catInfo]) => {
      budget[cat].forEach(row => {
        const obj = { หมวด: catInfo.label, รายการ: row.name }
        MONTHS.forEach((m, i) => { obj[`Budget ${m}`] = row.budgets[i]; obj[`Actual ${m}`] = row.actuals[i] })
        obj['Budget รวม'] = sumRow(row, 'budgets')
        obj['Actual รวม'] = sumRow(row, 'actuals')
        rows.push(obj)
      })
    })
    exportToExcel(rows, `budget_${budget.year}`)
    showToast('📥 Export งบประมาณแล้ว!', 'success')
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
