/**
 * Stock Analysis — วิเคราะห์สต็อกรถ
 * Route: /analytics/stock
 */
import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { listDocs, listAllDocs } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { stockAnalysis } from '../../utils/stockAnalysis.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { escHtml } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'

export default async function StockAnalysisPage(container) {
  const myGen = container.__routerGen
  // (v1.0.1309) ข้อมูลจริงล้วน — ไม่มีเป้าสต็อกสมมติ/อายุสต็อกตัวอย่างแล้ว
  let liveModels = []
  let aging = []
  let noDate = 0
  let dataSource = 'demo'
  let sortBy = 'stock'
  let sortDir = 'desc'

  try {
    // เดิม orderBy('createdAt') — รถจริงในระบบไม่มี field นี้ (มีแต่ arrivedAt) ต้องใช้ arrivedAt ให้ตรงกับ Stock.js
    const [vehicles, bookings] = await Promise.all([
      listDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 500).catch(() => []),
      listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    const r = stockAnalysis({ vehicles, bookings, today: todayBangkok() })
    liveModels = r.models
    aging = r.aging
    noDate = r.noDate
    if (liveModels.length) dataSource = 'live'
  } catch {}

  function renderPage() {
    const sorted = [...liveModels].sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1
      if (sortBy === 'name') return mul * String(a.name || '').localeCompare(String(b.name || ''))
      return mul * ((a[sortBy] ?? -1) - (b[sortBy] ?? -1))
    })
    const totalStock = liveModels.reduce((a, m) => a + m.stock, 0)
    const totalReserved = liveModels.reduce((a, m) => a + m.reserved, 0)
    const totalValue = liveModels.reduce((a, m) => a + m.stock * (m.price || 0), 0)
    const lowStock = liveModels.filter(m => m.status.color === 'danger').length
    const maxStock = Math.max(1, ...liveModels.map(m => Math.max(m.stock, m.sold30)))
    const empty = '<div style="font-size:0.78rem;color:var(--text-muted);padding:10px 0">ยังไม่มีรถในสต็อก — เพิ่มรถได้ที่หน้า สต็อกรถ</div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📦 Stock Analysis</div>
            <div class="page-subtitle">วิเคราะห์สต็อกรถ — เทียบยอดขาย 30 วัน และอายุสต็อก${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="order-btn">🧮 ดูแผนสั่งรถ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:16px">
          ${kpi('🚗 รถในสต็อก', totalStock + ' คัน', 'primary')}
          ${kpi('📋 จองแล้ว', totalReserved + ' คัน', 'warning')}
          ${kpi('⚠️ ใกล้หมด (<15 วัน)', lowStock + ' รุ่น', lowStock > 0 ? 'danger' : 'success')}
          ${kpi('💰 มูลค่ารวม', totalValue > 0 ? formatCurrency(totalValue) : '-', 'success')}
        </div>

        <div class="sa-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px;margin-bottom:14px">
          <div class="card" style="padding:14px;min-width:0">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 สต็อกแต่ละรุ่น เทียบขาย 30 วัน</div>
            ${liveModels.length ? liveModels.map(m => {
              const pct = Math.round(m.stock / maxStock * 100)
              const sPct = Math.round(m.sold30 / maxStock * 100)
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;gap:8px;font-size:0.73rem;margin-bottom:3px">
                  <span style="min-width:0;overflow-wrap:anywhere">${escHtml(m.name)}</span>
                  <span style="color:var(--${m.status.color});font-weight:700;white-space:nowrap">สต็อก ${m.stock} · ขาย ${m.sold30}</span>
                </div>
                <div style="background:var(--surface-2);border-radius:4px;height:10px;position:relative">
                  <div style="width:${pct}%;background:var(--primary);height:10px;border-radius:4px"></div>
                  ${m.sold30 ? `<div title="ขาย 30 วัน" style="position:absolute;left:${Math.min(sPct, 99)}%;top:0;width:2px;height:10px;background:var(--text-muted)"></div>` : ''}
                </div>
              </div>`
            }).join('') : empty}
          </div>

          <div class="card" style="padding:14px;min-width:0">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">⏳ อายุสต็อก (นับจากวันรถเข้า)</div>
            ${aging.map(a => {
              const color = a.range.startsWith('120') ? 'danger' : a.range.startsWith('91') ? 'warning' : 'primary'
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
                  <span>${a.range}</span><span style="color:var(--${color})">${a.count} คัน (${a.pct}%)</span>
                </div>
                <div style="background:var(--surface-2);border-radius:4px;height:8px">
                  <div style="width:${a.pct}%;background:var(--${color});height:8px;border-radius:4px"></div>
                </div>
              </div>`
            }).join('')}
            ${noDate ? `<div style="font-size:0.68rem;color:var(--text-muted);margin-top:6px">ไม่นับ ${noDate} คันที่ยังไม่ได้ใส่วันรถเข้า</div>` : ''}
          </div>
        </div>

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:640px">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                ${thSort('name', 'รุ่น', sortBy, sortDir)}
                ${thSort('stock', 'สต็อก', sortBy, sortDir)}
                ${thSort('reserved', 'จอง', sortBy, sortDir)}
                ${thSort('avail', 'พร้อมขาย', sortBy, sortDir)}
                ${thSort('sold30', 'ขาย 30 วัน', sortBy, sortDir)}
                ${thSort('dos', 'พอขาย (วัน)', sortBy, sortDir)}
                ${thSort('price', 'ราคา', sortBy, sortDir)}
                <th style="padding:8px 14px">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.length ? sorted.map(m => `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px;font-weight:600">${escHtml(m.name)}</td>
                  <td style="padding:8px 10px;text-align:center;font-weight:700">${m.stock}</td>
                  <td style="padding:8px 10px;text-align:center;color:var(--warning)">${m.reserved}</td>
                  <td style="padding:8px 10px;text-align:center;font-weight:700;color:var(--success)">${m.avail}</td>
                  <td style="padding:8px 10px;text-align:center">${m.sold30}</td>
                  <td style="padding:8px 10px;text-align:center;color:var(--text-muted)">${m.dos == null ? '-' : m.dos}</td>
                  <td style="padding:8px 10px;text-align:right">${m.price > 0 ? formatCurrency(m.price) : '-'}</td>
                  <td style="padding:8px 14px"><span class="badge badge-${m.status.color}" style="font-size:0.6rem">${m.status.label}</span></td>
                </tr>`).join('') : `<tr><td colspan="8" style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.8rem">ยังไม่มีรถในสต็อก</td></tr>`}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;padding-left:4px">พอขาย (วัน) = รถพร้อมขาย ÷ ยอดขายเฉลี่ยต่อวันใน 30 วันล่าสุด · ใกล้หมด &lt; 15 วัน · ปกติ ≤ 60 วัน · เส้นเทา = ยอดขาย 30 วัน</p>
      </div>
    `

    container.querySelectorAll('[data-sort]').forEach(th => th.addEventListener('click', () => {
      const s = th.dataset.sort
      if (sortBy === s) sortDir = sortDir === 'desc' ? 'asc' : 'desc'
      else { sortBy = s; sortDir = 'desc' }
      renderPage()
    }))
    // (v1.0.1309) เดิมปุ่มนี้เขียน stock_orders ด้วยจำนวนจาก "เป้าสต็อก" ที่แต่งขึ้น — ตอนนี้พาไปหน้าแผนสั่งรถจริง (ตารางสี + พยากรณ์)
    container.querySelector('#order-btn')?.addEventListener('click', () => navigate('/dms/color-matrix'))
  }

  renderPage()
}

function thSort(key, label, sortBy, sortDir) {
  const active = sortBy === key
  const arrow = active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''
  return `<th style="padding:8px 10px;text-align:${key==='name'?'left':'center'};cursor:pointer;${active?'color:var(--primary)':''}" data-sort="${key}">${label}${arrow}</th>`
}
