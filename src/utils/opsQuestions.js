// (v1.0.1079) คำถามงานประจำวันที่ LAMI เคยตอบไม่ได้ (ได้แต่ลิงก์เปล่า หรือดึงรายการใบจองที่ไม่เกี่ยวมาตอบ):
//   "นัดทดลองขับวันนี้มีใครบ้าง" · "พรุ่งนี้มีใครเข้าโชว์รูม" · "มีลูกค้าทัก LINE รอตอบไหม"
//   "เรื่องร้องเรียนค้างอยู่ไหม" · "ลูกค้าใหม่เดือนนี้กี่คน" · "ใครเกิดวันนี้ / ครบรอบซื้อรถสัปดาห์นี้"
// ฟังก์ชันล้วน ทดสอบได้ · ตัวโหลดข้อมูลอยู่ใน lamiCommandCard.js (loadOpsAnswer)
import { dmy } from './format.js'
import { plateRows, deliveredOn, PLATE_LATE_DAYS } from './plateList.js'
import { carOf } from './carLabel.js'
import { nextAnniversary } from './anniversary.js'
import { lostBySeller, classifyLostReason, LOST_REASON_LABELS } from './lostReason.js'

const has = (s, re) => re.test(s)
// คำสั่งให้ทำ (นัด/บันทึก/สร้าง) ไม่ใช่คำถาม → ปล่อยให้ตัวสั่งงานจัดการ
const COMMAND = /^(นัด|บันทึก|สร้าง|เพิ่ม|ลบ|แก้|ย้าย|มอบ)(?!.*(มีใคร|กี่|ไหม|บ้าง|อะไร|เลยกำหนด|ค้าง|ที่))/

// (v1.0.1090) "ลูกค้าจากเฟสบุ๊คเดือนนี้กี่คน" → กรองตามช่องทาง (คีย์เดียวกับ quickLead QUICK_SOURCES)
const SOURCE_WORDS = [['facebook', /เฟส|เฟซ|facebook|\bfb\b/i], ['line', /ไลน์|\bline\b/i], ['tiktok', /ติ๊?กต็?อก|tiktok/i], ['instagram', /ไอจี|instagram|\big\b/i],
  ['phone', /โทรเข้า/], ['referral', /แนะนำ|บอกต่อ/], ['event', /บูธ|อีเวนต์|event/i]]
export function sourceOf(s) { const hit = SOURCE_WORDS.find(([, re]) => re.test(s)); return hit ? hit[0] : '' }

