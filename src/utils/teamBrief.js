// (v1.0.1056) หัวหน้าถาม: "ทีมวันนี้เป็นไง" / "ใครมีนัดค้างเยอะสุด" / "สรุปงานทีม" → LAMI สรุปงานติดตามรายเซลส์จากข้อมูลจริงทันที
// นับเฉพาะลูกค้า/นัดที่ผู้ใช้มองเห็น (ตัวเอง + ลูกทีม · แอดมิน/เจ้าของ = ทั้งโชว์รูม) · ฟังก์ชันล้วน ทดสอบได้
export const UNOWNED = 'ยังไม่มีผู้ดูแล'
const isDate = d => /^\d{4}-\d{2}-\d{2}/.test(d || '')
const bkkDate = v => {
  const t = v?.toDate ? v.toDate() : v ? new Date(v) : null
  return t && !isNaN(t) ? new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''
}

export function isTeamQuestion(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '').trim()
  if (!s || s.length > 60) return false
  if (/ทีม\s*(?:AI|เอไอ)|เอเจนต์|agent/i.test(s)) return false // (v1.0.1136) ถามทีม AI → กระดานทีม AI
  if (/ยอด|เป้า|ขายดี|ขายเก่ง|ส่งมอบ|ค่าคอม|รายได้|ทุกคน|ทั้งหมด|อันดับ|ทำไม|อย่างไร|ใบจอง|ลงเวลา|มาสาย/.test(s)) return false
  if (/(?:ใคร|(?:ลูกทีม|ลูกน้อง|เซลส์)\s*คนไหน)(?:มี)?\s*(?:นัด|งาน|ลูกค้า)?\s*(?:ติดตาม)?\s*(?:ค้าง|เลยกำหนด)\s*(?:โทร|ติดตาม)?\s*(?:เยอะ|มาก|นาน)|ใครไม่(?:ได้)?ตามลูกค้า|ใครตามงานช้า/.test(s)) return true
  return /ทีม|ลูกทีม|ลูกน้อง|เซลส์แต่ละคน|เซลส์\s*คนไหน|พนักงานขาย/.test(s) && /เป็นไง|เป็นยังไง|วันนี้|ค้าง|สรุป|ตามงาน|ติดตาม|สถานะ|ภาพรวม|อัปเดต|อัพเดท|อัพเดต/.test(s)
}

export function teamStats({ customers = [], followups = [], today }) {
  const vis = new Map()
  customers.forEach(c => { if (c && !c.deleted) vis.set(c.id, c) })
  const rows = new Map()
  const row = n => { const k = String(n || '').trim() || UNOWNED; if (!rows.has(k)) rows.set(k, { name: k, active: 0, overdue: 0, dueToday: 0, hotNoFu: 0, newToday: 0 }); return rows.get(k) }
  const pend = followups.filter(f => f && !f.deleted && f.status === 'pending' && vis.has(f.customerId) && isDate(f.dueDate))
  const pendIds = new Set(pend.map(f => f.customerId))
  pend.forEach(f => {
    const r = row(vis.get(f.customerId).assignedTo), d = f.dueDate.slice(0, 10)
    if (d < today) r.overdue++
    else if (d === today) r.dueToday++
  })
  ;[...vis.values()].filter(c => !c.isLost && ['lead', 'pp'].includes(c.stage) && !c.bookingId).forEach(c => {
    const r = row(c.assignedTo)
    r.active++
    if (c.temperature === 'hot' && !pendIds.has(c.id)) r.hotNoFu++
    if (bkkDate(c.createdAt) === today) r.newToday++
  })
  const all = [...rows.values()]
  const unowned = all.find(r => r.name === UNOWNED) || null
  const sellers = all.filter(r => r.name !== UNOWNED).sort((a, b) => b.overdue - a.overdue || b.dueToday - a.dueToday || b.hotNoFu - a.hotNoFu || b.active - a.active || a.name.localeCompare(b.name))
  return { sellers, unowned }
}

export function teamBriefText({ sellers, unowned }, dateLabel = '') {
  if (!sellers.length && !unowned) return '👥 ยังไม่มีลูกค้าที่กำลังติดตามในทีมตอนนี้'
  const lines = [`👥 งานติดตามของทีมวันนี้${dateLabel ? ' ' + dateLabel : ''} — ${sellers.length} คน`]
  sellers.slice(0, 10).forEach(r => {
    const parts = [r.overdue ? `⚠️ เลยกำหนด ${r.overdue}` : '', r.dueToday ? `📞 วันนี้ ${r.dueToday}` : '', r.hotNoFu ? `🔥 HOT ไม่มีนัด ${r.hotNoFu}` : '', r.newToday ? `🧲 ลีดใหม่ ${r.newToday}` : ''].filter(Boolean)
    lines.push(`• ${r.name} — ${parts.length ? parts.join(' · ') : '✅ ไม่มีงานค้าง'} · ดูแล ${r.active} คน`)
  })
  if (sellers.length > 10) lines.push(`…และอีก ${sellers.length - 10} คน`)
  if (unowned?.active) lines.push(`🙋 ลูกค้าที่${UNOWNED} ${unowned.active} คน${unowned.hotNoFu ? ` (HOT ${unowned.hotNoFu})` : ''}`)
  const top = sellers[0]
  const tip = top?.overdue ? `คุยกับ ${top.name} ก่อน — มีนัดเลยกำหนดมากที่สุด (${top.overdue} นัด)`
    : unowned?.active ? `มอบหมายลูกค้าที่${UNOWNED}ให้เซลส์`
    : sellers.some(r => r.hotNoFu) ? `ให้ ${sellers.filter(r => r.hotNoFu).sort((a, b) => b.hotNoFu - a.hotNoFu)[0].name} นัดลูกค้า HOT ที่ยังไม่มีนัด` : ''
  lines.push(tip ? `💡 ${tip}` : '✅ ทีมไม่มีนัดค้าง')
  return lines.join('\n')
}

export function teamFollowUps({ sellers }) {
  return [
    sellers.some(r => r.overdue || r.dueToday) ? 'วันนี้ควรโทรหาใคร' : '',
    sellers.some(r => r.hotNoFu) ? 'ลูกค้า hot ที่ยังไม่มีนัดมีใครบ้าง' : '',
    'ใครขายดีสุด',
  ].filter(Boolean)
}
