// Finance Match Engine — จับคู่โปรไฟล์ลูกค้า (อาชีพ/รายได้) กับโปรไฟล์ความชอบของไฟแนนซ์แต่ละแห่ง
// (bank_partner_info) เพื่อแนะนำว่าเคสนี้ควรส่งธนาคารไหนก่อน — คำนวณแบบ rule-based ทันที
// ไม่ต้องเรียก AI (ถูก/เร็ว) ส่วนความเห็น AI เพิ่มเติมแบบ on-demand อยู่ที่ recommendFinance() ใน ai.js

export const OCCUPATIONS = [
  'ราชการ/รัฐวิสาหกิจ',
  'พนักงานบริษัทเอกชน',
  'ธุรกิจส่วนตัว/เจ้าของกิจการ',
  'ฟรีแลนซ์/อาชีพอิสระ',
  'เกษตรกร',
  'อื่นๆ',
]

// คะแนน 0-100 + เหตุผลประกอบ (array ของ string) สำหรับธนาคาร 1 แห่งเทียบกับโปรไฟล์ลูกค้า 1 คน
// customerProfile: { occupation, monthlyIncome, downPct }
// bankInfo: bank_partner_info doc { bankName, approval, minDown, preferredOccupations, minIncome, blacklistOk, hasBlacklistHistory (จากลูกค้า ถ้ามี) }
export function scoreFinanceMatch(customerProfile, bankInfo) {
  let score = 0
  const reasons = []
  const occ = customerProfile?.occupation || ''
  const income = Number(customerProfile?.monthlyIncome) || 0
  const preferred = Array.isArray(bankInfo?.preferredOccupations) ? bankInfo.preferredOccupations : []

  // อาชีพ — ธนาคารไม่ได้ตั้งค่ารายการอาชีพที่ชอบไว้เลย = รับทุกอาชีพ (ให้คะแนนกลางๆ ไม่เต็ม เพราะไม่รู้จริง)
  if (!preferred.length) {
    score += 20
  } else if (occ && preferred.includes(occ)) {
    score += 40
    reasons.push(`ชอบลูกค้าอาชีพ "${occ}" อยู่แล้ว`)
  } else if (occ) {
    reasons.push(`ปกติไม่ค่อยรับลูกค้าอาชีพ "${occ}" — พิจารณาเป็นกรณีพิเศษ`)
  }

  // รายได้ขั้นต่ำ
  const minIncome = Number(bankInfo?.minIncome) || 0
  if (minIncome > 0 && income > 0) {
    if (income >= minIncome) {
      score += 20
      if (income >= minIncome * 1.5) reasons.push('รายได้สูงกว่าเกณฑ์ขั้นต่ำมาก โอกาสอนุมัติสูง')
    } else {
      reasons.push(`รายได้ต่ำกว่าเกณฑ์ขั้นต่ำที่ธนาคารนี้มักอนุมัติ (${minIncome.toLocaleString()} บาท/เดือน)`)
    }
  } else {
    score += 10 // ไม่มีข้อมูลพอจะเทียบ — ให้คะแนนกลางๆ ไม่หัก
  }

  // Approval rate ของธนาคาร (ยิ่งสูงยิ่งน่าลอง)
  const approval = Number(bankInfo?.approval) || 0
  score += Math.round((approval / 100) * 20)
  if (approval >= 80) reasons.push(`Approval Rate สูง (${approval}%)`)

  // เงินดาวน์ที่ลูกค้าตั้งใจจะลง เทียบกับเงินดาวน์ขั้นต่ำของธนาคาร
  const minDown = Number(bankInfo?.minDown) || 0
  const downPct = Number(customerProfile?.downPct) || 0
  if (minDown > 0 && downPct > 0) {
    if (downPct >= minDown) score += 10
    else reasons.push(`เงินดาวน์ที่ตั้งใจจะลง (${downPct}%) ต่ำกว่าขั้นต่ำของธนาคารนี้ (${minDown}%)`)
  } else {
    score += 5
  }

  // ประวัติ Blacklist/ค้างชำระ ของลูกค้า (ถ้าทราบ)
  if (customerProfile?.hasBlacklistHistory) {
    if (bankInfo?.blacklistOk) reasons.push('ธนาคารนี้รับพิจารณาลูกค้าที่มีประวัติค้างชำระเป็นกรณีพิเศษ')
    else { score -= 20; reasons.push('ลูกค้ามีประวัติค้างชำระ — ธนาคารนี้ปกติไม่รับกรณีนี้') }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}

// คืน array เรียงคะแนนมากไปน้อย: [{ ...bankInfo, score, reasons }]
export function rankFinanceMatches(customerProfile, bankInfoList) {
  return bankInfoList
    .map(b => ({ ...b, ...scoreFinanceMatch(customerProfile, b) }))
    .sort((a, b) => b.score - a.score)
}
