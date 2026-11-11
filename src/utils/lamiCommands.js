// (v1.0.1031) LAMI "สั่งงานได้จริง" — พิมพ์สั่งเป็นประโยค เช่น
//   "นัดสมชายพรุ่งนี้ 10 โมง โทรคุยเรื่องไฟแนนซ์"  → 📅 นัดติดตามสมชาย 11/11/2569 10:00 (กด ✅ ทำเลย ครั้งเดียว)
//   "มานี hot" / "ปรับ ปิติ เป็น warm"              → 🔥 เปลี่ยนความสนใจ
//   "นัดลองขับ ดวงใจ เสาร์นี้บ่าย 2"                → 🚗 เปิดฟอร์มนัดลองขับที่กรอกให้แล้ว
//   "โทรหา สมหญิง"                                 → 📞 โทร
//   "ลีดใหม่ สมศักดิ์ 0812345678 สนใจ S07"          → ➕ เปิดฟอร์ม Lead ที่กรอกชื่อ/เบอร์/รุ่นให้แล้ว
//   "โทรหาสมชายแล้ว สนใจผ่อน 0%" / "มานี ไม่รับสาย"    → ✅ บันทึกว่าติดต่อแล้ว ปิดนัดที่ถึงกำหนด แล้วเสนอนัดถัดไป
//   "สมชาย จองแล้ว" / "เปิดใบจอง มานี"               → 📝 เปิดหน้าลูกค้าพร้อมฟอร์มสร้างใบจอง (ยังต้องกรอกเงินจองเอง)
//   "จด สมชาย ชอบสีขาว รอโบนัสสิ้นปี"                → 📝 บันทึกลงไทม์ไลน์ลูกค้า
// ตัดสินใจในเครื่องล้วน (ไม่ต้องรอ AI · ใช้ได้แม้ AI ไม่ว่าง) ทำเฉพาะลูกค้าที่ผู้ใช้มองเห็นอยู่แล้ว
import { mentionedCustomers } from './aiActions.js'
import { suggestNextDue } from './nextFollowup.js'
import { dmy } from './format.js'
import { detectLeadIntent } from './searchIntent.js'

// คำไทยต้องมี เป็น/ลูกค้า นำหน้า — กัน "เย็นนี้/ตอนเย็น/4 โมงเย็น" (เวลา) ถูกอ่านเป็น Cold
const TEMP = [[/hot|🔥|(?:เป็น|ลูกค้า)\s*ร้อน/i, 'hot', '🔴 Hot'], [/warm|(?:เป็น|ลูกค้า)\s*อุ่น/i, 'warm', '🟡 Warm'], [/cold|❄|(?:เป็น|ลูกค้า)\s*เย็น/i, 'cold', '🔵 Cold']]
const NEW_LEAD = /^(?:เพิ่ม\s*(?:ลีด|lead|ลูกค้า)|ลีดใหม่|lead\s*ใหม่|ลูกค้าใหม่|new\s*lead|\+\s*lead)/i
export const WHEN = /วันนี้|พรุ่งนี้|มะรืน|สัปดาห์|อาทิตย์หน้า|เดือน|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|\d+\s*วัน|\d{1,2}\s*\/\s*\d|โมง|ทุ่ม|บ่าย|เย็นนี้|เช้า|\d{1,2}[:.]\d{2}/
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

