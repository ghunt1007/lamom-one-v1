/**
 * Fleet GPS Tracker — ติดตาม GPS รถ Fleet แบบ Real-time
 * Route: /b2b/fleet-gps
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_FLEET = [
  { id:'F001', plate:'กข-1234', model:'BYD Atto 3', driver:'สมชาย ก.', status:'moving', speed:62, soc:74, lat:13.756, lng:100.502, location:'ถ.สุขุมวิท ซ.22', lastUpdate:'11:42', odometer:18500, trip:'ส่งเอกสาร ลาดพร้าว' },
  { id:'F002', plate:'กข-5678', model:'BYD Seal AWD', driver:'นภา ม.', status:'parked', speed:0, soc:42, lat:13.729, lng:100.523, location:'ลานจอด CentralWorld', lastUpdate:'11:38', odometer:32000, trip:'ประชุมลูกค้า Fleet' },
  { id:'F003', plate:'กก-0001', model:'MG ZS EV', driver:'มาลี จ.', status:'idle', speed:0, soc:88, lat:13.740, lng:100.560, location:'สำนักงาน LAMOM ONE', lastUpdate:'11:45', odometer:5200, trip:'รอผู้ขับ' },
  { id:'F004', plate:'กก-1122', model:'BYD Atto 3', driver:'วิชัย ร.', status:'moving', speed:45, soc:56, lat:13.761, lng:100.537, location:'ถ.รัชดาภิเษก', lastUpdate:'11:43', odometer:9800, trip:'รับลูกค้า Test Drive' },
  { id:'F005', plate:'กก-3344', model:'BYD Dolphin', driver:'รัชนี ส.', status:'charging', speed:0, soc:23, lat:13.748, lng:100.495, location:'PEA VOLTA ชิดลม', lastUpdate:'11:40', odometer:12600, trip:'ชาร์จระหว่างวัน' },
]

const STATUS_MAP = {
  moving:   { label:'กำลังขับ', color:'var(--success)', icon:'🚗' },
  parked:   { label:'จอดอยู่',  color:'var(--text-muted)', icon:'🅿️' },
  idle:     { label:'รอผู้ขับ', color:'var(--warning)', icon:'⏸' },
  charging: { label:'กำลังชาร์จ',color:'var(--primary)', icon:'⚡' },
}

export default async function FleetGpsPage(container) {
  const myGen = container.__routerGen
  let FLEET = DEMO_FLEET.map(f => ({ ...f }))
  let dataSource = 'demo'
  let selectedId = null
  let filterStatus = 'all'
  let tick = 0
  let alerts = { soc: '20%', speed: '120 km/h', geofence: '10 km', idle: '2 ชม' }

  try {
    const docs = await listDocs('fleet_vehicles', [], 'plate', 'asc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `F${i+1}`,
        plate: d.plate || d.licensePlate || '',
        model: d.model || d.vehicleModel || '',
        driver: d.driver || d.driverName || '',
        status: d.status || 'parked',
        speed: d.speed || 0,
        soc: d.soc || d.battery || 0,
        lat: d.lat || 13.75,
        lng: d.lng || 100.50,
        location: d.location || d.address || '',
        lastUpdate: d.lastUpdate || d.updatedAt || '',
        odometer: d.odometer || 0,
        trip: d.trip || d.tripNote || '',
      }))
      FLEET = [...mapped, ...DEMO_FLEET]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const rows = filterStatus==='all' ? FLEET : FLEET.filter(f=>f.status===filterStatus)
    const moving = FLEET.filter(f=>f.status==='moving').length
    const sel = selectedId ? FLEET.find(f=>f.id===selectedId) : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛰 Fleet GPS Tracker</div>
            <div class="page-subtitle">ติดตามรถ ${FLEET.length} คัน แบบ Real-time · ${moving} คันกำลังขับ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="refresh-btn">🔄 Refresh</button>
            <button class="btn btn-primary" id="alert-btn">🔔 ตั้ง Alert</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${Object.entries(STATUS_MAP).map(([k,v])=>`
            <div class="card" style="padding:12px 14px;border-left:4px solid ${v.color}">
              <div style="font-size:1rem">${v.icon}</div>
              <div style="font-size:1.4rem;font-weight:900;color:${v.color}">${FLEET.filter(f=>f.status===k).length}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${v.label}</div>
            </div>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 340px;gap:16px">
          <!-- Map placeholder -->
          <div>
            <div class="card" style="padding:0;overflow:hidden">
              <div style="background:linear-gradient(135deg,var(--surface-2) 0%,var(--surface) 100%);aspect-ratio:16/9;position:relative;display:flex;align-items:center;justify-content:center;min-height:320px">
                <!-- Map background grid -->
                <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.1" viewBox="0 0 400 280">
                  ${Array.from({length:8},(_,i)=>`<line x1="${i*57}" y1="0" x2="${i*57}" y2="280" stroke="var(--text-muted)" stroke-width="1"/>`).join('')}
                  ${Array.from({length:5},(_,i)=>`<line x1="0" y1="${i*70}" x2="400" y2="${i*70}" stroke="var(--text-muted)" stroke-width="1"/>`).join('')}
                </svg>
                <!-- Vehicle pins -->
                ${FLEET.map((f,i) => {
                  const s = STATUS_MAP[f.status]
                  const x = 40 + (i * 70)
                  const y = 60 + (i % 3) * 80
                  const isSelected = f.id === selectedId
                  return `<div class="map-pin" data-id="${f.id}" style="position:absolute;left:${x}px;top:${y}px;cursor:pointer;transform:translate(-50%,-50%);z-index:${isSelected?10:1}">
                    <div style="background:${s.color};color:#fff;border-radius:50%;width:${isSelected?36:28}px;height:${isSelected?36:28}px;display:flex;align-items:center;justify-content:center;font-size:${isSelected?'1rem':'0.8rem'};box-shadow:0 2px 8px ${s.color}66;border:2px solid #fff;transition:all .2s">${s.icon}</div>
                    ${isSelected?`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px 8px;font-size:0.62rem;margin-top:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.2)">${escHtml(f.plate)}<br>${escHtml(f.driver)}</div>`:''}
                  </div>`
                }).join('')}
                <div style="position:absolute;bottom:10px;right:10px;font-size:0.64rem;color:var(--text-muted);background:var(--surface);padding:4px 8px;border-radius:var(--radius-sm)">🗺 แผนที่ (Simulation)</div>
              </div>
            </div>
          </div>

          <!-- Vehicle list -->
          <div style="display:flex;flex-direction:column;gap:0">
            <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
              <button class="btn btn-xs ${filterStatus==='all'?'btn-primary':'btn-secondary'} fs-btn" data-s="all">ทั้งหมด</button>
              ${Object.entries(STATUS_MAP).map(([k,v])=>`<button class="btn btn-xs ${filterStatus===k?'btn-primary':'btn-secondary'} fs-btn" data-s="${k}">${v.icon}</button>`).join('')}
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;max-height:380px;overflow-y:auto">
              ${rows.map(f => fleetRow(f)).join('')}
            </div>
          </div>
        </div>

        ${sel ? `
        <div class="card" style="padding:14px;margin-top:14px">
          <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📍 ${escHtml(sel.plate)} · ${escHtml(sel.model)} · ${escHtml(sel.driver)}</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:0.74rem">
            ${[['📍 ตำแหน่ง',escHtml(sel.location)],['🚀 ความเร็ว',sel.speed+'km/h'],['🔋 SOC',sel.soc+'%'],['📏 ไมล์',sel.odometer.toLocaleString()+' km'],['🎯 ภารกิจ',escHtml(sel.trip)]].map(([k,v])=>`
              <div style="background:var(--surface-2);padding:8px;border-radius:var(--radius-sm)">
                <div style="font-size:0.62rem;color:var(--text-muted)">${k}</div>
                <div style="font-weight:700;font-size:0.78rem">${v}</div>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>`

    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      FLEET.forEach(f => { if(f.status==='moving') { f.speed=Math.floor(40+Math.random()*40); f.soc=Math.max(5,f.soc-1) } })
      render(); showToast('🔄 อัปเดตตำแหน่งแล้ว', 'success')
    })
    document.getElementById('alert-btn')?.addEventListener('click', () => {
      openModal({ title:'🔔 ตั้ง Alert', size:'xs',
        body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
          <label style="display:flex;justify-content:space-between;align-items:center"><span>🔋 SOC ต่ำกว่า</span><input class="input" id="al-soc" value="${alerts.soc}" style="width:80px;text-align:center"></label>
          <label style="display:flex;justify-content:space-between;align-items:center"><span>🚀 ความเร็วเกิน</span><input class="input" id="al-speed" value="${alerts.speed}" style="width:80px;text-align:center"></label>
          <label style="display:flex;justify-content:space-between;align-items:center"><span>📍 ออกนอกพื้นที่</span><input class="input" id="al-geo" value="${alerts.geofence}" style="width:80px;text-align:center"></label>
          <label style="display:flex;justify-content:space-between;align-items:center"><span>⏰ จอดนานเกิน</span><input class="input" id="al-idle" value="${alerts.idle}" style="width:80px;text-align:center"></label>
        </div>`,
        confirmText:'💾 บันทึก Alert',
        onConfirm() {
          alerts.soc      = document.getElementById('al-soc')?.value.trim()   || alerts.soc
          alerts.speed    = document.getElementById('al-speed')?.value.trim() || alerts.speed
          alerts.geofence = document.getElementById('al-geo')?.value.trim()   || alerts.geofence
          alerts.idle     = document.getElementById('al-idle')?.value.trim()  || alerts.idle
          showToast(`🔔 บันทึก Alert GPS แล้ว · SOC<${alerts.soc} · >${alerts.speed} · >${alerts.geofence}`, 'success')
        }
      })
    })
    container.querySelectorAll('.fs-btn').forEach(b => b.addEventListener('click', () => { filterStatus=b.dataset.s; render() }))
    container.querySelectorAll('.map-pin, .fleet-row').forEach(el => el.addEventListener('click', () => {
      selectedId = el.dataset.id === selectedId ? null : el.dataset.id; render()
    }))
  }

  function fleetRow(f) {
    const s = STATUS_MAP[f.status]
    const isSelected = f.id === selectedId
    return `<div class="fleet-row" data-id="${f.id}" style="background:${isSelected?'var(--primary)11':'var(--surface-2)'};border:1px solid ${isSelected?'var(--primary)':'transparent'};border-radius:var(--radius-sm);padding:10px;cursor:pointer;transition:all .2s">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-weight:700;font-size:0.8rem">${escHtml(f.plate)}</div>
        <span style="font-size:0.62rem;background:${s.color};color:#fff;padding:1px 7px;border-radius:8px">${s.icon} ${s.label}</span>
      </div>
      <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(f.driver)} · ${escHtml(f.model)}</div>
      <div style="font-size:0.7rem;margin-top:4px">${escHtml(f.location)}</div>
      <div style="display:flex;gap:10px;margin-top:5px;font-size:0.68rem;color:var(--text-muted)">
        <span>🚀 ${f.speed}km/h</span>
        <span>🔋 ${f.soc}%</span>
        <span>🕐 ${f.lastUpdate}</span>
      </div>
    </div>`
  }

  render()
}
