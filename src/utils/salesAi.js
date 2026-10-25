// "AI ผู้ช่วยปิดการขาย" — สรุปข้อมูลลูกค้า 1 ราย (สถานะ ความสนใจ ประวัติการติดต่อ นัดที่ค้าง เหตุผลเสียดีล)
// เป็นข้อความสั้นๆ ส่งให้ Gemini ช่วยคิดว่า "ควรทำอะไรต่อ" และร่างข้อความ LINE ให้พร้อมส่ง
// ไม่ส่งเบอร์โทร/อีเมล/LINE ID ออกไปนอกระบบ — AI ไม่จำเป็นต้องรู้เพื่อให้คำแนะนำ
import { toDateStr } from './format.js'

const STAGE_TH = { lead: 'Lead (ยังไม่ได้คุยจริงจัง)', pp: 'Prospect (คุยแล้ว มีช่องทางติดต่อ)', booking: 'จองแล้ว', delivered: 'ส่งมอบแล้ว' }
const TEMP_TH = { hot: 'ร้อน (สนใจมาก)', warm: 'อุ่น', cold: 'เย็น' }
const SOURCE_TH = { facebook: 'Facebook', line: 'LINE', tiktok: 'TikTok', 'walk-in': 'เดินเข้าโชว์รูม', referral: 'ลูกค้าแนะนำ', google: 'Google', website: 'เว็บไซต์', phone: 'โทรเข้า', other: 'อื่นๆ' }

function daysBetween(a, b) {
  const t = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  return Math.round((t(b) - t(a)) / 86400000)
}

// c = เอกสารลูกค้า, history = [{ ts, label, text }] ใหม่สุดก่อน, followups = นัดที่ค้าง [{ dueDate, purpose, note }]
export function buildCustomerBrief(c, { history = [], followups = [], today }) {
  const created = toDateStr(c.createdAt)
  const last = toDateStr(c.lastContactAt)
  const lines = [
    `ชื่อลูกค้า: ${c.firstName || 'ลูกค้า'}`,
    `สถานะ: ${STAGE_TH[c.stage] || c.stage || '-'}${c.isLost ? ` · เสียดีลแล้ว เหตุผล: ${c.lostReason || '-'}` : ''}`,
    c.temperature ? `ความสนใจ: ${TEMP_TH[c.temperature] || c.temperature}` : null,
    `รุ่นที่สนใจ: ${c.interestedModel || 'ยังไม่ระบุ'}`,
    c.budget ? `งบประมาณ: ${Number(c.budget).toLocaleString('en-US')} บาท` : null,
    c.occupation ? `อาชีพ: ${c.occupation}` : null,
    c.monthlyIncome ? `รายได้ต่อเดือน: ${Number(c.monthlyIncome).toLocaleString('en-US')} บาท` : null,
    `ที่มา: ${SOURCE_TH[c.source] || c.source || '-'}`,
    created && today ? `เป็นลูกค้ามาแล้ว: ${daysBetween(created, today)} วัน` : null,
    last && today ? `ติดต่อล่าสุด: ${daysBetween(last, today)} วันก่อน` : 'ยังไม่มีบันทึกการติดต่อ',
    !c.isLost && c.prevLostReason ? `เคยเสียดีลมาก่อนเพราะ: ${c.prevLostReason}` : null,
  ]
  const hist = history.filter(h => h && (h.text || h.label)).slice(0, 8)
  if (hist.length) {
    lines.push('ประวัติการติดต่อ (ล่าสุดก่อน):')
    hist.forEach(h => lines.push(`- ${toDateStr(h.ts) || '-'} ${h.label || ''}: ${String(h.text || '').slice(0, 160)}`))
  }
  const fus = followups.slice(0, 5)
  if (fus.length) {
    lines.push('นัดติดตามที่ค้างอยู่:')
    fus.forEach(f => lines.push(`- ${f.dueDate || '-'} ${f.purpose || 'ติดตาม'}${f.note ? ` (${String(f.note).slice(0, 80)})` : ''}`))
  }
  return lines.filter(Boolean).join('\n')
}

export function buildCloserPrompt(brief) {
  return `คุณคือโค้ชการขายรถยนต์ไฟฟ้ามือหนึ่งของโชว์รูมในไทย ช่วยเซลส์ปิดการขายลูกค้ารายนี้
ข้อมูลลูกค้าจากระบบ (ใช้เฉพาะข้อมูลนี้ ห้ามแต่งข้อเท็จจริงเพิ่ม):
${brief}

ตอบเป็น JSON object อย่างเดียว ภาษาไทย กระชับ ใช้ได้จริงวันนี้:
{"score": โอกาสปิดการขาย 0-100,
 "summary": "สรุปสถานการณ์ลูกค้า 1 ประโยค",
 "nextAction": "สิ่งที่ควรทำต่อทันที 1 อย่าง ชัดเจน",
 "when": "ควรทำเมื่อไหร่ เช่น วันนี้ก่อนเที่ยง / พรุ่งนี้",
 "channel": "call หรือ line หรือ visit",
 "lineMessage": "ข้อความ LINE ที่เซลส์ส่งให้ลูกค้าได้เลย สุภาพ เป็นกันเอง ไม่เกิน 3 ประโยค ไม่ใส่ราคาหรือโปรที่ไม่มีในข้อมูล",
 "objections": ["ข้อกังวลที่ลูกค้าน่าจะมี พร้อมวิธีตอบสั้นๆ", "..."],
 "followUpDays": จำนวนวันจากวันนี้ที่ควรนัดติดตามครั้งถัดไป 0-14}`
}

const CHANNELS = ['call', 'line', 'visit']

// ดึง JSON จากคำตอบ AI (อาจมี ```json ครอบ หรือมีข้อความปน) แล้วจัดรูปให้ปลอดภัยก่อนแสดง — คืน null ถ้าอ่านไม่ได้
export function parseCloserReply(text) {
  const raw = String(text || '').match(/\{[\s\S]*\}/)?.[0]
  if (!raw) return null
  let o
  try { o = JSON.parse(raw) } catch { return null }
  if (!o || typeof o !== 'object') return null
  const num = (v, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : null)
  const str = v => (typeof v === 'string' ? v.trim() : '')
  const out = {
    score: num(o.score, 0, 100),
    summary: str(o.summary),
    nextAction: str(o.nextAction),
    when: str(o.when),
    channel: CHANNELS.includes(o.channel) ? o.channel : '',
    lineMessage: str(o.lineMessage),
    objections: (Array.isArray(o.objections) ? o.objections : []).map(str).filter(Boolean).slice(0, 4),
    followUpDays: num(o.followUpDays, 0, 30),
  }
  return out.summary || out.nextAction || out.lineMessage ? out : null
}

// วันนัดถัดไป 'YYYY-MM-DD' จาก followUpDays ที่ AI แนะนำ
export function addDaysIso(today, days) {
  const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) + (days || 0)))
  return d.toISOString().slice(0, 10)
}
