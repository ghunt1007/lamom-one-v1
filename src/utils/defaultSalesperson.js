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

// (v1.0.1019) <option> ของช่องเลือกเซลส์ในฟอร์มต่างๆ — ใช้ค่าเดิมของเอกสารถ้ามี (ไม่มีในรายชื่อก็ยังคงไว้ ไม่เปลี่ยนเป็นคนแรกเงียบๆ)
// ไม่มีค่าเดิม = เลือกตัวเองตาม defaultSalesperson · blank = มีตัวเลือก "-" ว่างไว้บนสุด
export function salesOptionsHtml(staff, { current = '', me = '', isSales = false, blank = false } = {}) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  let options = [...(staff || [])], selected = ''
  if (String(current || '').trim()) {
    selected = current
    if (!options.includes(current)) options = [current, ...options]
  } else ({ options, selected } = defaultSalesperson(options, me, { addIfMissing: isSales }))
  return (blank ? `<option value="">-</option>` : '') + options.map(s => `<option value="${esc(s)}"${s === selected ? ' selected' : ''}>${esc(s)}</option>`).join('')
}

// (v1.0.1022) ชื่อนี้คือ "ฉัน" ไหม — ตรงทั้งชื่อ (ไม่สนคำนำหน้า/ช่องว่าง/ตัวพิมพ์) หรือชื่อแรกตรงกันเมื่อฝั่งใดฝั่งหนึ่งพิมพ์มาแค่ชื่อเดียว
// ("สมชาย" = "สมชาย ใจดี" แต่ "สมชาย ก" ≠ "สมชาย ข") · ใช้กับช่องที่พิมพ์ชื่อเอง เช่น ผู้รับผิดชอบงาน
export function isMyName(name, me) {
  const n = normName(name), m = normName(me)
  if (!n || !m) return false
  if (n === m) return true
  const [nf, ...nr] = n.split(' '), [mf, ...mr] = m.split(' ')
  return nf === mf && (!nr.length || !mr.length)
}
