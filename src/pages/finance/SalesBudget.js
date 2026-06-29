/**
 * Sales Budget — งบขาย + งบแถม
 * Route: /finance/sales-budget
 * เปรียบเทียบเป้ายอดขาย vs จริง, งบโปรโมชั่น vs ใช้ไป รายเดือน
 */
import { getSalesData } from '../../core/db.js'
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const YEAR = 2025
const LS_KEY = 'lamom_sales_budget_2025'

// เป้ายอดขาย default (บาท) รายเดือน — สามารถ edit ได้
const DEFAULT_TARGETS = [9000000, 8500000, 12000000, 10000000, 13000000, 9000000, 10000000, 11000000, 10000000, 11000000, 13000000, 18000000]
// งบแถม/FOC default รายเดือน
const DEFAULT_FOC_BUDGET = [300000, 250000, 400000, 350000, 450000, 300000, 350000, 380000, 350000, 380000, 450000, 600000]

// ข้อมูลเซลส์ demo (ใช้เมื่อไม่มีข้อมูลจริง)
const DEMO_SALES_BY_MONTH = {
  0: { revenue: 9200000, units: 8, foc: 180000 },
  1: { revenue: 6800000, units: 6, foc: 120000 },
  2: { revenue: 13100000, units: 11, foc: 380000 },
  3: { revenue: 10200000, units: 9, foc: 290000 },
  4: { revenue: 15400000, units: 13, foc: 410000 },
  5: { revenue: 8300000, units: 7, foc: 140000 },
}

function loadBudgets() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    return {
      targets: saved.targets || [...DEFAULT_TARGETS],
      focBudget: saved.focBudget || [...DEFAULT_FOC_BUDGET],
    }
  } catch { return { targets: [...DEFAULT_TARGETS], focBudget: [...DEFAULT_FOC_BUDGET] } }
}

function saveBudgets(targets, focBudget) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ targets, focBudget })) } catch {}
}

