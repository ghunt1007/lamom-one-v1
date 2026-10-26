// ค้นหาลูกค้าแบบยืดหยุ่น: พิมพ์หลายคำได้ (ต้องตรงทุกคำ เช่น "s07 สมชาย") และเบอร์โทรพิมพ์แบบมีขีด/เว้นวรรคก็เจอ
// (เช่น "081-234" เจอเบอร์ที่บันทึกไว้เป็น 0812345678)
const digits = s => String(s || '').replace(/\D/g, '')

export function searchTokens(query) {
  return String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean)
}

// คำพิเศษที่ระบบ "เข้าใจ" แทนการหาตัวหนังสือ — พิมพ์ภาษาพูดได้ เช่น "ร้อน s07", "lead เงียบ", "ยังไม่มีเบอร์"
const SMART = [
  { re: /^(ร้อน|hot)$/, label: '🔴 ลูกค้าร้อน', test: c => c.temperature === 'hot' },
  { re: /^(อุ่น|warm)$/, label: '🟡 ลูกค้าอุ่น', test: c => c.temperature === 'warm' },
  { re: /^(เย็น|cold)$/, label: '🔵 ลูกค้าเย็น', test: c => c.temperature === 'cold' },
  { re: /^(lead|ลีด|ใหม่)$/, label: '🧲 Lead', test: c => c.stage === 'lead' && !c.isLost },
  { re: /^(prospect|คุยอยู่|กำลังคุย)$/, label: '📇 Prospect', test: c => c.stage === 'pp' && !c.isLost },
  { re: /^(จอง|จองแล้ว|booking)$/, label: '📝 จองแล้ว', test: c => c.stage === 'booking' },
  { re: /^(ส่งมอบ|ส่งมอบแล้ว|delivered)$/, label: '✅ ส่งมอบแล้ว', test: c => c.stage === 'delivered' },
  { re: /^(เสียดีล|หลุด|lost)$/, label: '⬛ เสียดีล', test: c => !!c.isLost },
  { re: /^(เงียบ|ไม่ได้ติดต่อ|ไม่ได้คุย)$/, label: '💤 เงียบนาน', test: (c, o) => !!o.isQuiet?.(c) },
  { re: /^(ไม่มีเบอร์|ยังไม่มีเบอร์)$/, label: '📵 ยังไม่มีเบอร์', test: c => digits(c.phone).length < 9 },
  { re: /^(ไม่มีผู้ดูแล|ยังไม่มีผู้ดูแล)$/, label: '👤 ยังไม่มีผู้ดูแล', test: c => !String(c.assignedTo || '').trim() },
]

// แยกคำค้นเป็น "ตัวกรองที่เข้าใจ" กับ "คำที่ต้องหาตามตัวหนังสือ" (ใช้ทั้งกรองและแสดงป้าย "เข้าใจว่า…")
export function parseSmartQuery(query) {
  const smart = [], text = []
  for (const t of searchTokens(query)) {
    const m = SMART.find(x => x.re.test(t))
    if (m && !smart.includes(m)) smart.push(m)
    else if (!m) text.push(t)
  }
  return { smart, text, labels: smart.map(m => m.label) }
}

export function matchesSearch(c, query, fullName, opts = {}) {
  const { smart, text: tokens } = parseSmartQuery(query)
  if (!smart.every(m => m.test(c, opts))) return false
  if (!tokens.length) return true
  const name = fullName ? fullName(c) : [c.firstName, c.lastName].filter(Boolean).join(' ')
  const text = [name, c.nickname, c.lineId, c.interestedModel, c.assignedTo, c.occupation]
    .filter(Boolean).join(' ').toLowerCase()
  const phone = digits(c.phone)
  return tokens.every(t => {
    if (text.includes(t)) return true
    const d = digits(t)
    // ต้องเป็นตัวเลขล้วน (ยอมให้มีขีด/วงเล็บ/+) และยาว 3 หลักขึ้นไป ถึงจะเทียบกับเบอร์โทร
    if (d.length >= 3 && /^[\d\-+().]+$/.test(t)) {
      const local = d.startsWith('66') && d.length >= 11 ? '0' + d.slice(2) : d
      return phone.includes(local) || phone.includes(d)
    }
    return false
  })
}
