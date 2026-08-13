/**
 * Staff Grievances — เรื่องร้องเรียนภายในของพนักงาน (คนละทิศทางกับ Disciplinary Records
 * ที่เป็นการตักเตือนพนักงานจากฝ่ายบริหาร — หน้านี้คือพนักงานร้องเรียนปัญหาในที่ทำงานขึ้นไปหา HR/ผู้จัดการ)
 * Route: /hr/grievances
 */
import { showToast, getState } from '../../core/store.js'
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'

function myName() {
  const me = getState('user') || {}
  return me.displayName || me.email || 'ผู้ใช้ปัจจุบัน'
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CATEGORIES = {
  harassment: { label: '🚫 การล่วงละเมิด/คุกคาม', badge: 'danger' },
  workplace:  { label: '🏢 สภาพแวดล้อมการทำงาน', badge: 'warning' },
  management: { label: '👔 การบริหาร/หัวหน้างาน', badge: 'primary' },
  salary:     { label: '💰 เงินเดือน/สวัสดิการ', badge: 'accent' },
  safety:     { label: '⚠️ ความปลอดภัย', badge: 'danger' },
  other:      { label: '📋 อื่นๆ', badge: 'secondary' },
}

const STATUS = {
  pending:   { label: '⏳ รอรับเรื่อง', badge: 'warning' },
  in_review: { label: '🔍 กำลังตรวจสอบ', badge: 'primary' },
  resolved:  { label: '✅ ดำเนินการแล้ว', badge: 'success' },
  rejected:  { label: '❌ ไม่ดำเนินการ', badge: 'danger' },
}

// สิทธิ์ดูแลเรื่องร้องเรียน (HR/ผู้จัดการ/แอดมิน/เจ้าของ) เห็นเรื่องร้องเรียนทั้งหมด
// พนักงานทั่วไปเห็นแค่เรื่องที่ตัวเองยื่นเท่านั้น (Firestore Rules บังคับจริงเช่นกัน)
const HANDLER_ROLES = ['hr', 'manager', 'admin', 'owner']

export default async function StaffGrievancesPage(container) {
  const myGen = container.__routerGen
  const me = getState('user') || {}
  const myRole = getState('role') || me.role || 'staff'
  const isHandler = HANDLER_ROLES.includes(myRole)

  let cases = []
  let filterStatus = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try {
      cases = isHandler
        ? await listDocs('staff_grievances', [], 'createdAt', 'desc', 300)
        : await listDocs('staff_grievances', [['submittedBy', '==', me.uid || '']], 'createdAt', 'desc', 100)
    } catch (e) { cases = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const pending = cases.filter(c => c.status === 'pending').length
    const filtered = filterStatus === 'all' ? cases : cases.filter(c => c.status === filterStatus)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📢 เรื่องร้องเรียนภายใน</div>
            <div class="page-subtitle">${isHandler ? 'จัดการเรื่องร้องเรียนของพนักงาน — เห็นเฉพาะ HR/ผู้จัดการ' : 'ยื่นเรื่องร้องเรียนปัญหาในที่ทำงาน — เห็นเฉพาะเรื่องที่คุณยื่นเองและ HR/ผู้จัดการเท่านั้น'}</div>
          </div>
          <div class="page-actions">
            ${isHandler && pending > 0 ? `<span class="badge badge-warning">⏳ รอรับเรื่อง ${pending}</span>` : ''}
            <button class="btn btn-primary" id="new-case-btn">➕ ยื่นเรื่องร้องเรียน</button>
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
          <button class="btn btn-sm ${filterStatus==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(STATUS).map(([k,v]) => `<button class="btn btn-sm ${filterStatus===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        ${!filtered.length ? `<div class="empty-state"><div class="empty-icon">📢</div><div class="empty-title">${isHandler ? 'ไม่มีเรื่องร้องเรียน' : 'คุณยังไม่เคยยื่นเรื่องร้องเรียน'}</div></div>` : `
        <div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap"><table class="table">
            <thead><tr>${isHandler ? '<th>ผู้ยื่น</th>' : ''}<th>หมวด</th><th>หัวข้อ</th><th>วันที่ยื่น</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${filtered.map(c => {
                const cat = CATEGORIES[c.category] || CATEGORIES.other
                const st = STATUS[c.status] || STATUS.pending
                return `<tr>
                  ${isHandler ? `<td style="font-weight:600">${escHtml(c.submittedByName)}</td>` : ''}
                  <td><span class="badge badge-${cat.badge}" style="font-size:0.68rem">${cat.label}</span></td>
                  <td style="font-size:0.83rem">${escHtml(c.subject)}</td>
                  <td style="font-size:0.78rem;color:var(--text-muted)">${timeAgo(c.createdAt)}</td>
                  <td><span class="badge badge-${st.badge}" style="font-size:0.68rem">${st.label}</span></td>
                  <td><button class="btn btn-xs btn-secondary view-btn" data-id="${c.id}">🔍 ดู</button></td>
                </tr>`
              }).join('')}
            </tbody>
          </table></div>
        </div>`}
      </div>
    `

    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.s; renderPage() }))
    document.getElementById('new-case-btn')?.addEventListener('click', openCaseForm)
    document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const c = cases.find(x => x.id === b.dataset.id); if (c) openCaseDetail(c)
    }))
  }

  function openCaseForm() {
    const { el, close } = openModal({
      title: '➕ ยื่นเรื่องร้องเรียน', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">หมวดหมู่ *</label>
          <select class="input" id="gf-category">${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="gf-subject" placeholder="สรุปสั้นๆ ว่าเรื่องอะไร"></div>
        <div class="input-group"><label class="input-label">เกี่ยวข้องกับใคร/แผนกไหน (ถ้ามี)</label><input class="input" id="gf-against" placeholder="ไม่ระบุก็ได้"></div>
        <div class="input-group"><label class="input-label">รายละเอียด *</label><textarea class="input" id="gf-desc" rows="4" placeholder="อธิบายเหตุการณ์ให้ละเอียดที่สุดเท่าที่ทำได้"></textarea></div>
        <div style="font-size:0.72rem;color:var(--text-muted);padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm)">
          🔒 เรื่องร้องเรียนนี้จะเห็นได้เฉพาะคุณและ HR/ผู้จัดการเท่านั้น (บังคับที่ระดับฐานข้อมูลจริง ไม่ใช่แค่ซ่อนที่หน้าจอ)
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="gfc">ยกเลิก</button><button class="btn btn-primary" id="gfs">📤 ส่งเรื่อง</button>`
    })
    el.querySelector('#gfc').addEventListener('click', close)
    el.querySelector('#gfs').addEventListener('click', async () => {
      const subject = el.querySelector('#gf-subject').value.trim()
      const description = el.querySelector('#gf-desc').value.trim()
      if (!subject || !description) { showToast('❗ กรอกหัวข้อและรายละเอียดให้ครบ', 'warning'); return }
      try {
        await createDoc('staff_grievances', {
          submittedBy: me.uid || '',
          submittedByName: myName(),
          category: el.querySelector('#gf-category').value,
          subject,
          against: el.querySelector('#gf-against').value.trim(),
          description,
          status: 'pending',
          resolution: '',
          resolvedBy: null,
          resolvedAt: null,
        })
        showToast('📤 ส่งเรื่องร้องเรียนแล้ว', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openCaseDetail(c) {
    const cat = CATEGORIES[c.category] || CATEGORIES.other
    const st = STATUS[c.status] || STATUS.pending
    const { el, close } = openModal({
      title: `${cat.label}`, size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:8px;align-items:center">
          <span class="badge badge-${st.badge}">${st.label}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">ยื่นเมื่อ ${formatDate(c.createdAt)}${isHandler ? ' โดย ' + escHtml(c.submittedByName) : ''}</span>
        </div>
        <div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">หัวข้อ</div><div style="font-weight:600">${escHtml(c.subject)}</div></div>
        ${c.against ? `<div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">เกี่ยวข้องกับ</div><div>${escHtml(c.against)}</div></div>` : ''}
        <div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">รายละเอียด</div><div style="white-space:pre-wrap;font-size:0.85rem">${escHtml(c.description)}</div></div>
        ${c.resolution ? `<div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);border-left:3px solid var(--success)">
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">ผลการดำเนินการ (โดย ${escHtml(c.resolvedBy || '-')})</div>
          <div style="font-size:0.85rem;white-space:pre-wrap">${escHtml(c.resolution)}</div>
        </div>` : ''}
        ${isHandler && c.status !== 'resolved' && c.status !== 'rejected' ? `
        <div class="input-group" style="margin-top:6px">
          <label class="input-label">บันทึกผลการดำเนินการ</label>
          <textarea class="input" id="gd-resolution" rows="3" placeholder="สิ่งที่ตรวจสอบ/ดำเนินการไปแล้ว">${escHtml(c.resolution || '')}</textarea>
        </div>` : ''}
      </div>`,
      footer: isHandler && c.status !== 'resolved' && c.status !== 'rejected' ? `
        <button class="btn btn-secondary" id="gdc">ปิด</button>
        ${c.status === 'pending' ? `<button class="btn btn-primary" id="gd-review">🔍 เริ่มตรวจสอบ</button>` : ''}
        <button class="btn btn-danger" id="gd-reject">❌ ไม่ดำเนินการ</button>
        <button class="btn btn-success" id="gd-resolve">✅ ดำเนินการแล้ว</button>
      ` : `<button class="btn btn-secondary" id="gdc">ปิด</button>`
    })
    el.querySelector('#gdc').addEventListener('click', close)
    el.querySelector('#gd-review')?.addEventListener('click', async () => {
      try { await updateDocData('staff_grievances', c.id, { status: 'in_review' }); showToast('🔍 เริ่มตรวจสอบแล้ว', 'success'); close(); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    el.querySelector('#gd-reject')?.addEventListener('click', async () => {
      if (!await confirmDialog({ title: 'ไม่ดำเนินการ', message: 'ยืนยันปิดเรื่องนี้โดยไม่ดำเนินการ?', confirmText: 'ยืนยัน', danger: true })) return
      const resolution = el.querySelector('#gd-resolution')?.value.trim() || ''
      try {
        await updateDocData('staff_grievances', c.id, { status: 'rejected', resolution, resolvedBy: myName(), resolvedAt: new Date().toISOString() })
        showToast('ปิดเรื่องแล้ว', 'warning'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    el.querySelector('#gd-resolve')?.addEventListener('click', async () => {
      const resolution = el.querySelector('#gd-resolution')?.value.trim() || ''
      if (!resolution) { showToast('❗ บันทึกผลการดำเนินการก่อนปิดเรื่อง', 'warning'); return }
      try {
        await updateDocData('staff_grievances', c.id, { status: 'resolved', resolution, resolvedBy: myName(), resolvedAt: new Date().toISOString() })
        showToast('✅ ดำเนินการเสร็จสิ้น', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}
