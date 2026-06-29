/**
 * Purchase Order — ใบสั่งซื้อ
 * Route: /finance/po
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

const PO_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary' },
  pending:   { label: 'รออนุมัติ', color: 'warning' },
  approved:  { label: 'อนุมัติแล้ว', color: 'primary' },
  ordered:   { label: 'สั่งแล้ว', color: 'primary' },
  received:  { label: 'รับแล้ว', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'danger' },
}

const PO_CATS = {
  vehicle: { label: 'รถยนต์', icon: '🚗' },
  parts:   { label: 'อะไหล่', icon: '🔩' },
  supplies:{ label: 'อุปกรณ์', icon: '📦' },
  service: { label: 'บริการ', icon: '🔧' },
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const DEMO_POS = [
  { id: 'PO001', title: 'สั่งรถ BYD Atto 3 จำนวน 5 คัน', cat: 'vehicle', supplier: 'BYD Thailand', amount: 5495000, status: 'approved', requestDate: addHours(48), approvedBy: 'สมชาย ผจก.', expectedDate: addDays(14) },
  { id: 'PO002', title: 'อะไหล่ชุดเบรก MG 20 ชุด', cat: 'parts', supplier: 'MG Parts Thailand', amount: 85000, status: 'received', requestDate: addHours(120), approvedBy: 'สมชาย ผจก.', expectedDate: addDays(-3) },
  { id: 'PO003', title: 'น้ำมันเครื่อง Shell 5W-30 x 50 ถัง', cat: 'supplies', supplier: 'Shell Thailand', amount: 48500, status: 'pending', requestDate: addHours(8), approvedBy: null, expectedDate: addDays(7) },
  { id: 'PO004', title: 'สั่งรถ BYD Dolphin 3 คัน', cat: 'vehicle', supplier: 'BYD Thailand', amount: 2097000, status: 'ordered', requestDate: addHours(72), approvedBy: 'สมชาย ผจก.', expectedDate: addDays(21) },
  { id: 'PO005', title: 'ซ่อม Lift ช่าง 2 ตัว', cat: 'service', supplier: 'TA Tech', amount: 32000, status: 'draft', requestDate: addHours(2), approvedBy: null, expectedDate: addDays(5) },
]

export default async function PurchaseOrderPage(container) {
  const myGen = container.__routerGen
  let orders = DEMO_POS.map(o => ({ ...o }))
  let dataSource = 'demo'
  let statusFilter = 'all'

  try {
    const docs = await listDocs('purchase_orders', [], 'requestDate', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `PO${String(i+1).padStart(3,'0')}`,
        title: d.title || d.description || d.name || 'ใบสั่งซื้อ',
        cat: d.cat || d.category || 'supplies',
        supplier: d.supplier || d.supplierName || '',
        amount: d.amount || d.totalAmount || 0,
        status: d.status || 'pending',
        requestDate: d.requestDate || d.createdAt || new Date().toISOString(),
        approvedBy: d.approvedBy || null,
        expectedDate: d.expectedDate || d.dueDate || '',
      }))
      orders = [...mapped, ...DEMO_POS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = orders.filter(o => statusFilter === 'all' || o.status === statusFilter)
    const pending = orders.filter(o => o.status === 'pending').length
    const totalAmount = orders.filter(o => !['cancelled'].includes(o.status)).reduce((a, o) => a + o.amount, 0)
    const pendingAmount = orders.filter(o => o.status === 'pending').reduce((a, o) => a + o.amount, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Purchase Orders</div>
            <div class="page-subtitle">ใบสั่งซื้อ — อนุมัติและติดตาม${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-po-btn">+ สร้าง PO</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 PO ทั้งหมด', orders.length, 'primary')}
          ${kpi('⏳ รออนุมัติ', pending + ' (' + formatCurrency(pendingAmount) + ')', pending > 0 ? 'warning' : 'secondary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalAmount), 'success')}
          ${kpi('🚚 กำลังจัดส่ง', orders.filter(o=>o.status==='ordered').length, 'primary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(PO_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(o => {
            const st = PO_STATUS[o.status]
            const cat = PO_CATS[o.cat]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${st?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div style="flex:1">
                  <div style="display:flex;gap:8px;align-items:center">
                    <span style="font-size:1.1rem">${cat?.icon}</span>
                    <div>
                      <div style="font-weight:600;font-size:0.87rem">${escHtml(o.title)}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(o.id)} · ${escHtml(o.supplier)} · ${timeAgo(o.requestDate)}</div>
                    </div>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span style="font-weight:800;font-size:1rem;color:var(--${st?.color})">${formatCurrency(o.amount)}</span>
                  <span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span>
                </div>
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">
                📅 Expected: ${formatDate(o.expectedDate)}
                ${o.approvedBy ? ` · ✓ ${escHtml(o.approvedBy)}` : ''}
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-secondary view-btn" data-id="${o.id}">รายละเอียด</button>
                ${o.status === 'pending' ? `<button class="btn btn-xs btn-success approve-btn" data-id="${o.id}">✓ อนุมัติ</button>` : ''}
                ${o.status === 'pending' ? `<button class="btn btn-xs btn-danger reject-btn" data-id="${o.id}">✗ ยกเลิก</button>` : ''}
                ${o.status === 'approved' ? `<button class="btn btn-xs btn-primary order-btn" data-id="${o.id}">📤 สั่งซื้อ</button>` : ''}
                ${o.status === 'ordered' ? `<button class="btn btn-xs btn-success receive-btn" data-id="${o.id}">📦 รับแล้ว</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-po-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const o = orders.find(x => x.id === b.dataset.id); if (o) openDetail(o)
    }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => {
      const o = orders.find(x => x.id === b.dataset.id)
      if (o) { o.status = 'approved'; o.approvedBy = 'ผู้จัดการ'; showToast(`✅ อนุมัติ ${o.id} แล้ว`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => {
      const o = orders.find(x => x.id === b.dataset.id)
      if (o) { o.status = 'cancelled'; showToast(`❌ ยกเลิก ${o.id}`, 'warning'); renderPage() }
    }))
    container.querySelectorAll('.order-btn').forEach(b => b.addEventListener('click', () => {
      const o = orders.find(x => x.id === b.dataset.id)
      if (o) { o.status = 'ordered'; showToast(`📤 สั่งซื้อ ${o.id} แล้ว`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.receive-btn').forEach(b => b.addEventListener('click', () => {
      const o = orders.find(x => x.id === b.dataset.id)
      if (o) { o.status = 'received'; showToast(`📦 รับสินค้า ${o.id} แล้ว`, 'success'); renderPage() }
    }))
  }

  function openDetail(o) {
    const st = PO_STATUS[o.status]
    const cat = PO_CATS[o.cat]
    openModal({
      title: `📋 ${o.id}`,
      size: 'sm',
      body: `
        <div style="display:flex;gap:6px;margin-bottom:12px">
          <span class="badge badge-${st?.color}">${st?.label}</span>
          <span class="badge badge-secondary">${cat?.icon} ${cat?.label}</span>
        </div>
        <div style="font-weight:700;margin-bottom:10px">${escHtml(o.title)}</div>
        ${row('ผู้จัดหา', escHtml(o.supplier))}
        ${row('มูลค่า', formatCurrency(o.amount))}
        ${row('วันที่ขอ', timeAgo(o.requestDate))}
        ${row('Expected', formatDate(o.expectedDate))}
        ${o.approvedBy ? row('อนุมัติโดย', escHtml(o.approvedBy)) : ''}
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ สร้าง PO ใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">รายการสินค้า/บริการ *</label><input class="input" id="po-title"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="po-cat">${Object.entries(PO_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ผู้จัดหา *</label><input class="input" id="po-supplier"></div>
          <div class="input-group"><label class="input-label">มูลค่า (บาท) *</label><input type="number" class="input" id="po-amount"></div>
          <div class="input-group"><label class="input-label">กำหนดรับ</label><input type="date" class="input" id="po-date" value="${addDays(14)}"></div>
        </div>
      `,
      onConfirm() {
        const title = document.getElementById('po-title')?.value?.trim()
        const supplier = document.getElementById('po-supplier')?.value?.trim()
        const amount = +document.getElementById('po-amount')?.value || 0
        if (!title || !supplier) { showToast('❗ กรุณากรอกข้อมูล', 'error'); return }
        orders.unshift({
          id: `PO${String(orders.length+1).padStart(3,'0')}`, title,
          cat: document.getElementById('po-cat')?.value||'supplies', supplier, amount,
          status: 'pending', requestDate: new Date().toISOString(), approvedBy: null,
          expectedDate: document.getElementById('po-date')?.value||addDays(14)
        })
        showToast('✅ สร้าง PO แล้ว!', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
