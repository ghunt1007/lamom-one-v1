// Demo seed data — service module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  const now = new Date()

  // Job Cards
  const jobs = [
    { id:'j1', jobNo:'JOB-2025-001', custName:'วิชัย สุขใจ', phone:'0812345678', brand:'BYD', model:'Seal', plate:'กข-1234 กรุงเทพ', vin:'LGXCE4C10PA000001', mileage:15200, type:'service', status:'inprogress', bay:'เบย์ 1', techName:'สมชาย ช่างดี', desc:'เปลี่ยนน้ำมันเบรก ตรวจสภาพรถ 10,000 km', parts:[], labor:800, createdAt: new Date(Date.now()-7200000).toISOString() },
    { id:'j2', jobNo:'JOB-2025-002', custName:'อรนุช พรหมมา', phone:'0898765432', brand:'MG', model:'MG4', plate:'คง-5678 เชียงใหม่', vin:'SDUZZZEF5PA000003', mileage:3400, type:'warranty', status:'diagnosing', bay:'เบย์ 2', techName:'วิชัย ช่างเก่ง', desc:'ระบบ AC ไม่เย็น', parts:[], labor:0, createdAt: new Date(Date.now()-3600000).toISOString() },
    { id:'j3', jobNo:'JOB-2025-003', custName:'กิตติพงษ์ วรรณศิลป์', phone:'0876543210', brand:'NETA', model:'V II', plate:'งจ-9012 ขอนแก่น', vin:'LNBSCCAD0PA000005', mileage:8900, type:'repair', status:'waiting_parts', bay:'เบย์ 3', techName:'สมชาย ช่างดี', desc:'เปลี่ยนยาง + อัพเดต Firmware', parts:['ยางหน้า x2'], labor:1200, createdAt: new Date(Date.now()-86400000).toISOString() },
  ]
  jobs.forEach(j => { if (!demoCol('job_cards')[j.id]) demoCol('job_cards')[j.id] = j })


  // Parts
  const parts = [
    { id:'p1', sku:'BYD-SEAL-BF001', name:'น้ำมันเบรก DOT4 BYD Original', brand:'BYD', category:'น้ำมันและของเหลว', unit:'ขวด', qty:24, minQty:5, unitCost:280, unitPrice:450, location:'ชั้น A1', createdAt:'2025-01-10' },
    { id:'p2', sku:'BYD-SEAL-BP002', name:'ผ้าเบรกหน้า BYD Seal', brand:'BYD', category:'ระบบเบรก', unit:'ชุด', qty:8, minQty:2, unitCost:1800, unitPrice:3200, location:'ชั้น B2', createdAt:'2025-01-15' },
    { id:'p3', sku:'MG-MG4-TY001', name:'ยางหน้า Michelin 235/45R18', brand:'Michelin', category:'ยางและล้อ', unit:'เส้น', qty:12, minQty:4, unitCost:3200, unitPrice:4800, location:'โกดัง', createdAt:'2025-02-01' },
    { id:'p4', sku:'NETA-V-AC001', name:'คอมเพรสเซอร์แอร์ NETA V II', brand:'NETA', category:'ระบบไฟฟ้า', unit:'ชิ้น', qty:2, minQty:1, unitCost:12000, unitPrice:18500, location:'ชั้น C1', createdAt:'2025-02-10' },
    { id:'p5', sku:'UNI-FL001', name:'น้ำหล่อเย็น EV Coolant', brand:'Universal', category:'น้ำมันและของเหลว', unit:'ลิตร', qty:3, minQty:10, unitCost:450, unitPrice:700, location:'ชั้น A2', createdAt:'2025-01-20' },
  ]
  parts.forEach(p => { if (!demoCol('parts')[p.id]) demoCol('parts')[p.id] = p })


  // Service appointments (หน้า /service/appointment)
  const serviceAppts = [
    { id:'SA001', custName:'สมชาย ใจดี', phone:'0812345678', plate:'กข-1234 กทม.', model:'BYD Seal AWD', type:'เช็กระยะ 10,000 km', date:'2025-06-09', time:'09:00', tech:'วิชัย ช่างดี', status:'confirmed', note:'นำน้ำมันเครื่องสำรองด้วย', km:10200 },
    { id:'SA002', custName:'สมศรี มั่งมี', phone:'0823456789', plate:'คง-5678 กทม.', model:'MG4 X', type:'แก้ไขปัญหา / ซ่อม', date:'2025-06-09', time:'10:30', tech:'ธนา ซ่อมเก่ง', status:'inservice', note:'ระบบ A/C ไม่เย็น', km:25400 },
    { id:'SA003', custName:'วิชัย เดินดี', phone:'0834567890', plate:'งจ-9012 ชบ.', model:'DEEPAL S07', type:'เปลี่ยนถ่ายน้ำมัน', date:'2025-06-10', time:'08:00', tech:'วิชัย ช่างดี', status:'scheduled', note:'', km:15000 },
    { id:'SA004', custName:'ประภา สวยงาม', phone:'0845678901', plate:'ฉก-3456 นบ.', model:'BYD Atto3', type:'ตรวจสภาพรถ', date:'2025-06-10', time:'14:00', tech:'', status:'scheduled', note:'ต้องการใบตรวจสภาพ', km:45000 },
    { id:'SA005', custName:'อนุชา รวยมาก', phone:'0856789012', plate:'ชด-7890 กทม.', model:'MG ZS EV', type:'รับประกัน (Warranty)', date:'2025-06-11', time:'09:00', tech:'ธนา ซ่อมเก่ง', status:'scheduled', note:'เตือน warning ที่ dashboard', km:8900 },
  ]
  serviceAppts.forEach(a => { if (!demoCol('service_appointments')[a.id]) demoCol('service_appointments')[a.id] = a })


  // Service packages (หน้า /service/packages)
  const servicePackages = [
    { id:'PKG001', name:'เปลี่ยนถ่ายน้ำมันเครื่อง', type:'basic', price:1200, duration:60, items:['น้ำมันเครื่อง 4L','ไส้กรองน้ำมัน'], soldCount:142, active:true },
    { id:'PKG002', name:'ตรวจเช็คระยะ 10,000 km', type:'standard', price:3500, duration:120, items:['น้ำมันเครื่อง','ไส้กรองอากาศ','ตรวจสายพาน','ตรวจเบรก'], soldCount:88, active:true },
    { id:'PKG003', name:'Premium Service Package', type:'premium', price:6800, duration:180, items:['Full Service','เปลี่ยนหัวเทียน','ล้างห้องเครื่อง','ตรวจช่วงล่าง','ล้างแอร์'], soldCount:34, active:true },
    { id:'PKG004', name:'EV Battery Health Check', type:'ev', price:1800, duration:90, items:['ตรวจ SOH','ตรวจ BMS','ทดสอบ Cell Balance','Report'], soldCount:56, active:true },
    { id:'PKG005', name:'ล้างรถ + เคลือบแว็กซ์', type:'basic', price:800, duration:90, items:['ล้างรถภายนอก','ดูดฝุ่นภายใน','เคลือบแว็กซ์'], soldCount:211, active:true },
    { id:'PKG006', name:'EV Annual Service', type:'ev', price:4200, duration:150, items:['ตรวจ Full EV System','ตรวจชาร์จเจอร์','ตรวจ Inverter','Software Update'], soldCount:29, active:false },
  ]
  servicePackages.forEach(p => { if (!demoCol('service_packages')[p.id]) demoCol('service_packages')[p.id] = p })


  // Service reminders (หน้า /service/reminders)
  const srAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // Surveyor appointments (หน้า /service/surveyor)
  const surveyorAppointments = [
    { id:'SA-001', claimNo:'CLM-2401', customer:'คุณสมชาย', plate:'กข-1234', model:'BYD Atto 3', insurer:'กรุงเทพประกันภัย', surveyor:'คุณสมศักดิ์', date:'2026-06-16', time:'10:00', status:'confirmed', damage:'กันชนหน้า ฝากระโปรง' },
    { id:'SA-002', claimNo:'CLM-2398', customer:'คุณวันดี', plate:'1กก-5678', model:'MG ZS EV', insurer:'วิริยะประกันภัย', surveyor:'', date:'2026-06-17', time:'13:30', status:'pending', damage:'ประตูซ้ายบุบ กระจกแตก' },
    { id:'SA-003', claimNo:'CLM-2390', customer:'บ.รุ่งเรือง', plate:'2ขข-9999', model:'BYD Seal AWD', insurer:'เมืองไทยประกันภัย', surveyor:'คุณสมหมาย', date:'2026-06-14', time:'09:00', status:'done', damage:'หลังคาบุบ หน้าต่างร้าว', estimateApproved:85000 },
  ]
  surveyorAppointments.forEach(a => { if (!demoCol('surveyor_appointments')[a.id]) demoCol('surveyor_appointments')[a.id] = a })


  // Technician schedule (หน้า /service/technicians)
  const technicianSchedule = [
    { id:'T001', name:'วิทยา ช่างใหญ่', skills:['general','ev'], level:'Senior', efficiency:94, jobsToday:3 },
    { id:'T002', name:'สุรชัย มือดี', skills:['ev','electric'], level:'Specialist', efficiency:88, jobsToday:4 },
    { id:'T003', name:'มานะ ขยัน', skills:['general','body'], level:'Junior', efficiency:76, jobsToday:2 },
    { id:'T004', name:'ชาตรี แข็งแกร่ง', skills:['aircon','general'], level:'Senior', efficiency:91, jobsToday:3 },
    { id:'T005', name:'ประสิทธิ์ ดีเด่น', skills:['general'], level:'Technician', efficiency:82, jobsToday:5 },
  ]
  technicianSchedule.forEach(t => { if (!demoCol('technician_schedule')[t.id]) demoCol('technician_schedule')[t.id] = t })


  // Vehicle inspections (หน้า /service/inspection)
  const vehicleInspections = [
    { id:'INS001', type:'pdi', vehiclePlate:'กก 1234 BKK', brand:'BYD', model:'Seal AWD', vin:'LBWAB2EB7PD001001', customerId:'C001', customerName:'วิชาญ มีโชค', techId:'T001', techName:'ธีรยุทธ เก่งกาจ', date:'2025-06-05', status:'done', mileage:12, overallResult:'pass', notes:'รถสภาพดีพร้อมส่งมอบ', items:null },
    { id:'INS002', type:'periodic', vehiclePlate:'ขข 5678 BKK', brand:'MG', model:'ZS EV', vin:'LSJWSRAR7NE001007', customerId:'C003', customerName:'ธีรยุทธ เก่งกาจ', techId:'T002', techName:'สมชาย ช่างดี', date:'2025-06-08', status:'inprog', mileage:25000, overallResult:null, notes:'', items:null },
    { id:'INS003', type:'pdi', vehiclePlate:'คค 9012 BKK', brand:'BYD', model:'Atto 3', vin:'LBWAB2EB7PD001003', customerId:'C004', customerName:'สมหญิง รักรถ', techId:'T001', techName:'ธีรยุทธ เก่งกาจ', date: new Date().toISOString().slice(0,10), status:'pending', mileage:8, overallResult:null, notes:'', items:null },
  ]
  vehicleInspections.forEach(i => { if (!demoCol('vehicle_inspections')[i.id]) demoCol('vehicle_inspections')[i.id] = i })


  // Waiting lounge queue (หน้า /service/lounge)
  const wlAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  // Warranty claims (หน้า /service/warranty-claim)
  const wcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // Warranty expiry tracker (หน้า /service/warranty-expiry)
  const warrantyExpiryVehicles = [
    { id:'WE001', vin:'LBV5A2B10P0001234', model:'BYD Atto 3', plate:'กข-1234', owner:'สมชาย ใจดี',    phone:'081-111-2222', sale:'2024-06-10', warrantyEnd:'2027-06-10', kmWarranty:100000, kmCurrent:28400, status:'active' },
    { id:'WE002', vin:'LBV5A2B10P0005678', model:'BYD Seal AWD', plate:'คง-5678', owner:'นภา สุขใจ',  phone:'089-333-4444', sale:'2023-03-01', warrantyEnd:'2026-03-01', kmWarranty:100000, kmCurrent:62100, status:'expired' },
    { id:'WE003', vin:'LBV5A2B10P0009012', model:'BYD Han',     plate:'จฉ-9012', owner:'วิชัย ดีมาก',  phone:'076-555-6666', sale:'2024-01-15', warrantyEnd:'2027-01-15', kmWarranty:100000, kmCurrent:41200, status:'active' },
    { id:'WE004', vin:'LBV5A2B10P0003456', model:'MG ZS EV',    plate:'ชซ-3456', owner:'มาลี รุ่งเรือง',phone:'095-777-8888', sale:'2025-01-20', warrantyEnd:'2028-01-20', kmWarranty:100000, kmCurrent:8900,  status:'active' },
    { id:'WE005', vin:'LBV5A2B10P0007890', model:'BYD Dolphin', plate:'ฌญ-7890', owner:'อรุณ วิชิต',   phone:'081-999-0000', sale:'2023-09-05', warrantyEnd:'2026-07-14', kmWarranty:100000, kmCurrent:58300, status:'expiring' },
    { id:'WE006', vin:'LBV5A2B10P0002345', model:'BYD Atto 3',  plate:'ฎฏ-2345', owner:'สุดา ภักดี',   phone:'089-111-3333', sale:'2023-12-01', warrantyEnd:'2026-08-01', kmWarranty:100000, kmCurrent:51000, status:'expiring' },
  ]
  warrantyExpiryVehicles.forEach(v => { if (!demoCol('warranty_expiry_vehicles')[v.id]) demoCol('warranty_expiry_vehicles')[v.id] = v })


  // Wash & Detailing queue (หน้า /service/wash)
  const wqAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  // Maintenance schedule (หน้า /service/maintenance-schedule) — ตารางบำรุงรักษาเช็คระยะตามยี่ห้อ/รุ่น
  // items: {name, partPrice, laborPrice} ต่อรายการ — ยอดรวมคำนวณจากผลรวมของแต่ละรายการ
  const maintenanceSchedules = [
    { id:'ms1', brand:'DEEPAL', model:'S07', intervalKm:10000, intervalMonths:6, items:[
      { name:'น้ำมันเครื่อง', partPrice:1200, laborPrice:300 }, { name:'ไส้กรองอากาศ', partPrice:350, laborPrice:150 },
      { name:'ตรวจสายพาน', partPrice:0, laborPrice:200 }, { name:'ตรวจเบรก', partPrice:0, laborPrice:200 },
    ], notes:'' },
    { id:'ms2', brand:'DEEPAL', model:'S07', intervalKm:20000, intervalMonths:12, items:[
      { name:'น้ำมันเครื่อง', partPrice:1200, laborPrice:300 }, { name:'ไส้กรองน้ำมัน', partPrice:450, laborPrice:150 },
      { name:'ตรวจช่วงล่าง', partPrice:0, laborPrice:400 }, { name:'ตรวจระบบไฟฟ้า EV', partPrice:0, laborPrice:800 },
    ], notes:'' },
    { id:'ms3', brand:'DEEPAL', model:'S07', intervalKm:40000, intervalMonths:24, items:[
      { name:'น้ำมันเบรก', partPrice:600, laborPrice:400 }, { name:'หัวเทียน/ระบบมอเตอร์', partPrice:1800, laborPrice:600 },
      { name:'ตรวจ Battery SOH', partPrice:0, laborPrice:1200 }, { name:'ตรวจ BMS', partPrice:0, laborPrice:800 },
    ], notes:'ตรวจแบตเตอรี่ตามรอบประกัน EV' },
    { id:'ms4', brand:'AION', model:'Y Plus', intervalKm:10000, intervalMonths:6, items:[
      { name:'ตรวจระบบเบรก', partPrice:0, laborPrice:300 }, { name:'ตรวจยาง', partPrice:0, laborPrice:150 }, { name:'ตรวจ Cooling System', partPrice:200, laborPrice:250 },
    ], notes:'' },
    { id:'ms5', brand:'AION', model:'Y Plus', intervalKm:20000, intervalMonths:12, items:[
      { name:'ตรวจ SOH แบตเตอรี่', partPrice:0, laborPrice:1200 }, { name:'ตรวจ Inverter', partPrice:0, laborPrice:800 },
      { name:'Software Update', partPrice:0, laborPrice:500 }, { name:'ตรวจช่วงล่าง', partPrice:0, laborPrice:400 },
    ], notes:'' },
    { id:'ms6', brand:'OMODA & JAECOO', model:'Omoda 5', intervalKm:10000, intervalMonths:6, items:[
      { name:'น้ำมันเครื่อง', partPrice:1000, laborPrice:300 }, { name:'ไส้กรองอากาศ', partPrice:300, laborPrice:150 },
      { name:'ตรวจเบรก', partPrice:0, laborPrice:200 }, { name:'ตรวจแอร์', partPrice:0, laborPrice:250 },
    ], notes:'' },
    { id:'ms7', brand:'OMODA & JAECOO', model:'Omoda 5', intervalKm:40000, intervalMonths:24, items:[
      { name:'เปลี่ยนสายพานไทม์มิ่ง', partPrice:3500, laborPrice:1500 }, { name:'น้ำมันเกียร์', partPrice:1200, laborPrice:400 }, { name:'ตรวจช่วงล่างเต็มระบบ', partPrice:0, laborPrice:1200 },
    ], notes:'' },
    { id:'ms8', brand:'SUZUKI', model:'Swift', intervalKm:10000, intervalMonths:6, items:[
      { name:'น้ำมันเครื่อง', partPrice:800, laborPrice:250 }, { name:'ไส้กรองอากาศ', partPrice:250, laborPrice:100 }, { name:'ตรวจเบรก', partPrice:0, laborPrice:150 },
    ], notes:'' },
    { id:'ms9', brand:'NISSAN', model:'Almera', intervalKm:10000, intervalMonths:6, items:[
      { name:'น้ำมันเครื่อง', partPrice:850, laborPrice:250 }, { name:'ไส้กรองน้ำมัน', partPrice:280, laborPrice:100 },
      { name:'ตรวจเบรก', partPrice:0, laborPrice:150 }, { name:'ตรวจระบบไฟ', partPrice:0, laborPrice:100 },
    ], notes:'' },
  ]
  maintenanceSchedules.forEach(m => { if (!demoCol('maintenance_schedules')[m.id]) demoCol('maintenance_schedules')[m.id] = m })


  // Bay management (หน้า /service/bay)
  const serviceBays = [
    { id:'B1', type:'ทั่วไป',   status:'busy',     job:'JC-2401', car:'BYD Atto 3 · กข-1234', tech:'สมชาย', etaMin:45 },
    { id:'B2', type:'ทั่วไป',   status:'busy',     job:'JC-2398', car:'MG ZS · 1กก-5678',     tech:'วิชัย',  etaMin:90 },
    { id:'B3', type:'ทั่วไป',   status:'free',     job:'', car:'', tech:'', etaMin:0 },
    { id:'B4', type:'ช่วงล่าง', status:'waiting',  job:'JC-2390', car:'BYD Seal · ขข-9999',   tech:'ประเสริฐ', etaMin:0 },
    { id:'B5', type:'ช่วงล่าง', status:'free',     job:'', car:'', tech:'', etaMin:0 },
    { id:'B6', type:'BP/สี',    status:'busy',     job:'BP-1102', car:'BYD Dolphin · 2กข-3456', tech:'อนุชา',  etaMin:240 },
    { id:'B7', type:'BP/สี',    status:'cleaning', job:'', car:'', tech:'ทีมล้าง', etaMin:15 },
    { id:'B8', type:'EV',       status:'busy',     job:'JC-2405', car:'BYD Han · 3ขค-7788',    tech:'ธนพล',  etaMin:60 },
  ]
  serviceBays.forEach(b => { if (!demoCol('service_bays')[b.id]) demoCol('service_bays')[b.id] = b })


  // Body & Paint jobs (หน้า /service/bp)
  const bodyRepairJobs = [
    { id:'BP001', plate:'กก 1234 กทม', model:'BYD Atto 3', customer:'คุณวรพจน์ สุขใจ', damage:'ชนหน้า ไฟหน้าแตก กันชนยุบ', estimate:45000, status:'estimate', tech:'ช่างเพ็ชร', daysIn:2, insurer:'วิริยะประกัน', claim:'VIR-2026-4521' },
    { id:'BP002', plate:'บบ 5678 ชลบุรี', model:'MG ZS EV', customer:'บริษัท ทรัพย์สิน จก.', damage:'ข้างซ้ายถลอก กระโปรงหลังบุบ', estimate:28000, status:'approved', tech:'ช่างแดน', daysIn:5, insurer:'เมืองไทยประกัน', claim:'MTI-2026-1102' },
    { id:'BP003', plate:'คค 9012 นนทบุรี', model:'BYD Seal AWD', customer:'คุณนภา ชื่นดี', damage:'สีซีดทั้งคัน เคลือบสีใหม่', estimate:35000, status:'in_progress', tech:'ช่างโอ', daysIn:8, insurer:'AXA', claim:'AXA-2026-7788' },
    { id:'BP004', plate:'งง 3456 ปทุม', model:'BYD Dolphin', customer:'คุณสมชาย ดีใจ', damage:'กระจกบังลมหน้าแตก', estimate:12000, status:'ready', tech:'ช่างเพ็ชร', daysIn:3, insurer:'ทิพยประกัน', claim:'TIP-2026-3344' },
    { id:'BP005', plate:'จจ 7890 สมุทรปราการ', model:'MG4 EV', customer:'คุณพรทิพย์ มั่นคง', damage:'ท้ายชนหนักมาก โครงสร้างเสียหาย', estimate:120000, status:'estimate', tech:'ช่างแดน', daysIn:1, insurer:'กรุงเทพประกัน', claim:'BKI-2026-9900' },
    { id:'BP006', plate:'ฉฉ 2345 ระยอง', model:'BYD Atto 3', customer:'คุณวิชัย สุดยอด', damage:'ประตูซ้ายหลังบุบ', estimate:18000, status:'completed', tech:'ช่างโอ', daysIn:12, insurer:'ไทยวิวัฒน์', claim:'TVV-2026-5566' },
  ]
  bodyRepairJobs.forEach(j => { if (!demoCol('body_repair_jobs')[j.id]) demoCol('body_repair_jobs')[j.id] = j })


  // Charging stations (หน้า /service/charging)
  const csAddMins = n => { const d = new Date(); d.setMinutes(d.getMinutes() + n); return d.toISOString() }

  // Pickup & Delivery jobs (หน้า /service/pickup)
  const pdAddHours = n => { const d = new Date(); d.setHours(d.getHours() + n); return d.toISOString() }

  // EV Battery health (หน้า /service/ev-battery)
  const evAddDays2 = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // EV diagnostic scans (หน้า /service/ev-diagnostic)
  const evdAddMins = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  // Loaner car fleet + loans (หน้า /service/loaner)
  const loanerCars = [
    { id:'LC001', plate:'กท-9001 กทม.', model:'Toyota Yaris 2022', color:'ขาว', fuel:'เบนซิน', fuelLevel:80, km:45200, status:'available', note:'' },
    { id:'LC002', plate:'กท-9002 กทม.', model:'Honda City 2023', color:'เงิน', fuel:'เบนซิน', fuelLevel:60, km:32100, status:'loaned', loanedTo:'สมชาย ใจดี', loanDate:'2025-06-07', returnDate:'2025-06-10', note:'คืนด้วยน้ำมันเต็มถัง' },
    { id:'LC003', plate:'กท-9003 กทม.', model:'Isuzu D-Max 2021', color:'เทา', fuel:'ดีเซล', fuelLevel:40, km:68900, status:'service', note:'เช็กระยะตามกำหนด' },
    { id:'LC004', plate:'กท-9004 กทม.', model:'Toyota Yaris 2023', color:'ดำ', fuel:'เบนซิน', fuelLevel:100, km:12000, status:'cleaning', note:'' },
  ]
  loanerCars.forEach(c => { if (!demoCol('loaner_cars')[c.id]) demoCol('loaner_cars')[c.id] = c })


  // Service parts inventory (หน้า /service/parts-inventory) — คนละหน้ากับ parts_inventory ที่ใช้ใน PartsAnalytics
  const servicePartsInventory = [
    { id:'SP001', name:'ผ้าเบรกหน้า BYD', sku:'BRK-F-001', cat:'brake', qty:12, minQty:6, unitCost:850, unitPrice:1500, location:'A1-01', compatible:['BYD Seal','BYD Atto 3'] },
    { id:'SP002', name:'ผ้าเบรกหลัง BYD', sku:'BRK-R-001', cat:'brake', qty:4, minQty:6, unitCost:720, unitPrice:1200, location:'A1-02', compatible:['BYD Seal'] },
    { id:'SP003', name:'ไส้กรองอากาศ', sku:'FLT-AIR-01', cat:'filter', qty:20, minQty:8, unitCost:250, unitPrice:450, location:'B2-01', compatible:['All'] },
    { id:'SP004', name:'น้ำยาล้างกระจก', sku:'FLD-WSH-01', cat:'fluid', qty:35, minQty:10, unitCost:80, unitPrice:150, location:'C1-01', compatible:['All'] },
    { id:'SP005', name:'Battery Module BYD', sku:'EV-BAT-001', cat:'electrical', qty:2, minQty:2, unitCost:45000, unitPrice:75000, location:'D1-01', compatible:['BYD Dolphin'] },
    { id:'SP006', name:'ยาง Bridgestone 215/55R17', sku:'TYR-BS-001', cat:'tyre', qty:8, minQty:4, unitCost:2800, unitPrice:4500, location:'E1-01', compatible:['BYD Atto 3','BYD Seal'] },
    { id:'SP007', name:'ไฟหน้า LED Assembly', sku:'BODY-HL-01', cat:'body', qty:3, minQty:2, unitCost:8500, unitPrice:14000, location:'A2-01', compatible:['BYD Dolphin'] },
  ]
  servicePartsInventory.forEach(p => { if (!demoCol('service_parts_inventory')[p.id]) demoCol('service_parts_inventory')[p.id] = p })


  // Parts purchase orders (หน้า /service/parts-order)
  const poAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Parts RMA (หน้า /service/parts-rma)
  const partsRma = [
    { id:'RMA001', partNo:'BYD-BRAKE-F01', partName:'ผ้าเบรคหน้า BYD Atto 3', qty:4, unit:'ชุด', reason:'ชิ้นส่วนชำรุด', supplier:'BYD Thailand', date:'2026-06-01', cost:2800, status:'approved', refNo:'BYD-RET-2026-0041' },
    { id:'RMA002', partNo:'MG-FILTER-001',  partName:'กรองอากาศ MG ZS EV',    qty:6, unit:'ชิ้น', reason:'ผิดรุ่น',          supplier:'MG Sales',    date:'2026-06-03', cost:1200, status:'pending',  refNo:'' },
    { id:'RMA003', partNo:'BYD-LAMP-R02',   partName:'ไฟท้าย BYD Seal',       qty:2, unit:'ชิ้น', reason:'แตกระหว่างขนส่ง',  supplier:'BYD Thailand', date:'2026-06-05', cost:8400, status:'shipped', refNo:'BYD-RET-2026-0042' },
    { id:'RMA004', partNo:'BOSCH-WIPER-S',  partName:'ใบปัดน้ำฝน Bosch',      qty:10,unit:'คู่',  reason:'ผลิตภัณฑ์ชำรุด',   supplier:'Bosch Thai',  date:'2026-06-08', cost:3500, status:'pending',  refNo:'' },
    { id:'RMA005', partNo:'BYD-TYRE-195',   partName:'ยาง BYD 195/60R16',     qty:8, unit:'เส้น', reason:'ผิดสเปก',           supplier:'BYD Thailand', date:'2026-06-10', cost:16000,status:'approved', refNo:'BYD-RET-2026-0043' },
  ]
  partsRma.forEach(r => { if (!demoCol('parts_rma')[r.id]) demoCol('parts_rma')[r.id] = r })


  // Quick Lane jobs (หน้า /service/quick-lane)
  const quickLaneJobs = [
    { id:'QL001', plate:'กก-1234', customer:'สมชาย ใจดี',    service:'เปลี่ยนถ่ายน้ำมัน',    bay:1, started:'09:10', estimated:30, status:'done',       price:1200 },
    { id:'QL002', plate:'ขข-5678', customer:'นภา สุขสม',     service:'เติมลม / ตรวจยาง',      bay:2, started:'09:30', estimated:15, status:'in_progress', price:0    },
    { id:'QL003', plate:'คค-9012', customer:'วิชัย ศรีดี',   service:'เปลี่ยนไส้กรองอากาศ',   bay:1, started:'09:45', estimated:20, status:'waiting',     price:800  },
    { id:'QL004', plate:'งง-3456', customer:'กาญจนา ทอง',   service:'ตรวจเช็ก EV Battery',   bay:3, started:'10:00', estimated:45, status:'in_progress', price:500  },
    { id:'QL005', plate:'จจ-7890', customer:'ประเสริฐ มั่น', service:'เปลี่ยนถ่ายน้ำมัน',    bay:2, started:'10:15', estimated:30, status:'waiting',     price:1200 },
  ]
  quickLaneJobs.forEach(j => { if (!demoCol('quick_lane_jobs')[j.id]) demoCol('quick_lane_jobs')[j.id] = j })


  // Recall management (หน้า /service/recall)
  const rcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Recall tracker vehicles by VIN (หน้า /service/recall-tracker)
  const recallTrackerVehicles = [
    { id:'RTV1', vin:'LGXC4EBA5PA000101', plate:'กข-1234', model:'BYD Atto 3', owner:'นภา มีสุข', phone:'081-234-5678', recalls:['RC001'], status:{ RC001:'pending' } },
    { id:'RTV2', vin:'LGXC5EBA6PA000202', plate:'กข-5678', model:'BYD Seal AWD', owner:'สมชาย วิเศษ', phone:'089-876-5432', recalls:['RC002'], status:{ RC002:'notified' } },
    { id:'RTV3', vin:'LGXC4EBA5PA000303', plate:'กก-0009', model:'BYD Atto 3', owner:'รัชนี สุขใจ', phone:'062-222-3333', recalls:['RC001'], status:{ RC001:'completed' } },
    { id:'RTV4', vin:'LSGBC54C5PA000404', plate:'กก-1234', model:'MG ZS EV', owner:'มาลี จันทร์ดี', phone:'076-111-2222', recalls:['RC003'], status:{ RC003:'pending' } },
    { id:'RTV5', vin:'LGXC5EBA6PA000505', plate:'กก-5678', model:'BYD Seal AWD', owner:'วิชัย รุ่งเรือง', phone:'095-555-6666', recalls:['RC002'], status:{ RC002:'completed' } },
  ]
  recallTrackerVehicles.forEach(v => { if (!demoCol('recall_tracker_vehicles')[v.id]) demoCol('recall_tracker_vehicles')[v.id] = v })


  // Reschedule AI appointments (หน้า /service/reschedule-ai)
  const rescheduleAppointments = [
    { id:'A001', customer:'นภา มีสุข', phone:'081-234-5678', model:'BYD Atto 3', service:'เช็คระยะ 10,000 km', date:'2026-06-15', slot:'09:00', bay:1, status:'confirmed', aiSuggested:false },
    { id:'A002', customer:'สมชาย วิเศษ', phone:'089-876-5432', model:'BYD Seal AWD', service:'เปลี่ยนยาง 4 เส้น', date:'2026-06-15', slot:'10:00', bay:2, status:'cancelled', aiSuggested:false },
    { id:'A003', customer:'มาลี จันทร์ดี', phone:'076-111-2222', model:'MG ZS EV', service:'PDI ก่อนส่งมอบ', date:'2026-06-16', slot:'09:30', bay:1, status:'confirmed', aiSuggested:false },
    { id:'A004', customer:'วิชัย รุ่งเรือง', phone:'095-555-6666', model:'BYD Atto 3', service:'เช็คระยะ 20,000 km', date:'2026-06-16', slot:'13:00', bay:3, status:'waitlist', aiSuggested:false },
    { id:'A005', customer:'รัชนี สุขใจ', phone:'062-222-3333', model:'BYD Dolphin', service:'Battery Health Check', date:'2026-06-17', slot:'11:00', bay:2, status:'confirmed', aiSuggested:false },
  ]
  rescheduleAppointments.forEach(a => { if (!demoCol('reschedule_appointments')[a.id]) demoCol('reschedule_appointments')[a.id] = a })


  // Roadside assist cases (หน้า /service/roadside)
  const raAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  // Parts inventory (for analytics)
  const partsInventory = [
    { id:'pi1', sku:'BYD-SEAL-BF001', name:'น้ำมันเบรก DOT4 BYD Original', brand:'BYD', category:'น้ำมันและของเหลว', qty:24, minQty:5, unitCost:280, unitPrice:450, turnover:8.2, lastSold:'2025-06-10' },
    { id:'pi2', sku:'BYD-SEAL-BP002', name:'ผ้าเบรกหน้า BYD Seal', brand:'BYD', category:'ระบบเบรก', qty:8, minQty:2, unitCost:1800, unitPrice:3200, turnover:3.1, lastSold:'2025-05-28' },
    { id:'pi3', sku:'MG-MG4-TY001', name:'ยางหน้า Michelin 235/45R18', brand:'Michelin', category:'ยางและล้อ', qty:12, minQty:4, unitCost:3200, unitPrice:4800, turnover:5.4, lastSold:'2025-06-05' },
    { id:'pi4', sku:'NETA-V-AC001', name:'คอมเพรสเซอร์แอร์ NETA V II', brand:'NETA', category:'ระบบไฟฟ้า', qty:2, minQty:1, unitCost:12000, unitPrice:18500, turnover:1.8, lastSold:'2025-04-20' },
    { id:'pi5', sku:'UNI-FL001', name:'น้ำหล่อเย็น EV Coolant', brand:'Universal', category:'น้ำมันและของเหลว', qty:3, minQty:10, unitCost:450, unitPrice:700, turnover:0.9, lastSold:'2025-03-15' },
  ]
  partsInventory.forEach(p => { if (!demoCol('parts_inventory')[p.id]) demoCol('parts_inventory')[p.id] = p })


  // Service history records (หน้า /service/history) — distinct concept from job_cards (active repair jobs);
  // this is a completed-service log with its own cost breakdown & next-service-due tracking.
  const shAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Vehicle warranties (หน้า /service/warranty-management) — distinct from warranty_claims (OEM reimbursement claims, used by /service/warranty-claim)
  const vehicleWarranties = [
    { id:'W001', customerId:'C001', customerName:'วิชาญ มีโชค', phone:'081-234-5678',
      vehiclePlate:'กก 1234 BKK', brand:'BYD', model:'Seal', year:2024, vin:'LBWAB2EB7PD002345',
      type:'factory', startDate:'2024-01-15', endDate:'2027-01-14', km:100000,
      status:'active', notes:'รับประกัน 3 ปี หรือ 100,000 กม.' },
    { id:'W002', customerId:'C002', customerName:'อรนุช สายใจ', phone:'082-345-6789',
      vehiclePlate:'ขข 5678 BKK', brand:'BYD', model:'Atto 3', year:2023, vin:'LBWAB2EB7PD003456',
      type:'battery', startDate:'2023-03-10', endDate:'2031-03-09', km:160000,
      status:'active', notes:'รับประกันแบตเตอรี่ EV 8 ปี หรือ 160,000 กม.' },
    { id:'W003', customerId:'C003', customerName:'ธีรยุทธ เก่งกาจ', phone:'083-456-7890',
      vehiclePlate:'คค 9012 BKK', brand:'MG', model:'ZS EV', year:2022, vin:'LSJWSRAR7NE012345',
      type:'factory', startDate:'2022-06-01', endDate:'2025-05-31', km:100000,
      status:'expiring', notes:'ใกล้หมดอายุ — เสนอต่ออายุ' },
    { id:'W004', customerId:'C004', customerName:'สมหญิง รักรถ', phone:'084-567-8901',
      vehiclePlate:'งง 3456 BKK', brand:'Neta', model:'V', year:2022, vin:'LNBSDBEB9PA001234',
      type:'factory', startDate:'2022-01-01', endDate:'2024-12-31', km:80000,
      status:'expired', notes:'หมดอายุแล้ว' },
    { id:'W005', customerId:'C001', customerName:'วิชาญ มีโชค', phone:'081-234-5678',
      vehiclePlate:'กก 1234 BKK', brand:'BYD', model:'Seal', year:2024, vin:'LBWAB2EB7PD002345',
      type:'extended', startDate:'2027-01-15', endDate:'2029-01-14', km:200000,
      status:'active', notes:'รับประกันเพิ่มเติม 2 ปี' },
  ]
  vehicleWarranties.forEach(w => { if (!demoCol('vehicle_warranties')[w.id]) demoCol('vehicle_warranties')[w.id] = w })


  // Warranty service claims (หน้า /service/warranty-management) — customer-facing warranty claims, linked to vehicle_warranties by warrantyId
  const warrantyServiceClaims = [
    { id:'CL001', warrantyId:'W003', customerName:'ธีรยุทธ เก่งกาจ', vehiclePlate:'คค 9012 BKK',
      type:'factory', date:'2025-03-15', issue:'ระบบ AC ขัดข้อง — เสียงดังผิดปกติ',
      status:'closed', techNote:'เปลี่ยนคอมเพรสเซอร์ AC ใหม่', cost:15000, covered:true },
    { id:'CL002', warrantyId:'W003', customerName:'ธีรยุทธ เก่งกาจ', vehiclePlate:'คค 9012 BKK',
      type:'factory', date:'2024-11-10', issue:'จอ Infotainment ค้าง รีสตาร์ทเองบ่อยครั้ง',
      status:'closed', techNote:'Update firmware และเปลี่ยนแผงวงจร', cost:8000, covered:true },
    { id:'CL003', warrantyId:'W004', customerName:'สมหญิง รักรถ', vehiclePlate:'งง 3456 BKK',
      type:'factory', date:'2025-05-20', issue:'ประตูหลังซ้าย – บานพับหลวม',
      status:'pending', techNote:'', cost:0, covered:null },
  ]
  warrantyServiceClaims.forEach(c => { if (!demoCol('warranty_service_claims')[c.id]) demoCol('warranty_service_claims')[c.id] = c })
}
