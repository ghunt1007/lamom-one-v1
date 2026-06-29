/**
 * Vehicle Transfer — โอนรถระหว่างสาขา
 * Route: /dms/transfer
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const TRANSFER_STATUS = {
  pending:   { label: 'รออนุมัติ', color: 'warning' },
  approved:  { label: 'อนุมัติแล้ว', color: 'primary' },
  in_transit:{ label: 'กำลังขนส่ง', color: 'warning' },
  arrived:   { label: 'ถึงปลายทาง', color: 'success' },
  completed: { label: 'เสร็จสิ้น', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'danger' },
}

const BRANCHES = ['สาขากรุงเทพ', 'สาขาเชียงใหม่', 'สาขาภูเก็ต', 'สาขาขอนแก่น', 'สาขาพัทยา']

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const DEMO_TRANSFERS = [
  { id: 'TRF001', vehiclePlate: 'กก 1234', vehicleModel: 'BYD Seal AWD', color: 'Pearl White', vin: 'LBWAB2EB7PD001', fromBranch: 'สาขากรุงเทพ', toBranch: 'สาขาเชียงใหม่', requestedBy: 'สมชาย ผู้จัดการ', approvedBy: 'วิชัย MD', status: 'in_transit', requestDate: addDays(-3), transferDate: addDays(-1), eta: addDays(1), reason: 'ลูกค้าต้องการเร่งด่วน', trackingNo: 'TH1234567890' },
  { id: 'TRF002', vehiclePlate: 'ขข 5678', vehicleModel: 'MG ZS EV', color: 'Galaxy Black', vin: 'LSJWSRAR7NE002', fromBranch: 'สาขาภูเก็ต', toBranch: 'สาขากรุงเทพ', requestedBy: 'อรวรรณ สาขาภูเก็ต', approvedBy: null, status: 'pending', requestDate: addDays(-1), transferDate: null, eta: null, reason: 'สต็อกส่วนเกิน', trackingNo: null },
  { id: 'TRF003', vehiclePlate: 'คค 9012', vehicleModel: 'BYD Atto 3', color: 'Surf Blue', vin: 'LBWAB2EB7PD003', fromBranch: 'สาขากรุงเทพ', toBranch: 'สาขาพัทยา', requestedBy: 'ปทิตา พัทยา', approvedBy: 'สมชาย ผู้จัดการ', status: 'completed', requestDate: addDays(-14), transferDate: addDays(-12), eta: addDays(-10), reason: 'ลูกค้าจองที่พัทยา', trackingNo: 'TH9876543210' },
]

export default async function VehicleTransferPage(container) {
  const myGen = container.__routerGen
  let transfers = DEMO_TRANSFERS.map(t => ({ ...t }))
  let statusFilter = 'all'
  let dataSource = 'demo'

  try {
    const docs = await listDocs('vehicle_transfers', [], 'requestDate', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `TRF${String(i+1).padStart(3,'0')}`,
        vehiclePlate: d.vehiclePlate || d.plate || '',
        vehicleModel: d.vehicleModel || d.model || '',
        color: d.color || '',
        vin: d.vin || '',
        fromBranch: d.fromBranch || d.from || '',
        toBranch: d.toBranch || d.to || '',
        requestedBy: d.requestedBy || '',
        approvedBy: d.approvedBy || null,
        status: d.status || 'pending',
        requestDate: d.requestDate || d.createdAt?.slice(0,10) || '',
        transferDate: d.transferDate || null,
        eta: d.eta || null,
        reason: d.reason || '',
        trackingNo: d.trackingNo || null,
      }))
      transfers = [...mapped, ...DEMO_TRANSFERS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = transfers.filter(t => statusFilter === 'all' || t.status === statusFilter)
    const inTransit = transfers.filter(t => t.status === 'in_transit').length
    const pending = transfers.filter(t => t.status === 'pending').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚛 Vehicle Transfer</div>
            <div class="page-subtitle">โอนรถระหว่างสาขา — ติดตามสถานะการขนส่ง${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-transfer-btn">+ ขอโอนรถ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚛 โอนทั้งหมด', transfers.length, 'primary')}
          ${kpi('⏳ รออนุมัติ', pending, pending > 0 ? 'warning' : 'secondary')}
          ${kpi('🚚 กำลังขนส่ง', inTransit, inTransit > 0 ? 'primary' : 'secondary')}
          ${kpi('✅ เสร็จสิ้น', transfers.filter(t=>t.status==='completed').length, 'success')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(TRANSFER_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(t => {
            const st = TRANSFER_STATUS[t.status]
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${st?.color})">
              <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                <div>
                  <div style="font-weight:700">${escHtml(t.id)} — ${escHtml(t.vehicleModel)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(t.vehiclePlate)} · ${escHtml(t.color)} · VIN: ${escHtml(t.vin)}</div>
                </div>
                <span class="badge badge-${st?.color}">${st?.label}</span>
              </div>

              <!-- Transfer route -->
              <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:10px">
                <div style="text-align:center">
                  <div style="font-size:0.7rem;color:var(--text-muted)">ต้นทาง</div>
                  <div style="font-weight:700;font-size:0.85rem">🏢 ${escHtml(t.fromBranch)}</div>
                </div>
                <div style="flex:1;text-align:center;font-size:1.2rem">→</div>
                <div style="text-align:center">
                  <div style="font-size:0.7rem;color:var(--text-muted)">ปลายทาง</div>
                  <div style="font-weight:700;font-size:0.85rem">🏢 ${escHtml(t.toBranch)}</div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
                <div><div style="font-size:0.68rem;color:var(--text-muted)">ขอโดย</div><div style="font-size:0.82rem">${escHtml(t.requestedBy)}</div></div>
                <div><div style="font-size:0.68km;color:var(--text-muted)">วันที่ขอ</div><div style="font-size:0.82rem">${formatDate(t.requestDate)}</div></div>
                ${t.eta ? `<div><div style="font-size:0.68rem;color:var(--text-muted)">ETA</div><div style="font-size:0.82rem;font-weight:700">${formatDate(t.eta)}</div></div>` : '<div></div>'}
              </div>

              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-secondary view-btn" data-id="${escHtml(t.id)}">ดูรายละเอียด</button>
                ${t.status === 'pending' ? `<button class="btn btn-xs btn-success approve-btn" data-id="${escHtml(t.id)}">✓ อนุมัติ</button>` : ''}
                ${t.status === 'approved' ? `<button class="btn btn-xs btn-primary transit-btn" data-id="${escHtml(t.id)}">🚚 เริ่มขนส่ง</button>` : ''}
                ${t.status === 'in_transit' ? `<button class="btn btn-xs btn-success arrived-btn" data-id="${escHtml(t.id)}">📍 ถึงปลายทาง</button>` : ''}
              </div>
            </div>`
          }).join('')}
          ${!list.length ? '<div class="empty-state"><div class="empty-state-icon">🚛</div><div>ไม่พบรายการโอน</div></div>' : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-transfer-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const t = transfers.find(x => x.id === b.dataset.id); if (t) openDetail(t)
    }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => {
      const t = transfers.find(x => x.id === b.dataset.id)
      if (t) { t.status = 'approved'; t.approvedBy = 'ผู้จัดการ'; showToast('✅ อนุมัติโอนรถแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.transit-btn').forEach(b => b.addEventListener('click', () => {
      const t = transfers.find(x => x.id === b.dataset.id)
      if (t) { t.status = 'in_transit'; t.transferDate = addDays(0); t.eta = addDays(2); t.trackingNo = 'TH' + Math.floor(Math.random()*9000000000+1000000000); showToast('🚚 เริ่มขนส่งแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.arrived-btn').forEach(b => b.addEventListener('click', () => {
      const t = transfers.find(x => x.id === b.dataset.id)
      if (t) { t.status = 'completed'; showToast('📍 บันทึกถึงปลายทางแล้ว!', 'success'); renderPage() }
    }))
  }

  function openDetail(t) {
    const st = TRANSFER_STATUS[t.status]
    openModal({
      title: `🚛 ${t.id}`,
      size: 'md',
      body: `
        <div style="margin-bottom:10px"><span class="badge badge-${st?.color}">${st?.label}</span></div>
        ${row('รถ', t.vehicleModel + ' ' + t.color)}
        ${row('ทะเบียน', t.vehiclePlate)}
        ${row('ต้นทาง', t.fromBranch)}
        ${row('ปลายทาง', t.toBranch)}
        ${row('ขอโดย', t.requestedBy)}
        ${t.approvedBy ? row('อนุมัติโดย', t.approvedBy) : ''}
        ${row('เหตุผล', t.reason)}
        ${t.trackingNo ? row('Tracking No.', t.trackingNo) : ''}
        ${t.eta ? row('ETA', formatDate(t.eta)) : ''}
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ ขอโอนรถ',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ทะเบียน *</label><input class="input" id="tf-plate" placeholder="กก 1234"></div>
          <div class="input-group"><label class="input-label">รุ่น</label><input class="input" id="tf-model" placeholder="BYD Seal AWD"></div>
          <div class="input-group"><label class="input-label">ต้นทาง</label>
            <select class="input" id="tf-from">${BRANCHES.map(b=>`<option>${b}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ปลายทาง</label>
            <select class="input" id="tf-to">${BRANCHES.map(b=>`<option>${b}</option>`).join('')}</select>
          </div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">เหตุผล</label><input class="input" id="tf-reason" placeholder="เหตุผลที่ขอโอน"></div>
        </div>
      `,
      onConfirm() {
        const plate = document.getElementById('tf-plate')?.value?.trim()
        if (!plate) { showToast('❗ กรุณากรอกทะเบียน', 'error'); return }
        const from = document.getElementById('tf-from')?.value
        const to = document.getElementById('tf-to')?.value
        if (from === to) { showToast('❗ ต้นทางและปลายทางต้องต่างกัน', 'error'); return }
        transfers.unshift({
          id: `TRF${String(transfers.length+1).padStart(3,'0')}`,
          vehiclePlate: plate, vehicleModel: document.getElementById('tf-model')?.value||'', color: '',
          vin: '', fromBranch: from, toBranch: to, requestedBy: 'ผู้ใช้ปัจจุบัน',
          approvedBy: null, status: 'pending', requestDate: addDays(0),
          transferDate: null, eta: null, reason: document.getElementById('tf-reason')?.value||'', trackingNo: null
        })
        showToast('✅ ส่งคำขอโอนรถแล้ว!', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${escHtml(String(v ?? ''))}</span></div>` }
