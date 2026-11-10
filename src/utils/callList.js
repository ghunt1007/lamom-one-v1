// (v1.0.1035) "วันนี้ควรโทรหาใคร" ตอบทันทีจากข้อมูลจริง (ไม่ต้องรอ AI) — เรียงตามความเร่งด่วน:
//   1) นัดติดตามที่เลยกำหนด (เลยนานก่อน) 2) นัดวันนี้ (ตามเวลา) 3) Lead/Prospect Hot/Warm ที่เงียบ ≥ 3 วันและไม่มีนัดค้าง
// คะแนนโอกาสปิด (heuristicScore) ใช้ตัดสินเมื่อเร่งด่วนเท่ากัน · คืนรายการพร้อมเหตุผลสั้นๆ
import { heuristicScore } from './leadScore.js'
import { dmy } from './format.js'

const DAY = 86400e3
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY
const bkkDate = v => {
  const t = v?.toDate ? v.toDate() : v ? new Date(v) : null
  return t && !isNaN(t) ? new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''
}

export function isCallListQuestion(q) {
  const s = String(q || '')
  return /(?:ควร|ต้อง)\s*(?:โทร|ตาม|ติดต่อ)(?:หา)?\s*ใคร|ใคร(?:บ้าง)?\s*(?:ที่)?(?:ต้อง|ควร)\s*(?:โทร|ตาม)|โทรหาใคร(?:ดี|ก่อน)|ตามใครดี|ตามใครก่อน|call\s*list|รายชื่อ(?:ที่)?ต้องโทร/i.test(s)
}

export function callList({ customers = [], followups = [], today, now = Date.now(), limit = 5 }) {
  const byId = new Map(customers.filter(c => c && !c.deleted && !c.isLost).map(c => [c.id, c]))
  const rows = new Map()
  const t = dayNum(today)
  for (const f of followups) {
    if (!f || f.deleted || f.status !== 'pending' || !/^\d{4}-\d{2}-\d{2}/.test(f.dueDate || '')) continue
    const c = byId.get(f.customerId)
    if (!c) continue
    const d = f.dueDate.slice(0, 10), late = t - dayNum(d)
    if (late < 0) { if (!rows.has(c.id)) rows.set(c.id, { c, rank: 9, future: true }); continue }
    const rank = late > 0 ? 0 : 1
    const prev = rows.get(c.id)
    if (prev && !prev.future && (prev.rank < rank || (prev.rank === rank && prev.late >= late))) continue
    rows.set(c.id, { c, rank, late, time: f.time || '', why: late > 0 ? `เลยนัด ${late} วัน${f.purpose && f.purpose !== 'ทั่วไป' ? ' · ' + f.purpose : ''}` : `นัดวันนี้${f.time ? ' ' + f.time + ' น.' : ''}${f.note ? ' · ' + String(f.note).slice(0, 40) : ''}` })
  }
  for (const c of byId.values()) {
    if (rows.has(c.id) || !['lead', 'pp'].includes(c.stage) || !['hot', 'warm'].includes(c.temperature)) continue
    const last = bkkDate(c.lastContactAt) || bkkDate(c.createdAt)
    const quiet = last ? t - dayNum(last) : 99
    if (quiet < 3) continue
    rows.set(c.id, { c, rank: c.temperature === 'hot' ? 2 : 3, quiet, why: `${c.temperature === 'hot' ? '🔥 Hot' : 'Warm'} · ${c.lastContactAt ? `เงียบ ${quiet} วัน` : `ยังไม่เคยติดต่อ (เข้ามา ${dmy(last)})`} · ไม่มีนัดค้าง` })
  }
  return [...rows.values()].filter(r => !r.future)
    .map(r => ({ ...r, score: heuristicScore(r.c, now).score }))
    .sort((a, b) => a.rank - b.rank || (a.rank === 0 ? b.late - a.late : 0) || (a.rank === 1 ? String(a.time || '99').localeCompare(String(b.time || '99')) : 0) || b.score - a.score)
    .slice(0, limit)
    .map(r => ({ customer: r.c, why: r.why, score: r.score, phone: String(r.c.phone || '').replace(/[^\d+]/g, '') }))
}

// รายการ → คำสั่งการ์ด (📞 โทรเลย / 👤 เปิด ถ้าไม่มีเบอร์)
export function callListCommands(list) {
  return list.map(r => {
    const c = r.customer, name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.nickname || 'ลูกค้า'
    const desc = `${r.why}${c.interestedModel ? ' · 🚗 ' + c.interestedModel : ''} · โอกาสปิด ${r.score}%`
    return r.phone ? { kind: 'tel', customer: c, phone: r.phone, label: `📞 ${name}`, desc } : { kind: 'open', customer: c, label: `👤 ${name} (ไม่มีเบอร์)`, desc }
  })
}
