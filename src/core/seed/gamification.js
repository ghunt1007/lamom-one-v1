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


  // Gamification challenges (หน้า /gamification/challenges) — ภารกิจท้าทายทีม
  const now = new Date()
}
