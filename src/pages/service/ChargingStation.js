/**
 * Charging Station — สถานีชาร์จ EV
 * Route: /service/charging
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const CHARGER_STATUS = {
  available: { label: 'ว่าง', color: 'success', icon: '🟢' },
  in_use:    { label: 'กำลังชาร์จ', color: 'warning', icon: '⚡' },
  reserved:  { label: 'จองแล้ว', color: 'primary', icon: '🔵' },
  offline:   { label: 'ออฟไลน์', color: 'danger', icon: '🔴' },
  maintenance: { label: 'ซ่อมบำรุง', color: 'secondary', icon: '🔧' },
}

const CHARGER_TYPES = {
  ac_7:   { label: 'AC 7 kW', color: 'secondary' },
  ac_22:  { label: 'AC 22 kW', color: 'primary' },
  dc_50:  { label: 'DC 50 kW', color: 'warning' },
  dc_150: { label: 'DC 150 kW', color: 'success' },
}

function addMins(n) { const d = new Date(); d.setMinutes(d.getMinutes() + n); return d.toISOString() }
function subMins(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const DEMO_CHARGERS = [
  { id: 'CS01', name: 'Charger A1', type: 'dc_150', status: 'in_use', power: 150, soc: 62, vehicle: 'BYD Seal AWD · 1กข-1234', startTime: subMins(45), estFinish: addMins(25), energy: 28.5 },
  { id: 'CS02', name: 'Charger A2', type: 'dc_150', status: 'available', power: 150, soc: 0, vehicle: null, startTime: null, estFinish: null, energy: 0 },
  { id: 'CS03', name: 'Charger B1', type: 'dc_50', status: 'reserved', power: 50, soc: 0, vehicle: 'BYD Atto 3 · 2ขค-5678', startTime: null, estFinish: addMins(15), energy: 0 },
  { id: 'CS04', name: 'Charger B2', type: 'dc_50', status: 'in_use', power: 50, soc: 78, vehicle: 'MG ZS EV · 3คง-9012', startTime: subMins(80), estFinish: addMins(10), energy: 42.1 },
  { id: 'CS05', name: 'Charger C1', type: 'ac_22', status: 'available', power: 22, soc: 0, vehicle: null, startTime: null, estFinish: null, energy: 0 },
  { id: 'CS06', name: 'Charger C2', type: 'ac_22', status: 'offline', power: 22, soc: 0, vehicle: null, startTime: null, estFinish: null, energy: 0 },
  { id: 'CS07', name: 'Charger D1', type: 'ac_7', status: 'maintenance', power: 7, soc: 0, vehicle: null, startTime: null, estFinish: null, energy: 0 },
  { id: 'CS08', name: 'Charger D2', type: 'ac_7', status: 'available', power: 7, soc: 0, vehicle: null, startTime: null, estFinish: null, energy: 0 },
]

const SESSION_HISTORY = [
  { charger: 'CS01', vehicle: 'BYD Dolphin', duration: 62, energy: 35.2, cost: 176, date: subMins(120) },
  { charger: 'CS04', vehicle: 'Tesla Model 3', duration: 95, energy: 48.5, cost: 242.5, date: subMins(200) },
  { charger: 'CS02', vehicle: 'BYD Seal AWD', duration: 38, energy: 25.0, cost: 125, date: subMins(300) },
]

export default async function ChargingStationPage(container) {
  let chargers = DEMO_CHARGERS.map(c => ({ ...c }))

  function renderPage() {
    const available = chargers.filter(c => c.status === 'available').length
    const inUse = chargers.filter(c => c.status === 'in_use').length
    const offline = chargers.filter(c => ['offline','maintenance'].includes(c.status)).length
    const totalEnergy = SESSION_HISTORY.reduce((a, s) => a + s.energy, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ Charging Station</div>
            <div class="page-subtitle">สถานีชาร์จ EV — ติดตามสถานะ Real-time</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="start-session-btn">⚡ เริ่มชาร์จ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔌 ทั้งหมด', chargers.length + ' หัว', 'primary')}
          ${kpi('🟢 ว่าง', available + ' หัว', 'success')}
          ${kpi('⚡ กำลังชาร์จ', inUse + ' หัว', 'warning')}
          ${kpi('⚡ พลังงานวันนี้', totalEnergy.toFixed(1) + ' kWh', 'primary')}
        </div>

        <!-- Charger Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-bottom:16px">
          ${chargers.map(c => {
            const st = CHARGER_STATUS[c.status]
            const ct = CHARGER_TYPES[c.type]
            const isCharging = c.status === 'in_use'
            return `<div class="card" style="padding:14px;border-left:4px solid var(--${st?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                <div>
                  <div style="font-size:1.4rem">${st?.icon}</div>
                  <div style="font-weight:700;font-size:0.9rem">${c.name}</div>
                  <span class="badge badge-${ct?.color}" style="font-size:0.6rem">${ct?.label}</span>
                </div>
                <span class="badge badge-${st?.color}" style="font-size:0.65rem">${st?.label}</span>
              </div>

              ${isCharging ? `
                <div style="margin-bottom:10px">
                  <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">🚗 ${c.vehicle}</div>
                  <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
                    <span>SOC: ${c.soc}%</span>
                    <span>${c.energy} kWh</span>
                  </div>
                  <div style="background:var(--surface-2);border-radius:4px;height:8px">
                    <div style="width:${c.soc}%;background:var(--success);height:8px;border-radius:4px"></div>
                  </div>
                  <div style="font-size:0.68rem;color:var(--text-muted);margin-top:4px">⏱ เสร็จ ~${timeAgo(c.estFinish)}</div>
                </div>
              ` : c.status === 'reserved' ? `
                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">🚗 ${c.vehicle}<br>🕐 ETA ${timeAgo(c.estFinish)}</div>
              ` : `<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">${c.power} kW</div>`}

              <div style="display:flex;gap:4px">
                ${c.status === 'available' ? `<button class="btn btn-xs btn-success start-btn" data-id="${c.id}" style="flex:1">⚡ เริ่มชาร์จ</button>` : ''}
                ${c.status === 'in_use' ? `<button class="btn btn-xs btn-danger stop-btn" data-id="${c.id}" style="flex:1">⏹ หยุด</button>` : ''}
                ${c.status === 'offline' ? `<button class="btn btn-xs btn-primary restart-btn" data-id="${c.id}" style="flex:1">🔄 Restart</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>

        <!-- Session History -->
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📋 ประวัติเซสชั่นล่าสุด</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">หัวชาร์จ</th>
                <th style="padding:8px 14px;text-align:left">รถ</th>
                <th style="padding:8px 10px;text-align:right">เวลา</th>
                <th style="padding:8px 10px;text-align:right">พลังงาน</th>
                <th style="padding:8px 14px;text-align:right">ค่าบริการ</th>
                <th style="padding:8px 14px;text-align:right">เมื่อ</th>
              </tr>
            </thead>
            <tbody>
              ${SESSION_HISTORY.map(s => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.82rem">
                  <td style="padding:8px 14px">${s.charger}</td>
                  <td style="padding:8px 14px">🚗 ${s.vehicle}</td>
                  <td style="padding:8px 10px;text-align:right">${s.duration} นาที</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--warning)">${s.energy} kWh</td>
                  <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--success)">฿${s.cost.toFixed(2)}</td>
                  <td style="padding:8px 14px;text-align:right;color:var(--text-muted)">${timeAgo(s.date)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('start-session-btn')?.addEventListener('click', openStartSession)
    container.querySelectorAll('.start-btn').forEach(b => b.addEventListener('click', () => {
      const c = chargers.find(x => x.id === b.dataset.id)
      if (c) openStartSessionFor(c)
    }))
    container.querySelectorAll('.stop-btn').forEach(b => b.addEventListener('click', () => {
      const c = chargers.find(x => x.id === b.dataset.id)
      if (c) { c.status = 'available'; c.vehicle = null; c.soc = 0; c.energy = 0; c.startTime = null; c.estFinish = null; showToast(`⏹ หยุดชาร์จ ${c.name} แล้ว`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.restart-btn').forEach(b => b.addEventListener('click', () => {
      const c = chargers.find(x => x.id === b.dataset.id)
      if (c) { c.status = 'available'; showToast(`🔄 Restart ${c.name} สำเร็จ`, 'success'); renderPage() }
    }))
  }

  function openStartSessionFor(charger) {
    openStartSession(charger)
  }

  function openStartSession(charger = null) {
    const availableList = chargers.filter(c => c.status === 'available')
    openModal({
      title: '⚡ เริ่มชาร์จ',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">หัวชาร์จ</label>
            <select class="input" id="cs-charger">${availableList.map(c => {
              const ct = CHARGER_TYPES[c.type]
              return `<option value="${c.id}" ${charger?.id===c.id?'selected':''}>${c.name} — ${ct?.label}</option>`
            }).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ทะเบียนรถ</label><input class="input" id="cs-plate" placeholder="1กข-1234"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">รุ่นรถ</label><input class="input" id="cs-model" value="BYD Seal AWD"></div>
        </div>
      `,
      onConfirm() {
        const cid = document.getElementById('cs-charger')?.value
        const plate = document.getElementById('cs-plate')?.value?.trim()
        const model = document.getElementById('cs-model')?.value?.trim() || 'EV'
        if (!plate) { showToast('❗ กรุณากรอกทะเบียนรถ', 'error'); return }
        const c = chargers.find(x => x.id === cid)
        if (c) {
          c.status = 'in_use'; c.vehicle = `${model} · ${plate}`;
          c.soc = 30; c.energy = 0; c.startTime = new Date().toISOString()
          c.estFinish = addMins(60)
          showToast(`⚡ เริ่มชาร์จ ${c.name} แล้ว!`, 'success'); renderPage()
        }
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
