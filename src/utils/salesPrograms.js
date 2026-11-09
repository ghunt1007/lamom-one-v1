// (v1.0.970) ศูนย์แคมเปญ & เงื่อนไขขายประจำเดือน — ฟังก์ชันล้วน (pure) ใช้ร่วมกันระหว่างหน้า /crm/programs,
// LAMI (recordFacts) และหน้าอื่นที่อยากรู้ว่า "รุ่นนี้ วันนี้ ได้อะไรบ้าง"
// เก็บทุกอย่างใน collection เดียว sales_programs แยกด้วย type — ดอกเบี้ย/แคมเปญไฟแนนซ์, แคมเปญแบรนด์ (มอเตอร์),
// แคมเปญโชว์รูม, แคมเปญทีมขาย, แคมเปญที่เซลส์คิดเอง, มาร์จิ้นโชว์รูม, ค่าบริหารผู้จัดการ, เงินรางวัลพิเศษ
// 1 เดือนมีได้หลายแคมเปญ: แต่ละรายการมีช่วงวันที่ของตัวเอง (dateFrom–dateTo) ไม่ผูกกับเดือนตายตัว

export const PROGRAM_TYPES = {
  finance:  { icon: '🏦', label: 'ดอกเบี้ย & แคมเปญไฟแนนซ์', short: 'ไฟแนนซ์', who: 'บริษัทไฟแนนซ์' },
  brand:    { icon: '🏭', label: 'แคมเปญแบรนด์ (มอเตอร์)', short: 'แบรนด์', who: 'เจ้าของแบรนด์' },
  showroom: { icon: '🏢', label: 'แคมเปญโชว์รูม', short: 'โชว์รูม', who: 'โชว์รูม' },
  team:     { icon: '👥', label: 'แคมเปญทีมขาย', short: 'ทีมขาย', who: 'ทีมขาย' },
  sales:    { icon: '🙋', label: 'แคมเปญเซลส์คิดเอง', short: 'เซลส์', who: 'เซลส์' },
  margin:   { icon: '💹', label: 'มาร์จิ้นโชว์รูม', short: 'มาร์จิ้น', who: 'โชว์รูม', managerOnly: true },
  mgmtfee:  { icon: '🧑‍💼', label: 'ค่าบริหารผู้จัดการ', short: 'ค่าบริหาร', who: 'โชว์รูม', managerOnly: true },
  bonus:    { icon: '🏆', label: 'เงินรางวัลพิเศษ', short: 'รางวัล', who: 'ผู้ให้รางวัล' },
}
export const TYPE_ORDER = ['finance', 'brand', 'showroom', 'team', 'sales', 'margin', 'mgmtfee', 'bonus']
// แคมเปญที่ "ลูกค้าได้" (เอาไปบอกลูกค้าได้) — มาร์จิ้น/ค่าบริหาร/รางวัล เป็นของภายใน ห้ามบอกลูกค้า
export const CUSTOMER_TYPES = ['finance', 'brand', 'showroom', 'team', 'sales']

export const MGMT_ROLES = {
  teamManager:  'ผู้จัดการทีมขาย',
  salesManager: 'ผู้จัดการฝ่ายขาย',
}

// ใครได้รางวัลพิเศษ
export const BONUS_FOR = {
  all: 'เซลส์ทุกคน',
  person: 'เฉพาะคน',
  team: 'ทั้งทีม',
  manager: 'ผู้จัดการ',
}

const num = v => { const n = Number(String(v ?? '').replace(/[,\s฿%]/g, '')); return Number.isFinite(n) ? n : 0 }
const str = v => String(v ?? '').trim()
const ymdRe = /^\d{4}-\d{2}-\d{2}$/
const pad2 = n => String(n).padStart(2, '0')

// รุ่นรถ: รับได้ทั้ง array และข้อความคั่นด้วย , / | หรือขึ้นบรรทัด — ว่าง = ทุกรุ่นของยี่ห้อนั้น
export function parseModels(v) {
  const arr = Array.isArray(v) ? v : String(v ?? '').split(/[,|\n/]+/)
  const out = []
  arr.map(str).filter(Boolean).forEach(m => { if (!/^ทุกรุ่น$/.test(m) && !out.some(x => x.toLowerCase() === m.toLowerCase())) out.push(m) })
  return out
}

