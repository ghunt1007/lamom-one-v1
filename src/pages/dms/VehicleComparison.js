import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const VEHICLES = [
  { id: 'V001', brand: 'BYD', model: 'Seal', variant: 'Standard Range', year: 2024, price: 1199000,
    battery: 61.4, range: 460, power: 204, torque: 310, topSpeed: 175, accel: 7.5,
    charging_ac: 11, charging_dc: 150, seats: 5, size: 'D-Segment Sedan', weight: 2000,
    warranty_car: 6, warranty_battery: 8, colors: 6,
    features: ['AEB', 'ACC', 'Lane Assist', 'Blind Spot', 'Parking Sensor', '12.8" Touchscreen', 'HUD', 'OTA Update'],
    pros: ['ราคาคุ้มค่า', 'แบตใหญ่', 'ดีไซน์สวย'], cons: ['ศูนย์บริการน้อยกว่า Toyota', 'ประกันศูนย์สั้น'] },
  { id: 'V002', brand: 'BYD', model: 'Seal', variant: 'AWD', year: 2024, price: 1449000,
    battery: 82.5, range: 580, power: 390, torque: 670, topSpeed: 200, accel: 3.8,
    charging_ac: 11, charging_dc: 150, seats: 5, size: 'D-Segment Sedan', weight: 2150,
    warranty_car: 6, warranty_battery: 8, colors: 6,
    features: ['AEB', 'ACC', 'Lane Assist', 'Blind Spot', 'Parking Sensor', '12.8" Touchscreen', 'HUD', 'OTA Update', 'AWD', 'Dynamic Stability'],
    pros: ['สมรรถนะสูง', 'ระยะทางไกล', 'ขับเคลื่อน 4 ล้อ'], cons: ['ราคาสูงกว่า', 'หนักกว่า'] },
  { id: 'V003', brand: 'MG', model: 'ZS EV', variant: 'Grand Luxury', year: 2024, price: 1059000,
    battery: 72.6, range: 500, power: 176, torque: 280, topSpeed: 175, accel: 8.5,
    charging_ac: 7, charging_dc: 80, seats: 5, size: 'B-Segment SUV', weight: 1725,
    warranty_car: 5, warranty_battery: 7, colors: 5,
    features: ['AEB', 'ACC', 'Lane Assist', '10.1" Touchscreen', 'Parking Camera', 'Apple CarPlay'],
    pros: ['ราคาดี', 'ประหยัด', 'เป็น SUV'], cons: ['DC Charge ช้า', 'Power น้อยกว่า BYD'] },
  { id: 'V004', brand: 'BYD', model: 'Atto 3', variant: 'Extended', year: 2024, price: 1099000,
    battery: 60.5, range: 480, power: 150, torque: 310, topSpeed: 160, accel: 7.3,
    charging_ac: 7, charging_dc: 88, seats: 5, size: 'C-Segment SUV', weight: 1750,
    warranty_car: 6, warranty_battery: 8, colors: 7,
    features: ['AEB', 'ACC', 'Blind Spot', '12.8" Touchscreen', 'Rotating Screen', 'OTA Update', 'Guitar-shaped Door Handles'],
    pros: ['ดีไซน์โดดเด่น', 'ขนาดพอดี', 'Feature จัดเต็ม'], cons: ['Power น้อยสุด', 'ไม่มี DC Fast Charge เร็ว'] },
  { id: 'V005', brand: 'Neta', model: 'V', variant: 'Standard', year: 2024, price: 619000,
    battery: 38.5, range: 340, power: 95, torque: 150, topSpeed: 140, accel: 9.9,
    charging_ac: 6.6, charging_dc: 30, seats: 5, size: 'A-Segment Hatchback', weight: 1320,
    warranty_car: 5, warranty_battery: 8, colors: 5,
    features: ['Parking Camera', '10.25" Touchscreen', 'Keyless Entry', 'LED Lights'],
    pros: ['ราคาถูกที่สุด', 'เหมาะในเมือง', 'ประกันแบตนาน'], cons: ['ระยะสั้น', 'DC Charge ช้า', 'ไม่มี ADAS'] },
]

