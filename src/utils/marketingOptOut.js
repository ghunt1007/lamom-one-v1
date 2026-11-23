// (v1.0.1281) PDPA: ลูกค้าที่ไม่ยินยอมรับข่าวสาร (marketingConsent 'no' จากฟอร์มลีด) ต้องไม่ได้รับ SMS การตลาด
// (ลูกค้าเสี่ยงหนี / เสนอขายเพิ่ม / อวยพร) — หน้าพวกนี้สร้างรายชื่อจากใบจอง จึงเทียบด้วยเบอร์โทรกับเอกสารลูกค้า
export const phoneKey = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('66') && d.length === 11 ? '0' + d.slice(2) : d }

export function optedOutPhones(customers = []) {
  const out = new Set()
  for (const c of customers || []) {
    if (!c || c.deleted || c.marketingConsent !== 'no') continue
    const k = phoneKey(c.phone)
    if (k.length >= 9) out.add(k)
  }
  return out
}

// แยกรายชื่อที่ส่งได้ / ข้าม (ไม่ยินยอม) — phoneOf ดึงเบอร์จากแต่ละแถว
export function splitByConsent(rows = [], blocked = new Set(), phoneOf = r => r.phone) {
  const keep = [], skipped = []
  for (const r of rows || []) (blocked.has(phoneKey(phoneOf(r))) ? skipped : keep).push(r)
  return { keep, skipped }
}

// โหลดเบอร์ที่ไม่ยินยอม — อ่านไม่ได้ = เซ็ตว่าง (ไม่บล็อกการส่ง แต่ไม่เดา)
export async function loadOptedOutPhones() {
  try {
    const { listAllDocs } = await import('../core/db.js')
    const { companyScopeFilters } = await import('../core/companyScope.js')
    return optedOutPhones(await listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc'))
  } catch { return new Set() }
}

// (v1.0.1355) ลูกค้าที่ผูก LINE แล้วและยังรับข้อความได้ (ไม่เลิกรับ/ไม่บล็อก/ไม่ปฏิเสธข่าวสาร) — เบอร์ → lineUserId
// ใช้ส่งคำอวยพรรายคนทาง LINE แทน SMS (ฟรี) · เบอร์ซ้ำหลายเอกสาร ใช้ตัวแรกที่ผูกไว้
const isLineUid = v => /^U[0-9a-f]{10,40}$/i.test(String(v || ''))
export function lineContacts(customers = []) {
  const out = new Map()
  for (const c of customers || []) {
    if (!c || c.deleted || !isLineUid(c.lineUserId) || c.lineOptOut || c.lineBlockedAt || c.marketingConsent === 'no') continue
    const k = phoneKey(c.phone)
    if (k.length >= 9 && !out.has(k)) out.set(k, c.lineUserId)
  }
  return out
}

// โหลดลูกค้าครั้งเดียว ได้ทั้งเบอร์ที่ไม่ยินยอม และ LINE ที่ส่งได้ — อ่านไม่ได้ = ว่างทั้งคู่
export async function loadContactPrefs() {
  try {
    const { listAllDocs } = await import('../core/db.js')
    const { companyScopeFilters } = await import('../core/companyScope.js')
    const cs = await listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc')
    return { optedOut: optedOutPhones(cs), line: lineContacts(cs) }
  } catch { return { optedOut: new Set(), line: new Map() } }
}
