// (v1.0.1053) ถามสต็อก: "S07 สีขาวมีไหม" / "AION V เหลือกี่คัน" / "มีรถอะไรพร้อมขาย" / "รถค้างสต็อกนานมีคันไหน"
// → LAMI ตอบจากสต็อกจริงทันที (ไม่ต้องรอ AI) แยกรุ่น/สี · ไม่แสดงเลขตัวถังหรือราคาทุน · ฟังก์ชันล้วน ทดสอบได้
import { carOf } from './carLabel.js'
import { stockAgeDays } from './stockAge.js'

const norm = s => String(s || '').toLowerCase().replace(/[\s\-_.]+/g, '')
const INTENT = /สต็อก|สต๊อก|stock|พร้อมขาย|พร้อมส่ง|มีรถ|มีของ|เหลือ|มีไหม|มีมั้ย|มีมั๊ย|มีหรือเปล่า|มีรึเปล่า|มีสี|สีอะไร|สีไหน|กี่คัน|มีกี่/i
const GENERIC = /สต็อก|สต๊อก|stock|พร้อมขาย|พร้อมส่ง|มีรถอะไร|รถอะไรบ้าง/i
const AGED = /ค้างสต็อก|ค้างสต๊อก|(?:สต็อก|สต๊อก|รถ)[^\n]{0,12}(?:ค้างนาน|อยู่นาน|นานสุด|นานที่สุด)|ควรเร่งขาย|รถเก่าสุด/

// เช็คเร็วก่อนโหลดสต็อก — ไม่ใช่คำถามสต็อกแน่ๆ ก็ไม่ต้องอ่านข้อมูล
export const maybeStockQuestion = q => { const s = String(q || ''); return s.length <= 80 && (INTENT.test(s) || AGED.test(s)) }

