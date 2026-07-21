import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, readDoc, createDoc } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fullName(c) {
  return `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.custName || c.name || 'ลูกค้า'
}

const JOB_STATUS = {
  waiting:       { label: 'รอรับรถ',     color: 'primary', icon: '⏳' },
  checkin:       { label: 'รับรถแล้ว',   color: 'accent',  icon: '🔑' },
  diagnosing:    { label: 'วินิจฉัย',    color: 'primary', icon: '🔍' },
  inprogress:    { label: 'กำลังซ่อม',   color: 'warning', icon: '🔧' },
  waiting_parts: { label: 'รออะไหล่',    color: 'danger',  icon: '📦' },
  qc:            { label: 'QC ตรวจสอบ', color: 'success', icon: '✅' },
  done:          { label: 'เสร็จแล้ว',   color: 'success', icon: '🏁' },
  delivered:     { label: 'ส่งคืนแล้ว',  color: 'primary', icon: '🚗' },
}

const JOB_TYPE_LABEL = {
  warranty: 'ซ่อมรับประกัน', service: 'เข้าศูนย์บริการ', repair: 'ซ่อมทั่วไป', accident: 'งานชน/ประกัน', recall: 'Recall',
}

const DOC_TYPE_LABEL = {
  quotation: 'ใบเสนอราคา', invoice: 'ใบแจ้งหนี้', receipt: 'ใบเสร็จ', tax_invoice: 'ใบกำกับภาษี', credit_note: 'ใบลดหนี้',
}
const DOC_STATUS_LABEL = { draft: 'Draft', sent: 'ส่งแล้ว', paid: 'ชำระแล้ว', overdue: 'เกินกำหนด', cancelled: 'ยกเลิก' }

const SERVICE_TYPES = [
  'เช็กระยะ 10,000 km', 'เช็กระยะ 20,000 km', 'เปลี่ยนถ่ายน้ำมัน', 'ตรวจสภาพรถ',
  'แก้ไขปัญหา / ซ่อม', 'ติดตั้งอุปกรณ์', 'รับประกัน (Warranty)', 'อื่นๆ',
]

const ACTIVE_JOB_STATUSES = ['checkin', 'diagnosing', 'inprogress', 'waiting_parts', 'qc']

function warrantyExpiryOf(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  d.setFullYear(d.getFullYear() + 3)
  return d.toISOString().slice(0, 10)
}

function docTotal(d) {
  return (d.items || []).reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.price) || 0) * (1 + (Number(i.vat) || 0) / 100), 0)
}

export default async function CustomerPortalPage(container) {
  const myGen = container.__routerGen

  let customers = []
  let search = ''
  let selectedId = null
  let cust = null
  let loadingCust = false
  let tab = 'home'

  try { customers = await listDocs('customers', [], 'createdAt', 'desc', 500) } catch { customers = [] }
  if (container.__routerGen !== myGen) return

  function filteredCustomers() {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return customers.filter(c => fullName(c).toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q))
  }

  function dropdownHtml(matches) {
    if (!search) return ''
    return `<div class="card" style="position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:30;max-height:280px;overflow:auto;padding:4px">
      ${matches.length ? matches.slice(0, 8).map(c => `<div class="portal-pick" data-id="${c.id}" style="padding:8px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.82rem">
          <div style="font-weight:600">${escHtml(fullName(c))}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(c.phone || '-')}${c.email ? ' · ' + escHtml(c.email) : ''}</div>
        </div>`).join('') : `<div style="padding:10px;font-size:0.8rem;color:var(--text-muted)">ไม่พบลูกค้า</div>`}
    </div>`
  }

  function bindDropdownClicks() {
    document.querySelectorAll('.portal-pick').forEach(el => el.addEventListener('click', () => {
      const c = customers.find(x => x.id === el.dataset.id)
      if (c) selectCustomer(c)
    }))
  }

  async function buildCustomerView(c) {
    const name = fullName(c)
    const phone = c.phone || ''

    // ── หา booking ที่เชื่อมกับลูกค้าคนนี้ (bookingId → customerId → เบอร์โทร) ──
    let bookings = []
    try {
      if (c.id) bookings = await listDocs('bookings', [['customerId', '==', c.id]], 'createdAt', 'desc', 20).catch(() => [])
      if (!bookings.length && c.bookingId) {
        const b = await readDoc('bookings', c.bookingId).catch(() => null)
        if (b) bookings = [b]
      }
      if (!bookings.length && phone) {
        bookings = await listDocs('bookings', [['phone', '==', phone]], 'createdAt', 'desc', 20).catch(() => [])
      }
    } catch {}

    const vehicles = bookings.filter(b => b.brand || b.model).map(b => {
      const purchaseDate = b.actualDeliveryDate || b.deliveryDate || b.bookingDate || ''
      return {
        id: b.id,
        model: `${b.brand || ''} ${b.model || ''} ${b.variant || ''}`.trim() || 'รถยนต์',
        plate: b.whitePlate || b.redPlate || '-',
        color: b.colorOut || '-',
        year: purchaseDate ? purchaseDate.slice(0, 4) : '-',
        vin: b.vin || '-',
        purchaseDate,
        warrantyExpiry: warrantyExpiryOf(purchaseDate),
        status: b.status || '',
        bookingNo: b.bookingNo || '',
      }
    })
    const plates = vehicles.map(v => v.plate).filter(p => p && p !== '-')

    // ── job_cards: จับคู่ด้วยเบอร์โทรก่อน (มีตรงตัว) → ชื่อลูกค้า ──
    let jobs = []
    try {
      if (phone) jobs = await listDocs('job_cards', [['phone', '==', phone]], 'createdAt', 'desc', 100).catch(() => [])
      if (!jobs.length) {
        const all = await listDocs('job_cards', [], 'createdAt', 'desc', 500).catch(() => [])
        jobs = all.filter(j => j.custName && j.custName.trim() === name.trim())
      }
    } catch {}

    // ── insurance_policies: ไม่มี FK ตรง — จับคู่ด้วยทะเบียนรถ หรือชื่อลูกค้า ──
    let insurance = []
    try {
      const all = await listDocs('insurance_policies', [], 'endDate', 'asc', 500).catch(() => [])
      insurance = all.filter(p => (p.plate && plates.includes(p.plate)) || (p.custName && p.custName.trim() === name.trim()))
    } catch {}

    // ── invoices: จับคู่ด้วยชื่อลูกค้า ──
    let documents = []
    try {
      const all = await listDocs('invoices', [], 'date', 'desc', 500).catch(() => [])
      documents = all.filter(d => d.custName && d.custName.trim() === name.trim())
    } catch {}

    return { id: c.id, raw: c, name, phone, email: c.email || '', vehicles, jobs, insurance, documents }
  }

  function renderPage() {
    const matches = filteredCustomers()
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="card" style="padding:14px 16px;margin-bottom:18px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
            <div>
              <div style="font-weight:700;font-size:0.95rem">👁 Customer Portal — มุมมองพนักงาน</div>
              <div style="font-size:0.76rem;color:var(--text-muted)">ดูสิ่งที่ลูกค้าเห็นเมื่อเข้าพอร์ทัลของตัวเอง เลือกลูกค้าเพื่อดูข้อมูลจริงของเขา</div>
            </div>
            <div style="position:relative;flex:1;min-width:240px;max-width:360px">
              <input class="input" id="portal-search" placeholder="🔍 ค้นหาลูกค้า ชื่อ/เบอร์โทร/อีเมล..." value="${escHtml(search)}" autocomplete="off">
              <div id="portal-dropdown">${dropdownHtml(matches)}</div>
            </div>
          </div>
        </div>

        <div id="portal-body">
          ${!selectedId ? emptyPicker() : loadingCust ? loadingState() : cust ? customerContent() : `<div class="empty-state" style="padding:48px"><div class="empty-icon">❓</div><div class="empty-title">ไม่พบข้อมูลลูกค้า</div></div>`}
        </div>
      </div>
    `

    bindDropdownClicks()
    const searchEl = document.getElementById('portal-search')
    searchEl?.addEventListener('input', e => {
      search = e.target.value
      const dd = document.getElementById('portal-dropdown')
      if (dd) dd.innerHTML = dropdownHtml(filteredCustomers())
      bindDropdownClicks()
    })

    if (!cust) return

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('portal-switch')?.addEventListener('click', () => { selectedId = null; cust = null; search = ''; tab = 'home'; renderPage() })
    document.getElementById('book-submit')?.addEventListener('click', async () => {
      const vehSel = document.getElementById('book-vehicle')
      const typeSel = document.getElementById('book-type')
      const dateInp = document.getElementById('book-date')
      const timeSel = document.getElementById('book-time')
      const noteInp = document.getElementById('book-note')
      const chosenVeh = cust.vehicles[vehSel ? vehSel.selectedIndex : 0] || {}
      const btn = document.getElementById('book-submit')
      btn.disabled = true
      try {
        await createDoc('service_appointments', {
          custName: cust.name, phone: cust.phone,
          model: chosenVeh.model || '', plate: chosenVeh.plate || '',
          type: typeSel?.value || SERVICE_TYPES[0],
          date: dateInp?.value || new Date().toISOString().slice(0, 10),
          time: timeSel?.value || '09:00',
          note: noteInp?.value?.trim() || '',
          status: 'scheduled',
        })
        showToast('📅 ส่งคำขอนัดหมายแล้ว ทีมงานจะติดต่อยืนยัน', 'success')
        tab = 'home'; renderPage()
      } catch {
        showToast('❗ ส่งคำขอไม่สำเร็จ กรุณาลองใหม่', 'error')
        btn.disabled = false
      }
    })
    container.querySelectorAll('.dl-btn').forEach(btn => btn.addEventListener('click', () => {
      const doc = cust.documents.find(d => d.id === btn.dataset.id)
      if (!doc) return
      const typeLabel = DOC_TYPE_LABEL[doc.type] || doc.type
      const total = docTotal(doc)
      openModal({
        title: `📄 ${typeLabel} — ${doc.no}`,
        size: 'sm',
        body: `
          <div style="font-size:0.82rem">
            <div style="text-align:center;padding:20px 0;border-bottom:1px solid var(--border);margin-bottom:14px">
              <div style="font-size:2rem;margin-bottom:6px">📄</div>
              <div style="font-weight:700;font-size:1rem">${escHtml(typeLabel)}</div>
              <div style="font-size:0.76rem;color:var(--text-muted);margin-top:2px">${escHtml(doc.no)}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">วันที่</span><span>${escHtml(doc.date || '-')}</span></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">ลูกค้า</span><span>${escHtml(cust.name)}</span></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">รายการ</span><span>${escHtml(cust.vehicles[0]?.model || '-')}</span></div>
              <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
                <span style="font-weight:700">จำนวนเงิน</span>
                <span style="font-weight:700;color:var(--primary);font-size:1rem">${formatCurrency(total)}</span>
              </div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">สถานะ</span><span>${escHtml(DOC_STATUS_LABEL[doc.status] || doc.status || '-')}</span></div>
            </div>
          </div>
        `
      })
    }))
  }

  async function selectCustomer(c) {
    selectedId = c.id
    search = ''
    loadingCust = true
    tab = 'home'
    renderPage()
    const view = await buildCustomerView(c)
    if (container.__routerGen !== myGen) return
    cust = view
    loadingCust = false
    renderPage()
  }

  function emptyPicker() {
    return `<div class="empty-state" style="padding:60px 20px">
      <div class="empty-icon" style="font-size:2.2rem">🔍</div>
      <div class="empty-title">ค้นหาลูกค้าเพื่อดูพอร์ทัลของเขา</div>
      <div style="font-size:0.82rem;color:var(--text-muted);margin-top:6px">พิมพ์ชื่อหรือเบอร์โทรในช่องค้นหาด้านบน</div>
    </div>`
  }

  function loadingState() {
    return `<div style="display:flex;flex-direction:column;gap:10px">
      ${[1, 2, 3].map(() => `<div class="skeleton" style="height:80px;border-radius:var(--radius-md)"></div>`).join('')}
    </div>`
  }

  function customerContent() {
    const c = cust
    const activeJob = c.jobs.find(j => ACTIVE_JOB_STATUSES.includes(j.status))
    return `
      <!-- Portal Header -->
      <div style="background:linear-gradient(135deg,var(--primary),var(--accent));padding:24px 20px;border-radius:var(--radius-lg);margin-bottom:20px;color:white">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:1.4rem">👤</div>
          <div style="flex:1">
            <div style="font-size:1.1rem;font-weight:700">สวัสดีคุณ ${escHtml(c.name)}</div>
            <div style="opacity:0.85;font-size:0.82rem">${escHtml(c.phone || '-')} ${c.email ? '· ' + escHtml(c.email) : ''}</div>
          </div>
          <button class="btn btn-sm" id="portal-switch" style="background:rgba(255,255,255,0.2);color:#fff;border:none">🔁 เปลี่ยนลูกค้า</button>
        </div>
        ${activeJob ? `<div style="margin-top:14px;background:rgba(255,255,255,0.15);padding:10px 14px;border-radius:var(--radius-sm)">
          <div style="font-size:0.8rem;opacity:0.85;margin-bottom:2px">🔧 งานที่กำลังดำเนินการ</div>
          <div style="font-weight:700">${escHtml(activeJob.jobNo || '')} — ${escHtml(activeJob.desc || JOB_TYPE_LABEL[activeJob.type] || '')}</div>
          <div style="font-size:0.78rem;opacity:0.85">ช่าง: ${escHtml(activeJob.techName || 'ยังไม่ระบุ')}</div>
        </div>` : ''}
      </div>

      <!-- Quick tabs -->
      <div style="display:flex;gap:4px;margin-bottom:16px;overflow-x:auto">
        ${[['home', '🏠 ภาพรวม'], ['vehicles', '🚗 รถของฉัน'], ['service', '🔧 งานซ่อม'], ['docs', '📄 เอกสาร'], ['insurance', '🛡 ประกัน'], ['book', '📅 นัดซ่อม']].map(([t, l]) => `<button class="btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'} tab-btn" data-t="${t}" style="white-space:nowrap">${l}</button>`).join('')}
      </div>

      ${tab === 'home' ? renderHome(c) : tab === 'vehicles' ? renderVehicles(c) : tab === 'service' ? renderService(c) : tab === 'docs' ? renderDocs(c) : tab === 'insurance' ? renderInsurance(c) : renderBooking(c)}
    `
  }

  function renderHome(c) {
    return `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${!c.vehicles.length && !c.jobs.length && !c.insurance.length && !c.documents.length ? `<div class="empty-state" style="padding:36px"><div class="empty-icon">📭</div><div class="empty-title">ยังไม่มีข้อมูลของลูกค้าคนนี้ในระบบ</div></div>` : ''}

        <!-- Vehicle summary -->
        ${c.vehicles.map(v => `<div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:4px">🚗 ${escHtml(v.model)}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);display:grid;grid-template-columns:1fr 1fr;gap:4px">
            <div>ทะเบียน: ${escHtml(v.plate)}</div>
            <div>สี: ${escHtml(v.color)}</div>
            <div>ปี: ${escHtml(v.year)}</div>
            <div>รับประกัน: ${v.warrantyExpiry ? escHtml(v.warrantyExpiry) : '-'}</div>
          </div>
        </div>`).join('')}

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          ${miniStat('🔧 งานซ่อม', c.jobs.length + ' ครั้ง')}
          ${miniStat('🛡 ประกันภัย', c.insurance.length + ' กรมธรรม์')}
          ${miniStat('📄 เอกสาร', c.documents.length + ' ฉบับ')}
        </div>
      </div>
    `
  }

  function renderVehicles(c) {
    if (!c.vehicles.length) return `<div class="empty-state" style="padding:36px"><div class="empty-icon">🚗</div><div class="empty-title">ยังไม่พบรถที่เชื่อมกับลูกค้าคนนี้</div></div>`
    return c.vehicles.map(v => `
      <div class="card" style="padding:20px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="font-size:2.5rem">🚗</div>
          <div>
            <div style="font-size:1.1rem;font-weight:700">${escHtml(v.model)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(v.plate)} · ${escHtml(v.color)} · ปี ${escHtml(v.year)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.83rem">
          <div><div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:2px">VIN</div><div style="font-family:monospace">${escHtml(v.vin)}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:2px">วันที่รับรถ</div><div>${v.purchaseDate ? formatDate(v.purchaseDate) : '-'}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:2px">รับประกัน</div><div style="color:var(--success);font-weight:600">${v.warrantyExpiry ? 'ถึง ' + formatDate(v.warrantyExpiry) : '-'}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:2px">สถานะใบจอง</div><div>${escHtml(v.status || '-')}</div></div>
        </div>
      </div>
    `).join('')
  }

  function renderService(c) {
    if (!c.jobs.length) return `<div class="empty-state" style="padding:36px"><div class="empty-icon">🔧</div><div class="empty-title">ยังไม่มีประวัติงานซ่อม</div></div>`
    return `<div style="display:flex;flex-direction:column;gap:10px">
      ${c.jobs.map(j => {
        const st = JOB_STATUS[j.status] || { label: j.status || '-', color: 'primary', icon: '❔' }
        return `<div class="card" style="padding:16px;${ACTIVE_JOB_STATUSES.includes(j.status) ? 'border-left:3px solid var(--warning)' : ''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
            <div>
              <div style="font-weight:700;font-size:0.9rem">${escHtml(j.jobNo || '-')}</div>
              <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(JOB_TYPE_LABEL[j.type] || j.type || '-')}</div>
            </div>
            <span class="badge badge-${st.color}">${st.icon} ${escHtml(st.label)}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-size:0.78rem;color:var(--text-muted)">
            <div>📅 ${j.createdAt ? formatDate(j.createdAt) : '-'}</div>
            <div>🔧 ช่าง: ${escHtml(j.techName || 'ยังไม่ระบุ')}</div>
            ${j.labor ? `<div>💰 ${formatCurrency(j.labor)}</div>` : ''}
          </div>
          ${j.desc ? `<div style="margin-top:8px;font-size:0.78rem;background:var(--surface-2);padding:6px 10px;border-radius:var(--radius-sm)">📝 ${escHtml(j.desc)}</div>` : ''}
        </div>`
      }).join('')}
    </div>`
  }

  function renderDocs(c) {
    if (!c.documents.length) return `<div class="empty-state" style="padding:36px"><div class="empty-icon">📄</div><div class="empty-title">ยังไม่มีเอกสาร</div></div>`
    return `<div class="card" style="padding:0;overflow:hidden">
      <table class="table">
        <thead><tr><th>เลขที่</th><th>ประเภท</th><th>วันที่</th><th class="text-right">จำนวน</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>
          ${c.documents.map(d => `<tr>
            <td style="font-family:monospace;font-size:0.8rem">${escHtml(d.no)}</td>
            <td style="font-size:0.82rem">${escHtml(DOC_TYPE_LABEL[d.type] || d.type || '-')}</td>
            <td style="font-size:0.8rem">${escHtml(d.date || '-')}</td>
            <td class="text-right" style="font-weight:700">${formatCurrency(docTotal(d))}</td>
            <td><span class="badge badge-${d.status === 'paid' ? 'success' : d.status === 'overdue' ? 'danger' : 'primary'}">${escHtml(DOC_STATUS_LABEL[d.status] || d.status || '-')}</span></td>
            <td><button class="btn btn-xs btn-secondary dl-btn" data-id="${d.id}">📥</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`
  }

  function renderInsurance(c) {
    if (!c.insurance.length) return `<div class="empty-state" style="padding:36px"><div class="empty-icon">🛡</div><div class="empty-title">ยังไม่มีกรมธรรม์ประกันภัย</div></div>`
    return c.insurance.map(ins => `
      <div class="card" style="padding:20px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="font-size:2rem">🛡</div>
          <div>
            <div style="font-weight:700">${escHtml(ins.insurer || '-')} — ${escHtml(ins.type || '-')}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(ins.plate || '-')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.83rem">
          <div><div style="color:var(--text-muted);font-size:0.72rem">เบี้ยประกัน</div><div style="font-weight:700">${formatCurrency(ins.premium || 0)}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem">เริ่มคุ้มครอง</div><div>${ins.startDate ? formatDate(ins.startDate) : '-'}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem">สิ้นสุด</div><div style="color:var(--warning);font-weight:600">${ins.endDate ? formatDate(ins.endDate) : '-'}</div></div>
        </div>
      </div>
    `).join('')
  }

  function renderBooking(c) {
    const today = new Date().toISOString().slice(0, 10)
    if (!c.vehicles.length) {
      return `<div class="card" style="padding:20px">
        <div class="empty-state" style="padding:0">
          <div class="empty-icon">🚗</div>
          <div class="empty-title">ต้องมีรถที่เชื่อมกับลูกค้าก่อนจึงจะนัดหมายได้</div>
        </div>
      </div>`
    }
    return `
      <div class="card" style="padding:20px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:14px">📅 ขอนัดหมายงานซ่อม</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">รถที่ต้องการนำเข้าซ่อม</label>
            <select class="input" id="book-vehicle">
              ${c.vehicles.map(v => `<option>${escHtml(v.model)} (${escHtml(v.plate)})</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">ประเภทงาน</label>
            <select class="input" id="book-type">
              ${SERVICE_TYPES.map(t => `<option>${escHtml(t)}</option>`).join('')}
            </select>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันที่ต้องการ</label><input class="input" type="date" id="book-date" value="${today}"></div>
            <div class="input-group"><label class="input-label">เวลาที่ต้องการ</label>
              <select class="input" id="book-time">
                ${['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map(t => `<option>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="input-group"><label class="input-label">อาการ / รายละเอียด</label><textarea class="input" id="book-note" rows="3" placeholder="อธิบายอาการหรือสิ่งที่ต้องการ..."></textarea></div>
          <button class="btn btn-primary" id="book-submit">📅 ส่งคำขอนัดหมาย</button>
        </div>
      </div>
    `
  }

  function miniStat(label, value) {
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;text-align:center">
      <div style="font-size:0.85rem;font-weight:700">${value}</div>
      <div style="font-size:0.72rem;color:var(--text-muted)">${label}</div>
    </div>`
  }

  renderPage()
}