// แถวดอกเบี้ย: ดาวน์ % · ผ่อนกี่งวด · ดอกเบี้ย % ต่อปี (flat rate แบบเช่าซื้อทั่วไป)
export function parseRates(v) {
  return (Array.isArray(v) ? v : []).map(r => ({ down: num(r?.down), months: Math.round(num(r?.months)), rate: num(r?.rate) }))
    .filter(r => r.months > 0 || r.rate > 0)
}

// ทำความสะอาดข้อมูลก่อนบันทึก — ตัวเลขเป็นตัวเลข วันที่ YYYY-MM-DD วันสิ้นสุดไม่ก่อนวันเริ่ม
export function normalizeProgram(raw = {}) {
  const type = PROGRAM_TYPES[raw.type] ? raw.type : 'showroom'
  let dateFrom = ymdRe.test(str(raw.dateFrom)) ? str(raw.dateFrom) : ''
  let dateTo = ymdRe.test(str(raw.dateTo)) ? str(raw.dateTo) : ''
  if (dateFrom && dateTo && dateTo < dateFrom) [dateFrom, dateTo] = [dateTo, dateFrom]
  const p = {
    type,
    title: str(raw.title),
    brand: str(raw.brand),
    models: parseModels(raw.models),
    dateFrom, dateTo,
    conditions: str(raw.conditions),
    amount: num(raw.amount),
    gift: str(raw.gift),
    note: str(raw.note),
    status: raw.status === 'draft' ? 'draft' : 'active',
  }
  if (type === 'finance') {
    p.financeCo = str(raw.financeCo)
    p.rates = parseRates(raw.rates)
    p.financeCommission = num(raw.financeCommission)
    p.subsidy = num(raw.subsidy)
  }
  if (type === 'margin') p.percent = num(raw.percent)
  if (type === 'mgmtfee') p.role = MGMT_ROLES[raw.role] ? raw.role : 'teamManager'
  if (type === 'sales' || type === 'team') p.owner = str(raw.owner)
  if (type === 'bonus') {
    p.bonusFor = BONUS_FOR[raw.bonusFor] ? raw.bonusFor : 'all'
    p.owner = str(raw.owner)
    p.targetUnits = Math.round(num(raw.targetUnits))
    p.sponsor = str(raw.sponsor)
  }
  if (['bonus', 'margin', 'mgmtfee'].includes(type)) p.countBy = raw.countBy === 'booked' ? 'booked' : 'delivered'
  return p
}

export function validateProgram(p) {
  if (!p.title) return 'กรุณากรอกชื่อแคมเปญ'
  if (!p.dateFrom) return 'กรุณาเลือกวันเริ่ม'
  if (p.type === 'finance' && !p.financeCo) return 'กรุณาเลือกบริษัทไฟแนนซ์'
  return ''
}

