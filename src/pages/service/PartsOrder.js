import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

// ป้องกัน XSS — หมายเหตุ (notes) เป็นข้อความที่ผู้ใช้พิมพ์เอง ต้อง escape ก่อนแสดงผลเสมอ
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const PO_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary' },
  pending:   { label: 'รออนุมัติ', color: 'warning' },
  approved:  { label: 'อนุมัติแล้ว', color: 'primary' },
  ordered:   { label: 'สั่งซื้อแล้ว', color: 'primary' },
  partial:   { label: 'รับบางส่วน', color: 'warning' },
  received:  { label: 'รับครบแล้ว', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'danger' },
}

const PARTS_CATEGORIES = { brake: 'เบรก', filter: 'กรอง', coolant: 'ระบายความร้อน', ev: 'EV System', tyre: 'ยาง', body: 'ตัวถัง', electric: 'ไฟฟ้า', consumable: 'สิ้นเปลือง' }

const SUPPLIERS = ['BYD Parts Thailand', 'Thai Auto Parts', 'MG Parts Center', 'EV Supply Co.', 'อะไหล่ไทยเซ็นทรัล']

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function PartsOrderPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let statusFilter = 'all'
  let orders = []
  let loading = true

  async function loadData() {
    loading = true
    try { orders = await listDocs('parts_orders', [], 'createdDate', 'desc', 500) } catch (e) { orders = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function filtered() {
    return orders.filter(o => statusFilter === 'all' || o.status === statusFilter)
      .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
  }

  const today = new Date().toISOString().slice(0, 10)

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = filtered()
    const pending = orders.filter(o => o.status === 'pending').length
    const ordered = orders.filter(o => o.status === 'ordered' || o.status === 'partial').length
    const totalValue = orders.reduce((a, o) => a + o.total, 0)
    const overdue = orders.filter(o => ['ordered','partial'].includes(o.status) && o.expectedDate < today).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔩 สั่งอะไหล่</div>
            <div class="page-subtitle">Parts Order — สั่งซื้ออะไหล่จากซัพพลายเออร์</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-po-btn">+ สร้าง PO</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⏳ รออนุมัติ', pending, 'warning')}
          ${kpi('🚚 รอรับสินค้า', ordered, 'primary')}
          ${kpi('❗ เกินกำหนด', overdue, overdue > 0 ? 'danger' : 'secondary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalValue), 'success')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(PO_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>PO</th><th>ซัพพลายเออร์</th><th>วันที่สร้าง</th><th>กำหนดรับ</th><th>รายการ</th><th>มูลค่า</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${list.map(o => {
                const st = PO_STATUS[o.status]
                const isOverdue = ['ordered','partial'].includes(o.status) && o.expectedDate < today
                return `<tr>
                  <td style="font-family:monospace;font-weight:700;font-size:0.82rem">${o.id}</td>
                  <td style="font-size:0.85rem">${o.supplier}</td>
                  <td style="font-size:0.82rem">${formatDate(o.createdDate)}</td>
                  <td>
                    <div style="font-size:0.82rem;color:${isOverdue?'var(--danger)':'inherit'}">${o.expectedDate ? formatDate(o.expectedDate) : '-'}</div>
                    ${isOverdue ? '<div style="font-size:0.7rem;color:var(--danger)">❗ เกินกำหนด</div>' : ''}
                  </td>
                  <td style="font-size:0.82rem">${o.items.length} รายการ</td>
                  <td class="text-right" style="font-size:0.83rem;font-weight:700">${formatCurrency(o.total)}</td>
                  <td><span class="badge badge-${st?.color}">${st?.label}</span></td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-xs btn-secondary open-po-btn" data-id="${o.id}">ดู</button>
                      ${o.status === 'pending' ? `<button class="btn btn-xs btn-primary approve-po-btn" data-id="${o.id}">✓ อนุมัติ</button>` : ''}
                      ${o.status === 'approved' ? `<button class="btn btn-xs btn-primary order-po-btn" data-id="${o.id}">📋 สั่งซื้อ</button>` : ''}
                      ${['ordered','partial'].includes(o.status) ? `<button class="btn btn-xs btn-success receive-po-btn" data-id="${o.id}">📦 รับสินค้า</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('')}
              ${!list.length ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบรายการ</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-po-btn')?.addEventListener('click', openPOForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(orders.map(o => ({ PO: o.id, ซัพพลายเออร์: o.supplier, สถานะ: PO_STATUS[o.status]?.label, มูลค่า: o.total, วันที่: o.createdDate })), 'parts_orders')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-po-btn').forEach(b => b.addEventListener('click', () => {
      const o = orders.find(x => x.id === b.dataset.id); if (o) openPODetail(o)
    }))
    container.querySelectorAll('.approve-po-btn').forEach(b => b.addEventListener('click', async () => {
      const o = orders.find(x => x.id === b.dataset.id)
      if (!o) return
      try {
        await updateDocData('parts_orders', o.id, { status: 'approved' })
        showToast(`✅ อนุมัติ ${o.id} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.order-po-btn').forEach(b => b.addEventListener('click', async () => {
      const o = orders.find(x => x.id === b.dataset.id)
      if (!o) return
      try {
        await updateDocData('parts_orders', o.id, { status: 'ordered', orderDate: today })
        showToast(`📋 ส่งคำสั่งซื้อ ${o.id} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.receive-po-btn').forEach(b => b.addEventListener('click', () => {
      const o = orders.find(x => x.id === b.dataset.id); if (o) openReceiveModal(o)
    }))
  }

  function openPODetail(o) {
    const st = PO_STATUS[o.status]
    openModal({
      title: `🔩 ${o.id} — ${o.supplier}`,
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            ${row('ซัพพลายเออร์', o.supplier)}${row('สร้างโดย', o.createdBy)}${row('วันที่สร้าง', formatDate(o.createdDate))}
            ${row('วันที่สั่ง', o.orderDate ? formatDate(o.orderDate) : '-')}${row('กำหนดรับ', o.expectedDate ? formatDate(o.expectedDate) : '-')}
            ${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}
          </div>
          <div>
            ${row('มูลค่ารวม', `<strong style="color:var(--success)">${formatCurrency(o.total)}</strong>`)}
            ${o.notes ? `<div style="margin-top:8px;padding:8px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.8rem">📌 ${esc(o.notes)}</div>` : ''}
          </div>
        </div>
        <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px">รายการอะไหล่</div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>Part No.</th><th>รายการ</th><th>หมวด</th><th class="text-right">จำนวน</th><th class="text-right">ราคา/หน่วย</th><th class="text-right">รวม</th><th class="text-right">รับแล้ว</th></tr></thead>
            <tbody>
              ${o.items.map(i => `<tr>
                <td style="font-family:monospace;font-size:0.78rem">${i.partNo}</td>
                <td style="font-size:0.83rem">${i.name}</td>
                <td><span class="badge badge-secondary" style="font-size:0.65rem">${PARTS_CATEGORIES[i.cat]||i.cat}</span></td>
                <td class="text-right">${i.qty} ${i.unit}</td>
                <td class="text-right">${formatCurrency(i.unitCost)}</td>
                <td class="text-right" style="font-weight:700">${formatCurrency(i.qty * i.unitCost)}</td>
                <td class="text-right" style="color:${i.received>=i.qty?'var(--success)':i.received>0?'var(--warning)':'var(--text-muted)'}">${i.received}/${i.qty}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-2)">
                <td colspan="5" style="font-weight:800;padding:8px 12px">รวมทั้งหมด</td>
                <td class="text-right" style="font-weight:800;color:var(--success)">${formatCurrency(o.total)}</td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `,
      footer: ['ordered','partial'].includes(o.status) ? `<button class="btn btn-success receive-modal-btn">📦 รับสินค้า</button>` : o.status === 'pending' ? `<button class="btn btn-primary approve-modal-btn">✓ อนุมัติ</button>` : ''
    })
    setTimeout(() => {
      document.querySelector('.modal .receive-modal-btn')?.addEventListener('click', () => {
        document.querySelector('.modal-close-btn')?.click()
        openReceiveModal(o)
      })
      document.querySelector('.modal .approve-modal-btn')?.addEventListener('click', async () => {
        document.querySelector('.modal-close-btn')?.click()
        try {
          await updateDocData('parts_orders', o.id, { status: 'approved' })
          showToast(`✅ อนุมัติ ${o.id} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    }, 50)
  }

  function openReceiveModal(o) {
    openModal({
      title: `📦 รับสินค้า — ${o.id}`,
      size: 'md',
      body: `
        <div style="margin-bottom:12px;font-size:0.83rem;color:var(--text-muted)">กรอกจำนวนที่รับจริงสำหรับแต่ละรายการ</div>
        ${o.items.map((i, idx) => `
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1;font-size:0.83rem">${i.name}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">สั่ง ${i.qty} ${i.unit}</div>
            <input type="number" class="input recv-qty" data-idx="${idx}" value="${i.qty - i.received}" min="0" max="${i.qty - i.received}" style="width:80px;text-align:center">
          </div>
        `).join('')}
      `,
      confirmText: '✅ ยืนยันรับสินค้า',
      async onConfirm() {
        const items = o.items.map(i => ({ ...i }))
        document.querySelectorAll('.modal .recv-qty').forEach(inp => {
          const idx = +inp.dataset.idx
          const qty = +inp.value || 0
          if (items[idx]) items[idx].received = Math.min(items[idx].received + qty, items[idx].qty)
        })
        const allReceived = items.every(i => i.received >= i.qty)
        const anyReceived = items.some(i => i.received > 0)
        const status = allReceived ? 'received' : anyReceived ? 'partial' : o.status
        try {
          await updateDocData('parts_orders', o.id, { items, status, receivedDate: allReceived ? today : (o.receivedDate || null) })
          showToast(allReceived ? `✅ รับสินค้า ${o.id} ครบแล้ว!` : `📦 รับสินค้าบางส่วน ${o.id}`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openPOForm() {
    let lineCount = 1
    openModal({
      title: '+ สร้าง Purchase Order ใหม่',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="input-group" style="grid-column:1/-1">
            <label class="input-label">ซัพพลายเออร์ *</label>
            <select class="input" id="pof-supplier">
              ${SUPPLIERS.map(s => `<option>${s}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">กำหนดรับสินค้า</label><input type="date" class="input" id="pof-expected" value="${addDays(7)}"></div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="pof-notes" placeholder="บันทึกเพิ่มเติม..."></div>
        </div>
        <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">รายการอะไหล่</div>
        <div id="po-lines">
          <div style="display:grid;grid-template-columns:2fr 1fr 80px 100px;gap:6px;margin-bottom:6px">
            <input class="input po-name" placeholder="ชื่ออะไหล่ *">
            <select class="input po-cat">${Object.entries(PARTS_CATEGORIES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
            <input type="number" class="input po-qty" placeholder="จำนวน" min="1" value="1">
            <input type="number" class="input po-price" placeholder="ราคา/หน่วย">
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" id="add-line-btn" style="margin-top:6px">+ เพิ่มรายการ</button>
      `,
      async onConfirm() {
        const supplier = document.getElementById('pof-supplier')?.value
        if (!supplier) { showToast('❗ กรุณาเลือกซัพพลายเออร์', 'error'); return false }
        const names = [...document.querySelectorAll('.modal .po-name')].map(i => i.value.trim())
        const cats = [...document.querySelectorAll('.modal .po-cat')].map(i => i.value)
        const qtys = [...document.querySelectorAll('.modal .po-qty')].map(i => +i.value || 1)
        const prices = [...document.querySelectorAll('.modal .po-price')].map(i => +i.value || 0)
        const items = names.map((n, idx) => ({ partNo: `NEW-${idx+1}`, name: n || `อะไหล่ ${idx+1}`, cat: cats[idx], qty: qtys[idx], unit: 'ชิ้น', unitCost: prices[idx], received: 0 })).filter(i => i.name)
        const total = items.reduce((a, i) => a + i.qty * i.unitCost, 0)
        try {
          await createDoc('parts_orders', {
            supplier,
            status: 'pending', createdDate: today, orderDate: null,
            expectedDate: document.getElementById('pof-expected')?.value || addDays(7),
            receivedDate: null, total, notes: document.getElementById('pof-notes')?.value || '',
            createdBy: 'พนักงาน', items
          })
          showToast('✅ สร้าง PO แล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      document.getElementById('add-line-btn')?.addEventListener('click', () => {
        const line = document.createElement('div')
        line.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 80px 100px;gap:6px;margin-bottom:6px'
        line.innerHTML = `<input class="input po-name" placeholder="ชื่ออะไหล่ *"><select class="input po-cat">${Object.entries(PARTS_CATEGORIES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select><input type="number" class="input po-qty" placeholder="จำนวน" min="1" value="1"><input type="number" class="input po-price" placeholder="ราคา/หน่วย">`
        document.getElementById('po-lines')?.appendChild(line)
      })
    }, 50)
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
