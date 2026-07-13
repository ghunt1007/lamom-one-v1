/**
 * Vehicle Database — ข้อมูลรถทุกยี่ห้อที่ขายในประเทศไทย
 * Route: /dms/vehicle-db
 */
import {
  BRANDS, FUEL_TYPES, searchVehicles, getVehicles,
  loadOverrides, loadAdditions, loadDeletions,
  saveOverride, clearOverride, saveAddition, deleteVehicle,
  restoreDeleted, resetUserData, exportUserData, importUserData,
} from '../../data/vehicleDatabase.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const FUEL_LABELS = { Petrol:'เบนซิน', Diesel:'ดีเซล', Hybrid:'ไฮบริด', 'PHEV':'PHEV', BEV:'ไฟฟ้า 100%' }
const FUEL_COLORS = { Petrol:'var(--text-muted)', Diesel:'var(--warning)', Hybrid:'var(--success)', PHEV:'var(--primary)', BEV:'#00b4d8' }
const TYPE_ICONS = { sedan:'🚗', suv:'🚙', pickup:'🛻', mpv:'🚌', hatchback:'🚗', roadster:'🏎' }

function fuelBadge(fuel) {
  const c = FUEL_COLORS[fuel] || 'var(--text-muted)'
  const l = FUEL_LABELS[fuel] || fuel
  return '<span style="font-size:0.6rem;padding:2px 7px;border-radius:10px;background:' + c + '22;color:' + c + ';font-weight:700;border:1px solid ' + c + '44">' + l + '</span>'
}

function priceStr(p) {
  return p >= 1000000 ? (p / 1000000).toFixed(2) + ' ล.' : (p / 1000).toFixed(0) + 'K'
}

function carCard(v) {
  const icon = TYPE_ICONS[v.bodyType] || '🚗'
  const rangeHtml = v.fuel === 'BEV' || v.fuel === 'PHEV'
    ? '<div style="font-size:0.64rem;color:#00b4d8">⚡ ' + (v.range > 0 ? v.range + ' km' : 'PHEV ' + v.battery) + '</div>'
    : '<div style="font-size:0.64rem;color:var(--success)">⛽ ' + (v.fuelEconomy || '-') + '</div>'
  return '<div class="card vehicle-card" data-id="' + v.id + '" style="padding:14px;cursor:pointer;transition:transform .15s;margin-bottom:0">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
      '<div style="font-size:1.1rem">' + icon + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">' + fuelBadge(v.fuel) + verifiedBadge(v) + '</div>' +
    '</div>' +
    '<div style="font-weight:800;font-size:0.82rem;color:var(--text);margin-bottom:1px">' + v.brand + '</div>' +
    '<div style="font-size:0.78rem;font-weight:600;margin-bottom:2px">' + v.model + '</div>' +
    '<div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:8px;line-height:1.3">' + v.variant + '</div>' +
    rangeHtml +
    '<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">' +
      '<div>' +
        '<div style="font-size:0.65rem;color:var(--text-muted)">ราคา</div>' +
        '<div style="font-size:0.92rem;font-weight:900;color:var(--primary)">฿' + priceStr(v.price) + '</div>' +
      '</div>' +
      '<div style="font-size:0.65rem;color:var(--text-muted);text-align:right">ปี ' + v.year + '<br>' + v.seats + ' ที่นั่ง</div>' +
    '</div>' +
  '</div>'
}

function safetyRows(arr) {
  return arr.map(s => '<div style="font-size:0.74rem;padding:4px 0;border-bottom:1px solid var(--border-subtle)">✅ ' + s + '</div>').join('')
}
function techRows(arr) {
  return arr.map(t => '<div style="font-size:0.74rem;padding:4px 0;border-bottom:1px solid var(--border-subtle)">🔧 ' + t + '</div>').join('')
}
function bulletRows(arr, icon) {
  if (!arr || !arr.length) return ''
  return arr.map(t => '<div style="font-size:0.74rem;padding:4px 0;border-bottom:1px solid var(--border-subtle);line-height:1.4">' + icon + ' ' + t + '</div>').join('')
}
function prosConsBox(title, arr, icon, color) {
  if (!arr || !arr.length) return ''
  return '<div style="flex:1;background:var(--surface-2);border-radius:8px;padding:10px;border-top:3px solid ' + color + '">' +
    '<div style="font-weight:700;font-size:0.74rem;margin-bottom:6px;color:' + color + '">' + title + '</div>' +
    arr.map(t => '<div style="font-size:0.72rem;padding:3px 0;line-height:1.4">' + icon + ' ' + t + '</div>').join('') +
  '</div>'
}
function colorDots(arr) {
  return arr.map(c => '<span style="display:inline-block;padding:2px 8px;margin:2px;font-size:0.64rem;background:var(--surface-2);border-radius:10px">' + c + '</span>').join('')
}

function specRow(label, val) {
  if (!val && val !== 0) return ''
  return '<tr>' +
    '<td style="padding:6px 10px;font-size:0.72rem;color:var(--text-muted);width:40%">' + label + '</td>' +
    '<td style="padding:6px 10px;font-size:0.74rem;font-weight:600">' + val + '</td>' +
  '</tr>'
}

