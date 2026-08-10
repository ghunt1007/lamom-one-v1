/**
 * Overtime Tracking — ติดตาม OT
 * Route: /hr/overtime
 */
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

const OT_STATUS = {
  pending:  { label: 'รออนุมัติ', color: 'warning', icon: '⏳' },
  approved: { label: 'อนุมัติแล้ว', color: 'success', icon: '✅' },
  rejected: { label: 'ไม่อนุมัติ', color: 'danger', icon: '❌' },
  paid:     { label: 'จ่ายแล้ว', color: 'secondary', icon: '💸' },
}

const OT_RATE = 1.5 // เท่าของค่าจ้างปกติ
const MONTHLY_LIMIT_HOURS = 36 // เพดาน OT ตามกฎหมาย

// (v1.0.318) เดิม "+ บันทึก OT" ใหม่ทุกรายการเขียน hourlyRate: 200 ตายตัวเสมอ ไม่ว่าพนักงานคนนั้นได้ค่าแรง
// จริงเท่าไหร่ — ค่า OT ที่คำนวณ (hours × hourlyRate × 1.5) ผิดสำหรับทุกคนที่ไม่ได้รับ ฿200/ชม. พอดี แก้ให้
// คำนวณจากเงินเดือนจริงของพนักงานคนนั้น (ดึงจาก staff_salaries ก่อน fallback ไป staff.salary เดิมที่ยังไม่
// ย้ายข้อมูล — dual-read pattern เดียวกับ Staff.js/Payroll.js) หารเป็นค่าแรงต่อชั่วโมงด้วยฐาน 30 วัน × 8 ชม.
// (ฐานคำนวณมาตรฐานที่ใช้แปลงเงินเดือนเป็นค่าแรงรายวัน/รายชั่วโมงทั่วไป)
// ต้องเป็น HR/การเงิน/ผู้จัดการขึ้นไปเท่านั้นถึงบันทึก OT ใหม่ได้ (เดิมไม่มีการจำกัดสิทธิ์เลย) เพราะต้อง
// อ่านเงินเดือนจริงมาคำนวณ — ตรงกับสิทธิ์อ่าน staff_salaries ที่จำกัดไว้แล้วที่ระดับ Firestore Rules
const OT_MANAGE_ROLES = ['owner', 'admin', 'manager', 'hr', 'finance']
function hourlyRateFromSalary(salary) { return Math.round((Number(salary) || 0) / 30 / 8) }

function otPay(o) { return Math.round(o.hours * o.hourlyRate * OT_RATE) }

