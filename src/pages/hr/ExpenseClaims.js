import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CLAIM_CATS = {
  fuel:       { label: '⛽ น้ำมัน', color: 'warning' },
  meals:      { label: '🍽 ค่าอาหาร', color: 'success' },
  transport:  { label: '🚌 ค่าเดินทาง', color: 'primary' },
  phone:      { label: '📱 ค่าโทรศัพท์', color: 'accent' },
  accom:      { label: '🏨 ที่พัก', color: 'accent' },
  marketing:  { label: '📣 ค่าการตลาด', color: 'danger' },
  office:     { label: '🖊 เครื่องเขียน', color: 'primary' },
  other:      { label: '📋 อื่นๆ', color: 'primary' },
}

const CLAIM_STATUS = {
  pending:  { label: 'รออนุมัติ', color: 'warning' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  paid:     { label: 'จ่ายแล้ว', color: 'primary' },
  rejected: { label: 'ไม่อนุมัติ', color: 'danger' },
}

export default async function ExpenseClaimsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let claims = []
  let statusFilter = 'all'
  let deptFilter = 'all'
  let tab = 'claims' // claims | summary
  let loading = true

  async function loadData() {
    loading = true
    try { claims = await listDocs('expense_claims', [], 'date', 'desc', 500) } catch (e) { claims = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getFiltered() {
    let list = claims
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter)
    if (deptFilter !== 'all') list = list.filter(c => c.dept === deptFilter)
    return list
  }

  function getSummary() {
    return {
      pending: claims.filter(c => c.status === 'pending').reduce((a, c) => a + c.amount, 0),
      approved: claims.filter(c => c.status === 'approved').reduce((a, c) => a + c.amount, 0),
      paid: claims.filter(c => c.status === 'paid').reduce((a, c) => a + c.amount, 0),
      total: claims.reduce((a, c) => a + c.amount, 0),
    }
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const s = getSummary()
    const filtered = getFiltered()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💳 Expense Claims</div>
            <div class="page-subtitle">การเบิกค่าใช้จ่าย</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="ex-export">📥 Export</button>
            <button class="btn btn-primary" id="new-claim-btn">➕ ยื่นเบิก</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('⏳ รออนุมัติ', formatCurrency(s.pending), 'warning')}
          ${kpi('✅ อนุมัติแล้ว', formatCurrency(s.approved), 'success')}
          ${kpi('💳 จ่ายแล้ว', formatCurrency(s.paid), 'primary')}
          ${kpi('📊 รวมทั้งหมด', formatCurrency(s.total), 'secondary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <button class="btn btn-sm ${tab==='claims'?'btn-primary':'btn-secondary'} tab-btn" data-t="claims">📋 รายการเบิก</button>
          <button class="btn btn-sm ${tab==='summary'?'btn-primary':'btn-secondary'} tab-btn" data-t="summary">📊 สรุปหมวดหมู่</button>
        </div>

        ${tab === 'claims' ? renderClaims(filtered) : renderSummary()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('new-claim-btn')?.addEventListener('click', () => openClaimForm())
    document.getElementById('ex-export')?.addEventListener('click', () => exportToExcel(filtered.map(c => ({ วันที่:c.date, พนักงาน:c.staffName, หมวด:CLAIM_CATS[c.cat].label, รายละเอียด:c.desc, จำนวน:c.amount, สถานะ:CLAIM_STATUS[c.status].label })), 'ExpenseClaims'))
    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.querySelectorAll('.df-btn').forEach(b => b.addEventListener('click', () => { deptFilter = b.dataset.d; renderPage() }))
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const c = claims.find(x => x.id === btn.dataset.id)
        if (!c) return
        await updateDocData('expense_claims', c.id, { status: 'approved', approvedBy: 'ผู้จัดการ' })
        await notify(c, 'อนุมัติคำขอเบิกค่าใช้จ่ายแล้ว')
        showToast('✅ อนุมัติแล้ว', 'success'); await loadData()
      })
    })
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const c = claims.find(x => x.id === btn.dataset.id)
        if (!c) return
        await updateDocData('expense_claims', c.id, { status: 'rejected', rejectReason: 'ไม่อนุมัติ' })
        await notify(c, 'ไม่อนุมัติคำขอเบิกค่าใช้จ่าย')
        showToast('❌ ไม่อนุมัติ', 'danger'); await loadData()
      })
    })
    document.querySelectorAll('.pay-claim-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const c = claims.find(x => x.id === btn.dataset.id)
        if (!c) return
        await updateDocData('expense_claims', c.id, { status: 'paid', paidDate: new Date().toISOString().slice(0,10) })
        showToast('💳 จ่ายแล้ว', 'success'); await loadData()
      })
    })
    document.querySelectorAll('.del-claim-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const c = claims.find(x => x.id === btn.dataset.id)
        if (!c) return
        const ok = await confirmDialog({ title: '🗑️ ลบรายการเบิก', message: `ยืนยันลบรายการเบิกของ "${escHtml(c.staffName)}" — ${escHtml(c.desc)}?`, confirmText: 'ลบ', danger: true })
        if (!ok) return
        await softDelete('expense_claims', c.id)
        showToast('🗑️ ลบแล้ว', 'success'); await loadData()
      })
    })
  }

  async function notify(c, title) {
    try {
      await createDoc('notifications', {
        type: 'finance', title, body: `${c.staffName} — ${c.desc} (${formatCurrency(c.amount)})`,
        read: false, link: '/hr/expense', createdAt: new Date().toISOString(),
      })
      setState('unreadCount', (getState('unreadCount') || 0) + 1)
    } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบสถานะที่บันทึกไปแล้ว */ }
  }

  function renderClaims(filtered) {
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(CLAIM_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>
        <div style="display:flex;gap:4px;margin-left:auto">
          ${['all','sales','service','admin'].map(d => `<button class="btn btn-sm ${deptFilter===d?'btn-primary':'btn-secondary'} df-btn" data-d="${d}">${{all:'ทั้งแผนก',sales:'Sales',service:'Service',admin:'Admin'}[d]}</button>`).join('')}
        </div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>วันที่</th><th>พนักงาน</th><th>หมวด</th><th>รายละเอียด</th><th class="text-right">จำนวน</th><th>ใบเสร็จ</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            ${filtered.map(c => {
              const cat = CLAIM_CATS[c.cat]; const st = CLAIM_STATUS[c.status]
              return `<tr>
                <td style="font-size:0.8rem;white-space:nowrap">${escHtml(c.date)}</td>
                <td style="font-size:0.85rem;font-weight:600">${escHtml(c.staffName)}</td>
                <td><span class="badge badge-${cat.color}" style="font-size:0.67rem">${cat.label}</span></td>
                <td style="font-size:0.82rem">${escHtml(c.desc)}${c.rejectReason?`<br><span style="color:var(--danger);font-size:0.72rem">${escHtml(c.rejectReason)}</span>`:''}</td>
                <td class="text-right" style="font-weight:700">${formatCurrency(c.amount)}</td>
                <td style="text-align:center">${c.receipt?'✅':''}</td>
                <td><span class="badge badge-${st.color}">${st.label}</span></td>
                <td>
                  <div style="display:flex;gap:4px">
                    ${c.status === 'pending' ? `<button class="btn btn-xs btn-success approve-btn" data-id="${c.id}">อนุมัติ</button><button class="btn btn-xs btn-danger reject-btn" data-id="${c.id}">ปฏิเสธ</button>` : ''}
                    ${c.status === 'approved' ? `<button class="btn btn-xs btn-primary pay-claim-btn" data-id="${c.id}">จ่าย</button>` : ''}
                    <button class="btn btn-xs btn-ghost del-claim-btn" data-id="${c.id}" title="ลบ">🗑️</button>
                  </div>
                </td>
              </tr>`
            }).join('')}
            ${!filtered.length ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่มีรายการ</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `
  }

  function renderSummary() {
    const byCat = {}
    Object.keys(CLAIM_CATS).forEach(k => { byCat[k] = 0 })
    claims.filter(c => c.status !== 'rejected').forEach(c => { byCat[c.cat] = (byCat[c.cat] || 0) + c.amount })
    const total = Object.values(byCat).reduce((a, v) => a + v, 0) || 1
    const sorted = Object.entries(byCat).sort(([,a],[,b]) => b - a).filter(([,v]) => v > 0)
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${sorted.map(([k, v]) => {
          const cat = CLAIM_CATS[k]; const pct = Math.round(v / total * 100)
          return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-weight:600;font-size:0.85rem">${cat.label}</span>
              <span style="font-weight:700;color:var(--primary)">${formatCurrency(v)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;height:6px;background:var(--surface-3);border-radius:99px"><div style="height:100%;width:${pct}%;background:var(--${cat.color});border-radius:99px"></div></div>
              <span style="font-size:0.75rem;color:var(--text-muted)">${pct}%</span>
            </div>
          </div>`
        }).join('')}
      </div>
    `
  }

  function openClaimForm() {
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: '💳 ยื่นเบิกค่าใช้จ่าย', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อพนักงาน *</label><input class="input" id="ex-name" placeholder="ชื่อ-นามสกุล"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">หมวดหมู่</label>
            <select class="input" id="ex-cat">
              ${Object.entries(CLAIM_CATS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">วันที่</label><input class="input" type="date" id="ex-date" value="${today}"></div>
        </div>
        <div class="input-group"><label class="input-label">รายละเอียด *</label><input class="input" id="ex-desc" placeholder="ระบุรายละเอียด"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">จำนวนเงิน (฿) *</label><input class="input" type="number" id="ex-amount" placeholder="0"></div>
          <div class="input-group"><label class="input-label">มีใบเสร็จ?</label>
            <select class="input" id="ex-receipt"><option value="1">มีใบเสร็จ ✅</option><option value="0">ไม่มีใบเสร็จ</option></select>
          </div>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="ex-c">ยกเลิก</button><button class="btn btn-primary" id="ex-s">📩 ยื่นเบิก</button>`
    })
    el.querySelector('#ex-c').addEventListener('click', close)
    el.querySelector('#ex-s').addEventListener('click', async () => {
      const staffName = el.querySelector('#ex-name').value.trim()
      const desc = el.querySelector('#ex-desc').value.trim()
      const amount = +el.querySelector('#ex-amount').value
      if (!staffName || !desc || !amount) return showToast('❗ กรุณากรอกข้อมูลให้ครบ', 'warning')
      await createDoc('expense_claims', {
        staffName, dept: 'other',
        cat: el.querySelector('#ex-cat').value,
        desc, amount, date: el.querySelector('#ex-date').value,
        status: 'pending', approvedBy: null, paidDate: null,
        receipt: el.querySelector('#ex-receipt').value === '1'
      })
      showToast('📩 ยื่นเบิกแล้ว', 'success'); close(); await loadData()
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