export function parseOpsSpec(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '')
  // (v1.0.1103) "นัดเข้าศูนย์บริการพรุ่งนี้" (ไม่มีชื่อลูกค้า) = ถามรายการนัด ไม่ใช่คำสั่งนัด
  const topicOnly = /^นัด\s*(?:เข้าศูนย์(?:บริการ)?|ซ่อม|เซอร์วิส|เช็คระยะ|ส่งมอบ|ส่งรถ|ทดลองขับ|ลองขับ|เข้าโชว์รูม|โชว์รูม)\s*(?:วันนี้|พรุ่งนี้|สัปดาห์นี้|อาทิตย์นี้)$/.test(s)
  if (s.length < 4 || s.length > 80 || (COMMAND.test(s) && !topicOnly)) return null
  const day = /พรุ่งนี้/.test(s) ? 'tomorrow' : 'today'
  // (v1.0.1103) "ใครยังไม่ได้ป้ายขาว" / "ลูกค้าคนไหนยังไม่ได้จดทะเบียน" / "ใครยังใช้ป้ายแดง"
  if (has(s, /ป้ายขาว|ป้ายแดง|ป้ายทะเบียน|จดทะเบียน|ทะเบียนรถ|เล่มทะเบียน|ได้ทะเบียน/) && has(s, /ยังไม่|ยังใช้|ค้าง|รอ|ใคร|คันไหน|กี่คัน|กี่คน|คนไหน|คืน|(?:หรือ|รึ)ยัง/) && !has(s, /ราคา|ค่าจด|กี่บาท|เท่าไหร่/)) return { kind: 'plate' }
  // (v1.0.1092) "ลูกค้าที่ส่งมอบเดือนที่แล้ว" / "ลูกค้าที่ซื้อรถไปแล้วปีนี้" → รายชื่อลูกค้าที่รับรถแล้ว
  if (has(s, /ส่งมอบแล้ว|ซื้อ(?:รถ)?(?:ไป)?แล้ว|ที่ส่งมอบ|รับรถ(?:ไป)?แล้ว|ออกรถ(?:ไป)?แล้ว/) && has(s, /ลูกค้า|ใคร|รายชื่อ|กี่คน/) && !has(s, /นัด|พรุ่งนี้|ยอด|เป้า/))
    return { kind: 'delivered', period: /เดือน(?:ก่อน|ที่แล้ว)/.test(s) ? 'prevmonth' : /ปี/.test(s) ? 'year' : /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 'week' : 'month' }
  // (v1.0.1118) "วันนี้ฉันโทรไปกี่คนแล้ว" / "เมื่อวานโทรไปกี่สาย" / "ทีมโทรไปกี่สายวันนี้" → นับจากบันทึกผลการโทรในแอป
  if (has(s, /โทร\s*(?:ไป|ออก)?\s*(?:หา)?\s*(?:ลูกค้า)?\s*(?:ไป|ได้)?\s*(?:แล้ว)?\s*กี่\s*(?:สาย|คน|ครั้ง|ราย)|ยอดโทร|จำนวนสาย|โทรไปแล้วกี่/) && !has(s, /ควร|ต้อง|นัด|ค่าโทร/))
    return { kind: 'calls', day: /เมื่อวาน/.test(s) ? 'yesterday' : /สัปดาห์|อาทิตย์|7\s*วัน/.test(s) ? 'week' : /เดือนนี้/.test(s) ? 'month' : 'today', team: has(s, /ทีม|แต่ละคน|รายคน|ใครโทร|เซลส์/) }
  // (v1.0.1092) "ลูกค้าของฉันมีกี่คน" → สรุปลูกค้าในมือตามขั้น/ความร้อน
  if (has(s, /ลูกค้า\s*(?:ของ)?\s*(?:ฉัน|ผม|หนู|เรา|ตัวเอง)|ลูกค้าที่(?:ฉัน|ผม)?ดูแล|ลูกค้าในมือ|ลูกค้าทั้งหมด|(?:ฉัน|ผม|หนู|เรา)\s*มี\s*ลูกค้า/) && has(s, /กี่|สรุป|เท่าไ|มีเท่า|ภาพรวม/) && !has(s, /ใหม่|เพิ่ง|เดือน|สัปดาห์|วันนี้|เมื่อวาน/)) return { kind: 'mycust' }
  // (v1.0.1092) "ลูกค้าที่ยังไม่มีเบอร์โทร" → ข้อมูลที่ต้องเติม
  if (has(s, /(?:ไม่มี|ยังไม่มี|ไม่ได้ใส่|ยังไม่ได้ใส่|ขาด)\s*เบอร์|เบอร์\s*(?:ว่าง|หาย)/) && !has(s, /^(?:เพิ่ม|ใส่|แก้)/)) return { kind: 'nophone' }
  // (v1.0.1092) "ลูกค้าคนไหนมีโอกาสปิดสูงสุด"
  if (has(s, /โอกาส(?:ปิด)?(?:การขาย)?\s*(?:สูง|มาก|เยอะ|ดี)|ใกล้ปิด|น่าจะปิด|มีแวว(?:ปิด|ซื้อ)|ปิดง่าย|พร้อมซื้อ|ใกล้(?:จะ)?ตัดสินใจ|ใกล้(?:จะ)?ซื้อ/)) return { kind: 'topscore' }
  // (v1.0.1111) "เหตุผลที่ลูกค้าไม่ซื้อ" / "ลูกค้าไม่ซื้อเพราะอะไร" = สรุปดีลที่หลุด
  if (has(s, /(?:เหตุผล|สาเหตุ).{0,12}(?:ไม่ซื้อ|ไม่จอง|ไม่เอา|เสียดีล|หลุด)|(?:ไม่ซื้อ|ไม่จอง)\s*(?:เพราะ|เพราะอะไร|ทำไม)/) && !has(s, /บันทึก/)) return { kind: 'lost', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  if (has(s, /เสียดีล|เสียลูกค้า|lost|ปิดไม่ได้|หลุด/i) && !has(s, /บันทึก/) && has(s, /ใคร|กี่|บ้าง|เดือน|สัปดาห์|อาทิตย์|ปีนี้|สรุป|ทำไม|เหตุผล|เพราะ|รายชื่อ|ยอด/)) return { kind: 'lost', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  // (v1.0.1090) "ยอดจองวันนี้" / "เมื่อวานปิดได้กี่คัน" / "สัปดาห์นี้มีใครจองบ้าง"
  if (has(s, /ยอดจอง|จองใหม่|ใบจองใหม่|เพิ่งจอง|ลูกค้า(?:ที่)?จอง(?!แล้วยัง)|ปิดการขาย|ปิดได้|ปิดดีล|ใครจอง|มีคนจอง|จองกี่|จองไป|จองได้/) && has(s, /วันนี้|เมื่อวาน|สัปดาห์|อาทิตย์|7 วัน/) && !has(s, /ส่งมอบ|ทดลองขับ|ลองขับ/)) return { kind: 'bookday', day: /เมื่อวาน/.test(s) ? 'yesterday' : /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 'week' : 'today' }
  // (v1.0.1091) "ใครถอนจองเดือนนี้" / "เดือนนี้ถอนจองกี่ใบ"
  if (has(s, /ถอนจอง|ยกเลิกจอง|ถอนใบจอง|ยกเลิกใบจอง|ถอนการจอง|ยกเลิกการจอง|จอง(?:แล้ว)?(?:แต่)?\s*(?:ถอน|ยกเลิก)/) && !has(s, /^(?:ถอน|ยกเลิก)/)) return { kind: 'withdrawn', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  // (v1.0.1091) "ลูกค้าที่นัดแล้วไม่มา" (นัดโชว์รูม + ทดลองขับที่บันทึกว่าไม่มา)
  if (has(s, /ไม่มา(?:ตามนัด)?|no\s*-?\s*show|เบี้ยวนัด|ผิดนัด/i) && !has(s, /ทำไม|มาถึง|รถ(?:คัน)?(?:ไหน|ยัง)|ได้รถ|ใบสั่ง|สั่งรถ|รถที่สั่ง/)) return { kind: 'noshow', range: /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 7 : 30 }
  // (v1.0.1091) "เซลส์คนไหนยังไม่มีใบจองเดือนนี้"
  if (has(s, /เซลส์|เซล|พนักงานขาย|ลูกทีม|ใครใน(?:ทีม)?|ทีม\s*(?:ฉัน|ผม|เรา)?\s*ใคร/) && has(s, /ยังไม่(?:มี|ได้)?\s*(?:ใบ)?จอง|ยังไม่มียอด|ไม่มียอด|ยังไม่ปิด(?:การขาย|ได้)?|ยังไม่ได้ขาย|ขายไม่ได้/)) return { kind: 'nobookseller' }
  // (v1.0.1091) "ไฟแนนซ์ไหนอนุมัติเยอะสุด" / "ยื่นไฟแนนซ์ที่ไหนบ่อยสุด"
  if (has(s, /ไฟแนนซ์|แบงก์|ธนาคาร|ลีสซิ่ง/) && has(s, /ไหน|อันดับ|เยอะ|มากสุด|บ่อย|สรุป|ผ่านกี่|อนุมัติกี่|เปอร์เซ็นต์|%/) && !has(s, /ดอกเบี้ย|ผ่อน|ดาวน์|งวด|รอ(?:ผล)?\s*ไฟแนนซ์|ใคร|ใบจองไหน|ใบไหน|ยังไม่(?:ได้)?\s*(?:ผ่าน|อนุมัติ)/)) return { kind: 'finbank' }
  if (has(s, /รายได้|ค่าคอม/) && has(s, /ยังไม่กรอก|ไม่ได้กรอก|ค้างกรอก|ยังไม่ใส่|ขาด/)) return { kind: 'income' }
  if (has(s, /ส่งมอบ/) && has(s, /เดือนหน้า/) && !has(s, /ยอด|เป้า/)) return { kind: 'delivery', day: 'nextmonth' }
  // (v1.0.1117) "ใครจะส่งมอบเดือนนี้" / "ลูกค้าที่จะออกรถเดือนนี้" → นัดส่งมอบที่เหลือของเดือนนี้ (ไม่ใช่ยอดที่ส่งไปแล้ว)
  if (has(s, /ส่งมอบ|ออกรถ|รับรถ/) && has(s, /เดือนนี้/) && has(s, /จะ|นัด|กำหนด|ที่เหลือ/) && !has(s, /ยอด|เป้า|แล้ว(?!ยัง)/)) return { kind: 'delivery', day: 'restmonth' }
  if (has(s, /ส่งมอบ/) && !has(s, /ยอด|เป้า|เดือน|ปีนี้|ทั้งปี|ปีก่อน|ปีที่แล้ว|ประเมิน|พึงพอใจ|แบบสอบถาม|รีวิว|ยังไม่(?:ได้)?\s*นัด|ไม่ได้นัด/) && has(s, /วันนี้|พรุ่งนี้|สัปดาห์|อาทิตย์|นัด|ใคร|กี่คัน|ไหม/)) return { kind: 'delivery', day: /พรุ่งนี้/.test(s) ? 'tomorrow' : /สัปดาห์หน้า|อาทิตย์หน้า/.test(s) ? 'nextweek' : /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 'week' : 'today' }
  if (has(s, /ช่องทาง|ที่มา|มาจาก/) && has(s, /ลูกค้า|ลีด|lead/i)) return { kind: 'newcust', ...(sourceOf(s) ? { source: sourceOf(s) } : {}), period: /สัปดาห์|อาทิตย์/.test(s) ? 'week' : /เดือนก่อน|เดือนที่แล้ว/.test(s) ? 'prevmonth' : 'month' }
  // (v1.0.1094) "เคลมประกันค้างกี่เรื่อง" (เคลมประกันภัยรถยนต์ ไม่ใช่เคลมรับประกันศูนย์)
  if (has(s, /เคลม/) && !has(s, /รับประกัน|วอร์แรนตี|warranty/i)) return { kind: 'claim' }
  // (v1.0.1094) "อะไหล่ไหนใกล้หมด" (ไม่ใช่ "รถรออะไหล่")
  if (has(s, /อะไหล่|parts?\b/i) && has(s, /ใกล้หมด|หมด|ต่ำ|เหลือน้อย|ต้องสั่ง|ควรสั่ง|ขาด|สต็อก|สต๊อก|คงเหลือ/) && !has(s, /รออะไหล่|ราคา/)) return { kind: 'parts' }
  // (v1.0.1094) "รายได้ศูนย์บริการเดือนนี้"
  if (has(s, /รายได้|ยอด/) && has(s, /ศูนย์บริการ|งานซ่อม|เซอร์วิส|service|ซ่อม/i) && !has(s, /ค้าง|รอ/)) return { kind: 'servicerev', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  // (v1.0.1094) "เมื่อวานมีอะไรเกิดขึ้นบ้าง" / "สรุปเมื่อวาน"
  if (has(s, /เมื่อวาน/) && has(s, /มีอะไร|เกิดอะไร|สรุป|เป็นไง|ภาพรวม|ทำอะไร/) && !has(s, /walk|ร้องเรียน|จอง|ส่งมอบ/i)) return { kind: 'yesterday' }
  // (v1.0.1094) "ลูกค้าที่ควรขอให้แนะนำเพื่อน"
  if (has(s, /แนะนำ(?:เพื่อน|ต่อ|คนอื่น)|บอกต่อ|referral/i) && has(s, /ควร|ขอ|ใคร|ลูกค้า/) && !has(s, /มาจาก|จากการ|ใหม่/)) return { kind: 'referask' }
  // (v1.0.1094) "ออกบูธครั้งไหนได้ลีดเยอะสุด" / "อีเวนต์ไหนคุ้มสุด"
  if (has(s, /บูธ|อีเวนต์|event|งานแสดง|มอเตอร์โชว์|motor\s*(?:show|expo)/i) && has(s, /ไหน|อันดับ|เยอะ|มากสุด|คุ้ม|ดีสุด|สรุป|ผล/) && !has(s, /ลูกค้าจาก|ลีดจาก/)) return { kind: 'eventbest' }
  // (v1.0.1094) "แคมเปญไหนได้ลูกค้าเยอะสุด" (แคมเปญในใบจอง เช่น ดอกเบี้ยพิเศษ/ฟรีดาวน์)
  if (has(s, /แคมเปญ|campaign/i) && has(s, /ไหน|อันดับ|เยอะ|มากสุด|ดีสุด|สรุป|ได้ผล/)) return { kind: 'campaignbest' }
  // (v1.0.1087) "ประกันภัยใครใกล้หมด / ลูกค้าที่ประกันจะหมดเดือนนี้" (ประกันรถยนต์/พ.ร.บ.) · "รับประกันรถคันไหนใกล้หมด" (warranty)
  if (has(s, /รับประกัน|วอร์แรนตี|warranty/i) && has(s, /หมด|ครบ|ใกล้/)) return { kind: 'warranty', range: /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 7 : /3 เดือน|90 วัน/.test(s) ? 90 : 30 }
  if (has(s, /ประกัน|พ\.?ร\.?บ|กรมธรรม์/) && has(s, /หมด|ต่อ|ครบ|ใกล้/) && !has(s, /เคลม|ซ่อม/)) return { kind: 'insurance', range: /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 7 : /3 เดือน|90 วัน/.test(s) ? 90 : 30 }
  // (v1.0.1086) "เตือนเข้าศูนย์เดือนนี้มีใครบ้าง" / "ใครครบระยะเช็ค" → รายการเตือนเข้าศูนย์ (ไม่ใช่นัดวันนี้)
  if (has(s, /เตือนเข้าศูนย์|ครบระยะ|ถึงระยะ|ครบกำหนดเข้าศูนย์|ถึงกำหนดเข้าศูนย์|ต้องเข้าศูนย์|(?:ใกล้|ถึง|ครบ)\s*(?:รอบ|กำหนด)?\s*(?:เช็ค|เช็ก)\s*ระยะ|ใกล้เข้าศูนย์/)) return { kind: 'reminder', range: /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 7 : 30 }
  // (v1.0.1086) "งานที่เลยกำหนดมีอะไรบ้าง" → งานในปฏิทินที่เลยวันแล้วยังไม่ได้ทำ (เงื่อนไขเดียวกับปฏิทินงาน)
  if (has(s, /เลยกำหนด|เกินกำหนด|เลยวันนัด|ตกค้าง|^(?:มี)?งานค้าง|งานที่ค้าง|ค้างทำ|งาน.{0,10}ค้าง(?:จาก)?(?:เมื่อวาน|อยู่)|ค้างจากเมื่อวาน/) && !has(s, /ร้องเรียน|ซ่อม|ประกัน|ผ่อน|ชำระ|ไฟแนนซ์|ส่งมอบ|รับรถ|ส่งรถ/)) return { kind: 'overdue' }
  // (v1.0.1082) งานศูนย์บริการ: "รถเข้าศูนย์วันนี้กี่คัน" / "งานซ่อมค้างอยู่กี่งาน" / "รถรออะไหล่มีคันไหน"
  if (has(s, /เข้าศูนย์|นัดซ่อม|นัดเซอร์วิส|นัดเช็คระยะ|เช็คระยะ|งานซ่อม|ใบสั่งซ่อม|job\s*card|รถซ่อม|ซ่อมค้าง|รออะไหล่|ซ่อมเสร็จ/i) && !has(s, /ราคา|ค่าซ่อม|กี่บาท|เท่าไหร่/)) return { kind: 'service', day: /เดือนนี้/.test(s) ? 'month' : /สัปดาห์นี้|อาทิตย์นี้|7\s*วัน/.test(s) ? 'week' : day }
  // (v1.0.1082) "ลูกค้าที่ยังไม่มีผู้ดูแลมีใครบ้าง"
  if (has(s, /(?:ยังไม่มี|ไม่มี|ไร้)\s*(?:ผู้ดูแล|คนดูแล|เซลส์ดูแล|เซลส์)|ยังไม่(?:ได้)?(?:มอบ|แจก|แบ่ง)|ยังไม่มีเจ้าของ/) && has(s, /ลูกค้า|ลีด|lead/i)) return { kind: 'unassigned' }
  // (v1.0.1087) "วันนี้มีลูกค้า walk in กี่คน" / "เมื่อวานมีคนเดินเข้าโชว์รูมกี่คน"
  if (has(s, /walk\s*-?\s*in|วอล์?คอิน|เดินเข้า/i)) return { kind: 'walkin', day: /เมื่อวาน/.test(s) ? 'yesterday' : /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 'week' : /เดือน/.test(s) ? 'month' : 'today' }
  // (v1.0.1099) "ความพึงพอใจลูกค้าเดือนนี้" / "ลูกค้าคนไหนให้คะแนนต่ำ" / "NPS เดือนนี้"
  if (has(s, /ความพึงพอใจ|พอใจ(?:ไหม|มั้ย|แค่ไหน)|คะแนน(?:ความ)?(?:ต่ำ|พอใจ|ประเมิน|รีวิว)|ให้คะแนน|\bnps\b|\bcsat\b|แบบสำรวจ|ผลสำรวจ|รีวิว(?:ใหม่|ลูกค้า)?|ไม่พอใจ/i) && !has(s, /ร้องเรียน|^(?:บันทึก|เพิ่ม)/)) return { kind: 'csat', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s), low: /ต่ำ|ไม่พอใจ|แย่|น้อย/.test(s) }
  // (v1.0.1113) "รถคันไหนขายได้กำไรน้อยสุด" / "รุ่นไหนกำไรดีสุด" → จัดอันดับกำไรรายคัน (เฉพาะคันที่ใส่ต้นทุนจริง)
  if (has(s, /กำไร/) && has(s, /คันไหน|รุ่นไหน|รายคัน/) && has(s, /น้อย|ต่ำ|มาก|สูง|ดี|เยอะ|อันดับ|เท่าไ/) && !has(s, /ดาวน์|ผ่อน|ค่าคอม|ลูกค้า/)) return { kind: 'profit', perUnit: true, low: has(s, /น้อย|ต่ำ|ขาดทุน/), ...(has(s, /รุ่นไหน/) ? { byModel: true } : {}), prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  // (v1.0.1117) "ค่าการตลาดเดือนนี้" / "ต้นทุนต่อลีดเท่าไหร่" → ค่าโฆษณาที่ใส่ไว้ + ค่าบูธที่ใช้จริง ÷ ลูกค้าใหม่ (ไม่ใช่ค่าใช้จ่ายเบิก)
  if (has(s, /ค่า(?:ใช้จ่าย)?(?:การ)?ตลาด|ค่าโฆษณา|ค่า(?:ยิง)?แอด|งบ(?:การ)?ตลาด|งบโฆษณา|ต้นทุน\s*(?:ต่อ|หา)\s*(?:ลีด|ลูกค้า|lead)|\bcac\b|\bcpl\b|cost\s*per\s*lead|ลีดละ/i) && !has(s, /^(?:ใส่|บันทึก|เพิ่ม|แก้)/))
    return { kind: 'mktspend', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  // (v1.0.1098) "ค่าใช้จ่ายเดือนนี้เท่าไหร่" / "กำไรเดือนนี้เท่าไหร่" (ภาพรวมโชว์รูม · เฉพาะผู้จัดการ/เจ้าของ)
  if (has(s, /กำไร|ขาดทุน|p\s*&\s*l|ค่าใช้จ่าย|รายจ่าย|ใช้เงินไป/i) && !has(s, /ต่อคัน|คันละ|รุ่น|ลูกค้า|ดาวน์|ผ่อน|ค่าคอม|อะไหล่|ศูนย์บริการ|ซ่อม|เบิก(?:ได้|ยังไง)/) && !has(s, /^(?:เพิ่ม|บันทึก|เบิก)/))
    return { kind: has(s, /กำไร|ขาดทุน|p\s*&\s*l/i) ? 'profit' : 'expense', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  // (v1.0.1097) "ใครลางานวันนี้" / "พรุ่งนี้มีใครลาบ้าง"
  // (v1.0.1116) "ลูกค้าซ้ำมีไหม" / "มีลูกค้าเบอร์ซ้ำไหม"
  if (has(s, /(?:ลูกค้า|ลีด|รายชื่อ|เบอร์|ชื่อ)\s*(?:ที่)?\s*ซ้ำ|ซ้ำกัน|บันทึกซ้ำ|duplicate/i) && !has(s, /ป้ายแดง|ใบจอง|ป้าย/)) return { kind: 'dup' }
  // (v1.0.1114) "ลูกค้าคนไหนค้างจ่าย" (ลูกหนี้ที่บันทึกไว้) · "ลูกค้าที่รอคืนเงินมัดจำ" (ถอนจองแล้วยังไม่คืนเงิน)
  if (has(s, /คืนเงิน|คืนมัดจำ|รอคืน|ยังไม่(?:ได้)?คืน/) && !has(s, /บันทึก|ขอคืน(?:ได้)?ไหม/)) return { kind: 'refund' }
  if (has(s, /ค้างจ่าย|ค้างชำระ|ลูกหนี้|หนี้ค้าง|ยังไม่จ่ายเงิน|ติดหนี้/) && !has(s, /ค่างวด|งวด|ผ่อน|ดาวน์|มัดจำ|ไฟแนนซ์/)) return { kind: 'debt' }
  // (v1.0.1113) "ดอกเบี้ย floor plan เดือนนี้" / "ภาระดอกเบี้ยรถในสต็อก"
  if (has(s, /floor\s*plan|ฟลอร์\s*แพลน|ฟลอแพลน|ดอกเบี้ย(?:รถ)?\s*(?:ใน)?\s*สต็อก|ดอกเบี้ยสต็อก/i)) return { kind: 'floorplan' }
  // (v1.0.1112) "ใครมาสายวันนี้" / "วันนี้ใครยังไม่ลงเวลา" → ตารางลงเวลาวันนี้
  if (has(s, /มาสาย|เข้างานสาย|ยังไม่(?:ได้)?\s*(?:ลงเวลา|เข้างาน|สแกน)|ขาดงาน|ใครไม่มาทำงาน|ลงเวลา(?:เข้างาน)?\s*(?:กี่คน|ครบ|ยัง)/) && !has(s, /ลูกค้า|ส่งมอบ|ไฟแนนซ์/)) return { kind: 'late' }
  if (has(s, /ลา(?:งาน|ป่วย|กิจ|พักร้อน|หยุด)|ใครลา|มีคนลา|ลากี่คน|ขอลา|หยุดงาน|พนักงาน\s*(?:ที่)?\s*ลา|ลา\s*(?:วันนี้|พรุ่งนี้|สัปดาห์นี้)\s*(?:มี)?\s*(?:ใคร|กี่)/) && !has(s, /^(?:ขอ)?ลา(?:งาน|ป่วย|กิจ)?\s*(?:พรุ่งนี้|วันที่|\d)/)) return { kind: 'leave', day: /พรุ่งนี้/.test(s) ? 'tomorrow' : /เดือนนี้/.test(s) ? 'month' : /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 'week' : 'today' }
  // (v1.0.1097) "รถที่กำลังจะมาถึงมีกี่คัน" / "รถสั่งไว้มาเมื่อไหร่"
  // (v1.0.1107) "รถเข้าใหม่สัปดาห์นี้" / "เดือนนี้รับรถเข้าสต็อกกี่คัน"
  if (has(s, /รถ(?:เข้า|มา)(?:ใหม่|แล้ว)|รถ(?:ที่)?เพิ่ง(?:เข้า|มา)|รับรถเข้า(?:สต็อก|สต๊อก)?|เข้าสต็อก|เข้าสต๊อก|รถล็อตใหม่/) && !has(s, /ลูกค้า|ศูนย์|ซ่อม|เมื่อไหร่|กำลัง/)) return { kind: 'arrived', days: /เดือน/.test(s) ? 'month' : /วันนี้/.test(s) ? 1 : 7 }
  if (has(s, /กำลัง(?:จะ)?มา(?:ถึง)?|กำลังขนส่ง|ระหว่างขนส่ง|รถ(?:ที่)?สั่ง(?:ไว้)?|รถจะเข้า|รถเข้าเมื่อไหร่|รถมาเมื่อไหร่|ใบสั่ง(?:ซื้อ)?รถ|สั่งรถ(?:ไป)?กี่คัน/) && !has(s, /ลูกค้า|ใคร(?:รอ|จอง)|อะไหล่/)) return { kind: 'incoming' }
  // (v1.0.1097) "รถรุ่นไหนเหลือน้อย" / "รุ่นไหนควรสั่งเพิ่ม"
  if (has(s, /รุ่นไหน|รุ่นอะไร|คันไหน|ควรสั่ง|ต้องสั่ง/) && has(s, /เหลือน้อย|ใกล้หมด|หมดสต็อก|หมดสต๊อก|ขาดสต็อก|ขาดสต๊อก|สั่งเพิ่ม|ควรสั่ง|ต้องสั่ง|ไม่พอ/) && !has(s, /อะไหล่/)) return { kind: 'lowstock' }
  // (v1.0.1097) "ลูกค้าที่ไม่ได้รับสายมีใครบ้าง" → โทรแล้วไม่รับสาย (14 วันล่าสุด) ที่ยังติดต่อไม่ได้
  if (has(s, /ไม่(?:ได้)?รับสาย|โทรไม่ติด|ติดต่อไม่ได้|ไม่รับโทรศัพท์/) && has(s, /ใคร|บ้าง|กี่|รายชื่อ|คนไหน/)) return { kind: 'noanswer' }
  // (v1.0.1097) "เซลส์คนไหนมีลูกค้า hot เยอะสุด" / "ลูกค้า hot แต่ละเซลส์"
  if (has(s, /hot|ร้อน/i) && has(s, /เซลส์|เซล|พนักงานขาย|แต่ละคน|รายคน|ใครมี|ของทีม|ในทีม|ทีม(?:ฉัน|ผม|เรา)/) && (has(s, /เยอะ|มากสุด|มากที่สุด|กี่คน|แต่ละ|อันดับ|รายคน|แยก/) || has(s, /(?:ของ|ใน)\s*ทีม|ทีม\s*(?:ฉัน|ผม|เรา)/))) return { kind: 'hotbyseller' }
  // (v1.0.1097) "รถคันไหนยังไม่ได้ทำ PDI" / "PDI ค้างกี่คัน"
  if (has(s, /pdi|ตรวจ(?:สภาพ)?รถก่อนส่งมอบ|ตรวจรถใหม่/i) && !has(s, /^(?:สร้าง|เพิ่ม|บันทึก)/)) return { kind: 'pdi' }
  // (v1.0.1096) "ลูกค้าคนไหนคุยนานแล้วยังไม่ปิด" → ลูกค้าที่ยังไม่จอง เรียงจากคุยนานสุด
  // (v1.0.1108) "ลูกค้าหายไปนานที่สุด" / "ใครเงียบหายไปนาน"
  if (has(s, /หายไป(?:นาน)?|หายเงียบ|เงียบหาย|เงียบนาน|ไม่ได้(?:คุย|ติดต่อ)(?:กัน)?นาน/) && has(s, /ลูกค้า|ใคร|คนไหน/) && !has(s, /^(?:นัด|บันทึก)/)) return { kind: 'stale' }
  if (has(s, /คุยนาน|ตามนาน|ค้างนาน|นานแล้ว|ยืดเยื้อ|ลากยาว/) && has(s, /ยังไม่(?:ได้)?\s*(?:ปิด|จอง|ซื้อ|ตัดสินใจ)|ไม่ปิด|ไม่จอง/) && !has(s, /ใบจอง|ไฟแนนซ์|ส่งมอบ/)) return { kind: 'stale' }
  // (v1.0.1096) "ใครมีรถเก่ามาเทิร์น" / "รถเทิร์นค้างประเมินกี่คัน"
  if (has(s, /เทิร์น|trade\s*-?\s*in|รถเก่า(?:มา)?(?:แลก|เทิร์น|ขาย)/i) && !has(s, /ราคา|ประเมินราคา(?!.*(?:กี่|ใคร|ไหน))|เท่าไหร่|ได้กี่บาท/)) return { kind: 'tradein', ...(/เดือนนี้/.test(s) ? { month: true } : {}) }
  // (v1.0.1096) "อัตราปิดการขายเดือนนี้" / "ปิดการขายเฉลี่ยกี่วัน"
  if (has(s, /อัตรา(?:การ)?(?:ปิด|จอง|ขาย)|conversion|close\s*rate|ปิด(?:การขาย|ได้)?\s*(?:เฉลี่ย|กี่\s*%|กี่เปอร์เซ็นต์)|เฉลี่ย(?:กี่วัน|.*วันปิด)|กี่วัน(?:ถึง|กว่าจะ)(?:ปิด|จอง)/i)) return { kind: 'closerate', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  // (v1.0.1095) "ลูกค้าคนไหนยังไม่ได้ทำใบเสนอราคา"
  if (has(s, /ใบเสนอ|quotation/i) && has(s, /ยังไม่(?:ได้|มี)?\s*(?:ทำ|ออก|มี|ให้|ส่ง)|ไม่มีใบเสนอ|ไม่เคย(?:ได้)?(?:ทำ|ออก)?\s*ใบเสนอ/) && has(s, /ลูกค้า|ใคร|คนไหน|รายชื่อ/)) return { kind: 'noquote' }
  // (v1.0.1095) "ใครจองรุ่น S05 บ้าง" / "เดือนนี้จอง AION V กี่ใบ"
  if (has(s, /จอง/) && has(s, /ใคร|กี่|บ้าง|รายชื่อ|คนไหน/) && !has(s, /ถอน|ยกเลิก|ยังไม่/)) {
    const m = s.replace(/\b(?:hot|warm|cold|line|walk\s*-?\s*in|vin|facebook|fb|tiktok|ig|instagram|lead|lami|ai|vip|ok)\b/gi, ' ').match(/[A-Za-z][A-Za-z0-9\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9\-]*)*/)
    if (m && m[0].replace(/\W/g, '').length >= 2) return { kind: 'bookmodel', model: m[0].trim(), period: /เดือนนี้/.test(s) ? 'month' : /ปีนี้/.test(s) ? 'year' : 'all' }
  }
  // (v1.0.1095) "ลูกค้าคนไหนยังไม่ได้ทดลองขับ" → ลูกค้าที่กำลังคุย (ยังไม่จอง) ที่ไม่มีประวัติทดลองขับเลย
  if (has(s, /ยังไม่(?:ได้|เคย)?\s*(?:นัด\s*)?(?:ทดลอง|ลอง)\s*ขับ|ไม่เคย(?:ทดลอง|ลอง)\s*ขับ|ไม่ได้(?:ทดลอง|ลอง)\s*ขับ/) && !has(s, /^(?:นัด|บันทึก)/)) return { kind: 'notd' }
  // (v1.0.1090) "ลูกค้าที่ทดลองขับแล้วยังไม่จอง" → รายชื่อที่ควรตามต่อ (ไม่ใช่นัดวันนี้)
  if (has(s, /ทดลองขับ|ลองขับ|test\s*drive|เทสไดร(?:ฟ|ว)์?/i) && has(s, /ยังไม่(?:ได้)?(?:จอง|ซื้อ|ปิด)|ไม่จอง|ไม่ซื้อ|แล้วไม่/)) return { kind: 'tdnobook', range: /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 7 : /3 เดือน|90 วัน/.test(s) ? 90 : 30 }
  // (v1.0.1117) "เดือนนี้มีเทสไดรฟ์กี่ครั้ง" → สรุปทั้งเดือน · "สัปดาห์นี้" → นัด 7 วันข้างหน้า
  if (has(s, /ทดลองขับ|ลองขับ|test\s*drive|เทสไดร(?:ฟ|ว)์?/i) && !(has(s, /แล้ว(?:หรือ)?ยัง|รึยัง|หรือยัง|เคย/) && !has(s, /ใคร|กี่|บ้าง|มีใคร/)))
    return { kind: 'testdrive', day: /เดือนนี้/.test(s) ? 'month' : /สัปดาห์|อาทิตย์|7\s*วัน/.test(s) ? 'week' : day }
  // (v1.0.1091) "ลูกค้ามาโชว์รูมเดือนนี้กี่คน" → นับ walk-in ตามช่วง (นัดโชว์รูมดูได้ทีละวัน)
  if (has(s, /โชว์รูม|showroom/i) && has(s, /เดือน|สัปดาห์|อาทิตย์|7 วัน/) && !has(s, /นัด/)) return { kind: 'walkin', day: /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 'week' : 'month' }
  if ((has(s, /โชว์รูม|showroom/i) && has(s, /นัด|เข้า|มา/)) || has(s, /นัด\s*(?:มา)?\s*ดูรถ|มาดูรถ/)) return { kind: 'showroom', day: /สัปดาห์|อาทิตย์|7\s*วัน/.test(s) ? 'week' : day }
  if (has(s, /line|ไลน์|แชท|แชต|ทัก/i) && (has(s, /รอ|ยังไม่ตอบ|ค้าง|ตอบ/) || (has(s, /ลูกค้า|ใคร/) && has(s, /วันนี้|ทักมา|ทักเข้า|เข้ามา/)))) return { kind: 'line' }
  if (has(s, /ร้องเรียน|complain/i)) return { kind: 'complaint' }
  if (has(s, /วันเกิด|เกิดวันนี้|เกิดเดือนนี้|ครบรอบ|(?:รับรถ|ซื้อรถ|ออกรถ)\s*(?:มา)?\s*ครบ\s*\d*\s*ปี/)) return { kind: 'anniv', ...(/เดือนหน้า/.test(s) ? { nextMonth: true } : {}), range: /เดือน/.test(s) ? 30 : /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 7 : 0 }
  if (has(s, /(ลูกค้า|ลีด|lead)\s*(?:ใหม่|เข้า|(?:ที่)?(?:มา)?จาก|(?:ที่)?เพิ่ง(?:เพิ่ม|เข้า|ลง))|ได้\s*(?:ลูกค้า|ลีด|lead)|(?:ลูกค้า|ลีด).{0,10}เพิ่ง\s*(?:ได้|เข้า|เพิ่ม)/i) && has(s, /เดือน|สัปดาห์|อาทิตย์|กี่คน|กี่ราย|วันนี้|เมื่อวาน|ไหม|มั้ย|บ้าง/) && !(has(s, /วันนี้/) && has(s, /มีใคร|ใครบ้าง|รายชื่อ/))) return { kind: 'newcust', ...(sourceOf(s) ? { source: sourceOf(s) } : {}), period: /เมื่อวาน/.test(s) ? 'yesterday' : /วันนี้/.test(s) ? 'today' : /สัปดาห์|อาทิตย์/.test(s) ? 'week' : /เดือนก่อน|เดือนที่แล้ว/.test(s) ? 'prevmonth' : 'month' }
  return null
}

function addDays(iso, n) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000)
  return d.toISOString().slice(0, 10)
}
const ymd = v => {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 10)
  const ms = typeof v.toMillis === 'function' ? v.toMillis() : v.seconds ? v.seconds * 1000 : v instanceof Date ? v.getTime() : NaN
  return Number.isFinite(ms) ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : ''
}
const alive = rows => (rows || []).filter(r => r && !r.deleted)
const MAX = 8
const more = (n) => n > MAX ? [`…และอีก ${n - MAX} ราย`] : []
const nm = c => String(c?.name || [c?.firstName, c?.lastName].filter(Boolean).join(' ') || c?.customerName || c?.custName || 'ลูกค้า').trim()
const dayWord = day => day === 'tomorrow' ? 'พรุ่งนี้' : 'วันนี้'

export function testDriveAnswer(rows, { today, day = 'today' }) {
  if (day === 'month') {
    const from = today.slice(0, 8) + '01'
    const ml = alive(rows).filter(t => ymd(t.date) >= from && ymd(t.date) <= today && !['cancelled', 'canceled'].includes(t.status))
    if (!ml.length) return { n: 0, text: `🚗 เดือนนี้ (${dmy(from)}–${dmy(today)}) ยังไม่มีการทดลองขับ` }
    const done = ml.filter(t => ['completed', 'done'].includes(t.status)).length, miss = ml.filter(t => ['no_show', 'noshow'].includes(t.status)).length
    const byModel = {}; ml.forEach(t => { const m = String(t.model || '').trim(); if (m) byModel[m] = (byModel[m] || 0) + 1 })
    const top = Object.entries(byModel).sort((a, b) => b[1] - a[1]).slice(0, 3)
    return { n: ml.length, text: [`🚗 ทดลองขับเดือนนี้ ${ml.length} ครั้ง (${dmy(from)}–${dmy(today)})`,
      `✅ ขับแล้ว ${done}${miss ? ` · ❌ ไม่มา ${miss}` : ''} · ⏳ รอ/อื่นๆ ${ml.length - done - miss}`,
      ...(top.length ? ['🚘 รุ่นที่ขับมากสุด: ' + top.map(([m, n]) => `${m} ${n}`).join(' · ')] : [])].join('\n') }
  }
  if (day === 'week') {
    const to = addDays(today, 6)
    const wl = alive(rows).filter(t => ymd(t.date) >= today && ymd(t.date) <= to && ['scheduled', 'confirmed', 'in_progress', ''].includes(t.status || ''))
      .sort((a, b) => (ymd(a.date) + (a.time || '')).localeCompare(ymd(b.date) + (b.time || '')))
    if (!wl.length) return { n: 0, text: `🚗 7 วันนี้ (${dmy(today)}–${dmy(to)}) ไม่มีนัดทดลองขับ` }
    return { n: wl.length, text: [`🚗 นัดทดลองขับ 7 วันนี้ — ${wl.length} ราย`, ...wl.slice(0, MAX).map(t => `• ${dmy(ymd(t.date)).slice(0, 5)} ${t.time ? String(t.time).slice(0, 5) + ' ' : ''}${nm(t)}${t.model ? ' · ' + t.model : ''}`), ...more(wl.length)].join('\n') }
  }
  const date = day === 'tomorrow' ? addDays(today, 1) : today
  const list = alive(rows).filter(t => ymd(t.date) === date && ['scheduled', 'confirmed', 'in_progress', ''].includes(t.status || ''))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  if (!list.length) return { text: `🚗 ${dayWord(day)} (${dmy(date)}) ไม่มีนัดทดลองขับ`, n: 0 }
  return { n: list.length, text: [`🚗 นัดทดลองขับ${dayWord(day)} ${dmy(date)} — ${list.length} ราย`, ...list.slice(0, MAX).map(t => `• ${t.time ? t.time.slice(0, 5) + ' ' : ''}${nm(t)}${t.model ? ' · ' + t.model : ''}${t.staff ? ' · 👤 ' + t.staff : ''}`), ...more(list.length)].join('\n') }
}

export function showroomAnswer(rows, { today, day = 'today' }) {
  if (day === 'week') {
    const to = addDays(today, 6)
    const wl = alive(rows).filter(a => ymd(a.date) >= today && ymd(a.date) <= to && ['scheduled', 'confirmed', ''].includes(a.status || ''))
      .sort((a, b) => (ymd(a.date) + (a.time || '')).localeCompare(ymd(b.date) + (b.time || '')))
    if (!wl.length) return { n: 0, text: `🏬 7 วันนี้ (${dmy(today)}–${dmy(to)}) ไม่มีนัดลูกค้าเข้าโชว์รูม` }
    return { n: wl.length, text: [`🏬 นัดเข้าโชว์รูม 7 วันนี้ — ${wl.length} ราย`, ...wl.slice(0, MAX).map(a => `• ${dmy(ymd(a.date)).slice(0, 5)} ${a.time ? String(a.time).slice(0, 5) + ' ' : ''}${nm(a)}${a.model ? ' · ' + a.model : ''}`), ...more(wl.length)].join('\n') }
  }
  const date = day === 'tomorrow' ? addDays(today, 1) : today
  const list = alive(rows).filter(a => ymd(a.date) === date && ['scheduled', 'confirmed', ''].includes(a.status || ''))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  if (!list.length) return { text: `🏬 ${dayWord(day)} (${dmy(date)}) ไม่มีนัดลูกค้าเข้าโชว์รูม`, n: 0 }
  return { n: list.length, text: [`🏬 นัดเข้าโชว์รูม${dayWord(day)} ${dmy(date)} — ${list.length} ราย`, ...list.slice(0, MAX).map(a => `• ${a.time ? a.time.slice(0, 5) + ' ' : ''}${nm(a)}${a.purpose ? ' · ' + a.purpose : ''}${a.salesperson ? ' · 👤 ' + a.salesperson : ''}`), ...more(list.length)].join('\n') }
}

// ห้องแชต LINE ที่ลูกค้าทักมาล่าสุดและยังไม่มีใครอ่าน/ตอบ (เงื่อนไขเดียวกับหน้างานวันนี้)
export function lineWaitingAnswer(threads, customers) {
  const byLine = new Map(alive(customers).filter(c => c.lineUserId).map(c => [c.lineUserId, c]))
  const list = alive(threads).filter(t => t.platform === 'line' && t.unread && t.lastDirection === 'in')
    .map(t => ({ t, c: byLine.get(t.userId) }))
    .filter(({ c }) => !c || !c.isLost)
  if (!list.length) return { text: '💬 ไม่มีลูกค้าทัก LINE ค้างตอบ 👍', n: 0 }
  return { n: list.length, text: [`💬 ลูกค้าทัก LINE รอตอบ ${list.length} ราย`, ...list.slice(0, MAX).map(({ t, c }) => `• ${c ? nm(c) : (t.displayName || t.name || 'ลูกค้า (ยังไม่จับคู่)')}${t.lastText ? ': "' + String(t.lastText).slice(0, 40) + '"' : ''}${c?.assignedTo ? ' · 👤 ' + c.assignedTo : ''}`), ...more(list.length)].join('\n') }
}

const OPEN_COMPLAINT = ['open', 'investigating', 'escalated']
export function complaintAnswer(rows, { today }) {
  const list = alive(rows).filter(c => OPEN_COMPLAINT.includes(c.status || 'open'))
    .sort((a, b) => (a.priority === 'critical' ? 0 : 1) - (b.priority === 'critical' ? 0 : 1) || String(a.openDate || '').localeCompare(String(b.openDate || '')))
  if (!list.length) return { text: '✅ ไม่มีเรื่องร้องเรียนค้าง', n: 0 }
  const age = c => { const d = ymd(c.openDate || c.createdAt); if (!d) return ''; const n = Math.round((Date.parse(today) - Date.parse(d)) / 86400000); return n > 0 ? ` · ค้าง ${n} วัน` : ' · วันนี้' }
  const noOwner = list.filter(c => !String(c.assignedTo || '').trim()).length
  return { n: list.length, text: [`⚠️ เรื่องร้องเรียนค้าง ${list.length} เรื่อง${noOwner ? ` (ยังไม่มีผู้รับผิดชอบ ${noOwner})` : ''}`, ...list.slice(0, MAX).map(c => `• ${c.priority === 'critical' ? '🔴 ' : ''}${nm(c)} — ${c.subject || 'ไม่ระบุหัวข้อ'}${c.status === 'escalated' ? ' · Escalate' : ''}${age(c)}${c.assignedTo ? ' · 👤 ' + c.assignedTo : ''}`), ...more(list.length)].join('\n') }
}

// ลูกค้าใหม่ในช่วงเวลา แยกตามที่มา · ไม่นับลูกค้าที่ลบแล้ว
// (v1.0.1090) ทดลองขับแล้ว (ช่วง N วันล่าสุด) แต่ยังไม่มีใบจอง → รายชื่อที่ควรโทรตาม
// เทียบใบจองด้วยเบอร์ (ตัวเลขล้วน) หรือชื่อ · ไม่นับนัดที่ยกเลิก/ไม่มา และผล "ไม่สนใจ" ไว้ท้ายสุด
const TD_RES = { interested: '🔥 สนใจมาก', maybe: '🤔 อาจจะ', notinterested: '😐 ไม่สนใจ' }
const phoneK = v => { const d = String(v || '').replace(/\D/g, ''); return d.startsWith('66') && d.length === 11 ? '0' + d.slice(2) : d }
const nameK = v => String(v || '').replace(/\s+/g, '').toLowerCase()
export function tdNoBookAnswer(drives, bookings, { today, range = 30 }) {
  const from = addDays(today, -range)
  const bkPhone = new Set(), bkName = new Set()
  alive(bookings).forEach(b => { if (/ถอน|ยกเลิก/.test(b.status || '')) return; const p = phoneK(b.phone); if (p.length >= 9) bkPhone.add(p); const n = nameK(b.custName || b.customerName); if (n) bkName.add(n) })
  const seen = new Map()
  alive(drives).forEach(t => {
    const d = String(t.date || '').slice(0, 10)
    if (!d || d < from || d > today || ['cancelled', 'no_show', 'noshow'].includes(t.status) || t.result === 'booked') return
    const p = phoneK(t.phone), n = nameK(t.customerName)
    if ((p.length >= 9 && bkPhone.has(p)) || (n && bkName.has(n))) return
    const key = p.length >= 9 ? p : n
    if (!key || (seen.has(key) && seen.get(key).date >= d)) return
    seen.set(key, { ...t, date: d })
  })
  const rank = t => t.result === 'interested' ? 0 : t.result === 'maybe' ? 1 : t.result === 'notinterested' ? 3 : 2
  const list = [...seen.values()].sort((a, b) => rank(a) - rank(b) || b.date.localeCompare(a.date))
  const span = `${range} วันล่าสุด (${dmy(from)}–${dmy(today)})`
  if (!list.length) return { n: 0, text: `🚗 ลูกค้าที่ทดลองขับ${span} จองแล้วทุกคน หรือยังไม่มีนัดทดลองขับ` }
  return { n: list.length, text: [`🚗 ทดลองขับแล้วยังไม่จอง — ${list.length} ราย · ${span}`,
    ...list.slice(0, MAX).map(t => `• ${t.customerName || 'ลูกค้า'}${t.model ? ' · ' + t.model : ''} · ขับ ${dmy(t.date)}${TD_RES[t.result] ? ' · ' + TD_RES[t.result] : ''}${t.staff ? ' · 👤 ' + t.staff : ''}${t.phone ? ' · 📞 ' + t.phone : ''}`),
    ...more(list.length), '💡 โทรตามคนที่ "สนใจมาก" ก่อน — ยิ่งตามเร็วยิ่งปิดง่าย'].join('\n') }
}

export function bookDayAnswer(bookings, { today, day = 'today' }) {
  const from = day === 'yesterday' ? addDays(today, -1) : day === 'week' ? addDays(today, -6) : today
  const to = day === 'yesterday' ? from : today
  const word = day === 'yesterday' ? `เมื่อวาน (${dmy(from)})` : day === 'week' ? `ในรอบ 7 วัน (${dmy(from)}–${dmy(to)})` : `วันนี้ (${dmy(today)})`
  const rows = alive(bookings).filter(b => { const d = String(b.bookingDate || '').slice(0, 10); return d >= from && d <= to })
  const live = rows.filter(b => !/ถอน|ยกเลิก/.test(b.status || ''))
  if (!rows.length) return { n: 0, text: `📝 ยอดจอง${word}: ยังไม่มีใบจองใหม่` }
  const by = {}
  live.forEach(b => { const k = b.salesName || 'ไม่ระบุเซลส์'; by[k] = (by[k] || 0) + 1 })
  return { n: live.length, text: [`📝 ยอดจอง${word} ${live.length} ใบ${rows.length > live.length ? ` · ถอนแล้ว ${rows.length - live.length} ใบ` : ''}`,
    ...live.slice(0, MAX).map(b => `• ${nm(b)}${carOf(b) ? ' · ' + carOf(b) : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''}${day !== 'today' ? ' · ' + dmy(String(b.bookingDate).slice(0, 10)) : ''}`), ...more(live.length),
    ...(Object.keys(by).length > 1 ? ['', '🏆 ' + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')] : [])].join('\n') }
}

const CANCEL = /ถอน|ยกเลิก/
const monthRange = (today, prev) => {
  if (!prev) return [today.slice(0, 7) + '-01', today, 'เดือนนี้']
  const from = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1)).toISOString().slice(0, 10)
  return [from, addDays(today.slice(0, 7) + '-01', -1), 'เดือนก่อน']
}
// ใบจองที่ถอนในเดือน (นับตามเดือนที่จอง · ตรงกับตัวเลข "ถอน" ในสรุปยอด)
export function withdrawnAnswer(bookings, { today, prev = false }) {
  const [from, to, label] = monthRange(today, prev)
  const inM = alive(bookings).filter(b => { const d = String(b.bookingDate || '').slice(0, 10); return d >= from && d <= to })
  const list = inM.filter(b => CANCEL.test(b.status || ''))
  const span = `${dmy(from)}–${dmy(to)}`
  if (!list.length) return { n: 0, text: `✅ ${label}ยังไม่มีใบจองที่ถอน (${span}) · จองทั้งหมด ${inM.length} ใบ` }
  return { n: list.length, text: [`↩️ ถอนจอง${label} ${list.length} ใบ จาก ${inM.length} ใบ (${Math.round(list.length / inM.length * 100)}%) · ${span}`,
    ...list.slice(0, MAX).map(b => `• ${nm(b)}${carOf(b) ? ' · ' + carOf(b) : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''} · จอง ${dmy(String(b.bookingDate).slice(0, 10))}${b.cancelReason || b.withdrawReason ? ' · ' + (b.cancelReason || b.withdrawReason) : ''}`),
    ...more(list.length)].join('\n') }
}

// นัดที่บันทึกว่า "ไม่มา" (นัดโชว์รูม + ทดลองขับ) ในช่วง N วันล่าสุด → ควรโทรนัดใหม่
export function noShowAnswer(appts, drives, { today, range = 30 }) {
  const from = addDays(today, -range)
  const rows = [
    ...alive(appts).filter(a => a.status === 'noshow').map(a => ({ name: nm(a), date: String(a.date || '').slice(0, 10), what: '🏬 นัดโชว์รูม', staff: a.salesperson, phone: a.phone })),
    ...alive(drives).filter(t => ['no_show', 'noshow'].includes(t.status)).map(t => ({ name: nm(t), date: String(t.date || '').slice(0, 10), what: '🚗 ทดลองขับ' + (t.model ? ' ' + t.model : ''), staff: t.staff, phone: t.phone })),
  ].filter(r => r.date >= from && r.date <= today).sort((a, b) => b.date.localeCompare(a.date))
  const span = `${range} วันล่าสุด (${dmy(from)}–${dmy(today)})`
  if (!rows.length) return { n: 0, text: `✅ ไม่มีลูกค้าที่นัดแล้วไม่มา ${span}` }
  return { n: rows.length, text: [`🙈 นัดแล้วไม่มา ${rows.length} ราย · ${span}`,
    ...rows.slice(0, MAX).map(r => `• ${r.name} · ${r.what} · ${dmy(r.date)}${r.staff ? ' · 👤 ' + r.staff : ''}${r.phone ? ' · 📞 ' + r.phone : ''}`), ...more(rows.length),
    '💡 โทรถามสะดวกวันไหน แล้วนัดใหม่ — ลูกค้าที่ไม่มาส่วนใหญ่ยังสนใจอยู่'].join('\n') }
}

// เซลส์ที่ยังไม่มีใบจองเดือนนี้ (รายชื่อเซลส์ = Master Data + คนที่ดูแลลูกค้า/มีใบจองย้อนหลัง 3 เดือน)
export function noBookSellerAnswer({ sellers = [], customers = [], bookings = [], today }) {
  const from = today.slice(0, 7) + '-01', back = addDays(from, -92)
  const names = new Set(sellers.map(n => String(n || '').trim()).filter(Boolean))
  alive(customers).forEach(c => { if (c.assignedTo && !c.isLost) names.add(String(c.assignedTo).trim()) })
  const bk = alive(bookings)
  bk.forEach(b => { const d = String(b.bookingDate || '').slice(0, 10); if (b.salesName && d >= back) names.add(String(b.salesName).trim()) })
  const got = {}
  bk.forEach(b => { const d = String(b.bookingDate || '').slice(0, 10); if (d >= from && d <= today && !CANCEL.test(b.status || '') && b.salesName) got[String(b.salesName).trim()] = (got[String(b.salesName).trim()] || 0) + 1 })
  const none = [...names].filter(n => !got[n]).sort()
  if (!names.size) return { n: 0, text: '👥 ยังไม่มีรายชื่อเซลส์ในระบบ' }
  const head = `📝 ใบจองเดือนนี้รายเซลส์ (${dmy(from)}–${dmy(today)})`
  if (!none.length) return { n: 0, text: `${head}\n✅ ทุกคนมีใบจองแล้ว\n${Object.entries(got).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k} ${v} ใบ`).join('\n')}` }
  const active = c => alive(customers).filter(x => String(x.assignedTo || '').trim() === c && !x.isLost && !x.bookingId && ['lead', 'pp'].includes(x.stage))
  return { n: none.length, text: [head, `⚠️ ยังไม่มีใบจอง ${none.length} คน`,
    ...none.slice(0, 12).map(n => { const a = active(n); const hot = a.filter(x => x.temperature === 'hot').length; return `• ${n} — ดูแลลูกค้า ${a.length} คน${hot ? ` · 🔥 HOT ${hot}` : ''}` }),
    ...(Object.keys(got).length ? ['', '✅ มีใบจองแล้ว: ' + Object.entries(got).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')] : [])].join('\n') }
}

// สรุปไฟแนนซ์ 6 เดือนล่าสุด: ยื่นกี่ใบ ผ่าน/ไม่ผ่าน/รอผล ต่อบริษัท
const FIN_WAIT = ['รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง']
export function finBankAnswer(bookings, { today, months = 6 }) {
  const from = addDays(today, -Math.round(months * 30.5))
  const m = new Map()
  alive(bookings).forEach(b => {
    const co = String(b.financeCo || '').trim(), d = String(b.bookingDate || '').slice(0, 10)
    if (!co || b.finStatus === 'ซื้อสด' || d < from || d > today) return
    const r = m.get(co) || { name: co, n: 0, pass: 0, fail: 0, wait: 0 }
    r.n++
    if (b.finStatus === 'ไม่ผ่าน') r.fail++
    else if (b.finStatus === 'ผ่าน' || b.finStatus === 'รอเซ็นสัญญา' || (!FIN_WAIT.includes(b.status) && !CANCEL.test(b.status || '') && b.status !== 'รอรถ' && b.finStatus !== 'รอผล' && b.finStatus !== 'รอส่ง')) r.pass++
    else r.wait++
    m.set(co, r)
  })
  const rows = [...m.values()].sort((a, b) => b.pass - a.pass || b.n - a.n)
  const span = `${months} เดือนล่าสุด (${dmy(from)}–${dmy(today)})`
  if (!rows.length) return { n: 0, text: `🏦 ยังไม่มีใบจองที่ระบุบริษัทไฟแนนซ์ ${span}` }
  const pct = r => { const done = r.pass + r.fail; return done ? ` · ผ่าน ${Math.round(r.pass / done * 100)}%` : '' }
  const best = rows.filter(r => r.pass + r.fail >= 3).sort((a, b) => b.pass / (b.pass + b.fail) - a.pass / (a.pass + a.fail))[0]
  return { n: rows.length, text: [`🏦 ไฟแนนซ์ ${span}`,
    ...rows.slice(0, 8).map((r, i) => `${i + 1}. ${r.name} — ยื่น ${r.n} · ✅ ผ่าน ${r.pass} · ❌ ไม่ผ่าน ${r.fail} · ⏳ รอ ${r.wait}${pct(r)}`),
    best ? `💡 ${best.name} ผ่านง่ายสุด (${Math.round(best.pass / (best.pass + best.fail) * 100)}%) — ลูกค้าเครดิตก้ำกึ่งลองยื่นที่นี่ก่อน` : '💡 ข้อมูลยังน้อย — ใส่ "สถานะไฟแนนซ์" ในใบจองให้ครบเพื่อเทียบได้แม่นขึ้น'].join('\n') }
}

const STAGE_L = { lead: '🧲 Lead', pp: '📇 Prospect', booked: '📝 จองแล้ว', booking: '📝 จองแล้ว', delivered: '✅ ส่งมอบแล้ว' }
export function myCustomersAnswer(customers, { today }) {
  const list = alive(customers)
  if (!list.length) return { n: 0, text: '👥 ยังไม่มีลูกค้าในความดูแล' }
  const lost = list.filter(c => c.isLost).length, live = list.filter(c => !c.isLost)
  const by = {}
  live.forEach(c => { const k = STAGE_L[c.stage] || (c.bookingId ? '📝 จองแล้ว' : '🧲 Lead'); by[k] = (by[k] || 0) + 1 })
  const open = live.filter(c => ['lead', 'pp'].includes(c.stage) && !c.bookingId)
  const t = k => open.filter(c => c.temperature === k).length
  const month = list.filter(c => ymd(c.createdAt) >= today.slice(0, 7) + '-01').length
  return { n: list.length, text: [`👥 ลูกค้าในความดูแล ${list.length} คน${lost ? ` (เสียดีล ${lost})` : ''}`,
    ...Object.entries(by).map(([k, v]) => `• ${k} ${v} คน`),
    open.length ? `🌡 กำลังติดตาม ${open.length} คน · 🔥 HOT ${t('hot')} · 🟡 WARM ${t('warm')} · 🔵 COLD ${t('cold')}` : '',
    `🆕 เข้ามาใหม่เดือนนี้ ${month} คน`].filter(Boolean).join('\n') }
}

export function noPhoneAnswer(customers) {
  const list = alive(customers).filter(c => !c.isLost && String(c.phone || '').replace(/\D/g, '').length < 9)
  if (!list.length) return { n: 0, text: '✅ ลูกค้าทุกคนมีเบอร์โทรแล้ว' }
  const rank = c => c.temperature === 'hot' ? 0 : c.temperature === 'warm' ? 1 : 2
  list.sort((a, b) => rank(a) - rank(b))
  return { n: list.length, text: [`📵 ลูกค้าที่ยังไม่มีเบอร์โทร ${list.length} คน (HOT ขึ้นก่อน)`,
    ...list.slice(0, MAX).map(c => `• ${nm(c)}${c.temperature ? ' · ' + c.temperature.toUpperCase() : ''}${c.lineId || c.lineUserId ? ' · 💚 มี LINE' : ''}${c.assignedTo ? ' · 👤 ' + c.assignedTo : ''}`),
    ...more(list.length), '💡 เปิดลูกค้าแล้วเติมเบอร์ — ระบบจะโทร/ส่งข้อความได้ และกันลูกค้าซ้ำได้แม่นขึ้น'].join('\n') }
}

// (v1.0.1095) ลูกค้าที่กำลังคุย (ยังไม่จอง ไม่เสียดีล) ที่ไม่มีนัดทดลองขับเลย · เทียบด้วยเบอร์หรือชื่อ · HOT ขึ้นก่อน
export function noTestDriveAnswer(customers, drives) {
  const tdPhone = new Set(), tdName = new Set()
  alive(drives).forEach(t => { if (['cancelled'].includes(t.status)) return; const p = phoneK(t.phone); if (p.length >= 9) tdPhone.add(p); const n = nameK(t.customerName); if (n) tdName.add(n) })
  const full = c => nameK([c.firstName, c.lastName].filter(Boolean).join(''))
  const list = alive(customers).filter(c => !c.isLost && !c.bookingId && ['lead', 'pp', undefined, ''].includes(c.stage)
    && !(phoneK(c.phone).length >= 9 && tdPhone.has(phoneK(c.phone))) && !(full(c) && tdName.has(full(c))))
  if (!list.length) return { n: 0, text: '🚗 ลูกค้าที่กำลังคุยทุกคนทดลองขับแล้ว 👍' }
  const rank = c => c.temperature === 'hot' ? 0 : c.temperature === 'warm' ? 1 : 2
  list.sort((a, b) => rank(a) - rank(b) || String(b.updatedAt?.seconds ?? b.updatedAt ?? '').localeCompare(String(a.updatedAt?.seconds ?? a.updatedAt ?? '')))
  return { n: list.length, text: [`🚗 ลูกค้าที่ยังไม่ได้ทดลองขับ ${list.length} คน (ยังไม่จอง · HOT ขึ้นก่อน)`,
    ...list.slice(0, MAX).map(c => `• ${nm(c)}${c.temperature ? ' · ' + c.temperature.toUpperCase() : ''}${c.interestedModel ? ' · 🚗 ' + c.interestedModel : ''}${c.assignedTo ? ' · 👤 ' + c.assignedTo : ''}${c.phone ? ' · 📞 ' + c.phone : ''}`),
    ...more(list.length), '💡 ชวนคนที่ HOT มาทดลองขับก่อน — ลูกค้าที่ได้ขับจริงปิดง่ายกว่ามาก'].join('\n') }
}

// (v1.0.1095) ลูกค้าที่กำลังคุยแต่ยังไม่มีใบเสนอราคา (เทียบ customerId · เบอร์ · ชื่อ)
export function noQuoteAnswer(customers, quotes) {
  const ids = new Set(), ph = new Set(), nmz = new Set()
  alive(quotes).forEach(q => { if (q.customerId) ids.add(q.customerId); const p = phoneK(q.phone); if (p.length >= 9) ph.add(p); const n = nameK(q.customerName); if (n) nmz.add(n) })
  const full = c => nameK([c.firstName, c.lastName].filter(Boolean).join(''))
  const list = alive(customers).filter(c => !c.isLost && !c.bookingId && ['lead', 'pp', undefined, ''].includes(c.stage)
    && !ids.has(c.id) && !(phoneK(c.phone).length >= 9 && ph.has(phoneK(c.phone))) && !(full(c) && nmz.has(full(c))))
  if (!list.length) return { n: 0, text: '📄 ลูกค้าที่กำลังคุยทุกคนมีใบเสนอราคาแล้ว 👍' }
  const rank = c => c.temperature === 'hot' ? 0 : c.temperature === 'warm' ? 1 : 2
  list.sort((a, b) => rank(a) - rank(b))
  return { n: list.length, text: [`📄 ลูกค้าที่ยังไม่มีใบเสนอราคา ${list.length} คน (ยังไม่จอง · HOT ขึ้นก่อน)`,
    ...list.slice(0, MAX).map(c => `• ${nm(c)}${c.temperature ? ' · ' + c.temperature.toUpperCase() : ''}${c.interestedModel ? ' · 🚗 ' + c.interestedModel : ''}${c.assignedTo ? ' · 👤 ' + c.assignedTo : ''}`),
    ...more(list.length), '💡 ถาม LAMI "ราคา <รุ่น>" แล้วกด 📄 ทำใบเสนอราคา ส่งให้คนที่ HOT ก่อน'].join('\n') }
}

// (v1.0.1095) ใบจองตามรุ่น (ไม่นับถอน/ยกเลิก) · ยังไม่ส่งมอบขึ้นก่อน
const keyz = v => String(v || '').toLowerCase().replace(/[^a-z0-9ก-๙]/g, '')
export function bookingsByModelAnswer(bookings, { today, model, period = 'all' }) {
  const k = keyz(model)
  const from = period === 'month' ? today.slice(0, 7) + '-01' : period === 'year' ? today.slice(0, 4) + '-01-01' : ''
  const list = alive(bookings).filter(b => !/ถอน|ยกเลิก/.test(b.status || '') && keyz(carOf(b) + ' ' + (b.model || '')).includes(k) && (!from || ymd(b.bookingDate) >= from))
  const word = period === 'month' ? 'เดือนนี้' : period === 'year' ? 'ปีนี้' : ''
  if (!list.length) return { n: 0, text: `📝 ไม่มีใบจองรุ่น ${model}${word ? ' ' + word : ''}` }
  const done = b => b.status === 'ส่งมอบแล้ว'
  list.sort((a, b) => done(a) - done(b) || ymd(b.bookingDate).localeCompare(ymd(a.bookingDate)))
  const nDone = list.filter(done).length
  return { n: list.length, text: [`📝 ใบจองรุ่น ${model}${word ? ' ' + word : ''} — ${list.length} ใบ (ยังไม่ส่งมอบ ${list.length - nDone} · ส่งมอบแล้ว ${nDone})`,
    ...list.slice(0, MAX).map(b => `• ${nm(b)} · ${carOf(b) || b.model}${b.color ? ' สี' + b.color : ''} · ${b.status || 'จอง'}${b.bookingDate ? ' · จอง ' + dmy(ymd(b.bookingDate)) : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''}`),
    ...more(list.length)].join('\n') }
}

const DAYMS = 86400e3
const dnum = d => { const t = Date.parse(String(d || '').slice(0, 10) + 'T00:00:00Z'); return isNaN(t) ? null : Math.round(t / DAYMS) }
const created = c => ymd(c.createdAt) || ymd(c.date) || ''
// (v1.0.1096) ลูกค้าที่ยังไม่จอง (ไม่เสียดีล) ที่คุยมาเกิน 30 วัน · เรียงจากนานสุด HOT ขึ้นก่อนเมื่อเท่ากัน
export function staleProspectAnswer(customers, { today, min = 30 }) {
  const t = dnum(today)
  const list = alive(customers).filter(c => !c.isLost && !c.bookingId && ['lead', 'pp', undefined, ''].includes(c.stage))
    .map(c => ({ c, age: dnum(created(c)) == null ? null : t - dnum(created(c)) })).filter(x => x.age != null && x.age >= min)
  if (!list.length) return { n: 0, text: `👍 ไม่มีลูกค้าที่คุยเกิน ${min} วันแล้วยังไม่จอง` }
  const rank = c => c.temperature === 'hot' ? 0 : c.temperature === 'warm' ? 1 : 2
  list.sort((a, b) => rank(a.c) - rank(b.c) || b.age - a.age)
  return { n: list.length, text: [`⏳ ลูกค้าที่คุยเกิน ${min} วันแล้วยังไม่จอง ${list.length} คน (HOT ขึ้นก่อน)`,
    ...list.slice(0, MAX).map(({ c, age }) => `• ${nm(c)}${c.temperature ? ' · ' + c.temperature.toUpperCase() : ''}${c.interestedModel ? ' · 🚗 ' + c.interestedModel : ''} · คุยมา ${age} วัน${c.assignedTo ? ' · 👤 ' + c.assignedTo : ''}`),
    ...more(list.length), '💡 ถามตรงๆ ว่าติดอะไร (ราคา ไฟแนนซ์ รถเทิร์น) แล้วเสนอทางออก หรือชวนทดลองขับอีกครั้ง'].join('\n') }
}

// (v1.0.1096) รถเทิร์น: ที่ยังไม่จบ (ไม่นับขายต่อแล้ว/ปฏิเสธ) แยกตามสถานะ
const TI = { appraisal: '🔍 รอประเมิน', offered: '💰 เสนอราคาแล้ว', accepted: '✅ ลูกค้าตกลง', received: '🚗 รับรถแล้ว' }
export function tradeInAnswer(items, { today, month = false }) {
  // (v1.0.1118) "มีรถเทิร์นกี่คันเดือนนี้" → ทุกคันที่เข้ามาเดือนนี้ (รวมที่จบแล้ว/ไม่ตกลง) ไม่ใช่แค่ที่ค้าง
  if (month) {
    const ml = alive(items).filter(t => ymd(t.date).slice(0, 7) === today.slice(0, 7))
    if (!ml.length) return { n: 0, text: `🔄 เดือนนี้ยังไม่มีรถเทิร์นเข้ามา` }
    const lab = { ...TI, declined: '❌ ไม่ตกลง' }
    const by = Object.keys(lab).map(k => [k, ml.filter(t => t.status === k).length]).filter(([, n]) => n)
    return { n: ml.length, text: [`🔄 รถเทิร์นเดือนนี้ ${ml.length} คัน · ${by.map(([k, n]) => `${lab[k]} ${n}`).join(' · ')}`,
      ...ml.slice(0, MAX).map(t => `• ${t.customer || t.customerName || 'ลูกค้า'} · ${t.oldCar || 'รถเก่า'} · ${lab[t.status] || t.status || ''}`), ...more(ml.length)].join('\n') }
  }
  const list = alive(items).filter(t => TI[t.status]).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  if (!list.length) return { n: 0, text: '🔄 ตอนนี้ไม่มีรถเทิร์นที่ค้างอยู่' }
  const by = Object.keys(TI).map(k => [k, list.filter(t => t.status === k).length]).filter(([, n]) => n)
  const fmt = n => '฿' + Math.round(Number(n) || 0).toLocaleString('th-TH')
  const t0 = dnum(today)
  return { n: list.length, text: [`🔄 รถเทิร์นที่ยังไม่จบ ${list.length} คัน · ${by.map(([k, n]) => `${TI[k]} ${n}`).join(' · ')}`,
    ...list.slice(0, MAX).map(t => `• ${t.customer || t.customerName || 'ลูกค้า'} · ${t.oldCar || 'รถเก่า'}${t.newCar && t.newCar !== '—' ? ' → ' + t.newCar : ''} · ${TI[t.status]}${t.offerPrice ? ' · เสนอ ' + fmt(t.offerPrice) : ''}${dnum(t.date) != null ? ` · ${t0 - dnum(t.date)} วัน` : ''}`),
    ...more(list.length), by.some(([k]) => k === 'appraisal') ? '💡 ประเมินคันที่รออยู่ก่อน — ลูกค้ารอราคารถเก่าเพื่อตัดสินใจจองคันใหม่' : ''].filter(Boolean).join('\n') }
}

// (v1.0.1096) อัตราปิดการขาย: ลูกค้าใหม่ในเดือน → จองแล้วกี่คน · เวลาเฉลี่ยจากเข้ามาถึงวันจอง (ใบจองที่ผูกลูกค้า)
export function closeRateAnswer(customers, bookings, { today, prev = false }) {
  let ym = today.slice(0, 7)
  if (prev) { const [y, m] = ym.split('-').map(Number); ym = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }
  const cs = alive(customers)
  const byId = new Map(cs.map(c => [c.id, c]))
  const fresh = cs.filter(c => created(c).startsWith(ym))
  const bks = alive(bookings).filter(b => !/ถอน|ยกเลิก/.test(b.status || ''))
  const bookedIds = new Set(bks.map(b => b.customerId).filter(Boolean))
  cs.forEach(c => { if (c.bookingId) bookedIds.add(c.id) })
  const won = fresh.filter(c => bookedIds.has(c.id) || ['booking', 'delivered'].includes(c.stage)).length
  const lost = fresh.filter(c => c.isLost).length
  const byBk = new Map(cs.filter(c => c.bookingId).map(c => [c.bookingId, c]))
  const custOf = b => byBk.get(b.id) || (b.customerId && byId.get(b.customerId))
  const gaps = bks.filter(b => ymd(b.bookingDate).startsWith(ym) && custOf(b))
    .map(b => dnum(b.bookingDate) - dnum(created(custOf(b)))).filter(n => Number.isFinite(n) && n >= 0)
  const avg = gaps.length ? Math.round(gaps.reduce((a, n) => a + n, 0) / gaps.length) : null
  const word = prev ? 'เดือนก่อน' : 'เดือนนี้'
  const lines = [`📈 อัตราปิดการขาย${word} (${ym.slice(5, 7)}/${+ym.slice(0, 4) + 543})`,
    fresh.length ? `👥 ลูกค้าใหม่ ${fresh.length} คน → จองแล้ว ${won} คน (${Math.round(won / fresh.length * 100)}%)${lost ? ` · เสียดีล ${lost} คน` : ''}` : `👥 ${word}ยังไม่มีลูกค้าใหม่`,
    avg != null ? `⏱ ใบจอง${word} ${gaps.length} ใบ ใช้เวลาเฉลี่ย ${avg} วัน จากวันที่ลูกค้าเข้ามาถึงวันจอง` : bks.some(b => ymd(b.bookingDate).startsWith(ym)) ? `⏱ ใบจอง${word}ยังไม่ได้ผูกกับลูกค้า จึงคำนวณเวลาเฉลี่ยไม่ได้` : `⏱ ${word}ยังไม่มีใบจอง`]
  if (fresh.length && won / fresh.length < 0.2) lines.push('💡 ปิดได้ต่ำกว่า 20% — ชวนลูกค้าใหม่มาทดลองขับภายใน 7 วันแรก')
  return { n: fresh.length, text: lines.join('\n') }
}

// (v1.0.1097) โทรแล้วไม่รับสาย (ไทม์ไลน์ comm_logs + นัดที่ปิดด้วยผล "ไม่รับสาย") ใน N วันล่าสุด ที่ยังไม่ได้คุยกันหลังจากนั้น
const NOANS = /ไม่รับสาย|โทรไม่ติด|ติดต่อไม่ได้|📵/
export function noAnswerAnswer(customers, logs, followups, { today, range = 14 }) {
  const from = addDays(today, -range)
  const byId = new Map(alive(customers).map(c => [c.id, c]))
  const ev = new Map()
  const put = (id, d, note) => { if (!id || !byId.has(id) || !d || d < from || d > today) return; const o = ev.get(id); if (!o || o.d < d) ev.set(id, { d, note }) }
  alive(logs).forEach(l => { if (NOANS.test(String(l.note || ''))) put(l.customerId, ymd(l.createdAt), l.note) })
  alive(followups).forEach(f => { if (f.status === 'done' && NOANS.test(String(f.result || ''))) put(f.customerId, ymd(f.updatedAt) || ymd(f.dueDate), f.result) })
  const list = [...ev.entries()].map(([id, e]) => ({ c: byId.get(id), ...e }))
    .filter(({ c, d }) => !c.isLost && !(ymd(c.lastContactAt) > d)).sort((a, b) => b.d.localeCompare(a.d))
  if (!list.length) return { n: 0, text: `📵 ${range} วันล่าสุดไม่มีลูกค้าที่โทรแล้วไม่รับสายค้างอยู่` }
  return { n: list.length, text: [`📵 โทรแล้วไม่รับสาย ${list.length} คน (${range} วันล่าสุด · ยังไม่ได้คุยกันหลังจากนั้น)`,
    ...list.slice(0, MAX).map(({ c, d }) => `• ${nm(c)}${c.temperature ? ' · ' + c.temperature.toUpperCase() : ''}${c.interestedModel ? ' · 🚗 ' + c.interestedModel : ''} · โทรไม่ติด ${dmy(d)}${c.phone ? ' · 📞 ' + c.phone : ''}`),
    ...more(list.length), '💡 ลองโทรคนละช่วงเวลา (เย็นหลัง 17:00) หรือส่ง LINE สั้นๆ ก่อนโทร'].join('\n') }
}

// (v1.0.1097) ลูกค้า HOT (ยังไม่จอง ไม่เสียดีล) แยกตามเซลส์ผู้ดูแล
export function hotBySellerAnswer(customers) {
  const hot = alive(customers).filter(c => c.temperature === 'hot' && !c.isLost && !c.bookingId && ['lead', 'pp', undefined, ''].includes(c.stage))
  if (!hot.length) return { n: 0, text: '🔥 ตอนนี้ยังไม่มีลูกค้า HOT ที่ยังไม่จอง' }
  const by = {}
  hot.forEach(c => { const k = String(c.assignedTo || '').trim() || 'ยังไม่มีผู้ดูแล'; by[k] = (by[k] || 0) + 1 })
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1])
  return { n: hot.length, text: [`🔥 ลูกค้า HOT ที่ยังไม่จอง ${hot.length} คน แยกตามเซลส์`, ...rows.map(([k, n], i) => `${i + 1}. ${k} — ${n} คน`),
    rows[0][1] >= 2 * (rows[1]?.[1] || 0) && rows.length > 1 ? `💡 ${rows[0][0]} ถือ HOT เยอะสุด — ช่วยกระจายหรือเร่งนัดทดลองขับ` : '💡 โทรนัดทดลองขับลูกค้า HOT ภายในสัปดาห์นี้'].join('\n') }
}

// (v1.0.1097) PDI ที่ยังไม่ผ่าน (รอตรวจ/กำลังตรวจ/ไม่ผ่าน) · เรียงจากเริ่มนานสุด
const PDI_TH = { pending: '⏳ รอตรวจ', inprogress: '🔧 กำลังตรวจ', failed: '❌ ไม่ผ่าน', rectified: '🔁 แก้ไขแล้ว รอตรวจซ้ำ' }
export function pdiAnswer(pdis, { today }) {
  const list = alive(pdis).filter(p => ['pending', 'inprogress', 'failed', 'rectified'].includes(p.status)).sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')))
  if (!list.length) return { n: 0, text: '✅ ไม่มีรถค้างตรวจ PDI' }
  const t0 = dnum(today)
  const cnt = Object.keys(PDI_TH).map(k => [k, list.filter(p => p.status === k).length]).filter(([, n]) => n)
  return { n: list.length, text: [`🔧 รถที่ยังไม่ผ่าน PDI ${list.length} คัน · ${cnt.map(([k, n]) => `${PDI_TH[k]} ${n}`).join(' · ')}`,
    ...list.slice(0, MAX).map(p => `• ${carOf(p) || 'รถ'}${p.color ? ' สี' + p.color : ''}${p.vin ? ' · VIN …' + String(p.vin).slice(-6) : ''} · ${PDI_TH[p.status]}${dnum(p.startDate) != null ? ` · ${t0 - dnum(p.startDate)} วัน` : ''}${p.inspector ? ' · 👤 ' + p.inspector : ''}`),
    ...more(list.length), list.some(p => p.status === 'failed') ? '💡 แก้คันที่ไม่ผ่านก่อน — ถ้ามีนัดส่งมอบจะได้ไม่เลื่อน' : ''].filter(Boolean).join('\n') }
}

// (v1.0.1107) รถที่รับเข้าสต็อกล่าสุด (vehicles.arrivedAt)
export function arrivedAnswer(vehicles, { today, days = 7 }) {
  const from = days === 'month' ? today.slice(0, 7) + '-01' : addDays(today, -(days - 1))
  const label = days === 'month' ? 'เดือนนี้' : days === 1 ? 'วันนี้' : 'ในรอบ 7 วัน'
  const list = alive(vehicles).filter(v => { const d = ymd(v.arrivedAt); return d && d >= from && d <= today }).sort((a, b) => ymd(b.arrivedAt).localeCompare(ymd(a.arrivedAt)))
  if (!list.length) return { n: 0, text: `🚙 ${label}ยังไม่มีรถรับเข้าสต็อก (${dmy(from)}–${dmy(today)})` }
  const by = {}
  list.forEach(v => { const k = carOf(v) || 'ไม่ระบุรุ่น'; by[k] = (by[k] || 0) + 1 })
  const sold = list.filter(v => v.status && v.status !== 'available' && v.status !== 'transit').length
  return { n: list.length, text: [`🚙 รถเข้าสต็อก${label} ${list.length} คัน (${dmy(from)}–${dmy(today)})${sold ? ` · จอง/ขายไปแล้ว ${sold} คัน` : ''}`,
    Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · '),
    ...list.slice(0, MAX).map(v => `• ${dmy(ymd(v.arrivedAt))} ${carOf(v) || 'รถ'}${v.color ? ' ' + v.color : ''}${v.status === 'available' ? ' · พร้อมขาย' : ''}`), ...more(list.length)].join('\n') }
}

// (v1.0.1103) ลูกค้ารับรถแล้วแต่ยังไม่ได้ป้ายขาว (จากใบจอง: ส่งมอบแล้ว ไม่มี whitePlate) · รับรถเกิน 45 วันขึ้นก่อน
export function plateAnswer(bookings, { today, days = 180 }) {
  const list = plateRows(bookings, { today, days }).filter(r => !r.white)
  if (!list.length) return { n: 0, text: `✅ ลูกค้าที่รับรถใน ${days} วันนี้ได้ป้ายขาวครบแล้ว (หรือยังไม่มีใครรับรถ)` }
  const late = list.filter(x => x.late).length
  return { n: list.length, text: [`🟥 รับรถแล้วยังไม่ได้ป้ายขาว ${list.length} คัน${late ? ` · เกิน ${PLATE_LATE_DAYS} วัน ${late} คัน` : ''}`,
    ...list.slice(0, MAX).map(({ b, age, red }) => `• ${nm(b)}${carOf(b) ? ' · ' + carOf(b) : ''} · รับรถ ${dmy(deliveredOn(b))} (${age} วัน)${red ? ' · ป้ายแดง ' + red : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''}`),
    ...more(list.length), late ? `💡 ตามงานทะเบียนคันที่เกิน ${PLATE_LATE_DAYS} วันก่อน แล้วกรอกเลขป้ายขาวในหน้าติดตามทะเบียน` : '💡 ได้เลขทะเบียนแล้วกรอก "ป้ายขาว" ในหน้าติดตามทะเบียน รายการนี้จะหายไปเอง'].join('\n') }
}

// (v1.0.1097) การลาของพนักงาน (อนุมัติแล้ว + รออนุมัติ) ที่ครอบวันนั้น
const LEAVE_TH = { sick: '🤒 ลาป่วย', personal: '📋 ลากิจ', annual: '🏖 ลาพักร้อน', maternity: '👶 ลาคลอด', ordain: '🧡 ลาบวช', unpaid: '💔 ลาไม่รับค่าจ้าง' }
export function leaveAnswer(rows, { today, day = 'today' }) {
  const from = day === 'tomorrow' ? addDays(today, 1) : today
  // (v1.0.1117) "ใครลางานเดือนนี้" → ทั้งเดือน (1 ถึงสิ้นเดือน)
  const mEnd = addDays(new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 1)).toISOString().slice(0, 10), -1)
  const from0 = day === 'month' ? today.slice(0, 8) + '01' : from
  const to = day === 'month' ? mEnd : day === 'week' ? addDays(today, 6) : from
  const list = alive(rows).filter(r => ['approved', 'pending'].includes(r.status) && ymd(r.from) <= to && (ymd(r.to) || ymd(r.from)) >= from0)
    .sort((a, b) => ymd(a.from).localeCompare(ymd(b.from)))
  const word = day === 'month' ? `เดือนนี้ (${dmy(from0)}–${dmy(to)})` : day === 'week' ? `7 วันนี้ (${dmy(from)}–${dmy(to)})` : `${dayWord(day)} ${dmy(from)}`
  if (!list.length) return { n: 0, text: `👥 ${word} ไม่มีพนักงานลา` }
  const pend = list.filter(r => r.status === 'pending').length
  return { n: list.length, text: [`👥 พนักงานลา${word} — ${list.length} คน${pend ? ` (รออนุมัติ ${pend})` : ''}`,
    ...list.slice(0, MAX).map(r => `• ${r.staff || 'พนักงาน'} · ${LEAVE_TH[r.type] || 'ลา'} · ${dmy(ymd(r.from))}${ymd(r.to) && ymd(r.to) !== ymd(r.from) ? '–' + dmy(ymd(r.to)) : ''}${r.status === 'pending' ? ' · ⏳ รออนุมัติ' : ''}`),
    ...more(list.length)].join('\n') }
}

// (v1.0.1116) ลูกค้าซ้ำ: เบอร์โทรเดียวกัน (ตัดขีด/ช่องว่าง เทียบ 9 หลักท้าย) หรือชื่อ-นามสกุลเดียวกันทุกตัวอักษร
export function dupAnswer(customers) {
  const live = alive(customers).filter(c => !c.isLost)
  const groups = new Map()
  const add = (k, c) => { if (!k) return; const g = groups.get(k) || []; if (!g.includes(c)) g.push(c); groups.set(k, g) }
  live.forEach(c => {
    const ph = String(c.phone || '').replace(/\D/g, '').slice(-9)
    if (ph.length === 9) add('p' + ph, c)
    const n = [c.firstName, c.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (c.firstName && c.lastName && n.length >= 5) add('n' + n, c)
  })
  const dups = [...groups.entries()].filter(([, g]) => g.length > 1)
  const seen = new Set(), rows = []
  dups.forEach(([k, g]) => { const id = g.map(c => c.id).sort().join(','); if (seen.has(id)) return; seen.add(id); rows.push({ by: k[0] === 'p' ? 'เบอร์' : 'ชื่อ', g }) })
  if (!rows.length) return { n: 0, text: '✅ ไม่พบลูกค้าซ้ำ (เทียบเบอร์โทรและชื่อ-นามสกุล)' }
  return { n: rows.length, text: [`👥 พบลูกค้าที่น่าจะซ้ำ ${rows.length} กลุ่ม`,
    ...rows.slice(0, MAX).map(({ by, g }) => `• ${by}ซ้ำ: ${g.slice(0, 3).map(c => `${nm(c)}${c.assignedTo ? ' (' + c.assignedTo + ')' : ''}`).join(' · ')}${g.length > 3 ? ` +${g.length - 3}` : ''}`),
    ...more(rows.length), '💡 รวมรายชื่อซ้ำได้ที่หน้าจัดการลูกค้าซ้ำ'].join('\n') }
}

// (v1.0.1114) ลูกหนี้ที่บันทึกในหน้าควบคุมเครดิต (ไม่นับที่ชำระแล้ว) · ค้างนานก่อน
const DEBT_TH = { current: 'ปกติ', overdue_7: 'ค้าง 1-7 วัน', overdue_30: 'ค้าง 8-30 วัน', overdue_60: 'ค้าง 31-60 วัน', bad_debt: 'หนี้เสีย' }
export function debtAnswer(rows) {
  const list = alive(rows).filter(d => d.status !== 'settled' && (Number(d.used) || 0) > 0).sort((a, b) => String(a.oldest || '').localeCompare(String(b.oldest || '')))
  if (!list.length) return { n: 0, text: '💸 ไม่มีลูกหนี้ค้างชำระที่บันทึกไว้ 👍\nℹ️ ลูกหนี้นับจากที่บันทึกในหน้าควบคุมเครดิต' }
  const total = list.reduce((a, d) => a + (Number(d.used) || 0), 0)
  const late = list.filter(d => d.status !== 'current')
  return { n: list.length, text: [`💸 ลูกหนี้ค้างชำระ ${list.length} ราย · รวม ${thb(total)}${late.length ? ` · เกินกำหนด ${late.length} ราย` : ''}`,
    ...list.slice(0, MAX).map(d => `• ${d.customer || 'ลูกค้า'} — ${thb(d.used)} · ${DEBT_TH[d.status] || d.status || ''}${d.phone ? ' · 📞 ' + d.phone : ''}`), ...more(list.length)].join('\n') }
}

// (v1.0.1114) ถอนจองแล้ว มีเงินมัดจำ ยังไม่คืน (สูตรเดียวกับหน้าคืนเงิน)
export function refundAnswer(bookings) {
  const dep = b => Number(b?.bookingDeposit) || Number(b?.down) || 0
  const st = b => b.refundStatus || ((dep(b) > 0 && !b.rightsOnly) ? 'รอคืนเงิน' : 'ไม่ต้องคืน')
  const list = alive(bookings).filter(b => b.status === 'ถอนจอง' && st(b) === 'รอคืนเงิน')
    .sort((a, b) => String(a.cancelDate || a.bookingDate || '').localeCompare(String(b.cancelDate || b.bookingDate || '')))
  if (!list.length) return { n: 0, text: '💵 ไม่มีลูกค้าที่ถอนจองแล้วรอคืนเงินมัดจำ 👍' }
  const total = list.reduce((a, b) => a + dep(b), 0)
  return { n: list.length, text: [`💵 รอคืนเงินมัดจำ ${list.length} ราย · รวม ${thb(total)}`,
    ...list.slice(0, MAX).map(b => `• ${b.custName || 'ลูกค้า'} — ${thb(dep(b))}${b.cancelDate ? ' · ถอน ' + dmy(String(b.cancelDate).slice(0, 10)) : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''}`), ...more(list.length),
    '💡 ทำเรื่องคืนเงินได้ที่หน้าคืนเงิน'].join('\n') }
}

// (v1.0.1113) ภาระ floor plan: ยอดเงินกู้รถที่ยังไม่ปิด · ดอกเบี้ยสะสม · ต่อวัน · เดือนนี้ · คันที่ค้างนาน (สูตรเดียวกับหน้า Floor Plan)
export function floorPlanAnswer(docs, { today }) {
  const cfg = alive(docs).find(d => d.kind === 'settings')
  const rate = cfg && cfg.rate !== '' && Number(cfg.rate) >= 0 ? Number(cfg.rate) : 6.5
  const active = alive(docs).filter(d => d.kind !== 'settings' && d.status === 'active')
  if (!active.length) return { n: 0, text: '🏦 ไม่มีรถที่ติด floor plan อยู่ตอนนี้ 👍' }
  const t = Date.parse(today)
  const days = u => Math.max(0, Math.round((t - Date.parse(ymd(u.drawDate) || today)) / 86400000))
  const p = u => Number(u.principal) || 0
  const monthStart = Date.parse(today.slice(0, 8) + '01')
  const daysThisMonth = u => Math.max(0, Math.round((t - Math.max(monthStart, Date.parse(ymd(u.drawDate) || today))) / 86400000))
  const total = active.reduce((a, u) => a + p(u), 0)
  const accrued = active.reduce((a, u) => a + p(u) * rate / 100 * days(u) / 365, 0)
  const month = active.reduce((a, u) => a + p(u) * rate / 100 * daysThisMonth(u) / 365, 0)
  const daily = active.reduce((a, u) => a + p(u) * rate / 100 / 365, 0)
  const baht = n => '฿' + Math.round(n).toLocaleString('en-US')
  const aged = active.map(u => ({ u, d: days(u) })).filter(x => x.d > 120).sort((a, b) => b.d - a.d)
  return { n: active.length, text: [
    `🏦 Floor plan ตอนนี้ — ${active.length} คัน · ยอดเงินกู้ ${baht(total)} (ดอกเบี้ย ${rate}% ต่อปี)`,
    `💸 ดอกเบี้ยเดือนนี้ถึงวันนี้ ${baht(month)} · วันละ ${baht(daily)}`,
    `📈 ดอกเบี้ยสะสมทั้งหมดที่ยังไม่ปิด ${baht(accrued)}`,
    ...(aged.length ? ['', `🔥 ติดเกิน 120 วัน ${aged.length} คัน`, ...aged.slice(0, 5).map(({ u, d }) => `• ${[u.model, u.color].filter(Boolean).join(' ') || 'รถ'} — ${d} วัน · ดอกเบี้ย ${baht(p(u) * rate / 100 * d / 365)}`)] : []),
    '💡 ขายคันที่ติดนานก่อน จะลดดอกเบี้ยได้มากสุด',
  ].join('\n') }
}

// (v1.0.1112) ลงเวลาวันนี้: มาสาย / ขาด / ยังไม่ลงเวลา (จากหน้าลงเวลา · ไม่นับคนที่ลาวันนี้)
export function lateAnswer(rows, staff = [], leaves = [], { today }) {
  const rec = alive(rows).filter(r => ymd(r.date) === today)
  const onLeave = new Set(alive(leaves).filter(l => ['approved', 'pending'].includes(l.status) && ymd(l.from) <= today && (ymd(l.to) || ymd(l.from)) >= today).map(l => String(l.staff || '').trim()))
  const name = r => String(r.staffName || r.name || 'พนักงาน').trim()
  const late = rec.filter(r => r.status === 'late'), absent = rec.filter(r => r.status === 'absent')
  const inIds = new Set(rec.filter(r => r.checkIn).map(r => r.staffId))
  const people = alive(staff).filter(x => x.active !== false && !/ลาออก|resign/i.test(x.status || ''))
  const noIn = people.filter(x => !inIds.has(x.id) && !onLeave.has(String([x.firstName, x.lastName].filter(Boolean).join(' ') || x.name || '').trim()))
  const head = `🕘 ลงเวลาวันนี้ ${dmy(today)}`
  if (!rec.length && !people.length) return { n: 0, text: `${head}\nยังไม่มีข้อมูลลงเวลา — ให้ทีมกดลงเวลาที่หน้า "ลงเวลา"` }
  const lines = [head, `✅ ลงเวลาแล้ว ${inIds.size} คน${late.length ? ` · ⏰ มาสาย ${late.length} คน` : ''}${absent.length ? ` · ❌ ขาด ${absent.length} คน` : ''}${onLeave.size ? ` · 🏖 ลา ${onLeave.size} คน` : ''}`]
  if (late.length) lines.push('', '⏰ มาสาย', ...late.slice(0, MAX).map(r => `• ${name(r)}${r.checkIn ? ' · เข้า ' + String(r.checkIn).slice(0, 5) : ''}`))
  if (absent.length) lines.push('', '❌ ขาดงาน', ...absent.slice(0, MAX).map(r => `• ${name(r)}`))
  if (noIn.length && people.length) lines.push('', `⏳ ยังไม่ลงเวลา ${noIn.length} คน`, '• ' + noIn.slice(0, 10).map(x => [x.firstName, x.lastName].filter(Boolean).join(' ') || x.name || 'พนักงาน').join(', ') + (noIn.length > 10 ? ` +${noIn.length - 10}` : ''))
  if (!late.length && !absent.length && !noIn.length) lines.push('👍 ทุกคนมาตรงเวลา')
  return { n: late.length + absent.length, text: lines.join('\n') }
}

// (v1.0.1097) รถที่กำลังมา: สต็อกสถานะกำลังขนส่ง + ใบสั่งรถที่ยังไม่ถึง (ไม่นับร่าง/ยกเลิก)
const ORD_TH = { ordered: '📤 สั่งแล้ว', confirmed: '✅ ยืนยันแล้ว', production: '🏭 กำลังผลิต', shipped: '🚢 กำลังขนส่ง' }
export function incomingAnswer(vehicles, orders, { today }) {
  const transit = alive(vehicles).filter(v => v.status === 'transit')
  const ords = alive(orders).filter(o => ORD_TH[o.status]).sort((a, b) => String(a.expectedDate || '9').localeCompare(String(b.expectedDate || '9')))
  const qty = o => Math.max(1, Number(o.qty) || 1)
  const nOrd = ords.reduce((a, o) => a + qty(o), 0)
  if (!transit.length && !nOrd) return { n: 0, text: '🚢 ตอนนี้ไม่มีรถที่กำลังมา (ไม่มีรถกำลังขนส่งหรือใบสั่งรถค้าง)' }
  const lines = [`🚢 รถที่กำลังมา — ${transit.length + nOrd} คัน`]
  if (transit.length) {
    const by = {}
    transit.forEach(v => { const k = carOf(v) || 'ไม่ระบุรุ่น'; by[k] = (by[k] || 0) + 1 })
    lines.push(`🚛 สต็อกกำลังขนส่ง ${transit.length} คัน: ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')}`)
  }
  if (nOrd) lines.push(`📦 ใบสั่งรถค้าง ${ords.length} ใบ (${nOrd} คัน)`, ...ords.slice(0, MAX).map(o => `• ${carOf(o) || o.model || 'รถ'}${o.color ? ' สี' + o.color : ''}${qty(o) > 1 ? ' × ' + qty(o) : ''} · ${ORD_TH[o.status]}${o.expectedDate ? ` · คาดว่าถึง ${dmy(ymd(o.expectedDate))}${ymd(o.expectedDate) < today ? ' ⚠️ เลยกำหนด' : ''}` : ''}`), ...(ords.length > MAX ? [`…และอีก ${ords.length - MAX} ใบ`] : []))
  return { n: transit.length + nOrd, text: lines.join('\n') }
}

// (v1.0.1097) รุ่นที่เหลือน้อย: เทียบรถพร้อมขาย + กำลังมา กับใบจองที่ยังรอรถ
export function lowStockAnswer(vehicles, bookings) {
  const k = v => carOf(v) || String(v.model || '').trim()
  const m = new Map()
  const row = name => { if (!m.has(name)) m.set(name, { name, ready: 0, coming: 0, wait: 0 }); return m.get(name) }
  alive(vehicles).forEach(v => { if (!k(v)) return; if (v.status === 'available') row(k(v)).ready++; else if (v.status === 'transit') row(k(v)).coming++ })
  alive(bookings).filter(b => b.status === 'รอรถ').forEach(b => { if (k(b)) row(k(b)).wait++ })
  const rows = [...m.values()].map(r => ({ ...r, gap: r.ready + r.coming - r.wait })).filter(r => r.ready <= 1 || r.gap < 0)
    .sort((a, b) => a.gap - b.gap || a.ready - b.ready)
  if (!rows.length) return { n: 0, text: '✅ ทุกรุ่นยังมีรถพร้อมขายพอ (เหลือรุ่นละ 2 คันขึ้นไป และพอสำหรับใบจองที่รอรถ)' }
  return { n: rows.length, text: [`📉 รุ่นที่รถเหลือน้อย ${rows.length} รุ่น`,
    ...rows.slice(0, MAX).map(r => `• ${r.name} — พร้อมขาย ${r.ready}${r.coming ? ` · กำลังมา ${r.coming}` : ''}${r.wait ? ` · ใบจองรอรถ ${r.wait}` : ''}${r.gap < 0 ? ` · ⚠️ ขาด ${-r.gap} คัน` : ''}`),
    rows.some(r => r.gap < 0) ? '💡 สั่งรุ่นที่ขาดก่อน — มีลูกค้าจองรออยู่แล้ว' : '💡 รุ่นที่เหลือคันเดียว ควรสั่งเพิ่มก่อนหมด'].join('\n') }
}

// (v1.0.1098) ค่าใช้จ่าย / กำไรของเดือน — นิยามเดียวกับหน้า P&L (รายได้+ต้นทุนจากใบจอง · ค่าใช้จ่ายที่เบิกผ่านระบบ ไม่รวมเงินเดือน)
const thb = n => '฿' + Math.round(Number(n) || 0).toLocaleString('th-TH')
const prevYm = ym => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }
const g0 = (real, low) => low && real[0].g < 0 ? `⚠️ ขาดทุน ${real.filter(r => r.g < 0).length} คัน — เช็กส่วนลด/ของแถมก่อนปิดดีลครั้งหน้า` : ''
export function moneyMonthAnswer({ sales = [], opex = [], today, prev = false, kind = 'expense', saleCost, perUnit = false, low = false, byModel = false }) {
  const ym = prev ? prevYm(today.slice(0, 7)) : today.slice(0, 7)
  const word = prev ? 'เดือนก่อน' : 'เดือนนี้'
  const label = `${word} (${ym.slice(5, 7)}/${+ym.slice(0, 4) + 543})`
  const ex = opex.filter(e => e.month === ym)
  const exTotal = ex.reduce((a, e) => a + e.amt, 0)
  const byCat = {}
  ex.forEach(e => { byCat[e.label] = (byCat[e.label] || 0) + e.amt })
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const exLines = cats.length ? cats.slice(0, 5).map(([k, v]) => `• ${k} ${thb(v)}`) : []
  if (kind === 'expense') {
    const before = opex.filter(e => e.month === prevYm(ym)).reduce((a, e) => a + e.amt, 0)
    if (!ex.length) return { n: 0, text: `💸 ค่าใช้จ่าย${label}: ยังไม่มีรายการเบิกที่อนุมัติ${before ? ` · เดือนก่อนหน้า ${thb(before)}` : ''}\nℹ️ นับจากเบิกพนักงาน + เงินสดย่อยที่อนุมัติแล้ว (ไม่รวมเงินเดือน)` }
    return { n: ex.length, text: [`💸 ค่าใช้จ่าย${label} ${thb(exTotal)}${before ? ` · เดือนก่อนหน้า ${thb(before)}` : ''}`, ...exLines, 'ℹ️ นับจากเบิกพนักงาน + เงินสดย่อยที่อนุมัติแล้ว (ไม่รวมเงินเดือน)'].join('\n') }
  }
  if (perUnit) {
    // ใช้เฉพาะคันที่กรอกต้นทุนจริง (คันที่ประมาณการ 82% กำไรเท่ากันหมด เทียบกันไม่ได้) · ย้อนหลัง 90 วัน
    const from = new Date(Date.parse(today) - 90 * 86400000).toISOString().slice(0, 10)
    const real = sales.filter(x => String(x.date || '').slice(0, 10) >= from && String(x.date || '').slice(0, 10) <= today && Number(x.cost) > 0 && Number(x.salePrice) > 0)
      .map(x => ({ x, g: Number(x.salePrice) - Number(x.cost) })).sort((a, b) => low ? a.g - b.g : b.g - a.g)
    const all = sales.filter(x => String(x.date || '').slice(0, 10) >= from && String(x.date || '').slice(0, 10) <= today).length
    if (!real.length) return { n: 0, text: `📈 กำไรรายคัน 90 วันล่าสุด: ยังไม่มีคันไหนกรอก "ต้นทุนรถ" ในใบจอง${all ? ` (ขายไป ${all} คัน)` : ''}\n💡 ใส่ต้นทุนจริงในใบจอง LAMI จะบอกได้ว่าคันไหนกำไรดี/น้อย` }
    if (byModel) {
      const m = new Map()
      real.forEach(({ x, g }) => { const k = carOf(x) || 'ไม่ระบุรุ่น'; const r = m.get(k) || { k, n: 0, g: 0, p: 0 }; r.n++; r.g += g; r.p += Number(x.salePrice); m.set(k, r) })
      const rows = [...m.values()].map(r => ({ ...r, avg: r.g / r.n })).sort((a, b) => low ? a.avg - b.avg : b.avg - a.avg)
      return { n: rows.length, text: [`📈 กำไรขั้นต้นเฉลี่ยต่อคันรายรุ่น 90 วันล่าสุด — ${low ? 'น้อยสุด' : 'มากสุด'}ก่อน (${real.length} คันที่มีต้นทุนจริง${all > real.length ? ` จาก ${all} คัน` : ''})`,
        ...rows.slice(0, 8).map((r, i) => `${i + 1}. ${r.k} — เฉลี่ย ${thb(r.avg)}/คัน (${Math.round(r.g / r.p * 100)}%) · ${r.n} คัน`)].join('\n') }
    }
    return { n: real.length, text: [`📈 กำไรขั้นต้นรายคัน 90 วันล่าสุด — ${low ? 'น้อยสุด' : 'มากสุด'}ก่อน (${real.length} คันที่มีต้นทุนจริง${all > real.length ? ` จาก ${all} คัน` : ''})`,
      ...real.slice(0, 8).map(({ x, g }) => `• ${carOf(x) || 'รถ'} · ${x.custName || 'ลูกค้า'} — ${thb(g)} (${Math.round(g / Number(x.salePrice) * 100)}%)`),
      g0(real, low)].filter(Boolean).join('\n') }
  }
  const rows = sales.filter(x => String(x.date || '').startsWith(ym))
  const rev = rows.reduce((a, x) => a + (Number(x.salePrice) || 0), 0)
  const cogs = rows.reduce((a, x) => a + saleCost(x), 0)
  const est = rows.filter(x => !(Number(x.cost) > 0) && (Number(x.salePrice) || 0) > 0).length
  const gross = rev - cogs, net = gross - exTotal
  if (!rev && !exTotal) return { n: 0, text: `📈 กำไร${label}: ยังไม่มียอดขายหรือค่าใช้จ่ายในระบบ` }
  return { n: rows.length, text: [`📈 กำไร${label} (ประมาณการจากระบบ)`,
    `💰 รายได้ ${thb(rev)} (${rows.length} คัน · นับแบบเดียวกับหน้า P&L) · ต้นทุนรถ ${thb(cogs)}`,
    `📊 กำไรขั้นต้น ${thb(gross)}${rev ? ` (${Math.round(gross / rev * 100)}%)` : ''}`,
    `💸 ค่าใช้จ่ายที่เบิก ${thb(exTotal)} → กำไรสุทธิ ${thb(net)}`,
    est ? `ℹ️ ${est} คันยังไม่ได้ใส่ต้นทุนจริง ใช้ต้นทุนประมาณการแทน · ยังไม่รวมเงินเดือน` : 'ℹ️ ยังไม่รวมเงินเดือน'].join('\n') }
}

// (v1.0.1099) ผลสำรวจความพึงพอใจ (csat 1–5 · nps 0–10) ของเดือน · NPS = %promoter(9–10) − %detractor(0–6) · คะแนนต่ำขึ้นก่อน
export function csatAnswer(rows, { today, prev = false, low = false }) {
  let ym = today.slice(0, 7)
  if (prev) { const [y, m] = ym.split('-').map(Number); ym = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }
  const word = prev ? 'เดือนก่อน' : 'เดือนนี้'
  const all = alive(rows)
  const list = all.filter(r => (ymd(r.date) || ymd(r.createdAt)).startsWith(ym))
  const bad = r => (Number(r.csat) > 0 && Number(r.csat) <= 2) || (typeof r.nps === 'number' && r.nps <= 6)
  const pool = low && !list.filter(bad).length ? all.filter(r => (ymd(r.date) || ymd(r.createdAt)) >= addDays(today, -90)) : list
  const lows = pool.filter(bad).sort((a, b) => (Number(a.csat) || 9) - (Number(b.csat) || 9))
  if (!list.length && !lows.length) return { n: 0, text: `⭐ ${word}ยังไม่มีผลสำรวจความพึงพอใจ — ส่งแบบสำรวจหลังส่งมอบ/เข้าศูนย์ได้ที่หน้า CSAT` }
  const lines = []
  if (list.length) {
    const cs = list.map(r => Number(r.csat)).filter(n => n > 0)
    const np = list.map(r => r.nps).filter(n => typeof n === 'number')
    const nps = np.length ? Math.round((np.filter(n => n >= 9).length - np.filter(n => n <= 6).length) / np.length * 100) : null
    lines.push(`⭐ ความพึงพอใจ${word} — ${list.length} คนตอบ`, `${cs.length ? `😊 คะแนนเฉลี่ย ${(cs.reduce((a, n) => a + n, 0) / cs.length).toFixed(1)}/5` : ''}${nps != null ? `${cs.length ? ' · ' : ''}📣 NPS ${nps > 0 ? '+' : ''}${nps}` : ''}`)
  } else lines.push(`⭐ ${word}ยังไม่มีผลสำรวจ — แสดงคะแนนต่ำใน 90 วันล่าสุด`)
  if (lows.length) lines.push(`⚠️ ให้คะแนนต่ำ ${lows.length} คน`, ...lows.slice(0, MAX).map(r => `• ${r.customer || r.customerName || 'ลูกค้า'}${r.model ? ' · ' + r.model : ''} · ${Number(r.csat) > 0 ? '⭐' + r.csat + '/5' : ''}${typeof r.nps === 'number' ? ' NPS ' + r.nps : ''}${r.comment ? ` · "${String(r.comment).replace(/\s+/g, ' ').slice(0, 60)}"` : ''}${r.phone ? ' · 📞 ' + r.phone : ''}`), '💡 โทรขอโทษและถามว่าแก้อะไรได้ภายใน 24 ชม. — เปลี่ยนคนไม่พอใจเป็นคนบอกต่อได้')
  else if (list.length) lines.push('✅ ไม่มีลูกค้าให้คะแนนต่ำ')
  return { n: list.length, text: lines.filter(Boolean).join('\n') }
}

export function topScoreAnswer(customers, { scoreOf, max = MAX }) {
  const list = alive(customers).filter(c => !c.isLost && !c.bookingId && ['lead', 'pp', undefined, ''].includes(c.stage))
    .map(c => ({ c, s: scoreOf(c) })).sort((a, b) => b.s.score - a.s.score).slice(0, max)
  if (!list.length) return { n: 0, text: '👥 ยังไม่มีลูกค้าที่กำลังติดตาม' }
  return { n: list.length, text: [`🎯 ลูกค้าที่มีโอกาสปิดสูงสุด ${list.length} คน`,
    ...list.map(({ c, s }, i) => `${i + 1}. ${nm(c)} — ${s.score}%${c.interestedModel ? ' · 🚗 ' + c.interestedModel : ''}${(() => { const g = (s.signals || []).filter(x => !/รถที่สนใจ|ความสนใจสูง/.test(x)); return g.length ? ' · ' + g[0] : '' })()}`),
    '💡 โทรนัดทดลองขับหรือส่งใบเสนอราคาให้ 3 คนแรกวันนี้'].join('\n') }
}

export function deliveredAnswer(bookings, { today, period = 'month' }) {
  let from = today.slice(0, 7) + '-01', to = today, label = 'เดือนนี้'
  if (period === 'prevmonth') { from = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1)).toISOString().slice(0, 10); to = addDays(today.slice(0, 7) + '-01', -1); label = 'เดือนก่อน' }
  else if (period === 'year') { from = today.slice(0, 4) + '-01-01'; label = 'ปีนี้' }
  else if (period === 'week') { from = addDays(today, -6); label = 'ในรอบ 7 วัน' }
  const dOf = b => String(b.actualDeliveryDate || b.deliveryDate || '').slice(0, 10)
  const list = alive(bookings).filter(b => (b.status === 'ส่งมอบแล้ว' || b.status === 'delivered') && dOf(b) >= from && dOf(b) <= to).sort((a, b) => dOf(b).localeCompare(dOf(a)))
  const span = `${dmy(from)}–${dmy(to)}`
  if (!list.length) return { n: 0, text: `🚗 ${label}ยังไม่มีลูกค้ารับรถ (${span})` }
  return { n: list.length, text: [`✅ ลูกค้ารับรถ${label} ${list.length} คน · ${span}`,
    ...list.slice(0, MAX).map(b => `• ${dmy(dOf(b))} ${nm(b)}${carOf(b) ? ' · ' + carOf(b) : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''}`),
    ...more(list.length), '💡 โทรถามความพึงพอใจหลังรับรถ 7 วัน และขอให้แนะนำเพื่อน'].join('\n') }
}

