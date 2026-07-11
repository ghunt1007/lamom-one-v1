import { showToast } from '../../core/store.js'
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const LEAVE_TYPES = {
  sick:     { label: '🤒 ลาป่วย', badge: 'warning', maxDays: 30, paid: true },
  personal: { label: '📋 ลากิจ', badge: 'primary', maxDays: 15, paid: true },
  annual:   { label: '🏖 ลาพักร้อน', badge: 'success', maxDays: 10, paid: true },
  maternity:{ label: '👶 ลาคลอด', badge: 'accent', maxDays: 90, paid: true },
  ordain:   { label: '🧡 ลาบวช', badge: 'warning', maxDays: 15, paid: true },
  unpaid:   { label: '💔 ลาไม่รับค่าจ้าง', badge: 'danger', maxDays: 999, paid: false },
}

const LEAVE_STATUS = {
  pending:  { label: '⏳ รอพิจารณา', badge: 'warning' },
  approved: { label: '✅ อนุมัติ', badge: 'success' },
  rejected: { label: '❌ ไม่อนุมัติ', badge: 'danger' },
}

const DEMO_QUOTA = {
  sick: { used: 3, total: 30 },
  personal: { used: 2, total: 15 },
  annual: { used: 4, total: 10 },
}

function calcDays(from, to) {
  const d1 = new Date(from), d2 = new Date(to)
  return Math.max(1, Math.round((d2 - d1) / 86400000) + 1)
}

