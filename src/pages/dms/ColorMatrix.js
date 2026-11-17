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
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { escHtml } from '../../utils/escape.js'
import { orderNeeds } from '../../utils/orderNeeds.js'
import { carLabel } from '../../utils/carLabel.js'
import { confirmDialog } from '../../utils/modal.js'

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
  none:  { label: 'ไม่มีสต็อก', badge: '⛔ ไม่มีสต็อก', color: 'var(--danger)' },
}

export default async function ColorMatrixPage(container) {
  const myGen = container.__routerGen
  let vehicles = []
  let orders = []
  let bookings = []
  let needs = []
  let showAllNeeds = false
  let rows = []
  let filterModel = 'all'
  let filterStatus = 'all'
  let loading = true
  let ordering = false

  async function loadData() {
    loading = true
    try { vehicles = await listDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 1000) } catch { vehicles = [] }
    try { orders = await listDocs('vehicle_orders', companyScopeFilters(), 'createdAt', 'desc', 500) } catch { orders = [] }
    // (v1.0.1224) ใบจองที่ลูกค้ายังรอรถ — ใช้คำนวณว่าต้องสั่งรุ่นไหน สีอะไร กี่คัน
    try { bookings = await listDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 2000) } catch { bookings = [] }
    needs = orderNeeds({ bookings, vehicles, orders })
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
      if (!map[key]) map[key] = { brand: v.brand || '', model: v.model, displayModel: carLabel(v.brand, v.model), color, stockQty: 0, pendingLeadDays: null, cost: 0 }
      if (v.status === 'available') {
        map[key].stockQty++
        map[key].cost = v.cost || map[key].cost
      }
    })
    orders.forEach(o => {
      if (!o.model) return
      const color = o.color || 'ไม่ระบุสี'
      const key = `${o.brand || ''}|${o.model}|${color}`
      if (!map[key]) map[key] = { brand: o.brand || '', model: o.model, displayModel: carLabel(o.brand, o.model), color, stockQty: 0, pendingLeadDays: null, cost: o.unitCost || 0 }
      const pending = !['arrived', 'cancelled'].includes(o.status)
      if (pending) {
        const lead = daysUntil(o.expectedDate) ?? 0
        if (map[key].pendingLeadDays == null || lead < map[key].pendingLeadDays) map[key].pendingLeadDays = lead
      }
    })
    rows = Object.values(map).map(r => {
      const status = r.stockQty > 0 ? 'stock' : (r.pendingLeadDays != null ? 'order' : 'none')
      return { ...r, status, leadDays: r.pendingLeadDays || 0 }
    }).sort((a, b) => String(a.displayModel || '').localeCompare(String(b.displayModel || '')) || String(a.color || '').localeCompare(String(b.color || '')))
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

  // (v1.0.1224) 🛒 ต้องสั่งรุ่นไหน สีอะไร — ลูกค้าจองรอรถ เทียบ รถว่าง + กำลังมา + สั่งแล้ว
  function needsSection() {
    const waiting = needs.filter(r => r.wait > 0)
    const short = waiting.filter(r => r.short > 0)
    const totalShort = short.reduce((a, r) => a + r.short, 0)
    const list = showAllNeeds ? waiting : short
    const cell = (v, c) => `<div style="text-align:center;min-width:44px"><div style="font-weight:800;color:${c || 'inherit'}">${v}</div></div>`
    const head = l => `<div style="text-align:center;min-width:44px;font-size:0.62rem;color:var(--text-muted)">${l}</div>`
    const line = r => `<div class="cm-need" style="display:flex;align-items:center;gap:8px;padding:10px 4px;border-top:1px solid var(--border);flex-wrap:wrap">
        <div style="width:20px;height:20px;border-radius:50%;background:${colorDot(r.color)};border:2px solid var(--border);flex-shrink:0"></div>
        <div style="flex:1;min-width:140px">
          <div style="font-weight:700;font-size:0.82rem">${escHtml(r.car)} · สี${escHtml(r.color)}</div>
          <div style="font-size:0.66rem;color:var(--text-muted);overflow-wrap:anywhere">รอ: ${r.waitNames.map(escHtml).join(', ')}${r.wait > r.waitNames.length ? ` และอีก ${r.wait - r.waitNames.length} คน` : ''}${r.draft ? ` · ร่างใบสั่ง ${r.draft} คัน` : ''}</div>
        </div>
        <div style="display:flex;gap:2px;font-size:0.8rem">
          ${cell(r.wait)}${cell(r.ready)}${cell(r.coming + r.ordered)}${cell(r.short ? '−' + r.short : '✓', r.short ? 'var(--danger)' : 'var(--success)')}
        </div>
      </div>`
    return `<div class="card" style="padding:14px 16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <div style="font-weight:900;font-size:0.95rem;flex:1;min-width:200px">🛒 ต้องสั่งรถรุ่นไหน สีอะไร</div>
          ${waiting.length ? `<button class="btn btn-xs btn-secondary" id="cm-need-all">${showAllNeeds ? 'ดูเฉพาะที่ขาด' : `ดูทุกรุ่นที่มีลูกค้ารอ (${waiting.length})`}</button>` : ''}
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">นับจากใบจองที่ลูกค้ายังรอรถ (ยังไม่มีเลขตัวถัง ไม่นับที่รถมาแล้ว/ถอนจอง) เทียบกับรถว่างในสต็อก รถกำลังมา และใบสั่งรถที่ส่งไปแล้ว</div>
        ${!waiting.length ? `<div style="padding:14px 0;color:var(--success);font-weight:700">✅ ตอนนี้ไม่มีลูกค้าที่จองแล้วรอรถ</div>`
          : !list.length ? `<div style="padding:14px 0;color:var(--success);font-weight:700">✅ รถพอสำหรับลูกค้าที่จองรอทุกคนแล้ว (มีลูกค้ารอ ${waiting.reduce((a, r) => a + r.wait, 0)} คน)</div>`
          : `<div style="font-weight:800;color:${totalShort ? 'var(--danger)' : 'var(--success)'};margin-bottom:4px">${totalShort ? `ต้องสั่งเพิ่ม ${totalShort} คัน · ${short.length} รุ่น/สี` : 'ไม่มีรุ่นที่ขาด'}</div>
             <div style="display:flex;align-items:center;gap:8px;padding:4px;flex-wrap:wrap"><div style="flex:1;min-width:168px"></div><div style="display:flex;gap:2px">${head('จองรอ')}${head('พร้อมขาย')}${head('มา/สั่ง')}${head('ขาด')}</div></div>
             ${list.map(line).join('')}`}
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
            <div class="page-title">🎨 ตารางสีรถ · ต้องสั่งอะไร</div>
            <div class="page-subtitle">ลูกค้าจองรอ + สต็อกจริง + ใบสั่งรถ · ${MODELS.length} รุ่น ${rows.length} รายการสี</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="order-btn" ${ordering ? 'disabled' : ''}>${ordering ? '⏳ กำลังทำ...' : '📦 ทำร่างใบสั่งที่ขาด'}</button>
          </div>
        </div>

        ${needsSection()}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">
          ${sc('✅ มีสต็อก', stockCount + ' สี', 'var(--success)')}
          ${sc('📦 สั่งแล้ว รอรับ', orderCount + ' สี', 'var(--warning)')}
          ${sc('⛔ ไม่มีสต็อก/ไม่ได้สั่ง', noneCount + ' สี', 'var(--danger)')}
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
    document.getElementById('cm-need-all')?.addEventListener('click', () => { showAllNeeds = !showAllNeeds; render() })
    document.getElementById('order-btn')?.addEventListener('click', async () => {
      // (v1.0.1224) ขาดตามลูกค้าที่จองรอก่อน (จำนวนคันที่ขาด หักร่างที่ทำไว้แล้ว) — ถ้าไม่มี ใช้สีที่ไม่มีสต็อกเลยแบบเดิม
      const fromNeeds = needs.filter(r => r.short - r.draft > 0).map(r => ({ brand: r.brand, model: r.model, color: r.color === 'ไม่ระบุสี' ? '' : r.color, qty: r.short - r.draft, cost: 0, why: `ลูกค้าจองรอ ${r.wait} คน: ${r.waitNames.join(', ')}` }))
      const gaps = fromNeeds.length ? fromNeeds : rows.filter(r => r.status === 'none').map(r => ({ ...r, qty: 1, why: 'สีที่ไม่มีสต็อกและไม่มีคำสั่งซื้อค้าง' }))
      if (!gaps.length) { showToast('✅ ไม่มีรุ่น/สีที่ขาดตอนนี้', 'success'); return }
      if (!await confirmDialog({ title: '📦 ทำร่างใบสั่งรถ', message: `ทำร่าง ${gaps.length} รายการ (${gaps.reduce((a, g) => a + g.qty, 0)} คัน)? ร่างยังไม่ได้ส่งให้ใคร ไปตรวจและกดสั่งจริงที่หน้าใบสั่งรถ`, confirmText: 'ทำร่าง' })) return
      ordering = true; render()
      try {
        const today = new Date()
        const expected = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
        for (const g of gaps) {
          await createDoc('vehicle_orders', {
            orderNo: 'ORD-CM-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
            brand: g.brand, model: g.model, variant: '', color: g.color,
            qty: g.qty, unitCost: g.cost || 0, status: 'draft', expectedDate: expected,
            supplier: '', notes: 'ร่างจากหน้าตารางสีรถ — ' + g.why,
            createdAt: today.toISOString().slice(0, 10),
            companyId: myEffectiveCompanyId(),
          })
        }
        showToast(`📦 ทำร่างใบสั่งรถ ${gaps.length} รายการแล้ว — ตรวจและกดสั่งที่หน้าใบสั่งรถ`, 'success')
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
