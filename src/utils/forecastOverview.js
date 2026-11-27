// (v1.0.1434) LAMI "คาดการณ์เดือนนี้" — รวมทุกการคาดการณ์ไว้คำตอบเดียว (ตัวเลขเดียวกับแต่ละหน้า)
// ส่งมอบ · ยอดจอง · ลูกค้าใหม่ · รายได้ · รถเข้าศูนย์เดือนหน้า — ตัวไหนประวัติไม่พอ ข้ามไป ไม่เดา · ฟังก์ชันล้วน
import { bookingPace } from './bookingPace.js'
import { isCancelled } from './bookingStatus.js'
import { incomeForecast } from './incomeForecast.js'
import { serviceForecast } from './serviceForecast.js'
import { toDate } from './format.js'
import { testDriveConversion } from './testDriveConversion.js'
import { bestCallTimes } from './callTimes.js'
import { sourceConversion } from './leadScore.js'
import { jobTurnaround } from './jobTurnaround.js'

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export const ymThai = ym => TH_M[Number(ym.slice(5, 7)) - 1] + ' ' + (Number(ym.slice(0, 4)) + 543)
export const baht = v => '฿' + Math.round(v).toLocaleString('en-US')
const range = (lo, hi) => hi > lo ? ` (${lo}–${hi})` : ''
const bkkDate = v => { const d = toDate(v); return d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d) : '' }

