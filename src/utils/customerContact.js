// บันทึกว่า "ติดต่อลูกค้ารายนี้แล้ววันนี้" (lastContactAt + updatedAt อัตโนมัติจาก updateDocData) — เรียกเมื่อบันทึกผล
// Follow-up แล้ว เพื่อให้ลูกค้าหลุดจากรายการ "Lead ไม่ได้ติดตามเกิน 3 วัน" และนับในรายงาน "ติดต่อแล้ว" ตอน 18:00
// ไม่ throw (ไม่มีสิทธิ์แก้ลูกค้ารายนั้น/หาไม่เจอ ก็ข้ามไป — ผลการติดตามบันทึกไปแล้ว)
import { updateDocData } from '../core/db.js'

export async function touchCustomerContact(customerId, now = new Date().toISOString()) {
  if (!customerId) return false
  try { await updateDocData('customers', customerId, { lastContactAt: now }); return true } catch { return false }
}
