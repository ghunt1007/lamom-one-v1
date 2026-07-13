// Demo seed data — productivity module: Calendar events + Notes (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  const pdAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const pdHoursAgo = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const OWNER_NAME = 'ทวีศักดิ์ สุขสมบัติเสถียร'

  const calendarEvents = [
    { id: 'CE001', title: 'ประชุมทีมขายประจำสัปดาห์', description: 'ทบทวนยอดขายสัปดาห์นี้ + วางแผนสัปดาห์หน้า', date: pdAddDays(0), time: '09:00', type: 'meeting', assignee: OWNER_NAME, createdBy: OWNER_NAME },
    { id: 'CE002', title: 'นัดลูกค้า VIP ดูรถ BYD Han EV', description: 'คุณพรทิพย์ วงษ์ทอง — นัดดูรถที่โชว์รูมใหญ่', date: pdAddDays(1), time: '14:00', type: 'meeting', assignee: 'ปิยะ เซลส์', createdBy: OWNER_NAME },
    { id: 'CE003', title: 'เดดไลน์ส่งรายงานยอดขายเดือนนี้', description: 'ส่งให้ผู้บริหารก่อนสิ้นเดือน', date: pdAddDays(3), time: '17:00', type: 'deadline', assignee: 'สมศรี การเงิน', createdBy: OWNER_NAME },
    { id: 'CE004', title: 'อบรม Product Knowledge รุ่นใหม่ MG4', description: 'อบรมทีมขายทั้งหมดเรื่องสเปครถรุ่นใหม่', date: pdAddDays(4), time: '10:00', type: 'training', assignee: 'ทีมขายทั้งหมด', createdBy: OWNER_NAME },
    { id: 'CE005', title: 'แจ้งเตือนต่อประกันรถลูกค้า', description: 'ลูกค้าคุณวิชัย สุขใจ กรมธรรม์ใกล้หมดอายุ', date: pdAddDays(2), time: '', type: 'reminder', assignee: 'วิชัย ยอดขาย', createdBy: OWNER_NAME },
    { id: 'CE006', title: 'ประชุมผู้บริหารรายเดือน', description: 'สรุปผลประกอบการ + วางแผนกลยุทธ์ไตรมาสหน้า', date: pdAddDays(6), time: '13:30', type: 'meeting', assignee: OWNER_NAME, createdBy: OWNER_NAME },
    { id: 'CE007', title: 'Motor Show — เตรียมบูธ', description: 'ทีมการตลาดเตรียมของและป้ายโฆษณาก่อนงาน', date: pdAddDays(-2), time: '08:00', type: 'other', assignee: 'ทีมการตลาด', createdBy: OWNER_NAME },
    { id: 'CE008', title: 'เดดไลน์ปิดงบไตรมาส', description: 'ฝ่ายบัญชีต้องปิดงบให้เสร็จก่อนประชุมบอร์ด', date: pdAddDays(5), time: '16:00', type: 'deadline', assignee: 'สมศรี การเงิน', createdBy: OWNER_NAME },
  ]
  calendarEvents.forEach(e => { if (!demoCol('calendar_events')[e.id]) demoCol('calendar_events')[e.id] = e })


  const notes = [
    { id: 'NT001', title: 'ไอเดียโปรโมชั่นเดือนหน้า', body: 'ลองทำแคมเปญ "ซื้อรถ EV แถมค่าไฟฟรี 6 เดือน" ร่วมกับพาร์ทเนอร์สถานีชาร์จ — เช็คงบกับฝ่ายการตลาดก่อน', tags: ['การตลาด', 'ไอเดีย'], pinned: true, createdBy: OWNER_NAME, linkedType: null, linkedId: null, createdAt: pdHoursAgo(3), updatedAt: pdHoursAgo(3) },
    { id: 'NT002', title: 'สิ่งที่ต้องคุยกับซัพพลายเออร์อะไหล่', body: 'ต่อรองราคาแบตเตอรี่ล็อตใหม่ + ถามเรื่อง lead time ที่นานขึ้นช่วงนี้', tags: ['จัดซื้อ'], pinned: false, createdBy: 'สมศรี การเงิน', linkedType: null, linkedId: null, createdAt: pdHoursAgo(20), updatedAt: pdHoursAgo(20) },
    { id: 'NT003', title: 'ข้อสังเกตจากลูกค้า — เสียงบ่นเรื่องคิวช่าง', body: 'ลูกค้าหลายรายบ่นว่าคิวรอซ่อมนานช่วงเสาร์-อาทิตย์ ควรพิจารณาเพิ่มช่างกะสุดสัปดาห์', tags: ['บริการ', 'ด่วน'], pinned: true, createdBy: OWNER_NAME, linkedType: null, linkedId: null, createdAt: pdHoursAgo(30), updatedAt: pdHoursAgo(5) },
    { id: 'NT004', title: 'สรุปประชุมทีมขายสัปดาห์ที่แล้ว', body: 'เป้าเดือนนี้ 45 คัน ปัจจุบันทำได้ 28 คัน ต้องเร่งปิดดีลที่ค้างอยู่ในไปป์ไลน์อีก 12 ดีล', tags: ['ขาย', 'ประชุม'], pinned: false, createdBy: OWNER_NAME, linkedType: null, linkedId: null, createdAt: pdHoursAgo(48), updatedAt: pdHoursAgo(48) },
    { id: 'NT005', title: 'รายชื่อผู้เข้าอบรม Product Knowledge', body: 'เซลส์ใหม่ 3 คนยังไม่ผ่านการอบรมรุ่น BYD Seal — ต้องจัดอบรมเพิ่มก่อนสิ้นเดือน', tags: ['HR', 'อบรม'], pinned: false, createdBy: 'HR', linkedType: null, linkedId: null, createdAt: pdHoursAgo(60), updatedAt: pdHoursAgo(60) },
    { id: 'NT006', title: 'ไอเดีย: จัดกิจกรรมลูกค้าเก่าแนะนำเพื่อน', body: 'ให้ส่วนลด 5,000 บาท ทั้งผู้แนะนำและผู้ถูกแนะนำ เมื่อปิดการขายสำเร็จ', tags: ['การตลาด', 'ไอเดีย'], pinned: false, createdBy: OWNER_NAME, linkedType: null, linkedId: null, createdAt: pdHoursAgo(75), updatedAt: pdHoursAgo(75) },
    { id: 'NT007', title: 'เช็คลิสต์ก่อนงาน Motor Show', body: 'โบรชัวร์ 500 ชุด, ป้ายไวนิล 4 จุด, ทีมสาธิตขับ 2 คัน, ของแถมเล็กๆ สำหรับผู้เข้าชม', tags: ['การตลาด', 'อีเวนต์'], pinned: false, createdBy: 'ทีมการตลาด', linkedType: null, linkedId: null, createdAt: pdHoursAgo(90), updatedAt: pdHoursAgo(90) },
  ]
  notes.forEach(n => { if (!demoCol('notes')[n.id]) demoCol('notes')[n.id] = n })

}
