// (v1.0.1054) ถามค่างวด: "S07 ดาวน์ 20% ผ่อน 60 งวดเท่าไหร่" / "ผ่อน AION V เดือนละเท่าไหร่" / "ราคา 899,000 ดาวน์ 25% 72 งวด"
// → LAMI คิดค่างวดให้ทันที (ดอกเบี้ยคงที่ สูตรเดียวกับหน้าคำนวณสินเชื่อ) ไม่ต้องรอ AI · ฟังก์ชันล้วน ทดสอบได้
import { flatMonthly } from './installment.js'
import { thaiNumerals } from './lamiCommands.js'
import { carLabel } from './carLabel.js'

export const DEFAULT_RATE = 2.79
const norm = s => String(s || '').toLowerCase().replace(/[\s\-_.]+/g, '')
const baht = n => '฿' + Math.round(n).toLocaleString('en-US')
const INTENT = /ผ่อน|ค่างวด|งวดละ|เดือนละ/

// เช็คเร็ว: ต้องพูดถึงการผ่อน และไม่ใช่ประโยคสั่งบันทึก ("โทรหาสมชายแล้ว สนใจผ่อน 0%")
export function maybePayQuestion(q) {
  const s = String(q || '')
  return s.length <= 90 && INTENT.test(s) && !/สนใจ|โทร|แล้ว|นัด|จด |บันทึก|ลูกค้า|ลีด|ใคร|ไม่ผ่าน|ค้างชำระ|พนักงาน|เงินกู้|เบิก/.test(s)
}

const num = s => Number(String(s).replace(/,/g, ''))

