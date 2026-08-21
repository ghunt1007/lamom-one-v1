import { listDocs, watchDocs, createDoc, updateDocData, softDelete, seedDemoData, getSalesData } from '../../core/db.js'
import { showToast, getState, on } from '../../core/store.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { formatDate, formatCurrency, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getBranches } from '../../data/masterData.js'
import { pickVehicle } from '../../utils/vehiclePicker.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── ป้องกันขายซ้ำ (double-selling) ──────────────────────────────────────────────
// ระบบนี้มี 3 จุดที่ "ล็อค/จอง" รถแยกกันไม่ sync กันเลย: ReserveLock.js เขียนลง collection 'reservations',
// VehicleReservation.js เขียนลง 'vehicle_reservations', ส่วน Stock.js เขียน field status เองใน 'vehicles'
// ไม่ทำ full merge เป็น collection เดียว (เสี่ยงเกินไปสำหรับ patch เล็ก ต้องแก้ทั้ง 3 หน้าพร้อมกัน) แค่กัน
// อันตรายจริง (ขายรถที่มีคนจอง/ล็อคอยู่แล้วซ้ำ) โดยเช็คก่อนปล่อยรถกลับเป็น "พร้อมขาย" ทุกครั้งว่าไม่มีการ
// ล็อค/จองที่ยัง active อยู่ในอีก 2 ระบบ — vehicle_reservations ไม่มี field vin/stockId ที่ผูกกับรถจริงเลย
// (stockId มีอยู่ในสคีมาแต่ไม่เคยถูกเซ็ตจากหน้าไหนเลย) จึงเช็คได้แค่แบบ best-effort ด้วยรุ่น+สี ไม่ใช่ VIN ตรงๆ
async function checkActiveLocks(v) {
  const conflicts = []
  try {
    const locks = await listDocs('reservations', [], 'lockedAt', 'desc', 300)
    locks.filter(l => l.vin && v.vin && l.vin === v.vin && (l.status === 'reserved' || l.status === 'locked'))
      .forEach(l => conflicts.push(`🔐 ล็อคสต็อก (ReserveLock): ${l.customer || '-'} (${l.status === 'locked' ? 'ล็อคชั่วคราว' : 'จองแล้ว'})`))
  } catch (e) {}
  try {
    const resv = await listDocs('vehicle_reservations', [], 'created', 'desc', 300)
    resv.filter(r => ['active', 'deposit', 'confirmed'].includes(r.status) &&
      ((r.stockId && r.stockId === v.id) || (r.model && v.model && r.model.toLowerCase().includes(String(v.model).toLowerCase()) && r.color === v.color)))
      .forEach(r => conflicts.push(`📋 จองคิว (VehicleReservation): ${r.customer || '-'} (${r.status})`))
  } catch (e) {}
  return conflicts
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
  // เดิมหน้านี้ไม่มีการแจ้งเลยว่า DEMO_STOCK (7 คันตัวอย่าง) ที่โผล่มาแทนตอนยังไม่มีรถจริงเป็นข้อมูลปลอม
  // (ทุกหน้าอื่นในระบบที่ fallback แบบเดียวกัน เช่น Staff.js มี badge "⚠️ ข้อมูลตัวอย่าง" เตือนไว้เสมอ) ทำให้
  // ดูเหมือนมีรถในสต็อกจริง 7 คันทั้งที่ยังไม่มีรถจริงเลยแม้แต่คันเดียว — เพิ่ม badge แบบเดียวกัน
  let isDemoData = false

  // Real-time: อัปเดตสดเมื่อมีคนแก้ไขสต็อกรถจากเครื่องอื่น — หน้านี้ renderContent()/updateStats()
  // แก้แค่ #stock-content/#stock-filtered/#vstat-*/#stock-total เท่านั้น ไม่แตะช่องค้นหาเลย จึงปลอดภัย
  let firstSnapshot = true
  let unsubStock = () => {}
  // (v1.0.453) การกรองตามบริษัทย้ายเข้า query จริงแล้ว (companyScopeFilters()) — ต้องยกเลิก subscription
  // เก่าแล้วยิงใหม่ทุกครั้งที่ activeCompanyFilter (ตัวกรอง Topbar) เปลี่ยน ไม่งั้นตัวกรองจะหยุดทำงาน
  function startWatchStock() {
    unsubStock()
    unsubStock = watchDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 500, async rows => {
      if (container.__routerGen !== myGen) { unsubStock(); return }
      // softDelete() ไม่ได้ลบเอกสารจริง แค่ตั้ง deleted:true — ถ้าไม่กรองออก รถที่ "ลบ" ไปแล้วจะยังโผล่กลับมา
      // ในสต็อกทุกครั้งที่มี snapshot ใหม่เข้ามา (รวมถึง snapshot จากการลบเองด้วย)
      stock = rows.filter(v => !v.deleted)
      isDemoData = !stock.length && firstSnapshot
      if (isDemoData) DEMO_STOCK.forEach(v => stock.push({ ...v }))
      firstSnapshot = false
      // ลิงก์ใบจอง (แหล่งกลาง): จับคู่ตาม VIN → แสดงสถานะจอง/ลูกค้าบนรถในสต็อก
      try {
        const sales = await getSalesData()
        bookingByVin = {}
        sales.forEach(s => { if (s.plate) bookingByVin[s.plate] = s })
      } catch (e) {}
      if (container.__routerGen !== myGen) return
      updateStats(); applyFilter()
    })
  }
  startWatchStock()
  const offCompanyFilter = on('activeCompanyFilter', startWatchStock)

  function updateStats() {
    const counts = {}
    Object.keys(STATUS).forEach(k => counts[k] = stock.filter(v => v.status === k).length)
    Object.keys(STATUS).forEach(k => {
      const el = document.getElementById(`vstat-${k}`)
      if (el) el.textContent = counts[k]
    })
    const totalEl = document.getElementById('stock-total')
    if (totalEl) totalEl.textContent = `${stock.length} คัน`
    const demoEl = document.getElementById('stock-demo-indicator')
    if (demoEl) demoEl.textContent = isDemoData ? '⚠️ ข้อมูลตัวอย่าง (ยังไม่มีรถในสต็อกจริง)' : ''

    // Value stats
    const availableValue = stock.filter(v => v.status === 'available').reduce((s, v) => s + (v.cost || 0), 0)
    const el = document.getElementById('stock-value')
    if (el) el.textContent = `มูลค่าสต็อก: ${formatCurrency(availableValue)}`
  }

  function applyFilter() {
    // (v1.0.453) การกรองตามบริษัทย้ายเข้า query จริงแล้ว (companyScopeFilters() ใน startWatchStock()) —
    // ไม่ต้องกรองซ้ำที่นี่อีก
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
            <button class="btn btn-ghost btn-sm" id="v-jobcard-btn">🔧 เปิด Job Card</button>
            <button class="btn btn-ghost btn-sm" id="v-warranty-btn">🛡 แจ้งเคลมประกัน</button>
          </div>
          <div id="v-booking-panel"><div class="skeleton" style="height:34px;border-radius:10px"></div></div>
          <div id="v-pdi-panel"><div class="skeleton" style="height:34px;border-radius:10px"></div></div>
          <div id="v-jobcard-panel"><div class="skeleton" style="height:34px;border-radius:10px"></div></div>
          <div id="v-warranty-panel"><div class="skeleton" style="height:34px;border-radius:10px"></div></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-primary" id="v-edit-btn">✏️ แก้ไข</button>`
    })
    document.getElementById('v-edit-btn')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(v) })
    document.getElementById('v-jobcard-btn')?.addEventListener('click', () => {
      sessionStorage.setItem('lamom_jobcard_prefill', JSON.stringify({
        vehicleId: v.id, vin: v.vin || '', brand: v.brand || '', model: v.model || '',
      }))
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
      navigate('/service/jobs')
    })
    document.getElementById('v-warranty-btn')?.addEventListener('click', () => {
      sessionStorage.setItem('lamom_warranty_prefill', JSON.stringify({
        vehicleId: v.id, vin: v.vin || '', brand: v.brand || '', model: v.model || '',
      }))
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
      navigate('/service/warranty-claim')
    })
    refreshBookingPanelForVehicle(v)
    refreshPdiPanel(v)
    refreshJobCardPanelForVehicle(v)
    refreshWarrantyPanelForVehicle(v)
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

  // (v1.0.460) รถ 1 คัน — ดูประวัติทั้งวงจร (จอง/PDI/ซ่อม/เคลมประกัน) ในหน้าเดียวกัน ไม่ต้องไล่ค้นทีละหน้า
  // ตามที่ขอ ("เบ็ดเสร็จจุดเดียว") — bookingByVin คำนวณไว้แล้วในสโคปด้านนอก (จับคู่ด้วย VIN จริง)
  // ส่วน PDI ผูก vehicleId จริงอยู่แล้ว (real FK) แต่ job_cards/warranty_claims เพิ่งเพิ่ม field vin ให้ใหม่
  // ในรอบนี้ (ก่อนหน้านี้ไม่มีเลย) จึงจับคู่ได้แม่นยำเฉพาะรายการที่เปิดผ่านปุ่มในหน้านี้นับจากนี้ไป
  function refreshBookingPanelForVehicle(v) {
    const el = document.getElementById('v-booking-panel')
    if (!el) return
    const b = v.vin ? bookingByVin[v.vin] : null
    if (!b) { el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted)">📋 ยังไม่มีใบจอง</div>`; return }
    el.innerHTML = `<div class="card" style="padding:8px 12px;font-size:0.8rem">📋 <strong>จองแล้ว</strong> — ${escHtml(b.custName || '-')} · ${escHtml(b.status || '-')}</div>`
  }
  async function refreshPdiPanel(v) {
    const el = document.getElementById('v-pdi-panel')
    if (!el) return
    let pdis = []
    try { pdis = await listDocs('pdi', companyScopeFilters(), 'startDate', 'desc', 300) } catch { pdis = [] }
    if (!document.getElementById('v-pdi-panel')) return
    const p = pdis.find(x => x.vehicleId === v.id)
    if (!p) { el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted)">🔧 ยังไม่มีประวัติ PDI</div>`; return }
    el.innerHTML = `<div class="card" style="padding:8px 12px;font-size:0.8rem">🔧 <strong>PDI</strong> — ${escHtml(p.status || '-')} · ช่าง ${escHtml(p.techName || '-')} · ${formatDate(p.startDate)}</div>`
  }
  async function refreshJobCardPanelForVehicle(v) {
    const el = document.getElementById('v-jobcard-panel')
    if (!el) return
    let jobs = []
    try { jobs = await listDocs('job_cards', [], 'createdAt', 'desc', 300) } catch { jobs = [] }
    if (!document.getElementById('v-jobcard-panel')) return
    const matched = jobs.filter(j => !j.deleted && v.vin && j.vin === v.vin)
    if (!matched.length) { el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted)">🗂️ ยังไม่มีประวัติ Job Card</div>`; return }
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">
      ${matched.slice(0, 3).map(j => `<div class="card" style="padding:8px 12px;font-size:0.8rem">🗂️ ${escHtml(j.jobNo || '')} — ${escHtml(j.status || '-')} · ${formatDate(j.createdAt)}</div>`).join('')}
      ${matched.length > 3 ? `<div style="font-size:0.72rem;color:var(--text-muted)">และอีก ${matched.length - 3} รายการ</div>` : ''}
    </div>`
  }
  async function refreshWarrantyPanelForVehicle(v) {
    const el = document.getElementById('v-warranty-panel')
    if (!el) return
    let claims = []
    try { claims = await listDocs('warranty_claims', [], 'submitted', 'desc', 300) } catch { claims = [] }
    if (!document.getElementById('v-warranty-panel')) return
    const matched = claims.filter(c => v.vin && c.vin === v.vin)
    if (!matched.length) { el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted)">🛡 ยังไม่มีเคลมประกัน</div>`; return }
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">
      ${matched.slice(0, 3).map(c => `<div class="card" style="padding:8px 12px;font-size:0.8rem">🛡 ${escHtml(c.issue || '-')} — ${escHtml(c.status || '-')} · ${formatDate(c.submitted)}</div>`).join('')}
      ${matched.length > 3 ? `<div style="font-size:0.72rem;color:var(--text-muted)">และอีก ${matched.length - 3} รายการ</div>` : ''}
    </div>`
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
        if (btn.dataset.st === 'available') {
          const conflicts = await checkActiveLocks(v)
          if (conflicts.length) {
            showToast('⚠️ ห้ามปล่อยขาย — รถคันนี้ยังมีการจอง/ล็อคค้างอยู่: ' + conflicts.join(' · '), 'error')
            return
          }
        }
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
                <option value="other" ${(existing && !BRANDS.includes(existing.brand))?'selected':''}>อื่นๆ</option>
              </select>
              <input class="input" id="vf-brand-other" value="${escHtml((existing && !BRANDS.includes(existing.brand)) ? existing.brand : '')}" placeholder="ระบุยี่ห้อ..." style="margin-top:6px;display:${(existing && !BRANDS.includes(existing.brand)) ? 'block' : 'none'}">
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
            <!-- เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
            เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok() -->
            <div class="input-group"><label class="input-label">วันที่รับรถ</label><input class="input" type="date" id="vf-arrived" value="${existing?.arrivedAt||todayBangkok()}"></div>
            <div class="input-group"><label class="input-label">เลขไมล์ (km)</label><input class="input" type="number" id="vf-mileage" value="${existing?.mileage||0}"></div>
          </div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="vf-notes" value="${escHtml(existing?.notes||'')}"></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="vfc">ยกเลิก</button><button class="btn btn-primary" id="vfs">💾 บันทึก</button>`
    })
    el.querySelector('#vf-brand')?.addEventListener('change', e => {
      el.querySelector('#vf-brand-other').style.display = e.target.value === 'other' ? 'block' : 'none'
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
      const brandSel = el.querySelector('#vf-brand').value
      const brandOther = el.querySelector('#vf-brand-other').value.trim()
      if (brandSel === 'other' && !brandOther) { showToast('❗ กรุณาระบุชื่อยี่ห้อ', 'error'); return }
      const btn = el.querySelector('#vfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        brand: brandSel === 'other' ? brandOther : brandSel,
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
        if (isEdit) {
          if (data.status === 'available' && existing.status !== 'available') {
            const conflicts = await checkActiveLocks({ ...existing, ...data })
            if (conflicts.length) {
              showToast('⚠️ ห้ามปล่อยขาย — รถคันนี้ยังมีการจอง/ล็อคค้างอยู่: ' + conflicts.join(' · '), 'error')
              btn.disabled = false; btn.innerHTML = '💾 บันทึก'
              return
            }
          }
          await updateDocData('vehicles', existing.id, data); Object.assign(existing, data)
        }
        else {
          // Phase 2 หลายบริษัท — ติด companyId ของบริษัทหลักที่พนักงานคนรับรถเข้าสังกัดอยู่ (ถ้ามี) รถเดิม
          // ที่ไม่มี companyId ยังเห็นได้ทุกคนเหมือนเดิม (ไม่ถูกกรองออก)
          const payload = { ...data, companyId: myEffectiveCompanyId() }
          const id = await createDoc('vehicles', payload); stock.unshift({ ...payload, id })
        }
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
            <span style="font-size:0.76rem;color:var(--warning);font-weight:600" id="stock-demo-indicator"></span>
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
    // เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
    // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
    exportToExcel(stock.map(v => ({ ยี่ห้อ:v.brand, รุ่น:v.model, Variant:v.variant, ปี:v.year, สี:v.color, VIN:v.vin, ราคา:v.price, ต้นทุน:v.cost, กำไร:(v.price||0)-(v.cost||0), สถานะ:STATUS[v.status]?.label||v.status, ที่ตั้ง:v.location, รับมา:formatDate(v.arrivedAt) })), `stock-${todayBangkok()}.xlsx`, 'สต็อกรถ')
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

  return function cleanupStock() { unsubStock(); offCompanyFilter() }
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${value}</span></div>`
}

function colorDot(color = '') {
  const map = { ขาว:'#f5f5f5', น้ำเงิน:'#1976D2', แดง:'#E53935', ดำ:'#212121', เทา:'#9E9E9E', เขียว:'#43A047', เงิน:'#BDBDBD', ทอง:'#FDD835' }
  for (const [k, v] of Object.entries(map)) { if (color.includes(k)) return v }
  return '#6B7280'
}
