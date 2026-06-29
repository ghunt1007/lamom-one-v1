/**
 * Stock Reservation Lock — ล็อคสต็อกรอโอน / ป้องกันซ้ำซ้อน
 * Route: /dms/reserve-lock
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_STOCK = [
  { id:'SV001', vin:'LBV5A2B10P0001111', model:'BYD Atto 3',   color:'Arctic Blue',  year:'2026', price:1099000, status:'reserved', customer:'สมชาย ใจดี',   agent:'พนักงาน A', lockedAt:'2026-06-12', expiry:'2026-06-19', deposit:50000 },
  { id:'SV002', vin:'LBV5A2B10P0002222', model:'BYD Seal AWD', color:'Cosmos Black', year:'2026', price:1699000, status:'reserved', customer:'นภา สุขใจ',    agent:'พนักงาน B', lockedAt:'2026-06-13', expiry:'2026-06-20', deposit:100000},
  { id:'SV003', vin:'LBV5A2B10P0003333', model:'BYD Han',      color:'Jade Green',   year:'2026', price:2099000, status:'available',customer:'',              agent:'',           lockedAt:'',           expiry:'',            deposit:0    },
  { id:'SV004', vin:'LBV5A2B10P0004444', model:'BYD Dolphin',  color:'Snow White',   year:'2026', price:899000,  status:'locked',   customer:'วิชัย ดีมาก',  agent:'พนักงาน A', lockedAt:'2026-06-14', expiry:'2026-06-17', deposit:30000},
  { id:'SV005', vin:'LBV5A2B10P0005555', model:'MG ZS EV',     color:'Pearl White',  year:'2026', price:799000,  status:'available',customer:'',              agent:'',           lockedAt:'',           expiry:'',            deposit:0    },
  { id:'SV006', vin:'LBV5A2B10P0006666', model:'BYD Atto 3',   color:'Ski White',    year:'2026', price:1099000, status:'sold',     customer:'มาลี รุ่งเรือง',agent:'พนักงาน C', lockedAt:'2026-06-10', expiry:'',            deposit:0    },
  { id:'SV007', vin:'LBV5A2B10P0007777', model:'BYD Seal AWD', color:'Aurora Silver',year:'2026', price:1699000, status:'available',customer:'',              agent:'',           lockedAt:'',           expiry:'',            deposit:0    },
]

const STATUS_CFG = {
  available: { label:'ว่าง',       bg:'var(--success)', icon:'✅' },
  reserved:  { label:'จองแล้ว',   bg:'var(--warning)', icon:'🔒' },
  locked:    { label:'ล็อคชั่วคราว',bg:'var(--danger)', icon:'🔐' },
  sold:      { label:'ขายแล้ว',   bg:'var(--text-muted)',icon:'🏁' },
}

function daysLeft(expiry) {
  if(!expiry) return null
  return Math.round((new Date(expiry)-new Date('2026-06-14'))/86400000)
}

export default async function ReserveLockPage(container) {
  const myGen = container.__routerGen
  let stock = DEMO_stock.map(s => ({ ...s }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('reservations', [], 'lockedAt', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `SV${String(i+1).padStart(3,'0')}`,
        vin: d.vin || '',
        model: d.model || '',
        color: d.color || '',
        year: d.year || '2026',
        price: d.price || 0,
        status: d.status || 'available',
        customer: d.customer || '',
        agent: d.agent || '',
        lockedAt: d.lockedAt || '',
        expiry: d.expiry || '',
        deposit: d.deposit || 0,
      }))
      stock = [...mapped, ...DEMO_STOCK]
      dataSource = 'live'
    }
  } catch {}

  let filterStatus = 'all'
  let filterModel  = 'all'

  function render() {
    let rows = stock
    if(filterStatus !== 'all') rows = rows.filter(v=>v.status===filterStatus)
    if(filterModel !== 'all')  rows = rows.filter(v=>v.model===filterModel)

    const models   = [...new Set(stock.map(v=>v.model))]
    const avail    = stock.filter(v=>v.status==='available').length
    const reserved = stock.filter(v=>v.status==='reserved').length
    const locked   = stock.filter(v=>v.status==='locked').length
    const expiringSoon = stock.filter(v=>v.expiry && daysLeft(v.expiry)<=3 && v.status!=='sold').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔐 Stock Reservation Lock</div>
            <div class="page-subtitle">ล็อคสต็อกรอโอน · ป้องกันซ้ำซ้อน · ${stock.length} คัน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="release-exp-btn">🔓 ปลดล็อคหมดอายุ</button>
            <button class="btn btn-primary" id="lock-btn">+ ล็อคสต็อก</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('✅ ว่าง', avail+' คัน', 'var(--success)')}
          ${sc('🔒 จองแล้ว', reserved+' คัน', 'var(--warning)')}
          ${sc('🔐 ล็อคชั่วคราว', locked+' คัน', 'var(--danger)')}
          ${sc('⚠️ ใกล้หมดอายุ', expiringSoon+' คัน', expiringSoon>0?'var(--danger)':'var(--text-muted)')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          ${['all','available','reserved','locked','sold'].map(s=>`
            <button class="btn btn-xs ${filterStatus===s?'btn-primary':'btn-secondary'} stat-btn" data-s="${s}">
              ${STATUS_CFG[s]?.icon||'🔍'} ${STATUS_CFG[s]?.label||'ทั้งหมด'}
            </button>`).join('')}
          <select class="input" id="model-filter" style="min-width:160px;margin-left:8px">
            <option value="all">ทุกรุ่น</option>
            ${models.map(m=>`<option value="${escHtml(m)}" ${filterModel===m?'selected':''}>${escHtml(m)}</option>`).join('')}
          </select>
        </div>

        <!-- Stock grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
          ${rows.map(v => stockCard(v)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted);grid-column:1/-1">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    document.getElementById('model-filter')?.addEventListener('change',e=>{filterModel=e.target.value;render()})
    document.getElementById('release-exp-btn')?.addEventListener('click',()=>{
      const expired=stock.filter(v=>v.expiry&&daysLeft(v.expiry)<=0&&v.status!=='sold')
      expired.forEach(v=>{v.status='available';v.customer='';v.agent='';v.lockedAt='';v.expiry='';v.deposit=0})
      render(); showToast(`🔓 ปลดล็อค ${expired.length} คันที่หมดอายุแล้ว`,'success')
    })
    document.getElementById('lock-btn')?.addEventListener('click',()=>openLockModal())
    container.querySelectorAll('.lock-now-btn').forEach(b=>b.addEventListener('click',()=>{
      const v=stock.find(x=>x.id===b.dataset.id); if(v) openLockModal(v)
    }))
    container.querySelectorAll('.unlock-btn').forEach(b=>b.addEventListener('click',()=>{
      const v=stock.find(x=>x.id===b.dataset.id)
      if(v){
        openModal({title:'🔓 ปลดล็อค — ' + escHtml(v.model),size:'xs',
          body:`<div style="font-size:0.8rem">ปลดล็อค <b>${escHtml(v.model)}</b> คืนเป็นว่าง?${v.deposit?`<br>มัดจำ ฿${v.deposit.toLocaleString()} จะต้องคืน`:''}`,
          confirmText:'🔓 ปลดล็อค',
          onConfirm(){v.status='available';v.customer='';v.agent='';v.lockedAt='';v.expiry='';v.deposit=0;render();showToast('🔓 ปลดล็อคแล้ว','success')}
        })
      }
    }))
  }

  function openLockModal(vehicle=null) {
    const avail = vehicle ? [vehicle] : stock.filter(v=>v.status==='available')
    openModal({
      title:'🔒 ล็อคสต็อก', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เลือกรถ</label>
          <select class="input" id="lock-vin" style="width:100%;margin-top:3px">
            ${avail.map(v=>`<option value="${escHtml(v.id)}">${escHtml(v.model)} ${escHtml(v.color)} (VIN:${escHtml(v.vin.slice(-6))})</option>`).join('')}
          </select></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อลูกค้า</label><input class="input" id="lock-cust" style="width:100%;margin-top:3px" placeholder="ชื่อลูกค้า..."></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ประเภท</label>
            <select class="input" id="lock-type" style="width:100%;margin-top:3px"><option value="reserved">จอง</option><option value="locked">ล็อคชั่วคราว</option></select></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">หมดอายุ</label><input class="input" id="lock-exp" type="date" value="2026-06-21" style="width:100%;margin-top:3px"></div>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">มัดจำ (บาท)</label><input class="input" id="lock-dep" type="number" placeholder="0" style="width:100%;margin-top:3px"></div>
      </div>`,
      confirmText:'🔒 ล็อคสต็อก',
      onConfirm(){
        const vinId=document.getElementById('lock-vin')?.value
        const cust=document.getElementById('lock-cust')?.value?.trim()
        if(!cust){showToast('ใส่ชื่อลูกค้า','warning');return false}
        const v=stock.find(x=>x.id===vinId)
        if(v){
          v.status=document.getElementById('lock-type')?.value||'reserved'
          v.customer=cust; v.agent='พนักงาน A'; v.lockedAt='2026-06-14'
          v.expiry=document.getElementById('lock-exp')?.value||''
          v.deposit=parseInt(document.getElementById('lock-dep')?.value)||0
          render(); showToast(`🔒 ล็อค ${v.model} ให้ ${cust} แล้ว`,'success')
        }
      }
    })
  }

  function stockCard(v) {
    const cfg = STATUS_CFG[v.status]
    const dl  = v.expiry ? daysLeft(v.expiry) : null
    let expiryStr = ''
    if (v.expiry) {
      const dColor = dl <= 3 ? 'var(--danger)' : dl <= 7 ? 'var(--warning)' : 'var(--success)'
      const dLabel = dl <= 0 ? 'หมดอายุ' : dl + ' วัน'
      expiryStr = '· หมด ' + formatDate(v.expiry) + ' <span style="color:' + dColor + '">(' + dLabel + ')</span>'
    }
    let lockLine = v.lockedAt ? '<div style="font-size:0.68rem;color:var(--text-muted)">ล็อค ' + formatDate(v.lockedAt) + ' ' + expiryStr + '</div>' : ''
    let depositLine = v.deposit ? '<div style="font-size:0.72rem;color:var(--primary);font-weight:700;margin-top:2px">มัดจำ ' + v.deposit.toLocaleString() + ' บ.</div>' : ''
    let custSection = v.customer ? '<div style="font-size:0.76rem;background:var(--surface-2);padding:8px;border-radius:6px;margin-bottom:8px"><div><b>' + escHtml(v.customer) + '</b> · ' + escHtml(v.agent) + '</div>' + lockLine + depositLine + '</div>' : ''
    const lockBtn    = v.status === 'available' ? '<button class="btn btn-xs btn-primary lock-now-btn" data-id="' + escHtml(v.id) + '" style="font-size:0.68rem">🔒 ล็อค</button>' : ''
    const unlockBtn  = (v.status === 'reserved' || v.status === 'locked') ? '<button class="btn btn-xs btn-secondary unlock-btn" data-id="' + escHtml(v.id) + '" style="font-size:0.68rem">🔓 ปลด</button>' : ''
    return `<div class="card" style="padding:14px;border-top:3px solid ${cfg.bg}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:700;font-size:0.88rem">${escHtml(v.model)}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(v.color)} · ${v.year}</div>
        </div>
        <span style="font-size:0.62rem;background:${cfg.bg};color:#fff;padding:2px 8px;border-radius:10px">${cfg.icon} ${cfg.label}</span>
      </div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">VIN: ${escHtml(v.vin.slice(-8))}</div>
      ${custSection}
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:0.9rem;font-weight:900;color:var(--primary)">฿${v.price.toLocaleString()}</div>
        <div style="display:flex;gap:4px">${lockBtn}${unlockBtn}</div>
      </div>
    </div>`
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