const CLAIM_L = { reported: '📋 แจ้งเคลม', surveying: '🔍 สำรวจภัย', approved: '✅ อนุมัติ', repairing: '🔧 กำลังซ่อม' }
export function claimAnswer(claims, { today }) {
  const open = alive(claims).filter(c => CLAIM_L[c.status] || !c.status)
  if (!open.length) return { n: 0, text: '✅ ไม่มีเคลมประกันที่ค้างอยู่' }
  const by = {}
  open.forEach(c => { const k = CLAIM_L[c.status] || '📋 แจ้งเคลม'; by[k] = (by[k] || 0) + 1 })
  const age = c => { const d = ymd(c.reported || c.createdAt); return d ? Math.round((Date.parse(today) - Date.parse(d)) / 86400000) : 0 }
  const list = open.map(c => ({ c, a: age(c) })).sort((x, y) => y.a - x.a)
  return { n: open.length, text: [`🛡 เคลมประกันค้าง ${open.length} เรื่อง`, Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · '),
    ...list.slice(0, MAX).map(({ c, a }) => `• ${c.customer || 'ลูกค้า'}${c.plate ? ' · ' + c.plate : ''}${c.insurer ? ' · ' + c.insurer : ''} · ${CLAIM_L[c.status] || '📋 แจ้งเคลม'}${a > 0 ? ` · ${a} วัน` : ''}`),
    ...more(open.length), list[0].a > 14 ? `💡 ${list[0].c.customer || 'เรื่องแรก'} ค้าง ${list[0].a} วันแล้ว — โทรตามบริษัทประกัน` : ''].filter(Boolean).join('\n') }
}

