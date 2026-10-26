// ปุ่ม "ลงมือทำ" ใต้คำตอบ LAMI — ถ้าคำถามเอ่ยชื่อลูกค้า ให้กดโทร/นัดลองขับ/เปิดข้อมูลลูกค้าคนนั้นได้ทันที
// เช่น "นัดลองขับสมชายพรุ่งนี้บ่าย 2" → ปุ่ม 🚗 นัดลองขับ สมชาย (เปิดฟอร์มพร้อมวันเวลาที่เดาไว้)
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '')

export function mentionedCustomers(question, customers = [], max = 2) {
  const q = norm(question)
  if (!q) return []
  const hits = []
  for (const c of customers) {
    if (!c || c.deleted) continue
    const first = norm(c.firstName), nick = norm(c.nickname)
    const full = norm([c.firstName, c.lastName].filter(Boolean).join(''))
    const score = full.length >= 4 && q.includes(full) ? 3 : first.length >= 2 && q.includes(first) ? 2 : nick.length >= 2 && q.includes(nick) ? 1 : 0
    if (score) hits.push({ c, score })
  }
  // ชื่อเต็มตรงก่อน · ชื่อยาวก่อน (กัน "มา" ไปจับ "มานะ")
  // ตัด "มา" ทิ้งถ้า "มานะ" ก็ถูกจับด้วย (ชื่อสั้นที่เป็นส่วนหนึ่งของชื่อที่ยาวกว่า)
  const kept = hits.filter(h => !hits.some(o => o !== h && norm(o.c.firstName).length > norm(h.c.firstName).length && norm(o.c.firstName).includes(norm(h.c.firstName))))
  return kept.sort((a, b) => b.score - a.score || norm(b.c.firstName).length - norm(a.c.firstName).length).slice(0, max).map(h => h.c)
}

export function customerActionsFor(question, customers = []) {
  const q = String(question || '')
  const wantsTd = /ทดลองขับ|ลองขับ|test\s*drive/i.test(q)
  const wantsCall = /โทร|call/i.test(q)
  return mentionedCustomers(q, customers).flatMap(c => {
    const name = c.firstName || c.nickname || 'ลูกค้า'
    const acts = []
    if (wantsTd) acts.push({ kind: 'td', id: c.id, label: `🚗 นัดลองขับ ${name}` })
    if (c.phone && (wantsCall || !wantsTd)) acts.push({ kind: 'tel', id: c.id, label: `📞 โทร ${name}`, phone: String(c.phone).replace(/[^\d+]/g, '') })
    acts.push({ kind: 'open', id: c.id, label: `👤 เปิด ${name}` })
    return acts
  })
}
