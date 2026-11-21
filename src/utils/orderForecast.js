// (v1.0.1233) 📈 คาดการณ์สั่งรถล่วงหน้า — ต่อยอดจาก orderNeeds (ขาดตอนนี้) ให้มองไปข้างหน้า "ช่วงรอรถมาส่ง"
// ต้องสั่ง = ลูกค้าจองรอ + ยอดจองที่น่าจะเข้ามาระหว่างรอรถ (จังหวะจองย้อนหลัง) + ลีดร้อน/อุ่นที่น่าจะปิด − รถว่าง/กำลังมา/สั่งแล้ว
// แยกรุ่น แล้วแบ่งตามสีตามสัดส่วนสีที่ลูกค้าจองจริงช่วงที่ผ่านมา · ฟังก์ชันล้วน ไม่แตะฐานข้อมูล (หน้าตารางสีรถ + LAMI ใช้ร่วมกัน)
import { orderNeeds, modelKey } from './orderNeeds.js'
import { carOf } from './carLabel.js'
import { isCancelled } from './bookingStatus.js'
import { toDateStr } from './format.js'

export const FORECAST_LEAD_DAYS = [30, 45, 60, 90]
export const HOT_CLOSE = 0.3   // ลีดร้อน 10 คน ≈ ปิดได้ 3 คัน (ประมาณการแบบระวัง)
export const WARM_CLOSE = 0.1
const NO_COLOR = 'ไม่ระบุสี'
export const OVERSTOCK_DAYS = 120
const norm = s => String(s || '').toLowerCase().replace(/[\s\-_.()]+/g, '')
const dayNum = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5 }
const alive = a => (a || []).filter(x => x && !x.deleted)
const r1 = n => Math.round(n * 10) / 10

/**
 * @returns {{ models: Array, total: number, leadDays: number, lookbackDays: number, sold: number }}
 * models[i] = { mk, car, sold, perMonth, expected, hot, warm, leads, wait, have, spare, coverDays, suggest, unassigned, colors:[…] }
 * colors[j] = { color, sold, share, wait, have, short, expected, leads, suggest, waitNames }
 */
export function orderForecast({ bookings = [], vehicles = [], orders = [], customers = [], today, leadDays = 45, lookbackDays = 90, hotClose = HOT_CLOSE, warmClose = WARM_CLOSE } = {}) {
  const t = dayNum(today)
  const models = new Map()
  const model = (rec, car) => {
    const mk = modelKey(rec)
    if (!mk) return null
    if (!models.has(mk)) models.set(mk, { mk, car: car || String(rec.model || '').trim(), brand: rec.brand || '', model: rec.model || '', sold: 0, hot: 0, warm: 0, colors: new Map() })
    const m = models.get(mk)
    if (car && car.length > m.car.length) Object.assign(m, { car, brand: rec.brand || m.brand, model: rec.model || m.model })
    return m
  }
  const color = (m, c) => {
    const name = String(c || '').trim() || NO_COLOR
    const k = norm(name)
    if (!m.colors.has(k)) m.colors.set(k, { color: name, sold: 0, wait: 0, have: 0, short: 0, draft: 0, waitNames: [] })
    return m.colors.get(k)
  }

  // 1) ตอนนี้: ลูกค้าจองรอ เทียบ รถว่าง/กำลังมา/สั่งแล้ว (นิยามเดียวกับส่วน "ต้องสั่งรุ่นไหน สีอะไร")
  for (const r of orderNeeds({ bookings, vehicles, orders })) {
    const m = model(r, r.car)
    if (!m) continue
    Object.assign(color(m, r.color), { wait: r.wait, have: r.have, short: r.short, draft: r.draft, waitNames: r.waitNames })
  }
  // 2) จังหวะจองย้อนหลัง (ไม่นับใบที่ถอนจอง) แยกรุ่น + สี
  let soldAll = 0
  for (const b of alive(bookings)) {
    if (isCancelled(b)) continue
    const d = toDateStr(b.bookingDate || b.createdAt)
    if (!d) continue
    const ago = t - dayNum(d)
    if (ago < 0 || ago >= lookbackDays) continue
    const m = model(b, carOf(b))
    if (!m) continue
    m.sold++; soldAll++
    color(m, b.colorOut || b.color).sold++
  }
  // 3) ลีดที่ยังไม่จอง แยกตามรุ่นที่สนใจ
  for (const c of alive(customers)) {
    if (c.isLost || c.bookingId || !['lead', 'pp'].includes(c.stage)) continue
    if (c.temperature !== 'hot' && c.temperature !== 'warm') continue
    const name = String(c.interestedModel || '').trim()
    if (!name) continue
    // ลีดมักพิมพ์รุ่นยาว ("DEEPAL S07 Long Range AWD") → จับคู่รุ่นที่มีอยู่แล้วที่ขึ้นต้นเหมือนกัน (ยาวสุดก่อน)
    const k = modelKey({ model: name })
    if (!k) continue
    const hit = [...models.keys()].filter(mk => k.startsWith(mk)).sort((a, b) => b.length - a.length)[0]
    const m = hit ? models.get(hit) : model({ model: name }, '')
    if (!m) continue
    m[c.temperature]++
  }

  const out = []
  for (const m of models.values()) {
    const perDay = m.sold / lookbackDays
    const expected = perDay * leadDays
    const leads = m.hot * hotClose + m.warm * warmClose
    const cols = [...m.colors.values()]
    const soldCols = cols.reduce((a, c) => a + c.sold, 0)
    const wait = cols.reduce((a, c) => a + c.wait, 0)
    const have = cols.reduce((a, c) => a + c.have, 0)
    const colors = cols.map(c => {
      const share = soldCols ? c.sold / soldCols : 0
      const exp = expected * share, ld = leads * share
      // อย่างน้อยเท่าที่ขาดตอนนี้ (ลูกค้าจองรอแล้ว) + ส่วนที่คาดว่าจะจองเพิ่ม ถ้ารถสีนั้นไม่พอ
      const suggest = Math.max(c.short, Math.round(c.wait + exp + ld - c.have))
      return { ...c, share, expected: r1(exp), leads: r1(ld), suggest }
    }).sort((a, b) => b.suggest - a.suggest || b.sold - a.sold || b.wait - a.wait || a.color.localeCompare(b.color))
    // ไม่มีประวัติสีเลย (เช่นรุ่นใหม่ มีแต่ลีด) → ยังแบ่งสีไม่ได้ แสดงเป็น "ยังไม่รู้สี"
    const unassigned = soldCols ? 0 : Math.max(0, Math.round(expected + leads - Math.max(0, have - wait)))
    const suggest = colors.reduce((a, c) => a + c.suggest, 0) + unassigned
    const spare = Math.max(0, have - wait)
    out.push({
      mk: m.mk, car: m.car, brand: m.brand, model: m.model, sold: m.sold, perMonth: r1(perDay * 30), expected: r1(expected),
      hot: m.hot, warm: m.warm, leads: r1(leads), wait, have, spare,
      coverDays: perDay > 0 ? Math.floor(spare / perDay) : null,
      // (v1.0.1240) รถว่างเกินกว่าที่น่าจะขายได้ใน 120 วัน (หรือมีรถว่างแต่ไม่มีใครจองเลยใน 90 วัน) — ไม่ควรสั่งเพิ่ม ควรเร่งขาย
      overstock: spare > 0 && (perDay > 0 ? spare / perDay >= OVERSTOCK_DAYS : !(m.hot || m.warm)),
      suggest, unassigned, colors,
    })
  }
  const list = out.filter(m => m.sold || m.wait || m.have || m.hot || m.warm)
    .sort((a, b) => b.suggest - a.suggest || b.sold - a.sold || a.car.localeCompare(b.car))
  return { models: list, total: list.reduce((a, m) => a + m.suggest, 0), leadDays, lookbackDays, sold: soldAll }
}

