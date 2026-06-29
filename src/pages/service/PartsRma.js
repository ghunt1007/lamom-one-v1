/**
 * Parts Return & RMA — คืนอะไหล่ / ส่งคืน Supplier
 * Route: /service/parts-rma
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

let RMAS = [
  { id:'RMA001', partNo:'BYD-BRAKE-F01', partName:'ผ้าเบรคหน้า BYD Atto 3', qty:4, unit:'ชุด', reason:'ชิ้นส่วนชำรุด', supplier:'BYD Thailand', date:'2026-06-01', cost:2800, status:'approved', refNo:'BYD-RET-2026-0041' },
  { id:'RMA002', partNo:'MG-FILTER-001',  partName:'กรองอากาศ MG ZS EV',    qty:6, unit:'ชิ้น', reason:'ผิดรุ่น',          supplier:'MG Sales',    date:'2026-06-03', cost:1200, status:'pending',  refNo:'' },
  { id:'RMA003', partNo:'BYD-LAMP-R02',   partName:'ไฟท้าย BYD Seal',       qty:2, unit:'ชิ้น', reason:'แตกระหว่างขนส่ง',  supplier:'BYD Thailand', date:'2026-06-05', cost:8400, status:'shipped', refNo:'BYD-RET-2026-0042' },
  { id:'RMA004', partNo:'BOSCH-WIPER-S',  partName:'ใบปัดน้ำฝน Bosch',      qty:10,unit:'คู่',  reason:'ผลิตภัณฑ์ชำรุด',   supplier:'Bosch Thai',  date:'2026-06-08', cost:3500, status:'pending',  refNo:'' },
  { id:'RMA005', partNo:'BYD-TYRE-195',   partName:'ยาง BYD 195/60R16',     qty:8, unit:'เส้น', reason:'ผิดสเปก',           supplier:'BYD Thailand', date:'2026-06-10', cost:16000,status:'approved', refNo:'BYD-RET-2026-0043' },
]

const STATUS_CONFIG = {
  pending:  { label:'รอดำเนินการ', bg:'var(--warning)',  fg:'#fff' },
  approved: { label:'อนุมัติแล้ว', bg:'var(--primary)',  fg:'#fff' },
  shipped:  { label:'ส่งคืนแล้ว',  bg:'var(--success)',  fg:'#fff' },
  rejected: { label:'ปฏิเสธ',      bg:'var(--danger)',   fg:'#fff' },
}

export default async function PartsRmaPage(container) {
  let filterStatus = 'all'

  function render() {
    const rows = filterStatus === 'all' ? RMAS : RMAS.filter(r => r.status === filterStatus)
    const totalCost = RMAS.reduce((s, r) => s + r.cost, 0)
    const pending   = RMAS.filter(r => r.status === 'pending').length
    const approved  = RMAS.filter(r => r.status === 'approved').length
    const shipped   = RMAS.filter(r => r.status === 'shipped').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">↩️ Parts Return & RMA</div>
            <div class="page-subtitle">คืนอะไหล่ชำรุด / ผิดรุ่น · ส่งคืน Supplier · ${RMAS.length} รายการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-rma-btn">+ สร้าง RMA ใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📋 ทั้งหมด', RMAS.length+' รายการ', 'var(--primary)')}
          ${sc('⏳ รอดำเนินการ', pending, 'var(--warning)')}
          ${sc('✅ อนุมัติ / ส่ง', (approved+shipped), 'var(--success)')}
          ${sc('💸 มูลค่ารวม', formatCurrency(totalCost), 'var(--text)')}
        </div>

        <!-- Filter tabs -->
        <div style="display:flex;gap:6px;margin-bottom:14px">
          ${['all','pending','approved','shipped','rejected'].map(s=>`
            <button class="btn btn-xs ${filterStatus===s?'btn-primary':'btn-secondary'} stat-btn" data-s="${s}">
              ${s==='all'?'ทั้งหมด':STATUS_CONFIG[s]?.label||s}
            </button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${rows.map(r => {
            const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending
            return `
            <div class="card rma-card" data-id="${r.id}" style="padding:14px;cursor:pointer;border-left:3px solid ${cfg.bg}">
              <div style="display:flex;align-items:flex-start;gap:12px">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span style="font-weight:700;font-size:0.86rem">${r.partName}</span>
                    <span style="font-size:0.62rem;background:${cfg.bg};color:${cfg.fg};padding:2px 8px;border-radius:10px">${cfg.label}</span>
                  </div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">
                    Part# ${r.partNo} · ${r.qty} ${r.unit} · ${r.supplier}
                  </div>
                  <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">
                    เหตุผล: ${r.reason} · วันที่: ${formatDate(r.date)}
                    ${r.refNo ? ` · Ref: ${r.refNo}` : ''}
                  </div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-size:1rem;font-weight:900;color:var(--primary)">${formatCurrency(r.cost)}</div>
                  ${r.status==='pending'?`<button class="btn btn-xs btn-primary approve-btn" data-id="${r.id}" style="margin-top:6px;font-size:0.68rem">✅ อนุมัติ</button>`:''}
                </div>
              </div>
            </div>`
          }).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ RMA</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.s; render() }))
    document.getElementById('new-rma-btn')?.addEventListener('click', () => openNewModal())
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation()
      const rma = RMAS.find(r => r.id === b.dataset.id)
      if (rma) {
        rma.status = 'approved'
        rma.refNo = 'REF-'+Date.now().toString().slice(-6)
        render()
        showToast(`✅ อนุมัติ RMA ${rma.partName} แล้ว`, 'success')
      }
    }))
    container.querySelectorAll('.rma-card').forEach(el => el.addEventListener('click', () => {
      const rma = RMAS.find(r => r.id === el.dataset.id)
      if (rma) openDetailModal(rma)
    }))
  }

  function openDetailModal(r) {
    const cfg = STATUS_CONFIG[r.status]
    openModal({
      title:`↩️ RMA — ${r.partNo}`,
      size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between"><b>${r.partName}</b><span style="font-size:0.62rem;background:${cfg.bg};color:${cfg.fg};padding:2px 8px;border-radius:10px">${cfg.label}</span></div>
        ${dr('Part No.', r.partNo)}
        ${dr('จำนวน', r.qty+' '+r.unit)}
        ${dr('Supplier', r.supplier)}
        ${dr('มูลค่า', formatCurrency(r.cost))}
        ${dr('เหตุผล', r.reason)}
        ${dr('วันที่', formatDate(r.date))}
        ${r.refNo?dr('Ref No.', r.refNo):''}
        <hr style="border-color:var(--border)">
        <label style="font-size:0.72rem;color:var(--text-muted)">อัปเดตสถานะ</label>
        <select class="input" id="status-upd" style="width:100%">
          ${Object.entries(STATUS_CONFIG).map(([k,v])=>`<option value="${k}" ${k===r.status?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>`,
      confirmText:'💾 บันทึก',
      onConfirm() {
        r.status = document.getElementById('status-upd')?.value || r.status
        render(); showToast(`💾 อัปเดตสถานะ RMA แล้ว`, 'success')
      }
    })
  }

  function openNewModal() {
    openModal({
      title:'+ สร้าง RMA ใหม่', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">Part Number</label><input class="input" id="rma-no" placeholder="BYD-XXX-001" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่ออะไหล่</label><input class="input" id="rma-name" placeholder="ชื่ออะไหล่..." style="width:100%;margin-top:4px"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">จำนวน</label><input class="input" id="rma-qty" type="number" placeholder="1" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">มูลค่า (บาท)</label><input class="input" id="rma-cost" type="number" placeholder="0" style="width:100%;margin-top:4px"></div>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">Supplier</label>
          <select class="input" id="rma-sup" style="width:100%;margin-top:4px"><option>BYD Thailand</option><option>MG Sales</option><option>Bosch Thai</option><option>อื่นๆ</option></select></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เหตุผล</label>
          <select class="input" id="rma-reason" style="width:100%;margin-top:4px">
            <option>ชิ้นส่วนชำรุด</option><option>ผิดรุ่น</option><option>แตกระหว่างขนส่ง</option><option>ผลิตภัณฑ์ชำรุด</option><option>ผิดสเปก</option></select></div>
      </div>`,
      confirmText:'📋 สร้าง RMA',
      onConfirm() {
        const no = document.getElementById('rma-no')?.value?.trim()
        const name = document.getElementById('rma-name')?.value?.trim()
        if (!no || !name) { showToast('กรอกข้อมูลให้ครบ', 'warning'); return false }
        RMAS.unshift({
          id:'RMA'+Date.now(), partNo:no, partName:name,
          qty:parseInt(document.getElementById('rma-qty')?.value)||1,
          unit:'ชิ้น', reason:document.getElementById('rma-reason')?.value||'',
          supplier:document.getElementById('rma-sup')?.value||'',
          date:'2026-06-14', cost:parseInt(document.getElementById('rma-cost')?.value)||0,
          status:'pending', refNo:''
        })
        render(); showToast(`📋 สร้าง RMA ${name} แล้ว`, 'success')
      }
    })
  }

  function dr(k, v) {
    return `<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted);width:90px;flex-shrink:0;font-size:0.72rem">${k}</span><span>${v}</span></div>`
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
