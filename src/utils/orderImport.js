// (v1.0.1322) นำเข้าคำสั่งซื้อรถจาก Excel ทีละหลายรายการ — หน้าคำสั่งซื้อรถเดิมมีแค่ปุ่มส่งออก ต้องคีย์ทีละใบ
// รับหัวคอลัมน์แบบเดียวกับปุ่ม "ส่งออก" ของหน้านี้ (ส่งออก → แก้ → นำกลับเข้าได้) และชื่ออังกฤษที่พบบ่อย
// ไม่แก้/ลบรายการเดิม: เลขที่ซ้ำกับในระบบหรือซ้ำกันเองในไฟล์จะถูกข้าม · แถวที่ไม่มีรุ่นข้าม
import { parseStockDate } from './stockImport.js'

export const ORDER_IMPORT_COLS = ['เลขที่', 'ยี่ห้อ', 'รุ่น', 'Variant', 'สี', 'จำนวน', 'ต้นทุน', 'สถานะ', 'วันรับคาด', 'Supplier', 'หมายเหตุ']

const ALIASES = {
  orderNo: ['เลขที่', 'เลขที่สั่งซื้อ', 'orderno', 'order', 'po'],
  brand: ['ยี่ห้อ', 'brand', 'make'],
  model: ['รุ่น', 'model'],
  variant: ['variant', 'รุ่นย่อย', 'เกรด'],
  color: ['สี', 'color', 'colour'],
  qty: ['จำนวน', 'qty', 'quantity', 'คัน'],
  unitCost: ['ต้นทุน', 'ต้นทุนต่อคัน', 'cost', 'unitcost'],
  status: ['สถานะ', 'status'],
  expectedDate: ['วันรับคาด', 'วันที่คาดว่าจะได้รับ', 'eta', 'expected', 'expecteddate', 'วันรถเข้า'],
  supplier: ['supplier', 'ผู้ขาย', 'ซัพพลายเออร์'],
  notes: ['หมายเหตุ', 'notes', 'note'],
}

const STATUS_WORDS = [
  ['cancelled', /ยกเลิก|cancel/i], ['arrived', /ถึงแล้ว|รับแล้ว|arrived/i], ['shipped', /ขนส่ง|shipped|transit/i],
  ['production', /ผลิต|production/i], ['confirmed', /ยืนยัน|confirmed/i], ['draft', /ร่าง|draft/i], ['ordered', /สั่ง|ordered/i],
]

const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '')
function pick(row, field) {
  const keys = Object.keys(row || {})
  for (const a of ALIASES[field]) {
    const k = keys.find(k => norm(k) === norm(a))
    if (k != null && String(row[k] ?? '').trim()) return String(row[k]).trim()
  }
  return ''
}
const num = s => { const n = Number(String(s || '').replace(/[,฿\s]/g, '')); return Number.isFinite(n) ? n : 0 }

export function parseOrderStatus(s) {
  const hit = STATUS_WORDS.find(([, re]) => re.test(String(s || '')))
  return hit ? hit[0] : 'ordered'
}

// rows = แถวจาก Excel · existing = คำสั่งซื้อในระบบ · newNo = ฟังก์ชันสร้างเลขที่ใหม่เมื่อแถวไม่มีเลขที่
export function planOrderImport(rows, existing = [], { today = '', newNo = i => `ORD-IMP-${i + 1}` } = {}) {
  const seen = new Set((existing || []).filter(o => o && !o.deleted && o.orderNo).map(o => norm(o.orderNo)))
  const creates = [], skipped = []
  ;(rows || []).forEach((r, i) => {
    const row = i + 2 // แถวที่ 1 = หัวคอลัมน์
    const model = pick(r, 'model')
    const name = [pick(r, 'brand'), model, pick(r, 'color')].filter(Boolean).join(' ') || '(ว่าง)'
    if (!model) { skipped.push({ row, name, reason: 'ไม่มีรุ่นรถ' }); return }
    let orderNo = pick(r, 'orderNo')
    if (orderNo && seen.has(norm(orderNo))) { skipped.push({ row, name, reason: `เลขที่ ${orderNo} มีอยู่แล้ว` }); return }
    if (!orderNo) orderNo = newNo(i)
    seen.add(norm(orderNo))
    const d = pick(r, 'expectedDate')
    creates.push({
      orderNo, brand: pick(r, 'brand'), model, variant: pick(r, 'variant'), color: pick(r, 'color'),
      qty: Math.max(1, Math.round(num(pick(r, 'qty'))) || 1), unitCost: num(pick(r, 'unitCost')),
      supplier: pick(r, 'supplier'), expectedDate: d ? parseStockDate(d, '') : '',
      status: parseOrderStatus(pick(r, 'status')), notes: pick(r, 'notes'), createdAt: today,
    })
  })
  return { creates, skipped }
}
