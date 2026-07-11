/**
 * Stock Analysis — วิเคราะห์สต็อกรถ
 * Route: /analytics/stock
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const MODELS = [
  { id: 'M01', name: 'BYD Dolphin', stock: 8, reserved: 3, sold30: 12, targetStock: 10, price: 899000, color: '#3b82f6' },
  { id: 'M02', name: 'BYD Atto 3', stock: 5, reserved: 2, sold30: 8, targetStock: 8, price: 1099000, color: '#10b981' },
  { id: 'M03', name: 'BYD Seal AWD', stock: 3, reserved: 1, sold30: 6, targetStock: 6, price: 1699000, color: '#f59e0b' },
  { id: 'M04', name: 'MG ZS EV', stock: 11, reserved: 1, sold30: 5, targetStock: 8, price: 799000, color: '#ef4444' },
  { id: 'M05', name: 'BYD Han', stock: 2, reserved: 1, sold30: 3, targetStock: 4, price: 2099000, color: '#8b5cf6' },
  { id: 'M06', name: 'BYD Atto 3 Pro', stock: 4, reserved: 0, sold30: 4, targetStock: 5, price: 1299000, color: '#06b6d4' },
  { id: 'M07', name: 'MG4 Electric', stock: 6, reserved: 2, sold30: 7, targetStock: 7, price: 949000, color: '#ec4899' },
]

const AGING_DATA = [
  { range: '0-30 วัน', count: 18, pct: 40 },
  { range: '31-60 วัน', count: 12, pct: 27 },
  { range: '61-90 วัน', count: 7, pct: 16 },
  { range: '91-120 วัน', count: 5, pct: 11 },
  { range: '120+ วัน', count: 3, pct: 7 },
]

export default async function StockAnalysisPage(container) {
  const myGen = container.__routerGen
  let liveModels = [...MODELS].map(m => ({ ...m }))
  let dataSource = 'demo'
  let sortBy = 'stock'
  let sortDir = 'desc'

  try {
    const vehicles = await listDocs('vehicles', [], 'createdAt', 'desc', 500).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (vehicles.length >= 2) {
      const grouped = {}
      for (const v of vehicles) {
        const key = `${v.brand || ''} ${v.model || ''}`.trim() || 'ไม่ระบุ'
        if (!grouped[key]) grouped[key] = { stock: 0, reserved: 0, price: v.price || v.salePrice || 0 }
        if (v.status === 'จอง' || v.status === 'reserved') grouped[key].reserved++
        else grouped[key].stock++
      }
      liveModels = Object.entries(grouped).map(([name, g], i) => {
        const demo = MODELS.find(m => m.name === name) || MODELS[i % MODELS.length]
        return { ...demo, name, stock: g.stock, reserved: g.reserved, price: g.price || demo.price }
      })
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const sorted = [...liveModels].sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name)
      return mul * (a[sortBy] - b[sortBy])
    })
    const totalStock = liveModels.reduce((a, m) => a + m.stock, 0)
    const totalReserved = liveModels.reduce((a, m) => a + m.reserved, 0)
    const totalValue = liveModels.reduce((a, m) => a + m.stock * m.price, 0)
    const lowStock = liveModels.filter(m => m.stock < m.targetStock).length
    const maxStock = Math.max(1, ...liveModels.map(m => Math.max(m.stock, m.targetStock)))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📦 Stock Analysis</div>
            <div class="page-subtitle">วิเคราะห์สต็อกรถ — ระดับ ความต้องการ และอายุสต็อก${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="order-btn">+ สั่งรถเพิ่ม</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚗 รถในสต็อก', totalStock + ' คัน', 'primary')}
          ${kpi('📋 จองแล้ว', totalReserved + ' คัน', 'warning')}
          ${kpi('⚠️ ต่ำกว่าเป้า', lowStock + ' รุ่น', lowStock > 0 ? 'danger' : 'success')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalValue), 'success')}
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
          <!-- Bar chart by model -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 สต็อกแต่ละรุ่น (vs เป้า)</div>
            ${liveModels.map(m => {
              const pct = Math.round(m.stock / maxStock * 100)
              const tPct = Math.round(m.targetStock / maxStock * 100)
              const status = m.stock >= m.targetStock ? 'success' : m.stock >= m.targetStock * 0.5 ? 'warning' : 'danger'
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
                  <span>${escHtml(m.name)}</span>
                  <span style="color:var(--${status});font-weight:700">${m.stock} / ${m.targetStock}</span>
                </div>
                <div style="background:var(--surface-2);border-radius:4px;height:10px;position:relative">
                  <div style="width:${pct}%;background:var(--${status});height:10px;border-radius:4px"></div>
                  <div style="position:absolute;left:${tPct}%;top:0;width:2px;height:10px;background:var(--text-muted)"></div>
                </div>
              </div>`
            }).join('')}
          </div>

          <!-- Aging analysis -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">⏳ Aging สต็อก</div>
            ${AGING_DATA.map(a => {
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
          </div>
        </div>

        <!-- Detail table -->
        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                ${thSort('name', 'รุ่น', sortBy, sortDir)}
                ${thSort('stock', 'สต็อก', sortBy, sortDir)}
                ${thSort('reserved', 'จอง', sortBy, sortDir)}
                <th style="padding:8px 10px;text-align:center">พร้อมขาย</th>
                ${thSort('sold30', 'ขาย 30 วัน', sortBy, sortDir)}
                <th style="padding:8px 10px;text-align:center">DOS</th>
                ${thSort('price', 'ราคา', sortBy, sortDir)}
                <th style="padding:8px 14px">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(m => {
                const avail = m.stock - m.reserved
                const dos = m.sold30 > 0 ? (m.stock / (m.sold30/30)).toFixed(1) : '∞'
                const status = m.stock >= m.targetStock ? 'success' : m.stock >= m.targetStock * 0.5 ? 'warning' : 'danger'
                const statusLabel = m.stock >= m.targetStock ? 'ปกติ' : m.stock >= m.targetStock * 0.5 ? 'ต่ำ' : 'วิกฤต'
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="width:8px;height:8px;border-radius:50%;background:${m.color}"></div>
                      <span style="font-weight:600">${escHtml(m.name)}</span>
                    </div>
                  </td>
                  <td style="padding:8px 10px;text-align:center;font-weight:700">${m.stock}</td>
                  <td style="padding:8px 10px;text-align:center;color:var(--warning)">${m.reserved}</td>
                  <td style="padding:8px 10px;text-align:center;font-weight:700;color:var(--success)">${avail}</td>
                  <td style="padding:8px 10px;text-align:center">${m.sold30}</td>
                  <td style="padding:8px 10px;text-align:center;color:var(--text-muted)">${dos} วัน</td>
                  <td style="padding:8px 10px;text-align:right">${formatCurrency(m.price)}</td>
                  <td style="padding:8px 14px"><span class="badge badge-${status}" style="font-size:0.6rem">${statusLabel}</span></td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;padding-left:4px">DOS = Days of Supply · แถวสีเทา = เส้นเป้า</p>
      </div>
    `

    container.querySelectorAll('[data-sort]').forEach(th => th.addEventListener('click', () => {
      const s = th.dataset.sort
      if (sortBy === s) sortDir = sortDir === 'desc' ? 'asc' : 'desc'
      else { sortBy = s; sortDir = 'desc' }
      renderPage()
    }))
    document.getElementById('order-btn')?.addEventListener('click', () => {
      const lowModels = liveModels.filter(m => m.stock < m.targetStock)
      openModal({
        title: '+ สั่งรถเพิ่ม',
        size: 'sm',
        body: `<div style="font-size:0.82rem">
          <p style="margin-bottom:8px">รุ่นที่ต้องการ:</p>
          ${lowModels.map(m => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">
            <span>${escHtml(m.name)}</span><span style="color:var(--danger)">ขาด ${m.targetStock - m.stock} คัน</span>
          </div>`).join('')}
        </div>`,
        async onConfirm() {
          const totalCars = lowModels.reduce((s, m) => s + (m.targetStock - m.stock), 0)
          try {
            for (const m of lowModels) {
              await createDoc('stock_orders', {
                model: m.name,
                qty: m.targetStock - m.stock,
                status: 'pending',
                orderedAt: new Date().toISOString(),
              })
            }
            showToast(`📋 ส่งคำสั่งซื้อ ${lowModels.length} รุ่น รวม ${totalCars} คันแล้ว`, 'success')
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function thSort(key, label, sortBy, sortDir) {
  const active = sortBy === key
  const arrow = active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''
  return `<th style="padding:8px 10px;text-align:${key==='name'?'left':'center'};cursor:pointer;${active?'color:var(--primary)':''}" data-sort="${key}">${label}${arrow}</th>`
}