function buildModal(v) {
  const icon = TYPE_ICONS[v.bodyType] || '🚗'
  const evSection = (v.fuel === 'BEV' || v.fuel === 'PHEV')
    ? specRow('แบตเตอรี่', v.battery) +
      specRow(v.fuel === 'PHEV' ? 'ระยะทางไฟฟ้า' : 'ระยะทาง (NEDC/CLTC)', v.range > 0 ? v.range + ' km' : '-') +
      specRow('ชาร์จ AC (Onboard)', v.chargeAC ? v.chargeAC + ' kW' : '') +
      specRow('ชาร์จเร็ว DC (สูงสุด)', v.chargeDC ? v.chargeDC + ' kW' : '') +
      specRow('เวลาชาร์จเร็ว', v.chargeTime || '') +
      (v.fuel === 'PHEV' ? specRow('ถังน้ำมัน', v.fuelTank ? v.fuelTank + ' ลิตร' : '') : '')
    : specRow('อัตราสิ้นเปลือง', v.fuelEconomy) + specRow('ถังน้ำมัน', v.fuelTank ? v.fuelTank + ' ลิตร' : '')

  const body = '<div style="font-size:0.82rem">' +
    '<div style="background:var(--surface-2);padding:12px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">' +
      '<div>' +
        '<div style="font-size:1.3rem;font-weight:900">' + icon + ' ' + v.brand + ' ' + v.model + '</div>' +
        '<div style="font-size:0.76rem;color:var(--text-muted)">' + v.variant + ' · ปี ' + v.year + '</div>' +
      '</div>' +
      fuelBadge(v.fuel) +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">' +
      '<div class="card" style="padding:10px;text-align:center"><div style="font-size:0.64rem;color:var(--text-muted)">ราคาเริ่มต้น</div><div style="font-size:1rem;font-weight:900;color:var(--primary)">฿' + v.priceMin.toLocaleString() + '</div></div>' +
      '<div class="card" style="padding:10px;text-align:center"><div style="font-size:0.64rem;color:var(--text-muted)">ราคาสูงสุด</div><div style="font-size:1rem;font-weight:900;color:var(--warning)">฿' + v.priceMax.toLocaleString() + '</div></div>' +
      '<div class="card" style="padding:10px;text-align:center"><div style="font-size:0.64rem;color:var(--text-muted)">ที่นั่ง</div><div style="font-size:1rem;font-weight:900;color:var(--success)">' + v.seats + ' ที่นั่ง</div></div>' +
    '</div>' +
    (v.ncap ? '<div style="background:var(--surface-2);border-left:4px solid var(--success);padding:8px 12px;border-radius:6px;margin-bottom:8px;font-size:0.74rem"><strong style="color:var(--success)">🏆 ผลทดสอบความปลอดภัย (NCAP):</strong> ' + v.ncap + '</div>' : '') +
    (v.ecoSticker ? '<div style="background:var(--surface-2);border-left:4px solid var(--warning);padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:0.74rem"><strong style="color:var(--warning)">🌱 ECO Sticker:</strong> ' + v.ecoSticker + '</div>' : '') +
    '<div style="font-weight:700;font-size:0.76rem;margin-bottom:6px;color:var(--primary)">⚙️ สเปคเครื่องยนต์/ระบบขับเคลื่อน</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;background:var(--surface-2);border-radius:8px;overflow:hidden">' +
      '<tbody>' +
      specRow('เครื่องยนต์', v.engine) +
      specRow('กำลัง', v.power + ' แรงม้า') +
      specRow('แรงบิด', v.torque + ' Nm') +
      specRow('เกียร์', v.transmission) +
      specRow('ขับเคลื่อน', v.drivetrain) +
      specRow('เชื้อเพลิง', FUEL_LABELS[v.fuel] || v.fuel) +
      evSection +
      specRow('CO₂ (g/km)', v.co2 === 0 ? '0 (BEV)' : v.co2) +
      '</tbody>' +
    '</table>' +
    '<div style="font-weight:700;font-size:0.76rem;margin-bottom:6px;color:var(--primary)">📐 ขนาดตัวรถ</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;background:var(--surface-2);border-radius:8px;overflow:hidden">' +
      '<tbody>' +
      specRow('ความยาว × กว้าง × สูง', v.length + ' × ' + v.width + ' × ' + v.height + ' mm') +
      specRow('ระยะฐานล้อ', v.wheelbase + ' mm') +
      specRow('น้ำหนักรถ', v.weight + ' kg') +
      specRow('ความจุท้ายรถ', v.bootSpace ? v.bootSpace + ' ลิตร' : '') +
      specRow('ที่เก็บของด้านหน้า (Frunk)', v.frunk ? v.frunk + ' ลิตร' : '') +
      specRow('ระยะต่ำสุดจากพื้น', v.groundClearance ? v.groundClearance + ' mm' : '') +
      specRow('ถุงลมนิรภัย', v.airbags ? v.airbags + ' ใบ' : '') +
      specRow('ลากจูงสูงสุด', v.towCapacity ? v.towCapacity.toLocaleString() + ' kg' : '') +
      '</tbody>' +
    '</table>' +
    '<div style="font-weight:700;font-size:0.76rem;margin-bottom:6px;color:var(--primary)">🛡 ระบบความปลอดภัย</div>' +
    '<div style="background:var(--surface-2);padding:10px;border-radius:8px;margin-bottom:12px">' + safetyRows(v.safety) + '</div>' +
    '<div style="font-weight:700;font-size:0.76rem;margin-bottom:6px;color:var(--primary)">🔧 เทคโนโลยี / อุปกรณ์</div>' +
    '<div style="background:var(--surface-2);padding:10px;border-radius:8px;margin-bottom:12px">' + techRows(v.tech) + '</div>' +
    (v.adas && v.adas.length
      ? '<div style="font-weight:700;font-size:0.76rem;margin-bottom:6px;color:var(--primary)">🤖 ระบบขับขี่อัจฉริยะ (ADAS)</div>' +
        '<div style="background:var(--surface-2);padding:10px;border-radius:8px;margin-bottom:12px">' + bulletRows(v.adas, '🤖') + '</div>'
      : '') +
    '<div style="font-weight:700;font-size:0.76rem;margin-bottom:6px;color:var(--primary)">🎨 สีภายนอก</div>' +
    '<div style="margin-bottom:12px">' + colorDots(v.colors) + '</div>' +
    (v.interiorColors && v.interiorColors.length
      ? '<div style="font-weight:700;font-size:0.76rem;margin-bottom:6px;color:var(--primary)">🪑 สีภายใน</div>' +
        '<div style="margin-bottom:12px">' + colorDots(v.interiorColors) + '</div>'
      : '') +
    ((v.strengths && v.strengths.length) || (v.weaknesses && v.weaknesses.length)
      ? '<div style="display:flex;gap:8px;margin-bottom:12px">' +
          prosConsBox('💪 จุดแข็ง', v.strengths, '▸', 'var(--success)') +
          prosConsBox('🔻 จุดอ่อน', v.weaknesses, '▸', 'var(--warning)') +
        '</div>'
      : '') +
    ((v.pros && v.pros.length) || (v.cons && v.cons.length)
      ? '<div style="display:flex;gap:8px;margin-bottom:12px">' +
          prosConsBox('👍 ข้อดี', v.pros, '✓', 'var(--primary)') +
          prosConsBox('👎 ข้อเสีย', v.cons, '✗', 'var(--danger)') +
        '</div>'
      : '') +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<div class="card" style="padding:10px"><div style="font-size:0.64rem;color:var(--text-muted)">การรับประกัน</div><div style="font-size:0.74rem;font-weight:600">' + v.warranty + '</div></div>' +
      '<div class="card" style="padding:10px"><div style="font-size:0.64rem;color:var(--text-muted)">ผู้นำเข้า / ประกอบ</div><div style="font-size:0.74rem;font-weight:600">' + v.importer + ' · ' + v.origin + '</div></div>' +
    '</div>' +
  '</div>'

  return { title: icon + ' ' + v.brand + ' ' + v.model + ' ' + v.variant, body }
}

