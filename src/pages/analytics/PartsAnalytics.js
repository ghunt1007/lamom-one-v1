/**
 * Parts Analytics — วิเคราะห์อะไหล่
 * Route: /analytics/parts
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, softDelete } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const PARTS_DATA = [
  { name: 'ไส้กรองแอร์', sold90: 84, stock: 20, cost: 200, price: 380, daysInStock: 12 },
  { name: 'ผ้าเบรกหน้า BYD', sold90: 36, stock: 12, cost: 850, price: 1500, daysInStock: 28 },
  { name: 'ใบปัดน้ำฝน (คู่)', sold90: 52, stock: 30, cost: 320, price: 650, daysInStock: 18 },
  { name: 'ยาง 215/55R17', sold90: 28, stock: 8, cost: 2800, price: 4500, daysInStock: 25 },
  { name: 'น้ำยาหล่อเย็น', sold90: 22, stock: 15, cost: 900, price: 1800, daysInStock: 40 },
  { name: '12V Battery', sold90: 14, stock: 6, cost: 2200, price: 3500, daysInStock: 38 },
  { name: 'ไฟหน้า LED Assembly', sold90: 2, stock: 3, cost: 8500, price: 14000, daysInStock: 160 },
  { name: 'สปอยเลอร์ Carbon', sold90: 1, stock: 3, cost: 9000, price: 15000, daysInStock: 220 },
  { name: 'ล้อแม็กซ์ 19"', sold90: 1, stock: 2, cost: 32000, price: 48000, daysInStock: 190 },
]

export function turnover(p) { return p.stock > 0 ? Math.round(p.sold90 / 3 / p.stock * 10) / 10 : 0 } // ครั้ง/เดือน
export function marginPct(p) { return Math.round((p.price - p.cost) / p.price * 100) }
export function classify(p) {
  if (p.daysInStock > 120) return 'dead'
  if (turnover(p) >= 1) return 'fast'
  return 'slow'
}

const CLASS_INFO = {
  fast: { label: 'หมุนเร็ว', color: 'success', icon: '🟢' },
  slow: { label: 'หมุนช้า', color: 'warning', icon: '🟡' },
  dead: { label: 'Dead Stock', color: 'danger', icon: '🔴' },
}

export default async function PartsAnalyticsPage(container) {
  const myGen = container.__routerGen
  let liveParts = [...PARTS_DATA].map(p => ({ ...p }))
  let dataSource = 'demo'
  let sortBy = 'sold90'

  async function loadData() {
    try {
      const parts = (await listDocs('parts_inventory', [], 'name', 'asc', 500).catch(() => [])).filter(p => !p.deleted)
      if (container.__routerGen !== myGen) return
      if (parts.length >= 2) {
        liveParts = parts.map(p => ({
          id: p.id,
          name: p.name || p.partName || 'อะไหล่',
          sold90: p.sold90 || p.qtySold || 0,
          stock: p.stock || p.qty || 0,
          cost: p.cost || p.costPrice || 0,
          price: p.price || p.salePrice || 0,
          daysInStock: p.daysInStock || 30,
        }))
        dataSource = 'live'
      } else {
        liveParts = [...PARTS_DATA].map(p => ({ ...p }))
        dataSource = 'demo'
      }
    } catch {}
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    const sorted = [...liveParts].sort((a, b) => {
      if (sortBy === 'turnover') return turnover(b) - turnover(a)
      if (sortBy === 'margin') return marginPct(b) - marginPct(a)
      if (sortBy === 'days') return b.daysInStock - a.daysInStock
      return b.sold90 - a.sold90
    })
    const revenue90 = liveParts.reduce((a, p) => a + p.sold90 * p.price, 0)
    const profit90 = liveParts.reduce((a, p) => a + p.sold90 * (p.price - p.cost), 0)
    const deadStock = liveParts.filter(p => classify(p) === 'dead')
    const deadValue = deadStock.reduce((a, p) => a + p.stock * p.cost, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔩 Parts Analytics</div>
            <div class="page-subtitle">วิเคราะห์อะไหล่ — 90 วันล่าสุด${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="add-part-btn">➕ เพิ่มอะไหล่</button>
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 ยอดขาย 90 วัน', formatCurrency(revenue90), 'primary')}
          ${kpi('📊 กำไร 90 วัน', formatCurrency(profit90), 'success')}
          ${kpi('🔴 Dead Stock', deadStock.length + ' SKU', deadStock.length > 0 ? 'danger' : 'success')}
          ${kpi('💸 ทุนจมใน Dead Stock', formatCurrency(deadValue), deadValue > 0 ? 'warning' : 'success')}
        </div>

        ${deadStock.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🔴 <strong>Dead Stock (ค้างเกิน 120 วัน):</strong> ${deadStock.map(p => escHtml(p.name)).join(' · ')}
            — แนะนำจัดโปรลดล้างสต็อก หรือคืนซัพพลายเออร์
          </div>
        ` : ''}

        <!-- Sort -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          ${[['sold90','📊 ขายดี'],['turnover','🔄 Turnover'],['margin','💰 Margin'],['days','⏳ ค้างนาน']].map(([k,l]) =>
            `<button class="btn btn-xs ${sortBy===k?'btn-primary':'btn-secondary'} sort-btn" data-s="${k}">${l}</button>`).join('')}
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">อะไหล่</th>
                <th style="padding:8px 10px;text-align:right">ขาย 90 วัน</th>
                <th style="padding:8px 10px;text-align:right">สต็อก</th>
                <th style="padding:8px 10px;text-align:right">Turnover/เดือน</th>
                <th style="padding:8px 10px;text-align:right">Margin</th>
                <th style="padding:8px 10px;text-align:right">ค้าง (วัน)</th>
                <th style="padding:8px 14px">สถานะ</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(p => {
                const cls = classify(p)
                const ci = CLASS_INFO[cls]
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${cls==='dead'?';background:var(--danger)06':''}">
                  <td style="padding:8px 14px;font-weight:600">${escHtml(p.name)}</td>
                  <td style="padding:8px 10px;text-align:right">${p.sold90} ชิ้น</td>
                  <td style="padding:8px 10px;text-align:right">${p.stock}</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--${turnover(p)>=1?'success':'warning'})">${turnover(p)}×</td>
                  <td style="padding:8px 10px;text-align:right">${marginPct(p)}%</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--${p.daysInStock>120?'danger':'text-muted'})">${p.daysInStock}</td>
                  <td style="padding:8px 14px"><span class="badge badge-${ci.color}" style="font-size:0.6rem">${ci.icon} ${ci.label}</span></td>
                  <td style="padding:8px 14px;text-align:right">${dataSource==='live' && p.id ? `<button class="btn btn-xs btn-secondary del-part-btn" data-id="${p.id}" title="ลบ" style="color:var(--danger)">🗑</button>` : ''}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 Turnover = ยอดขายเฉลี่ย/เดือน ÷ สต็อก — ต่ำกว่า 1× คือหมุนช้า · ค้างเกิน 120 วัน = Dead Stock</p>
      </div>
    `

    container.querySelectorAll('.sort-btn').forEach(b => b.addEventListener('click', () => { sortBy = b.dataset.s; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        [...liveParts].sort((a, b) => b.sold90 - a.sold90).map(p => ({
          'ชิ้นส่วน': p.name,
          'ขาย 90 วัน (ชิ้น)': p.sold90,
          'สต็อก (ชิ้น)': p.stock,
          'ต้นทุน (บาท)': p.cost,
          'ราคาขาย (บาท)': p.price,
          'Margin %': marginPct(p),
          'Turnover (ครั้ง/เดือน)': turnover(p),
          'วันในสต็อก': p.daysInStock,
          'หมวด': classify(p),
        })),
        'Parts_Analytics.xlsx',
        'Parts'
      )
      showToast('📥 Export Parts Analytics แล้ว', 'success')
    })
    document.getElementById('add-part-btn')?.addEventListener('click', () => openAddPart())
    container.querySelectorAll('.del-part-btn').forEach(b => b.addEventListener('click', async () => {
      const p = liveParts.find(x => x.id === b.dataset.id)
      if (!p) return
      const ok = await confirmDialog({ title: 'ลบอะไหล่', message: `ยืนยันลบอะไหล่ "${escHtml(p.name)}" ออกจากระบบวิเคราะห์หรือไม่?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('parts_inventory', p.id)
        showToast('🗑 ลบแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
  }

  function openAddPart() {
    openModal({
      title: '➕ เพิ่มอะไหล่เข้าระบบวิเคราะห์',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่ออะไหล่ *</label><input class="input" id="np-name"></div>
        <div class="input-group"><label class="input-label">ขาย 90 วัน (ชิ้น)</label><input class="input" type="number" id="np-sold" value="0"></div>
        <div class="input-group"><label class="input-label">สต็อกคงเหลือ (ชิ้น)</label><input class="input" type="number" id="np-stock" value="0"></div>
        <div class="input-group"><label class="input-label">ต้นทุน/ชิ้น (บาท)</label><input class="input" type="number" id="np-cost" value="0"></div>
        <div class="input-group"><label class="input-label">ราคาขาย/ชิ้น (บาท)</label><input class="input" type="number" id="np-price" value="0"></div>
        <div class="input-group"><label class="input-label">ค้างในสต็อก (วัน)</label><input class="input" type="number" id="np-days" value="30"></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('np-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่ออะไหล่', 'error'); return false }
        try {
          await createDoc('parts_inventory', {
            name,
            sold90: parseInt(document.getElementById('np-sold')?.value) || 0,
            stock: parseInt(document.getElementById('np-stock')?.value) || 0,
            cost: parseFloat(document.getElementById('np-cost')?.value) || 0,
            price: parseFloat(document.getElementById('np-price')?.value) || 0,
            daysInStock: parseInt(document.getElementById('np-days')?.value) || 30,
          })
          showToast(`✅ เพิ่มอะไหล่ "${name}" แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