export default async function SalesBudgetPage(container) {
  const myGen = container.__routerGen
  let { targets, focBudget } = loadBudgets()
  let actualByMonth = {}
  let tab = 'sales'     // 'sales' | 'foc' | 'person'
  let editMode = false

  // โหลดข้อมูลจริง
  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return
    sales.forEach(s => {
      const mo = parseInt((s.date || '').slice(5, 7)) - 1
      if (isNaN(mo) || mo < 0 || mo > 11) return
      if (!actualByMonth[mo]) actualByMonth[mo] = { revenue: 0, units: 0, foc: 0, salesPersons: {} }
      actualByMonth[mo].revenue += s.salePrice || 0
      actualByMonth[mo].units++
      actualByMonth[mo].foc += s.budgetUsed || s.discount || 0
      const sp = s.salesName || 'ไม่ระบุ'
      if (!actualByMonth[mo].salesPersons[sp]) actualByMonth[mo].salesPersons[sp] = { revenue: 0, units: 0 }
      actualByMonth[mo].salesPersons[sp].revenue += s.salePrice || 0
      actualByMonth[mo].salesPersons[sp].units++
    })
    // ถ้าไม่มีข้อมูลจริงใช้ demo
    if (Object.keys(actualByMonth).length < 2) {
      actualByMonth = { ...DEMO_SALES_BY_MONTH }
      Object.keys(actualByMonth).forEach(k => {
        if (!actualByMonth[k].salesPersons) {
          actualByMonth[k].salesPersons = {
            'อรนุช เซลส์ดี': { revenue: Math.round(actualByMonth[k].revenue * 0.6), units: Math.ceil(actualByMonth[k].units * 0.6) },
            'วิชัย ขายเก่ง': { revenue: Math.round(actualByMonth[k].revenue * 0.4), units: Math.floor(actualByMonth[k].units * 0.4) },
          }
        }
      })
    }
  } catch {
    if (container.__routerGen !== myGen) return
    actualByMonth = { ...DEMO_SALES_BY_MONTH }
  }

  function calcTotals() {
    let totalTarget = 0, totalActual = 0, totalFocBudget = 0, totalFocUsed = 0
    for (let m = 0; m < 12; m++) {
      const act = actualByMonth[m]
      totalTarget += targets[m] || 0
      totalActual += act ? act.revenue : 0
      totalFocBudget += focBudget[m] || 0
      totalFocUsed += act ? (act.foc || 0) : 0
    }
    const pct = totalTarget > 0 ? Math.round(totalActual / totalTarget * 100) : 0
    const focPct = totalFocBudget > 0 ? Math.round(totalFocUsed / totalFocBudget * 100) : 0
    return { totalTarget, totalActual, totalFocBudget, totalFocUsed, pct, focPct }
  }

  function getSalesPersons() {
    const persons = {}
    Object.values(actualByMonth).forEach(mo => {
      if (!mo.salesPersons) return
      Object.entries(mo.salesPersons).forEach(([name, data]) => {
        if (!persons[name]) persons[name] = { revenue: 0, units: 0 }
        persons[name].revenue += data.revenue || 0
        persons[name].units += data.units || 0
      })
    })
    return persons
  }

  function render() {
    const tot = calcTotals()
    const hasData = Object.keys(actualByMonth).length > 0

    container.innerHTML =
      '<div class="page-content animate-slide">' +
        '<div class="page-header"><div>' +
          '<div class="page-title">🎯 งบขาย & งบแถม ' + YEAR + '</div>' +
          '<div class="page-subtitle">เป้ายอดขาย vs จริง · งบ FOC/โปรโมชั่น vs ใช้ไป รายเดือน</div>' +
        '</div><div class="page-actions">' +
          '<button class="btn ' + (editMode?'btn-warning':'btn-secondary') + '" id="sb-edit">' + (editMode?'✅ บันทึกเป้า':'✏️ แก้ไขเป้า') + '</button>' +
          '<button class="btn btn-secondary" id="sb-reset" style="' + (editMode?'':'display:none') + '">↺ Reset</button>' +
          '<button class="btn btn-secondary" id="sb-export">📥 Export</button>' +
        '</div></div>' +

        // KPI Cards
        '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px">' +
          kpi('🎯 เป้ายอดขายรวม', formatCurrency(tot.totalTarget), 'primary') +
          kpi('💰 ยอดจริงรวม', formatCurrency(tot.totalActual), 'success') +
          kpi('📈 Achievement', tot.pct + '%', tot.pct >= 100 ? 'success' : tot.pct >= 80 ? 'warning' : 'danger') +
          kpi('💸 งบ FOC รวม', formatCurrency(tot.totalFocBudget), 'accent') +
          kpi('🎁 FOC ใช้ไป', formatCurrency(tot.totalFocUsed), 'warning') +
          kpi('📊 FOC%', tot.focPct + '%', tot.focPct <= 100 ? 'success' : 'danger') +
        '</div>' +

        // Tabs
        '<div style="display:flex;gap:6px;margin-bottom:16px">' +
          '<button class="btn btn-sm ' + (tab==='sales'?'btn-primary':'btn-secondary') + '" id="tab-sales">📊 งบขายรายเดือน</button>' +
          '<button class="btn btn-sm ' + (tab==='foc'?'btn-primary':'btn-secondary') + '" id="tab-foc">🎁 งบแถม FOC</button>' +
          '<button class="btn btn-sm ' + (tab==='person'?'btn-primary':'btn-secondary') + '" id="tab-person">👤 แยกตามเซลส์</button>' +
        '</div>' +

        // Tab content
        '<div id="sb-content">' + renderTabContent(tot, hasData) + '</div>' +
      '</div>'

    container.querySelector('#tab-sales').addEventListener('click', () => { tab = 'sales'; updateContent() })
    container.querySelector('#tab-foc').addEventListener('click', () => { tab = 'foc'; updateContent() })
    container.querySelector('#tab-person').addEventListener('click', () => { tab = 'person'; updateContent() })
    container.querySelector('#sb-edit').addEventListener('click', () => {
      if (editMode) {
        // บันทึกค่าที่แก้ไข
        for (let m = 0; m < 12; m++) {
          const tEl = container.querySelector('#target-' + m)
          const fEl = container.querySelector('#foc-' + m)
          if (tEl) targets[m] = parseFloat(tEl.value.replace(/,/g, '')) || targets[m]
          if (fEl) focBudget[m] = parseFloat(fEl.value.replace(/,/g, '')) || focBudget[m]
        }
        saveBudgets(targets, focBudget)
        showToast('💾 บันทึกเป้าแล้ว', 'success')
        editMode = false
      } else {
        editMode = true
      }
      render()
    })
    container.querySelector('#sb-reset')?.addEventListener('click', () => {
      targets = [...DEFAULT_TARGETS]
      focBudget = [...DEFAULT_FOC_BUDGET]
      saveBudgets(targets, focBudget)
      showToast('↺ Reset เป้าแล้ว', 'warning')
      render()
    })
    container.querySelector('#sb-export').addEventListener('click', () => {
      exportToExcel(MONTHS_TH.map((mo, m) => {
        const act = actualByMonth[m]
        const revenue = act ? act.revenue : 0
        const focUsed = act ? (act.foc || 0) : 0
        return {
          เดือน: mo + ' ' + YEAR, เป้ายอดขาย: targets[m], ยอดจริง: revenue,
          'Achievement%': targets[m] > 0 ? Math.round(revenue / targets[m] * 100) + '%' : '-',
          งบFOC: focBudget[m], FOCจริง: focUsed,
          'FOC%': focBudget[m] > 0 ? Math.round(focUsed / focBudget[m] * 100) + '%' : '-'
        }
      }), 'sales_budget_' + YEAR)
      showToast('📥 Export แล้ว', 'success')
    })
  }

  function updateContent() {
    const tot = calcTotals()
    const content = container.querySelector('#sb-content')
    if (content) content.innerHTML = renderTabContent(tot, true)
    container.querySelectorAll('[id^="tab-"]').forEach(b => {
      b.className = 'btn btn-sm ' + (b.id === 'tab-' + tab ? 'btn-primary' : 'btn-secondary')
    })
  }

  function renderTabContent(tot, hasData) {
    if (tab === 'sales') return renderSalesTab(tot)
    if (tab === 'foc') return renderFocTab(tot)
    if (tab === 'person') return renderPersonTab(tot)
    return ''
  }

  function renderSalesTab(tot) {
    const currentMonth = new Date().getMonth()
    return '<div class="card" style="padding:0;overflow:hidden;overflow-x:auto">' +
      '<table>' +
        '<thead><tr>' +
          '<th style="min-width:70px">เดือน</th>' +
          '<th class="text-right" style="min-width:110px">เป้ายอดขาย</th>' +
          '<th class="text-right" style="min-width:110px">ยอดจริง</th>' +
          '<th class="text-right" style="min-width:70px">Ach%</th>' +
          '<th class="text-right" style="min-width:80px">+/- (บาท)</th>' +
          '<th style="min-width:100px">Progress</th>' +
        '</tr></thead>' +
        '<tbody>' +
          MONTHS_TH.map((mo, m) => {
            const act = actualByMonth[m]
            const revenue = act ? act.revenue : 0
            const target = targets[m] || 0
            const pct = target > 0 ? Math.round(revenue / target * 100) : 0
            const diff = revenue - target
            const hasFuture = m > currentMonth
            const rowStyle = m === currentMonth ? 'background:var(--surface-2)' : hasFuture ? 'opacity:0.55' : ''
            const pctColor = pct >= 100 ? 'success' : pct >= 80 ? 'warning' : pct > 0 ? 'danger' : 'muted'
            return '<tr style="' + rowStyle + '">' +
              '<td><strong>' + mo + '</strong>' + (m === currentMonth ? ' <span style="font-size:0.65rem;color:var(--primary)">◀ ปัจจุบัน</span>' : '') + '</td>' +
              '<td class="text-right">' +
                (editMode && !hasFuture ? '<input type="text" style="width:100px;text-align:right;border:1px solid var(--primary);border-radius:4px;padding:2px 6px;font-size:0.82rem;background:var(--surface)" id="target-' + m + '" value="' + target.toLocaleString() + '">' : formatCurrency(target)) +
              '</td>' +
              '<td class="text-right" style="font-weight:600;color:var(--' + (revenue > 0 ? 'success' : 'muted') + ')">' + (revenue > 0 ? formatCurrency(revenue) : '<span style="color:var(--text-muted)">-</span>') + '</td>' +
              '<td class="text-right"><span class="badge badge-' + pctColor + '" style="font-size:0.7rem">' + (revenue > 0 || !hasFuture ? pct + '%' : '-') + '</span></td>' +
              '<td class="text-right" style="font-size:0.82rem;color:var(--' + (diff >= 0 ? 'success' : 'danger') + ')">' +
                (revenue > 0 ? (diff >= 0 ? '+' : '') + formatCurrency(diff) : '-') +
              '</td>' +
              '<td>' +
                (revenue > 0 ? '<div style="background:var(--surface-2);border-radius:3px;height:8px;min-width:80px"><div style="width:' + Math.min(100,pct) + '%;height:8px;background:var(--' + pctColor + ');border-radius:3px"></div></div>' : '<span style="font-size:0.72rem;color:var(--text-muted)">' + (hasFuture ? 'ยังไม่ถึงเดือน' : 'ไม่มีข้อมูล') + '</span>') +
              '</td>' +
            '</tr>'
          }).join('') +
        '</tbody>' +
        '<tfoot><tr style="background:var(--surface-2);font-weight:800">' +
          '<td>รวมทั้งปี</td>' +
          '<td class="text-right">' + formatCurrency(targets.reduce((a,v) => a+v,0)) + '</td>' +
          '<td class="text-right" style="color:var(--success)">' + formatCurrency(Object.values(actualByMonth).reduce((a,v) => a+(v.revenue||0),0)) + '</td>' +
          '<td class="text-right"><span class="badge badge-' + (tot.pct>=100?'success':tot.pct>=80?'warning':'danger') + '">' + tot.pct + '%</span></td>' +
          '<td class="text-right" style="color:var(--' + (tot.totalActual>=tot.totalTarget?'success':'danger') + ')">' + (tot.totalActual >= tot.totalTarget ? '+' : '') + formatCurrency(tot.totalActual - tot.totalTarget) + '</td>' +
          '<td></td>' +
        '</tr></tfoot>' +
      '</table>' +
    '</div>'
  }

  function renderFocTab(tot) {
    const currentMonth = new Date().getMonth()
    return '<div class="card" style="padding:0;overflow:hidden;overflow-x:auto">' +
      '<table>' +
        '<thead><tr>' +
          '<th style="min-width:70px">เดือน</th>' +
          '<th class="text-right" style="min-width:110px">งบ FOC/แถม</th>' +
          '<th class="text-right" style="min-width:110px">ใช้จริง</th>' +
          '<th class="text-right" style="min-width:70px">%</th>' +
          '<th class="text-right" style="min-width:80px">คงเหลือ</th>' +
          '<th style="min-width:100px">Progress</th>' +
        '</tr></thead>' +
        '<tbody>' +
          MONTHS_TH.map((mo, m) => {
            const act = actualByMonth[m]
            const focUsed = act ? (act.foc || 0) : 0
            const budget = focBudget[m] || 0
            const pct = budget > 0 ? Math.round(focUsed / budget * 100) : 0
            const remaining = budget - focUsed
            const hasFuture = m > currentMonth
            const rowStyle = m === currentMonth ? 'background:var(--surface-2)' : hasFuture ? 'opacity:0.55' : ''
            const pctColor = pct > 100 ? 'danger' : pct >= 80 ? 'warning' : focUsed > 0 ? 'success' : 'muted'
            return '<tr style="' + rowStyle + '">' +
              '<td><strong>' + mo + '</strong>' + (m === currentMonth ? ' <span style="font-size:0.65rem;color:var(--primary)">◀</span>' : '') + '</td>' +
              '<td class="text-right">' +
                (editMode && !hasFuture ? '<input type="text" style="width:100px;text-align:right;border:1px solid var(--primary);border-radius:4px;padding:2px 6px;font-size:0.82rem;background:var(--surface)" id="foc-' + m + '" value="' + budget.toLocaleString() + '">' : formatCurrency(budget)) +
              '</td>' +
              '<td class="text-right" style="font-weight:600;color:var(--' + (focUsed > 0 ? 'warning' : 'muted') + ')">' + (focUsed > 0 ? formatCurrency(focUsed) : '-') + '</td>' +
              '<td class="text-right"><span class="badge badge-' + pctColor + '" style="font-size:0.7rem">' + (focUsed > 0 || !hasFuture ? pct + '%' : '-') + '</span></td>' +
              '<td class="text-right" style="font-size:0.82rem;color:var(--' + (remaining >= 0 ? 'success' : 'danger') + ')">' +
                (focUsed > 0 || !hasFuture ? formatCurrency(remaining) : '-') +
              '</td>' +
              '<td>' +
                (focUsed > 0 ? '<div style="background:var(--surface-2);border-radius:3px;height:8px;min-width:80px"><div style="width:' + Math.min(100,pct) + '%;height:8px;background:var(--' + pctColor + ');border-radius:3px"></div></div>' : '<span style="font-size:0.72rem;color:var(--text-muted)">' + (hasFuture ? 'ยังไม่ถึงเดือน' : 'ไม่มีข้อมูล') + '</span>') +
              '</td>' +
            '</tr>'
          }).join('') +
        '</tbody>' +
        '<tfoot><tr style="background:var(--surface-2);font-weight:800">' +
          '<td>รวมทั้งปี</td>' +
          '<td class="text-right">' + formatCurrency(focBudget.reduce((a,v) => a+v,0)) + '</td>' +
          '<td class="text-right" style="color:var(--warning)">' + formatCurrency(Object.values(actualByMonth).reduce((a,v) => a+(v.foc||0),0)) + '</td>' +
          '<td class="text-right"><span class="badge badge-' + (tot.focPct<=100?'success':'danger') + '">' + tot.focPct + '%</span></td>' +
          '<td class="text-right" style="color:var(--' + (tot.totalFocUsed<=tot.totalFocBudget?'success':'danger') + ')">' + formatCurrency(tot.totalFocBudget - tot.totalFocUsed) + '</td>' +
          '<td></td>' +
        '</tr></tfoot>' +
      '</table>' +
    '</div>' +
    '<div class="card" style="padding:14px 16px;margin-top:12px;border-left:3px solid var(--accent)">' +
      '<div style="font-size:0.82rem;font-weight:700;margin-bottom:6px">💡 สรุปงบแถม</div>' +
      '<div style="font-size:0.8rem;color:var(--text-muted);line-height:1.6">' +
        'งบ FOC/แถมทั้งปี <strong>' + formatCurrency(focBudget.reduce((a,v)=>a+v,0)) + '</strong> · ' +
        'ใช้ไปแล้ว <strong>' + formatCurrency(Object.values(actualByMonth).reduce((a,v)=>a+(v.foc||0),0)) + '</strong> · ' +
        'คิดเป็น <strong>' + tot.focPct + '%</strong> ของงบทั้งปี<br>' +
        'หมายเหตุ: ค่า FOC คำนวณจาก budgetUsed หรือ discount ในใบจอง' +
      '</div>' +
    '</div>'
  }

  function renderPersonTab(tot) {
    const persons = getSalesPersons()
    const entries = Object.entries(persons).sort((a,b) => b[1].revenue - a[1].revenue)
    const grandTotal = entries.reduce((a,[,v]) => a + v.revenue, 0)

    // สร้างเป้าต่อคนแบบ rough estimate (ยอดรวม / จำนวนคน)
    const totalTarget = targets.reduce((a,v)=>a+v,0)
    const perPersonTarget = entries.length > 0 ? Math.round(totalTarget / entries.length) : totalTarget

    return '<div class="card" style="padding:0;overflow:hidden;overflow-x:auto">' +
      '<table>' +
        '<thead><tr>' +
          '<th>เซลส์</th>' +
          '<th class="text-right">เป้าโดยประมาณ</th>' +
          '<th class="text-right">ยอดจริง</th>' +
          '<th class="text-right">Achievement</th>' +
          '<th class="text-right">จำนวนคัน</th>' +
          '<th class="text-right">Avg Deal</th>' +
          '<th>สัดส่วน</th>' +
        '</tr></thead>' +
        '<tbody>' +
          (entries.length ? entries.map(([name, data]) => {
            const pct = perPersonTarget > 0 ? Math.round(data.revenue / perPersonTarget * 100) : 0
            const sharePct = grandTotal > 0 ? Math.round(data.revenue / grandTotal * 100) : 0
            const avgDeal = data.units > 0 ? Math.round(data.revenue / data.units) : 0
            const pctColor = pct >= 100 ? 'success' : pct >= 80 ? 'warning' : 'danger'
            return '<tr>' +
              '<td><strong>' + esc(name) + '</strong></td>' +
              '<td class="text-right" style="color:var(--text-muted)">' + formatCurrency(perPersonTarget) + '</td>' +
              '<td class="text-right" style="font-weight:700;color:var(--success)">' + formatCurrency(data.revenue) + '</td>' +
              '<td class="text-right"><span class="badge badge-' + pctColor + '">' + pct + '%</span></td>' +
              '<td class="text-right">' + data.units + ' คัน</td>' +
              '<td class="text-right" style="font-size:0.8rem">' + formatCurrency(avgDeal) + '</td>' +
              '<td style="min-width:120px">' +
                '<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem">' +
                  '<div style="background:var(--surface-2);border-radius:3px;height:8px;width:80px"><div style="width:' + sharePct + '%;height:8px;background:var(--primary);border-radius:3px"></div></div>' +
                  '<span>' + sharePct + '%</span>' +
                '</div>' +
              '</td>' +
            '</tr>'
          }).join('') : '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบข้อมูลเซลส์</td></tr>') +
        '</tbody>' +
        (entries.length ? '<tfoot><tr style="background:var(--surface-2);font-weight:800">' +
          '<td>รวม</td>' +
          '<td class="text-right">' + formatCurrency(totalTarget) + '</td>' +
          '<td class="text-right" style="color:var(--success)">' + formatCurrency(grandTotal) + '</td>' +
          '<td class="text-right"><span class="badge badge-' + (grandTotal>=totalTarget?'success':grandTotal>=totalTarget*0.8?'warning':'danger') + '">' + (totalTarget > 0 ? Math.round(grandTotal/totalTarget*100) : 0) + '%</span></td>' +
          '<td class="text-right">' + entries.reduce((a,[,v])=>a+v.units,0) + ' คัน</td>' +
          '<td class="text-right">' + formatCurrency(entries.reduce((a,[,v])=>a+v.units,0) > 0 ? Math.round(grandTotal / entries.reduce((a,[,v])=>a+v.units,0)) : 0) + '</td>' +
          '<td>100%</td>' +
        '</tr></tfoot>' : '') +
      '</table>' +
    '</div>' +
    '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:8px;padding:0 4px">' +
      'หมายเหตุ: เป้าต่อเซลส์คำนวณจากเป้ารวม ÷ จำนวนเซลส์ที่มีข้อมูล' +
    '</div>'
  }

  render()
}

function kpi(t, v, c) {
  return '<div class="card" style="padding:12px 14px;border-left:3px solid var(--' + c + ')">' +
    '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px">' + t + '</div>' +
    '<div style="font-size:1.0rem;font-weight:800;color:var(--' + c + ')">' + v + '</div></div>'
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
