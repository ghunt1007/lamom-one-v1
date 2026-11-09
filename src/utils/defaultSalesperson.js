import { normName } from './salesMetrics.js'

// (v1.0.1018) นัดใหม่ → เลือกเซลส์เป็นตัวเองไว้ให้ (จับชื่อเต็มหรือชื่อแรก) · ไม่มีในรายชื่อเซลส์ก็เพิ่มชื่อตัวเองไว้บนสุด (เฉพาะเซลส์ — เจ้าของ/ผู้จัดการไม่ถูกเพิ่ม)
export function defaultSalesperson(options, me, { addIfMissing = true } = {}) {
  const m = normName(me)
  if (!m) return { options, selected: '' }
  const first = m.split(' ')[0]
  const hit = options.find(o => normName(o) === m) || options.find(o => normName(o).split(' ')[0] === first)
  if (hit) return { options, selected: hit }
  return addIfMissing ? { options: [me, ...options], selected: me } : { options, selected: '' }
}
