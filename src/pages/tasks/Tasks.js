import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PRIORITY = {
  urgent:  { label: '🔴 เร่งด่วน', badge: 'danger', order: 0 },
  high:    { label: '🟠 สำคัญ',    badge: 'warning', order: 1 },
  medium:  { label: '🟡 ปานกลาง', badge: 'accent', order: 2 },
  low:     { label: '🟢 ต่ำ',      badge: 'success', order: 3 },
}

const STATUS = {
  todo:       { label: '📋 ต้องทำ',      badge: 'primary' },
  inprogress: { label: '⚙️ กำลังทำ',     badge: 'primary' },
  done:       { label: '✅ เสร็จแล้ว',   badge: 'success' },
  cancelled:  { label: '❌ ยกเลิก',       badge: 'danger'  },
}

export default async function TasksPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let tasks = []
  let viewFilter = 'active' // active | all | done
  let priorityFilter = 'all'

  async function loadData() {
    try { tasks = await listDocs('tasks', [], 'dueDate', 'asc', 500) } catch {}
    renderBoard()
  }

  function getFiltered() {
    let t = tasks.filter(t => {
      if (viewFilter === 'active') return t.status !== 'done' && t.status !== 'cancelled'
      if (viewFilter === 'done') return t.status === 'done' || t.status === 'cancelled'
      return true
    })
    if (priorityFilter !== 'all') t = t.filter(x => x.priority === priorityFilter)
    return t.sort((a, b) => (PRIORITY[a.priority]?.order ?? 9) - (PRIORITY[b.priority]?.order ?? 9))
  }

  function renderBoard() {
    const wrap = document.getElementById('tasks-board')
    if (!wrap) return
    const filtered = getFiltered()

    // Stats
    const statEl = document.getElementById('tasks-stat')
    if (statEl) {
      const todo = tasks.filter(t => t.status === 'todo').length
      const inprog = tasks.filter(t => t.status === 'inprogress').length
      const done = tasks.filter(t => t.status === 'done').length
      const overdue = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.dueDate && t.dueDate < new Date().toISOString().slice(0,10)).length
      statEl.innerHTML = `
        <span class="badge badge-primary">📋 ต้องทำ ${todo}</span>
        <span class="badge badge-primary">⚙️ กำลังทำ ${inprog}</span>
        <span class="badge badge-success">✅ เสร็จ ${done}</span>
        ${overdue ? `<span class="badge badge-danger">⏰ เกินกำหนด ${overdue}</span>` : ''}
      `
    }

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">✅</div><div class="empty-title">${viewFilter==='done'?'ยังไม่มีงานที่เสร็จ':'ไม่มีงานค้าง!'}</div></div>`
      return
    }

    wrap.innerHTML = filtered.map(t => taskCard(t)).join('')

    document.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.task-status-btn,.task-del,.task-edit')) return
        openDetail(tasks.find(x => x.id === card.dataset.id))
      })
    })
    document.querySelectorAll('.task-status-btn').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const t = tasks.find(x => x.id === btn.dataset.id)
      if (!t) return
      const order = ['todo','inprogress','done']
      const next = order[order.indexOf(t.status) + 1] || 'done'
      try {
        await updateDocData('tasks', t.id, { status: next })
        t.status = next
        showToast(`→ ${STATUS[next]?.label}`, 'success'); renderBoard()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    }))
    document.querySelectorAll('.task-del').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const t = tasks.find(x => x.id === btn.dataset.id)
      if (!await confirmDialog({ title:'ลบงาน', message:`ลบ "${t?.title}"?`, confirmText:'ลบ', danger:true })) return
      try {
        await softDelete('tasks', btn.dataset.id)
        tasks = tasks.filter(x => x.id !== btn.dataset.id)
        showToast('ลบแล้ว', 'success'); renderBoard()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    }))
    document.querySelectorAll('.task-edit').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openForm(tasks.find(x => x.id === btn.dataset.id))
    }))
  }

  function taskCard(t) {
    const pr = PRIORITY[t.priority] || PRIORITY.medium
    const st = STATUS[t.status] || STATUS.todo
    const isOverdue = t.status !== 'done' && t.status !== 'cancelled' && t.dueDate && t.dueDate < new Date().toISOString().slice(0,10)
    const isDone = t.status === 'done' || t.status === 'cancelled'
    const nextLabel = { todo:'▶ เริ่ม', inprogress:'✅ เสร็จ' }[t.status]
    return `
      <div class="card task-card" data-id="${t.id}" style="padding:14px;cursor:pointer;margin-bottom:10px;border-left:3px solid var(--${pr.badge});${isDone?'opacity:0.6':''}">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">
              <span class="badge badge-${pr.badge}" style="font-size:0.68rem">${pr.label}</span>
              <span class="badge badge-${st.badge}" style="font-size:0.68rem">${st.label}</span>
              ${isOverdue ? `<span class="badge badge-danger" style="font-size:0.68rem">⏰ เกินกำหนด</span>` : ''}
            </div>
            <div style="font-weight:600;${isDone?'text-decoration:line-through;color:var(--text-muted)':''}">${escHtml(t.title)}</div>
            ${t.desc ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:3px">${escHtml(t.desc)}</div>` : ''}
            <div style="display:flex;gap:12px;margin-top:6px;font-size:0.75rem;color:var(--text-muted)">
              ${t.dueDate ? `<span>📅 ${formatDate(t.dueDate)}</span>` : ''}
              ${t.assignedTo ? `<span>👤 ${escHtml(t.assignedTo)}</span>` : ''}
              <span>${timeAgo(t.createdAt)}</span>
            </div>
          </div>
          <div style="display:flex;gap:3px;flex-shrink:0">
            ${nextLabel && !isDone ? `<button class="btn btn-primary btn-sm task-status-btn" data-id="${t.id}">${nextLabel}</button>` : ''}
            <button class="btn btn-ghost btn-sm task-edit" data-id="${t.id}">✏️</button>
            <button class="btn btn-ghost btn-sm task-del" data-id="${t.id}" style="color:var(--danger)">🗑</button>
          </div>
        </div>
      </div>`
  }

  function openDetail(t) {
    if (!t) return
    const pr = PRIORITY[t.priority] || PRIORITY.medium
    const st = STATUS[t.status] || STATUS.todo
    openModal({
      title: '✅ ' + escHtml(t.title), size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge badge-${pr.badge}">${pr.label}</span>
            <span class="badge badge-${st.badge}">${st.label}</span>
          </div>
          ${t.desc ? `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-md);font-size:0.85rem">${escHtml(t.desc)}</div>` : ''}
          ${dRow('📅','กำหนด',formatDate(t.dueDate))}
          ${dRow('👤','มอบหมาย',t.assignedTo||'-')}
          ${dRow('🕐','สร้างเมื่อ',timeAgo(t.createdAt))}
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-primary" id="t-edit">✏️ แก้ไข</button>`
    })
    document.getElementById('t-edit')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(t) })
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const today = new Date().toISOString().slice(0,10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10)
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขงาน' : '➕ งานใหม่', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">ชื่องาน *</label><input class="input" id="tf-title" value="${escHtml(existing?.title||'')}"><span class="input-error" id="tf-title-e"></span></div>
          <div class="input-group"><label class="input-label">รายละเอียด</label><textarea class="input" id="tf-desc" rows="2">${escHtml(existing?.desc||'')}</textarea></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ความสำคัญ</label>
              <select class="input" id="tf-prio">
                ${Object.entries(PRIORITY).map(([k,v]) => `<option value="${k}" ${existing?.priority===k?'selected':''}>${v.label}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">สถานะ</label>
              <select class="input" id="tf-status">
                ${Object.entries(STATUS).map(([k,v]) => `<option value="${k}" ${existing?.status===k?'selected':''}>${v.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">กำหนดส่ง</label><input class="input" type="date" id="tf-due" value="${existing?.dueDate||tomorrow}"></div>
            <div class="input-group"><label class="input-label">มอบหมายให้</label><input class="input" id="tf-assign" value="${escHtml(existing?.assignedTo||'')}"></div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="tfc">ยกเลิก</button><button class="btn btn-primary" id="tfs">💾 บันทึก</button>`
    })
    el.querySelector('#tfc').addEventListener('click', close)
    el.querySelector('#tfs').addEventListener('click', async () => {
      const title = el.querySelector('#tf-title').value.trim()
      if (!title) { el.querySelector('#tf-title-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#tfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        title, desc: el.querySelector('#tf-desc').value.trim(),
        priority: el.querySelector('#tf-prio').value,
        status: el.querySelector('#tf-status').value,
        dueDate: el.querySelector('#tf-due').value,
        assignedTo: el.querySelector('#tf-assign').value.trim(),
        createdAt: existing?.createdAt || new Date().toISOString(),
      }
      try {
        if (isEdit) { await updateDocData('tasks', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('tasks', data); tasks.unshift({ ...data, id }) }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มงานแล้ว', 'success')
        close(); renderBoard()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">✅ Tasks</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px" id="tasks-stat"></div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="add-task-btn">➕ งานใหม่</button>
        </div>
      </div>

      <!-- View Filter -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm vf-btn btn-primary" data-vf="active">🔥 Active</button>
          <button class="btn btn-sm vf-btn btn-secondary" data-vf="all">ทั้งหมด</button>
          <button class="btn btn-sm vf-btn btn-secondary" data-vf="done">✅ เสร็จแล้ว</button>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm pf-btn btn-secondary" data-pf="all">ทุกระดับ</button>
          ${Object.entries(PRIORITY).map(([k,v]) => `<button class="btn btn-sm pf-btn btn-secondary" data-pf="${k}">${v.label}</button>`).join('')}
        </div>
      </div>

      <div id="tasks-board">
        ${[...Array(3)].map(() => `<div class="skeleton" style="height:80px;border-radius:var(--radius-md);margin-bottom:10px"></div>`).join('')}
      </div>
    </div>
  `

  document.getElementById('add-task-btn').addEventListener('click', () => openForm())
  document.querySelectorAll('.vf-btn').forEach(btn => btn.addEventListener('click', () => {
    viewFilter = btn.dataset.vf
    document.querySelectorAll('.vf-btn').forEach(b => b.className = `btn btn-sm vf-btn ${b.dataset.vf === viewFilter ? 'btn-primary' : 'btn-secondary'}`)
    renderBoard()
  }))
  document.querySelectorAll('.pf-btn').forEach(btn => btn.addEventListener('click', () => {
    priorityFilter = btn.dataset.pf
    document.querySelectorAll('.pf-btn').forEach(b => b.className = `btn btn-sm pf-btn ${b.dataset.pf === priorityFilter ? 'btn-primary' : 'btn-secondary'}`)
    renderBoard()
  }))

  if (container.__routerGen === myGen) await loadData()
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${escHtml(String(value ?? ''))}</span></div>`
}
