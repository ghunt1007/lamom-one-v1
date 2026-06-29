/**
 * Overtime Tracking — ติดตาม OT
 * Route: /hr/overtime
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const OT_STATUS = {
  pending:  { label: 'รออนุมัติ', color: 'warning', icon: '⏳' },
  approved: { label: 'อนุมัติแล้ว', color: 'success', icon: '✅' },
  rejected: { label: 'ไม่อนุมัติ', color: 'danger', icon: '❌' },
  paid:     { label: 'จ่ายแล้ว', color: 'secondary', icon: '💸' },
}

const OT_RATE = 1.5 // เท่าของค่าจ้างปกติ

const DEMO_OT = [
  { id: 'OT001', staff: 'วิทยา ช่างใหญ่', dept: 'บริการ', date: addDays(-1), hours: 3, hourlyRate: 219, reason: 'ซ่อมรถลูกค้าด่วน — ต้องส่งมอบพรุ่งนี้', status: 'pending' },
  { id: 'OT002', staff: 'สุรชัย มือดี', dept: 'บริการ', date: addDays(-1), hours: 2, hourlyRate: 200, reason: 'EV Diagnostic เคสซับซ้อน', status: 'pending' },
  { id: 'OT003', staff: 'วิชัย ยอดขาย', dept: 'ขาย', date: addDays(-3), hours: 4, hourlyRate: 188, reason: 'งาน Motor Show — บูธถึง 22:00', status: 'approved' },
  { id: 'OT004', staff: 'สมศรี การเงิน', dept: 'การเงิน', date: addDays(-5), hours: 3, hourlyRate: 263, reason: 'ปิดงบเดือน', status: 'paid' },
  { id: 'OT005', staff: 'มานะ ขยัน', dept: 'บริการ', date: addDays(-7), hours: 5, hourlyRate: 156, reason: 'ค้างงานซ่อมสีตัวถัง', status: 'rejected' },
]

const MONTHLY_BY_STAFF = [
  { name: 'วิทยา ช่างใหญ่', hours: 18, limit: 36 },
  { name: 'สุรชัย มือดี', hours: 14, limit: 36 },
  { name: 'วิชัย ยอดขาย', hours: 12, limit: 36 },
  { name: 'มานะ ขยัน', hours: 28, limit: 36 },
  { name: 'สมศรี การเงิน', hours: 8, limit: 36 },
]

function otPay(o) { return Math.round(o.hours * o.hourlyRate * OT_RATE) }

export default async function OvertimeTrackingPage(container) {
  let records = DEMO_OT.map(o => ({ ...o }))
  let statusFilter = 'all'

  function renderPage() {
    const list = records.filter(o => statusFilter === 'all' || o.status === statusFilter)
    const pending = records.filter(o => o.status === 'pending')
    const monthHours = records.filter(o => o.status !== 'rejected').reduce((a, o) => a + o.hours, 0)
    const monthCost = records.filter(o => ['approved','paid'].includes(o.status)).reduce((a, o) => a + otPay(o), 0)
    const nearLimit = MONTHLY_BY_STAFF.filter(s => s.hours / s.limit >= 0.75)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⏱ Overtime Tracking</div>
            <div class="page-subtitle">ติดตาม OT — อนุมัติ คำนวณ (อัตรา ×${OT_RATE})</div>
          </div>
          <div class="page-actions">
            ${pending.length > 0 ? `<button class="btn btn-success" id="approve-all-btn">✅ อนุมัติทั้งหมด (${pending.length})</button>` : ''}
            <button class="btn btn-primary" id="add-ot-btn">+ บันทึก OT</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⏱ OT เดือนนี้', monthHours + ' ชม.', 'primary')}
          ${kpi('💰 ค่า OT', formatCurrency(monthCost), 'warning')}
          ${kpi('⏳ รออนุมัติ', pending.length, pending.length > 0 ? 'warning' : 'success')}
          ${kpi('⚠️ ใกล้เพดาน', nearLimit.length + ' คน', nearLimit.length > 0 ? 'danger' : 'success')}
        </div>

        <!-- Monthly hours by staff -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 ชั่วโมง OT สะสมเดือนนี้ (เพดาน ${MONTHLY_BY_STAFF[0].limit} ชม./เดือน ตามกฎหมาย)</div>
          ${MONTHLY_BY_STAFF.map(s => {
            const pct = Math.round(s.hours / s.limit * 100)
            const color = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'success'
            return `<div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
                <span>${s.name}</span><span style="color:var(--${color})">${s.hours}/${s.limit} ชม. (${pct}%)</span>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:8px">
                <div style="width:${pct}%;background:var(--${color});height:8px;border-radius:3px"></div>
              </div>
            </div>`
          }).join('')}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(OT_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- OT records -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(o => {
            const os = OT_STATUS[o.status]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${os?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.85rem">${escHtml(o.staff)} <span style="font-size:0.7rem;color:var(--text-muted)">· ${escHtml(o.dept)}</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">📅 ${formatDate(o.date)} · ⏱ ${o.hours} ชม. × ${formatCurrency(o.hourlyRate)} × ${OT_RATE}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted);font-style:italic">📌 ${escHtml(o.reason)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${os?.color}" style="font-size:0.62rem">${os?.icon} ${os?.label}</span>
                  <div style="font-size:0.88rem;font-weight:700;color:var(--success)">${formatCurrency(otPay(o))}</div>
                </div>
              </div>
              ${o.status === 'pending' ? `
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-success approve-btn" data-id="${o.id}">✅ อนุมัติ</button>
                  <button class="btn btn-xs btn-danger reject-btn" data-id="${o.id}">❌ ไม่อนุมัติ</button>
                </div>
              ` : ''}
              ${o.status === 'approved' ? `<button class="btn btn-xs btn-secondary pay-btn" data-id="${o.id}">💸 จ่ายพร้อมเงินเดือน</button>` : ''}
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => {
      const o = records.find(x => x.id === b.dataset.id); if (o) { o.status = 'approved'; showToast('✅ อนุมัติ OT แล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => {
      const o = records.find(x => x.id === b.dataset.id); if (o) { o.status = 'rejected'; renderPage() }
    }))
    container.querySelectorAll('.pay-btn').forEach(b => b.addEventListener('click', () => {
      const o = records.find(x => x.id === b.dataset.id); if (o) { o.status = 'paid'; showToast('💸 ส่งเข้ารอบเงินเดือนแล้ว', 'success'); renderPage() }
    }))
    document.getElementById('approve-all-btn')?.addEventListener('click', () => {
      records.filter(o => o.status === 'pending').forEach(o => { o.status = 'approved' })
      showToast('✅ อนุมัติ OT ทั้งหมดแล้ว', 'success'); renderPage()
    })
    document.getElementById('add-ot-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ บันทึก OT',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">พนักงาน *</label>
            <select class="input" id="ot-staff">${MONTHLY_BY_STAFF.map(s=>`<option>${s.name}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">วันที่</label><input class="input" type="date" id="ot-date" value="${addDays(0)}"></div>
          <div class="input-group"><label class="input-label">จำนวนชั่วโมง</label><input class="input" type="number" min="0.5" max="8" step="0.5" id="ot-hours" value="2"></div>
          <div class="input-group"><label class="input-label">เหตุผล *</label><input class="input" id="ot-reason"></div>
        </div>`,
        onConfirm() {
          const reason = document.getElementById('ot-reason')?.value?.trim()
          if (!reason) { showToast('❗ กรุณากรอกเหตุผล', 'error'); return }
          records.unshift({ id:`OT${String(records.length+1).padStart(3,'0')}`, staff:document.getElementById('ot-staff')?.value||'—', dept:'—', date:document.getElementById('ot-date')?.value||addDays(0), hours:parseFloat(document.getElementById('ot-hours')?.value)||1, hourlyRate:200, reason, status:'pending' })
          showToast('✅ บันทึก OT แล้ว — รออนุมัติ', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
