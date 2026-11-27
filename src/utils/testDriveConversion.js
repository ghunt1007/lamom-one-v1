// (v1.0.1431) ทดลองขับแล้วจองจริงกี่ % — ดูจากใบจองจริง (ลูกค้าคนเดียวกัน จองภายใน 45 วันหลังขับ)
// ไม่พึ่งช่อง "ผล" ที่เซลส์อาจไม่ได้กรอก · พร้อมรายชื่อ "ขับแล้วยังไม่จอง" 2–30 วันล่าสุดให้โทรตาม · ฟังก์ชันล้วน
const DAY = 86400000
const ms = v => { const t = Date.parse(String(v || '').slice(0, 10)); return Number.isFinite(t) ? t : null }
const phoneKey = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('66') && d.length === 11 ? '0' + d.slice(2) : d }
export const isDoneTd = t => !!t && !t.deleted && (t.status === 'done' || t.status === 'completed')

export function testDriveConversion({ testDrives = [], bookings = [], customers = [], today, windowDays = 45, minSample = 10, minModel = 5 } = {}) {
  const t0 = ms(today)
  if (t0 == null) return null
  // ใบจองของลูกค้าแต่ละคน (ตาม id และเบอร์) — นับใบที่ถอนด้วย เพราะ "จอง" เกิดขึ้นแล้วจริง
  const byKey = new Map()
  const add = (k, d) => { if (!k || d == null) return; (byKey.get(k) || byKey.set(k, []).get(k)).push(d) }
  for (const b of bookings || []) {
    if (!b || b.deleted) continue
    const d = ms(b.bookingDate)
    add(b.customerId && 'id:' + b.customerId, d)
    const p = phoneKey(b.phone || b.custPhone)
    if (p.length >= 9) add('p:' + p, d)
  }
  const lost = new Set((customers || []).filter(c => c && (c.isLost || c.deleted)).map(c => c.id))
  const bookedAfter = (td, d) => {
    if (td.result === 'booked') return true
    const keys = [td.customerId && 'id:' + td.customerId, phoneKey(td.phone).length >= 9 && 'p:' + phoneKey(td.phone)].filter(Boolean)
    return keys.some(k => (byKey.get(k) || []).some(x => x >= d - 3 * DAY && x <= d + windowDays * DAY))
  }
  const done = (testDrives || []).filter(isDoneTd).map(td => ({ td, d: ms(td.date) })).filter(x => x.d != null && x.d <= t0)
  // ตัวอย่างที่ "ครบเวลาแล้ว" (ขับมานานกว่า windowDays วัน ไม่เกิน 1 ปี) — ใบที่เพิ่งขับยังจองได้อีก ไม่นับเป็นไม่จอง
  const settled = done.filter(x => x.d <= t0 - windowDays * DAY && x.d >= t0 - 365 * DAY).map(x => ({ ...x, ok: bookedAfter(x.td, x.d) }))
  const rate = settled.length >= minSample ? settled.filter(x => x.ok).length / settled.length : null
  const models = new Map()
  for (const x of settled) {
    const m = String(x.td.model || '').trim()
    if (!m) continue
    const r = models.get(m) || { model: m, n: 0, booked: 0 }
    r.n++; if (x.ok) r.booked++
    models.set(m, r)
  }
  const byModel = [...models.values()].filter(r => r.n >= minModel).map(r => ({ ...r, rate: r.booked / r.n })).sort((a, b) => b.rate - a.rate || b.n - a.n)
  // โทรตาม: ขับเสร็จ 2–30 วันก่อน ยังไม่มีใบจอง ไม่ได้บอกว่าไม่สนใจ และลูกค้ายังไม่ถูกปิดว่าเสีย
  const seen = new Set()
  const chase = done.filter(x => x.d >= t0 - 30 * DAY && x.d <= t0 - 2 * DAY && x.td.result !== 'notinterested' && !lost.has(x.td.customerId) && !bookedAfter(x.td, x.d))
    .sort((a, b) => b.d - a.d)
    .filter(x => { const k = x.td.customerId || phoneKey(x.td.phone) || x.td.id; if (seen.has(k)) return false; seen.add(k); return true })
    .map(x => ({ td: x.td, days: Math.round((t0 - x.d) / DAY) }))
  return { rate, n: settled.length, booked: settled.filter(x => x.ok).length, byModel, chase, windowDays }
}
