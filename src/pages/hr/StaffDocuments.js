/**
 * Staff Documents — เอกสารพนักงาน
 * Route: /hr/documents
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

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
  let docs = DEMO_DOCS.map(d => ({ ...d }))
  let typeFilter = 'all'
  let search = ''

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
                    <button class="btn btn-xs btn-secondary">⬇️</button>
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
    container.querySelectorAll('.verify-btn').forEach(b => b.addEventListener('click', () => {
      const d = docs.find(x => x.id === b.dataset.id); if (d) { d.verified = true; showToast('✅ ตรวจสอบเอกสารแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.renew-btn').forEach(b => b.addEventListener('click', () => {
      const d = docs.find(x => x.id === b.dataset.id)
      if (d) { d.expiry = addDays(365); d.uploaded = addDays(0); showToast('🔄 ต่ออายุเอกสารแล้ว (+1 ปี)', 'success'); renderPage() }
    }))
    document.getElementById('upload-btn')?.addEventListener('click', openUploadForm)
  }

  function openUploadForm() {
    openModal({
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
        <div style="padding:14px;border:2px dashed var(--border);border-radius:var(--radius-sm);text-align:center;color:var(--text-muted);font-size:0.78rem;cursor:pointer">
          📎 คลิกเพื่อเลือกไฟล์ (PDF, JPG, PNG)
        </div>
      </div>`,
      onConfirm() {
        const name = document.getElementById('doc-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อเอกสาร', 'error'); return }
        docs.unshift({ id:`D${String(docs.length+1).padStart(3,'0')}`, staff:document.getElementById('doc-staff')?.value||'—', type:document.getElementById('doc-type')?.value||'other', name, uploaded:addDays(0), expiry:document.getElementById('doc-expiry')?.value||null, verified:false })
        showToast('✅ อัปโหลดเอกสารแล้ว — รอตรวจสอบ', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
