/**
 * EV Battery Health — ตรวจสอบแบตเตอรี่ EV
 * Route: /service/ev-battery
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const BATTERY_STATUS = {
  excellent: { label: 'ดีมาก', color: 'success', icon: '🟢', threshold: 90 },
  good:      { label: 'ดี', color: 'primary', icon: '🔵', threshold: 80 },
  fair:      { label: 'พอใช้', color: 'warning', icon: '🟡', threshold: 70 },
  poor:      { label: 'ต้องเฝ้าระวัง', color: 'danger', icon: '🔴', threshold: 0 },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const DEMO_VEHICLES = [
  { id: 'V001', plate: '1กข-1234', model: 'BYD Seal AWD', year: 2023, owner: 'สมชาย ใจดี', soh: 94, soc: 78, cycles: 180, capacity: 82.56, originalCapacity: 87.9, lastCheck: addDays(-30), range: 498, nextCheck: addDays(60) },
  { id: 'V002', plate: '2ขค-5678', model: 'BYD Dolphin', year: 2022, owner: 'มาลี สุขใจ', soh: 87, soc: 45, cycles: 340, capacity: 42.0, originalCapacity: 44.9, lastCheck: addDays(-15), range: 310, nextCheck: addDays(75) },
  { id: 'V003', plate: '3คง-9012', model: 'MG ZS EV', year: 2021, owner: 'ธนพล เที่ยงตรง', soh: 74, soc: 62, cycles: 520, capacity: 39.5, originalCapacity: 50.3, lastCheck: addDays(-7), range: 268, nextCheck: addDays(23) },
  { id: 'V004', plate: '4งจ-3456', model: 'BYD Atto 3', year: 2023, owner: 'อรทัย ตั้งใจ', soh: 92, soc: 91, cycles: 90, capacity: 58.7, originalCapacity: 60.5, lastCheck: addDays(-45), range: 412, nextCheck: addDays(15) },
  { id: 'V005', plate: '5จฉ-7890', model: 'BYD Han', year: 2022, owner: 'วิรัช เก่งมาก', soh: 68, soc: 33, cycles: 680, capacity: 64.6, originalCapacity: 85.4, lastCheck: addDays(-90), range: 380, nextCheck: addDays(-15) },
]

function getBatteryStatus(soh) {
  if (soh >= 90) return 'excellent'
  if (soh >= 80) return 'good'
  if (soh >= 70) return 'fair'
  return 'poor'
}

export default async function EVBatteryPage(container) {
  let vehicles = DEMO_VEHICLES.map(v => ({ ...v }))
  let statusFilter = 'all'

  function renderPage() {
    const list = vehicles.filter(v => statusFilter === 'all' || getBatteryStatus(v.soh) === statusFilter)
    const avgSoh = Math.round(vehicles.reduce((a, v) => a + v.soh, 0) / vehicles.length)
    const needAttention = vehicles.filter(v => getBatteryStatus(v.soh) === 'poor' || getBatteryStatus(v.soh) === 'fair').length
    const overdueCheck = vehicles.filter(v => v.nextCheck < addDays(0)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔋 EV Battery Health</div>
            <div class="page-subtitle">ตรวจสอบสุขภาพแบตเตอรี่ — ลูกค้าทั้งหมด</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-check-btn">+ บันทึกตรวจ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔋 SOH เฉลี่ย', avgSoh + '%', avgSoh >= 85 ? 'success' : avgSoh >= 75 ? 'warning' : 'danger')}
          ${kpi('⚠️ ต้องเฝ้าระวัง', needAttention + ' คัน', needAttention > 0 ? 'danger' : 'success')}
          ${kpi('📅 เกินกำหนดตรวจ', overdueCheck + ' คัน', overdueCheck > 0 ? 'danger' : 'secondary')}
          ${kpi('🚗 รถในระบบ', vehicles.length + ' คัน', 'primary')}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} st-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(BATTERY_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} st-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- Vehicle battery list -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
          ${list.map(v => {
            const status = getBatteryStatus(v.soh)
            const bs = BATTERY_STATUS[status]
            const isOverdue = v.nextCheck < addDays(0)
            const degradation = Math.round((1 - v.soh/100) * 100)
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${bs?.color})">
              <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${v.plate}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${v.model} · ${v.year} · ${v.owner}</div>
                </div>
                <span class="badge badge-${bs?.color}" style="font-size:0.62rem">${bs?.icon} ${bs?.label}</span>
              </div>

              <!-- SOH bar -->
              <div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
                  <span style="color:var(--text-muted)">SOH (State of Health)</span>
                  <strong style="color:var(--${bs?.color})">${v.soh}%</strong>
                </div>
                <div style="background:var(--surface-2);border-radius:4px;height:10px">
                  <div style="width:${v.soh}%;background:var(--${bs?.color});height:10px;border-radius:4px"></div>
                </div>
              </div>

              <!-- SOC bar -->
              <div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
                  <span style="color:var(--text-muted)">SOC (ชาร์จปัจจุบัน)</span>
                  <strong>${v.soc}%</strong>
                </div>
                <div style="background:var(--surface-2);border-radius:4px;height:6px">
                  <div style="width:${v.soc}%;background:var(--primary);height:6px;border-radius:4px"></div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.73rem;margin-bottom:10px">
                ${mini('Capacity', v.capacity + '/' + v.originalCapacity + ' kWh')}
                ${mini('Cycles', v.cycles + ' รอบ')}
                ${mini('Range', v.range + ' km')}
                ${mini('ตรวจครั้งหน้า', isOverdue ? '⚠️ เกินกำหนด' : formatDate(v.nextCheck))}
              </div>

              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-primary check-btn" data-id="${v.id}" style="flex:1">🔋 บันทึกผล</button>
                ${isOverdue ? `<button class="btn btn-xs btn-danger sched-btn" data-id="${v.id}">📅 นัด</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.st-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.check-btn').forEach(b => b.addEventListener('click', () => {
      const v = vehicles.find(x => x.id === b.dataset.id); if (v) openCheckModal(v)
    }))
    document.getElementById('add-check-btn')?.addEventListener('click', () => openCheckModal())
  }

  function openCheckModal(v = null) {
    openModal({
      title: '🔋 บันทึกผลตรวจแบตเตอรี่',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        ${v ? `<div style="font-weight:700">${v.plate} — ${v.model}</div>` : ''}
        <div class="input-group"><label class="input-label">SOH (%)</label><input class="input" id="bat-soh" type="number" min="0" max="100" value="${v?.soh||90}"></div>
        <div class="input-group"><label class="input-label">SOC (%)</label><input class="input" id="bat-soc" type="number" min="0" max="100" value="${v?.soc||80}"></div>
        <div class="input-group"><label class="input-label">จำนวนรอบชาร์จ</label><input class="input" id="bat-cycles" type="number" value="${v?.cycles||0}"></div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="bat-note" placeholder="ผลการตรวจ..."></div>
      </div>`,
      onConfirm() {
        if (v) {
          v.soh = parseInt(document.getElementById('bat-soh')?.value) || v.soh
          v.soc = parseInt(document.getElementById('bat-soc')?.value) || v.soc
          v.cycles = parseInt(document.getElementById('bat-cycles')?.value) || v.cycles
          v.lastCheck = addDays(0)
          v.nextCheck = addDays(90)
        }
        showToast('✅ บันทึกผลตรวจแบตเตอรี่แล้ว', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function mini(l, v) { return `<div style="background:var(--surface-2);padding:5px 7px;border-radius:var(--radius-sm)"><div style="color:var(--text-muted);font-size:0.65rem">${l}</div><div style="font-weight:700">${v}</div></div>` }
