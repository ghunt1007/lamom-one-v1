// เป้ายอดขายรายเดือนของปี (ตั้งที่หน้า Sales Budget) — sales_budgets 1 เอกสารต่อปี { year, targets:[12], units?:[12] }
// เดิมแต่ละหน้าเขียน query นี้เอง (TargetActual, DailyReport, SalesForecast) และ Company KPI ใช้เป้าสมมติ ฿120 ล้าน
// รวมไว้ที่เดียว: ยังไม่ได้ตั้ง → targets/units เป็น null (หน้าแสดง "ยังไม่ได้ตั้งเป้า" ไม่ใช่เลขปลอม)
import { listDocs } from '../core/db.js'
import { companyScopeFilters } from '../core/companyScope.js'

export function budgetFromDoc(d) {
  const arr = v => (Array.isArray(v) && v.length === 12 ? v.map(x => Number(x) || 0) : null)
  return { id: d?.id || null, targets: arr(d?.targets), units: arr(d?.units) }
}

export async function loadSalesBudget(year) {
  try {
    const docs = await listDocs('sales_budgets', [['year', '==', Number(year)], ...companyScopeFilters()], 'createdAt', 'asc', 1)
    return budgetFromDoc(docs[0])
  } catch { return budgetFromDoc(null) }
}

// ผลรวมเดือน from..to (1–12) — null ถ้าไม่มีข้อมูลหรือรวมได้ 0
export function sumMonths(arr, from = 1, to = 12) {
  if (!arr) return null
  const s = arr.slice(from - 1, to).reduce((a, v) => a + v, 0)
  return s > 0 ? s : null
}