export function partsLowAnswer(parts) {
  const list = alive(parts).filter(p => (Number(p.qty) || 0) <= (Number(p.minQty) || 0)).sort((a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0))
  if (!list.length) return { n: 0, text: `✅ อะไหล่ทุกรายการยังเหลือเกินจุดสั่งซื้อ (${alive(parts).length} รายการ)` }
  const out = list.filter(p => !(Number(p.qty) > 0)).length
  return { n: list.length, text: [`📦 อะไหล่ถึงจุดสั่งซื้อ ${list.length} รายการ${out ? ` (หมดแล้ว ${out})` : ''}`,
    ...list.slice(0, MAX).map(p => `• ${p.name || p.partNo || 'อะไหล่'} — เหลือ ${Number(p.qty) || 0}${p.unit ? ' ' + p.unit : ''} · จุดสั่ง ${Number(p.minQty) || 0}`), ...more(list.length),
    '💡 เปิดหน้าสั่งอะไหล่เพื่อสั่งรายการที่หมดก่อน'].join('\n') }
}

export function serviceRevAnswer(jobs, { today, prev = false }) {
  const [from, to, label] = monthRange(today, prev)
  const fmt = n => '฿' + Math.round(n).toLocaleString('th-TH')
  const done = alive(jobs).filter(j => ['done', 'delivered'].includes(j.status)).filter(j => { const d = ymd(j.updatedAt || j.createdAt); return d >= from && d <= to })
  const opened = alive(jobs).filter(j => { const d = ymd(j.createdAt); return d >= from && d <= to }).length
  const labor = done.reduce((a, j) => a + (Number(j.labor) || 0), 0)
  if (!done.length) return { n: 0, text: `🔧 รายได้ศูนย์บริการ${label}: ยังไม่มีงานซ่อมที่ปิดงาน (${dmy(from)}–${dmy(to)}) · เปิดงานใหม่ ${opened} งาน` }
  return { n: done.length, text: [`🔧 รายได้ศูนย์บริการ${label} ${fmt(labor)} (ค่าแรง)`, `✅ ปิดงาน ${done.length} งาน · เฉลี่ย ${fmt(labor / done.length)}/งาน · เปิดงานใหม่ ${opened} งาน`, `📅 ${dmy(from)}–${dmy(to)} · นับเหมือนหน้างานซ่อม (งานเสร็จ/ส่งคืนแล้ว)`].join('\n') }
}

