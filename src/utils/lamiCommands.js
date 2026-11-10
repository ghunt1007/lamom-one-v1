// (v1.0.1031) LAMI "สั่งงานได้จริง" — พิมพ์สั่งเป็นประโยค เช่น
//   "นัดสมชายพรุ่งนี้ 10 โมง โทรคุยเรื่องไฟแนนซ์"  → 📅 นัดติดตามสมชาย 11/11/2569 10:00 (กด ✅ ทำเลย ครั้งเดียว)
//   "มานี hot" / "ปรับ ปิติ เป็น warm"              → 🔥 เปลี่ยนความสนใจ
//   "นัดลองขับ ดวงใจ เสาร์นี้บ่าย 2"                → 🚗 เปิดฟอร์มนัดลองขับที่กรอกให้แล้ว
//   "โทรหา สมหญิง"                                 → 📞 โทร
//   "ลีดใหม่ สมศักดิ์ 0812345678 สนใจ S07"          → ➕ เปิดฟอร์ม Lead ที่กรอกชื่อ/เบอร์/รุ่นให้แล้ว
//   "โทรหาสมชายแล้ว สนใจผ่อน 0%" / "มานี ไม่รับสาย"    → ✅ บันทึกว่าติดต่อแล้ว ปิดนัดที่ถึงกำหนด แล้วเสนอนัดถัดไป
//   "จด สมชาย ชอบสีขาว รอโบนัสสิ้นปี"                → 📝 บันทึกลงไทม์ไลน์ลูกค้า
// ตัดสินใจในเครื่องล้วน (ไม่ต้องรอ AI · ใช้ได้แม้ AI ไม่ว่าง) ทำเฉพาะลูกค้าที่ผู้ใช้มองเห็นอยู่แล้ว
import { mentionedCustomers } from './aiActions.js'
import { suggestNextDue } from './nextFollowup.js'
import { dmy } from './format.js'
import { detectLeadIntent } from './searchIntent.js'

// คำไทยต้องมี เป็น/ลูกค้า นำหน้า — กัน "เย็นนี้/ตอนเย็น/4 โมงเย็น" (เวลา) ถูกอ่านเป็น Cold
const TEMP = [[/hot|🔥|(?:เป็น|ลูกค้า)\s*ร้อน/i, 'hot', '🔴 Hot'], [/warm|(?:เป็น|ลูกค้า)\s*อุ่น/i, 'warm', '🟡 Warm'], [/cold|❄|(?:เป็น|ลูกค้า)\s*เย็น/i, 'cold', '🔵 Cold']]
const NEW_LEAD = /^(?:เพิ่ม\s*(?:ลีด|lead|ลูกค้า)|ลีดใหม่|lead\s*ใหม่|ลูกค้าใหม่|new\s*lead|\+\s*lead)/i
const WHEN = /วันนี้|พรุ่งนี้|มะรืน|สัปดาห์|อาทิตย์หน้า|เดือน|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|\d+\s*วัน|\d{1,2}\s*\/\s*\d|โมง|ทุ่ม|บ่าย|เย็นนี้|เช้า|\d{1,2}[:.]\d{2}/
const fullName = c => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.nickname || 'ลูกค้า'

// เวลาในประโยค → 'HH:MM' 24 ชม. ('' ถ้าไม่ได้บอก) · "บ่าย 2" = 14:00 · "2 ทุ่ม" = 20:00 · "10 โมง" = 10:00
// เลขไทย/คำอ่านตัวเลข → เลขอารบิก เฉพาะที่ติดกับคำบอกเวลา (พิมพ์ด้วยเสียงมักได้ "บ่ายสองโมง" / "สิบโมงครึ่ง")
const NUM_WORDS = [['สิบสอง', 12], ['สิบเอ็ด', 11], ['สิบ', 10], ['เก้า', 9], ['แปด', 8], ['เจ็ด', 7], ['หก', 6], ['ห้า', 5], ['สี่', 4], ['สาม', 3], ['สอง', 2], ['หนึ่ง', 1], ['เอ็ด', 1]]
export function thaiNumerals(q) {
  let t = String(q || '').replace(/[๐-๙]/g, d => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)))
  for (const [w, n] of NUM_WORDS) t = t.replace(new RegExp(`(บ่าย\\s*)${w}|${w}(?=\\s*(?:โมง|ทุ่ม))`, 'g'), (m, pre) => (pre || '') + n)
  return t
}

