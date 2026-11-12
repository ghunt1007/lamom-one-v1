// (v1.0.1098) ค่าใช้จ่ายดำเนินงานจริงที่เบิกผ่านระบบ: เบิกพนักงาน (อนุมัติ/จ่ายแล้ว) + เงินสดย่อยจ่ายออก (อนุมัติแล้ว)
// ใช้ร่วมกันระหว่างหน้า P&L และ LAMI · ไม่รวมเงินเดือน (ยังไม่มีแหล่งข้อมูลรายเดือนที่รวมได้ตรงๆ)
export const OPEX_LABELS = {
  fuel: '⛽ น้ำมัน', meals: '🍽 ค่าอาหาร', transport: '🚌 ค่าเดินทาง', phone: '📱 ค่าโทรศัพท์', accom: '🏨 ที่พัก',
  marketing: '📣 ค่าการตลาด', office: '🖊 เครื่องเขียน', supplies: '📎 ของใช้สำนักงาน', refresh: '☕ รับรองลูกค้า',
  postage: '📮 ไปรษณีย์/เอกสาร', repair: '🔨 ซ่อมเล็กน้อย', other: '📋 อื่นๆ',
}
// คืน [{ month: 'YYYY-MM', cat, label, amt }]
export function opexEntries(claims = [], petty = []) {
  const out = []
  const add = (d, cat, amt) => { const month = String(d || '').slice(0, 7); if (month) out.push({ month, cat, label: OPEX_LABELS[cat] || OPEX_LABELS.other, amt: Number(amt) || 0 }) }
  claims.filter(c => c && !c.deleted && (c.status === 'approved' || c.status === 'paid')).forEach(c => add(c.date, c.cat, c.amount))
  petty.filter(p => p && !p.deleted && p.type === 'out' && p.status === 'approved').forEach(p => add(p.time, p.cat, p.amount))
  return out
}
