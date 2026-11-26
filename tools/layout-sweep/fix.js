const d = n => new Date(Date.UTC(2026, 10, 26 + n)).toISOString().slice(0, 10)
const models = ['DEEPAL S07', 'DEEPAL L07', 'AION V', 'JAECOO 6', 'DEEPAL S05']
const sales = ['สมชาย ใจดีมากมาย', 'วิภา', 'อนันต์', 'กมล']
const st = ['รอส่งมอบ', 'ได้รถแล้วรอสั่งแต่ง', 'ผ่านไฟแนนซ์รอเบิก', 'ซื้อสดรอเบิกรถ', 'รอรถ', 'ยอดจองคงค้าง', 'รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง', 'ผ่านไฟแนนซ์รอจอง', 'ส่งมอบแล้ว', 'ถอนจอง', 'ตัดตัวเลขรอส่งมอบ']
const bookings = Array.from({ length: 60 }, (_, k) => ({ id: 'b' + k, bookingNo: 'BK-' + (1000 + k), status: st[k % st.length], bookingDate: d(-k * 3), cutDate: st[k % st.length].includes('ส่งมอบแล้ว') || st[k % st.length].startsWith('ตัด') ? d(-k) : '', deliveryDate: k % 3 ? d(k % 9 - 2) : '', brand: models[k % 5].split(' ')[0], model: models[k % 5].split(' ')[1], salesName: sales[k % 4], custName: 'คุณลูกค้าทดสอบชื่อยาวมาก นามสกุลยาวมาก ' + k, phone: '08100000' + String(k).padStart(2, '0'), price: 999000 + k * 10000, financeCo: k % 2 ? 'ธนาคารทดสอบ' : 'ซื้อสด', companyId: 'c1' }))
const customers = Array.from({ length: 40 }, (_, k) => ({ id: 'cu' + k, firstName: 'ลูกค้าทดสอบ' + k, lastName: 'นามสกุลยาวยาว', phone: '08200000' + String(k).padStart(2, '0'), stage: ['lead', 'pp', 'booking', 'delivered'][k % 4], assignedTo: sales[k % 4], interestedModel: models[k % 5], temperature: ['hot', 'warm', 'cold'][k % 3], createdAt: d(-k) + 'T03:00:00Z', companyId: 'c1', source: 'Facebook' }))
const vehicles = Array.from({ length: 20 }, (_, k) => ({ id: 'v' + k, brand: models[k % 5].split(' ')[0], model: models[k % 5].split(' ')[1], color: ['ขาว', 'ดำ', 'เทา'][k % 3], status: ['available', 'transit', 'reserved', 'sold'][k % 4], vin: 'VIN' + k, arrivedAt: d(-k * 4), companyId: 'c1', price: 1100000 }))
globalThis.__FIX = {
  users: [{ id: 'u1', uid: 'u1', email: 'owner@example.com', name: 'เจ้าของ ทดสอบ', displayName: 'เจ้าของ ทดสอบ', role: 'owner', programOwner: true, active: true }],
  bookings, customers, vehicles,
  followups: customers.slice(0, 10).map((c, k) => ({ id: 'f' + k, customerId: c.id, customerName: c.firstName, salesperson: c.assignedTo, dueDate: d(k - 5), status: 'pending', note: 'โทรติดตาม' })),
  test_drives: customers.slice(0, 6).map((c, k) => ({ id: 't' + k, customerName: c.firstName, model: c.interestedModel, date: d(k - 2), time: '10:00', status: 'scheduled', staff: c.assignedTo })),
  job_cards: Array.from({ length: 8 }, (_, k) => ({ id: 'j' + k, jobNo: 'JC-' + k, status: ['received', 'in_progress', 'done', 'delivered'][k % 4], plate: 'กข ' + k, custName: 'ลูกค้า ' + k, createdAt: d(-k) })),
}
