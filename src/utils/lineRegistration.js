// สถานะการลงทะเบียน LINE ของเซลส์ (line_sales_targets ที่เซลส์พิมพ์ "ลงทะเบียน ชื่อ" ใน LINE OA) เทียบกับรายชื่อเซลส์ในแอป
// เทียบชื่อแบบเดียวกับ worker (normSalesName ใน workers/daily-report.js): ไม่สนตัวพิมพ์/ช่องว่าง/จุด/คำนำหน้า "คุณ"
// unknown = ชื่อที่ลงทะเบียนแต่ไม่ตรงกับเซลส์คนไหนเลย (พิมพ์ผิด) — คนนั้นจะไม่ได้รับงานทาง LINE
export const lineNameKey = n => String(n || '').toLowerCase().replace(/^คุณ/, '').replace(/[\s.]/g, '')

export function lineRegistrationStatus(staffNames, regs) {
  const regKeys = new Map()
  ;(regs || []).forEach(r => { const k = lineNameKey(r?.name); if (k && !regKeys.has(k)) regKeys.set(k, String(r.name).trim()) })
  const staff = [...new Set((staffNames || []).map(n => String(n || '').trim()).filter(Boolean))]
  const staffKeys = new Set(staff.map(lineNameKey))
  return {
    registered: staff.filter(n => regKeys.has(lineNameKey(n))),
    missing: staff.filter(n => !regKeys.has(lineNameKey(n))),
    unknown: [...regKeys.entries()].filter(([k]) => !staffKeys.has(k)).map(([, n]) => n),
  }
}
