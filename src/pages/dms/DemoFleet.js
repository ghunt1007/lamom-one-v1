/**
 * Demo Fleet — จัดการรถทดลองขับ
 * Route: /dms/demo-fleet
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const DEMO_STATUS = {
  available: { label: 'พร้อมใช้', color: 'success', icon: '✅' },
  in_use:    { label: 'กำลัง Test Drive', color: 'warning', icon: '🚗' },
  charging:  { label: 'กำลังชาร์จ', color: 'primary', icon: '⚡' },
  maintenance:{ label: 'ซ่อมบำรุง', color: 'danger', icon: '🔧' },
}

const DEMO_CARS = [
  { id: 'DM01', model: 'BYD Dolphin', plate: 'ทด-001', soc: 85, mileage: 8420, status: 'available', tdCount30: 18, lastClean: addDays(-1), insuranceExp: addDays(120), note: '' },
  { id: 'DM02', model: 'BYD Atto 3', plate: 'ทด-002', soc: 42, mileage: 12150, status: 'charging', tdCount30: 24, lastClean: addDays(0), insuranceExp: addDays(85), note: '' },
  { id: 'DM03', model: 'BYD Seal AWD', plate: 'ทด-003', soc: 91, mileage: 6890, status: 'in_use', tdCount30: 31, lastClean: addDays(-2), insuranceExp: addDays(200), note: 'ลูกค้า: ประพันธ์ มั่งมี · เซลส์: วิชัย · ออก 14:20' },
  { id: 'DM04', model: 'MG4 Electric', plate: 'ทด-004', soc: 12, mileage: 15600, status: 'maintenance', tdCount30: 9, lastClean: addDays(-5), insuranceExp: addDays(25), note: 'ยางหน้าซ้ายรั่ว — รออะไหล่' },
  { id: 'DM05', model: 'BYD Han', plate: 'ทด-005', soc: 78, mileage: 4200, status: 'available', tdCount30: 12, lastClean: addDays(0), insuranceExp: addDays(310), note: '' },
]

export default async function DemoFleetPage(container) {
  const myGen = container.__routerGen
  let cars = DEMO_CARS.map(c => ({ ...c }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('demo_fleet', [], 'model', 'asc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `DM${String(i+1).padStart(2,'0')}`,
        model: d.model || '',
        plate: d.plate || '',
        soc: d.soc || 0,
        mileage: d.mileage || 0,
        status: d.status || 'available',
        tdCount30: d.tdCount30 || 0,
        lastClean: d.lastClean || addDays(0),
        insuranceExp: d.insuranceExp || addDays(90),
        note: d.note || '',
      }))
      cars = [...mapped, ...DEMO_CARS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const available = cars.filter(c => c.status === 'available').length
    const lowBattery = cars.filter(c => c.soc < 30).length
    const totalTd = cars.reduce((a, c) => a + c.tdCount30, 0)
    const insExpiring = cars.filter(c => c.insuranceExp <= addDays(30))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 Demo Fleet</div>
            <div class="page-subtitle">จัดการรถทดลองขับ — ${cars.length} คัน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-car-btn">+ เพิ่มรถ Demo</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('✅ พร้อมใช้', available + '/' + cars.length, available > 0 ? 'success' : 'danger')}
          ${kpi('🚗 Test Drive (30 วัน)', totalTd + ' ครั้ง', 'primary')}
          ${kpi('🔋 แบตต่ำ (<30%)', lowBattery, lowBattery > 0 ? 'warning' : 'success')}
          ${kpi('🛡 ประกันใกล้หมด', insExpiring.length, insExpiring.length > 0 ? 'danger' : 'secondary')}
        </div>

        ${insExpiring.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🛡 <strong>ประกันใกล้หมด:</strong> ${insExpiring.map(c => `${escHtml(c.plate)} (${formatDate(c.insuranceExp)})`).join(' · ')}
          </div>
        ` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${cars.map(c => {
            const ds = DEMO_STATUS[c.status]
            const socColor = c.soc >= 60 ? 'success' : c.soc >= 30 ? 'warning' : 'danger'
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${ds?.color})">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(c.model)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(c.plate)} · ${c.mileage.toLocaleString()} km</div>
                </div>
                <span class="badge badge-${ds?.color}" style="font-size:0.62rem">${ds?.icon} ${ds?.label}</span>
              </div>

              <!-- SOC -->
              <div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:3px">
                  <span style="color:var(--text-muted)">🔋 แบตเตอรี่</span>
                  <strong style="color:var(--${socColor})">${c.soc}%</strong>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:8px">
                  <div style="width:${c.soc}%;background:var(--${socColor});height:8px;border-radius:3px"></div>
                </div>
              </div>

              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">
                🚗 TD เดือนนี้: ${c.tdCount30} ครั้ง · 🧽 ล้างล่าสุด ${timeAgo(c.lastClean)}
              </div>
              ${c.note ? `<div style="font-size:0.7rem;color:var(--warning);font-style:italic;margin-bottom:8px">📌 ${escHtml(c.note)}</div>` : ''}

              <div style="display:flex;gap:5px;flex-wrap:wrap">
                ${c.status === 'available' ? `<button class="btn btn-xs btn-warning checkout-btn" data-id="${c.id}">🚗 เริ่ม TD</button>` : ''}
                ${c.status === 'in_use' ? `<button class="btn btn-xs btn-success return-btn" data-id="${c.id}">✅ รับคืน</button>` : ''}
                ${c.status === 'charging' && c.soc >= 80 ? `<button class="btn btn-xs btn-success ready-btn" data-id="${c.id}">✅ พร้อมใช้</button>` : ''}
                ${c.status === 'available' && c.soc < 60 ? `<button class="btn btn-xs btn-primary charge-btn" data-id="${c.id}">⚡ ชาร์จ</button>` : ''}
                ${c.status === 'maintenance' ? `<button class="btn btn-xs btn-success fixed-btn" data-id="${c.id}">🔧 ซ่อมเสร็จ</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.checkout-btn').forEach(b => b.addEventListener('click', () => {
      const c = cars.find(x => x.id === b.dataset.id)
      if (c) openModal({
        title: '🚗 เริ่ม Test Drive: ' + escHtml(c.model),
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="td-customer"></div>
          <div class="input-group"><label class="input-label">เซลส์ที่ไปด้วย</label>
            <select class="input" id="td-staff"><option>วิชัย ยอดขาย</option><option>สุดา มาดี</option><option>ธนา เก่ง</option></select>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted)">📋 เช็คก่อนออก: ใบขับขี่ลูกค้า + ถ่ายรูปรอบคัน</div>
        </div>`,
        onConfirm() {
          const name = document.getElementById('td-customer')?.value?.trim()
          if (!name) { showToast('❗ กรอกชื่อลูกค้า', 'error'); return }
          c.status = 'in_use'
          c.note = `ลูกค้า: ${name} · เซลส์: ${document.getElementById('td-staff')?.value} · ออก ${new Date().toTimeString().slice(0,5)}`
          showToast('🚗 บันทึกออก Test Drive แล้ว', 'warning'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.return-btn').forEach(b => b.addEventListener('click', () => {
      const c = cars.find(x => x.id === b.dataset.id)
      if (c) {
        c.tdCount30++; c.soc = Math.max(5, c.soc - 8); c.mileage += 15; c.note = ''
        c.status = c.soc < 30 ? 'charging' : 'available'
        showToast('✅ รับรถคืนแล้ว' + (c.soc < 30 ? ' — แบตต่ำ ส่งชาร์จอัตโนมัติ' : ''), 'success'); renderPage()
      }
    }))
    container.querySelectorAll('.charge-btn').forEach(b => b.addEventListener('click', () => {
      const c = cars.find(x => x.id === b.dataset.id); if (c) { c.status = 'charging'; renderPage() }
    }))
    container.querySelectorAll('.ready-btn, .fixed-btn').forEach(b => b.addEventListener('click', () => {
      const c = cars.find(x => x.id === b.dataset.id)
      if (c) { c.status = 'available'; if (c.soc < 80) c.soc = 100; c.note = ''; showToast('✅ ' + c.plate + ' พร้อมใช้', 'success'); renderPage() }
    }))
    document.getElementById('add-car-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เพิ่มรถ Demo',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">รุ่น *</label><input class="input" id="dm-model"></div>
          <div class="input-group"><label class="input-label">ทะเบียน</label><input class="input" id="dm-plate" placeholder="ทด-006"></div>
        </div>`,
        onConfirm() {
          const model = document.getElementById('dm-model')?.value?.trim()
          if (!model) { showToast('❗ กรอกรุ่น', 'error'); return }
          cars.push({ id:`DM${String(cars.length+1).padStart(2,'0')}`, model, plate:document.getElementById('dm-plate')?.value||'ทด-ใหม่', soc:100, mileage:0, status:'available', tdCount30:0, lastClean:addDays(0), insuranceExp:addDays(365), note:'' })
          showToast('✅ เพิ่มรถ Demo แล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
