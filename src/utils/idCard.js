// (v1.0.985) อ่านบัตรประชาชนด้วย AI — ส่วนตรรกะล้วน (ไม่แตะ DOM/Firebase) ทดสอบได้
// AI ตอบ JSON → ตรวจเลขบัตรด้วยหลักตรวจสอบ (หลักที่ 13) ถ้าไม่ผ่านจะไม่กรอกให้ กันอ่านเลขผิดแล้วบันทึกลงใบจอง

// เลขบัตรประชาชนไทย 13 หลัก: หลักสุดท้าย = (11 - (Σ หลักที่ i × (14 - i)) mod 11) mod 10
export function validThaiId(v) {
  const d = String(v || '').replace(/\D/g, '')
  if (d.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(d[12])
}

// 1-2345-67890-12-3
export function formatThaiId(v) {
  const d = String(v || '').replace(/\D/g, '')
  return d.length === 13 ? `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}` : String(v || '')
}

// แปลงวันเกิด (ค.ศ./พ.ศ. หลายรูปแบบ) → YYYY-MM-DD ค.ศ. · อ่านไม่ได้ → ''
export function normBirthDate(v) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v || '').trim())
  if (!m) return ''
  let y = Number(m[1])
  if (y > 2400) y -= 543
  const mo = Number(m[2]), d = Number(m[3])
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return ''
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// หาจังหวัดจากท้ายที่อยู่ ถ้า AI ไม่ได้แยกมาให้ (จ.นนทบุรี / จังหวัดนนทบุรี / กรุงเทพมหานคร)
export function provinceFromAddress(addr) {
  const s = String(addr || '')
  if (/กรุงเทพ|กทม/.test(s)) return 'กรุงเทพมหานคร'
  const m = /(?:จ\.|จังหวัด)\s*([ก-๙]+)/.exec(s)
  return m ? m[1] : ''
}

const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim()

// คำตอบดิบจาก AI → { name, nid, nidOk, address, province, birthDate } · ไม่ใช่บัตร/อ่านไม่ได้ → null
export function parseIdCardReply(text) {
  let o
  try { o = JSON.parse(String(text || '').match(/\{[\s\S]*\}/)?.[0] || 'null') } catch { o = null }
  if (!o || typeof o !== 'object') return null
  const name = clean([o.title, o.firstName, o.lastName].filter(Boolean).join(' ') || o.name)
  const digits = String(o.nid || '').replace(/\D/g, '')
  const nidOk = validThaiId(digits)
  const address = clean(o.address)
  const province = clean(o.province).replace(/^(จ\.|จังหวัด)\s*/, '') || provinceFromAddress(address)
  const birthDate = normBirthDate(o.birthDate)
  if (!name && !digits && !address) return null
  return { name, nid: nidOk ? digits : '', nidOk, nidRead: digits, address, province, birthDate }
}
