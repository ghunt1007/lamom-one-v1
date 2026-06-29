/**
 * Call Log — บันทึกสายโทรเข้า-ออก
 * Route: /comms/calls
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addMinutes(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const CALL_TYPES = {
  inbound:  { label: 'สายเข้า', color: 'primary', icon: '📥' },
  outbound: { label: 'โทรออก', color: 'success', icon: '📤' },
  missed:   { label: 'สายที่ไม่ได้รับ', color: 'danger', icon: '📵' },
}

const CALL_TOPICS = {
  sales:    { label: 'สอบถามรถ', icon: '🚗' },
  service:  { label: 'นัด/สอบถามบริการ', icon: '🔧' },
  complaint:{ label: 'ร้องเรียน', icon: '📢' },
  finance:  { label: 'การเงิน/ค้างชำระ', icon: '💰' },
  other:    { label: 'อื่นๆ', icon: '📌' },
}

const DEMO_CALLS = [
  { id: 'C001', type: 'inbound', topic: 'sales', caller: 'สมหญิง รักรถ', phone: '081-234-5678', duration: 420, staff: 'สุดา มาดี', time: addMinutes(15), note: 'ถามโปร Dolphin — นัดเข้ามาดูพรุ่งนี้ 14:00', followUp: true, followed: false },
  { id: 'C002', type: 'missed', topic: 'other', caller: 'ไม่ทราบ', phone: '02-987-6543', duration: 0, staff: null, time: addMinutes(35), note: '', followUp: true, followed: false },
  { id: 'C003', type: 'outbound', topic: 'service', caller: 'สมชาย ใจดี', phone: '085-111-2222', duration: 180, staff: 'วิทยา ช่างใหญ่', time: addMinutes(60), note: 'แจ้งรถซ่อมเสร็จแล้ว นัดรับพรุ่งนี้', followUp: false, followed: false },
  { id: 'C004', type: 'inbound', topic: 'complaint', caller: 'ประยุทธ ไม่พอใจ', phone: '089-333-4444', duration: 660, staff: 'ผจก.บริการ', time: addMinutes(120), note: 'ไม่พอใจรอนาน — ผจก.รับเรื่องแล้ว เปิดเคสร้องเรียน', followUp: true, followed: true },
  { id: 'C005', type: 'inbound', topic: 'finance', caller: 'มาลี สุขใจ', phone: '086-222-3333', duration: 240, staff: 'สมศรี การเงิน', time: addMinutes(200), note: 'ถามยอดค้างค่าอะไหล่ — แจ้งยอดแล้ว จะโอนพรุ่งนี้', followUp: false, followed: false },
  { id: 'C006', type: 'outbound', topic: 'sales', caller: 'ประพันธ์ มั่งมี', phone: '081-111-9999', duration: 540, staff: 'วิชัย ยอดขาย', time: addMinutes(300), note: 'Follow-up หลัง Test Drive — ขอคิดถึงศุกร์นี้', followUp: true, followed: false },
]

function fmtDur(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return m + ':' + String(s).padStart(2, '0') + ' นาที'
}

export default async function CallLogPage(container) {
  const myGen = container.__routerGen
  let calls = DEMO_CALLS.map(c => ({ ...c }))
  let dataSource = 'demo'
  let typeFilter = 'all'

  try {
    const docs = await listDocs('call_logs', [], 'time', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `CL${i+1}`,
        type: d.type || 'inbound',
        topic: d.topic || 'other',
        caller: d.caller || d.customerName || 'ไม่ทราบ',
        phone: d.phone || '',
        duration: d.duration || 0,
        staff: d.staff || d.staffName || null,
        time: d.time || d.createdAt || new Date().toISOString(),
        note: d.note || d.notes || '',
        followUp: d.followUp || false,
        followed: d.followed || false,
      }))
      calls = [...mapped, ...DEMO_CALLS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = calls.filter(c => typeFilter === 'all' || c.type === typeFilter)
    const missed = calls.filter(c => c.type === 'missed').length
    const needFollow = calls.filter(c => c.followUp && !c.followed).length
    const totalDur = calls.reduce((a, c) => a + c.duration, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">☎️ Call Log</div>
            <div class="page-subtitle">บันทึกสายโทรเข้า-ออก — วันนี้${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-call-btn">+ บันทึกสาย</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('☎️ สายวันนี้', calls.length, 'primary')}
          ${kpi('📵 ไม่ได้รับ', missed, missed > 0 ? 'danger' : 'success')}
          ${kpi('📞 รอ Follow-up', needFollow, needFollow > 0 ? 'warning' : 'success')}
          ${kpi('⏱ เวลาสายรวม', Math.round(totalDur/60) + ' นาที', 'secondary')}
        </div>

        ${missed > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            📵 <strong>มีสายที่ไม่ได้รับ ${missed} สาย</strong> — โทรกลับภายใน 15 นาทีเพิ่มโอกาสปิดดีล 10 เท่า
          </div>
        ` : ''}

        <!-- Type filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(CALL_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(c => {
            const ct = CALL_TYPES[c.type]
            const tp = CALL_TOPICS[c.topic]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${ct?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px">
                <div>
                  <div style="font-weight:700;font-size:0.84rem">${ct?.icon} ${escHtml(c.caller)} <span style="font-size:0.7rem;color:var(--text-muted)">${escHtml(c.phone)}</span></div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${tp?.icon} ${tp?.label} · ${fmtDur(c.duration)} ${c.staff ? '· 👤 ' + escHtml(c.staff) : ''} · ${timeAgo(c.time)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
                  <span class="badge badge-${ct?.color}" style="font-size:0.6rem">${ct?.label}</span>
                  ${c.followUp ? (c.followed
                    ? '<span class="badge badge-success" style="font-size:0.58rem">✅ ติดตามแล้ว</span>'
                    : '<span class="badge badge-warning" style="font-size:0.58rem">⏳ รอติดตาม</span>') : ''}
                </div>
              </div>
              ${c.note ? `<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:6px">📝 ${escHtml(c.note)}</div>` : ''}
              <div style="display:flex;gap:6px">
                ${c.type === 'missed' ? `<button class="btn btn-xs btn-danger callback-btn" data-id="${c.id}">📞 โทรกลับด่วน</button>` : ''}
                ${c.followUp && !c.followed ? `<button class="btn btn-xs btn-success follow-btn" data-id="${c.id}">✅ ติดตามแล้ว</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.callback-btn').forEach(b => b.addEventListener('click', () => {
      const c = calls.find(x => x.id === b.dataset.id)
      if (c) { c.type = 'outbound'; c.followed = true; c.staff = 'คุณ (Demo)'; c.note = 'โทรกลับแล้ว'; showToast('📞 บันทึกการโทรกลับ ' + c.phone, 'success'); renderPage() }
    }))
    container.querySelectorAll('.follow-btn').forEach(b => b.addEventListener('click', () => {
      const c = calls.find(x => x.id === b.dataset.id); if (c) { c.followed = true; renderPage() }
    }))
    document.getElementById('add-call-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ บันทึกสาย',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อผู้โทร/ผู้รับ *</label><input class="input" id="cl-caller"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="cl-phone"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="cl-type">${Object.entries(CALL_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เรื่อง</label>
            <select class="input" id="cl-topic">${Object.entries(CALL_TOPICS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">บันทึก</label><input class="input" id="cl-note"></div>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer">
            <input type="checkbox" id="cl-follow" style="accent-color:var(--primary)"> ต้องติดตามต่อ
          </label>
        </div>`,
        onConfirm() {
          const caller = document.getElementById('cl-caller')?.value?.trim()
          if (!caller) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
          calls.unshift({ id:`C${String(calls.length+1).padStart(3,'0')}`, type:document.getElementById('cl-type')?.value||'inbound', topic:document.getElementById('cl-topic')?.value||'other', caller, phone:document.getElementById('cl-phone')?.value||'—', duration:0, staff:'คุณ (Demo)', time:new Date().toISOString(), note:document.getElementById('cl-note')?.value||'', followUp:document.getElementById('cl-follow')?.checked||false, followed:false })
          showToast('✅ บันทึกสายแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
