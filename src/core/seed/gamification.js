// Demo seed data — gamification module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  // Daily Missions (หน้า /gamification/missions)
  const dailyMissionsDemo = [
    { id:'D1', period:'daily', title:'บันทึก Follow-up 3 ราย', xp:50, icon:'📞', done:true, progress:3, target:3 },
    { id:'D2', period:'daily', title:'ส่งใบเสนอราคา 1 ใบ', xp:80, icon:'📄', done:true, progress:1, target:1 },
    { id:'D3', period:'daily', title:'อัปเดต Pipeline 5 ดีล', xp:60, icon:'📋', done:false, progress:3, target:5 },
    { id:'D4', period:'daily', title:'ตอบแชทลูกค้าภายใน 30 นาที', xp:40, icon:'💬', done:false, progress:2, target:3 },
    { id:'D5', period:'daily', title:'บันทึก Voice Note 1 ครั้ง', xp:30, icon:'🎙', done:false, progress:0, target:1 },
    { id:'W1', period:'weekly', title:'ปิดดีล 2 คันขึ้นไป', xp:500, icon:'🏆', done:false, progress:1, target:2 },
    { id:'W2', period:'weekly', title:'รับ NPS ≥ 4.5 จาก 3 ลูกค้า', xp:300, icon:'⭐', done:false, progress:2, target:3 },
    { id:'W3', period:'weekly', title:'เรียน Training ครบ 1 หลักสูตร', xp:200, icon:'📚', done:true, progress:1, target:1 },
    { id:'W4', period:'weekly', title:'ไม่มี Lead หลุด 7 วัน', xp:400, icon:'🎯', done:false, progress:5, target:7 },
  ]
  dailyMissionsDemo.forEach(m => { if (!demoCol('daily_missions')[m.id]) demoCol('daily_missions')[m.id] = m })


  // Reward store (หน้า /gamification/rewards) — ร้านแลกของรางวัลด้วยแต้มพนักงาน
  const gamificationRewards = [
    { id:'RW001', name:'บัตรกำนัล Central 1,000 บาท', cat:'cash', points:1000, stock:10, redeemed30:6, popular:true },
    { id:'RW002', name:'ลาพิเศษ 1 วัน (ไม่หักโควต้า)', cat:'time', points:2000, stock:99, redeemed30:4, popular:true },
    { id:'RW003', name:'หูฟัง Bluetooth', cat:'item', points:1500, stock:5, redeemed30:2, popular:false },
    { id:'RW004', name:'เลือกที่จอดรถ VIP 1 เดือน', cat:'perk', points:800, stock:2, redeemed30:2, popular:true },
    { id:'RW005', name:'บัตรน้ำมัน 500 บาท', cat:'cash', points:500, stock:20, redeemed30:8, popular:true },
    { id:'RW006', name:'Voucher ร้านอาหาร 2 ที่นั่ง', cat:'item', points:1200, stock:6, redeemed30:3, popular:false },
    { id:'RW007', name:'ออกก่อนเวลา 2 ชม. (ศุกร์)', cat:'time', points:600, stock:99, redeemed30:9, popular:true },
    { id:'RW008', name:'มื้อกลางวันกับ MD', cat:'perk', points:3000, stock:1, redeemed30:0, popular:false },
  ]
  gamificationRewards.forEach(r => { if (!demoCol('gamification_rewards')[r.id]) demoCol('gamification_rewards')[r.id] = r })


  // หมายเหตุ: gamification_challenges (CH001-CH004) ถูก seed ไว้แล้วใน seed/core.js — ไม่ seed ซ้ำที่นี่

  // Gamification events (ledger จริง) — ตัวอย่างประวัติแต้มที่เกิดจาก business event ย้อนหลัง
  // ให้หน้า Dashboard/Leaderboard มีข้อมูลตัวอย่างตั้งแต่เปิดใช้งานครั้งแรก (ไม่ต้องรอ action จริงก่อน)
  const now = new Date()
  const geAddDays = (n, h) => { const d = new Date(now); d.setDate(d.getDate() + n); if (h != null) d.setHours(h); return d.toISOString() }
  const gamificationEventsSeed = [
    { id:'ge1', userName:'วิชัย ยอดขาย', userId:'วิชัย ยอดขาย', points:100, reason:'🚗 ส่งมอบรถสำเร็จ', sourceCollection:'bookings', sourceId:'seed', createdAt: geAddDays(-1, 10) },
    { id:'ge2', userName:'วิชัย ยอดขาย', userId:'วิชัย ยอดขาย', points:20, reason:'📝 สร้างใบจองใหม่', sourceCollection:'bookings', sourceId:'seed', createdAt: geAddDays(-3, 14) },
    { id:'ge3', userName:'สุดา มาดี', userId:'สุดา มาดี', points:100, reason:'🚗 ส่งมอบรถสำเร็จ', sourceCollection:'bookings', sourceId:'seed', createdAt: geAddDays(-2, 11) },
    { id:'ge4', userName:'สุดา มาดี', userId:'สุดา มาดี', points:10, reason:'📇 อัปเกรดลูกค้าเป็น Prospect', sourceCollection:'customers', sourceId:'seed', createdAt: geAddDays(-5, 9) },
    { id:'ge5', userName:'ธนา เก่ง', userId:'ธนา เก่ง', points:20, reason:'📝 สร้างใบจองใหม่', sourceCollection:'bookings', sourceId:'seed', createdAt: geAddDays(-6, 15) },
    { id:'ge6', userName:'มานะ ขยัน', userId:'มานะ ขยัน', points:5, reason:'✅ ทำงานเสร็จสิ้น', sourceCollection:'tasks', sourceId:'seed', createdAt: geAddDays(-1, 16) },
    { id:'ge7', userName:'วิทยา ช่างใหญ่', userId:'วิทยา ช่างใหญ่', points:2, reason:'💬 บันทึกการติดต่อลูกค้า', sourceCollection:'comm_logs', sourceId:'seed', createdAt: geAddDays(-2, 13) },
    { id:'ge8', userName:'ทวีศักดิ์ สุขสมบัติเสถียร', userId:'demo-user', points:5, reason:'✅ ทำงานเสร็จสิ้น', sourceCollection:'tasks', sourceId:'seed', createdAt: geAddDays(-4, 9) },
    { id:'ge9', userName:'ทวีศักดิ์ สุขสมบัติเสถียร', userId:'demo-user', points:2, reason:'💬 บันทึกการติดต่อลูกค้า', sourceCollection:'comm_logs', sourceId:'seed', createdAt: geAddDays(-7, 10) },
    { id:'ge10', userName:'วิชัย ยอดขาย', userId:'วิชัย ยอดขาย', points:100, reason:'🚗 ส่งมอบรถสำเร็จ', sourceCollection:'bookings', sourceId:'seed', createdAt: geAddDays(-9, 18) },
  ]
  gamificationEventsSeed.forEach(e => { if (!demoCol('gamification_events')[e.id]) demoCol('gamification_events')[e.id] = e })
}