const SPEC_GROUPS = [
  { label: '💰 ราคาและการเงิน', specs: [
    { key: 'price', label: 'ราคาเริ่มต้น', format: 'currency', betterLow: true },
  ]},
  { label: '🔋 แบตเตอรี่และพิสัย', specs: [
    { key: 'battery', label: 'ความจุแบต (kWh)', format: 'number', unit: 'kWh', betterLow: false },
    { key: 'range', label: 'ระยะทาง NEDC (กม.)', format: 'number', unit: 'กม.', betterLow: false },
    { key: 'charging_dc', label: 'DC Fast Charge (kW)', format: 'number', unit: 'kW', betterLow: false },
    { key: 'charging_ac', label: 'AC Charge (kW)', format: 'number', unit: 'kW', betterLow: false },
  ]},
  { label: '⚡ สมรรถนะ', specs: [
    { key: 'power', label: 'กำลัง (HP)', format: 'number', unit: 'HP', betterLow: false },
    { key: 'torque', label: 'แรงบิด (Nm)', format: 'number', unit: 'Nm', betterLow: false },
    { key: 'topSpeed', label: 'ความเร็วสูงสุด', format: 'number', unit: 'กม./ชม.', betterLow: false },
    { key: 'accel', label: '0-100 กม./ชม.', format: 'decimal', unit: 'วินาที', betterLow: true },
  ]},
  { label: '📐 ขนาดและที่นั่ง', specs: [
    { key: 'size', label: 'ขนาดรถ', format: 'text' },
    { key: 'seats', label: 'ที่นั่ง', format: 'number', unit: 'คน' },
    { key: 'weight', label: 'น้ำหนัก', format: 'number', unit: 'กก.', betterLow: true },
  ]},
  { label: '🛡 การรับประกัน', specs: [
    { key: 'warranty_car', label: 'รับประกันตัวรถ', format: 'number', unit: 'ปี', betterLow: false },
    { key: 'warranty_battery', label: 'รับประกันแบต', format: 'number', unit: 'ปี', betterLow: false },
  ]},
]

