// (v1.0.1259) จับ "รถมายัง" / "รถถึงหรือยัง" / "ได้รถยัง" ด้วย (ไม่จับ "มายังไง")
// (v1.0.1248) ลูกค้าที่ผูก LINE แล้วถามเองว่า "รถมาเมื่อไหร่" / "สถานะรถ" → ตอบสถานะใบจองของตัวเองทันที
// เปิดสวิตช์ inbox_auto.statusAsk ก่อน (ปิดไว้เป็นค่าเริ่มต้น) · ตอบเฉพาะใบจองที่ผูกกับ LINE นี้จริง (lineUserId ของใบจอง/ลูกค้า)
// ไม่บอกข้อมูลภายใน (ลำดับคิวลูกค้าคนอื่น เลขตัวถัง เลขใบสั่ง) — บอกแค่สถานะ + วันที่คาดว่ารถถึงแบบประมาณ
// ไม่มีใบจองที่ยังไม่ส่งมอบ → คืน null ให้ AI/ทีมตอบตามปกติ
import { etaForBookings, needsBooking } from '../src/utils/orderNeeds.js'
import { isCancelled } from '../src/utils/bookingStatus.js'
// ยังไม่ได้รับรถ = ไม่ถอน และยังไม่ "ส่งมอบแล้ว" (ตัดตัวเลขรอส่งมอบ นับเป็นยอดขายแต่ลูกค้ายังรอรับรถ — ต้องตอบได้)
const isOpenBooking = b => !isCancelled(b) && b?.status !== 'ส่งมอบแล้ว'
import { customerStatusMessage } from '../src/utils/bookingNotify.js'

export const STATUS_ASK_RE = /(?:รถ(?:ของ(?:ผม|ฉัน|หนู|เรา))?(?:จะ)?(?:มา|ถึง|เข้า)(?:ถึง)?(?:โชว์รูม)?(?:เมื่อ|วัน)?(?:ไหร่|ไร|ไหน)|ได้รถ(?:เมื่อ|วัน)?(?:ไหร่|ไร|ไหน)|สถานะ(?:รถ|การจอง|ใบจอง)|เช็ค?สถานะ|รับรถ(?:ได้)?(?:เมื่อ|วัน)?(?:ไหร่|ไร|ไหน)|รถ(?:ของ(?:ผม|ฉัน|หนู|เรา))?(?:มา|ถึง|เข้า)(?:โชว์รูม)?(?:แล้ว)?(?:หรือ)?ยัง(?!ไง|งี้|ไม่|มี)|ได้รถ(?:แล้ว)?(?:หรือ)?ยัง(?!ไง|งี้|ไม่|มี))/
export const isStatusAsk = text => { const t = String(text || '').replace(/\s+/g, ''); return t.length > 0 && t.length <= 80 && STATUS_ASK_RE.test(t) }

const dmy = d => /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${Number(d.slice(0, 4)) + 543}` : ''

/** ข้อความตอบลูกค้า (ฟังก์ชันล้วน) — mine = ใบจองของลูกค้าคนนี้ · all/vehicles/orders = ข้อมูลทั้งร้าน (ใช้ไล่คิวจองก่อนได้ก่อน) */
export function statusAskReply({ mine = [], all = [], vehicles = [], orders = [], today = '' } = {}) {
  const open = mine.filter(b => b && !b.deleted && b.id && isOpenBooking(b))
  if (!open.length) return null
  const eta = open.some(needsBooking) ? etaForBookings({ bookings: all.length ? all : open, vehicles, orders, today }) : new Map()
  const parts = open.slice(0, 2).map(b => {
    const base = customerStatusMessage(b, b.status) || `${String(b.custName || '').trim() ? `สวัสดีครับคุณ${String(b.custName).trim().split(/\s+/)[0]}` : 'สวัสดีครับ'} ใบจอง${[b.brand, b.model].filter(Boolean).join(' ') || 'รถ'}ของคุณอยู่ในสถานะ "${b.status || 'กำลังดำเนินการ'}" ครับ`
    if (!needsBooking(b)) return base
    const e = eta.get(b.id)
    const when = e?.date && e.date >= today ? dmy(e.date) : ''
    const line = e?.kind === 'ready' ? '🚗 ตอนนี้มีรถรุ่น/สีที่จองพร้อมแล้ว เซลส์จะติดต่อนัดวันรับรถเร็วๆ นี้ครับ'
      : (e?.kind === 'transit' || e?.kind === 'order') && when ? `🚚 รถคาดว่าจะถึงโชว์รูมประมาณ ${when} (เป็นวันประมาณการ อาจเลื่อนได้เล็กน้อย)`
        : '🚚 ทีมงานกำลังจัดสรรรถรุ่น/สีที่จองให้ เมื่อทราบวันรถเข้า เซลส์จะรีบแจ้งทันทีครับ'
    return `${base}\n${line}`
  })
  return [...parts, 'สอบถามเพิ่มเติมพิมพ์มาได้เลย ทีมงานจะตอบกลับครับ 🙏'].join('\n\n').slice(0, 4800)
}

/**
 * deps: { enabled, userId, text, today, query(col, fields, equal)→rows, send(text)→bool, record(text) }
 * คืน true เมื่อตอบไปแล้ว (ผู้เรียกไม่ต้องให้ AI ตอบซ้ำ)
 */
export async function handleStatusAsk(deps) {
  if (!deps?.enabled || !deps.userId || !isStatusAsk(deps.text)) return false
  const q = (col, fields, eq) => deps.query(col, fields, eq).catch(() => [])
  const BK = ['status', 'custName', 'salesName', 'brand', 'model', 'colorOut', 'color', 'vin', 'bookingDate', 'createdAt', 'deliveryDate', 'customerId', 'lineUserId', 'deleted']
  const [byLine, custs] = await Promise.all([
    q('bookings', BK, ['lineUserId', deps.userId]),
    q('customers', ['bookingId', 'lineUserId', 'deleted'], ['lineUserId', deps.userId]),
  ])
  const ids = new Set(byLine.map(b => b.id))
  const custIds = custs.filter(c => !c.deleted).map(c => c.id)
  const viaCust = (await Promise.all(custIds.slice(0, 3).map(id => q('bookings', BK, ['customerId', id])))).flat()
  const mine = [...byLine, ...viaCust.filter(b => !ids.has(b.id) && ids.add(b.id))]
  if (!mine.some(b => b && !b.deleted && isOpenBooking(b))) return false
  const needEta = mine.some(b => b && !b.deleted && isOpenBooking(b) && needsBooking(b))
  const [all, avail, transit, orders] = needEta ? await Promise.all([
    q('bookings', BK),
    q('vehicles', ['status', 'brand', 'model', 'color', 'vin', 'arrivedAt', 'deleted'], ['status', 'available']),
    q('vehicles', ['status', 'brand', 'model', 'color', 'vin', 'arrivedAt', 'eta', 'expectedDate', 'deleted'], ['status', 'transit']),
    q('vehicle_orders', ['status', 'brand', 'model', 'color', 'qty', 'expectedDate', 'deleted']),
  ]) : [[], [], [], []]
  const text = statusAskReply({ mine, all, vehicles: [...avail, ...transit], orders, today: deps.today })
  if (!text) return false
  if (!(await deps.send(text))) return false
  await deps.record?.(text)
  return true
}
