import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS = {
  draft:      { label: '✏️ ร่าง',          badge: 'primary' },
  ordered:    { label: '📤 สั่งแล้ว',      badge: 'primary' },
  confirmed:  { label: '✅ ยืนยันแล้ว',    badge: 'accent'  },
  production: { label: '🏭 กำลังผลิต',     badge: 'warning' },
  shipped:    { label: '🚢 กำลังขนส่ง',    badge: 'accent'  },
  arrived:    { label: '📦 ถึงแล้ว',       badge: 'success' },
  cancelled:  { label: '❌ ยกเลิก',        badge: 'danger'  },
}

const DEMO_ORDERS = [
  { id:'ord1', orderNo:'ORD-2025-001', brand:'BYD', model:'Seal', variant:'AWD', color:'ขาว Pearl', qty:3, unitCost:1150000, status:'shipped', expectedDate:'2025-04-20', supplier:'BYD Auto Thailand', notes:'ETA พอร์ตแหลมฉบัง', createdAt:'2025-03-01' },
  { id:'ord2', orderNo:'ORD-2025-002', brand:'MG', model:'MG4', variant:'X', color:'แดง', qty:2, unitCost:840000, status:'confirmed', expectedDate:'2025-05-10', supplier:'SAIC-MG Thailand', notes:'', createdAt:'2025-03-15' },
  { id:'ord3', orderNo:'ORD-2025-003', brand:'DEEPAL', model:'S7', variant:'Pro', color:'ดำ', qty:1, unitCost:1320000, status:'arrived', expectedDate:'2025-04-01', supplier:'Changan Auto Thailand', notes:'รับแล้ว — ส่ง PDI', createdAt:'2025-02-20' },
  { id:'ord4', orderNo:'ORD-2025-004', brand:'NETA', model:'V II', variant:'400', color:'ขาว', qty:5, unitCost:680000, status:'production', expectedDate:'2025-06-01', supplier:'NETA Thailand', notes:'', createdAt:'2025-04-01' },
]

let orderCounter = 5

