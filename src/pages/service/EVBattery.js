/**
 * EV Battery Health — ตรวจสอบแบตเตอรี่ EV
 * Route: /service/ev-battery
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

const BATTERY_STATUS = {
  excellent: { label: 'ดีมาก', color: 'success', icon: '🟢', threshold: 90 },
  good:      { label: 'ดี', color: 'primary', icon: '🔵', threshold: 80 },
  fair:      { label: 'พอใช้', color: 'warning', icon: '🟡', threshold: 70 },
  poor:      { label: 'ต้องเฝ้าระวัง', color: 'danger', icon: '🔴', threshold: 0 },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

function getBatteryStatus(soh) {
  if (soh >= 90) return 'excellent'
  if (soh >= 80) return 'good'
  if (soh >= 70) return 'fair'
  return 'poor'
}

export default async function EVBatteryPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let vehicles = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { vehicles = await listDocs('ev_battery_vehicles', [], 'plate', 'asc', 500) } catch (e) { vehicles = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
      async onConfirm() {
        if (!v) { showToast('❗ กรุณาเลือกรถจากรายการ', 'error'); return false }
        const patch = {
          soh: parseInt(document.getElementById('bat-soh')?.value) || v.soh,
          soc: parseInt(document.getElementById('bat-soc')?.value) || v.soc,
          cycles: parseInt(document.getElementById('bat-cycles')?.value) || v.cycles,
          lastCheck: addDays(0),
          nextCheck: addDays(90),
        }
        try {
          await updateDocData('ev_battery_vehicles', v.id, patch)
          showToast('✅ บันทึกผลตรวจแบตเตอรี่แล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function mini(l, v) { return `<div style="background:var(--surface-2);padding:5px 7px;border-radius:var(--radius-sm)"><div style="color:var(--text-muted);font-size:0.65rem">${l}</div><div style="font-weight:700">${v}</div></div>` }
