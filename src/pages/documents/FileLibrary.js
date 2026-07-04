/**
 * File Library — คลังเอกสาร (อัปโหลด/เก็บ/เรียกดู/แก้ไข/ลบไฟล์จริง)
 * Route: /documents/library
 * ต่างจาก Document Studio (แต่งเอกสารข้อความ) — หน้านี้เก็บไฟล์จริง (PDF/รูป/Excel ฯลฯ)
 */
import { listDocs, createDoc, updateDocData, softDelete } from '../../core/db.js'
import { showToast, getState } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { uploadFile, deleteFile, STORAGE_ENABLED } from '../../utils/storage.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CATEGORIES = {
  general:  { label: 'ทั่วไป',   icon: '📁', color: 'secondary' },
  customer: { label: 'ลูกค้า',   icon: '👤', color: 'primary' },
  booking:  { label: 'ใบจอง',    icon: '📝', color: 'accent' },
  vehicle:  { label: 'รถยนต์',   icon: '🚗', color: 'success' },
  staff:    { label: 'พนักงาน',  icon: '🧑‍💼', color: 'warning' },
  contract: { label: 'สัญญา',    icon: '📜', color: 'danger' },
}

function fileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️'
  if (ext === 'pdf') return '📕'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  if (['doc', 'docx'].includes(ext)) return '📘'
  return '📄'
}

function formatBytes(n) {
  if (!n) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return v.toFixed(i ? 1 : 0) + ' ' + units[i]
}

