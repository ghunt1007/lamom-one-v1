/**
 * Meeting Minutes — บันทึกประชุม มติ Action Items
 * Route: /comms/meetings
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function statusBadge(s) {
  const m = { upcoming:{l:'กำหนดการ',c:'var(--primary)'}, in_progress:{l:'กำลังประชุม',c:'var(--warning)'}, completed:{l:'เสร็จแล้ว',c:'var(--success)'} }
  const x = m[s] || { l: escHtml(s), c: 'var(--text-muted)' }
  return '<span style="font-size:0.62rem;padding:2px 8px;border-radius:6px;background:' + x.c + '22;color:' + x.c + ';font-weight:700">' + x.l + '</span>'
}

function meetingCard(m) {
  const doneCount = m.actions.filter(a => a.done).length
  return '<div class="card" style="padding:14px;margin-bottom:8px">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
      '<div>' +
        '<div style="font-weight:700;font-size:0.82rem">' + escHtml(m.title) + '</div>' +
        '<div style="font-size:0.68rem;color:var(--text-muted)">📅 ' + escHtml(m.date) + ' ' + escHtml(m.time) + ' · 🏢 ' + escHtml(m.dept) + '</div>' +
      '</div>' +
      statusBadge(m.status) +
    '</div>' +
    '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">👥 ' + m.attendees.map(a => escHtml(a)).join(', ') + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<div style="font-size:0.7rem"><span style="color:var(--text-muted)">Action Items</span> <span style="font-weight:700">' + doneCount + '/' + m.actions.length + '</span></div>' +
      '<button class="btn btn-sm btn-secondary view-btn" data-id="' + m.id + '">รายละเอียด</button>' +
    '</div>' +
  '</div>'
}

function actionRow(a) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border-subtle)">' +
    '<div>' +
      '<div style="font-size:0.76rem;font-weight:600;' + (a.done ? 'text-decoration:line-through;color:var(--text-muted)' : '') + '">' + escHtml(a.task) + '</div>' +
      '<div style="font-size:0.64rem;color:var(--text-muted)">👤 ' + escHtml(a.owner) + ' · 📅 ' + escHtml(a.due) + '</div>' +
    '</div>' +
    (a.done ? '<span style="color:var(--success)">✅</span>' : '<span style="color:var(--warning)">⏳</span>') +
  '</div>'
}

export default async function MeetingMinutesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let meetings = []
  let loading = true
  let filter = 'all'

  async function loadData() {
    loading = true
    try { meetings = await listDocs('meeting_minutes', [], 'date', 'desc', 100) } catch (e) { meetings = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const filtered = filter === 'all' ? meetings : meetings.filter(m => m.status === filter)
    const upcoming = meetings.filter(m => m.status === 'upcoming').length
    const completed = meetings.filter(m => m.status === 'completed').length
    const pendingActions = meetings.flatMap(m => m.actions).filter(a => !a.done).length

    const filterBtns = [['all','ทั้งหมด'],['upcoming','กำหนดการ'],['in_progress','กำลังประชุม'],['completed','เสร็จแล้ว']].map(([k, l]) =>
      '<button class="btn btn-sm ' + (filter === k ? 'btn-primary' : 'btn-secondary') + ' filter-btn" data-f="' + k + '">' + l + '</button>'
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Meeting Minutes</div>
            <div class="page-subtitle">บันทึกประชุม มติ และ Action Items</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-meeting-btn">+ สร้างการประชุม</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('📅 การประชุมทั้งหมด', meetings.length + ' รายการ', 'var(--primary)')}
          ${sc('🔜 กำหนดการ', upcoming + ' รายการ', 'var(--warning)')}
          ${sc('✅ เสร็จสิ้น', completed + ' รายการ', 'var(--success)')}
          ${sc('⚠️ Action รอทำ', pendingActions + ' รายการ', 'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>

        ${filtered.map(m => meetingCard(m)).join('')}
      </div>`

    container.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const m = meetings.find(x => x.id === b.dataset.id)
      if (!m) return
      const agendaList = m.agenda.map(a => '<li style="font-size:0.76rem;margin-bottom:3px">' + escHtml(a) + '</li>').join('')
      const actionsHtml = m.actions.length === 0
        ? '<div style="color:var(--text-muted);font-size:0.74rem;padding:8px 0">ยังไม่มี Action Items</div>'
        : m.actions.map(a => actionRow(a)).join('')
      const body = '<div style="font-size:0.82rem">' +
        '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:10px">📅 ' + escHtml(m.date) + ' ' + escHtml(m.time) + ' · 🏢 ' + escHtml(m.dept) + ' · 👥 ' + m.attendees.map(a => escHtml(a)).join(', ') + '</div>' +
        '<div style="margin-bottom:10px"><div style="font-size:0.76rem;font-weight:700;margin-bottom:4px">📌 วาระการประชุม</div><ul style="padding-left:16px;margin:0">' + agendaList + '</ul></div>' +
        (m.minutes ? '<div style="background:var(--surface-2);padding:10px;border-radius:8px;margin-bottom:10px"><div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">📝 บันทึกการประชุม</div><div style="font-size:0.76rem;line-height:1.6">' + escHtml(m.minutes) + '</div></div>' : '') +
        '<div><div style="font-size:0.76rem;font-weight:700;margin-bottom:4px">🎯 Action Items</div>' + actionsHtml + '</div>' +
      '</div>'
      openModal({ title: '📋 ' + escHtml(m.title), size: 'md', body, confirmText: 'ปิด', onConfirm: () => {} })
    }))
    document.getElementById('new-meeting-btn')?.addEventListener('click', openNewMeetingModal)
  }

  function openNewMeetingModal() {
    const today = new Date().toISOString().slice(0, 10)
    openModal({
      title: '📋 สร้างการประชุมใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อการประชุม *</label>
            <input id="mt-title" class="input" placeholder="ประชุมทีมขาย / บอร์ดบริหาร..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วันที่</label><input id="mt-date" type="date" class="input" value="${today}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">เวลา</label><input id="mt-time" type="time" class="input" value="09:00"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ฝ่าย/หน่วยงาน</label><input id="mt-dept" class="input" placeholder="ขาย / บริหาร..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">สถานะ</label>
              <select id="mt-status" class="input">
                <option value="upcoming">กำหนดการ</option>
                <option value="in_progress">กำลังประชุม</option>
                <option value="completed">เสร็จแล้ว</option>
              </select>
            </div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ผู้เข้าร่วม (คั่นด้วยจุลภาค)</label>
            <input id="mt-attendees" class="input" placeholder="ทวีศักดิ์, กิตติ, ปิยะ..."></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">วาระการประชุม (แยกบรรทัด)</label>
            <textarea id="mt-agenda" class="input" rows="3" placeholder="1. ทบทวนยอดขาย&#10;2. วางแผนโปรโมชั่น..."></textarea></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="mt-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('mt-save')?.addEventListener('click', async () => {
      const title = document.getElementById('mt-title')?.value.trim()
      if (!title) { showToast('⚠️ กรุณากรอกชื่อการประชุม', 'warning'); return }
      const agendaRaw = document.getElementById('mt-agenda')?.value.trim()
      const attendeesRaw = document.getElementById('mt-attendees')?.value.trim()
      try {
        await createDoc('meeting_minutes', {
          title,
          date: document.getElementById('mt-date')?.value || today,
          time: document.getElementById('mt-time')?.value || '09:00',
          dept: document.getElementById('mt-dept')?.value.trim() || '-',
          attendees: attendeesRaw ? attendeesRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
          agenda: agendaRaw ? agendaRaw.split('\n').filter(Boolean) : [],
          minutes: '',
          actions: [],
          status: document.getElementById('mt-status')?.value || 'upcoming',
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ สร้างการประชุมแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
