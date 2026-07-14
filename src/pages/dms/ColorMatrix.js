/**
 * Color & Option Matrix — สี/ออปชั่นที่มีสต็อก vs ต้องสั่ง
 * Route: /dms/color-matrix
 *
 * ข้อมูลคำนวณจริงจาก collection `vehicles` (สต็อกจริง — ดู src/pages/dms/Stock.js)
 * และ `vehicle_orders` (คำสั่งซื้อจริง — ดู src/pages/dms/VehicleOrders.js) — ไม่มีข้อมูล mock
 */
import { listDocs, createDoc } from '../../core/db.js'
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function colorDot(color = '') {
  const map = { ขาว: '#f5f5f5', น้ำเงิน: '#1976D2', แดง: '#E53935', ดำ: '#212121', เทา: '#9E9E9E', เขียว: '#43A047', เงิน: '#BDBDBD', ทอง: '#FDD835', ชมพู: '#e91e63', เหลือง: '#ffd600' }
  for (const [k, v] of Object.entries(map)) { if (color.includes(k)) return v }
  return '#6B7280'
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000))
}

const STATUS_META = {
  stock: { label: 'มีสต็อก', badge: '✅ สต็อก', color: 'var(--success)' },
  order: { label: 'สั่งแล้ว รอรับ', badge: '📦 สั่งแล้ว', color: 'var(--warning)' },
  none:  { label: 'ต้องสั่ง', badge: '⛔ ต้องสั่ง', color: 'var(--danger)' },
}