// ── เดือน / ช่วงวันที่ ──
export function monthBounds(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return [`${y}-${pad2(m)}-01`, `${y}-${pad2(m)}-${pad2(last)}`]
}
export function shiftMonth(ym, n) {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`
}
const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export const MONTH_FULL_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
export function monthLabelTh(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  return y && m ? `${MONTH_FULL_TH[m - 1]} ${y + 543}` : ''
}
export function shortDateTh(ymd) {
  if (!ymdRe.test(str(ymd))) return ''
  return `${+ymd.slice(8)} ${MONTH_TH[+ymd.slice(5, 7) - 1]}`
}
export function rangeLabel(p) {
  if (!p.dateFrom) return 'ยังไม่ระบุวัน'
  if (!p.dateTo) return `ตั้งแต่ ${shortDateTh(p.dateFrom)}`
  if (p.dateFrom === p.dateTo) return shortDateTh(p.dateFrom)
  return `${shortDateTh(p.dateFrom)} – ${shortDateTh(p.dateTo)}`
}

// ไม่มีวันสิ้นสุด = ใช้ไปเรื่อยๆจนกว่าจะแก้
export function isActiveOn(p, ymd) {
  if (!p || p.deleted || p.status === 'draft' || !p.dateFrom) return false
  return p.dateFrom <= ymd && (!p.dateTo || p.dateTo >= ymd)
}
export function overlapsMonth(p, ym) {
  if (!p || p.deleted || !p.dateFrom) return false
  const [a, b] = monthBounds(ym)
  return p.dateFrom <= b && (!p.dateTo || p.dateTo >= a)
}
export function daysLeft(p, today) {
  if (!p.dateTo) return null
  const d = (Date.UTC(+p.dateTo.slice(0, 4), +p.dateTo.slice(5, 7) - 1, +p.dateTo.slice(8, 10)) -
    Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))) / 864e5
  return Math.round(d)
}
// สถานะสั้นๆ สำหรับป้าย: 'soon' ยังไม่เริ่ม · 'live' ใช้ได้ · 'ending' เหลือ ≤ 3 วัน · 'ended' หมดแล้ว · 'draft'
export function liveState(p, today) {
  if (p.status === 'draft') return 'draft'
  if (!p.dateFrom || p.dateFrom > today) return 'soon'
  const left = daysLeft(p, today)
  if (left !== null && left < 0) return 'ended'
  if (left !== null && left <= 3) return 'ending'
  return 'live'
}

// ── ตรงกับรถคันไหน ──
const norm = s => str(s).toLowerCase().replace(/[\s\-_.]+/g, '')
export function matchesCar(p, brand, model) {
  const pb = norm(p.brand)
  const b = norm(brand)
  const m = norm(model)
  if (pb && b && !(b.includes(pb) || pb.includes(b))) return false
  if (!p.models?.length) return true
  if (!m) return true
  return p.models.some(x => { const n = norm(x); return n && (m.includes(n) || n.includes(m)) })
}

export function canSeeType(type, isManager) {
  return isManager || !PROGRAM_TYPES[type]?.managerOnly
}

// เรียง: ตามประเภท แล้ววันสิ้นสุดใกล้สุดก่อน
export function sortPrograms(list) {
  const ti = t => { const i = TYPE_ORDER.indexOf(t); return i < 0 ? 99 : i }
  return [...list].sort((a, b) => ti(a.type) - ti(b.type) || String(a.dateTo || '9999').localeCompare(String(b.dateTo || '9999')) || String(a.title).localeCompare(String(b.title), 'th'))
}

// รายการที่ใช้ได้กับรถคันนี้วันนี้
export function programsForCar(list, { brand = '', model = '', date, isManager = false } = {}) {
  return sortPrograms((list || []).filter(p => canSeeType(p.type, isManager) && isActiveOn(p, date) && matchesCar(p, brand, model)))
}

// ดอกเบี้ยต่ำสุดตามดาวน์/งวด (ดาวน์ที่ลูกค้าวางต้อง ≥ ดาวน์ขั้นต่ำของแถว) — คืนเรียงจากถูกสุด
export function bestRates(list, { down = null, months = null } = {}) {
  const out = []
  ;(list || []).filter(p => p.type === 'finance').forEach(p => (p.rates || []).forEach(r => {
    if (months && r.months && r.months !== Number(months)) return
    if (down != null && down !== '' && r.down > Number(down)) return
    out.push({ financeCo: p.financeCo, title: p.title, down: r.down, months: r.months, rate: r.rate, programId: p.id })
  }))
  return out.sort((a, b) => a.rate - b.rate || b.months - a.months)
}

// ค่างวดต่อเดือน (flat rate แบบเช่าซื้อทั่วไป) ไม่รวม VAT
export function monthlyInstallment(price, downPct, months, ratePct) {
  const financed = Math.max(0, num(price) * (1 - num(downPct) / 100))
  const n = Math.max(1, Math.round(num(months)))
  return Math.round((financed + financed * (num(ratePct) / 100) * (n / 12)) / n)
}

// สรุปสิ่งที่ "รถคันนี้" ได้: ส่วนลดที่ลูกค้าได้รวม · ของแถม · ดอกเบี้ยดีสุด · รายได้ภายใน (มาร์จิ้น/ค่าบริหาร/รางวัล)
export function carSummary(programs) {
  const s = { customerCash: 0, gifts: [], bestRate: null, financeCommission: 0, subsidy: 0, margin: 0, marginPct: 0, mgmt: { teamManager: 0, salesManager: 0 }, bonus: 0, count: programs.length }
  programs.forEach(p => {
    if (CUSTOMER_TYPES.includes(p.type) && p.type !== 'finance') s.customerCash += p.amount || 0
    if (p.gift) s.gifts.push(p.gift)
    if (p.type === 'finance') {
      s.financeCommission = Math.max(s.financeCommission, p.financeCommission || 0)
      s.subsidy = Math.max(s.subsidy, p.subsidy || 0)
    }
    if (p.type === 'margin') { s.margin += p.amount || 0; s.marginPct += p.percent || 0 }
    if (p.type === 'mgmtfee') s.mgmt[p.role || 'teamManager'] += p.amount || 0
    if (p.type === 'bonus') s.bonus += p.amount || 0
  })
  s.bestRate = bestRates(programs)[0] || null
  return s
}

// คัดลอกไปเดือนถัดไป: เลื่อนวันที่ไป 1 เดือน (วันที่ 31 → วันสุดท้ายของเดือนใหม่)
export function copyToNextMonth(p) {
  const shift = ymd => {
    if (!ymd) return ''
    const [y, m, d] = ymd.split('-').map(Number)
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const isLast = d === new Date(Date.UTC(y, m, 0)).getUTCDate()
    return `${new Date(Date.UTC(y, m, 1)).getUTCFullYear()}-${pad2(new Date(Date.UTC(y, m, 1)).getUTCMonth() + 1)}-${pad2(isLast ? last : Math.min(d, last))}`
  }
  const { id: _id, createdAt: _c, updatedAt: _u, createdByUid: _cu, createdByName: _cn, ...rest } = p
  return normalizeProgram({ ...rest, dateFrom: shift(p.dateFrom), dateTo: shift(p.dateTo) })
}

// ── ข้อมูลจากหน้าเดิม (อ่านอย่างเดียว) ──
// ตารางดอกเบี้ยเดิม (/finance/rate-sheets) ไม่มีช่องดอกเบี้ย มีแต่คอมไฟแนนซ์/ซับซิดี้ — แสดงรวมในแท็บไฟแนนซ์
const THAI_MONTH_INDEX = Object.fromEntries(MONTH_FULL_TH.map((m, i) => [m, i + 1]))
export function fromLegacyRateSheet(s) {
  let dateFrom = ymdRe.test(str(s.dateFrom)) ? s.dateFrom : ''
  let dateTo = ymdRe.test(str(s.dateTo)) ? s.dateTo : ''
  const mi = THAI_MONTH_INDEX[str(s.month)]
  if (!dateFrom && mi && s.year) { [dateFrom, dateTo] = monthBounds(`${s.year}-${pad2(mi)}`) }
  return { ...normalizeProgram({ type: 'finance', title: s.campaign || 'แคมเปญไฟแนนซ์', brand: s.brand, models: s.model, dateFrom, dateTo, conditions: s.conditions, financeCo: s.bank, financeCommission: s.financeCommission, subsidy: s.subsidy, amount: 0, status: s.status === 'pending' ? 'draft' : 'active' }), id: 'rs:' + s.id, legacy: '/finance/rate-sheets' }
}
// โปรโมชั่นเดิม (/marketing/promotions) = แคมเปญแบรนด์
export function fromLegacyPromotion(p) {
  return { ...normalizeProgram({ type: p.type === 'finance' ? 'finance' : 'brand', title: p.title || p.name || 'โปรโมชั่น', brand: p.brand, models: p.model, dateFrom: p.startDate, dateTo: p.endDate, conditions: p.conditions || p.description, amount: p.value, financeCo: p.type === 'finance' ? (p.financeCo || 'ไม่ระบุ') : '', status: p.status === 'ended' ? 'active' : 'active' }), id: 'pr:' + p.id, legacy: '/marketing/promotions' }
}

// ── สรุปให้ LAMI (ข้อความสั้น) ──
const baht = n => '฿' + Math.round(n).toLocaleString('en-US')
export function programLine(p) {
  const t = PROGRAM_TYPES[p.type]
  const car = [p.brand, p.models?.length ? p.models.join('/') : 'ทุกรุ่น'].filter(Boolean).join(' ')
  const bits = []
  if (p.type === 'finance') {
    if (p.financeCo) bits.push(p.financeCo)
    const r = (p.rates || []).slice().sort((a, b) => a.rate - b.rate)[0]
    if (r) bits.push(`ดอกเบี้ย ${r.rate}% ดาวน์ ${r.down}% ${r.months} งวด${p.rates.length > 1 ? ` (+อีก ${p.rates.length - 1} แบบ)` : ''}`)
    if (p.subsidy) bits.push(`ซับซิดี้ ${baht(p.subsidy)}`)
  } else if (p.type === 'margin') {
    bits.push([p.amount ? baht(p.amount) + '/คัน' : '', p.percent ? p.percent + '%' : ''].filter(Boolean).join(' + '))
  } else if (p.type === 'mgmtfee') {
    bits.push(`${MGMT_ROLES[p.role] || ''} ${baht(p.amount)}/คัน`)
  } else if (p.type === 'bonus') {
    bits.push(`${baht(p.amount)}${p.targetUnits ? ` เมื่อถึง ${p.targetUnits} คัน` : ''} · ${p.bonusFor === 'person' && p.owner ? p.owner : BONUS_FOR[p.bonusFor] || ''}`)
  } else if (p.amount) bits.push(`ลด ${baht(p.amount)}`)
  if (p.gift) bits.push(`แถม ${p.gift}`)
  if (p.owner && (p.type === 'sales' || p.type === 'team')) bits.push(`โดย ${p.owner}`)
  return `${t?.short || p.type}: ${p.title} · ${car} · ${bits.filter(Boolean).join(' · ')} · ${rangeLabel(p)}${p.conditions ? ` · เงื่อนไข: ${p.conditions.slice(0, 120)}` : ''}`
}

export function programFacts(list, { today, isManager = false, max = 25 } = {}) {
  const active = sortPrograms((list || []).filter(p => canSeeType(p.type, isManager) && isActiveOn(p, today)))
  return active.slice(0, max).map(programLine)
}

// ── (v1.0.976) ผลตอบแทนจากแคมเปญ: นับรถจริงจากใบจอง → รางวัลพิเศษ (ความคืบหน้ารายคน) · มาร์จิ้น · ค่าบริหาร ──
// นับตาม countBy ของแต่ละรายการ: 'delivered' (ส่งมอบ/ตัดตัวเลขในช่วงแคมเปญ — ค่าเริ่มต้น) หรือ 'booked' (วันที่จอง)
// รถต้องตรงยี่ห้อ/รุ่นของแคมเปญ · ใบจองที่ถอน/ยกเลิกไม่นับ
const CANCELLED_ST = ['ถอนจอง', 'ยกเลิก']
const DELIVERED_ST = ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ']
const NAME_PREFIX = /^(นางสาว|นาง|นาย|น\.ส\.|คุณ|mrs\.?|mr\.?|ms\.?|miss)\s*/i
export const personKey = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(NAME_PREFIX, '').trim()
const ymdOf = v => {
  if (!v) return ''
  if (typeof v === 'string') return ymdRe.test(v.slice(0, 10)) ? v.slice(0, 10) : ''
  const d = typeof v.toDate === 'function' ? v.toDate() : (typeof v.seconds === 'number' ? new Date(v.seconds * 1000) : (v instanceof Date ? v : null))
  if (!d || isNaN(d)) return ''
  return new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10) // เวลาไทย
}
export const COUNT_BY = { delivered: 'นับรถที่ส่งมอบ', booked: 'นับรถที่จอง' }
export function bookingCountDay(b, countBy = 'delivered') {
  if (!b || b.deleted || CANCELLED_ST.includes(b.status)) return ''
  if (countBy === 'booked') return ymdOf(b.bookingDate) || ymdOf(b.createdAt)
  if (!DELIVERED_ST.includes(b.status)) return ''
  return ymdOf(b.actualDeliveryDate) || ymdOf(b.cutDate) || ymdOf(b.deliveryDate)
}
// ใบจองที่นับเข้าแคมเปญนี้ (ภายในช่วงวันของแคมเปญ ∩ ช่วงที่ดู)
export function countedBookings(p, bookings, { from = '', to = '' } = {}) {
  const a = [p.dateFrom, from].filter(Boolean).sort().pop() || ''
  const z = [p.dateTo, to].filter(Boolean).sort()[0] || ''
  return (bookings || []).filter(b => {
    const d = bookingCountDay(b, p.countBy)
    return d && (!a || d >= a) && (!z || d <= z) && matchesCar(p, b.brand, b.model)
  })
}
const rewardFor = (p, units) => (p.targetUnits ? (units >= p.targetUnits ? p.amount : 0) : p.amount * units)

// คืน { bonuses:[{p, rows:[{name,key,units,target,left,pct,earned}] , total}], margin:{units,amount}, mgmt:{teamManager,salesManager}, perPerson: Map(key→{name,bonus}) }
// staff = รายชื่อเซลส์ (ชื่อ) ใช้กับรางวัล "เซลส์ทุกคน" ให้คนที่ยังไม่มียอดก็เห็น 0
export function programEarnings(programs, bookings, { month, staff = [], isManager = false } = {}) {
  const [from, to] = monthBounds(month)
  const list = (programs || []).filter(p => !p.deleted && p.status !== 'draft' && overlapsMonth(p, month) && canSeeType(p.type, isManager))
  const out = { bonuses: [], margin: { units: 0, amount: 0, items: [] }, mgmt: { teamManager: { units: 0, amount: 0 }, salesManager: { units: 0, amount: 0 } }, perPerson: new Map() }
  const names = new Map()
  const addName = n => { const k = personKey(n); if (k && !names.has(k)) names.set(k, String(n).trim()) }
  staff.forEach(addName)
  ;(bookings || []).forEach(b => addName(b.salesName))
  list.filter(p => p.type === 'bonus').forEach(p => {
    const hits = countedBookings(p, bookings, { from, to })
    let rows = []
    if (p.bonusFor === 'team' || p.bonusFor === 'manager') {
      const units = hits.length
      rows = [{ name: p.bonusFor === 'team' ? (p.owner || 'ทั้งทีม') : (p.owner || 'ผู้จัดการ'), key: '', units }]
    } else {
      const by = new Map()
      hits.forEach(b => { const k = personKey(b.salesName); if (k) by.set(k, (by.get(k) || 0) + 1) })
      const keys = p.bonusFor === 'person' && p.owner ? [personKey(p.owner)] : [...new Set([...names.keys(), ...by.keys()])]
      rows = keys.filter(Boolean).map(k => ({ name: names.get(k) || (p.owner || k), key: k, units: by.get(k) || 0 }))
    }
    rows = rows.map(r => {
      const target = p.targetUnits || 0
      const earned = rewardFor(p, r.units)
      return { ...r, target, left: target ? Math.max(0, target - r.units) : 0, pct: target ? Math.min(100, Math.round(r.units / target * 100)) : null, earned }
    }).sort((a, b) => b.earned - a.earned || b.units - a.units || a.name.localeCompare(b.name, 'th'))
    rows.forEach(r => { if (r.key) { const pp = out.perPerson.get(r.key) || { name: r.name, bonus: 0 }; pp.bonus += r.earned; out.perPerson.set(r.key, pp) } })
    out.bonuses.push({ p, rows, total: rows.reduce((a, r) => a + r.earned, 0) })
  })
  list.filter(p => p.type === 'margin').forEach(p => {
    const hits = countedBookings(p, bookings, { from, to })
    const amount = hits.reduce((a, b) => a + (p.amount || 0) + (p.percent ? num(b.price) * p.percent / 100 : 0), 0)
    out.margin.units += hits.length
    out.margin.amount += amount
    out.margin.items.push({ p, units: hits.length, amount: Math.round(amount) })
  })
  list.filter(p => p.type === 'mgmtfee').forEach(p => {
    const hits = countedBookings(p, bookings, { from, to })
    const m = out.mgmt[p.role] || out.mgmt.teamManager
    m.units += hits.length
    m.amount += hits.length * (p.amount || 0)
  })
  out.margin.amount = Math.round(out.margin.amount)
  return out
}

// ความคืบหน้ารางวัลของคนเดียว (ใช้ใน "งานของฉัน"/LAMI) — คืนเฉพาะรายการที่ยังไม่ได้และมีเป้า หรือได้แล้ว
export function myBonusProgress(earn, name) {
  const k = personKey(name)
  if (!k) return []
  return earn.bonuses.map(({ p, rows }) => ({ p, row: rows.find(r => r.key === k) })).filter(x => x.row)
}
