/**
 * Service Reminder — แจ้งเตือนเช็คระยะ
 * Route: /service/reminders
 */
import { formatDate, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addDays(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

const REMINDER_TYPES = {
  mileage:  { label: 'ครบระยะ (km)', color: 'primary', icon: '🛣' },
  time:     { label: 'ครบกำหนดเวลา', color: 'warning', icon: '📅' },
  warranty: { label: 'ใกล้หมดประกัน', color: 'danger', icon: '🛡' },
  battery:  { label: 'ตรวจแบตประจำปี', color: 'success', icon: '🔋' },
}

export default async function ServiceReminderPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let reminders = []
  let typeFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { reminders = (await listDocs('service_reminders', [], 'dueDate', 'asc', 500)).filter(r => !r.deleted) } catch (e) { reminders = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = reminders.filter(r => typeFilter === 'all' || r.type === typeFilter)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const overdue = reminders.filter(r => r.dueDate < addDays(0) && !r.booked).length
    const pending = reminders.filter(r => !r.contacted).length
    const bookedCount = reminders.filter(r => r.booked).length
    const bookRate = Math.round(bookedCount / reminders.filter(r => r.contacted).length * 100) || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔔 Service Reminder</div>
            <div class="page-subtitle">แจ้งเตือนเช็คระยะ — ดึงลูกค้ากลับเข้าศูนย์</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="add-reminder-btn">➕ เพิ่มการแจ้งเตือน</button>
            ${pending > 0 ? `<button class="btn btn-primary" id="notify-all-btn">📤 แจ้งทั้งหมด (${pending})</button>` : ''}
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔔 รายการแจ้งเตือน', reminders.length, 'primary')}
          ${kpi('❗ เกินกำหนด', overdue, overdue > 0 ? 'danger' : 'success')}
          ${kpi('📞 ยังไม่ติดต่อ', pending, pending > 0 ? 'warning' : 'success')}
          ${kpi('📊 Booking Rate', bookRate + '%', bookRate >= 50 ? 'success' : 'warning')}
        </div>

        <!-- Type filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(REMINDER_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(r => {
            const rt = REMINDER_TYPES[r.type]
            const isOverdue = r.dueDate < addDays(0) && !r.booked
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${rt?.color})${isOverdue?';background:var(--danger)08':''}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.85rem">${r.customer} <span style="font-size:0.7rem;color:var(--text-muted)">📞 ${r.phone}</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${r.plate} · ${r.model}</div>
                  <div style="font-size:0.72rem;color:var(--${isOverdue?'danger':'text-muted'})">${rt?.icon} ${r.detail} · กำหนด ${formatDate(r.dueDate)}${isOverdue?' ❗ เกินกำหนด':''}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${rt?.color}" style="font-size:0.6rem">${rt?.icon} ${rt?.label}</span>
                  ${r.booked ? '<span class="badge badge-success" style="font-size:0.6rem">📅 จองคิวแล้ว</span>'
                    : r.contacted ? '<span class="badge badge-warning" style="font-size:0.6rem">📞 ติดต่อแล้ว</span>'
                    : '<span class="badge badge-secondary" style="font-size:0.6rem">⏳ รอติดต่อ</span>'}
                </div>
              </div>
              <div style="display:flex;gap:6px">
                ${!r.contacted ? `<button class="btn btn-xs btn-primary contact-btn" data-id="${r.id}">📤 ส่งแจ้งเตือน</button>` : ''}
                ${r.contacted && !r.booked ? `<button class="btn btn-xs btn-success book-btn" data-id="${r.id}">📅 จองคิว</button><button class="btn btn-xs btn-secondary recontact-btn" data-id="${r.id}">📞 ติดตามอีกครั้ง</button>` : ''}
                <button class="btn btn-xs btn-ghost del-reminder-btn" data-id="${r.id}" style="margin-left:auto" title="ลบ">🗑️</button>
              </div>
            </div>`
          }).join('')}
          ${!reminders.length ? `<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">ยังไม่มีรายการแจ้งเตือน</div><div class="empty-desc">กด "➕ เพิ่มการแจ้งเตือน" เพื่อเริ่มติดตามลูกค้าที่ครบกำหนดเช็คระยะ</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.contact-btn').forEach(b => b.addEventListener('click', async () => {
      const r = reminders.find(x => x.id === b.dataset.id)
      if (!r) return
      try {
        await updateDocData('service_reminders', r.id, { contacted: true })
        showToast(`📤 ส่งแจ้งเตือนถึง ${r.customer} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.recontact-btn').forEach(b => b.addEventListener('click', async () => {
      const r = reminders.find(x => x.id === b.dataset.id)
      if (!r) return
      const contactCount = (r.contactCount || 1) + 1
      const lastContactAt = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      try {
        await updateDocData('service_reminders', r.id, { contactCount, lastContactAt })
        showToast(`📞 ติดตามครั้งที่ ${contactCount} — ${r.customer} (${r.phone}) บันทึกแล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.book-btn').forEach(b => b.addEventListener('click', () => {
      const r = reminders.find(x => x.id === b.dataset.id)
      if (r) openModal({
        title: '📅 จองคิว: ' + r.customer,
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">วันที่นัด</label><input class="input" type="date" id="bk-date" value="${addDays(3)}"></div>
          <div class="input-group"><label class="input-label">เวลา</label>
            <select class="input" id="bk-time"><option>09:00</option><option>10:00</option><option>11:00</option><option>13:00</option><option>14:00</option><option>15:00</option></select>
          </div>
        </div>`,
        async onConfirm() {
          const bookedDate = document.getElementById('bk-date')?.value || addDays(3)
          const bookedTime = document.getElementById('bk-time')?.value || ''
          try {
            await updateDocData('service_reminders', r.id, { booked: true, bookedDate, bookedTime })
            showToast('📅 จองคิวสำเร็จ!', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    document.getElementById('notify-all-btn')?.addEventListener('click', async () => {
      const toNotify = reminders.filter(r => !r.contacted)
      try {
        await Promise.all(toNotify.map(r => updateDocData('service_reminders', r.id, { contacted: true })))
        showToast('📤 ส่งแจ้งเตือนทั้งหมดแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    document.getElementById('add-reminder-btn')?.addEventListener('click', () => {
      openModal({
        title: '➕ เพิ่มการแจ้งเตือนเช็คระยะ',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="sr-customer" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="sr-phone" placeholder="08x-xxx-xxxx"></div>
          <div class="input-group"><label class="input-label">ทะเบียนรถ *</label><input class="input" id="sr-plate" placeholder="1กข-1234"></div>
          <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="sr-model" placeholder="เช่น BYD Seal"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="sr-type">${Object.entries(REMINDER_TYPES).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">รายละเอียด</label><input class="input" id="sr-detail" placeholder="เช่น ครบ 20,000 กม."></div>
          <div class="input-group"><label class="input-label">วันครบกำหนด *</label><input class="input" type="date" id="sr-due" value="${addDays(0)}"></div>
          <span class="input-error" id="sr-err"></span>
        </div>`,
        confirmText: '➕ เพิ่ม',
        async onConfirm() {
          const customer = document.getElementById('sr-customer')?.value?.trim()
          const plate = document.getElementById('sr-plate')?.value?.trim()
          const dueDate = document.getElementById('sr-due')?.value
          if (!customer || !plate || !dueDate) { document.getElementById('sr-err').textContent = '❗ กรุณากรอกชื่อลูกค้า ทะเบียนรถ และวันครบกำหนด'; return false }
          try {
            await createDoc('service_reminders', {
              customer, phone: document.getElementById('sr-phone')?.value?.trim() || '',
              plate, model: document.getElementById('sr-model')?.value?.trim() || '',
              type: document.getElementById('sr-type')?.value || 'mileage',
              detail: document.getElementById('sr-detail')?.value?.trim() || '',
              dueDate, contacted: false, booked: false, contactCount: 0,
            })
            showToast('✅ เพิ่มการแจ้งเตือนแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
    container.querySelectorAll('.del-reminder-btn').forEach(b => b.addEventListener('click', async () => {
      const r = reminders.find(x => x.id === b.dataset.id)
      if (!r) return
      const ok = await confirmDialog({ title: '🗑️ ลบการแจ้งเตือน', message: `ยืนยันลบการแจ้งเตือนของ "${escHtml(r.customer)}"?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('service_reminders', r.id)
        showToast('🗑️ ลบแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
