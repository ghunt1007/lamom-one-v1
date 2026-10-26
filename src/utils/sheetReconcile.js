// (v1.0.747) เทียบลูกค้า/ใบจองในโปรแกรมกับไฟล์ "DATA Booking" (Google Sheet ของโชว์รูม) โดยยึดไฟล์เป็นหลัก
// ใช้คู่กับปุ่ม "📥 นำเข้าจาก Excel" (bookingImport.js) ซึ่งดูแลฝั่ง "ไฟล์มี แต่โปรแกรมไม่มี/ไม่ตรง" ของใบจองอยู่แล้ว
// ไฟล์นี้เพิ่มอีกฝั่ง: ของที่ "โปรแกรมมีเกินมา" + ข้อมูลลูกค้า (ชื่อ/เบอร์/สถานะ) ที่ไม่ตรงกับไฟล์ + ใบจองที่ยังไม่มีลูกค้าผูก
//
// หลักการ (ไม่เขียนอะไรเอง แค่คืนแผนให้หน้าจอแสดงให้เจ้าของติ๊กเลือก):
// - ใบจองจับคู่ด้วยเลขใบจอง ใบที่เลขไม่อยู่ในไฟล์ = เกิน, เลขซ้ำในโปรแกรม = ซ้ำ (เก็บใบที่ผูกลูกค้า/เก่าสุดไว้)
// - ใบจองเลขชั่วคราว (…-TEMP จากการนำเข้าครั้งแรก ส.ค. 2569) ถ้าชื่อ/เบอร์ตรงกับแถวในไฟล์ที่ยังไม่มีเลข = ยังใช้อยู่ ไม่นับเกิน
// - ลูกค้าที่ผูกกับใบจองที่ตรงไฟล์ หรือชื่อ/เบอร์ตรงกับไฟล์ = ตรง, ลูกค้าเบอร์ซ้ำกันหลายคน = เก็บคนที่ผูกใบจอง/เก่าสุดไว้
// - ลูกค้าที่ยังเป็น Lead/Prospect (ไม่เคยจอง) ไม่อยู่ในไฟล์อยู่แล้วโดยธรรมชาติ → แยกกลุ่มไว้ ไม่เสนอให้ลบเป็นค่าเริ่มต้น
import { mapBookingRow } from './bookingImport.js'

const NAME_PREFIX = /^(นางสาว|นาง|นาย|น\.ส\.|นส\.|คุณ|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?|miss)\s*/i

export function normPhone(v) {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : ''
}

export function normPersonName(v) {
  let s = String(v ?? '').trim().replace(/\s+/g, ' ')
  for (let i = 0; i < 2; i++) s = s.replace(NAME_PREFIX, '')
  return s.replace(/\s/g, '').toLowerCase()
}

export function customerFullName(c) {
  return `${c?.firstName || ''} ${c?.lastName || ''}`.trim()
}

// แยกชื่อเต็มจากไฟล์เป็นชื่อ/นามสกุลแบบเดียวกับ newCustomerDoc() (คำสุดท้าย = นามสกุล)
export function splitFullName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  const lastName = parts.length > 1 ? parts.pop() : ''
  return { firstName: parts.join(' '), lastName }
}

export function isTempBookingNo(no) {
  const s = String(no ?? '').trim()
  return !s || /-TEMP$/i.test(s)
}

function ts(v) {
  if (!v) return Infinity
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? Infinity : t }
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v.seconds === 'number') return v.seconds * 1000
  return Infinity
}

// เลือกตัวที่ "ควรเก็บ" จากกลุ่มที่ซ้ำกัน: ตัวที่มีของผูกอยู่ก่อน แล้วค่อยเก่าสุด
function pickKeeper(items, isLinked) {
  return [...items].sort((a, b) => (isLinked(b) - isLinked(a)) || (ts(a.createdAt) - ts(b.createdAt)))[0]
}

/**
 * @param sheetRows  แถวจาก readBookingSheet(wb).rows
 * @param bookings   ใบจองทั้งหมดในโปรแกรม (รวมที่ลบแล้วก็ได้ จะกรองออกเอง)
 * @param customers  ลูกค้าทั้งหมดในโปรแกรม (รวมที่ลบแล้วก็ได้)
 */
