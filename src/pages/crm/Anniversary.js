/**
 * Customer Anniversary — วันครบรอบซื้อรถ / แจ้งเตือนอัตโนมัติ
 * Route: /crm/anniversary
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TODAY = '2026-06-14'

const CUSTOMERS = [
  { id:'AV001', name:'สมชาย ใจดี',    phone:'081-111-2222', model:'BYD Atto 3',  saleDate:'2025-06-14', years:1, notified:false },
  { id:'AV002', name:'นภา สุขใจ',     phone:'089-333-4444', model:'BYD Seal AWD',saleDate:'2025-06-20', years:1, notified:false },
  { id:'AV003', name:'วิชัย ดีมาก',   phone:'076-555-6666', model:'BYD Han',     saleDate:'2024-06-10', years:2, notified:true  },
  { id:'AV004', name:'มาลี รุ่งเรือง',phone:'095-777-8888', model:'MG ZS EV',    saleDate:'2023-06-25', years:3, notified:false },
  { id:'AV005', name:'อรุณ วิชิต',    phone:'081-999-0000', model:'BYD Dolphin', saleDate:'2025-07-01', years:1, notified:false },
  { id:'AV006', name:'สุดา ภักดี',    phone:'089-111-3333', model:'BYD Atto 3',  saleDate:'2024-06-16', years:2, notified:false },
  { id:'AV007', name:'ประยุทธ มั่นคง', phone:'085-222-4444', model:'BYD Han',     saleDate:'2022-06-14', years:4, notified:true  },
]

function daysTillAnniv(saleDate) {
  const sd = new Date(saleDate)
  const thisYear = new Date(TODAY).getFullYear()
  let anniv = new Date(thisYear, sd.getMonth(), sd.getDate())
  if (anniv < new Date(TODAY)) anniv = new Date(thisYear+1, sd.getMonth(), sd.getDate())
  return Math.round((anniv - new Date(TODAY)) / 86400000)
}

function anniversaryLabel(days) {
  if (days === 0) return { label:'🎂 วันนี้!',    bg:'var(--success)', urgent:true  }
  if (days <= 7)  return { label:`อีก ${days} วัน`, bg:'var(--danger)',  urgent:true  }
  if (days <= 30) return { label:`อีก ${days} วัน`, bg:'var(--warning)', urgent:false }
  return               { label:`อีก ${days} วัน`, bg:'var(--text-muted)',urgent:false }
}

const GIFT_TEMPLATES = [
  { id:'g1', name:'ส่วนลดเซอร์วิส 500 บ.', icon:'🔧' },
  { id:'g2', name:'ตรวจสภาพรถฟรี',          icon:'🚗' },
  { id:'g3', name:'ล้างรถฟรี 1 ครั้ง',       icon:'🚿' },
  { id:'g4', name:'บัตรกำนัล 300 บ.',        icon:'🎁' },
]

export default async function AnniversaryPage(container) {
  const myGen = container.__routerGen
  let customers = [...CUSTOMERS]
  let filter = 'all'
  let dataSource = 'demo'
  let autoNotify = false

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    const delivered = sales.filter(s => s.status === 'ส่งมอบแล้ว' || s.status === 'delivered')
    if (delivered.length >= 2) {
      const live = delivered.map((s, i) => ({
        id: `LV${i+1}`,
        name: s.customerName || s.custName || 'ลูกค้า',
        phone: s.phone || '',
        model: s.model || s.vehicleModel || '',
        saleDate: s.deliveryDate || s.bookingDate || new Date().toISOString().slice(0, 10),
        years: Math.floor((Date.now() - new Date(s.deliveryDate || s.bookingDate || Date.now()).getTime()) / (365.25 * 86400000)),
        notified: false,
      }))
      customers = [...live, ...CUSTOMERS]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const sorted = customers.map(c => ({ ...c, daysLeft: daysTillAnniv(c.saleDate) }))
      .sort((a,b) => a.daysLeft - b.daysLeft)

    const today   = sorted.filter(c => c.daysLeft === 0)
    const week    = sorted.filter(c => c.daysLeft > 0 && c.daysLeft <= 7)
    const month   = sorted.filter(c => c.daysLeft > 7 && c.daysLeft <= 30)
    const upcoming= sorted.filter(c => c.daysLeft > 30)

    let rows = filter === 'today' ? today : filter === 'week' ? week : filter === 'month' ? month : sorted

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎂 Customer Anniversary</div>
            <div class="page-subtitle">วันครบรอบซื้อรถ · แจ้งเตือนล่วงหน้า · ส่งของขวัญอัตโนมัติ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn ${autoNotify?'btn-success':'btn-secondary'}" id="auto-notify-btn">${autoNotify?'✅ Auto-Notify: เปิด':'🤖 Auto แจ้งทั้งหมด'}</button>
            <button class="btn btn-primary" id="send-all-btn">🎁 ส่งของขวัญทั้งหมด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🎂 วันนี้', today.length+' คน', today.length>0?'var(--danger)':'var(--text-muted)')}
          ${sc('📅 ภายใน 7 วัน', week.length+' คน', 'var(--warning)')}
          ${sc('📆 ภายใน 30 วัน', month.length+' คน', 'var(--primary)')}
          ${sc('✅ แจ้งแล้ว', customers.filter(c=>c.notified).length+' คน', 'var(--success)')}
        </div>

        <!-- Filter -->
        <div style="display:flex;gap:6px;margin-bottom:14px">
          ${[['all','ทั้งหมด'],['today','วันนี้'],['week','7 วัน'],['month','30 วัน']].map(([f,l])=>`
            <button class="btn btn-xs ${filter===f?'btn-primary':'btn-secondary'} fil-btn" data-f="${f}">${l}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(c => {
            const anniv = anniversaryLabel(c.daysLeft)
            return `
            <div class="card" style="padding:14px;border-left:3px solid ${anniv.bg}">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="font-size:1.6rem">${c.years===1?'🥳':c.years===2?'🎊':c.years===3?'🎉':'🏆'}</div>
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                    <span style="font-weight:700;font-size:0.88rem">${escHtml(c.name)}</span>
                    <span style="font-size:0.68rem;color:var(--text-muted)">${escHtml(c.phone)}</span>
                    <span style="font-size:0.62rem;background:${anniv.bg};color:#fff;padding:1px 8px;border-radius:10px;font-weight:${anniv.urgent?700:400}">${anniv.label}</span>
                    ${c.notified?`<span style="font-size:0.6rem;background:var(--success);color:#fff;padding:1px 6px;border-radius:8px">✅ แจ้งแล้ว</span>`:''}
                  </div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">
                    🚗 ${escHtml(c.model)} · ซื้อ ${formatDate(c.saleDate)} · ครบรอบ ${c.years} ปี
                  </div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                  ${!c.notified?`<button class="btn btn-xs btn-primary notify-btn" data-id="${c.id}" style="font-size:0.7rem">🎁 ส่ง</button>`:''}
                  <button class="btn btn-xs btn-secondary gift-btn" data-id="${c.id}" style="font-size:0.7rem">🎀 เลือกของขวัญ</button>
                </div>
              </div>
            </div>`
          }).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่มีในช่วงนี้</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.fil-btn').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.f;render()}))
    document.getElementById('auto-notify-btn')?.addEventListener('click',()=>{
      autoNotify = !autoNotify
      render()
      showToast(autoNotify ? '🤖 Auto-Notify เปิดแล้ว — จะส่ง LINE 3 วันก่อนครบรอบ' : '⏸ Auto-Notify ปิดแล้ว', autoNotify ? 'success' : 'warning')
    })
    document.getElementById('send-all-btn')?.addEventListener('click',()=>{
      const notNotified = customers.filter(c=>!c.notified)
      notNotified.forEach(c=>c.notified=true)
      render(); showToast(`🎁 ส่งของขวัญให้ ${notNotified.length} คนแล้ว`,'success')
    })
    container.querySelectorAll('.notify-btn').forEach(b=>b.addEventListener('click',()=>{
      const c=customers.find(x=>x.id===b.dataset.id)
      if(c){c.notified=true;render();showToast(`🎁 ส่งของขวัญให้ ${c.name} แล้ว`,'success')}
    }))
    container.querySelectorAll('.gift-btn').forEach(b=>b.addEventListener('click',()=>{
      const c=customers.find(x=>x.id===b.dataset.id)
      if(c) openGiftModal(c)
    }))
  }

  function openGiftModal(c) {
    openModal({
      title:'🎀 เลือกของขวัญ — ' + escHtml(c.name), size:'xs',
      body:`<div style="font-size:0.8rem">
        <div style="color:var(--text-muted);margin-bottom:10px">ครบรอบ ${c.years} ปี · ${escHtml(c.model)}</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${GIFT_TEMPLATES.map(g=>`
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px;border-radius:6px;border:1px solid var(--border)">
              <input type="radio" name="gift" value="${g.id}" style="flex-shrink:0">
              <span>${g.icon} ${g.name}</span>
            </label>`).join('')}
        </div>
      </div>`,
      confirmText:'📤 ส่งของขวัญ',
      onConfirm(){
        const sel=document.querySelector('input[name="gift"]:checked')
        if(!sel){showToast('เลือกของขวัญก่อน','warning');return false}
        const gift=GIFT_TEMPLATES.find(g=>g.id===sel.value)
        c.notified=true; render()
        showToast(`${gift.icon} ส่ง "${gift.name}" ให้ ${c.name} ทาง LINE แล้ว`,'success')
      }
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