// ── AI Live Lookup: ดึงข้อมูลรถคันไหนก็ได้แบบ real-time ผ่าน Claude API ──────────
// อ่าน key จาก localStorage เท่านั้น — ไม่แสดง key ออกที่ใดทั้งสิ้น (security)
const AI_SCHEMA = 'brand, model, variant, year, type, fuel(Petrol|Diesel|Hybrid|PHEV|BEV), bodyType(sedan|suv|pickup|mpv|hatchback|roadster), price, priceMin, priceMax (THB), engine, power(hp number), torque(Nm number), transmission, drivetrain, battery(string e.g. "60 kWh" or ""), range(km number, 0 if ICE), length, width, height, wheelbase, weight, seats, bootSpace(L), frunk(L front trunk, 0 if none), fuelTank(L, 0 if BEV), groundClearance(mm), airbags(number), towCapacity(kg, 0 if none), chargeAC(kW onboard AC charger, 0 if ICE), chargeDC(kW DC fast charge peak, 0 if ICE), chargeTime(string e.g "DC 30→80% ~30 นาที" Thai, "" if ICE), fuelEconomy(string e.g "15 km/L" or ""), co2(number, 0 if BEV), safety(array of strings — list ALL airbags/ABS/ESP/AEB etc), tech(array of strings), adas(array of intelligent-driving/ADAS feature strings in Thai), ncap(string — ASEAN/Euro NCAP star rating + year + scores if known, Thai), ecoSticker(string — Thai ECO Sticker info: CO2 g/km + emission, "" if unknown), warranty(string), colors(array of exterior colors), interiorColors(array of interior color names), strengths(array 3-4 จุดแข็ง Thai), weaknesses(array 3-4 จุดอ่อน Thai), pros(array 3-4 ข้อดี Thai), cons(array 3-4 ข้อเสีย Thai), importer, origin'

// เรียก Claude API (อ่าน key จาก localStorage เท่านั้น) แล้วคืน JSON object
async function callClaudeJSON(prompt, maxTokens) {
  const apiKey = localStorage.getItem('sk_claude_api_key')
  if (!apiKey) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens || 1800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) { const e = new Error('API_' + res.status); e.code = 'API_' + res.status; throw e }
  const data = await res.json()
  const text = (data.content && data.content[0] && data.content[0].text) || ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('PARSE')
  return JSON.parse(m[0])
}

async function aiLookup(queryText) {
  const prompt = 'คุณคือฐานข้อมูลรถยนต์ที่ขายในประเทศไทยที่แม่นยำที่สุด (ข้อมูลปี 2025-2026). ' +
    'ผู้ใช้ค้นหา: "' + queryText + '". ' +
    'ตอบกลับเป็น JSON object เดียวของรถรุ่นย่อยที่ตรงที่สุดที่ขายในไทย โดยใช้ฟิลด์เหล่านี้ (ค่าตัวเลขให้เป็น number ไม่ใส่คอมมา): ' +
    AI_SCHEMA +
    '. ราคาเป็นบาท. ถ้าไม่ใช่รถไฟฟ้าให้ battery="" range=0 chargeAC=0 chargeDC=0. ' +
    'ห้ามมีข้อความอื่นนอก JSON. ถ้าไม่รู้จักรถคันนี้ให้ตอบ {"error":"not_found"}.'
  const obj = await callClaudeJSON(prompt, 1800)
  if (obj.error) { const e = new Error('NOT_FOUND'); e.code = 'NOT_FOUND'; throw e }
  obj.id = 'AI_' + Date.now()
  return obj
}

// ตรวจสอบ/อัปเดตข้อมูลรถที่มีอยู่ ด้วย AI — คืน { vehicle, changes[] }
async function aiVerifyVehicle(v) {
  const prompt = 'คุณคือผู้เชี่ยวชาญข้อมูลรถยนต์ที่ขายในประเทศไทย (อ้างอิงสเปก official ผู้ผลิต + สื่อ + รีวิวจริง ปี 2025-2026). ' +
    'นี่คือข้อมูลรถในฐานข้อมูล (JSON):\n' + JSON.stringify(v) + '\n' +
    'งานของคุณ: ตรวจสอบทุกฟิลด์ว่าตรงกับความจริงของรถรุ่นย่อยนี้ที่ขายในไทยหรือไม่ แก้ไขฟิลด์ที่ผิด และเติม/ขยายฟิลด์ที่ยังไม่ละเอียดพอ (เช่น safety, adas, ncap, ecoSticker, strengths, weaknesses, pros, cons, colors, interiorColors). ' +
    'ใช้ชุดฟิลด์: ' + AI_SCHEMA + ', chargeTime. ' +
    'ตอบเป็น JSON เท่านั้น รูปแบบ: {"vehicle": {ออบเจ็กต์รถที่ถูกต้องครบทุกฟิลด์ คง id เดิม}, "changes": [{"field":"ชื่อฟิลด์","old":"ค่าเดิม","new":"ค่าใหม่","reason":"เหตุผลสั้นๆภาษาไทย"}]}. ' +
    'ถ้าทุกอย่างถูกต้องแล้วให้ changes เป็น []. ห้ามมีข้อความนอก JSON.'
  const result = await callClaudeJSON(prompt, 3000)
  if (result.vehicle) result.vehicle.id = v.id
  return result
}

