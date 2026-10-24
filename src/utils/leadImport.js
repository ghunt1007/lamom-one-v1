// นำเข้า Lead จาก Excel/CSV — แทนลูปเดิมในหน้าลูกค้าที่ (1) รู้จักแค่หัวคอลัมน์ตรงตาม Template เป๊ะๆ (2) ไม่เช็คซ้ำเลย
// นำเข้าไฟล์เดิมสองรอบได้ลูกค้าซ้ำสองชุด และ (3) ไม่ใส่ผู้ดูแล ทำให้เซลส์ที่ถูกจำกัดสิทธิ์มองไม่เห็นรายชื่อที่ตัวเองนำเข้า
// ตัวนี้เป็นฟังก์ชันล้วน (ไม่แตะ Firestore) — หน้า Customers.js เรียกแล้วค่อย createDoc เฉพาะรายการ creates
import { deriveInitialStage } from '../core/customerInsights.js'
import { digitsOnly, findDuplicate } from './quickLead.js'

// หัวคอลัมน์ที่รับได้ (เทียบแบบไม่สนช่องว่าง/ตัวพิมพ์) — คอลัมน์แรกตาม Template เดิมของหน้าลูกค้า
export const LEAD_COLUMNS = {
  firstName: ['ชื่อ', 'ชื่อลูกค้า', 'first name', 'firstname', 'name'],
  lastName: ['นามสกุล', 'last name', 'lastname', 'surname'],
  fullName: ['ชื่อ-นามสกุล', 'ชื่อ นามสกุล', 'ชื่อนามสกุล', 'full name', 'fullname'],
  phone: ['โทรศัพท์', 'เบอร์', 'เบอร์โทร', 'เบอร์โทรศัพท์', 'มือถือ', 'phone', 'tel', 'mobile'],
  lineId: ['LINE ID', 'LINE', 'ไลน์', 'lineid'],
  email: ['Email', 'อีเมล', 'e-mail'],
  interestedModel: ['รถที่สนใจ', 'รุ่นที่สนใจ', 'รุ่น', 'model'],
  source: ['ที่มา', 'แหล่งที่มา', 'ช่องทาง', 'source'],
  assignedTo: ['ผู้ดูแล', 'เซลส์', 'เซลล์', 'sales', 'salesperson'],
  notes: ['หมายเหตุ', 'note', 'notes'],
}

const norm = s => String(s ?? '').toLowerCase().replace(/[\s_\-]/g, '')

function pick(row, aliases) {
  const keys = Object.keys(row || {})
  for (const a of aliases) {
    const k = keys.find(k => norm(k) === norm(a))
    if (k != null && String(row[k] ?? '').trim()) return String(row[k]).trim()
  }
  return ''
}

// Excel ชอบตัด 0 หน้าเบอร์มือถือทิ้ง (812345678) — เติมกลับให้ และแปลง +66 เป็น 0
export function normalizePhone(raw) {
  let d = digitsOnly(raw)
  if (d.startsWith('66') && d.length === 11) d = '0' + d.slice(2)
  if (d.length === 9 && !d.startsWith('0')) d = '0' + d
  return d
}

// ข้อความที่มาแบบพิมพ์เอง → key ที่หน้าลูกค้าใช้ (ไม่รู้จัก = other)
export function mapSource(raw) {
  const s = String(raw ?? '').toLowerCase()
  if (!s) return 'other'
  if (/facebook|fb|เฟส/.test(s)) return 'facebook'
  if (/tiktok|ติ๊กต็อก/.test(s)) return 'tiktok'
  if (/line|ไลน์/.test(s)) return 'line'
  if (/walk|หน้าร้าน|โชว์รูม/.test(s)) return 'walk-in'
  if (/refer|แนะนำ/.test(s)) return 'referral'
  if (/google|กูเกิล/.test(s)) return 'google'
  if (/web|เว็บ/.test(s)) return 'website'
  if (/phone|โทร/.test(s)) return 'phone'
  return ['facebook', 'line', 'tiktok', 'walk-in', 'referral', 'google', 'website', 'phone', 'other'].includes(s) ? s : 'other'
}

// rows = แถวจากไฟล์ (object ตามหัวคอลัมน์), existing = ลูกค้าที่มีในระบบ
// คืน { creates: [doc...], duplicates: [{ row: n, name, reason }], skipped: n (แถวไม่มีชื่อ) }
export function planLeadImport(rows, existing, { assignedTo = '' } = {}) {
  const creates = []
  const duplicates = []
  let skipped = 0
  const known = [...(existing || [])]
  const nameKey = c => norm([c.firstName, c.lastName].filter(Boolean).join(' '))
  ;(rows || []).forEach((row, i) => {
    let firstName = pick(row, LEAD_COLUMNS.firstName)
    let lastName = pick(row, LEAD_COLUMNS.lastName)
    const full = pick(row, LEAD_COLUMNS.fullName)
    if (!firstName && full) [firstName, ...lastName] = full.split(/\s+/), lastName = lastName.join(' ')
    else if (firstName && !lastName && /\s/.test(firstName)) [firstName, ...lastName] = firstName.split(/\s+/), lastName = lastName.join(' ')
    if (!firstName && !lastName) { skipped++; return }
    const fields = {
      firstName, lastName,
      phone: normalizePhone(pick(row, LEAD_COLUMNS.phone)),
      lineId: pick(row, LEAD_COLUMNS.lineId),
      email: pick(row, LEAD_COLUMNS.email),
      interestedModel: pick(row, LEAD_COLUMNS.interestedModel),
      source: mapSource(pick(row, LEAD_COLUMNS.source)),
      assignedTo: pick(row, LEAD_COLUMNS.assignedTo) || assignedTo,
      notes: pick(row, LEAD_COLUMNS.notes),
      temperature: null, vip: false, budget: 0, occupation: '', monthlyIncome: 0,
    }
    const name = [firstName, lastName].filter(Boolean).join(' ')
    // ซ้ำ = เบอร์หรือ LINE ตรงกับที่มีอยู่ (ในระบบหรือแถวก่อนหน้าในไฟล์เดียวกัน)
    // ถ้าไม่มีทั้งเบอร์และ LINE ใช้ชื่อ-นามสกุลเต็มเทียบแทน
    const dup = (fields.phone || fields.lineId)
      ? findDuplicate(fields, known)
      : known.find(c => !c.deleted && nameKey(c) === nameKey(fields))
    if (dup) {
      duplicates.push({ row: i + 2, name, reason: dup.__fromFile ? 'ซ้ำกับแถวก่อนหน้าในไฟล์' : `มีในระบบแล้ว (${[dup.firstName, dup.lastName].filter(Boolean).join(' ')})` })
      return
    }
    const doc = { ...fields, stage: deriveInitialStage(fields), isLost: false, lostReason: '', lostAt: null, bookingId: null, tags: [] }
    creates.push(doc)
    known.push({ ...doc, __fromFile: true })
  })
  return { creates, duplicates, skipped }
}
