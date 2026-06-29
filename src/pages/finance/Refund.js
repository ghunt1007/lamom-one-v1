/**
 * Refund Workflow — คืนเงิน: ขออนุมัติ → อนุมัติ → โอน
 * Route: /finance/refund
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

let REFUNDS = [
  { id:'RF001', customer:'อรุณ วิชิต',    type:'คืนมัดจำ',    amount:50000,  reason:'ยกเลิกจอง BYD Atto 3',  status:'approved',    date:'2026-06-12', approvedBy:'ผู้จัดการ A', txDate:'2026-06-13' },
  { id:'RF002', customer:'สุดา ภักดี',    type:'คืนส่วนเกิน', amount:8500,   reason:'จ่ายเกิน ค่าซ่อม',      status:'pending',     date:'2026-06-13', approvedBy:'',           txDate:'' },
  { id:'RF003', customer:'ประยุทธ มั่นคง',type:'คืนมัดจำ',    amount:100000, reason:'ยกเลิกจอง BYD Han',     status:'transferred', date:'2026-06-11', approvedBy:'ผู้จัดการ B', txDate:'2026-06-12' },
  { id:'RF004', customer:'พิมพ์ สวัสดี',  type:'คืนค่าบริการ',amount:3200,   reason:'ยกเลิกแพ็กเกจ',         status:'rejected',    date:'2026-06-10', approvedBy:'ผู้จัดการ A', txDate:'' },
  { id:'RF005', customer:'สมชาย ใจดี',    type:'คืนส่วนเกิน', amount:12000,  reason:'คำนวณค่าซ่อมผิด',       status:'pending',     date:'2026-06-14', approvedBy:'',           txDate:'' },
]

const STATUS_CFG = {
  pending:     { label:'รออนุมัติ',   bg:'var(--warning)', icon:'⏳' },
  approved:    { label:'อนุมัติแล้ว', bg:'var(--primary)', icon:'✅' },
  transferred: { label:'โอนแล้ว',     bg:'var(--success)', icon:'💸' },
  rejected:    { label:'ปฏิเสธ',      bg:'var(--danger)',  icon:'❌' },
}

export default async function RefundPage(container) {
  let filterStatus = 'all'

  function refundRow(r) {
    const cfg        = STATUS_CFG[r.status]
    const txLine     = r.txDate ? ' · โอน ' + formatDate(r.txDate) : ''
    const approvLine = r.approvedBy ? ' · อนุมัติโดย ' + r.approvedBy : ''
    const isPending  = r.status === 'pending'
    const isApproved = r.status === 'approved'
    const actionBtns = isPending
      ? '<button class="btn btn-xs btn-primary approve-btn" data-id="' + r.id + '" style="font-size:0.66rem">✅ อนุมัติ</button><button class="btn btn-xs btn-secondary reject-btn" data-id="' + r.id + '" style="font-size:0.66rem;margin-left:4px">❌ ปฏิเสธ</button>'
      : isApproved
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
          <div style="font-size:1rem;font-weight:900;color:var(--danger)">-฿${r.amount.toLocaleString()}</div>
          <div style="margin-top:4px">${actionBtns}</div>
        </div>
      </div>
    </div>`
  }

  function render() {
    let rows = REFUNDS
    if (filterStatus !== 'all') rows = rows.filter(r=>r.status===filterStatus)

    const pending     = REFUNDS.filter(r=>r.status==='pending').length
    const approved    = REFUNDS.filter(r=>r.status==='approved').length
    const transferred = REFUNDS.filter(r=>r.status==='transferred').length
    const totalPend   = REFUNDS.filter(r=>r.status==='pending').reduce((s,r)=>s+r.amount,0)

    const filterBtns = ['all','pending','approved','transferred','rejected'].map(s=>{
      const label = s==='all' ? 'ทั้งหมด' : STATUS_CFG[s].icon + ' ' + STATUS_CFG[s].label
      return '<button class="btn btn-xs ' + (filterStatus===s?'btn-primary':'btn-secondary') + ' stat-btn" data-s="' + s + '">' + label + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💸 Refund Workflow</div>
            <div class="page-subtitle">คืนเงิน: ขออนุมัติ → อนุมัติ → โอน · ${REFUNDS.length} รายการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-refund-btn">+ ขอคืนเงินใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('⏳ รออนุมัติ', pending+' รายการ', 'var(--warning)')}
          ${sc('✅ อนุมัติแล้ว', approved+' รายการ', 'var(--primary)')}
          ${sc('💸 โอนแล้ว', transferred+' รายการ', 'var(--success)')}
          ${sc('💰 ยอดรอคืน', '฿'+totalPend.toLocaleString(), 'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(r=>refundRow(r)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.approve-btn').forEach(b=>b.addEventListener('click',()=>{
      const r=REFUNDS.find(x=>x.id===b.dataset.id)
      if(r){r.status='approved';r.approvedBy='ผู้จัดการ';render();showToast('✅ อนุมัติคืนเงิน ฿'+r.amount.toLocaleString()+' แล้ว','success')}
    }))
    container.querySelectorAll('.reject-btn').forEach(b=>b.addEventListener('click',()=>{
      const r=REFUNDS.find(x=>x.id===b.dataset.id)
      if(r){r.status='rejected';r.approvedBy='ผู้จัดการ';render();showToast('❌ ปฏิเสธคำขอคืนเงิน','warning')}
    }))
    container.querySelectorAll('.transfer-btn').forEach(b=>b.addEventListener('click',()=>{
      const r=REFUNDS.find(x=>x.id===b.dataset.id)
      if(r){r.status='transferred';r.txDate='2026-06-14';render();showToast('💸 โอนเงินคืน ฿'+r.amount.toLocaleString()+' เรียบร้อย','success')}
    }))
    document.getElementById('new-refund-btn')?.addEventListener('click',()=>openNewRefundModal())
  }

  function openNewRefundModal() {
    openModal({
      title:'💸 ขอคืนเงิน', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อลูกค้า</label><input class="input" id="rf-cust" style="width:100%;margin-top:3px" placeholder="ชื่อลูกค้า..."></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ประเภทการคืน</label>
          <select class="input" id="rf-type" style="width:100%;margin-top:3px">
            <option>คืนมัดจำ</option><option>คืนส่วนเกิน</option><option>คืนค่าบริการ</option>
          </select></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ยอดเงิน (บาท)</label><input class="input" id="rf-amount" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เหตุผล</label><textarea class="input" id="rf-reason" style="width:100%;margin-top:3px;height:60px" placeholder="เหตุผลการคืนเงิน..."></textarea></div>
      </div>`,
      confirmText:'📤 ส่งขออนุมัติ',
      onConfirm() {
        const cust=document.getElementById('rf-cust')?.value?.trim()
        const amount=parseInt(document.getElementById('rf-amount')?.value)||0
        const reason=document.getElementById('rf-reason')?.value?.trim()
        if(!cust||!amount||!reason){showToast('กรุณากรอกข้อมูลให้ครบ','warning');return false}
        const type=document.getElementById('rf-type')?.value||'คืนมัดจำ'
        REFUNDS.push({id:'RF'+Date.now(),customer:cust,type,amount,reason,status:'pending',date:'2026-06-14',approvedBy:'',txDate:''})
        render(); showToast('📤 ยื่นขอคืนเงิน ฿'+amount.toLocaleString()+' แล้ว','success')
      }
    })
  }

  function sc(l,v,c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
