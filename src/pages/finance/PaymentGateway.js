/**
 * Payment Gateway — รับชำระเงิน QR / โอน / บัตรเครดิต
 * Route: /finance/payment
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const TRANSACTIONS = [
  { id:'PAY001', ref:'INV-2026-1001', customer:'คุณวรพจน์ สุขใจ', amount:1549000, method:'QR Code', status:'success', date:'2026-06-14', desc:'ค่ารถ BYD Atto 3' },
  { id:'PAY002', ref:'INV-2026-1002', customer:'บริษัท ทรัพย์สิน จก.', amount:85000, method:'โอนธนาคาร', status:'success', date:'2026-06-13', desc:'ค่าดาวน์ MG ZS EV ×3' },
  { id:'PAY003', ref:'INV-2026-1003', customer:'คุณนภา ชื่นดี', amount:35000, method:'บัตรเครดิต', status:'pending', date:'2026-06-15', desc:'ค่าซ่อม BP + ค่าแรง' },
  { id:'PAY004', ref:'INV-2026-1004', customer:'คุณสมชาย ดีใจ', amount:12000, method:'QR Code', status:'success', date:'2026-06-12', desc:'ค่าบริการ Service Package' },
  { id:'PAY005', ref:'INV-2026-1005', customer:'คุณพรทิพย์ มั่นคง', amount:8900, method:'บัตรเครดิต', status:'failed', date:'2026-06-11', desc:'ค่าอะไหล่ + ค่าแรง' },
  { id:'PAY006', ref:'INV-2026-1006', customer:'โรงพยาบาล เซ็นทรัลฯ', amount:296000, method:'โอนธนาคาร', status:'pending', date:'2026-06-15', desc:'ดาวน์ Fleet BYD Dolphin ×5' },
]

const METHOD_ICONS = { 'QR Code':'📱', 'โอนธนาคาร':'🏦', 'บัตรเครดิต':'💳' }

function statusBadge(s) {
  const m = { success:{l:'สำเร็จ',c:'var(--success)'}, pending:{l:'รอชำระ',c:'var(--warning)'}, failed:{l:'ล้มเหลว',c:'var(--danger)'} }
  const x = m[s] || { l: s, c: 'var(--text-muted)' }
  return '<span style="font-size:0.62rem;padding:2px 8px;border-radius:6px;background:' + x.c + '22;color:' + x.c + ';font-weight:700">' + x.l + '</span>'
}

function txRow(t) {
  return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
    '<td style="padding:8px 10px">' +
      '<div style="font-size:0.76rem;font-weight:600">' + t.ref + '</div>' +
      '<div style="font-size:0.62rem;color:var(--text-muted)">' + t.date + '</div>' +
    '</td>' +
    '<td style="padding:8px 10px;font-size:0.74rem">' + t.customer + '</td>' +
    '<td style="padding:8px 10px;font-size:0.72rem;color:var(--text-muted)">' + t.desc + '</td>' +
    '<td style="padding:8px 10px;font-size:0.72rem">' + (METHOD_ICONS[t.method] || '💰') + ' ' + t.method + '</td>' +
    '<td style="padding:8px 10px;font-weight:700;font-size:0.8rem;color:var(--success)">฿' + t.amount.toLocaleString() + '</td>' +
    '<td style="padding:8px 10px">' + statusBadge(t.status) + '</td>' +
    '<td style="padding:8px 10px">' +
      (t.status === 'pending' ? '<button class="btn btn-sm btn-primary confirm-btn" data-id="' + t.id + '">ยืนยัน</button>' : '') +
    '</td>' +
  '</tr>'
}

export default async function PaymentGatewayPage(container) {
  let txns = TRANSACTIONS.map(t => ({ ...t }))
  let filter = 'all'

  function render() {
    const filtered = filter === 'all' ? txns : txns.filter(t => t.status === filter)
    const totalSuccess = txns.filter(t => t.status === 'success').reduce((s, t) => s + t.amount, 0)
    const totalPending = txns.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount, 0)
    const qrCount = txns.filter(t => t.method === 'QR Code' && t.status === 'success').length

    const filterBtns = [['all','ทั้งหมด'],['success','สำเร็จ'],['pending','รอชำระ'],['failed','ล้มเหลว']].map(([k, l]) =>
      '<button class="btn btn-sm ' + (filter === k ? 'btn-primary' : 'btn-secondary') + ' filter-btn" data-f="' + k + '">' + l + '</button>'
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💳 Payment Gateway</div>
            <div class="page-subtitle">รับชำระเงิน QR / โอน / บัตรเครดิต</div>
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
              <tbody>${filtered.map(t => txRow(t)).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('.confirm-btn').forEach(b => b.addEventListener('click', () => {
      const t = txns.find(x => x.id === b.dataset.id)
      if (t) { t.status = 'success'; showToast('✅ ยืนยันการชำระ ' + t.ref, 'success'); render() }
    }))
    document.getElementById('new-pay-btn')?.addEventListener('click', () => {
      openModal({
        title: '📱 สร้าง QR ชำระเงิน',
        size: 'sm',
        body: '<div style="text-align:center;padding:20px">' +
          '<div style="font-size:4rem">📱</div>' +
          '<div style="font-size:0.82rem;color:var(--text-muted);margin-top:8px">QR Code พร้อมรับชำระ</div>' +
          '<div style="background:var(--surface-2);margin:12px auto;width:120px;height:120px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:3rem">▪️</div>' +
          '<div style="font-size:0.72rem;color:var(--text-muted)">LAMOM ONE · PromptPay</div>' +
        '</div>',
        confirmText: 'ปิด',
        onConfirm: () => {}
      })
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