export default async function VehicleComparisonPage(container) {
  const myGen = container.__routerGen
  let selected = ['V001', 'V002', 'V003']
  const MAX_SELECT = 4
  let vehicles = VEHICLES.map(v => ({ ...v, features: [...v.features], pros: [...v.pros], cons: [...v.cons] }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('vehicles', [], 'price', 'asc', 50).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.filter(d => d.model && d.price > 0).map((d, i) => ({
        id: d.id || `V${String(i+1).padStart(3,'0')}`,
        brand: d.brand || '',
        model: d.model || '',
        variant: d.variant || '',
        year: d.year || new Date().getFullYear(),
        price: d.price || 0,
        battery: d.battery || 0,
        range: d.range || 0,
        power: d.power || 0,
        torque: d.torque || 0,
        topSpeed: d.topSpeed || 0,
        accel: d.accel || 0,
        charging_ac: d.charging_ac || 0,
        charging_dc: d.charging_dc || 0,
        seats: d.seats || 5,
        size: d.size || '',
        weight: d.weight || 0,
        warranty_car: d.warranty_car || 5,
        warranty_battery: d.warranty_battery || 8,
        colors: d.colors || 1,
        features: d.features || [],
        pros: d.pros || [],
        cons: d.cons || [],
      }))
      vehicles = [...mapped, ...VEHICLES]
      dataSource = 'live'
      selected = vehicles.slice(0, 3).map(v => v.id)
    }
  } catch {}

  function getSelected() { return selected.map(id => vehicles.find(v => v.id === id)).filter(Boolean) }

  function renderPage() {
    const cars = getSelected()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 Vehicle Comparison</div>
            <div class="page-subtitle">เปรียบเทียบรถยนต์ EV — สูงสุด ${MAX_SELECT} คัน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="clear-btn">🗑 ล้างทั้งหมด</button>
          </div>
        </div>

        <!-- Vehicle Selector -->
        <div class="card" style="padding:14px;margin-bottom:16px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">เลือกรถที่ต้องการเปรียบเทียบ</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${VEHICLES.map(v => {
              const isSelected = selected.includes(v.id)
              return `<button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'} vehicle-toggle" data-id="${escHtml(v.id)}">
                ${isSelected ? '✓ ' : ''}${escHtml(v.brand)} ${escHtml(v.model)} ${escHtml(v.variant)}
              </button>`
            }).join('')}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">เลือกแล้ว ${selected.length}/${MAX_SELECT} คัน</div>
        </div>

        ${cars.length < 2 ? `<div class="empty-state"><div class="empty-state-icon">🚗</div><div>เลือกรถอย่างน้อย 2 คันเพื่อเปรียบเทียบ</div></div>` : renderComparison(cars)}
      </div>
    `

    document.getElementById('clear-btn')?.addEventListener('click', () => { selected = []; renderPage() })
    document.querySelectorAll('.vehicle-toggle').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.id
        if (selected.includes(id)) {
          selected = selected.filter(x => x !== id)
        } else {
          if (selected.length >= MAX_SELECT) { showToast(`❗ เลือกได้สูงสุด ${MAX_SELECT} คัน`, 'warning'); return }
          selected.push(id)
        }
        renderPage()
      })
    })
  }

  function renderComparison(cars) {
    const cols = cars.length

    // Find best value for each spec
    function getBest(spec, cars) {
      if (spec.format === 'text') return null
      const vals = cars.map(c => c[spec.key]).filter(v => typeof v === 'number')
      if (!vals.length) return null
      return spec.betterLow ? Math.min(...vals) : Math.max(...vals)
    }

    return `
      <div style="overflow-x:auto">
        <!-- Header row with car names -->
        <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0;margin-bottom:0">
          <div style="padding:12px;background:var(--surface-2);border:1px solid var(--border);font-weight:700;font-size:0.82rem">ข้อมูล</div>
          ${cars.map(car => `
            <div style="padding:12px;background:var(--surface);border:1px solid var(--border);text-align:center">
              <div style="font-weight:800;font-size:0.88rem">${escHtml(car.brand)} ${escHtml(car.model)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(car.variant)} ${car.year}</div>
              <div style="font-size:1rem;font-weight:900;color:var(--primary);margin-top:4px">${formatCurrency(car.price)}</div>
            </div>
          `).join('')}
        </div>

        ${SPEC_GROUPS.map(group => `
          <!-- Group header -->
          <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
            <div colspan="${cols+1}" style="padding:8px 12px;background:var(--primary-dim);border:1px solid var(--border);font-weight:700;font-size:0.8rem;color:var(--primary);grid-column:1/-1">${group.label}</div>
          </div>
          ${group.specs.map(spec => {
            const best = getBest(spec, cars)
            return `<div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
              <div style="padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center">${spec.label}</div>
              ${cars.map(car => {
                const val = car[spec.key]
                const isNum = typeof val === 'number'
                const isBest = isNum && val === best
                let display
                if (spec.format === 'currency') display = formatCurrency(val)
                else if (spec.format === 'decimal') display = val?.toFixed(1) + (spec.unit ? ' ' + spec.unit : '')
                else if (isNum) display = val?.toLocaleString() + (spec.unit ? ' ' + spec.unit : '')
                else display = escHtml(val || '-')
                return `<td style="padding:8px 12px;border:1px solid var(--border);text-align:center;background:${isBest ? (spec.betterLow ? 'rgba(34,197,94,.08)' : 'rgba(34,197,94,.08)') : 'var(--surface)'};font-size:0.85rem;font-weight:${isBest?'800':'400'};color:${isBest?'var(--success)':'inherit'}">${display}${isBest ? ' ✓' : ''}</td>`
              }).join('')}
            </div>`
          }).join('')}
        `).join('')}

        <!-- Features comparison -->
        <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
          <div style="padding:8px 12px;background:var(--primary-dim);border:1px solid var(--border);font-weight:700;font-size:0.8rem;color:var(--primary);grid-column:1/-1">🛠 ฟีเจอร์หลัก</div>
        </div>
        ${(() => {
          const allFeatures = [...new Set(cars.flatMap(c => c.features))].sort()
          return allFeatures.map(feat => `
            <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
              <div style="padding:6px 12px;background:var(--surface-2);border:1px solid var(--border);font-size:0.78rem;color:var(--text-muted);display:flex;align-items:center">${escHtml(feat)}</div>
              ${cars.map(car => `<div style="padding:6px 12px;border:1px solid var(--border);text-align:center;font-size:0.9rem;background:var(--surface)">${car.features.includes(feat) ? '✅' : '❌'}</div>`).join('')}
            </div>
          `).join('')
        })()}

        <!-- Pros/Cons -->
        <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0;margin-top:16px">
          ${cars.map((car, i) => `
            <div style="${i===0?'padding:12px;background:var(--surface-2);border:1px solid var(--border);font-weight:700;font-size:0.82rem;grid-column:1':''}">
              ${i===0 ? '👍 ข้อดี / 👎 ข้อเสีย' : ''}
            </div>
          `).join('')}
        </div>
        <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
          <div style="padding:12px;background:var(--surface-2);border:1px solid var(--border);font-size:0.8rem;color:var(--text-muted)">👍 ข้อดี</div>
          ${cars.map(car => `<div style="padding:12px;border:1px solid var(--border);font-size:0.8rem">
            ${car.pros.map(p => `<div style="color:var(--success);margin-bottom:2px">✓ ${escHtml(p)}</div>`).join('')}
          </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
          <div style="padding:12px;background:var(--surface-2);border:1px solid var(--border);font-size:0.8rem;color:var(--text-muted)">👎 ข้อเสีย</div>
          ${cars.map(car => `<div style="padding:12px;border:1px solid var(--border);font-size:0.8rem">
            ${car.cons.map(c => `<div style="color:var(--danger);margin-bottom:2px">✗ ${escHtml(c)}</div>`).join('')}
          </div>`).join('')}
        </div>
      </div>
    `
  }

  renderPage()
}
