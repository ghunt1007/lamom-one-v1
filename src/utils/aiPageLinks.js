// ปุ่ม "เปิดหน้า…" ใต้คำตอบ LAMI — ดูจากคำถาม แล้วพาไปหน้าที่ใช้ทำเรื่องนั้นต่อได้ทันที
const LINKS = [
  [/ทดลองขับ|ลองขับ|test\s*drive/i, '🚗 นัดทดลองขับ', '/crm/testdrive'],
  [/สต็อก|stock|รถเหลือ|รถว่าง/i, '📦 สต็อกรถ', '/dms/stock'],
  [/จอง|booking|ส่งมอบ/i, '📝 จองรถ', '/crm/bookings'],
  [/ไฟแนนซ์|finance|ผ่านไฟ|ยื่นกู้/i, '🏦 ยื่นไฟแนนซ์', '/finance/application'],
  [/ค่างวด|ผ่อน|ดาวน์|ดอกเบี้ย/i, '🧮 คำนวณค่างวด', '/finance/loan-calc'],
  [/ค้างชำระ|ทวงหนี้|หนี้/i, '💳 ค้างชำระ', '/finance/debt'],
  [/ติดตาม|follow/i, '📞 Follow-up', '/crm/followup'],
  [/hot lead|ลีด|lead|ลูกค้า/i, '👥 ลูกค้า', '/crm/customers'],
  [/เสียดีล|lost|หลุด/i, '📉 Lost Deal', '/crm/lostdeals'],
  [/เทียบรุ่น|เปรียบเทียบ|ต่างกันยังไง/i, '⚖️ เทียบรุ่นรถ', '/dms/compare'],
  [/วันนี้ทำอะไร|ทำอะไรก่อน|งานของฉัน|my day/i, '☀️ งานของฉันวันนี้', '/crm/my-day'],
  [/pipeline|ไปป์ไลน์/i, '📋 Pipeline', '/crm/pipeline'],
]

export function pageLinksFor(question, max = 2) {
  const q = String(question || '')
  const out = []
  for (const [re, label, path] of LINKS) {
    if (re.test(q) && !out.some(o => o.path === path)) out.push({ label, path })
    if (out.length >= max) break
  }
  return out
}
