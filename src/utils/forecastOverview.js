// (v1.0.1434) LAMI "คาดการณ์เดือนนี้" — รวมทุกการคาดการณ์ไว้คำตอบเดียว (ตัวเลขเดียวกับแต่ละหน้า)
// ส่งมอบ · ยอดจอง · ลูกค้าใหม่ · รายได้ · รถเข้าศูนย์เดือนหน้า — ตัวไหนประวัติไม่พอ ข้ามไป ไม่เดา · ฟังก์ชันล้วน
import { bookingPace } from './bookingPace.js'
import { isCancelled } from './bookingStatus.js'
import { incomeForecast } from './incomeForecast.js'
import { serviceForecast } from './serviceForecast.js'
import { toDate } from './format.js'

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const ymThai = ym => TH_M[Number(ym.slice(5, 7)) - 1] + ' ' + (Number(ym.slice(0, 4)) + 543)
const baht = v => '฿' + Math.round(v).toLocaleString('en-US')
const range = (lo, hi) => hi > lo ? ` (${lo}–${hi})` : ''
const bkkDate = v => { const d = toDate(v); return d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d) : '' }

// หัวข้อ "จะเป็นยังไง" ทั้งเดือน — เฉพาะเมื่อยังเหลือ ≥ 2 วัน (วันท้ายเดือนตัวเลขจริงคือคำตอบแล้ว)
// money = false → ไม่แสดงตัวเลขเงิน (เซลส์ที่ไม่ได้เห็นทั้งร้าน)
export function forecastOverview({ fc = null, bookings = [], customers = [], reminders = [], jobs = [], today, money = true } = {}) {
  const ym = String(today || '').slice(0, 7)
  const out = []
  if (fc) out.push(`🚚 ส่งมอบ: แล้ว ${fc.delivered} คัน → คาด ≈ ${fc.expected} คัน${range(fc.worst, fc.best)}${fc.target ? ` · เป้า ${fc.target} (${fc.targetPct}%)` : ''}`)
  const live = (bookings || []).filter(b => b && !b.deleted)
  const bp = bookingPace(live.filter(b => !isCancelled(b)).map(b => String(b.bookingDate || '').slice(0, 10)), today)
  if (bp?.method === 'history' && bp.daysInMonth - bp.day >= 2) {
    const e = Math.max(bp.soFar, bp.expected)
    out.push(`📝 ยอดจอง: แล้ว ${bp.soFar} ใบ → คาด ≈ ${e} ใบ${range(Math.max(bp.soFar, Math.min(e, bp.low)), Math.max(e, bp.high))}`)
  }
  const cd = (customers || []).filter(c => c && !c.deleted).map(c => bkkDate(c.createdAt))
  const lp = bookingPace(cd, today)
  if (lp?.method === 'history' && lp.daysInMonth - lp.day >= 2) {
    const e = Math.max(lp.soFar, lp.expected)
    out.push(`🧲 ลูกค้าใหม่: แล้ว ${lp.soFar} ราย → คาด ≈ ${e} ราย${range(Math.max(lp.soFar, lp.low), Math.max(e, lp.high))}`)
  }
  const inc = money ? incomeForecast({ bookings: live, today, fc }) : null
  if (inc) out.push(`💰 รายได้: แล้ว ${baht(inc.soFar)} → คาด ≈ ${baht(inc.expected)} (${baht(inc.low)}–${baht(inc.high)})`)
  const sv = serviceForecast({ reminders, jobs, today })
  if (sv) out.push(`🔧 รถเข้าศูนย์เดือนหน้า (${ymThai(sv.next)}) ≈ ${sv.expected} คัน${money && sv.revenue != null ? ` · รายได้ ≈ ${baht(sv.revenue)}` : ''}`)
  if (!out.length) return { n: 0, text: '🔮 ยังคาดการณ์ไม่ได้ — ต้องมีข้อมูลย้อนหลังอย่างน้อย 3 เดือน (ใบจอง/ลูกค้า) ก่อน LAMI ถึงจะคาดได้แม่น' }
  return { n: out.length, text: [`🔮 คาดการณ์เดือนนี้ ${ymThai(ym)} — ภาพรวม`, ...out,
    '💡 ถามต่อแยกเรื่องได้ เช่น "เดือนนี้จะส่งมอบได้กี่คัน" · "ค่าคอมเดือนนี้เท่าไหร่"'].join('\n') }
}

// "คาดการณ์เดือนนี้" / "สรุปคาดการณ์" / "สิ้นเดือนจะเป็นยังไง" (ไม่ระบุเรื่อง — ถ้าระบุเรื่องจะไปคำตอบเฉพาะเรื่อง)
export function isOverviewForecastQuestion(q) {
  const s = String(q || '').trim()
  if (!s || s.length > 50) return false
  if (/คัน|ใบ|ส่งมอบ|จอง|รายได้|ค่าคอม|ศูนย์|ซ่อม|เช็คระยะ|ลูกค้าใหม่|ลีด|lead|สั่งรถ|สต็อก|สต๊อก|เดือนหน้า|ปีหน้า|ใคร|รุ่น|สี/i.test(s)) return false
  return /คาดการณ์|พยากรณ์|forecast|สิ้นเดือน.{0,10}(?:เป็นยังไง|เป็นไง|จะได้|เท่าไหร่|เท่าไร)|เดือนนี้.{0,6}จะ(?:ได้|เป็น)/i.test(s)
}
