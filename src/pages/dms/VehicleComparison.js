import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { pickVehicle } from '../../utils/vehiclePicker.js'
import { getVehicles, getVehicleById } from '../../data/vehicleDatabase.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// แปลงข้อมูลรถจาก vehicleDatabase.js (แค็ตตาล็อกรถทุกรุ่นในไทย) ให้เข้ากับสเปกที่หน้านี้ต้องการ
function mapDbVehicle(v) {
  return {
    id: v.id, brand: v.brand, model: v.model, variant: v.variant, year: v.year,
    price: v.price || 0,
    battery: parseFloat(v.battery) || 0,
    range: v.range || 0,
    power: v.power || 0,
    torque: v.torque || 0,
    topSpeed: 0,
    accel: 0,
    charging_ac: 0,
    charging_dc: 0,
    seats: v.seats || 5,
    size: v.type || v.bodyType || '',
    weight: v.weight || 0,
    warranty_car: 0,
    warranty_battery: 0,
    colors: v.colors?.length || 0,
    warrantyText: v.warranty || '',
    features: [...(v.safety || []), ...(v.tech || [])],
    pros: [],
    cons: [],
  }
}

const SPEC_GROUPS = [
  { label: '💰 ราคาและการเงิน', specs: [
    { key: 'price', label: 'ราคาเริ่มต้น', format: 'currency', betterLow: true },
  ]},
  { label: '🔋 แบตเตอรี่และพิสัย', specs: [
    { key: 'battery', label: 'ความจุแบต (kWh)', format: 'number', unit: 'kWh', betterLow: false },
    { key: 'range', label: 'ระยะทาง (กม.)', format: 'number', unit: 'กม.', betterLow: false },
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
    { key: 'size', label: 'ประเภทรถ', format: 'text' },
    { key: 'seats', label: 'ที่นั่ง', format: 'number', unit: 'คน' },
    { key: 'weight', label: 'น้ำหนัก', format: 'number', unit: 'กก.', betterLow: true },
  ]},
  { label: '🛡 การรับประกัน', specs: [
    { key: 'warrantyText', label: 'การรับประกัน', format: 'text' },
  ]},
]

