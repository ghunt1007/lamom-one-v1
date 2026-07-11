/**
 * Fleet GPS Tracker — ติดตาม GPS รถ Fleet แบบ Real-time
 * Route: /b2b/fleet-gps
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS_MAP = {
  moving:   { label:'กำลังขับ', color:'var(--success)', icon:'🚗' },
  parked:   { label:'จอดอยู่',  color:'var(--text-muted)', icon:'🅿️' },
  idle:     { label:'รอผู้ขับ', color:'var(--warning)', icon:'⏸' },
  charging: { label:'กำลังชาร์จ',color:'var(--primary)', icon:'⚡' },
}

export default async function FleetGpsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let FLEET = []
  let loading = true
  let selectedId = null
  let filterStatus = 'all'
  let alerts = { soc: '20%', speed: '120 km/h', geofence: '10 km', idle: '2 ชม' }
  let alertsDocId = null

  async function loadData() {
    loading = true
    try { FLEET = await listDocs('fleet_vehicles', [], 'plate', 'asc', 100) } catch (e) { FLEET = [] }
    try {
      const alertDocs = await listDocs('fleet_alerts', [], 'createdAt', 'desc', 1)
      if (alertDocs.length) {
        alertsDocId = alertDocs[0].id
        alerts = {
          soc: alertDocs[0].soc || alerts.soc,
          speed: alertDocs[0].speed || alerts.speed,
          geofence: alertDocs[0].geofence || alerts.geofence,
          idle: alertDocs[0].idle || alerts.idle,
        }
      }
    } catch (e) {}
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const rows = filterStatus==='all' ? FLEET : FLEET.filter(f=>f.status===filterStatus)
    const moving = FLEET.filter(f=>f.status==='moving').length
    const sel = selectedId ? FLEET.find(f=>f.id===selectedId) : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛰 Fleet GPS Tracker</div>
            <div class="page-subtitle">ติดตามรถ ${FLEET.length} คัน แบบ Real-time · ${moving} คันกำลังขับ</div>
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
              <div style="background:linear-gradient(135deg,var(--surface-2) 0%,var(--surface) 100%);aspect-ratio:16/9;position:relative;display:flex;align-items:center;justify-content:center;min-width:0">
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
            ${[['📍 ตำแหน่ง',escHtml(sel.location)],['🚀 ความเร็ว',sel.speed+'km/h'],['🔋 SOC',sel.soc+'%'],['📏 ไมล์',(sel.odometer||0).toLocaleString()+' km'],['🎯 ภารกิจ',escHtml(sel.trip)]].map(([k,v])=>`
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
        async onConfirm() {
          const soc      = document.getElementById('al-soc')?.value.trim()   || alerts.soc
          const speed    = document.getElementById('al-speed')?.value.trim() || alerts.speed
          const geofence = document.getElementById('al-geo')?.value.trim()   || alerts.geofence
          const idle     = document.getElementById('al-idle')?.value.trim()  || alerts.idle
          try {
            if (alertsDocId) {
              await updateDocData('fleet_alerts', alertsDocId, { soc, speed, geofence, idle })
            } else {
              alertsDocId = await createDoc('fleet_alerts', { soc, speed, geofence, idle })
            }
            alerts = { soc, speed, geofence, idle }
            showToast(`🔔 บันทึก Alert GPS แล้ว · SOC<${soc} · >${speed} · >${geofence}`, 'success')
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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

  await loadData()
}
