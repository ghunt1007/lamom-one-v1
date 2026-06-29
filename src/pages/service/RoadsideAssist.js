/**
 * Roadside Assist — ช่วยเหลือฉุกเฉิน 24 ชม.
 * Route: /service/roadside
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addMinutes(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const CASE_TYPES = {
  battery_dead: { label: 'แบต 12V หมด', icon: '🔋' },
  out_of_charge:{ label: 'ไฟหมดกลางทาง', icon: '⚡' },
  flat_tire:    { label: 'ยางแบน/รั่ว', icon: '🛞' },
  accident:     { label: 'อุบัติเหตุ', icon: '💥' },
  breakdown:    { label: 'รถเสีย/ขับต่อไม่ได้', icon: '🔧' },
  locked_out:   { label: 'กุญแจ/ล็อครถ', icon: '🔑' },
}

const CASE_STATUS = {
  new:       { label: 'รับแจ้งใหม่!', color: 'danger', icon: '🆕' },
  dispatched:{ label: 'ส่งทีมแล้ว', color: 'warning', icon: '🚐' },
  onsite:    { label: 'ถึงที่เกิดเหตุ', color: 'primary', icon: '📍' },
  resolved:  { label: 'ช่วยเสร็จแล้ว', color: 'success', icon: '✅' },
  towing:    { label: 'ลากเข้าศูนย์', color: 'warning', icon: '🚛' },
}

const DEMO_CASES = [
  { id: 'RA001', customer: 'สมชาย ใจดี', phone: '085-111', plate: '1กข-1234', model: 'BYD Seal', type: 'out_of_charge', location: 'มอเตอร์เวย์ กม.32 ขาออก', status: 'dispatched', reported: addMinutes(18), team: 'ทีมกู้ภัย A (มีตู้ชาร์จเคลื่อนที่)', eta: 15 },
  { id: 'RA002', customer: 'มาลี สุขใจ', phone: '086-222', plate: '2ขค-5678', model: 'BYD Dolphin', type: 'flat_tire', location: 'ห้าง Mega บางนา ลานจอด B2', status: 'onsite', reported: addMinutes(45), team: 'ทีมกู้ภัย B', eta: 0 },
  { id: 'RA003', customer: 'วิรัช เก่งมาก', phone: '089-555', plate: '5จฉ-7890', model: 'BYD Han', type: 'battery_dead', location: 'บ้านลูกค้า ซ.ลาซาล 24', status: 'resolved', reported: addMinutes(150), team: 'ทีมกู้ภัย A', eta: 0 },
  { id: 'RA004', customer: 'ธนพล เที่ยงตรง', phone: '087-333', plate: '3คง-9012', model: 'MG ZS EV', type: 'accident', location: 'แยกบางนา — ชนท้าย', status: 'towing', reported: addMinutes(90), team: 'รถลาก + ประสานประกัน', eta: 20 },
]

export default async function RoadsideAssistPage(container) {
  let cases = DEMO_CASES.map(c => ({ ...c }))

  function renderPage() {
    const active = cases.filter(c => !['resolved'].includes(c.status))
    const newCases = cases.filter(c => c.status === 'new')
    const avgResponse = 22 // นาที

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚨 Roadside Assist</div>
            <div class="page-subtitle">ช่วยเหลือฉุกเฉิน 24 ชม. — Hotline 02-xxx-1669</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-danger" id="new-case-btn" style="font-size:0.95rem">🆘 รับแจ้งเหตุใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚨 เคส active', active.length, active.length > 0 ? 'danger' : 'success')}
          ${kpi('🆕 รอส่งทีม', newCases.length, newCases.length > 0 ? 'danger' : 'success')}
          ${kpi('⏱ Response เฉลี่ย', avgResponse + ' นาที', avgResponse <= 30 ? 'success' : 'warning')}
          ${kpi('✅ ช่วยแล้วเดือนนี้', '23 เคส', 'primary')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${cases.map(c => {
            const ct = CASE_TYPES[c.type]
            const cs = CASE_STATUS[c.status]
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${cs?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${ct?.icon} ${ct?.label} — ${c.plate} (${c.model})</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">👤 ${c.customer} 📞 ${c.phone} · แจ้ง ${timeAgo(c.reported)}</div>
                  <div style="font-size:0.74rem;font-weight:600;color:var(--primary)">📍 ${c.location}</div>
                  ${c.team ? `<div style="font-size:0.72rem;color:var(--text-muted)">🚐 ${c.team}${c.eta > 0 ? ' · ถึงใน ~' + c.eta + ' นาที' : ''}</div>` : ''}
                </div>
                <span class="badge badge-${cs?.color}" style="font-size:0.65rem">${cs?.icon} ${cs?.label}</span>
              </div>
              <div style="display:flex;gap:6px">
                ${c.status === 'new' ? `<button class="btn btn-xs btn-warning dispatch-btn" data-id="${c.id}">🚐 ส่งทีม</button>` : ''}
                ${c.status === 'dispatched' ? `<button class="btn btn-xs btn-primary onsite-btn" data-id="${c.id}">📍 ถึงที่เกิดเหตุ</button>` : ''}
                ${c.status === 'onsite' ? `
                  <button class="btn btn-xs btn-success resolve-btn" data-id="${c.id}">✅ ช่วยเสร็จ — ขับต่อได้</button>
                  <button class="btn btn-xs btn-warning tow-btn" data-id="${c.id}">🚛 ต้องลากเข้าศูนย์</button>` : ''}
                ${c.status === 'towing' ? `<button class="btn btn-xs btn-success arrive-btn" data-id="${c.id}">🏁 ถึงศูนย์ — เปิด Job Card</button>` : ''}
                ${c.status !== 'resolved' ? `<button class="btn btn-xs btn-secondary call-btn" data-id="${c.id}">📞 โทรหาลูกค้า</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.dispatch-btn').forEach(b => b.addEventListener('click', () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (c) openModal({
        title: '🚐 ส่งทีมกู้ภัย',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ทีม</label>
            <select class="input" id="ra-team">
              <option>ทีมกู้ภัย A (มีตู้ชาร์จเคลื่อนที่)</option>
              <option>ทีมกู้ภัย B</option>
              <option>รถลาก + ประสานประกัน</option>
            </select>
          </div>
          <div class="input-group"><label class="input-label">ETA (นาที)</label><input class="input" type="number" id="ra-eta" value="30"></div>
        </div>`,
        onConfirm() {
          c.team = document.getElementById('ra-team')?.value || '—'
          c.eta = parseInt(document.getElementById('ra-eta')?.value) || 30
          c.status = 'dispatched'
          showToast(`🚐 ส่งทีมแล้ว — SMS แจ้งลูกค้า ETA ${c.eta} นาที`, 'warning'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.onsite-btn').forEach(b => b.addEventListener('click', () => {
      const c = cases.find(x => x.id === b.dataset.id); if (c) { c.status = 'onsite'; c.eta = 0; renderPage() }
    }))
    container.querySelectorAll('.resolve-btn').forEach(b => b.addEventListener('click', () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (c) { c.status = 'resolved'; showToast('✅ ปิดเคส — ส่งแบบประเมินความพอใจให้ลูกค้า', 'success'); renderPage() }
    }))
    container.querySelectorAll('.tow-btn').forEach(b => b.addEventListener('click', () => {
      const c = cases.find(x => x.id === b.dataset.id); if (c) { c.status = 'towing'; c.eta = 45; renderPage() }
    }))
    container.querySelectorAll('.arrive-btn').forEach(b => b.addEventListener('click', () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (c) { c.status = 'resolved'; showToast('🏁 รถถึงศูนย์ — เปิด Job Card อัตโนมัติ + จัด Loaner Car ให้ลูกค้า', 'success'); renderPage() }
    }))
    container.querySelectorAll('.call-btn').forEach(b => b.addEventListener('click', () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (!c) return
      c.callLog = (c.callLog || 0) + 1
      showToast(`📞 โทรหา ${c.customer} · ${c.phone} (ครั้งที่ ${c.callLog}) บันทึกแล้ว`, 'success')
      renderPage()
    }))
    document.getElementById('new-case-btn')?.addEventListener('click', () => {
      openModal({
        title: '🆘 รับแจ้งเหตุฉุกเฉิน',
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ทะเบียน/ลูกค้า *</label><input class="input" id="ra-plate" autofocus placeholder="1กข-1234"></div>
          <div class="input-group"><label class="input-label">เบอร์ติดต่อ</label><input class="input" id="ra-phone"></div>
          <div class="input-group"><label class="input-label">ประเภทเหตุ</label>
            <select class="input" id="ra-type">${Object.entries(CASE_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">จุดเกิดเหตุ *</label><input class="input" id="ra-location" placeholder="ถนน/กม./จุดสังเกต"></div>
        </div>`,
        confirmText: '🆘 รับแจ้ง',
        onConfirm() {
          const plate = document.getElementById('ra-plate')?.value?.trim()
          const location = document.getElementById('ra-location')?.value?.trim()
          if (!plate || !location) { showToast('❗ กรอกทะเบียนและจุดเกิดเหตุ', 'error'); return }
          cases.unshift({ id:`RA${String(cases.length+1).padStart(3,'0')}`, customer:'(ค้นจากทะเบียน)', phone:document.getElementById('ra-phone')?.value||'—', plate, model:'—', type:document.getElementById('ra-type')?.value||'breakdown', location, status:'new', reported:new Date().toISOString(), team:null, eta:0 })
          showToast('🆘 รับแจ้งแล้ว — เร่งส่งทีมภายใน 5 นาที!', 'error'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
