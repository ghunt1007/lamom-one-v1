// (v1.0.1231) ปลุกลีดเก่า: Lead/Prospect ที่เงียบเกิน 30 วัน → ร่างข้อความรายคน (AI หรือแบบฟอร์ม) แล้วส่งทีเดียว
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล — หน้า src/pages/crm/WakeLeads.js เป็นคนส่งและบันทึก
// กติกากันโดนบล็อก/PDPA: ทักคนละไม่เกิน 1 ครั้งต่อ 30 วัน (wakeSentAt) · ข้ามคนที่พิมพ์ "เลิกรับ"/บล็อก OA/ไม่ยินยอมรับข่าวสาร
import { toDate } from './format.js'

export const WAKE_QUIET_DAYS = 30
export const WAKE_COOLDOWN_DAYS = 30
export const WAKE_MAX_DAYS = 365 // เงียบเกิน 1 ปี ถือว่าหลุดแล้ว ไม่ทัก

const dayNum = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5 }
// วันที่แบบไทย (YYYY-MM-DD) ของค่าเวลาใดๆ (Firestore Timestamp / ISO / Date) — ไม่รู้ = ''
export function bkkDay(v) {
  const d = toDate(v)
  if (!d || Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10)
}
export function daysSince(v, today) {
  const d = bkkDay(v)
  return d ? Math.round(dayNum(today) - dayNum(d)) : null
}

// ครั้งล่าสุดที่ "มีการเคลื่อนไหวจริง" กับลูกค้า (ไม่ใช้ updatedAt เพราะซิงก์ Sheet/แก้ข้อมูลก็เปลี่ยน)
export function lastTouchDays(c, today) {
  const ds = [c.lastContactAt, c.reEnquiredAt, c.stageChangedAt, c.wakeSentAt, c.createdAt].map(v => daysSince(v, today)).filter(n => n != null && n >= 0)
  return ds.length ? Math.min(...ds) : null
}

export const isLineUid = v => /^U[0-9a-f]{10,40}$/i.test(String(v || ''))

/**
 * customers → [{ c, days, channel: 'line'|'phone', name }] เรียง Hot ก่อน แล้วเงียบน้อยก่อน (ยังอุ่นกว่า)
 * mine(c) = ลูกค้าที่ผู้ใช้คนนี้มีสิทธิ์เห็น
 */
export function pickWakeLeads(customers, { today, mine = () => true, quiet = WAKE_QUIET_DAYS, cooldown = WAKE_COOLDOWN_DAYS, maxDays = WAKE_MAX_DAYS } = {}) {
  const out = []
  for (const c of customers || []) {
    if (!c || c.deleted || c.isLost || !['lead', 'pp'].includes(c.stage) || c.bookingId) continue
    if (c.lineOptOut || c.lineBlockedAt || c.marketingConsent === 'no') continue
    if (!mine(c)) continue
    const sent = daysSince(c.wakeSentAt, today)
    if (sent != null && sent < cooldown) continue
    const days = lastTouchDays(c, today)
    if (days == null || days < quiet || days > maxDays) continue
    const phone = String(c.phone || '').replace(/\D/g, '')
    const channel = isLineUid(c.lineUserId) ? 'line' : phone.length >= 9 ? 'phone' : ''
    if (!channel) continue
    out.push({ c, days, channel, name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ลูกค้า' })
  }
  const t = { hot: 0, warm: 1, cold: 3 }
  return out.sort((a, b) => (t[a.c.temperature] ?? 2) - (t[b.c.temperature] ?? 2) || a.days - b.days)
}

// ข้อความตั้งต้น (ไม่ใช้ AI) — โปรเดือนนี้ใส่เฉพาะเมื่อมีโปรจริงของรุ่นนั้น (promo = บรรทัดจาก promoLines)
export function wakeMessage(c, promo = [], me = '') {
  const first = String(c.firstName || '').trim().split(/\s+/)[0]
  const hi = first && !/^ลูกค้า/.test(first) ? `สวัสดีครับคุณ${first}` : 'สวัสดีครับ'
  const who = me ? ` ผม${me}จากโชว์รูมครับ` : ''
  const car = String(c.interestedModel || '').trim()
  const deal = promo.length ? ` เดือนนี้${car ? ` ${car}` : ''}มี${promo.slice(0, 2).join(' และ ')}` : ''
  return `${hi}${who} ไม่ได้คุยกันนานเลย${car ? ` ยังสนใจ ${car} อยู่ไหมครับ` : ' ยังสนใจรถอยู่ไหมครับ'}${deal} ถ้าสะดวก แวะมาทดลองขับหรือให้ผมคำนวณค่างวดให้ได้เลยครับ`
}

// คำสั่ง AI ร่างข้อความรายคน (ใส่โปรจริงได้ ถ้ามี) — ตอบเป็น JSON [{ i, msg }] ใช้ parseBatchNudgeReply อ่าน
export function buildWakePrompt(rows) {
  const lines = rows.map((r, i) => {
    const first = String(r.c.firstName || 'ลูกค้า').trim().split(/\s+/)[0]
    return `${i + 1}. ${first} · สนใจ ${r.c.interestedModel || 'ยังไม่ระบุรุ่น'} · เงียบ ${r.days} วัน${r.promo?.length ? ` · โปรจริงเดือนนี้: ${r.promo.slice(0, 2).join(', ')}` : ''}`
  })
  return `คุณคือเซลส์รถยนต์ไฟฟ้าในไทยที่สุภาพ เป็นกันเอง ร่างข้อความ LINE สั้นๆ ทักลูกค้าแต่ละคนที่เงียบไปนานให้กลับมาคุยกัน
ให้แต่ละข้อความต่างกัน ไม่เกิน 3 ประโยค เรียกชื่อลูกค้า ("คุณ...") อ้างรุ่นที่สนใจ และชวนมาทดลองขับหรือให้คำนวณค่างวด
ถ้ามี "โปรจริงเดือนนี้" ให้เอ่ยถึงได้ตามที่ให้มาเท่านั้น ห้ามแต่งราคา ส่วนลด หรือโปรเอง ห้ามใช้อีโมจิเกิน 1 ตัว
ลูกค้า:
${lines.join('\n')}

ตอบเป็น JSON array อย่างเดียว: [{"i": ลำดับ, "msg": "ข้อความ"}]`
}
