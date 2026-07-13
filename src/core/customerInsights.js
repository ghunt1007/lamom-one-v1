/**
 * Customer Insights — pure functions, no side effects, no db.js imports.
 * Used by the unified Customer Workspace (src/pages/crm/Customers.js) to power:
 *   - getFollowUpRecommendation(customer, commLogs, opts) → follow-up panel
 *   - getBookingDiagnosis(booking)                        → booking problem-diagnosis panel
 * Callers fetch data (comm_logs, vehicles, bookings) themselves and pass it in here.
 */

export function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
}

// ── Stage transition helpers (shared by Customers.js) ──────────────────────
export function deriveInitialStage(data) {
  return (data?.phone || data?.lineId) ? 'pp' : 'lead'
}

// True when an edit to a 'lead' should auto-bump them to 'pp' (newly got a phone/LINE)
export function shouldAutoPromoteToPP(existing, patch) {
  if (!existing || existing.stage !== 'lead') return false
  const hadContact = !!(existing.phone || existing.lineId)
  if (hadContact) return false
  const willHaveContact = !!((patch.phone ?? existing.phone) || (patch.lineId ?? existing.lineId))
  return willHaveContact
}

// ── Follow-up recommendation engine ─────────────────────────────────────────
const STAGE_ADVICE = {
  lead: 'ยังไม่ได้เบอร์ติดต่อหรือ LINE ID — ลองขอเบอร์โทร/LINE เพื่อติดตามต่ออย่างจริงจัง',
  pp: 'ได้เบอร์ติดต่อ/LINE แล้วแต่ยังไม่จอง — ลองนัดทดลองขับ หรือส่งใบเสนอราคาให้พิจารณา',
  booking: 'ลูกค้าจองรถแล้ว — ติดตามความคืบหน้าไฟแนนซ์และนัดส่งมอบให้ราบรื่น',
  delivered: 'ส่งมอบรถแล้ว — ติดตามความพึงพอใจหลังการขายและโอกาสแนะนำต่อ',
}

/**
 * @param {object} customer  unified customer doc
 * @param {array}  commLogs  comm_logs entries for this customer, sorted newest-first (optional)
 * @param {object} opts      { stockAvailable: boolean|null, overBudget: boolean }
 */
export function getFollowUpRecommendation(customer, commLogs = [], opts = {}) {
  if (!customer) return { urgency: 'low', recommendation: '', diagnosedProblem: null }

  if (customer.isLost) {
    return {
      urgency: 'low',
      recommendation: `ลูกค้ารายนี้ถูกทำเครื่องหมายว่าเสียดีลแล้ว${customer.lostReason ? ' (' + customer.lostReason + ')' : ''} — ไม่ต้องติดตามต่อ เว้นแต่มีสัญญาณกลับมาสนใจ`,
      diagnosedProblem: customer.lostReason || 'เสียดีล',
    }
  }

  if (customer.stage === 'delivered') {
    const d = daysSince(customer.stageChangedAt)
    if (d != null && d <= 7) {
      return { urgency: 'high', recommendation: `ส่งมอบรถมาแล้ว ${d} วัน — โทรเช็คความพึงพอใจภายใน 7 วันแรก (ดูหน้า After-Sales Follow-up)`, diagnosedProblem: null }
    }
    return { urgency: 'low', recommendation: STAGE_ADVICE.delivered, diagnosedProblem: null }
  }

  const lastLog = commLogs && commLogs[0]
  const lastContactDate = lastLog?.createdAt || customer.stageChangedAt || customer.createdAt
  const idleDays = daysSince(lastContactDate)
  const stageDays = daysSince(customer.stageChangedAt || customer.createdAt)

  let urgency = 'low'
  if (customer.temperature === 'hot') urgency = 'high'
  else if (customer.temperature === 'warm') urgency = 'medium'
  if (idleDays != null && idleDays >= 7) urgency = 'high'
  else if (idleDays != null && idleDays >= 3 && urgency === 'low') urgency = 'medium'

  const parts = [STAGE_ADVICE[customer.stage] || STAGE_ADVICE.lead]
  if (idleDays != null) {
    if (idleDays === 0) parts.push('ติดต่อล่าสุดวันนี้')
    else parts.push(`ไม่ได้ติดต่อมา ${idleDays} วันแล้ว`)
  }
  if (stageDays != null && stageDays >= 14) {
    parts.push(`ค้างอยู่สถานะนี้มา ${stageDays} วัน ควรตรวจสอบว่าติดขัดอะไร`)
    if (urgency === 'low') urgency = 'medium'
  }

  let diagnosedProblem = null
  if (opts.stockAvailable === false && customer.interestedModel) {
    parts.push(`รุ่นที่สนใจ (${customer.interestedModel}) ไม่มีในสต็อกตอนนี้ — แจ้งลูกค้าและเสนอรุ่นทดแทนหรือรอรอบถัดไป`)
    diagnosedProblem = 'รถไม่มีสต็อก'
    if (urgency === 'low') urgency = 'medium'
  } else if (opts.stockAvailable === true && customer.interestedModel && (customer.stage === 'pp')) {
    parts.push(`รุ่นที่สนใจ (${customer.interestedModel}) มีในสต็อกพร้อมขาย — เร่งปิดการขายได้เลย`)
  }

  if (opts.overBudget) {
    parts.push('งบประมาณของลูกค้าต่ำกว่าราคารถที่สนใจ — เสนอโปรโมชั่น/ตัวเลือกไฟแนนซ์ หรือแนะนำรุ่นย่อยที่ราคาถูกกว่า')
    diagnosedProblem = diagnosedProblem || 'งบประมาณไม่พอ'
    urgency = 'medium'
  }

  return { urgency, recommendation: parts.join(' · '), diagnosedProblem }
}