export function yesterdayAnswer({ customers = [], bookings = [], walkins = [], drives = [] }, { today }) {
  const y = addDays(today, -1)
  const on = v => ymd(v) === y
  const nc = alive(customers).filter(c => on(c.createdAt))
  const bk = alive(bookings).filter(b => String(b.bookingDate || '').slice(0, 10) === y && !CANCEL.test(b.status || ''))
  const dv = alive(bookings).filter(b => (b.status === 'ส่งมอบแล้ว' || b.status === 'delivered') && String(b.actualDeliveryDate || b.deliveryDate || '').slice(0, 10) === y)
  const wi = alive(walkins).filter(w => on(w.visitTime || w.createdAt))
  const td = alive(drives).filter(t => String(t.date || '').slice(0, 10) === y && !['cancelled', 'no_show', 'noshow'].includes(t.status))
  const lines = [`📆 สรุปเมื่อวาน ${dmy(y)}`,
    `🧲 ลูกค้าใหม่ ${nc.length} คน · 🚶 walk-in ${wi.length} · 🚗 ทดลองขับ ${td.length}`,
    `📝 จองใหม่ ${bk.length} ใบ · ✅ ส่งมอบ ${dv.length} คัน`]
  if (bk.length) lines.push(...bk.slice(0, 5).map(b => `• 📝 ${nm(b)}${carOf(b) ? ' · ' + carOf(b) : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''}`))
  if (dv.length) lines.push(...dv.slice(0, 5).map(b => `• ✅ ${nm(b)}${carOf(b) ? ' · ' + carOf(b) : ''}`))
  if (!nc.length && !bk.length && !dv.length && !wi.length && !td.length) lines.push('😴 เมื่อวานยังไม่มีการบันทึกงานในระบบ')
  return { n: nc.length + bk.length + dv.length, text: lines.join('\n') }
}

