/**
 * Team Meeting — ประชุมทีม + บันทึก Action Items
 * Route: /hr/meetings
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MEETING_TYPES = {
  daily:    { label: 'Morning Brief', color: 'primary', icon: '☀️' },
  weekly:   { label: 'ประชุมสัปดาห์', color: 'success', icon: '📅' },
  monthly:  { label: 'ประชุมเดือน', color: 'warning', icon: '📊' },
  adhoc:    { label: 'ประชุมด่วน', color: 'danger', icon: '🚨' },
}

const DEMO_MEETINGS = [
  { id: 'M001', title: 'Morning Brief — ทีมขาย', type: 'daily', date: addDays(0), time: '08:45', attendees: 'ทีมขายทั้งหมด', notes: 'เป้าวันนี้ 2 คัน · มีนัด Test Drive 4 ราย', done: false,
    actions: [
      { task: 'โทร follow-up ลูกค้า Hot 3 ราย', owner: 'วิชัย', done: true },
      { task: 'เตรียมรถ Demo ให้พร้อม 10:00', owner: 'ธนา', done: false },
    ] },
  { id: 'M002', title: 'ประชุมสัปดาห์ — ทุกแผนก', type: 'weekly', date: addDays(-2), time: '17:00', attendees: 'หัวหน้าทุกแผนก', notes: 'ยอดสัปดาห์ที่แล้ว 5 คัน ต่ำกว่าเป้า 2 · Service ทำได้ดี CSAT 4.7', done: true,
    actions: [
      { task: 'วิเคราะห์ Lost Deals สัปดาห์ที่แล้ว', owner: 'ผจก.ขาย', done: true },
      { task: 'จัดโปรกระตุ้นปลายเดือน', owner: 'การตลาด', done: false },
      { task: 'ขอใบเสนอราคาผ้าไมโครไฟเบอร์ใหม่', owner: 'บริการ', done: false },
    ] },
  { id: 'M003', title: 'รีวิวงบเดือน + วางแผนเดือนหน้า', type: 'monthly', date: addDays(3), time: '14:00', attendees: 'เจ้าของ + ผู้จัดการ', notes: '', done: false, actions: [] },
]

export default async function TeamMeetingPage(container) {
  let meetings = DEMO_MEETINGS.map(m => ({ ...m, actions: m.actions.map(a => ({ ...a })) }))

  function renderPage() {
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date))
    const openActions = meetings.flatMap(m => m.actions).filter(a => !a.done).length
    const upcoming = meetings.filter(m => !m.done && m.date >= addDays(0)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👥 Team Meeting</div>
            <div class="page-subtitle">ประชุมทีม — วาระ บันทึก ติดตาม Action Items</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-meeting-btn">+ นัดประชุม</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('📅 นัดที่จะถึง', upcoming, 'primary')}
          ${kpi('📋 Action ค้าง', openActions, openActions > 0 ? 'warning' : 'success')}
          ${kpi('✅ ประชุมเดือนนี้', meetings.filter(m => m.done).length + ' ครั้ง', 'secondary')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${sorted.map(m => {
            const mt = MEETING_TYPES[m.type]
            const openCount = m.actions.filter(a => !a.done).length
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${mt?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${mt?.icon} ${m.title}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">📅 ${formatDate(m.date)} ${m.time} · 👥 ${m.attendees}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${mt?.color}" style="font-size:0.6rem">${mt?.label}</span>
                  ${m.done ? '<span class="badge badge-success" style="font-size:0.6rem">✅ จบแล้ว</span>' : ''}
                </div>
              </div>
              ${m.notes ? `<div style="font-size:0.76rem;color:var(--text-muted);background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm);margin-bottom:8px">📝 ${escHtml(m.notes)}</div>` : ''}
              ${m.actions.length > 0 ? `
                <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">📋 Action Items ${openCount > 0 ? `(ค้าง ${openCount})` : '(ครบแล้ว ✅)'}</div>
                ${m.actions.map((a, i) => `
                  <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.78rem;cursor:pointer;border-bottom:1px solid var(--border)">
                    <input type="checkbox" class="action-check" data-mid="${m.id}" data-i="${i}" ${a.done?'checked':''} style="accent-color:var(--primary)">
                    <span style="${a.done?'text-decoration:line-through;color:var(--text-muted)':''}">${a.task}</span>
                    <span style="margin-left:auto;font-size:0.65rem;color:var(--text-muted)">👤 ${a.owner}</span>
                  </label>
                `).join('')}
              ` : ''}
              <div style="display:flex;gap:6px;margin-top:10px">
                <button class="btn btn-xs btn-secondary add-action-btn" data-id="${m.id}">+ Action</button>
                ${!m.done ? `<button class="btn btn-xs btn-secondary note-btn" data-id="${m.id}">📝 บันทึก</button>
                <button class="btn btn-xs btn-success end-btn" data-id="${m.id}">✅ จบประชุม</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.action-check').forEach(cb => cb.addEventListener('change', () => {
      const m = meetings.find(x => x.id === cb.dataset.mid)
      if (m) { m.actions[parseInt(cb.dataset.i)].done = cb.checked; renderPage() }
    }))
    container.querySelectorAll('.add-action-btn').forEach(b => b.addEventListener('click', () => {
      const m = meetings.find(x => x.id === b.dataset.id)
      if (m) openModal({
        title: '+ Action Item',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">งาน *</label><input class="input" id="ai-task"></div>
          <div class="input-group"><label class="input-label">ผู้รับผิดชอบ</label><input class="input" id="ai-owner"></div>
        </div>`,
        onConfirm() {
          const task = document.getElementById('ai-task')?.value?.trim()
          if (!task) { showToast('❗ กรุณากรอกงาน', 'error'); return }
          m.actions.push({ task, owner: document.getElementById('ai-owner')?.value || '—', done: false })
          showToast('✅ เพิ่ม Action แล้ว', 'success'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.note-btn').forEach(b => b.addEventListener('click', () => {
      const m = meetings.find(x => x.id === b.dataset.id)
      if (m) openModal({
        title: '📝 บันทึกการประชุม',
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">บันทึก</label><textarea class="input" id="mn-notes" rows="4">${escHtml(m.notes || '')}</textarea></div>`,
        onConfirm() { m.notes = document.getElementById('mn-notes')?.value || ''; showToast('📝 บันทึกแล้ว', 'success'); renderPage() }
      })
    }))
    container.querySelectorAll('.end-btn').forEach(b => b.addEventListener('click', () => {
      const m = meetings.find(x => x.id === b.dataset.id); if (m) { m.done = true; showToast('✅ จบประชุม — Action Items ถูกติดตามต่อ', 'success'); renderPage() }
    }))
    document.getElementById('add-meeting-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ นัดประชุม',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="mt-title"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="mt-type">${Object.entries(MEETING_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">วันที่</label><input class="input" type="date" id="mt-date" value="${addDays(1)}"></div>
          <div class="input-group"><label class="input-label">เวลา</label><input class="input" type="time" id="mt-time" value="09:00"></div>
          <div class="input-group"><label class="input-label">ผู้เข้าร่วม</label><input class="input" id="mt-attendees"></div>
        </div>`,
        onConfirm() {
          const title = document.getElementById('mt-title')?.value?.trim()
          if (!title) { showToast('❗ กรุณากรอกหัวข้อ', 'error'); return }
          meetings.unshift({ id:`M${String(meetings.length+1).padStart(3,'0')}`, title, type:document.getElementById('mt-type')?.value||'adhoc', date:document.getElementById('mt-date')?.value||addDays(1), time:document.getElementById('mt-time')?.value||'09:00', attendees:document.getElementById('mt-attendees')?.value||'—', notes:'', done:false, actions:[] })
          showToast('📅 นัดประชุมแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
