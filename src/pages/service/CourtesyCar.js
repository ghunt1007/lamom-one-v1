/**
 * Pickup & Delivery — บริการรับ-ส่งรถลูกค้า
 * Route: /service/pickup
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addHours(n) { const d = new Date(); d.setHours(d.getHours() + n); return d.toISOString() }

const PD_STATUS = {
  scheduled: { label: 'นัดแล้ว', color: 'secondary', icon: '📅' },
  enroute:   { label: 'คนขับกำลังไป', color: 'primary', icon: '🚗' },
  picked:    { label: 'รับรถแล้ว', color: 'warning', icon: '✅' },
  servicing: { label: 'อยู่ศูนย์บริการ', color: 'warning', icon: '🔧' },
  returning: { label: 'กำลังส่งคืน', color: 'primary', icon: '🔙' },
  completed: { label: 'ส่งคืนแล้ว', color: 'success', icon: '🏁' },
}

const PD_TYPE = {
  pickup:   { label: 'รับรถมาซ่อม', icon: '📥' },
  delivery: { label: 'ส่งรถคืน', icon: '📤' },
  both:     { label: 'รับ-ส่งครบวงจร', icon: '🔄' },
}

const DRIVERS = ['สมบัติ ขับดี', 'อนันต์ ปลอดภัย']

const DEMO_JOBS = [
  { id: 'PD001', customer: 'สมชาย ใจดี', phone: '085-111', plate: '1กข-1234', address: 'คอนโด Ideo สุขุมวิท 93', distance: 8, type: 'both', status: 'servicing', driver: 'สมบัติ ขับดี', scheduledAt: addHours(-3), service: 'เช็คระยะ 20,000 km' },
  { id: 'PD002', customer: 'มาลี สุขใจ', phone: '086-222', plate: '2ขค-5678', address: 'หมู่บ้านพฤกษา บางนา', distance: 5, type: 'pickup', status: 'enroute', driver: 'อนันต์ ปลอดภัย', scheduledAt: addHours(0), service: 'เปลี่ยนยาง 4 เส้น' },
  { id: 'PD003', customer: 'ธนพล เที่ยงตรง', phone: '087-333', plate: '3คง-9012', address: 'ออฟฟิศ Empire Tower สาทร', distance: 15, type: 'delivery', status: 'scheduled', driver: null, scheduledAt: addHours(4), service: 'ซ่อมเสร็จแล้ว — รอส่งคืน' },
  { id: 'PD004', customer: 'อรทัย ตั้งใจ', phone: '088-444', plate: '4งจ-3456', address: 'บ้านเดี่ยว ลาดกระบัง', distance: 12, type: 'both', status: 'completed', driver: 'สมบัติ ขับดี', scheduledAt: addHours(-26), service: 'ตรวจแบตเตอรี่' },
]

const NEXT = { scheduled: 'enroute', enroute: 'picked', picked: 'servicing', servicing: 'returning', returning: 'completed' }

export default async function CourtesyCarPage(container) {
  let jobs = DEMO_JOBS.map(j => ({ ...j }))

  function renderPage() {
    const active = jobs.filter(j => j.status !== 'completed').length
    const todayJobs = jobs.length
    const totalKm = jobs.reduce((a, j) => a + j.distance * (j.type === 'both' ? 2 : 1), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 Pickup & Delivery</div>
            <div class="page-subtitle">บริการรับ-ส่งรถลูกค้า — ฟรีในรัศมี 10 กม.</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-pd-btn">+ นัดรับ-ส่ง</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔄 งานวันนี้', todayJobs, 'primary')}
          ${kpi('🚗 กำลังดำเนินการ', active, active > 0 ? 'warning' : 'success')}
          ${kpi('🛣 ระยะทางรวม', totalKm + ' km', 'secondary')}
          ${kpi('👷 คนขับ', DRIVERS.length + ' คน', 'secondary')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${jobs.map(j => {
            const ps = PD_STATUS[j.status]
            const pt = PD_TYPE[j.type]
            const next = NEXT[j.status]
            const isFree = j.distance <= 10
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${ps?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.86rem">${escHtml(j.plate)} — ${escHtml(j.customer)} <span style="font-size:0.7rem;color:var(--text-muted)">📞 ${escHtml(j.phone)}</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">📍 ${escHtml(j.address)} (${j.distance} km ${isFree ? '— ฟรี' : '— คิดเพิ่ม'})</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🔧 ${escHtml(j.service)}</div>
                  ${j.driver ? `<div style="font-size:0.72rem;color:var(--text-muted)">👷 ${escHtml(j.driver)}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${ps?.color}" style="font-size:0.62rem">${ps?.icon} ${ps?.label}</span>
                  <span class="badge badge-secondary" style="font-size:0.6rem">${pt?.icon} ${pt?.label}</span>
                  <span style="font-size:0.68rem;color:var(--text-muted)">${timeAgo(j.scheduledAt)}</span>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                ${j.status === 'scheduled' && !j.driver ? `<button class="btn btn-xs btn-primary assign-btn" data-id="${j.id}">👷 มอบหมายคนขับ</button>` : ''}
                ${next && j.driver ? `<button class="btn btn-xs btn-${PD_STATUS[next]?.color} next-btn" data-id="${j.id}">${PD_STATUS[next]?.icon} → ${PD_STATUS[next]?.label}</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.assign-btn').forEach(b => b.addEventListener('click', () => {
      const j = jobs.find(x => x.id === b.dataset.id)
      if (j) openModal({
        title: '👷 มอบหมายคนขับ',
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">คนขับ</label>
          <select class="input" id="pd-driver">${DRIVERS.map(d=>`<option>${d}</option>`).join('')}</select></div>`,
        onConfirm() { j.driver = document.getElementById('pd-driver')?.value || DRIVERS[0]; showToast('👷 มอบหมายแล้ว', 'success'); renderPage() }
      })
    }))
    container.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', () => {
      const j = jobs.find(x => x.id === b.dataset.id)
      if (j) {
        j.status = NEXT[j.status]
        if (j.status === 'completed') showToast('🏁 ส่งรถคืนเรียบร้อย — ส่ง SMS ขอบคุณลูกค้าแล้ว', 'success')
        renderPage()
      }
    }))
    document.getElementById('add-pd-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ นัดรับ-ส่งรถ',
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="pd-name"></div>
          <div class="input-group"><label class="input-label">ทะเบียน</label><input class="input" id="pd-plate"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ที่อยู่รับ/ส่ง</label><input class="input" id="pd-address"></div>
          <div class="input-group"><label class="input-label">ระยะทาง (km)</label><input class="input" type="number" id="pd-distance" value="5"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="pd-type">${Object.entries(PD_TYPE).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">งานบริการ</label><input class="input" id="pd-service"></div>
        </div>`,
        onConfirm() {
          const name = document.getElementById('pd-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
          jobs.unshift({ id:`PD${String(jobs.length+1).padStart(3,'0')}`, customer:name, phone:'—', plate:document.getElementById('pd-plate')?.value||'—', address:document.getElementById('pd-address')?.value||'—', distance:parseInt(document.getElementById('pd-distance')?.value)||5, type:document.getElementById('pd-type')?.value||'pickup', status:'scheduled', driver:null, scheduledAt:new Date().toISOString(), service:document.getElementById('pd-service')?.value||'—' })
          showToast('✅ นัดรับ-ส่งแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
