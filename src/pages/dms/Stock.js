import { listDocs, createDoc, updateDocData, softDelete, seedDemoData, getSalesData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getBranches } from '../../data/masterData.js'
import { pickVehicle } from '../../utils/vehiclePicker.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS = {
  available:  { label: '✅ พร้อมขาย',   badge: 'success' },
  reserved:   { label: '📝 จองแล้ว',    badge: 'warning' },
  sold:        { label: '🏁 ขายแล้ว',   badge: 'primary' },
  transit:    { label: '🚢 อยู่ระหว่างขนส่ง', badge: 'accent' },
  pdi:        { label: '🔧 อยู่ใน PDI', badge: 'warning' },
  demo:       { label: '🚗 รถทดลองขับ', badge: 'primary' },
}

const BRANDS = ['BYD','MG','NETA','DEEPAL','CHANGAN','GWM','CHERY','ZEEKR','AION','ORA']

const DEMO_STOCK = [
  { id:'v1', brand:'BYD', model:'Seal', variant:'AWD', color:'ขาว Pearl', vin:'LGXCE4C10PA000001', year:2025, price:1299000, cost:1150000, status:'available', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-03-01', notes:'' },
  { id:'v2', brand:'BYD', model:'Atto 3', variant:'Extended Range', color:'น้ำเงิน', vin:'LGXCE4C10PA000002', year:2025, price:1099000, cost:970000, status:'reserved', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-02-15', notes:'จอง-วิชัย สุขใจ' },
  { id:'v3', brand:'MG', model:'MG4', variant:'X-Power', color:'แดง Dragon', vin:'SDUZZZEF5PA000003', year:2025, price:949000, cost:840000, status:'available', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-03-10', notes:'' },
  { id:'v4', brand:'DEEPAL', model:'S7', variant:'Pro', color:'ดำ Obsidian', vin:'LZEZ1EBA0PA000004', year:2025, price:1479000, cost:1320000, status:'pdi', mileage:0, location:'ห้อง PDI', arrivedAt:'2025-04-01', notes:'PDI เสร็จ 5 เม.ย.' },
  { id:'v5', brand:'NETA', model:'V II', variant:'Pro 400', color:'ขาว', vin:'LNBSCCAD0PA000005', year:2025, price:769000, cost:680000, status:'available', mileage:0, location:'โชว์รูมสาขา 2', arrivedAt:'2025-03-20', notes:'' },
  { id:'v6', brand:'BYD', model:'Seal', variant:'RWD', color:'เทา Ink', vin:'LGXCE4C10PA000006', year:2025, price:1199000, cost:1060000, status:'demo', mileage:3520, location:'โชว์รูมหลัก', arrivedAt:'2025-01-10', notes:'รถทดลองขับ' },
  { id:'v7', brand:'MG', model:'MG4', variant:'X', color:'ขาว', vin:'SDUZZZEF5PA000007', year:2024, price:869000, cost:760000, status:'sold', mileage:0, location:'-', arrivedAt:'2024-11-01', notes:'ขายแล้ว 15 ม.ค. 68' },
]

export default async function StockPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let stock = []
  let bookingByVin = {}
  let filtered = []
  let statusFilter = 'all'
  let brandFilter = 'all'
  let search = ''
  let viewMode = 'table' // table | card

  async function loadData() {
    try { stock = await listDocs('vehicles', [], 'arrivedAt', 'desc', 500) } catch {}
    if (!stock.length) DEMO_STOCK.forEach(v => stock.push({ ...v }))
    // ลิงก์ใบจอง (แหล่งกลาง): จับคู่ตาม VIN → แสดงสถานะจอง/ลูกค้าบนรถในสต็อก
    try {
      const sales = await getSalesData()
      bookingByVin = {}
      sales.forEach(s => { if (s.plate) bookingByVin[s.plate] = s })
    } catch (e) {}
    updateStats(); applyFilter()
  }

  function updateStats() {
    const counts = {}
    Object.keys(STATUS).forEach(k => counts[k] = stock.filter(v => v.status === k).length)
    Object.keys(STATUS).forEach(k => {
      const el = document.getElementById(`vstat-${k}`)
      if (el) el.textContent = counts[k]
    })
    const totalEl = document.getElementById('stock-total')
    if (totalEl) totalEl.textContent = `${stock.length} คัน`

    // Value stats
    const availableValue = stock.filter(v => v.status === 'available').reduce((s, v) => s + (v.cost || 0), 0)
    const el = document.getElementById('stock-value')
    if (el) el.textContent = `มูลค่าสต็อก: ${formatCurrency(availableValue)}`
  }

  function applyFilter() {
    filtered = stock.filter(v => {
      const ms = statusFilter === 'all' || v.status === statusFilter
      const bs = brandFilter === 'all' || v.brand === brandFilter
      const ss = !search || `${v.brand} ${v.model} ${v.color} ${v.vin}`.toLowerCase().includes(search)
      return ms && bs && ss
    })
    renderContent()
  }

  function renderContent() {
    const wrap = document.getElementById('stock-content')
    if (!wrap) return
    const countEl = document.getElementById('stock-filtered')
    if (countEl) countEl.textContent = `แสดง ${filtered.length} คัน`

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">🚗</div><div class="empty-title">ไม่พบรถ</div><div class="empty-desc">ลองเปลี่ยนตัวกรอง</div></div>`
      return
    }

    if (viewMode === 'card') {
      wrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
        ${filtered.map(v => cardView(v)).join('')}
      </div>`
    } else {
      wrap.innerHTML = `<div class="table-wrap">
        <table>
          <thead><tr>
            <th>ยี่ห้อ/รุ่น</th><th>สี</th><th>VIN</th><th>ปี</th>
            <th>ราคา</th><th>กำไร</th><th>สถานะ</th><th>ที่ตั้ง</th><th>รับมา</th><th></th>
          </tr></thead>
          <tbody>${filtered.map(v => tableRow(v)).join('')}</tbody>
        </table>
      </div>`
    }

    bindEvents()
  }

  function tableRow(v) {
    const st = STATUS[v.status] || { label: v.status, badge: 'primary' }
    const margin = (v.price || 0) - (v.cost || 0)
    return `
      <tr class="stock-row" data-id="${v.id}" style="cursor:pointer">
        <td>
          <div style="font-weight:600">${escHtml(v.brand)} ${escHtml(v.model)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(v.variant || '')}</div>
        </td>
        <td><div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:50%;background:${colorDot(v.color)};border:1px solid var(--border)"></div>${escHtml(v.color)}</div></td>
        <td style="font-size:0.75rem;color:var(--text-muted);font-family:monospace">${escHtml(v.vin || '-')}</td>
        <td style="text-align:center">${v.year || '-'}</td>
        <td style="color:var(--accent);font-weight:600">${formatCurrency(v.price)}</td>
        <td style="color:${margin > 0 ? 'var(--success)' : 'var(--danger)'};font-size:0.85rem">${margin > 0 ? '+' : ''}${formatCurrency(margin)}</td>
        <td><span class="badge badge-${st.badge}">${st.label}</span>${(v.vin && bookingByVin[v.vin]) ? `<div style="font-size:0.66rem;color:var(--warning);margin-top:2px" title="${escHtml(bookingByVin[v.vin].custName)}">🔗 จอง: ${escHtml(bookingByVin[v.vin].status)}</div>` : ''}</td>
        <td style="font-size:0.8rem;color:var(--text-2)">${escHtml(v.location || '-')}</td>
        <td style="font-size:0.78rem;color:var(--text-muted)">${formatDate(v.arrivedAt)}</td>
        <td>
          <div style="display:flex;gap:3px">
            <button class="btn btn-ghost btn-sm edit-v" data-id="${v.id}" title="แก้ไข">✏️</button>
            <button class="btn btn-ghost btn-sm del-v" data-id="${v.id}" title="ลบ" style="color:var(--danger)">🗑</button>
          </div>
        </td>
      </tr>`
  }

  function cardView(v) {
    const st = STATUS[v.status] || { label: v.status, badge: 'primary' }
    const margin = (v.price || 0) - (v.cost || 0)
    return `
      <div class="card card-lift stock-row" data-id="${v.id}" style="cursor:pointer;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:1rem">${escHtml(v.brand)} ${escHtml(v.model)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(v.variant || '')} · ${v.year}</div>
          </div>
          <span class="badge badge-${st.badge}">${st.label}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <div style="width:14px;height:14px;border-radius:50%;background:${colorDot(v.color)};border:1px solid var(--border);flex-shrink:0"></div>
          <span style="font-size:0.85rem;color:var(--text-2)">${escHtml(v.color)}</span>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-family:monospace;margin-bottom:10px">${escHtml(v.vin || '-')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--accent)">${formatCurrency(v.price)}</div>
            <div style="font-size:0.75rem;color:${margin > 0 ? 'var(--success)' : 'var(--danger)'}">กำไร ${margin > 0 ? '+' : ''}${formatCurrency(margin)}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm edit-v" data-id="${v.id}">✏️</button>
            <button class="btn btn-ghost btn-sm del-v" data-id="${v.id}" style="color:var(--danger)">🗑</button>
          </div>
        </div>
      </div>`
  }

  function bindEvents() {
    document.querySelectorAll('.stock-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.edit-v,.del-v')) return
        openDetail(stock.find(x => x.id === row.dataset.id))
      })
    })
    document.querySelectorAll('.edit-v').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openForm(stock.find(x => x.id === btn.dataset.id))
    }))
    document.querySelectorAll('.del-v').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const v = stock.find(x => x.id === btn.dataset.id)
      if (!await confirmDialog({ title:'ลบรถ', message:`ลบ ${v?.brand} ${v?.model} สี${v?.color}?`, confirmText:'ลบ', danger:true })) return
      try {
        await softDelete('vehicles', btn.dataset.id)
        stock = stock.filter(x => x.id !== btn.dataset.id)
        showToast('ลบแล้ว', 'success'); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    }))
  }

  function openDetail(v) {
    if (!v) return
    const st = STATUS[v.status] || { label: v.status, badge: 'primary' }
    const margin = (v.price || 0) - (v.cost || 0)
    openModal({
      title: '🚗 ' + escHtml(v.brand) + ' ' + escHtml(v.model) + ' — ' + escHtml(v.color),
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="badge badge-${st.badge}" style="font-size:0.9rem">${escHtml(st.label)}</span>
            <span style="font-size:1.2rem;font-weight:700;color:var(--accent)">${formatCurrency(v.price)}</span>
          </div>
          <div class="grid-2" style="gap:8px">
            ${dRow('🚗','ยี่ห้อ/รุ่น', escHtml(`${v.brand} ${v.model} ${v.variant||''}`))}
            ${dRow('🎨','สี', escHtml(v.color))}
            ${dRow('🔢','VIN', escHtml(v.vin||'-'))}
            ${dRow('📅','ปีรถ',v.year||'-')}
            ${dRow('💰','ราคาขาย',formatCurrency(v.price))}
            ${dRow('📦','ต้นทุน',formatCurrency(v.cost))}
            ${dRow('📊','กำไร',`<span style="color:${margin>0?'var(--success)':'var(--danger)'}">${margin>0?'+':''}${formatCurrency(margin)}</span>`)}
            ${dRow('📍','ที่ตั้ง', escHtml(v.location||'-'))}
            ${dRow('🗓','รับมาเมื่อ',formatDate(v.arrivedAt))}
            ${v.mileage ? dRow('🛣','เลขไมล์',`${v.mileage.toLocaleString()} km`) : ''}
          </div>
          ${v.notes ? `<div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-md);font-size:0.85rem">📝 ${escHtml(v.notes)}</div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="v-reserve" ${v.status !== 'available' ? 'disabled' : ''}>📝 จอง</button>
            <button class="btn btn-secondary btn-sm" id="v-status">🔄 เปลี่ยนสถานะ</button>
            <button class="btn btn-ghost btn-sm" id="v-qr">🔗 QR Code</button>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-primary" id="v-edit-btn">✏️ แก้ไข</button>`
    })
    document.getElementById('v-edit-btn')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(v) })
    document.getElementById('v-reserve')?.addEventListener('click', async () => {
      try {
        await updateDocData('vehicles', v.id, { status: 'reserved' })
        v.status = 'reserved'; showToast('เปลี่ยนสถานะเป็น จองแล้ว', 'success')
        document.querySelector('.modal-overlay')?.remove(); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    })
    document.getElementById('v-status')?.addEventListener('click', () => openStatusModal(v))
    document.getElementById('v-qr')?.addEventListener('click', () => {
      openModal({
        title: '🔗 QR Code — ' + escHtml(v.brand) + ' ' + escHtml(v.model),
        size: 'sm',
        body: `
          <div style="text-align:center;padding:4px">
            <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px;display:inline-block;margin-bottom:12px">
              <svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="49" height="49" fill="#111" rx="2"/>
                <rect x="12" y="12" width="35" height="35" fill="#fff"/>
                <rect x="19" y="19" width="21" height="21" fill="#111"/>
                <rect x="96" y="5" width="49" height="49" fill="#111" rx="2"/>
                <rect x="103" y="12" width="35" height="35" fill="#fff"/>
                <rect x="110" y="19" width="21" height="21" fill="#111"/>
                <rect x="5" y="96" width="49" height="49" fill="#111" rx="2"/>
                <rect x="12" y="103" width="35" height="35" fill="#fff"/>
                <rect x="19" y="110" width="21" height="21" fill="#111"/>
                <rect x="60" y="5" width="8" height="8" fill="#111"/><rect x="76" y="5" width="8" height="8" fill="#111"/>
                <rect x="68" y="13" width="8" height="8" fill="#111"/><rect x="84" y="13" width="8" height="8" fill="#111"/>
                <rect x="60" y="21" width="8" height="8" fill="#111"/><rect x="76" y="21" width="8" height="8" fill="#111"/>
                <rect x="5" y="60" width="8" height="8" fill="#111"/><rect x="21" y="60" width="8" height="8" fill="#111"/>
                <rect x="37" y="68" width="8" height="8" fill="#111"/><rect x="5" y="76" width="8" height="8" fill="#111"/>
                <rect x="29" y="76" width="8" height="8" fill="#111"/><rect x="13" y="84" width="8" height="8" fill="#111"/>
                <rect x="60" y="60" width="8" height="8" fill="#111"/><rect x="76" y="68" width="8" height="8" fill="#111"/>
                <rect x="68" y="76" width="8" height="8" fill="#111"/><rect x="84" y="60" width="8" height="8" fill="#111"/>
                <rect x="60" y="84" width="8" height="8" fill="#111"/><rect x="76" y="84" width="8" height="8" fill="#111"/>
                <rect x="96" y="60" width="8" height="8" fill="#111"/><rect x="112" y="68" width="8" height="8" fill="#111"/>
                <rect x="128" y="60" width="8" height="8" fill="#111"/><rect x="120" y="76" width="8" height="8" fill="#111"/>
                <rect x="96" y="84" width="8" height="8" fill="#111"/><rect x="112" y="84" width="8" height="8" fill="#111"/>
                <rect x="60" y="96" width="8" height="8" fill="#111"/><rect x="76" y="104" width="8" height="8" fill="#111"/>
                <rect x="68" y="112" width="8" height="8" fill="#111"/><rect x="84" y="120" width="8" height="8" fill="#111"/>
                <rect x="60" y="128" width="8" height="8" fill="#111"/><rect x="84" y="104" width="8" height="8" fill="#111"/>
                <rect x="96" y="96" width="8" height="8" fill="#111"/><rect x="128" y="104" width="8" height="8" fill="#111"/>
                <rect x="112" y="112" width="8" height="8" fill="#111"/><rect x="128" y="128" width="8" height="8" fill="#111"/>
              </svg>
            </div>
            <div style="font-family:monospace;font-size:0.63rem;color:var(--text-muted);word-break:break-all;margin-bottom:12px;padding:0 4px">${escHtml(v.vin)}</div>
            <div style="background:var(--surface-2);border-radius:8px;padding:10px;text-align:left;font-size:0.76rem">
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">รุ่น</span><strong>${escHtml(v.brand)} ${escHtml(v.model)} ${escHtml(v.variant)}</strong></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">สี</span><span>${escHtml(v.color)}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">สถานะ</span><span>${STATUS[v.status]?.label || escHtml(v.status)}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">ราคา</span><strong style="color:var(--success)">${formatCurrency(v.price)}</strong></div>
            </div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:8px">สแกน QR เพื่อดูข้อมูลรถคันนี้</div>
          </div>
        `
      })
    })
  }

  function openStatusModal(v) {
    const { el, close } = openModal({
      title: '🔄 เปลี่ยนสถานะ', size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:8px">
        ${Object.entries(STATUS).map(([k, s]) => `
          <button class="btn btn-secondary" data-st="${k}" style="justify-content:flex-start;gap:10px;${v.status===k?'border-color:var(--primary);background:var(--primary-dim)':''}">
            <span class="badge badge-${s.badge}">${s.label}</span>
          </button>
        `).join('')}
      </div>`,
      footer: `<button class="btn btn-secondary" id="vsc">ยกเลิก</button>`
    })
    el.querySelector('#vsc').addEventListener('click', close)
    el.querySelectorAll('[data-st]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await updateDocData('vehicles', v.id, { status: btn.dataset.st })
        v.status = btn.dataset.st; showToast(`เปลี่ยนสถานะเป็น ${STATUS[btn.dataset.st]?.label}`, 'success')
        close(); document.querySelector('.modal-overlay')?.remove(); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    }))
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const { el, close } = openModal({
      title: isEdit ? `✏️ แก้ไขรถ` : '➕ เพิ่มรถใหม่',
      size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <button type="button" class="btn btn-secondary btn-sm" id="vf-pick" style="align-self:flex-start">🚘 เลือกจาก Catalog (140 รุ่น) — เติมสเปก/ราคาอัตโนมัติ</button>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ยี่ห้อ *</label>
              <select class="input" id="vf-brand">
                ${BRANDS.map(b => `<option value="${b}" ${existing?.brand===b?'selected':''}>${b}</option>`).join('')}
                <option value="other" ${!BRANDS.includes(existing?.brand)?'selected':''}>อื่นๆ</option>
              </select>
            </div>
            <div class="input-group"><label class="input-label">รุ่น *</label><input class="input" id="vf-model" value="${escHtml(existing?.model||'')}" placeholder="เช่น Seal"><span class="input-error" id="vf-model-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">Variant</label><input class="input" id="vf-variant" value="${escHtml(existing?.variant||'')}" placeholder="เช่น AWD, Extended Range"></div>
            <div class="input-group"><label class="input-label">ปีรถ</label><input class="input" type="number" id="vf-year" value="${existing?.year||new Date().getFullYear()}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">สี</label><input class="input" id="vf-color" value="${escHtml(existing?.color||'')}" placeholder="เช่น ขาว Pearl"></div>
            <div class="input-group"><label class="input-label">VIN</label><input class="input" id="vf-vin" value="${escHtml(existing?.vin||'')}" placeholder="17 หลัก"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ราคาขาย (บาท)</label><input class="input" type="number" id="vf-price" value="${existing?.price||''}"></div>
            <div class="input-group"><label class="input-label">ต้นทุน (บาท)</label><input class="input" type="number" id="vf-cost" value="${existing?.cost||''}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">สถานะ</label>
              <select class="input" id="vf-status">
                ${Object.entries(STATUS).map(([k,v]) => `<option value="${k}" ${existing?.status===k?'selected':''}>${v.label}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">ที่ตั้ง</label><input class="input" id="vf-loc" list="vf-locs" value="${escHtml(existing?.location||getBranches()[0]||'โชว์รูมหลัก')}"><datalist id="vf-locs">${getBranches().map(b => `<option value="${b}">`).join('')}<option value="ห้อง PDI"><option value="-"></datalist></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันที่รับรถ</label><input class="input" type="date" id="vf-arrived" value="${existing?.arrivedAt||new Date().toISOString().slice(0,10)}"></div>
            <div class="input-group"><label class="input-label">เลขไมล์ (km)</label><input class="input" type="number" id="vf-mileage" value="${existing?.mileage||0}"></div>
          </div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="vf-notes" value="${escHtml(existing?.notes||'')}"></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="vfc">ยกเลิก</button><button class="btn btn-primary" id="vfs">💾 บันทึก</button>`
    })
    el.querySelector('#vf-pick')?.addEventListener('click', () => pickVehicle(v => {
      const bsel = el.querySelector('#vf-brand')
      if (![...bsel.options].some(o => o.value === v.brand)) { const o = document.createElement('option'); o.value = v.brand; o.textContent = v.brand; bsel.insertBefore(o, bsel.firstChild) }
      bsel.value = v.brand
      el.querySelector('#vf-model').value = v.model
      el.querySelector('#vf-variant').value = v.variant
      if (!el.querySelector('#vf-price').value) el.querySelector('#vf-price').value = v.price || ''
      el.querySelector('#vf-year').value = v.year || el.querySelector('#vf-year').value
    }))
    el.querySelector('#vfc').addEventListener('click', close)
    el.querySelector('#vfs').addEventListener('click', async () => {
      const model = el.querySelector('#vf-model').value.trim()
      if (!model) { el.querySelector('#vf-model-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#vfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        brand: el.querySelector('#vf-brand').value,
        model, variant: el.querySelector('#vf-variant').value,
        year: Number(el.querySelector('#vf-year').value),
        color: el.querySelector('#vf-color').value,
        vin: el.querySelector('#vf-vin').value.trim(),
        price: Number(el.querySelector('#vf-price').value) || 0,
        cost: Number(el.querySelector('#vf-cost').value) || 0,
        status: el.querySelector('#vf-status').value,
        location: el.querySelector('#vf-loc').value,
        arrivedAt: el.querySelector('#vf-arrived').value,
        mileage: Number(el.querySelector('#vf-mileage').value) || 0,
        notes: el.querySelector('#vf-notes').value.trim(),
      }
      try {
        if (isEdit) { await updateDocData('vehicles', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('vehicles', data); stock.unshift({ ...data, id }) }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มรถแล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  // ── Page HTML ─────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">📦 สต็อกรถยนต์</div>
          <div style="display:flex;gap:12px;align-items:center">
            <span class="page-subtitle" id="stock-total">กำลังโหลด...</span>
            <span style="font-size:0.8rem;color:var(--accent)" id="stock-value"></span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="view-toggle-btn">🃏 Card View</button>
          <button class="btn btn-secondary btn-sm" id="stock-export-btn">📥 Export</button>
          <button class="btn btn-primary" id="add-stock-btn">➕ เพิ่มรถ</button>
        </div>
      </div>

      <!-- Status Stats -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${Object.entries(STATUS).map(([k,v]) => `
          <div class="card" data-sf="${k}" style="padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;flex-shrink:0;transition:all 150ms">
            <span id="vstat-${k}" style="font-size:1.2rem;font-weight:700;color:var(--${v.badge})">0</span>
            <span style="font-size:0.78rem;color:var(--text-muted)">${v.label}</span>
          </div>
        `).join('')}
      </div>

      <!-- Filter Bar -->
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <div style="position:relative;flex:1;min-width:180px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="stock-search" placeholder="ค้นหา ยี่ห้อ รุ่น สี VIN..." style="padding-left:32px">
          </div>
          <select class="input" id="brand-filter" style="width:140px">
            <option value="all">ทุกยี่ห้อ</option>
            ${BRANDS.map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="btn btn-sm sf-stock btn-primary" data-sf="all">ทั้งหมด</button>
            ${Object.entries(STATUS).map(([k,v]) => `<button class="btn btn-sm sf-stock btn-secondary" data-sf="${k}">${v.label}</button>`).join('')}
          </div>
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px" id="stock-filtered"></div>

      <!-- Content -->
      <div id="stock-content">
        ${[...Array(5)].map(() => `<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  if (!document.getElementById('stock-style')) {
    const s = document.createElement('style')
    s.id = 'stock-style'
    s.textContent = `.stock-row:hover td{background:var(--surface-2)}`
    document.head.appendChild(s)
  }

  document.getElementById('add-stock-btn').addEventListener('click', () => openForm())
  document.getElementById('stock-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.getElementById('brand-filter').addEventListener('change', e => { brandFilter = e.target.value; applyFilter() })
  document.getElementById('view-toggle-btn').addEventListener('click', () => {
    viewMode = viewMode === 'table' ? 'card' : 'table'
    document.getElementById('view-toggle-btn').textContent = viewMode === 'table' ? '🃏 Card View' : '📋 Table View'
    applyFilter()
  })
  document.getElementById('stock-export-btn').addEventListener('click', () => {
    if (!stock.length) return
    exportToExcel(stock.map(v => ({ ยี่ห้อ:v.brand, รุ่น:v.model, Variant:v.variant, ปี:v.year, สี:v.color, VIN:v.vin, ราคา:v.price, ต้นทุน:v.cost, กำไร:(v.price||0)-(v.cost||0), สถานะ:STATUS[v.status]?.label||v.status, ที่ตั้ง:v.location, รับมา:formatDate(v.arrivedAt) })), `stock-${new Date().toISOString().slice(0,10)}.xlsx`, 'สต็อกรถ')
    showToast('Export แล้ว', 'success')
  })
  document.querySelectorAll('.sf-stock').forEach(btn => btn.addEventListener('click', () => {
    statusFilter = btn.dataset.sf
    document.querySelectorAll('.sf-stock').forEach(b => b.className = `btn btn-sm sf-stock ${b.dataset.sf === statusFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))
  document.querySelectorAll('[data-sf]').forEach(card => card.addEventListener('click', e => {
    if (!e.currentTarget.classList.contains('card')) return
    statusFilter = card.dataset.sf
    document.querySelectorAll('.sf-stock').forEach(b => b.className = `btn btn-sm sf-stock ${b.dataset.sf === statusFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))

  if (container.__routerGen === myGen) await loadData()
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${value}</span></div>`
}

function colorDot(color = '') {
  const map = { ขาว:'#f5f5f5', น้ำเงิน:'#1976D2', แดง:'#E53935', ดำ:'#212121', เทา:'#9E9E9E', เขียว:'#43A047', เงิน:'#BDBDBD', ทอง:'#FDD835' }
  for (const [k, v] of Object.entries(map)) { if (color.includes(k)) return v }
  return '#6B7280'
}