// (v1.0.1034) "สั่งอะไรได้บ้าง" → ตอบทันทีพร้อมตัวอย่างจากชื่อลูกค้าจริง (ไม่ต้องรอ AI)
export function isCommandHelp(q) {
  return /สั่ง(?:งาน)?(?:อะไร|ไร)ได้|สั่ง(?:งาน)?ยังไง|สั่ง(?:งาน)?อย่างไร|วิธีสั่ง|ทำอะไรให้ได้บ้าง|ช่วยอะไรได้บ้าง|คำสั่ง(?:มี)?อะไร/.test(String(q || ''))
}
// ชื่อตัวอย่างจากลูกค้าจริง: ลูกค้า Hot ก่อน · ชื่อสั้นคำเดียว (ไม่ใช่ "ลูกค้า…")
export function exampleName(list = []) {
  const ok = x => x && !x.isLost && !x.deleted && /^[ก-๙A-Za-z]{2,10}$/.test(String(x.firstName || '')) && !/^ลูกค้า/.test(x.firstName)
  return (list.find(x => ok(x) && x.temperature === 'hot') || list.find(ok))?.firstName || 'สมชาย'
}
export function commandHelpText(n = 'สมชาย') {
  return [
    '🪄 พิมพ์หรือพูดสั่งเป็นประโยคได้เลย แล้วกด ✅ ทำเลย ครั้งเดียวจบ:',
    `• 📅 นัด: "นัด${n}พรุ่งนี้ 10 โมง" · "ทักไลน์${n}ศุกร์นี้บ่ายสอง"`,
    `• ✅ ติดต่อแล้ว: "โทรหา${n}แล้ว สนใจผ่อน 0%" · "${n} ไม่รับสาย" (ปิดนัดที่ถึงกำหนด + เสนอนัดถัดไป)`,
    `• 🔥 ความสนใจ: "${n} hot" · "${n} hot นัดพรุ่งนี้ 10 โมง" (นัด + ปรับในคำสั่งเดียว)`,
    `• 📝 จดโน้ต: "จด ${n} ชอบสีขาว รอโบนัส"`,
    `• 🚗 ลองขับ: "นัดลองขับ ${n} เสาร์บ่าย 2"`,
    `• 📝 จอง: "${n} จองแล้ว" (เปิดฟอร์มจองที่กรอกชื่อ/รุ่นให้)`,
    `• 🧾 ใบจอง: "${n} ตัดตัวเลขแล้ว" · "${n} ส่งมอบแล้ว" · "${n} ไฟแนนซ์ผ่าน" · "${n} รถมาแล้ว" · "${n} ถอนจอง" (เปิดใบจองแล้วเปลี่ยนสถานะให้)`,
    '• ➕ ลูกค้าใหม่: "ลีดใหม่ สมศักดิ์ 0812345678 สนใจ S07"',
    '• 👥 ทีละหลายคน: "นัดโทรลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง" · "นัดลูกค้าที่เงียบเกิน 7 วันทั้งหมด พรุ่งนี้" (กด ✅ ทำทั้งหมด ครั้งเดียว)',
    `• 🚗 วันส่งมอบ: "นัดส่งมอบ${n} ศุกร์นี้ 10 โมง" · "เลื่อนส่งมอบ${n}ไป 20/11"`,
    `• 📅 เลื่อน/ยกเลิกนัด: "เลื่อนนัด${n}ไปศุกร์ 10 โมง" · "ยกเลิกนัด${n}"`,
    `• 📞 โทร: "โทรหา ${n}"`,
    `• 👤 ถามถึงลูกค้า: "${n}ถึงไหนแล้ว" · "สรุป${n}" (ขั้น ความสนใจ ติดต่อล่าสุด นัดถัดไป ใบจอง + คำแนะนำ)`,
    '• ☀️ งานวันนี้: "วันนี้มีอะไรบ้าง" · "สรุปวันนี้" (นัดวันนี้ เลยกำหนด ส่งมอบ ลีดใหม่ + ปุ่มถามต่อ)',
    '• 📊 ยอดเดือนนี้: "ยอดเดือนนี้เป็นไง" · "ถึงเป้าหรือยัง" · "ใครขายดีสุด" (ส่งมอบ จองใหม่ เทียบเดือนก่อน เป้า อันดับ)',
    '• 🚙 สต็อก: "S07 สีขาวมีไหม" · "มีรถอะไรพร้อมขาย" · "รถค้างสต็อกนานมีคันไหน" (แยกรุ่น/สี จากสต็อกจริง)',
    '• 🧮 ค่างวด: "S07 ดาวน์ 20% ผ่อน 60 งวดเท่าไหร่" · "ผ่อน AION V เดือนละเท่าไหร่" · "ราคา 899,000 ดาวน์ 25% 72 งวด"',
    '• 📝 ถามหาใบจอง: "ใครรอไฟแนนซ์" · "ใครรอรถ" · "ใครยังไม่นัดส่งมอบ" · "ใบจองไหนค้างนานสุด"',
    '• 🔎 ถามหารายชื่อ: "ลูกค้า hot มีใครบ้าง" · "ใครเงียบเกิน 7 วัน" · "ใครยังไม่มีนัด" · "ลูกค้าสนใจ S05 มีใครบ้าง"',
    '',
    '💡 ในหน้าลูกค้า ใช้ช่อง 🪄 สั่งเร็ว ได้โดยไม่ต้องพิมพ์ชื่อ · กด Ctrl K แล้วพิมพ์คำสั่งเดียวกันก็ได้',
  ].join('\n')
}

