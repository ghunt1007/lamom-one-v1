/**
 * Profit Analysis — วิเคราะห์กำไรเชิงลึก
 * Route: /analytics/profit
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { getSalesData } from '../../core/db.js'

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.']
const PRODUCTS = [
  { id: 'P1', name: 'BYD Seal AWD', category: 'EV Sedan', units: 18, revenue: 28620000, cogs: 22896000, gross: 5724000 },
  { id: 'P2', name: 'BYD Atto 3',   category: 'EV SUV',   units: 24, revenue: 30960000, cogs: 25082000, gross: 5878000 },
  { id: 'P3', name: 'MG ZS EV',     category: 'EV SUV',   units: 15, revenue: 16050000, cogs: 13000000, gross: 3050000 },
  { id: 'P4', name: 'Service',       category: 'บริการ',   units: 380, revenue: 3800000, cogs: 1900000, gross: 1900000 },
  { id: 'P5', name: 'Accessories',  category: 'อุปกรณ์',  units: 145, revenue: 870000,  cogs: 520000,  gross: 350000 },
]

const MONTHLY_DATA = [
  { month: 'ม.ค.', revenue: 12500000, cogs: 9800000, opex: 1200000 },
  { month: 'ก.พ.', revenue: 11200000, cogs: 8900000, opex: 1150000 },
  { month: 'มี.ค.', revenue: 15800000, cogs: 12300000, opex: 1300000 },
  { month: 'เม.ย.', revenue: 13600000, cogs: 10800000, opex: 1250000 },
  { month: 'พ.ค.', revenue: 16200000, cogs: 12500000, opex: 1350000 },
  { month: 'มิ.ย.', revenue: 18000000, cogs: 13900000, opex: 1400000 },
]

export default async function ProfitAnalysisPage(container) {
  const myGen = container.__routerGen
  let period = 'h1'
  let activeTab = 'overview'
  let liveMonthly = null

  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return
    if (sales.length) {
      const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
      const byMonth = {}
      sales.forEach(s => {
        const mo = parseInt((s.date || '').slice(5, 7)) - 1
        if (isNaN(mo) || mo < 0 || mo > 11) return
        if (!byMonth[mo]) byMonth[mo] = { month: MONTHS_TH[mo], revenue: 0, cogs: 0, opex: 1250000 }
        byMonth[mo].revenue += s.salePrice || 0
        byMonth[mo].cogs += Math.round((s.salePrice || 0) * 0.8)
      })
      const built = Object.values(byMonth).sort((a, b) => MONTHS_TH.indexOf(a.month) - MONTHS_TH.indexOf(b.month))
      if (built.length >= 1) liveMonthly = built
    }
  } catch {}

  function renderPage() {
    const data = liveMonthly || MONTHLY_DATA
    const totalRevenue = data.reduce((a, m) => a + m.revenue, 0)
    const totalCogs = data.reduce((a, m) => a + m.cogs, 0)
    const totalOpex = data.reduce((a, m) => a + m.opex, 0)
    const grossProfit = totalRevenue - totalCogs
    const netProfit = grossProfit - totalOpex
    const grossMargin = totalRevenue ? Math.round(grossProfit / totalRevenue * 100) : 0
    const netMargin = totalRevenue ? Math.round(netProfit / totalRevenue * 100) : 0

    const maxRevenue = Math.max(...data.map(m => m.revenue))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📈 Profit Analysis</div>
            <div class="page-subtitle">วิเคราะห์กำไร-ขาดทุนเชิงลึก ครึ่งปีแรก 2568
              ${liveMonthly ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● ข้อมูลจริงจากใบจอง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:8px">Demo</span>'}
            </div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 รายได้รวม', formatCurrency(totalRevenue), 'primary')}
          ${kpi('📊 Gross Profit', formatCurrency(grossProfit), 'success')}
          ${kpi('💵 Net Profit', formatCurrency(netProfit), netProfit > 0 ? 'success' : 'danger')}
          ${kpi('📉 Net Margin', netMargin + '%', netMargin >= 10 ? 'success' : netMargin >= 5 ? 'warning' : 'danger')}
        </div>

        <!-- P&L Summary card -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px;color:var(--text-muted)">📋 สรุป P&L ครึ่งปีแรก</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
            ${plBar('รายได้รวม', totalRevenue, totalRevenue, 'primary')}
            ${plBar('ต้นทุนสินค้า (COGS)', totalCogs, totalRevenue, 'warning')}
            ${plBar('กำไรขั้นต้น', grossProfit, totalRevenue, 'success')}
            ${plBar('ค่าใช้จ่าย Op.', totalOpex, totalRevenue, 'danger')}
            ${plBar('กำไรสุทธิ', netProfit, totalRevenue, 'success')}
            <div style="text-align:center;padding:12px;background:var(--surface-2);border-radius:var(--radius-sm)">
              <div style="font-size:0.7rem;color:var(--text-muted)">Gross Margin</div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--success)">${grossMargin}%</div>
            </div>
          </div>
        </div>

        <!-- Monthly chart -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px;color:var(--text-muted)">📊 รายได้รายเดือน (ล้านบาท)</div>
          <div style="display:flex;gap:4px;align-items:flex-end;height:140px">
            ${data.map(m => {
              const grossPct = Math.round((m.revenue - m.cogs) / m.revenue * 100)
              const revenueH = Math.round(m.revenue / maxRevenue * 120)
              const grossH = Math.round((m.revenue - m.cogs) / maxRevenue * 120)
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="font-size:0.65rem;color:var(--text-muted)">${(m.revenue/1000000).toFixed(1)}M</div>
                <div style="width:100%;display:flex;flex-direction:column;justify-content:flex-end;height:${revenueH}px;position:relative">
                  <div style="position:absolute;bottom:0;width:100%;background:var(--primary);opacity:0.3;height:${revenueH}px;border-radius:2px 2px 0 0"></div>
                  <div style="position:absolute;bottom:0;width:100%;background:var(--success);height:${grossH}px;border-radius:2px 2px 0 0"></div>
                </div>
                <div style="font-size:0.65rem;color:var(--text-muted)">${m.month}</div>
                <div style="font-size:0.6rem;color:var(--success)">${grossPct}%</div>
              </div>`
            }).join('')}
          </div>
          <div style="display:flex;gap:16px;margin-top:8px;font-size:0.72rem">
            <span><span style="display:inline-block;width:10px;height:10px;background:var(--primary);opacity:0.3;border-radius:2px"></span> รายได้</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:var(--success);border-radius:2px"></span> กำไรขั้นต้น</span>
          </div>
        </div>

        <!-- Product profitability -->
        <div class="card" style="overflow:hidden">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">🏆 กำไรตามสินค้า/บริการ</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">สินค้า/บริการ</th>
                <th style="padding:10px 14px;text-align:right">รายได้</th>
                <th style="padding:10px 14px;text-align:right">ต้นทุน</th>
                <th style="padding:10px 14px;text-align:right">กำไรขั้นต้น</th>
                <th style="padding:10px 14px;text-align:right">Margin</th>
                <th style="padding:10px 14px;text-align:center">Margin Bar</th>
              </tr>
            </thead>
            <tbody>
              ${PRODUCTS.map(p => {
                const margin = Math.round(p.gross / p.revenue * 100)
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 14px">
                    <div style="font-weight:600;font-size:0.85rem">${p.name}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${p.category} · ${p.units} ${p.category==='บริการ'?'รายการ':'คัน'}</div>
                  </td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.83rem">${formatCurrency(p.revenue)}</td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.83rem;color:var(--danger)">${formatCurrency(p.cogs)}</td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.83rem;font-weight:700;color:var(--success)">${formatCurrency(p.gross)}</td>
                  <td style="padding:10px 14px;text-align:right;font-weight:800;color:${margin>=25?'var(--success)':margin>=15?'var(--warning)':'var(--danger)'}">${margin}%</td>
                  <td style="padding:10px 14px">
                    <div style="background:var(--surface-2);border-radius:3px;height:8px;min-width:80px">
                      <div style="width:${margin}%;background:${margin>=25?'var(--success)':margin>=15?'var(--warning)':'var(--danger)'};height:8px;border-radius:3px"></div>
                    </div>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function plBar(label, value, total, color) {
  const pct = total ? Math.round(value / total * 100) : 0
  return `<div style="text-align:center;padding:12px;background:var(--surface-2);border-radius:var(--radius-sm)">
    <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">${label}</div>
    <div style="font-size:0.88rem;font-weight:800;color:var(--${color})">${(value/1000000).toFixed(1)}M</div>
    <div style="font-size:0.65rem;color:var(--text-muted)">${pct}% ของรายได้</div>
  </div>`
}