// รายการร่างใบสั่งจากผลคาดการณ์ (หักร่างที่ทำไว้แล้ว) — ไม่รวม "ยังไม่รู้สี"
export function forecastOrderLines(fc) {
  const out = []
  for (const m of fc.models) {
    for (const c of m.colors) {
      const qty = c.suggest - c.draft
      if (qty <= 0) continue
      out.push({ brand: m.brand, model: m.model, color: c.color === NO_COLOR ? '' : c.color, qty,
        why: `คาดการณ์ ${fc.leadDays} วัน: จองรอ ${c.wait} · คาดจองเพิ่ม ~${c.expected}${c.leads ? ` · ลีดร้อน/อุ่น ~${c.leads}` : ''} · มี/มา/สั่ง ${c.have}` })
    }
  }
  return out
}

// สรุปข้อความ (LAMI / รายงาน)
export function orderForecastText(fc, max = 8) {
  const need = fc.models.filter(m => m.suggest > 0)
  if (!need.length) {
    const over = fc.models.filter(m => m.overstock)
    return `📈 คาดการณ์ ${fc.leadDays} วันข้างหน้า: รถที่มี/กำลังมา/สั่งไว้ พอสำหรับลูกค้าที่จองรอและยอดจองที่น่าจะเข้ามาแล้ว${over.length ? `\n⚠️ สต็อกเกิน ควรเร่งขาย: ${over.slice(0, 5).map(m => `${m.car} ว่าง ${m.spare}`).join(', ')}` : ''}`
  }
  const lines = [`📈 คาดการณ์สั่งรถ (รถมาส่งใน ~${fc.leadDays} วัน) — ควรสั่งรวม ${fc.total} คัน`]
  for (const m of need.slice(0, max)) {
    const cols = m.colors.filter(c => c.suggest > 0).map(c => `สี${c.color} ${c.suggest}`)
    if (m.unassigned) cols.push(`ยังไม่รู้สี ${m.unassigned}`)
    lines.push(`• ${m.car} ${m.suggest} คัน (${cols.join(', ')}) — จองเฉลี่ย ${m.perMonth}/เดือน · จองรอ ${m.wait} · มี/มา/สั่ง ${m.have}${m.hot ? ` · ลีดร้อน ${m.hot}` : ''}`)
  }
  if (need.length > max) lines.push(`…และอีก ${need.length - max} รุ่น`)
  const over = fc.models.filter(m => m.overstock)
  if (over.length) lines.push(`⚠️ สต็อกเกิน ไม่ควรสั่งเพิ่ม: ${over.slice(0, 5).map(m => `${m.car} (ว่าง ${m.spare}${m.coverDays != null ? ` · พอขาย ~${m.coverDays} วัน` : ' · ไม่มีคนจองใน 90 วัน'})`).join(', ')}`)
  lines.push('💡 เป็นการประมาณจากจังหวะจองย้อนหลัง 90 วัน + ลีดร้อน — ดู/ปรับช่วงรอรถ และทำร่างใบสั่งได้ที่ เมนูรถ › 🎨 ตารางสีรถ')
  return lines.join('\n')
}
