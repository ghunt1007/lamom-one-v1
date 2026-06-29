/**
 * Used Car Management — ซื้อ-ขายรถมือสอง ประเมิน ตั้งราคา
 * Route: /dms/used-car
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_USED_CARS = [
  { id:'UC001', plate:'กก-1234 กทม.',  brand:'Toyota', model:'Camry',       year:2022, km:28000, appraisal:750000, asking:820000, sold:0,      status:'for_sale',   date:'2026-05-20', buyer:''          },
  { id:'UC002', plate:'ขข-5678 นทบ.',  brand:'Honda',  model:'City',        year:2021, km:45000, appraisal:430000, asking:489000, sold:489000, status:'sold',       date:'2026-06-01', buyer:'สมชาย ใจดี' },
  { id:'UC003', plate:'คค-9012 กทม.',  brand:'Mazda',  model:'CX-5',        year:2023, km:15000, appraisal:920000, asking:980000, sold:0,      status:'inspection', date:'2026-06-12', buyer:''          },
  { id:'UC004', plate:'งง-3456 สมทบ.', brand:'BYD',    model:'Atto 3 2024', year:2024, km:8000,  appraisal:880000, asking:950000, sold:0,      status:'for_sale',   date:'2026-06-10', buyer:''          },
  { id:'UC005', plate:'จจ-7890 กทม.',  brand:'Honda',  model:'HR-V',        year:2022, km:32000, appraisal:610000, asking:660000, sold:0,      status:'reserved',   date:'2026-06-13', buyer:'นภา สุขใจ' },
]

const STATUS_CFG = {
  for_sale:   { label:'ขายอยู่',     bg:'var(--success)',     icon:'🏷️' },
  inspection: { label:'ประเมินอยู่', bg:'var(--warning)',     icon:'🔍' },
  reserved:   { label:'จองแล้ว',     bg:'var(--primary)',     icon:'🔒' },
  sold:       { label:'ขายแล้ว',     bg:'var(--text-muted)',  icon:'🏁' },
}

export default async function UsedCarPage(container) {
  const myGen = container.__routerGen
  let usedCars = DEMO_USED_CARS.map(c => ({ ...c }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('used_cars', [], 'date', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `UC${String(i+1).padStart(3,'0')}`,
        plate: d.plate || '',
        brand: d.brand || '',
        model: d.model || '',
        year: d.year || new Date().getFullYear(),
        km: d.km || 0,
        appraisal: d.appraisal || 0,
        asking: d.asking || d.askingPrice || 0,
        sold: d.sold || d.soldPrice || 0,
        status: d.status || 'inspection',
        date: d.date || '',
        buyer: d.buyer || '',
      }))
      usedCars = [...mapped, ...DEMO_USED_CARS]
      dataSource = 'live'
    }
  } catch {}

  let filterStatus = 'all'

  function carRow(c) {
    const cfg        = STATUS_CFG[c.status]
    const margin     = c.status==='sold' ? c.sold - c.appraisal : c.asking - c.appraisal
    const marginCol  = margin >= 0 ? 'var(--success)' : 'var(--danger)'
    const marginStr  = (margin >= 0 ? '+' : '') + margin.toLocaleString() + ' บ.'
    const buyerLine  = c.buyer ? ' · ผู้ซื้อ: ' + escHtml(c.buyer) : ''
    const sellBtn    = c.status==='for_sale'   ? '<button class="btn btn-xs btn-primary sell-btn" data-id="' + escHtml(c.id) + '" style="font-size:0.68rem">💵 บันทึกขาย</button>' : ''
    const approveBtn = c.status==='inspection' ? '<button class="btn btn-xs btn-primary approve-btn" data-id="' + escHtml(c.id) + '" style="font-size:0.68rem">✅ อนุมัติ</button>' : ''
    const editBtn    = c.status!=='sold'       ? '<button class="btn btn-xs btn-secondary edit-btn" data-id="' + escHtml(c.id) + '" style="font-size:0.68rem">✏️ ราคา</button>' : ''
    return `<div class="card" style="padding:14px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:1.8rem">🚗</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:700;font-size:0.9rem">${escHtml(c.brand)} ${escHtml(c.model)}</span>
            <span style="font-size:0.66rem;background:var(--surface-2);padding:1px 7px;border-radius:8px">${c.year}</span>
            <span style="font-size:0.62rem;background:${cfg.bg};color:#fff;padding:1px 8px;border-radius:8px">${cfg.icon} ${cfg.label}</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">
            ทะเบียน ${escHtml(c.plate)} · ${c.km.toLocaleString()} กม. · รับเข้า ${formatDate(c.date)}${buyerLine}
          </div>
          <div style="display:flex;gap:16px;font-size:0.74rem">
            <span>💰 ประเมิน ฿${c.appraisal.toLocaleString()}</span>
            <span>🏷️ ตั้งขาย ฿${c.asking.toLocaleString()}</span>
            <span style="color:${marginCol};font-weight:700">กำไร ${marginStr}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
          ${sellBtn}${approveBtn}${editBtn}
        </div>
      </div>
    </div>`
  }

  function render() {
    let rows = usedCars
    if (filterStatus !== 'all') rows = rows.filter(c=>c.status===filterStatus)

    const forSale    = usedCars.filter(c=>c.status==='for_sale').length
    const inspection = usedCars.filter(c=>c.status==='inspection').length
    const soldCount  = usedCars.filter(c=>c.status==='sold').length
    const totalMargin= usedCars.filter(c=>c.status==='sold').reduce((s,c)=>s+(c.sold-c.appraisal),0)

    const statusBtns = ['all','for_sale','inspection','reserved','sold'].map(s=>{
      const label = s==='all' ? 'ทั้งหมด' : STATUS_CFG[s].icon + ' ' + STATUS_CFG[s].label
      return '<button class="btn btn-xs ' + (filterStatus===s?'btn-primary':'btn-secondary') + ' stat-btn" data-s="' + s + '">' + label + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 Used Car Management</div>
            <div class="page-subtitle">ซื้อ-ขายรถมือสอง ประเมิน ตั้งราคา · ${usedCars.length} คัน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-car-btn">+ รับรถมือสองเข้า</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🏷️ ขายอยู่', forSale+' คัน', 'var(--success)')}
          ${sc('🔍 ประเมินอยู่', inspection+' คัน', 'var(--warning)')}
          ${sc('🏁 ขายแล้ว', soldCount+' คัน', 'var(--text-muted)')}
          ${sc('💰 กำไรรวม', '฿'+totalMargin.toLocaleString(), totalMargin>=0?'var(--success)':'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${statusBtns}</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(c=>carRow(c)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.sell-btn').forEach(b=>b.addEventListener('click',()=>{
      const c=usedCars.find(x=>x.id===b.dataset.id)
      if(c){c.status='sold';c.sold=c.asking;c.buyer='ลูกค้าใหม่';render();showToast('🏁 บันทึกขาย '+c.brand+' '+c.model+' แล้ว','success')}
    }))
    container.querySelectorAll('.approve-btn').forEach(b=>b.addEventListener('click',()=>{
      const c=usedCars.find(x=>x.id===b.dataset.id)
      if(c){c.status='for_sale';render();showToast('✅ อนุมัติ '+c.brand+' '+c.model+' ตั้งขายแล้ว','success')}
    }))
    container.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click',()=>{
      const c=usedCars.find(x=>x.id===b.dataset.id)
      if(c) openEditPriceModal(c)
    }))
    document.getElementById('add-car-btn')?.addEventListener('click',()=>openAddModal())
  }

  function openEditPriceModal(c) {
    openModal({
      title: '✏️ แก้ไขราคา — ' + escHtml(c.brand) + ' ' + escHtml(c.model),
      size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;font-size:0.82rem">
          <div style="background:var(--surface-2);border-radius:8px;padding:8px 12px;font-size:0.76rem">
            <span style="color:var(--text-muted)">ทะเบียน: </span><span style="font-weight:700">${escHtml(c.plate)}</span>
            &nbsp;·&nbsp;<span style="color:var(--text-muted)">เลขไมล์: </span><span style="font-weight:700">${c.km.toLocaleString()} กม.</span>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคาประเมิน (บาท)</label>
            <input id="ep-appr" type="number" class="input" value="${c.appraisal}"></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคาตั้งขาย (บาท)</label>
            <input id="ep-ask" type="number" class="input" value="${c.asking}"></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="ep-save">💾 บันทึกราคา</button>
        </div>
      `
    })
    document.getElementById('ep-save')?.addEventListener('click', () => {
      const appraisal = parseInt(document.getElementById('ep-appr')?.value) || c.appraisal
      const asking    = parseInt(document.getElementById('ep-ask')?.value)  || c.asking
      if (asking < appraisal) { showToast('⚠️ ราคาขายต่ำกว่าราคาประเมิน', 'warning'); return }
      c.appraisal = appraisal
      c.asking    = asking
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ อัปเดตราคา ' + c.brand + ' ' + c.model + ' แล้ว', 'success')
      render()
    })
  }

  function openAddModal() {
    openModal({
      title:'🚗 รับรถมือสองเข้า', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ยี่ห้อ</label><input class="input" id="uc-brand" style="width:100%;margin-top:3px" placeholder="Toyota..."></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">รุ่น</label><input class="input" id="uc-model" style="width:100%;margin-top:3px" placeholder="Camry..."></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ปี</label><input class="input" id="uc-year" style="width:100%;margin-top:3px" placeholder="2023"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">เลขไมล์</label><input class="input" id="uc-km" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ทะเบียน</label><input class="input" id="uc-plate" style="width:100%;margin-top:3px" placeholder="กก-1234 กทม."></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคาประเมิน (บ.)</label><input class="input" id="uc-appr" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคาตั้งขาย (บ.)</label><input class="input" id="uc-ask" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
        </div>
      </div>`,
      confirmText:'🚗 รับรถเข้า',
      onConfirm() {
        const brand=document.getElementById('uc-brand')?.value?.trim()
        const model=document.getElementById('uc-model')?.value?.trim()
        if(!brand||!model){showToast('ใส่ยี่ห้อและรุ่น','warning');return false}
        const year=parseInt(document.getElementById('uc-year')?.value)||2023
        const km=parseInt(document.getElementById('uc-km')?.value)||0
        const plate=document.getElementById('uc-plate')?.value?.trim()||'-'
        const appraisal=parseInt(document.getElementById('uc-appr')?.value)||0
        const asking=parseInt(document.getElementById('uc-ask')?.value)||0
        usedCars.push({id:'UC'+Date.now(),plate,brand,model,year,km,appraisal,asking,sold:0,status:'inspection',date:'2026-06-14',buyer:''})
        render(); showToast('🚗 รับ '+brand+' '+model+' เข้าสต็อก (รอประเมิน)','success')
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
