/**
 * Warranty Expiry Tracker — ติดตามวันหมดประกันรายคัน
 * Route: /service/warranty-expiry
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const TODAY = '2026-06-14'

let VEHICLES = [
  { id:'WE001', vin:'LBV5A2B10P0001234', model:'BYD Atto 3', plate:'กข-1234', owner:'สมชาย ใจดี',    phone:'081-111-2222', sale:'2024-06-10', warrantyEnd:'2027-06-10', kmWarranty:100000, kmCurrent:28400, status:'active' },
  { id:'WE002', vin:'LBV5A2B10P0005678', model:'BYD Seal AWD', plate:'คง-5678', owner:'นภา สุขใจ',  phone:'089-333-4444', sale:'2023-03-01', warrantyEnd:'2026-03-01', kmWarranty:100000, kmCurrent:62100, status:'expired' },
  { id:'WE003', vin:'LBV5A2B10P0009012', model:'BYD Han',     plate:'จฉ-9012', owner:'วิชัย ดีมาก',  phone:'076-555-6666', sale:'2024-01-15', warrantyEnd:'2027-01-15', kmWarranty:100000, kmCurrent:41200, status:'active' },
  { id:'WE004', vin:'LBV5A2B10P0003456', model:'MG ZS EV',    plate:'ชซ-3456', owner:'มาลี รุ่งเรือง',phone:'095-777-8888', sale:'2025-01-20', warrantyEnd:'2028-01-20', kmWarranty:100000, kmCurrent:8900,  status:'active' },
  { id:'WE005', vin:'LBV5A2B10P0007890', model:'BYD Dolphin', plate:'ฌญ-7890', owner:'อรุณ วิชิต',   phone:'081-999-0000', sale:'2023-09-05', warrantyEnd:'2026-07-14', kmWarranty:100000, kmCurrent:58300, status:'expiring' },
  { id:'WE006', vin:'LBV5A2B10P0002345', model:'BYD Atto 3',  plate:'ฎฏ-2345', owner:'สุดา ภักดี',   phone:'089-111-3333', sale:'2023-12-01', warrantyEnd:'2026-08-01', kmWarranty:100000, kmCurrent:51000, status:'expiring' },
]

function daysLeft(endDate) {
  return Math.round((new Date(endDate) - new Date(TODAY)) / 86400000)
}

function statusBadge(s, d) {
  if (s === 'expired')  return { label:'หมดแล้ว',    bg:'var(--danger)',  fg:'#fff' }
  if (d <= 60)          return { label:`เหลือ ${d}ว`, bg:'var(--warning)', fg:'#fff' }
  return { label:'ปกติ', bg:'var(--success)', fg:'#fff' }
}

export default async function WarrantyExpiryPage(container) {
  let filter = 'all'
  let search = ''

  function render() {
    let rows = VEHICLES
    if (filter === 'expired')  rows = rows.filter(v => v.status === 'expired')
    if (filter === 'expiring') rows = rows.filter(v => v.status === 'expiring')
    if (filter === 'active')   rows = rows.filter(v => v.status === 'active')
    if (search) rows = rows.filter(v => v.owner.includes(search) || v.model.includes(search) || v.plate.includes(search))

    const expired  = VEHICLES.filter(v => v.status === 'expired').length
    const expiring = VEHICLES.filter(v => v.status === 'expiring').length
    const active   = VEHICLES.filter(v => v.status === 'active').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛡 Warranty Expiry Tracker</div>
            <div class="page-subtitle">ติดตามประกันหมดอายุ · แจ้งลูกค้าล่วงหน้า · ${VEHICLES.length} คัน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="notify-all-btn">📨 แจ้งเตือนทั้งหมด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🚗 ทั้งหมด', VEHICLES.length+' คัน', 'var(--primary)')}
          ${sc('✅ ปกติ', active+' คัน', 'var(--success)')}
          ${sc('⚠️ ใกล้หมด', expiring+' คัน', 'var(--warning)')}
          ${sc('❌ หมดแล้ว', expired+' คัน', 'var(--danger)')}
        </div>

        <!-- Filter + search -->
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          ${['all','active','expiring','expired'].map(f=>`
            <button class="btn btn-xs ${filter===f?'btn-primary':'btn-secondary'} fil-btn" data-f="${f}">
              ${f==='all'?'ทั้งหมด':f==='active'?'✅ ปกติ':f==='expiring'?'⚠️ ใกล้หมด':'❌ หมดแล้ว'}
            </button>`).join('')}
          <input class="input" id="search-box" placeholder="ค้นหาชื่อ / รุ่น / ทะเบียน..." value="${search}" style="flex:1;min-width:200px">
        </div>

        <!-- Table -->
        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:860px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
              <th style="padding:10px 12px;text-align:left">รถ / ทะเบียน</th>
              <th>เจ้าของ</th>
              <th style="text-align:center">วันหมดประกัน</th>
              <th style="text-align:center">เหลือ (วัน)</th>
              <th style="text-align:right">KM ปัจจุบัน</th>
              <th style="text-align:center">สถานะ</th>
              <th style="text-align:center">Action</th>
            </tr></thead>
            <tbody>
              ${rows.map(v => {
                const d = daysLeft(v.warrantyEnd)
                const badge = statusBadge(v.status, d)
                const kmPct = Math.min(Math.round(v.kmCurrent / v.kmWarranty * 100), 100)
                return `<tr class="warranty-row" data-id="${v.id}" style="border-bottom:1px solid var(--border);font-size:0.78rem;cursor:pointer">
                  <td style="padding:9px 12px">
                    <div style="font-weight:700">${v.model}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${v.plate} · ${v.vin.slice(-8)}</div>
                  </td>
                  <td>
                    <div style="font-weight:600">${v.owner}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${v.phone}</div>
                  </td>
                  <td style="text-align:center">${formatDate(v.warrantyEnd)}</td>
                  <td style="text-align:center;font-weight:700;color:${d<=0?'var(--danger)':d<=60?'var(--warning)':'var(--success)'}">
                    ${d <= 0 ? 'หมดแล้ว' : d+' วัน'}
                  </td>
                  <td style="text-align:right">
                    <div>${v.kmCurrent.toLocaleString()} km</div>
                    <div style="height:4px;background:var(--surface-2);border-radius:2px;margin-top:3px;width:80px;margin-left:auto">
                      <div style="height:100%;width:${kmPct}%;background:${kmPct>=90?'var(--danger)':kmPct>=70?'var(--warning)':'var(--primary)'};border-radius:2px"></div>
                    </div>
                  </td>
                  <td style="text-align:center">
                    <span style="font-size:0.62rem;background:${badge.bg};color:${badge.fg};padding:2px 8px;border-radius:10px">${badge.label}</span>
                  </td>
                  <td style="text-align:center">
                    ${v.notified ? `<span style="font-size:0.66rem;color:var(--success)">✅ แจ้งแล้ว</span>` : `<button class="btn btn-xs btn-secondary notify-btn" data-id="${v.id}" style="font-size:0.68rem">📱 แจ้ง</button>`}
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
          ${rows.length===0?'<div style="padding:30px;text-align:center;color:var(--text-muted)">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.fil-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    document.getElementById('search-box')?.addEventListener('input', e => { search = e.target.value; render() })
    document.getElementById('notify-all-btn')?.addEventListener('click', () => {
      const targets = VEHICLES.filter(v => v.status === 'expiring' || v.status === 'expired')
      targets.forEach(v => { v.notified = true })
      render()
      showToast(`📨 ส่ง SMS แจ้งเตือนประกัน ${targets.length} คันแล้ว`, 'success')
    })
    container.querySelectorAll('.notify-btn').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation()
      const v = VEHICLES.find(x => x.id === b.dataset.id)
      if (v) { v.notified = true; render(); showToast(`📱 ส่ง SMS ให้ ${v.owner} แจ้งประกัน ${v.model} แล้ว`, 'success') }
    }))
    container.querySelectorAll('.warranty-row').forEach(tr => tr.addEventListener('click', () => {
      const v = VEHICLES.find(x => x.id === tr.dataset.id)
      if (v) openDetailModal(v)
    }))
  }

  function openDetailModal(v) {
    const d = daysLeft(v.warrantyEnd)
    openModal({
      title:`🛡 ประกัน — ${v.model}`,
      size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        ${row('รถ', v.model+' · '+v.plate)}
        ${row('เจ้าของ', v.owner+' · '+v.phone)}
        ${row('VIN', v.vin)}
        ${row('ซื้อวันที่', formatDate(v.sale))}
        ${row('ประกันหมด', formatDate(v.warrantyEnd))}
        ${row('เหลือ', d<=0?'<span style="color:var(--danger)">หมดแล้ว</span>':'<b>'+d+' วัน</b>')}
        ${row('KM ปัจจุบัน', v.kmCurrent.toLocaleString()+' / '+v.kmWarranty.toLocaleString())}
        <hr style="border-color:var(--border)">
        <div style="font-size:0.72rem;color:var(--text-muted)">ต่อประกันเพิ่ม / Extended Warranty</div>
        <select class="input" id="warranty-ext" style="width:100%">
          <option value="1">1 ปี (+฿15,000)</option>
          <option value="2">2 ปี (+฿25,000)</option>
          <option value="3">3 ปี (+฿35,000)</option>
        </select>
      </div>`,
      confirmText:'📋 บันทึกต่อประกัน',
      onConfirm() {
        const ext = parseInt(document.getElementById('warranty-ext')?.value) || 1
        const cur = new Date(v.warrantyEnd)
        cur.setFullYear(cur.getFullYear() + ext)
        v.warrantyEnd = cur.toISOString().slice(0, 10)
        v.status = 'active'
        render()
        showToast(`✅ ต่อประกัน ${v.model} +${ext} ปี — หมดอายุใหม่ ${v.warrantyEnd}`, 'success')
      }
    })
  }

  function row(k, v) {
    return `<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted);width:120px;flex-shrink:0">${k}</span><span>${v}</span></div>`
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.3rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
