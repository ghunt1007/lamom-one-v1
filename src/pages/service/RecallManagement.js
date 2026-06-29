/**
 * Recall Management — จัดการการเรียกคืนรถ
 * Route: /service/recall
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const RECALL_STATUS = {
  open:       { label: 'เปิดอยู่', color: 'danger' },
  in_progress:{ label: 'กำลังดำเนินการ', color: 'warning' },
  completed:  { label: 'เสร็จสิ้น', color: 'success' },
  closed:     { label: 'ปิดแล้ว', color: 'secondary' },
}

const VEHICLE_STATUS = {
  pending_contact: { label: 'ยังไม่ติดต่อ', color: 'secondary' },
  contacted:       { label: 'ติดต่อแล้ว', color: 'primary' },
  scheduled:       { label: 'นัดแล้ว', color: 'warning' },
  fixed:           { label: 'แก้ไขแล้ว', color: 'success' },
  declined:        { label: 'ปฏิเสธ', color: 'danger' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_RECALLS = [
  {
    id: 'RC001', title: 'BYD Seal: Software Update v3.2.1 (BMS Fix)', brand: 'BYD', model: 'Seal AWD',
    recallNo: 'BYD-TH-2025-001', status: 'in_progress', severity: 'high',
    issueDate: addDays(-30), deadline: addDays(90), fixDescription: 'อัพเดต Firmware BMS แก้ปัญหาการชาร์จในอุณหภูมิสูง',
    totalVehicles: 18, fixed: 12, pending: 6, declined: 0, laborHours: 0.5, partsCost: 0
  },
  {
    id: 'RC002', title: 'MG ZS EV: เปลี่ยนสายไฟ On-Board Charger', brand: 'MG', model: 'ZS EV',
    recallNo: 'MGT-2025-EV-002', status: 'open', severity: 'critical',
    issueDate: addDays(-14), deadline: addDays(60), fixDescription: 'เปลี่ยนชุดสายไฟ OBC ป้องกันความร้อนสูงเกิน',
    totalVehicles: 8, fixed: 0, pending: 8, declined: 0, laborHours: 2, partsCost: 4500
  },
  {
    id: 'RC003', title: 'BYD Atto 3: Airbag Module Replacement', brand: 'BYD', model: 'Atto 3',
    recallNo: 'BYD-TH-2024-012', status: 'completed', severity: 'critical',
    issueDate: addDays(-180), deadline: addDays(-10), fixDescription: 'เปลี่ยน Airbag Module ทั้งหมด',
    totalVehicles: 15, fixed: 14, pending: 0, declined: 1, laborHours: 3, partsCost: 12000
  },
]

const DEMO_VEHICLES = [
  { vin: 'LBWAB2EB7PD001001', plate: 'กก 1234', owner: 'วิชัย มีโชค', phone: '085-xxx', recallId: 'RC001', vStatus: 'fixed', appointDate: addDays(-5) },
  { vin: 'LBWAB2EB7PD001002', plate: 'กก 5678', owner: 'สุดา ขยัน', phone: '086-xxx', recallId: 'RC001', vStatus: 'scheduled', appointDate: addDays(3) },
  { vin: 'LBWAB2EB7PD001003', plate: 'กก 9012', owner: 'ธนา เก่ง', phone: '087-xxx', recallId: 'RC001', vStatus: 'contacted', appointDate: null },
  { vin: 'LSJWSRAR7NE001001', plate: 'ขข 1234', owner: 'อรวรรณ ดี', phone: '088-xxx', recallId: 'RC002', vStatus: 'pending_contact', appointDate: null },
  { vin: 'LSJWSRAR7NE001002', plate: 'ขข 5678', owner: 'ปทิตา สาวสวย', phone: '089-xxx', recallId: 'RC002', vStatus: 'pending_contact', appointDate: null },
]

export default async function RecallManagementPage(container) {
  let recalls = DEMO_RECALLS.map(r => ({ ...r }))
  let vehicles = DEMO_VEHICLES.map(v => ({ ...v }))
  let selectedRecall = null

  function renderPage() {
    const open = recalls.filter(r => r.status === 'open').length
    const critical = recalls.filter(r => r.severity === 'critical').length
    const totalPending = recalls.reduce((a, r) => a + r.pending, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔔 Recall Management</div>
            <div class="page-subtitle">จัดการการเรียกคืนและแจ้งเตือนรถ</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 Recall ทั้งหมด', recalls.length, 'primary')}
          ${kpi('🔴 เปิดอยู่', open, open > 0 ? 'danger' : 'secondary')}
          ${kpi('⚠️ Critical', critical, critical > 0 ? 'danger' : 'secondary')}
          ${kpi('🚗 รอซ่อม', totalPending + ' คัน', totalPending > 0 ? 'warning' : 'secondary')}
        </div>

        <div style="display:grid;grid-template-columns:${selectedRecall ? '1fr 1fr' : '1fr'};gap:14px">
          <!-- Recall list -->
          <div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${recalls.map(r => {
                const st = RECALL_STATUS[r.status]
                const progressPct = Math.round(r.fixed / r.totalVehicles * 100)
                const isSelected = selectedRecall?.id === r.id
                return `<div class="card recall-card" data-id="${r.id}" style="padding:14px;cursor:pointer;border-left:3px solid var(--${st?.color});${isSelected?'box-shadow:0 0 0 2px var(--primary)':''}">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <div>
                      <div style="font-weight:700;font-size:0.88rem">${r.title}</div>
                      <div style="font-size:0.72rem;color:var(--text-muted)">${r.recallNo} · ${r.brand} ${r.model}</div>
                    </div>
                    <div style="text-align:right">
                      <span class="badge badge-${st?.color}" style="font-size:0.65rem">${st?.label}</span>
                      <div style="font-size:0.65rem;margin-top:2px;color:${r.severity==='critical'?'var(--danger)':'var(--warning)'}">${r.severity === 'critical' ? '🔴 Critical' : '🟡 High'}</div>
                    </div>
                  </div>
                  <div style="margin-bottom:6px">
                    <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:2px">
                      <span style="color:var(--text-muted)">ความคืบหน้า ${r.fixed}/${r.totalVehicles} คัน</span>
                      <span style="font-weight:700;color:${progressPct>=80?'var(--success)':progressPct>=50?'var(--warning)':'var(--danger)'}">${progressPct}%</span>
                    </div>
                    <div style="background:var(--surface-2);border-radius:3px;height:6px">
                      <div style="width:${progressPct}%;background:${progressPct>=80?'var(--success)':progressPct>=50?'var(--warning)':'var(--danger)'};height:6px;border-radius:3px"></div>
                    </div>
                  </div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">Deadline: ${formatDate(r.deadline)}</div>
                </div>`
              }).join('')}
            </div>
          </div>

          <!-- Vehicle list for selected recall -->
          ${selectedRecall ? `
            <div>
              <div style="font-weight:700;margin-bottom:10px;font-size:0.9rem">🚗 รายการรถใน ${selectedRecall.id}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">${selectedRecall.fixDescription}</div>
              ${vehicles.filter(v => v.recallId === selectedRecall.id).map(v => {
                const vs = VEHICLE_STATUS[v.vStatus]
                return `<div class="card" style="padding:10px;margin-bottom:6px;border-left:3px solid var(--${vs?.color})">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <div>
                      <div style="font-weight:600;font-size:0.83rem">${v.plate} — ${v.owner}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">${v.phone}</div>
                    </div>
                    <span class="badge badge-${vs?.color}" style="font-size:0.62rem">${vs?.label}</span>
                  </div>
                  ${v.appointDate ? `<div style="font-size:0.72rem;color:var(--text-muted)">นัด: ${formatDate(v.appointDate)}</div>` : ''}
                  <div style="display:flex;gap:4px;margin-top:6px">
                    ${v.vStatus === 'pending_contact' ? `<button class="btn btn-xs btn-primary contact-veh-btn" data-vin="${v.vin}">📞 ติดต่อ</button>` : ''}
                    ${v.vStatus === 'contacted' ? `<button class="btn btn-xs btn-warning schedule-veh-btn" data-vin="${v.vin}">📅 นัด</button>` : ''}
                    ${v.vStatus === 'scheduled' ? `<button class="btn btn-xs btn-success fix-veh-btn" data-vin="${v.vin}">✅ แก้ไขแล้ว</button>` : ''}
                  </div>
                </div>`
              }).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.recall-card').forEach(el => el.addEventListener('click', () => {
      const r = recalls.find(x => x.id === el.dataset.id)
      selectedRecall = selectedRecall?.id === r?.id ? null : r
      renderPage()
    }))

    container.querySelectorAll('.contact-veh-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation()
      const v = vehicles.find(x => x.vin === b.dataset.vin)
      if (v) { v.vStatus = 'contacted'; showToast('📞 ติดต่อลูกค้าแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.schedule-veh-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation()
      const v = vehicles.find(x => x.vin === b.dataset.vin)
      if (v) { v.vStatus = 'scheduled'; v.appointDate = addDays(5); showToast('📅 นัดหมายแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.fix-veh-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation()
      const v = vehicles.find(x => x.vin === b.dataset.vin)
      if (v) {
        v.vStatus = 'fixed'
        const recall = recalls.find(r => r.id === v.recallId)
        if (recall) { recall.fixed++; recall.pending-- }
        showToast('✅ บันทึกการแก้ไขแล้ว!', 'success'); renderPage()
      }
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
