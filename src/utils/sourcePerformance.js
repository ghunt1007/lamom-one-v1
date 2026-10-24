// ผลลัพธ์จริงของแต่ละช่องทาง Lead — นับจากลูกค้าจริงในระบบ (ไม่ใช่ตัวเลขที่กรอกเองในแคมเปญ)
// กลุ่ม = ลูกค้าที่ "เข้ามา" ในช่วงที่เลือก (createdAt ตามเวลาไทย) แยกตาม source แล้วดูว่าไปถึงไหน:
// จอง (stage booking/delivered หรือมีใบจอง), ส่งมอบ (stage delivered หรือใบจองของเขาส่งมอบแล้ว), เสียดีล (isLost)
// รายได้ = totalIncome ในใบจองของลูกค้ากลุ่มนี้ (ผูกด้วย customerId) — ใช้งบจากแคมเปญ (lead_gen_campaigns) ถ้ามี
import { bangkokDate } from './myDay.js'
import { DELIVERED_STATUSES } from './deliveryIncome.js'

export const SOURCE_INFO = {
  facebook: ['📘', 'Facebook'], line: ['💚', 'LINE'], tiktok: ['🎵', 'TikTok'], 'walk-in': ['🚶', 'Walk-in'],
  referral: ['🤝', 'แนะนำ'], google: ['🔍', 'Google'], website: ['🌐', 'เว็บไซต์'], phone: ['📱', 'โทรเข้า'], other: ['📌', 'อื่นๆ'],
}
// ช่องทางในหน้าแคมเปญ (LeadSources.js CHANNEL_MAP) → source ของลูกค้า
const CAMPAIGN_CHANNEL = { facebook: 'facebook', google: 'google', line: 'line', referral: 'referral', walkin: 'walk-in', organic: 'website', event: 'other' }

export const normSource = s => {
  const k = String(s || '').trim().toLowerCase()
  if (!k) return 'other'
  if (SOURCE_INFO[k]) return k
  if (k === 'walkin' || k === 'walk in') return 'walk-in'
  return k
}

// period: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } (รวมปลายทั้งสองฝั่ง) — from/to ว่าง = ไม่จำกัด
export function inPeriod(date, { from = '', to = '' } = {}) {
  if (!date) return false
  return (!from || date >= from) && (!to || date <= to)
}

export function summarizeSources({ customers = [], bookings = [], campaigns = [] }, period = {}) {
  const rows = {}
  const row = k => (rows[k] ||= { source: k, leads: 0, booked: 0, delivered: 0, lost: 0, open: 0, income: 0, spent: 0, daysToBook: [] })
  const bookingsByCustomer = new Map()
  ;(bookings || []).filter(b => b && !b.deleted && b.customerId).forEach(b => {
    if (!bookingsByCustomer.has(b.customerId)) bookingsByCustomer.set(b.customerId, [])
    bookingsByCustomer.get(b.customerId).push(b)
  })

  ;(customers || []).filter(c => c && !c.deleted).forEach(c => {
    const created = bangkokDate(c.createdAt)
    if (!inPeriod(created, period)) return
    const r = row(normSource(c.source))
    const bks = (bookingsByCustomer.get(c.id) || []).filter(b => !['ถอนจอง', 'ยกเลิก'].includes(b.status))
    const delivered = c.stage === 'delivered' || bks.some(b => DELIVERED_STATUSES.includes(b.status))
    const booked = delivered || c.stage === 'booking' || !!c.bookingId || bks.length > 0
    r.leads++
    if (booked) r.booked++
    if (delivered) r.delivered++
    if (c.isLost && !booked) r.lost++
    if (!booked && !c.isLost) r.open++
    r.income += bks.reduce((s, b) => s + (Number(b.totalIncome) || 0), 0)
    if (booked) {
      const firstBook = bks.map(b => (b.bookingDate || '').slice(0, 10)).filter(Boolean).sort()[0]
      if (firstBook && created && firstBook >= created) {
        const [y1, m1, d1] = created.split('-').map(Number), [y2, m2, d2] = firstBook.split('-').map(Number)
        r.daysToBook.push(Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000))
      }
    }
  })

  ;(campaigns || []).filter(c => c && !c.deleted).forEach(c => {
    const start = String(c.startDate || '').slice(0, 10)
    if (period.from || period.to) { if (!inPeriod(start, period)) return }
    const k = CAMPAIGN_CHANNEL[c.channel] || normSource(c.channel)
    row(k).spent += Number(c.spent) || 0
  })

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
  const list = Object.values(rows).map(r => ({
    ...r,
    icon: SOURCE_INFO[r.source]?.[0] || '📌',
    label: SOURCE_INFO[r.source]?.[1] || r.source,
    bookRate: pct(r.booked, r.leads),
    deliverRate: pct(r.delivered, r.leads),
    avgDaysToBook: r.daysToBook.length ? Math.round(r.daysToBook.reduce((s, x) => s + x, 0) / r.daysToBook.length) : null,
    costPerLead: r.spent && r.leads ? Math.round(r.spent / r.leads) : null,
    costPerSale: r.spent && r.delivered ? Math.round(r.spent / r.delivered) : null,
  })).sort((a, b) => b.leads - a.leads || b.delivered - a.delivered)

  const total = list.reduce((t, r) => {
    ;['leads', 'booked', 'delivered', 'lost', 'open', 'income', 'spent'].forEach(k => { t[k] += r[k] })
    return t
  }, { leads: 0, booked: 0, delivered: 0, lost: 0, open: 0, income: 0, spent: 0 })
  total.bookRate = pct(total.booked, total.leads)
  // ช่องทางที่ปิดการขายเก่งที่สุด (ต้องมีอย่างน้อย 5 ราย กันช่องทางที่มี 1 คนแล้วจอง 100% ขึ้นอันดับ)
  const best = list.filter(r => r.leads >= 5).sort((a, b) => b.bookRate - a.bookRate || b.leads - a.leads)[0] || null
  return { rows: list, total, best }
}

// ช่วงเวลาที่เลือกได้ในหน้าเพจ — today = 'YYYY-MM-DD' ตามเวลาไทย
export function periodRange(key, today) {
  const [y, m] = today.split('-').map(Number)
  const ym = (yy, mm) => { const d = new Date(Date.UTC(yy, mm - 1, 1)); return d.toISOString().slice(0, 7) }
  if (key === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
  if (key === 'last-month') {
    const lm = ym(y, m - 1)
    const end = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)
    return { from: `${lm}-01`, to: end }
  }
  if (key === '3m') return { from: `${ym(y, m - 2)}-01`, to: today }
  if (key === 'year') return { from: `${y}-01-01`, to: today }
  return {}
}
