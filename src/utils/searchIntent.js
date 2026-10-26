// ช่องค้นหา Ctrl+K เข้าใจ "คำสั่ง" ไม่ใช่แค่คำค้น — พิมพ์ชื่อ+เบอร์ลูกค้าใหม่ แล้วกด Enter = เพิ่ม Lead ให้เลย
// (ตัดสินใจในเครื่องล้วน ไม่ส่งข้อมูลออก) · หน้าเมนูทั้งหมดค้นได้จากเมนูเดียวกับแถบซ้าย (data/navMenu.js)
import { menuMatches } from './menuSearch.js'

const LEAD_WORDS = /^(เพิ่ม\s*(ลีด|lead|ลูกค้า)|ลีดใหม่|lead\s*ใหม่|ลูกค้าใหม่|new\s*lead|\+\s*lead)\s*/i
const PHONE = /(?:\+?66|0)\d(?:[\s-]?\d){7,8}/

// คืน { kind: 'lead', text } เมื่อดูเหมือนตั้งใจเพิ่มลูกค้าใหม่ · null ถ้าไม่ใช่
// phoneKnown(digits) = true เมื่อเบอร์นี้มีลูกค้าอยู่แล้ว (ไม่เสนอเพิ่มซ้ำ)
export function detectLeadIntent(q, phoneKnown = () => false) {
  const s = String(q || '').trim()
  if (!s) return null
  const byWord = LEAD_WORDS.test(s)
  const ph = s.match(PHONE)
  const digits = ph ? ph[0].replace(/\D/g, '').replace(/^66/, '0') : ''
  // เบอร์อย่างเดียวไม่พอ ต้องมีชื่อ/รุ่นประกอบด้วย (พิมพ์เบอร์เพื่อค้นหาลูกค้าเดิมเป็นเรื่องปกติ)
  const hasWords = /[ก-๙a-z]{2,}/i.test(s.replace(PHONE, '').replace(LEAD_WORDS, ''))
  if (digits && phoneKnown(digits)) return null
  if (!(byWord || (digits && hasWords))) return null
  const text = s.replace(LEAD_WORDS, '').trim()
  // ชื่อ = คำที่พิมพ์ก่อนเบอร์/ก่อนคำว่า "สนใจ" (พิมพ์แบบคำสั่งมักขึ้นต้นด้วยชื่อ) ตัด "คุณ/ชื่อ" ออก
  const head = text.split(PHONE)[0].split(/\s(?:สนใจ|อยากได้|รุ่น|จาก|line|ไลน์|@)/i)[0].replace(/^(คุณ|ชื่อ)\s*/, '').trim()
  const name = head && !/\d/.test(head) && head.length <= 40 ? head : ''
  return { kind: 'lead', text, name }
}

// nav = กลุ่มเมนูที่กรองสิทธิ์แล้ว · คืนรายการหน้าที่ตรงคำค้น ไม่ซ้ำ route
export function matchMenuPages(nav, q, limit = 8) {
  const seen = new Set(), out = []
  for (const g of nav) for (const i of g.items) {
    if (seen.has(i.path) || !menuMatches(i.label, i.path, q)) continue
    seen.add(i.path)
    out.push({ ...i, group: g.group })
    if (out.length >= limit) return out
  }
  return out
}
