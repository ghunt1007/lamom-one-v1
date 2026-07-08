/**
 * Document Templates — แม่แบบเอกสาร
 * Route: /documents/templates
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const TPL_CATS = {
  sales:    { label: 'งานขาย', color: 'success', icon: '💰' },
  service:  { label: 'งานบริการ', color: 'warning', icon: '🔧' },
  finance:  { label: 'การเงิน', color: 'primary', icon: '🏦' },
  hr:       { label: 'HR', color: 'secondary', icon: '👤' },
  legal:    { label: 'กฎหมาย', color: 'danger', icon: '⚖️' },
}

export default async function DocumentTemplatesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let templates = []
  let catFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { templates = await listDocs('document_templates', [], 'name', 'asc', 500) } catch (e) { templates = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = templates.filter(t => catFilter === 'all' || t.cat === catFilter)
    const totalUsage = templates.reduce((a, t) => a + t.usage, 0)
    const activeCount = templates.filter(t => t.active).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📑 Document Templates</div>
            <div class="page-subtitle">แม่แบบเอกสาร — สร้างเอกสารได้ในคลิกเดียว</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-tpl-btn">+ สร้าง Template</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('📑 Templates', templates.length + ' แบบ', 'primary')}
          ${kpi('✅ ใช้งานอยู่', activeCount, 'success')}
          ${kpi('📊 สร้างเอกสารแล้ว', totalUsage.toLocaleString() + ' ครั้ง', 'secondary')}
        </div>

        <!-- Category filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
          ${Object.entries(TPL_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- Template cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${list.map(t => {
            const tc = TPL_CATS[t.cat]
            return `<div class="card" style="padding:14px${t.active?'':';opacity:0.6'}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div style="font-weight:700;font-size:0.87rem">${t.name}</div>
                <span class="badge badge-${tc?.color}" style="font-size:0.6rem">${tc?.icon} ${tc?.label}</span>
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">
                📊 ใช้ ${t.usage} ครั้ง · ล่าสุด ${timeAgo(t.lastUsed)}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
                ${t.fields.map(f => `<span style="font-size:0.62rem;background:var(--surface-2);padding:2px 6px;border-radius:3px;color:var(--text-muted)">${f}</span>`).join('')}
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-primary use-btn" data-id="${t.id}" style="flex:1" ${t.active?'':'disabled'}>📄 สร้างเอกสาร</button>
                <button class="btn btn-xs btn-secondary toggle-btn" data-id="${t.id}">${t.active?'⏸':'▶️'}</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', async () => {
      const t = templates.find(x => x.id === b.dataset.id)
      if (!t) return
      try {
        await updateDocData('document_templates', t.id, { active: !t.active })
        showToast(!t.active ? '▶️ เปิดใช้งาน Template' : '⏸ พัก Template', 'primary')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.use-btn').forEach(b => b.addEventListener('click', () => {
      const t = templates.find(x => x.id === b.dataset.id); if (t) openUseModal(t)
    }))
    document.getElementById('add-tpl-btn')?.addEventListener('click', openAddForm)
  }

  function openUseModal(t) {
    openModal({
      title: '📄 สร้างเอกสาร: ' + t.name,
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${t.fields.map((f, i) => `<div class="input-group"><label class="input-label">${f}</label><input class="input" id="doc-f-${i}"></div>`).join('')}
      </div>`,
      confirmText: '📄 สร้าง PDF',
      async onConfirm() {
        try {
          await updateDocData('document_templates', t.id, { usage: t.usage + 1, lastUsed: new Date().toISOString() })
          showToast('✅ สร้างเอกสารแล้ว — กำลังดาวน์โหลด PDF...', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openAddForm() {
    openModal({
      title: '+ สร้าง Template ใหม่',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อ Template *</label><input class="input" id="tp-name"></div>
        <div class="input-group"><label class="input-label">หมวด</label>
          <select class="input" id="tp-cat">${Object.entries(TPL_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">Fields (คั่นด้วย ,)</label><input class="input" id="tp-fields" placeholder="ชื่อลูกค้า, รุ่นรถ, ราคา"></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('tp-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        const fields = (document.getElementById('tp-fields')?.value || '').split(',').map(s => s.trim()).filter(Boolean)
        try {
          await createDoc('document_templates', { name, cat:document.getElementById('tp-cat')?.value||'sales', usage:0, lastUsed:new Date().toISOString(), fields: fields.length ? fields : ['ข้อมูล'], active:true })
          showToast('✅ สร้าง Template แล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
