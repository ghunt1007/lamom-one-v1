import { listDocs, seedDemoData, getSalesData } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { formatCurrency } from '../../utils/format.js'
import { saleCost, costEstimateNote } from '../../utils/saleCost.js'
import { exportToExcel } from '../../utils/importExport.js'
import { opexEntries } from '../../utils/opex.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// (v1.0.950) เดิมหลังเอาตัวเลขตัวอย่างออก (v1.0.907) ตารางเดือนกลายเป็นว่าง → ยอดขายจริงไม่มีเดือนให้ "ทับ" เลย
// หน้า P&L จึงเป็น 0 ตลอดแม้มีใบจองจริง ตอนนี้เริ่มจาก 12 เดือนของปีที่เลือก (ค่า 0) แล้วเติมยอดจริง
function emptyYear(year) {
  return MONTHS.map((label, i) => ({ month: `${year}-${String(i + 1).padStart(2, '0')}`, label, revenue: 0, cogs: 0, opex: 0 }))
}


export default async function PLPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let selectedYear = String(new Date().getFullYear())
  let plData = emptyYear(selectedYear)
  let opexCats = []
  let costNote = ''
  let viewMode = 'month' // month | quarter | year

  function getQuarterData() {
    const y = selectedYear
    const quarters = [
      { label: 'Q1', months: [`${y}-01`,`${y}-02`,`${y}-03`] },
      { label: 'Q2', months: [`${y}-04`,`${y}-05`,`${y}-06`] },
      { label: 'Q3', months: [`${y}-07`,`${y}-08`,`${y}-09`] },
      { label: 'Q4', months: [`${y}-10`,`${y}-11`,`${y}-12`] },
    ]
    return quarters.map(q => {
      const rows = plData.filter(r => q.months.includes(r.month))
      return {
        label: q.label,
        revenue: rows.reduce((s,r) => s + r.revenue, 0),
        cogs: rows.reduce((s,r) => s + r.cogs, 0),
        opex: rows.reduce((s,r) => s + r.opex, 0),
      }
    })
  }

  function getDisplayData() {
    if (viewMode === 'quarter') return getQuarterData()
    if (viewMode === 'year') {
      const t = plData.reduce((a,r) => ({ label:`${selectedYear} ทั้งปี`, revenue: a.revenue+r.revenue, cogs: a.cogs+r.cogs, opex: a.opex+r.opex }), { revenue:0,cogs:0,opex:0 })
      return [t]
    }
    return plData
  }

  function calc(r) {
    const gross = r.revenue - r.cogs
    const grossPct = r.revenue > 0 ? (gross / r.revenue * 100).toFixed(1) : 0
    const net = gross - r.opex
    const netPct = r.revenue > 0 ? (net / r.revenue * 100).toFixed(1) : 0
    return { gross, grossPct, net, netPct }
  }

  function renderPage() {
    const data = getDisplayData()
    const totals = data.reduce((a, r) => ({
      revenue: a.revenue + r.revenue,
      cogs: a.cogs + r.cogs,
      opex: a.opex + r.opex,
    }), { revenue: 0, cogs: 0, opex: 0 })
    const tc = calc(totals)

    const maxRev = Math.max(...data.map(r => r.revenue))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📉 กำไร-ขาดทุน (P&L)</div>
            <div class="page-subtitle">ปี ${Number(selectedYear) + 543}
              <span style="font-size:0.72rem;color:var(--text-muted);margin-left:6px">· รายได้/ต้นทุนจากใบจองจริง · ค่าใช้จ่ายจากใบเบิก+เงินสดย่อย (ยังไม่รวมเงินเดือน)</span>
              ${costNote}
            </div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm ${viewMode==='month'?'btn-primary':'btn-secondary'}" data-vm="month">รายเดือน</button>
              <button class="btn btn-sm ${viewMode==='quarter'?'btn-primary':'btn-secondary'}" data-vm="quarter">ราย Q</button>
              <button class="btn btn-sm ${viewMode==='year'?'btn-primary':'btn-secondary'}" data-vm="year">ทั้งปี</button>
            </div>
            <button class="btn btn-secondary" id="pl-export">📥 ส่งออก</button>
          </div>
        </div>

        <!-- Summary KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpiCard('💰 รายได้รวม', formatCurrency(totals.revenue), 'primary')}
          ${kpiCard('📦 ต้นทุนสินค้า', formatCurrency(totals.cogs), 'warning', `COGS ${totals.revenue>0?(totals.cogs/totals.revenue*100).toFixed(1):0}%`)}
          ${kpiCard('✅ กำไรขั้นต้น', formatCurrency(tc.gross), tc.gross>=0?'success':'danger', `Margin ${tc.grossPct}%`)}
          ${kpiCard('🏆 กำไรสุทธิ', formatCurrency(tc.net), tc.net>=0?'success':'danger', `Net Margin ${tc.netPct}%`)}
        </div>

        <!-- Chart + OPEX breakdown -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:20px">
          <!-- Bar Chart -->
          <div class="card" style="padding:20px">
            <div style="font-weight:700;margin-bottom:16px">📊 รายได้เทียบกำไรขั้นต้น</div>
            <div style="display:flex;align-items:flex-end;gap:${viewMode==='month'?4:12}px;height:180px;border-bottom:1px solid var(--border);padding-bottom:8px">
              ${data.map(r => {
                const c = calc(r)
                const rh = maxRev > 0 ? Math.round(r.revenue / maxRev * 160) : 0
                const gh = maxRev > 0 ? Math.round(c.gross / maxRev * 160) : 0
                return `
                  <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;flex:1;min-width:0">
                    <div style="display:flex;align-items:flex-end;justify-content:center;gap:2px;height:160px;width:100%">
                      <div style="width:40%;max-width:12px;flex-shrink:0;align-self:flex-end;height:${rh}px;background:var(--primary);border-radius:2px 2px 0 0" title="Revenue: ${formatCurrency(r.revenue)}"></div>
                      <div style="width:40%;max-width:12px;flex-shrink:0;align-self:flex-end;height:${Math.max(gh,1)}px;background:${c.gross>=0?'var(--success)':'var(--danger)'};border-radius:2px 2px 0 0" title="GP: ${formatCurrency(c.gross)}"></div>
                    </div>
                    <div style="font-size:0.6rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;max-width:100%">${r.label}</div>
                  </div>`
              }).join('')}
            </div>
            <div style="display:flex;gap:16px;margin-top:10px;font-size:0.75rem">
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--primary);display:inline-block;border-radius:2px"></span>รายได้</span>
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--success);display:inline-block;border-radius:2px"></span>กำไรขั้นต้น</span>
            </div>
          </div>

          <!-- OPEX Breakdown -->
          <div class="card" style="padding:20px">
            <div style="font-weight:700;margin-bottom:4px">💸 แยกค่าใช้จ่ายดำเนินงาน</div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:10px">จากใบเบิกพนักงานที่อนุมัติแล้ว + เงินสดย่อยที่จ่ายออก (ยังไม่รวมเงินเดือน/ค่าเช่า)</div>
            <div style="font-size:0.88rem;font-weight:700;color:var(--warning);margin-bottom:12px">${formatCurrency(totals.opex)} / ปี</div>
            ${opexCats.length ? opexCats.map(o => `
              <div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;gap:8px;font-size:0.78rem;margin-bottom:3px">
                  <span>${o.label}</span><span style="color:var(--text-muted);white-space:nowrap">${formatCurrency(o.amt)} · ${o.pct}%</span>
                </div>
                <div style="background:var(--surface-3);border-radius:99px;height:6px;overflow:hidden">
                  <div style="height:100%;width:${o.pct}%;background:var(--warning);border-radius:99px"></div>
                </div>
              </div>
            `).join('') : '<div style="padding:12px;text-align:center;font-size:0.76rem;color:var(--text-muted)">ยังไม่มีค่าใช้จ่ายที่เบิกผ่านระบบปีนี้</div>'}
          </div>
        </div>

        <!-- Detail Table -->
        <div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap"><table class="table">
            <thead>
              <tr>
                <th>ช่วงเวลา</th>
                <th class="text-right">รายได้</th>
                <th class="text-right">ต้นทุนขาย</th>
                <th class="text-right">กำไรขั้นต้น</th>
                <th class="text-right">GP%</th>
                <th class="text-right">ค่าใช้จ่าย</th>
                <th class="text-right">กำไรสุทธิ</th>
                <th class="text-right">สุทธิ%</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(r => {
                const c = calc(r)
                return `<tr>
                  <td style="font-weight:600">${r.label}${r.actual ? ' <span title="Revenue/COGS จากข้อมูลจริง" style="color:var(--success);font-weight:400;font-size:0.7rem">✓ จริง</span>' : ''}</td>
                  <td class="text-right">${formatCurrency(r.revenue)}</td>
                  <td class="text-right" style="color:var(--text-muted)">${formatCurrency(r.cogs)}</td>
                  <td class="text-right" style="color:var(--${c.gross>=0?'success':'danger'})">${formatCurrency(c.gross)}</td>
                  <td class="text-right"><span class="badge badge-${c.gross>=0?'success':'danger'}">${c.grossPct}%</span></td>
                  <td class="text-right" style="color:var(--text-muted)">${formatCurrency(r.opex)}${r.opexActual ? ' <span title="รวมค่าใช้จ่ายที่เบิกผ่านระบบจริง (Petty Cash + เบิกพนักงานที่อนุมัติแล้ว) — ยังไม่รวมเงินเดือน" style="color:var(--success);font-weight:400;font-size:0.62rem">✓ บางส่วน</span>' : ''}</td>
                  <td class="text-right" style="color:var(--${c.net>=0?'success':'danger'});font-weight:700">${formatCurrency(c.net)}</td>
                  <td class="text-right"><span class="badge badge-${c.net>=0?'success':'danger'}">${c.netPct}%</span></td>
                </tr>`
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-2);font-weight:700">
                <td>รวม</td>
                <td class="text-right">${formatCurrency(totals.revenue)}</td>
                <td class="text-right">${formatCurrency(totals.cogs)}</td>
                <td class="text-right" style="color:var(--${tc.gross>=0?'success':'danger'})">${formatCurrency(tc.gross)}</td>
                <td class="text-right"><span class="badge badge-${tc.gross>=0?'success':'danger'}">${tc.grossPct}%</span></td>
                <td class="text-right">${formatCurrency(totals.opex)}</td>
                <td class="text-right" style="color:var(--${tc.net>=0?'success':'danger'})">${formatCurrency(tc.net)}</td>
                <td class="text-right"><span class="badge badge-${tc.net>=0?'success':'danger'}">${tc.netPct}%</span></td>
              </tr>
            </tfoot>
          </table></div>
        </div>
      </div>
    `

    document.querySelectorAll('[data-vm]').forEach(btn => {
      btn.addEventListener('click', () => { viewMode = btn.dataset.vm; renderPage() })
    })

    document.getElementById('pl-export')?.addEventListener('click', () => {
      exportToExcel(data.map(r => {
        const c = calc(r)
        return { 'ช่วงเวลา': r.label, 'Revenue': r.revenue, 'COGS': r.cogs, 'Gross Profit': c.gross, 'GP%': c.grossPct, 'OPEX': r.opex, 'Net Profit': c.net, 'Net%': c.netPct }
      }), `PL_${selectedYear}`)
    })
  }

  if (container.__routerGen !== myGen) return
  renderPage()

  // overlay ยอดขายจริงจากใบจอง (แหล่งกลาง) ทับเดือนที่มีข้อมูลจริง
  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return
    const byMonth = {}
    const yearSales = sales.filter(s => String(s.date || '').startsWith(selectedYear + '-'))
    costNote = costEstimateNote(yearSales)
    yearSales.forEach(s => {
      const m = (s.date || '').slice(0, 7); if (!m) return
      if (!byMonth[m]) byMonth[m] = { revenue: 0, cogs: 0 }
      byMonth[m].revenue += s.salePrice || 0; byMonth[m].cogs += saleCost(s)
    })
    let changed = false
    plData = plData.map(r => {
      if (byMonth[r.month]) { changed = true; return { ...r, revenue: byMonth[r.month].revenue, cogs: byMonth[r.month].cogs, actual: true } }
      return r
    })
    if (changed) renderPage()
  } catch (e) {}

  // overlay OPEX จริงบางส่วน — รวมค่าใช้จ่ายที่เบิกผ่านระบบแล้วจริง (Petty Cash จ่ายออก + เบิกพนักงานที่
  // อนุมัติ/จ่ายแล้ว) ทับตัวเลขประมาณการเฉพาะเดือนที่มียอดจริง > 0 — ไม่รวมเงินเดือน (ยังไม่มีแหล่งข้อมูล
  // เงินเดือนต่อเดือนที่ดึงมารวมได้ตรงๆ) จึงติดป้าย "✓ บางส่วน" ไม่ใช่ "✓ จริง" เหมือน revenue/cogs — กัน
  // เข้าใจผิดว่าเป็นต้นทุนดำเนินงานที่ครบถ้วนแล้ว
  try {
    const [claims, petty] = await Promise.all([
      listDocs('expense_claims', companyScopeFilters(), 'date', 'desc', 2000),
      listDocs('petty_cash', companyScopeFilters(), 'time', 'desc', 2000),
    ])
    if (container.__routerGen !== myGen) return
    const opexByMonth = {}
    const byCat = {}
    opexEntries(claims, petty).filter(e => e.month.startsWith(selectedYear + '-')).forEach(e => {
      opexByMonth[e.month] = (opexByMonth[e.month] || 0) + e.amt
      byCat[e.label] = (byCat[e.label] || 0) + e.amt
    })
    const catTotal = Object.values(byCat).reduce((a, v) => a + v, 0)
    opexCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([label, amt]) => ({ label, amt, pct: catTotal ? Math.round(amt / catTotal * 100) : 0 }))
    let opexChanged = false
    plData = plData.map(r => {
      if (opexByMonth[r.month] > 0) { opexChanged = true; return { ...r, opex: opexByMonth[r.month], opexActual: true } }
      return r
    })
    if (opexChanged || opexCats.length) renderPage()
  } catch (e) {}
}

function kpiCard(title, value, color, sub = '') {
  return `<div class="kpi-card">
    <div class="kpi-title">${title}</div>
    <div class="kpi-value" style="color:var(--${color})">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`
}
