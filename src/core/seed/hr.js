// Demo seed data — hr module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  const addDaysISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const addDaysFullISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString() }
  const now = new Date()

  // Staff
  const staff = [
    { id:'st1', firstName:'ทวีศักดิ์', lastName:'สุขสมบัติเสถียร', nickname:'เจ้าของ', role:'owner', dept:'ผู้บริหาร', phone:'0812345678', email:'owner@lamom.com', startDate:'2020-01-01', salary:0, status:'active' },
    { id:'st2', firstName:'อรนุช', lastName:'เซลส์ดี', nickname:'นุ้ย', role:'sales', dept:'ฝ่ายขาย', phone:'0823456789', email:'nun@lamom.com', startDate:'2022-03-01', salary:25000, status:'active' },
    { id:'st3', firstName:'วิชัย', lastName:'ขายเก่ง', nickname:'วิ', role:'sales', dept:'ฝ่ายขาย', phone:'0834567890', email:'wichai@lamom.com', startDate:'2023-06-01', salary:22000, status:'active' },
    { id:'st4', firstName:'สมชาย', lastName:'ช่างดี', nickname:'ชาย', role:'service', dept:'ฝ่ายบริการ', phone:'0845678901', email:'somchai@lamom.com', startDate:'2021-09-01', salary:20000, status:'active' },
    { id:'st5', firstName:'วิชัย', lastName:'ช่างเก่ง', nickname:'เก่ง', role:'service', dept:'ฝ่ายบริการ', phone:'0856789012', email:'wichai2@lamom.com', startDate:'2022-12-01', salary:18000, status:'probation' },
  ]
  staff.forEach(s => { if (!demoCol('staff')[s.id]) demoCol('staff')[s.id] = s })


  // Team/Department Targets — เป้าหมายทีม/ฝ่าย + KPI (หน้า /hr/targets)
  const ttPeriod = new Date().toISOString().slice(0, 7)

  // Employee KPI Evaluations — ประเมินผลงานรายบุคคล (หน้า /hr/employee-kpi)
  const ekAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

  // Expense claims (หน้า /hr/expense-claims) — การเบิกค่าใช้จ่ายพนักงาน
  const expenseClaims = [
    { id:'EX001', staffName:'วิชาญ มีโชค', dept:'sales', cat:'fuel', desc:'น้ำมันเยี่ยมลูกค้า ชลบุรี', amount:850, date:'2026-06-05', status:'approved', approvedBy:'ผู้จัดการ', paidDate:null, receipt:true },
    { id:'EX002', staffName:'อรนุช สายใจ', dept:'sales', cat:'meals', desc:'ค่าอาหารลูกค้า 3 คน', amount:1200, date:'2026-06-06', status:'pending', approvedBy:null, paidDate:null, receipt:true },
    { id:'EX003', staffName:'ธีรยุทธ เก่งกาจ', dept:'service', cat:'transport', desc:'BTS/MRT ไปอบรม', amount:180, date:'2026-06-07', status:'approved', approvedBy:'ผู้จัดการ', paidDate:null, receipt:false },
    { id:'EX004', staffName:'นภา จิตดี', dept:'admin', cat:'office', desc:'กระดาษ A4 + ปากกา', amount:450, date:'2026-06-08', status:'paid', approvedBy:'ผู้จัดการ', paidDate:'2026-06-09', receipt:true },
    { id:'EX005', staffName:'วิชาญ มีโชค', dept:'sales', cat:'marketing', desc:'พิมพ์โบรชัวร์ 100 แผ่น', amount:3500, date:'2026-06-09', status:'pending', approvedBy:null, paidDate:null, receipt:true },
    { id:'EX006', staffName:'พิมพ์ใจ ตั้งมั่น', dept:'service', cat:'phone', desc:'ค่าโทรศัพท์ มิ.ย.', amount:299, date:'2026-06-01', status:'rejected', approvedBy:'ผู้จัดการ', paidDate:null, receipt:false, rejectReason:'เกินวงเงิน' },
  ]
  expenseClaims.forEach(c => { if (!demoCol('expense_claims')[c.id]) demoCol('expense_claims')[c.id] = c })


  // Staff loans (หน้า /hr/loans) — เงินกู้/เบิกล่วงหน้าพนักงาน
  const staffLoans = [
    { id:'SL001', staff:'มานะ ขยัน', salary:18000, type:'advance', amount:8000, installments:1, paidInstallments:0, status:'pending', date:'2026-07-03', reason:'ค่าเทอมลูก' },
    { id:'SL002', staff:'ธนา เก่ง', salary:24000, type:'emergency', amount:30000, installments:6, paidInstallments:2, status:'approved', date:'2026-04-25', reason:'ซ่อมบ้านน้ำท่วม' },
    { id:'SL003', staff:'วิทยา ช่างใหญ่', salary:35000, type:'education', amount:60000, installments:12, paidInstallments:12, status:'paid', date:'2025-05-30', reason:'ค่าเทอมมหาวิทยาลัยลูก' },
    { id:'SL004', staff:'สมบัติ ขับดี', salary:15000, type:'emergency', amount:40000, installments:6, paidInstallments:0, status:'rejected', date:'2026-06-24', reason:'เกินวงเงิน (ขอ 2.7 เท่า)' },
  ]
  staffLoans.forEach(l => { if (!demoCol('staff_loans')[l.id]) demoCol('staff_loans')[l.id] = l })


  // Skill matrix (หน้า /hr/skills)
  const staffSkills = [
    { id:'S01', name:'วิชัย ยอดขาย', role:'Senior Sales', skills:{ sales:4, product:4, finance:3, ev_repair:0, general_repair:0, crm_system:3, english:2 } },
    { id:'S02', name:'สุดา มาดี', role:'Sales', skills:{ sales:3, product:3, finance:4, ev_repair:0, general_repair:0, crm_system:4, english:3 } },
    { id:'S03', name:'ธนา เก่ง', role:'Junior Sales', skills:{ sales:2, product:2, finance:1, ev_repair:0, general_repair:0, crm_system:2, english:1 } },
    { id:'S04', name:'วิทยา ช่างใหญ่', role:'Senior Tech', skills:{ sales:0, product:3, finance:0, ev_repair:4, general_repair:4, crm_system:2, english:1 } },
    { id:'S05', name:'สุรชัย มือดี', role:'EV Specialist', skills:{ sales:0, product:4, finance:0, ev_repair:4, general_repair:3, crm_system:3, english:2 } },
    { id:'S06', name:'มานะ ขยัน', role:'Junior Tech', skills:{ sales:0, product:1, finance:0, ev_repair:1, general_repair:2, crm_system:1, english:0 } },
  ]
  staffSkills.forEach(s => { if (!demoCol('staff_skills')[s.id]) demoCol('staff_skills')[s.id] = s })


  // Salary scale (หน้า /hr/salary-scale)
  const salaryScaleStaff = [
    { id:'S001', name:'วิชัย ยอดขาย', dept:'ขาย', grade:'G3', salary:32000, market:34000 },
    { id:'S002', name:'สุดา มาดี', dept:'ขาย', grade:'G3', salary:30000, market:34000 },
    { id:'S003', name:'ธนา เก่ง', dept:'ขาย', grade:'G2', salary:24000, market:25000 },
    { id:'S004', name:'วิทยา ช่างใหญ่', dept:'บริการ', grade:'G3', salary:35000, market:36000 },
    { id:'S005', name:'สมศรี การเงิน', dept:'การเงิน', grade:'G4', salary:42000, market:45000 },
    { id:'S006', name:'ประพันธ์ ผู้จัดการ', dept:'บริหาร', grade:'G5', salary:58000, market:62000 },
  ]
  salaryScaleStaff.forEach(s => { if (!demoCol('salary_scale_staff')[s.id]) demoCol('salary_scale_staff')[s.id] = s })


  // Staff profiles (หน้า /hr/profile)
  const staffProfiles = [
    { id:'STF001', name:'วิชัย ยอดขาย', nameEn:'Wichai Yodsai', avatar:'👨', dept:'ฝ่ายขาย', role:'เซลส์อาวุโส', empType:'fulltime', status:'active', startDate:addDaysISO(-730), salary:35000, phone:'085-xxx', email:'wichai@lamom.one', skills:['EV','Negotiation','CRM'], kpiScore:94, leaveBalance:8 },
    { id:'STF002', name:'สุดา มาดี', nameEn:'Suda Madee', avatar:'👩', dept:'ฝ่ายขาย', role:'เซลส์', empType:'fulltime', status:'active', startDate:addDaysISO(-365), salary:28000, phone:'086-xxx', email:'suda@lamom.one', skills:['Customer Service','EV'], kpiScore:87, leaveBalance:10 },
    { id:'STF003', name:'วิทยา ช่างดี', nameEn:'Witthaya Chandee', avatar:'🧑', dept:'ศูนย์บริการ', role:'ช่างอาวุโส', empType:'fulltime', status:'active', startDate:addDaysISO(-1095), salary:32000, phone:'087-xxx', email:'witthaya@lamom.one', skills:['EV Diagnostic','BYD','MG'], kpiScore:91, leaveBalance:5 },
    { id:'STF004', name:'ปทิตา การเงิน', nameEn:'Patita Finance', avatar:'👩', dept:'การเงิน', role:'ผู้จัดการการเงิน', empType:'fulltime', status:'active', startDate:addDaysISO(-548), salary:45000, phone:'088-xxx', email:'patita@lamom.one', skills:['Accounting','Excel','QuickBooks'], kpiScore:96, leaveBalance:12 },
    { id:'STF005', name:'ธนา เก่งกว่า', nameEn:'Tana Kengkwa', avatar:'👨', dept:'ฝ่ายขาย', role:'เซลส์', empType:'probation', status:'active', startDate:addDaysISO(-60), salary:22000, phone:'089-xxx', email:'tana@lamom.one', skills:['Communication'], kpiScore:72, leaveBalance:0 },
  ]
  staffProfiles.forEach(s => { if (!demoCol('staff_profiles')[s.id]) demoCol('staff_profiles')[s.id] = s })


  // Disciplinary records (หน้า /hr/disciplinary) — บันทึกตักเตือน/ใบเตือนพนักงาน
  const disciplinaryRecords = [
    { id:'DR-001', caseNo:'DR-001', staff:'สมชาย ใจดี', dept:'ช่าง', level:'verbal', reason:'มาสายเกิน 3 ครั้ง/เดือน', by:'หัวหน้าช่าง', date:'2026-05-18', ack:true },
    { id:'DR-002', caseNo:'DR-002', staff:'นิภา สวยงาม', dept:'เซลส์', level:'written', reason:'ไม่บันทึก Lead ตามขั้นตอน ทำให้เสียลูกค้า', by:'ผจก.ขาย', date:'2026-06-01', ack:true },
    { id:'DR-003', caseNo:'DR-003', staff:'สมชาย ใจดี', dept:'ช่าง', level:'written', reason:'มาสายซ้ำหลังตักเตือนวาจา', by:'หัวหน้าช่าง', date:'2026-06-08', ack:false },
  ]
  disciplinaryRecords.forEach(r => { if (!demoCol('disciplinary_records')[r.id]) demoCol('disciplinary_records')[r.id] = r })


  // Onboarding staff (หน้า /hr/onboarding)
  const onboardingTemplate = [
    { id:'T01', cat:'docs', task:'กรอกแบบฟอร์มข้อมูลส่วนตัว', dueDay:1 },
    { id:'T02', cat:'docs', task:'ส่งสำเนาเอกสาร (บัตร ทะเบียนบ้าน ฯลฯ)', dueDay:1 },
    { id:'T03', cat:'system', task:'สร้าง account อีเมลบริษัท', dueDay:1 },
    { id:'T04', cat:'system', task:'เข้าถึงระบบ LAMOM ONE', dueDay:2 },
    { id:'T05', cat:'equip', task:'รับอุปกรณ์ทำงาน (คอม/โทรศัพท์)', dueDay:1 },
    { id:'T06', cat:'meeting', task:'พบผู้บังคับบัญชาโดยตรง', dueDay:1 },
    { id:'T07', cat:'meeting', task:'Tour ทั่วบริษัท + แนะนำทีม', dueDay:2 },
    { id:'T08', cat:'training', task:'อบรม Product Knowledge (EV)', dueDay:3 },
    { id:'T09', cat:'training', task:'อบรม SOP ฝ่ายที่สังกัด', dueDay:5 },
    { id:'T10', cat:'training', task:'อบรม LAMOM ONE — ใช้งานระบบ', dueDay:5 },
    { id:'T11', cat:'meeting', task:'ประชุม 1:1 กับหัวหน้า — เซ็ตเป้าหมาย', dueDay:7 },
    { id:'T12', cat:'docs', task:'เซ็นสัญญาจ้างงาน', dueDay:3 },
  ]
  const onboardingStaff = [
    { id:'NS001', name:'ปิยะ ดีงาม', role:'เซลส์ที่ปรึกษา', dept:'ฝ่ายขาย', startDate:addDaysISO(-3), tasks:onboardingTemplate.map(t => ({ ...t, done: t.dueDay <= 2 })) },
    { id:'NS002', name:'วรรณา สวยงาม', role:'ช่างบริการ', dept:'บริการ', startDate:addDaysISO(-1), tasks:onboardingTemplate.map(t => ({ ...t, done: t.dueDay <= 1 })) },
    { id:'NS003', name:'กิตติศักดิ์ เก่งกาจ', role:'เจ้าหน้าที่การเงิน', dept:'การเงิน', startDate:addDaysISO(1), tasks:onboardingTemplate.map(t => ({ ...t, done: false })) },
  ]

  // Offboarding staff (หน้า /hr/offboarding)
  const offboardingStaff = [
    { id:'OB001', name:'ประสิทธิ์ ดีเด่น', role:'ช่างเทคนิค', dept:'บริการ', lastDay:addDaysISO(14), reason:'ได้งานใกล้บ้าน', successor:'มานะ ขยัน', tasks:{ T01:true, T02:false, T03:false, T04:false, T05:false, T06:false, T07:false, T08:false, T09:true, T10:false } },
    { id:'OB002', name:'กมล ขายเก่ง', role:'เซลส์', dept:'ขาย', lastDay:addDaysISO(-5), reason:'ย้ายจังหวัด', successor:'ธนา เก่ง', tasks:{ T01:true, T02:true, T03:true, T04:true, T05:true, T06:true, T07:true, T08:true, T09:true, T10:true } },
  ]
  offboardingStaff.forEach(o => { if (!demoCol('offboarding_staff')[o.id]) demoCol('offboarding_staff')[o.id] = o })


  // Performance reviews (หน้า /hr/performance-review)
  const performanceReviews = [
    { id:'PR001', staff:'วิชัย ยอดขาย', dept:'ฝ่ายขาย', period:'H1/2568',
      status:'reviewed', selfScores:{ kpi:4, quality:4, teamwork:5, initiative:4, development:3 },
      mgmtScores:{ kpi:4, quality:4, teamwork:4, initiative:3, development:4 },
      comment:'ยอดขายดีเยี่ยม แต่ต้องพัฒนาด้านความคิดริเริ่ม', grade:'B+' },
    { id:'PR002', staff:'สุดา มาดี', dept:'ฝ่ายขาย', period:'H1/2568',
      status:'completed', selfScores:{ kpi:5, quality:5, teamwork:5, initiative:5, development:4 },
      mgmtScores:{ kpi:5, quality:4, teamwork:5, initiative:4, development:4 },
      comment:'ผลงานดีเยี่ยม ยอดขายสูงสุดในทีม', grade:'A' },
    { id:'PR003', staff:'ธนา เก่ง', dept:'ฝ่ายขาย', period:'H1/2568',
      status:'self_done', selfScores:{ kpi:3, quality:4, teamwork:4, initiative:3, development:4 },
      mgmtScores:null, comment:'', grade:null },
    { id:'PR004', staff:'วิทยา ช่าง', dept:'บริการ', period:'H1/2568',
      status:'pending', selfScores:null, mgmtScores:null, comment:'', grade:null },
  ]
  performanceReviews.forEach(r => { if (!demoCol('performance_reviews')[r.id]) demoCol('performance_reviews')[r.id] = r })


  // Recruitment jobs + applicants (หน้า /hr/recruitment)
  const recruitmentJobs = [
    { id:'JB001', title:'Sales Executive (รถยนต์ไฟฟ้า)', dept:'ฝ่ายขาย', location:'กรุงเทพฯ', type:'fulltime', salaryMin:25000, salaryMax:50000, status:'open', openDate:'2026-05-01', deadline:'2026-07-01', filled:0, description:'ขายรถยนต์ไฟฟ้า BYD / MG / Neta / ORA ต้องมีประสบการณ์ขายรถยนต์อย่างน้อย 1 ปี', requirements:['มีใบขับขี่', 'มีทักษะการเจรจาต่อรอง', 'มีรถส่วนตัวจะพิจารณาเป็นพิเศษ'] },
    { id:'JB002', title:'Service Advisor', dept:'ฝ่ายบริการ', location:'กรุงเทพฯ', type:'fulltime', salaryMin:18000, salaryMax:30000, status:'open', openDate:'2026-05-15', deadline:'2026-06-30', filled:0, description:'รับลูกค้าเข้าศูนย์บริการ ประสานงานช่าง แจ้งสถานะงาน', requirements:['ปริญญาตรีขึ้นไป', 'มีทักษะสื่อสารดี', 'ภาษาอังกฤษพื้นฐาน'] },
    { id:'JB003', title:'Digital Marketing Specialist', dept:'ฝ่ายการตลาด', location:'กรุงเทพฯ', type:'fulltime', salaryMin:22000, salaryMax:40000, status:'hold', openDate:'2026-04-01', deadline:'2026-05-31', filled:0, description:'ดูแล Social Media Facebook/TikTok/Instagram ทำ Content และวิเคราะห์ผล', requirements:['ประสบการณ์ด้าน Digital Marketing 2 ปี', 'รู้จัก Meta Ads / Google Ads'] },
    { id:'JB004', title:'Automotive Technician (EV)', dept:'ฝ่ายบริการ', location:'กรุงเทพฯ', type:'fulltime', salaryMin:20000, salaryMax:40000, status:'filled', openDate:'2026-03-01', deadline:'2026-04-30', filled:1, description:'ช่างซ่อมรถยนต์ไฟฟ้า มีประกาศนียบัตรวิชาชีพ', requirements:['ปวช./ปวส. ช่างยนต์', 'ผ่านการอบรม EV จะพิจารณาพิเศษ'] },
  ]
  recruitmentJobs.forEach(j => { if (!demoCol('recruitment_jobs')[j.id]) demoCol('recruitment_jobs')[j.id] = j })


  // Overtime records (หน้า /hr/overtime)
  const overtimeRecords = [
    { id:'OT001', staff:'วิทยา ช่างใหญ่', dept:'บริการ', date:addDaysISO(-1), hours:3, hourlyRate:219, reason:'ซ่อมรถลูกค้าด่วน — ต้องส่งมอบพรุ่งนี้', status:'pending' },
    { id:'OT002', staff:'สุรชัย มือดี', dept:'บริการ', date:addDaysISO(-1), hours:2, hourlyRate:200, reason:'EV Diagnostic เคสซับซ้อน', status:'pending' },
    { id:'OT003', staff:'วิชัย ยอดขาย', dept:'ขาย', date:addDaysISO(-3), hours:4, hourlyRate:188, reason:'งาน Motor Show — บูธถึง 22:00', status:'approved' },
    { id:'OT004', staff:'สมศรี การเงิน', dept:'การเงิน', date:addDaysISO(-5), hours:3, hourlyRate:263, reason:'ปิดงบเดือน', status:'paid' },
    { id:'OT005', staff:'มานะ ขยัน', dept:'บริการ', date:addDaysISO(-7), hours:5, hourlyRate:156, reason:'ค้างงานซ่อมสีตัวถัง', status:'rejected' },
  ]
  overtimeRecords.forEach(o => { if (!demoCol('overtime_records')[o.id]) demoCol('overtime_records')[o.id] = o })


  // Bonus pool staff (หน้า /hr/bonus-pool)
  const bonusPoolStaff = [
    { id:'BP001', name:'นภา มีสุข', dept:'ฝ่ายขาย', role:'Sales Manager', kpi:98, base:55000, multiplier:3.0, paid:false },
    { id:'BP002', name:'สมชาย วิเศษ', dept:'ฝ่ายบริการ', role:'SA Lead', kpi:85, base:42000, multiplier:2.0, paid:false },
    { id:'BP003', name:'มาลี จันทร์ดี', dept:'ฝ่ายการตลาด', role:'Marketing Mgr', kpi:91, base:50000, multiplier:2.5, paid:false },
    { id:'BP004', name:'วิชัย รุ่งเรือง', dept:'ฝ่ายขาย', role:'Sales Exec', kpi:72, base:35000, multiplier:1.5, paid:false },
    { id:'BP005', name:'รัชนี สุขใจ', dept:'ฝ่าย HR', role:'HR Specialist', kpi:88, base:40000, multiplier:2.0, paid:false },
    { id:'BP006', name:'อรุณ วิชิต', dept:'ฝ่ายการเงิน', role:'Accountant', kpi:94, base:45000, multiplier:2.5, paid:false },
  ]
  bonusPoolStaff.forEach(s => { if (!demoCol('bonus_pool_staff')[s.id]) demoCol('bonus_pool_staff')[s.id] = s })


  // Welfare items (หน้า /hr/welfare)
  const welfareItems = [
    { id:'WF001', category:'ประกัน', name:'ประกันชีวิตกลุ่ม', provider:'AIA', coverage:'500,000', eligible:28, enrolled:26, cost:1200, period:'รายปี', active:true },
    { id:'WF002', category:'ประกัน', name:'ประกันสุขภาพ OPD/IPD', provider:'Cigna', coverage:'150,000', eligible:28, enrolled:28, cost:3500, period:'รายปี', active:true },
    { id:'WF003', category:'กองทุน', name:'กองทุนสำรองเลี้ยงชีพ', provider:'กองทุน TMB', coverage:'5%', eligible:20, enrolled:18, cost:0, period:'รายเดือน', active:true },
    { id:'WF004', category:'สิทธิพิเศษ', name:'ส่วนลดซื้อรถพนักงาน', provider:'LAMOM', coverage:'2%', eligible:28, enrolled:28, cost:0, period:'ครั้งเดียว', active:true },
    { id:'WF005', category:'สุขภาพ', name:'ตรวจสุขภาพประจำปี', provider:'รพ.บำรุงราษฎร์', coverage:'ครบชุด', eligible:28, enrolled:25, cost:2800, period:'รายปี', active:true },
    { id:'WF006', category:'สิทธิพิเศษ', name:'โบนัสวันเกิด', provider:'LAMOM', coverage:'500 บ.', eligible:28, enrolled:28, cost:500, period:'รายปี', active:true },
    { id:'WF007', category:'กองทุน', name:'กองทุน EV เงินกู้รถ', provider:'LAMOM', coverage:'500,000', eligible:15, enrolled:8, cost:0, period:'ครั้งเดียว', active:false },
  ]
  welfareItems.forEach(w => { if (!demoCol('welfare_items')[w.id]) demoCol('welfare_items')[w.id] = w })


  // HR announcements (หน้า /hr/announcements)
  const hrAnnouncements = [
    { id:'AN001', title:'ปิดระบบ LAMOM ONE อัปเกรด คืนวันเสาร์ 23:00–01:00', type:'urgent', author:'Admin', time:addDaysFullISO(-1), pinned:true, readBy:12, totalStaff:16, body:'ระบบจะใช้งานไม่ได้ชั่วคราว กรุณาบันทึกงานค้างก่อนเวลา' },
    { id:'AN002', title:'งานเลี้ยงกลางปี ศุกร์ 26 มิ.ย. 18:00 — ร้านครัวริมน้ำ', type:'event', author:'HR', time:addDaysFullISO(-3), pinned:true, readBy:15, totalStaff:16, body:'ลงชื่อร่วมงานที่ HR ภายในพุธนี้ มีรถรับ-ส่งจากโชว์รูม' },
    { id:'AN003', title:'ปรับระเบียบเบิกค่าน้ำมัน — ใช้แอปบันทึกแทนกระดาษ', type:'policy', author:'การเงิน', time:addDaysFullISO(-7), pinned:false, readBy:11, totalStaff:16, body:'เริ่ม 1 ก.ค. เบิกผ่าน LAMOM ONE → Expense Claims เท่านั้น แนบรูปใบเสร็จในแอป' },
    { id:'AN004', title:'ยินดีต้อนรับพนักงานใหม่ — ปิยะ (เซลส์) และ วรรณา (ช่าง)', type:'general', author:'HR', time:addDaysFullISO(-10), pinned:false, readBy:16, totalStaff:16, body:'ฝากดูแลน้องใหม่ทั้ง 2 ท่านด้วยครับ' },
    { id:'AN005', title:'BYD ปรับราคา Atto 3 มีผล 1 ก.ค. — รอประกาศราคาใหม่', type:'urgent', author:'ผจก.ขาย', time:addDaysFullISO(-2), pinned:false, readBy:9, totalStaff:16, body:'ระหว่างนี้ห้ามยืนยันราคากับลูกค้าที่จองหลัง 1 ก.ค. จนกว่าจะมีประกาศ' },
  ]
  hrAnnouncements.forEach(a => { if (!demoCol('announcements_hr')[a.id]) demoCol('announcements_hr')[a.id] = a })


  // Team meetings (หน้า /hr/meetings)
  const teamMeetings = [
    { id:'M001', title:'Morning Brief — ทีมขาย', type:'daily', date:addDaysISO(0), time:'08:45', attendees:'ทีมขายทั้งหมด', notes:'เป้าวันนี้ 2 คัน · มีนัด Test Drive 4 ราย', done:false,
      actions:[
        { task:'โทร follow-up ลูกค้า Hot 3 ราย', owner:'วิชัย', done:true },
        { task:'เตรียมรถ Demo ให้พร้อม 10:00', owner:'ธนา', done:false },
      ] },
    { id:'M002', title:'ประชุมสัปดาห์ — ทุกแผนก', type:'weekly', date:addDaysISO(-2), time:'17:00', attendees:'หัวหน้าทุกแผนก', notes:'ยอดสัปดาห์ที่แล้ว 5 คัน ต่ำกว่าเป้า 2 · Service ทำได้ดี CSAT 4.7', done:true,
      actions:[
        { task:'วิเคราะห์ Lost Deals สัปดาห์ที่แล้ว', owner:'ผจก.ขาย', done:true },
        { task:'จัดโปรกระตุ้นปลายเดือน', owner:'การตลาด', done:false },
        { task:'ขอใบเสนอราคาผ้าไมโครไฟเบอร์ใหม่', owner:'บริการ', done:false },
      ] },
    { id:'M003', title:'รีวิวงบเดือน + วางแผนเดือนหน้า', type:'monthly', date:addDaysISO(3), time:'14:00', attendees:'เจ้าของ + ผู้จัดการ', notes:'', done:false, actions:[] },
  ]
  teamMeetings.forEach(m => { if (!demoCol('team_meetings')[m.id]) demoCol('team_meetings')[m.id] = m })


  // Mood survey responses (หน้า /hr/mood-survey) — วันที่อิงวันปัจจุบันเพื่อให้หน้าแสดงข้อมูลสดเสมอ
  const moodResponses = [
    { id:'MR001', staff:'นภา มีสุข', dept:'ฝ่ายขาย', date:addDaysISO(0), score:4, note:'ยอดขายดี แต่งานเอกสารเยอะ' },
    { id:'MR002', staff:'สมชาย วิเศษ', dept:'ฝ่ายบริการ', date:addDaysISO(0), score:3, note:'ช่างขาดวันนี้ งานหนักขึ้น' },
    { id:'MR003', staff:'มาลี จันทร์ดี', dept:'ฝ่ายการตลาด', date:addDaysISO(0), score:5, note:'แคมเปญสำเร็จ ทีมสนุก!' },
    { id:'MR004', staff:'วิชัย รุ่งเรือง', dept:'ฝ่ายขาย', date:addDaysISO(0), score:2, note:'เป้าสูงมาก กดดัน' },
    { id:'MR005', staff:'รัชนี สุขใจ', dept:'ฝ่าย HR', date:addDaysISO(0), score:4, note:'' },
    { id:'MR006', staff:'อรุณ วิชิต', dept:'ฝ่ายการเงิน', date:addDaysISO(-1), score:3, note:'ปิดงบล่าช้า' },
    { id:'MR007', staff:'สุดา ภักดี', dept:'ฝ่ายขาย', date:addDaysISO(-1), score:5, note:'ปิดดีลใหม่ 3 คัน' },
  ]
  moodResponses.forEach(r => { if (!demoCol('mood_responses')[r.id]) demoCol('mood_responses')[r.id] = r })


  // Succession plans (หน้า /hr/succession)
  const successionPlans = [
    { id:'SP001', role:'ผู้จัดการฝ่ายขาย', current:{ name:'คุณสมชาย วงศ์ดี', tenure:'8 ปี', risk:'medium' }, successors:[
      { name:'คุณวิชัย ใจดี', readiness:'ready', dept:'เซลส์', gaps:'ทักษะบริหารทีม' },
      { name:'คุณนิภา สมบัติ', readiness:'1yr', dept:'เซลส์', gaps:'ประสบการณ์จัดการ Fleet' },
    ] },
    { id:'SP002', role:'หัวหน้าช่าง', current:{ name:'คุณประเสริฐ ดีมาก', tenure:'12 ปี', risk:'high' }, successors:[
      { name:'คุณธนพล ช่างเก่ง', readiness:'1yr', dept:'ช่าง', gaps:'ใบรับรอง EV, ทักษะบริหาร' },
      { name:'คุณอนุชา ซ่อมดี', readiness:'2yr', dept:'ช่าง', gaps:'ประสบการณ์ BP, การจัดการงบ' },
    ] },
    { id:'SP003', role:'ผู้จัดการการเงิน', current:{ name:'คุณมาลี บัญชีดี', tenure:'5 ปี', risk:'low' }, successors:[
      { name:'คุณสุดา เลขสวย', readiness:'2yr', dept:'บัญชี', gaps:'ระบบ ERP, การรายงานผู้บริหาร' },
    ] },
    { id:'SP004', role:'ผู้จัดการการตลาด', current:{ name:'คุณวิไล สวยงาม', tenure:'3 ปี', risk:'medium' }, successors:[] },
  ]
  successionPlans.forEach(p => { if (!demoCol('succession_plans')[p.id]) demoCol('succession_plans')[p.id] = p })


  // HR extras — Leave requests (หน้า /hr/leave) — fields match Leave.js exactly
  const leaveRequests = [
    { id:'L001', staff:'อรนุช สายใจ', type:'annual', from:'2025-06-20', to:'2025-06-22', days:3, reason:'ท่องเที่ยวต่างจังหวัด', status:'approved', approvedBy:'ทวีศักดิ์', createdAt: new Date(Date.now()-86400000*10).toISOString() },
    { id:'L002', staff:'วิชาญ มีโชค', type:'sick', from: new Date().toISOString().slice(0,10), to: new Date().toISOString().slice(0,10), days:1, reason:'มีไข้ไปพบแพทย์', status:'pending', approvedBy:null, createdAt: new Date(Date.now()-3600000*2).toISOString() },
    { id:'L003', staff:'ธีรยุทธ เก่งกาจ', type:'personal', from:'2025-06-15', to:'2025-06-15', days:1, reason:'ต่อใบอนุญาตขับขี่', status:'pending', approvedBy:null, createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'L004', staff:'สมหมาย รักงาน', type:'personal', from:'2025-07-01', to:'2025-07-03', days:3, reason:'งานแต่งงานของญาติ', status:'pending', approvedBy:null, createdAt: new Date(Date.now()-86400000*7).toISOString() },
    { id:'L005', staff:'นภา จันทร์งาม', type:'annual', from:'2025-05-26', to:'2025-05-30', days:5, reason:'วันหยุดยาว', status:'approved', approvedBy:'ทวีศักดิ์', createdAt: new Date(Date.now()-86400000*20).toISOString() },
  ]
  leaveRequests.forEach(l => { if (!demoCol('leave_requests')[l.id]) demoCol('leave_requests')[l.id] = l })


  // ── HR Extras ──
  const surveys = [
    { id:'sv1', staffId:'s1', staffName:'อรนุช เซลส์ดี', mood:5, category:'งาน', comment:'ชอบงาน ทีมดี', date: new Date().toISOString().slice(0,10), anonymous:false, createdAt: new Date().toISOString() },
    { id:'sv2', staffId:'s2', staffName:'วิชัย ขายเก่ง', mood:3, category:'สภาพแวดล้อม', comment:'เครียดช่วงปลายเดือน', date: new Date().toISOString().slice(0,10), anonymous:false, createdAt: new Date().toISOString() },
  ]
  surveys.forEach(s => { if (!demoCol('surveys')[s.id]) demoCol('surveys')[s.id] = s })


  // Performance scorecards (หน้า /hr/performance) — distinct from performance_reviews (used by /hr/performance-review)
  const performanceScorecards = [
    { id:'PS001', name:'อรนุช สายใจ', dept:'ฝ่ายขาย', role:'เซลส์', period:'Q2/2025',
      kpiScore:92, behaviorScore:88, attendanceScore:95, overallScore:91.7, rating:5,
      reviewer:'ผู้จัดการขาย', reviewDate:'2025-06-01', goals:'ปิดยอด 15 คัน/เดือน', nextGoals:'เป้า 18 คัน/เดือน Q3',
      strengths:'ทักษะการนำเสนอดีเยี่ยม ลูกค้าชอบมาก', improvements:'ต้องพัฒนาการติดตามลูกค้าหลังการขาย',
      salary_adjustment:8, bonus_multiplier:1.5 },
    { id:'PS002', name:'วิชาญ ช่างซ่อม', dept:'ศูนย์บริการ', role:'ช่างอาวุโส', period:'Q2/2025',
      kpiScore:85, behaviorScore:90, attendanceScore:100, overallScore:87.5, rating:4,
      reviewer:'หัวหน้าช่าง', reviewDate:'2025-06-02', goals:'จำนวนงาน 120 job/เดือน',
      nextGoals:'เป้า 140 job/เดือน', strengths:'แม่นยำ รวดเร็ว', improvements:'ทักษะ EV Battery ต้องพัฒนา',
      salary_adjustment:5, bonus_multiplier:1.2 },
    { id:'PS003', name:'นิภา บัญชีดี', dept:'การเงิน', role:'นักบัญชี', period:'Q2/2025',
      kpiScore:78, behaviorScore:82, attendanceScore:90, overallScore:80.5, rating:3,
      reviewer:'CFO', reviewDate:'2025-06-03', goals:'ปิดงบเดือนภายใน 5 วัน',
      nextGoals:'ระบบ automated report', strengths:'ละเอียดรอบคอบ', improvements:'ความเร็วการทำงาน',
      salary_adjustment:3, bonus_multiplier:1.0 },
    { id:'PS004', name:'สมชาย คลังสินค้า', dept:'คลังสินค้า', role:'คลังสินค้า', period:'Q2/2025',
      kpiScore:70, behaviorScore:75, attendanceScore:85, overallScore:73.3, rating:2,
      reviewer:'ผู้จัดการ', reviewDate:'2025-06-04', goals:'stock accuracy 99%',
      nextGoals:'ใช้ระบบ Barcode scan ครบ', strengths:'ขยันทำงาน', improvements:'ความถูกต้องในการนับสต็อก',
      salary_adjustment:2, bonus_multiplier:0.8 },
  ]
  performanceScorecards.forEach(p => { if (!demoCol('performance_scorecards')[p.id]) demoCol('performance_scorecards')[p.id] = p })


  // Shift schedules (หน้า /hr/shift-schedule) — one doc per staff+date assignment, seeded for the current week
  const ssWeekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d })()
}
