// (v1.0.1068) ถามข้อมูลรุ่นรถ: "ราคา AION V เท่าไหร่" / "S07 วิ่งได้กี่กิโล" / "S05 มีกี่รุ่นย่อย" / "เทียบ AION V กับ S07"
// → LAMI ตอบจากฐานข้อมูลรถทันที (ไม่ต้องรอ AI) พร้อมข้อความส่งลูกค้า · ฟังก์ชันล้วน ทดสอบได้
import { carLabel } from './carLabel.js'

const norm = s => String(s || '').toLowerCase().replace(/[\s\-_.()]+/g, '')
const baht = n => '฿' + Math.round(n).toLocaleString('en-US')
const COMPARE = /เทียบ|เปรียบเทียบ|\bvs\.?\b|ต่างกัน|ต่างจาก|ดีกว่า/i
const INTENT = /ราคา|เท่าไหร่|เท่าไร|กี่บาท|สเปค|สเป็ค|spec|รุ่นย่อย|กี่รุ่น|รุ่นไหนบ้าง|วิ่งได้|วิ่งไกล|ระยะทาง|กี่กิโล|กี่ กม|แบต|แรงม้า|กี่ที่นั่ง|รับประกัน|วารันตี|warranty|ชาร์จ|ขนาดตัวรถ|ยาวเท่า|กินน้ำมัน|อัตราสิ้นเปลือง|ข้อมูลรถ|รายละเอียดรถ|จุดเด่น/i
// คำที่บอกว่าเป็นเรื่องอื่น (สั่งบันทึก/ลูกค้า/การเงิน/สต็อก) — ปล่อยให้ตัวตอบอื่นหรือ AI จัดการ
const OTHER = /ลูกค้า|ลีด|lead|โทร|นัด|บันทึก|จด |แล้ว|ใบจอง|ส่งมอบ|ยอดขาย|เป้า|ค่าคอม|รายได้|ต้นทุน|กำไร|สต็อก|สต๊อก|พร้อมขาย|ผ่อน|ค่างวด|ดาวน์|ไฟแนนซ์|อะไหล่|ประกันภัย|มือสอง|เทิร์น|โปร/i

export function maybeModelQuestion(q) {
  const s = String(q || '')
  return s.length >= 3 && s.length <= 90 && (INTENT.test(s) || COMPARE.test(s)) && !OTHER.test(s)
}

