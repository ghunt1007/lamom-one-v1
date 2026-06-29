/**
 * Expense Approval — อนุมัติค่าใช้จ่าย
 * Route: /finance/expenses
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const EXP_CATS = {
  travel:    { label: 'เดินทาง', icon: '✈️', color: 'primary' },
  meal:      { label: 'อาหาร', icon: '🍽', color: 'warning' },
  supplies:  { label: 'อุปกรณ์', icon: '🖊', color: 'secondary' },
  marketing: { label: 'การตลาด', icon: '📣', color: 'success' },
  repair:    { label: 'ซ่อมบำรุง', icon: '🔧', color: 'warning' },
  other:     { label: 'อื่นๆ', icon: '📦', color: 'secondary' },
}

const EXP_STATUS = {
  pending:  { label: 'รออนุมัติ', color: 'warning' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  rejected: { label: 'ปฏิเสธ', color: 'danger' },
  paid:     { label: 'จ่ายแล้ว', color: 'secondary' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const DEMO_EXPENSES = [
  { id: 'EXP001', title: 'ค่าเดินทาง — BYD Training Bangkok', cat: 'travel', amount: 4800, status: 'pending', submittedBy: 'วิชัย ยอดขาย', dept: 'ฝ่ายขาย', submitDate: addHours(6), approvedBy: null, receipt: true, notes: 'อบรมผลิตภัณฑ์ BYD 2025' },
  { id: 'EXP002', title: 'ค่าอาหารลูกค้า — Business Lunch', cat: 'meal', amount: 2200, status: 'pending', submittedBy: 'สุดา มาดี', dept: 'ฝ่ายขาย', submitDate: addHours(12), approvedBy: null, receipt: true, notes: 'นัดลูกค้า B2B' },
  { id: 'EXP003', title: 'ซื้อหมึกพริ้นเตอร์ + กระดาษ A4', cat: 'supplies', amount: 1850, status: 'approved', submittedBy: 'มานี HR', dept: 'HR', submitDate: addHours(48), approvedBy: 'สมชาย ผู้จัดการ', receipt: true, notes: '' },
  { id: 'EXP004', title: 'ค่าโฆษณา Facebook Ads เดือนนี้', cat: 'marketing', amount: 15000, status: 'approved', submittedBy: 'ปทิตา Marketing', dept: 'การตลาด', submitDate: addHours(72), approvedBy: 'สมชาย ผู้จัดการ', receipt: false, notes: 'Campaign BYD Atto3' },
  { id: 'EXP005', title: 'ซ่อมแอร์ศูนย์บริการ', cat: 'repair', amount: 8500, status: 'pending', submittedBy: 'วิทยา ช่าง', dept: 'บริการ', submitDate: addHours(3), approvedBy: null, receipt: true, notes: 'แอร์ตัวที่ 2 คอมเพรสเซอร์เสีย' },
  { id: 'EXP006', title: 'ค่าเดินทางงาน Motor Expo', cat: 'travel', amount: 3600, status: 'rejected', submittedBy: 'ธนา เก่ง', dept: 'ฝ่ายขาย', submitDate: addHours(120), approvedBy: 'สมชาย ผู้จัดการ', receipt: true, notes: 'เกินวงเงิน Budget' },
]

export default async function ExpenseApprovalPage(container) {
  const myGen = container.__routerGen
  let expenses = DEMO_EXPENSES.map(e => ({ ...e }))
  let dataSource = 'demo'
  let statusFilter = 'all'
  let catFilter = 'all'

  try {
    const docs = await listDocs('expense_approvals', [], 'submitDate', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `EXP${String(i+1).padStart(3,'0')}`,
        title: d.title || d.description || d.desc || 'ค่าใช้จ่าย',
        cat: d.cat || d.category || 'other',
        amount: d.amount || 0,
        status: d.status || 'pending',
        submittedBy: d.submittedBy || d.staffName || '',
        dept: d.dept || d.department || '',
        submitDate: d.submitDate || d.createdAt || new Date().toISOString(),
        approvedBy: d.approvedBy || null,
        receipt: d.receipt !== undefined ? d.receipt : false,
        notes: d.notes || '',
      }))
      expenses = [...mapped, ...DEMO_EXPENSES]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = expenses.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (catFilter !== 'all' && e.cat !== catFilter) return false
      return true
    })
    const pending = expenses.filter(e => e.status === 'pending').length
    const pendingAmount = expenses.filter(e => e.status === 'pending').reduce((a, e) => a + e.amount, 0)
    const approvedAmount = expenses.filter(e => e.status === 'approved' || e.status === 'paid').reduce((a, e) => a + e.amount, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💸 Expense Approval</div>
            <div class="page-subtitle">อนุมัติค่าใช้จ่ายพนักงาน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-exp-btn">+ ยื่นค่าใช้จ่าย</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 รายการทั้งหมด', expenses.length, 'primary')}
          ${kpi('⏳ รออนุมัติ', pending + ' (' + formatCurrency(pendingAmount) + ')', pending > 0 ? 'warning' : 'secondary')}
          ${kpi('✅ อนุมัติแล้ว', formatCurrency(approvedAmount), 'success')}
          ${kpi('💰 เดือนนี้รวม', formatCurrency(expenses.reduce((a,e)=>a+e.amount,0)), 'primary')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
            ${Object.entries(EXP_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px">
            ${Object.entries(EXP_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon}</button>`).join('')}
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(e => {
            const cat = EXP_CATS[e.cat]
            const st = EXP_STATUS[e.status]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${st?.color})">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                <div style="display:flex;gap:12px;align-items:center;flex:1">
                  <div style="font-size:1.4rem">${cat?.icon}</div>
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:0.87rem">${escHtml(e.title)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">
                      ${escHtml(e.submittedBy)} · ${escHtml(e.dept)} · ${timeAgo(e.submitDate)}
                      ${e.receipt ? ' · <span style="color:var(--success)">🧾 มีใบเสร็จ</span>' : ' · <span style="color:var(--warning)">⚠️ ไม่มีใบเสร็จ</span>'}
                    </div>
                    ${e.notes ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">📌 ${escHtml(e.notes)}</div>` : ''}
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                  <div style="font-size:1.1rem;font-weight:800;color:var(--${st?.color})">${formatCurrency(e.amount)}</div>
                  <span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span>
                </div>
              </div>
              ${e.status === 'pending' ? `
                <div style="display:flex;gap:6px;margin-top:10px">
                  <button class="btn btn-xs btn-success approve-btn" data-id="${e.id}" style="flex:1">✓ อนุมัติ</button>
                  <button class="btn btn-xs btn-danger reject-btn" data-id="${e.id}" style="flex:1">✗ ปฏิเสธ</button>
                  <button class="btn btn-xs btn-secondary view-btn" data-id="${e.id}">ดูรายละเอียด</button>
                </div>
              ` : `<button class="btn btn-xs btn-secondary view-btn" data-id="${e.id}" style="margin-top:8px">ดูรายละเอียด</button>`}
            </div>`
          }).join('')}
          ${!list.length ? '<div class="empty-state"><div class="empty-state-icon">💸</div><div>ไม่พบรายการ</div></div>' : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    document.getElementById('add-exp-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const e = expenses.find(x => x.id === b.dataset.id); if (e) openDetail(e)
    }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => {
      const e = expenses.find(x => x.id === b.dataset.id)
      if (e) { e.status = 'approved'; e.approvedBy = 'ผู้จัดการ'; showToast(`✅ อนุมัติ "${e.title}" แล้ว`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => {
      const e = expenses.find(x => x.id === b.dataset.id)
      if (e) { e.status = 'rejected'; e.approvedBy = 'ผู้จัดการ'; showToast(`❌ ปฏิเสธ "${e.title}"`, 'warning'); renderPage() }
    }))
  }

  function openDetail(e) {
    const cat = EXP_CATS[e.cat]
    const st = EXP_STATUS[e.status]
    openModal({
      title: '💸 ' + escHtml(e.id),
      size: 'sm',
      body: `
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <span class="badge badge-${st?.color}">${st?.label}</span>
          <span class="badge badge-secondary">${cat?.icon} ${cat?.label}</span>
        </div>
        <div style="font-weight:700;margin-bottom:10px">${escHtml(e.title)}</div>
        ${row('จำนวนเงิน', formatCurrency(e.amount))}
        ${row('ยื่นโดย', escHtml(e.submittedBy) + ' (' + escHtml(e.dept) + ')')}
        ${row('วันที่ยื่น', timeAgo(e.submitDate))}
        ${row('ใบเสร็จ', e.receipt ? '✅ มี' : '⚠️ ไม่มี')}
        ${e.approvedBy ? row('โดย', escHtml(e.approvedBy)) : ''}
        ${e.notes ? row('หมายเหตุ', escHtml(e.notes)) : ''}
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ ยื่นค่าใช้จ่าย',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">รายละเอียด *</label><input class="input" id="ef-title" placeholder="ค่าใช้จ่าย..."></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="ef-cat">${Object.entries(EXP_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">จำนวนเงิน (บาท) *</label><input type="number" class="input" id="ef-amount" placeholder="0"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><input class="input" id="ef-notes" placeholder="รายละเอียดเพิ่มเติม"></div>
        </div>
      `,
      onConfirm() {
        const title = document.getElementById('ef-title')?.value?.trim()
        const amount = +document.getElementById('ef-amount')?.value || 0
        if (!title) { showToast('❗ กรุณากรอกรายละเอียด', 'error'); return }
        if (amount <= 0) { showToast('❗ กรุณากรอกจำนวนเงิน', 'error'); return }
        expenses.unshift({
          id: `EXP${String(expenses.length+1).padStart(3,'0')}`, title,
          cat: document.getElementById('ef-cat')?.value||'other', amount,
          status: 'pending', submittedBy: 'ผู้ใช้ปัจจุบัน', dept: 'ทั่วไป',
          submitDate: new Date().toISOString(), approvedBy: null, receipt: false,
          notes: document.getElementById('ef-notes')?.value||''
        })
        showToast('✅ ยื่นค่าใช้จ่ายแล้ว!', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
