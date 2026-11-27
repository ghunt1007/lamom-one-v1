// (v1.0.1423) รถในสต็อก ↔ ลูกค้าที่สนใจรุ่นนั้น — ช่วยระบายรถค้างสต็อก: เห็นทันทีว่าโทรหาใครได้
// เทียบด้วย modelKey เดียวกับหน้าตารางสีรถ (ตัดชื่อยี่ห้อออก "DEEPAL S07" = "S07") · ฟังก์ชันล้วน
import { modelKey } from './orderNeeds.js'

const TEMP_RANK = { hot: 0, warm: 1, cold: 2 }
const ms = v => { const t = v?.toDate ? v.toDate().getTime() : Date.parse(v || ''); return Number.isFinite(t) ? t : 0 }

export const isOpenLead = c => !!c && !c.deleted && !c.isLost && ['lead', 'pp'].includes(c.stage)

export function leadsForCar(vehicle, customers = []) {
  const key = modelKey(vehicle)
  if (!key) return []
  const color = String(vehicle?.color || '').trim().toLowerCase()
  return (customers || []).filter(c => isOpenLead(c) && modelKey({ model: c.interestedModel }) === key)
    .map(c => ({ c, colorHit: !!color && !!c.interestedColor && String(c.interestedColor).trim().toLowerCase() === color }))
    .sort((a, b) => Number(b.colorHit) - Number(a.colorHit) || (TEMP_RANK[a.c.temperature] ?? 3) - (TEMP_RANK[b.c.temperature] ?? 3)
      || Math.max(ms(b.c.lastContactAt), ms(b.c.createdAt)) - Math.max(ms(a.c.lastContactAt), ms(a.c.createdAt)))
}

// นับต่อรุ่น ครั้งเดียว (หน้าสต็อกมีรถหลายคันรุ่นเดียวกัน)
export function leadCountByModel(customers = []) {
  const m = new Map()
  for (const c of customers || []) {
    if (!isOpenLead(c)) continue
    const k = modelKey({ model: c.interestedModel })
    if (k) m.set(k, (m.get(k) || 0) + 1)
  }
  return m
}
