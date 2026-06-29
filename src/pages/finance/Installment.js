/**
 * Installment Tracking — ติดตามงวดผ่อนลูกค้าที่ซื้อตรง
 * Route: /finance/installment
 */
import { formatDate } from '../../utils/format.js'
import { showToast } from '../../core/store.js'

let PLANS = [
  { id:'INS001', customer:'สมชาย ใจดี',   model:'BYD Atto 3',  total:1099000, paid:4,  total_inst:36, monthly:30528, nextDate:'2026-07-01', status:'current',   overdue:0 },
  { id:'INS002', customer:'นภา สุขใจ',    model:'BYD Seal AWD',total:1699000, paid:12, total_inst:60, monthly:31648, nextDate:'2026-07-05', status:'current',   overdue:0 },
  { id:'INS003', customer:'วิชัย ดีมาก',  model:'BYD Han',     total:2099000, paid:2,  total_inst:48, monthly:47250, nextDate:'2026-06-10', status:'overdue',   overdue:4 },
  { id:'INS004', customer:'มาลี รุ่งเรือง',model:'MG ZS EV',   total:799000,  paid:24, total_inst:36, monthly:24361, nextDate:'2026-07-20', status:'current',   overdue:0 },
  { id:'INS005', customer:'อรุณ วิชิต',   model:'BYD Dolphin', total:899000,  paid:36, total_inst:36, monthly:27222, nextDate:'',           status:'completed', overdue:0 },
]

export default async function InstallmentPage(container) {
  let filterStatus = 'all'

  function planCard(p) {
    const pct       = Math.round(p.paid/p.total_inst*100)
    const remaining = p.total_inst - p.paid
    const balance   = remaining * p.monthly
    const isOD   = p.status==='overdue'
    const isDone = p.status==='completed'
    const statusBg    = isDone?'var(--success)':isOD?'var(--danger)':'var(--primary)'
    const statusLabel = isDone?'✅ ชำระครบ':isOD?'⚠️ ค้างชำระ':'💳 ปกติ'
    const overdueStr  = isOD ? ' <span style="color:var(--danger);font-weight:700">ค้าง ' + p.overdue + ' วัน</span>' : ''
    const nextStr     = isDone ? 'ปิดบัญชีแล้ว' : 'งวดถัดไป ' + formatDate(p.nextDate)
    const remindBtn   = isOD  ? '<button class="btn btn-xs btn-primary remind-btn" data-id="' + p.id + '" style="font-size:0.68rem">📱 ทวง</button>' : ''
    const payBtn      = !isDone ? '<button class="btn btn-xs btn-secondary pay-btn" data-id="' + p.id + '" style="font-size:0.68rem">💳 บันทึกงวด</button>' : ''
    return `<div class="card" style="padding:14px;border-left:3px solid ${statusBg}">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:1.4rem">💳</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:700;font-size:0.88rem">${p.customer}</span>
            <span style="font-size:0.66rem;color:var(--text-muted)">${p.model}</span>
            <span style="font-size:0.62rem;background:${statusBg};color:#fff;padding:1px 8px;border-radius:8px">${statusLabel}</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">
            ผ่อน ${p.monthly.toLocaleString()} บ./เดือน · ชำระแล้ว ${p.paid}/${p.total_inst} งวด${overdueStr}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <div style="flex:1;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${statusBg};border-radius:3px"></div>
            </div>
            <span style="font-size:0.64rem;color:var(--text-muted)">${pct}%</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted)">
            ยอดค้างอยู่ ฿${balance.toLocaleString()} · ${nextStr}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">${remindBtn}${payBtn}</div>
      </div>
    </div>`
  }

  function render() {
    let rows = PLANS
    if (filterStatus !== 'all') rows = rows.filter(p=>p.status===filterStatus)

    const overdue   = PLANS.filter(p=>p.status==='overdue').length
    const current   = PLANS.filter(p=>p.status==='current').length
    const completed = PLANS.filter(p=>p.status==='completed').length
    const totalBal  = PLANS.filter(p=>p.status!=='completed').reduce((s,p)=>s+(p.total_inst-p.paid)*p.monthly,0)

    const filterBtns = ['all','overdue','current','completed'].map(s=>{
      const label = s==='all'?'ทั้งหมด':s==='overdue'?'⚠️ ค้างชำระ':s==='current'?'💳 ปกติ':'✅ ปิดบัญชี'
      return '<button class="btn btn-xs ' + (filterStatus===s?'btn-primary':'btn-secondary') + ' stat-btn" data-s="' + s + '">' + label + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💳 Installment Tracking</div>
            <div class="page-subtitle">ติดตามงวดผ่อนลูกค้าที่ซื้อตรง · ${PLANS.length} สัญญา</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="remind-all-btn">📱 ทวงทั้งหมด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('⚠️ ค้างชำระ', overdue+' สัญญา', 'var(--danger)')}
          ${sc('💳 ปกติ', current+' สัญญา', 'var(--primary)')}
          ${sc('✅ ปิดบัญชี', completed+' สัญญา', 'var(--success)')}
          ${sc('💰 ยอดค้างรวม', '฿'+totalBal.toLocaleString(), 'var(--warning)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(p=>planCard(p)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.remind-btn').forEach(b=>b.addEventListener('click',()=>{
      const p=PLANS.find(x=>x.id===b.dataset.id)
      if(p) showToast('📱 ส่งแจ้งเตือน SMS/LINE ให้ '+p.customer+' แล้ว','success')
    }))
    container.querySelectorAll('.pay-btn').forEach(b=>b.addEventListener('click',()=>{
      const p=PLANS.find(x=>x.id===b.dataset.id)
      if(p&&p.status!=='completed'){
        p.paid+=1; if(p.paid>=p.total_inst){p.status='completed';p.nextDate=''}
        render(); showToast('💳 บันทึกงวด '+p.paid+'/'+p.total_inst+' ให้ '+p.customer,'success')
      }
    }))
    document.getElementById('remind-all-btn')?.addEventListener('click',()=>{
      const n=PLANS.filter(p=>p.status==='overdue').length
      showToast('📱 ส่งทวงถามทั้ง '+n+' รายที่ค้างชำระแล้ว','success')
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