// ลูกค้าที่รับรถไปแล้ว 14–120 วัน (ช่วงที่ยังประทับใจ) และไม่มีเรื่องร้องเรียน → ขอให้แนะนำเพื่อน
export function referAskAnswer(bookings, { today, complainedNames = new Set() }) {
  const list = alive(bookings).filter(b => b.status === 'ส่งมอบแล้ว' || b.status === 'delivered').map(b => {
    const d = String(b.actualDeliveryDate || b.deliveryDate || '').slice(0, 10)
    return { b, d, days: d ? Math.round((Date.parse(today) - Date.parse(d)) / 86400000) : -1 }
  }).filter(x => x.days >= 14 && x.days <= 120 && !complainedNames.has(String(nm(x.b)).replace(/\s+/g, ''))).sort((a, b) => a.days - b.days)
  if (!list.length) return { n: 0, text: '🤝 ยังไม่มีลูกค้าที่รับรถครบ 14–120 วัน (ช่วงที่เหมาะขอให้แนะนำเพื่อน)' }
  return { n: list.length, text: [`🤝 ลูกค้าที่ควรขอให้แนะนำเพื่อน ${list.length} คน (รับรถ 14–120 วัน ไม่มีเรื่องร้องเรียน)`,
    ...list.slice(0, MAX).map(({ b, d, days }) => `• ${nm(b)}${carOf(b) ? ' · ' + carOf(b) : ''} · รับรถ ${dmy(d)} (${days} วัน)${b.salesName ? ' · 👤 ' + b.salesName : ''}${b.phone ? ' · 📞 ' + b.phone : ''}`),
    ...more(list.length), '💡 โทรถามการใช้รถก่อน แล้วค่อยชวนแนะนำเพื่อน — บอกสิทธิ์ที่เพื่อนจะได้ด้วย'].join('\n') }
}

