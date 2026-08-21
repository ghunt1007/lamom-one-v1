import { listDocs, seedDemoData, getSalesData } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { formatCurrency } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// เลขตัวอย่าง (ยังไม่มีข้อมูลจริง) — เดิมผูก key เดือนไว้ตายตัวที่ปี 2025 ('2025-01'..'2025-12') ทำให้ overlay
// ยอดขายจริงด้านล่าง (จับคู่ด้วย r.month) ไม่มีทางจับคู่กับปีปัจจุบันได้เลยเมื่อข้ามปี — P&L ปีปัจจุบันจะไม่มี
// ข้อมูลจริงโชว์แม้แต่เดือนเดียว ตอนนี้ผูก key เดือนกับปีปัจจุบันจริงเสมอ (ตัวเลขตัวอย่างยังคงเดิม ใช้แค่ตอนยังไม่มีข้อมูลจริง)
const DEMO_MONTH_VALUES = [
  { revenue:4200000, cogs:3570000, opex:380000, label:'ม.ค.' },
  { revenue:3800000, cogs:3230000, opex:360000, label:'ก.พ.' },
  { revenue:5100000, cogs:4335000, opex:420000, label:'มี.ค.' },
  { revenue:4600000, cogs:3910000, opex:400000, label:'เม.ย.' },
  { revenue:5300000, cogs:4505000, opex:430000, label:'พ.ค.' },
  { revenue:4900000, cogs:4165000, opex:410000, label:'มิ.ย.' },
  { revenue:5800000, cogs:4930000, opex:450000, label:'ก.ค.' },
  { revenue:5200000, cogs:4420000, opex:440000, label:'ส.ค.' },
  { revenue:4700000, cogs:3995000, opex:415000, label:'ก.ย.' },
  { revenue:5600000, cogs:4760000, opex:460000, label:'ต.ค.' },
  { revenue:6100000, cogs:5185000, opex:490000, label:'พ.ย.' },
  { revenue:6800000, cogs:5780000, opex:520000, label:'ธ.ค.' },
]
function buildDemoPL(year) {
  return DEMO_MONTH_VALUES.map((v, i) => ({ month: `${year}-${String(i+1).padStart(2,'0')}`, ...v }))
}

const OPEX_BREAKDOWN = [
  { label: 'เงินเดือนพนักงาน', pct: 38 },
  { label: 'ค่าเช่าสถานที่', pct: 18 },
  { label: 'ค่าการตลาด', pct: 14 },
  { label: 'ค่าสาธารณูปโภค', pct: 8 },
  { label: 'ค่าซ่อมบำรุง', pct: 7 },
  { label: 'ค่าใช้จ่ายอื่น', pct: 15 },
]

