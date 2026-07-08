/**
 * Checklist Engine — สร้างและใช้ Checklist ทุกประเภทในองค์กร
 * Route: /documents/checklist
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const CAT_COLORS = { DMS:'var(--primary)', บริการ:'var(--warning)', คุณภาพ:'var(--success)', HR:'var(--danger)' }

function catBadge(cat) {
  const c = CAT_COLORS[cat] || 'var(--primary)'
  return '<span style="font-size:0.62rem;padding:2px 8px;border-radius:6px;background:' + c + '22;color:' + c + ';font-weight:700">' + cat + '</span>'
}

export default async function ChecklistEnginePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let checklists = []
  let activeId = null
  let loading = true

  async function loadData() {
    loading = true
    try {
      const docs = await listDocs('checklists', [], 'name', 'asc', 500)
      checklists = docs.map(cl => ({ ...cl, progress: new Array(cl.items.length).fill(false) }))
    } catch (e) { checklists = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function checklistCard(cl) {
    const done = cl.progress.filter(Boolean).length
    return '<div class="card" style="padding:14px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
        '<div>' +
          '<div style="font-weight:700;font-size:0.82rem">' + cl.name + '</div>' +
          '<div style="font-size:0.68rem;color:var(--text-muted)">ใช้แล้ว ' + cl.usedCount + ' ครั้ง · ล่าสุด ' + cl.lastUsed + '</div>' +
        '</div>' +
        catBadge(cl.category) +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div style="font-size:0.7rem;color:var(--text-muted)">' + cl.items.length + ' รายการ' + (done > 0 ? ' · ✅ ' + done + '/' + cl.items.length : '') + '</div>' +
        '<button class="btn btn-sm btn-primary use-btn" data-id="' + cl.id + '">▶ ใช้ Checklist</button>' +
      '</div>' +
    '</div>'
  }

  function renderActive(cl) {
    const done = cl.progress.filter(Boolean).length
    const pct = Math.round(done / cl.items.length * 100)

    const itemsHtml = cl.items.map((item, i) =>
      '<label style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border-subtle);cursor:pointer;background:' + (cl.progress[i] ? 'var(--success)11' : 'transparent') + '">' +
        '<input type="checkbox" class="check-box" data-i="' + i + '" ' + (cl.progress[i] ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer">' +
        '<span style="font-size:0.8rem;' + (cl.progress[i] ? 'text-decoration:line-through;color:var(--text-muted)' : '') + '">' + item + '</span>' +
      '</label>'
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">✅ ${cl.name}</div>
            <div class="page-subtitle">${cl.category} · ${done}/${cl.items.length} รายการเสร็จแล้ว</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="back-btn">← กลับ</button>
            <button class="btn btn-primary" id="save-cl-btn">💾 บันทึกผล</button>
          </div>
        </div>

        <div class="card" style="padding:14px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:0.78rem;font-weight:700">ความคืบหน้า</span>
            <span style="font-size:0.78rem;color:var(--success);font-weight:700">${pct}%</span>
          </div>
          <div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--success);border-radius:5px;transition:width .4s"></div>
          </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          ${itemsHtml}
        </div>
      </div>`

    container.querySelectorAll('.check-box').forEach(cb => cb.addEventListener('change', e => {
      cl.progress[parseInt(e.target.dataset.i)] = e.target.checked
      renderActive(cl)
    }))
    document.getElementById('back-btn')?.addEventListener('click', () => { activeId = null; render() })
    document.getElementById('save-cl-btn')?.addEventListener('click', async () => {
      const doneCount = cl.progress.filter(Boolean).length
      try {
        await updateDocData('checklists', cl.id, { usedCount: cl.usedCount + 1, lastUsed: new Date().toISOString().slice(0, 10) })
        showToast('✅ บันทึก ' + cl.name + ' (' + doneCount + '/' + cl.items.length + ' รายการ)', 'success')
        activeId = null
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    if (activeId) {
      const cl = checklists.find(c => c.id === activeId)
      if (cl) { renderActive(cl); return }
    }

    const totalUsed = checklists.reduce((s, c) => s + c.usedCount, 0)
    const totalItems = checklists.reduce((s, c) => s + c.items.length, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">✅ Checklist Engine</div>
            <div class="page-subtitle">สร้างและใช้ Checklist ทุกประเภทในองค์กร</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-cl-btn">+ สร้าง Checklist ใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('📋 Checklist ทั้งหมด', checklists.length + ' ชุด', 'var(--primary)')}
          ${sc('🔢 รายการรวม', totalItems + ' รายการ', 'var(--warning)')}
          ${sc('📊 ใช้งานรวม', totalUsed + ' ครั้ง', 'var(--success)')}
          ${sc('📂 หมวดหมู่', '4 หมวด', 'var(--primary)')}
        </div>

        ${checklists.map(cl => checklistCard(cl)).join('')}
      </div>`

    container.querySelectorAll('.use-btn').forEach(b => b.addEventListener('click', () => { activeId = b.dataset.id; render() }))
    document.getElementById('new-cl-btn')?.addEventListener('click', openNewChecklistModal)
  }

  function openNewChecklistModal() {
    const CATS = ['DMS','บริการ','คุณภาพ','HR']
    openModal({
      title: '📋 สร้าง Checklist ใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อ Checklist *</label>
            <input id="cl-name" class="input" placeholder="PDI Checklist / Delivery Checklist..."></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">หมวดหมู่</label>
            <select id="cl-cat" class="input">
              ${CATS.map(c=>`<option>${c}</option>`).join('')}
            </select>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">รายการตรวจ (แยกบรรทัด) *</label>
            <textarea id="cl-items" class="input" rows="5" placeholder="ตรวจสอบรอยขีดข่วนภายนอก&#10;ตรวจระบบไฟทั้งหมด&#10;ทดสอบ AC&#10;..."></textarea>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="cl-save">💾 สร้าง Checklist</button>
        </div>
      `
    })
    document.getElementById('cl-save')?.addEventListener('click', async () => {
      const name = document.getElementById('cl-name')?.value.trim()
      const itemsRaw = document.getElementById('cl-items')?.value.trim()
      if (!name || !itemsRaw) { showToast('⚠️ กรุณากรอกชื่อและรายการ', 'warning'); return }
      const items = itemsRaw.split('\n').map(s=>s.trim()).filter(Boolean)
      try {
        await createDoc('checklists', {
          name,
          category: document.getElementById('cl-cat')?.value || 'DMS',
          usedCount: 0,
          lastUsed: new Date().toISOString().slice(0,10),
          items,
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ สร้าง Checklist: ' + name + ' (' + items.length + ' รายการ)', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
