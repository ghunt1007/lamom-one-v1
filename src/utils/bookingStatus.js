// (2026-11-02) สถานะใบจอง — รายการเดียวของทั้งแอป (ตรงกับคอลัมน์ "สถานะ" ใน Google Sheet)
// ทุกที่ที่ต้องรู้ว่าใบจองยกเลิก/ส่งมอบ/ยังเปิดอยู่ ให้ใช้ค่าจากไฟล์นี้ ไม่พิมพ์ชื่อสถานะเอง
// มีเทส (bookingStatus.test.js) ตรวจทั้งโปรเจกต์ว่าไม่มีชื่อสถานะใบจองที่สะกดต่างจากรายการนี้
export const BOOKING_STATUSES = [
  'จัดไฟแนนซ์ก่อนจอง', 'ผ่านไฟแนนซ์รอจอง', 'ยอดจองคงค้าง', 'รอผลไฟแนนซ์', 'ผ่านไฟแนนซ์รอเบิก',
  'ซื้อสดรอเบิกรถ', 'รอรถ', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ', 'ส่งมอบแล้ว', 'ถอนจอง',
]
// 'ยกเลิก' ไม่ได้อยู่ใน Sheet แต่เก็บไว้เผื่อข้อมูลเก่า
export const CANCELLED_STATUSES = ['ถอนจอง', 'ยกเลิก']
// นับเป็นยอดส่งมอบ (ตัดตัวเลขแล้ว = ขายแล้วตามรายงาน)
export const DELIVERED_STATUSES = ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ']

export const isCancelled = b => CANCELLED_STATUSES.includes(b?.status)
export const isDelivered = b => DELIVERED_STATUSES.includes(b?.status)
// ยังต้องตามงาน = ไม่ถอน ไม่ส่งมอบ
export const isOpenBooking = b => !isCancelled(b) && !isDelivered(b)
