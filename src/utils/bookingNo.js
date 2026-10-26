// เลขใบจองที่ระบบออกให้เอง (ตอนยังไม่มีเลขจากไฟล์ DATA Booking): SK + ปีเดือนวัน (yyMMdd ตามเวลาไทย) + เลขสุ่ม 3 หลัก
// เดิมเขียนซ้ำ 3 ที่ และใช้วันที่ UTC — สร้างก่อน 07:00 น. ได้วันที่ของเมื่อวาน
import { todayBangkok } from './format.js'

export function newBookingNo(today = todayBangkok(), rand = Math.random) {
  return 'SK' + today.slice(2).replace(/-/g, '') + String(Math.floor(rand() * 900) + 100)
}
