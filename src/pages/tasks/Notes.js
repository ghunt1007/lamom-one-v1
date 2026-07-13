// Notes — บันทึกช่วยจำทั่วไป (ไม่ผูกกับลูกค้าโดยเฉพาะ — ต่างจาก CustomerNotes)
// Route: /notes
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast, getState } from '../../core/store.js'
import { timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const NOTE_COLORS = ['primary', 'success', 'warning', 'accent', 'danger', 'secondary']
function colorFor(id) {
  let h = 0
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) >>> 0
  return NOTE_COLORS[h % NOTE_COLORS.length]
}

export default async function NotesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let notes = []
  let search = ''
  let tagFilter = 'all'

  async function loadData() {
    try { notes = await listDocs('notes', [], 'updatedAt', 'desc', 500) } catch { notes = [] }
    renderBoard()
  }

  function allTags() {
    const set = new Set()
    notes.forEach(n => (n.tags || []).forEach(t => set.add(t)))
    return [...set].sort()
  }

  function getFiltered() {
    let list = notes.slice()
    if (tagFilter !== 'all') list = list.filter(n => (n.tags || []).includes(tagFilter))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(n => (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q)))
    }
    list.sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1
      return (b.updatedAt || '').localeCompare(a.updatedAt || '')
    })
    return list
  }

  function renderBoard() {
    const wrap = document.getElementById('notes-grid')
    if (!wrap) return

    const tagRow = document.getElementById('notes-tag-row')
    if (tagRow) {
      const tags = allTags()
      tagRow.innerHTML =
        `<button class="btn btn-sm nt-btn ${tagFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-tag="all">ทั้งหมด</button>` +
        tags.map(t => `<button class="btn btn-sm nt-btn ${tagFilter === t ? 'btn-primary' : 'btn-secondary'}" data-tag="${escHtml(t)}">#${escHtml(t)}</button>`).join('')
      tagRow.querySelectorAll('.nt-btn').forEach(b => b.addEventListener('click', () => { tagFilter = b.dataset.tag; renderBoard() }))
    }

    const filtered = getFiltered()

    const statEl = document.getElementById('notes-stat')
    if (statEl) {
      statEl.innerHTML = `<span class="badge badge-primary">📝 ทั้งหมด ${notes.length}</span><span class="badge badge-warning">📌 ปักหมุด ${notes.filter(n => n.pinned).length}</span>`
    }

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">🗒️</div><div class="empty-title">${notes.length ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีบันทึก'}</div></div>`
      return
    }

    wrap.innerHTML = filtered.map(n => noteCard(n)).join('')

    wrap.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.note-pin,.note-del,.note-edit')) return
        openForm(notes.find(x => x.id === card.dataset.id))
      })
    })
    wrap.querySelectorAll('.note-pin').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const n = notes.find(x => x.id === btn.dataset.id)
      if (!n) return
      try {
        await updateDocData('notes', n.id, { pinned: !n.pinned })
        n.pinned = !n.pinned
        showToast(n.pinned ? '📌 ปักหมุดแล้ว' : 'เอาปักหมุดออกแล้ว', 'success')
        renderBoard()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    }))
    wrap.querySelectorAll('.note-del').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const n = notes.find(x => x.id === btn.dataset.id)
      if (!await confirmDialog({ title: 'ลบบันทึก', message: `ลบ "${escHtml(n?.title || '(ไม่มีหัวข้อ)')}"?`, confirmText: 'ลบ', danger: true })) return
      try {
        await softDelete('notes', btn.dataset.id)
        notes = notes.filter(x => x.id !== btn.dataset.id)
        showToast('ลบแล้ว', 'success'); renderBoard()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    }))
    wrap.querySelectorAll('.note-edit').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openForm(notes.find(x => x.id === btn.dataset.id))
    }))
  }

  function noteCard(n) {
    const c = colorFor(n.id)
    return `
      <div class="card note-card" data-id="${n.id}" style="padding:14px;cursor:pointer;border-top:3px solid var(--${c});display:flex;flex-direction:column;gap:8px;height:100%">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
          <div style="font-weight:700;font-size:0.9rem;flex:1">${n.pinned ? '📌 ' : ''}${escHtml(n.title || '(ไม่มีหัวข้อ)')}</div>
          <div style="display:flex;gap:2px;flex-shrink:0">
            <button class="btn btn-ghost btn-sm note-pin" data-id="${n.id}" title="ปักหมุด">${n.pinned ? '📌' : '📍'}</button>
            <button class="btn btn-ghost btn-sm note-edit" data-id="${n.id}">✏️</button>
            <button class="btn btn-ghost btn-sm note-del" data-id="${n.id}" style="color:var(--danger)">🗑</button>
          </div>
        </div>
        <div style="font-size:0.78rem;color:var(--text-2);white-space:pre-wrap;flex:1;max-height:90px;overflow:hidden">${escHtml(n.body || '')}</div>
        ${(n.tags || []).length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${n.tags.map(t => `<span class="badge badge-secondary" style="font-size:0.62rem">#${escHtml(t)}</span>`).join('')}</div>` : ''}
        ${n.linkedType && n.linkedId ? `<div style="font-size:0.68rem;color:var(--text-muted)">🔗 เชื่อมโยง: ${escHtml(n.linkedType)} #${escHtml(n.linkedId)}</div>` : ''}
        <div style="font-size:0.68rem;color:var(--text-muted)">${escHtml(n.createdBy || '')} · ${timeAgo(n.updatedAt || n.createdAt)}</div>
      </div>`
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const user = getState('user')
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขบันทึก' : '➕ บันทึกใหม่', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="nf-title" value="${escHtml(existing?.title || '')}"><span class="input-error" id="nf-title-e"></span></div>
          <div class="input-group"><label class="input-label">เนื้อหา</label><textarea class="input" id="nf-body" rows="5">${escHtml(existing?.body || '')}</textarea></div>
          <div class="input-group"><label class="input-label">แท็ก (คั่นด้วยจุลภาค)</label><input class="input" id="nf-tags" value="${escHtml((existing?.tags || []).join(', '))}" placeholder="เช่น ลูกค้า, ด่วน, ไอเดีย"></div>
          <div class="input-group">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem">
              <input type="checkbox" id="nf-pinned" ${existing?.pinned ? 'checked' : ''}> 📌 ปักหมุดไว้ด้านบน
            </label>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="nfc">ยกเลิก</button><button class="btn btn-primary" id="nfs">💾 บันทึก</button>`
    })
    el.querySelector('#nfc').addEventListener('click', close)
    el.querySelector('#nfs').addEventListener('click', async () => {
      const title = el.querySelector('#nf-title').value.trim()
      if (!title) { el.querySelector('#nf-title-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#nfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const tags = el.querySelector('#nf-tags').value.split(',').map(t => t.trim()).filter(Boolean)
      const data = {
        title,
        body: el.querySelector('#nf-body').value.trim(),
        tags,
        pinned: el.querySelector('#nf-pinned').checked,
        createdBy: existing?.createdBy || user?.displayName || user?.uid || 'unknown',
        linkedType: existing?.linkedType || null,
        linkedId: existing?.linkedId || null,
      }
      try {
        if (isEdit) { await updateDocData('notes', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('notes', data); notes.unshift({ ...data, id }) }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มบันทึกแล้ว', 'success')
        close(); renderBoard()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🗒️ Notes</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px" id="notes-stat"></div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="add-note-btn">➕ บันทึกใหม่</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        <input class="input" id="notes-search" placeholder="🔍 ค้นหาหัวข้อ/เนื้อหา/แท็ก..." style="max-width:280px">
        <div style="display:flex;gap:4px;flex-wrap:wrap" id="notes-tag-row"></div>
      </div>

      <div id="notes-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
        ${[...Array(3)].map(() => `<div class="skeleton" style="height:140px;border-radius:var(--radius-md)"></div>`).join('')}
      </div>
    </div>
  `

  document.getElementById('add-note-btn').addEventListener('click', () => openForm())
  let searchTimer = null
  document.getElementById('notes-search').addEventListener('input', e => {
    clearTimeout(searchTimer)
    const val = e.target.value
    searchTimer = setTimeout(() => { search = val; renderBoard() }, 200)
  })

  if (container.__routerGen === myGen) await loadData()
}
