/**
 * Quick Lane — ช่อง Fast Service เปลี่ยนถ่ายน้ำมัน / ตรวจสภาพรวดเร็ว
 * Route: /service/quick-lane
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const STATUS_CFG = {
  waiting:     { label:'รอคิว',      bg:'var(--surface-2)',  icon:'⏳', textColor:'var(--text-muted)' },
  in_progress: { label:'กำลังทำ',   bg:'var(--warning)',    icon:'🔧', textColor:'#fff' },
  done:        { label:'เสร็จแล้ว', bg:'var(--success)',    icon:'✅', textColor:'#fff' },
}

const SERVICES = ['เปลี่ยนถ่ายน้ำมัน','เติมลม / ตรวจยาง','เปลี่ยนไส้กรองอากาศ','ตรวจเช็ก EV Battery','เปลี่ยนน้ำกลั่น','ตรวจสภาพรวดเร็ว 30 จุด','เปลี่ยนหลอดไฟ','ล้างหัวฉีด']

export default async function QuickLanePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let filterStatus = 'all'
  let JOBS = []
  let loading = true

  async function loadData() {
    loading = true
    try { JOBS = await listDocs('quick_lane_jobs', [], 'started', 'asc', 500) } catch (e) { JOBS = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function jobCard(j) {
    const cfg = STATUS_CFG[j.status]
    const startBtn = j.status==='waiting'     ? '<button class="btn btn-xs btn-primary start-btn" data-id="'+j.id+'" style="font-size:0.68rem">▶ เริ่มงาน</button>' : ''
    const doneBtn  = j.status==='in_progress' ? '<button class="btn btn-xs btn-primary done-btn" data-id="'+j.id+'" style="font-size:0.68rem">✅ เสร็จ</button>' : ''
    const priceStr = j.price > 0 ? '฿'+j.price.toLocaleString() : 'ฟรี'
    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;align-items:flex-start;gap:12px">' +
        '<div style="background:var(--surface-2);border-radius:8px;padding:8px 12px;text-align:center;flex-shrink:0">' +
          '<div style="font-size:0.6rem;color:var(--text-muted)">Bay</div>' +
          '<div style="font-size:1.2rem;font-weight:900;color:var(--primary)">' + j.bay + '</div>' +
        '</div>' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
            '<span style="font-weight:700;font-size:0.88rem">' + j.customer + '</span>' +
            '<span style="font-size:0.66rem;background:var(--surface-2);padding:1px 7px;border-radius:8px">' + j.plate + '</span>' +
            '<span style="font-size:0.62rem;background:'+cfg.bg+';color:'+cfg.textColor+';padding:1px 7px;border-radius:8px">' + cfg.icon + ' ' + cfg.label + '</span>' +
          '</div>' +
          '<div style="font-size:0.74rem;margin-bottom:4px">' + j.service + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted)">⏱ เข้า ' + j.started + ' · คาด ' + j.estimated + ' นาที · ' + priceStr + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">' + startBtn + doneBtn + '</div>' +
      '</div>' +
    '</div>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    let rows = filterStatus==='all' ? JOBS : JOBS.filter(j=>j.status===filterStatus)

    const waiting    = JOBS.filter(j=>j.status==='waiting').length
    const inProgress = JOBS.filter(j=>j.status==='in_progress').length
    const done       = JOBS.filter(j=>j.status==='done').length
    const revenue    = JOBS.filter(j=>j.status==='done').reduce((s,j)=>s+j.price,0)

    const statusBtns = ['all','waiting','in_progress','done'].map(s=>{
      const lbl = s==='all'?'ทั้งหมด':STATUS_CFG[s].icon+' '+STATUS_CFG[s].label
      return '<button class="btn btn-xs '+(filterStatus===s?'btn-primary':'btn-secondary')+' stat-btn" data-s="'+s+'">'+lbl+'</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ Quick Lane</div>
            <div class="page-subtitle">Fast Service · วันนี้ ${JOBS.length} คิว</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="walkin-btn">+ รับคิวใหม่</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('⏳ รอคิว', waiting+' คัน', 'var(--text-muted)')}
          ${sc('🔧 กำลังทำ', inProgress+' คัน', 'var(--warning)')}
          ${sc('✅ เสร็จแล้ว', done+' คัน', 'var(--success)')}
          ${sc('💰 รายได้วันนี้', '฿'+revenue.toLocaleString(), 'var(--primary)')}
        </div>
        <div style="display:flex;gap:6px;margin-bottom:14px">${statusBtns}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(j=>jobCard(j)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่มีคิว</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.start-btn').forEach(b=>b.addEventListener('click',async ()=>{
      const j=JOBS.find(x=>x.id===b.dataset.id)
      if(!j) return
      j.status='in_progress'; render()
      showToast('🔧 เริ่มงาน: '+j.customer+' '+j.service,'success')
      try { await updateDocData('quick_lane_jobs', j.id, { status: 'in_progress' }) } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.done-btn').forEach(b=>b.addEventListener('click',async ()=>{
      const j=JOBS.find(x=>x.id===b.dataset.id)
      if(!j) return
      j.status='done'; render()
      showToast('✅ เสร็จ: '+j.customer+' · '+j.service,'success')
      try { await updateDocData('quick_lane_jobs', j.id, { status: 'done' }) } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('walkin-btn')?.addEventListener('click',()=>openWalkInModal())
  }

  function openWalkInModal() {
    openModal({
      title:'⚡ รับคิว Quick Lane', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อลูกค้า</label><input class="input" id="ql-cust" style="width:100%;margin-top:3px" placeholder="ชื่อ..."></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ทะเบียน</label><input class="input" id="ql-plate" style="width:100%;margin-top:3px" placeholder="กก-1234"></div>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">บริการ</label>
          <select class="input" id="ql-svc" style="width:100%;margin-top:3px">
            ${SERVICES.map(s=>'<option>'+s+'</option>').join('')}
          </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">Bay</label>
            <select class="input" id="ql-bay" style="width:100%;margin-top:3px"><option>1</option><option>2</option><option>3</option></select></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคา (บ.)</label><input class="input" id="ql-price" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
        </div>
      </div>`,
      confirmText:'⚡ เปิดคิว',
      async onConfirm() {
        const cust=document.getElementById('ql-cust')?.value?.trim()
        const plate=document.getElementById('ql-plate')?.value?.trim()
        if(!cust||!plate){showToast('กรอกชื่อและทะเบียน','warning');return false}
        const svc=document.getElementById('ql-svc')?.value||SERVICES[0]
        const bay=parseInt(document.getElementById('ql-bay')?.value)||1
        const price=parseInt(document.getElementById('ql-price')?.value)||0
        const now=new Date()
        const timeStr=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0')
        try {
          await createDoc('quick_lane_jobs', {plate,customer:cust,service:svc,bay,started:timeStr,estimated:30,status:'waiting',price})
          showToast('⚡ รับคิว '+cust+' เรียบร้อย','success')
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
