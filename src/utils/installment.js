// ค่างวดรถแบบดอกเบี้ยคงที่ (flat rate) ตามที่ไฟแนนซ์รถในไทยใช้ — สูตรเดียวกับหน้า Loan Calculator
// (ยอดจัด + ยอดจัด × ดอกเบี้ย% × ปี) ÷ จำนวนงวด · ตัวเลขเบื้องต้น อัตราจริงขึ้นกับการอนุมัติ
export function flatMonthly(price, downPct, months, ratePct) {
  const p = Number(price) || 0, m = Number(months) || 0
  if (p <= 0 || m <= 0) return { down: 0, loan: 0, monthly: 0 }
  const down = Math.round(p * (Number(downPct) || 0) / 100)
  const loan = p - down
  const monthly = Math.round((loan + loan * (Number(ratePct) || 0) / 100 * (m / 12)) / m)
  return { down, loan, monthly }
}

// ไฟแนนซ์ไม่ผ่าน → เสนอแผนใหม่ที่ดาวน์มากขึ้น (ยอดจัดน้อยลง) ให้เซลส์คุยกับลูกค้า/ยื่นไฟแนนซ์ใหม่
// total = ราคารวมหลังส่วนลด+อุปกรณ์ · currentDown = เงินดาวน์เดิม (บาท) · คืนแถวละ 1 ระดับดาวน์ พร้อมค่างวด 72/84 งวด
export function replanOptions(total, currentDown = 0, ratePct = 2.79) {
  const t = Number(total) || 0
  if (t <= 0) return []
  const cur = Math.max(0, Math.round((Number(currentDown) || 0) / t * 100))
  const pcts = [...new Set([25, 30, 40, 50].filter(p => p > cur))].slice(0, 3)
  return pcts.map(p => ({
    pct: p,
    down: flatMonthly(t, p, 72, ratePct).down,
    loan: flatMonthly(t, p, 72, ratePct).loan,
    m72: flatMonthly(t, p, 72, ratePct).monthly,
    m84: flatMonthly(t, p, 84, ratePct).monthly,
    more: Math.max(0, flatMonthly(t, p, 72, ratePct).down - (Number(currentDown) || 0)),
  }))
}

export function replanText(rows, ratePct = 2.79) {
  const fmt = n => Number(n).toLocaleString('th-TH')
  if (!rows.length) return ''
  return ['ทางเลือกการผ่อนแบบใหม่ (ตัวเลขประมาณการ ดอกเบี้ย ' + ratePct + '% ต่อปี อัตราจริงขึ้นกับไฟแนนซ์อนุมัติ)',
    ...rows.map(r => `• ดาวน์ ${r.pct}% (${fmt(r.down)} บาท) ยอดจัด ${fmt(r.loan)} บาท → ผ่อน 72 งวด ${fmt(r.m72)} บาท/เดือน หรือ 84 งวด ${fmt(r.m84)} บาท/เดือน`),
  ].join('\n')
}
