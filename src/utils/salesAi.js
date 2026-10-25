// "AI ผู้ช่วยปิดการขาย" — สรุปข้อมูลลูกค้า 1 ราย (สถานะ ความสนใจ ประวัติการติดต่อ นัดที่ค้าง เหตุผลเสียดีล)
// เป็นข้อความสั้นๆ ส่งให้ Gemini ช่วยคิดว่า "ควรทำอะไรต่อ" และร่างข้อความ LINE ให้พร้อมส่ง
// ไม่ส่งเบอร์โทร/อีเมล/LINE ID ออกไปนอกระบบ — AI ไม่จำเป็นต้องรู้เพื่อให้คำแนะนำ
import { toDateStr } from './format.js'
import { flatMonthly } from './installment.js'

const STAGE_TH = { lead: 'Lead (ยังไม่ได้คุยจริงจัง)', pp: 'Prospect (คุยแล้ว มีช่องทางติดต่อ)', booking: 'จองแล้ว', delivered: 'ส่งมอบแล้ว' }
const TEMP_TH = { hot: 'ร้อน (สนใจมาก)', warm: 'อุ่น', cold: 'เย็น' }
const SOURCE_TH = { facebook: 'Facebook', line: 'LINE', tiktok: 'TikTok', 'walk-in': 'เดินเข้าโชว์รูม', referral: 'ลูกค้าแนะนำ', google: 'Google', website: 'เว็บไซต์', phone: 'โทรเข้า', other: 'อื่นๆ' }

function daysBetween(a, b) {
  const t = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  return Math.round((t(b) - t(a)) / 86400000)
}

// c = เอกสารลูกค้า, history = [{ ts, label, text }] ใหม่สุดก่อน, followups = นัดที่ค้าง [{ dueDate, purpose, note }]
const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9ก-๙]+/g, '')

// หารุ่นใน catalog ที่ตรงกับ "รุ่นที่สนใจ" (เช่น 'Deepal S07', 's05 max') → คืนบรรทัดข้อมูลจริง สูงสุด limit รุ่นย่อย
// ใช้ชื่อรุ่นที่ยาวที่สุดที่เจอในข้อความ เพื่อไม่ให้ 'S07' ไปจับ 'S07 (2026)' ผิดยี่ห้อ
export function modelFacts(interested, vehicles = [], limit = 4) {
  return modelMatches(interested, vehicles, limit).map(v => [
    `${v.brand} ${v.model} ${v.variant || ''}`.trim(),
    v.price ? `ราคา ${Number(v.price).toLocaleString('en-US')} บาท` : null,
    v.range ? `วิ่งได้ ${v.range} กม.` : null,
    v.battery ? `แบต ${v.battery}` : null,
    v.chargeDC ? `ชาร์จเร็ว DC ${v.chargeDC} kW` : null,
    v.warranty ? `รับประกัน ${v.warranty}` : null,
  ].filter(Boolean).join(' · '))
}

// รุ่นย่อยใน catalog ที่ตรงกับ "รุ่นที่สนใจ" (object รถเต็มๆ) — ใช้ทั้งสรุปสเปคและเครื่องคิดค่างวด
export function modelMatches(interested, vehicles = [], limit = 4) {
  const q = norm(interested)
  if (!q || !vehicles.length) return []
  let best = 0
  const hits = []
  for (const v of vehicles) {
    const m = norm(v.model)
    if (m.length < 2 || !q.includes(m)) continue
    const brandHit = q.includes(norm(v.brand))
    if (m.length <= 2 && !brandHit) continue // รุ่นชื่อสั้น (D9, M6, X1) ต้องมียี่ห้อด้วย กันจับผิด
    const score = m.length + (brandHit ? 100 : 0)
    if (score > best) { best = score; hits.length = 0 }
    if (score === best) hits.push(v)
  }
  // ถ้าระบุรุ่นย่อยด้วย (เช่น 'max') ให้รุ่นย่อยนั้นขึ้นก่อน
  const words = v => String(v.variant || '').toLowerCase().split(/[^a-z0-9ก-๙]+/).filter(w => w.length >= 2)
  const common = w => hits.every(h => words(h).includes(w))
  const vHit = v => words(v).filter(w => !common(w) && q.includes(w)).length
  const sorted = hits.slice().sort((a, b) => vHit(b) - vHit(a) || (a.price || 0) - (b.price || 0))
  return sorted.slice(0, limit)
}

