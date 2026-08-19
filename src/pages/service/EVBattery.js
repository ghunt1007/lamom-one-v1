/**
 * EV Battery Health — ตรวจสอบแบตเตอรี่ EV
 * Route: /service/ev-battery
 */
import { formatDate, timeAgo, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const BATTERY_STATUS = {
  excellent: { label: 'ดีมาก', color: 'success', icon: '🟢', threshold: 90 },
  good:      { label: 'ดี', color: 'primary', icon: '🔵', threshold: 80 },
  fair:      { label: 'พอใช้', color: 'warning', icon: '🟡', threshold: 70 },
  poor:      { label: 'ต้องเฝ้าระวัง', color: 'danger', icon: '🔴', threshold: 0 },
}

function addDays(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function getBatteryStatus(soh) {
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
    try { vehicles = (await listDocs('ev_battery_vehicles', [], 'plate', 'asc', 500)).filter(v => !v.deleted) } catch (e) { vehicles = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = vehicles.filter(v => statusFilter === 'all' || getBatteryStatus(v.soh) === statusFilter)
    const avgSoh = vehicles.length ? Math.round(vehicles.reduce((a, v) => a + v.soh, 0) / vehicles.length) : 0
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
            <button class="btn btn-secondary" id="add-vehicle-btn">➕ เพิ่มรถ EV</button>
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
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(v.plate)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(v.model)} · ${v.year} · ${escHtml(v.owner)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${bs?.color}" style="font-size:0.62rem">${bs?.icon} ${bs?.label}</span>
                  <button class="btn btn-xs btn-secondary del-vehicle-btn" data-id="${v.id}" title="ลบ" style="color:var(--danger)">🗑</button>
                </div>
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
    container.querySelectorAll('.sched-btn').forEach(b => b.addEventListener('click', () => {
      const v = vehicles.find(x => x.id === b.dataset.id); if (v) openScheduleModal(v)
    }))
    document.getElementById('add-check-btn')?.addEventListener('click', () => openCheckModal())
    document.getElementById('add-vehicle-btn')?.addEventListener('click', () => openAddVehicle())
    container.querySelectorAll('.del-vehicle-btn').forEach(b => b.addEventListener('click', async () => {
      const v = vehicles.find(x => x.id === b.dataset.id)
      if (!v) return
      const ok = await confirmDialog({ title: 'ลบรถ EV', message: `ยืนยันลบรถ "${escHtml(v.plate)} — ${escHtml(v.model)}" ออกจากระบบตรวจแบตเตอรี่หรือไม่?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('ev_battery_vehicles', v.id)
        showToast('🗑 ลบรถแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
  }

  function openAddVehicle() {
    openModal({
      title: '➕ เพิ่มรถ EV เข้าระบบตรวจแบตเตอรี่',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ทะเบียน *</label><input class="input" id="nv-plate" placeholder="1กข-1234"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ *</label><input class="input" id="nv-model" placeholder="BYD Seal"></div>
        <div class="input-group"><label class="input-label">ปี</label><input class="input" type="number" id="nv-year" value="${new Date().getFullYear()+543}"></div>
        <div class="input-group"><label class="input-label">เจ้าของ</label><input class="input" id="nv-owner" placeholder="ชื่อลูกค้า"></div>
        <div class="input-group"><label class="input-label">Capacity เดิม (kWh)</label><input class="input" type="number" id="nv-cap" value="82"></div>
      </div>`,
      async onConfirm() {
        const plate = document.getElementById('nv-plate')?.value?.trim()
        const model = document.getElementById('nv-model')?.value?.trim()
        if (!plate || !model) { showToast('❗ กรุณากรอกทะเบียนและรุ่นรถ', 'error'); return false }
        const originalCapacity = parseFloat(document.getElementById('nv-cap')?.value) || 82
        try {
          await createDoc('ev_battery_vehicles', {
            plate, model,
            year: parseInt(document.getElementById('nv-year')?.value) || new Date().getFullYear()+543,
            owner: document.getElementById('nv-owner')?.value?.trim() || '-',
            soh: 100, soc: 80, cycles: 0,
            capacity: originalCapacity, originalCapacity,
            range: Math.round(originalCapacity * 6),
            lastCheck: addDays(0), nextCheck: addDays(90),
          })
          showToast(`✅ เพิ่มรถ "${plate}" เข้าระบบแล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openCheckModal(v = null) {
    openModal({
      title: '🔋 บันทึกผลตรวจแบตเตอรี่',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        ${v ? `<div style="font-weight:700">${escHtml(v.plate)} — ${escHtml(v.model)}</div>` : `
        <div class="input-group"><label class="input-label">เลือกรถ *</label>
          <select class="input" id="bat-vehicle">
            <option value="">— เลือกรถจากรายการ —</option>
            ${vehicles.map(x => `<option value="${x.id}">${escHtml(x.plate)} — ${escHtml(x.model)} (${escHtml(x.owner)})</option>`).join('')}
          </select>
        </div>`}
        <div class="input-group"><label class="input-label">SOH (%)</label><input class="input" id="bat-soh" type="number" min="0" max="100" value="${v?.soh||90}"></div>
        <div class="input-group"><label class="input-label">SOC (%)</label><input class="input" id="bat-soc" type="number" min="0" max="100" value="${v?.soc||80}"></div>
        <div class="input-group"><label class="input-label">จำนวนรอบชาร์จ</label><input class="input" id="bat-cycles" type="number" value="${v?.cycles||0}"></div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="bat-note" placeholder="ผลการตรวจ..."></div>
      </div>`,
      async onConfirm() {
        if (!v) {
          const selId = document.getElementById('bat-vehicle')?.value
          v = vehicles.find(x => x.id === selId)
          if (!v) { showToast('❗ กรุณาเลือกรถจากรายการ', 'error'); return false }
        }
        const patch = {
          soh: parseInt(document.getElementById('bat-soh')?.value) || v.soh,
          soc: parseInt(document.getElementById('bat-soc')?.value) || v.soc,
          cycles: parseInt(document.getElementById('bat-cycles')?.value) || v.cycles,
          note: document.getElementById('bat-note')?.value.trim() || '',
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

  function openScheduleModal(v) {
    openModal({
      title: '📅 นัดตรวจแบตเตอรี่ — ' + escHtml(v.plate),
      size: 'sm',
      body: `<div class="input-group"><label class="input-label">วันนัดตรวจ *</label><input class="input" type="date" id="sched-date" value="${addDays(3)}"></div>`,
      confirmText: '📅 บันทึกวันนัด',
      async onConfirm() {
        const nextCheck = document.getElementById('sched-date')?.value
        if (!nextCheck) { showToast('❗ กรุณาระบุวันนัด', 'error'); return false }
        try {
          await updateDocData('ev_battery_vehicles', v.id, { nextCheck })
          showToast(`📅 นัดตรวจ ${v.plate} วันที่ ${formatDate(nextCheck)} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function mini(l, v) { return `<div style="background:var(--surface-2);padding:5px 7px;border-radius:var(--radius-sm)"><div style="color:var(--text-muted);font-size:0.65rem">${l}</div><div style="font-weight:700">${v}</div></div>` }