// q = ประโยคที่พิมพ์ · customers = ลูกค้าที่ผู้ใช้เห็น · คืนรายการคำสั่งที่ทำได้ (ว่าง = ไม่ใช่คำสั่ง ให้ AI ตอบตามปกติ)
export function parseLamiCommand(q, customers = [], today) {
  const s = thaiNumerals(String(q || '').trim())
  if (!s || s.length > 200 || /[?？]$|ไหม$|มั้ย$|(?:หรือ|รึ)ยัง$|หรือเปล่า$|ป่ะ$|อย่างไร|ยังไง|เท่าไร|กี่/.test(s)) return []
  // (v1.0.1038) เลื่อนนัด: "เลื่อนนัดสมชายไปศุกร์ 10 โมง" · ยกเลิกนัด: "ยกเลิกนัดสมชาย" / "สมชาย ไม่ต้องโทรแล้ว"
  const isMove = !/ลองขับ|ส่งมอบ|รับรถ|ส่งรถ|จอง/.test(s) && /เลื่อน/.test(s) && WHEN.test(s.replace(/^[^]*?เลื่อน/, ''))
  const isUnfu = !isMove && !/ลองขับ|ส่งมอบ|รับรถ|ส่งรถ|จอง/.test(s) && /ยกเลิก(?:การ)?นัด|ลบนัด|ไม่ต้อง(?:นัด|โทร|ตาม)|ไม่นัดแล้ว/.test(s)
  // (v1.0.1040) นัดวันส่งมอบ: "นัดส่งมอบสมชาย ศุกร์นี้ 10 โมง" / "เลื่อนส่งมอบมานีไป 20/11" → ลงวัน/เวลาส่งมอบในใบจอง
  const delivRest = s.replace(/^[^]*?(?:ส่งมอบ|ส่งรถ|รับรถ)(?:รถ)?/, '')
  const isDeliv = /(?:นัด|เลื่อน|กำหนด|ลง)?\s*(?:วัน)?(?:ส่งมอบ|ส่งรถ|รับรถ)/.test(s) && !/แล้ว|ยกเลิก/.test(s) && WHEN.test(delivRest)
  // ยกเลิก/เลื่อน/ลบ แบบอื่น → ให้ AI ตอบ (กันสร้างนัดผิดจาก "ยกเลิก…")
  if (!isMove && !isUnfu && !isDeliv && !/ยกเลิกจอง/.test(s) && /ยกเลิก|เลื่อน|ไม่ต้อง|ไม่นัด|ลบ|cancel/i.test(s)) return []
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
  // (v1.0.1036) ขั้นของใบจอง: "สมชาย ตัดตัวเลขแล้ว" / "มานี ส่งมอบแล้ว" → เปิดใบจองแล้วเปลี่ยนสถานะให้ (ใช้ขั้นตอนเดียวกับหน้าใบจอง)
  const stage = !isNote ? bookingStageIn(s) : null
  // (v1.0.1034) จอง: เปิดฟอร์มสร้างใบจองของลูกค้าคนนั้น (ไม่บันทึกเงินเองอัตโนมัติ — ต้องกรอกเงินจองก่อน)
  const isBook = !isNote && !stage && /^(?:ช่วย\s*)?(?:จอง(?!ลองขับ)|ทำใบจอง|ออกใบจอง|เปิดใบจอง|สร้างใบจอง)|(?:ตกลง|ขอ)?จองแล้ว|ปิดการขาย(?:ได้)?แล้ว|ปิดดีล(?:ได้)?แล้ว|ตกลงจอง|จะจอง(?:วันนี้|เลย)/.test(s)
  const isTd = !isNote && !isLog && !isBook && /ลองขับ|ทดลองขับ|test\s*drive/i.test(s)
  const tempHit = TEMP.find(([re]) => re.test(s))
  const isTempOnly = !isNote && !isLog && !isBook && tempHit && (/^(?:ปรับ|ตั้ง|เปลี่ยน|ให้)|เป็น\s*(?:hot|warm|cold|ร้อน|อุ่น|เย็น)/i.test(s) || (!WHEN.test(s) && s.replace(/hot|warm|cold/i, '').trim().split(/\s+/).length <= 2))
  const hasWhen = WHEN.test(s)
  const isFu = !isTd && !isNote && !isLog && !isBook && (/^(?:ช่วย\s*)?(?:นัด|ตาม|ติดต่อ|follow)|นัด(?:ติดตาม|โทร|คุย)|ตามลูกค้า|เตือน(?:ให้)?(?:โทร|ตาม)/i.test(s) || (/^(?:ช่วย\s*)?(?:โทรหา|โทรกลับ|ทักไลน์|ทัก)|นัด|โทรหา|โทรกลับ/.test(s) && hasWhen))
  // "สมชาย hot นัดพรุ่งนี้ 10 โมง" = นัด + ปรับความสนใจ ในคำสั่งเดียว
  const isTemp = !isFu && isTempOnly
  const isCall = !isFu && !isTd && !isNote && !isLog && !isBook && /^(?:โทร|call)\s*(?:หา)?/i.test(s)
  if (isDeliv) {
    const due = suggestNextDue(delivRest.replace(/^\s*ไป/, ''), today)
    if (!due?.dueDate || due.skip) return []
    for (const c of hits) {
      if (!c.bookingId) continue
      out.push({ kind: 'deliv', customer: c, dueDate: due.dueDate, time, label: `🚗 นัดส่งมอบ ${fullName(c)} ${dmy(due.dueDate)}${time ? ' ' + time + ' น.' : ''}`, desc: 'ลงวัน/เวลาส่งมอบในใบจอง (ขึ้นปฏิทินส่งมอบและงานวันนี้ให้เอง)' })
    }
    return out
  }
  if (isMove || isUnfu) {
    for (const c of hits) {
      const name = fullName(c)
      if (isUnfu) { out.push({ kind: 'unfu', customer: c, label: `🗑️ ยกเลิกนัดที่ค้างของ ${name}`, desc: 'นัดที่ยังไม่ได้ทำจะถูกปิดเป็น "ข้าม" (ไม่ลบประวัติ)' }); continue }
      const due = suggestNextDue(s.replace(/^[^]*?เลื่อน(?:นัด)?/, ''), today)
      if (!due?.dueDate) continue
      out.push({ kind: 'move', customer: c, dueDate: due.dueDate, time, label: `📅 เลื่อนนัด ${name} → ${dmy(due.dueDate)}${time ? ' ' + time + ' น.' : ''}`, desc: 'ย้ายนัดที่ใกล้ที่สุดที่ยังไม่ได้ทำ (ไม่มีนัดค้าง = สร้างนัดใหม่)' })
    }
    return out
  }
  for (const c of hits) {
    const name = fullName(c)
    if (stage && c.bookingId) out.push({ kind: 'stage', customer: c, status: stage, label: `📝 ${name} → ${stage}`,
      desc: stage === 'ถอนจอง' ? 'เปิดใบจองแล้วถามเหตุผลการถอนจอง' : 'เปิดใบจองแล้วเปลี่ยนสถานะ ลงวันที่ อัปเดตสต็อก/ลูกค้าให้ครบ' })
    // "โทรหาสมชายแล้ว ไฟแนนซ์ผ่าน" = เปลี่ยนสถานะใบจอง + บันทึกการติดต่อ (2 การ์ด)
    if (stage && !isLog) continue
    if (isBook) {
      if (c.isLost) continue
      out.push(c.bookingId
        ? { kind: 'open', customer: c, label: `📝 ${name} มีใบจองแล้ว`, desc: 'เปิดหน้าลูกค้าเพื่อดูใบจองเดิม' }
        : { kind: 'book', customer: c, label: `📝 สร้างใบจอง ${name}`, desc: `${c.interestedModel ? '🚗 ' + c.interestedModel + ' · ' : ''}เปิดฟอร์มที่กรอกชื่อ/รุ่นให้แล้ว กรอกเงินจองแล้วกดสร้าง` })
    } else if (isLog) {
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
// คำว่า "ขั้นของใบจอง" ในประโยค → ชื่อสถานะใน BOOKING_STATUSES (ต้องมีคำว่าแล้ว/ได้ เพื่อไม่ให้ "รอรถมา" กลายเป็นคำสั่ง)
const STAGE_WORDS = [
  [/ถอนจอง|ยกเลิกจอง|ขอถอน(?:จอง)?/, 'ถอนจอง'],
  [/ตัดตัวเลข(?:ได้)?(?:แล้ว)?|ตัดรถ(?:ได้)?แล้ว/, 'ตัดตัวเลขรอส่งมอบ'],
  [/(?:ส่งมอบ|ส่งรถ|รับรถ|ออกรถ)(?:ไป|ได้)?แล้ว/, 'ส่งมอบแล้ว'],
  [/(?:ไฟแนนซ์|แบงก์|ธนาคาร|ไฟแนนท์)\s*(?:ผ่าน|อนุมัติ)|ผ่านไฟแนนซ์|อนุมัติ(?:ไฟแนนซ์)?แล้ว/, 'ผ่านไฟแนนซ์รอเบิก'],
  [/(?:ส่ง|ยื่น)\s*(?:ไฟแนนซ์|เอกสารไฟแนนซ์|แบงก์)(?:ไป)?แล้ว/, 'รอผลไฟแนนซ์'],
  [/รถ(?:มา|เข้า|ถึง)(?:แล้ว|ถึงแล้ว)/, 'รอส่งมอบ'],
]
export function bookingStageIn(s) {
  const hit = STAGE_WORDS.find(([re]) => re.test(String(s || '')))
  return hit ? hit[1] : null
}

// ลิงก์ของคำสั่งที่ต้องเปิดหน้าอื่น (การ์ดคำสั่ง + Ctrl K ใช้ร่วมกัน) — ไม่ใช่คำสั่งแบบนี้คืน ''
export function commandHref(cmd) {
  const id = encodeURIComponent(cmd?.customer?.id || '')
  if (cmd?.kind === 'stage') return `/crm/bookings?id=${encodeURIComponent(cmd.customer.bookingId)}&status=${encodeURIComponent(cmd.status)}`
  if (cmd?.kind === 'book') return `/crm/customers?id=${id}&book=1`
  if (cmd?.kind === 'open') return `/crm/customers?id=${id}`
  if (cmd?.kind === 'bk') return `/crm/bookings?id=${encodeURIComponent(cmd.bookingId || '')}` // (v1.0.1046) เปิดใบจองนั้นเลย
  return ''
}

// (v1.0.1037) ปุ่มลัดใต้ช่อง 🪄 สั่งเร็วในหน้าลูกค้า — เลือกตามสถานะลูกค้า กดแล้วเห็นการ์ดก่อนทำ (ไม่ต้องพิมพ์)
export function quickChips(c) {
  if (!c || c.isLost) return []
  // ไม่ซ้ำกับปุ่มที่มีอยู่แล้วในหน้า (🔴 Hot/Warm/Cold, ✅ ติดต่อแล้ว)
  if (c.bookingId && c.stage !== 'delivered') return ['รถมาแล้ว', 'ตัดตัวเลขแล้ว', 'นัดส่งมอบ พรุ่งนี้ 10 โมง', 'ส่งมอบแล้ว', 'จด ']
  if (c.stage === 'delivered') return ['นัดอีก 7 วัน', 'จด ']
  return ['ไม่รับสาย', 'พรุ่งนี้ 10 โมง', 'ลองขับ เสาร์ 10 โมง', ...(c.temperature === 'hot' && !c.bookingId ? ['จองแล้ว'] : []), 'จด ']
}

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
  if (cmd.kind === 'deliv') {
    await db.updateDocData('bookings', c.bookingId, { deliveryDate: cmd.dueDate, ...(cmd.time ? { deliveryTime: cmd.time } : {}), updatedAt: new Date().toISOString() })
    return `🚗 นัดส่งมอบ ${fullName(c)} วันที่ ${dmy(cmd.dueDate)}${cmd.time ? ' เวลา ' + cmd.time + ' น.' : ''} แล้ว`
  }
  if (cmd.kind === 'move' || cmd.kind === 'unfu') {
    let rows = []
    try { rows = await db.listDocs('followups', followupFilters, 'dueDate', 'asc', 2000) } catch { rows = [] }
    const pending = rows.filter(f => f && !f.deleted && f.customerId === c.id && f.status === 'pending')
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
    if (cmd.kind === 'unfu') {
      for (const f of pending) await db.updateDocData('followups', f.id, { status: 'skipped', result: 'ยกเลิกนัด' + (me ? ` (${me})` : '') })
      return pending.length ? `🗑️ ยกเลิกนัดของ ${fullName(c)} แล้ว ${pending.length} รายการ` : `${fullName(c)} ไม่มีนัดค้างอยู่แล้ว`
    }
    const f = pending[0]
    if (f) {
      const from = String(f.dueDate || '').slice(0, 10)
      await db.updateDocData('followups', f.id, { dueDate: cmd.dueDate, ...(cmd.time ? { time: cmd.time } : {}), note: `${f.note ? f.note + ' · ' : ''}เลื่อนจาก ${dmy(from)}`.slice(0, 200) })
      return `📅 เลื่อนนัด ${fullName(c)} จาก ${dmy(from)} เป็น ${dmy(cmd.dueDate)}${cmd.time ? ' ' + cmd.time + ' น.' : ''} แล้ว`
    }
    const { buildManualFollowup } = await import('./customerFollowups.js')
    const nf = buildManualFollowup(c, { dueDate: cmd.dueDate, type: 'call', note: 'นัดใหม่ (ไม่มีนัดเดิมให้เลื่อน)', me, purpose: c.stage === 'lead' || c.stage === 'pp' ? 'ติดตาม Lead ใหม่' : 'ทั่วไป' })
    await db.createDoc('followups', { ...nf, ...(cmd.time ? { time: cmd.time } : {}), companyId: c.companyId ?? companyId ?? null })
    return `📅 ${fullName(c)} ไม่มีนัดเดิม — สร้างนัด ${dmy(cmd.dueDate)}${cmd.time ? ' ' + cmd.time + ' น.' : ''} ให้แล้ว`
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
