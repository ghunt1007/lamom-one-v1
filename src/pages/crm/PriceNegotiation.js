/**
 * Price Negotiation Log — บันทึกประวัติการต่อราคา / อนุมัติส่วนลด
 * Route: /crm/price-negotiation
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DEMO_NEGOTIATIONS = [
  { id:'PN001', customer:'สมชาย ใจดี',    model:'BYD Atto 3',   listPrice:1199900, offerPrice:1150000, discount:49900, discPct:4.2, status:'approved', sales:'นาย กิตติ',  date:'2026-06-14', approver:'ผจก. วิชัย' },
  { id:'PN002', customer:'นภา สุขสม',     model:'BYD Seal AWD',  listPrice:1999900, offerPrice:1900000, discount:99900, discPct:5.0, status:'pending',  sales:'นางสาว ปิยะ', date:'2026-06-15', approver:''           },
  { id:'PN003', customer:'วิชัย ศรีดี',   model:'BYD Dolphin',   listPrice:799900,  offerPrice:770000,  discount:29900, discPct:3.7, status:'rejected', sales:'นาย กิตติ',  date:'2026-06-13', approver:'ผจก. วิชัย' },
  { id:'PN004', customer:'กาญจนา ทอง',   model:'MG ZS EV',      listPrice:999900,  offerPrice:960000,  discount:39900, discPct:4.0, status:'approved', sales:'นาย สมพงษ์', date:'2026-06-12', approver:'ผจก. วิชัย' },
  { id:'PN005', customer:'ประเสริฐ มั่น', model:'BYD Han',       listPrice:2599900, offerPrice:2500000, discount:99900, discPct:3.8, status:'pending',  sales:'นางสาว ปิยะ', date:'2026-06-15', approver:''           },
]

const STATUS_CFG = {
  approved: { label:'อนุมัติแล้ว', bg:'var(--success)',    icon:'✅' },
  pending:  { label:'รออนุมัติ',   bg:'var(--warning)',    icon:'⏳' },
  rejected: { label:'ปฏิเสธ',     bg:'var(--danger)',     icon:'❌' },
}

export default async function PriceNegotiationPage(container) {
  const myGen = container.__routerGen
  let NEGOTIATIONS = DEMO_NEGOTIATIONS.map(n => ({ ...n }))
  let dataSource = 'demo'
  let filterStatus = 'all'

  try {
    const docs = await listDocs('price_negotiations', [], 'date', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `PN${String(i+1).padStart(3,'0')}`,
        customer: d.customer || d.customerName || 'ลูกค้า',
        model: d.model || d.vehicleModel || '',
        listPrice: d.listPrice || d.price || 0,
        offerPrice: d.offerPrice || d.offer || 0,
        discount: d.discount || (d.listPrice - d.offerPrice) || 0,
        discPct: d.discPct || (d.listPrice > 0 ? +((d.discount / d.listPrice) * 100).toFixed(1) : 0),
        status: d.status || 'pending',
        sales: d.sales || d.salesName || '',
        date: d.date || d.createdAt?.slice(0, 10) || '',
        approver: d.approver || '',
      }))
      NEGOTIATIONS = [...mapped, ...DEMO_NEGOTIATIONS]
      dataSource = 'live'
    }
  } catch {}

  function negRow(n) {
    const cfg        = STATUS_CFG[n.status]
    const approveBtn = n.status==='pending' ? '<button class="btn btn-xs btn-primary appr-btn" data-id="' + escHtml(n.id) + '" style="font-size:0.68rem">✅ อนุมัติ</button>' : ''
    const rejectBtn  = n.status==='pending' ? '<button class="btn btn-xs btn-secondary rej-btn" data-id="' + escHtml(n.id) + '" style="font-size:0.68rem">❌ ปฏิเสธ</button>' : ''
    const approverLine = n.approver ? ' · โดย ' + escHtml(n.approver) : ''
    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;align-items:flex-start;gap:12px">' +
        '<div style="font-size:1.6rem">💬</div>' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
            '<span style="font-weight:700;font-size:0.88rem">' + escHtml(n.customer) + '</span>' +
            '<span style="font-size:0.66rem;background:var(--surface-2);padding:1px 7px;border-radius:8px">' + escHtml(n.model) + '</span>' +
            '<span style="font-size:0.62rem;background:' + cfg.bg + ';color:#fff;padding:1px 7px;border-radius:8px">' + cfg.icon + ' ' + cfg.label + '</span>' +
          '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">เซลส์: ' + escHtml(n.sales) + ' · ' + formatDate(n.date) + approverLine + '</div>' +
          '<div style="display:flex;gap:14px;font-size:0.74rem">' +
            '<span>💰 ราคา List ฿' + n.listPrice.toLocaleString() + '</span>' +
            '<span style="color:var(--warning)">🤝 เสนอ ฿' + n.offerPrice.toLocaleString() + '</span>' +
            '<span style="color:var(--danger);font-weight:700">💸 ส่วนลด ฿' + n.discount.toLocaleString() + ' (' + n.discPct + '%)</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">' + approveBtn + rejectBtn + '</div>' +
      '</div>' +
    '</div>'
  }

  function render() {
    let rows = filterStatus==='all' ? NEGOTIATIONS : NEGOTIATIONS.filter(n=>n.status===filterStatus)

    const approved  = NEGOTIATIONS.filter(n=>n.status==='approved').length
    const pending   = NEGOTIATIONS.filter(n=>n.status==='pending').length
    const totalDisc = NEGOTIATIONS.filter(n=>n.status==='approved').reduce((s,n)=>s+n.discount,0)
    const avgDisc   = NEGOTIATIONS.filter(n=>n.status==='approved').length
      ? (NEGOTIATIONS.filter(n=>n.status==='approved').reduce((s,n)=>s+n.discPct,0)/approved).toFixed(1) : '0'

    const statusBtns = ['all','approved','pending','rejected'].map(s=>{
      const lbl = s==='all'?'ทั้งหมด':STATUS_CFG[s].icon+' '+STATUS_CFG[s].label
      return '<button class="btn btn-xs '+(filterStatus===s?'btn-primary':'btn-secondary')+' stat-btn" data-s="'+s+'">'+lbl+'</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💬 Price Negotiation Log</div>
            <div class="page-subtitle">บันทึกประวัติการต่อราคา · ${NEGOTIATIONS.length} รายการ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-neg-btn">+ ขอส่วนลด</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('✅ อนุมัติ', approved+' รายการ', 'var(--success)')}
          ${sc('⏳ รออนุมัติ', pending+' รายการ', 'var(--warning)')}
          ${sc('💸 ส่วนลดรวม', '฿'+totalDisc.toLocaleString(), 'var(--danger)')}
          ${sc('📊 Avg Disc.', avgDisc+'%', 'var(--primary)')}
        </div>
        <div style="display:flex;gap:6px;margin-bottom:14px">${statusBtns}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(n=>negRow(n)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.appr-btn').forEach(b=>b.addEventListener('click',()=>{
      const n=NEGOTIATIONS.find(x=>x.id===b.dataset.id)
      if(n){n.status='approved';n.approver='ผจก. วิชัย';render();showToast('✅ อนุมัติส่วนลด '+n.customer+' ฿'+n.discount.toLocaleString(),'success')}
    }))
    container.querySelectorAll('.rej-btn').forEach(b=>b.addEventListener('click',()=>{
      const n=NEGOTIATIONS.find(x=>x.id===b.dataset.id)
      if(n){n.status='rejected';n.approver='ผจก. วิชัย';render();showToast('❌ ปฏิเสธส่วนลด '+n.customer,'warning')}
    }))
    document.getElementById('new-neg-btn')?.addEventListener('click',()=>openNewModal())
  }

  function openNewModal() {
    openModal({
      title:'💬 ขอส่วนลดพิเศษ', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ลูกค้า</label><input class="input" id="pn-cust" style="width:100%;margin-top:3px" placeholder="ชื่อลูกค้า..."></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">รุ่นรถ</label>
          <select class="input" id="pn-model" style="width:100%;margin-top:3px">
            <option>BYD Atto 3</option><option>BYD Seal AWD</option><option>BYD Dolphin</option><option>BYD Han</option><option>MG ZS EV</option>
          </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคา List (บ.)</label><input class="input" id="pn-list" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคาที่เสนอ (บ.)</label><input class="input" id="pn-offer" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
        </div>
      </div>`,
      confirmText:'📤 ส่งขออนุมัติ',
      onConfirm() {
        const cust=document.getElementById('pn-cust')?.value?.trim()
        const list=parseInt(document.getElementById('pn-list')?.value)||0
        const offer=parseInt(document.getElementById('pn-offer')?.value)||0
        if(!cust||!list||!offer){showToast('กรอกข้อมูลให้ครบ','warning');return false}
        const disc=list-offer
        const discPct=+(disc/list*100).toFixed(1)
        const model=document.getElementById('pn-model')?.value||'BYD Atto 3'
        NEGOTIATIONS.unshift({id:'PN'+Date.now(),customer:cust,model,listPrice:list,offerPrice:offer,discount:disc,discPct,status:'pending',sales:'เซลส์ Demo',date:'2026-06-15',approver:''})
        render(); showToast('📤 ส่งขออนุมัติส่วนลด ฿'+disc.toLocaleString()+' แล้ว','success')
      }
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
