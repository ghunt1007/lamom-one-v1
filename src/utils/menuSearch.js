// หาเมนูในแถบซ้าย — ชื่อเมนูส่วนใหญ่เป็นภาษาอังกฤษ จึงเติมคำไทยที่เซลส์ใช้จริงให้ค้นเจอ
// (เช่น พิมพ์ "ทดลองขับ" เจอ Test Drive, "เงินเดือน" เจอ Payroll)
const TH = [
  [/test ?drive|^td /, 'ทดลองขับ ลองขับ'], [/follow/, 'ติดตาม ตามลูกค้า'], [/finance/, 'ไฟแนนซ์ การเงิน'],
  [/commission/, 'คอมมิชชั่น ค่าคอม'], [/stock|inventory/, 'สต็อก คลังรถ'], [/pipeline|funnel/, 'ไปป์ไลน์ ยอดขาย'],
  [/dashboard|summary|overview/, 'แดชบอร์ด ภาพรวม สรุป'], [/service|job card|repair|bay|technician/, 'ซ่อม เซอร์วิส ศูนย์บริการ'],
  [/parts/, 'อะไหล่'], [/insurance|claim|policy/, 'ประกัน เคลม'], [/payroll|salary/, 'เงินเดือน'],
  [/attendance|shift|overtime/, 'เข้างาน ลงเวลา กะ โอที'], [/invoice|receipt|billing/, 'ใบแจ้งหนี้ ใบเสร็จ'],
  [/quot/, 'ใบเสนอราคา'], [/marketing|campaign|promotion/, 'การตลาด แคมเปญ โปรโมชั่น'], [/event/, 'อีเวนต์ งาน'],
  [/training|course|quiz|knowledge/, 'อบรม เรียน ความรู้'], [/report|analytics|trend/, 'รายงาน วิเคราะห์'],
  [/^tasks?$|missions/, 'งาน สิ่งที่ต้องทำ'], [/notes|minutes/, 'โน้ต บันทึก'], [/loan|installment|leasing/, 'ผ่อน สินเชื่อ งวด ค่างวด'],
  [/trade-?in|used car/, 'เทิร์น รถเก่า รถมือสอง'], [/delivery/, 'ส่งมอบ'], [/warranty/, 'รับประกัน'], [/recall/, 'เรียกคืน'],
  [/birthday/, 'วันเกิด'], [/leaderboard|badges|gamification|reward/, 'อันดับ แข่งขัน รางวัล'], [/call|inbox|comm hub|sms|broadcast|line oa|chat/, 'โทร แชท ข้อความ ส่งไลน์'],
  [/lead/, 'ลีด ลูกค้าใหม่'], [/customer|vip|loyalty|churn|clv/, 'ลูกค้า'], [/reservation|reserve/, 'จอง'],
  [/price|pricing|margin|negotiation/, 'ราคา ต่อรอง กำไร'], [/expense|petty cash/, 'ค่าใช้จ่าย เบิก'],
  [/kpi|target|goal|budget|forecast/, 'เป้า เป้าหมาย งบ'], [/setting|config|master data/, 'ตั้งค่า'], [/user|security|api key/, 'ผู้ใช้ สิทธิ์'],
  [/schedule|calendar|appt/, 'ตาราง นัด ปฏิทิน'], [/map|gps/, 'แผนที่'], [/vehicle|car|model|fleet/, 'รถ รุ่นรถ'],
  [/\bev\b|charging|battery/, 'ไฟฟ้า ชาร์จ แบตเตอรี่'], [/cash|bank|deposit|refund|payment/, 'เงินสด ธนาคาร มัดจำ คืนเงิน จ่ายเงิน'],
  [/tax|vat/, 'ภาษี'], [/p&l|profit|break-even/, 'กำไร ขาดทุน'], [/recruit|onboarding|offboarding|org chart|hr\b/, 'พนักงาน รับสมัคร'],
  [/ai|lami|coach|insight/, 'เอไอ ผู้ช่วย'], [/complaint|feedback|csat|nps|satisfaction|review|sentiment/, 'ร้องเรียน ความพึงพอใจ รีวิว'],
  [/notification|announcement/, 'แจ้งเตือน ประกาศ'], [/document|contract|template|form/, 'เอกสาร สัญญา แบบฟอร์ม'],
  [/walk-in|showroom/, 'หน้าร้าน โชว์รูม'], [/lost deal|win-back/, 'ลูกค้าหลุด ดึงกลับ'], [/referral/, 'แนะนำ'],
  [/photo/, 'รูป'], [/key/, 'กุญแจ'], [/plate/, 'ป้ายทะเบียน'], [/accessor/, 'ของแต่ง อุปกรณ์'],
]
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '')

export function menuKeywords(label, path = '') {
  const l = String(label || '').toLowerCase()
  return [label, path, ...TH.filter(([re]) => re.test(l)).map(([, th]) => th)].join(' ')
}

// ทุกคำที่พิมพ์ (แยกด้วยช่องว่าง) ต้องเจอในชื่อ/ที่อยู่/คำไทยของเมนู
export function menuMatches(label, path, q) {
  const words = String(q || '').trim().split(/\s+/).filter(Boolean).map(norm)
  if (!words.length) return true
  const hay = norm(menuKeywords(label, path))
  return words.every(w => hay.includes(w))
}
