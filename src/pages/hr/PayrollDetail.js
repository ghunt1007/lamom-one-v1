/**
 * Payroll Detail — รายละเอียดเงินเดือน
 * Route: /finance/payroll-detail
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { printPayslip } from '../../utils/payrollDocs.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PAYROLL_STATUS = {
  draft:    { label: 'ร่าง', color: 'secondary' },
  approved: { label: 'อนุมัติแล้ว', color: 'primary' },
  paid:     { label: 'จ่ายแล้ว', color: 'success' },
}

const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน']

function netPay(s) {
  return s.base + s.commission + s.bonus + s.ot - s.tax - s.sso - s.deductions
}

export default async function PayrollDetailPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staff = []
  let monthIdx = 5
  let deptFilter = 'all'
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { staff = await listDocs('payroll_records', [], 'name', 'asc', 300) } catch (e) { staff = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const depts = [...new Set(staff.map(s => s.dept))]
    const list = staff.filter(s =>
      (deptFilter === 'all' || s.dept === deptFilter) &&
      (statusFilter === 'all' || s.status === statusFilter)
    )
    const totalNet = staff.reduce((a, s) => a + netPay(s), 0)
    const paidCount = staff.filter(s => s.status === 'paid').length
    const pendingCount = staff.filter(s => s.status !== 'paid').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💳 Payroll Detail</div>
            <div class="page-subtitle">รายละเอียดเงินเดือน — ประมวลผลและอนุมัติ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="pay-all-btn">💳 จ่ายที่อนุมัติแล้ว</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 พนักงาน', staff.length + ' คน', 'primary')}
          ${kpi('💰 จ่ายสุทธิรวม', formatCurrency(totalNet), 'success')}
          ${kpi('✅ จ่ายแล้ว', paidCount + ' คน', 'success')}
          ${kpi('⏳ ค้างจ่าย', pendingCount + ' คน', pendingCount > 0 ? 'warning' : 'secondary')}
        </div>

        <!-- Period & Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <div style="display:flex;gap:4px">
            ${MONTHS.map((m, i) => `<button class="btn btn-xs ${monthIdx===i?'btn-primary':'btn-secondary'} month-btn" data-i="${i}">${m.slice(0,3)}</button>`).join('')}
          </div>
          <select class="input" id="dept-filter" style="width:auto;height:28px;font-size:0.78rem">
            <option value="all">ทุกแผนก</option>
            ${depts.map(d => `<option value="${escHtml(d)}" ${deptFilter===d?'selected':''}>${escHtml(d)}</option>`).join('')}
          </select>
          <div style="display:flex;gap:4px">
            ${Object.entries(PAYROLL_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} st-btn" data-s="${k}">${v.label}</button>`).join('')}
            <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} st-btn" data-s="all">ทั้งหมด</button>
          </div>
        </div>

        <div class="card" style="overflow:hidden">
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:800px">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                  <th style="padding:10px 14px;text-align:left">พนักงาน</th>
                  <th style="padding:10px 10px;text-align:right">เงินเดือน</th>
                  <th style="padding:10px 10px;text-align:right">Commission</th>
                  <th style="padding:10px 10px;text-align:right">โบนัส</th>
                  <th style="padding:10px 10px;text-align:right">OT</th>
                  <th style="padding:10px 10px;text-align:right">หัก</th>
                  <th style="padding:10px 10px;text-align:right;font-weight:700">สุทธิ</th>
                  <th style="padding:10px 14px;text-align:center">สถานะ</th>
                  <th style="padding:10px 14px;text-align:center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(s => {
                  const st = PAYROLL_STATUS[s.status]
                  const net = netPay(s)
                  const totalDeduct = s.tax + s.sso + s.deductions
                  return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 14px">
                      <div style="font-weight:600;font-size:0.85rem">${escHtml(s.name)}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(s.dept)}</div>
                    </td>
                    <td style="padding:10px 10px;text-align:right;font-size:0.82rem">${formatCurrency(s.base)}</td>
                    <td style="padding:10px 10px;text-align:right;font-size:0.82rem;color:var(--success)">${s.commission > 0 ? '+'+formatCurrency(s.commission) : '-'}</td>
                    <td style="padding:10px 10px;text-align:right;font-size:0.82rem;color:var(--warning)">${s.bonus > 0 ? '+'+formatCurrency(s.bonus) : '-'}</td>
                    <td style="padding:10px 10px;text-align:right;font-size:0.82rem">${s.ot > 0 ? '+'+formatCurrency(s.ot) : '-'}</td>
                    <td style="padding:10px 10px;text-align:right;font-size:0.82rem;color:var(--danger)">-${formatCurrency(totalDeduct)}</td>
                    <td style="padding:10px 10px;text-align:right;font-weight:900;color:var(--success)">${formatCurrency(net)}</td>
                    <td style="padding:10px 14px;text-align:center"><span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span></td>
                    <td style="padding:10px 14px;text-align:center">
                      <div style="display:flex;gap:4px;justify-content:center">
                        <button class="btn btn-xs btn-secondary slip-btn" data-id="${s.id}">slip</button>
                        ${s.status === 'draft' ? `<button class="btn btn-xs btn-primary approve-btn" data-id="${s.id}">อนุมัติ</button>` : ''}
                        ${s.status === 'approved' ? `<button class="btn btn-xs btn-success pay-btn" data-id="${s.id}">จ่าย</button>` : ''}
                      </div>
                    </td>
                  </tr>`
                }).join('')}
                ${!list.length ? `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">ไม่มีรายการ</td></tr>` : ''}
              </tbody>
              <tfoot>
                <tr style="border-top:2px solid var(--border);font-weight:700">
                  <td style="padding:10px 14px;font-size:0.83rem">รวม (${list.length} คน)</td>
                  <td style="padding:10px 10px;text-align:right;font-size:0.82rem">${formatCurrency(list.reduce((a,s)=>a+s.base,0))}</td>
                  <td style="padding:10px 10px;text-align:right;font-size:0.82rem">${formatCurrency(list.reduce((a,s)=>a+s.commission,0))}</td>
                  <td style="padding:10px 10px;text-align:right;font-size:0.82rem">${formatCurrency(list.reduce((a,s)=>a+s.bonus,0))}</td>
                  <td style="padding:10px 10px;text-align:right;font-size:0.82rem">${formatCurrency(list.reduce((a,s)=>a+s.ot,0))}</td>
                  <td style="padding:10px 10px;text-align:right;font-size:0.82rem">${formatCurrency(list.reduce((a,s)=>a+s.tax+s.sso+s.deductions,0))}</td>
                  <td style="padding:10px 10px;text-align:right;color:var(--success)">${formatCurrency(list.reduce((a,s)=>a+netPay(s),0))}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.month-btn').forEach(b => b.addEventListener('click', () => { monthIdx = +b.dataset.i; renderPage() }))
    container.querySelectorAll('.st-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('dept-filter')?.addEventListener('change', e => { deptFilter = e.target.value; renderPage() })
    document.getElementById('pay-all-btn')?.addEventListener('click', async () => {
      const toPay = staff.filter(s => s.status === 'approved')
      if (!toPay.length) { showToast('ไม่มีรายการที่อนุมัติ', 'warning'); return }
      for (const s of toPay) { await updateDocData('payroll_records', s.id, { status: 'paid' }) }
      showToast(`✅ จ่ายเงินเดือน ${toPay.length} คนแล้ว!`, 'success'); await loadData()
    })
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('payroll_records', b.dataset.id, { status: 'approved' })
      showToast('✅ อนุมัติแล้ว', 'success'); await loadData()
    }))
    container.querySelectorAll('.pay-btn').forEach(b => b.addEventListener('click', async () => {
      const s = staff.find(x => x.id === b.dataset.id)
      await updateDocData('payroll_records', b.dataset.id, { status: 'paid' })
      showToast(`✅ จ่ายเงินเดือน ${s?.name} แล้ว`, 'success'); await loadData()
    }))
    container.querySelectorAll('.slip-btn').forEach(b => b.addEventListener('click', () => {
      const s = staff.find(x => x.id === b.dataset.id); if (s) openSlip(s)
    }))
  }

  function openSlip(s) {
    const net = netPay(s)
    openModal({
      title: '💳 Pay Slip — ' + escHtml(s.name),
      size: 'sm',
      body: `
        <div style="text-align:center;padding:10px 0;margin-bottom:14px">
          <div style="font-size:0.75rem;color:var(--text-muted)">${MONTHS[monthIdx]} 2568</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(s.dept)} · ${escHtml(s.id)}</div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:10px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">+ รายได้</div>
          ${row('เงินเดือน', formatCurrency(s.base))}
          ${s.commission > 0 ? row('Commission', formatCurrency(s.commission)) : ''}
          ${s.bonus > 0 ? row('โบนัส', formatCurrency(s.bonus)) : ''}
          ${s.ot > 0 ? row('OT', formatCurrency(s.ot)) : ''}
        </div>
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:6px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">- หัก</div>
          ${row('ภาษี', formatCurrency(s.tax))}
          ${row('ประกันสังคม', formatCurrency(s.sso))}
          ${s.deductions > 0 ? row('หักอื่นๆ', formatCurrency(s.deductions)) : ''}
        </div>
        <div style="border-top:2px solid var(--border);padding-top:10px;margin-top:6px;display:flex;justify-content:space-between;font-size:1rem;font-weight:900">
          <span>สุทธิ</span><span style="color:var(--success)">${formatCurrency(net)}</span>
        </div>
      `,
      footer: '<button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">ปิด</button>' +
              '<button class="btn btn-primary" id="payslip-print">🖨 พิมพ์สลิป</button>'
    })
    document.getElementById('payslip-print')?.addEventListener('click', () => printPayslip(s, MONTHS[monthIdx] + ' 2568'))
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
