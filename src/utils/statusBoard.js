// (v1.0.1382) กระดานสถานะใบจองแยกหมวด บนหน้าภาพรวม — จองเท่าไหร่ ส่งมอบเท่าไหร่ ค้างแต่ละสถานะเท่าไหร่
// ฟังก์ชันล้วน ใช้ชื่อสถานะจริงจาก bookingStatus.js (ตรงกับคอลัมน์ "สถานะ" ใน Google Sheet)
import { BOOKING_STATUSES, isCancelled, isDelivered, cancelledMonth, deliveredMonth } from './bookingStatus.js'

// หมวด (เรียงตามขั้นงานจริง ใกล้ส่งมอบที่สุดก่อน) — ทุกสถานะใน BOOKING_STATUSES ต้องอยู่ในหมวดใดหมวดหนึ่ง (มีเทสตรวจ)
export const STATUS_GROUPS = [
  { key: 'ready', icon: '🚚', label: 'รถมาแล้ว รอส่งมอบ', color: 'success', hint: 'ใกล้ส่งมอบที่สุด',
    statuses: ['ตัดตัวเลขรอส่งมอบ', 'รอส่งมอบ', 'ได้รถแล้วรอสั่งแต่ง'] },
  { key: 'release', icon: '🏦', label: 'รอเบิกรถ', color: 'accent', hint: 'ไฟแนนซ์ผ่าน/ซื้อสด รอเบิกรถจากคลัง',
    statuses: ['ผ่านไฟแนนซ์รอเบิก', 'ซื้อสดรอเบิกรถ'] },
  { key: 'wait', icon: '⏳', label: 'รอรถ / ยอดจองค้าง', color: 'warning', hint: 'ยังไม่ได้รถ',
    statuses: ['รอรถ', 'ยอดจองคงค้าง'] },
  { key: 'finance', icon: '📄', label: 'ขั้นไฟแนนซ์', color: 'primary', hint: 'รอผล/เตรียมเอกสาร',
    statuses: ['รอผลไฟแนนซ์', 'ผ่านไฟแนนซ์รอจอง', 'จัดไฟแนนซ์ก่อนจอง'] },
]
export const STATUS_NOTE = {
  'ตัดตัวเลขรอส่งมอบ': 'นับเป็นยอดขายแล้ว',
  'ได้รถแล้วรอสั่งแต่ง': 'รอติดอุปกรณ์',
}

const DAY = 86400000
const t0 = v => { const t = Date.parse(String(v || '').slice(0, 10)); return Number.isFinite(t) ? t : null }

function statusStat(status, rows, today) {
  const now = t0(today) ?? Date.now()
  const ages = rows.map(b => t0(b.bookingDate)).filter(t => t != null).map(t => Math.max(0, Math.floor((now - t) / DAY)))
  return {
    status, rows, count: rows.length,
    value: rows.reduce((s, b) => s + (Number(b.price) || 0), 0),
    avgAge: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
    maxAge: ages.length ? Math.max(...ages) : null,
    note: STATUS_NOTE[status] || '',
  }
}

// scope 'open' = ใบที่ยังไม่จบตอนนี้ทั้งหมด (ทุกเดือน) · 'period' = เฉพาะใบที่จองในเดือนที่เลือก แยกตามสถานะปัจจุบัน
export function statusBoard(bookings = [], months = [], { today = '', scope = 'open' } = {}) {
  const set = new Set(Array.isArray(months) ? months : [months])
  const live = bookings.filter(b => b && !b.deleted)
  const bookedIn = live.filter(b => set.has(String(b.bookingDate || '').slice(0, 7)))
  const deliveredIn = live.filter(b => isDelivered(b) && set.has(deliveredMonth(b)))
  const withdrawnIn = live.filter(b => set.has(cancelledMonth(b)))
  const base = scope === 'period' ? bookedIn : live
  const open = base.filter(b => !isCancelled(b) && !isDelivered(b))
  // ตัดตัวเลขรอส่งมอบ = นับเป็นยอดส่งมอบแล้ว แต่รถยังไม่ถึงมือลูกค้า → แสดงในหมวด "รอส่งมอบ" ด้วย
  const waitingHandover = base.filter(b => b.status === 'ตัดตัวเลขรอส่งมอบ')
  const pool = [...open, ...waitingHandover]
  const known = new Set(STATUS_GROUPS.flatMap(g => g.statuses))
  const groups = STATUS_GROUPS.map(g => {
    const st = g.statuses.map(s => statusStat(s, pool.filter(b => b.status === s), today))
    return { ...g, items: st, count: st.reduce((s, x) => s + x.count, 0), value: st.reduce((s, x) => s + x.value, 0) }
  })
  const otherRows = open.filter(b => !known.has(b.status))
  if (otherRows.length) {
    const names = [...new Set(otherRows.map(b => String(b.status || '').trim() || 'ไม่ระบุสถานะ'))]
    const items = names.map(n => statusStat(n, otherRows.filter(b => (String(b.status || '').trim() || 'ไม่ระบุสถานะ') === n), today))
    groups.push({ key: 'other', icon: '❔', label: 'สถานะอื่นๆ', color: 'secondary', hint: 'สถานะที่ไม่ตรงกับรายการใน Sheet', statuses: names, items, count: otherRows.length, value: items.reduce((s, x) => s + x.value, 0) })
  }
  const pending = pool.length
  return {
    summary: {
      booked: bookedIn.length,
      active: bookedIn.filter(b => !isCancelled(b)).length,
      delivered: deliveredIn.length,
      handedOver: deliveredIn.filter(b => b.status === 'ส่งมอบแล้ว').length,
      cutWaiting: deliveredIn.filter(b => b.status === 'ตัดตัวเลขรอส่งมอบ').length,
      withdrawn: withdrawnIn.length,
      pending, pendingValue: pool.reduce((s, b) => s + (Number(b.price) || 0), 0),
    },
    rows: { booked: bookedIn, delivered: deliveredIn, withdrawn: withdrawnIn, pending: pool },
    groups: groups.filter(g => g.count || g.key !== 'other'),
  }
}

export const ALL_GROUPED_STATUSES = () => STATUS_GROUPS.flatMap(g => g.statuses)
export { BOOKING_STATUSES }
