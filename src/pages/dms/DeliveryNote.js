import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getBranches, getSalesStaff } from '../../data/masterData.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const BOOKING_TO_DN = {
  'รอส่งมอบ': 'pending',
  'ตัดตัวเลขรอส่งมอบ': 'scheduled',
  'ส่งมอบแล้ว': 'done',
  'ถอนจอง': 'cancelled',
  'รอผลไฟแนนซ์': 'pending',
  'รอรถ': 'pending',
  'ยอดจองคงค้าง': 'pending',
}

const DN_STATUS = {
  pending:   { label: 'รอส่งมอบ', color: 'warning' },
  scheduled: { label: 'นัดหมายแล้ว', color: 'primary' },
  done:      { label: 'ส่งมอบแล้ว', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'danger' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

// localStorage overlay: delivery scheduling + checklist per booking
function loadOL(id) { try { return JSON.parse(localStorage.getItem('dn-ol-' + id) || '{}') } catch { return {} } }
function saveOL(id, data) { try { localStorage.setItem('dn-ol-' + id, JSON.stringify({ ...loadOL(id), ...data })) } catch {} }

const DEMO_DNS = [
  { id:'DN001', bookingId:'BK001', _fbId:null, customerName:'วิชาญ มีโชค', phone:'081-234-5678',
    brand:'BYD', model:'Seal', variant:'AWD Performance', color:'Cosmos Black', year:2024,
    vin:'LBWAB2EB7PD001002', plate:'กก 1234 BKK', price:1449000, salesperson:'อรนุช สายใจ',
    deliveryDate:addDays(-5), deliveryTime:'10:00', location:'โชว์รูม LAMOM สาขาหลัก',
    status:'done', signedAt:addDays(-5), notes:'ลูกค้าพอใจมาก',
    accessories:['ฟิล์มกันรอย','แผ่นยางรองเท้า','พรมรถ','Car Charger Type 2'],
    checklist:{ docs:true, keys:true, charger:true, manual:true, mats:true, spare:true } },
  { id:'DN002', bookingId:'BK002', _fbId:null, customerName:'อรนุช สาวสวย', phone:'082-345-6789',
    brand:'MG', model:'ZS EV', variant:'Grand Luxury', color:'Pearl White', year:2024,
    vin:'LSJWSRAR7NE001008', plate:'', price:1059000, salesperson:'วิชาญ มีโชค',
    deliveryDate:addDays(2), deliveryTime:'13:00', location:'โชว์รูม LAMOM สาขาหลัก',
    status:'scheduled', signedAt:null, notes:'',
    accessories:['ฟิล์มกันรอย','พรมรถ'],
    checklist:{ docs:false, keys:false, charger:false, manual:false, mats:false, spare:false } },
  { id:'DN003', bookingId:'BK003', _fbId:null, customerName:'ธีรยุทธ เก่งกาจ', phone:'083-456-7890',
    brand:'BYD', model:'Atto 3', variant:'Extended Range', color:'Sky Blue', year:2024,
    vin:'LBWAB2EB7PD001003', plate:'', price:1099000, salesperson:'อรนุช สายใจ',
    deliveryDate:addDays(7), deliveryTime:'10:30', location:'บ้านลูกค้า (ส่งถึงบ้าน)',
    status:'pending', signedAt:null, notes:'ลูกค้าขอส่งถึงบ้าน',
    accessories:['ฟิล์มกันรอย','แผ่นยางรองเท้า','Wall Charger 7kW'],
    checklist:{ docs:false, keys:false, charger:false, manual:false, mats:false, spare:false } },
]

export default async function DeliveryNotePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let statusFilter = 'all'
  let notes = []

  // skeleton while loading
  container.innerHTML = `<div class="page-content animate-slide">
    <div style="padding:20px 0">${[...Array(4)].map(() => `<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>`).join('')}</div>
  </div>`

  // Load from bookings
  try {
    const bookings = await listDocs('bookings', [], 'createdAt', 'desc', 500)
    if (container.__routerGen !== myGen) return
    const relevant = bookings.filter(b => ['รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ', 'ส่งมอบแล้ว', 'ถอนจอง'].includes(b.status))
    if (relevant.length) {
      notes = relevant.map(b => {
        const ol = loadOL(b.id)
        return {
          id: b.bookingNo || b.id,
          bookingId: b.bookingNo || b.id,
          _fbId: b.id,
          customerName: b.custName || '',
          phone: b.custPhone || ol.phone || '',
          brand: b.brand || '',
          model: b.model || '',
          variant: b.variant || '',
          color: b.color || ol.color || '',
          vin: b.vin || '',
          plate: ol.plate || b.plate || '',
          price: b.price || 0,
          salesperson: b.salesName || '',
          deliveryDate: ol.deliveryDate || b.actualDeliveryDate || addDays(7),
          deliveryTime: ol.deliveryTime || '10:00',
          location: ol.location || (getBranches()[0] || 'โชว์รูมหลัก'),
          status: ol.status || BOOKING_TO_DN[b.status] || 'pending',
          signedAt: ol.signedAt || null,
          notes: ol.notes || '',
          accessories: ol.accessories || [],
          checklist: ol.checklist || { docs:false, keys:false, charger:false, manual:false, mats:false, spare:false },
        }
      })
    }
  } catch {}

  if (!notes.length) notes = [...DEMO_DNS]
  if (container.__routerGen !== myGen) return

  const today = new Date().toISOString().slice(0, 10)

  function filtered() {
    return notes.filter(n => statusFilter === 'all' || n.status === statusFilter)
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
  }

  function renderPage() {
    const list = filtered()
    const pending   = notes.filter(n => n.status === 'pending').length
    const scheduled = notes.filter(n => n.status === 'scheduled').length
    const done      = notes.filter(n => n.status === 'done').length
    const todayList = notes.filter(n => n.deliveryDate === today && n.status !== 'cancelled')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 ใบส่งมอบรถ</div>
            <div class="page-subtitle">Vehicle Delivery Note — จัดการการส่งมอบรถ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-dn-btn">+ สร้างใบส่งมอบ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 รอส่งมอบ', pending, 'warning')}
          ${kpi('📅 นัดหมายแล้ว', scheduled, 'primary')}
          ${kpi('✅ ส่งมอบแล้ว', done, 'success')}
          ${kpi('📅 วันนี้', todayList.length, todayList.length > 0 ? 'warning' : 'secondary')}
        </div>

        ${todayList.length ? `<div class="card" style="padding:12px 14px;margin-bottom:14px;border-left:3px solid var(--warning)">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:6px">📅 ส่งมอบวันนี้ (${todayList.length} คัน)</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${todayList.map(n => `<span class="badge badge-warning" style="font-size:0.75rem">${escHtml(n.deliveryTime)} · ${escHtml(n.customerName)} · ${escHtml(n.brand)} ${escHtml(n.model)}</span>`).join('')}
          </div>
        </div>` : ''}

        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(DN_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead>
              <tr><th>ใบส่งมอบ</th><th>ลูกค้า</th><th>รถ</th><th>วันส่งมอบ</th><th>สถานที่</th><th>เซลส์</th><th>สถานะ</th><th></th></tr>
            </thead>
            <tbody>
              ${list.map(n => {
                const st = DN_STATUS[n.status] || DN_STATUS.pending
                const isToday = n.deliveryDate === today
                const isOverdue = n.deliveryDate < today && n.status !== 'done' && n.status !== 'cancelled'
                return `<tr style="${isToday ? 'border-left:3px solid var(--warning)' : ''}">
                  <td>
                    <div style="font-family:monospace;font-weight:700;font-size:0.82rem">${escHtml(n.id)}</div>
                    ${n._fbId ? '<div style="font-size:0.68rem;color:var(--success);margin-top:2px">🔗 จากใบจอง</div>' : ''}
                  </td>
                  <td>
                    <div style="font-weight:600;font-size:0.85rem">${escHtml(n.customerName)}</div>
                    <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(n.phone)}</div>
                  </td>
                  <td>
                    <div style="font-size:0.85rem;font-weight:600">${escHtml(n.brand)} ${escHtml(n.model)}</div>
                    <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(n.variant)} · ${escHtml(n.color)}</div>
                  </td>
                  <td>
                    <div style="font-size:0.83rem;font-weight:${isToday?700:400};color:${isToday?'var(--warning)':isOverdue?'var(--danger)':'inherit'}">${formatDate(n.deliveryDate)}</div>
                    <div style="font-size:0.73rem;color:var(--text-muted)">${n.deliveryTime}</div>
                  </td>
                  <td style="font-size:0.8rem;max-width:160px">${escHtml(n.location)}</td>
                  <td style="font-size:0.82rem">${escHtml(n.salesperson)}</td>
                  <td>
                    <span class="badge badge-${st.color}">${st.label}</span>
                    ${isOverdue ? '<span class="badge badge-danger" style="font-size:0.62rem;margin-left:4px">เกินกำหนด</span>' : ''}
                  </td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-xs btn-secondary open-dn-btn" data-id="${n.id}">ดู</button>
                      ${n.status !== 'done' && n.status !== 'cancelled'
                        ? `<button class="btn btn-xs btn-primary schedule-dn-btn" data-id="${n.id}">📅 นัด</button>
                           <button class="btn btn-xs btn-success confirm-dn-btn" data-id="${n.id}">✓</button>`
                        : ''}
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

    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-dn-btn')?.addEventListener('click', () => openDNForm())
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(list.map(n => ({ ID:n.id, ลูกค้า:n.customerName, รถ:`${n.brand} ${n.model}`, สี:n.color, VIN:n.vin, ทะเบียน:n.plate, ราคา:n.price, วันส่งมอบ:n.deliveryDate, สถานะ:DN_STATUS[n.status]?.label })), 'delivery_notes')
      showToast('📥 Export แล้ว!', 'success')
    })
    document.querySelectorAll('.open-dn-btn').forEach(b => b.addEventListener('click', () => { const n = notes.find(x => x.id === b.dataset.id); if (n) openDNDetail(n) }))
    document.querySelectorAll('.schedule-dn-btn').forEach(b => b.addEventListener('click', () => { const n = notes.find(x => x.id === b.dataset.id); if (n) openScheduleForm(n) }))
    document.querySelectorAll('.confirm-dn-btn').forEach(b => b.addEventListener('click', () => { const n = notes.find(x => x.id === b.dataset.id); if (n) openDeliveryConfirm(n) }))
  }

  function openDNDetail(n) {
    const st = DN_STATUS[n.status] || DN_STATUS.pending
    const checkItems = [
      ['docs','📄 เอกสารครบถ้วน'],['keys','🔑 กุญแจรถ/สมาร์ทคีย์'],
      ['charger','🔌 สายชาร์จ / Wall Charger'],['manual','📖 คู่มือรถ'],
      ['mats','🟫 พรม / แผ่นรองเท้า'],['spare','🔧 อุปกรณ์แม่แรง/ไขควง'],
    ]
    openModal({
      title: '🚗 ' + escHtml(n.id) + ' — ใบส่งมอบรถ',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">ข้อมูลลูกค้า</div>
            ${row('ชื่อ',escHtml(n.customerName))}${row('โทร',escHtml(n.phone))}${row('เซลส์',escHtml(n.salesperson))}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">ข้อมูลรถ</div>
            ${row('รุ่น',escHtml(`${n.brand} ${n.model} ${n.variant}`))}${row('สี',escHtml(n.color))}
            ${row('VIN',`<span style="font-family:monospace;font-size:0.78rem">${escHtml(n.vin||'-')}</span>`)}
            ${row('ทะเบียน',escHtml(n.plate||'(รอออก)'))}
            ${row('ราคา',`<strong style="color:var(--success)">${formatCurrency(n.price)}</strong>`)}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">กำหนดส่งมอบ</div>
            ${row('วัน',formatDate(n.deliveryDate))}${row('เวลา',escHtml(n.deliveryTime))}
            ${row('สถานที่',escHtml(n.location))}${row('สถานะ',`<span class="badge badge-${st.color}">${st.label}</span>`)}
            ${n.signedAt ? row('ส่งมอบแล้ว',formatDate(n.signedAt)) : ''}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">อุปกรณ์เสริม</div>
            ${n.accessories.length ? n.accessories.map(a => `<div style="font-size:0.8rem;padding:3px 0;border-bottom:1px solid var(--border)">✓ ${escHtml(a)}</div>`).join('') : '<div style="font-size:0.8rem;color:var(--text-muted)">ไม่มี</div>'}
          </div>
        </div>
        <div>
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px">✅ Checklist ส่งมอบ</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            ${checkItems.map(([key, label]) => `
              <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <span style="font-size:1rem">${n.checklist[key] ? '✅' : '⬜'}</span>
                <span style="font-size:0.82rem;${n.checklist[key]?'':'color:var(--text-muted)'}">${label}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ${n.notes ? `<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted)">📌 ${escHtml(n.notes)}</div>` : ''}
      `,
      footer: n.status !== 'done' && n.status !== 'cancelled'
        ? `<button class="btn btn-primary schedule-modal-btn" style="margin-right:6px">📅 นัดส่งมอบ</button><button class="btn btn-success confirm-modal-btn">✓ ยืนยันส่งมอบ</button>`
        : ''
    })
    setTimeout(() => {
      document.querySelector('.modal .schedule-modal-btn')?.addEventListener('click', () => { document.querySelector('.modal-close-btn')?.click(); openScheduleForm(n) })
      document.querySelector('.modal .confirm-modal-btn')?.addEventListener('click', () => { document.querySelector('.modal-close-btn')?.click(); openDeliveryConfirm(n) })
    }, 50)
  }

  function openScheduleForm(n) {
    const staff = getSalesStaff()
    openModal({
      title: '📅 นัดส่งมอบ — ' + escHtml(n.customerName),
      size: 'md',
      body: `
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.83rem">
          <div style="font-weight:700">${escHtml(n.brand)} ${escHtml(n.model)} ${escHtml(n.variant)}</div>
          <div style="color:var(--text-muted)">${escHtml(n.color)} · ${escHtml(n.vin || 'รอ VIN')}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="input-group"><label class="input-label">วันส่งมอบ *</label><input type="date" class="input" id="sc-date" value="${escHtml(n.deliveryDate)}"></div>
          <div class="input-group"><label class="input-label">เวลา</label><input type="time" class="input" id="sc-time" value="${escHtml(n.deliveryTime)}"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">สถานที่</label>
            <input class="input" id="sc-loc" list="sc-locs" value="${escHtml(n.location)}">
            <datalist id="sc-locs">${getBranches().map(b => `<option value="${escHtml(b)}">`).join('')}<option value="บ้านลูกค้า (ส่งถึงบ้าน)"></datalist>
          </div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">เซลส์ / ผู้ส่งมอบ</label>
            <input class="input" id="sc-sales" list="sc-staff" value="${escHtml(n.salesperson)}">
            <datalist id="sc-staff">${staff.map(s => `<option value="${escHtml(s)}">`).join('')}</datalist>
          </div>
        </div>
      `,
      confirmLabel: '📅 บันทึกนัด',
      onConfirm() {
        const date = document.getElementById('sc-date')?.value
        if (!date) { showToast('❗ กรุณาระบุวันส่งมอบ', 'error'); return }
        const overlay = {
          deliveryDate: date,
          deliveryTime: document.getElementById('sc-time')?.value || n.deliveryTime,
          location: document.getElementById('sc-loc')?.value || n.location,
          status: 'scheduled',
        }
        if (n._fbId) saveOL(n._fbId, overlay)
        Object.assign(n, overlay)
        showToast(`📅 นัดส่งมอบ ${n.customerName} วัน ${formatDate(date)} เรียบร้อย`, 'success')
        renderPage()
      }
    })
  }

  function openDeliveryConfirm(n) {
    const checkItems = [['docs','📄 เอกสาร'],['keys','🔑 กุญแจ'],['charger','🔌 สายชาร์จ'],['manual','📖 คู่มือ'],['mats','🟫 พรม'],['spare','🔧 อุปกรณ์']]
    openModal({
      title: '✓ ยืนยันการส่งมอบ — ' + escHtml(n.customerName),
      size: 'md',
      body: `
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.83rem">
          <div style="font-weight:700">${escHtml(n.brand)} ${escHtml(n.model)} ${escHtml(n.variant)}</div>
          <div style="color:var(--text-muted)">${escHtml(n.color)} · ${escHtml(n.vin || 'รอ VIN')}</div>
        </div>
        <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">ตรวจสอบ Checklist ก่อนส่งมอบ</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">
          ${checkItems.map(([key,label]) => `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);cursor:pointer">
              <input type="checkbox" class="dn-check" data-k="${key}" ${n.checklist[key]?'checked':''} style="width:15px;height:15px">
              <span style="font-size:0.82rem">${label}</span>
            </label>
          `).join('')}
        </div>
        <div class="input-group"><label class="input-label">ทะเบียนรถ</label><input class="input" id="dn-plate" value="${escHtml(n.plate)}" placeholder="กก 1234 BKK"></div>
        <div class="input-group" style="margin-top:10px"><label class="input-label">หมายเหตุ</label><textarea class="input" id="dn-notes" rows="2" placeholder="บันทึกเพิ่มเติม...">${escHtml(n.notes)}</textarea></div>
      `,
      confirmLabel: '✅ ยืนยันส่งมอบ',
      confirmClass: 'btn-success',
      onConfirm() {
        const checklist = {}
        checkItems.forEach(([key]) => { checklist[key] = !!document.querySelector(`.modal .dn-check[data-k="${key}"]`)?.checked })
        const plate = document.getElementById('dn-plate')?.value || n.plate
        const notes2 = document.getElementById('dn-notes')?.value || ''
        const signedAt = new Date().toISOString().slice(0, 10)
        const overlay = { status:'done', signedAt, plate, notes:notes2, checklist }
        if (n._fbId) {
          saveOL(n._fbId, overlay)
          updateDocData('bookings', n._fbId, { status:'ส่งมอบแล้ว', actualDeliveryDate:signedAt, plate }).catch(() => {})
        }
        Object.assign(n, overlay)
        showToast(`✅ ส่งมอบ ${n.brand} ${n.model} ให้ ${n.customerName} เรียบร้อย!`, 'success')
        renderPage()
      }
    })
  }

  function openDNForm() {
    const staff = getSalesStaff()
    openModal({
      title: '+ สร้างใบส่งมอบใหม่',
      size: 'lg',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="df-name" placeholder="ชื่อลูกค้า"></div>
        <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="df-phone" placeholder="08x-xxx-xxxx"></div>
        <div class="input-group"><label class="input-label">แบรนด์ / รุ่น</label><input class="input" id="df-model" placeholder="BYD Seal AWD"></div>
        <div class="input-group"><label class="input-label">สี</label><input class="input" id="df-color" placeholder="Cosmos Black"></div>
        <div class="input-group"><label class="input-label">VIN</label><input class="input" id="df-vin" placeholder="VIN..."></div>
        <div class="input-group"><label class="input-label">ราคา (บาท)</label><input type="number" class="input" id="df-price" placeholder="1449000"></div>
        <div class="input-group"><label class="input-label">วันส่งมอบ *</label><input type="date" class="input" id="df-date" value="${addDays(7)}"></div>
        <div class="input-group"><label class="input-label">เวลา</label><input type="time" class="input" id="df-time" value="10:00"></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">สถานที่</label>
          <input class="input" id="df-loc" list="df-locs" value="${escHtml(getBranches()[0]||'โชว์รูมหลัก')}">
          <datalist id="df-locs">${getBranches().map(b => `<option value="${escHtml(b)}">`).join('')}<option value="บ้านลูกค้า (ส่งถึงบ้าน)"></datalist>
        </div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">เซลส์</label>
          <input class="input" id="df-sales" list="df-staff" placeholder="ชื่อเซลส์">
          <datalist id="df-staff">${staff.map(s => `<option value="${escHtml(s)}">`).join('')}</datalist>
        </div>
      </div>`,
      onConfirm() {
        const name = document.getElementById('df-name')?.value?.trim()
        const date = document.getElementById('df-date')?.value
        if (!name || !date) { showToast('❗ กรุณากรอกข้อมูลที่จำเป็น', 'error'); return }
        const model = document.getElementById('df-model')?.value || ''
        const [brand, ...rest] = model.split(' ')
        const n = {
          id: `DN${String(notes.length+1).padStart(3,'0')}`, bookingId:'', _fbId:null,
          customerName:name, phone:document.getElementById('df-phone')?.value||'',
          brand:brand||'', model:rest.join(' ')||model, variant:'', color:document.getElementById('df-color')?.value||'',
          vin:document.getElementById('df-vin')?.value||'', plate:'', price:+(document.getElementById('df-price')?.value||0),
          salesperson:document.getElementById('df-sales')?.value||'',
          deliveryDate:date, deliveryTime:document.getElementById('df-time')?.value||'10:00',
          location:document.getElementById('df-loc')?.value||'',
          status:'pending', signedAt:null, notes:'',
          accessories:[], checklist:{ docs:false, keys:false, charger:false, manual:false, mats:false, spare:false }
        }
        notes.unshift(n)
        showToast('✅ สร้างใบส่งมอบแล้ว!', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
