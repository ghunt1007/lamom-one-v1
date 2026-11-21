// (v1.0.1230) "🔗 ผูก LINE" — QR ให้ลูกค้าสแกนครั้งเดียว แล้ว LINE ของลูกค้าผูกกับแฟ้มในแอป
// ลูกค้าสแกน → LINE เปิดแชต OA พร้อมข้อความ "ผูก ABC123" → กดส่ง → worker ใส่ lineUserId ให้ (workers/lineLink.js)
// หลังผูกแล้ว: แจ้งสถานะรถ/ขอรีวิว/ส่งข้อความกลุ่ม ส่งถึงลูกค้าคนนี้ได้ · ลูกค้าพิมพ์ "เลิกรับ" ได้ทุกเมื่อ (PDPA)
import { updateDocData } from '../core/db.js'
import { showToast } from '../core/store.js'
import { openQrModal } from './qrModal.js'
import { formatDate } from './format.js'
import { smsHref } from './callLink.js'
import { isOpenBooking } from './bookingStatus.js'

const WORKER = import.meta.env.VITE_DAILY_REPORT_URL || 'https://lamom-daily-report.ghunt1007.workers.dev'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// รหัส 6 ตัวแบบสุ่มจริง (crypto) — ต้องตรงกับรูปแบบที่ worker อ่าน (parseLinkCode)
export function makeLinkCode(rand = null) {
  const bytes = rand ? Array.from({ length: 6 }, () => Math.floor(rand() * 256)) : Array.from(crypto.getRandomValues(new Uint8Array(6)))
  return bytes.map(b => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

// ลิงก์เปิดแชต OA พร้อมข้อความ (LINE URL scheme: oaMessage) — ถ้าไม่รู้ @basicId คืน ''
export function lineLinkUrl(basicId, code) {
  if (!/^@[A-Za-z0-9._-]{2,40}$/.test(String(basicId || '')) || !/^[A-Z0-9]{6}$/.test(String(code || ''))) return ''
  return `https://line.me/R/oaMessage/${encodeURIComponent(basicId)}/?${encodeURIComponent('ผูก ' + code)}`
}

// (v1.0.1236) ใบจองที่ยังไม่ส่งมอบ/ไม่ถอน และลูกค้ายังไม่ผูก LINE (ควรชวนผูก จะได้แจ้งสถานะรถเองได้)
export const needsLineLink = b => !!b && !b.deleted && isOpenBooking(b) && !b.lineUserId

// สถานะการผูกของลูกค้า/ใบจอง (ไว้โชว์ป้ายในแฟ้ม)
export function lineLinkState(d) {
  if (!d?.lineUserId) return { linked: false, label: '' }
  if (d.lineBlockedAt) return { linked: true, label: '🚫 ลูกค้าบล็อก LINE OA' }
  if (d.lineOptOut) return { linked: true, label: '🔕 ผูกแล้ว · ลูกค้าขอเลิกรับข้อความ' }
  return { linked: true, label: `✅ ผูก LINE แล้ว${d.lineLinkedAt ? ` (${formatDate(d.lineLinkedAt)})` : ''}` }
}

let oaCache = { at: 0, id: '' }
export async function fetchOaId() {
  if (oaCache.id && Date.now() - oaCache.at < 3600e3) return oaCache.id
  try {
    const r = await fetch(`${WORKER}/lead/info`)
    const d = r.ok ? await r.json() : null
    const id = /^@[A-Za-z0-9._-]{2,40}$/.test(String(d?.line || '')) ? d.line : ''
    if (id) oaCache = { at: Date.now(), id }
    return id
  } catch { return '' }
}

/**
 * เปิด QR ผูก LINE · targets = [{ col: 'customers'|'bookings', id }] (ใส่รหัสเดียวกันทุกเอกสาร)
 * name = ชื่อลูกค้า (หัวป้ายพิมพ์)
 */
// (v1.0.1235) สร้างรหัสผูก + ลิงก์ (ใช้ทั้ง QR และส่งลิงก์ทาง SMS) — คืน { oa, code, url } หรือ null (แจ้งเตือนให้แล้ว)
export async function prepareLineLink(targets = []) {
  const list = targets.filter(t => t && t.id && ['customers', 'bookings'].includes(t.col))
  if (!list.length) return null
  const oa = await fetchOaId()
  if (!oa) { showToast('ยังดึงชื่อ LINE OA ไม่ได้ — ตรวจว่าเชื่อม LINE OA หลักแล้ว (หน้าเชื่อมช่องทาง)', 'error'); return null }
  const code = makeLinkCode()
  const at = new Date().toISOString()
  try {
    for (const t of list) await updateDocData(t.col, t.id, { lineLinkCode: code, lineLinkCodeAt: at })
  } catch { showToast('สร้างรหัสไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'); return null }
  return { oa, code, url: lineLinkUrl(oa, code) }
}

// ข้อความต่อท้าย SMS/แชตอื่น ชวนลูกค้าแตะลิงก์ผูก LINE
export function lineLinkInvite(url) {
  return url ? `\n\nรับข่าวโปรและแจ้งสถานะรถทาง LINE: แตะลิงก์นี้แล้วกด "ส่ง" ข้อความที่ขึ้นมา ${url}` : ''
}

export async function openLineLinkQr({ targets = [], name = '', phone = '' } = {}) {
  const ready = await prepareLineLink(targets)
  if (!ready) return null
  const { oa, code, url } = ready
  return openQrModal({
    title: 'ผูก LINE ลูกค้า', url, filename: `ผูกLINE-${code}`,
    sms: smsHref(phone, `สวัสดีครับ${name ? ' คุณ' + name : ''}`.trim() + lineLinkInvite(url)),
    note: `ให้ลูกค้าสแกนด้วยกล้องมือถือ → LINE จะเปิดแชต ${oa} พร้อมข้อความ "ผูก ${code}" → ลูกค้ากดส่ง เท่านั้น · รหัสใช้ได้ 30 วัน · ลูกค้าพิมพ์ "เลิกรับ" เพื่อหยุดรับข้อความได้ทุกเมื่อ`,
    poster: { heading: 'รับแจ้งสถานะรถทาง LINE', lines: [name ? `คุณ${name}` : '', 'สแกน แล้วกด "ส่ง" ข้อความที่ขึ้นมา', `รหัส ${code}`].filter(Boolean) },
  })
}
