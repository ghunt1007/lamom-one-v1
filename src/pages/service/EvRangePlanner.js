/**
 * EV Range Planner — วางแผนการเดินทาง EV ตามระยะแบต + สถานีชาร์จ
 * Route: /service/ev-range
 *
 * รุ่นรถ: ดึงจากแคตตาล็อกรถจริงของระบบ (vehicleDatabase.js) — ไม่ใช่ "รถของบริษัท" ที่ระบุทะเบียนจริง
 * จุดชาร์จ: เก็บใน Firestore (ev_trip_charging_points) แก้ไข/เพิ่มได้โดยทีมงาน — ไม่ใช่ข้อมูล real-time
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { formatCurrency, timeAgo } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData, softDelete } from '../../core/db.js'
import { getVehicles } from '../../data/vehicleDatabase.js'

// จุดชาร์จเริ่มต้น (seed ครั้งแรกเท่านั้นถ้ายังไม่มีข้อมูลใน Firestore) — ทีมงานแก้ไข/เพิ่ม/ลบได้เองภายหลัง
const DEFAULT_CHARGING_POINTS = [
  { name:'PEA VOLTA สยามพารากอน', dist:12, kw:150, price:6.5, note:'ในเมือง' },
  { name:'PTT EV Station อโศก',   dist:8,  kw:50,  price:5.8, note:'ในเมือง' },
  { name:'BYD Fast Charge ลาดพร้าว', dist:15, kw:200, price:7.2, note:'ในเมือง' },
  { name:'EA Anywhere ราชประสงค์', dist:5,  kw:22,  price:4.5, note:'ในเมือง' },
  { name:'Orio Charge เมกาบางนา', dist:28, kw:150, price:6.8, note:'ขาออกเมือง' },
]

const PRESETS = [
  { label:'กรุงเทพ → พัทยา', dist:147, elev:'+40m' },
  { label:'กรุงเทพ → เขาใหญ่', dist:205, elev:'+800m' },
  { label:'กรุงเทพ → หัวหิน', dist:246, elev:'+20m' },
  { label:'กรุงเทพ → ชะอำ', dist:216, elev:'+15m' },
]

// รายรุ่นรถ EV จากแคตตาล็อกจริงของระบบ (getVehicles()) — ใช้สเปคโรงงาน (range/battery) ไม่ใช่รถที่ระบุทะเบียนจริง
function loadEvModels() {
  return getVehicles()
    .filter(v => v.fuel === 'BEV' && v.range > 0)
    .map(v => ({
      id: v.id,
      model: `${v.brand} ${v.model} ${v.variant}`.trim(),
      battery: parseFloat(v.battery) || 0,
      range: v.range,
    }))
    .sort((a, b) => a.model.localeCompare(b.model, 'th'))
}

export default async function EvRangePlannerPage(container) {
  const myGen = container.__routerGen
  const VEHICLES = loadEvModels()

  let selVehicle = VEHICLES[0] || null
  let socPct = 80
  let tripDist = 147
  let acOn = true
  let highway = true
  let passengers = 2
  let points = []
  let loaded = false

  async function loadPoints() {
    let docs = []
    try { docs = await listDocs('ev_trip_charging_points', [], 'dist', 'asc', 100) } catch (e) {}
    if (!docs.length) {
      for (const p of DEFAULT_CHARGING_POINTS) {
        try { await createDoc('ev_trip_charging_points', p) } catch (e) {}
      }
      try { docs = await listDocs('ev_trip_charging_points', [], 'dist', 'asc', 100) } catch (e) {}
    }
    points = docs
    loaded = true
  }

  function calcRange() {
    if (!selVehicle) return 0
    const base = selVehicle.range * (socPct / 100)
    const acPenalty = acOn ? 0.88 : 1
    const highwayPenalty = highway ? 0.85 : 1
    const passPenalty = 1 - (passengers - 1) * 0.015
    return Math.round(base * acPenalty * highwayPenalty * passPenalty)
  }

  function calcCost(dist) {
    if (!selVehicle || !selVehicle.range) return 0
    const kWh = (dist / selVehicle.range) * selVehicle.battery
    return Math.round(kWh * 6.5)
  }

  function render() {
    if (!loaded) {
      container.innerHTML = `<div class="page-content"><div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">⏳ กำลังโหลดข้อมูล...</div></div>`
      return
    }
    if (!selVehicle) {
      container.innerHTML = `<div class="page-content"><div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">ไม่พบรุ่นรถไฟฟ้า (BEV) ในแคตตาล็อกระบบ</div></div>`
      return
    }

    const range = calcRange()
    const canReach = range >= tripDist
    const remain = range - tripDist
    const remainPct = Math.max(0, Math.round((remain / selVehicle.range) * 100))
    const tripCost = calcCost(tripDist)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗺 EV Range Planner</div>
            <div class="page-subtitle">วางแผนการเดินทาง EV · คำนวณระยะวิ่งโดยประมาณจากสเปครถในระบบ + จุดชาร์จที่ทีมงานแนะนำ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="share-btn">📤 แชร์แผน</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Left: inputs -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- Vehicle selector -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🚗 เลือกรุ่นรถ (จากแคตตาล็อกในระบบ)</div>
              <select class="input" id="veh-select" style="width:100%">
                ${VEHICLES.map(v => `<option value="${v.id}" ${selVehicle.id===v.id?'selected':''}>${v.model} — ${v.range} km / ${v.battery} kWh</option>`).join('')}
              </select>
            </div>

            <!-- Trip settings -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⚙️ ตั้งค่าการเดินทาง</div>

              <div style="margin-bottom:12px">
                <div style="font-size:0.74rem;margin-bottom:6px">🔋 พลังงานแบตเตอรี่ปัจจุบัน: <b>${socPct}%</b></div>
                <input type="range" id="soc-slider" min="5" max="100" value="${socPct}" style="width:100%">
              </div>

              <div style="margin-bottom:12px">
                <div style="font-size:0.74rem;margin-bottom:6px">📍 ระยะทางปลายทาง: <b>${tripDist} km</b></div>
                <input type="range" id="dist-slider" min="10" max="500" value="${tripDist}" style="width:100%">
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
                  ${PRESETS.map(p=>`<button class="btn btn-xs btn-secondary preset-btn" data-dist="${p.dist}" title="${p.elev}">${p.label}</button>`).join('')}
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                <label style="display:flex;align-items:center;gap:6px;font-size:0.76rem;cursor:pointer">
                  <input type="checkbox" id="ac-chk" ${acOn?'checked':''}> 🌬 แอร์ติด
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:0.76rem;cursor:pointer">
                  <input type="checkbox" id="hwy-chk" ${highway?'checked':''}> 🛣 ทางด่วน
                </label>
              </div>

              <div>
                <div style="font-size:0.74rem;margin-bottom:6px">👥 จำนวนผู้โดยสาร: <b>${passengers} คน</b></div>
                <input type="range" id="pass-slider" min="1" max="5" value="${passengers}" style="width:100%">
              </div>
            </div>
          </div>

          <!-- Right: result -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- Result card -->
            <div class="card" style="padding:20px;background:${canReach?'var(--success)':'var(--danger)'}18;border:2px solid ${canReach?'var(--success)':'var(--danger)'}">
              <div style="text-align:center;margin-bottom:16px">
                <div style="font-size:2.5rem;font-weight:900;color:${canReach?'var(--success)':'var(--danger)'}">${range} km</div>
                <div style="font-size:0.8rem;color:var(--text-muted)">ระยะวิ่งได้โดยประมาณจากสเปครถ · แบต ${socPct}%</div>
                <div style="font-size:1.1rem;font-weight:700;margin-top:8px;color:${canReach?'var(--success)':'var(--danger)'}">
                  ${canReach ? `✅ ถึงได้ · เหลือ ${remain} km (${remainPct}%)` : `❌ ไม่ถึง · ขาด ${Math.abs(remain)} km`}
                </div>
              </div>

              <!-- Range bar -->
              <div style="height:12px;background:var(--surface-2);border-radius:6px;overflow:hidden;margin-bottom:14px;position:relative">
                <div style="height:100%;width:${Math.min(100,range/5)}%;background:${canReach?'var(--success)':'var(--danger)'};transition:width .3s"></div>
                <div style="position:absolute;top:0;height:100%;width:2px;background:var(--primary);left:${Math.min(100,tripDist/5)}%"></div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                ${stat('⚡ ค่าไฟ (ประมาณ)', formatCurrency(tripCost), 'var(--primary)')}
                ${stat('🔋 SOC เหลือ', canReach?remainPct+'%':'—', canReach?'var(--success)':'var(--danger)')}
                ${stat('📏 ระยะเป้า', tripDist+' km', 'var(--text)')}
              </div>
              <div style="font-size:0.64rem;color:var(--text-muted);margin-top:10px;text-align:center">
                * คำนวณจากสเปคโรงงานของรุ่นรถ และสมมติฐานค่าไฟ ฿6.5/kWh — เป็นค่าประมาณเพื่อวางแผน ไม่ใช่ข้อมูล real-time
              </div>
            </div>

            <!-- Charging points -->
            <div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div>
                  <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted)">⚡ จุดชาร์จแนะนำระหว่างทาง</div>
                  <div style="font-size:0.64rem;color:var(--text-muted)">ข้อมูลที่ทีมงานเพิ่ม/แก้ไขเอง ไม่ใช่สถานะว่าง-ไม่ว่าง real-time</div>
                </div>
                <button class="btn btn-xs btn-secondary" id="add-point-btn">➕ เพิ่มจุดชาร์จ</button>
              </div>
              ${points.length === 0 ? `<div style="font-size:0.74rem;color:var(--text-muted);padding:8px 0">ยังไม่มีจุดชาร์จในระบบ</div>` : points.map(p=>`
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                  <div style="flex:1">
                    <div style="font-size:0.78rem;font-weight:600">${p.name}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">~${p.dist} km · ${p.kw}kW · ${formatCurrency(p.price)}/kWh${p.note ? ' · '+p.note : ''}</div>
                    <div style="font-size:0.62rem;color:var(--text-muted)">${p.updatedByName ? `แก้ไขล่าสุดโดย ${p.updatedByName} · ${timeAgo(p.updatedAt)}` : 'ข้อมูลตัวอย่างเริ่มต้น'}</div>
                  </div>
                  <button class="btn btn-xs btn-secondary edit-point-btn" data-id="${p.id}" style="font-size:0.68rem">✏️</button>
                  <button class="btn btn-xs btn-secondary nav-btn" data-name="${p.name}" style="font-size:0.68rem">นำทาง</button>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`

    document.getElementById('veh-select')?.addEventListener('change', e => {
      selVehicle = VEHICLES.find(v => v.id === e.target.value) || selVehicle
      render()
    })
    document.getElementById('soc-slider')?.addEventListener('input', e => { socPct = parseInt(e.target.value); render() })
    document.getElementById('dist-slider')?.addEventListener('input', e => { tripDist = parseInt(e.target.value); render() })
    document.getElementById('ac-chk')?.addEventListener('change', e => { acOn = e.target.checked; render() })
    document.getElementById('hwy-chk')?.addEventListener('change', e => { highway = e.target.checked; render() })
    document.getElementById('pass-slider')?.addEventListener('input', e => { passengers = parseInt(e.target.value); render() })
    document.getElementById('share-btn')?.addEventListener('click', () => {
      const summary = `${selVehicle.model} | SoC ${socPct}% | เที่ยว ${tripDist} km | ${acOn ? 'AC on' : 'AC off'} | ${highway ? 'ทางด่วน' : 'ในเมือง'}`
      navigator.clipboard?.writeText(summary)
        .then(() => showToast(`📤 Copy แผนการเดินทาง ${selVehicle.model} ${tripDist} km แล้ว — วางใน LINE ได้เลย`, 'success'))
        .catch(() => showToast(`📤 แชร์แผนการเดินทาง ${selVehicle.model} ${tripDist} km แล้ว`, 'success'))
    })
    container.querySelectorAll('.preset-btn').forEach(b => b.addEventListener('click', () => {
      tripDist = parseInt(b.dataset.dist); render()
    }))
    container.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => {
      const q = encodeURIComponent(b.dataset.name + ' กรุงเทพ')
      window.open(`https://www.google.com/maps/search/${q}`, '_blank', 'noopener,noreferrer')
      showToast(`🗺 เปิด Google Maps → ${b.dataset.name}`, 'success')
    }))
    document.getElementById('add-point-btn')?.addEventListener('click', () => openPointModal(null))
    container.querySelectorAll('.edit-point-btn').forEach(b => b.addEventListener('click', () => {
      const p = points.find(x => x.id === b.dataset.id)
      if (p) openPointModal(p)
    }))
  }

  function openPointModal(existing) {
    const isEdit = !!existing
    const body = `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:0.82rem">
        <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อจุดชาร์จ *</label>
          <input id="pt-name" class="input" value="${existing?.name || ''}" placeholder="เช่น PEA VOLTA สยามพารากอน"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ระยะห่างโดยประมาณ (km)</label>
            <input id="pt-dist" type="number" class="input" value="${existing?.dist ?? 10}"></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">กำลังชาร์จ (kW)</label>
            <input id="pt-kw" type="number" class="input" value="${existing?.kw ?? 50}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคา (฿/kWh)</label>
            <input id="pt-price" type="number" step="0.1" class="input" value="${existing?.price ?? 6.5}"></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">หมายเหตุ</label>
            <input id="pt-note" class="input" value="${existing?.note || ''}" placeholder="เช่น ในเมือง"></div>
        </div>
      </div>
    `
    openModal({
      title: isEdit ? '✏️ แก้ไขจุดชาร์จ' : '➕ เพิ่มจุดชาร์จ',
      body,
      footer: `
        <div>${isEdit ? `<button class="btn btn-sm btn-danger" id="pt-del">🗑 ลบ</button>` : ''}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" id="pt-cancel">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="pt-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('pt-cancel')?.addEventListener('click', () => document.querySelector('.modal-overlay')?.remove())
    document.getElementById('pt-save')?.addEventListener('click', async () => {
      const name = document.getElementById('pt-name')?.value.trim()
      if (!name) { showToast('⚠️ กรุณากรอกชื่อจุดชาร์จ', 'warning'); return }
      const user = getState('user')
      const data = {
        name,
        dist: parseFloat(document.getElementById('pt-dist')?.value) || 0,
        kw: parseFloat(document.getElementById('pt-kw')?.value) || 0,
        price: parseFloat(document.getElementById('pt-price')?.value) || 0,
        note: document.getElementById('pt-note')?.value.trim() || '',
        updatedByName: user?.displayName || user?.email || 'ผู้ใช้งาน',
      }
      try {
        if (isEdit) await updateDocData('ev_trip_charging_points', existing.id, data)
        else await createDoc('ev_trip_charging_points', data)
        document.querySelector('.modal-overlay')?.remove()
        showToast(isEdit ? '✅ แก้ไขจุดชาร์จแล้ว' : '✅ เพิ่มจุดชาร์จแล้ว', 'success')
        await loadPoints()
        if (container.__routerGen === myGen) render()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    if (isEdit) {
      document.getElementById('pt-del')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title:'🗑 ลบจุดชาร์จ', message:`ลบ "${existing.name}" ออกจากรายการ?`, confirmText:'ลบ', danger:true })
        if (!ok) return
        try {
          await softDelete('ev_trip_charging_points', existing.id)
          document.querySelector('.modal-overlay')?.remove()
          showToast('🗑 ลบจุดชาร์จแล้ว', 'warning')
          await loadPoints()
          if (container.__routerGen === myGen) render()
        } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
      })
    }
  }

  function stat(label, val, color) {
    return `<div style="background:var(--surface-2);padding:8px;border-radius:var(--radius-sm);text-align:center">
      <div style="font-size:0.64rem;color:var(--text-muted)">${label}</div>
      <div style="font-size:0.88rem;font-weight:700;color:${color}">${val}</div>
    </div>`
  }

  await loadPoints()
  render()
}