export function timeIn(q) {
  const t = thaiNumerals(q)
  let m = t.match(/(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  m = t.match(/บ่าย\s*(\d{1,2})(?:\s*โมง)?(?:\s*ครึ่ง)?/)
  if (m && +m[1] >= 1 && +m[1] <= 5) return `${12 + +m[1]}:${/ครึ่ง/.test(m[0]) ? '30' : '00'}`
  m = t.match(/(\d{1,2})\s*ทุ่ม(\s*ครึ่ง)?/)
  if (m && +m[1] >= 1 && +m[1] <= 5) return `${18 + +m[1]}:${m[2] ? '30' : '00'}`
  m = t.match(/(\d{1,2})\s*โมง(?:เช้า|เย็น)?(\s*ครึ่ง)?/)
  if (m) {
    let h = +m[1]
    if (/โมงเย็น/.test(m[0]) && h < 7) h += 12
    else if (h >= 1 && h <= 6 && !/เช้า/.test(m[0])) h += 12 // "4 โมง" = 16:00 (เวลาทำงานโชว์รูม)
    if (h <= 23) return `${String(h).padStart(2, '0')}:${m[2] ? '30' : '00'}`
  }
  if (/เที่ยง(?!คืน)/.test(t)) return '12:00'
  return ''
}

// ข้อความโน้ต = ประโยคที่ตัดคำสั่ง (จด/โน้ต/บันทึกว่า) และชื่อลูกค้าออก
export function noteText(s, c) {
  let t = String(s || '').replace(/^(?:ช่วย\s*)?(?:จด(?:ไว้|โน้ต)?|โน้ต|note|บันทึก(?:ว่า|โน้ต)?)\s*(?:ว่า|ไว้)?\s*/i, '')
  for (const n of [[c.firstName, c.lastName].filter(Boolean).join(' '), c.firstName, c.nickname].filter(x => x && String(x).length >= 2)) {
    const i = t.indexOf(n)
    if (i >= 0 && i < 12) { t = (t.slice(0, i) + t.slice(i + n.length)); break }
  }
  return t.replace(/^\s*(?:คุณ|ลูกค้า)?\s*[:\-–,]?\s*(?:ว่า)?\s*/, '').trim().slice(0, 500)
}

// q = ประโยคที่พิมพ์ · customers = ลูกค้าที่ผู้ใช้เห็น · คืนรายการคำสั่งที่ทำได้ (ว่าง = ไม่ใช่คำสั่ง ให้ AI ตอบตามปกติ)
export function parseLamiCommand(q, customers = [], today) {
  const s = thaiNumerals(String(q || '').trim())
  if (!s || s.length > 200 || /[?？]$|ไหม$|มั้ย$|อย่างไร|ยังไง|เท่าไร|กี่/.test(s)) return []
  // ยกเลิก/เลื่อน/ลบ ยังไม่รองรับแบบทำทันที → ให้ AI ตอบ (กันสร้างนัดผิดจาก "ยกเลิกนัด…")
  if (/ยกเลิก|เลื่อน|ไม่ต้อง|ไม่นัด|ลบ|cancel/i.test(s)) return []
  const hits = mentionedCustomers(s, customers, 3)
  // (v1.0.1032) ลูกค้าใหม่: ขึ้นต้นด้วย ลีดใหม่/เพิ่มลูกค้า… หรือ เบอร์ใหม่+ชื่อที่ยังไม่มีในระบบ → เปิดฟอร์ม Lead ที่กรอกให้แล้ว
  const known = new Set(customers.map(c => String(c?.phone || '').replace(/\D/g, '')).filter(Boolean))
  const lead = detectLeadIntent(s, d => known.has(d))
  if (lead && (NEW_LEAD.test(s) || !hits.length)) {
    return [{ kind: 'lead', text: lead.text, name: lead.name, label: `➕ เพิ่ม Lead ใหม่${lead.name ? ' ' + lead.name : ''}`, desc: lead.text.length > 60 ? lead.text.slice(0, 60) + '…' : lead.text }]
  }
  if (!hits.length) return []
  const out = []
  const time = timeIn(s)
  // (v1.0.1032) จดโน้ต: ขึ้นต้นด้วย จด/โน้ต/บันทึกว่า → ลงไทม์ไลน์ลูกค้า (customer_notes) ไม่สร้างนัด
  const isNote = /^(?:ช่วย\s*)?(?:จด(?:ไว้|โน้ต)?|โน้ต|note|บันทึก(?:ว่า|โน้ต)?)(?=\s|[ก-๙])/i.test(s)
  // (v1.0.1032) ติดต่อแล้ว: "โทรหาสมชายแล้ว…" / "คุยกับมานีแล้ว…" / "ปิติ ไม่รับสาย" → บันทึกผล + ปิดนัดที่ถึงกำหนด
  const noAnswer = /ไม่รับสาย|ติดต่อไม่ได้|ปิดเครื่อง|โทรไม่ติด|สายไม่ว่าง/.test(s)
  const isLog = !isNote && (/(?:โทร|คุย|ทัก|เจอ|ไปหา|เยี่ยม|ส่ง(?:ไลน์|ข้อมูล|ใบเสนอ|ราคา|โปร|รูป))[^\n]{0,40}?แล้ว(?!ก็|ค่อย)/.test(s) || noAnswer)
  const isTd = !isNote && !isLog && /ลองขับ|ทดลองขับ|test\s*drive/i.test(s)
  const tempHit = TEMP.find(([re]) => re.test(s))
  const isTempOnly = !isNote && !isLog && tempHit && (/^(?:ปรับ|ตั้ง|เปลี่ยน|ให้)|เป็น\s*(?:hot|warm|cold|ร้อน|อุ่น|เย็น)/i.test(s) || (!WHEN.test(s) && s.replace(/hot|warm|cold/i, '').trim().split(/\s+/).length <= 2))
  const hasWhen = WHEN.test(s)
  const isFu = !isTd && !isNote && !isLog && (/^(?:ช่วย\s*)?(?:นัด|ตาม|ติดต่อ|follow)|นัด(?:ติดตาม|โทร|คุย)|ตามลูกค้า|เตือน(?:ให้)?(?:โทร|ตาม)/i.test(s) || (/^(?:ช่วย\s*)?(?:โทรหา|โทรกลับ|ทักไลน์|ทัก)|นัด|โทรหา|โทรกลับ/.test(s) && hasWhen))
  // "สมชาย hot นัดพรุ่งนี้ 10 โมง" = นัด + ปรับความสนใจ ในคำสั่งเดียว
  const isTemp = !isFu && isTempOnly
  const isCall = !isFu && !isTd && !isNote && !isLog && /^(?:โทร|call)\s*(?:หา)?/i.test(s)
  for (const c of hits) {
    const name = fullName(c)
    if (isLog) {
      const type = /ไลน์|line/i.test(s) ? 'line' : /เจอ|ไปหา|เยี่ยม|มาโชว์รูม|เข้าโชว์รูม/.test(s) ? 'visit' : 'call'
      const text = noteText(s.replace(/^(?:ช่วย\s*)?(?:บันทึก(?:ว่า)?\s*)?/, ''), c) || s
      // นัดครั้งถัดไปในประโยคเดียวกัน เช่น "…แล้ว นัดใหม่ศุกร์นี้ 10 โมง" (ไม่นับ "วันนี้" ที่หมายถึงตอนที่โทร)
      const wantsNext = /นัด|อีกที|อีกครั้ง|ใหม่|ตามต่อ/.test(s) && WHEN.test(s.replace(/วันนี้|เมื่อกี้|เมื่อเช้า/g, ''))
      const due = wantsNext ? suggestNextDue(s.replace(/วันนี้/g, ''), today) : null
      const next = due && !due.skip ? { dueDate: due.dueDate, time } : null
      out.push({ kind: 'log', customer: c, type, text, contacted: !noAnswer, next, ...(tempHit ? { temp: tempHit[1] } : {}),
        label: `✅ ${noAnswer ? 'โทรไม่ติด' : 'ติดต่อแล้ว'} ${name}${next ? ` · นัดต่อ ${dmy(next.dueDate)}${time ? ' ' + time + ' น.' : ''}` : ''}${tempHit ? ' · ' + tempHit[2] : ''}`,
        desc: `${type === 'line' ? '💚 LINE' : type === 'visit' ? '🚶 เจอตัว' : '📞 โทร'} · ${text.length > 50 ? text.slice(0, 50) + '…' : text}` })
    } else if (isNote) {
      const text = noteText(s, c)
      if (!text) continue
      const type = /ไลน์|line|แชท/i.test(s) ? 'chat' : /เจอ|มาโชว์รูม|เข้าโชว์รูม|เข้าพบ|มาที่/.test(s) ? 'visit' : /โทร/.test(s) ? 'call' : 'internal'
      out.push({ kind: 'note', customer: c, text, type, label: `📝 จดไว้ที่ ${name}`, desc: text.length > 60 ? text.slice(0, 60) + '…' : text })
    } else if (isTd) out.push({ kind: 'td', customer: c, hint: s, label: `🚗 นัดลองขับ ${name}`, desc: 'เปิดฟอร์มที่กรอกชื่อ/รุ่น/วันเวลาให้แล้ว' })
    else if (isTemp && !isFu) out.push({ kind: 'temp', customer: c, temp: tempHit[1], label: `ปรับความสนใจ ${name} → ${tempHit[2]}`, desc: c.temperature ? `เดิม ${c.temperature}` : '' })
    else if (isFu) {
      const due = suggestNextDue(s, today)
      if (due.skip) continue
      const type = /ไลน์|line/i.test(s) ? 'line' : /เข้าโชว์รูม|นัดพบ|เจอ|มาที่|ไปหา|เยี่ยม/.test(s) ? 'visit' : 'call'
      const note = s.slice(0, 120)
      out.push({ kind: 'fu', customer: c, dueDate: due.dueDate, time, type, note, ...(tempHit ? { temp: tempHit[1] } : {}),
        label: `📅 นัดติดตาม ${name} · ${dmy(due.dueDate)}${time ? ' ' + time + ' น.' : ''}${tempHit ? ' · ' + tempHit[2] : ''}`,
        desc: `${type === 'line' ? '💚 LINE' : type === 'visit' ? '🏠 นัดพบ' : '📞 โทร'} · ${due.why}` })
    } else if (isCall && c.phone) out.push({ kind: 'tel', customer: c, phone: String(c.phone).replace(/[^\d+]/g, ''), label: `📞 โทร ${name}`, desc: c.phone })
  }
  return out
}

// (v1.0.1032) สั่งในหน้าลูกค้าคนเดียว ไม่ต้องพิมพ์ชื่อ: "พรุ่งนี้ 10 โมง hot" / "จด ชอบสีขาว" / "ลองขับ เสาร์บ่าย 2" / "warm"
export function scopedCommand(text, c, today) {
  const t = String(text || '').trim()
  const name = c?.firstName || c?.nickname || ''
  if (!t || !name) return []
  const one = [c]
  const m = t.match(/^(?:จด(?:ไว้|โน้ต)?|โน้ต|note|บันทึก(?:ว่า|โน้ต)?)\s*/i)
  if (m) return parseLamiCommand(`จด ${name} ${t.slice(m[0].length)}`, one, today)
  if (/ลองขับ|test\s*drive/i.test(t)) return parseLamiCommand(`นัดลองขับ ${name} ${t.replace(/^(?:นัด)?(?:ทดลอง|ลอง)ขับ\s*/, '')}`, one, today)
  const direct = parseLamiCommand(`${name} ${t}`, one, today)
  if (direct.length) return direct
  return WHEN.test(t) ? parseLamiCommand(`นัด${name} ${t}`, one, today) : []
}

// ทำตามคำสั่ง (ปุ่ม ✅ ทำเลย) — คืนข้อความผลลัพธ์ · deps ส่งเข้ามาเพื่อทดสอบได้
export async function runLamiCommand(cmd, { me = '', db, companyId, followupFilters = [] } = {}) {
  const c = cmd.customer
  if (cmd.kind === 'fu') {
    const { buildManualFollowup } = await import('./customerFollowups.js')
    const f = buildManualFollowup(c, { dueDate: cmd.dueDate, type: cmd.type, note: cmd.note, me, purpose: c.stage === 'lead' || c.stage === 'pp' ? 'ติดตาม Lead ใหม่' : 'ทั่วไป' })
    await db.createDoc('followups', { ...f, ...(cmd.time ? { time: cmd.time } : {}), companyId: c.companyId ?? companyId ?? null })
    if (cmd.temp && cmd.temp !== c.temperature) { await db.updateDocData('customers', c.id, { temperature: cmd.temp }); c.temperature = cmd.temp }
    return `📅 นัดติดตาม ${fullName(c)} วันที่ ${dmy(cmd.dueDate)}${cmd.time ? ' เวลา ' + cmd.time + ' น.' : ''}${cmd.temp ? ' · ' + cmd.temp.toUpperCase() : ''} แล้ว`
  }
  if (cmd.kind === 'log') {
    // นัดที่ถึงกำหนดแล้ว (วันนี้/เลยกำหนด) → ปิดเป็น "ทำแล้ว" พร้อมผล · ไม่มีนัดค้าง → ลงไทม์ไลน์ (comm_logs)
    const today = cmd.today || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
    let rows = []
    try { rows = await db.listDocs('followups', followupFilters, 'dueDate', 'asc', 2000) } catch { rows = [] }
    const due = rows.filter(f => f && !f.deleted && f.customerId === c.id && f.status === 'pending' && String(f.dueDate || '').slice(0, 10) <= today)
    const result = `${cmd.contacted ? '' : '📵 '}${cmd.text}`
    for (const f of due) await db.updateDocData('followups', f.id, { status: 'done', result })
    if (!due.length) await db.createDoc('comm_logs', { customerId: c.id, type: cmd.type || 'call', note: result, createdBy: me, companyId: c.companyId ?? companyId ?? null })
    if (cmd.contacted) {
      const now = new Date().toISOString()
      await db.updateDocData('customers', c.id, { lastContactAt: now, ...(c.firstContactAt ? {} : { firstContactAt: now }) })
      c.lastContactAt = now
    }
    if (cmd.temp && cmd.temp !== c.temperature) { await db.updateDocData('customers', c.id, { temperature: cmd.temp }); c.temperature = cmd.temp }
    if (cmd.next) {
      const { buildManualFollowup } = await import('./customerFollowups.js')
      const f = buildManualFollowup(c, { dueDate: cmd.next.dueDate, type: cmd.type === 'line' ? 'line' : 'call', note: cmd.text.slice(0, 120), me, purpose: c.stage === 'lead' || c.stage === 'pp' ? 'ติดตาม Lead ใหม่' : 'ทั่วไป' })
      await db.createDoc('followups', { ...f, ...(cmd.next.time ? { time: cmd.next.time } : {}), companyId: c.companyId ?? companyId ?? null })
    }
    return `✅ บันทึกแล้ว: ${fullName(c)}${due.length ? ` · ปิดนัด ${due.length} รายการ` : ''}${cmd.next ? ` · นัดต่อ ${dmy(cmd.next.dueDate)}${cmd.next.time ? ' ' + cmd.next.time + ' น.' : ''}` : ''}`
  }
  if (cmd.kind === 'note') {
    await db.createDoc('customer_notes', { customerId: c.id, customer: fullName(c), type: cmd.type || 'internal', text: cmd.text, staff: me, time: new Date().toISOString(), pinned: false, companyId: c.companyId ?? companyId ?? null })
    return `📝 จดไว้ที่ ${fullName(c)} แล้ว`
  }
  if (cmd.kind === 'temp') {
    await db.updateDocData('customers', c.id, { temperature: cmd.temp })
    c.temperature = cmd.temp
    return `✅ ${fullName(c)} เป็น ${cmd.temp.toUpperCase()} แล้ว`
  }
  return ''
}