// (v1.0.1439) การ์ดคาดการณ์แต่ละเรื่อง — ใช้ทั้งหน้า /analytics/forecast และคำตอบ LAMI (ตัวเลขชุดเดียวกัน)
// คืนทุกเรื่องเสมอ: ok=false พร้อม why = ทำไมยังคาดไม่ได้ (หน้าแสดงเป็นการ์ดจาง · LAMI ข้าม)
// money = false → ไม่คำนวณตัวเลขเงิน (เซลส์ที่ไม่ได้เห็นทั้งร้าน)
export function forecastCards({ fc = null, next = null, bookings = [], customers = [], reminders = [], jobs = [], today, money = true } = {}) {
  const cards = []
  const add = c => cards.push({ ok: true, ...c })
  const no = (key, icon, title, why, path) => cards.push({ key, icon, title, ok: false, why, path })
  if (fc) add({ key: 'delivery', icon: '🚚', title: 'ส่งมอบเดือนนี้', value: fc.expected, unit: 'คัน', lo: fc.worst, hi: fc.best, soFar: fc.delivered, soFarText: `ส่งมอบแล้ว ${fc.delivered} คัน`, target: fc.target || null,
    note: fc.target ? `เป้า ${fc.target} คัน → คาด ${fc.targetPct}%` : 'ยังไม่ได้ตั้งเป้าส่งมอบ', path: '/analytics/delivery-forecast',
    line: `🚚 ส่งมอบ: แล้ว ${fc.delivered} คัน → คาด ≈ ${fc.expected} คัน${range(fc.worst, fc.best)}${fc.target ? ` · เป้า ${fc.target} (${fc.targetPct}%)` : ''}` })
  else no('delivery', '🚚', 'ส่งมอบเดือนนี้', 'อ่านใบจองไม่ได้', '/analytics/delivery-forecast')
  const live = (bookings || []).filter(b => b && !b.deleted)
  const bp = bookingPace(live.filter(b => !isCancelled(b)).map(b => String(b.bookingDate || '').slice(0, 10)), today)
  if (bp?.method === 'history' && bp.daysInMonth - bp.day >= 2) {
    const e = Math.max(bp.soFar, bp.expected), lo = Math.max(bp.soFar, Math.min(e, bp.low)), hi = Math.max(e, bp.high)
    add({ key: 'booking', icon: '📝', title: 'ยอดจองเดือนนี้', value: e, unit: 'ใบ', lo, hi, soFar: bp.soFar, soFarText: `จองแล้ว ${bp.soFar} ใบ`, note: `เดือนก่อนๆ ถึงวันนี้จองได้ราว ${Math.round(bp.share * 100)}% ของทั้งเดือน`, path: '/crm/bookings',
      line: `📝 ยอดจอง: แล้ว ${bp.soFar} ใบ → คาด ≈ ${e} ใบ${range(lo, hi)}` })
  } else no('booking', '📝', 'ยอดจองเดือนนี้', bp?.method === 'done' || (bp && bp.daysInMonth - bp.day < 2) ? 'สิ้นเดือนแล้ว — ดูยอดจริงได้เลย' : 'ต้องมีใบจองย้อนหลังอย่างน้อย 3 เดือน (เดือนละ ≥ 3 ใบ)', '/crm/bookings')
  const lp = bookingPace((customers || []).filter(c => c && !c.deleted).map(c => bkkDate(c.createdAt)), today)
  if (lp?.method === 'history' && lp.daysInMonth - lp.day >= 2) {
    const e = Math.max(lp.soFar, lp.expected), lo = Math.max(lp.soFar, lp.low), hi = Math.max(e, lp.high)
    add({ key: 'lead', icon: '🧲', title: 'ลูกค้าใหม่เดือนนี้', value: e, unit: 'ราย', lo, hi, soFar: lp.soFar, soFarText: `เข้ามาแล้ว ${lp.soFar} ราย`, note: `เดือนก่อนๆ ถึงวันนี้ได้ราว ${Math.round(lp.share * 100)}% ของทั้งเดือน`, path: '/crm/customers',
      line: `🧲 ลูกค้าใหม่: แล้ว ${lp.soFar} ราย → คาด ≈ ${e} ราย${range(lo, hi)}` })
  } else no('lead', '🧲', 'ลูกค้าใหม่เดือนนี้', 'ต้องมีลูกค้าย้อนหลังอย่างน้อย 3 เดือน', '/crm/customers')
  if (money) {
    const inc = incomeForecast({ bookings: live, today, fc })
    if (inc) add({ key: 'income', icon: '💰', title: 'รายได้เดือนนี้', value: inc.expected, unit: '', money: true, lo: inc.low, hi: inc.high, soFar: inc.soFar, soFarText: `ได้แล้ว ${baht(inc.soFar)}`, note: `คอมเซลส์ ≈ ${baht(inc.com70)}`, path: '/crm/sales-income',
      line: `💰 รายได้: แล้ว ${baht(inc.soFar)} → คาด ≈ ${baht(inc.expected)} (${baht(inc.low)}–${baht(inc.high)})` })
    else no('income', '💰', 'รายได้เดือนนี้', 'ต้องมีรายได้ที่กรอกแล้วอย่างน้อย 3 คันใน 3 เดือนก่อน', '/crm/sales-income')
  }
  if (next && next.count) add({ key: 'next', icon: '📅', title: `ส่งมอบเดือนหน้า (${ymThai(next.ym)})`, value: next.expected, unit: 'คัน', lo: next.worst, hi: next.best, note: `จากใบจองค้าง ${next.count} ใบที่น่าจะไปส่งเดือนหน้า`, path: '/analytics/delivery-forecast',
    line: `📅 ส่งมอบเดือนหน้า (${ymThai(next.ym)}) ≈ ${next.expected} คัน${range(next.worst, next.best)}` })
  const sv = serviceForecast({ reminders, jobs, today })
  if (sv) add({ key: 'service', icon: '🔧', title: `รถเข้าศูนย์เดือนหน้า (${ymThai(sv.next)})`, value: sv.expected, unit: 'คัน', note: `ครบกำหนด ${sv.due} คัน × นัดได้จริง ${Math.round(sv.rate * 100)}%${money && sv.revenue != null ? ` · รายได้ ≈ ${baht(sv.revenue)}` : ''}`, path: '/analytics/service',
    line: `🔧 รถเข้าศูนย์เดือนหน้า (${ymThai(sv.next)}) ≈ ${sv.expected} คัน${money && sv.revenue != null ? ` · รายได้ ≈ ${baht(sv.revenue)}` : ''}` })
  else no('service', '🔧', 'รถเข้าศูนย์เดือนหน้า', 'ต้องมีประวัติเตือนเช็คระยะอย่างน้อย 10 รายการใน 6 เดือน', '/analytics/service')
  return cards
}