export default async function PLPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let selectedYear = String(new Date().getFullYear())
  let plData = buildDemoPL(selectedYear)
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
            <div class="page-title">📉 P&L Dashboard</div>
            <div class="page-subtitle">กำไร-ขาดทุน ${selectedYear}
              <span style="font-size:0.72rem;color:var(--warning);margin-left:6px" title="OPEX ทั้งหมดเป็นตัวเลขประมาณการ ยังไม่เชื่อมข้อมูลค่าใช้จ่ายจริง — ดูเครื่องหมาย ✓/(ประมาณ) ต่อแถวในตารางว่า Revenue/COGS เดือนไหนเป็นข้อมูลจริง">⚠️ OPEX เป็นตัวเลขประมาณการ</span>
            </div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm ${viewMode==='month'?'btn-primary':'btn-secondary'}" data-vm="month">รายเดือน</button>
              <button class="btn btn-sm ${viewMode==='quarter'?'btn-primary':'btn-secondary'}" data-vm="quarter">ราย Q</button>
              <button class="btn btn-sm ${viewMode==='year'?'btn-primary':'btn-secondary'}" data-vm="year">ทั้งปี</button>
            </div>
            <button class="btn btn-secondary" id="pl-export">📥 Export</button>
          </div>
        </div>

        <!-- Summary KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpiCard('💰 รายได้รวม', formatCurrency(totals.revenue), 'primary')}
          ${kpiCard('📦 ต้นทุนสินค้า', formatCurrency(totals.cogs), 'warning', `COGS ${totals.revenue>0?(totals.cogs/totals.revenue*100).toFixed(1):0}%`)}
          ${kpiCard('✅ Gross Profit', formatCurrency(tc.gross), tc.gross>=0?'success':'danger', `Margin ${tc.grossPct}%`)}
          ${kpiCard('🏆 Net Profit', formatCurrency(tc.net), tc.net>=0?'success':'danger', `Net Margin ${tc.netPct}%`)}
        </div>

        <!-- Chart + OPEX breakdown -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:20px">
          <!-- Bar Chart -->
          <div class="card" style="padding:20px">
            <div style="font-weight:700;margin-bottom:16px">📊 Revenue vs Gross Profit</div>
            <div style="display:flex;align-items:flex-end;gap:${viewMode==='month'?4:12}px;height:180px;border-bottom:1px solid var(--border);padding-bottom:8px">
              ${data.map(r => {
                const c = calc(r)
                const rh = maxRev > 0 ? Math.round(r.revenue / maxRev * 160) : 0
                const gh = maxRev > 0 ? Math.round(c.gross / maxRev * 160) : 0
                return `
                  <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
                    <div style="display:flex;align-items:flex-end;gap:2px;height:160px">
                      <div style="width:12px;height:${rh}px;background:var(--primary);border-radius:2px 2px 0 0" title="Revenue: ${formatCurrency(r.revenue)}"></div>
                      <div style="width:12px;height:${Math.max(gh,1)}px;background:${c.gross>=0?'var(--success)':'var(--danger)'};border-radius:2px 2px 0 0" title="GP: ${formatCurrency(c.gross)}"></div>
                    </div>
                    <div style="font-size:0.65rem;color:var(--text-muted);white-space:nowrap">${r.label}</div>
                  </div>`
              }).join('')}
            </div>
            <div style="display:flex;gap:16px;margin-top:10px;font-size:0.75rem">
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--primary);display:inline-block;border-radius:2px"></span>Revenue</span>
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--success);display:inline-block;border-radius:2px"></span>Gross Profit</span>
            </div>
          </div>

          <!-- OPEX Breakdown -->
          <div class="card" style="padding:20px">
            <div style="font-weight:700;margin-bottom:4px">💸 OPEX Breakdown</div>
            <div style="font-size:0.7rem;color:var(--warning);margin-bottom:10px">⚠️ สัดส่วน % ยังเป็นตัวอย่าง — ยอดรวม OPEX ต่อเดือนที่มีเครื่องหมาย ✓ ด้านล่างรวมค่าใช้จ่ายจริงที่เบิกผ่านระบบแล้ว (Petty Cash + เบิกพนักงานที่อนุมัติ) แต่ยังไม่รวมเงินเดือน</div>
            <div style="font-size:0.88rem;font-weight:700;color:var(--warning);margin-bottom:12px">${formatCurrency(totals.opex)} / ปี</div>
            ${OPEX_BREAKDOWN.map(o => `
              <div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                  <span>${o.label}</span><span style="color:var(--text-muted)">${o.pct}%</span>
                </div>
                <div style="background:var(--surface-3);border-radius:99px;height:6px;overflow:hidden">
                  <div style="height:100%;width:${o.pct}%;background:var(--warning);border-radius:99px"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Detail Table -->
        <div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap"><table class="table">
            <thead>
              <tr>
                <th>ช่วงเวลา</th>
                <th class="text-right">Revenue</th>
                <th class="text-right">COGS</th>
                <th class="text-right">Gross Profit</th>
                <th class="text-right">GP%</th>
                <th class="text-right">OPEX</th>
                <th class="text-right">Net Profit</th>
                <th class="text-right">Net%</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(r => {
                const c = calc(r)
                return `<tr>
                  <td style="font-weight:600">${r.label}${r.actual ? ' <span title="Revenue/COGS จากข้อมูลจริง" style="color:var(--success);font-weight:400;font-size:0.7rem">✓ จริง</span>' : viewMode === 'month' ? ' <span title="ตัวเลขประมาณการ ยังไม่มีข้อมูลจริงเดือนนี้" style="color:var(--text-muted);font-weight:400;font-size:0.7rem">(ประมาณ)</span>' : ''}</td>
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
    sales.forEach(s => {
      const m = (s.date || '').slice(0, 7); if (!m) return
      if (!byMonth[m]) byMonth[m] = { revenue: 0, cogs: 0 }
      byMonth[m].revenue += s.salePrice || 0; byMonth[m].cogs += s.cost || 0
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
      listDocs('expense_claims', [], 'date', 'desc', 2000),
      listDocs('petty_cash', companyScopeFilters(), 'time', 'desc', 2000),
    ])
    if (container.__routerGen !== myGen) return
    const opexByMonth = {}
    claims.filter(c => c.status === 'approved' || c.status === 'paid').forEach(c => {
      const m = (c.date || '').slice(0, 7); if (!m) return
      opexByMonth[m] = (opexByMonth[m] || 0) + (c.amount || 0)
    })
    petty.filter(p => p.type === 'out' && p.status === 'approved').forEach(p => {
      const m = (p.time || '').slice(0, 7); if (!m) return
      opexByMonth[m] = (opexByMonth[m] || 0) + (p.amount || 0)
    })
    let opexChanged = false
    plData = plData.map(r => {
      if (opexByMonth[r.month] > 0) { opexChanged = true; return { ...r, opex: opexByMonth[r.month], opexActual: true } }
      return r
    })
    if (opexChanged) renderPage()
  } catch (e) {}
}

function kpiCard(title, value, color, sub = '') {
  return `<div class="kpi-card">
    <div class="kpi-title">${title}</div>
    <div class="kpi-value" style="color:var(--${color})">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`
}
