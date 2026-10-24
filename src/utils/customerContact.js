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
