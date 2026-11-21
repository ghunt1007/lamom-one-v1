// (v1.0.1148) ขอรีวิวจากลูกค้าที่รับรถแล้วทาง LINE — เดิมปุ่ม "📩 ขอรีวิว" บอกแค่ว่ายังไม่เชื่อมระบบส่ง
// เลือกเฉพาะลูกค้าที่: ส่งมอบแล้ว · เคยทัก LINE OA (มี lineUserId) · ยังไม่เคยถูกขอรีวิว · ยังไม่มีรีวิวในระบบ
const norm = s => String(s || '').toLowerCase().replace(/^คุณ/, '').replace(/\s+/g, '')
const ms = v => {
  if (!v) return NaN
  if (typeof v === 'string' || typeof v === 'number') return new Date(v).getTime()
  if (typeof v.toDate === 'function') return v.toDate().getTime()
  if (typeof v.seconds === 'number') return v.seconds * 1000
  return NaN
}

/** days = 0 หมายถึงไม่จำกัดช่วงเวลา */
export function pickReviewTargets(customers = [], reviews = [], { days = 60, now = Date.now() } = {}) {
  const reviewed = new Set(reviews.map(r => norm(r.customer)).filter(Boolean))
  const out = []
  for (const c of customers) {
    if (!c || c.deleted || c.isLost || c.stage !== 'delivered' || !c.lineUserId || c.lineOptOut || c.lineBlockedAt || c.reviewAskedAt) continue
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
    if (reviewed.has(norm(name)) || (c.firstName && reviewed.has(norm(c.firstName)))) continue
    if (days > 0) {
      const at = ms(c.stageChangedAt) || ms(c.updatedAt)
      if (!Number.isFinite(at) || now - at > days * 864e5) continue
    }
    out.push({ id: c.id, name, lineUserId: c.lineUserId })
  }
  return out
}

export function isHttpsLink(v) {
  try { const u = new URL(String(v || '').trim()); return u.protocol === 'https:' && !!u.hostname.includes('.') } catch { return false }
}

export function reviewMessage(link = '', showroom = '') {
  const who = showroom ? `ทีมงาน ${showroom}` : 'ทีมงานโชว์รูม'
  return [
    `สวัสดีค่ะ ${who} ขอบคุณที่ไว้วางใจรับรถกับเรานะคะ 🙏`,
    'รบกวนเวลาไม่ถึง 1 นาที ให้คะแนนและเล่าความประทับใจให้เราหน่อยนะคะ ทุกความเห็นช่วยให้เราบริการได้ดีขึ้นค่ะ',
    link ? `⭐ กดรีวิวได้ที่: ${String(link).trim()}` : '',
    'ขอบคุณมากค่ะ 💙',
  ].filter(Boolean).join('\n')
}
