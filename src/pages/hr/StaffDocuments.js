/**
 * Staff Documents — เอกสารพนักงาน
 * Route: /hr/documents
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'
import { uploadFile } from '../../utils/storage.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const DOC_TYPES = {
  contract:  { label: 'สัญญาจ้าง', color: 'primary', icon: '📜' },
  idcard:    { label: 'บัตรประชาชน', color: 'secondary', icon: '🪪' },
  license:   { label: 'ใบขับขี่', color: 'warning', icon: '🚗' },
  cert:      { label: 'ใบรับรอง/วุฒิ', color: 'success', icon: '🎓' },
  medical:   { label: 'ใบรับรองแพทย์', color: 'danger', icon: '🏥' },
  other:     { label: 'อื่นๆ', color: 'secondary', icon: '📄' },
}

const DEMO_DOCS = [
  { id: 'D001', staff: 'วิชัย ยอดขาย', type: 'contract', name: 'สัญญาจ้าง 2024', uploaded: addDays(-300), expiry: addDays(65), verified: true },
  { id: 'D002', staff: 'วิชัย ยอดขาย', type: 'license', name: 'ใบขับขี่ส่วนบุคคล', uploaded: addDays(-200), expiry: addDays(120), verified: true },
  { id: 'D003', staff: 'สุดา มาดี', type: 'contract', name: 'สัญญาจ้าง 2024', uploaded: addDays(-280), expiry: addDays(85), verified: true },
  { id: 'D004', staff: 'สุดา มาดี', type: 'idcard', name: 'สำเนาบัตรประชาชน', uploaded: addDays(-280), expiry: null, verified: true },
  { id: 'D005', staff: 'วิทยา ช่างใหญ่', type: 'cert', name: 'ใบรับรอง EV Specialist', uploaded: addDays(-100), expiry: addDays(20), verified: true },
  { id: 'D006', staff: 'ธนา เก่ง', type: 'medical', name: 'ใบรับรองแพทย์ประจำปี', uploaded: addDays(-360), expiry: addDays(-5), verified: true },
  { id: 'D007', staff: 'ปิยะ ดีงาม', type: 'contract', name: 'สัญญาจ้าง (ใหม่)', uploaded: addDays(-2), expiry: addDays(363), verified: false },
]

export default async function StaffDocumentsPage(container) {
  const myGen = container.__routerGen
  let docs = DEMO_DOCS.map(d => ({ ...d, _persisted: false }))
  let typeFilter = 'all'
  let search = ''

  try {
    const real = await listDocs('staff_documents', [], 'uploaded', 'desc', 200).catch(() => [])
    if (container.__routerGen === myGen && real.length) {
      docs = [...real.map(d => ({ ...d, _persisted: true })), ...docs]
    }
  } catch {}

  function expiryState(d) {
    if (!d.expiry) return 'none'
    if (d.expiry < addDays(0)) return 'expired'
    if (d.expiry <= addDays(30)) return 'expiring'
    return 'ok'
  }

  function renderPage() {
    const list = docs.filter(d =>
      (typeFilter === 'all' || d.type === typeFilter) &&
      (search === '' || d.staff.toLowerCase().includes(search) || d.name.toLowerCase().includes(search))
    )
    const expired = docs.filter(d => expiryState(d) === 'expired').length
    const expiring = docs.filter(d => expiryState(d) === 'expiring').length
    const unverified = docs.filter(d => !d.verified).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📁 Staff Documents</div>
            <div class="page-subtitle">เอกสารพนักงาน — สัญญา ใบรับรอง วันหมดอายุ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="upload-btn">+ อัปโหลดเอกสาร</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📁 เอกสารทั้งหมด', docs.length, 'primary')}
          ${kpi('❗ หมดอายุแล้ว', expired, expired > 0 ? 'danger' : 'success')}
          ${kpi('⏰ ใกล้หมดอายุ (30 วัน)', expiring, expiring > 0 ? 'warning' : 'secondary')}
          ${kpi('🔍 รอตรวจสอบ', unverified, unverified > 0 ? 'warning' : 'success')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-input" placeholder="ค้นหาพนักงาน / เอกสาร..." value="${escHtml(search)}" style="width:200px;padding:6px 10px;font-size:0.8rem">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
            ${Object.entries(DOC_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- Docs table -->
        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">พนักงาน</th>
                <th style="padding:8px 10px;text-align:left">เอกสาร</th>
                <th style="padding:8px 10px">ประเภท</th>
                <th style="padding:8px 10px">หมดอายุ</th>
                <th style="padding:8px 10px">สถานะ</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(d => {
                const dt = DOC_TYPES[d.type]
                const es = expiryState(d)
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${es==='expired'?';background:var(--danger)08':''}">
                  <td style="padding:8px 14px;font-weight:600">${escHtml(d.staff)}</td>
                  <td style="padding:8px 10px">
                    <div>${escHtml(d.name)}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">อัปโหลด ${formatDate(d.uploaded)}</div>
                  </td>
                  <td style="padding:8px 10px;text-align:center"><span class="badge badge-${dt?.color}" style="font-size:0.6rem">${dt?.icon} ${dt?.label}</span></td>
                  <td style="padding:8px 10px;text-align:center;font-size:0.73rem;color:var(--${es==='expired'?'danger':es==='expiring'?'warning':'text-muted'})">
                    ${d.expiry ? formatDate(d.expiry) + (es==='expired'?' ❗':es==='expiring'?' ⏰':'') : '—'}
                  </td>
                  <td style="padding:8px 10px;text-align:center">
                    ${d.verified ? '<span class="badge badge-success" style="font-size:0.6rem">✅ ตรวจแล้ว</span>' : `<button class="btn btn-xs btn-warning verify-btn" data-id="${d.id}">🔍 ตรวจสอบ</button>`}
                  </td>
                  <td style="padding:8px 14px;text-align:right;white-space:nowrap">
                    ${d.fileUrl ? `<button class="btn btn-xs btn-secondary view-btn" data-id="${d.id}" title="เปิดไฟล์">⬇️</button>` : `<button class="btn btn-xs btn-secondary" disabled title="ยังไม่มีไฟล์แนบ" style="opacity:.4">⬇️</button>`}
                    ${es === 'expired' || es === 'expiring' ? `<button class="btn btn-xs btn-primary renew-btn" data-id="${d.id}">🔄 ต่ออายุ</button>` : ''}
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('search-input')?.addEventListener('input', e => { search = e.target.value.toLowerCase(); renderPage() })
    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const d = docs.find(x => x.id === b.dataset.id)
      if (d?.fileUrl) window.open(d.fileUrl, '_blank', 'noopener,noreferrer')
    }))
    container.querySelectorAll('.verify-btn').forEach(b => b.addEventListener('click', async () => {
      const d = docs.find(x => x.id === b.dataset.id)
      if (!d) return
      d.verified = true
      if (d._persisted) { try { await updateDocData('staff_documents', d.id, { verified: true }) } catch {} }
      showToast('✅ ตรวจสอบเอกสารแล้ว', 'success'); renderPage()
    }))
    container.querySelectorAll('.renew-btn').forEach(b => b.addEventListener('click', async () => {
      const d = docs.find(x => x.id === b.dataset.id)
      if (!d) return
      d.expiry = addDays(365); d.uploaded = addDays(0)
      if (d._persisted) { try { await updateDocData('staff_documents', d.id, { expiry: d.expiry, uploaded: d.uploaded }) } catch {} }
      showToast('🔄 ต่ออายุเอกสารแล้ว (+1 ปี)', 'success'); renderPage()
    }))
    document.getElementById('upload-btn')?.addEventListener('click', openUploadForm)
  }

  function openUploadForm() {
    const { el, close } = openModal({
      title: '+ อัปโหลดเอกสาร',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">พนักงาน *</label>
          <select class="input" id="doc-staff">
            <option>วิชัย ยอดขาย</option><option>สุดา มาดี</option><option>ธนา เก่ง</option>
            <option>วิทยา ช่างใหญ่</option><option>ปิยะ ดีงาม</option>
          </select>
        </div>
        <div class="input-group"><label class="input-label">ชื่อเอกสาร *</label><input class="input" id="doc-name"></div>
        <div class="input-group"><label class="input-label">ประเภท</label>
          <select class="input" id="doc-type">${Object.entries(DOC_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">วันหมดอายุ (ถ้ามี)</label><input class="input" type="date" id="doc-expiry"></div>
        <div class="input-group"><label class="input-label">ไฟล์เอกสาร</label>
          <input class="input" type="file" id="doc-file" accept="image/*,.pdf">
        </div>
        <span class="input-error" id="doc-err"></span>
      </div>`,
      footer: '<button class="btn btn-secondary" id="doc-c">ยกเลิก</button><button class="btn btn-primary" id="doc-s">✅ อัปโหลด</button>',
    })
    el.querySelector('#doc-c').addEventListener('click', close)
    el.querySelector('#doc-s').addEventListener('click', async () => {
      const name = el.querySelector('#doc-name')?.value?.trim()
      if (!name) { el.querySelector('#doc-err').textContent = '❗ กรุณากรอกชื่อเอกสาร'; return }
      const staff = el.querySelector('#doc-staff')?.value || '—'
      const type = el.querySelector('#doc-type')?.value || 'other'
      const expiry = el.querySelector('#doc-expiry')?.value || null
      const file = el.querySelector('#doc-file')?.files?.[0]

      const btn = el.querySelector('#doc-s'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลังอัปโหลด...'
      let fileUrl = ''
      if (file) {
        try { const up = await uploadFile(file, 'staff/' + staff.replace(/\W+/g, '')); fileUrl = up.url }
        catch (e) { showToast(`⚠️ อัปโหลดไฟล์ไม่สำเร็จ (${e.message || 'ไม่ทราบสาเหตุ'}) — บันทึกข้อมูลไว้ก่อนได้`, 'warning') }
      }
      const data = { staff, type, name, uploaded: addDays(0), expiry, verified: false, fileUrl }
      try {
        const id = await createDoc('staff_documents', data)
        docs.unshift({ id, ...data, _persisted: true })
        try {
          await createDoc('notifications', {
            type: 'hr',
            title: 'มีเอกสารพนักงานรอตรวจสอบ',
            body: `${staff} อัปโหลด "${name}" (${DOC_TYPES[type]?.label || type}) — กรุณาตรวจสอบ`,
            read: false, link: '/hr/documents', createdAt: new Date().toISOString(),
          })
          setState('unreadCount', (getState('unreadCount') || 0) + 1)
        } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบเอกสารที่บันทึกไปแล้ว */ }
      } catch {
        docs.unshift({ id: `D${String(docs.length + 1).padStart(3, '0')}`, ...data, _persisted: false })
      }
      showToast('✅ อัปโหลดเอกสารแล้ว — รอตรวจสอบ', 'success'); close(); renderPage()
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
