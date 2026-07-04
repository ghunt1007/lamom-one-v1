/**
 * Staff Loan — เงินกู้/เบิกล่วงหน้าพนักงาน
 * Route: /hr/loans
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const LOAN_TYPES = {
  advance:   { label: 'เบิกเงินเดือนล่วงหน้า', icon: '💵', maxPct: 50, desc: 'สูงสุด 50% ของเงินเดือน หักคืนเดือนถัดไป' },
  emergency: { label: 'กู้ฉุกเฉิน', icon: '🆘', maxPct: 200, desc: 'สูงสุด 2 เท่าเงินเดือน ผ่อน 6 งวด ไม่มีดอกเบี้ย' },
  education: { label: 'กู้เพื่อการศึกษาบุตร', icon: '🎓', maxPct: 300, desc: 'สูงสุด 3 เท่าเงินเดือน ผ่อน 12 งวด' },
}

const LOAN_STATUS = {
  pending:  { label: 'รออนุมัติ', color: 'warning', icon: '⏳' },
  approved: { label: 'อนุมัติ — กำลังผ่อน', color: 'primary', icon: '💸' },
  paid:     { label: 'ผ่อนครบแล้ว', color: 'success', icon: '✅' },
  rejected: { label: 'ไม่อนุมัติ', color: 'danger', icon: '❌' },
}

export default async function StaffLoanPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let loans = []
  let loading = true

  async function loadData() {
    loading = true
    try { loans = await listDocs('staff_loans', [], 'date', 'desc', 300) } catch (e) { loans = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const pending = loans.filter(l => l.status === 'pending')
    const activeLoans = loans.filter(l => l.status === 'approved')
    const outstanding = activeLoans.reduce((a, l) => a + l.amount * (1 - l.paidInstallments / l.installments), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💸 Staff Loan</div>
            <div class="page-subtitle">เงินกู้/เบิกล่วงหน้าพนักงาน — สวัสดิการไม่มีดอกเบี้ย</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-loan-btn">+ ยื่นขอกู้/เบิก</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('⏳ รออนุมัติ', pending.length, pending.length > 0 ? 'warning' : 'success')}
          ${kpi('💸 ยอดค้างชำระรวม', formatCurrency(Math.round(outstanding)), 'primary')}
          ${kpi('📋 สัญญา active', activeLoans.length, 'secondary')}
        </div>

        <!-- Loan types -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          ${Object.values(LOAN_TYPES).map(t => `
            <div class="card" style="padding:12px">
              <div style="font-weight:700;font-size:0.82rem;margin-bottom:4px">${t.icon} ${t.label}</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">${t.desc}</div>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${loans.map(l => {
            const lt = LOAN_TYPES[l.type]
            const ls = LOAN_STATUS[l.status]
            const remaining = l.amount * (1 - l.paidInstallments / l.installments)
            const perInstallment = Math.round(l.amount / l.installments)
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${ls?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.86rem">${escHtml(l.staff)} <span style="font-size:0.7rem;color:var(--text-muted)">(เงินเดือน ${formatCurrency(l.salary)})</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${lt?.icon} ${lt?.label} · ${formatDate(l.date)} · 📌 ${escHtml(l.reason)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${ls?.color}" style="font-size:0.62rem">${ls?.icon} ${ls?.label}</span>
                  <div style="font-size:0.88rem;font-weight:700">${formatCurrency(l.amount)}</div>
                </div>
              </div>
              ${l.status === 'approved' ? `
                <div style="margin-bottom:8px">
                  <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:3px">
                    <span style="color:var(--text-muted)">ผ่อนแล้ว ${l.paidInstallments}/${l.installments} งวด (${formatCurrency(perInstallment)}/งวด หักจากเงินเดือน)</span>
                    <span style="color:var(--warning)">คงเหลือ ${formatCurrency(Math.round(remaining))}</span>
                  </div>
                  <div style="background:var(--surface-2);border-radius:3px;height:8px">
                    <div style="width:${Math.round(l.paidInstallments/l.installments*100)}%;background:var(--success);height:8px;border-radius:3px"></div>
                  </div>
                </div>
                <button class="btn btn-xs btn-success pay-btn" data-id="${l.id}">💵 หักงวดนี้ (พร้อมเงินเดือน)</button>
              ` : ''}
              ${l.status === 'pending' ? `
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-success approve-btn" data-id="${l.id}">✅ อนุมัติ</button>
                  <button class="btn btn-xs btn-danger reject-btn" data-id="${l.id}">❌ ไม่อนุมัติ</button>
                </div>
              ` : ''}
              <button class="btn btn-xs btn-ghost del-loan-btn" data-id="${l.id}" style="margin-top:6px" title="ลบ">🗑️ ลบ</button>
            </div>`
          }).join('')}
          ${!loans.length ? `<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-title">ไม่มีคำขอกู้/เบิก</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', async () => {
      const l = loans.find(x => x.id === b.dataset.id)
      if (!l) return
      await updateDocData('staff_loans', l.id, { status: 'approved' })
      showToast(`✅ อนุมัติ ${formatCurrency(l.amount)} — โอนพร้อมรอบเงินเดือน`, 'success'); await loadData()
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', async () => {
      const l = loans.find(x => x.id === b.dataset.id)
      if (!l) return
      await updateDocData('staff_loans', l.id, { status: 'rejected' })
      await loadData()
    }))
    container.querySelectorAll('.pay-btn').forEach(b => b.addEventListener('click', async () => {
      const l = loans.find(x => x.id === b.dataset.id)
      if (!l) return
      const paidInstallments = l.paidInstallments + 1
      const status = paidInstallments >= l.installments ? 'paid' : l.status
      await updateDocData('staff_loans', l.id, { paidInstallments, status })
      showToast(paidInstallments >= l.installments ? '🎉 ผ่อนครบแล้ว — ปิดสัญญา' : `💵 หักงวดที่ ${paidInstallments} แล้ว`, paidInstallments >= l.installments ? 'success' : 'primary')
      await loadData()
    }))
    container.querySelectorAll('.del-loan-btn').forEach(b => b.addEventListener('click', async () => {
      const l = loans.find(x => x.id === b.dataset.id)
      if (!l) return
      const ok = await confirmDialog({ title: '🗑️ ลบรายการกู้/เบิก', message: `ยืนยันลบรายการของ "${escHtml(l.staff)}" — ${formatCurrency(l.amount)}?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      await softDelete('staff_loans', l.id)
      showToast('🗑️ ลบแล้ว', 'success'); await loadData()
    }))
    document.getElementById('add-loan-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ ยื่นขอกู้/เบิกล่วงหน้า',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">พนักงาน *</label>
            <select class="input" id="ln-staff">
              <option data-sal="18000">มานะ ขยัน (฿18,000)</option>
              <option data-sal="24000">ธนา เก่ง (฿24,000)</option>
              <option data-sal="32000">วิชัย ยอดขาย (฿32,000)</option>
              <option data-sal="15000">สมบัติ ขับดี (฿15,000)</option>
            </select>
          </div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="ln-type">${Object.entries(LOAN_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">จำนวนเงิน (บาท) *</label><input class="input" type="number" id="ln-amount"></div>
          <div class="input-group"><label class="input-label">เหตุผล</label><input class="input" id="ln-reason"></div>
        </div>`,
        async onConfirm() {
          const sel = document.getElementById('ln-staff')
          const staffName = sel?.value?.split(' (')[0] || '—'
          const salary = parseInt(sel?.selectedOptions[0]?.dataset.sal) || 15000
          const type = document.getElementById('ln-type')?.value || 'advance'
          const amount = parseInt(document.getElementById('ln-amount')?.value) || 0
          const maxAmount = Math.round(salary * LOAN_TYPES[type].maxPct / 100)
          if (amount <= 0) { showToast('❗ กรอกจำนวนเงิน', 'error'); return false }
          if (amount > maxAmount) { showToast(`❗ เกินวงเงิน — ${LOAN_TYPES[type].label} สูงสุด ${formatCurrency(maxAmount)}`, 'error'); return false }
          const installments = type === 'advance' ? 1 : type === 'emergency' ? 6 : 12
          await createDoc('staff_loans', { staff: staffName, salary, type, amount, installments, paidInstallments: 0, status: 'pending', date: addDays(0), reason: document.getElementById('ln-reason')?.value || '—' })
          showToast('✅ ยื่นคำขอแล้ว — รอผู้จัดการอนุมัติ', 'success'); await loadData()
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
