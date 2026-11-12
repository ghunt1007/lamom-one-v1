// (v1.0.1106) "ข้อสังเกตจาก AI" สร้างจากข้อมูลจริงทั้งหมด (ใบจอง ลูกค้า นัดติดตาม สต็อก) — ไม่มีข้อความสมมติ
// แต่ละข้อมี id ตามเรื่อง + เดือน (กด "ไม่สนใจ" แล้วซ่อนเฉพาะเดือนนั้น เดือนหน้าถ้ายังเป็นอยู่จะขึ้นใหม่)
// ฟังก์ชันล้วน ทดสอบได้
import { carOf } from './carLabel.js'
import { isOpenBooking } from './bookingStatus.js'
import { stockAgeDays } from './stockAge.js'
import { plateRows, PLATE_LATE_DAYS } from './plateList.js'

const DAY = 86400e3
const dnum = d => /^\d{4}-\d{2}-\d{2}/.test(d || '') ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY : null
const ymd = v => {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 10)
  const t = v?.toDate ? v.toDate() : v instanceof Date ? v : typeof v?.seconds === 'number' ? new Date(v.seconds * 1000) : null
  return t && !isNaN(t) ? new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''
}
const alive = a => (a || []).filter(x => x && !x.deleted)
const nm = c => String([c.firstName, c.lastName].filter(Boolean).join(' ') || c.custName || c.customerName || c.nickname || 'ลูกค้า').trim()
const withdrawn = b => /ถอน|ยกเลิก/.test(b.status || '')
const FIN = ['รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง']
const names = (arr, n = 3) => arr.slice(0, n).join(', ') + (arr.length > n ? ` และอีก ${arr.length - n}` : '')

