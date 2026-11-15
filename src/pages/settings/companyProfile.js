// ค่าเริ่มต้นของ "ตั้งค่าบริษัท" — เดิมเป็นข้อมูลตัวอย่าง (เลขภาษี/เบอร์/ที่อยู่สมมติ) และถูกเขียนลง Firestore
// ทันทีที่มีคนเปิดหน้า ทำให้ดูเหมือนตั้งค่าจริงแล้ว ตอนนี้ช่องที่ยังไม่กรอกจะว่างไว้ และไม่บันทึกจนกว่าจะกดบันทึกเอง
export const COMPANY_DEFAULTS = {
  name: '', nameTh: '', taxId: '', phone: '', email: '', address: '',
  website: '', lineOA: '', facebook: '', brand: '',
  logoText: 'LAMOM', logoColor: '#2563eb', footerNote: '',
}

// ค่าตัวอย่างเก่าที่อาจค้างอยู่ใน Firestore — ถือว่า "ยังไม่ได้กรอก"
export const LEGACY_SAMPLE = {
  name: 'LAMOM ออโต้ จำกัด',
  nameTh: 'บริษัท ลาม่อม ออโต้ จำกัด',
  taxId: '0-1055-12345-67-1',
  phone: '02-123-4567',
  email: 'info@lamom.co.th',
  address: '123 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310',
  website: 'www.lamom.co.th',
  lineOA: '@lamomauto',
  facebook: 'LamoMAuto',
  brand: 'BYD, MG, DEEPAL, NETA',
  footerNote: 'ขอบคุณที่ไว้วางใจ LAMOM AUTO — บริการด้วยใจ',
}

export function cleanCompany(doc = {}) {
  const out = { ...COMPANY_DEFAULTS }
  for (const [k, v] of Object.entries(doc || {})) {
    if (v == null) continue
    if (LEGACY_SAMPLE[k] !== undefined && String(v).trim() === LEGACY_SAMPLE[k]) continue
    out[k] = v
  }
  return out
}

// ช่องสำคัญที่ยังว่าง (ใช้บอกเจ้าของว่าต้องกรอกอะไร)
export function missingCompanyFields(d) {
  const labels = { nameTh: 'ชื่อบริษัท (ไทย)', taxId: 'เลขผู้เสียภาษี', address: 'ที่อยู่', phone: 'โทรศัพท์' }
  return Object.keys(labels).filter(k => !String(d?.[k] || '').trim()).map(k => labels[k])
}