export function buildCustomerBrief(c, { history = [], followups = [], today, vehicles = [] }) {
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
  const facts = modelFacts(c.interestedModel, vehicles)
  if (facts.length) {
    lines.push('ข้อมูลรถรุ่นที่สนใจ (ราคาตั้งจากระบบ ยังไม่รวมโปรโมชั่น):')
    facts.forEach(f => lines.push(`- ${f}`))
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
 "lineMessage": "ข้อความ LINE ที่เซลส์ส่งให้ลูกค้าได้เลย สุภาพ เป็นกันเอง ไม่เกิน 3 ประโยค ถ้าจำเป็นใช้ได้เฉพาะราคาและสเปคที่อยู่ใน \"ข้อมูลรถรุ่นที่สนใจ\" ห้ามแต่งโปรโมชั่น/ส่วนลด",
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

// สำหรับแชท LAMI: ถ้าคำถามพูดถึงรุ่นรถ → แนบสเปค/ราคาจริงจาก catalog; ถ้าพูดถึงแค่ยี่ห้อ → แนบรายชื่อรุ่น + ช่วงราคา
// คืน '' ถ้าคำถามไม่เกี่ยวกับรถ (ไม่เพิ่ม context ฟรีๆ)
export function catalogContext(text, vehicles = []) {
  const hits = modelMatches(text, vehicles, 6)
  if (hits.length) {
    const facts = modelFacts(text, vehicles, 6)
    return 'ข้อมูลรถจากระบบ (ราคาตั้ง ยังไม่รวมโปร):\n' + facts.map((f, i) => {
      const m = hits[i].price ? flatMonthly(hits[i].price, 20, 72, 2.79).monthly : 0
      return `- ${f}${m ? ` · ตัวอย่างค่างวด ~${m.toLocaleString('en-US')} บาท/เดือน (ดาวน์ 20% 72 งวด ดอกเบี้ย 2.79% ต่อปี เป็นตัวเลขเบื้องต้น)` : ''}`
    }).join('\n')
  }
  const q = norm(text)
  const brands = [...new Set(vehicles.map(v => v.brand).filter(Boolean))].filter(b => norm(b).length >= 3 && q.includes(norm(b)))
  if (!brands.length) return ''
  const out = []
  for (const b of brands.slice(0, 2)) {
    const byModel = {}
    vehicles.filter(v => v.brand === b).forEach(v => { (byModel[v.model] ||= []).push(v.price || 0) })
    const rows = Object.entries(byModel).slice(0, 12).map(([m, ps]) => {
      const p = ps.filter(Boolean)
      const fmt = n => Number(n).toLocaleString('en-US')
      return `- ${b} ${m}${p.length ? ` ราคา ${fmt(Math.min(...p))}${Math.max(...p) !== Math.min(...p) ? `–${fmt(Math.max(...p))}` : ''} บาท` : ''} (${ps.length} รุ่นย่อย)`
    })
    out.push(`รุ่นของ ${b} ในระบบ:`, ...rows)
  }
  return out.join('\n')
}

// "ร่างข้อความทักลูกค้าที่เงียบ ทีละหลายคน" — ส่ง AI แค่ชื่อต้น รุ่นที่สนใจ จำนวนวันที่เงียบ (ไม่มีเบอร์/LINE ID)
// list = [{ firstName, name, interestedModel, days, temperature }] → prompt; คำตอบ JSON [{ i, msg }]
export function buildBatchNudgePrompt(list) {
  const rows = list.map((c, i) => {
    const first = String(c.firstName || c.name || 'ลูกค้า').trim().split(/\s+/)[0]
    return `${i + 1}. ${first} · สนใจ ${c.interestedModel || 'ยังไม่ระบุรุ่น'} · เงียบ ${c.days ?? '?'} วัน${c.temperature === 'hot' ? ' · สนใจมาก' : ''}`
  })
  return `คุณคือเซลส์รถยนต์ไฟฟ้าในไทยที่สุภาพ เป็นกันเอง ร่างข้อความ LINE สั้นๆ ทักลูกค้าแต่ละคนที่เงียบไป
ให้แต่ละข้อความต่างกัน ไม่เกิน 2 ประโยค เรียกชื่อลูกค้า ("คุณ...") อ้างรุ่นที่สนใจ และชวนคุยต่อ/ชวนมาทดลองขับ
ห้ามใส่ราคา ส่วนลด หรือโปรโมชั่น ห้ามใช้อีโมจิเกิน 1 ตัว
ลูกค้า:
${rows.join('\n')}

ตอบเป็น JSON array อย่างเดียว: [{"i": ลำดับ, "msg": "ข้อความ"}]`
}

export function parseBatchNudgeReply(text, n) {
  const raw = String(text || '').match(/\[[\s\S]*\]/)?.[0]
  if (!raw) return []
  let arr
  try { arr = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(arr)) return []
  const out = []
  for (const o of arr) {
    const i = Number(o?.i)
    const msg = typeof o?.msg === 'string' ? o.msg.trim() : ''
    if (Number.isInteger(i) && i >= 1 && i <= n && msg && !out.some(x => x.i === i)) out.push({ i, msg: msg.slice(0, 400) })
  }
  return out.sort((a, b) => a.i - b.i)
}
