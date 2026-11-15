// (v1.0.1155) สรุป "ระบบพร้อมใช้งานจริงแค่ไหน และยังเหลืออะไรให้ทำ" สำหรับเจ้าของโปรแกรม
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล: รับสถานะจาก worker (socialStatus) + สวิตช์ inbox_auto + สถานะสำรองข้อมูล
// ทุกข้อเป็นของจริงที่ตรวจได้ ไม่ใช่ตัวเลขสมมติ ข้อที่ตรวจไม่ได้จะบอกว่า "ตรวจไม่ได้" ไม่เดาว่าผ่าน

const BACKUP_MAX_AGE_MS = 36 * 3600 * 1000

/**
 * @param {{status?:object|null, auto?:object|null, lastBackupMs?:number|null, now?:number}} i
 * @returns {{id:string,label:string,state:'ok'|'todo'|'unknown',hint:string,link?:string}[]}
 */
export function readinessItems({ status, auto, lastBackupMs, sheet, now = Date.now() } = {}) {
  const items = []
  const add = (id, label, state, hint, link) => items.push({ id, label, state, hint, ...(link ? { link } : {}) })
  const noStatus = !status
  const st = (ok, hint) => noStatus ? 'unknown' : (ok ? 'ok' : 'todo')

  add('line', 'LINE เชื่อมต่อแล้ว', st(status?.line?.configured, 'ใส่ LINE token ในหน้าช่องทางโซเชียล → 🔑'), 'ใส่คีย์ LINE ในหน้า 🔑 คีย์เชื่อมต่อ', '/marketing/channels')
  const pages = (status?.meta?.pages || []).length
  add('meta', 'Facebook / Instagram เชื่อมต่อแล้ว', st(status?.meta?.configured && pages > 0), 'ใส่โทเคนผู้ใช้ระบบ Meta ในหน้า 🔑 คีย์เชื่อมต่อ', '/marketing/channels')
  add('ai', 'คีย์ AI (Gemini) พร้อม', st(status?.ai?.configured), 'ใส่ GEMINI_API_KEY ในหน้า 🔑 คีย์เชื่อมต่อ', '/marketing/channels')
  add('leadhook', 'คีย์รับลีดจาก TikTok / อีเมล พร้อม', st(status?.leadHook?.configured), 'กด 🎲 สร้างคีย์ในหน้า 🔑 คีย์เชื่อมต่อ', '/marketing/channels')

  const noAuto = !auto || auto._noAccess
  const sw = (id, label, on, hint) => add(id, label, noAuto ? 'unknown' : (on ? 'ok' : 'todo'), hint, '/marketing/channels')
  sw('publicform', 'เปิดฟอร์มรับลูกค้าสาธารณะ', auto?.publicForm, 'เจ้าของเปิดเองที่หน้าช่องทางโซเชียล → ตอบอัตโนมัติ')
  sw('aireply', 'เปิด AI ตอบแชตอัตโนมัติ', auto?.aiReply, 'เจ้าของเปิดเองเมื่อพร้อม (ทดสอบข้อความก่อน)')
  sw('leadalert', 'แจ้งเตือนลีดใหม่ทาง LINE', auto?.leadAlert !== false, 'เปิดสวิตช์ "แจ้งเตือนทันที" ที่หน้าช่องทางโซเชียล')

  // (v1.0.1158) Google Sheet DATA Booking — ระบบเปิดไฟล์เองได้ไหม (ปุ่มซิงก์ไม่ต้องโหลดไฟล์เอง + แถบเตือน Sheet มีแก้ไข)
  // sheet: { ok:true } | { code:'not_shared', shareWith } | null (ตรวจไม่ได้)
  if (sheet?.ok) add('sheet', 'ระบบเปิด Google Sheet ลูกค้าได้เอง', 'ok', '', '/crm/bookings')
  else if (sheet?.code === 'not_shared') add('sheet', 'ระบบเปิด Google Sheet ลูกค้าได้เอง', 'todo', `แชร์ไฟล์ Sheet (สิทธิ์ผู้มีสิทธิ์อ่าน) ให้อีเมล ${sheet.shareWith || 'ของระบบ'} ครั้งเดียว แล้วกด 🔄 ซิงก์ Sheet จะดึงไฟล์ให้เอง`, '/crm/bookings')
  else add('sheet', 'ระบบเปิด Google Sheet ลูกค้าได้เอง', 'unknown', 'ตรวจไม่ได้ตอนนี้ (ออฟไลน์หรือระบบรายงานไม่ตอบ) ลองเปิดหน้านี้ใหม่', '/crm/bookings')

  let backupState = 'unknown'
  let backupHint = 'ยังไม่พบประวัติสำรองข้อมูล — ตรวจที่หน้าสำรองข้อมูล'
  if (typeof lastBackupMs === 'number' && lastBackupMs > 0) {
    backupState = now - lastBackupMs <= BACKUP_MAX_AGE_MS ? 'ok' : 'todo'
    backupHint = 'สำรองอัตโนมัติควรทำทุกคืน แต่ล่าสุดเก่ากว่า 36 ชั่วโมงแล้ว'
  }
  add('backup', 'สำรองข้อมูลอัตโนมัติล่าสุดไม่เกิน 36 ชม.', backupState, backupHint, '/settings/backup')
  return items
}

export function readinessSummary(items) {
  const ok = items.filter(i => i.state === 'ok').length
  const todo = items.filter(i => i.state === 'todo').length
  const unknown = items.filter(i => i.state === 'unknown').length
  return { ok, todo, unknown, total: items.length }
}
