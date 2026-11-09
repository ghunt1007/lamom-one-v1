// (v1.0.973) ตัวชี้วัดการขายครบชุด — Target/Quota · Forecast · GP · GMV · RevShare · KPI · Pipeline · Conversion ·
// AOV · Sales Cycle · B2B/B2C/B2G · Cross-sell · Up-sell · CRM · Lead · Prospect · Churn · LTV
// ฟังก์ชันล้วน (pure) คำนวณจากใบจอง/ลูกค้า/ทดลองขับ/ใบเสนอราคา/งานซ่อมจริง หน้า /analytics/sales-metrics เป็นคนดึงข้อมูลมาให้
// ทุกตัวคืน null เมื่อไม่มีข้อมูลพอ (หน้าแสดง "—" ไม่ใช่เลขสมมติ)
import { ymdBangkok } from './format.js'
import { saleCost, isCostEstimated } from './saleCost.js'
import { heuristicScore } from './leadScore.js'
// เทียบชื่อแบบเดียวกับ core/hierarchy.js normName (ตัดคำนำหน้า/ช่องว่าง) — เขียนซ้ำที่นี่ให้ไฟล์นี้ไม่ต้องโหลด firebase
const NAME_PREFIX = /^(นางสาว|นาง|นาย|น\.ส\.|คุณ|mrs\.?|mr\.?|ms\.?|miss)\s*/i
export const normName = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(NAME_PREFIX, '').trim()

export const CANCELLED = ['ถอนจอง', 'ยกเลิก']
export const DELIVERED = ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ']
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const DAY = 864e5
const t = ymd => Date.parse(ymd + 'T00:00:00Z')

// ── ช่วงเวลา ──
export function periodRange(kind, today) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7)
  const pad = n => String(n).padStart(2, '0')
  const last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate()
  if (kind === 'prev') { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last(py, pm))}`, months: [pm], year: py } }
  if (kind === 'year') return { from: `${y}-01-01`, to: today, months: Array.from({ length: m }, (_, i) => i + 1), year: y }
  if (kind === 'quarter') { const q0 = Math.floor((m - 1) / 3) * 3 + 1; return { from: `${y}-${pad(q0)}-01`, to: today, months: [q0, q0 + 1, q0 + 2].filter(x => x <= m), fullMonths: [q0, q0 + 1, q0 + 2], year: y } }
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last(y, m))}`, months: [m], year: y, isCurrentMonth: true }
}

// (v1.0.989) ช่วงเทียบที่ยุติธรรม — เดือนนี้: วันที่ 1..วันนี้ของเดือนก่อน (ช่วงเท่ากัน) · เดือนก่อน: ทั้งเดือนก่อนหน้านั้น
// ไตรมาส/ปี: ช่วงเดียวกันของปีก่อน · คืน null ถ้าไม่รู้จัก
export function compareRange(kind, today) {
  const pad = n => String(n).padStart(2, '0')
  const last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate()
  const y = +today.slice(0, 4), m = +today.slice(5, 7), d = +today.slice(8, 10)
  const back = (yy, mm) => (mm === 1 ? [yy - 1, 12] : [yy, mm - 1])
  if (kind === 'month') { const [py, pm] = back(y, m); return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(Math.min(d, last(py, pm)))}`, months: [pm], year: py, label: `1–${Math.min(d, last(py, pm))} เดือนก่อน` } }
  if (kind === 'prev') { const [py, pm] = back(...back(y, m)); return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last(py, pm))}`, months: [pm], year: py, label: 'เดือนก่อนหน้านั้น' } }
  if (kind === 'quarter' || kind === 'year') { const r = periodRange(kind, today); const shift = s => `${+s.slice(0, 4) - 1}${s.slice(4)}`; const to = r.to.slice(5) === '02-29' ? `${y - 1}-02-28` : shift(r.to); return { from: shift(r.from), to, months: r.months, year: y - 1, label: 'ช่วงเดียวกันปีก่อน' } }
  return null
}

