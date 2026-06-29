import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const WARRANTY_STATUS = {
  active:   { label: 'มีผล', color: 'success' },
  expiring: { label: 'ใกล้หมด', color: 'warning' },
  expired:  { label: 'หมดอายุ', color: 'danger' },
  claimed:  { label: 'เคลม', color: 'primary' },
  void:     { label: 'ยกเลิก', color: 'secondary' },
}

const WARRANTY_TYPES = {
  factory:   { label: 'รับประกันโรงงาน', icon: '🏭' },
  dealer:    { label: 'รับประกันจากตัวแทน', icon: '🏪' },
  extended:  { label: 'รับประกันเพิ่มเติม', icon: '🛡' },
  parts:     { label: 'รับประกันอะไหล่', icon: '🔩' },
  battery:   { label: 'รับประกันแบตเตอรี่ EV', icon: '🔋' },
}

const CLAIM_STATUS = {
  pending:  { label: 'รอดำเนินการ', color: 'warning' },
  approved: { label: 'อนุมัติ', color: 'success' },
  rejected: { label: 'ปฏิเสธ', color: 'danger' },
  closed:   { label: 'ปิด', color: 'secondary' },
}

const today = new Date()

function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt }
function daysLeft(endDate) { return Math.round((new Date(endDate) - today) / 86400000) }

const DEMO_WARRANTIES = [
  { id: 'W001', customerId: 'C001', customerName: 'วิชาญ มีโชค', phone: '081-234-5678',
    vehiclePlate: 'กก 1234 BKK', brand: 'BYD', model: 'Seal', year: 2024, vin: 'LBWAB2EB7PD002345',
    type: 'factory', startDate: '2024-01-15', endDate: '2027-01-14', km: 100000,
    status: 'active', notes: 'รับประกัน 3 ปี หรือ 100,000 กม.', claims: 0 },
  { id: 'W002', customerId: 'C002', customerName: 'อรนุช สายใจ', phone: '082-345-6789',
    vehiclePlate: 'ขข 5678 BKK', brand: 'BYD', model: 'Atto 3', year: 2023, vin: 'LBWAB2EB7PD003456',
    type: 'battery', startDate: '2023-03-10', endDate: '2031-03-09', km: 160000,
    status: 'active', notes: 'รับประกันแบตเตอรี่ EV 8 ปี หรือ 160,000 กม.', claims: 0 },
  { id: 'W003', customerId: 'C003', customerName: 'ธีรยุทธ เก่งกาจ', phone: '083-456-7890',
    vehiclePlate: 'คค 9012 BKK', brand: 'MG', model: 'ZS EV', year: 2022, vin: 'LSJWSRAR7NE012345',
    type: 'factory', startDate: '2022-06-01', endDate: '2025-05-31', km: 100000,
    status: 'expiring', notes: 'ใกล้หมดอายุ — เสนอต่ออายุ', claims: 2 },
  { id: 'W004', customerId: 'C004', customerName: 'สมหญิง รักรถ', phone: '084-567-8901',
    vehiclePlate: 'งง 3456 BKK', brand: 'Neta', model: 'V', year: 2022, vin: 'LNBSDBEB9PA001234',
    type: 'factory', startDate: '2022-01-01', endDate: '2024-12-31', km: 80000,
    status: 'expired', notes: 'หมดอายุแล้ว', claims: 1 },
  { id: 'W005', customerId: 'C001', customerName: 'วิชาญ มีโชค', phone: '081-234-5678',
    vehiclePlate: 'กก 1234 BKK', brand: 'BYD', model: 'Seal', year: 2024, vin: 'LBWAB2EB7PD002345',
    type: 'extended', startDate: '2027-01-15', endDate: '2029-01-14', km: 200000,
    status: 'active', notes: 'รับประกันเพิ่มเติม 2 ปี', claims: 0 },
]

const DEMO_CLAIMS = [
  { id: 'CL001', warrantyId: 'W003', customerName: 'ธีรยุทธ เก่งกาจ', vehiclePlate: 'คค 9012 BKK',
    type: 'factory', date: '2025-03-15', issue: 'ระบบ AC ขัดข้อง — เสียงดังผิดปกติ',
    status: 'closed', techNote: 'เปลี่ยนคอมเพรสเซอร์ AC ใหม่', cost: 15000, covered: true },
  { id: 'CL002', warrantyId: 'W003', customerName: 'ธีรยุทธ เก่งกาจ', vehiclePlate: 'คค 9012 BKK',
    type: 'factory', date: '2024-11-10', issue: 'จอ Infotainment ค้าง รีสตาร์ทเองบ่อยครั้ง',
    status: 'closed', techNote: 'Update firmware และเปลี่ยนแผงวงจร', cost: 8000, covered: true },
  { id: 'CL003', warrantyId: 'W004', customerName: 'สมหญิง รักรถ', vehiclePlate: 'งง 3456 BKK',
    type: 'factory', date: '2025-05-20', issue: 'ประตูหลังซ้าย – บานพับหลวม',
    status: 'pending', techNote: '', cost: 0, covered: null },
]

