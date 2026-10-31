// นำเข้ารถเข้าสต็อกจากไฟล์ Excel ทีละหลายคัน — สต็อกรถ (collection 'vehicles') ยังว่างเพราะทีมไม่เคยคีย์รถทีละคัน
// รับหัวคอลัมน์แบบเดียวกับปุ่ม "ส่งออก" ของหน้าสต็อก (ส่งออกแล้วแก้แล้วนำกลับเข้าได้) และชื่ออังกฤษที่พบบ่อย
// ไม่แก้/ลบรถที่มีอยู่แล้ว: VIN ซ้ำกับในระบบหรือซ้ำกันเองในไฟล์จะถูกข้าม
export const STOCK_IMPORT_COLS = ['ยี่ห้อ', 'รุ่น', 'Variant', 'ปี', 'สี', 'VIN', 'ราคา', 'ต้นทุน', 'สถานะ', 'ที่ตั้ง', 'รับมา']

const ALIASES = {
  brand: ['ยี่ห้อ', 'brand', 'make'],
  model: ['รุ่น', 'model'],
  variant: ['variant', 'รุ่นย่อย', 'เกรด'],
  year: ['ปี', 'year', 'ปีรุ่น'],
  color: ['สี', 'color', 'colour'],
  vin: ['vin', 'เลขตัวถัง', 'chassis'],
  price: ['ราคา', 'price', 'ราคาขาย'],
  cost: ['ต้นทุน', 'cost'],
  status: ['สถานะ', 'status'],
  location: ['ที่ตั้ง', 'location', 'สาขา'],
  arrivedAt: ['รับมา', 'วันที่รับรถ', 'arrived', 'arrivedat', 'วันรับรถ'],
}

const STATUS_WORDS = [
  ['sold', /ขายแล้ว|ส่งมอบ|sold/i], ['reserved', /จอง|reserved/i], ['transit', /ขนส่ง|transit/i],
  ['pdi', /pdi/i], ['demo', /ทดลองขับ|demo/i], ['available', /พร้อมขาย|available|ว่าง/i],
]

const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '')

function pick(row, field) {
  const keys = Object.keys(row)
  for (const a of ALIASES[field]) {
    const k = keys.find(k => norm(k) === norm(a))
    if (k != null && String(row[k] ?? '').trim()) return String(row[k]).trim()
  }
  return ''
}

const num = s => { const n = Number(String(s || '').replace(/[,฿\s]/g, '')); return Number.isFinite(n) ? n : 0 }

const beYear = y => (y > 2400 ? y - 543 : y)

export function parseStockStatus(s) {
  const hit = STATUS_WORDS.find(([, re]) => re.test(String(s || '')))
  return hit ? hit[0] : 'available'
}

// วันที่จาก Excel มาได้หลายแบบ: 2026-10-30, 30/10/2026, 30/10/2569 (พ.ศ.) หรือข้อความวันที่เต็มของ JS
export function parseStockDate(s, today) {
  const t = String(s || '').trim()
  if (!t) return today
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    const y = +m[3] > 2400 ? +m[3] - 543 : +m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  const d = new Date(t)
  if (isNaN(d)) return today
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function planStockImport(rows, existing = [], { today = '', defaultLocation = '' } = {}) {
  const seen = new Set((existing || []).filter(v => !v.deleted && v.vin).map(v => String(v.vin).trim().toUpperCase()))
  const creates = [], skipped = []
  ;(rows || []).forEach((r, i) => {
    const row = i + 2 // แถวตามไฟล์ Excel (แถว 1 = หัวคอลัมน์)
    const brand = pick(r, 'brand'), model = pick(r, 'model')
    const vin = pick(r, 'vin').toUpperCase()
    if (!brand || !model) { skipped.push({ row, name: [brand, model].filter(Boolean).join(' ') || '-', reason: 'ไม่มียี่ห้อหรือรุ่น' }); return }
    if (vin && seen.has(vin)) { skipped.push({ row, name: `${brand} ${model}`, reason: `VIN ${vin} มีอยู่แล้ว` }); return }
    if (vin) seen.add(vin)
    creates.push({
      brand, model, variant: pick(r, 'variant'),
      year: beYear(num(pick(r, 'year'))) || Number(String(today).slice(0, 4)) || new Date().getFullYear(),
      color: pick(r, 'color'), vin,
      price: num(pick(r, 'price')), cost: num(pick(r, 'cost')),
      status: parseStockStatus(pick(r, 'status')),
      location: pick(r, 'location') || defaultLocation,
      arrivedAt: parseStockDate(pick(r, 'arrivedAt'), today),
      mileage: 0, notes: 'นำเข้าจาก Excel',
    })
  })
  return { creates, skipped }
}
