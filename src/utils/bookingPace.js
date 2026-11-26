// (v1.0.1400) คาดยอดจองสิ้นเดือนให้ฉลาดกว่าเส้นตรง — เดิมทุกที่คิด "จองแล้ว ÷ วันที่ผ่านไป × วันทั้งเดือน"
// ซึ่งพลาดเมื่อร้านจองหนักช่วงต้น/ปลายเดือน (เช่น งานมอเตอร์โชว์ โปรปลายเดือน)
// วิธีใหม่: ดู 6 เดือนก่อนว่า "ถึงวันที่เท่านี้ของเดือน" จองได้กี่ % ของทั้งเดือน (ปรับตามจำนวนวันในเดือน)
// แล้วคาดสิ้นเดือน = จองแล้ว ÷ % นั้น · ช่วงแย่–ดี จากเดือนที่ช้าสุด/เร็วสุด · ประวัติไม่พอ (<3 เดือนที่มี ≥3 ใบ) ใช้เส้นตรงเหมือนเดิม
const dim = ym => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()
const prevYm = ym => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }

// dates = วันที่จอง 'YYYY-MM-DD' (ทุกใบที่ต้องการนับ) · today = 'YYYY-MM-DD' (เวลาไทย)
export function bookingPace(dates = [], today = '', { months = 6, minPerMonth = 3, minMonths = 3 } = {}) {
  const ym = String(today).slice(0, 7), day = +String(today).slice(8, 10)
  if (!/^\d{4}-\d{2}$/.test(ym) || !day) return null
  const D = dim(ym), frac = Math.min(1, day / D)
  const byMonth = {}
  for (const d of dates) { const s = String(d || '').slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) (byMonth[s.slice(0, 7)] ||= []).push(+s.slice(8, 10)) }
  const soFar = (byMonth[ym] || []).filter(n => n <= day).length
  const linear = Math.round(soFar / frac)
  const hist = []
  let m = ym
  for (let i = 0; i < months; i++) {
    m = prevYm(m)
    const days = byMonth[m] || []
    if (days.length < minPerMonth) continue
    const cut = Math.round(frac * dim(m))
    hist.push({ ym: m, total: days.length, early: days.filter(n => n <= cut).length })
  }
  const base = { ym, day, daysInMonth: D, soFar, linear, months: hist.length }
  if (day >= D) return { ...base, method: 'done', expected: soFar, low: soFar, high: soFar, share: 1 }
  if (hist.length < minMonths) return { ...base, method: 'linear', expected: linear, low: linear, high: linear, share: frac }
  const sumE = hist.reduce((a, h) => a + h.early, 0), sumT = hist.reduce((a, h) => a + h.total, 0)
  const share = sumE / sumT
  const shares = hist.map(h => h.early / h.total)
  // ยังไม่มีใบจองเลยเดือนนี้ หรือเดือนก่อนๆ ช่วงนี้แทบไม่มีใบ → หารไม่ได้ ใช้ค่าเฉลี่ยส่วนที่เหลือของเดือนก่อนๆ แทน
  const restAvg = (sumT - sumE) / hist.length
  const proj = s => s > 0.05 ? soFar / s : soFar + restAvg
  const expected = Math.max(soFar, Math.round(proj(share)))
  const low = Math.max(soFar, Math.round(proj(Math.max(...shares))))
  const high = Math.max(expected, Math.round(proj(Math.min(...shares))))
  return { ...base, method: 'history', expected, low: Math.min(low, expected), high, share }
}

// ข้อความสั้นอธิบายที่มา — ใช้ใต้ตัวเลขบนการ์ด/คำตอบ LAMI
export function paceNote(p) {
  if (!p) return ''
  if (p.method === 'history') return `เดือนก่อนๆ ถึงวันที่ ${p.day} จองได้ราว ${Math.round(p.share * 100)}% ของทั้งเดือน (ดู ${p.months} เดือน)`
  if (p.method === 'linear') return 'คิดจากจังหวะเฉลี่ยต่อวัน (ประวัติยังไม่พอ)'
  return ''
}
