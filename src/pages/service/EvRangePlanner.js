/**
 * EV Range Planner — วางแผนการเดินทาง EV ตามระยะแบต + สถานีชาร์จ
 * Route: /service/ev-range
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatCurrency } from '../../utils/format.js'

const VEHICLES = [
  { id:'V1', model:'BYD Atto 3', battery:60.5, soh:97, range:480, charge:'CCS2+AC', plate:'กข-1234' },
  { id:'V2', model:'BYD Seal AWD', battery:82.6, soh:99, range:520, charge:'CCS2+AC', plate:'กข-5678' },
  { id:'V3', model:'MG ZS EV', battery:51, soh:92, range:440, charge:'CCS2+AC', plate:'กก-0001' },
]

const STATIONS = [
  { id:'S1', name:'PEA VOLTA สยามพารา', dist:12, kw:150, slots:4, free:2, price:6.5 },
  { id:'S2', name:'PTT EV Station อโศก', dist:8, kw:50, slots:2, free:1, price:5.8 },
  { id:'S3', name:'BYD Fast Charge ลาดพร้าว', dist:15, kw:200, slots:6, free:4, price:7.2 },
  { id:'S4', name:'EA Anywhere ราชประสงค์', dist:5, kw:22, slots:8, free:6, price:4.5 },
  { id:'S5', name:'Orio Charge เมกาบางนา', dist:28, kw:150, slots:3, free:0, price:6.8 },
]

const PRESETS = [
  { label:'กรุงเทพ → พัทยา', dist:147, elev:'+40m' },
  { label:'กรุงเทพ → เขาใหญ่', dist:205, elev:'+800m' },
  { label:'กรุงเทพ → หัวหิน', dist:246, elev:'+20m' },
  { label:'กรุงเทพ → ชะอำ', dist:216, elev:'+15m' },
]

export default async function EvRangePlannerPage(container) {
  let selVehicle = VEHICLES[0]
  let socPct = 80
  let tripDist = 147
  let acOn = true
  let highway = true
  let passengers = 2

  function calcRange() {
    const base = selVehicle.range * (selVehicle.soh / 100) * (socPct / 100)
    const acPenalty = acOn ? 0.88 : 1
    const highwayPenalty = highway ? 0.85 : 1
    const passPenalty = 1 - (passengers - 1) * 0.015
    return Math.round(base * acPenalty * highwayPenalty * passPenalty)
  }

  function calcCost(dist) {
    const kWh = (dist / selVehicle.range) * selVehicle.battery
    return Math.round(kWh * 6.5)
  }

  function render() {
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
            <div class="page-subtitle">วางแผนการเดินทาง EV · คำนวณระยะวิ่ง + สถานีชาร์จระหว่างทาง</div>
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
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🚗 เลือกรถ</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${VEHICLES.map(v=>`
                  <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-sm);border:2px solid ${selVehicle.id===v.id?'var(--primary)':'var(--border)'};cursor:pointer;background:${selVehicle.id===v.id?'var(--primary)11':'var(--surface-2)'}">
                    <input type="radio" name="veh" class="veh-radio" data-id="${v.id}" ${selVehicle.id===v.id?'checked':''} style="display:none">
                    <div style="flex:1">
                      <div style="font-weight:700;font-size:0.82rem">${v.model}</div>
                      <div style="font-size:0.68rem;color:var(--text-muted)">${v.plate} · ${v.battery}kWh · SOH ${v.soh}%</div>
                    </div>
                    <div style="font-size:0.76rem;font-weight:700;color:var(--primary)">${v.range} km</div>
                  </label>`).join('')}
              </div>
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
                <div style="font-size:0.8rem;color:var(--text-muted)">ระยะวิ่งได้จาก SOH ${selVehicle.soh}% · แบต ${socPct}%</div>
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
                ${stat('⚡ ค่าไฟ', formatCurrency(tripCost), 'var(--primary)')}
                ${stat('🔋 SOC เหลือ', canReach?remainPct+'%':'—', canReach?'var(--success)':'var(--danger)')}
                ${stat('📏 ระยะเป้า', tripDist+' km', 'var(--text)')}
              </div>
            </div>

            <!-- Charging stations -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⚡ สถานีชาร์จใกล้เคียง</div>
              ${STATIONS.map(s=>`
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                  <div style="flex:1">
                    <div style="font-size:0.78rem;font-weight:600">${s.name}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${s.dist} km · ${s.kw}kW · ${formatCurrency(s.price)}/kWh</div>
                  </div>
                  <div style="text-align:right">
                    <span style="font-size:0.66rem;background:${s.free>0?'var(--success)':'var(--danger)'};color:#fff;padding:2px 7px;border-radius:8px">${s.free>0?s.free+' ว่าง':'เต็ม'}</span>
                  </div>
                  <button class="btn btn-xs btn-secondary nav-btn" data-name="${s.name}" style="font-size:0.68rem">นำทาง</button>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`

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
    container.querySelectorAll('.veh-radio').forEach(r => r.closest('label')?.addEventListener('click', () => {
      selVehicle = VEHICLES.find(v => v.id === r.dataset.id) || VEHICLES[0]; render()
    }))
    container.querySelectorAll('.preset-btn').forEach(b => b.addEventListener('click', () => {
      tripDist = parseInt(b.dataset.dist); render()
    }))
    container.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => {
      const q = encodeURIComponent(b.dataset.name + ' กรุงเทพ')
      window.open(`https://www.google.com/maps/search/${q}`, '_blank', 'noopener,noreferrer')
      showToast(`🗺 เปิด Google Maps → ${b.dataset.name}`, 'success')
    }))
  }

  function stat(label, val, color) {
    return `<div style="background:var(--surface-2);padding:8px;border-radius:var(--radius-sm);text-align:center">
      <div style="font-size:0.64rem;color:var(--text-muted)">${label}</div>
      <div style="font-size:0.88rem;font-weight:700;color:${color}">${val}</div>
    </div>`
  }

  render()
}
