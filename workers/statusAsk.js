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
// (v1.0.1266) ถามงานศูนย์บริการ: "รถซ่อมเสร็จยัง" / "เช็คระยะเสร็จหรือยัง" / "รับรถที่ศูนย์ได้กี่โมง"
export const JOB_ASK_RE = /(?:ซ่อม|เช็[คก]ระยะ|ศูนย์|เซอร์วิส|ล้างรถ|ทำสี|เคลม).{0,12}(?:เสร็จ|ได้(?:รับ)?(?:รถ)?(?:เมื่อ|กี่)|ยัง(?!ไง))|(?:รถ.{0,6}เสร็จ(?:แล้ว)?(?:หรือ)?ยัง)/
export const isJobAsk = text => { const t = String(text || '').replace(/\s+/g, ''); return t.length > 0 && t.length <= 80 && JOB_ASK_RE.test(t) }
const JOB_LABEL = { waiting: 'รอรับรถเข้าศูนย์', checkin: 'รับรถเข้าศูนย์แล้ว', diagnosing: 'กำลังตรวจเช็กหาสาเหตุ', inprogress: 'กำลังดำเนินการ', waiting_parts: 'รออะไหล่', qc: 'กำลังตรวจคุณภาพก่อนส่งมอบ', done: 'เสร็จเรียบร้อย พร้อมให้มารับได้เลย 🚗' }
/** ข้อความตอบสถานะงานศูนย์ (ฟังก์ชันล้วน) — jobs = ใบงานของลูกค้าคนนี้ · ไม่มีงานค้าง = null */
export function jobAskReply({ jobs = [], name = '' } = {}) {
  const open = jobs.filter(j => j && !j.deleted && j.id && JOB_LABEL[j.status])
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
  if (!open.length) return null
  const n = String(name || '').trim().replace(/^คุณ/, '').split(/\s+/)[0]
  const lines = open.slice(0, 2).map(j => {
    const car = [[j.brand, j.model].filter(Boolean).join(' ').trim(), j.plate ? `ทะเบียน ${String(j.plate).trim()}` : ''].filter(Boolean).join(' ')
    return `🔧 รถ${car ? ` ${car}` : 'ของคุณ'}: ${JOB_LABEL[j.status]}`
  })
  return [`${n ? `สวัสดีครับคุณ${n}` : 'สวัสดีครับ'} สถานะงานที่ศูนย์บริการตอนนี้ครับ`, ...lines, 'สอบถามค่าใช้จ่ายหรือรายละเอียดเพิ่ม พิมพ์มาได้เลย ทีมงานจะตอบกลับครับ 🙏'].join('\n')
}

