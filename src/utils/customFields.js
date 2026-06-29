// Custom Field Builder — let admins add fields to any module without deploy
// Stored in Firestore collection 'custom_fields' per module

import { listDocs, createDoc, updateDocData, softDelete } from '../core/db.js'
import { openModal, confirmDialog } from './modal.js'
import { showToast } from '../core/store.js'

const FIELD_TYPES = [
  { value: 'text',     label: '📝 ข้อความ' },
  { value: 'number',   label: '🔢 ตัวเลข' },
  { value: 'select',   label: '📋 Dropdown' },
  { value: 'boolean',  label: '☑️ ใช่/ไม่ใช่' },
  { value: 'date',     label: '📅 วันที่' },
  { value: 'textarea', label: '📄 ข้อความยาว' },
  { value: 'url',      label: '🔗 URL' },
  { value: 'phone',    label: '📱 เบอร์โทร' },
]

// Load custom fields for a module
export async function getCustomFields(module) {
  return listDocs('custom_fields', [['module','==',module]], 'order', 'asc', 100)
}

// Render custom field inputs into a form container
export function renderCustomFields(fields, existingData = {}) {
  if (!fields.length) return ''
  return `
    <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px">
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">ฟิลด์เพิ่มเติม</div>
      ${fields.map(f => renderFieldInput(f, existingData[f.key] ?? '')).join('')}
    </div>
  `
}