export default async function WarrantyManagementPage(container) {
  const myGen = container.__routerGen
  let tab = 'warranties'
  let statusFilter = 'all'
  let typeFilter = 'all'
  let searchQ = ''
  let warranties = [...DEMO_WARRANTIES]
  let claims = [...DEMO_CLAIMS]
  let dataSource = 'demo'

  try {
    const bookings = await listDocs('bookings', [], 'createdAt', 'desc', 500).catch(() => [])
    if (container.__routerGen !== myGen) return
    const delivered = bookings.filter(b => b.status === 'ส่งมอบแล้ว')
    if (delivered.length) {
      const EV_BRANDS = ['BYD', 'MG', 'Neta', 'ORA', 'AION', 'Tesla', 'Ora']
      const addYears = (d, y) => { const dt = new Date(d); dt.setFullYear(dt.getFullYear() + y); return dt.toISOString().slice(0, 10) }
      const live = delivered.map(b => {
        const startDate = (b.actualDeliveryDate || b.updatedAt?.toDate?.()?.toISOString() || '').slice(0, 10)
        const isEV = EV_BRANDS.some(br => (b.brand || '').includes(br))
        return {
          id: 'W-' + b.id, customerId: b.id,
          customerName: b.custName || 'ลูกค้า', phone: b.custPhone || '',
          vehiclePlate: b.plate || '', brand: b.brand || '', model: b.model || '',
          year: new Date(startDate || new Date()).getFullYear(), vin: b.vin || '',
          type: 'factory', startDate, endDate: startDate ? addYears(startDate, 3) : '',
          km: 100000, status: 'active',
          notes: 'รับประกันโรงงาน 3 ปี' + (isEV ? ' / แบตเตอรี่ 8 ปี' : ''),
          claims: 0, _live: true,
        }
      })
      warranties = [...live, ...DEMO_WARRANTIES]
      dataSource = 'live'
    }
  } catch {}

  function getWarrantyStatus(w) {
    const days = daysLeft(w.endDate)
    if (days < 0) return 'expired'
    if (days <= 90) return 'expiring'
    return w.status
  }

  function filtered() {
    return warranties.filter(w => {
      const s = getWarrantyStatus(w)
      if (statusFilter !== 'all' && s !== statusFilter) return false
      if (typeFilter !== 'all' && w.type !== typeFilter) return false
      if (searchQ) {
        const q = searchQ.toLowerCase()
        if (!w.customerName.includes(searchQ) && !w.vehiclePlate.toLowerCase().includes(q) && !w.model.toLowerCase().includes(q)) return false
      }
      return true
    })
  }

  function renderPage() {
    const list = filtered()
    const activeCount = warranties.filter(w => getWarrantyStatus(w) === 'active').length
    const expiringCount = warranties.filter(w => getWarrantyStatus(w) === 'expiring').length
    const expiredCount = warranties.filter(w => getWarrantyStatus(w) === 'expired').length
    const pendingClaims = claims.filter(c => c.status === 'pending').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛡 Warranty Management</div>
            <div class="page-subtitle">จัดการรับประกันและการเคลมสินค้า${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-btn">+ เพิ่มรับประกัน</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('✅ มีผล', activeCount, 'success')}
          ${kpi('⚠️ ใกล้หมด', expiringCount, 'warning')}
          ${kpi('❌ หมดอายุ', expiredCount, 'danger')}
          ${kpi('📋 เคลมรอดำเนิน', pendingClaims, 'primary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${[['warranties','🛡 รับประกันทั้งหมด'],['claims','📋 ประวัติการเคลม'],['expiring','⚠️ ใกล้หมดอายุ']].map(([t,l]) => `<button class="btn btn-sm ${tab===t?'btn-primary':'btn-secondary'} tab-btn" data-t="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'warranties' ? renderWarranties(list) : tab === 'claims' ? renderClaims() : renderExpiring()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('add-btn')?.addEventListener('click', () => openWarrantyForm(null))
    document.getElementById('export-btn')?.addEventListener('click', () => { exportToExcel(list.map(w => ({ ID: w.id, ลูกค้า: w.customerName, ทะเบียน: w.vehiclePlate, รุ่น: w.model, ประเภท: WARRANTY_TYPES[w.type]?.label, วันหมด: w.endDate, สถานะ: WARRANTY_STATUS[getWarrantyStatus(w)]?.label })), 'warranty_report'); showToast('📥 Export แล้ว!', 'success') })
    document.getElementById('search-w')?.addEventListener('input', e => { searchQ = e.target.value; renderPage() })
    document.getElementById('status-filter')?.addEventListener('change', e => { statusFilter = e.target.value; renderPage() })
    document.getElementById('type-filter')?.addEventListener('change', e => { typeFilter = e.target.value; renderPage() })
    document.querySelectorAll('.open-w-btn').forEach(b => b.addEventListener('click', () => { const w = warranties.find(x => x.id === b.dataset.id); if (w) openWarrantyDetail(w) }))
    document.querySelectorAll('.claim-btn').forEach(b => b.addEventListener('click', () => { const w = warranties.find(x => x.id === b.dataset.id); if (w) openClaimForm(w) }))
    document.querySelectorAll('.claim-action-btn').forEach(b => b.addEventListener('click', () => {
      const c = claims.find(x => x.id === b.dataset.id)
      if (!c) return
      c.status = b.dataset.action
      showToast(`✅ อัปเดตสถานะเคลมแล้ว`, 'success')
      renderPage()
    }))
  }

  function renderWarranties(list) {
    return `
      <!-- Filters -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        <input class="input" id="search-w" placeholder="🔍 ค้นหา ชื่อ/ทะเบียน/รุ่น..." value="${escHtml(searchQ)}" style="width:220px">
        <select class="input" id="status-filter" style="width:150px">
          <option value="all">สถานะทั้งหมด</option>
          ${Object.entries(WARRANTY_STATUS).map(([k,v]) => `<option value="${k}" ${statusFilter===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
        <select class="input" id="type-filter" style="width:170px">
          <option value="all">ประเภทรับประกันทั้งหมด</option>
          ${Object.entries(WARRANTY_TYPES).map(([k,v]) => `<option value="${k}" ${typeFilter===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr>
            <th>รหัส</th><th>ลูกค้า</th><th>รถ</th><th>ประเภท</th>
            <th>วันหมดอายุ</th><th>เหลือ</th><th>เคลม</th><th>สถานะ</th><th>การจัดการ</th>
          </tr></thead>
          <tbody>
            ${list.map(w => {
              const s = getWarrantyStatus(w)
              const st = WARRANTY_STATUS[s]
              const days = daysLeft(w.endDate)
              const tp = WARRANTY_TYPES[w.type]
              return `<tr>
                <td><span style="font-family:monospace;font-size:0.8rem">${escHtml(w.id)}</span></td>
                <td>
                  <div style="font-weight:600;font-size:0.85rem">${escHtml(w.customerName)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(w.phone)}</div>
                </td>
                <td>
                  <div style="font-weight:600;font-size:0.85rem">${escHtml(w.vehiclePlate)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(w.brand)} ${escHtml(w.model)} ${w.year}</div>
                </td>
                <td><span style="font-size:0.82rem">${tp?.icon} ${tp?.label}</span></td>
                <td style="font-size:0.83rem">${formatDate(w.endDate)}</td>
                <td style="font-size:0.83rem;color:${days < 0 ? 'var(--danger)' : days <= 90 ? 'var(--warning)' : 'var(--success)'}">
                  ${days < 0 ? `หมดแล้ว ${Math.abs(days)} วัน` : `${days} วัน`}
                </td>
                <td style="text-align:center">${w.claims > 0 ? `<span class="badge badge-warning">${w.claims}</span>` : '<span style="color:var(--text-muted);font-size:0.8rem">-</span>'}</td>
                <td><span class="badge badge-${st.color}">${st.label}</span></td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-xs btn-secondary open-w-btn" data-id="${w.id}">ดู</button>
                    ${s !== 'expired' ? `<button class="btn btn-xs btn-primary claim-btn" data-id="${w.id}">เคลม</button>` : ''}
                  </div>
                </td>
              </tr>`
            }).join('')}
            ${!list.length ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบข้อมูล</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `
  }

  function renderClaims() {
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr>
            <th>รหัส</th><th>ลูกค้า</th><th>ทะเบียน</th><th>วันที่</th><th>ปัญหา</th><th>ค่าใช้จ่าย</th><th>คุ้มครอง</th><th>สถานะ</th><th>การจัดการ</th>
          </tr></thead>
          <tbody>
            ${claims.map(c => {
              const st = CLAIM_STATUS[c.status]
              return `<tr>
                <td style="font-family:monospace;font-size:0.8rem">${escHtml(c.id)}</td>
                <td style="font-size:0.85rem;font-weight:600">${escHtml(c.customerName)}</td>
                <td style="font-size:0.83rem">${escHtml(c.vehiclePlate)}</td>
                <td style="font-size:0.82rem">${formatDate(c.date)}</td>
                <td style="font-size:0.82rem;max-width:200px">${escHtml(c.issue)}</td>
                <td style="font-size:0.82rem">${c.cost > 0 ? formatCurrency(c.cost) : '-'}</td>
                <td>${c.covered === true ? '<span class="badge badge-success">✓ คุ้มครอง</span>' : c.covered === false ? '<span class="badge badge-danger">✗ ไม่คุ้มครอง</span>' : '<span class="badge badge-secondary">รอ</span>'}</td>
                <td><span class="badge badge-${st.color}">${st.label}</span></td>
                <td>
                  ${c.status === 'pending' ? `
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-xs btn-success claim-action-btn" data-id="${c.id}" data-action="approved">✓ อนุมัติ</button>
                      <button class="btn btn-xs btn-danger claim-action-btn" data-id="${c.id}" data-action="rejected">✗ ปฏิเสธ</button>
                    </div>` : '<span style="font-size:0.75rem;color:var(--text-muted)">ดำเนินการแล้ว</span>'}
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderExpiring() {
    const exp = warranties.filter(w => getWarrantyStatus(w) === 'expiring').sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${exp.map(w => {
          const days = daysLeft(w.endDate)
          const tp = WARRANTY_TYPES[w.type]
          return `<div class="card" style="padding:16px;border-left:3px solid var(--warning)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-weight:700;font-size:0.92rem">${escHtml(w.customerName)} — ${escHtml(w.vehiclePlate)}</div>
                <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(w.brand)} ${escHtml(w.model)} · ${tp?.icon} ${tp?.label}</div>
                <div style="font-size:0.8rem;margin-top:6px">หมดอายุ: <strong>${formatDate(w.endDate)}</strong> · เหลือ <strong style="color:var(--warning)">${days} วัน</strong></div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-warning open-w-btn" data-id="${w.id}">ดูรายละเอียด</button>
                <button class="btn btn-sm btn-primary">📞 แจ้งลูกค้า</button>
              </div>
            </div>
          </div>`
        }).join('')}
        ${!exp.length ? `<div class="empty-state"><div class="empty-state-icon">✅</div><div>ไม่มีรับประกันที่ใกล้หมดอายุ</div></div>` : ''}
      </div>
    `
  }

  function openWarrantyDetail(w) {
    const s = getWarrantyStatus(w)
    const st = WARRANTY_STATUS[s]
    const tp = WARRANTY_TYPES[w.type]
    const days = daysLeft(w.endDate)
    const wClaims = claims.filter(c => c.warrantyId === w.id)
    openModal({
      title: '🛡 ' + escHtml(w.id) + ' — รายละเอียดรับประกัน',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">ข้อมูลลูกค้า</div>
            ${row('ชื่อ', escHtml(w.customerName))}${row('โทร', escHtml(w.phone))}${row('ทะเบียน', escHtml(w.vehiclePlate))}${row('รถ', escHtml(`${w.brand} ${w.model} ${w.year}`))}${row('VIN', `<span style="font-family:monospace;font-size:0.78rem">${escHtml(w.vin||'-')}</span>`)}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">ข้อมูลรับประกัน</div>
            ${row('ประเภท', `${tp?.icon} ${tp?.label}`)}${row('วันเริ่ม', formatDate(w.startDate))}${row('วันหมด', formatDate(w.endDate))}${row('ระยะทาง', `${(w.km/1000).toFixed(0)}k กม.`)}${row('สถานะ', `<span class="badge badge-${st.color}">${st.label}</span>`)}${row('เหลือ', `<span style="color:${days<0?'var(--danger)':days<=90?'var(--warning)':'var(--success)'};font-weight:700">${days < 0 ? `หมดแล้ว ${Math.abs(days)} วัน` : `${days} วัน`}</span>`)}
          </div>
        </div>
        <div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted)">${escHtml(w.notes)}</div>
        ${wClaims.length ? `<div style="margin-top:14px"><div style="font-size:0.78rem;font-weight:700;margin-bottom:8px">ประวัติการเคลม (${wClaims.length})</div>${wClaims.map(c => `<div style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px;font-size:0.8rem"><div style="font-weight:600">${escHtml(c.issue)}</div><div style="color:var(--text-muted);margin-top:2px">${formatDate(c.date)} · ${c.techNote ? escHtml(c.techNote) : 'รอดำเนินการ'}</div></div>`).join('')}</div>` : ''}
      `,
      footer: s !== 'expired' ? `<button class="btn btn-primary claim-btn" data-id="${w.id}">📋 ยื่นเคลม</button>` : ''
    })
    setTimeout(() => {
      document.querySelector('.modal .claim-btn')?.addEventListener('click', () => { document.querySelector('.modal-close-btn')?.click(); openClaimForm(w) })
    }, 50)
  }

  function openClaimForm(w) {
    openModal({
      title: '📋 ยื่นเคลมรับประกัน — ' + escHtml(w.vehiclePlate),
      size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ปัญหา / อาการที่พบ</label><textarea class="input" id="claim-issue" rows="3" placeholder="อธิบายปัญหาที่พบ..."></textarea></div>
        <div class="input-group"><label class="input-label">วันที่พบปัญหา</label><input type="date" class="input" id="claim-date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="input-group"><label class="input-label">เลขกิโลปัจจุบัน</label><input type="number" class="input" id="claim-km" placeholder="กม."></div>
      </div>`,
      onConfirm() {
        const issue = document.getElementById('claim-issue')?.value?.trim()
        if (!issue) { showToast('❗ กรุณาระบุปัญหา', 'error'); return }
        const newClaim = { id: `CL${String(claims.length + 1).padStart(3,'0')}`, warrantyId: w.id, customerName: w.customerName, vehiclePlate: w.vehiclePlate, type: w.type, date: document.getElementById('claim-date')?.value, issue, status: 'pending', techNote: '', cost: 0, covered: null }
        claims.unshift(newClaim)
        w.claims++
        showToast('📋 ยื่นเคลมแล้ว รอการอนุมัติ', 'success')
        tab = 'claims'
        renderPage()
      }
    })
  }

  function openWarrantyForm(w) {
    openModal({
      title: w ? `✏️ แก้ไขรับประกัน ${w.id}` : '+ เพิ่มรับประกันใหม่',
      size: 'lg',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="wf-name" value="${escHtml(w?.customerName||'')}"></div>
        <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="wf-phone" value="${escHtml(w?.phone||'')}"></div>
        <div class="input-group"><label class="input-label">ทะเบียนรถ *</label><input class="input" id="wf-plate" value="${escHtml(w?.vehiclePlate||'')}"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="wf-model" value="${escHtml(w?.model||'')}"></div>
        <div class="input-group"><label class="input-label">ประเภทรับประกัน</label>
          <select class="input" id="wf-type">${Object.entries(WARRANTY_TYPES).map(([k,v]) => `<option value="${k}" ${w?.type===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">ระยะทาง (กม.)</label><input type="number" class="input" id="wf-km" value="${w?.km||100000}"></div>
        <div class="input-group"><label class="input-label">วันเริ่ม</label><input type="date" class="input" id="wf-start" value="${w?.startDate||new Date().toISOString().slice(0,10)}"></div>
        <div class="input-group"><label class="input-label">วันหมดอายุ</label><input type="date" class="input" id="wf-end" value="${w?.endDate||''}"></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><input class="input" id="wf-notes" value="${escHtml(w?.notes||'')}"></div>
      </div>`,
      onConfirm() {
        const name = document.getElementById('wf-name')?.value?.trim()
        const plate = document.getElementById('wf-plate')?.value?.trim()
        if (!name || !plate) { showToast('❗ กรุณากรอกข้อมูลที่จำเป็น', 'error'); return }
        if (w) {
          Object.assign(w, { customerName: name, vehiclePlate: plate, type: document.getElementById('wf-type').value, startDate: document.getElementById('wf-start').value, endDate: document.getElementById('wf-end').value, notes: document.getElementById('wf-notes').value })
          showToast('✅ แก้ไขรับประกันแล้ว', 'success')
        } else {
          warranties.unshift({ id: `W${String(warranties.length+1).padStart(3,'0')}`, customerName: name, phone: document.getElementById('wf-phone').value, vehiclePlate: plate, model: document.getElementById('wf-model').value, type: document.getElementById('wf-type').value, startDate: document.getElementById('wf-start').value, endDate: document.getElementById('wf-end').value, km: +document.getElementById('wf-km').value||100000, status: 'active', notes: document.getElementById('wf-notes').value, claims: 0 })
          showToast('✅ เพิ่มรับประกันแล้ว', 'success')
        }
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}

function row(label, value) {
  return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${label}</span><span>${value}</span></div>`
}
