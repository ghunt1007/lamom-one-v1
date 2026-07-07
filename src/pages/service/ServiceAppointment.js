import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const APPT_STATUS = {
  scheduled: { label: 'นัดแล้ว', color: 'primary' },
  confirmed: { label: 'ยืนยัน', color: 'success' },
  inservice:  { label: 'กำลังซ่อม', color: 'warning' },
  done:       { label: 'เสร็จ', color: 'success' },
  cancelled:  { label: 'ยกเลิก', color: 'danger' },
  noshow:     { label: 'ไม่มา', color: 'danger' },
}

const SERVICE_TYPES = [
  'เช็กระยะ 10,000 km', 'เช็กระยะ 20,000 km', 'เปลี่ยนถ่ายน้ำมัน', 'ตรวจสภาพรถ',
  'แก้ไขปัญหา / ซ่อม', 'ติดตั้งอุปกรณ์', 'รับประกัน (Warranty)', 'อื่นๆ'
]

const TECHS = ['วิชัย ช่างดี', 'ธนา ซ่อมเก่ง', 'สมศักดิ์ ช่างใหม่', 'อรุณ ช่างเก่า']

export default async function ServiceAppointmentPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let appts = []
  let viewDate = new Date().toISOString().slice(0, 10)
  let viewMode = 'day' // day | week | list
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { appts = await listDocs('service_appointments', [], 'date', 'desc', 500) } catch (e) { appts = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getFiltered() {
    let list = appts
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter)
    if (viewMode === 'day') list = list.filter(a => a.date === viewDate)
    else if (viewMode === 'week') {
      const d = new Date(viewDate)
      const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      list = list.filter(a => a.date >= mon.toISOString().slice(0,10) && a.date <= sun.toISOString().slice(0,10))
    }
    return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  }

  function getStats() {
    const today = new Date().toISOString().slice(0,10)
    const todayAppts = appts.filter(a => a.date === today)
    return {
      total: todayAppts.length,
      confirmed: todayAppts.filter(a => a.status === 'confirmed').length,
      inservice: todayAppts.filter(a => a.status === 'inservice').length,
      done: todayAppts.filter(a => a.status === 'done').length,
    }
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const s = getStats()
    const filtered = getFiltered()
    const today = new Date().toISOString().slice(0,10)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📅 Service Appointment</div>
            <div class="page-subtitle">การนัดหมายงานซ่อม</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-appt-btn">➕ นัดใหม่</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('📅 นัดวันนี้', s.total, 'primary')}
          ${kpi('✅ ยืนยันแล้ว', s.confirmed, 'success')}
          ${kpi('🔧 กำลังซ่อม', s.inservice, 'warning')}
          ${kpi('🏁 เสร็จแล้ว', s.done, 'success')}
        </div>

        <!-- View controls -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            ${['day','week','list'].map(m => `<button class="btn btn-sm ${viewMode===m?'btn-primary':'btn-secondary'} vm-btn" data-m="${m}">${{day:'วัน',week:'สัปดาห์',list:'รายการ'}[m]}</button>`).join('')}
          </div>
          ${viewMode !== 'list' ? `<input type="date" class="input" id="view-date" value="${viewDate}" style="width:160px">` : ''}
          <div style="display:flex;gap:4px;margin-left:auto">
            <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
            ${Object.entries(APPT_STATUS).slice(0,4).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- Appointment cards / table -->
        ${filtered.length ? `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${filtered.map(a => renderApptCard(a)).join('')}
          </div>
        ` : `
          <div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">ไม่มีการนัดหมาย</div><div class="empty-desc">ในช่วงเวลาที่เลือก</div></div>
        `}
      </div>
    `

    document.getElementById('new-appt-btn')?.addEventListener('click', () => openApptForm())
    document.querySelectorAll('.vm-btn').forEach(b => b.addEventListener('click', () => { viewMode = b.dataset.m; renderPage() }))
    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('view-date')?.addEventListener('change', e => { viewDate = e.target.value; renderPage() })
    document.querySelectorAll('.appt-status-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const id = btn.dataset.id; const status = btn.dataset.status
        const a = appts.find(x => x.id === id)
        if (!a) return
        try {
          await updateDocData('service_appointments', a.id, { status })
          showToast(`✅ อัพเดตสถานะเป็น "${APPT_STATUS[status].label}"`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })
    document.querySelectorAll('.appt-card').forEach(card => {
      card.addEventListener('click', () => {
        const a = appts.find(x => x.id === card.dataset.id)
        if (a) openApptDetail(a)
      })
    })
  }

  function renderApptCard(a) {
    const st = APPT_STATUS[a.status]
    const isToday = a.date === new Date().toISOString().slice(0,10)
    return `
      <div class="appt-card" data-id="${a.id}" style="
        padding:14px 16px;background:var(--surface);border:1px solid var(--border);
        border-radius:var(--radius-md);cursor:pointer;display:flex;align-items:center;gap:16px;
        ${isToday?'border-left:3px solid var(--primary);':''}
      ">
        <!-- Time block -->
        <div style="min-width:54px;text-align:center;flex-shrink:0">
          <div style="font-size:1.2rem;font-weight:800;color:var(--primary)">${a.time}</div>
          ${viewMode !== 'day' ? `<div style="font-size:0.68rem;color:var(--text-muted)">${a.date}</div>` : ''}
        </div>
        <!-- Info -->
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
            <span style="font-weight:700;font-size:0.9rem">${escHtml(a.custName)}</span>
            <span class="badge badge-${st.color}" style="font-size:0.65rem">${st.label}</span>
            ${isToday ? '<span class="badge badge-accent" style="font-size:0.65rem">วันนี้</span>' : ''}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(a.model)} · ${escHtml(a.plate)} · ${escHtml(a.type)}</div>
          ${a.note ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">📝 ${escHtml(a.note)}</div>` : ''}
        </div>
        <!-- Tech -->
        <div style="text-align:center;flex-shrink:0;font-size:0.78rem;color:var(--text-muted)">
          🔧 ${escHtml(a.tech || 'ยังไม่ได้มอบหมาย')}
        </div>
        <!-- Quick status -->
        <div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
          ${a.status === 'scheduled' ? `<button class="btn btn-xs btn-success appt-status-btn" data-id="${a.id}" data-status="confirmed">ยืนยัน</button>` : ''}
          ${a.status === 'confirmed' ? `<button class="btn btn-xs btn-warning appt-status-btn" data-id="${a.id}" data-status="inservice">เริ่มซ่อม</button>` : ''}
          ${a.status === 'inservice' ? `<button class="btn btn-xs btn-success appt-status-btn" data-id="${a.id}" data-status="done">เสร็จ</button>` : ''}
          ${['scheduled','confirmed'].includes(a.status) ? `<button class="btn btn-xs btn-danger appt-status-btn" data-id="${a.id}" data-status="cancelled">ยกเลิก</button>` : ''}
        </div>
      </div>
    `
  }

  function openApptForm(appt = null) {
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: appt ? '✏️ แก้ไขนัดหมาย' : '📅 นัดหมายใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="ap-cust" value="${escHtml(appt?.custName||'')}" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="ap-phone" value="${escHtml(appt?.phone||'')}" placeholder="08x-xxx-xxxx"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="ap-model" value="${escHtml(appt?.model||'')}" placeholder="เช่น BYD Seal AWD"></div>
          <div class="input-group"><label class="input-label">ทะเบียน</label><input class="input" id="ap-plate" value="${escHtml(appt?.plate||'')}" placeholder="กข-1234 กทม."></div>
        </div>
        <div class="input-group"><label class="input-label">ประเภทงาน *</label>
          <select class="input" id="ap-type">
            ${SERVICE_TYPES.map(t => `<option value="${t}" ${appt?.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วันที่นัด *</label><input class="input" type="date" id="ap-date" value="${appt?.date||today}"></div>
          <div class="input-group"><label class="input-label">เวลา *</label><input class="input" type="time" id="ap-time" value="${appt?.time||'09:00'}"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ช่างผู้รับผิดชอบ</label>
            <select class="input" id="ap-tech"><option value="">-- ยังไม่ระบุ --</option>${TECHS.map(t=>`<option value="${t}" ${appt?.tech===t?'selected':''}>${t}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เลขไมล์ (km)</label><input class="input" type="number" id="ap-km" value="${appt?.km||''}"></div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><textarea class="input" id="ap-note" rows="2">${escHtml(appt?.note||'')}</textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="ap-c">ยกเลิก</button><button class="btn btn-primary" id="ap-s">💾 บันทึก</button>`
    })
    el.querySelector('#ap-c').addEventListener('click', close)
    el.querySelector('#ap-s').addEventListener('click', async () => {
      const custName = el.querySelector('#ap-cust').value.trim()
      const date = el.querySelector('#ap-date').value
      const time = el.querySelector('#ap-time').value
      if (!custName || !date || !time) return showToast('❗ กรุณากรอกข้อมูลที่จำเป็น', 'warning')
      const data = { custName, date, time, phone: el.querySelector('#ap-phone').value, model: el.querySelector('#ap-model').value, plate: el.querySelector('#ap-plate').value, type: el.querySelector('#ap-type').value, tech: el.querySelector('#ap-tech').value, km: +el.querySelector('#ap-km').value||0, note: el.querySelector('#ap-note').value }
      try {
        if (appt) await updateDocData('service_appointments', appt.id, data)
        else await createDoc('service_appointments', { ...data, status:'scheduled' })
        showToast('📅 บันทึกนัดหมายแล้ว', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openApptDetail(a) {
    const st = APPT_STATUS[a.status]
    openModal({
      title: '📅 ' + escHtml(a.custName) + ' — ' + escHtml(a.date) + ' ' + escHtml(a.time), size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge badge-${st.color}">${st.label}</span>
            <span class="badge badge-primary">${a.type}</span>
          </div>
          <div class="grid-2" style="gap:8px;font-size:0.85rem">
            <div>📱 ${escHtml(a.phone)}</div>
            <div>🚗 ${escHtml(a.model)}</div>
            <div>🔖 ${escHtml(a.plate)}</div>
            <div>📏 ${a.km?.toLocaleString()||'-'} km</div>
            <div>🔧 ${escHtml(a.tech||'ยังไม่ระบุช่าง')}</div>
          </div>
          ${a.note ? `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-sm);font-size:0.83rem">📝 ${escHtml(a.note)}</div>` : ''}
          <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--border)">
            ${Object.entries(APPT_STATUS).filter(([k])=>k!==a.status).map(([k,v])=>`<button class="btn btn-sm btn-secondary status-change-btn" data-s="${k}">${v.label}</button>`).join('')}
            <button class="btn btn-sm btn-primary edit-btn" style="margin-left:auto">✏️ แก้ไข</button>
          </div>
        </div>`,
      footer: ''
    })
    document.querySelectorAll('.status-change-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await updateDocData('service_appointments', a.id, { status: btn.dataset.s })
          showToast('✅ อัพเดตแล้ว', 'success')
          document.querySelector('.modal-overlay')?.remove()
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })
    document.querySelector('.edit-btn')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openApptForm(a) })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