export function parsePaySpec(q, vehicles = []) {
  if (!maybePayQuestion(q)) return null
  const s = thaiNumerals(String(q).trim()).replace(/[?？]+$/, '')
  const n = norm(s)
  // เงื่อนไขที่พิมพ์มา
  const mm = s.match(/(\d{2,3})\s*(?:งวด|เดือน)/), yy = s.match(/(\d)\s*ปี/)
  const months = mm ? +mm[1] : yy ? +yy[1] * 12 : null
  if (months != null && (months < 12 || months > 120)) return null
  const rm = s.match(/ดอก(?:เบี้ย)?\s*(\d{1,2}(?:\.\d+)?)\s*%?/) || s.match(/ผ่อน\s*(0)\s*%/)
  const rate = rm ? +rm[1] : null
  const dp = s.match(/ดาวน์\s*(\d{1,2}(?:\.\d+)?)\s*%/)
  const dl = s.match(/ดาวน์\s*(\d+(?:\.\d+)?)\s*(แสน|หมื่น|ล้าน)/)
  const da = s.match(/ดาวน์\s*(\d{1,3}(?:,\d{3})+|\d{4,8})(?!\s*%)/)
  const downAmt = dl ? +dl[1] * { แสน: 1e5, หมื่น: 1e4, ล้าน: 1e6 }[dl[2]] : da ? num(da[1]) : null
  // ราคา: ตัวเลขที่พิมพ์มา (ไม่ใช่ตัวเลขหลังคำว่าดาวน์) หรือราคาจากฐานข้อมูลรุ่นรถ
  const rest = s.replace(/ดาวน์\s*[\d,.]+\s*(?:แสน|หมื่น|ล้าน|%)?/, ' ')
  const pl = rest.match(/(\d+(?:\.\d+)?)\s*ล้าน/), pa = rest.match(/(\d{1,3}(?:,\d{3})+|\d{6,8})/)
  let price = pl ? Math.round(+pl[1] * 1e6) : pa ? num(pa[1]) : null
  let car = ''
  if (!price || price < 100000) {
    price = null
    const list = vehicles.filter(v => v && Number(v.price) > 0 && v.model)
    const names = [...new Set(list.map(v => String(v.model).trim()))].sort((a, b) => b.length - a.length)
    let hits = names.filter(m => norm(m).length >= 2 && n.includes(norm(m)))
    if (!hits.length) hits = names.filter(m => m.split(/\s+/).some(w => w.length >= 2 && /\d/.test(w) && !/^\(/.test(w) && n.includes(norm(w))))
    if (!hits.length) return null
    // ชื่อรุ่นตรงหลายรุ่นปี (เช่น "S07 (2024)" กับ "S07 (2026)") → ใช้รุ่นปีล่าสุด
    const yearOf = m => Math.max(...list.filter(v => String(v.model).trim() === m).map(v => Number(v.year) || 0))
    const model = hits.sort((x, y) => yearOf(y) - yearOf(x) || y.length - x.length)[0]
    const variants = list.filter(v => String(v.model).trim() === model).sort((a, b) => a.price - b.price)
    // พิมพ์ชื่อรุ่นย่อยมาด้วยก็ใช้รุ่นย่อยนั้น ไม่งั้นใช้รุ่นเริ่มต้น (ราคาต่ำสุด)
    const v = variants.find(x => x.variant && norm(x.variant).length >= 3 && n.includes(norm(x.variant))) || variants[0]
    price = Number(v.price)
    car = carLabel(v.brand, v.model, v.variant) + (variants.length > 1 && v === variants[0] ? ' (รุ่นเริ่มต้น)' : '')
  }
  if (downAmt != null && downAmt >= price) return null
  return { price, car, months, rate, downPct: dp ? +dp[1] : downAmt != null ? Math.round(downAmt / price * 1000) / 10 : null }
}

export function payAnswer(spec) {
  const rate = spec.rate ?? DEFAULT_RATE
  const head = `🧮 ${spec.car ? spec.car + ' · ' : ''}ราคา ${baht(spec.price)}`
  const lines = [head]
  const monthsList = spec.months ? [spec.months] : [48, 60, 72, 84]
  const downs = spec.downPct != null ? [spec.downPct] : spec.months ? [10, 15, 20, 25, 30] : [15, 20, 25]
  if (downs.length === 1) {
    const d = flatMonthly(spec.price, downs[0], monthsList[0], rate)
    lines.push(`ดาวน์ ${downs[0]}% = ${baht(d.down)} · ยอดจัด ${baht(d.loan)}`)
    monthsList.forEach(m => lines.push(`• ${m} งวด → ${baht(flatMonthly(spec.price, downs[0], m, rate).monthly)}/เดือน`))
  } else {
    downs.forEach(p => {
      const d = flatMonthly(spec.price, p, monthsList[0], rate)
      lines.push(`• ดาวน์ ${p}% (${baht(d.down)}) → ` + monthsList.map(m => `${monthsList.length > 1 ? m + ' งวด ' : ''}${baht(flatMonthly(spec.price, p, m, rate).monthly)}`).join(' · ') + (monthsList.length > 1 ? '' : `/เดือน (${monthsList[0]} งวด)`))
    })
  }
  lines.push(`ℹ️ ประมาณการ ดอกเบี้ยคงที่ ${rate}% ต่อปี${spec.rate == null ? ' (ค่าเริ่มต้น พิมพ์ "ดอก 2.5" เพื่อเปลี่ยน)' : ''} · อัตราจริงขึ้นกับไฟแนนซ์อนุมัติ`)
  return lines.join('\n')
}

// (v1.0.1057) ข้อความสำหรับส่งให้ลูกค้า (LINE/แชต) — ตัวเลขชุดเดียวกับคำตอบ ไม่มีคำแนะนำภายใน
export function payCustomerText(spec) {
  const body = payAnswer(spec).split('\n').filter(l => !l.startsWith('ℹ️'))
  body[0] = `ตารางผ่อนเบื้องต้น ${spec.car ? spec.car.replace(' (รุ่นเริ่มต้น)', '') + ' ' : ''}ราคา ${baht(spec.price)}`
  return [...body, `*ตัวเลขประมาณการ ดอกเบี้ย ${spec.rate ?? DEFAULT_RATE}% ต่อปี (คงที่) ค่างวดจริงขึ้นกับการอนุมัติของไฟแนนซ์`, 'สนใจนัดดูรถหรือทดลองขับ แจ้งได้เลย 🙏'].join('\n')
}

// ปุ่มถามต่อ: ลองเงื่อนไขอื่นในแตะเดียว
export function payFollowUps(spec) {
  const base = spec.car ? spec.car.replace(' (รุ่นเริ่มต้น)', '') : `ราคา ${spec.price}`
  const out = []
  if (spec.downPct == null || spec.months == null) out.push(`ผ่อน ${base} ดาวน์ ${spec.downPct ?? 25}% ${spec.months ?? 72} งวด`)
  else {
    if (spec.downPct < 30) out.push(`ผ่อน ${base} ดาวน์ ${Math.min(50, Math.round(spec.downPct) + 5)}% ${spec.months} งวด`)
    if (spec.months < 84) out.push(`ผ่อน ${base} ดาวน์ ${spec.downPct}% ${spec.months + 12} งวด`)
  }
  return out
}
