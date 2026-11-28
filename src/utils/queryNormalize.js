// (v1.0.1518) ทีมขายพิมพ์คำอังกฤษปนไทยบ่อย ("booking today", "test drive tomorrow", "who to call")
// → แปลงคำอังกฤษที่รู้จักเป็นภาษาไทยก่อนส่งให้ตัวตอบทันทีของ LAMI (คำถามที่ไม่มีคำพวกนี้คืนค่าเดิม)
// ฟังก์ชันล้วน · ไม่แตะชื่อรุ่นรถ (S07 / AION V / ATTO 3) เพราะแปลงเฉพาะคำที่อยู่ในรายการเท่านั้น
const MAP = [
  [/\bwho\s+(?:should\s+i|to)\s+call(?:\s+today)?\b/gi, 'วันนี้ควรโทรหาใคร'],
  [/\bcall\s*list\b/gi, 'วันนี้ควรโทรหาใคร'],
  [/\btest\s*-?\s*drives?\b/gi, 'ทดลองขับ'],
  // (v1.0.1532) เพิ่มคำที่ทีมพิมพ์บ่อย
  [/\b(?:who\s+is\s+)?waiting\s+for\s+(?:the\s+)?cars?\b/gi, 'ใครรอรถ'],
  [/\btop\s+sell(?:er|ers|ing)\b/gi, 'เซลส์คนไหนขายดีสุด'],
  [/\boverdue\s+follow\s*-?\s*ups?\b/gi, 'นัดเลยกำหนด'],
  [/\bfollow\s*-?\s*ups?\s+today\b/gi, 'วันนี้ควรโทรหาใคร'],
  [/\bpending\s+finance\b/gi, 'ใครรอไฟแนนซ์'],
  [/\b(?:pending|open)\s+(?:quotations?|quotes?)\b/gi, 'ใบเสนอราคาค้างอยู่กี่ใบ'],
  [/\bfollow\s*-?\s*ups?\b/gi, 'นัดติดตาม'],
  [/\boverdue\b/gi, 'เลยกำหนด'],
  [/\bpending\b/gi, 'รอ'],
  [/\bbooths?\b/gi, 'บูธ'],
  // (v1.0.1542)
  [/\bwho\s+is\s+(?:on\s+)?leave\b|\bwho(?:'s|\s+is)?\s+off\b/gi, 'ใครลา'],
  [/\bon\s+leave\b/gi, 'ลา'],
  [/\bwho\s+is\s+late\b/gi, 'ใครมาสาย'],
  [/\b(?:today'?s?\s+appointments?|appointments?\s+today)\b/gi, 'วันนี้มีนัดอะไร'],
  [/\bappointments?\b/gi, 'นัด'],
  [/\bquotations?\b|\bquotes?\b/gi, 'ใบเสนอราคา'],
  [/\bpayroll\b|\bsalar(?:y|ies)\b/gi, 'สรุปเงินเดือน'],
  [/\bexpenses?\b/gi, 'ค่าใช้จ่าย'],
  [/\bprofit\b/gi, 'กำไร'],
  [/\bwalk\s*-?\s*ins?\b/gi, 'walk-in'],
  [/\bhot\s+leads?\b/gi, 'ลูกค้า hot'],
  [/\bnew\s+leads?\b/gi, 'ลูกค้าใหม่'],
  [/\bleads?\b/gi, 'ลูกค้า'],
  [/\bcustomers?\b/gi, 'ลูกค้า'],
  [/\bbookings?\b/gi, 'ยอดจอง'],
  [/\bdeliver(?:y|ies|ed)\b/gi, 'ส่งมอบ'],
  [/\bsales\b/gi, 'ยอดขาย'],
  [/\btarget\b/gi, 'เป้า'],
  [/\bcommissions?\b/gi, 'ค่าคอม'],
  [/\bstock\b/gi, 'สต็อก'],
  [/\bfinance\b/gi, 'ไฟแนนซ์'],
  [/\brefunds?\b/gi, 'คืนเงินจอง'],
  [/\bthis\s+month\b/gi, 'เดือนนี้'],
  [/\blast\s+month\b/gi, 'เดือนก่อน'],
  [/\bnext\s+month\b/gi, 'เดือนหน้า'],
  [/\bthis\s+week\b/gi, 'สัปดาห์นี้'],
  [/\blast\s+week\b/gi, 'สัปดาห์ที่แล้ว'],
  [/\bnext\s+week\b/gi, 'สัปดาห์หน้า'],
  [/\btoday\b/gi, 'วันนี้'],
  [/\btomorrow\b/gi, 'พรุ่งนี้'],
  [/\byesterday\b/gi, 'เมื่อวาน'],
  [/\bthis\s+year\b/gi, 'ปีนี้'],
]
const ANY = /\b(?:waiting|top|follow|overdue|pending|booths?|who|call|test|walk|hot|new|leads?|customers?|bookings?|deliver\w*|sales|target|commissions?|stock|finance|refunds?|this|last|next|today|tomorrow|yesterday|leave|off|late|appointments?|quotations?|quotes?|payroll|salar\w*|expenses?|profit|open|today's)\b/i

export function normalizeQuery(q) {
  const s = String(q ?? '')
  if (!ANY.test(s)) return s
  let out = s
  for (const [re, th] of MAP) out = out.replace(re, ` ${th} `)
  out = out.replace(/\s+/g, ' ').trim()
  // "ยอดจอง ยอดขาย" ซ้อนกันจากการแปลงคำติดกัน → เหลือคำเดียว
  return out.replace(/(ยอด(?:จอง|ขาย)) ยอด(?:จอง|ขาย)/g, '$1')
}
