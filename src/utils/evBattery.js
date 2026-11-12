// (v1.0.1105) ผลตรวจสุขภาพแบตรถ EV จากที่บันทึกจริง (ev_battery_checks) — แทนรายการรถสมมติเดิม
export function batStatus(health) {
  const h = Number(health)
  if (!isFinite(h)) return 'unknown'
  return h >= 95 ? 'excellent' : h >= 88 ? 'good' : h >= 80 ? 'fair' : 'warning'
}
const key = r => String(r.vin || r.plate || '').replace(/[\s-]/g, '').toUpperCase()
/** ผลตรวจล่าสุดของรถแต่ละคัน (จับคู่ด้วย VIN หรือทะเบียน) เรียงคันที่แบตต่ำสุดขึ้นก่อน */
export function latestBatteries(checks = []) {
  const by = new Map()
  for (const r of checks) {
    if (!r || r.deleted || !key(r)) continue
    const k = key(r), cur = by.get(k)
    if (!cur || String(r.checkDate || '') > String(cur.checkDate || '')) by.set(k, r)
  }
  return [...by.values()].map(r => ({ ...r, health: Number(r.health) || 0, cycles: Number(r.cycles) || 0, status: batStatus(r.health) }))
    .sort((a, b) => a.health - b.health)
}
