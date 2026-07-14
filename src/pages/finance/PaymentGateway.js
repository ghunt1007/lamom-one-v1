/**
 * Payment Gateway — รับชำระเงิน QR / โอน / บัตรเครดิต (แยกจาก Cashier Desk)
 * Route: /finance/payment
 *
 * ต่างจาก Cashier Desk (จุดรับเงินหน้าเคาน์เตอร์แบบ walk-in ผูกกับ "บิลรอชำระ" ภายใน)
 * — หน้านี้คือธุรกรรมที่ผูกกับ "เลขที่อ้างอิง" (เช่นใบแจ้งหนี้/ใบจอง) ให้ลูกค้าจ่ายทางไกล
 * ผ่าน QR/โอน/บัตร แล้วติดตามสถานะ สำเร็จ/รอ/ล้มเหลว แยกเป็นธุรกรรมของตัวเอง
 * เดิมหน้านี้เป็น TRANSACTIONS hardcoded + ปุ่มยืนยันแก้สถานะแค่ในหน่วยความจำ (รีเฟรชแล้วหาย)
 * แก้ให้เป็น Firestore จริง (collection 'payment_transactions') — สร้าง/ยืนยัน/ทำเครื่องหมายล้มเหลวจริง
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const METHOD_ICONS = { 'QR Code':'📱', 'โอนธนาคาร':'🏦', 'บัตรเครดิต':'💳' }

function statusBadge(s) {
  const m = { success:{l:'สำเร็จ',c:'var(--success)'}, pending:{l:'รอชำระ',c:'var(--warning)'}, failed:{l:'ล้มเหลว',c:'var(--danger)'} }
  const x = m[s] || { l: s, c: 'var(--text-muted)' }
  return '<span style="font-size:0.62rem;padding:2px 8px;border-radius:6px;background:' + x.c + '22;color:' + x.c + ';font-weight:700">' + x.l + '</span>'
}

export default async function PaymentGatewayPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let txns = []
  let filter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { txns = await listDocs('payment_transactions', [], 'date', 'desc', 300) } catch (e) { txns = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function txRow(t) {
    return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
      '<td style="padding:8px 10px">' +
        '<div style="font-size:0.76rem;font-weight:600">' + escHtml(t.ref) + '</div>' +
        '<div style="font-size:0.62rem;color:var(--text-muted)">' + escHtml(t.date) + '</div>' +
      '</td>' +
      '<td style="padding:8px 10px;font-size:0.74rem">' + escHtml(t.customer) + '</td>' +
      '<td style="padding:8px 10px;font-size:0.72rem;color:var(--text-muted)">' + escHtml(t.desc) + '</td>' +
      '<td style="padding:8px 10px;font-size:0.72rem">' + (METHOD_ICONS[t.method] || '💰') + ' ' + escHtml(t.method) + '</td>' +
      '<td style="padding:8px 10px;font-weight:700;font-size:0.8rem;color:var(--success)">฿' + (t.amount || 0).toLocaleString() + '</td>' +
      '<td style="padding:8px 10px">' + statusBadge(t.status) + '</td>' +
      '<td style="padding:8px 10px;white-space:nowrap">' +
        (t.status === 'pending'
          ? '<button class="btn btn-xs btn-success confirm-btn" data-id="' + t.id + '">✅ ยืนยัน</button> ' +
            '<button class="btn btn-xs btn-secondary fail-btn" data-id="' + t.id + '">❌ ล้มเหลว</button>'
          : '') +
      '</td>' +
    '</tr>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const filtered = filter === 'all' ? txns : txns.filter(t => t.status === filter)
    const totalSuccess = txns.filter(t => t.status === 'success').reduce((s, t) => s + (t.amount||0), 0)
    const totalPending = txns.filter(t => t.status === 'pending').reduce((s, t) => s + (t.amount||0), 0)
    const qrCount = txns.filter(t => t.method === 'QR Code' && t.status === 'success').length

    const filterBtns = [['all','ทั้งหมด'],['success','สำเร็จ'],['pending','รอชำระ'],['failed','ล้มเหลว']].map(([k, l]) =>
      '<button class="btn btn-sm ' + (filter === k ? 'btn-primary' : 'btn-secondary') + ' filter-btn" data-f="' + k + '">' + l + '</button>'
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💳 Payment Gateway</div>
            <div class="page-subtitle">รับชำระเงิน QR / โอน / บัตรเครดิต — ผูกกับเลขที่อ้างอิง</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-pay-btn">+ สร้าง QR ชำระ</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('✅ รับชำระแล้ว', '฿' + totalSuccess.toLocaleString(), 'var(--success)')}
          ${sc('⏳ รอชำระ', '฿' + totalPending.toLocaleString(), 'var(--warning)')}
          ${sc('📱 QR สำเร็จ', qrCount + ' รายการ', 'var(--primary)')}
          ${sc('📊 ธุรกรรมทั้งหมด', txns.length + ' รายการ', 'var(--text-muted)')}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap">
            ${filterBtns}
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
              <thead>
                <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">เลขที่</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">ลูกค้า</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">รายการ</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">ช่องทาง</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">ยอด</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">สถานะ</th>
                  <th style="padding:10px"></th>
                </tr>
              </thead>
              <tbody>${filtered.map(t => txRow(t)).join('') || '<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--text-muted)">ยังไม่มีธุรกรรม — กด "+ สร้าง QR ชำระ" เพื่อเริ่ม</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('.confirm-btn').forEach(b => b.addEventListener('click', async () => {
      const t = txns.find(x => x.id === b.dataset.id)
      if (!t) return
      await updateDocData('payment_transactions', t.id, { status: 'success' })
      showToast('✅ ยืนยันการชำระ ' + t.ref, 'success')
      await loadData()
    }))
    container.querySelectorAll('.fail-btn').forEach(b => b.addEventListener('click', async () => {
      const t = txns.find(x => x.id === b.dataset.id)
      if (!t) return
      await updateDocData('payment_transactions', t.id, { status: 'failed' })
      showToast('❌ ทำเครื่องหมายล้มเหลว ' + t.ref, 'warning')
      await loadData()
    }))
    document.getElementById('new-pay-btn')?.addEventListener('click', openNewPaymentModal)
  }

  function openNewPaymentModal() {
    const { el, close } = openModal({
      title: '📱 สร้าง QR ชำระเงิน',
      size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="input-group"><label class="input-label">เลขที่อ้างอิง (ใบแจ้งหนี้/ใบจอง) *</label><input class="input" id="np-ref" placeholder="เช่น INV-2026-1007"></div>
        <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="np-customer" placeholder="ชื่อลูกค้า"></div>
        <div class="input-group"><label class="input-label">รายการ</label><input class="input" id="np-desc" placeholder="รายละเอียดรายการ"></div>
        <div class="input-group"><label class="input-label">จำนวนเงิน (฿) *</label><input class="input" type="number" id="np-amount" placeholder="0"></div>
        <div class="input-group"><label class="input-label">ช่องทาง</label>
          <select class="input" id="np-method">${Object.keys(METHOD_ICONS).map(k => `<option value="${k}">${METHOD_ICONS[k]} ${k}</option>`).join('')}</select>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="np-c">ยกเลิก</button><button class="btn btn-primary" id="np-s">สร้างรายการ</button>`
    })
    el.querySelector('#np-c').addEventListener('click', close)
    el.querySelector('#np-s').addEventListener('click', async () => {
      const ref = el.querySelector('#np-ref').value.trim()
      const customer = el.querySelector('#np-customer').value.trim()
      const amount = parseInt(el.querySelector('#np-amount').value) || 0
      if (!ref || !customer || amount <= 0) { showToast('❗ กรอกเลขที่อ้างอิง ลูกค้า และจำนวนเงินให้ครบ', 'error'); return }
      const desc = el.querySelector('#np-desc').value.trim() || '—'
      const method = el.querySelector('#np-method').value
      const id = await createDoc('payment_transactions', { ref, customer, desc, amount, method, status: 'pending', date: new Date().toISOString().slice(0,10) })
      showToast('✅ สร้างรายการชำระแล้ว — รอลูกค้าชำระ', 'success')
      close()
      await loadData()
      showQrModal({ id, ref, customer, amount })
    })
  }

  function showQrModal(t) {
    openModal({
      title: '📱 QR ชำระเงิน',
      size: 'sm',
      body: '<div style="text-align:center;padding:20px">' +
        '<div style="background:var(--surface-2);margin:0 auto 12px;width:140px;height:140px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:3rem">▪️</div>' +
        '<div style="font-size:1rem;font-weight:800">฿' + (t.amount||0).toLocaleString() + '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">' + escHtml(t.ref) + ' — ' + escHtml(t.customer) + '</div>' +
        '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:10px">LAMOM ONE · PromptPay — ส่งให้ลูกค้าสแกน แล้วกด "ยืนยัน" ในตารางเมื่อลูกค้าชำระแล้ว</div>' +
      '</div>',
      confirmText: 'ปิด',
      onConfirm: () => {}
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
