/**
 * Team Meeting — ประชุมทีม + บันทึก Action Items
 * Route: /hr/meetings
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

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

export default async function TeamMeetingPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let meetings = []
  let loading = true

  async function loadData() {
    loading = true
    try { meetings = await listDocs('team_meetings', [], 'date', 'desc', 200) } catch (e) { meetings = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date))
    const openActions = meetings.flatMap(m => m.actions||[]).filter(a => !a.done).length
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
            const actions = m.actions || []
            const openCount = actions.filter(a => !a.done).length
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
              ${actions.length > 0 ? `
                <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">📋 Action Items ${openCount > 0 ? `(ค้าง ${openCount})` : '(ครบแล้ว ✅)'}</div>
                ${actions.map((a, i) => `
                  <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.78rem;cursor:pointer;border-bottom:1px solid var(--border)">
                    <input type="checkbox" class="action-check" data-mid="${m.id}" data-i="${i}" ${a.done?'checked':''} style="accent-color:var(--primary)">
                    <span style="${a.done?'text-decoration:line-through;color:var(--text-muted)':''}">${escHtml(a.task)}</span>
                    <span style="margin-left:auto;font-size:0.65rem;color:var(--text-muted)">👤 ${escHtml(a.owner)}</span>
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
          ${!sorted.length ? `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">ไม่มีนัดประชุม</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.action-check').forEach(cb => cb.addEventListener('change', async () => {
      const m = meetings.find(x => x.id === cb.dataset.mid)
      if (!m) return
      const actions = (m.actions||[]).map((a, i) => i === parseInt(cb.dataset.i) ? { ...a, done: cb.checked } : a)
      await updateDocData('team_meetings', m.id, { actions })
      await loadData()
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
        async onConfirm() {
          const task = document.getElementById('ai-task')?.value?.trim()
          if (!task) { showToast('❗ กรุณากรอกงาน', 'error'); return false }
          const actions = [...(m.actions||[]), { task, owner: document.getElementById('ai-owner')?.value || '—', done: false }]
          await updateDocData('team_meetings', m.id, { actions })
          showToast('✅ เพิ่ม Action แล้ว', 'success'); await loadData()
        }
      })
    }))
    container.querySelectorAll('.note-btn').forEach(b => b.addEventListener('click', () => {
      const m = meetings.find(x => x.id === b.dataset.id)
      if (m) openModal({
        title: '📝 บันทึกการประชุม',
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">บันทึก</label><textarea class="input" id="mn-notes" rows="4">${escHtml(m.notes || '')}</textarea></div>`,
        async onConfirm() {
          await updateDocData('team_meetings', m.id, { notes: document.getElementById('mn-notes')?.value || '' })
          showToast('📝 บันทึกแล้ว', 'success'); await loadData()
        }
      })
    }))
    container.querySelectorAll('.end-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('team_meetings', b.dataset.id, { done: true })
      showToast('✅ จบประชุม — Action Items ถูกติดตามต่อ', 'success'); await loadData()
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
        async onConfirm() {
          const title = document.getElementById('mt-title')?.value?.trim()
          if (!title) { showToast('❗ กรุณากรอกหัวข้อ', 'error'); return false }
          await createDoc('team_meetings', {
            title, type: document.getElementById('mt-type')?.value||'adhoc',
            date: document.getElementById('mt-date')?.value||addDays(1), time: document.getElementById('mt-time')?.value||'09:00',
            attendees: document.getElementById('mt-attendees')?.value||'—', notes: '', done: false, actions: [],
          })
          showToast('📅 นัดประชุมแล้ว', 'success'); await loadData()
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
