/**
 * Form Builder — สร้างฟอร์มรับข้อมูลแบบ Drag-and-drop (text UI)
 * Route: /documents/form-builder
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const FIELD_TYPES = [
  { type:'text',     icon:'✏️', label:'Text' },
  { type:'number',   icon:'🔢', label:'Number' },
  { type:'email',    icon:'📧', label:'Email' },
  { type:'phone',    icon:'📞', label:'Phone' },
  { type:'date',     icon:'📅', label:'Date' },
  { type:'select',   icon:'📋', label:'Dropdown' },
  { type:'radio',    icon:'⚪', label:'Radio' },
  { type:'checkbox', icon:'☑️', label:'Checkbox' },
  { type:'textarea', icon:'📝', label:'Long Text' },
  { type:'file',     icon:'📎', label:'File Upload' },
]

let activeFields = []
let editingFormId = null

export default async function FormBuilderPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let forms = []
  let view = 'list' // list | editor
  let loading = true

  async function loadData() {
    loading = true
    try { forms = await listDocs('forms', [], 'name', 'asc', 500) } catch (e) { forms = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    if (view === 'list') renderList()
    else renderEditor()
  }

  function renderList() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📝 Form Builder</div>
            <div class="page-subtitle">สร้างฟอร์มรับข้อมูลลูกค้าได้เอง · ${forms.length} ฟอร์ม · ${forms.reduce((s,f)=>s+f.submissions,0)} การตอบ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-form-btn">+ สร้างฟอร์มใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
          ${forms.map(f => formCard(f)).join('')}
        </div>
      </div>`

    document.getElementById('new-form-btn')?.addEventListener('click', () => openNewFormModal())
    container.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => {
      const f = forms.find(x => x.id === b.dataset.id)
      if (f) { editingFormId = f.id; activeFields = f.fields.map((l,i)=>({id:'fx'+(i+1),type:'text',label:l,required:i<2})); view='editor'; render() }
    }))
    container.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', () => {
      const url = 'https://lamom.app/form/' + b.dataset.id
      navigator.clipboard?.writeText(url)
        .then(() => showToast('🔗 Copy Link แล้ว · ' + url, 'success'))
        .catch(() => showToast('🔗 Link: ' + url, 'success'))
    }))
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', async () => {
      const f = forms.find(x => x.id === b.dataset.id)
      if (!f) return
      try {
        await updateDocData('forms', f.id, { active: !f.active })
        showToast(`${!f.active?'✅ เปิด':'⏸ ปิด'} "${f.name}" แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function renderEditor() {
    const form = forms.find(f => f.id === editingFormId) || { name: 'ฟอร์มใหม่' }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚙ แก้ไขฟอร์ม: ${form.name}</div>
            <div class="page-subtitle">ลากสลับตำแหน่ง · เพิ่ม/ลบช่อง · ตั้งค่า Required</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="back-btn">← กลับ</button>
            <button class="btn btn-secondary" id="preview-btn">👁 Preview</button>
            <button class="btn btn-primary" id="save-btn">💾 บันทึก</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:220px 1fr;gap:16px">
          <!-- Field palette -->
          <div>
            <div class="card" style="padding:12px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">➕ เพิ่มช่องใหม่</div>
              <div style="display:flex;flex-direction:column;gap:5px">
                ${FIELD_TYPES.map(ft=>`
                  <button class="btn btn-secondary add-field-btn" data-type="${ft.type}" style="text-align:left;padding:7px 10px;font-size:0.76rem">
                    ${ft.icon} ${ft.label}
                  </button>`).join('')}
              </div>
            </div>
          </div>

          <!-- Field list -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 ช่องในฟอร์ม (${activeFields.length} ช่อง)</div>
            <div id="fields-list" style="display:flex;flex-direction:column;gap:8px">
              ${activeFields.map((f, i) => fieldRow(f, i)).join('')}
            </div>
            ${activeFields.length === 0 ? `<div style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:30px">เพิ่มช่องจากแถบซ้าย</div>` : ''}
          </div>
        </div>
      </div>`

    document.getElementById('back-btn')?.addEventListener('click', () => { view='list'; render() })
    document.getElementById('save-btn')?.addEventListener('click', async () => {
      const f = forms.find(x => x.id === editingFormId)
      if (!f) return
      try {
        await updateDocData('forms', f.id, { fields: activeFields.map(f=>f.label) })
        view='list'
        showToast('💾 บันทึกฟอร์มแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    document.getElementById('preview-btn')?.addEventListener('click', () => openPreviewModal())
    container.querySelectorAll('.add-field-btn').forEach(b => b.addEventListener('click', () => {
      const ft = FIELD_TYPES.find(x => x.type === b.dataset.type)
      activeFields.push({ id:'fx'+Date.now(), type:b.dataset.type, label:ft.label+' '+(activeFields.length+1), required:false })
      render()
    }))
    container.querySelectorAll('.del-field-btn').forEach(b => b.addEventListener('click', () => {
      activeFields = activeFields.filter(f => f.id !== b.dataset.id); render()
    }))
    container.querySelectorAll('.req-toggle').forEach(b => b.addEventListener('change', () => {
      const f = activeFields.find(x => x.id === b.dataset.id)
      if (f) f.required = b.checked
    }))
    container.querySelectorAll('.up-btn').forEach(b => b.addEventListener('click', () => {
      const i = activeFields.findIndex(x => x.id === b.dataset.id)
      if (i > 0) { [activeFields[i-1],activeFields[i]] = [activeFields[i],activeFields[i-1]]; render() }
    }))
    container.querySelectorAll('.dn-btn').forEach(b => b.addEventListener('click', () => {
      const i = activeFields.findIndex(x => x.id === b.dataset.id)
      if (i < activeFields.length-1) { [activeFields[i+1],activeFields[i]] = [activeFields[i],activeFields[i+1]]; render() }
    }))
  }

  function fieldRow(f, i) {
    const ft = FIELD_TYPES.find(x => x.type === f.type) || FIELD_TYPES[0]
    return `
      <div style="display:flex;align-items:center;gap:8px;background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm)">
        <div style="display:flex;flex-direction:column;gap:1px">
          <button class="btn btn-xs btn-secondary up-btn" data-id="${f.id}" style="padding:1px 6px;line-height:1">▲</button>
          <button class="btn btn-xs btn-secondary dn-btn" data-id="${f.id}" style="padding:1px 6px;line-height:1">▼</button>
        </div>
        <span style="font-size:1rem;flex-shrink:0">${ft.icon}</span>
        <span style="font-size:0.76rem;font-weight:700;flex:1">${f.label}</span>
        <span style="font-size:0.64rem;background:var(--primary)22;color:var(--primary);padding:2px 6px;border-radius:6px">${ft.label}</span>
        <label style="display:flex;align-items:center;gap:4px;font-size:0.72rem;flex-shrink:0">
          <input type="checkbox" class="req-toggle" data-id="${f.id}" ${f.required?'checked':''}>Required
        </label>
        <button class="btn btn-xs btn-secondary del-field-btn" data-id="${f.id}" style="color:var(--danger)">✕</button>
      </div>`
  }

  function formCard(f) {
    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-weight:700;font-size:0.88rem">${f.name}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${f.desc}</div>
          </div>
          <span style="font-size:0.64rem;background:${f.active?'var(--success)':'var(--surface-2)'};color:${f.active?'#fff':'var(--text-muted)'};padding:2px 8px;border-radius:10px">${f.active?'เปิด':'ปิด'}</span>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">${f.fields.length} ช่อง · ${f.submissions} การตอบ</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${f.fields.slice(0,3).map(l=>`<span style="font-size:0.64rem;background:var(--surface-2);padding:2px 7px;border-radius:6px">${l}</span>`).join('')}${f.fields.length>3?`<span style="font-size:0.64rem;color:var(--text-muted)">+${f.fields.length-3}</span>`:''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-xs btn-secondary edit-btn" data-id="${f.id}">⚙ แก้ไข</button>
          <button class="btn btn-xs btn-secondary share-btn" data-id="${f.id}">🔗 แชร์</button>
          <button class="btn btn-xs btn-secondary toggle-btn" data-id="${f.id}">${f.active?'⏸':'▶'}</button>
        </div>
      </div>`
  }

  function openNewFormModal() {
    openModal({
      title:'+ สร้างฟอร์มใหม่', size:'xs',
      body:`<div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อฟอร์ม</label><input class="input" id="nf-name" placeholder="เช่น ฟอร์มจองทดลองขับ" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">คำอธิบาย</label><input class="input" id="nf-desc" placeholder="คำอธิบายสั้นๆ" style="width:100%;margin-top:4px"></div>
      </div>`,
      confirmText:'สร้าง',
      async onConfirm() {
        const name = document.getElementById('nf-name')?.value.trim()
        const desc = document.getElementById('nf-desc')?.value.trim()
        if (!name) { showToast('ใส่ชื่อฟอร์ม', 'warning'); return false }
        try {
          const id = await createDoc('forms', { name, desc, fields:[], submissions:0, active:true })
          editingFormId = id; activeFields = []; view = 'editor'
          showToast(`✅ สร้าง "${name}" แล้ว — เพิ่มช่องได้เลย`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openPreviewModal() {
    openModal({
      title: '👁 Preview ฟอร์ม',
      size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        ${activeFields.map(f => {
          const ft = FIELD_TYPES.find(x=>x.type===f.type)||FIELD_TYPES[0]
          return `<div>
            <label style="font-size:0.76rem;font-weight:600">${f.label}${f.required?' <span style="color:var(--danger)">*</span>':''}</label>
            ${f.type==='textarea' ? `<textarea class="input" style="width:100%;margin-top:4px;height:60px" placeholder="${f.label}"></textarea>`
              : f.type==='select' ? `<select class="input" style="width:100%;margin-top:4px"><option>-- เลือก --</option></select>`
              : `<input class="input" type="${f.type}" placeholder="${f.label}" style="width:100%;margin-top:4px">`}
          </div>`
        }).join('')}`,
      confirmText: '✉ ส่งฟอร์ม (ทดสอบ)',
      async onConfirm() {
        const f = forms.find(x => x.id === editingFormId)
        if (!f) { showToast('📨 ส่งฟอร์มทดสอบแล้ว · ฟอร์มใหม่', 'success'); return }
        try {
          await updateDocData('forms', f.id, { submissions: f.submissions + 1 })
          showToast(`📨 ส่งฟอร์มทดสอบแล้ว · ${f.name} (${f.submissions + 1} การตอบ)`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}
