import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

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

const DEMO_CLAIMS = [
  { id:'EX001', staffName:'วิชาญ มีโชค', dept:'sales', cat:'fuel', desc:'น้ำมันเยี่ยมลูกค้า ชลบุรี', amount:850, date:'2025-06-05', status:'approved', approvedBy:'ผู้จัดการ', paidDate:null, receipt:true },
  { id:'EX002', staffName:'อรนุช สายใจ', dept:'sales', cat:'meals', desc:'ค่าอาหารลูกค้า 3 คน', amount:1200, date:'2025-06-06', status:'pending', approvedBy:null, paidDate:null, receipt:true },
  { id:'EX003', staffName:'ธีรยุทธ เก่งกาจ', dept:'service', cat:'transport', desc:'BTS/MRT ไปอบรม', amount:180, date:'2025-06-07', status:'approved', approvedBy:'ผู้จัดการ', paidDate:null, receipt:false },
  { id:'EX004', staffName:'นภา จิตดี', dept:'admin', cat:'office', desc:'กระดาษ A4 + ปากกา', amount:450, date:'2025-06-08', status:'paid', approvedBy:'ผู้จัดการ', paidDate:'2025-06-09', receipt:true },
  { id:'EX005', staffName:'วิชาญ มีโชค', dept:'sales', cat:'marketing', desc:'พิมพ์โบรชัวร์ 100 แผ่น', amount:3500, date:'2025-06-09', status:'pending', approvedBy:null, paidDate:null, receipt:true },
  { id:'EX006', staffName:'พิมพ์ใจ ตั้งมั่น', dept:'service', cat:'phone', desc:'ค่าโทรศัพท์ มิ.ย.', amount:299, date:'2025-06-01', status:'rejected', approvedBy:'ผู้จัดการ', paidDate:null, receipt:false, rejectReason:'เกินวงเงิน' },
]

export default async function ExpenseClaimsPage(container) {
  let claims = DEMO_CLAIMS.map(c => ({ ...c }))
  let statusFilter = 'all'
  let deptFilter = 'all'
  let tab = 'claims' // claims | summary

  function getFiltered() {
    let list = claims
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter)
    if (deptFilter !== 'all') list = list.filter(c => c.dept === deptFilter)
    return list.sort((a, b) => b.date.localeCompare(a.date))
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
      btn.addEventListener('click', () => {
        const c = claims.find(x => x.id === btn.dataset.id)
        if (c) { c.status = 'approved'; c.approvedBy = 'ผู้จัดการ'; showToast('✅ อนุมัติแล้ว', 'success'); renderPage() }
      })
    })
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = claims.find(x => x.id === btn.dataset.id)
        if (c) { c.status = 'rejected'; c.rejectReason = 'ไม่อนุมัติ'; showToast('❌ ไม่อนุมัติ', 'danger'); renderPage() }
      })
    })
    document.querySelectorAll('.pay-claim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = claims.find(x => x.id === btn.dataset.id)
        if (c) { c.status = 'paid'; c.paidDate = new Date().toISOString().slice(0,10); showToast('💳 จ่ายแล้ว', 'success'); renderPage() }
      })
    })
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
    el.querySelector('#ex-s').addEventListener('click', () => {
      const staffName = el.querySelector('#ex-name').value.trim()
      const desc = el.querySelector('#ex-desc').value.trim()
      const amount = +el.querySelector('#ex-amount').value
      if (!staffName || !desc || !amount) return showToast('❗ กรุณากรอกข้อมูลให้ครบ', 'warning')
      claims.unshift({
        id: 'EX' + Date.now(), staffName, dept: 'other',
        cat: el.querySelector('#ex-cat').value,
        desc, amount, date: el.querySelector('#ex-date').value,
        status: 'pending', approvedBy: null, paidDate: null,
        receipt: el.querySelector('#ex-receipt').value === '1'
      })
      showToast('📩 ยื่นเบิกแล้ว', 'success'); close(); renderPage()
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