export function buildInsights({ bookings = [], customers = [], followups = [], vehicles = [], today, sourceLabel = {} } = {}) {
  const month = today.slice(0, 7)
  const prevMonth = (() => { const y = +today.slice(0, 4), m = +today.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` })()
  const t0 = dnum(today)
  const bks = alive(bookings), cs = alive(customers)
  const out = []
  const add = (kind, o) => out.push({ id: `${kind}-${month}`, kind, ...o })

  // 1) ลูกค้า HOT ที่ไม่มีนัดติดตามค้างอยู่ → เสี่ยงหลุด
  const pendingFu = new Set(alive(followups).filter(f => f.status === 'pending').map(f => f.customerId))
  const hotNoFu = cs.filter(c => !c.isLost && !c.bookingId && ['lead', 'pp', '', undefined].includes(c.stage) && c.temperature === 'hot' && !pendingFu.has(c.id))
  if (hotNoFu.length) add('hotnofu', { cat: 'risk', priority: 'high', n: hotNoFu.length,
    title: `ลูกค้า HOT ${hotNoFu.length} คนยังไม่มีนัดติดตาม`,
    detail: `เช่น ${names(hotNoFu.map(nm))} — ลูกค้าที่พร้อมซื้อแต่ไม่มีใครนัดโทรต่อ มีโอกาสไปซื้อที่อื่น`,
    recommendation: 'ถาม LAMI "วันนี้ควรโทรหาใคร" แล้วกดโทรทีละคน หรือ "นัดโทรลูกค้า hot ทุกคน พรุ่งนี้ 10 โมง"',
    link: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' } })

  // 2) ใบจองรอไฟแนนซ์นานเกิน 14 วัน
  const finLate = bks.filter(b => FIN.includes(b.status)).map(b => ({ b, age: dnum(ymd(b.stageChangedAt) || ymd(b.bookingDate)) })).filter(x => x.age != null && t0 - x.age > 14)
  if (finLate.length) add('finlate', { cat: 'risk', priority: finLate.length >= 3 ? 'high' : 'medium', n: finLate.length,
    title: `รอผลไฟแนนซ์เกิน 14 วัน ${finLate.length} ใบ`,
    detail: `${names(finLate.map(x => x.b.custName || 'ลูกค้า'))} — ยิ่งรอนาน ลูกค้ายิ่งเปลี่ยนใจ`,
    recommendation: 'โทรตามไฟแนนซ์วันนี้ ถ้าไม่ผ่านให้เสนอไฟแนนซ์อีกเจ้าหรือปรับเงินดาวน์',
    link: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' } })

  // 3) รถพร้อมส่ง แต่ยังไม่นัดวันส่งมอบ → ยอดส่งมอบที่ทำได้ทันที
  const readyNoDate = bks.filter(b => ['รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status) && !/^\d{4}-\d{2}-\d{2}/.test(b.deliveryDate || ''))
  if (readyNoDate.length) add('readynodate', { cat: 'opportunity', priority: 'high', n: readyNoDate.length,
    title: `รถพร้อมส่ง ${readyNoDate.length} คันยังไม่นัดวันส่งมอบ`,
    detail: `${names(readyNoDate.map(b => b.custName || 'ลูกค้า'))} — นัดส่งมอบได้เลย นับเป็นยอดเดือนนี้ทันที`,
    recommendation: 'โทรนัดวันรับรถ แล้วใส่วันส่งมอบในใบจอง (หรือบอก LAMI "นัดส่งมอบ <ชื่อ> วันศุกร์")',
    link: { path: '/dms/delivery-calendar', label: '📅 เปิดปฏิทินส่งมอบ' } })

  // 4) รถค้างสต็อกนาน
  const aged = alive(vehicles).filter(v => v.status === 'available').map(v => ({ v, d: stockAgeDays(v.arrivedAt, today) })).filter(x => x.d >= 90).sort((a, b) => b.d - a.d)
  if (aged.length) add('aged', { cat: 'ops', priority: aged.length >= 5 ? 'high' : 'medium', n: aged.length,
    title: `รถค้างสต็อกเกิน 90 วัน ${aged.length} คัน`,
    detail: aged.slice(0, 4).map(({ v, d }) => `${carOf(v) || 'รถ'}${v.color ? ' ' + v.color : ''} ${d} วัน`).join(' · '),
    recommendation: 'เสนอคันที่ค้างนานให้ลูกค้าที่สนใจรุ่นนั้นก่อน หรือจัดโปรเร่งขาย — ลดดอกเบี้ย floor plan',
    link: { path: '/dms/stock', label: '🚙 เปิดหน้าสต็อก' } })

  // 5) ป้ายแดงเกิน 45 วัน
  const plateLate = plateRows(bks, { today }).filter(r => r.late)
  if (plateLate.length) add('platelate', { cat: 'ops', priority: 'medium', n: plateLate.length,
    title: `รับรถแล้วเกิน ${PLATE_LATE_DAYS} วันแต่ยังไม่มีป้ายขาว ${plateLate.length} คัน`,
    detail: `${names(plateLate.map(r => r.b.custName || 'ลูกค้า'))} — ป้ายแดงใช้ได้จำกัด ลูกค้าเสี่ยงโดนปรับ`,
    recommendation: 'ตามงานทะเบียน แล้วกรอกเลขป้ายขาวในหน้าติดตามทะเบียน',
    link: { path: '/dms/plates', label: '🪪 เปิดหน้าติดตามทะเบียน' } })

  // 6) รุ่นที่จองเยอะสุดเดือนนี้ เทียบเดือนก่อน
  const inM = (b, m) => String(b.bookingDate || '').slice(0, 7) === m && !withdrawn(b)
  const cnt = m => { const o = {}; bks.filter(b => inM(b, m)).forEach(b => { const k = carOf(b) || 'ไม่ระบุรุ่น'; o[k] = (o[k] || 0) + 1 }); return o }
  const cur = cnt(month), prev = cnt(prevMonth)
  const top = Object.entries(cur).filter(([k]) => k !== 'ไม่ระบุรุ่น').sort((a, b) => b[1] - a[1])[0]
  if (top) {
    const total = Object.values(cur).reduce((a, b) => a + b, 0)
    const p = prev[top[0]] || 0
    const ready = alive(vehicles).filter(v => v.status === 'available' && carOf(v) === top[0]).length
    add('topmodel', { cat: 'sales', priority: ready === 0 ? 'medium' : 'low', n: total,
      title: `${top[0]} จองมากสุดเดือนนี้ ${top[1]} ใบ จาก ${total} ใบ`,
      detail: `เดือนก่อนรุ่นนี้จอง ${p} ใบ · รถพร้อมขายในสต็อกตอนนี้ ${ready} คัน`,
      recommendation: ready === 0 ? `สต็อก ${top[0]} หมด — สั่งรถเพิ่มก่อนลูกค้ารอนาน` : `ใช้ ${top[0]} เป็นรุ่นนำในโฆษณา/บูธเดือนนี้`,
      link: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' } })
  }

  // 7) ช่องทางที่ได้ลูกค้าใหม่มากสุดเดือนนี้
  const fresh = cs.filter(c => ymd(c.createdAt).slice(0, 7) === month)
  if (fresh.length >= 3) {
    const by = {}
    fresh.forEach(c => { const raw = String(c.source || '').trim(); const k = raw ? (sourceLabel[raw] || raw) : 'ไม่ระบุ'; by[k] = (by[k] || 0) + 1 })
    const [src, n] = Object.entries(by).filter(([k]) => k !== 'ไม่ระบุ').sort((a, b) => b[1] - a[1])[0] || []
    const unknown = by['ไม่ระบุ'] || 0
    if (src) add('topsource', { cat: 'customer', priority: 'low', n: fresh.length,
      title: `ลูกค้าใหม่เดือนนี้ ${fresh.length} คน มาจาก "${src}" มากสุด (${n} คน)`,
      detail: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(' · '),
      recommendation: unknown > fresh.length / 3 ? `ลูกค้า ${unknown} คนไม่ได้ระบุที่มา — กรอก "มาจาก" ทุกครั้ง จะรู้ว่าช่องทางไหนคุ้ม` : `เพิ่มงบ/เวลาให้ช่องทาง "${src}"`,
      link: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' } })
  }

  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.priority] - rank[b.priority])
}
