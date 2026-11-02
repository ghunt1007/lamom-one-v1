/**
 * Profit Analysis — วิเคราะห์กำไรเชิงลึก
 * Route: /analytics/profit
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { getSalesData } from '../../core/db.js'
import { saleCost, costEstimateNote } from '../../utils/saleCost.js'
import { escHtml } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.']
const PRODUCTS = [] // (2026-11-02) เอาข้อมูลสมมติออก

const MONTHLY_DATA = [
  { month: 'ม.ค.', revenue: 0, cogs: 0, opex: 0 },
  { month: 'ก.พ.', revenue: 0, cogs: 0, opex: 0 },
  { month: 'มี.ค.', revenue: 0, cogs: 0, opex: 0 },
  { month: 'เม.ย.', revenue: 0, cogs: 0, opex: 0 },
  { month: 'พ.ค.', revenue: 0, cogs: 0, opex: 0 },
  { month: 'มิ.ย.', revenue: 0, cogs: 0, opex: 0 },
]

export default async function ProfitAnalysisPage(container) {
  const myGen = container.__routerGen
  let period = 'h1'
  let activeTab = 'overview'
  let liveMonthly = null
  let liveProducts = null
  // ปีปัจจุบันเท่านั้น — เดิมรวมทุกปีเข้าเดือนเดียวกัน (ม.ค. ปีนี้ + ม.ค. ปีก่อน) และหัวข้อเขียนตายตัว "ครึ่งปีแรก 2568"
  const year = new Date().getFullYear()
  let costNote = ''

  try {
    const sales = (await getSalesData()).filter(s => String(s.date || '').startsWith(String(year)))
    if (container.__routerGen !== myGen) return
    costNote = costEstimateNote(sales)
    if (sales.length) {
      const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
      const byMonth = {}
      sales.forEach(s => {
        const mo = parseInt((s.date || '').slice(5, 7)) - 1
        if (isNaN(mo) || mo < 0 || mo > 11) return
        if (!byMonth[mo]) byMonth[mo] = { month: MONTHS_TH[mo], revenue: 0, cogs: 0, opex: 0 }
        byMonth[mo].revenue += s.salePrice || 0
        // ต้นทุนจริงต่อคัน (s.cost จากใบจอง) ถ้าไม่มีค่อย fallback ประมาณ 82% ของราคาขาย — pattern เดียวกับ
        // CashFlow.js/VatReport.js ไม่ใช่ประมาณ 80% ตายตัวทุกคันอีกต่อไป
        byMonth[mo].cogs += saleCost(s)
      })
      const built = Object.values(byMonth).sort((a, b) => MONTHS_TH.indexOf(a.month) - MONTHS_TH.indexOf(b.month))
      if (built.length >= 1) liveMonthly = built

      // เดิมตาราง "กำไรตามสินค้า/บริการ" เป็น PRODUCTS ปลอมตายตัวเสมอ ไม่เคยเปลี่ยนตามข้อมูลจริงเลยแม้ KPI
      // ด้านบนจะเป็นข้อมูลจริงแล้วก็ตาม (badge "● ข้อมูลจริงจากใบจอง" หลอกผู้ใช้ว่าทั้งหน้าเป็นของจริง ทั้งที่
      // ตารางนี้ไม่ใช่) พบจากการทดสอบคลิกใช้งานจริง — แก้ให้สร้างจากยอดขายจริงแยกตามรุ่นรถเหมือน SalesByModel.js
      const byModel = {}
      sales.forEach(s => {
        const key = (s.brand || '-') + '|' + (s.model || '-')
        if (!byModel[key]) byModel[key] = { id: key, name: (s.model || '-').trim() || '-', category: s.brand || '-', units: 0, revenue: 0, cogs: 0 }
        const p = byModel[key]
        p.units++
        p.revenue += s.salePrice || 0
        p.cogs += saleCost(s)
      })
      liveProducts = Object.values(byModel).map(p => ({ ...p, gross: p.revenue - p.cogs })).sort((a, b) => b.revenue - a.revenue)
    }
  } catch {}

  function renderPage() {
    const data = liveMonthly || MONTHLY_DATA
    const products = liveProducts || PRODUCTS
    const totalRevenue = data.reduce((a, m) => a + m.revenue, 0)
    const totalCogs = data.reduce((a, m) => a + m.cogs, 0)
    const totalOpex = data.reduce((a, m) => a + m.opex, 0)
    const grossProfit = totalRevenue - totalCogs
    const netProfit = grossProfit - totalOpex
    const grossMargin = totalRevenue ? Math.round(grossProfit / totalRevenue * 100) : 0
    const netMargin = totalRevenue ? Math.round(netProfit / totalRevenue * 100) : 0

    const maxRevenue = Math.max(1, ...data.map(m => m.revenue))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📈 Profit Analysis</div>
            <div class="page-subtitle">วิเคราะห์กำไร-ขาดทุน ปี ${year + 543}
              ${liveMonthly ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● ข้อมูลจริงจากใบจอง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:8px">ยังไม่มีข้อมูล</span>'}
              ${costNote}
            </div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 รายได้รวม', formatCurrency(totalRevenue), 'primary')}
          ${kpi('📊 กำไรขั้นต้น', formatCurrency(grossProfit), 'success')}
          ${kpi('💵 กำไรสุทธิ', formatCurrency(netProfit), netProfit > 0 ? 'success' : 'danger')}
          ${kpi('📉 อัตรากำไรสุทธิ', netMargin + '%', netMargin >= 10 ? 'success' : netMargin >= 5 ? 'warning' : 'danger')}
        </div>

        <!-- P&L Summary card -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px;color:var(--text-muted)">📋 สรุป P&L ปีนี้</div>
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
              const grossPct = m.revenue ? Math.round((m.revenue - m.cogs) / m.revenue * 100) : 0
              const revenueH = Math.round(m.revenue / maxRevenue * 120)
              const grossH = Math.round((m.revenue - m.cogs) / maxRevenue * 120)
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="font-size:0.65rem;color:var(--text-muted)">${m.revenue ? (m.revenue/1000000).toFixed(1) + 'M' : ''}</div>
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
        <div class="card" style="overflow-x:auto">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">🏆 กำไรตามสินค้า/บริการ</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">สินค้า/บริการ</th>
                <th style="padding:10px 14px;text-align:right">รายได้</th>
                <th style="padding:10px 14px;text-align:right">ต้นทุน</th>
                <th style="padding:10px 14px;text-align:right">กำไรขั้นต้น</th>
                <th style="padding:10px 14px;text-align:right">กำไร</th>
                <th style="padding:10px 14px;text-align:center">กราฟกำไร</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => {
                const margin = p.revenue ? Math.round(p.gross / p.revenue * 100) : 0
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 14px">
                    <div style="font-weight:600;font-size:0.85rem">${escHtml(p.name)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(p.category)} · ${p.units} ${p.category==='บริการ'?'รายการ':'คัน'}</div>
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

function plBar(label, value, total, color) {
  const pct = total ? Math.round(value / total * 100) : 0
  return `<div style="text-align:center;padding:12px;background:var(--surface-2);border-radius:var(--radius-sm)">
    <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">${label}</div>
    <div style="font-size:0.88rem;font-weight:800;color:var(--${color})">${(value/1000000).toFixed(1)}M</div>
    <div style="font-size:0.65rem;color:var(--text-muted)">${pct}% ของรายได้</div>
  </div>`
}
