/**
 * Receipt Automation — ออกใบเสร็จอัตโนมัติ / กฎการส่ง
 * Route: /finance/receipt-auto
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

let RECEIPTS = [
  { id:'R001', number:'REC-2026-0541', customer:'สมชาย ใจดี',    amount:1290000, type:'purchase', sent:true,  channel:'email', date:'2026-06-14', status:'sent'    },
  { id:'R002', number:'REC-2026-0542', customer:'นภา สุขสม',     amount:4500,    type:'service',  sent:true,  channel:'line',  date:'2026-06-14', status:'sent'    },
  { id:'R003', number:'REC-2026-0543', customer:'วิชัย ศรีดี',   amount:8900,    type:'service',  sent:false, channel:'email', date:'2026-06-15', status:'pending' },
  { id:'R004', number:'REC-2026-0544', customer:'กาญจนา ทอง',   amount:15600,   type:'insurance',sent:false, channel:'sms',   date:'2026-06-15', status:'failed'  },
  { id:'R005', number:'REC-2026-0545', customer:'ประเสริฐ มั่น', amount:2100,    type:'parts',    sent:true,  channel:'line',  date:'2026-06-15', status:'sent'    },
]

const AUTO_RULES = [
  { id:'AR1', name:'รถใหม่ — ส่ง Email', trigger:'purchase', channel:'email', active:true  },
  { id:'AR2', name:'ซ่อม — ส่ง LINE',    trigger:'service',  channel:'line',  active:true  },
  { id:'AR3', name:'ประกัน — ส่ง SMS',   trigger:'insurance',channel:'sms',   active:true  },
  { id:'AR4', name:'อะไหล่ — ส่ง LINE',  trigger:'parts',    channel:'line',  active:false },
]

const STATUS_CFG = {
  sent:    { label:'ส่งแล้ว',    bg:'var(--success)',     icon:'✅' },
  pending: { label:'รอส่ง',      bg:'var(--warning)',     icon:'⏳' },
  failed:  { label:'ส่งไม่ได้',  bg:'var(--danger)',      icon:'❌' },
}

export default async function ReceiptAutoPage(container) {
  let tab = 'receipts'
  let filterStatus = 'all'

  function receiptRow(r) {
    const cfg     = STATUS_CFG[r.status]
    const retryBtn = r.status==='failed'  ? '<button class="btn btn-xs btn-primary retry-btn" data-id="' + r.id + '" style="font-size:0.68rem">🔄 Retry</button>' : ''
    const sendBtn  = r.status==='pending' ? '<button class="btn btn-xs btn-primary send-btn" data-id="' + r.id + '" style="font-size:0.68rem">📤 ส่งเลย</button>' : ''
    const channelIcon = r.channel==='email'?'📧':r.channel==='line'?'💚':'📱'
    return '<div class="card" style="padding:12px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="font-size:1.4rem">🧾</div>' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
            '<span style="font-weight:700;font-size:0.82rem">' + r.number + '</span>' +
            '<span style="font-size:0.62rem;background:' + cfg.bg + ';color:#fff;padding:1px 7px;border-radius:8px">' + cfg.icon + ' ' + cfg.label + '</span>' +
          '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted)">' + escHtml(r.customer) + ' · ฿' + r.amount.toLocaleString() + ' · ' + channelIcon + ' ' + r.channel + ' · ' + formatDate(r.date) + '</div>' +
        '</div>' +
        '<div>' + retryBtn + sendBtn + '</div>' +
      '</div>' +
    '</div>'
  }

  function ruleRow(rule) {
    const chIcon = rule.channel==='email'?'📧':rule.channel==='line'?'💚':'📱'
    const toggle = '<label style="cursor:pointer;display:flex;align-items:center;gap:6px">' +
      '<input type="checkbox" class="rule-toggle" data-id="' + rule.id + '" ' + (rule.active?'checked':'') + ' style="cursor:pointer">' +
      '<span style="font-size:0.72rem">' + (rule.active?'เปิด':'ปิด') + '</span>' +
    '</label>'
    return '<div class="card" style="padding:12px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="font-size:1.4rem">' + chIcon + '</div>' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:0.82rem;margin-bottom:2px">' + rule.name + '</div>' +
          '<div style="font-size:0.68rem;color:var(--text-muted)">Trigger: ' + rule.trigger + ' → ' + rule.channel + '</div>' +
        '</div>' +
        toggle +
      '</div>' +
    '</div>'
  }

  function render() {
    let rows = RECEIPTS
    if (filterStatus !== 'all') rows = rows.filter(r=>r.status===filterStatus)

    const sentCount    = RECEIPTS.filter(r=>r.status==='sent').length
    const pendingCount = RECEIPTS.filter(r=>r.status==='pending').length
    const failedCount  = RECEIPTS.filter(r=>r.status==='failed').length
    const totalAmt     = RECEIPTS.reduce((s,r)=>s+r.amount,0)

    const statusBtns = ['all','sent','pending','failed'].map(s=>{
      const lbl = s==='all'?'ทั้งหมด':STATUS_CFG[s].icon+' '+STATUS_CFG[s].label
      return '<button class="btn btn-xs ' + (filterStatus===s?'btn-primary':'btn-secondary') + ' stat-btn" data-s="' + s + '">' + lbl + '</button>'
    }).join('')

    const tabBtns = [
      {key:'receipts', label:'🧾 ใบเสร็จ'},
      {key:'rules',    label:'⚙️ Auto Rules'},
    ].map(t=>'<button class="btn btn-sm ' + (tab===t.key?'btn-primary':'btn-secondary') + ' tab-btn" data-t="' + t.key + '">' + t.label + '</button>').join('')

    const rulesHtml = AUTO_RULES.map(r=>ruleRow(r)).join('')
    const receiptsHtml = `
      <div style="display:flex;gap:6px;margin-bottom:12px">${statusBtns}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${rows.map(r=>receiptRow(r)).join('')}
        ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>':''}
      </div>`

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧾 Receipt Automation</div>
            <div class="page-subtitle">ออกใบเสร็จอัตโนมัติ · ${RECEIPTS.length} รายการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="gen-btn">+ ออกใบเสร็จ</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('✅ ส่งแล้ว', sentCount+' รายการ', 'var(--success)')}
          ${sc('⏳ รอส่ง', pendingCount+' รายการ', 'var(--warning)')}
          ${sc('❌ ส่งไม่ได้', failedCount+' รายการ', 'var(--danger)')}
          ${sc('💰 รวมยอด', '฿'+totalAmt.toLocaleString(), 'var(--primary)')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px">${tabBtns}</div>

        ${tab==='receipts' ? receiptsHtml : '<div style="display:flex;flex-direction:column;gap:8px">' + rulesHtml + '</div>'}
      </div>`

    container.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.t;render()}))
    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.retry-btn').forEach(b=>b.addEventListener('click',()=>{
      const r=RECEIPTS.find(x=>x.id===b.dataset.id)
      if(r){r.status='sent';r.sent=true;render();showToast('🔄 Retry ส่งใบเสร็จ '+r.number+' แล้ว','success')}
    }))
    container.querySelectorAll('.send-btn').forEach(b=>b.addEventListener('click',()=>{
      const r=RECEIPTS.find(x=>x.id===b.dataset.id)
      if(r){r.status='sent';r.sent=true;render();showToast('📤 ส่งใบเสร็จ '+r.number+' แล้ว','success')}
    }))
    container.querySelectorAll('.rule-toggle').forEach(cb=>cb.addEventListener('change',()=>{
      const rule=AUTO_RULES.find(x=>x.id===cb.dataset.id)
      if(rule){rule.active=cb.checked;render();showToast((rule.active?'✅ เปิด':'❌ ปิด')+' Rule: '+rule.name,'info')}
    }))
    document.getElementById('gen-btn')?.addEventListener('click', openGenReceiptModal)
  }

  function openGenReceiptModal() {
    const today = new Date().toISOString().slice(0,10)
    const nextNum = 'REC-' + new Date().getFullYear() + '-' + String(RECEIPTS.length + 541 + 1).padStart(4,'0')
    openModal({
      title: '🧾 ออกใบเสร็จด่วน',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="background:var(--surface-2);border-radius:8px;padding:8px 12px;font-size:0.76rem">
            <span style="color:var(--text-muted)">เลขที่ใบเสร็จ: </span>
            <span style="font-weight:700;font-family:monospace">${nextNum}</span>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อลูกค้า *</label>
            <input id="rc-cust" class="input" placeholder="ชื่อ-นามสกุล..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภท</label>
              <select id="rc-type" class="input">
                <option value="purchase">ซื้อรถ</option>
                <option value="service">ซ่อมบริการ</option>
                <option value="insurance">ประกัน</option>
                <option value="parts">อะไหล่</option>
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ช่องทางส่ง</label>
              <select id="rc-ch" class="input">
                <option value="email">📧 Email</option>
                <option value="line">💚 LINE</option>
                <option value="sms">📱 SMS</option>
              </select>
            </div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ยอดรวม (฿) *</label>
            <input id="rc-amt" type="number" class="input" placeholder="0"></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="rc-save">🧾 ออกใบเสร็จ</button>
        </div>
      `
    })
    document.getElementById('rc-save')?.addEventListener('click', () => {
      const customer = document.getElementById('rc-cust')?.value.trim()
      const amount   = parseFloat(document.getElementById('rc-amt')?.value) || 0
      if (!customer || !amount) { showToast('⚠️ กรุณากรอกชื่อและยอดเงิน', 'warning'); return }
      RECEIPTS.push({
        id: 'R' + String(RECEIPTS.length + 1).padStart(3,'0'),
        number: nextNum,
        customer, amount,
        type:    document.getElementById('rc-type')?.value || 'service',
        channel: document.getElementById('rc-ch')?.value || 'email',
        date: today,
        sent: false,
        status: 'pending',
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ ออกใบเสร็จ ' + nextNum + ' ให้ ' + customer + ' แล้ว', 'success')
      render()
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