export default async function VehicleOrdersPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let orders = []
  let filtered = []
  let statusFilter = 'all'
  let search = ''

  async function loadData() {
    try { orders = await listDocs('vehicle_orders', [], 'createdAt', 'desc', 200) } catch {}
    if (!orders.length) DEMO_ORDERS.forEach(o => orders.push({ ...o }))
    updateStats(); applyFilter()
  }

  function updateStats() {
    Object.keys(STATUS).forEach(k => {
      const el = document.getElementById(`ostat-${k}`)
      if (el) el.textContent = orders.filter(o => o.status === k).length
    })
    const totalCost = orders.filter(o => !['cancelled'].includes(o.status)).reduce((s, o) => s + (o.unitCost || 0) * (o.qty || 1), 0)
    const el = document.getElementById('order-value')
    if (el) el.textContent = `มูลค่าคำสั่งซื้อรวม: ${formatCurrency(totalCost)}`
    const totEl = document.getElementById('order-total')
    if (totEl) totEl.textContent = `${orders.length} รายการ`
  }

  function applyFilter() {
    filtered = orders.filter(o => {
      const ss = statusFilter === 'all' || o.status === statusFilter
      const qs = !search || `${o.orderNo} ${o.brand} ${o.model} ${o.supplier}`.toLowerCase().includes(search)
      return ss && qs
    })
    renderTable()
  }

  function renderTable() {
    const wrap = document.getElementById('orders-content')
    if (!wrap) return
    const cEl = document.getElementById('orders-filtered')
    if (cEl) cEl.textContent = `แสดง ${filtered.length} รายการ`

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">🛒</div><div class="empty-title">ไม่พบคำสั่งซื้อ</div></div>`
      return
    }

    wrap.innerHTML = `<div class="table-wrap">
      <table>
        <thead><tr>
          <th>เลขที่คำสั่ง</th><th>ยี่ห้อ/รุ่น</th><th>สี</th><th>จำนวน</th>
          <th>ต้นทุน/คัน</th><th>มูลค่ารวม</th><th>สถานะ</th><th>วันรับคาด</th><th>Supplier</th><th></th>
        </tr></thead>
        <tbody>${filtered.map(o => tableRow(o)).join('')}</tbody>
      </table>
    </div>`
    bindTableEvents()
  }

  function tableRow(o) {
    const st = STATUS[o.status] || { label: escHtml(o.status), badge: 'primary' }
    const total = (o.unitCost || 0) * (o.qty || 1)
    const isLate = o.expectedDate && o.status !== 'arrived' && o.status !== 'cancelled' && new Date(o.expectedDate) < new Date()
    return `
      <tr class="order-row" data-id="${o.id}" style="cursor:pointer">
        <td><span style="font-weight:600;color:var(--primary)">${escHtml(o.orderNo)}</span></td>
        <td>
          <div style="font-weight:600">${escHtml(o.brand)} ${escHtml(o.model)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(o.variant || '')}</div>
        </td>
        <td>${escHtml(o.color || '-')}</td>
        <td style="text-align:center;font-weight:700">${o.qty || 1} คัน</td>
        <td style="color:var(--text-2)">${formatCurrency(o.unitCost)}</td>
        <td style="font-weight:600;color:var(--accent)">${formatCurrency(total)}</td>
        <td><span class="badge badge-${st.badge}">${st.label}</span></td>
        <td style="font-size:0.8rem;${isLate ? 'color:var(--danger);font-weight:600' : 'color:var(--text-2)'}">
          ${formatDate(o.expectedDate)}${isLate ? ' ⚠️' : ''}
        </td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${escHtml(o.supplier || '-')}</td>
        <td>
          <div style="display:flex;gap:3px">
            <button class="btn btn-ghost btn-sm edit-o" data-id="${o.id}" title="แก้ไข">✏️</button>
            <button class="btn btn-ghost btn-sm del-o" data-id="${o.id}" title="ยกเลิก" style="color:var(--danger)">🗑</button>
          </div>
        </td>
      </tr>`
  }

  function bindTableEvents() {
    document.querySelectorAll('.order-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.edit-o,.del-o')) return
        openDetail(orders.find(o => o.id === row.dataset.id))
      })
    })
    document.querySelectorAll('.edit-o').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openForm(orders.find(o => o.id === btn.dataset.id))
    }))
    document.querySelectorAll('.del-o').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const o = orders.find(x => x.id === btn.dataset.id)
      if (!await confirmDialog({ title:'ยกเลิกคำสั่ง', message:`ยกเลิก ${o?.orderNo}?`, confirmText:'ยกเลิก', danger:true })) return
      try {
        await updateDocData('vehicle_orders', btn.dataset.id, { status: 'cancelled' })
        const found = orders.find(x => x.id === btn.dataset.id)
        if (found) found.status = 'cancelled'
        showToast('ยกเลิกแล้ว', 'success'); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    }))
  }

  function openDetail(o) {
    if (!o) return
    const st = STATUS[o.status] || { label: escHtml(o.status), badge: 'primary' }
    const total = (o.unitCost || 0) * (o.qty || 1)
    const nextSt = getNextStatus(o.status)
    openModal({
      title: '🛒 ' + escHtml(o.orderNo), size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="badge badge-${st.badge}" style="font-size:0.9rem">${st.label}</span>
            <span style="font-size:1.2rem;font-weight:700;color:var(--accent)">${formatCurrency(total)}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${dRow('🚗','ยี่ห้อ/รุ่น', escHtml(o.brand)+' '+escHtml(o.model)+' '+escHtml(o.variant||''))}
            ${dRow('🎨','สี', escHtml(o.color||'-'))}
            ${dRow('🔢','จำนวน',`${o.qty} คัน`)}
            ${dRow('💰','ต้นทุน/คัน',formatCurrency(o.unitCost))}
            ${dRow('🏭','Supplier', escHtml(o.supplier||'-'))}
            ${dRow('📅','วันรับคาด',formatDate(o.expectedDate))}
            ${dRow('🗓','วันที่สั่ง',formatDate(o.createdAt))}
          </div>
          ${o.notes ? `<div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-md);font-size:0.85rem">📝 ${escHtml(o.notes)}</div>` : ''}
          ${nextSt ? `<button class="btn btn-primary btn-sm" id="o-advance">→ ${STATUS[nextSt]?.label}</button>` : ''}
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-primary" id="o-edit-btn">✏️ แก้ไข</button>`
    })
    document.getElementById('o-edit-btn')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(o) })
    document.getElementById('o-advance')?.addEventListener('click', async () => {
      if (!nextSt) return
      try {
        await updateDocData('vehicle_orders', o.id, { status: nextSt })
        o.status = nextSt
        if (nextSt === 'arrived') {
          showToast('📦 รถถึงแล้ว! เพิ่มเข้าสต็อกและส่ง PDI', 'success')
          document.querySelector('.modal-overlay')?.remove()
          setTimeout(() => navigate('/dms/stock'), 600)
        } else {
          showToast(`เปลี่ยนสถานะเป็น ${STATUS[nextSt]?.label}`, 'success')
          document.querySelector('.modal-overlay')?.remove()
        }
        updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    })
  }

  function getNextStatus(s) {
    const flow = ['draft','ordered','confirmed','production','shipped','arrived']
    const i = flow.indexOf(s)
    return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขคำสั่งซื้อ' : '➕ สั่งรถใหม่', size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${isEdit ? '' : `<div class="input-group"><label class="input-label">เลขที่คำสั่ง</label><input class="input" id="of-no" value="ORD-2025-${String(orderCounter).padStart(3,'0')}" readonly style="color:var(--text-muted)"></div>`}
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ยี่ห้อ *</label><input class="input" id="of-brand" value="${escHtml(existing?.brand||'')}"></div>
            <div class="input-group"><label class="input-label">รุ่น *</label><input class="input" id="of-model" value="${escHtml(existing?.model||'')}"><span class="input-error" id="of-model-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">Variant</label><input class="input" id="of-variant" value="${escHtml(existing?.variant||'')}"></div>
            <div class="input-group"><label class="input-label">สี</label><input class="input" id="of-color" value="${escHtml(existing?.color||'')}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">จำนวน (คัน)</label><input class="input" type="number" id="of-qty" value="${existing?.qty||1}" min="1"></div>
            <div class="input-group"><label class="input-label">ต้นทุน/คัน (บาท)</label><input class="input" type="number" id="of-cost" value="${existing?.unitCost||''}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">Supplier</label><input class="input" id="of-sup" value="${escHtml(existing?.supplier||'')}"></div>
            <div class="input-group"><label class="input-label">วันรับคาด</label><input class="input" type="date" id="of-date" value="${escHtml(existing?.expectedDate||'')}"></div>
          </div>
          <div class="input-group"><label class="input-label">สถานะ</label>
            <select class="input" id="of-status">
              ${Object.entries(STATUS).map(([k,v]) => `<option value="${k}" ${existing?.status===k?'selected':''}>${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="of-notes" value="${escHtml(existing?.notes||'')}"></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="ofc">ยกเลิก</button><button class="btn btn-primary" id="ofs">💾 บันทึก</button>`
    })
    el.querySelector('#ofc').addEventListener('click', close)
    el.querySelector('#ofs').addEventListener('click', async () => {
      const model = el.querySelector('#of-model').value.trim()
      if (!model) { el.querySelector('#of-model-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#ofs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        orderNo: isEdit ? existing.orderNo : el.querySelector('#of-no')?.value || `ORD-2025-${String(orderCounter).padStart(3,'0')}`,
        brand: el.querySelector('#of-brand').value.trim(),
        model, variant: el.querySelector('#of-variant').value.trim(),
        color: el.querySelector('#of-color').value.trim(),
        qty: Number(el.querySelector('#of-qty').value) || 1,
        unitCost: Number(el.querySelector('#of-cost').value) || 0,
        supplier: el.querySelector('#of-sup').value.trim(),
        expectedDate: el.querySelector('#of-date').value,
        status: el.querySelector('#of-status').value,
        notes: el.querySelector('#of-notes').value.trim(),
        createdAt: existing?.createdAt || today,
      }
      try {
        if (isEdit) { await updateDocData('vehicle_orders', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('vehicle_orders', data); orders.unshift({ ...data, id }); orderCounter++ }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ สั่งรถแล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  // ── Page HTML ─────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🛒 คำสั่งซื้อรถ</div>
          <div style="display:flex;gap:12px;align-items:center">
            <span class="page-subtitle" id="order-total">กำลังโหลด...</span>
            <span style="font-size:0.8rem;color:var(--accent)" id="order-value"></span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="order-export-btn">📥 Export</button>
          <button class="btn btn-primary" id="add-order-btn">➕ สั่งรถใหม่</button>
        </div>
      </div>

      <!-- Status Pills -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${Object.entries(STATUS).map(([k,v]) => `
          <div class="card" style="padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span id="ostat-${k}" style="font-size:1.2rem;font-weight:700;color:var(--${v.badge})">0</span>
            <span style="font-size:0.78rem;color:var(--text-muted)">${v.label}</span>
          </div>
        `).join('')}
      </div>

      <!-- Filter -->
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <div style="position:relative;flex:1;min-width:180px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="order-search" placeholder="ค้นหา เลขที่ ยี่ห้อ Supplier..." style="padding-left:32px">
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="btn btn-sm sf-ord btn-primary" data-sf="all">ทั้งหมด</button>
            ${Object.entries(STATUS).map(([k,v]) => `<button class="btn btn-sm sf-ord btn-secondary" data-sf="${k}">${v.label}</button>`).join('')}
          </div>
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px" id="orders-filtered"></div>
      <div id="orders-content">
        ${[...Array(4)].map(() => `<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  document.getElementById('add-order-btn').addEventListener('click', () => openForm())
  document.getElementById('order-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.getElementById('order-export-btn').addEventListener('click', () => {
    exportToExcel(orders.map(o => ({ เลขที่:o.orderNo, ยี่ห้อ:o.brand, รุ่น:o.model, สี:o.color, จำนวน:o.qty, ต้นทุน:o.unitCost, มูลค่ารวม:(o.unitCost||0)*(o.qty||1), สถานะ:STATUS[o.status]?.label||o.status, วันรับคาด:formatDate(o.expectedDate), Supplier:o.supplier })), `orders-${new Date().toISOString().slice(0,10)}.xlsx`, 'คำสั่งซื้อ')
    showToast('Export แล้ว', 'success')
  })
  document.querySelectorAll('.sf-ord').forEach(btn => btn.addEventListener('click', () => {
    statusFilter = btn.dataset.sf
    document.querySelectorAll('.sf-ord').forEach(b => b.className = `btn btn-sm sf-ord ${b.dataset.sf === statusFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))

  if (container.__routerGen === myGen) await loadData()
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${value}</span></div>`
}