// ── Booking problem-diagnosis engine ────────────────────────────────────────
/**
 * @param {object} booking  a row from the `bookings` collection
 */
export function getBookingDiagnosis(booking) {
  if (!booking) return { blockerType: 'none', message: 'ยังไม่มีใบจอง', suggestedAction: '' }

  if (booking.status === 'ถอนจอง' || booking.status === 'ยกเลิก') {
    return {
      blockerType: 'none',
      message: 'ใบจองนี้ถูกถอน/ยกเลิกแล้ว',
      suggestedAction: booking.refundStatus === 'รอคืนเงิน' ? 'ติดตามการคืนเงินจองกับฝ่ายการเงิน' : '-',
    }
  }

  if (booking.status === 'ส่งมอบแล้ว') {
    const d = daysSince(booking.actualDeliveryDate)
    if (d != null && d <= 7) {
      return { blockerType: 'none', message: `ส่งมอบรถแล้ว (${d} วันที่แล้ว)`, suggestedAction: 'โทรเช็คความพึงพอใจภายใน 7 วัน (ดูหน้า After-Sales Follow-up)' }
    }
    return { blockerType: 'none', message: 'ส่งมอบรถเรียบร้อยแล้ว', suggestedAction: '-' }
  }

  if (booking.finStatus === 'ไม่ผ่าน') {
    return {
      blockerType: 'finance_rejected',
      message: 'ไฟแนนซ์ไม่ผ่าน — ติดขัดเรื่องอนุมัติสินเชื่อ',
      suggestedAction: 'ลองยื่นไฟแนนซ์กับธนาคาร/บริษัทไฟแนนซ์อื่น หรือเสนอเพิ่มเงินดาวน์เพื่อลดความเสี่ยง',
    }
  }

  if (booking.finStatus === 'รอผล' || booking.status === 'รอผลไฟแนนซ์') {
    const d = daysSince(booking.submitDate)
    const overdue = d != null && d >= 7
    return {
      blockerType: 'finance_pending',
      message: `รอผลอนุมัติไฟแนนซ์${d != null ? ` (ยื่นมาแล้ว ${d} วัน)` : ''}`,
      suggestedAction: overdue ? '⚠️ ล่าช้าเกิน 7 วัน — ติดตามผลกับไฟแนนซ์ด่วน' : 'ติดตามผลอนุมัติกับไฟแนนซ์เป็นระยะ',
    }
  }

  if (booking.status === 'รอรถ') {
    return {
      blockerType: 'stock_shortage',
      message: 'รอรถเข้าสต็อก',
      suggestedAction: 'ตรวจสอบกำหนดรถเข้ากับฝ่ายสต็อก/ใบสั่งรถใหม่ และแจ้งลูกค้าล่วงหน้าหากคาดว่าจะล่าช้า',
    }
  }

  if (booking.status === 'รอส่งมอบ' || booking.status === 'ตัดตัวเลขรอส่งมอบ') {
    return {
      blockerType: 'awaiting_delivery_prep',
      message: 'อยู่ระหว่างเตรียมส่งมอบรถ',
      suggestedAction: 'ตรวจสอบ PDI / เอกสารทะเบียน / ป้ายแดง-ป้ายขาวให้พร้อมก่อนวันนัดส่งมอบ',
    }
  }

  if (booking.status === 'ยอดจองคงค้าง' || booking.status === 'จัดไฟแนนซ์ก่อนจอง') {
    return {
      blockerType: 'awaiting_delivery_prep',
      message: 'อยู่ระหว่างดำเนินการเอกสาร/เงินจอง',
      suggestedAction: 'ติดตามเอกสารและเงินจองให้ครบก่อนเข้าสู่กระบวนการไฟแนนซ์',
    }
  }

  return { blockerType: 'none', message: booking.status || '-', suggestedAction: '-' }
}

// ── Stock helper ─────────────────────────────────────────────────────────
// vehicles: rows from the `vehicles` collection (see src/pages/dms/Stock.js)
export function isModelInStock(interestedModel, vehicles = []) {
  if (!interestedModel) return null
  const needle = interestedModel.toLowerCase()
  return vehicles.some(v => {
    if (v.status !== 'available') return false
    const hay = `${v.brand || ''} ${v.model || ''} ${v.variant || ''}`.toLowerCase()
    return hay.includes(needle) || needle.includes(v.model?.toLowerCase() || ' ')
  })
}
