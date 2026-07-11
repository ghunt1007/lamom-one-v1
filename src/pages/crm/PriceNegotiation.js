/**
 * Price Negotiation Log — บันทึกประวัติการต่อราคา / อนุมัติส่วนลด
 * Route: /crm/price-negotiation
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const STATUS_CFG = {
  approved: { label:'อนุมัติแล้ว', bg:'var(--success)',    icon:'✅' },
  pending:  { label:'รออนุมัติ',   bg:'var(--warning)',    icon:'⏳' },
  rejected: { label:'ปฏิเสธ',     bg:'var(--danger)',     icon:'❌' },
}

export default async function PriceNegotiationPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let NEGOTIATIONS = []
  let filterStatus = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { NEGOTIATIONS = await listDocs('price_negotiations', [], 'date', 'desc', 200) } catch (e) { NEGOTIATIONS = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

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
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
            <div class="page-subtitle">บันทึกประวัติการต่อราคา · ${NEGOTIATIONS.length} รายการ</div>
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
    container.querySelectorAll('.appr-btn').forEach(b=>b.addEventListener('click', async ()=>{
      const n=NEGOTIATIONS.find(x=>x.id===b.dataset.id)
      if (!n) return
      try {
        await updateDocData('price_negotiations', n.id, { status:'approved', approver:'ผจก. วิชัย' })
        showToast('✅ อนุมัติส่วนลด '+n.customer+' ฿'+n.discount.toLocaleString(),'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.rej-btn').forEach(b=>b.addEventListener('click', async ()=>{
      const n=NEGOTIATIONS.find(x=>x.id===b.dataset.id)
      if (!n) return
      try {
        await updateDocData('price_negotiations', n.id, { status:'rejected', approver:'ผจก. วิชัย' })
        showToast('❌ ปฏิเสธส่วนลด '+n.customer,'warning')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
      async onConfirm() {
        const cust=document.getElementById('pn-cust')?.value?.trim()
        const list=parseInt(document.getElementById('pn-list')?.value)||0
        const offer=parseInt(document.getElementById('pn-offer')?.value)||0
        if(!cust||!list||!offer){showToast('กรอกข้อมูลให้ครบ','warning');return false}
        const disc=list-offer
        const discPct=+(disc/list*100).toFixed(1)
        const model=document.getElementById('pn-model')?.value||'BYD Atto 3'
        try {
          await createDoc('price_negotiations', {customer:cust,model,listPrice:list,offerPrice:offer,discount:disc,discPct,status:'pending',sales:'เซลส์ Demo',date:new Date().toISOString().slice(0,10),approver:''})
          showToast('📤 ส่งขออนุมัติส่วนลด ฿'+disc.toLocaleString()+' แล้ว','success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
