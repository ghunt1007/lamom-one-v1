// ค้นหาลูกค้าแบบยืดหยุ่น: พิมพ์หลายคำได้ (ต้องตรงทุกคำ เช่น "s07 สมชาย") และเบอร์โทรพิมพ์แบบมีขีด/เว้นวรรคก็เจอ
// (เช่น "081-234" เจอเบอร์ที่บันทึกไว้เป็น 0812345678)
const digits = s => String(s || '').replace(/\D/g, '')

export function searchTokens(query) {
  return String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean)
}

export function matchesSearch(c, query, fullName) {
  const tokens = searchTokens(query)
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
