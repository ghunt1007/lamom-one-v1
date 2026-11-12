/**
 * EV Station Management — สถานีชาร์จและ Battery Health
 * Route: /dms/ev-station
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { escHtml as __escA } from '../../utils/escape.js'
import { escHtml as esc } from '../../utils/escape.js'
import { latestBatteries } from '../../utils/evBattery.js'
import { formatDate, todayBangkok } from '../../utils/format.js'

const STATION_TYPES = ['DC Fast','AC Level 2','AC Level 1']
const POWER_OPTIONS = ['7.4 kW','11 kW','22 kW','50 kW','60 kW','120 kW','150 kW']
const CONNECTOR_OPTIONS = ['CCS2','CHAdeMO','Type2','GB/T','NACS']
const STATUS_OPTIONS = ['available','charging','offline','maintenance']
const STATUS_LABELS = { available:'ว่าง', charging:'กำลังชาร์จ', offline:'ออฟไลน์', maintenance:'ซ่อมบำรุง' }

export default async function EvStationPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let STATIONS = []
  let BATTERIES = []
  let tab = 'stations'
  let loading = true

  async function loadData() {
    loading = true
    try { STATIONS = await listDocs('ev_charging_stations', [], 'name', 'asc', 200) } catch (e) { STATIONS = [] }
    try { BATTERIES = latestBatteries(await listDocs('ev_battery_checks', [], 'checkDate', 'desc', 1000)) } catch (e) { BATTERIES = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function statusDot(s) {
    const colors = { available:'var(--success)', charging:'var(--primary)', offline:'var(--danger)', maintenance:'var(--warning)' }
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.62rem">
      <span style="width:8px;height:8px;border-radius:50%;background:${colors[s]||'var(--surface-2)'}"></span>
      ${STATUS_LABELS[s] || s}
    </span>`
  }

  function openStationModal(st) {
    const isEdit = !!st
    openModal({
      title: isEdit ? '✏️ แก้ไขสถานีชาร์จ' : '⚡ เพิ่มสถานีชาร์จใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div>
            <label style="font-size:0.74rem;color:var(--text-muted)">ชื่อสถานี *</label>
            <input id="ev-name" class="input" placeholder="เช่น Charger D1 (อาคารจอดรถ)" value="${esc(st?.name || '')}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">ประเภท Charger</label>
              <select id="ev-type" class="input">
                ${STATION_TYPES.map(t=>`<option value="${__escA(t)}" ${st?.type===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">กำลังไฟ</label>
              <select id="ev-power" class="input">
                ${POWER_OPTIONS.map(p=>`<option value="${__escA(p)}" ${st?.power===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>
          <div>
            <label style="font-size:0.74rem;color:var(--text-muted)">Connector (เลือกได้หลายตัว)</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
              ${CONNECTOR_OPTIONS.map(c=>`
                <label style="display:flex;align-items:center;gap:4px;font-size:0.76rem;cursor:pointer">
                  <input type="checkbox" class="ev-conn-cb" value="${__escA(c)}" ${st?.connectors?.includes(c)?'checked':''}>
                  ${c}
                </label>`).join('')}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">สถานะ</label>
              <select id="ev-status" class="input">
                ${STATUS_OPTIONS.map(s=>`<option value="${__escA(s)}" ${st?.status===s?'selected':''}>${STATUS_LABELS[s]}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">ราคาชาร์จ (฿/kWh)</label>
              <input id="ev-rate" type="number" class="input" placeholder="4.0" value="${__escA(st?.rate || 4)}">
            </div>
          </div>
        </div>
      `,
      footer: `
        <div>${isEdit ? `<button class="btn btn-sm btn-danger" id="ev-del">🗑 ลบ</button>` : ''}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="ev-save">💾 บันทึก</button>
        </div>
      `
    })

    document.getElementById('ev-save')?.addEventListener('click', async () => {
      const name = document.getElementById('ev-name')?.value.trim()
      if (!name) { showToast('⚠️ กรุณากรอกชื่อสถานี', 'warning'); return }
      const connectors = [...document.querySelectorAll('.ev-conn-cb:checked')].map(cb => cb.value)
      if (!connectors.length) { showToast('⚠️ เลือก Connector อย่างน้อย 1 ตัว', 'warning'); return }
      const data = {
        name,
        type: document.getElementById('ev-type')?.value || 'DC Fast',
        power: document.getElementById('ev-power')?.value || '60 kW',
        status: document.getElementById('ev-status')?.value || 'available',
        connectors,
        rate: parseFloat(document.getElementById('ev-rate')?.value) || 4,
        todaySessions: st?.todaySessions || 0,
        todayKwh: st?.todayKwh || 0,
        revenue: st?.revenue || 0
      }
      try {
        if (isEdit) await updateDocData('ev_charging_stations', st.id, data)
        else await createDoc('ev_charging_stations', data)
        showToast(isEdit ? '✅ แก้ไขสถานีแล้ว' : '✅ เพิ่มสถานีชาร์จแล้ว', 'success')
        document.querySelector('.modal-overlay')?.remove()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })

    if (isEdit) {
      document.getElementById('ev-del')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title:'🗑 ลบสถานีชาร์จ', message:`ลบ "${esc(st.name)}" ออกจากระบบ?`, confirmText:'ลบ', danger:true })
        if (!ok) return
        try {
          await softDelete('ev_charging_stations', st.id)
          document.querySelector('.modal-overlay')?.remove()
          showToast('🗑 ลบสถานีแล้ว', 'warning')
          if (container.__routerGen !== myGen) return
          await loadData()
        } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
      })
    }
  }

  // (v1.0.1105) บันทึกผลตรวจแบตจริงลง ev_battery_checks (เดิมปุ่มนี้แค่โชว์ข้อความว่าบันทึกแล้ว แต่ไม่ได้บันทึกอะไร)
  function openBatteryForm(pre = {}) {
    const f = (id, label, v = '', type = 'text', ph = '') => `<div class="input-group"><label class="input-label">${label}</label><input class="input" id="${id}" type="${type}" value="${esc(v ?? '')}" placeholder="${ph}" autocomplete="off"></div>`
    openModal({
      title: '🔋 บันทึกผลตรวจแบต',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        ${f('bt-vin', 'เลขตัวถัง (VIN) หรือทะเบียน *', pre.vin || pre.plate)}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">${f('bt-model', 'รุ่นรถ', pre.model)}${f('bt-cust', 'เจ้าของ', pre.customer)}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">${f('bt-health', 'สุขภาพแบต (%) *', '', 'number', 'เช่น 92')}${f('bt-cycles', 'รอบชาร์จ', pre.cycles || '', 'number')}</div>
        ${f('bt-date', 'วันที่ตรวจ', todayBangkok(), 'date')}
        ${f('bt-note', 'หมายเหตุ', '')}
      </div>`,
      async onConfirm() {
        const g = id => document.getElementById(id)?.value?.trim() || ''
        const vin = g('bt-vin'), health = Number(g('bt-health'))
        if (!vin) { showToast('❗ กรอกเลขตัวถังหรือทะเบียน', 'error'); return false }
        if (!(health > 0 && health <= 100)) { showToast('❗ กรอกสุขภาพแบต 1–100%', 'error'); return false }
        try {
          await createDoc('ev_battery_checks', { vin, model: g('bt-model'), customer: g('bt-cust'), health, cycles: Number(g('bt-cycles')) || 0, checkDate: g('bt-date') || todayBangkok(), note: g('bt-note') })
          showToast(`🔋 บันทึกผลตรวจแล้ว (${health}%)`, 'success')
          tab = 'batteries'
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
      }
    })
  }

  function openBatteryCheckModal(b) {
    const healthColors = { excellent:'var(--success)', good:'var(--success)', fair:'var(--warning)', warning:'var(--danger)' }
    const hc = healthColors[b.status] || 'var(--text-muted)'
    const healthLabels = { excellent:'ดีเยี่ยม', good:'ดี', fair:'ปานกลาง', warning:'ควรตรวจสอบ' }
    const degradeRate = b.cycles > 0 ? ((100 - b.health) / b.cycles * 100).toFixed(2) : '0.00'
    const estCycles = b.health > 70 ? Math.round((b.health - 70) / (parseFloat(degradeRate) || 0.05)) : 0
    openModal({
      title: `🔋 Battery Health — ${b.model}`,
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="padding:14px;background:var(--surface-2);border-radius:var(--radius-sm);text-align:center">
              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">Battery Health</div>
              <div style="font-size:2.2rem;font-weight:900;color:${hc};line-height:1">${b.health}%</div>
              <div style="font-size:0.72rem;color:${hc};font-weight:600;margin-top:4px">${healthLabels[b.status] || b.status}</div>
              <div style="height:8px;background:var(--surface-3,var(--border));border-radius:4px;overflow:hidden;margin-top:8px">
                <div style="height:100%;width:${b.health}%;background:${hc};border-radius:4px;transition:width .5s"></div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="padding:8px 12px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <div style="font-size:0.7rem;color:var(--text-muted)">Charge Cycles</div>
                <div style="font-weight:700;font-size:1rem">${b.cycles} รอบ</div>
              </div>
              <div style="padding:8px 12px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <div style="font-size:0.7rem;color:var(--text-muted)">Degradation/100 cycles</div>
                <div style="font-weight:700;font-size:1rem">${degradeRate}%</div>
              </div>
              <div style="padding:8px 12px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <div style="font-size:0.7rem;color:var(--text-muted)">คาดเหลืออีก (>70%)</div>
                <div style="font-weight:700;font-size:1rem;color:${estCycles<200?'var(--warning)':'var(--success)'}">${estCycles > 0 ? '~'+estCycles+' รอบ' : 'ต่ำกว่า 70%'}</div>
              </div>
            </div>
          </div>

          <table style="width:100%;font-size:0.76rem;border-collapse:collapse">
            ${[
              ['🚗 รุ่น', esc(b.model || '-')],
              ['👤 เจ้าของ', esc(b.customer || '-')],
              ['🔢 VIN / ทะเบียน', esc(b.vin || b.plate || '-')],
              ['📅 ตรวจล่าสุด', formatDate(b.checkDate)],
              ...(b.note ? [['📝 หมายเหตุ', b.note]] : []),
            ].map(([k,v])=>`<tr style="border-bottom:1px solid var(--border-subtle)">
              <td style="padding:7px 0;color:var(--text-muted)">${k}</td>
              <td style="padding:7px 0;font-weight:600;text-align:right">${v}</td>
            </tr>`).join('')}
          </table>

          ${b.status === 'warning' ? `
          <div style="padding:10px 12px;background:rgba(var(--danger-rgb,220,38,38),0.1);border:1px solid var(--danger);border-radius:var(--radius-sm);font-size:0.76rem;color:var(--danger)">
            ⚠️ <strong>Battery Health ต่ำ</strong> — แนะนำแจ้งเจ้าของรถเข้าตรวจสอบที่ศูนย์บริการโดยด่วน
          </div>` : ''}
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
          <button class="btn btn-primary btn-sm" id="bat-report">📋 บันทึกผลตรวจใหม่</button>
        </div>
      `
    })

    document.getElementById('bat-report')?.addEventListener('click', () => {
      document.querySelector('.modal-overlay')?.remove()
      openBatteryForm(b)
    })
  }

  function stationCard(st) {
    const border = st.status==='offline' ? 'var(--danger)' : st.status==='charging' ? 'var(--primary)' : 'var(--border)'
    return `<div class="card ev-station-card" data-id="${st.id}" style="padding:14px;border:1px solid ${border};margin-bottom:8px;cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:700;font-size:0.82rem">${esc(st.name)}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">${st.type} · ${st.power}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${statusDot(st.status)}
          <button class="btn btn-xs btn-secondary ev-edit-btn" data-id="${st.id}" style="padding:2px 6px;font-size:0.6rem">✏️</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${(st.connectors || []).map(c=>`<span style="font-size:0.62rem;background:var(--surface-2);padding:2px 7px;border-radius:6px">${c}</span>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:0.7rem">
        <div><div style="color:var(--text-muted);font-size:0.6rem">Session วันนี้</div><div style="font-weight:700">${st.todaySessions}</div></div>
        <div><div style="color:var(--text-muted);font-size:0.6rem">kWh จ่าย</div><div style="font-weight:700">${st.todayKwh} kWh</div></div>
        <div><div style="color:var(--text-muted);font-size:0.6rem">รายได้</div><div style="font-weight:700;color:var(--success)">${st.revenue ? '฿'+st.revenue : 'ฟรี'}</div></div>
      </div>
    </div>`
  }

  function batteryRow(b) {
    const healthColors = { excellent:'var(--success)', good:'var(--success)', fair:'var(--warning)', warning:'var(--danger)' }
    const hc = healthColors[b.status] || 'var(--text-muted)'
    return `<tr style="border-bottom:1px solid var(--border-subtle)">
      <td style="padding:8px 10px">
        <div style="font-size:0.76rem;font-weight:600">${esc(b.model)}</div>
        <div style="font-size:0.64rem;color:var(--text-muted)">${esc(String(b.vin || b.plate || '').slice(-8))}</div>
      </td>
      <td style="padding:8px 10px;font-size:0.74rem">${esc(b.customer || '-')}</td>
      <td style="padding:8px 10px">
        <div style="font-weight:700;font-size:0.8rem;color:${hc}">${b.health}%</div>
        <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden;margin-top:3px;width:80px">
          <div style="height:100%;width:${b.health}%;background:${hc};border-radius:3px"></div>
        </div>
      </td>
      <td style="padding:8px 10px;text-align:center;font-size:0.74rem">${b.cycles}</td>
      <td style="padding:8px 10px;font-size:0.72rem;color:var(--text-muted)">${formatDate(b.checkDate)}</td>
      <td style="padding:8px 10px">
        <button class="btn btn-sm btn-${b.status==='warning'?'danger':'secondary'} check-btn" data-vin="${esc(b.vin)}">${b.status==='warning'?'⚠️ ตรวจด่วน':'🔋 ตรวจสอบ'}</button>
      </td>
    </tr>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const available = STATIONS.filter(s => s.status === 'available').length
    const charging = STATIONS.filter(s => s.status === 'charging').length
    const offline = STATIONS.filter(s => s.status === 'offline').length
    const totalKwh = STATIONS.reduce((s,st) => s + st.todayKwh, 0)
    const totalRev = STATIONS.reduce((s,st) => s + st.revenue, 0)
    const warnBat = BATTERIES.filter(b => b.status === 'warning').length

    const tabBtns = [['stations','⚡ สถานีชาร์จ'],['batteries','🔋 Battery Health']].map(([k,l]) =>
      `<button class="btn btn-sm ${tab===k?'btn-primary':'btn-secondary'} tab-btn" data-t="${k}">${l}</button>`
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ EV Station Management</div>
            <div class="page-subtitle">สถานีชาร์จ + Battery Health Monitor${warnBat ? ` · <span style="color:var(--danger);font-weight:700">⚠️ ${warnBat} คัน Battery ต่ำ</span>` : ''}</div>
          </div>
          <div class="page-actions">
            ${tab === 'batteries' ? '<button class="btn btn-primary" id="add-bat-btn">+ บันทึกผลตรวจแบต</button>' : '<button class="btn btn-primary" id="add-station-btn">+ เพิ่มสถานี</button>'}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:14px">
          ${sc('✅ ว่าง', available+' สถานี', 'var(--success)')}
          ${sc('⚡ กำลังชาร์จ', charging+' สถานี', 'var(--primary)')}
          ${sc('📊 kWh วันนี้', totalKwh+' kWh', 'var(--warning)')}
          ${sc('💰 รายได้ชาร์จ', '฿'+totalRev.toLocaleString(), 'var(--success)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${tabBtns}</div>

        ${tab === 'stations'
          ? `<div>${STATIONS.map(st => stationCard(st)).join('')}</div>`
          : !BATTERIES.length ? `<div class="empty-state" style="padding:40px"><div class="empty-icon">🔋</div><div class="empty-title">ยังไม่มีผลตรวจแบต</div><div class="empty-desc">กด "+ บันทึกผลตรวจแบต" หลังตรวจรถลูกค้า ระบบจะเก็บผลล่าสุดของแต่ละคันและเตือนคันที่แบตต่ำกว่า 80%</div></div>`
          : `<div class="card" style="padding:0;overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
                <thead><tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">รุ่น/VIN</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">เจ้าของ</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">สุขภาพแบต</th>
                  <th style="text-align:center;padding:10px;font-weight:600;color:var(--text-muted)">รอบชาร์จ</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">ตรวจล่าสุด</th>
                  <th style="padding:10px"></th>
                </tr></thead>
                <tbody>${BATTERIES.map(b => batteryRow(b)).join('')}</tbody>
              </table>
            </div>`
        }
      </div>`

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; render() }))
    document.getElementById('add-station-btn')?.addEventListener('click', () => openStationModal(null))
    document.getElementById('add-bat-btn')?.addEventListener('click', () => openBatteryForm())

    container.querySelectorAll('.ev-edit-btn').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation()
      const st = STATIONS.find(s => s.id === b.dataset.id)
      if (st) openStationModal(st)
    }))

    container.querySelectorAll('.check-btn').forEach(b => b.addEventListener('click', () => {
      const bat = BATTERIES.find(x => x.vin === b.dataset.vin)
      if (bat) openBatteryCheckModal(bat)
    }))
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
