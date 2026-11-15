// ลีดเข้ามาจากลิงก์/QR ไหนของเรา (แนะนำเพื่อน บูธ ติดรถ นามบัตร หน้าแคมเปญ UTM ฟอร์มทั่วไป) — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
// ใช้ในหน้า แหล่งที่มาลีด (sourcePerformance.js) และรายงาน LINE 18:00 (workers/daily-report.js)
export const ENTRY_INFO = {
  ref: ['🤝', 'ลิงก์แนะนำเพื่อน'], booth: ['🎪', 'QR บูธ'], car: ['🚗', 'QR ติดรถโชว์'], card: ['📇', 'QR นามบัตรเซลส์'],
  landing: ['🌐', 'หน้าเว็บแคมเปญ'], utm: ['🔗', 'ลิงก์ UTM/โฆษณา'], form: ['📝', 'ฟอร์มทั่วไป'],
}
export function entryPointOf(c) {
  if (!c) return null
  if (c.referralCode) return 'ref'
  if (c.eventId && c.autoLead) return 'booth'
  if (c.utmMedium === 'namecard') return 'card'
  if (c.utmSource === 'walk-in' && c.utmMedium === 'qr') return 'car'
  if (c.utmSource === 'landing') return 'landing'
  if (c.utmCampaign || c.utmSource) return 'utm'
  if (c.autoLead && (c.tags || []).includes('ฟอร์มรับลีด')) return 'form'
  return null
}

// สรุปลีดตามช่องทางของเรา เช่น '🎪 QR บูธ 2 · 📇 QR นามบัตรเซลส์ 1' (เรียงมากไปน้อย) · ไม่มี = ''
export function entryPointLine(customers = []) {
  const n = {}
  ;(customers || []).forEach(c => { const k = entryPointOf(c); if (k) n[k] = (n[k] || 0) + 1 })
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${ENTRY_INFO[k][0]} ${ENTRY_INFO[k][1]} ${v}`).join(' · ')
}
