/**
 * Deposit Management — มัดจำ รับ/คืน/ตัดยอด
 * Route: /finance/deposit
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const ST = {
  held:     { label: 'ถือไว้',   color: 'var(--primary)' },
  applied:  { label: 'ตัดเข้าค่ารถ', color: 'var(--success)' },
  refunded: { label: 'คืนแล้ว',  color: 'var(--text-muted)' },
}

export default async function DepositManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let deposits = []
  let loading = true

  async function loadData() {
    loading = true
    try { deposits = await listDocs('deposits', [], 'date', 'desc', 200) } catch (e) { deposits = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const held = deposits.filter(d => d.status === 'held')
    const heldTotal = held.reduce((s, d) => s + d.amount, 0)
    const appliedTotal = deposits.filter(d => d.status === 'applied').reduce((s, d) => s + d.amount, 0)
    const refundTotal = deposits.filter(d => d.status === 'refunded').reduce((s, d) => s + d.amount, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💵 Deposit Management</div>
            <div class="page-subtitle">บริหารเงินมัดจำ — รับ / ตัดเข้าค่ารถ / คืนเงิน</div>
          </div>
          <div class="page-actions"><button class="btn btn-primary" id="add-btn">➕ รับมัดจำ</button></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${stat('🔒 มัดจำคงเหลือ', formatCurrency(heldTotal), 'var(--primary)', held.length + ' รายการ')}
          ${stat('✅ ตัดเข้าค่ารถ', formatCurrency(appliedTotal), 'var(--success)')}
          ${stat('↩️ คืนเงินแล้ว', formatCurrency(refundTotal), 'var(--text-muted)')}
        </div>

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:780px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
              <th style="padding:10px 12px">เลขที่</th><th>ลูกค้า / รถ</th><th>ใบจอง</th>
              <th style="text-align:right">จำนวน</th><th style="text-align:center">ช่องทาง</th>
              <th style="text-align:center">วันที่รับ</th><th style="text-align:center">สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              ${deposits.map(d => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:9px 12px;font-weight:600">${escHtml(d.id)}</td>
                  <td>${escHtml(d.customer)}<div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(d.model)}</div></td>
                  <td style="font-size:0.74rem;color:var(--text-muted)">${escHtml(d.booking)}</td>
                  <td style="text-align:right;font-weight:700">${formatCurrency(d.amount)}</td>
                  <td style="text-align:center;font-size:0.74rem">${escHtml(d.method)}</td>
                  <td style="text-align:center;font-size:0.74rem">${formatDate(d.date)}</td>
                  <td style="text-align:center"><span style="font-size:0.66rem;background:${ST[d.status].color};color:#fff;padding:2px 8px;border-radius:10px">${ST[d.status].label}</span></td>
                  <td style="text-align:right;padding-right:12px">${d.status==='held'?`
                    <button class="btn btn-xs btn-secondary apply-btn" data-id="${escHtml(d.id)}">ตัดค่ารถ</button>
                    <button class="btn btn-xs btn-secondary refund-btn" data-id="${escHtml(d.id)}" style="color:var(--danger)">คืน</button>`:''}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 "ตัดค่ารถ" = นำมัดจำหักจากยอดที่ลูกค้าต้องชำระ · "คืน" = ลูกค้ายกเลิกการจอง</p>
      </div>
    `

    container.querySelectorAll('.apply-btn').forEach(b => b.addEventListener('click', () => act(b.dataset.id, 'applied')))
    container.querySelectorAll('.refund-btn').forEach(b => b.addEventListener('click', () => act(b.dataset.id, 'refunded')))
    document.getElementById('add-btn')?.addEventListener('click', openAdd)
  }

  function act(id, status) {
    const d = deposits.find(x => x.id === id)
    if (!d) return
    openModal({
      title: status === 'applied' ? '✅ ตัดมัดจำเข้าค่ารถ ' + escHtml(d.id) : '↩️ คืนมัดจำ ' + escHtml(d.id),
      size: 'sm',
      body: `<div style="font-size:0.84rem">ลูกค้า: <strong>${escHtml(d.customer)}</strong><br>รถ: ${escHtml(d.model)}<br>จำนวน: <strong style="color:var(--primary)">${formatCurrency(d.amount)}</strong></div>
        ${status === 'refunded' ? `<div class="input-group" style="margin-top:10px"><label class="input-label">เหตุผลการคืน</label><input class="input" id="dp-reason" placeholder="เช่น ลูกค้ายกเลิกจอง"></div>` : ''}`,
      confirmText: status === 'applied' ? '✅ ยืนยันตัดยอด' : '↩️ ยืนยันคืนเงิน',
      async onConfirm() {
        try {
          await updateDocData('deposits', d.id, { status })
          showToast(status === 'applied'
            ? `ตัดมัดจำ ${formatCurrency(d.amount)} เข้าค่ารถ ${d.model} แล้ว`
            : `บันทึกคืนมัดจำ ${formatCurrency(d.amount)} ให้ ${d.customer} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openAdd() {
    openModal({
      title: '➕ รับเงินมัดจำ',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="dp-cust"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ *</label><input class="input" id="dp-model"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">จำนวนเงิน *</label><input class="input" type="number" id="dp-amt"></div>
          <div class="input-group" style="width:120px"><label class="input-label">ช่องทาง</label><select class="input" id="dp-method"><option>โอน</option><option>เงินสด</option><option>บัตรเครดิต</option><option>QR</option></select></div>
        </div>
        <div class="input-group"><label class="input-label">เลขที่ใบจอง</label><input class="input" id="dp-bk" placeholder="BK-xxxx"></div>
      </div>`,
      confirmText: '💾 รับมัดจำ',
      async onConfirm() {
        const customer = document.getElementById('dp-cust').value.trim()
        const model = document.getElementById('dp-model').value.trim()
        const amount = parseInt(document.getElementById('dp-amt').value)
        if (!customer || !model || !amount) { showToast('❗ กรอกข้อมูลที่จำเป็น', 'error'); return false }
        try {
          await createDoc('deposits', {
            customer, model, amount, method: document.getElementById('dp-method').value,
            date: new Date().toISOString().slice(0,10), status: 'held',
            booking: document.getElementById('dp-bk').value.trim() || '-'
          })
          showToast(`รับมัดจำ ${formatCurrency(amount)} จาก ${customer} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function stat(label, value, color, sub) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${label}</div>
      <div style="font-size:1.4rem;font-weight:900;color:${color};margin-top:2px">${value}</div>
      ${sub ? `<div style="font-size:0.66rem;color:var(--text-muted)">${sub}</div>` : ''}</div>`
  }

  await loadData()
}
