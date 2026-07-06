/**
 * Refund & Payment Verification — ศูนย์กลางการเงิน เชื่อมกับฝ่ายขายแบบเรียลไทม์
 * - คืนเงินจองจากการถอนจอง (อ่าน/เขียนใบจองจริง ฝ่ายขายเห็นสถานะทันที)
 * - ยืนยันยอดโอนเข้า (เงินจอง/ดาวน์) ที่เซลส์แจ้งเข้ามา
 * - คำขอคืนเงินทั่วไป (workflow ขออนุมัติ → อนุมัติ → โอน)
 * Route: /finance/refund
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const STATUS_CFG = {
  pending:     { label:'รออนุมัติ',   bg:'var(--warning)', icon:'⏳' },
  approved:    { label:'อนุมัติแล้ว', bg:'var(--primary)', icon:'✅' },
  transferred: { label:'โอนแล้ว',     bg:'var(--success)', icon:'💸' },
  rejected:    { label:'ปฏิเสธ',      bg:'var(--danger)',  icon:'❌' },
}

export default async function RefundPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let bookings = []
  let refunds = []
  let loading = true

  async function loadData() {
    loading = true
    try {
      bookings = await listDocs('bookings', [], 'createdAt', 'desc', 500)
      refunds = await listDocs('refund_requests', [], 'date', 'desc', 200)
    } catch (e) { /* keep whatever loaded */ }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  async function notifySales(title, body) {
    try {
      await createDoc('notifications', { type: 'finance', title, body, read: false, link: '/crm/bookings', createdAt: new Date().toISOString() })
      setState('unreadCount', (getState('unreadCount') || 0) + 1)
    } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบข้อมูลหลัก */ }
  }

  function refundStatusOf(b) {
    return b.refundStatus || ((Number(b.down) > 0 && !b.rightsOnly) ? 'รอคืนเงิน' : 'ไม่ต้องคืน')
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    // ── ข้อมูลลิงค์จากใบจองจริง ──
    const withdrawals = bookings.filter(b => b.status === 'ถอนจอง')
    const waitRefund = withdrawals.filter(b => refundStatusOf(b) === 'รอคืนเงิน')
    const verifyQueue = bookings.filter(b => b.paymentVerifyStatus === 'รอการเงินยืนยัน')
    const recentVerified = bookings.filter(b => b.paymentVerifyStatus === 'ยืนยันแล้ว').slice(0, 5)
    const pendingReq = refunds.filter(r => r.status === 'pending')
    const waitAmount = waitRefund.reduce((s, b) => s + (Number(b.refundAmount) || Number(b.down) || 0), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💸 คืนเงิน & ยืนยันยอดโอน</div>
            <div class="page-subtitle">เชื่อมกับฝ่ายขายเรียลไทม์ — ถอนจอง/คืนเงินจอง · ตรวจสอบยอดโอนเข้า · คำขอคืนเงินทั่วไป</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-sm" id="rf-refresh">🔄 รีเฟรช</button>
            <button class="btn btn-primary" id="new-refund-btn">+ ขอคืนเงินใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('💸 รอคืนเงินจอง (ถอนจอง)', waitRefund.length + ' ราย', waitRefund.length ? 'var(--warning)' : 'var(--success)')}
          ${sc('💰 ยอดรอคืนรวม', formatCurrency(waitAmount), waitAmount ? 'var(--danger)' : 'var(--success)')}
          ${sc('🔍 รอยืนยันยอดโอนเข้า', verifyQueue.length + ' ราย', verifyQueue.length ? 'var(--warning)' : 'var(--success)')}
          ${sc('⏳ คำขอคืนเงินรออนุมัติ', pendingReq.length + ' รายการ', pendingReq.length ? 'var(--warning)' : 'var(--success)')}
        </div>

        <!-- Section 1: ยืนยันยอดโอนเข้าจากเซลส์ -->
        <div style="font-size:0.82rem;font-weight:700;color:var(--primary);margin-bottom:8px">🔍 ยืนยันยอดโอนเข้า (เงินจอง/ดาวน์) — เซลส์แจ้งเข้ามา</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px">
          ${verifyQueue.map(b => `<div class="card" style="padding:12px 14px;border-left:3px solid var(--warning)">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="font-size:1.3rem">🔍</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:0.85rem">${escHtml(b.custName || '—')} <span style="font-size:0.7rem;color:var(--primary)">${escHtml(b.bookingNo || '')}</span></div>
                <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml((b.brand || '') + ' ' + (b.model || ''))} · เซลส์ ${escHtml(b.salesName || '—')} · แจ้งเมื่อ ${formatDate(b.paymentVerifyRequestedAt) || '—'}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:0.95rem;font-weight:900;color:var(--success)">+${formatCurrency(b.down)}</div>
                <button class="btn btn-xs btn-primary verify-ok-btn" data-id="${b.id}" style="margin-top:4px;background:var(--success);border-color:var(--success)">✅ ยืนยันเงินเข้าจริง</button>
              </div>
            </div>
          </div>`).join('')}
          ${!verifyQueue.length ? '<div style="font-size:0.76rem;color:var(--text-muted);padding:8px 4px">ไม่มีรายการรอตรวจสอบ</div>' : ''}
          ${recentVerified.length ? `<div style="font-size:0.7rem;color:var(--text-muted);padding:2px 4px">✅ ยืนยันล่าสุด: ${recentVerified.map(b => escHtml(b.custName || b.bookingNo) + ' (' + formatCurrency(b.down) + ')').join(' · ')}</div>` : ''}
        </div>

        <!-- Section 2: คืนเงินจองจากการถอนจอง -->
        <div style="font-size:0.82rem;font-weight:700;color:var(--primary);margin:14px 0 8px">❌ ถอนจอง — คืนเงินจองลูกค้า (ลิงค์จากใบจองจริง)</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px">
          ${withdrawals.map(b => {
            const rs = refundStatusOf(b)
            const amt = Number(b.refundAmount) || Number(b.down) || 0
            const rc = rs === 'คืนเงินแล้ว' ? 'var(--success)' : rs === 'รอคืนเงิน' ? 'var(--warning)' : 'var(--text-muted)'
            return `<div class="card" style="padding:12px 14px;border-left:3px solid ${rc}">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="font-size:1.3rem">❌</div>
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="font-weight:700;font-size:0.85rem">${escHtml(b.custName || '—')}</span>
                    <span style="font-size:0.7rem;color:var(--primary)">${escHtml(b.bookingNo || '')}</span>
                    <span style="font-size:0.64rem;font-weight:700;padding:1px 8px;border-radius:8px;background:${rc}22;color:${rc};border:1px solid ${rc}55">💸 ${escHtml(rs)}</span>
                  </div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">ถอนเมื่อ ${formatDate(b.cancelDate) || '—'} · เหตุผล: ${escHtml(b.cancelReason || '—')} · เซลส์ ${escHtml(b.salesName || '—')}${b.refundedAt ? ' · โอนคืนแล้ว ' + formatDate(b.refundedAt) : ''}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-size:0.95rem;font-weight:900;color:${amt > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${amt > 0 ? '-' + formatCurrency(amt) : 'ไม่มียอดคืน'}</div>
                  ${rs === 'รอคืนเงิน' ? `<button class="btn btn-xs btn-primary refund-done-btn" data-id="${b.id}" style="margin-top:4px;background:var(--success);border-color:var(--success)">💸 โอนคืนลูกค้าแล้ว</button>` : ''}
                </div>
              </div>
            </div>`
          }).join('')}
          ${!withdrawals.length ? '<div style="font-size:0.76rem;color:var(--text-muted);padding:8px 4px">ไม่มีใบจองที่ถอน</div>' : ''}
        </div>

        <!-- Section 3: คำขอคืนเงินทั่วไป -->
        <div style="font-size:0.82rem;font-weight:700;color:var(--primary);margin:14px 0 8px">📋 คำขอคืนเงินอื่นๆ (ขออนุมัติ → อนุมัติ → โอน)</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${refunds.map(r => refundRow(r)).join('')}
          ${!refunds.length ? '<div style="font-size:0.76rem;color:var(--text-muted);padding:8px 4px">ไม่มีคำขอ</div>' : ''}
        </div>
      </div>`

    document.getElementById('rf-refresh')?.addEventListener('click', () => loadData())
    document.getElementById('new-refund-btn')?.addEventListener('click', () => openNewRefundModal())

    container.querySelectorAll('.verify-ok-btn').forEach(btn => btn.addEventListener('click', async () => {
      const b = bookings.find(x => x.id === btn.dataset.id)
      if (!b) return
      const ok = await confirmDialog({ title: '✅ ยืนยันยอดโอนเข้า', message: `ยืนยันว่าเงิน ${formatCurrency(b.down)} ของ "${escHtml(b.custName || b.bookingNo)}" โอนเข้าบัญชีจริงแล้ว? เซลส์จะได้รับแจ้งทันที`, confirmText: 'ยืนยัน' })
      if (!ok) return
      const today = new Date().toISOString().slice(0, 10)
      await updateDocData('bookings', b.id, { paymentVerifyStatus: 'ยืนยันแล้ว', paymentVerifiedAt: today })
      await notifySales('✅ การเงินยืนยันยอดโอนแล้ว', `ใบจอง ${b.bookingNo} — ${b.custName || ''} ยอด ${formatCurrency(b.down)} มีเงินโอนเข้ามาจริง เซลส์ดำเนินการต่อได้`)
      showToast('✅ ยืนยันยอดโอนแล้ว — แจ้งเซลส์เรียบร้อย', 'success')
      await loadData()
    }))

    container.querySelectorAll('.refund-done-btn').forEach(btn => btn.addEventListener('click', async () => {
      const b = bookings.find(x => x.id === btn.dataset.id)
      if (!b) return
      const amt = Number(b.refundAmount) || Number(b.down) || 0
      const ok = await confirmDialog({ title: '💸 ยืนยันโอนเงินคืนลูกค้า', message: `ยืนยันว่าโอนเงินจอง ${formatCurrency(amt)} คืนให้ "${escHtml(b.custName || b.bookingNo)}" แล้ว? ฝ่ายขายจะเห็นสถานะ "คืนเงินแล้ว" ทันที`, confirmText: 'โอนคืนแล้ว' })
      if (!ok) return
      const today = new Date().toISOString().slice(0, 10)
      await updateDocData('bookings', b.id, { refundStatus: 'คืนเงินแล้ว', refundAmount: amt, refundedAt: today })
      await notifySales('💸 การเงินคืนเงินจองให้ลูกค้าแล้ว', `ใบจอง ${b.bookingNo} — คืนเงิน ${formatCurrency(amt)} ให้ ${b.custName || ''} เรียบร้อย (${formatDate(today)})`)
      showToast('💸 บันทึกการคืนเงินแล้ว — ฝ่ายขายเห็นสถานะทันที', 'success')
      await loadData()
    }))

    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('refund_requests', b.dataset.id, { status: 'approved', approvedBy: 'ผู้จัดการ' })
      const r = refunds.find(x => x.id === b.dataset.id)
      showToast('✅ อนุมัติคืนเงิน ' + formatCurrency(r?.amount || 0) + ' แล้ว', 'success'); await loadData()
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('refund_requests', b.dataset.id, { status: 'rejected', approvedBy: 'ผู้จัดการ' })
      showToast('❌ ปฏิเสธคำขอคืนเงิน', 'warning'); await loadData()
    }))
    container.querySelectorAll('.transfer-btn').forEach(b => b.addEventListener('click', async () => {
      const today = new Date().toISOString().slice(0, 10)
      await updateDocData('refund_requests', b.dataset.id, { status: 'transferred', txDate: today })
      const r = refunds.find(x => x.id === b.dataset.id)
      showToast('💸 โอนเงินคืน ' + formatCurrency(r?.amount || 0) + ' เรียบร้อย', 'success'); await loadData()
    }))
  }

  function refundRow(r) {
    const cfg        = STATUS_CFG[r.status]
    const txLine     = r.txDate ? ' · โอน ' + formatDate(r.txDate) : ''
    const approvLine = r.approvedBy ? ' · อนุมัติโดย ' + escHtml(r.approvedBy) : ''
    const actionBtns = r.status === 'pending'
      ? '<button class="btn btn-xs btn-primary approve-btn" data-id="' + r.id + '" style="font-size:0.66rem">✅ อนุมัติ</button><button class="btn btn-xs btn-secondary reject-btn" data-id="' + r.id + '" style="font-size:0.66rem;margin-left:4px">❌ ปฏิเสธ</button>'
      : r.status === 'approved'
        ? '<button class="btn btn-xs btn-secondary transfer-btn" data-id="' + r.id + '" style="font-size:0.66rem;background:var(--success);color:#fff">💸 โอนเงิน</button>'
        : ''
    return `<div class="card" style="padding:14px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:1.4rem">💸</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:700;font-size:0.86rem">${escHtml(r.customer)}</span>
            <span style="font-size:0.66rem;background:var(--surface-2);padding:1px 7px;border-radius:8px">${escHtml(r.type)}</span>
            <span style="font-size:0.62rem;background:${cfg.bg};color:#fff;padding:1px 8px;border-radius:8px">${cfg.icon} ${cfg.label}</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(r.reason)} · ยื่น ${formatDate(r.date)}${approvLine}${txLine}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:1rem;font-weight:900;color:var(--danger)">-${formatCurrency(r.amount)}</div>
          <div style="margin-top:4px">${actionBtns}</div>
        </div>
      </div>
    </div>`
  }

  function openNewRefundModal() {
    openModal({
      title:'💸 ขอคืนเงิน', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อลูกค้า</label><input class="input" id="rf-cust" style="width:100%;margin-top:3px" placeholder="ชื่อลูกค้า..."></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ประเภทการคืน</label>
          <select class="input" id="rf-type" style="width:100%;margin-top:3px">
            <option>คืนมัดจำ</option><option>คืนมัดจำป้ายแดง</option><option>คืนส่วนเกิน</option><option>คืนค่าบริการ</option>
          </select></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ยอดเงิน (บาท)</label><input class="input" id="rf-amount" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เหตุผล</label><textarea class="input" id="rf-reason" style="width:100%;margin-top:3px;height:60px" placeholder="เหตุผลการคืนเงิน..."></textarea></div>
      </div>`,
      confirmText:'📤 ส่งขออนุมัติ',
      async onConfirm() {
        const cust=document.getElementById('rf-cust')?.value?.trim()
        const amount=parseInt(document.getElementById('rf-amount')?.value)||0
        const reason=document.getElementById('rf-reason')?.value?.trim()
        if(!cust||!amount||!reason){showToast('กรุณากรอกข้อมูลให้ครบ','warning');return false}
        const type=document.getElementById('rf-type')?.value||'คืนมัดจำ'
        await createDoc('refund_requests', { customer:cust, type, amount, reason, status:'pending', date:new Date().toISOString().slice(0,10), approvedBy:'', txDate:'' })
        showToast('📤 ยื่นขอคืนเงิน ' + formatCurrency(amount) + ' แล้ว','success')
        await loadData()
      }
    })
  }

  function sc(l,v,c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