// % เปลี่ยนแปลง · ฐานเป็น 0/ไม่มี → null (ไม่แสดง ไม่เดา)
export function pctChange(cur, prev) {
  if (cur == null || prev == null || !prev) return null
  return Math.round((cur - prev) / Math.abs(prev) * 100)
}

export const bookingDay = b => ymdBangkok(b.bookingDate) || ymdBangkok(b.createdAt)
export const deliveryDay = b => (DELIVERED.includes(b.status) ? ymdBangkok(b.actualDeliveryDate) || ymdBangkok(b.cutDate) || ymdBangkok(b.deliveryDate) : '')
const inRange = (d, r) => !!d && d >= r.from && d <= r.to
const live = arr => (arr || []).filter(x => x && !x.deleted)

// ── B2B / B2C / B2G จากชื่อผู้ซื้อ (ใบจองไม่มีช่องประเภทลูกค้า) ──
const GOV = /(กรม|กระทรวง|สำนักงาน|องค์การบริหาร|อบต\.?|อบจ\.?|เทศบาล|ราชการ|ศาล|ตำรวจ|กองทัพ|โรงพยาบาลรัฐ|มหาวิทยาลัย(?!เอกชน)|การไฟฟ้า|การประปา|รัฐวิสาหกิจ)/
const BIZ = /(บริษัท|บจก\.?|หจก\.?|ห้างหุ้นส่วน|จำกัด|co\.?,?\s*ltd|company|corp|limited|มหาชน|ร้าน|โรงแรม|คลินิก|สหกรณ์|มูลนิธิ)/i
export function buyerType(b) {
  const explicit = String(b.customerType || b.buyerType || '').toUpperCase()
  if (['B2B', 'B2C', 'B2G'].includes(explicit)) return explicit
  const name = [b.custName, b.companyName, b.firstName, b.lastName].filter(Boolean).join(' ')
  if (GOV.test(name)) return 'B2G'
  if (BIZ.test(name) || b.isCorporate || b.taxId) return 'B2B'
  return 'B2C'
}

// ── ราคาเริ่มต้นของรุ่น (สำหรับ Up-sell) ──
export function basePriceIndex(vehicles = []) {
  const idx = new Map()
  vehicles.forEach(v => {
    const k = normName(`${v.brand} ${v.model}`)
    const p = num(v.price || v.priceMin)
    if (p > 0 && (!idx.has(k) || p < idx.get(k))) idx.set(k, p)
  })
  return idx
}