export function eventBestAnswer(events, metricsOf, { today }) {
  const done = alive(events).filter(e => e.startDate && e.startDate <= today).map(e => ({ e, m: metricsOf(e) }))
  if (!done.length) return { n: 0, text: '🎪 ยังไม่มีงานออกบูธ/อีเวนต์ที่จัดไปแล้ว' }
  const fmt = n => Number(n || 0).toLocaleString('th-TH')
  done.sort((a, b) => b.m.bookings - a.m.bookings || b.m.leads - a.m.leads)
  const costed = done.filter(x => x.m.costPerLead), cheap = costed.length > 1 ? costed.sort((a, b) => a.m.costPerLead - b.m.costPerLead)[0] : null
  return { n: done.length, text: [`🎪 ผลงานออกบูธ/อีเวนต์ (${done.length} งาน · เรียงตามยอดจอง)`,
    ...done.slice(0, MAX).map(({ e, m }, i) => `${i + 1}. ${e.title || 'อีเวนต์'} (${dmy(e.startDate)}) — Lead ${m.leads} · จอง ${m.bookings}${m.cost ? ` · งบ ฿${fmt(m.cost)}` : ''}${m.costPerLead ? ` · ฿${fmt(m.costPerLead)}/Lead` : ''}`),
    cheap ? `💡 ${cheap.e.title || 'งานนี้'} ได้ Lead ถูกสุด (฿${fmt(cheap.m.costPerLead)}/Lead)` : (costed.length ? '' : '💡 ใส่งบที่ใช้ในแต่ละงาน เพื่อเทียบความคุ้มได้')].filter(Boolean).join('\n') }
}

export function campaignBestAnswer(bookings, { today, months = 6 }) {
  const from = addDays(today, -Math.round(months * 30.5))
  const m = {}
  alive(bookings).forEach(b => { const d = String(b.bookingDate || '').slice(0, 10); const k = String(b.campaign || '').trim(); if (!k || d < from || d > today) return; const r = m[k] || (m[k] = { n: 0, live: 0, del: 0 }); r.n++; if (!CANCEL.test(b.status || '')) r.live++; if (b.status === 'ส่งมอบแล้ว') r.del++ })
  const rows = Object.entries(m).sort((a, b) => b[1].live - a[1].live)
  if (!rows.length) return { n: 0, text: `📣 ยังไม่มีใบจองที่ระบุแคมเปญ ${months} เดือนล่าสุด — เลือกแคมเปญในใบจองเพื่อดูว่าอันไหนได้ผล` }
  return { n: rows.length, text: [`📣 แคมเปญในใบจอง ${months} เดือนล่าสุด (${dmy(from)}–${dmy(today)})`, ...rows.slice(0, 8).map(([k, r], i) => `${i + 1}. ${k} — จอง ${r.live} ใบ · ส่งมอบ ${r.del}${r.n > r.live ? ` · ถอน ${r.n - r.live}` : ''}`)].join('\n') }
}

export function newCustomerAnswer(customers, { today, period = 'month', sourceLabel = {}, source = '' }) {
  let from, to = today, label
  if (period === 'today') { from = today; label = 'วันนี้' }
  else if (period === 'yesterday') { from = to = addDays(today, -1); label = 'เมื่อวาน' }
  else if (period === 'week') { from = addDays(today, -6); label = 'ในรอบ 7 วัน' }
  else if (period === 'prevmonth') { const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1)); from = d.toISOString().slice(0, 10); to = addDays(today.slice(0, 7) + '-01', -1); label = 'เดือนก่อน' }
  else { from = today.slice(0, 7) + '-01'; label = 'เดือนนี้' }
  const all = alive(customers).filter(c => { const d = ymd(c.createdAt); return d && d >= from && d <= to })
  if (source) {
    const lab = sourceLabel[source] || source
    const hit = all.filter(c => String(c.source || '').trim() === source)
    if (!hit.length) return { n: 0, text: `👥 ลูกค้าใหม่${label}จาก ${lab}: ยังไม่มี (${dmy(from)}–${dmy(to)}) · ลูกค้าใหม่ทุกช่องทาง ${all.length} คน` }
    return { n: hit.length, text: [`👥 ลูกค้าใหม่${label}จาก ${lab} ${hit.length} คน (${dmy(from)}–${dmy(to)}) · จากทั้งหมด ${all.length} คน`,
      `🔴 Hot ${hit.filter(c => c.temperature === 'hot').length} · 📝 จองแล้ว ${hit.filter(c => c.bookingId || ['booking', 'booked', 'delivered'].includes(c.stage)).length}`,
      ...hit.slice(0, MAX).map(c => `• ${nm(c)}${c.interestedModel ? ' · ' + c.interestedModel : ''}${c.assignedTo ? ' · 👤 ' + c.assignedTo : ''}`), ...more(hit.length)].join('\n') }
  }
  const list = all
  if (!list.length) return { text: `👥 ลูกค้าใหม่${label}: ยังไม่มี`, n: 0 }
  const src = {}
  list.forEach(c => { const raw = String(c.source || '').trim(); const k = sourceLabel[raw] || raw || 'ไม่ระบุ'; src[k] = (src[k] || 0) + 1 })
  const hot = list.filter(c => c.temperature === 'hot').length
  const booked = list.filter(c => c.bookingId || ['booking', 'booked', 'delivered'].includes(c.stage)).length
  return { n: list.length, text: [`👥 ลูกค้าใหม่${label} ${list.length} คน (${dmy(from)}–${dmy(to)})`, `🔴 Hot ${hot} · 📝 จองแล้ว ${booked}`, '', '📍 มาจาก', ...Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `• ${k} ${v} คน`)].join('\n') }
}

// ระบบยังไม่มีวันเกิดลูกค้า → บอกตรงๆ แล้วให้วันครบรอบซื้อรถแทน (จากใบจองที่ส่งมอบแล้ว)
export function annivAnswer(bookings, { today, range = 0, asked = '', nextMonth = false }) {
  // (v1.0.1094) "เดือนหน้า" = วันที่ 1 ถึงสิ้นเดือนหน้า (เดิมนับ 30 วันจากวันนี้)
  const from = nextMonth ? new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 1)).toISOString().slice(0, 10) : today
  const end = nextMonth ? new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) + 1, 0)).toISOString().slice(0, 10) : addDays(today, range)
  if (nextMonth) range = 1
  const list = alive(bookings).filter(b => b.status === 'ส่งมอบแล้ว' || b.status === 'delivered')
    .map(b => ({ b, nx: nextAnniversary(b.deliveryDate || b.bookingDate || '', from) }))
    .filter(x => x.nx && x.nx.date >= from && x.nx.date <= end)
    .sort((a, b) => a.nx.date.localeCompare(b.nx.date))
  const head = /เกิด/.test(asked) ? 'ℹ️ ระบบยังไม่ได้เก็บวันเกิดลูกค้า — ดูวันครบรอบซื้อรถแทนได้\n\n' : ''
  const when = range ? `${dmy(from)}–${dmy(end)}` : `วันนี้ ${dmy(today)}`
  if (!list.length) return { text: `${head}🎉 ไม่มีลูกค้าครบรอบซื้อรถ (${when})`, n: 0 }
  return { n: list.length, text: [`${head}🎉 ลูกค้าครบรอบซื้อรถ (${when}) ${list.length} ราย`, ...list.slice(0, MAX).map(({ b, nx }) => `• ${dmy(nx.date)} ${nm(b)}${carOf(b) ? ' · ' + carOf(b) : ''} · ครบ ${nx.years} ปี`), ...more(list.length)].join('\n') }
}

const DONE = ['ส่งมอบแล้ว', 'ถอนจอง', 'ยกเลิก']
// นัดส่งมอบ วันนี้/พรุ่งนี้/7 วัน (ยังไม่ได้ส่งจริง · ไม่นับใบที่ถอนจอง)
export function deliveryAnswer(bookings, { today, day = 'today' }) {
  // (v1.0.1095) สัปดาห์หน้า = จันทร์–อาทิตย์ถัดไป
  const dow = new Date(today + 'T00:00:00Z').getUTCDay()
  const nm1 = (() => { const y = +today.slice(0, 4), m = +today.slice(5, 7); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}` })()
  const from = day === 'tomorrow' ? addDays(today, 1) : day === 'nextweek' ? addDays(today, ((8 - dow) % 7) || 7) : day === 'nextmonth' ? nm1 + '-01' : today
  const to = day === 'restmonth' ? addDays(nm1 + '-01', -1) : day === 'week' ? addDays(today, 6) : day === 'nextweek' ? addDays(from, 6) : day === 'nextmonth' ? addDays((() => { const [y, m] = nm1.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01` })(), -1) : from
  const list = alive(bookings).filter(b => !DONE.includes(b.status) && ymd(b.deliveryDate) >= from && ymd(b.deliveryDate) <= to)
    .sort((a, b) => ymd(a.deliveryDate).localeCompare(ymd(b.deliveryDate)) || String(a.deliveryTime || '').localeCompare(String(b.deliveryTime || '')))
  const when = day === 'restmonth' ? `ที่เหลือเดือนนี้ (${dmy(from)}–${dmy(to)})` : day === 'week' ? ` 7 วันนี้ (${dmy(from)}–${dmy(to)})` : day === 'nextweek' ? `สัปดาห์หน้า (${dmy(from)}–${dmy(to)})` : day === 'nextmonth' ? `เดือนหน้า (${dmy(from)}–${dmy(to)})` : `${dayWord(day)} ${dmy(from)}`
  if (!list.length) return { text: `🚗 ไม่มีนัดส่งมอบ${when}`, n: 0 }
  return { n: list.length, text: [`🚗 นัดส่งมอบ${when} — ${list.length} คัน`, ...list.slice(0, MAX).map(b => `• ${['week', 'nextweek', 'nextmonth', 'restmonth'].includes(day) ? dmy(b.deliveryDate) + ' ' : ''}${b.deliveryTime ? String(b.deliveryTime).slice(0, 5) + ' ' : ''}${nm(b)}${b.model ? ' · ' + b.model : ''}${b.status ? ' · ' + b.status : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''}`), ...more(list.length)].join('\n') }
}

// ส่งมอบแล้วเดือนนี้แต่ยังไม่กรอกรายได้ (นิยามเดียวกับหน้างานวันนี้/รายงาน 18:00)
export function incomeMissingAnswer(bookings, { today }) {
  const month = today.slice(0, 7)
  const list = alive(bookings).filter(b => ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status) && !(Number(b.totalIncome) || 0) && String(b.cutDate || b.actualDeliveryDate || '').startsWith(month))
  if (!list.length) return { text: '💰 คันที่ส่งมอบเดือนนี้ กรอกรายได้ครบแล้ว 👍', n: 0 }
  const by = {}
  list.forEach(b => { const k = String(b.salesName || 'ไม่ระบุเซลส์').trim(); by[k] = (by[k] || 0) + 1 })
  return { n: list.length, text: [`💰 ส่งมอบเดือนนี้แต่ยังไม่กรอกรายได้ ${list.length} คัน`, ...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k} — ${v} คัน`), '', 'กรอกได้ที่หน้างานวันนี้ หมวด 💰 (แตะคันนั้นแล้วใส่ตัวเลข)'].join('\n') }
}

// เสียดีลเดือนนี้ (ตามวันที่กดเสียดีล) · เหตุผลรวม + รายเซลส์
export function lostAnswer(customers, { today, prev = false }) {
  const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - (prev ? 1 : 0), 1))
  const month = d.toISOString().slice(0, 7)
  const rows = lostBySeller(customers, month)
  const total = rows.reduce((s, r) => s + r.total, 0)
  const label = prev ? 'เดือนก่อน' : 'เดือนนี้'
  if (!total) {
    // (v1.0.1111) เดือนนี้ยังไม่มี → ให้ดูเหตุผลย้อนหลัง 3 เดือนแทน (ตอบ "ลูกค้าไม่ซื้อเพราะอะไร" ได้)
    const back = new Set([0, 1, 2].map(i => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7)))
    const r3 = {}; let n3 = 0
    alive(customers).filter(c => c.isLost && back.has(ymd(c.lostAt).slice(0, 7))).forEach(c => { const k = classifyLostReason(c.lostReason); r3[k] = (r3[k] || 0) + 1; n3++ })
    const tail = n3 ? ['', `❓ เหตุผลที่เสียดีล 3 เดือนล่าสุด (${n3} ราย)`, ...Object.entries(r3).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${LOST_REASON_LABELS[k] || k} ${v} ราย`)] : []
    return { text: [`📉 ${label}ยังไม่มีลูกค้าที่เสียดีล 👍`, ...tail].join('\n'), n: 0 }
  }
  const reasons = {}
  alive(customers).filter(c => c.isLost && ymd(c.lostAt).slice(0, 7) === month).forEach(c => { const k = classifyLostReason(c.lostReason); reasons[k] = (reasons[k] || 0) + 1 })
  return { n: total, text: [`📉 ${label}เสียดีล ${total} ราย`, '', '❓ เหตุผล', ...Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${LOST_REASON_LABELS[k] || k} ${v} ราย`), ...(rows.length > 1 ? ['', '👤 รายเซลส์', ...rows.slice(0, MAX).map(r => `• ${r.name} ${r.total} ราย${r.top[0] ? ' (ส่วนใหญ่: ' + r.top[0].label + ')' : ''}`)] : [])].join('\n') }
}

const APPT_DONE = ['cancelled', 'noshow']
const JOB_OPEN = { waiting: '⏳ รอรับรถ', checkin: '🔑 รับรถแล้ว', diagnosing: '🔍 วินิจฉัย', inprogress: '🔧 กำลังซ่อม', waiting_parts: '📦 รออะไหล่', qc: '✅ QC', done: '🏁 เสร็จ รอส่งคืน' }
// นัดเข้าศูนย์ของวัน + งานซ่อม (Job Card) ที่ยังไม่ส่งคืนลูกค้า แยกตามสถานะ
export function serviceAnswer(appts, jobs, { today, day = 'today' }) {
  // (v1.0.1110) "เดือนนี้ลูกค้าเข้าศูนย์กี่คัน" / "สัปดาห์นี้มีรถเข้าศูนย์กี่คัน" → นับนัดทั้งช่วง (ไม่นับยกเลิก/ไม่มา)
  if (day === 'month' || day === 'week') {
    const from = day === 'month' ? today.slice(0, 8) + '01' : today, to = day === 'month' ? today.slice(0, 8) + '31' : addDays(today, 6)
    const ap = alive(appts).filter(a => { const d = ymd(a.date); return d >= from && d <= to && !APPT_DONE.includes(a.status || '') })
    const past = ap.filter(a => ymd(a.date) < today).length, ahead = ap.length - past
    const word = day === 'month' ? 'เดือนนี้' : 'ใน 7 วันนี้'
    const open = alive(jobs).filter(j => JOB_OPEN[j.status || 'waiting']).length
    if (!ap.length) return { n: 0, text: [`🛠 ${word} (${dmy(from)}–${dmy(day === 'month' ? today : to)}) ยังไม่มีนัดเข้าศูนย์`, open ? `🔧 งานซ่อมที่ยังไม่ส่งคืน ${open} งาน` : ''].filter(Boolean).join('\n') }
    return { n: ap.length, text: [`🛠 นัดเข้าศูนย์${word} ${ap.length} คัน`, day === 'month' ? `• เข้ามาแล้ว ${past} คัน · ยังไม่ถึงวันนัด ${ahead} คัน` : '',
      ...ap.filter(a => ymd(a.date) >= today).sort((a, b) => (ymd(a.date) + (a.time || '')).localeCompare(ymd(b.date) + (b.time || ''))).slice(0, MAX).map(a => `• ${dmy(ymd(a.date)).slice(0, 5)} ${a.time ? String(a.time).slice(0, 5) + ' ' : ''}${nm(a)}${a.plate ? ' · ' + a.plate : ''}`),
      open ? `🔧 งานซ่อมที่ยังไม่ส่งคืน ${open} งาน` : ''].filter(Boolean).join('\n') }
  }
  const date = day === 'tomorrow' ? addDays(today, 1) : today
  const ap = alive(appts).filter(a => ymd(a.date) === date && !APPT_DONE.includes(a.status || ''))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  const open = alive(jobs).filter(j => JOB_OPEN[j.status || 'waiting'])
  const lines = []
  if (ap.length) lines.push(`🛠 นัดเข้าศูนย์${dayWord(day)} ${dmy(date)} — ${ap.length} คัน`, ...ap.slice(0, MAX).map(a => `• ${a.time ? String(a.time).slice(0, 5) + ' ' : ''}${nm(a)}${a.model ? ' · ' + a.model : ''}${a.plate ? ' · ' + a.plate : ''}${a.tech ? ' · 🔧 ' + a.tech : ''}`), ...more(ap.length))
  else lines.push(`🛠 ${dayWord(day)} (${dmy(date)}) ไม่มีนัดเข้าศูนย์`)
  lines.push('')
  if (!open.length) lines.push('🔧 ไม่มีงานซ่อมค้าง 👍')
  else {
    const by = {}
    open.forEach(j => { const k = j.status || 'waiting'; by[k] = (by[k] || 0) + 1 })
    lines.push(`🔧 งานซ่อมที่ยังไม่ส่งคืน ${open.length} งาน`, ...Object.keys(JOB_OPEN).filter(k => by[k]).map(k => `• ${JOB_OPEN[k]} ${by[k]} งาน`))
    const age = j => { const d = ymd(j.createdAt); return d ? Math.round((Date.parse(today) - Date.parse(d)) / 86400000) : 0 }
    const old = open.map(j => ({ j, n: age(j) })).filter(x => x.n >= 3 && x.j.status !== 'done').sort((a, b) => b.n - a.n)
    if (old.length) lines.push('', `⏰ ค้างนานเกิน 3 วัน ${old.length} งาน`, ...old.slice(0, 5).map(({ j, n }) => `• ${nm(j)}${j.plate ? ' · ' + j.plate : ''} — ${JOB_OPEN[j.status || 'waiting']} · ${n} วัน${j.techName ? ' · 🔧 ' + j.techName : ''}`))
  }
  return { n: ap.length + open.length, text: lines.join('\n') }
}

// ลูกค้า (ไม่นับเสียดีล/ลบ) ที่ยังไม่มีผู้ดูแล · ใหม่สุดก่อน
export function unassignedAnswer(customers) {
  const list = alive(customers).filter(c => !c.isLost && !String(c.assignedTo || '').trim())
    .sort((a, b) => ymd(b.createdAt).localeCompare(ymd(a.createdAt)))
  if (!list.length) return { text: '👤 ลูกค้าทุกคนมีผู้ดูแลแล้ว 👍', n: 0 }
  return { n: list.length, text: [`👤 ลูกค้าที่ยังไม่มีผู้ดูแล ${list.length} คน`, ...list.slice(0, MAX).map(c => `• ${nm(c)}${c.temperature === 'hot' ? ' 🔴' : ''}${c.interestedModel ? ' · ' + c.interestedModel : ''}${ymd(c.createdAt) ? ' · เข้ามา ' + dmy(ymd(c.createdAt)) : ''}`), ...more(list.length), '', 'มอบผู้ดูแลได้ที่หน้าลูกค้า (เลือกหลายคน → มอบหมาย)'].join('\n') }
}

// เตือนเข้าศูนย์ที่ยังไม่นัด: ครบกำหนดภายใน range วัน + ที่เลยกำหนดแล้ว (ไม่เกิน 60 วัน)
export function reminderAnswer(rows, { today, range = 30 }) {
  const end = addDays(today, range), from = addDays(today, -60)
  const list = alive(rows).filter(r => !r.booked && ymd(r.dueDate) && ymd(r.dueDate) >= from && ymd(r.dueDate) <= end)
    .sort((a, b) => ymd(a.dueDate).localeCompare(ymd(b.dueDate)))
  if (!list.length) return { text: `🔔 ไม่มีรถที่ต้องเตือนเข้าศูนย์ (ถึง ${dmy(end)})`, n: 0 }
  const late = list.filter(r => ymd(r.dueDate) < today).length
  const notCalled = list.filter(r => !r.contacted).length
  return { n: list.length, text: [`🔔 ต้องเตือนเข้าศูนย์ ${list.length} คัน (ถึง ${dmy(end)})${late ? ` · เลยกำหนดแล้ว ${late}` : ''}${notCalled ? ` · ยังไม่ได้ติดต่อ ${notCalled}` : ''}`,
    ...list.slice(0, MAX).map(r => `• ${dmy(ymd(r.dueDate))} ${r.customer || nm(r)}${r.plate ? ' · ' + r.plate : ''}${r.model ? ' · ' + r.model : ''}${ymd(r.dueDate) < today ? ' ❗' : ''}${r.contacted ? ' · ✅ ติดต่อแล้ว' : ''}`), ...more(list.length)].join('\n') }
}

// งานในปฏิทินที่เลยกำหนด (items = ผลจาก buildWorkItems ที่กรองขอบเขตแล้ว) · labels = KINDS
export function overdueAnswer(items, { today, labels = {} }) {
  const list = (items || []).filter(it => it && it.overdue).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (!list.length) return { text: '✅ ไม่มีงานที่เลยกำหนด 👍', n: 0 }
  const by = {}
  list.forEach(it => { by[it.kind] = (by[it.kind] || 0) + 1 })
  const late = it => Math.round((Date.parse(today) - Date.parse(it.date)) / 86400000)
  return { n: list.length, text: [`⚠️ งานเลยกำหนด ${list.length} รายการ`, Object.entries(by).map(([k, v]) => `${labels[k]?.icon || '•'} ${labels[k]?.label || k} ${v}`).join(' · '), '',
    ...list.slice(0, MAX).map(it => `• ${labels[it.kind]?.icon || ''} ${it.title || ''} — เลย ${late(it)} วัน${it.owner ? ' · 👤 ' + it.owner : ''}`), ...more(list.length), '', 'กดในปฏิทินงานเพื่อ ✓ ทำแล้ว หรือนัดใหม่'].join('\n') }
}

const daysTo = (today, d) => Math.round((Date.parse(d) - Date.parse(today)) / 86400000)
// ประกันภัยรถที่ยังไม่ต่อ: หมดภายใน range วัน + หมดไปแล้วไม่เกิน 30 วัน (ยังตามต่อได้)
export function insuranceAnswer(rows, { today, range = 30 }) {
  const list = alive(rows).filter(p => !['renewed', 'cancelled'].includes(p.status) && ymd(p.expiryDate))
    .map(p => ({ p, d: daysTo(today, ymd(p.expiryDate)) })).filter(x => x.d <= range && x.d >= -30).sort((a, b) => a.d - b.d)
  if (!list.length) return { text: `🛡 ไม่มีประกันภัยที่จะหมดใน ${range} วันนี้ 👍`, n: 0 }
  const gone = list.filter(x => x.d < 0).length
  return { n: list.length, text: [`🛡 ประกันภัยใกล้หมด/หมดแล้วยังไม่ต่อ ${list.length} ราย${gone ? ` (หมดไปแล้ว ${gone})` : ''}`,
    ...list.slice(0, MAX).map(({ p, d }) => `• ${nm(p)}${p.vehiclePlate ? ' · ' + p.vehiclePlate : ''}${p.insurer ? ' · ' + p.insurer : ''} — ${d < 0 ? `หมดไป ${-d} วัน ❗` : d === 0 ? 'หมดวันนี้' : `อีก ${d} วัน`} (${dmy(ymd(p.expiryDate))})`), ...more(list.length), '', '💡 โทรเสนอต่อก่อนหมด 2–4 สัปดาห์ ปิดง่ายที่สุด'].join('\n') }
}

// การรับประกันรถ (warranty) ที่จะหมดภายใน range วัน — โอกาสขายขยายรับประกัน/แพ็กเกจบริการ
export function warrantyAnswer(rows, { today, range = 30 }) {
  const list = alive(rows).filter(w => ymd(w.endDate) && w.status !== 'void')
    .map(w => ({ w, d: daysTo(today, ymd(w.endDate)) })).filter(x => x.d >= 0 && x.d <= range).sort((a, b) => a.d - b.d)
  if (!list.length) return { text: `🛡 ไม่มีรถที่รับประกันจะหมดใน ${range} วันนี้`, n: 0 }
  return { n: list.length, text: [`🛡 รับประกันรถจะหมดใน ${range} วัน — ${list.length} คัน`,
    ...list.slice(0, MAX).map(({ w, d }) => `• ${w.customerName || nm(w)}${w.vehiclePlate ? ' · ' + w.vehiclePlate : ''}${w.model ? ' · ' + w.model : ''} — อีก ${d} วัน (${dmy(ymd(w.endDate))})`), ...more(list.length), '', '💡 เสนอขยายการรับประกันหรือแพ็กเกจเช็คระยะ'].join('\n') }
}

const WALKIN_OUT = { test_drive: '🚗 ทดลองขับ', quotation: '📄 รับใบเสนอราคา', book: '📝 จอง', follow_up: '📞 นัดติดตาม', leave: '🚶 กลับไปก่อน' }
// ลูกค้าเดินเข้าโชว์รูม (walk_ins) ตามช่วงวัน · แยกผลการเข้าชม
export function walkinAnswer(rows, { today, day = 'today' }) {
  const from = day === 'yesterday' ? addDays(today, -1) : day === 'week' ? addDays(today, -6) : day === 'month' ? today.slice(0, 7) + '-01' : today
  const to = day === 'yesterday' ? from : today
  const label = { today: 'วันนี้', yesterday: 'เมื่อวาน', week: 'ในรอบ 7 วัน', month: 'เดือนนี้' }[day]
  const list = alive(rows).filter(w => { const d = ymd(w.visitTime); return d && d >= from && d <= to })
  if (!list.length) return { text: `🚶 ${label}ยังไม่มีบันทึกลูกค้า walk-in`, n: 0 }
  const by = {}
  list.forEach(w => { const k = WALKIN_OUT[w.outcome] || 'ไม่ระบุผล'; by[k] = (by[k] || 0) + 1 })
  const hot = list.filter(w => w.interest === 'hot').length
  const lines = [`🚶 ลูกค้า walk-in ${label} ${list.length} คน${hot ? ` · 🔴 Hot ${hot}` : ''}`, Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · ')]
  if (day === 'today' || day === 'yesterday') lines.push('', ...list.slice(0, MAX).map(w => `• ${nm(w)}${w.interestedIn ? ' · ' + w.interestedIn : ''}${WALKIN_OUT[w.outcome] ? ' · ' + WALKIN_OUT[w.outcome] : ''}${w.staff ? ' · 👤 ' + w.staff : ''}`), ...more(list.length))
  return { n: list.length, text: lines.join('\n') }
}

// (v1.0.1117) ค่าการตลาดของเดือน: ค่าโฆษณาที่กรอกไว้ในบัญชีโซเชียล + ค่าบูธที่ "ใช้จริง" (ไม่เอางบที่ตั้งมาคิด) · ต้นทุนต่อลูกค้าใหม่
export function mktSpendAnswer({ accounts = [], events = [], customers = [], today, prev = false, spendSummary, accountResults }) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7)
  const month = prev ? (m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`) : today.slice(0, 7)
  const label = `${month.slice(5, 7)}/${+month.slice(0, 4) + 543}`
  const fmt = n => '฿' + Math.round(n).toLocaleString('en-US')
  const ad = spendSummary(alive(accounts), accountResults(alive(customers), month), month)
  const evs = alive(events).filter(e => ymd(e.startDate).slice(0, 7) === month)
  const evSpent = evs.reduce((a, e) => a + Math.max(0, Number(e.spent) || 0), 0)
  const evBudgetOnly = evs.filter(e => !(Number(e.spent) > 0) && Number(e.budget) > 0)
  const newCust = alive(customers).filter(c => created(c).slice(0, 7) === month).length
  const total = ad.spend + evSpent
  const word = prev ? 'เดือนก่อน' : 'เดือนนี้'
  if (!total) return { n: 0, text: [`💸 ค่าการตลาด${word} (${label}): ยังไม่ได้ใส่ค่าโฆษณาหรือค่าบูธที่ใช้จริง`,
    `🧲 ลูกค้าใหม่${word} ${newCust} คน`,
    ...(evBudgetOnly.length ? [`ℹ️ มีงานบูธ ${evBudgetOnly.length} งานที่ใส่แค่งบที่ตั้ง ยังไม่ใส่ยอดใช้จริง`] : []),
    '💡 ใส่ค่าโฆษณาที่หน้าช่องทางโซเชียล (💸 ใส่ค่าโฆษณาเดือนนี้) และยอดใช้จริงของบูธที่หน้าอีเวนต์ แล้ว LAMI จะคิดต้นทุนต่อลีดให้'].join('\n') }
  const lines = [`💸 ค่าการตลาด${word} (${label}) ${fmt(total)}`]
  if (ad.spend) lines.push(`• 📣 ค่าโฆษณา ${fmt(ad.spend)} (${ad.paid} บัญชี) · Lead จากบัญชีที่ยิงแอด ${ad.leads}${ad.cpl != null ? ` → ${fmt(ad.cpl)}/Lead` : ''}${ad.cpb != null ? ` · ${fmt(ad.cpb)}/จอง` : ''}`)
  if (evSpent) lines.push(`• 🎪 ออกบูธ/อีเวนต์ ${fmt(evSpent)} (${evs.filter(e => Number(e.spent) > 0).length} งาน)`)
  lines.push(`🧲 ลูกค้าใหม่ทั้ง${word} ${newCust} คน${newCust ? ` → เฉลี่ย ${fmt(total / newCust)}/คน` : ''}`)
  if (evBudgetOnly.length) lines.push(`ℹ️ ไม่นับงานบูธ ${evBudgetOnly.length} งานที่ยังไม่ใส่ยอดใช้จริง`)
  return { n: 1, text: lines.join('\n') }
}

