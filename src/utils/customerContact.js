// บันทึกว่า "ติดต่อลูกค้ารายนี้แล้ววันนี้" (lastContactAt + updatedAt อัตโนมัติจาก updateDocData) — เรียกเมื่อบันทึกผล
// Follow-up แล้ว เพื่อให้ลูกค้าหลุดจากรายการ "Lead ไม่ได้ติดตามเกิน 3 วัน" และนับในรายงาน "ติดต่อแล้ว" ตอน 18:00
// ครั้งแรกที่ติดต่อจะบันทึก firstContactAt ด้วย (ใช้วัด "ติดต่อ Lead ใหม่เร็วแค่ไหน" ในหน้ารายได้รายเซลส์) — อ่านค่าจริง
// จากฐานข้อมูลก่อนเสมอ ถ้าอ่านไม่ได้จะไม่แตะ firstContactAt (กันเขียนทับเวลาครั้งแรกด้วยเวลาที่ช้ากว่า)
// ไม่ throw (ไม่มีสิทธิ์แก้ลูกค้ารายนั้น/หาไม่เจอ ก็ข้ามไป — ผลการติดตามบันทึกไปแล้ว)
import { updateDocData, readDoc } from '../core/db.js'

export async function touchCustomerContact(customerId, now = new Date().toISOString()) {
  if (!customerId) return false
  const patch = { lastContactAt: now }
  try {
    const cur = await readDoc('customers', customerId)
    if (cur && !cur.firstContactAt) patch.firstContactAt = now
  } catch { /* อ่านไม่ได้ — บันทึกแค่ lastContactAt */ }
  try { await updateDocData('customers', customerId, patch); return true } catch { return false }
}

// (v1.0.1370) ส่ง LINE ถึงลูกค้าจากในแอปแล้ว → ลงไทม์ไลน์การติดต่อ (comm_logs) ให้เห็นว่าส่งอะไรไปเมื่อไหร่ ใครส่ง
// + บันทึกว่าติดต่อแล้ววันนี้ · ไม่ throw (ส่งไปแล้ว บันทึกไม่ได้ก็ไม่ควรทำให้ดูเหมือนส่งไม่สำเร็จ)
export async function logLineSent(customerId, text) {
  if (!customerId) return false
  try {
    const [{ createDoc }, { getState }, { myEffectiveCompanyId }] = await Promise.all([
      import('../core/db.js'), import('../core/store.js'), import('../core/companyScope.js'),
    ])
    const me = getState('user') || {}
    await createDoc('comm_logs', {
      customerId, type: 'line', note: '💚 ส่ง LINE: ' + String(text || '').trim().slice(0, 300),
      createdBy: me.displayName || me.email || me.uid || '', companyId: myEffectiveCompanyId(),
    })
  } catch { /* ข้าม */ }
  return touchCustomerContact(customerId)
}