// ── คำนวณทั้งหมด ──
// src = { bookings, customers, testDrives, quotations, jobCards, budget:{targets,units}, vehicles }
// opts = { today, period:'month'|'prev'|'quarter'|'year', who: ชื่อเซลส์ (normName) หรือ '' = ทุกคน }
export function computeSalesMetrics(src = {}, { today, period = 'month', who = '', range = null } = {}) {
  const r = range || periodRange(period, today)
  const mine = (n) => !who || normName(n) === who
  const bookingsAll = live(src.bookings).filter(b => mine(b.salesName))
  const customersAll = live(src.customers).filter(c => mine(c.assignedTo))
  const valid = bookingsAll.filter(b => !CANCELLED.includes(b.status))
  const booked = valid.filter(b => inRange(bookingDay(b), r))
  const delivered = valid.filter(b => inRange(deliveryDay(b), r))
  const cancelled = bookingsAll.filter(b => CANCELLED.includes(b.status) && inRange(bookingDay(b), r))
  const price = b => num(b.price)
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0)

  // Target / Quota (จากหน้าเป้ายอดขาย) — เป้าคน = ไม่มี (เป้าบริษัทเท่านั้น) จึงแสดงเมื่อดูทุกคน
  const months = r.fullMonths || r.months
  const tgtRev = !who && src.budget?.targets ? months.reduce((a, m) => a + num(src.budget.targets[m - 1]), 0) : 0
  const tgtUnits = !who && src.budget?.units ? months.reduce((a, m) => a + num(src.budget.units[m - 1]), 0) : 0
  const gmv = sum(booked, price)
  const target = {
    revenue: tgtRev || null, units: tgtUnits || null,
    revenuePct: tgtRev ? Math.round(gmv / tgtRev * 100) : null,
    unitsPct: tgtUnits ? Math.round(booked.length / tgtUnits * 100) : null,
    basis: 'booked',
  }
  // (v1.0.976) เป้ารายคน = เป้าส่งมอบจากหน้า "รายได้รายเซลส์" (sales_targets) รวมทุกเดือนในช่วง — src.personTargets = { 'ชื่อ': คัน }
  const pt = src.personTargets || {}
  const ptOf = key => Object.entries(pt).reduce((a, [n, v]) => a + (normName(n) === key ? num(v) : 0), 0)
  if (who) {
    const u = ptOf(who)
    if (u) Object.assign(target, { units: u, unitsPct: Math.round(delivered.length / u * 100), basis: 'delivered' })
  }
  // ตารางเป้า/ทำได้รายคน (ดูทั้งทีม) — นับส่งมอบเทียบเป้าส่งมอบ + จองในช่วง
  const quotaMap = new Map()
  const qRow = (name) => { const k = normName(name); if (!k) return null; if (!quotaMap.has(k)) quotaMap.set(k, { key: k, name: String(name).trim(), target: 0, delivered: 0, booked: 0 }); return quotaMap.get(k) }
  Object.entries(pt).forEach(([n, v]) => { const r = qRow(n); if (r) r.target += num(v) })
  const allValid = live(src.bookings).filter(b => !CANCELLED.includes(b.status))
  allValid.forEach(b => {
    const d = inRange(deliveryDay(b), r), k = inRange(bookingDay(b), r)
    if (!d && !k) return
    const row = qRow(b.salesName); if (!row) return
    if (d) row.delivered++
    if (k) row.booked++
  })
  const quota = [...quotaMap.values()].map(q => ({ ...q, pct: q.target ? Math.round(q.delivered / q.target * 100) : null, left: Math.max(0, q.target - q.delivered) }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.delivered - a.delivered || a.name.localeCompare(b.name, 'th'))
  // ไม่มีเป้าบริษัท แต่มีเป้ารายคน → ใช้ผลรวมเป้าส่งมอบรายคนเป็นเป้าทีม
  if (!who && !target.units && !target.revenue) {
    const sumT = quota.reduce((x, q) => x + q.target, 0)
    if (sumT) Object.assign(target, { units: sumT, unitsPct: Math.round(delivered.length / sumT * 100), basis: 'delivered' })
  }

  // Forecast — เดือนปัจจุบัน: จังหวะการจอง × จำนวนวัน + ดีลที่กำลังคุย (มูลค่า × โอกาสปิด ปรับลดครึ่งเพราะไม่ใช่ทุกดีลจะปิดในเดือน)
  let forecast = null
  if (r.isCurrentMonth) {
    const dayN = +today.slice(8, 10), dim = +r.to.slice(8, 10)
    const pace = booked.length / dayN * dim
    const open = customersAll.filter(c => ['lead', 'pp'].includes(c.stage) && !c.isLost)
    const pipeUnits = open.reduce((a, c) => a + heuristicScore(c).score / 100, 0)
    const remainShare = (dim - dayN) / dim
    const units = Math.round(Math.max(booked.length, pace * 0.7 + (booked.length + pipeUnits * remainShare * 0.5) * 0.3))
    const aov = booked.length ? gmv / booked.length : (valid.length ? sum(valid, price) / valid.length : 0)
    forecast = { units, revenue: Math.round(units * aov), pace: Math.round(pace), pipelineUnits: Math.round(pipeUnits), daysPassed: dayN, daysInMonth: dim }
  }

  // GP — ราคาขาย − ต้นทุนรถ (ต้นทุนไม่ได้กรอก ใช้ประมาณ 82%) จากรถที่ส่งมอบ/ตัดตัวเลขในช่วงนี้
  const salesRows = delivered.map(b => ({ salePrice: price(b), cost: num(b.cost) }))
  const rev = sum(salesRows, s => s.salePrice)
  const gp = rev ? rev - sum(salesRows, saleCost) : null
  const grossProfit = { value: gp, pct: rev && gp != null ? Math.round(gp / rev * 1000) / 10 : null, estimated: salesRows.filter(isCostEstimated).length, units: delivered.length, revenue: rev }

  // RevShare — ส่วนแบ่งรายได้จากพันธมิตร: คอมไฟแนนซ์ + คอมประกัน (ถ้ามี) จากรถที่ส่งมอบในช่วงนี้
  const finShare = sum(delivered, b => num(b.comFinance))
  const insShare = sum(delivered, b => num(b.comInsurance || b.insuranceCommission))
  const revShare = { finance: finShare, insurance: insShare, total: finShare + insShare, perUnit: delivered.length ? Math.round((finShare + insShare) / delivered.length) : null }

  // Pipeline — ลูกค้าในแต่ละขั้น (ตอนนี้ ไม่ขึ้นกับช่วงเวลา)
  const openCust = customersAll.filter(c => !c.isLost)
  const pipeline = {
    lead: openCust.filter(c => c.stage === 'lead').length,
    prospect: openCust.filter(c => c.stage === 'pp').length,
    booking: valid.filter(b => !DELIVERED.includes(b.status)).length,
    delivered: delivered.length,
    lost: customersAll.filter(c => c.isLost).length,
  }

  // Conversion — ลูกค้าใหม่ในช่วงนี้ที่กลายเป็นใบจองแล้ว (ใบจองผูก customerId หรือ stage จองแล้ว/ส่งมอบ)
  const newCust = customersAll.filter(c => inRange(ymdBangkok(c.createdAt), r))
  const bookedCustIds = new Set(valid.map(b => b.customerId).filter(Boolean))
  const won = newCust.filter(c => bookedCustIds.has(c.id) || ['booking', 'delivered'].includes(c.stage))
  const conversion = { leads: newCust.length, won: won.length, pct: newCust.length ? Math.round(won.length / newCust.length * 1000) / 10 : null, cancelPct: booked.length + cancelled.length ? Math.round(cancelled.length / (booked.length + cancelled.length) * 100) : null }

  // AOV — ราคาเฉลี่ยต่อใบจอง
  const aov = booked.length ? Math.round(gmv / booked.length) : null

  // Sales Cycle — วันเฉลี่ยจากวันที่ลูกค้าเข้าระบบ ถึงวันจอง (เฉพาะใบจองที่ผูกลูกค้า)
  const custById = new Map(live(src.customers).map(c => [c.id, c]))
  const cycles = booked.map(b => { const c = custById.get(b.customerId); const a = c && ymdBangkok(c.createdAt), z = bookingDay(b); return a && z && z >= a ? (t(z) - t(a)) / DAY : null }).filter(x => x != null)
  cycles.sort((a, b) => a - b)
  const salesCycle = { avg: cycles.length ? Math.round(cycles.reduce((a, x) => a + x, 0) / cycles.length) : null, median: cycles.length ? Math.round(cycles[Math.floor(cycles.length / 2)]) : null, n: cycles.length }

  // B2B / B2C / B2G
  const mix = { B2B: { n: 0, value: 0 }, B2C: { n: 0, value: 0 }, B2G: { n: 0, value: 0 } }
  booked.forEach(b => { const k = buyerType(b); mix[k].n++; mix[k].value += price(b) })

  // Cross-sell (ประกัน/อุปกรณ์เสริม/ผลิตภัณฑ์อื่นในใบจอง) · Up-sell (เลือกรุ่นย่อยแพงกว่ารุ่นเริ่มต้นของรุ่นนั้น)
  const hasCross = b => num(b.accessoryAmount) > 0 || num(b.insuranceAmount) > 0 || num(b.warrantyAmount) > 0 || (Array.isArray(b.accessories) && b.accessories.length > 0) || !!b.insuranceCo
  const cross = booked.filter(hasCross)
  const baseIdx = basePriceIndex(src.vehicles || [])
  const upChecked = booked.filter(b => price(b) > 0 && baseIdx.has(normName(`${b.brand} ${b.model}`)))
  const up = upChecked.filter(b => price(b) > baseIdx.get(normName(`${b.brand} ${b.model}`)) * 1.02)
  const crossSell = { n: cross.length, pct: booked.length ? Math.round(cross.length / booked.length * 100) : null, value: sum(cross, b => num(b.accessoryAmount) + num(b.insuranceAmount)) }
  const upSell = { n: up.length, checked: upChecked.length, pct: upChecked.length ? Math.round(up.length / upChecked.length * 100) : null }

  // KPI รายเซลส์ในช่วงนี้: Lead ใหม่ · ทดลองขับ · ใบเสนอราคา · ใบจอง · ส่งมอบ
  const per = {}
  const P = n => (per[(n || 'ไม่ระบุ').trim()] ||= { leads: 0, testDrives: 0, quotes: 0, bookings: 0, delivered: 0, value: 0 })
  newCust.forEach(c => P(c.assignedTo).leads++)
  live(src.testDrives).filter(x => mine(x.staff) && inRange(ymdBangkok(x.date), r) && !['cancelled', 'noshow', 'no_show'].includes(x.status)).forEach(x => P(x.staff).testDrives++)
  live(src.quotations).filter(q => mine(q.salesName || q.salesperson || q.createdByName) && inRange(ymdBangkok(q.createdAt) || ymdBangkok(q.date), r)).forEach(q => P(q.salesName || q.salesperson || q.createdByName).quotes++)
  booked.forEach(b => { P(b.salesName).bookings++; P(b.salesName).value += price(b) })
  delivered.forEach(b => P(b.salesName).delivered++)
  const kpi = Object.entries(per).map(([name, v]) => ({ name, ...v, closeRate: v.leads ? Math.round(v.bookings / v.leads * 100) : null }))
    .sort((a, b) => b.bookings - a.bookings || b.delivered - a.delivered || b.leads - a.leads)

  // CRM — ฐานลูกค้า: ทั้งหมด · มีช่องทางติดต่อ · ได้คุยใน 30 วัน
  const d30 = new Date(t(today) - 30 * DAY).toISOString().slice(0, 10)
  const contactable = customersAll.filter(c => c.phone || c.lineId || c.email)
  const touched = customersAll.filter(c => (ymdBangkok(c.lastContactAt) || '') >= d30)
  const crm = { total: customersAll.length, contactable: contactable.length, touched30: touched.length, touchedPct: customersAll.length ? Math.round(touched.length / customersAll.length * 100) : null }

  // Churn — ลูกค้าที่รับรถไปแล้ว 6–24 เดือน แต่ 12 เดือนล่าสุดไม่กลับมาเข้าศูนย์เลย (ธุรกิจรถ "หาย" = ไม่กลับมาใช้บริการ)
  const jobs = live(src.jobCards)
  const d12 = new Date(t(today) - 365 * DAY).toISOString().slice(0, 10)
  const d6 = new Date(t(today) - 182 * DAY).toISOString().slice(0, 10)
  const d24 = new Date(t(today) - 730 * DAY).toISOString().slice(0, 10)
  const phoneKey = p => String(p || '').replace(/\D/g, '').slice(-9)
  const serviced = new Set()
  jobs.filter(j => (ymdBangkok(j.createdAt) || '') >= d12).forEach(j => { if (j.customerId) serviced.add('id:' + j.customerId); const k = phoneKey(j.phone); if (k.length === 9) serviced.add('ph:' + k); if (j.vin) serviced.add('vin:' + String(j.vin).trim().toUpperCase()) })
  const cohort = valid.filter(b => { const d = deliveryDay(b); return d && d <= d6 && d >= d24 })
  const lost = cohort.filter(b => !(serviced.has('id:' + b.customerId) || serviced.has('ph:' + phoneKey(b.phone)) || (b.vin && serviced.has('vin:' + String(b.vin).trim().toUpperCase()))))
  const churn = { cohort: cohort.length, lost: lost.length, pct: cohort.length && jobs.length ? Math.round(lost.length / cohort.length * 100) : null, noServiceData: !jobs.length }

  // LTV — รายได้เฉลี่ยต่อลูกค้าที่ซื้อแล้ว: ค่ารถ + งานศูนย์บริการ (ค่าแรง+อะไหล่) ตลอดที่มีข้อมูล
  const buyers = new Map()
  const keyOf = b => b.customerId ? 'id:' + b.customerId : (phoneKey(b.phone).length === 9 ? 'ph:' + phoneKey(b.phone) : 'n:' + normName(b.custName))
  valid.forEach(b => { const k = keyOf(b); buyers.set(k, (buyers.get(k) || 0) + price(b)) })
  let serviceRev = 0
  jobs.forEach(j => {
    const v = num(j.labor) + (Array.isArray(j.parts) ? j.parts.reduce((a, p) => a + num(p.price) * (num(p.qty) || 1), 0) : 0)
    const k = j.customerId ? 'id:' + j.customerId : 'ph:' + phoneKey(j.phone)
    if (buyers.has(k)) { buyers.set(k, buyers.get(k) + v); serviceRev += v }
  })
  const ltv = { avg: buyers.size ? Math.round([...buyers.values()].reduce((a, x) => a + x, 0) / buyers.size) : null, buyers: buyers.size, serviceRevenue: serviceRev, repeat: [...new Set(valid.map(keyOf))].length < valid.length ? valid.length - new Set(valid.map(keyOf)).size : 0 }

  // (v1.0.999) CAC — ต้นทุนหาลูกค้าใหม่ 1 ราย = (ค่าโฆษณาที่ใส่ไว้ในบัญชีโซเชียล + ค่าออกบูธ/อีเวนต์ที่เริ่มในช่วงนี้) ÷ ใบจองในช่วงนี้
  // ค่าใช้จ่ายเป็นของทั้งโชว์รูม จึงคิดเฉพาะตอนดูทุกคน · ไม่มีค่าใช้จ่ายที่ใส่ไว้ = null (ไม่เดา)
  let cac = null
  if (!who) {
    const ym = new Set(); for (let y = +r.from.slice(0, 4), m = +r.from.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= r.to.slice(0, 7); m === 12 ? (y++, m = 1) : m++) ym.add(`${y}-${String(m).padStart(2, '0')}`)
    const adSpend = live(src.socialAccounts).reduce((a, x) => a + [...ym].reduce((b, k) => b + Math.max(0, num(x.spend?.[k])), 0), 0)
    const eventSpend = live(src.events).filter(e => inRange(String(e.startDate || ''), r)).reduce((a, e) => a + (num(e.spent) || num(e.budget)), 0)
    const spend = adSpend + eventSpend
    if (spend > 0) {
      const value = booked.length ? Math.round(spend / booked.length) : null
      cac = { spend, adSpend, eventSpend, buyers: booked.length, value, ltvRatio: value && ltv.avg ? Math.round(ltv.avg / value * 10) / 10 : null }
    }
  }

  return {
    range: r,
    units: { booked: booked.length, delivered: delivered.length, cancelled: cancelled.length },
    target, forecast, gmv, grossProfit, revShare, pipeline, conversion, aov, salesCycle, mix, crossSell, upSell, kpi, crm, quota,
    lead: { total: pipeline.lead, new: newCust.filter(c => c.stage === 'lead').length },
    prospect: { total: pipeline.prospect, hot: openCust.filter(c => c.stage === 'pp' && heuristicScore(c).score >= 80).length },
    churn, ltv, cac,
  }
}

