// บรรทัด "รถพร้อมขายในสต็อกตอนนี้" สำหรับแนบให้ AI ตอนร่างคำตอบลูกค้า (ลูกค้ามักถาม "สีขาวมีพร้อมส่งไหม")
// โหลดไม่ได้ (สิทธิ์/ออฟไลน์) → คืน '' ให้ AI บอกลูกค้าว่าจะเช็กให้แทน
import { listDocs } from '../core/db.js'
import { companyScopeFilters } from '../core/companyScope.js'
import { stockFacts } from './bizFacts.js'

export async function stockLine() {
  try {
    const s = Object.values(stockFacts(await listDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 500)))[0]
    return s ? `รถพร้อมขายในสต็อกตอนนี้: ${s}` : ''
  } catch { return '' }
}