export default async function FileLibraryPage(container) {
  const myGen = container.__routerGen
  const me = getState('user') || {}

  let files = []
  let filtered = []
  let catFilter = ''
  let search = ''

  async function loadData() {
    try { files = await listDocs('doc_files', [], 'uploadedAt', 'desc', 300) } catch { files = [] }
    applyFilter()
  }

  function applyFilter() {
    filtered = files.filter(f => {
      if (catFilter && f.category !== catFilter) return false
      if (search) {
        const hay = [f.name, f.linkedCustomer, f.linkedBooking, f.note].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
    renderList()
  }

  function render() {
    const catChips = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn btn-sm cat-chip ${catFilter === '' ? 'btn-primary' : 'btn-secondary'}" data-c="">ทั้งหมด (${files.length})</button>
      ${Object.entries(CATEGORIES).map(([k, v]) => {
        const n = files.filter(f => f.category === k).length
        return `<button class="btn btn-sm cat-chip ${catFilter === k ? 'btn-primary' : 'btn-secondary'}" data-c="${k}">${v.icon} ${v.label} (${n})</button>`
      }).join('')}
    </div>`

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗂️ คลังเอกสาร</div>
            <div class="page-subtitle">เก็บ · แก้ไข · เรียกดู · ลบไฟล์ ได้ทุกประเภท</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="fl-upload-btn">⬆️ อัปโหลดไฟล์</button>
          </div>
        </div>

        ${!STORAGE_ENABLED ? `<div class="card" style="padding:10px 14px;margin-bottom:14px;background:rgba(245,158,11,.08);border:1px solid var(--warning)">
          <span style="font-size:0.8rem">⚠️ <b>โหมดสาธิต (Demo Mode):</b> ยังไม่ได้ตั้งค่า Cloudflare R2 (VITE_R2_WORKER_URL) — ไฟล์ที่อัปโหลดจะเก็บไว้ชั่วคราวในเบราว์เซอร์เท่านั้น และ<b>จะหายเมื่อรีเฟรชหน้า</b> จนกว่าจะตั้งค่า R2 Worker ให้เรียบร้อย</span>
        </div>` : ''}

        <div class="card mb-4" style="padding:10px 14px">
          <div style="position:relative">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="fl-search" placeholder="ค้นหาชื่อไฟล์ / ลูกค้า / เลขที่จอง..." value="${escHtml(search)}" style="padding-left:32px">
          </div>
        </div>

        ${catChips}
        <div id="fl-list"></div>
      </div>
    `

    document.getElementById('fl-upload-btn').addEventListener('click', () => openUploadModal())
    document.getElementById('fl-search').addEventListener('input', e => { search = e.target.value.trim().toLowerCase(); applyFilter() })
    container.querySelectorAll('.cat-chip').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; render(); applyFilter() }))

    renderList()
  }

  function renderList() {
    const el = document.getElementById('fl-list')
    if (!el) return
    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">🗂️</div><div class="empty-title">ยังไม่มีไฟล์</div><div class="empty-desc">กด "⬆️ อัปโหลดไฟล์" เพื่อเริ่มเก็บเอกสารแรก</div></div>`
      return
    }
    el.innerHTML = `<div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap"><table>
        <thead><tr>
          <th style="width:32px"></th><th>ชื่อไฟล์</th><th>หมวดหมู่</th><th>ผูกกับ</th>
          <th>ขนาด</th><th>อัปโหลดโดย</th><th>วันที่</th><th></th>
        </tr></thead>
        <tbody>${filtered.map(f => fileRow(f)).join('')}</tbody>
      </table></div>
    </div>`

    el.querySelectorAll('.fl-view').forEach(b => b.addEventListener('click', () => {
      const f = files.find(x => x.id === b.dataset.id)
      if (f?.url) window.open(f.url, '_blank', 'noopener,noreferrer')
      else showToast('ไม่พบไฟล์ต้นฉบับ (อาจหมดอายุใน Demo Mode)', 'error')
    }))
    el.querySelectorAll('.fl-edit').forEach(b => b.addEventListener('click', () => openEditModal(files.find(x => x.id === b.dataset.id))))
    el.querySelectorAll('.fl-del').forEach(b => b.addEventListener('click', () => handleDelete(files.find(x => x.id === b.dataset.id))))
  }

  function fileRow(f) {
    const cat = CATEGORIES[f.category] || CATEGORIES.general
    const linked = [f.linkedCustomer, f.linkedBooking].filter(Boolean).join(' · ') || '<span style="color:var(--text-muted)">—</span>'
    return `<tr>
      <td style="font-size:1.1rem;text-align:center">${fileIcon(f.name)}</td>
      <td style="font-weight:600;font-size:0.82rem">${escHtml(f.name)}${f.note ? `<div style="font-size:0.68rem;color:var(--text-muted);font-weight:400">${escHtml(f.note)}</div>` : ''}</td>
      <td><span class="badge badge-${cat.color}" style="font-size:0.68rem">${cat.icon} ${cat.label}</span></td>
      <td style="font-size:0.76rem">${linked}</td>
      <td style="font-size:0.76rem;color:var(--text-muted);white-space:nowrap">${formatBytes(f.size)}</td>
      <td style="font-size:0.76rem">${escHtml(f.uploadedBy || '-')}</td>
      <td style="font-size:0.72rem;white-space:nowrap">${formatDate(f.uploadedAt)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-xs fl-view" data-id="${f.id}" title="เปิดดู">👁️</button>
        <button class="btn btn-ghost btn-xs fl-edit" data-id="${f.id}" title="แก้ไข">✏️</button>
        <button class="btn btn-ghost btn-xs fl-del" data-id="${f.id}" title="ลบ" style="color:var(--danger)">🗑</button>
      </td>
    </tr>`
  }

  function openUploadModal() {
    const { el, close } = openModal({
      title: '⬆️ อัปโหลดไฟล์',
      size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">เลือกไฟล์ *</label>
          <input class="input" type="file" id="fu-file" multiple accept="image/*,.pdf,.xls,.xlsx,.csv,.doc,.docx">
          <span class="input-error" id="fu-file-e"></span>
        </div>
        <div class="input-group"><label class="input-label">หมวดหมู่</label>
          <select class="input" id="fu-cat">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ผูกกับลูกค้า (ถ้ามี)</label><input class="input" id="fu-cust" placeholder="ชื่อลูกค้า"></div>
          <div class="input-group"><label class="input-label">ผูกกับเลขที่จอง (ถ้ามี)</label><input class="input" id="fu-booking" placeholder="เช่น SK2507001"></div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="fu-note" placeholder="รายละเอียดเพิ่มเติม"></div>
      `,
      footer: '<button class="btn btn-secondary" id="fu-c">ยกเลิก</button><button class="btn btn-primary" id="fu-s">⬆️ อัปโหลด</button>',
    })
    el.querySelector('#fu-c').addEventListener('click', close)
    el.querySelector('#fu-s').addEventListener('click', async () => {
      const input = el.querySelector('#fu-file')
      const selected = Array.from(input.files || [])
      if (!selected.length) { el.querySelector('#fu-file-e').textContent = '⚠️ กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์'; return }
      const category = el.querySelector('#fu-cat').value
      const linkedCustomer = el.querySelector('#fu-cust').value.trim()
      const linkedBooking = el.querySelector('#fu-booking').value.trim()
      const note = el.querySelector('#fu-note').value.trim()

      const btn = el.querySelector('#fu-s'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลังอัปโหลด...'
      let okCount = 0
      for (const file of selected) {
        try {
          const up = await uploadFile(file, 'documents')
          await createDoc('doc_files', {
            name: file.name, url: up.url, key: up.key, size: file.size,
            category, linkedCustomer, linkedBooking, note,
            uploadedBy: me.displayName || me.email || 'ระบบ',
            uploadedAt: new Date().toISOString(),
          })
          okCount++
        } catch (e) { showToast(`❗ อัปโหลด ${file.name} ไม่สำเร็จ`, 'error') }
      }
      close()
      if (okCount) { showToast(`✅ อัปโหลดสำเร็จ ${okCount}/${selected.length} ไฟล์`, 'success'); await loadData() }
    })
  }

  function openEditModal(f) {
    if (!f) return
    const { el, close } = openModal({
      title: '✏️ แก้ไขข้อมูลไฟล์',
      size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">ชื่อไฟล์</label><input class="input" id="fe-name" value="${escHtml(f.name)}"></div>
        <div class="input-group"><label class="input-label">หมวดหมู่</label>
          <select class="input" id="fe-cat">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === f.category ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ผูกกับลูกค้า</label><input class="input" id="fe-cust" value="${escHtml(f.linkedCustomer || '')}"></div>
          <div class="input-group"><label class="input-label">ผูกกับเลขที่จอง</label><input class="input" id="fe-booking" value="${escHtml(f.linkedBooking || '')}"></div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="fe-note" value="${escHtml(f.note || '')}"></div>
      `,
      footer: '<button class="btn btn-secondary" id="fe-c">ยกเลิก</button><button class="btn btn-primary" id="fe-s">💾 บันทึก</button>',
    })
    el.querySelector('#fe-c').addEventListener('click', close)
    el.querySelector('#fe-s').addEventListener('click', async () => {
      const name = el.querySelector('#fe-name').value.trim()
      if (!name) return showToast('❗ กรุณาระบุชื่อไฟล์', 'error')
      const data = {
        name, category: el.querySelector('#fe-cat').value,
        linkedCustomer: el.querySelector('#fe-cust').value.trim(),
        linkedBooking: el.querySelector('#fe-booking').value.trim(),
        note: el.querySelector('#fe-note').value.trim(),
      }
      try {
        await updateDocData('doc_files', f.id, data)
        Object.assign(f, data)
        showToast('✅ แก้ไขแล้ว', 'success')
        close(); applyFilter()
      } catch { showToast('แก้ไขไม่สำเร็จ', 'error') }
    })
  }

  async function handleDelete(f) {
    if (!f) return
    const ok = await confirmDialog({ title: 'ลบไฟล์', message: `ลบ "${f.name}" ถาวร?`, confirmText: 'ลบ', danger: true })
    if (!ok) return
    try {
      await deleteFile(f.key).catch(() => {})
      await softDelete('doc_files', f.id)
      showToast('🗑 ลบไฟล์แล้ว', 'success')
      await loadData()
    } catch { showToast('ลบไม่สำเร็จ', 'error') }
  }

  render()
  if (container.__routerGen === myGen) await loadData()
}