// catalog = ชื่อรุ่นจากฐานข้อมูลรถ (v1.0.1110) — ถามรุ่นที่ไม่มีในสต็อก เช่น "ATTO 3 สีขาวมีไหม" ตอบว่าไม่มี แทนการโชว์รุ่นอื่นเฉยๆ
export function parseStockSpec(q, vehicles = [], catalog = []) {
  const s = String(q || '').trim().replace(/[?？]+$/, '').trim()
  if (!s || s.length > 80) return null
  if (/นัด|โทร|ยอด|เป้า|ราคา|ดาวน์|ผ่อน|ดอกเบี้ย|ลูกค้า|ลีด|ใบจอง|ส่งมอบ|ไฟแนนซ์|ทำไม|ยังไง|อย่างไร|อะไหล่|มูลค่า|ต้นทุน|กำไร|ขายได้|ขายไป|ขายแล้ว|ปิดได้|จองแล้วแต่|ยังไม่มี(?:ใน)?(?:สต็อก|สต๊อก)|เหลือน้อย|ใกล้หมด|สั่งเพิ่ม|กำลัง(?:จะ)?มา/.test(s)) return null
  const aged = AGED.test(s)
  if (!aged && !INTENT.test(s)) return null
  const live = vehicles.filter(v => v && !v.deleted)
  const n = norm(s)
  // รุ่น: ชื่อรุ่นในสต็อกจริงที่ปรากฏในคำถาม (ยาวสุดก่อน เช่น "aion v" ก่อน "aion")
  const models = [...new Set(live.map(v => String(v.model || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  let model = models.find(m => norm(m).length >= 2 && n.includes(norm(m))) || ''
  // พิมพ์เฉพาะส่วนท้ายของรุ่นก็ได้ เช่น "S07" ของ "DEEPAL S07"
  if (!model) model = models.find(m => m.split(/\s+/).some(w => w.length >= 2 && /\d/.test(w) && n.includes(norm(w)))) || ''
  const brands = [...new Set(live.map(v => String(v.brand || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  const brand = model ? '' : brands.find(b => norm(b).length >= 2 && n.includes(norm(b))) || ''
  const colors = [...new Set(live.map(v => String(v.color || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  const color = colors.find(c => s.includes(c) || s.includes('สี' + c)) || ''
  let missing = ''
  if (!model) {
    const have = new Set(models.map(norm))
    missing = [...new Set(catalog.map(m => String(m || '').trim()).filter(Boolean))]
      .filter(m => { const k = norm(m); return !have.has(k) && (k.length >= 4 || (k.length >= 3 && /\d/.test(k))) && n.includes(k) })
      .sort((a, b) => b.length - a.length)[0] || ''
  }
  if (!model && !brand && !color && !aged && !missing && !GENERIC.test(s)) return null
  return { model, brand, color, aged, ...(missing ? { missing } : {}) }
}

const title = spec => [spec.model || spec.brand, spec.color ? `สี${spec.color}` : ''].filter(Boolean).join(' ')
const colorLine = list => {
  const by = {}
  list.forEach(v => { const c = String(v.color || '').trim() || 'ไม่ระบุสี'; by[c] = (by[c] || 0) + 1 })
  return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ${k}`).join(' · ')
}

// (v1.0.1063) ข้อความสำหรับส่งให้ลูกค้า (LINE/แชต) — บอกรุ่น/สีที่พร้อมส่งมอบ ไม่บอกจำนวนคัน อายุสต็อก หรือข้อมูลภายใน
const colorNames = list => [...new Set(list.map(v => String(v.color || '').trim()).filter(Boolean))].join(', ') || 'สอบถามได้'
const customerText = (head, lines) => [`🚗 ${head}`, ...lines, 'สนใจนัดดูรถจริงหรือทดลองขับ แจ้งได้เลย 🙏'].join('\n')

// คืน { text, next, query, copy? } — query = คำค้นสำหรับเปิดหน้าสต็อกที่กรองไว้แล้ว
export function stockAnswer({ vehicles = [], spec, today }) {
  const live = vehicles.filter(v => v && !v.deleted)
  const match = v => (!spec.model || v.model === spec.model) && (!spec.brand || v.brand === spec.brand)
  const pool = live.filter(match)
  const inColor = spec.color ? pool.filter(v => String(v.color || '').trim() === spec.color) : pool
  const ready = inColor.filter(v => v.status === 'available')
  const age = v => stockAgeDays(v.arrivedAt, today)
  const query = [spec.model || spec.brand, spec.color].filter(Boolean).join(' ')

  if (spec.aged) {
    const aged = ready.map(v => ({ v, d: age(v) })).filter(x => x.d >= 60).sort((a, b) => b.d - a.d)
    const head = `⏳ รถพร้อมขายที่ค้างสต็อก 60 วันขึ้นไป${title(spec) ? ` (${title(spec)})` : ''} — ${aged.length} คัน`
    if (!aged.length) return { text: `✅ ไม่มีรถพร้อมขายที่ค้างสต็อกเกิน 60 วัน${title(spec) ? ` (${title(spec)})` : ''}`, next: ['มีรถอะไรพร้อมขาย'], query }
    return { text: [head, ...aged.slice(0, 8).map(({ v, d }) => `• ${carOf(v, true)} ${v.color || ''} — ${d} วัน`.replace(/\s+/g, ' ')), aged.length > 8 ? `…และอีก ${aged.length - 8} คัน` : '', '💡 เสนอคันที่ค้างนานก่อน หรือจัดโปรเร่งขาย'].filter(Boolean).join('\n'), next: ['มีรถอะไรพร้อมขาย'], query }
  }

  const transit = inColor.filter(v => v.status === 'transit').length
  const reserved = inColor.filter(v => v.status === 'reserved').length
  const extra = [transit ? `🚢 กำลังขนส่งมา ${transit} คัน` : '', reserved ? `📝 จองแล้ว ${reserved} คัน` : ''].filter(Boolean).join(' · ')

  if (spec.missing && !spec.model && !spec.brand) {
    const alt = spec.color ? live.filter(v => v.status === 'available' && String(v.color || '').trim() === spec.color) : []
    const by = new Map(); alt.forEach(v => { const m = carOf(v) || 'ไม่ระบุรุ่น'; by.set(m, (by.get(m) || 0) + 1) })
    const rows = [...by.entries()].sort((a, b) => b[1] - a[1])
    return {
      text: [`📭 ไม่มี ${spec.missing}${spec.color ? ` สี${spec.color}` : ''} ในสต็อกตอนนี้`,
        rows.length ? `🚗 รถสี${spec.color}รุ่นอื่นที่พร้อมขาย: ${rows.slice(0, 6).map(([m, k]) => `${m} ${k} คัน`).join(' · ')}` : '',
        `💡 ลูกค้าอยากได้ ${spec.missing} — บันทึกความสนใจไว้ หรือสั่งรถเพิ่ม`].filter(Boolean).join('\n'),
      next: ['มีรถอะไรพร้อมขาย'], query: spec.color || '',
    }
  }

  if (!spec.model && !spec.brand) {
    // ภาพรวม (หรือถามเฉพาะสี): แยกตามรุ่น
    const by = new Map()
    ready.forEach(v => { const m = carOf(v) || 'ไม่ระบุรุ่น'; by.set(m, [...(by.get(m) || []), v]) })
    const rows = [...by.entries()].sort((a, b) => b[1].length - a[1].length)
    if (!rows.length) return { text: `📭 ตอนนี้ไม่มีรถ${spec.color ? `สี${spec.color}` : ''}พร้อมขายในสต็อก${extra ? `\n${extra}` : ''}`, next: [], query }
    return {
      text: [`🚗 รถ${spec.color ? `สี${spec.color}` : ''}พร้อมขายในสต็อก — ${ready.length} คัน`, ...rows.slice(0, 12).map(([m, l]) => `• ${m} ${l.length} คัน${spec.color ? '' : ` (${colorLine(l)})`}`), rows.length > 12 ? `…และอีก ${rows.length - 12} รุ่น` : '', extra].filter(Boolean).join('\n'),
      next: [`${rows[0][0]} มีสีอะไรบ้าง`, 'รถค้างสต็อกนานมีคันไหน'], query,
      copy: customerText(`รถ${spec.color ? `สี${spec.color}` : ''}พร้อมส่งมอบตอนนี้`, rows.slice(0, 12).map(([m, l]) => `• ${m}${spec.color ? '' : ` — สี${colorNames(l)}`}`)),
    }
  }

  const name = title(spec.model && pool[0] ? { ...spec, model: carOf(pool[0]) } : spec)
  if (!ready.length) {
    const other = spec.color ? pool.filter(v => v.status === 'available') : []
    return {
      text: [`📭 ${name} ไม่มีพร้อมขายตอนนี้`, extra, other.length ? `💡 ${spec.model || spec.brand} สีอื่นที่พร้อมขาย: ${colorLine(other)}` : ''].filter(Boolean).join('\n'),
      next: ['มีรถอะไรพร้อมขาย'], query,
    }
  }
  const oldest = Math.max(...ready.map(age))
  const lines = [`🚗 ${name} — พร้อมขาย ${ready.length} คัน`]
  if (spec.brand) {
    const by = new Map()
    ready.forEach(v => { const m = carOf(v) || 'ไม่ระบุรุ่น'; by.set(m, [...(by.get(m) || []), v]) })
    ;[...by.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([m, l]) => lines.push(`• ${m} ${l.length} คัน${spec.color ? '' : ` (${colorLine(l)})`}`))
  } else if (!spec.color) lines.push(`🎨 ${colorLine(ready)}`)
  if (extra) lines.push(extra)
  if (oldest >= 60) lines.push(`⏳ คันที่อยู่นานสุด ${oldest} วัน — เสนอคันนี้ก่อน`)
  const byModel = new Map()
  ready.forEach(v => { const m = carOf(v) || name; byModel.set(m, [...(byModel.get(m) || []), v]) })
  const copy = customerText(`${name} พร้อมส่งมอบตอนนี้`, spec.color && !spec.brand ? [] : [...byModel.entries()].map(([m, l]) => spec.brand ? `• ${m}${spec.color ? '' : ` — สี${colorNames(l)}`}` : `สีที่มี: ${colorNames(l)}`))
  return { text: lines.join('\n'), next: ['รถค้างสต็อกนานมีคันไหน', 'มีรถอะไรพร้อมขาย'], query, copy }
}
