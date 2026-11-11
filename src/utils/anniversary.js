// วันครบรอบซื้อรถ "รอบถัดไป" จากวันส่งมอบ — ใช้ในหน้าอวยพร
// คืน { date:'YYYY-MM-DD', years } หรือ null ถ้าวันที่ใช้ไม่ได้
// รอบของปีนี้ที่ผ่านไปแล้วจะเลื่อนไปปีหน้า และไม่นับ "ครบ 0 ปี" (รถที่เพิ่งส่งมอบ)
export function nextAnniversary(deliveryDate, todayIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(deliveryDate || ''))
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(todayIso || ''))
  if (!m || !t) return null
  const y0 = +m[1], ty = +t[1]
  if (y0 > ty) return null
  // 29 ก.พ. ในปีที่ไม่ใช่อธิกสุรทิน → ใช้ 28 ก.พ.
  const dayIn = y => (m[2] === '02' && m[3] === '29' && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) ? '02-28' : `${m[2]}-${m[3]}`
  let y = ty
  if (`${y}-${dayIn(y)}` < t[0]) y += 1
  if (y - y0 < 1) y = y0 + 1
  return { date: `${y}-${dayIn(y)}`, years: y - y0 }
}
