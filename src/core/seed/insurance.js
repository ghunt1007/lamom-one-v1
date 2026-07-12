// Demo seed data — insurance module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  
  const now = new Date()

  const addDaysISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // Policy renewals (หน้า /insurance/policy) — แยกจาก insurance_policies (โครงสร้างข้อมูลคนละแบบ ใช้โดยหน้า /insurance)
  const policyRenewals = [
    { id:'POL001', plate:'กก 1234 กทม', customer:'คุณวรพจน์ สุขใจ', model:'BYD Atto 3', insurer:'วิริยะประกัน', type:'ชั้น 1', premium:28000, startDate:'2025-06-15', endDate:'2026-06-15', status:'expiring', sum:1549000 },
    { id:'POL002', plate:'บบ 5678 ชลบุรี', customer:'บริษัท ทรัพย์สิน จก.', model:'MG ZS EV', insurer:'เมืองไทยประกัน', type:'ชั้น 1', premium:32000, startDate:'2025-08-01', endDate:'2026-08-01', status:'active', sum:1099000 },
    { id:'POL003', plate:'คค 9012 นนทบุรี', customer:'คุณนภา ชื่นดี', model:'BYD Seal AWD', insurer:'AXA', type:'ชั้น 1', premium:35000, startDate:'2025-09-20', endDate:'2026-09-20', status:'active', sum:1399000 },
    { id:'POL004', plate:'งง 3456 ปทุม', customer:'คุณสมชาย ดีใจ', model:'BYD Dolphin', insurer:'ทิพยประกัน', type:'ชั้น 2+', premium:15000, startDate:'2025-06-01', endDate:'2026-06-01', status:'expired', sum:899000 },
    { id:'POL005', plate:'จจ 7890 สมุทรปราการ', customer:'คุณพรทิพย์ มั่นคง', model:'MG4 EV', insurer:'กรุงเทพประกัน', type:'ชั้น 1', premium:29000, startDate:'2026-01-15', endDate:'2027-01-15', status:'active', sum:1099000 },
    { id:'POL006', plate:'ฉฉ 2345 ระยอง', customer:'คุณวิชัย สุดยอด', model:'BYD Atto 3', insurer:'ไทยวิวัฒน์', type:'ชั้น 3+', premium:8000, startDate:'2025-12-01', endDate:'2026-12-01', status:'active', sum:1549000 },
  ]
  policyRenewals.forEach(p => { if (!demoCol('policy_renewals')[p.id]) demoCol('policy_renewals')[p.id] = p })


  // Insurance claims (หน้า /insurance/claims)
  const insuranceClaims = [
    { id:'CLM001', customer:'สมชาย ใจดี', plate:'1กข-1234', model:'BYD Seal', type:'collision', insurer:'วิริยะประกันภัย', status:'repairing', estimate:45000, approved:42000, reported:addDaysISO(-10), note:'ชนท้ายที่แยกอโศก คู่กรณีรับผิด' },
    { id:'CLM002', customer:'มาลี สุขใจ', plate:'2ขค-5678', model:'BYD Dolphin', type:'glass', insurer:'กรุงเทพประกันภัย', status:'completed', estimate:12000, approved:12000, reported:addDaysISO(-25), note:'กระจกหน้าร้าวจากหินกระเด็น' },
    { id:'CLM003', customer:'ธนพล เที่ยงตรง', plate:'3คง-9012', model:'MG ZS EV', type:'object', insurer:'ทิพยประกันภัย', status:'surveying', estimate:28000, approved:0, reported:addDaysISO(-3), note:'เฉี่ยวเสาในลานจอด' },
    { id:'CLM004', customer:'อรทัย ตั้งใจ', plate:'4งจ-3456', model:'BYD Atto 3', type:'flood', insurer:'วิริยะประกันภัย', status:'reported', estimate:0, approved:0, reported:addDaysISO(-1), note:'น้ำท่วมถึงพื้นรถ รอสำรวจ' },
    { id:'CLM005', customer:'วิรัช เก่งมาก', plate:'5จฉ-7890', model:'BYD Han', type:'collision', insurer:'เมืองไทยประกันภัย', status:'rejected', estimate:95000, approved:0, reported:addDaysISO(-30), note:'เมาแล้วขับ — ประกันไม่คุ้มครอง' },
  ]
  insuranceClaims.forEach(c => { if (!demoCol('insurance_claims')[c.id]) demoCol('insurance_claims')[c.id] = c })


  // Insurance renewals (หน้า /insurance/renewal) — แยกจาก insurance_policies/policy_renewals (โครงสร้างข้อมูลคนละแบบ)
  const insuranceRenewals = [
    { id:'INS001', customerId:'C001', customerName:'วิชาญ มีโชค', phone:'081-234-5678',
      vehiclePlate:'กก 1234', vehicleModel:'BYD Seal AWD', vehicleYear:2024,
      insurer:'เมืองไทยประกันภัย', policyNo:'MTI-2024-123456', type:'class1',
      premium:28500, coverAmount:1449000, expiryDate:addDaysISO(30),
      startDate:addDaysISO(-335), status:'upcoming', lastRenewedDate:addDaysISO(-335), salesperson:'อรนุช สายใจ',
      notes:'ลูกค้าสนใจต่อกับ insurer เดิม' },
    { id:'INS002', customerId:'C002', customerName:'อรนุช สาวสวย', phone:'082-345-6789',
      vehiclePlate:'ขข 5678', vehicleModel:'MG ZS EV', vehicleYear:2024,
      insurer:'กรุงเทพประกันภัย', policyNo:'BKK-2024-789012', type:'class1',
      premium:22000, coverAmount:1059000, expiryDate:addDaysISO(-5),
      startDate:addDaysISO(-370), status:'expired', lastRenewedDate:addDaysISO(-370), salesperson:'วิชาญ มีโชค',
      notes:'ต้องรีบต่อด่วน' },
    { id:'INS003', customerId:'C003', customerName:'ธีรยุทธ เก่งกาจ', phone:'083-456-7890',
      vehiclePlate:'คค 9012', vehicleModel:'BYD Atto 3', vehicleYear:2024,
      insurer:'วิริยะประกันภัย', policyNo:'VIR-2024-345678', type:'class2plus',
      premium:15800, coverAmount:1099000, expiryDate:addDaysISO(65),
      startDate:addDaysISO(-300), status:'upcoming', lastRenewedDate:addDaysISO(-300), salesperson:'อรนุช สายใจ',
      notes:'' },
    { id:'INS004', customerId:'C004', customerName:'สมใจ รักรถ', phone:'084-567-8901',
      vehiclePlate:'งง 3456', vehicleModel:'BYD Seal SR', vehicleYear:2024,
      insurer:'ทิพยประกันภัย', policyNo:'TIP-2024-567890', type:'class1',
      premium:26000, coverAmount:1199000, expiryDate:addDaysISO(180),
      startDate:addDaysISO(-185), status:'renewed', lastRenewedDate:addDaysISO(-185), salesperson:'อรนุช สายใจ',
      notes:'' },
  ]
  insuranceRenewals.forEach(p => { if (!demoCol('insurance_renewals')[p.id]) demoCol('insurance_renewals')[p.id] = p })


  // NCB policies (หน้า /insurance/ncb)
  const ncbPolicies = [
    { id:'POL-001', customer:'คุณอนันต์ รักดี', plate:'กข-1234', model:'BYD Atto 3', insurer:'กรุงเทพประกันภัย', renewDate:'2026-08-01', ncbYears:3, basePremium:18500, claimed:false },
    { id:'POL-002', customer:'คุณมาลี วงศ์ดี', plate:'1กก-5678', model:'MG ZS EV', insurer:'เมืองไทยประกันภัย', renewDate:'2026-07-15', ncbYears:0, basePremium:14200, claimed:true },
    { id:'POL-003', customer:'คุณวีระ สมบัติ', plate:'2ขข-9999', model:'BYD Seal AWD', insurer:'วิริยะประกันภัย', renewDate:'2026-09-30', ncbYears:5, basePremium:22000, claimed:false },
    { id:'POL-004', customer:'คุณสุดา ใจดี', plate:'3กค-1111', model:'BYD Dolphin', insurer:'อาคเนย์ประกันภัย', renewDate:'2026-06-25', ncbYears:2, basePremium:12800, claimed:false },
  ]
  ncbPolicies.forEach(p => { if (!demoCol('ncb_policies')[p.id]) demoCol('ncb_policies')[p.id] = p })

}