// คำอธิบายสั้นๆ ของแต่ละตัว (ภาษาเดียวกับที่เจ้าของเขียนไว้)
export const METRIC_INFO = {
  target: ['Target / Quota', 'เป้าหมายยอดขาย', 'ตัวเลขยอดขายที่พนักงานขายหรือทีมต้องทำให้ได้ในระยะเวลาที่กำหนด — ตั้งที่หน้า “เป้ายอดขาย”'],
  forecast: ['Forecast', 'การพยากรณ์ยอดขาย', 'คาดการณ์ยอดสิ้นเดือนจากจังหวะการจองที่ผ่านมา + ดีลที่กำลังคุย (มูลค่า × โอกาสปิด)'],
  gp: ['GP', 'กำไรขั้นต้น', 'ราคาขาย − ต้นทุนรถ (ยังไม่หักค่าใช้จ่ายบริหาร) คิดเป็น % ยิ่งสูงยิ่งดี'],
  gmv: ['GMV', 'มูลค่ายอดขายรวม', 'มูลค่ารวมของใบจองทั้งหมดในช่วงนี้ (ก่อนหักต้นทุน/ส่วนลด)'],
  revshare: ['RevShare', 'ส่วนแบ่งรายได้', 'รายได้ที่แบ่งมาจากพันธมิตร เช่น คอมไฟแนนซ์ คอมประกัน'],
  kpi: ['KPI', 'ดัชนีชี้วัดรายคน', 'Lead ใหม่ ทดลองขับ ใบเสนอราคา ใบจอง ส่งมอบ ของแต่ละเซลส์'],
  pipeline: ['Pipeline', 'ไปป์ไลน์การขาย', 'ลูกค้าในแต่ละขั้นตั้งแต่ Lead จนส่งมอบ — เห็นว่ามีดีลไหนอยู่ในมือบ้าง'],
  conversion: ['Conversion Rate', 'อัตราการปิดการขาย', '% ของลูกค้าใหม่ในช่วงนี้ที่จองรถจริง'],
  aov: ['AOV', 'ยอดเฉลี่ยต่อใบจอง', 'มูลค่าเฉลี่ยต่อคัน ยิ่งเพิ่มได้ ยอดรวมยิ่งโต'],
  cycle: ['Sales Cycle', 'วงจรการขาย', 'จำนวนวันเฉลี่ยตั้งแต่ลูกค้าเข้าระบบจนจองรถ'],
  mix: ['B2B · B2C · B2G', 'ประเภทผู้ซื้อ', 'B2B = บริษัท/ร้านค้า · B2C = บุคคลทั่วไป · B2G = หน่วยงานรัฐ (แยกจากชื่อผู้ซื้อในใบจอง)'],
  cross: ['Cross-Selling', 'การขายพ่วง', 'ใบจองที่ขายประกัน/อุปกรณ์เสริมเพิ่ม'],
  up: ['Up-Selling', 'การขายรุ่นที่แพงขึ้น', 'ใบจองที่เลือกรุ่นย่อยแพงกว่ารุ่นเริ่มต้นของรุ่นนั้น'],
  crm: ['CRM', 'ฐานลูกค้า', 'ลูกค้าทั้งหมด มีช่องทางติดต่อ และได้คุยใน 30 วันล่าสุด'],
  lead: ['Lead', 'ผู้มุ่งหวัง', 'คนที่สนใจแต่ยังไม่ได้คุยจริงจัง/ยังไม่มีช่องทางติดต่อ'],
  prospect: ['Prospect', 'ลูกค้าที่มีศักยภาพ', 'คุยแล้ว มีช่องทางติดต่อ มีความต้องการจริง'],
  churn: ['Churn Rate', 'อัตราลูกค้าหาย', 'ลูกค้าที่รับรถ 6–24 เดือนก่อน แต่ 12 เดือนล่าสุดไม่กลับมาเข้าศูนย์'],
  ltv: ['LTV', 'มูลค่าลูกค้าตลอดอายุ', 'รายได้เฉลี่ยต่อลูกค้าหนึ่งราย: ค่ารถ + งานศูนย์บริการทั้งหมด'],
  cac: ['CAC', 'ต้นทุนหาลูกค้าใหม่', 'ค่าโฆษณาเพจ/บัญชีโซเชียล + ค่าออกบูธในช่วงนี้ ÷ จำนวนใบจอง · LTV:CAC ยิ่งสูงยิ่งคุ้ม (3 เท่าขึ้นไปถือว่าดี)'],
}