export default async function LeavePage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let leaves = []
  let activeTab = 'requests' // requests | quota | calendar
  let filterStatus = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { leaves = await listDocs('leave_requests', [], 'createdAt', 'desc', 200) } catch (e) { leaves = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const pending = leaves.filter(l => l.status === 'pending').length
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏖 Leave Management</div>
            <div class="page-subtitle">บริหารการลาพนักงาน</div>
          </div>
          <div class="page-actions">
            ${pending > 0 ? `<span class="badge badge-warning">⏳ รออนุมัติ ${pending}</span>` : ''}
            <button class="btn btn-secondary" id="lv-export">📥 Export</button>
            <button class="btn btn-primary" id="new-leave-btn">➕ ยื่นลา</button>
          </div>
        </div>

        <!-- Quota Summary -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
          ${Object.entries(DEMO_QUOTA).map(([type, q]) => {
            const t = LEAVE_TYPES[type]
            const pct = Math.round(q.used / q.total * 100)
            return `<div class="card" style="padding:14px">
              <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">${t.label}</div>
              <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px">
                <span style="font-weight:600">ใช้ไปแล้ว ${q.used} วัน</span>
                <span style="color:var(--text-muted)">เหลือ ${q.total - q.used} วัน</span>
              </div>
              <div style="background:var(--surface-3);border-radius:99px;height:6px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--${pct>=80?'danger':pct>=50?'warning':'success'});border-radius:99px"></div>
              </div>
            </div>`
          }).join('')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          ${[['requests','📋 คำขอลา'],['quota','📊 สิทธิ์ลา'],['calendar','📅 ปฏิทิน']].map(([t,l]) =>
            `<button class="btn btn-sm ${activeTab===t?'btn-primary':'btn-secondary'} lv-tab" data-t="${t}">${l}</button>`
          ).join('')}
        </div>

        ${activeTab === 'requests' ? `
          <!-- Status filter -->
          <div style="display:flex;gap:6px;margin-bottom:12px">
            ${['all','pending','approved','rejected'].map(s => `
              <button class="btn btn-sm ${filterStatus===s?'btn-primary':'btn-secondary'} sf-btn" data-s="${s}">
                ${s==='all'?'ทั้งหมด':LEAVE_STATUS[s]?.label||s}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div id="lv-content">${renderTab()}</div>
      </div>
    `

    document.querySelectorAll('.lv-tab').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.t; renderPage() }))
    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.s; renderPage() }))
    document.getElementById('new-leave-btn')?.addEventListener('click', openLeaveForm)
    document.getElementById('lv-export')?.addEventListener('click', () => {
      exportToExcel(leaves.map(l => ({ รหัส:l.id, พนักงาน:l.staff, ประเภท:LEAVE_TYPES[l.type]?.label, จาก:l.from, ถึง:l.to, วัน:l.days, เหตุผล:l.reason, สถานะ:LEAVE_STATUS[l.status]?.label })), 'Leave_Report')
    })
    bindTableEvents()
  }

  function renderTab() {
    if (activeTab === 'requests') return renderRequests()
    if (activeTab === 'quota') return renderQuota()
    if (activeTab === 'calendar') return renderCalendar()
    return ''
  }

  function renderRequests() {
    const filtered = filterStatus === 'all' ? leaves : leaves.filter(l => l.status === filterStatus)
    if (!filtered.length) return `<div class="empty-state"><div class="empty-icon">🏖</div><div class="empty-title">ไม่มีคำขอลา</div></div>`
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>พนักงาน</th><th>ประเภท</th><th>วันที่</th><th>จำนวน</th><th>เหตุผล</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            ${filtered.map(l => {
              const tp = LEAVE_TYPES[l.type]
              const st = LEAVE_STATUS[l.status]
              return `<tr>
                <td style="font-weight:600">${escHtml(l.staff)}</td>
                <td><span class="badge badge-${tp?.badge}">${tp?.label}</span></td>
                <td style="font-size:0.82rem">${escHtml(l.from)} ${l.from !== l.to ? `→ ${escHtml(l.to)}` : ''}</td>
                <td class="text-center" style="font-weight:700">${l.days} วัน</td>
                <td style="font-size:0.82rem;color:var(--text-muted);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(l.reason)}</td>
                <td><span class="badge badge-${st?.badge}">${st?.label}</span></td>
                <td>
                  ${l.status === 'pending' ? `
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-success btn-sm approve-btn" data-id="${l.id}">✅</button>
                      <button class="btn btn-ghost btn-sm reject-btn" data-id="${l.id}" style="color:var(--danger)">❌</button>
                    </div>
                  ` : `<span style="font-size:0.75rem;color:var(--text-muted)">${escHtml(l.approvedBy || '-')}</span>`}
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderQuota() {
    const staffNames = [...new Set(leaves.map(l => l.staff))]
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>พนักงาน</th>${Object.entries(LEAVE_TYPES).slice(0,4).map(([,v]) => `<th class="text-center">${v.label}</th>`).join('')}<th class="text-center">รวมที่ใช้</th></tr></thead>
          <tbody>
            ${staffNames.map(name => {
              const myLeaves = leaves.filter(l => l.staff === name && l.status === 'approved')
              const byType = {}
              Object.keys(LEAVE_TYPES).forEach(t => { byType[t] = myLeaves.filter(l => l.type === t).reduce((a, l) => a + l.days, 0) })
              const total = Object.values(byType).reduce((a, v) => a + v, 0)
              return `<tr>
                <td style="font-weight:600">${escHtml(name)}</td>
                ${Object.entries(LEAVE_TYPES).slice(0,4).map(([k,]) => `<td class="text-center" style="font-size:0.85rem">${byType[k] || 0} วัน</td>`).join('')}
                <td class="text-center"><span class="badge badge-primary">${total} วัน</span></td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderCalendar() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
    const approvedLeaves = leaves.filter(l => l.status === 'approved')

    function getLeaveOnDay(d) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      return approvedLeaves.filter(l => l.from <= dateStr && l.to >= dateStr)
    }

    return `
      <div class="card" style="padding:20px">
        <div style="font-weight:700;text-align:center;margin-bottom:16px">${monthNames[month]} ${year + 543}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
          ${['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => `<div style="text-align:center;font-size:0.72rem;font-weight:700;color:var(--text-muted);padding:4px">${d}</div>`).join('')}
          ${Array.from({ length: firstDay }, () => '<div></div>').join('')}
          ${Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const leavers = getLeaveOnDay(day)
            const isToday = day === now.getDate()
            return `<div style="min-height:50px;border:1px solid var(--border);border-radius:4px;padding:3px;background:${isToday?'var(--primary-dim)':'var(--surface)'}">
              <div style="font-size:0.72rem;font-weight:${isToday?'700':'400'};color:${isToday?'var(--primary)':'var(--text-muted)'}">${day}</div>
              ${leavers.map(l => `<div style="font-size:0.6rem;background:var(--${LEAVE_TYPES[l.type]?.badge||'secondary'}-dim);border-radius:2px;padding:1px 3px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(l.staff.split(' ')[0])}</div>`).join('')}
            </div>`
          }).join('')}
        </div>
      </div>
    `
  }

  function bindTableEvents() {
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const l = leaves.find(x => x.id === btn.dataset.id)
        if (!l) return
        try {
          await updateDocData('leave_requests', l.id, { status: 'approved', approvedBy: 'ผู้จัดการ' })
          showToast(`✅ อนุมัติการลา ${l.staff}`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!await confirmDialog({ title:'ไม่อนุมัติ', message:'ยืนยันไม่อนุมัติการลา?', confirmText:'ไม่อนุมัติ', danger:true })) return
        const l = leaves.find(x => x.id === btn.dataset.id)
        if (!l) return
        try {
          await updateDocData('leave_requests', l.id, { status: 'rejected' })
          showToast('ไม่อนุมัติการลา', 'warning')
          if (container.__routerGen !== myGen) return
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })
  }

  function openLeaveForm() {
    const today = new Date().toISOString().slice(0,10)
    const { el, close } = openModal({
      title: '➕ ยื่นคำขอลา', size:'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">พนักงาน *</label>
          <select class="input" id="lf-staff">
            ${['อรนุช สายใจ','วิชาญ มีโชค','ธีรยุทธ เก่งกาจ','สมหมาย รักงาน','นภา จันทร์งาม'].map(n => `<option>${n}</option>`).join('')}
          </select>
        </div>
        <div class="input-group"><label class="input-label">ประเภทการลา</label>
          <select class="input" id="lf-type">
            ${Object.entries(LEAVE_TYPES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วันที่เริ่ม</label><input class="input" type="date" id="lf-from" value="${today}"></div>
          <div class="input-group"><label class="input-label">วันที่สิ้นสุด</label><input class="input" type="date" id="lf-to" value="${today}"></div>
        </div>
        <div class="input-group"><label class="input-label">เหตุผล *</label><textarea class="input" id="lf-reason" rows="2"></textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="lfc">ยกเลิก</button><button class="btn btn-primary" id="lfs">📤 ยื่นคำขอ</button>`
    })
    el.querySelector('#lfc').addEventListener('click', close)
    el.querySelector('#lfs').addEventListener('click', async () => {
      const reason = el.querySelector('#lf-reason').value.trim()
      if (!reason) return
      const from = el.querySelector('#lf-from').value
      const to = el.querySelector('#lf-to').value
      try {
        await createDoc('leave_requests', {
          staff: el.querySelector('#lf-staff').value,
          type: el.querySelector('#lf-type').value,
          from, to, days: calcDays(from, to),
          reason, status: 'pending', approvedBy: null,
        })
        showToast('📤 ยื่นคำขอลาแล้ว', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}