// (v1.0.1118) จำนวนสายที่โทรแล้วบันทึกผล (comm_logs type call) ช่วงวันที่ · แยกผล · team = แยกรายคน
const CALL_KINDS = [['😊 สนใจ', /^คุยแล้ว สนใจ/], ['🤔 ขอคิด', /^ขอคิด/], ['📵 ไม่รับสาย', /^ไม่รับสาย/], ['🙅 ไม่สนใจ', /^ไม่สนใจ/]]
export function callsAnswer(logs, { today, day = 'today', team = false }) {
  const from = day === 'yesterday' ? addDays(today, -1) : day === 'week' ? addDays(today, -6) : day === 'month' ? today.slice(0, 8) + '01' : today
  const to = day === 'yesterday' ? from : today
  const word = day === 'yesterday' ? `เมื่อวาน (${dmy(from)})` : day === 'week' ? `7 วันล่าสุด (${dmy(from)}–${dmy(to)})` : day === 'month' ? `เดือนนี้ (${dmy(from)}–${dmy(to)})` : `วันนี้ (${dmy(from)})`
  const list = alive(logs).filter(l => l.type === 'call' && ymd(l.createdAt) >= from && ymd(l.createdAt) <= to)
  const note = 'ℹ️ นับเฉพาะสายที่กด 📞 จากแอปแล้วบันทึกผลการโทร'
  if (!list.length) return { n: 0, text: [`📞 ${word} ยังไม่มีการโทรที่บันทึกผล`, note].join('\n') }
  const kinds = CALL_KINDS.map(([lab, re]) => [lab, list.filter(l => re.test(String(l.note || ''))).length]).filter(([, n]) => n)
  const people = new Set(list.map(l => l.customerId).filter(Boolean)).size
  const lines = [`📞 ${word} โทรไป ${list.length} สาย · ${people} คน`, kinds.map(([l, n]) => `${l} ${n}`).join(' · ')]
  if (team) {
    const by = {}; list.forEach(l => { const k = String(l.createdBy || 'ไม่ระบุ').trim(); by[k] = (by[k] || 0) + 1 })
    lines.push('👥 รายคน', ...Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n], i) => `${i + 1}. ${k} — ${n} สาย`))
  }
  lines.push(note)
  return { n: list.length, text: lines.filter(Boolean).join('\n') }
}

export const OPS_LINKS = {
  arrived: { path: '/dms/stock', label: '🚙 เปิดหน้าสต็อก' },
  plate: { path: '/dms/plates', label: '🟥 เปิดหน้าติดตามทะเบียน' },
  late: { path: '/hr/attendance', label: '🕘 เปิดหน้าลงเวลา' },
  floorplan: { path: '/dms/floorplan', label: '🏦 เปิดหน้า Floor Plan' },
  debt: { path: '/finance/credit', label: '💸 เปิดหน้าควบคุมเครดิต' },
  dup: { path: '/crm/duplicates', label: '👥 เปิดหน้าลูกค้าซ้ำ' },
  refund: { path: '/finance/refund', label: '💵 เปิดหน้าคืนเงิน' },
  walkin: { path: '/crm/walkin', label: '🚶 เปิดหน้า walk-in' },
  insurance: { path: '/insurance/renewal', label: '🛡 เปิดหน้าต่อประกัน' },
  warranty: { path: '/service/warranty-expiry', label: '🛡 เปิดหน้ารับประกันใกล้หมด' },
  reminder: { path: '/service/reminders', label: '🔔 เปิดหน้าเตือนเข้าศูนย์' },
  overdue: { path: '/calendar', label: '🗓️ เปิดปฏิทินงาน' },
  service: { path: '/service/jobs', label: '🔧 เปิดหน้างานซ่อม' },
  unassigned: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  testdrive: { path: '/crm/testdrive', label: '🚗 เปิดหน้าทดลองขับ' },
  bookday: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  withdrawn: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  delivered: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  claim: { path: '/insurance/claims', label: '🛡 เปิดหน้าเคลมประกัน' },
  parts: { path: '/service/parts-inventory', label: '📦 เปิดหน้าคลังอะไหล่' },
  servicerev: { path: '/service/jobs', label: '🔧 เปิดหน้างานซ่อม' },
  yesterday: { path: '/calendar', label: '🗓️ เปิดปฏิทินงาน' },
  referask: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  eventbest: { path: '/marketing/events', label: '🎪 เปิดหน้าออกบูธ/อีเวนต์' },
  campaignbest: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  mycust: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  nophone: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  topscore: { path: '/ai/lead-scoring', label: '🎯 เปิดหน้า Lead Scoring' },
  finbank: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  noshow: { path: '/crm/showroom', label: '🏬 เปิดหน้านัดโชว์รูม' },
  nobookseller: { path: '/crm/sales-income', label: '💰 เปิดหน้ารายได้รายเซลส์' },
  tdnobook: { path: '/crm/testdrive', label: '🚗 เปิดหน้าทดลองขับ' },
  notd: { path: '/crm/testdrive', label: '🚗 เปิดหน้าทดลองขับ' },
  noquote: { path: '/crm/quotation', label: '📄 เปิดหน้าใบเสนอราคา' },
  stale: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  noanswer: { path: '/crm/followup', label: '📞 เปิดหน้านัดติดตาม' },
  leave: { path: '/hr/leave', label: '👥 เปิดหน้าการลา' },
  expense: { path: '/finance/pl', label: '📈 เปิดหน้ากำไร-ขาดทุน' },
  calls: { path: '/crm/my-day', label: '☀️ เปิดหน้างานวันนี้' },
  mktspend: { path: '/marketing/channels', label: '📣 เปิดหน้าช่องทางโซเชียล' },
  csat: { path: '/crm/csat', label: '⭐ เปิดหน้าความพึงพอใจ' },
  profit: { path: '/finance/pl', label: '📈 เปิดหน้ากำไร-ขาดทุน' },
  incoming: { path: '/dms/orders', label: '📦 เปิดหน้าสั่งรถ' },
  lowstock: { path: '/dms/stock', label: '🚙 เปิดหน้าสต็อก' },
  hotbyseller: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  pdi: { path: '/dms/pdi', label: '🔧 เปิดหน้า PDI' },
  tradein: { path: '/dms/tradein', label: '🔄 เปิดหน้ารถเทิร์น' },
  closerate: { path: '/analytics/sales-metrics', label: '📊 เปิดหน้าตัวชี้วัดการขาย' },
  bookmodel: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  showroom: { path: '/crm/showroom', label: '🏬 เปิดหน้านัดโชว์รูม' },
  line: { path: '/crm/my-day', label: '💬 ตอบในหน้างานวันนี้' },
  complaint: { path: '/crm/complaints', label: '⚠️ เปิดหน้าเรื่องร้องเรียน' },
  newcust: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  anniv: { path: '/crm/birthdays', label: '🎉 ส่งคำอวยพร' },
  delivery: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  lost: { path: '/crm/lostdeals', label: '📉 เปิดหน้าดีลที่หลุด' },
  income: { path: '/crm/my-day', label: '💰 กรอกในหน้างานวันนี้' },
}

export function opsFollowUps(spec) {
  const all = { calls: 'วันนี้ควรโทรหาใคร', mktspend: 'ลีดจากบูธเดือนนี้กี่คน', dup: 'ลูกค้าคนไหนยังไม่ได้ใส่เบอร์', debt: 'ใบแจ้งหนี้ที่ยังไม่ได้เก็บเงิน', refund: 'มีใครถอนจองบ้าง', floorplan: 'รถค้างสต็อกนานมีคันไหน', late: 'ใครลาวันนี้', arrived: 'รถรุ่นไหนเหลือน้อย', plate: 'ลูกค้าที่ส่งมอบเดือนนี้', csat: 'เรื่องร้องเรียนค้างอยู่ไหม', expense: 'กำไรเดือนนี้เท่าไหร่', profit: 'ค่าใช้จ่ายเดือนนี้เท่าไหร่', leave: 'วันนี้มีอะไรบ้าง', incoming: 'รถรุ่นไหนเหลือน้อย', lowstock: 'รถที่กำลังจะมาถึงมีกี่คัน', noanswer: 'ลูกค้า hot ที่ยังไม่มีนัด', hotbyseller: 'ลูกค้า hot มีใครบ้าง', pdi: 'นัดส่งมอบสัปดาห์นี้มีใครบ้าง', stale: 'ลูกค้าคนไหนยังไม่ได้ทดลองขับ', tradein: 'ใครรอไฟแนนซ์', closerate: 'ลูกค้าใหม่เดือนนี้กี่คน', noquote: 'ใบเสนอราคาค้างอยู่กี่ใบ', bookmodel: 'รถรุ่นไหนขายดีสุดเดือนนี้', notd: 'ลูกค้าที่ทดลองขับแล้วยังไม่จอง', claim: 'งานซ่อมค้างอยู่กี่งาน', parts: 'รถรออะไหล่มีคันไหน', servicerev: 'พรุ่งนี้มีรถเข้าศูนย์กี่คัน', yesterday: 'วันนี้มีอะไรบ้าง', referask: 'ใครครบรอบซื้อรถเดือนนี้', eventbest: 'ลีดจากบูธเดือนนี้กี่คน', campaignbest: 'โปรเดือนนี้มีอะไรบ้าง', delivered: 'ใครครบรอบซื้อรถเดือนนี้', mycust: 'ลูกค้า hot มีใครบ้าง', nophone: 'ลูกค้าที่ยังไม่มีผู้ดูแล', topscore: 'วันนี้ควรโทรหาใคร', withdrawn: 'ยอดเดือนนี้เป็นไง', finbank: 'ใครรอไฟแนนซ์', noshow: 'ลูกค้าที่ทดลองขับแล้วยังไม่จอง', nobookseller: 'ทีมวันนี้เป็นไง', bookday: 'ยอดเดือนนี้เป็นไง', tdnobook: 'ลูกค้า hot มีใครบ้าง', testdrive: 'นัดทดลองขับพรุ่งนี้มีใครบ้าง', showroom: 'พรุ่งนี้มีใครนัดเข้าโชว์รูม', line: 'วันนี้มีอะไรบ้าง', complaint: 'มีลูกค้าทัก LINE รอตอบไหม', newcust: 'ลูกค้าใหม่สัปดาห์นี้กี่คน', anniv: 'ใครครบรอบซื้อรถเดือนนี้', delivery: 'นัดส่งมอบสัปดาห์นี้มีใครบ้าง', lost: 'ลูกค้า hot มีใครบ้าง', income: 'ค่าคอมเดือนนี้เท่าไหร่', service: 'พรุ่งนี้มีรถเข้าศูนย์กี่คัน', reminder: 'รถเข้าศูนย์วันนี้กี่คัน', insurance: 'รับประกันรถคันไหนใกล้หมด', walkin: 'walk in สัปดาห์นี้กี่คน', warranty: 'ประกันภัยใครใกล้หมด', overdue: 'วันนี้มีอะไรบ้าง', unassigned: 'ลูกค้าใหม่เดือนนี้กี่คน' }
  const out = [all[spec.kind]]
  if (spec.kind === 'testdrive' && spec.day === 'tomorrow') out[0] = 'พรุ่งนี้มีใครนัดเข้าโชว์รูม'
  if (spec.kind === 'delivery' && spec.day === 'week') out[0] = 'มีนัดส่งมอบพรุ่งนี้ไหม'
  if (spec.kind === 'service' && spec.day === 'tomorrow') out[0] = 'เรื่องร้องเรียนค้างอยู่ไหม'
  if (spec.kind === 'showroom' && spec.day === 'tomorrow') out[0] = 'นัดทดลองขับพรุ่งนี้มีใครบ้าง'
  out.push(spec.kind === 'newcust' ? 'ยอดเดือนนี้เป็นไง' : 'วันนี้ควรโทรหาใคร')
  return [...new Set(out)]
}