export function planSheetReconcile(sheetRows, bookings, customers) {
  const sheet = sheetRows.map(r => ({ ...mapBookingRow(r), row: r.__row })).filter(m => m.custName || m.bookingNo)
  const sheetByNo = new Map()
  for (const m of sheet) if (m.bookingNo && !sheetByNo.has(m.bookingNo)) sheetByNo.set(m.bookingNo, m)
  const sheetPhones = new Map(), sheetNames = new Map()
  for (const m of sheet) {
    const p = normPhone(m.phone); if (p && !sheetPhones.has(p)) sheetPhones.set(p, m)
    const n = normPersonName(m.custName); if (n && !sheetNames.has(n)) sheetNames.set(n, m)
  }
  const sheetRowFor = (name, phone) => sheetPhones.get(normPhone(phone)) || sheetNames.get(normPersonName(name)) || null

  const liveBookings = bookings.filter(b => !b.deleted)
  const liveCustomers = customers.filter(c => !c.deleted)
  const custById = new Map(liveCustomers.map(c => [c.id, c]))

  // ── ใบจอง ──
  const extraBookings = []
  const keptBookings = [] // { booking, sheet }
  const byNo = new Map()
  const tempWithRealNo = []
  const real = liveBookings.filter(b => !isTempBookingNo(b.bookingNo))
  for (const b of real) { const no = String(b.bookingNo).trim(); (byNo.get(no) || byNo.set(no, []).get(no)).push(b) }
  for (const b of liveBookings) {
    const no = String(b.bookingNo ?? '').trim()
    if (!isTempBookingNo(no)) continue
    // เลขชั่วคราว: ยังใช้อยู่ถ้าตรงกับแถวในไฟล์ที่ยังไม่มีเลขใบจอง
    const hit = sheetRowFor(b.custName, b.phone)
    if (hit && !hit.bookingNo) keptBookings.push({ booking: b, sheet: hit })
    else if (hit) tempWithRealNo.push({ booking: b, sheet: hit })
    else extraBookings.push({ booking: b, reason: 'not-in-sheet', note: 'ใบจองเลขชั่วคราว ไม่มีในไฟล์' })
  }
  // ใบจองเลขชั่วคราวที่ตอนนี้ไฟล์ออกเลขจริงให้แล้ว: ถ้าโปรแกรมยังไม่มีเลขจริงนั้น → เปลี่ยนเลขให้ (เก็บเงินจอง/F&I ที่กรอกไว้)
  // ถ้ามีเลขจริงอยู่แล้ว → ใบชั่วคราวเป็นของซ้ำ
  const renumberBookings = []
  const renumbered = new Set()
  for (const { booking: b, sheet: s } of tempWithRealNo) {
    if (byNo.has(s.bookingNo) || renumbered.has(s.bookingNo)) extraBookings.push({ booking: b, reason: 'temp-dup', note: `ซ้ำกับใบจอง ${s.bookingNo}` })
    else { renumbered.add(s.bookingNo); renumberBookings.push({ booking: b, sheet: s, patch: { bookingNo: s.bookingNo } }); keptBookings.push({ booking: b, sheet: s }) }
  }
  for (const [no, list] of byNo) {
    const s = sheetByNo.get(no)
    if (!s) { list.forEach(b => extraBookings.push({ booking: b, reason: 'not-in-sheet', note: 'เลขใบจองนี้ไม่มีในไฟล์' })); continue }
    const keep = pickKeeper(list, b => (b.customerId && custById.has(b.customerId)) ? 1 : 0)
    keptBookings.push({ booking: keep, sheet: s })
    list.filter(b => b !== keep).forEach(b => extraBookings.push({ booking: b, reason: 'dup-number', note: `เลขใบจอง ${no} ซ้ำในโปรแกรม` }))
  }

  // ── ลูกค้า ──
  const keptBookingIds = new Set(keptBookings.map(k => k.booking.id))
  const extraBookingIds = new Set(extraBookings.map(x => x.booking.id))
  const sheetForCustomer = new Map() // customerId → แถวในไฟล์ (ผ่านใบจองที่ผูก)
  for (const k of keptBookings) {
    if (k.booking.customerId && custById.has(k.booking.customerId) && !sheetForCustomer.has(k.booking.customerId)) sheetForCustomer.set(k.booking.customerId, k.sheet)
  }
  for (const c of liveCustomers) {
    if (!sheetForCustomer.has(c.id) && c.bookingId && keptBookingIds.has(c.bookingId)) {
      const k = keptBookings.find(x => x.booking.id === c.bookingId)
      if (k) sheetForCustomer.set(c.id, k.sheet)
    }
  }
  const linked = c => sheetForCustomer.has(c.id) ? 1 : 0

  const matchedCustomers = [] // { customer, sheet }
  const extraCustomers = []
  const leads = []
  for (const c of liveCustomers) {
    const s = sheetForCustomer.get(c.id) || sheetRowFor(customerFullName(c), c.phone)
    if (s) { matchedCustomers.push({ customer: c, sheet: s }); continue }
    const booked = c.stage === 'booking' || c.stage === 'delivered' || c.importedFromExcel || (c.bookingId && extraBookingIds.has(c.bookingId))
    if (booked) extraCustomers.push({ customer: c, reason: 'not-in-sheet', note: 'ลูกค้าที่จอง/ส่งมอบแล้ว แต่ไม่มีในไฟล์' })
    else leads.push(c)
  }
  // ลูกค้าซ้ำ: ตรงกับแถวเดียวกันในไฟล์หลายคน → เก็บคนที่ผูกใบจอง/เก่าสุด ที่เหลือเป็นส่วนเกิน
  const bySheetRow = new Map()
  for (const m of matchedCustomers) (bySheetRow.get(m.sheet) || bySheetRow.set(m.sheet, []).get(m.sheet)).push(m)
  const keptCustomers = []
  for (const [s, list] of bySheetRow) {
    const keep = pickKeeper(list.map(x => x.customer), linked)
    keptCustomers.push({ customer: keep, sheet: s })
    list.filter(x => x.customer !== keep).forEach(x => extraCustomers.push({ customer: x.customer, reason: 'duplicate', note: `ซ้ำกับลูกค้า ${customerFullName(keep) || s.custName}` }))
  }

  // ── ลูกค้าที่ข้อมูลไม่ตรงไฟล์ (ชื่อ / เบอร์ / ส่งมอบแล้ว) ──
  const customerFixes = []
  for (const { customer: c, sheet: s } of keptCustomers) {
    const patch = {}, changes = []
    if (s.custName && normPersonName(s.custName) !== normPersonName(customerFullName(c))) {
      Object.assign(patch, splitFullName(s.custName)); changes.push('name')
    }
    if (normPhone(s.phone) && normPhone(s.phone) !== normPhone(c.phone)) { patch.phone = s.phone; changes.push('phone') }
    if (s.status === 'ส่งมอบแล้ว' && c.stage !== 'delivered') { patch.stage = 'delivered'; changes.push('stage') }
    if (changes.length) customerFixes.push({ customer: c, sheet: s, patch, changes })
  }

  // ── ใบจองที่ตรงไฟล์ แต่ยังไม่มีลูกค้าผูก และหาลูกค้าที่ตรงก็ไม่เจอ → เสนอสร้างลูกค้า ──
  const keptCustomerBySheet = new Map(keptCustomers.map(k => [k.sheet, k.customer]))
  const missingCustomers = []
  const linkOnly = []
  const seenSheet = new Set()
  for (const k of keptBookings) {
    if (k.booking.customerId && custById.has(k.booking.customerId)) continue
    const existing = keptCustomerBySheet.get(k.sheet)
    if (existing) { linkOnly.push({ booking: k.booking, customer: existing }); continue }
    if (seenSheet.has(k.sheet)) continue
    seenSheet.add(k.sheet)
    missingCustomers.push({ booking: k.booking, sheet: k.sheet })
  }

  // ── แถวในไฟล์ที่โปรแกรมยังไม่มีใบจอง (ให้ไปกด "นำเข้าจาก Excel") ──
  const liveNos = new Set(liveBookings.map(b => String(b.bookingNo ?? '').trim()))
  renumberBookings.forEach(r => liveNos.add(r.patch.bookingNo))
  const missingBookings = [...sheetByNo.values()].filter(m => !liveNos.has(m.bookingNo))

  return {
    sheetCount: sheet.length,
    extraBookings, renumberBookings, extraCustomers, leads, customerFixes, missingCustomers, linkOnly, missingBookings,
    keptBookingCount: keptBookings.length, keptCustomerCount: keptCustomers.length,
  }
}