export default async function ColorMatrixPage(container) {
  const myGen = container.__routerGen
  let vehicles = []
  let orders = []
  let rows = []
  let filterModel = 'all'
  let filterStatus = 'all'
  let loading = true
  let ordering = false

  async function loadData() {
    loading = true
    try { vehicles = await listDocs('vehicles', [], 'arrivedAt', 'desc', 1000) } catch { vehicles = [] }
    try { orders = await listDocs('vehicle_orders', [], 'createdAt', 'desc', 500) } catch { orders = [] }
    computeMatrix()
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function computeMatrix() {
    const map = {}
    vehicles.forEach(v => {
      if (!v.model) return
      const color = v.color || 'ไม่ระบุสี'
      const key = `${v.brand || ''}|${v.model}|${color}`
      if (!map[key]) map[key] = { brand: v.brand || '', model: v.model, displayModel: `${v.brand || ''} ${v.model}`.trim(), color, stockQty: 0, pendingLeadDays: null, cost: 0 }
      if (v.status === 'available') {
        map[key].stockQty++
        map[key].cost = v.cost || map[key].cost
      }
    })
    orders.forEach(o => {
      if (!o.model) return
      const color = o.color || 'ไม่ระบุสี'
      const key = `${o.brand || ''}|${o.model}|${color}`
      if (!map[key]) map[key] = { brand: o.brand || '', model: o.model, displayModel: `${o.brand || ''} ${o.model}`.trim(), color, stockQty: 0, pendingLeadDays: null, cost: o.unitCost || 0 }
      const pending = !['arrived', 'cancelled'].includes(o.status)
      if (pending) {
        const lead = daysUntil(o.expectedDate) ?? 0
        if (map[key].pendingLeadDays == null || lead < map[key].pendingLeadDays) map[key].pendingLeadDays = lead
      }
    })
    rows = Object.values(map).map(r => {
      const status = r.stockQty > 0 ? 'stock' : (r.pendingLeadDays != null ? 'order' : 'none')
      return { ...r, status, leadDays: r.pendingLeadDays || 0 }
    }).sort((a, b) => a.displayModel.localeCompare(b.displayModel) || a.color.localeCompare(b.color))
  }

  function colorChip(r) {
    const meta = STATUS_META[r.status]
    const detail = r.status === 'stock' ? r.stockQty + ' คัน' : r.status === 'order' ? r.leadDays + ' วัน (รอรับ)' : '-'
    const borderStyle = colorDot(r.color) === '#f5f5f5' ? 'border:2px solid var(--border)' : 'border:2px solid transparent'
    return `<div class="card" style="padding:12px;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:50%;background:${colorDot(r.color)};${borderStyle};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:0.76rem;font-weight:700">${escHtml(r.color)}</div>
        <div style="font-size:0.66rem;color:var(--text-muted)">${escHtml(r.displayModel)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:0.62rem;background:${meta.color};color:#fff;padding:1px 8px;border-radius:8px;margin-bottom:2px">${meta.badge}</div>
        <div style="font-size:0.62rem;color:var(--text-muted)">${detail}</div>
      </div>
    </div>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="skeleton" style="height:400px;border-radius:8px"></div></div>`
      return
    }

    let filteredRows = rows
    if (filterModel !== 'all') filteredRows = filteredRows.filter(r => r.displayModel === filterModel)
    if (filterStatus !== 'all') filteredRows = filteredRows.filter(r => r.status === filterStatus)

    const MODELS = [...new Set(rows.map(r => r.displayModel))].sort()
    const stockCount = rows.filter(r => r.status === 'stock').length
    const orderCount = rows.filter(r => r.status === 'order').length
    const noneCount = rows.filter(r => r.status === 'none').length
    const totalQty = rows.filter(r => r.status === 'stock').reduce((s, r) => s + r.stockQty, 0)

    const modelOpts = MODELS.map(m => '<option value="' + escHtml(m) + '"' + (filterModel === m ? ' selected' : '') + '>' + escHtml(m) + '</option>').join('')

    const statusBtns = ['all', 'stock', 'order', 'none'].map(s => {
      const label = s === 'all' ? 'ทั้งหมด' : STATUS_META[s].badge
      return '<button class="btn btn-xs ' + (filterStatus === s ? 'btn-primary' : 'btn-secondary') + ' stat-btn" data-s="' + s + '">' + label + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎨 Color & Option Matrix</div>
            <div class="page-subtitle">สี/ออปชั่นจากสต็อกจริง (vehicles) + คำสั่งซื้อจริง (vehicle_orders) · ${MODELS.length} รุ่น ${rows.length} รายการสี</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="order-btn" ${ordering ? 'disabled' : ''}>${ordering ? '⏳ กำลังสั่ง...' : '📦 สั่งสีที่ขาด'}</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('✅ มีสต็อก', stockCount + ' สี', 'var(--success)')}
          ${sc('📦 สั่งแล้ว รอรับ', orderCount + ' สี', 'var(--warning)')}
          ${sc('⛔ ต้องสั่ง', noneCount + ' สี', 'var(--danger)')}
          ${sc('🚗 คันในสต็อก', totalQty + ' คัน', 'var(--primary)')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
          <select class="input" id="model-filter" style="min-width:160px">
            <option value="all">ทุกรุ่น</option>
            ${modelOpts}
          </select>
          ${statusBtns}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">
          ${filteredRows.map(r => colorChip(r)).join('')}
          ${filteredRows.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--text-muted);grid-column:1/-1">${rows.length === 0 ? 'ยังไม่มีข้อมูลรถในสต็อก — เพิ่มรถที่หน้า Stock (📦 สต็อกรถยนต์) ก่อน' : 'ไม่พบข้อมูลตามตัวกรอง'}</div>` : ''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.s; render() }))
    document.getElementById('model-filter')?.addEventListener('change', e => { filterModel = e.target.value; render() })
    document.getElementById('order-btn')?.addEventListener('click', async () => {
      const gaps = rows.filter(r => r.status === 'none')
      if (!gaps.length) { showToast('✅ ไม่มีสีที่ขาดสต็อกตอนนี้', 'success'); return }
      ordering = true; render()
      try {
        const today = new Date()
        const expected = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
        for (const g of gaps) {
          await createDoc('vehicle_orders', {
            orderNo: 'ORD-CM-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
            brand: g.brand, model: g.model, variant: '', color: g.color,
            qty: 1, unitCost: g.cost || 0, status: 'draft', expectedDate: expected,
            supplier: '', notes: 'สั่งอัตโนมัติจากหน้า Color & Option Matrix (สีที่ไม่มีสต็อกและไม่มีคำสั่งซื้อค้าง)',
            createdAt: today.toISOString().slice(0, 10),
          })
        }
        showToast(`📦 ส่งใบสั่ง ${gaps.length} สีที่ขาดสต็อกไปยังคำสั่งซื้อ (vehicle_orders) แล้ว`, 'success')
      } catch {
        showToast('เกิดข้อผิดพลาดระหว่างสร้างคำสั่งซื้อ', 'error')
      }
      ordering = false
      await loadData()
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
  await loadData()
}
