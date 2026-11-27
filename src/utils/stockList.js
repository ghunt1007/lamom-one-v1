// (v1.0.1312) คำสั่ง LINE "สต็อก" — รถในสต็อกตอนนี้ แยกรุ่น/สี: พร้อมขาย (รวม PDI) · กำลังมา · จองแล้ว (ไฟล์ stockLine.js คนละตัว = บรรทัดสต็อกให้ AI)
// "สต็อก S07" = เฉพาะรุ่นที่มีคำนี้ · รถทดลองขับ/ขายแล้ว/ลบแล้ว ไม่นับ · ไม่โชว์ราคา/ต้นทุน
import { modelKey } from './orderNeeds.js'
const READY = ['available', 'pdi', 'พร้อมขาย']
const TRANSIT = ['transit', 'ระหว่างขนส่ง']
const RESERVED = ['reserved', 'จอง', 'จองแล้ว']

const nameOf = v => [v.brand, v.model, v.variant].map(x => String(x || '').trim()).filter(Boolean).join(' ')
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '')

export function stockGroups(vehicles = [], q = '') {
  const nq = norm(q)
  const groups = new Map()
  for (const v of vehicles || []) {
    if (!v || v.deleted) continue
    const kind = READY.includes(v.status) ? 'ready' : TRANSIT.includes(v.status) ? 'transit' : RESERVED.includes(v.status) ? 'reserved' : null
    if (!kind) continue
    const name = nameOf(v) || 'ไม่ระบุรุ่น'
    if (nq && !norm(name).includes(nq)) continue
    if (!groups.has(name)) groups.set(name, { name, key: modelKey(v), ready: {}, transit: {}, reserved: 0 })
    const g = groups.get(name)
    if (kind === 'reserved') { g.reserved++; continue }
    const color = String(v.color || '').trim() || 'ไม่ระบุสี'
    g[kind][color] = (g[kind][color] || 0) + 1
  }
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0)
  return [...groups.values()].map(g => ({ ...g, readyN: sum(g.ready), transitN: sum(g.transit) }))
    .sort((a, b) => b.readyN - a.readyN || b.transitN - a.transitN || a.name.localeCompare(b.name))
}

// leadCounts (ไม่บังคับ) = Map(modelKey → จำนวนลูกค้าที่สนใจรุ่นนั้น) จาก stockLeads.leadCountByModel (v1.0.1424)
export function stockLineAnswer(vehicles = [], { q = '', max = 15, leadCounts = null } = {}) {
  const gs = stockGroups(vehicles, q)
  if (!gs.length) return q ? `📭 ไม่พบรถรุ่น "${q}" ในสต็อกครับ` : '📭 ยังไม่มีรถในสต็อกครับ (บันทึกรถได้ที่เมนู สต็อกรถ ในแอป)'
  const tot = k => gs.reduce((a, g) => a + (k === 'reserved' ? g.reserved : g[k + 'N']), 0)
  const colors = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ×${n}`).join(', ')
  const lines = [`🚗 รถในสต็อก${q ? ` (${q})` : ''}: พร้อมขาย ${tot('ready')} คัน · กำลังมา ${tot('transit')} · จองแล้ว ${tot('reserved')}`]
  for (const g of gs.slice(0, max)) {
    lines.push('', `▪️ ${g.name}`)
    if (g.readyN) lines.push(`  ✅ พร้อมขาย: ${colors(g.ready)}`)
    const lc = g.readyN && leadCounts ? leadCounts.get(g.key) || 0 : 0
    if (lc) lines.push(`  🎯 ลูกค้าสนใจรุ่นนี้ ${lc} คน (ดูรายชื่อที่หน้าสต็อกในแอป)`)
    if (g.transitN) lines.push(`  🚢 กำลังมา: ${colors(g.transit)}`)
    if (g.reserved) lines.push(`  📝 จองแล้ว ${g.reserved} คัน`)
  }
  if (gs.length > max) lines.push('', `…และอีก ${gs.length - max} รุ่น (พิมพ์ "สต็อก ชื่อรุ่น" เพื่อดูเฉพาะรุ่น)`)
  return lines.join('\n')
}
