// (v1.0.1069) ถามโปร: "โปรเดือนนี้มีอะไรบ้าง" / "S07 มีโปรอะไร" / "โปรไหนใกล้หมด" / "ดอกเบี้ยพิเศษมีไหม"
// → LAMI ตอบจากแคมเปญที่ใช้ได้วันนี้ทันที (เฉพาะโปรที่บอกลูกค้าได้ ไม่มีมาร์จิ้น/ค่าบริหาร/รางวัล) · ฟังก์ชันล้วน ทดสอบได้
import { CUSTOMER_TYPES, PROGRAM_TYPES, isActiveOn, matchesCar, sortPrograms, daysLeft, rangeLabel } from './salesPrograms.js'
import { promoLines } from './campaignLeads.js'
import { findModels } from './modelQuestions.js'

const INTENT = /โปร|แคมเปญ|ส่วนลด|ของแถม|ดอกเบี้ยพิเศษ|ดอกเบี้ย\s*0|campaign|promotion/i
const ENDING = /ใกล้หมด|จะหมด|หมดเขต|หมดเมื่อ|วันสุดท้าย|ถึงเมื่อ|ถึงวันไหน/
// คำที่บอกว่าเป็นเรื่องอื่น: สั่งบันทึก / ถามหาลูกค้า / รายได้ของเซลส์
const OTHER = /โทร|นัด|บันทึก|จด |แล้ว|ลูกค้า|ลีด|lead|ใคร|ค่าคอม|รายได้|ยอดขาย|เป้า|รางวัล|มาร์จิ้น|สร้าง|เพิ่มโปร|ตั้งโปร|โปรแกรม|โปรไฟล์|โปรเจ/i

export function maybePromoQuestion(q) {
  const s = String(q || '')
  // (v1.0.1108) "มีโปรอะไรให้ลูกค้า S05 บ้าง" — "ให้ลูกค้า" ไม่ได้แปลว่าถามหาลูกค้า
  const t = s.replace(/(?:ให้|สำหรับ|แก่|บอก|เสนอ)\s*ลูกค้า/g, ' ')
  return s.length >= 3 && s.length <= 80 && INTENT.test(t) && !OTHER.test(t)
}

export function parsePromoSpec(q, vehicles = []) {
  if (!maybePromoQuestion(q)) return null
  const s = String(q).trim().replace(/[?？]+$/, '')
  const model = findModels(s, vehicles)[0] || ''
  const brand = model ? String(vehicles.find(v => v && String(v.model).trim() === model)?.brand || '') : ''
  return { model, brand, ending: ENDING.test(s), finance: /ดอกเบี้ย|ไฟแนนซ์/.test(s) }
}

const baht = n => Math.round(n).toLocaleString('en-US')
const leftText = n => n == null ? '' : n === 0 ? 'ถึงวันนี้วันสุดท้าย' : `เหลือ ${n} วัน`
// บรรทัดสั้นของโปร 1 รายการ (ไม่มีข้อมูลภายใน)
function line(p, today) {
  const bits = []
  if (p.type === 'finance') {
    const r = (p.rates || []).slice().sort((a, b) => a.rate - b.rate)[0]
    if (r) bits.push(`ดอกเบี้ย ${r.rate}% ดาวน์ ${r.down}% ${r.months} งวด`)
    if (p.financeCo) bits.push(p.financeCo)
  } else if (p.amount) bits.push(`ลด ${baht(p.amount)} บาท`)
  if (p.gift) bits.push(`แถม ${p.gift}`)
  const car = [p.brand, p.models?.length ? p.models.join('/') : 'ทุกรุ่น'].filter(Boolean).join(' ')
  const left = daysLeft(p, today)
  return `${PROGRAM_TYPES[p.type]?.icon || '🎁'} ${p.title || PROGRAM_TYPES[p.type]?.short || 'โปร'} · ${car}${bits.length ? ' · ' + bits.join(' · ') : ''} · ${left != null && left <= 7 ? '⏳ ' + leftText(left) : rangeLabel(p)}`
}

export function promoAnswer({ programs = [], spec, today }) {
  const short = spec.model.replace(/\s*\(\d{4}\)\s*$/, '')
  let list = sortPrograms(programs.filter(p => p && CUSTOMER_TYPES.includes(p.type) && isActiveOn(p, today)))
  if (spec.model) list = list.filter(p => matchesCar(p, spec.brand, short))
  if (spec.finance) list = list.filter(p => p.type === 'finance')
  if (spec.ending) list = list.filter(p => { const n = daysLeft(p, today); return n != null && n <= 7 }).sort((a, b) => daysLeft(a, today) - daysLeft(b, today))
  const what = `${spec.finance ? 'ดอกเบี้ยพิเศษ' : 'โปร'}${short ? ' ' + short + ' ' : ''}${spec.ending ? 'ที่จะหมดใน 7 วัน' : 'ที่ใช้ได้วันนี้'}`
  if (!list.length) {
    return { text: `🎁 ไม่พบ${what}\nℹ️ ดูหรือเพิ่มแคมเปญได้ที่หน้า "แคมเปญ & อัตรา"`, copy: '', next: [...(spec.ending || spec.finance || short ? ['โปรเดือนนี้มีอะไรบ้าง'] : []), ...(short ? [`ราคา ${short} เท่าไหร่`] : [])] }
  }
  const lines = [`🎁 ${what} ${list.length} รายการ`]
  list.slice(0, 8).forEach(p => lines.push('• ' + line(p, today)))
  if (list.length > 8) lines.push(`… และอีก ${list.length - 8} รายการ`)
  let copy = ''
  if (short) {
    const sum = promoLines(list)
    if (sum.length) {
      lines.push('👉 รวมที่ลูกค้าได้: ' + sum.join(' · '))
      const lefts = list.map(p => daysLeft(p, today)).filter(n => n != null && n >= 0)
      const left = lefts.length ? Math.min(...lefts) : null
      copy = [`โปรพิเศษ ${short} ตอนนี้${left != null && left <= 7 ? ` (${leftText(left)})` : ''}`, ...sum.map(x => '• ' + x), 'สนใจนัดดูรถหรือให้คำนวณค่างวดให้ ทักกลับได้เลยค่ะ/ครับ'].join('\n')
    }
  }
  lines.push('ℹ️ เงื่อนไขเต็มดูที่หน้าแคมเปญ ตรวจก่อนยืนยันกับลูกค้า')
  const models = [...new Set(list.flatMap(p => p.models || []))].filter(m => m && m !== short)
  const next = short
    ? [`ผ่อน ${short} เดือนละเท่าไหร่`, `${short} มีสีอะไรพร้อมขาย`]
    : [...(spec.ending ? [] : ['โปรไหนใกล้หมด']), ...models.slice(0, 2).map(m => `${m} มีโปรอะไร`)]
  return { text: lines.join('\n'), copy, next }
}