function verifiedBadge(v) {
  if (!v._verifiedBy) return ''
  const c = v._verifiedBy === 'AI' ? '#00b4d8' : 'var(--success)'
  const icon = v._verifiedBy === 'AI' ? '🤖' : '✅'
  return '<span style="font-size:0.55rem;padding:1px 6px;border-radius:8px;background:' + c + '22;color:' + c + ';font-weight:700;border:1px solid ' + c + '55">' + icon + ' verified</span>'
}

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
}
function blankVehicle() {
  return {
    id: 'NEW_' + Date.now(), brand: '', model: '', variant: '', year: 2026, type: 'SUV', fuel: 'BEV', bodyType: 'suv',
    price: 0, priceMin: 0, priceMax: 0, engine: '', power: 0, torque: 0, transmission: '', drivetrain: '', battery: '', range: 0,
    length: 0, width: 0, height: 0, wheelbase: 0, weight: 0, seats: 5,
    bootSpace: 0, frunk: 0, fuelTank: 0, groundClearance: 0, airbags: 0, towCapacity: 0, chargeAC: 0, chargeDC: 0, chargeTime: '',
    fuelEconomy: '', co2: 0, safety: [], tech: [], adas: [], ncap: '', ecoSticker: '', warranty: '',
    colors: [], interiorColors: [], strengths: [], weaknesses: [], pros: [], cons: [], importer: '', origin: '',
  }
}