function renderFieldInput(field, value) {
  const id = `cf-${field.key}`
  const req = field.required ? '<span class="required">*</span>' : ''
  let input = ''

  if (field.type === 'select') {
    const opts = (field.options || '').split(',').map(o => o.trim()).filter(Boolean)
    input = `<select class="input" id="${id}">
      <option value="">-- เลือก --</option>
      ${opts.map(o => `<option value="${o}" ${value===o?'selected':''}>${o}</option>`).join('')}
    </select>`
  } else if (field.type === 'boolean') {
    input = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer">
      <input type="checkbox" id="${id}" ${value?'checked':''} style="width:16px;height:16px">
      <span style="font-size:0.875rem;color:var(--text-2)">${field.label}</span>
    </label>`
    return `<div class="input-group">${input}</div>`
  } else if (field.type === 'textarea') {
    input = `<textarea class="input" id="${id}" rows="2" placeholder="${field.placeholder||''}">${value}</textarea>`
  } else {
    const typeMap = { text:'text', number:'number', date:'date', url:'url', phone:'tel' }
    input = `<input class="input" type="${typeMap[field.type]||'text'}" id="${id}" value="${value}" placeholder="${field.placeholder||''}">`
  }

  return `
    <div class="input-group">
      <label class="input-label">${field.label} ${req}</label>
      ${input}
    </div>
  `
}

// Collect custom field values from form
export function collectCustomFields(fields) {
  const data = {}
  fields.forEach(f => {
    const el = document.getElementById(`cf-${f.key}`)
    if (!el) return
    if (f.type === 'boolean') data[f.key] = el.checked
    else if (f.type === 'number') data[f.key] = el.value === '' ? '' : Number(el.value)
    else data[f.key] = el.value
  })
  return data
}

// Open Custom Field Manager modal
export async function openCustomFieldManager(module) {
  let fields = await getCustomFields(module)

  const renderList = () => fields.map((f, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)" data-fid="${f.id}">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.875rem;font-weight:600">${f.label}
          <span style="font-size:0.72rem;color:var(--text-muted);font-weight:400;margin-left:6px">${f.key}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${FIELD_TYPES.find(t=>t.value===f.type)?.label||f.type}${f.required?' · จำเป็น':''}</div>
      </div>
      <button class="btn btn-ghost btn-sm cf-edit" data-idx="${i}" title="แก้ไข">✏️</button>
      <button class="btn btn-ghost btn-sm cf-del" data-id="${f.id}" title="ลบ" style="color:var(--danger)">🗑</button>
    </div>
  `).join('')

  const { el, close } = openModal({
    title: `⚙️ จัดการ Custom Fields — ${module}`,
    size: 'md',
    body: `
      <div id="cf-list" style="margin-bottom:16px">
        ${fields.length ? renderList() : '<div class="empty-state" style="padding:24px"><div class="empty-icon">🔧</div><div class="empty-title">ยังไม่มี Custom Fields</div></div>'}
      </div>
      <button class="btn btn-secondary btn-sm" id="cf-add-new" style="width:100%;justify-content:center">➕ เพิ่มฟิลด์ใหม่</button>
    `,
    footer: `<button class="btn btn-primary" id="cf-close">เสร็จสิ้น</button>`
  })

  el.querySelector('#cf-close')?.addEventListener('click', close)

  async function refresh() {
    fields = await getCustomFields(module)
    const list = el.querySelector('#cf-list')
    if (list) list.innerHTML = fields.length ? renderList() : '<div class="empty-state" style="padding:24px"><div class="empty-icon">🔧</div><div class="empty-title">ยังไม่มี Custom Fields</div></div>'
    bindListEvents()
  }

  function bindListEvents() {
    el.querySelectorAll('.cf-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ title:'ลบฟิลด์', message:'ต้องการลบฟิลด์นี้? ข้อมูลที่บันทึกไว้จะไม่หายแต่จะไม่แสดงอีกต่อไป', confirmText:'ลบ', danger:true })
        if (!ok) return
        await softDelete('custom_fields', btn.dataset.id)
        showToast('ลบฟิลด์แล้ว', 'success')
        await refresh()
      })
    })
    el.querySelectorAll('.cf-edit').forEach(btn => {
      btn.addEventListener('click', () => openFieldForm(fields[Number(btn.dataset.idx)]))
    })
  }

  el.querySelector('#cf-add-new')?.addEventListener('click', () => openFieldForm())
  bindListEvents()

  function openFieldForm(existing = null) {
    const isEdit = !!existing
    const { el: fe, close: fc } = openModal({
      title: isEdit ? `✏️ แก้ไขฟิลด์` : `➕ เพิ่มฟิลด์ใหม่`,
      size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group">
            <label class="input-label">ชื่อฟิลด์ (label) <span class="required">*</span></label>
            <input class="input" id="cf-label" value="${existing?.label||''}" placeholder="เช่น หมายเหตุพิเศษ">
          </div>
          <div class="input-group">
            <label class="input-label">Key (ภาษาอังกฤษ ไม่มีเว้นวรรค) <span class="required">*</span></label>
            <input class="input" id="cf-key" value="${existing?.key||''}" placeholder="เช่น special_note" ${isEdit?'disabled':''}>
            <span class="input-hint" style="font-size:0.72rem;color:var(--text-muted)">ใช้ภาษาอังกฤษ a-z, 0-9, _ เท่านั้น</span>
          </div>
          <div class="input-group">
            <label class="input-label">ประเภทฟิลด์</label>
            <select class="input" id="cf-type">
              ${FIELD_TYPES.map(t=>`<option value="${t.value}" ${existing?.type===t.value?'selected':''}>${t.label}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" id="cf-options-group" style="display:${existing?.type==='select'?'':'none'}">
            <label class="input-label">ตัวเลือก (คั่นด้วย ,)</label>
            <input class="input" id="cf-options" value="${existing?.options||''}" placeholder="เช่น ใช่, ไม่ใช่, รอดูก่อน">
          </div>
          <div class="input-group">
            <label class="input-label">Placeholder</label>
            <input class="input" id="cf-placeholder" value="${existing?.placeholder||''}" placeholder="ข้อความตัวอย่างในช่อง">
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="cf-required" ${existing?.required?'checked':''} style="width:16px;height:16px">
            <span style="font-size:0.875rem">จำเป็นต้องกรอก</span>
          </label>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="cfb-cancel">ยกเลิก</button><button class="btn btn-primary" id="cfb-save">💾 บันทึก</button>`
    })

    fe.querySelector('#cf-type')?.addEventListener('change', e => {
      fe.querySelector('#cf-options-group').style.display = e.target.value === 'select' ? '' : 'none'
    })
    fe.querySelector('#cf-label')?.addEventListener('input', e => {
      if (!isEdit) {
        const key = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g,'')
        const keyEl = fe.querySelector('#cf-key')
        if (keyEl) keyEl.value = key
      }
    })
    fe.querySelector('#cfb-cancel')?.addEventListener('click', fc)
    fe.querySelector('#cfb-save')?.addEventListener('click', async () => {
      const label = fe.querySelector('#cf-label').value.trim()
      const key   = fe.querySelector('#cf-key').value.trim()
      if (!label || !key) { showToast('กรุณาระบุชื่อและ Key', 'warning'); return }
      if (!isEdit && !/^[a-z0-9_]+$/.test(key)) { showToast('Key ใช้ได้เฉพาะ a-z, 0-9, _', 'warning'); return }

      const data = {
        module, label, key,
        type: fe.querySelector('#cf-type').value,
        options: fe.querySelector('#cf-options').value,
        placeholder: fe.querySelector('#cf-placeholder').value,
        required: fe.querySelector('#cf-required').checked,
        order: isEdit ? existing.order : (fields.length + 1)
      }
      if (isEdit) await updateDocData('custom_fields', existing.id, data)
      else await createDoc('custom_fields', data)
      showToast(isEdit ? 'แก้ไขฟิลด์แล้ว' : 'เพิ่มฟิลด์แล้ว', 'success')
      fc()
      await refresh()
    })
  }
}