// หัวข้อ "จะเป็นยังไง" ทั้งเดือน — เฉพาะเมื่อยังเหลือ ≥ 2 วัน (วันท้ายเดือนตัวเลขจริงคือคำตอบแล้ว)
export function forecastOverview(opts = {}) {
  const ym = String(opts.today || '').slice(0, 7)
  const out = forecastCards(opts).filter(c => c.ok).map(c => c.line)
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

// (v1.0.1441) การ์ด "ข้อมูลจริงที่ช่วยปิดการขาย" — แสดงในศูนย์คาดการณ์ใต้การ์ดคาดการณ์ (ไม่มีชื่อลูกค้า)
// ทุกตัวคำนวณจากข้อมูลร้าน ข้อมูลไม่พอ = ok:false พร้อมเหตุผล
export function insightCards({ testDrives = [], bookings = [], customers = [], logs = [], jobs = [], today, now = Date.now(), tdConv = testDriveConversion, callTimes = bestCallTimes, sourceConv = sourceConversion, turnaround = jobTurnaround } = {}) {
  const cards = []
  const td = tdConv({ testDrives, bookings, customers, today })
  if (td?.rate != null) cards.push({ ok: true, key: 'tdconv', icon: '🚗', title: 'ทดลองขับแล้วจองจริง', display: Math.round(td.rate * 100) + '%', note: `${td.booked} จาก ${td.n} ครั้ง (จองภายใน 45 วัน)${td.chase.length ? ` · ขับแล้วยังไม่จอง ${td.chase.length} ราย ควรโทรตาม` : ''}`, path: '/crm/testdrive' })
  else cards.push({ ok: false, key: 'tdconv', icon: '🚗', title: 'ทดลองขับแล้วจองจริง', why: 'ต้องมีทดลองขับที่เสร็จแล้ว ≥ 10 ครั้ง ที่ขับมานานกว่า 45 วัน', path: '/crm/testdrive' })
  const ct = callTimes(logs, { now })
  if (ct) cards.push({ ok: true, key: 'calltime', icon: '⏰', title: 'โทรช่วงไหนลูกค้ารับสาย', display: `${String(ct.best.from).padStart(2, '0')}–${String(ct.best.to).padStart(2, '0')} น.`, note: `รับสาย ${Math.round(ct.best.rate * 100)}% · น้อยสุด ${String(ct.worst.from).padStart(2, '0')}–${String(ct.worst.to).padStart(2, '0')} น. (${Math.round(ct.worst.rate * 100)}%) · จาก ${ct.total} สาย`, path: '/crm/my-day' })
  else cards.push({ ok: false, key: 'calltime', icon: '⏰', title: 'โทรช่วงไหนลูกค้ารับสาย', why: 'ต้องมีผลการโทรผ่านปุ่ม 📞 ≥ 40 สายใน 90 วัน', path: '/crm/my-day' })
  const sc = sourceConv(customers, now)
  const best = sc ? [...sc.bySource.values()].sort((a, b) => b.rate - a.rate || b.n - a.n)[0] : null
  if (best) cards.push({ ok: true, key: 'source', icon: '📣', title: 'ช่องทางที่ปิดได้ดีสุด', display: best.label, note: `ปิดได้ ${Math.round(best.rate * 100)}% (ร้านเฉลี่ย ${Math.round(sc.overall * 100)}% · จาก ${best.n} ราย)`, path: '/ai/lead-scoring' })
  else cards.push({ ok: false, key: 'source', icon: '📣', title: 'ช่องทางที่ปิดได้ดีสุด', why: 'ต้องมีลูกค้าอายุ 30 วัน–1 ปี ≥ 30 ราย และช่องทางละ ≥ 15 ราย', path: '/ai/lead-scoring' })
  const ta = turnaround(jobs, today)
  if (ta) cards.push({ ok: true, key: 'turnaround', icon: '⏱️', title: 'งานซ่อมปกติเสร็จใน', display: ta.median < 1 ? `${Math.max(1, Math.round(ta.median * 24))} ชม.` : `${Math.round(ta.median * 10) / 10} วัน`, note: `80% เสร็จภายใน ${Math.round(ta.p80 * 10) / 10} วัน · จาก ${ta.n} งานใน 90 วัน`, path: '/service/jobs' })
  else cards.push({ ok: false, key: 'turnaround', icon: '⏱️', title: 'งานซ่อมปกติเสร็จใน', why: 'เริ่มนับจากงานที่กดเสร็จตั้งแต่ 28/11/2569 — ต้องมี ≥ 5 งานใน 90 วัน', path: '/service/jobs' })
  return cards
}
