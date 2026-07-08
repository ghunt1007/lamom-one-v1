/**
 * Billing Run — ระบบวางบิล (รวมใบแจ้งหนี้เป็นรอบ ส่งเก็บเงินลูกค้า)
 * Route: /finance/billing-run
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function today() { return new Date().toISOString().slice(0, 10) }

const RUN_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary', icon: '📝' },
  submitted: { label: 'วางบิลแล้ว', color: 'primary', icon: '📑' },
  overdue:   { label: 'เกินกำหนดเก็บเงิน', color: 'danger', icon: '⚠️' },
  collected: { label: 'เก็บเงินแล้ว', color: 'success', icon: '✅' },
}

export default async function BillingRunPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let runs = []
  let invoices = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try {
      runs = await listDocs('billing_runs', [], 'createdAt', 'desc', 500)
      invoices = await listDocs('invoices', [], 'date', 'desc', 500)
    } catch (e) { runs = []; invoices = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function effStatus(r) {
    if (r.status === 'submitted' && r.dueDate < today()) return 'overdue'
    return r.status
  }

  function unbilledInvoices() {
    const billedIds = new Set(runs.flatMap(r => r.invoiceIds || []))
    return invoices.filter(i => i.type === 'invoice' && i.status !== 'paid' && !billedIds.has(i.id))
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = statusFilter === 'all' ? runs : runs.filter(r => effStatus(r) === statusFilter)
    const totalOutstanding = runs.filter(r => ['submitted','overdue'].includes(effStatus(r))).reduce((a, r) => a + r.totalAmount, 0)
    const overdueCount = runs.filter(r => effStatus(r) === 'overdue').length
    const collectedThisMonth = runs.filter(r => r.status === 'collected' && (r.collectedDate||'').slice(0,7) === today().slice(0,7)).reduce((a, r) => a + r.totalAmount, 0)
    const unbilled = unbilledInvoices()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📑 ระบบวางบิล</div>
            <div class="page-subtitle">Billing Run — รวมใบแจ้งหนี้เป็นรอบเพื่อวางบิลเก็บเงินลูกค้า</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-run-btn" ${!unbilled.length?'disabled':''}>+ วางบิลใหม่ (${unbilled.length} ใบรอวางบิล)</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📑 รอบวางบิลทั้งหมด', runs.length, 'primary')}
          ${kpi('⚠️ เกินกำหนดเก็บเงิน', overdueCount, overdueCount>0?'danger':'secondary')}
          ${kpi('💰 ยอดค้างรับรวม', formatCurrency(totalOutstanding), 'warning')}
          ${kpi('✅ เก็บเงินแล้วเดือนนี้', formatCurrency(collectedThisMonth), 'success')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(RUN_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>เลขที่วางบิล</th><th>ลูกค้า</th><th>จำนวนใบแจ้งหนี้</th><th>วันที่วางบิล</th><th>กำหนดชำระ</th><th class="text-right">ยอดรวม</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${list.map(r => {
                const st = RUN_STATUS[effStatus(r)]
                return `<tr>
                  <td style="font-family:monospace;font-size:0.8rem">${esc(r.runNo)}</td>
                  <td style="font-size:0.85rem">${esc(r.customerName)}</td>
                  <td style="font-size:0.82rem">${(r.invoiceIds||[]).length} ใบ</td>
                  <td style="font-size:0.8rem">${formatDate(r.submittedDate || r.createdAt)}</td>
                  <td style="font-size:0.8rem">${formatDate(r.dueDate)}</td>
                  <td class="text-right" style="font-weight:700">${formatCurrency(r.totalAmount)}</td>
                  <td><span class="badge badge-${st?.color}">${st?.icon} ${st?.label}</span></td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-xs btn-secondary view-run-btn" data-id="${r.id}">ดู</button>
                      ${r.status !== 'collected' ? `<button class="btn btn-xs btn-success collect-btn" data-id="${r.id}">✅ เก็บเงินแล้ว</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('')}
              ${!list.length ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบรายการ</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; render() }))
    document.getElementById('new-run-btn')?.addEventListener('click', openNewRunModal)
    container.querySelectorAll('.view-run-btn').forEach(b => b.addEventListener('click', () => {
      const r = runs.find(x => x.id === b.dataset.id); if (r) openDetailModal(r)
    }))
    container.querySelectorAll('.collect-btn').forEach(b => b.addEventListener('click', async () => {
      const r = runs.find(x => x.id === b.dataset.id)
      if (!r) return
      const ok = await confirmDialog({ title: '✅ ยืนยันเก็บเงินแล้ว', message: `ยืนยันว่าเก็บเงินตามบิล ${r.runNo} ครบแล้ว?`, confirmText: 'เก็บเงินแล้ว' })
      if (!ok) return
      try {
        await updateDocData('billing_runs', r.id, { status: 'collected', collectedDate: today() })
        for (const invId of (r.invoiceIds || [])) {
          await updateDocData('invoices', invId, { status: 'paid', paidDate: today() })
        }
        showToast(`✅ บันทึกเก็บเงิน ${r.runNo} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openDetailModal(r) {
    const items = invoices.filter(i => (r.invoiceIds||[]).includes(i.id))
    openModal({
      title: '📑 ' + r.runNo + ' — ' + r.customerName,
      size: 'md',
      body: `
        <table class="table" style="font-size:0.8rem">
          <thead><tr><th>เลขที่ใบแจ้งหนี้</th><th>วันที่</th><th class="text-right">มูลค่า</th></tr></thead>
          <tbody>${items.map(i => `<tr><td>${esc(i.no)}</td><td>${formatDate(i.date)}</td><td class="text-right">${formatCurrency((i.items||[]).reduce((a,x)=>a+x.qty*x.price*(1+x.vat/100),0))}</td></tr>`).join('')}</tbody>
          <tfoot><tr style="font-weight:700"><td colspan="2">รวมทั้งสิ้น</td><td class="text-right" style="color:var(--primary)">${formatCurrency(r.totalAmount)}</td></tr></tfoot>
        </table>
      `,
      confirmText: '🖨 พิมพ์', onConfirm: () => { window.print(); return false }
    })
  }

  function openNewRunModal() {
    const unbilled = unbilledInvoices()
    const custGroups = [...new Set(unbilled.map(i => i.custName))]
    openModal({
      title: '+ วางบิลใหม่',
      size: 'lg',
      body: `
        <div class="input-group"><label class="input-label">ลูกค้า</label>
          <select class="input" id="br-cust">${custGroups.map(c => `<option>${esc(c)}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">กำหนดชำระ</label><input type="date" class="input" id="br-due" value="${(() => { const d = new Date(); d.setDate(d.getDate()+15); return d.toISOString().slice(0,10) })()}"></div>
        <div style="font-size:0.8rem;font-weight:700;margin:10px 0 6px">เลือกใบแจ้งหนี้ที่จะวางบิล</div>
        <div id="br-invoice-list" style="max-height:260px;overflow-y:auto"></div>
      `,
      async onConfirm() {
        const customerName = document.getElementById('br-cust')?.value
        const checked = [...document.querySelectorAll('.br-inv-check:checked')].map(c => c.dataset.id)
        if (!checked.length) { showToast('❗ กรุณาเลือกใบแจ้งหนี้อย่างน้อย 1 ใบ', 'error'); return false }
        const items = unbilled.filter(i => checked.includes(i.id))
        const totalAmount = items.reduce((a, i) => a + (i.items||[]).reduce((s,x)=>s+x.qty*x.price*(1+x.vat/100),0), 0)
        try {
          const runNo = 'BR-' + new Date().getFullYear() + '-' + String(runs.length + 1).padStart(4, '0')
          await createDoc('billing_runs', {
            runNo, customerName, invoiceIds: checked, totalAmount,
            submittedDate: today(), dueDate: document.getElementById('br-due')?.value || today(),
            status: 'submitted',
          })
          showToast('📑 วางบิลแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      function renderInvList(custName) {
        const filtered = unbilled.filter(i => i.custName === custName)
        document.getElementById('br-invoice-list').innerHTML = filtered.map(i => `
          <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer;font-size:0.8rem">
            <span><input type="checkbox" class="br-inv-check" data-id="${i.id}" checked> ${esc(i.no)} — ${formatDate(i.date)}</span>
            <strong>${formatCurrency((i.items||[]).reduce((s,x)=>s+x.qty*x.price*(1+x.vat/100),0))}</strong>
          </label>
        `).join('') || '<div style="color:var(--text-muted);font-size:0.8rem">ไม่มีใบแจ้งหนี้ค้างของลูกค้ารายนี้</div>'
      }
      const custSel = document.getElementById('br-cust')
      if (custSel) { renderInvList(custSel.value); custSel.addEventListener('change', () => renderInvList(custSel.value)) }
    }, 50)
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