// รุ่นที่ถูกพูดถึงในคำถาม เรียงตามตำแหน่งที่ปรากฏ · ชื่อยาวชนะชื่อสั้นที่ซ้อนกัน ("aion v" ไม่นับ "aion ut")
// รุ่นหลายปี ("S07 (2024)" / "S07 (2026)") ที่พิมพ์แค่ "S07" → ใช้รุ่นปีล่าสุด
export function findModels(q, vehicles = []) {
  const n = norm(q)
  const list = vehicles.filter(v => v && v.model && Number(v.price) > 0)
  const names = [...new Set(list.map(v => String(v.model).trim()))]
  const yearOf = m => Math.max(...list.filter(v => String(v.model).trim() === m).map(v => Number(v.year) || 0))
  const cands = []
  names.forEach(m => {
    const full = norm(m)
    const base = norm(m.replace(/\s*\(\d{4}\)\s*$/, ''))
    const keys = [full, base, ...m.split(/\s+/).filter(w => w.length >= 2 && /\d/.test(w) && !/^\(/.test(w)).map(norm)]
    for (const k of [...new Set(keys)]) {
      if (k.length < 2) continue
      const at = n.indexOf(k)
      if (at >= 0) { cands.push({ model: m, at, len: k.length, exact: k === full, year: yearOf(m) }); break }
    }
  })
  // เลือกทีละตัว: ยาวสุดก่อน, ตรงชื่อเต็มก่อน, ปีใหม่ก่อน — ข้ามตัวที่ทับช่วงตัวอักษรกับตัวที่เลือกแล้ว
  cands.sort((a, b) => b.len - a.len || (b.exact - a.exact) || b.year - a.year)
  const picked = []
  for (const c of cands) if (!picked.some(p => c.at < p.at + p.len && p.at < c.at + c.len)) picked.push(c)
  return picked.sort((a, b) => a.at - b.at).map(c => c.model)
}

export function parseModelSpec(q, vehicles = []) {
  if (!maybeModelQuestion(q)) return null
  const s = String(q).trim().replace(/[?？]+$/, '')
  const models = findModels(s, vehicles)
  if (!models.length) return null
  if (COMPARE.test(s) && models.length >= 2) return { mode: 'compare', models: models.slice(0, 2) }
  if (COMPARE.test(s) && !INTENT.test(s)) return null
  return { mode: 'info', models: [models[0]] }
}

const variantsOf = (model, vehicles) => vehicles.filter(v => v && String(v.model).trim() === model && Number(v.price) > 0).sort((a, b) => a.price - b.price)
const isEv = v => Number(v.range) > 0 && /bev|ev|reev|phev/i.test(String(v.fuel))
const priceText = vs => vs.length > 1 && vs[0].price !== vs[vs.length - 1].price ? `${baht(vs[0].price)} – ${baht(vs[vs.length - 1].price)}` : baht(vs[0].price)
const rangeText = vs => {
  const r = vs.map(v => Number(v.range) || 0).filter(Boolean)
  if (!r.length) return ''
  const lo = Math.min(...r), hi = Math.max(...r)
  return lo === hi ? `${lo} กม.` : `${lo}–${hi} กม.`
}
const energyLine = vs => {
  const v = vs[0]
  if (isEv(v)) return `🔋 ${v.fuel} · วิ่งได้ ${rangeText(vs)}/ชาร์จ${v.battery ? ` · แบต ${[...new Set(vs.map(x => x.battery).filter(Boolean))].join(' / ')}` : ''}`
  return `⛽ ${v.fuel || ''}${v.engine ? ' · ' + v.engine : ''}${v.fuelEconomy ? ' · ' + v.fuelEconomy : ''}`
}
const name = vs => carLabel(vs[0].brand, vs[0].model.replace(/\s*\(\d{4}\)\s*$/, ''))

export function modelAnswer(spec, vehicles = []) {
  if (spec.mode === 'compare') return compareAnswer(spec, vehicles)
  const vs = variantsOf(spec.models[0], vehicles)
  if (!vs.length) return null
  const v = vs[0], top = vs[vs.length - 1]
  const lines = [`🚗 ${name(vs)}${v.year ? ` (${v.year})` : ''} · ${priceText(vs)}`]
  if (vs.length > 1) vs.forEach(x => lines.push(`• ${x.variant || 'รุ่นมาตรฐาน'} → ${baht(x.price)}${isEv(x) ? ` · ${x.range} กม.` : ''}${x.power ? ` · ${x.power} แรงม้า` : ''}`))
  else if (v.variant) lines.push(`• ${v.variant}${v.power ? ` · ${v.power} แรงม้า` : ''}`)
  lines.push(energyLine(vs))
  if (isEv(v) && (top.chargeTime || top.chargeDC)) lines.push(`⚡ ${top.chargeTime || `DC สูงสุด ${top.chargeDC} kW`}`)
  const size = [v.type, v.seats ? `${v.seats} ที่นั่ง` : '', v.length ? `ยาว ${Number(v.length).toLocaleString('en-US')} มม.` : '', v.bootSpace ? `ท้าย ${v.bootSpace} ลิตร` : ''].filter(Boolean).join(' · ')
  if (size) lines.push(`📐 ${size}`)
  if (v.warranty) lines.push(`🛡️ รับประกัน ${v.warranty}`)
  if (v.colors?.length) lines.push(`🎨 ${v.colors.length} สี: ${v.colors.slice(0, 6).join(', ')}${v.colors.length > 6 ? ' …' : ''}`)
  lines.push('ℹ️ ราคาและสเปคจากฐานข้อมูลรถในระบบ ตรวจกับใบราคาล่าสุดก่อนยืนยันกับลูกค้า')
  const copy = [`${name(vs)}${v.year ? ` ปี ${v.year}` : ''}`, `ราคา ${priceText(vs)}`,
    ...(vs.length > 1 ? vs.map(x => `- ${x.variant || 'รุ่นมาตรฐาน'} ${baht(x.price)}${isEv(x) ? ` (วิ่งได้ ${x.range} กม.)` : ''}`) : []),
    isEv(v) ? `วิ่งได้ ${rangeText(vs)} ต่อการชาร์จ` : (v.fuelEconomy ? `อัตราสิ้นเปลือง ${v.fuelEconomy}` : ''),
    v.warranty ? `รับประกัน ${v.warranty}` : '', 'สนใจนัดทดลองขับได้เลยค่ะ/ครับ'].filter(Boolean).join('\n')
  const short = v.model.replace(/\s*\(\d{4}\)\s*$/, '')
  const other = [...new Set(vehicles.filter(x => x && x.brand === v.brand && x.model !== v.model && Number(x.price) > 0 && x.type === v.type).map(x => String(x.model).replace(/\s*\(\d{4}\)\s*$/, '')))].filter(m => m !== short)[0]
  return { text: lines.join('\n'), copy, query: short, vehicleId: v.id, next: [`ผ่อน ${short} เดือนละเท่าไหร่`, `${short} มีสีอะไรพร้อมขาย`, ...(other ? [`เทียบ ${short} กับ ${other}`] : [])] }
}

function compareAnswer(spec, vehicles) {
  const [a, b] = spec.models.map(m => variantsOf(m, vehicles))
  if (!a.length || !b.length) return null
  const row = (label, f) => { const x = f(a), y = f(b); return x || y ? `${label}: ${x || '-'}  |  ${y || '-'}` : '' }
  const na = name(a), nb = name(b)
  const lines = [`⚖️ ${na}  |  ${nb}`,
    row('💰 ราคา', priceText),
    row('🔋 พลังงาน', vs => isEv(vs[0]) ? `${vs[0].fuel} ${rangeText(vs)}` : [vs[0].fuel, vs[0].fuelEconomy].filter(Boolean).join(' ')),
    row('🐎 แรงม้า', vs => { const p = vs.map(v => Number(v.power) || 0).filter(Boolean); return p.length ? (Math.min(...p) === Math.max(...p) ? `${p[0]}` : `${Math.min(...p)}–${Math.max(...p)}`) : '' }),
    row('📐 ยาว (มม.)', vs => vs[0].length ? Number(vs[0].length).toLocaleString('en-US') : ''),
    row('🧳 ท้ายรถ (ลิตร)', vs => vs[0].bootSpace ? String(vs[0].bootSpace) : ''),
    row('💺 ที่นั่ง', vs => vs[0].seats ? String(vs[0].seats) : ''),
    row('🛡️ รับประกัน', vs => vs[0].warranty || ''),
  ].filter(Boolean)
  // สรุปจุดต่างที่วัดได้ (ไม่ตัดสินแทน)
  const notes = []
  const pa = a[0].price, pb = b[0].price
  if (pa !== pb) notes.push(`${pa < pb ? na : nb} เริ่มต้นถูกกว่า ${baht(Math.abs(pa - pb))}`)
  const ra = Math.max(...a.map(v => Number(v.range) || 0)), rb = Math.max(...b.map(v => Number(v.range) || 0))
  if (ra && rb && ra !== rb) notes.push(`${ra > rb ? na : nb} วิ่งได้ไกลกว่า ${Math.abs(ra - rb)} กม.`)
  const la = Number(a[0].length) || 0, lb = Number(b[0].length) || 0
  if (la && lb && Math.abs(la - lb) >= 50) notes.push(`${la > lb ? na : nb} ตัวรถยาวกว่า ${Math.abs(la - lb)} มม.`)
  if (notes.length) lines.push('👉 ' + notes.join(' · '))
  lines.push('ℹ️ ข้อมูลจากฐานข้อมูลรถในระบบ ตรวจกับใบราคาล่าสุดก่อนยืนยันกับลูกค้า')
  const sa = a[0].model.replace(/\s*\(\d{4}\)\s*$/, ''), sb = b[0].model.replace(/\s*\(\d{4}\)\s*$/, '')
  return { text: lines.join('\n'), copy: '', ids: [a[0].id, b[0].id], next: [`ราคา ${sa} เท่าไหร่`, `ราคา ${sb} เท่าไหร่`, `ผ่อน ${sa} เดือนละเท่าไหร่`] }
}
