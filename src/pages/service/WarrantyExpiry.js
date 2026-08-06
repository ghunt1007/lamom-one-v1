/**
 * Warranty Expiry Tracker — ติดตามวันหมดประกันรายคัน
 * Route: /service/warranty-expiry
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, seedDemoData } from '../../core/db.js'
import { loadWarranties, persistWarranty } from './WarrantyManagement.js'

function daysLeft(endDate) {
  return Math.round((new Date(endDate) - new Date()) / 86400000)
}

// เดิมหน้านี้อ่าน collection 'warranty_expiry_vehicles' ของตัวเองแยกจาก WarrantyManagement.js โดยสิ้นเชิง —
// เป็นข้อมูล seed ตายตัว ไม่มีจุดไหนเขียนจริงเข้า collection นี้เลย (ไม่ sync กับใบจองที่ส่งมอบจริง/ประกันที่
// สร้าง-แก้ไขจริงในหน้า WarrantyManagement.js) ทำให้สองหน้าเห็นข้อมูลประกันคนละชุดกัน — แก้ให้ดึงจากฟังก์ชัน
// กลาง loadWarranties()/persistWarranty() ที่ WarrantyManagement.js export ไว้ (v1.0.359) แทน เป็นแหล่งข้อมูล
// จริงชุดเดียวกันทั้งสองหน้า (mapWarranty() ด้านล่างแปลง field name ให้ตรงกับ template เดิมของไฟล์นี้)
function mapWarranty(w, kmByVin) {
  return {
    id: w.id, vin: w.vin || '', plate: w.vehiclePlate || '-', model: [w.brand, w.model].filter(Boolean).join(' ') || '-',
    owner: w.customerName || '-', phone: w.phone || '', warrantyEnd: w.endDate || '', sale: w.startDate || '',
    kmCurrent: kmByVin[w.vin] || 0, kmWarranty: w.km || 100000, status: w.status || 'active', notified: !!w.notified,
    _raw: w,
  }
}

// ไม่มีฟิลด์ "เลขไมล์ปัจจุบัน" เก็บไว้ที่ประกันเลย (WarrantyManagement.js ไม่ track odometer) — ดึงเลขไมล์ล่าสุด
// จริงจาก job_cards (บันทึกทุกครั้งที่รถเข้าศูนย์บริการ มีฟิลด์ mileage ต่อ VIN จริงอยู่แล้ว) แทนการโชว์เลขปลอม
async function loadLatestMileageByVin() {
  let jobs = []
  try { jobs = await listDocs('job_cards', [], 'createdAt', 'desc', 1000) } catch { jobs = [] }
  const byVin = {}
  jobs.forEach(j => { if (j.vin && !(j.vin in byVin)) byVin[j.vin] = j.mileage || 0 }) // เรียง desc แล้ว — ตัวแรกต่อ VIN คือล่าสุด
  return byVin
}

// เดิมหน้านี้ใช้ v.status ที่บันทึกไว้ครั้งเดียวตอนสร้าง/แก้ไขข้อมูล ไม่ถูกคำนวณสดจากวันที่เลย ต่างจาก
// WarrantyManagement.js's getWarrantyStatus() ที่คำนวณสดจากวันหมดอายุทุกครั้งที่ render — ทำให้ตัวเลข
// active/expiring/expired ในหน้านี้ค้างผิดไปเรื่อยๆถ้าไม่มีใครมาแก้ record ทัน แก้ให้คำนวณสดแบบเดียวกัน
// (เก็บสถานะที่ไม่ได้ขึ้นกับวันที่ เช่น 'claimed'/'void' ไว้ก่อนเสมอถ้ามี เหมือน WarrantyManagement.js)
function getLiveStatus(v) {
  if (v.status === 'claimed' || v.status === 'void') return v.status
  const d = daysLeft(v.warrantyEnd)
  if (d <= 0) return 'expired'
  if (d <= 60) return 'expiring'
  return 'active'
}

function statusBadge(s, d) {
  if (s === 'expired')  return { label:'หมดแล้ว',    bg:'var(--danger)',  fg:'#fff' }
  if (d <= 60)          return { label:`เหลือ ${d}ว`, bg:'var(--warning)', fg:'#fff' }
  return { label:'ปกติ', bg:'var(--success)', fg:'#fff' }
}

export default async function WarrantyExpiryPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let filter = 'all'
  let search = ''
  let VEHICLES = []
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [warranties, kmByVin] = await Promise.all([loadWarranties(), loadLatestMileageByVin()])
      VEHICLES = warranties.map(w => mapWarranty(w, kmByVin)).filter(v => v.warrantyEnd).sort((a, b) => a.warrantyEnd.localeCompare(b.warrantyEnd))
    } catch (e) { VEHICLES = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    let rows = VEHICLES
    if (filter === 'expired')  rows = rows.filter(v => getLiveStatus(v) === 'expired')
    if (filter === 'expiring') rows = rows.filter(v => getLiveStatus(v) === 'expiring')
    if (filter === 'active')   rows = rows.filter(v => getLiveStatus(v) === 'active')
    if (search) rows = rows.filter(v => (v.owner||'').includes(search) || (v.model||'').includes(search) || (v.plate||'').includes(search))

    const expired  = VEHICLES.filter(v => getLiveStatus(v) === 'expired').length
    const expiring = VEHICLES.filter(v => getLiveStatus(v) === 'expiring').length
    const active   = VEHICLES.filter(v => getLiveStatus(v) === 'active').length

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
                const badge = statusBadge(getLiveStatus(v), d)
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
    document.getElementById('notify-all-btn')?.addEventListener('click', async () => {
      const targets = VEHICLES.filter(v => getLiveStatus(v) === 'expiring' || getLiveStatus(v) === 'expired')
      try {
        await Promise.all(targets.map(v => persistWarranty(v._raw, { notified: true })))
        showToast(`📨 แจ้งเตือนประกัน ${targets.length} คันแล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    container.querySelectorAll('.notify-btn').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation()
      const v = VEHICLES.find(x => x.id === b.dataset.id)
      if (!v) return
      try {
        await persistWarranty(v._raw, { notified: true })
        showToast(`📱 แจ้ง ${v.owner} เรื่องประกัน ${v.model} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
      async onConfirm() {
        const ext = parseInt(document.getElementById('warranty-ext')?.value) || 1
        const cur = new Date(v.warrantyEnd)
        cur.setFullYear(cur.getFullYear() + ext)
        const warrantyEnd = cur.toISOString().slice(0, 10)
        try {
          await persistWarranty(v._raw, { endDate: warrantyEnd, status: 'active' })
          showToast(`✅ ต่อประกัน ${v.model} +${ext} ปี — หมดอายุใหม่ ${warrantyEnd}`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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

  await loadData()
}