export default async function VehicleDatabasePage(container) {
  const myGen = container.__routerGen
  let filter = { brand: '', fuel: '', query: '' }
  let viewMode = 'grid'
  let WV = getVehicles() // (ฐาน + เพิ่ม) − ลบ + override — cache โหลดจาก Firestore ตอน bootstrap

  function refreshWV() { WV = getVehicles() }

  function getFiltered() {
    return WV.filter(v => {
      if (filter.brand && v.brand !== filter.brand) return false
      if (filter.fuel && v.fuel !== filter.fuel) return false
      if (filter.query) {
        const q = filter.query.toLowerCase()
        return (v.brand + ' ' + v.model + ' ' + v.variant).toLowerCase().includes(q)
      }
      return true
    })
  }

  function brandOpts() {
    const brands = [...new Set(WV.map(v => v.brand))].sort()
    return '<option value="">ทุกยี่ห้อ</option>' +
      brands.map(b => '<option value="' + b + '" ' + (filter.brand === b ? 'selected' : '') + '>' + b + '</option>').join('')
  }

  function fuelOpts() {
    return '<option value="">ทุกประเภท</option>' +
      FUEL_TYPES.map(f => '<option value="' + f + '" ' + (filter.fuel === f ? 'selected' : '') + '>' + (FUEL_LABELS[f] || f) + '</option>').join('')
  }

  function fuelTabBtns() {
    const tabs = [['','ทั้งหมด'],['BEV','ไฟฟ้า'],['Hybrid','ไฮบริด'],['PHEV','PHEV'],['Petrol','เบนซิน'],['Diesel','ดีเซล']]
    return tabs.map(([k, l]) =>
      '<button class="btn btn-sm ' + (filter.fuel === k ? 'btn-primary' : 'btn-secondary') + ' fuel-tab" data-fuel="' + k + '">' + l + '</button>'
    ).join('')
  }

  function statCard(l, v, c) {
    return '<div class="card" style="padding:12px 14px">' +
      '<div style="font-size:0.68rem;color:var(--text-muted)">' + l + '</div>' +
      '<div style="font-size:1.1rem;font-weight:900;color:' + c + ';margin-top:2px">' + v + '</div>' +
    '</div>'
  }

  function render() {
    const filtered = getFiltered()
    const evCount = WV.filter(v => v.fuel === 'BEV').length
    const hybridCount = WV.filter(v => v.fuel === 'Hybrid' || v.fuel === 'PHEV').length
    const brandCount = [...new Set(WV.map(v => v.brand))].length

    const gridHtml = filtered.length === 0
      ? '<div style="text-align:center;padding:40px;color:var(--text-muted)">ไม่พบรถที่ค้นหา</div>'
      : '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">' +
          filtered.map(v => carCard(v)).join('') +
        '</div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚘 Vehicle Database</div>
            <div class="page-subtitle">ข้อมูลรถทุกยี่ห้อที่ขายในประเทศไทย · ราคา สเปค ครบถ้วน</div>
          </div>
          <div class="page-actions">
            <input type="text" id="search-input" placeholder="ค้นหา ยี่ห้อ รุ่น รุ่นย่อย..." value="${filter.query}"
              style="padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:0.78rem;width:220px">
            <button class="btn btn-primary" id="ai-lookup-btn">🤖 ค้นด้วย AI</button>
            <button class="btn btn-secondary" id="ai-batch-btn">✨ ตรวจทั้งหมดด้วย AI</button>
            <button class="btn btn-secondary" id="add-vehicle-btn">➕ เพิ่มรถ</button>
            <button class="btn btn-secondary" id="data-mgr-btn">💾 ข้อมูล</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          ${statCard('🚗 รุ่นทั้งหมด', WV.length + ' รุ่น', 'var(--primary)')}
          ${statCard('🏭 ยี่ห้อ', brandCount + ' ยี่ห้อ', 'var(--warning)')}
          ${statCard('⚡ รถไฟฟ้า (BEV)', evCount + ' รุ่น', '#00b4d8')}
          ${statCard('✅ ยืนยันข้อมูลแล้ว', WV.filter(v => v._verifiedBy).length + ' รุ่น', 'var(--success)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
          ${fuelTabBtns()}
          <select id="brand-select" style="padding:5px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:0.74rem">
            ${brandOpts()}
          </select>
          <span style="margin-left:auto;font-size:0.74rem;color:var(--text-muted);padding:6px 0">พบ <strong>${filtered.length}</strong> รุ่น</span>
        </div>

        ${gridHtml}
      </div>`

    container.querySelectorAll('.fuel-tab').forEach(b => b.addEventListener('click', () => {
      filter.fuel = b.dataset.fuel
      render()
    }))

    const brandSel = document.getElementById('brand-select')
    brandSel?.addEventListener('change', () => { filter.brand = brandSel.value; render() })

    const searchInput = document.getElementById('search-input')
    searchInput?.addEventListener('input', () => { filter.query = searchInput.value; render() })

    container.querySelectorAll('.vehicle-card').forEach(card => card.addEventListener('click', () => {
      const v = WV.find(x => x.id === card.dataset.id)
      if (!v) return
      openVehicleModal(v)
    }))

    document.getElementById('ai-lookup-btn')?.addEventListener('click', openAiLookup)
    document.getElementById('ai-batch-btn')?.addEventListener('click', runBatchVerify)
    document.getElementById('add-vehicle-btn')?.addEventListener('click', () => openAdminEdit(blankVehicle(), true))
    document.getElementById('data-mgr-btn')?.addEventListener('click', openDataManager)
  }

  function openAiLookup() {
    const body = '<div style="font-size:0.82rem">' +
      '<div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:10px">' +
        '🤖 ค้นหารถ <strong>คันไหนก็ได้</strong>ที่ขายในไทย — พิมพ์ยี่ห้อ+รุ่น+รุ่นย่อย แล้ว AI จะดึงสเปคและราคาล่าสุดให้แบบเรียลไทม์' +
      '</div>' +
      '<input type="text" id="ai-q" placeholder="เช่น Tesla Model Y Long Range, Toyota Yaris Ativ Smart, Denza D9..." ' +
        'style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:0.82rem">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
        ['Tesla Model Y','Denza D9','BYD Seal AWD','Toyota Yaris Ativ','XPeng X9','Zeekr 001'].map(s =>
          '<button class="btn btn-sm btn-secondary ai-chip" data-q="' + s + '">' + s + '</button>').join('') +
      '</div>' +
      '<div id="ai-status" style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)"></div>' +
    '</div>'

    openModal({
      title: '🤖 AI Live Lookup — ค้นรถทุกคันในไทย',
      size: 'md',
      body,
      confirmText: '🔍 ค้นหา',
      onConfirm: () => { runAiSearch(); return false },
    })

    setTimeout(() => {
      const input = document.getElementById('ai-q')
      input?.focus()
      input?.addEventListener('keydown', e => { if (e.key === 'Enter') runAiSearch() })
      document.querySelectorAll('.ai-chip').forEach(c => c.addEventListener('click', () => {
        document.getElementById('ai-q').value = c.dataset.q
        runAiSearch()
      }))
    }, 50)
  }

  async function runAiSearch() {
    const input = document.getElementById('ai-q')
    const status = document.getElementById('ai-status')
    const q = input?.value?.trim()
    if (!q) { if (status) status.innerHTML = '<span style="color:var(--warning)">⚠️ กรุณาพิมพ์ชื่อรถ</span>'; return }
    if (status) status.innerHTML = '⏳ กำลังค้นหา <strong>' + q + '</strong> ผ่าน AI...'
    try {
      const v = await aiLookup(q)
      if (container.__routerGen !== myGen) return
      const { title, body } = buildModal(v)
      openModal({
        title: '🤖 ' + title,
        size: 'lg',
        body: '<div style="font-size:0.66rem;color:var(--warning);margin-bottom:8px;padding:6px 10px;background:var(--surface-2);border-radius:6px">⚠️ ข้อมูลจาก AI — โปรดตรวจสอบราคา/โปรโมชั่นล่าสุดกับโชว์รูมอีกครั้ง</div>' + body,
        confirmText: '➕ เพิ่มเข้าฐานข้อมูล',
        cancelText: 'ปิด',
        onConfirm: async () => {
          v.id = 'AI_ADD_' + Date.now()
          try {
            await saveAddition(v); refreshWV()
            showToast('➕ เพิ่ม ' + v.brand + ' ' + v.model + ' (จาก AI) เข้าฐานข้อมูลแล้ว', 'success')
            render()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        },
      })
      showToast('✅ พบข้อมูล ' + v.brand + ' ' + v.model, 'success')
    } catch (err) {
      let msg = '❌ ค้นหาไม่สำเร็จ'
      if (err.code === 'NO_KEY') msg = '🔑 ยังไม่ได้ตั้งค่า Claude API Key — ไปที่ตั้งค่า > API Keys'
      else if (err.code === 'NOT_FOUND') msg = '🔍 ไม่พบรถรุ่นนี้ในตลาดไทย ลองพิมพ์ให้ชัดเจนขึ้น'
      else if (err.code && err.code.startsWith('API_')) msg = '⚠️ เชื่อมต่อ AI ไม่สำเร็จ (' + err.code + ') — ตรวจสอบ API Key'
      if (status) status.innerHTML = '<span style="color:var(--danger)">' + msg + '</span>'
      else showToast(msg, 'error')
    }
  }

  // ── เปิด modal รถ พร้อมปุ่ม ตรวจ/แก้ไข ────────────────────────────────────────
  function fmtVal(x) { return Array.isArray(x) ? x.join(', ') : (x === undefined || x === null || x === '' ? '-' : String(x)) }
  function errMsg(err) {
    if (err.code === 'NO_KEY') return '🔑 ยังไม่ได้ตั้งค่า Claude API Key — ไปที่ ตั้งค่า > API Keys'
    if (err.code === 'NOT_FOUND') return '🔍 ไม่พบข้อมูลรถรุ่นนี้'
    if (err.code && err.code.indexOf('API_') === 0) return '⚠️ เชื่อมต่อ AI ไม่สำเร็จ (' + err.code + ')'
    return '❌ ไม่สำเร็จ: ' + (err.message || '')
  }

  function openVehicleModal(v) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove()) // กัน id ซ้ำจาก modal ค้าง
    const { title, body } = buildModal(v)
    const note = v._verifiedBy
      ? '<span style="font-size:0.66rem;color:var(--success);padding:6px 4px">✅ ยืนยันโดย ' + (v._verifiedBy === 'AI' ? 'AI' : 'แอดมิน') + ' · ' + v._verifiedAt + '</span>'
      : ''
    const actions = '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn btn-sm btn-primary" id="vh-ai-verify">🤖 ตรวจ/อัปเดตด้วย AI</button>' +
      '<button class="btn btn-sm btn-secondary" id="vh-admin-edit">✏️ แก้ไข (แอดมิน)</button>' +
      '<button class="btn btn-sm btn-danger" id="vh-delete">🗑 ลบรุ่นนี้</button>' +
      (v._verifiedBy ? '<button class="btn btn-sm btn-secondary" id="vh-reset">↩️ คืนค่าเดิม</button>' : '') +
      note + '</div>' +
      '<div id="vh-status" style="margin-bottom:10px;font-size:0.76rem"></div>'
    openModal({ title, size: 'lg', body: actions + body, confirmText: 'ปิด', onConfirm: () => {} })
    setTimeout(() => {
      document.getElementById('vh-ai-verify')?.addEventListener('click', () => runAiVerify(v))
      document.getElementById('vh-admin-edit')?.addEventListener('click', () => openAdminEdit(v))
      document.getElementById('vh-delete')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: '🗑 ลบรุ่นรถ', message: 'ยืนยันลบ "' + v.brand + ' ' + v.model + ' ' + v.variant + '" ออกจากฐานข้อมูล?', confirmText: 'ลบ', danger: true })
        if (!ok) return
        try {
          await deleteVehicle(v.id); refreshWV()
          showToast('🗑 ลบ ' + v.brand + ' ' + v.model + ' แล้ว', 'warning')
          document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
          if (container.__routerGen !== myGen) return
          render()
        } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
      })
      document.getElementById('vh-reset')?.addEventListener('click', async () => {
        try {
          await clearOverride(v.id); refreshWV(); showToast('↩️ คืนค่าข้อมูลเดิมแล้ว', 'warning')
          document.querySelector('.modal-close')?.click(); render()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    }, 50)
  }

  async function runAiVerify(v) {
    const status = document.getElementById('vh-status')
    if (status) status.innerHTML = '⏳ กำลังตรวจสอบกับข้อมูลล่าสุดด้วย AI...'
    try {
      const result = await aiVerifyVehicle(v)
      if (container.__routerGen !== myGen) return
      const changes = result.changes || []
      if (!changes.length) { if (status) status.innerHTML = '<span style="color:var(--success)">✅ AI ตรวจแล้ว ข้อมูลถูกต้อง ไม่มีจุดต้องแก้</span>'; return }
      const rows = changes.map(c =>
        '<tr style="border-bottom:1px solid var(--border-subtle)">' +
          '<td style="padding:6px 8px;font-size:0.7rem;font-weight:700;vertical-align:top">' + c.field + '</td>' +
          '<td style="padding:6px 8px;font-size:0.68rem;color:var(--danger);vertical-align:top">' + fmtVal(c.old) + '</td>' +
          '<td style="padding:6px 8px;font-size:0.68rem;color:var(--success);font-weight:600;vertical-align:top">' + fmtVal(c.new) + '</td>' +
          '<td style="padding:6px 8px;font-size:0.62rem;color:var(--text-muted);vertical-align:top">' + (c.reason || '') + '</td>' +
        '</tr>').join('')
      const dbody = '<div style="font-size:0.78rem"><div style="margin-bottom:8px;color:var(--warning)">🤖 AI พบ ' + changes.length + ' จุดที่ควรแก้/เพิ่มเติม:</div>' +
        '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--surface-2)">' +
        '<th style="padding:6px 8px;text-align:left;font-size:0.62rem">ฟิลด์</th><th style="padding:6px 8px;text-align:left;font-size:0.62rem">เดิม</th><th style="padding:6px 8px;text-align:left;font-size:0.62rem">AI แก้เป็น</th><th style="padding:6px 8px;text-align:left;font-size:0.62rem">เหตุผล</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div style="font-size:0.62rem;color:var(--text-muted);margin-top:8px">⚠️ AI อาจคลาดเคลื่อนได้ — ตรวจทานก่อนยืนยัน</div></div>'
      openModal({
        title: '🤖 ผลตรวจ ' + v.brand + ' ' + v.model, size: 'lg', body: dbody, confirmText: '✅ ใช้ข้อมูลที่ AI แก้',
        onConfirm: async () => {
          const fields = {}
          changes.forEach(c => { if (result.vehicle && (c.field in result.vehicle)) fields[c.field] = result.vehicle[c.field] })
          try {
            await saveOverride(v.id, fields, 'AI'); refreshWV()
            showToast('✅ อัปเดต ' + Object.keys(fields).length + ' ฟิลด์ด้วย AI แล้ว', 'success')
            render()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        },
      })
    } catch (err) { if (status) status.innerHTML = '<span style="color:var(--danger)">' + errMsg(err) + '</span>' }
  }

  function openAdminEdit(v, isNew) {
    const f = (label, key, val) => '<div style="margin-bottom:8px"><label style="font-size:0.64rem;color:var(--text-muted);display:block;margin-bottom:2px">' + label + '</label>' +
      '<input class="ae-in" data-k="' + key + '" value="' + String(val === undefined || val === null ? '' : val).replace(/"/g, '&quot;') + '" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text);font-size:0.74rem"></div>'
    const fa = (label, key, arr) => f(label + ' (คั่นด้วย ,)', key, (arr || []).join(', '))
    const opts = (list, cur) => list.map(o => '<option value="' + o + '"' + (o === cur ? ' selected' : '') + '>' + o + '</option>').join('')
    const sel = (label, key, list, val) => '<div style="margin-bottom:8px"><label style="font-size:0.64rem;color:var(--text-muted);display:block;margin-bottom:2px">' + label + '</label>' +
      '<select class="ae-in" data-k="' + key + '" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text);font-size:0.74rem">' + opts(list, val) + '</select></div>'
    const idBlock = isNew
      ? '<div style="background:var(--surface-2);padding:8px 10px;border-radius:6px;margin-bottom:10px">' +
          '<div style="font-size:0.66rem;color:var(--warning);margin-bottom:6px">➕ เพิ่มรถรุ่นใหม่ — กรอกข้อมูลระบุตัวรถ</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">' +
            f('ยี่ห้อ *', 'brand', v.brand) + f('รุ่น *', 'model', v.model) +
            f('รุ่นย่อย *', 'variant', v.variant) + f('ประเภท (Sedan/SUV/Pickup..)', 'type', v.type) +
            sel('เชื้อเพลิง', 'fuel', ['BEV', 'PHEV', 'Hybrid', 'Petrol', 'Diesel'], v.fuel) +
            sel('รูปทรง', 'bodyType', ['sedan', 'suv', 'pickup', 'mpv', 'hatchback', 'roadster'], v.bodyType) +
          '</div></div>'
      : ''
    const body = '<div style="font-size:0.78rem;max-height:62vh;overflow:auto;padding-right:4px">' +
      idBlock +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">' +
        f('ราคา (บาท)', 'price', v.price) + f('ราคาต่ำสุด', 'priceMin', v.priceMin) +
        f('ราคาสูงสุด', 'priceMax', v.priceMax) + f('ปี', 'year', v.year) +
        f('เครื่องยนต์/มอเตอร์', 'engine', v.engine) + f('แรงม้า (hp)', 'power', v.power) +
        f('แรงบิด (Nm)', 'torque', v.torque) + f('เกียร์', 'transmission', v.transmission) +
        f('ขับเคลื่อน', 'drivetrain', v.drivetrain) + f('แบตเตอรี่', 'battery', v.battery) +
        f('ระยะทาง (km)', 'range', v.range) + f('ที่นั่ง', 'seats', v.seats) +
        f('ชาร์จ AC (kW)', 'chargeAC', v.chargeAC) + f('ชาร์จ DC (kW)', 'chargeDC', v.chargeDC) +
        f('ความจุท้าย (L)', 'bootSpace', v.bootSpace) + f('Frunk (L)', 'frunk', v.frunk) +
        f('ถุงลม', 'airbags', v.airbags) + f('ระยะต่ำสุด (mm)', 'groundClearance', v.groundClearance) +
      '</div>' +
      f('เวลาชาร์จเร็ว', 'chargeTime', v.chargeTime) +
      f('NCAP', 'ncap', v.ncap) + f('ECO Sticker', 'ecoSticker', v.ecoSticker) +
      f('การรับประกัน', 'warranty', v.warranty) + f('ผู้นำเข้า/ประกอบ', 'importer', v.importer) +
      fa('สีภายนอก', 'colors', v.colors) + fa('สีภายใน', 'interiorColors', v.interiorColors) +
      fa('ระบบความปลอดภัย', 'safety', v.safety) + fa('ระบบขับขี่อัจฉริยะ ADAS', 'adas', v.adas) +
      fa('จุดแข็ง', 'strengths', v.strengths) + fa('จุดอ่อน', 'weaknesses', v.weaknesses) +
      fa('ข้อดี', 'pros', v.pros) + fa('ข้อเสีย', 'cons', v.cons) +
      '</div>'
    openModal({
      title: (isNew ? '➕ เพิ่มรถรุ่นใหม่ (แอดมิน)' : '✏️ แก้ไขข้อมูล (แอดมิน) — ' + v.brand + ' ' + v.model),
      size: 'lg', body, confirmText: (isNew ? '➕ เพิ่มรถ' : '💾 บันทึก'),
      onConfirm: async () => {
        const numKeys = ['price', 'priceMin', 'priceMax', 'year', 'power', 'torque', 'range', 'seats', 'chargeAC', 'chargeDC', 'bootSpace', 'frunk', 'airbags', 'groundClearance']
        const arrKeys = ['colors', 'interiorColors', 'safety', 'adas', 'strengths', 'weaknesses', 'pros', 'cons']
        const fields = {}
        document.querySelectorAll('.ae-in').forEach(inp => {
          const k = inp.dataset.k; let val = inp.value
          if (numKeys.indexOf(k) >= 0) val = parseFloat(val) || 0
          else if (arrKeys.indexOf(k) >= 0) val = val.split(',').map(s => s.trim()).filter(Boolean)
          fields[k] = val
        })
        try {
          if (isNew) {
            if (!fields.brand || !fields.model) { showToast('⚠️ กรุณากรอกยี่ห้อและรุ่น', 'warning'); return false }
            const nv = Object.assign(blankVehicle(), v, fields)
            if (!fields.priceMin) nv.priceMin = nv.price
            if (!fields.priceMax) nv.priceMax = nv.price
            await saveAddition(nv); refreshWV()
            showToast('➕ เพิ่ม ' + nv.brand + ' ' + nv.model + ' แล้ว', 'success')
          } else {
            await saveOverride(v.id, fields, 'admin'); refreshWV()
            showToast('💾 บันทึกข้อมูล (แอดมิน) แล้ว', 'success')
          }
          render()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      },
    })
  }

  // ── Batch: ให้ AI ตรวจ+เติมข้อมูลทุกคันที่กรองอยู่ ทีละคัน (แก้/เติมแบบ per-variant) ──
  let batchRunning = false
  function runBatchVerify() {
    if (batchRunning) return
    if (!localStorage.getItem('sk_claude_api_key')) {
      showToast('🔑 ต้องตั้ง Claude API Key ก่อน (ตั้งค่า > API Keys)', 'warning'); return
    }
    const list = getFiltered()
    const scopeLabel = filter.brand || (filter.fuel ? (FUEL_LABELS[filter.fuel] || filter.fuel) : 'ทั้งหมด')
    const body = '<div style="font-size:0.82rem">' +
      '<div style="margin-bottom:10px">จะให้ AI ตรวจสอบและเติมข้อมูล (จุดแข็ง/อ่อน, ข้อดี/เสีย, NCAP, ADAS, สเปก) ' +
      '<strong>' + list.length + ' คัน</strong> (ขอบเขต: ' + scopeLabel + ') แบบรายรุ่นย่อย — ผลลัพธ์จะถูกบันทึกทับอัตโนมัติ' +
      '<br><span style="font-size:0.7rem;color:var(--text-muted)">⚠️ ใช้เวลาพอสมควร (เรียก AI ทีละคัน) และใช้โควต้า API · กรองยี่ห้อก่อนเพื่อทำเป็นชุดย่อยได้</span></div>' +
      '<div id="batch-progress" style="font-size:0.8rem;font-weight:600"></div>' +
      '<div id="batch-log" style="margin-top:8px;max-height:200px;overflow:auto;font-size:0.68rem;color:var(--text-muted)"></div>' +
    '</div>'
    openModal({
      title: '✨ ตรวจทั้งหมดด้วย AI (' + list.length + ' คัน)', size: 'md', body,
      confirmText: '▶ เริ่มตรวจ',
      onConfirm: () => { doBatch(list); return false },
    })
  }

  async function doBatch(list) {
    batchRunning = true
    const prog = document.getElementById('batch-progress')
    const log = document.getElementById('batch-log')
    let ok = 0, changed = 0, fail = 0
    for (let i = 0; i < list.length; i++) {
      const v = list[i]
      if (prog) prog.innerHTML = '⏳ กำลังตรวจ ' + (i + 1) + '/' + list.length + ' — ' + v.brand + ' ' + v.model + ' ' + v.variant
      try {
        const result = await aiVerifyVehicle(v)
        const changes = result.changes || []
        if (changes.length && result.vehicle) {
          const fields = {}
          changes.forEach(c => { if (c.field in result.vehicle) fields[c.field] = result.vehicle[c.field] })
          if (Object.keys(fields).length) { await saveOverride(v.id, fields, 'AI'); changed++ }
        }
        ok++
        if (log) log.innerHTML = '✅ ' + v.brand + ' ' + v.model + ' ' + v.variant + ' (' + changes.length + ' แก้ไข)<br>' + log.innerHTML
      } catch (err) {
        fail++
        if (err.code === 'NO_KEY') { if (prog) prog.innerHTML = '🔑 ไม่พบ API Key — หยุด'; break }
        if (log) log.innerHTML = '⚠️ ' + v.brand + ' ' + v.model + ' — ' + errMsg(err) + '<br>' + log.innerHTML
      }
    }
    refreshWV()
    if (container.__routerGen !== myGen) { batchRunning = false; return }
    if (prog) prog.innerHTML = '🎉 เสร็จ! ตรวจ ' + ok + ' คัน · แก้ไข ' + changed + ' คัน · ผิดพลาด ' + fail
    showToast('✨ AI ตรวจเสร็จ ' + ok + ' คัน (แก้ไข ' + changed + ')', 'success')
    batchRunning = false
    render()
  }

  // ── จัดการข้อมูล: Export / Import / กู้คืน / ล้าง ───────────────────────────────
  function openDataManager() {
    const adds = loadAdditions().length, dels = loadDeletions().length, ovs = Object.keys(loadOverrides()).length
    const body = '<div style="font-size:0.82rem">' +
      '<div style="background:var(--surface-2);padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:0.74rem">' +
        '📊 การเปลี่ยนแปลงที่บันทึกไว้: เพิ่ม <strong>' + adds + '</strong> คัน · ลบ/ซ่อน <strong>' + dels + '</strong> คัน · แก้ไข <strong>' + ovs + '</strong> คัน' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button class="btn btn-primary" id="dm-export">⬇️ Export สำรองข้อมูล (.json)</button>' +
        '<button class="btn btn-secondary" id="dm-import">⬆️ Import นำเข้าข้อมูล (.json)</button>' +
        '<input type="file" id="dm-file" accept="application/json,.json" style="display:none">' +
        (dels > 0 ? '<button class="btn btn-secondary" id="dm-restore">↩️ กู้คืนรถที่ลบ (' + dels + ' คัน)</button>' : '') +
        '<button class="btn btn-danger" id="dm-reset">🗑 ล้างการแก้ไขทั้งหมด (กลับค่าเริ่มต้น)</button>' +
      '</div>' +
      '<div style="font-size:0.64rem;color:var(--text-muted);margin-top:10px">ไฟล์สำรองเก็บเฉพาะส่วนที่คุณ เพิ่ม/แก้/ลบ — นำไปใช้ย้ายเครื่องหรือกู้คืนได้</div>' +
      '<div id="dm-status" style="margin-top:8px;font-size:0.74rem"></div>' +
    '</div>'
    openModal({ title: '💾 จัดการข้อมูล (สำรอง / กู้คืน)', size: 'md', body, confirmText: 'ปิด', onConfirm: () => {} })
    setTimeout(() => {
      document.getElementById('dm-export')?.addEventListener('click', () => {
        downloadJSON('lamom-vehicles-' + new Date().toISOString().slice(0, 10) + '.json', exportUserData())
        const s = document.getElementById('dm-status'); if (s) s.innerHTML = '<span style="color:var(--success)">✅ ดาวน์โหลดไฟล์สำรองแล้ว</span>'
      })
      document.getElementById('dm-import')?.addEventListener('click', () => document.getElementById('dm-file').click())
      document.getElementById('dm-file')?.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0]; if (!file) return
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            await importUserData(JSON.parse(reader.result)); refreshWV()
            showToast('⬆️ นำเข้าข้อมูลสำเร็จ', 'success')
            document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); render()
          } catch (err) {
            const s = document.getElementById('dm-status'); if (s) s.innerHTML = '<span style="color:var(--danger)">❌ ไฟล์ไม่ถูกต้อง (ต้องเป็น .json ที่ export จากระบบนี้)</span>'
          }
        }
        reader.readAsText(file)
      })
      document.getElementById('dm-restore')?.addEventListener('click', async () => {
        try {
          await restoreDeleted(); refreshWV(); showToast('↩️ กู้คืนรถที่ลบแล้ว', 'success')
          document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); render()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
      document.getElementById('dm-reset')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: '🗑 ล้างการแก้ไขทั้งหมด', message: 'ลบข้อมูลที่ เพิ่ม/แก้/ลบ ทั้งหมด กลับสู่ค่าเริ่มต้นของระบบ?', confirmText: 'ล้างทั้งหมด', danger: true })
        if (!ok) return
        try {
          await resetUserData(); refreshWV(); showToast('🗑 ล้างการแก้ไขทั้งหมดแล้ว', 'warning')
          document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); render()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    }, 50)
  }

  render()
}