// (v1.0.975) สรุปตัวชี้วัดเดือนนี้เป็นบรรทัดสั้นๆ ให้ LAMI ใช้ตอบ (ไม่มีข้อมูล = ไม่ใส่ ไม่เดา)
export function metricsFacts(m, pm = null, label = '') {
  if (!m) return []
  const baht = n => `${Math.round(n || 0).toLocaleString('th-TH')} บาท`
  const out = [`จอง ${m.units.booked} คัน ส่งมอบ ${m.units.delivered} คัน ถอนจอง ${m.units.cancelled} · GMV ${baht(m.gmv)}`]
  if (m.target?.revenue) out.push(`เป้า ${baht(m.target.revenue)} ทำได้ ${m.target.revenuePct}%${m.target.units ? ` · เป้า ${m.target.units} คัน ทำได้ ${m.target.unitsPct}%` : ''}`)
  if (m.forecast) out.push(`คาดการณ์สิ้นเดือน ~${m.forecast.units} คัน ~${baht(m.forecast.revenue)}`)
  if (m.aov) out.push(`AOV (เฉลี่ยต่อใบจอง) ${baht(m.aov)}`)
  if (m.grossProfit?.pct != null && m.grossProfit?.units) out.push(`GP ${m.grossProfit.pct}% (${baht(m.grossProfit.value)} จาก ${m.grossProfit.units} คันที่ส่งมอบ)`)
  if (m.conversion?.pct != null) out.push(`Conversion ลูกค้าใหม่→จอง ${m.conversion.pct}% (${m.conversion.won}/${m.conversion.leads})`)
  if (m.salesCycle?.avg != null) out.push(`Sales cycle เฉลี่ย ${m.salesCycle.avg} วัน`)
  if (m.cac?.value) out.push(`CAC ต้นทุนหาลูกค้าใหม่ ${baht(m.cac.value)}/ราย (ค่าโฆษณา+ออกบูธ ${baht(m.cac.spend)} ÷ ${m.cac.buyers} ใบจอง)${m.cac.ltvRatio ? ` · LTV:CAC ${m.cac.ltvRatio} เท่า` : ''}`)
  if (m.churn?.pct != null) out.push(`Churn (ไม่กลับมาเข้าศูนย์) ${m.churn.pct}%`)
  // (v1.0.990) เทียบช่วงเดียวกันก่อนหน้า ให้ LAMI ตอบได้ว่า "ดีขึ้นหรือแย่ลง"
  if (pm && (pm.units.booked || pm.gmv)) {
    const ch = pctChange(m.gmv, pm.gmv)
    out.push(`เทียบ${label || 'ช่วงก่อน'}: จอง ${pm.units.booked} คัน ส่งมอบ ${pm.units.delivered} คัน GMV ${baht(pm.gmv)}${ch != null ? ` (GMV ตอนนี้ ${ch >= 0 ? '+' : ''}${ch}%)` : ''}${pm.conversion?.pct != null ? ` · Conversion ${pm.conversion.pct}%` : ''}`)
  }
  return out
}