// (v1.0.1282) ลูกค้าถามว่าเช็คระยะครั้งหน้าเมื่อไหร่ → ตอบจากหน้าแจ้งเตือนเช็คระยะ (service_reminders) ของเบอร์ตัวเอง
export const DUE_ASK_RE = /(?:เช็[คก]ระยะ|เข้าศูนย์|เซอร์วิส|ถ่ายน้ำมันเครื่อง).{0,12}(?:ครั้งหน้า|ครั้งต่อไป|รอบหน้า|รอบต่อไป|เมื่อไหร่|เมื่อไร|วันไหน|ตอนไหน|กี่โมง)|(?:ครบ|ถึง)กำหนด.{0,8}(?:เช็[คก]ระยะ|เข้าศูนย์)|(?:ครั้งหน้า|รอบหน้า).{0,6}(?:เช็[คก]ระยะ|เข้าศูนย์)/
export const isDueAsk = text => { const t = String(text || '').replace(/\s+/g, ''); return t.length > 0 && t.length <= 80 && DUE_ASK_RE.test(t) && !/ราคา|เท่าไหร่|กี่บาท|ค่าใช้จ่าย/.test(t) }
const digitsOf = p => String(p || '').replace(/\D/g, '').replace(/^66(?=\d{9}$)/, '0')
const dayN = d => { const [y, m, x] = String(d).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, x) / 864e5 }
/** ข้อความตอบกำหนดเข้าศูนย์ (ฟังก์ชันล้วน) — reminders ของเบอร์ลูกค้าคนนี้ · ไม่มีรายการ = null (ให้ทีมตอบเอง) */
export function dueAskReply({ reminders = [], name = '', today = '' } = {}) {
  const rows = reminders.filter(r => r && !r.deleted && /^\d{4}-\d{2}-\d{2}/.test(String(r.dueDate || '')) && dayN(r.dueDate) >= dayN(today) - 60)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
  if (!rows.length) return null
  const n = String(name || '').trim().replace(/^คุณ/, '').split(/\s+/)[0]
  const lines = rows.slice(0, 2).map(r => {
    const car = [String(r.model || '').trim(), r.plate ? `ทะเบียน ${String(r.plate).trim()}` : ''].filter(Boolean).join(' ')
    const left = dayN(r.dueDate) - dayN(today)
    const when = left === 0 ? 'วันนี้' : left < 0 ? `วันที่ ${dmy(r.dueDate)} (เลยกำหนดมา ${-left} วัน)` : `วันที่ ${dmy(r.dueDate)}`
    return `🔧 รถ${car ? ` ${car}` : 'ของคุณ'}: ถึงกำหนดเข้าศูนย์${r.detail ? ` (${String(r.detail).trim()})` : ''} ${when}${r.booked ? ' · จองคิวไว้แล้ว ✅' : ''}`
  })
  const anyOpen = rows.slice(0, 2).some(r => !r.booked)
  return [`${n ? `สวัสดีครับคุณ${n}` : 'สวัสดีครับ'} กำหนดเข้าศูนย์ครั้งถัดไปครับ`, ...lines, anyOpen ? 'ต้องการนัดวันเวลา ตอบกลับข้อความนี้ได้เลย ทีมงานจะจองคิวให้ครับ 🙏' : 'ถ้าต้องการเปลี่ยนวันนัด พิมพ์มาได้เลยครับ 🙏'].join('\n')
}

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
  if (!deps?.enabled || !deps.userId) return false
  const q = (col, fields, eq) => deps.query(col, fields, eq).catch(() => [])
  if (isDueAsk(deps.text) && !isStatusAsk(deps.text)) return handleDueAsk(deps, q)
  if (isJobAsk(deps.text) && !isStatusAsk(deps.text)) return handleJobAsk(deps, q)
  if (!isStatusAsk(deps.text)) return false
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

// (v1.0.1266) ลูกค้าที่ผูก LINE ถามงานศูนย์บริการ → ตอบจากใบงาน (job_cards) ของตัวเอง (จับด้วยแฟ้มลูกค้า หรือเบอร์โทรในแฟ้ม)
async function handleJobAsk(deps, q) {
  const custs = (await q('customers', ['firstName', 'phone', 'lineUserId', 'deleted'], ['lineUserId', deps.userId])).filter(c => !c.deleted)
  if (!custs.length) return false
  const F = ['status', 'custName', 'phone', 'customerId', 'brand', 'model', 'plate', 'updatedAt', 'createdAt', 'deleted']
  const byCust = (await Promise.all(custs.slice(0, 3).map(c => q('job_cards', F, ['customerId', c.id])))).flat()
  const phones = [...new Set(custs.map(c => String(c.phone || '').trim()).filter(p => p.replace(/\D/g, '').length >= 9))].slice(0, 3)
  const byPhone = (await Promise.all(phones.map(p => q('job_cards', F, ['phone', p])))).flat()
  const seen = new Set()
  const jobs = [...byCust, ...byPhone].filter(j => j?.id && !seen.has(j.id) && seen.add(j.id))
  const text = jobAskReply({ jobs, name: custs[0].firstName })
  if (!text) return false
  if (!(await deps.send(text))) return false
  await deps.record?.(text)
  return true
}

// (v1.0.1282) จับรายการเตือนด้วยเบอร์โทรในแฟ้มลูกค้าที่ผูก LINE นี้ (เบอร์ในหน้าเตือนอาจมีขีด/เว้นวรรค จึงอ่านทั้งหมดแล้วเทียบตัวเลข)
async function handleDueAsk(deps, q) {
  const custs = (await q('customers', ['firstName', 'phone', 'lineUserId', 'deleted'], ['lineUserId', deps.userId])).filter(c => !c.deleted)
  const phones = new Set(custs.map(c => digitsOf(c.phone)).filter(p => p.length >= 9))
  if (!phones.size) return false
  const all = await q('service_reminders', ['customer', 'phone', 'plate', 'model', 'detail', 'dueDate', 'booked', 'deleted'])
  const text = dueAskReply({ reminders: all.filter(r => phones.has(digitsOf(r.phone))), name: custs[0].firstName, today: deps.today })
  if (!text) return false
  if (!(await deps.send(text))) return false
  await deps.record?.(text)
  return true
}