export default async function OvertimeTrackingPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  const myRole = getState('role') || getState('user')?.role || 'staff'
  const canManage = OT_MANAGE_ROLES.includes(myRole)

  let records = []
  let staffList = [] // { id, name, dept, hourlyRate } — ใช้ทั้งแบบ dropdown และคำนวณค่าแรงจริง
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { records = await listDocs('overtime_records', [], 'date', 'desc', 300) } catch (e) { records = [] }
    try {
      const [staffDocs, salaryDocs] = await Promise.all([
        listDocs('staff', [], 'firstName', 'asc', 500).catch(() => []),
        listDocs('staff_salaries', [], 'updatedAt', 'desc', 500).catch(() => []), // permission-denied ได้ถ้าไม่มีสิทธิ์ — fallback ไป staff.salary เดิม
      ])
      const salaryMap = Object.fromEntries(salaryDocs.map(d => [d.id, d.salary]))
      staffList = staffDocs.filter(s => !s.deleted).map(s => ({
        id: s.id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || '—',
        dept: s.dept || '-',
        hourlyRate: hourlyRateFromSalary(salaryMap[s.id] != null ? salaryMap[s.id] : s.salary),
      }))
    } catch (e) { staffList = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  // ชั่วโมง OT สะสมของแต่ละคน "เดือนนี้" จากข้อมูลจริง (ไม่รวมรายการที่ถูกปฏิเสธ) — แทนตัวเลขปลอมเดิม
  function monthlyHoursByStaff() {
    const ym = todayBangkok().slice(0, 7)
    const byName = {}
    records.filter(o => o.status !== 'rejected' && (o.date || '').startsWith(ym)).forEach(o => {
      byName[o.staff] = (byName[o.staff] || 0) + (o.hours || 0)
    })
    return staffList.map(s => ({ name: s.name, hours: byName[s.name] || 0, limit: MONTHLY_LIMIT_HOURS }))
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = records.filter(o => statusFilter === 'all' || o.status === statusFilter)
    const pending = records.filter(o => o.status === 'pending')
    const monthHours = records.filter(o => o.status !== 'rejected').reduce((a, o) => a + o.hours, 0)
    const monthCost = records.filter(o => ['approved','paid'].includes(o.status)).reduce((a, o) => a + otPay(o), 0)
    const byStaff = monthlyHoursByStaff()
    const nearLimit = byStaff.filter(s => s.hours / s.limit >= 0.75)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⏱ Overtime Tracking</div>
            <div class="page-subtitle">ติดตาม OT — อนุมัติ คำนวณ (อัตรา ×${OT_RATE})</div>
          </div>
          <div class="page-actions">
            ${canManage && pending.length > 0 ? `<button class="btn btn-success" id="approve-all-btn">✅ อนุมัติทั้งหมด (${pending.length})</button>` : ''}
            ${canManage ? `<button class="btn btn-primary" id="add-ot-btn">+ บันทึก OT</button>` : ''}
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⏱ OT เดือนนี้', monthHours + ' ชม.', 'primary')}
          ${kpi('💰 ค่า OT', formatCurrency(monthCost), 'warning')}
          ${kpi('⏳ รออนุมัติ', pending.length, pending.length > 0 ? 'warning' : 'success')}
          ${kpi('⚠️ ใกล้เพดาน', nearLimit.length + ' คน', nearLimit.length > 0 ? 'danger' : 'success')}
        </div>

        <!-- Monthly hours by staff -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 ชั่วโมง OT สะสมเดือนนี้ (เพดาน ${MONTHLY_LIMIT_HOURS} ชม./เดือน ตามกฎหมาย)</div>
          ${byStaff.map(s => {
            const pct = Math.round(s.hours / s.limit * 100)
            const color = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'success'
            return `<div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
                <span>${escHtml(s.name)}</span><span style="color:var(--${color})">${s.hours}/${s.limit} ชม. (${pct}%)</span>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:8px">
                <div style="width:${pct}%;background:var(--${color});height:8px;border-radius:3px"></div>
              </div>
            </div>`
          }).join('')}
          ${!byStaff.length ? `<div style="font-size:0.75rem;color:var(--text-muted)">ยังไม่มีข้อมูลพนักงาน</div>` : ''}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(OT_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- OT records -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(o => {
            const os = OT_STATUS[o.status]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${os?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.85rem">${escHtml(o.staff)} <span style="font-size:0.7rem;color:var(--text-muted)">· ${escHtml(o.dept)}</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">📅 ${formatDate(o.date)} · ⏱ ${o.hours} ชม. × ${formatCurrency(o.hourlyRate)} × ${OT_RATE}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted);font-style:italic">📌 ${escHtml(o.reason)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${os?.color}" style="font-size:0.62rem">${os?.icon} ${os?.label}</span>
                  <div style="font-size:0.88rem;font-weight:700;color:var(--success)">${formatCurrency(otPay(o))}</div>
                </div>
              </div>
              ${o.status === 'pending' ? `
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-success approve-btn" data-id="${o.id}">✅ อนุมัติ</button>
                  <button class="btn btn-xs btn-danger reject-btn" data-id="${o.id}">❌ ไม่อนุมัติ</button>
                </div>
              ` : ''}
              ${o.status === 'approved' ? `<button class="btn btn-xs btn-secondary pay-btn" data-id="${o.id}">💸 จ่ายพร้อมเงินเดือน</button>` : ''}
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-icon">⏱</div><div class="empty-title">ไม่มีรายการ OT</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('overtime_records', b.dataset.id, { status: 'approved' })
      showToast('✅ อนุมัติ OT แล้ว', 'success'); await loadData()
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('overtime_records', b.dataset.id, { status: 'rejected' })
      await loadData()
    }))
    container.querySelectorAll('.pay-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('overtime_records', b.dataset.id, { status: 'paid' })
      showToast('💸 ส่งเข้ารอบเงินเดือนแล้ว', 'success'); await loadData()
    }))
    document.getElementById('approve-all-btn')?.addEventListener('click', async () => {
      const toApprove = records.filter(o => o.status === 'pending')
      for (const o of toApprove) { await updateDocData('overtime_records', o.id, { status: 'approved' }) }
      showToast('✅ อนุมัติ OT ทั้งหมดแล้ว', 'success'); await loadData()
    })
    document.getElementById('add-ot-btn')?.addEventListener('click', () => {
      if (!staffList.length) { showToast('❗ ยังไม่มีข้อมูลพนักงาน', 'error'); return }
      openModal({
        title: '+ บันทึก OT',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">พนักงาน *</label>
            <select class="input" id="ot-staff">${staffList.map(s=>`<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">วันที่</label><input class="input" type="date" id="ot-date" value="${addDays(0)}"></div>
          <div class="input-group"><label class="input-label">จำนวนชั่วโมง</label><input class="input" type="number" min="0.5" max="8" step="0.5" id="ot-hours" value="2"></div>
          <div class="input-group"><label class="input-label">เหตุผล *</label><input class="input" id="ot-reason"></div>
        </div>`,
        async onConfirm() {
          const reason = document.getElementById('ot-reason')?.value?.trim()
          if (!reason) { showToast('❗ กรุณากรอกเหตุผล', 'error'); return false }
          const staffId = document.getElementById('ot-staff')?.value
          const staff = staffList.find(s => s.id === staffId)
          if (!staff) { showToast('❗ กรุณาเลือกพนักงาน', 'error'); return false }
          await createDoc('overtime_records', {
            staff: staff.name, dept: staff.dept,
            date: document.getElementById('ot-date')?.value||addDays(0),
            hours: parseFloat(document.getElementById('ot-hours')?.value)||1, hourlyRate: staff.hourlyRate, reason, status: 'pending',
          })
          showToast('✅ บันทึก OT แล้ว — รออนุมัติ', 'success'); await loadData()
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
