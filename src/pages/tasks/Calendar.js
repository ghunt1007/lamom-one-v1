// Calendar — ปฏิทินรวมงาน/นัดหมาย (Tasks + Bookings delivery + manual Events)
// Route: /calendar
import { watchDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast, getState } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const EVENT_TYPES = {
  meeting:   { label: '👥 ประชุม',      color: 'primary' },
  reminder:  { label: '⏰ แจ้งเตือน',   color: 'warning' },
  deadline:  { label: '🎯 เดดไลน์',     color: 'danger' },
  training:  { label: '🎓 อบรม',        color: 'accent' },
  other:     { label: '📌 อื่นๆ',       color: 'secondary' },
}

const SRC_META = {
  task:    { icon: '✅', color: 'primary',  label: 'งาน' },
  booking: { icon: '🚗', color: 'success',  label: 'ส่งมอบรถ' },
  event:   { icon: '📅', color: 'accent',   label: 'นัดหมาย' },
}

function pad2(n) { return String(n).padStart(2, '0') }
function toISO(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}` }
function todayISO() { const d = new Date(); return toISO(d.getFullYear(), d.getMonth(), d.getDate()) }

const MONTH_NAMES = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const DOW_NAMES = ['อา','จ','อ','พ','พฤ','ศ','ส']

export default async function CalendarPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  const now = new Date()
  let viewYear = now.getFullYear()
  let viewMonth = now.getMonth() // 0-based

  let tasks = []
  let bookings = []
  let events = []

  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`

  // Real-time: 3 แหล่งข้อมูลรวมกันเป็นปฏิทินเดียว — อัปเดตสดเมื่อมีคนแก้ Task/ใบจอง/Event จากเครื่องอื่น
  // หน้านี้ไม่มีช่องค้นหาจึงอัปเดตได้ทันทีไม่ต้องกันโฟกัส
  const unsubs = [
    watchDocs('tasks', [], 'dueDate', 'asc', 500, rows => {
      if (container.__routerGen !== myGen) { unsubs.forEach(u => u()); return }
      tasks = rows; renderCalendar()
    }),
    watchDocs('bookings', [], 'deliveryDate', 'asc', 500, rows => {
      if (container.__routerGen !== myGen) { unsubs.forEach(u => u()); return }
      bookings = rows; renderCalendar()
    }),
    watchDocs('calendar_events', [], 'date', 'asc', 500, rows => {
      if (container.__routerGen !== myGen) { unsubs.forEach(u => u()); return }
      events = rows; renderCalendar()
    }),
  ]

  // รวมทุกแหล่งข้อมูลเป็น item เดียวกัน key ด้วยวันที่ (YYYY-MM-DD)
  function itemsByDate() {
    const map = {}
    const push = (date, item) => {
      if (!date) return
      const key = date.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
    tasks.forEach(t => {
      if (!t.dueDate) return
      push(t.dueDate, {
        src: 'task', id: t.id, title: t.title,
        sub: t.assignedTo ? `👤 ${t.assignedTo}` : '',
        statusLabel: t.status === 'done' ? '✅ เสร็จแล้ว' : (t.status === 'cancelled' ? '❌ ยกเลิก' : (t.priority === 'urgent' ? '🔴 เร่งด่วน' : '')),
        nav: '/tasks',
      })
    })
    bookings.forEach(b => {
      if (!b.deliveryDate) return
      push(b.deliveryDate, {
        src: 'booking', id: b.id, title: `ส่งมอบ: ${b.custName || 'ลูกค้า'} — ${(b.model || '') + ' ' + (b.variant || '')}`.trim(),
        sub: b.salesName ? `👤 ${b.salesName}` : '',
        statusLabel: b.status || '',
        nav: '/crm/bookings',
      })
    })
    events.forEach(e => {
      if (!e.date) return
      push(e.date, {
        src: 'event', id: e.id, title: e.title,
        sub: [e.time, e.assignee ? `👤 ${e.assignee}` : ''].filter(Boolean).join(' · '),
        statusLabel: EVENT_TYPES[e.type]?.label || '',
        nav: null,
        raw: e,
      })
    })
    return map
  }

  function renderCalendar() {
    const grid = document.getElementById('cal-grid')
    const label = document.getElementById('cal-month-label')
    if (!grid || !label) return

    label.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear + 543}`

    const map = itemsByDate()
    const firstDow = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()
    const today = todayISO()

    const cells = []
    // Leading days from previous month
    for (let i = 0; i < firstDow; i++) {
      const d = daysInPrevMonth - firstDow + i + 1
      cells.push({ d, otherMonth: true, dateKey: null })
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ d, otherMonth: false, dateKey: toISO(viewYear, viewMonth, d) })
    }
    // Trailing days to complete grid (multiple of 7)
    let trail = 1
    while (cells.length % 7 !== 0) { cells.push({ d: trail++, otherMonth: true, dateKey: null }) }

    grid.innerHTML = cells.map(c => {
      if (c.otherMonth) {
        return `<div class="cal-cell cal-cell-muted" style="min-height:88px;padding:6px;border:1px solid var(--border);opacity:0.35">
          <div style="font-size:0.72rem">${c.d}</div>
        </div>`
      }
      const items = map[c.dateKey] || []
      const isToday = c.dateKey === today
      const maxShow = 3
      return `<div class="cal-cell" data-date="${c.dateKey}" style="min-height:88px;padding:6px;border:1px solid var(--border);cursor:pointer;${isToday ? 'background:var(--primary-dim,rgba(99,102,241,0.08));border-color:var(--primary)' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.72rem;font-weight:${isToday ? '800' : '600'};color:${isToday ? 'var(--primary)' : 'var(--text-2)'}">${c.d}</span>
          ${items.length ? `<span class="badge badge-secondary" style="font-size:0.6rem">${items.length}</span>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px">
          ${items.slice(0, maxShow).map(it => {
            const m = SRC_META[it.src]
            return `<div style="font-size:0.62rem;padding:1px 4px;border-radius:4px;background:var(--surface-2);color:var(--${m.color});white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.icon} ${escHtml(it.title)}</div>`
          }).join('')}
          ${items.length > maxShow ? `<div style="font-size:0.6rem;color:var(--text-muted)">+${items.length - maxShow} เพิ่มเติม</div>` : ''}
        </div>
      </div>`
    }).join('')

    grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => openDayModal(cell.dataset.date, map[cell.dataset.date] || []))
    })

    // Upcoming list (next 14 days) below grid
    const upcomingEl = document.getElementById('cal-upcoming')
    if (upcomingEl) {
      const upcoming = []
      Object.keys(map).sort().forEach(key => {
        if (key >= today) map[key].forEach(it => upcoming.push({ ...it, date: key }))
      })
      const next = upcoming.slice(0, 8)
      upcomingEl.innerHTML = next.length ? next.map(it => {
        const m = SRC_META[it.src]
        return `<div class="card cal-upcoming-item" data-src="${it.src}" data-id="${it.id}" style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;margin-bottom:6px">
          <div>
            <div style="font-size:0.8rem;font-weight:600">${m.icon} ${escHtml(it.title)}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">${formatDate(it.date)} ${it.sub ? '· ' + escHtml(it.sub) : ''}</div>
          </div>
          ${it.statusLabel ? `<span class="badge badge-${m.color}" style="font-size:0.62rem">${escHtml(it.statusLabel)}</span>` : ''}
        </div>`
      }).join('') : `<div style="font-size:0.78rem;color:var(--text-muted);padding:10px 0">ไม่มีนัดหมายใน 14 วันข้างหน้า</div>`
      upcomingEl.querySelectorAll('.cal-upcoming-item').forEach(row => {
        row.addEventListener('click', () => handleItemClick(row.dataset.src, row.dataset.id))
      })
    }
  }

  function handleItemClick(src, id) {
    if (src === 'task') { navigate('/tasks'); return }
    if (src === 'booking') { navigate('/crm/bookings'); return }
    if (src === 'event') {
      const ev = events.find(e => e.id === id)
      if (ev) openEventForm(ev)
    }
  }

  function openDayModal(dateKey, items) {
    const { el, close } = openModal({
      title: `📅 ${formatDate(dateKey)}`,
      size: 'md',
      body: `
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
          <button class="btn btn-primary btn-sm" id="day-add-event">➕ เพิ่มนัดหมาย</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${items.length ? items.map(it => {
            const m = SRC_META[it.src]
            return `<div class="card day-item" data-src="${it.src}" data-id="${it.id}" style="padding:10px 12px;cursor:pointer;border-left:3px solid var(--${m.color})">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${m.icon} ${m.label}</div>
                  <div style="font-weight:600;font-size:0.85rem">${escHtml(it.title)}</div>
                  ${it.sub ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${escHtml(it.sub)}</div>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                  ${it.statusLabel ? `<span class="badge badge-${m.color}" style="font-size:0.62rem">${escHtml(it.statusLabel)}</span>` : ''}
                  ${it.src === 'event' ? `<button class="btn btn-ghost btn-sm day-event-del" data-id="${it.id}" style="color:var(--danger)">🗑</button>` : ''}
                </div>
              </div>
            </div>`
          }).join('') : `<div class="empty-state" style="padding:24px"><div class="empty-icon">📭</div><div class="empty-title">ไม่มีรายการวันนี้</div></div>`}
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>`
    })
    el.querySelectorAll('.day-item').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.day-event-del')) return
        close(); handleItemClick(row.dataset.src, row.dataset.id)
      })
    })
    el.querySelectorAll('.day-event-del').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const ev = events.find(x => x.id === btn.dataset.id)
      if (!await confirmDialog({ title: 'ลบนัดหมาย', message: `ลบ "${ev?.title || ''}"?`, confirmText: 'ลบ', danger: true })) return
      try {
        await softDelete('calendar_events', btn.dataset.id)
        events = events.filter(x => x.id !== btn.dataset.id)
        showToast('ลบแล้ว', 'success')
        close(); renderCalendar()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    }))
    el.querySelector('#day-add-event').addEventListener('click', () => {
      close(); openEventForm(null, dateKey)
    })
  }

  function openEventForm(existing, defaultDate) {
    const isEdit = !!existing
    const user = getState('user')
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขนัดหมาย' : '➕ นัดหมายใหม่', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="ef-title" value="${escHtml(existing?.title || '')}"><span class="input-error" id="ef-title-e"></span></div>
          <div class="input-group"><label class="input-label">รายละเอียด</label><textarea class="input" id="ef-desc" rows="2">${escHtml(existing?.description || '')}</textarea></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันที่ *</label><input class="input" type="date" id="ef-date" value="${existing?.date || defaultDate || todayISO()}"></div>
            <div class="input-group"><label class="input-label">เวลา</label><input class="input" type="time" id="ef-time" value="${existing?.time || ''}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ประเภท</label>
              <select class="input" id="ef-type">
                ${Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}" ${(existing?.type || 'other') === k ? 'selected' : ''}>${v.label}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">ผู้รับผิดชอบ</label><input class="input" id="ef-assignee" value="${escHtml(existing?.assignee || '')}"></div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="efc">ยกเลิก</button><button class="btn btn-primary" id="efs">💾 บันทึก</button>`
    })
    el.querySelector('#efc').addEventListener('click', close)
    el.querySelector('#efs').addEventListener('click', async () => {
      const title = el.querySelector('#ef-title').value.trim()
      if (!title) { el.querySelector('#ef-title-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#efs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        title,
        description: el.querySelector('#ef-desc').value.trim(),
        date: el.querySelector('#ef-date').value || todayISO(),
        time: el.querySelector('#ef-time').value || '',
        type: el.querySelector('#ef-type').value,
        assignee: el.querySelector('#ef-assignee').value.trim(),
        createdBy: existing?.createdBy || user?.displayName || user?.uid || 'unknown',
      }
      try {
        if (isEdit) { await updateDocData('calendar_events', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('calendar_events', data); events.push({ ...data, id }) }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มนัดหมายแล้ว', 'success')
        close(); renderCalendar()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">📅 ปฏิทินงาน</div>
          <div class="page-subtitle">รวมงาน (Tasks) · นัดส่งมอบรถ · นัดหมาย — ในที่เดียว</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="cal-add-event">➕ เพิ่มนัดหมาย</button>
        </div>
      </div>

      <div class="card" style="padding:14px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <button class="btn btn-secondary btn-sm" id="cal-prev">‹ ก่อนหน้า</button>
          <div id="cal-month-label" style="font-weight:700;font-size:1rem"></div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" id="cal-today">วันนี้</button>
            <button class="btn btn-secondary btn-sm" id="cal-next">ถัดไป ›</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0;margin-bottom:2px">
          ${DOW_NAMES.map(d => `<div style="text-align:center;font-size:0.7rem;font-weight:700;color:var(--text-muted);padding:4px 0">${d}</div>`).join('')}
        </div>
        <div id="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:0"></div>
      </div>

      <div class="page-title" style="font-size:0.95rem;margin-bottom:8px">🔜 กำลังจะถึง (14 วัน)</div>
      <div id="cal-upcoming"></div>
    </div>
  `

  document.getElementById('cal-add-event').addEventListener('click', () => openEventForm(null, todayISO()))
  document.getElementById('cal-prev').addEventListener('click', () => {
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear-- }
    renderCalendar()
  })
  document.getElementById('cal-next').addEventListener('click', () => {
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++ }
    renderCalendar()
  })
  document.getElementById('cal-today').addEventListener('click', () => {
    viewYear = now.getFullYear(); viewMonth = now.getMonth()
    renderCalendar()
  })

  return function cleanupCalendar() { unsubs.forEach(u => u()) }
}