export default async function VehicleComparisonPage(container) {
  const catalog = getVehicles()
  const MAX_SELECT = 4
  let selected = catalog.slice(0, 3).map(v => v.id)

  function getSelected() {
    return selected.map(id => getVehicleById(id)).filter(Boolean).map(mapDbVehicle)
  }

  function renderPage() {
    const cars = getSelected()
    const selectedRaw = selected.map(id => getVehicleById(id)).filter(Boolean)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 Vehicle Comparison</div>
            <div class="page-subtitle">เปรียบเทียบรถยนต์ทุกรุ่นในฐานข้อมูล (${catalog.length} รุ่น) — สูงสุด ${MAX_SELECT} คัน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="clear-btn">🗑 ล้างทั้งหมด</button>
            <button class="btn btn-primary" id="add-vehicle-btn" ${selected.length >= MAX_SELECT ? 'disabled' : ''}>+ เพิ่มรถเปรียบเทียบ</button>
          </div>
        </div>

        <!-- Vehicle Selector -->
        <div class="card" style="padding:14px;margin-bottom:16px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">รถที่เลือกเปรียบเทียบ (${selected.length}/${MAX_SELECT})</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${selectedRaw.length ? selectedRaw.map(v => `
              <span class="badge badge-primary vehicle-chip" style="font-size:0.78rem;padding:6px 10px;cursor:default">
                ${escHtml(v.brand)} ${escHtml(v.model)} ${escHtml(v.variant)}
                <button class="vehicle-remove" data-id="${escHtml(v.id)}" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:4px;font-size:0.9rem;line-height:1">✕</button>
              </span>
            `).join('') : '<span style="color:var(--text-muted);font-size:0.8rem">ยังไม่ได้เลือกรถ — กด "+ เพิ่มรถเปรียบเทียบ"</span>'}
          </div>
        </div>

        ${cars.length < 2 ? `<div class="empty-state"><div class="empty-icon">🚗</div><div class="empty-title">เลือกรถอย่างน้อย 2 คันเพื่อเปรียบเทียบ</div></div>` : renderComparison(cars)}
      </div>
    `

    document.getElementById('clear-btn')?.addEventListener('click', () => { selected = []; renderPage() })
    document.getElementById('add-vehicle-btn')?.addEventListener('click', () => {
      if (selected.length >= MAX_SELECT) { showToast(`❗ เลือกได้สูงสุด ${MAX_SELECT} คัน`, 'warning'); return }
      pickVehicle(v => {
        if (selected.includes(v.id)) { showToast('เลือกรถคันนี้ไปแล้ว', 'warning'); return }
        selected.push(v.id)
        renderPage()
      })
    })
    container.querySelectorAll('.vehicle-remove').forEach(btn => btn.addEventListener('click', () => {
      selected = selected.filter(id => id !== btn.dataset.id)
      renderPage()
    }))
  }

  function renderComparison(cars) {
    const cols = cars.length

    function getBest(spec, cars) {
      if (spec.format === 'text') return null
      const vals = cars.map(c => c[spec.key]).filter(v => typeof v === 'number' && v > 0)
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
            <div style="padding:8px 12px;background:var(--primary-dim);border:1px solid var(--border);font-weight:700;font-size:0.8rem;color:var(--primary);grid-column:1/-1">${group.label}</div>
          </div>
          ${group.specs.map(spec => {
            const best = getBest(spec, cars)
            return `<div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
              <div style="padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center">${spec.label}</div>
              ${cars.map(car => {
                const val = car[spec.key]
                const isNum = typeof val === 'number'
                const isBest = isNum && val > 0 && val === best
                let display
                if (spec.format === 'currency') display = formatCurrency(val)
                else if (spec.format === 'decimal') display = val ? val.toFixed(1) + (spec.unit ? ' ' + spec.unit : '') : '-'
                else if (isNum) display = val > 0 ? val.toLocaleString() + (spec.unit ? ' ' + spec.unit : '') : '-'
                else display = escHtml(val || '-')
                return `<div style="padding:8px 12px;border:1px solid var(--border);text-align:center;background:${isBest ? 'rgba(34,197,94,.08)' : 'var(--surface)'};font-size:0.85rem;font-weight:${isBest ? '800' : '400'};color:${isBest ? 'var(--success)' : 'inherit'}">${display}${isBest ? ' ✓' : ''}</div>`
              }).join('')}
            </div>`
          }).join('')}
        `).join('')}

        <!-- Features comparison -->
        <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
          <div style="padding:8px 12px;background:var(--primary-dim);border:1px solid var(--border);font-weight:700;font-size:0.8rem;color:var(--primary);grid-column:1/-1">🛠 ฟีเจอร์และความปลอดภัย</div>
        </div>
        ${(() => {
          const allFeatures = [...new Set(cars.flatMap(c => c.features))].sort()
          if (!allFeatures.length) return `<div style="padding:12px;color:var(--text-muted);font-size:0.8rem">ไม่มีข้อมูลฟีเจอร์</div>`
          return allFeatures.map(feat => `
            <div style="display:grid;grid-template-columns:200px repeat(${cols},1fr);gap:0">
              <div style="padding:6px 12px;background:var(--surface-2);border:1px solid var(--border);font-size:0.78rem;color:var(--text-muted);display:flex;align-items:center">${escHtml(feat)}</div>
              ${cars.map(car => `<div style="padding:6px 12px;border:1px solid var(--border);text-align:center;font-size:0.9rem;background:var(--surface)">${car.features.includes(feat) ? '✅' : '❌'}</div>`).join('')}
            </div>
          `).join('')
        })()}
      </div>
    `
  }

  renderPage()
}
