// Demo seed data — finance module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  const addDaysISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const now = new Date()

  // Sales (for Finance/Margin/Commission)
  const sales = [
    { id:'s1', date:'2025-03-15', custName:'ธีรพงศ์ แสงทอง', brand:'BYD', model:'Seal AWD', plate:'กข-1234 กรุงเทพ', salePrice:1299000, cost:1150000, finance:150000, insurance:28000, accessory:35000, discount:20000, salesName:'อรนุช เซลส์ดี', createdAt:'2025-03-15' },
    { id:'s2', date:'2025-03-20', custName:'อรนุช พรหมมา', brand:'MG', model:'MG4 X', plate:'คง-5678 เชียงใหม่', salePrice:949000, cost:840000, finance:95000, insurance:22000, accessory:15000, discount:10000, salesName:'วิชัย ขายเก่ง', createdAt:'2025-03-20' },
    { id:'s3', date:'2025-04-01', custName:'กิตติพงษ์ วรรณศิลป์', brand:'DEEPAL', model:'S7 Pro', plate:'งจ-9012 ขอนแก่น', salePrice:1479000, cost:1320000, finance:200000, insurance:35000, accessory:60000, discount:30000, salesName:'อรนุช เซลส์ดี', createdAt:'2025-04-01' },
    { id:'s4', date:'2025-04-10', custName:'พิมพ์ชนก ทองสุข', brand:'NETA', model:'V II 400', plate:'จด-3456 กรุงเทพ', salePrice:769000, cost:680000, finance:80000, insurance:18000, accessory:12000, discount:5000, salesName:'วิชัย ขายเก่ง', createdAt:'2025-04-10' },
  ]
  sales.forEach(s => { if (!demoCol('sales')[s.id]) demoCol('sales')[s.id] = s })


  // Commissions
  const comms = [
    { id:'c1', salesName:'อรนุช เซลส์ดี', month:'2025-03', carsSold:2, salePriceTotal:2778000, financeTotal:350000, insuranceTotal:63000, accessoryTotal:95000, status:'paid', paidAt:'2025-04-05' },
    { id:'c2', salesName:'วิชัย ขายเก่ง', month:'2025-03', carsSold:1, salePriceTotal:949000, financeTotal:95000, insuranceTotal:22000, accessoryTotal:15000, status:'pending', paidAt:'' },
    { id:'c3', salesName:'อรนุช เซลส์ดี', month:'2025-04', carsSold:1, salePriceTotal:1479000, financeTotal:200000, insuranceTotal:35000, accessoryTotal:60000, status:'pending', paidAt:'' },
    { id:'c4', salesName:'วิชัย ขายเก่ง', month:'2025-04', carsSold:1, salePriceTotal:769000, financeTotal:80000, insuranceTotal:18000, accessoryTotal:12000, status:'pending', paidAt:'' },
  ]
  comms.forEach(c => { if (!demoCol('commissions')[c.id]) demoCol('commissions')[c.id] = c })


  // Insurance policies
  const policies = [
    { id:'ins1', policyNo:'INS-2025-001', custName:'ธีรพงศ์ แสงทอง', brand:'BYD', model:'Seal AWD', plate:'กข-1234 กรุงเทพ', insurer:'เมืองไทยประกันภัย', type:'ชั้น 1', premium:28000, startDate:'2025-03-15', endDate:'2026-03-14', status:'active', salesName:'อรนุช เซลส์ดี', commission:5600 },
    { id:'ins2', policyNo:'INS-2025-002', custName:'อรนุช พรหมมา', brand:'MG', model:'MG4 X', plate:'คง-5678 เชียงใหม่', insurer:'วิริยะประกันภัย', type:'ชั้น 1', premium:22000, startDate:'2025-03-20', endDate:'2026-03-19', status:'active', salesName:'วิชัย ขายเก่ง', commission:4400 },
    { id:'ins3', policyNo:'INS-2024-088', custName:'สมชาย มีทรัพย์', brand:'Honda', model:'Civic', plate:'กค-5555 กรุงเทพ', insurer:'กรุงเทพประกันภัย', type:'ชั้น 2+', premium:15000, startDate:'2024-06-01', endDate:'2025-05-31', status:'expiring', salesName:'วิชัย ขายเก่ง', commission:3000 },
    { id:'ins4', policyNo:'INS-2024-045', custName:'วิชัย สุขใจ', brand:'Toyota', model:'Camry', plate:'งฉ-1111 นนทบุรี', insurer:'เมืองไทยประกันภัย', type:'ชั้น 1', premium:32000, startDate:'2024-03-01', endDate:'2025-02-28', status:'expired', salesName:'อรนุช เซลส์ดี', commission:6400 },
  ]
  policies.forEach(p => { if (!demoCol('insurance_policies')[p.id]) demoCol('insurance_policies')[p.id] = p })


  // Cashier Desk (หน้า /finance/cashier)
  const cdAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  // Compliance Calendar (หน้า /finance/compliance-calendar)
  const complianceEventsDemo = [
    { id:'CC001', title:'ต่ออายุใบอนุญาตจำหน่ายรถยนต์', category:'ใบอนุญาต', dueDate:'2026-07-01', responsible:'ผู้จัดการโชว์รูม', status:'pending', desc:'ใบอนุญาตค้าขายรถยนต์ กรมการขนส่งทางบก — ต้องต่อทุกปี' },
    { id:'CC002', title:'ยื่นภาษีมูลค่าเพิ่ม (VAT) ประจำเดือน พ.ค.', category:'ภาษี', dueDate:'2026-06-17', responsible:'ฝ่ายบัญชี', status:'pending', desc:'ยื่น ภพ.30 ผ่านระบบ e-Filing สรรพากร' },
    { id:'CC003', title:'ประกันสังคม มิ.ย. 2569', category:'แรงงาน', dueDate:'2026-06-15', responsible:'HR', status:'done', desc:'นำส่งเงินสมทบประกันสังคมพนักงาน 28 คน' },
    { id:'CC004', title:'ต่ออายุใบอนุญาตสถานที่จอดรถ', category:'ใบอนุญาต', dueDate:'2026-08-01', responsible:'ผู้จัดการโชว์รูม', status:'pending', desc:'ใบอนุญาตจากเทศบาลสำหรับที่จอดรถลูกค้า' },
    { id:'CC005', title:'ยื่นภาษีนิติบุคคล (PND51)', category:'ภาษี', dueDate:'2026-08-31', responsible:'ฝ่ายบัญชี', status:'pending', desc:'ภ.ง.ด. 51 ภาษีนิติบุคคลครึ่งปีแรก' },
    { id:'CC006', title:'ต่อใบอนุญาตติดตั้งป้ายโฆษณา', category:'ใบอนุญาต', dueDate:'2026-09-15', responsible:'Admin', status:'pending', desc:'ป้ายหน้าโชว์รูมและป้าย LED ฝ่าย Marketing' },
    { id:'CC007', title:'ต่อสัญญาเช่าอาคาร', category:'สัญญา', dueDate:'2026-12-31', responsible:'ผู้จัดการโชว์รูม', status:'pending', desc:'สัญญาเช่าอาคารโชว์รูม 3 ปี ครบกำหนดสิ้นปี' },
    { id:'CC008', title:'ยื่น ภ.ง.ด. 3, 53 เดือน พ.ค.', category:'ภาษี', dueDate:'2026-06-07', responsible:'ฝ่ายบัญชี', status:'done', desc:'ภาษีหัก ณ ที่จ่ายค่าบริการและเงินเดือนพนักงาน' },
  ]
  complianceEventsDemo.forEach(e => { if (!demoCol('compliance_events')[e.id]) demoCol('compliance_events')[e.id] = e })


  // Energy & Utility (หน้า /finance/energy)
  const energyReadingsDemo = [
    { id:'ER001', month:'ม.ค.', elec:42800, water:3200, net:2900, zone:{showroom:18000,service:14000,office:7200,parking:3600} },
    { id:'ER002', month:'ก.พ.', elec:39600, water:2900, net:2900, zone:{showroom:16500,service:13200,office:6800,parking:3100} },
    { id:'ER003', month:'มี.ค.', elec:44200, water:3400, net:2900, zone:{showroom:18800,service:14500,office:7100,parking:3800} },
    { id:'ER004', month:'เม.ย.', elec:51000, water:3800, net:2900, zone:{showroom:21200,service:16800,office:8200,parking:4800} },
    { id:'ER005', month:'พ.ค.', elec:53400, water:3900, net:3200, zone:{showroom:22100,service:17600,office:8700,parking:5000} },
    { id:'ER006', month:'มิ.ย.', elec:49800, water:3600, net:3200, zone:{showroom:20500,service:16200,office:8100,parking:5000} },
  ]
  energyReadingsDemo.forEach(r => { if (!demoCol('energy_readings')[r.id]) demoCol('energy_readings')[r.id] = r })


  // Financial Goals (หน้า /finance/goals)
  const financialGoalsDemo = [
    { id:'G001', title:'ยอดขายรถเดือนมิถุนายน', cat:'units', period:'รายเดือน', target:50, current:43, unit:'คัน' },
    { id:'G002', title:'รายได้รวมเดือนมิถุนายน', cat:'revenue', period:'รายเดือน', target:45000000, current:38500000, unit:'บาท' },
    { id:'G003', title:'กำไรสุทธิ Q2/2568', cat:'profit', period:'รายไตรมาส', target:8000000, current:6200000, unit:'บาท' },
    { id:'G004', title:'รายได้บริการ Q2/2568', cat:'service', period:'รายไตรมาส', target:3000000, current:2850000, unit:'บาท' },
    { id:'G005', title:'ยอดขายรวมปี 2568', cat:'units', period:'รายปี', target:600, current:241, unit:'คัน' },
    { id:'G006', title:'รายได้รวมปี 2568', cat:'revenue', period:'รายปี', target:500000000, current:212000000, unit:'บาท' },
  ]
  financialGoalsDemo.forEach(g => { if (!demoCol('financial_goals')[g.id]) demoCol('financial_goals')[g.id] = g })


  // Withholding Tax Certificates — ใบ 50 ทวิ (หน้า /finance/withholding-tax)
  const wtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Invoices — ใบแจ้งหนี้/ใบเสร็จ/ใบกำกับภาษี (หน้า /finance/invoice)
  const invoicesDemo = [
    { id:'D001', type:'invoice', no:'INV-2026-001', custName:'สมศักดิ์ เจริญสุข', custTax:'0105567012345', date:'2026-06-02', dueDate:'2026-06-17', items:[ { desc:'BYD Seal AWD', qty:1, unit:'คัน', price:1299000, vat:7 } ], status:'paid', paidDate:'2026-06-05', note:'' },
    { id:'D002', type:'invoice', no:'INV-2026-002', custName:'วิชัย เดินดี', custTax:'0105567098765', date:'2026-06-09', dueDate:'2026-06-24', items:[ { desc:'MG4 X', qty:1, unit:'คัน', price:1199000, vat:7 } ], status:'sent', note:'' },
    { id:'D003', type:'quotation', no:'QT-2026-005', custName:'ประภา สวยงาม', custTax:'', date:'2026-06-09', dueDate:'2026-06-23', items:[ { desc:'BYD Atto3 Standard', qty:1, unit:'คัน', price:899000, vat:7 }, { desc:'ฟิล์มกรองแสง', qty:1, unit:'ชุด', price:12000, vat:7 } ], status:'draft', note:'ขอใบเสนอราคาเพื่อขออนุมัติ' },
    { id:'D004', type:'receipt', no:'REC-2026-001', custName:'สมศักดิ์ เจริญสุข', custTax:'0105567012345', date:'2026-06-05', dueDate:'2026-06-05', items:[ { desc:'BYD Seal AWD', qty:1, unit:'คัน', price:1299000, vat:7 } ], status:'paid', paidDate:'2026-06-05', note:'' },
    { id:'D005', type:'invoice', no:'INV-2026-003', custName:'อนุชา รวยมาก', custTax:'', date:'2026-05-20', dueDate:'2026-06-04', items:[ { desc:'MG ZS EV', qty:1, unit:'คัน', price:1049000, vat:7 } ], status:'sent', note:'' },
  ]
  invoicesDemo.forEach(d => { if (!demoCol('invoices')[d.id]) demoCol('invoices')[d.id] = d })


  // Billing Runs — ระบบวางบิล (หน้า /finance/billing-run)
  const brAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Receipt Automation (หน้า /finance/receipt-auto)
  const autoReceiptsDemo = [
    { id:'AR001', number:'REC-2026-0541', customer:'สมชาย ใจดี', amount:1290000, type:'purchase', sent:true, channel:'email', date:'2026-06-14', status:'sent' },
    { id:'AR002', number:'REC-2026-0542', customer:'นภา สุขสม', amount:4500, type:'service', sent:true, channel:'line', date:'2026-06-14', status:'sent' },
    { id:'AR003', number:'REC-2026-0543', customer:'วิชัย ศรีดี', amount:8900, type:'service', sent:false, channel:'email', date:'2026-06-15', status:'pending' },
    { id:'AR004', number:'REC-2026-0544', customer:'กาญจนา ทอง', amount:15600, type:'insurance', sent:false, channel:'sms', date:'2026-06-15', status:'failed' },
    { id:'AR005', number:'REC-2026-0545', customer:'ประเสริฐ มั่น', amount:2100, type:'parts', sent:true, channel:'line', date:'2026-06-15', status:'sent' },
  ]
  autoReceiptsDemo.forEach(r => { if (!demoCol('auto_receipts')[r.id]) demoCol('auto_receipts')[r.id] = r })

  // Vendor Management (หน้า /finance/vendor)
  const vendorsDemo = [
    { id:'V001', name:'บริษัท ออโต้ พาร์ท จก.', category:'อะไหล่', contact:'คุณสมศักดิ์ 089-111-2233', payTerms:'30 วัน', ytdSpend:485000, rating:4.5, status:'active', lastOrder:'2026-06-10' },
    { id:'V002', name:'3M Thailand', category:'วัสดุซ่อมสี', contact:'คุณกมล 02-333-4455', payTerms:'15 วัน', ytdSpend:124000, rating:4.8, status:'active', lastOrder:'2026-06-08' },
    { id:'V003', name:'การไฟฟ้านครหลวง', category:'สาธารณูปโภค', contact:'-', payTerms:'ทันที', ytdSpend:38400, rating:5, status:'active', lastOrder:'2026-06-01' },
    { id:'V004', name:'ร้านเครื่องมือช่างครบครัน', category:'เครื่องมือ', contact:'คุณวิชัย 081-555-6677', payTerms:'15 วัน', ytdSpend:67500, rating:3.8, status:'active', lastOrder:'2026-05-20' },
    { id:'V005', name:'PTT น้ำมันหล่อลื่น', category:'น้ำมัน/สารหล่อลื่น', contact:'คุณปิยะ 02-666-7788', payTerms:'30 วัน', ytdSpend:95000, rating:4.2, status:'active', lastOrder:'2026-06-12' },
    { id:'V006', name:'บจก. ไทยทำความสะอาด', category:'บริการ', contact:'คุณอรุณ 086-999-0011', payTerms:'30 วัน', ytdSpend:24000, rating:4.0, status:'inactive', lastOrder:'2026-04-01' },
  ]
  vendorsDemo.forEach(v => { if (!demoCol('vendors')[v.id]) demoCol('vendors')[v.id] = v })


  // Finance applications (หน้า /finance/application)
  const financeApps = [
    { id:'FA001', custName:'สมศักดิ์ เจริญสุข', phone:'0812345678', vehicle:'DEEPAL S07', vehiclePrice:1299000, downPayment:200000, loanAmount:1099000, tenure:60, bank:'KBank', monthlyPayment:20420, status:'approved', submittedDate:'2026-06-01', approvedDate:'2026-06-02', rate:2.79, note:'', documents:['บัตรประชาชน','สลิปเงินเดือน','Statement 3 เดือน'] },
    { id:'FA002', custName:'วิชัย เดินดี', phone:'0834567890', vehicle:'AION Y Plus', vehiclePrice:1069000, downPayment:150000, loanAmount:919000, tenure:72, bank:'SCB', monthlyPayment:15700, status:'pending', submittedDate:'2026-06-09', approvedDate:null, rate:2.89, note:'รอเอกสารเพิ่มเติม', documents:['บัตรประชาชน','สลิปเงินเดือน'] },
    { id:'FA003', custName:'ประภา สวยงาม', phone:'0845678901', vehicle:'OMODA 5', vehiclePrice:899000, downPayment:100000, loanAmount:799000, tenure:84, bank:'Krungsri', monthlyPayment:11200, status:'submitted', submittedDate:'2026-06-09', approvedDate:null, rate:3.15, note:'', documents:['บัตรประชาชน'] },
    { id:'FA004', custName:'อนุชา รวยมาก', phone:'0856789012', vehicle:'NISSAN Almera', vehiclePrice:649000, downPayment:150000, loanAmount:499000, tenure:48, bank:'BBL', monthlyPayment:11800, status:'rejected', submittedDate:'2026-05-25', approvedDate:null, rate:0, note:'รายได้ไม่ผ่านเกณฑ์', documents:['บัตรประชาชน','สลิปเงินเดือน'] },
  ]
  financeApps.forEach(a => { if (!demoCol('finance_applications')[a.id]) demoCol('finance_applications')[a.id] = a })


  // Finance/insurance tracker (หน้า /finance/tracker)
  const financeTracker = [
    { id:'FT001', customerId:'', customerName:'วิชาญ มีโชค', phone:'081-234-5678', vehicleModel:'DEEPAL S07', vehiclePrice:1299000, downPayment:260000, loanAmount:1039000, bank:'Krungthai LEASE', term:60, monthlyPayment:20500, interestRate:2.75, status:'approved', submittedDate:'2026-06-08', approvedDate:'2026-06-15', conditions:'', salesperson:'อรนุช เซลส์ดี', notes:'อนุมัติเต็มจำนวน' },
    { id:'FT002', customerId:'', customerName:'อรนุช สาวสวย', phone:'082-345-6789', vehicleModel:'AION Y Plus', vehiclePrice:1069000, downPayment:200000, loanAmount:869000, bank:'Ayudhya Capital', term:60, monthlyPayment:16700, interestRate:2.99, status:'reviewing', submittedDate:'2026-06-20', approvedDate:null, conditions:'', salesperson:'วิชัย ขายเก่ง', notes:'รอผล 3-5 วันทำการ' },
    { id:'FT003', customerId:'', customerName:'ธีรยุทธ เก่งกาจ', phone:'083-456-7890', vehicleModel:'OMODA 5', vehiclePrice:899000, downPayment:90000, loanAmount:809000, bank:'TISCO Financial', term:72, monthlyPayment:13300, interestRate:3.15, status:'conditional', submittedDate:'2026-06-17', approvedDate:null, conditions:'ต้องมีผู้ค้ำประกัน หรือเพิ่มดาวน์เป็น 180,000 บาท', salesperson:'อรนุช เซลส์ดี', notes:'' },
    { id:'FT004', customerId:'', customerName:'สมใจ รักรถ', phone:'084-567-8901', vehicleModel:'NISSAN Almera', vehiclePrice:649000, downPayment:130000, loanAmount:519000, bank:'BBL Hire Purchase', term:60, monthlyPayment:10200, interestRate:2.85, status:'preparing', submittedDate:null, approvedDate:null, conditions:'', salesperson:'วิชัย ขายเก่ง', notes:'รอเอกสารบัตรประชาชน + สลิปเงินเดือน' },
  ]
  financeTracker.forEach(a => { if (!demoCol('finance_tracker')[a.id]) demoCol('finance_tracker')[a.id] = a })


  // Payroll records (หน้า /finance/payroll-detail)
  const payrollRecords = [
    { id:'S001', name:'วิชัย ยอดขาย', dept:'ฝ่ายขาย', base:25000, commission:18500, bonus:5000, ot:0, tax:2180, sso:750, deductions:500, status:'paid' },
    { id:'S002', name:'สุดา มาดี', dept:'ฝ่ายขาย', base:22000, commission:12000, bonus:0, ot:1500, tax:1680, sso:750, deductions:0, status:'paid' },
    { id:'S003', name:'ธนา เก่ง', dept:'ฝ่ายขาย', base:22000, commission:8500, bonus:0, ot:0, tax:1360, sso:750, deductions:0, status:'approved' },
    { id:'S004', name:'มานี HR', dept:'HR', base:28000, commission:0, bonus:3000, ot:0, tax:1550, sso:750, deductions:0, status:'approved' },
    { id:'S005', name:'วิทยา ช่าง', dept:'บริการ', base:20000, commission:0, bonus:2500, ot:3200, tax:1270, sso:750, deductions:300, status:'draft' },
    { id:'S006', name:'ปทิตา Marketing', dept:'การตลาด', base:26000, commission:0, bonus:4000, ot:0, tax:1500, sso:750, deductions:0, status:'draft' },
  ]
  payrollRecords.forEach(s => { if (!demoCol('payroll_records')[s.id]) demoCol('payroll_records')[s.id] = s })


  // Refund requests (หน้า /finance/refund — คำขอคืนเงินทั่วไป นอกเหนือจากคืนเงินจองที่ลิงค์จากใบจอง)
  const refundRequests = [
    { id:'RF001', customer:'สุดา ภักดี', type:'คืนส่วนเกิน', amount:8500, reason:'จ่ายเกิน ค่าซ่อม', status:'pending', date:addDaysISO(-2), approvedBy:'', txDate:'' },
    { id:'RF002', customer:'พิมพ์ สวัสดี', type:'คืนมัดจำป้ายแดง', amount:3000, reason:'คืนป้ายแดงหลังได้ป้ายขาว', status:'approved', date:addDaysISO(-4), approvedBy:'ผู้จัดการ A', txDate:'' },
    { id:'RF003', customer:'สมชาย ใจดี', type:'คืนส่วนเกิน', amount:12000, reason:'คำนวณค่าซ่อมผิด', status:'transferred', date:addDaysISO(-8), approvedBy:'ผู้จัดการ B', txDate:addDaysISO(-6) },
  ]
  refundRequests.forEach(r => { if (!demoCol('refund_requests')[r.id]) demoCol('refund_requests')[r.id] = r })


  // Finance extras
  const amAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // ── Finance Extras ──
  const vendorPayments = [
    { id:'vp1', vendor:'BYD Thailand', type:'stock', amount:5750000, dueDate:'2026-07-15', status:'pending', invoiceNo:'INV-2026-001', note:'สต็อกรถ 5 คัน', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'vp2', vendor:'สยาม อีวี ชาร์จเจอร์', type:'equipment', amount:180000, dueDate:'2026-07-01', status:'paid', invoiceNo:'INV-2026-002', note:'ติดตั้ง Charger 2 จุด', createdAt: new Date(Date.now()-86400000*10).toISOString() },
  ]
  vendorPayments.forEach(v => { if (!demoCol('vendor_payments')[v.id]) demoCol('vendor_payments')[v.id] = v })


  // Finance banks (for loan calculator)
  const financeBanks = [
    { id:'fb1', name:'กรุงเทพ (BAY)', minRate:1.99, maxRate:3.49, minDown:10, maxTenure:84, logo:'BAY', popular:true },
    { id:'fb2', name:'ไทยพาณิชย์ (SCB)', minRate:2.09, maxRate:3.59, minDown:10, maxTenure:84, logo:'SCB', popular:true },
    { id:'fb3', name:'กสิกรไทย (KBANK)', minRate:2.19, maxRate:3.79, minDown:15, maxTenure:72, logo:'KBANK', popular:true },
    { id:'fb4', name:'ทหารไทยธนชาต (TTB)', minRate:2.29, maxRate:3.99, minDown:10, maxTenure:84, logo:'TTB', popular:false },
    { id:'fb5', name:'ออมสิน (GSB)', minRate:1.89, maxRate:2.99, minDown:20, maxTenure:72, logo:'GSB', popular:false },
  ]
  financeBanks.forEach(b => { if (!demoCol('finance_banks')[b.id]) demoCol('finance_banks')[b.id] = b })


  // Finance rate sheets — ตารางดอกเบี้ยไฟแนนซ์ (จากอัปโหลดรูปภาพ + ยืนยันโดยผู้ใช้ หรือกรอกเอง)
  const financeRateSheets = [
    { id:'frs1', bank:'SCB', campaign:'ดอกเบี้ยพิเศษ Q3', brand:'DEEPAL', model:'S07', year:2026, month:'กรกฎาคม',
      dateFrom:'2026-07-01', dateTo:'2026-07-31', conditions:'ดาวน์ขั้นต่ำ 20% ผ่อนสูงสุด 60 งวด ดอกเบี้ย 2.99%/ปี',
      financeCommission:8000, extraPayment:2000, subsidy:15000, imageUrl:'', status:'confirmed', createdAt: new Date(Date.now()-86400000*3).toISOString() },
    { id:'frs2', bank:'KBANK', campaign:'ฟรีดาวน์ EV', brand:'AION', model:'Y Plus', year:2026, month:'กรกฎาคม',
      dateFrom:'2026-07-01', dateTo:'2026-08-15', conditions:'ฟรีดาวน์ ผ่อนสูงสุด 72 งวด ดอกเบี้ย 3.25%/ปี ต้องมีสลิปเงินเดือน',
      financeCommission:6500, extraPayment:0, subsidy:20000, imageUrl:'', status:'confirmed', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'frs3', bank:'TISCO', campaign:'ดอกเบี้ย 0% 24 เดือนแรก', brand:'OMODA & JAECOO', model:'Jaecoo J7', year:2026, month:'มิถุนายน',
      dateFrom:'2026-06-01', dateTo:'2026-06-30', conditions:'ดอกเบี้ย 0% 24 เดือนแรก จากนั้น 3.5%/ปี ดาวน์ 25%',
      financeCommission:7000, extraPayment:1500, subsidy:10000, imageUrl:'', status:'confirmed', createdAt: new Date(Date.now()-86400000*10).toISOString() },
    { id:'frs4', bank:'BAY', campaign:'โปรฤดูฝน', brand:'SUZUKI', model:'Swift', year:2026, month:'กรกฎาคม',
      dateFrom:'2026-07-01', dateTo:'2026-07-31', conditions:'ดาวน์ 15% ผ่อน 60 งวด ดอกเบี้ย 2.49%/ปี รอตรวจสอบยอด Extra จากภาพ',
      financeCommission:0, extraPayment:0, subsidy:0, imageUrl:'', status:'pending', createdAt: new Date(Date.now()-3600000*6).toISOString() },
  ]
  financeRateSheets.forEach(r => { if (!demoCol('finance_rate_sheets')[r.id]) demoCol('finance_rate_sheets')[r.id] = r })


  // Installment Plans — ติดตามงวดผ่อนลูกค้าที่ซื้อตรง (หน้า /finance/installment)
  const installmentPlans = [
    { id:'INS001', customer:'สมชาย ใจดี',    model:'BYD Atto 3',   total:1099000, paid:4,  totalInst:36, monthly:30528, nextDate:'2026-07-20', status:'current',   overdue:0, paidHistory:[] },
    { id:'INS002', customer:'นภา สุขใจ',     model:'BYD Seal AWD', total:1699000, paid:12, totalInst:60, monthly:31648, nextDate:'2026-08-05', status:'current',   overdue:0, paidHistory:[] },
    { id:'INS003', customer:'วิชัย ดีมาก',   model:'BYD Han',      total:2099000, paid:2,  totalInst:48, monthly:47250, nextDate:'2026-06-10', status:'overdue',   overdue:34, paidHistory:[] },
    { id:'INS004', customer:'มาลี รุ่งเรือง', model:'MG ZS EV',     total:799000,  paid:24, totalInst:36, monthly:24361, nextDate:'2026-07-20', status:'current',   overdue:0, paidHistory:[] },
    { id:'INS005', customer:'อรุณ วิชิต',    model:'BYD Dolphin',  total:899000,  paid:36, totalInst:36, monthly:27222, nextDate:'',           status:'completed', overdue:0, paidHistory:[] },
  ]
  installmentPlans.forEach(p => { if (!demoCol('installment_plans')[p.id]) demoCol('installment_plans')[p.id] = p })


  // EV Charging Sessions — ข้อมูลกลางร่วมกันของหน้า Charging Revenue (/finance/charging-revenue)
  // และ Charging Cost (/finance/charging-cost) — สร้างแบบสุ่มกึ่งกำหนด (seeded PRNG) ให้ได้ dataset
  // ที่เสมอต้นเสมอปลายทุกครั้งที่รัน demo แต่ยังดูสมจริงและมีแนวโน้มตามเดือน
  //
  // สคีมาต่อ 1 session:
  //   date (YYYY-MM-DD), time (HH:MM), stationId, stationName, vehicle,
  //   kwh, durationMin, touPeriod ('peak'|'offpeak'), useType ('public'|'test_drive'|'free_customer'|'company_car'|'delivery_prep'),
  //   rate (บาท/kWh ที่คิดลูกค้า — 0 ถ้าไม่ใช่ public), revenue (บาท — 0 ถ้าไม่ใช่ public),
  //   cost (บาท ต้นทุนไฟฟ้าตามเรท TOU — คำนวณทุก session ไม่ว่าประเภทไหน), status ('done'|'charging')
  //
  // Charging Revenue = กรองเฉพาะ useType==='public' (มุมมองรายได้)
  // Charging Cost     = รวมทุก useType (มุมมองต้นทุนไฟฟ้ารวม แยก Peak/Off-Peak + แยกตามการใช้งาน)
  const csRatePeak = 5.8
  const csRateOffpeak = 2.6
  const csStations = [
    { id:'CS1', name:'Charger A (150kW)', rate:7.50 },
    { id:'CS2', name:'Charger B (50kW)',  rate:6.80 },
    { id:'CS3', name:'AC Bay 1 (22kW)',   rate:4.50 },
    { id:'CS4', name:'AC Bay 2 (22kW)',   rate:4.50 },
  ]
  const csVehicles = ['BYD Atto 3','BYD Seal AWD','BYD Dolphin','BYD Han','MG4 X','MG ZS EV','NETA V II','DEEPAL S7','AION Y Plus','OMODA 5']
  const csUseTypes = [
    { key:'public',        w:11 },
    { key:'test_drive',    w:3 },
    { key:'free_customer', w:3 },
    { key:'company_car',   w:2 },
    { key:'delivery_prep', w:1 },
  ]
  function csPickUseType(rng) {
    const total = csUseTypes.reduce((s, x) => s + x.w, 0)
    let r = rng() * total
    for (const item of csUseTypes) { r -= item.w; if (r <= 0) return item.key }
    return csUseTypes[csUseTypes.length - 1].key
  }
  // mulberry32 — seeded PRNG กำหนดค่าตายตัว (deterministic) ให้ demo data เหมือนเดิมทุกครั้งที่รัน
  function csMakeRng(seed) {
    let a = seed
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const csRng = csMakeRng(42)
  const chargingSessions = []
  for (let mIdx = 0; mIdx < 6; mIdx++) {
    const monthsAgo = 5 - mIdx // 5 (เก่าสุด) ... 0 (เดือนปัจจุบัน)
    const count = 14 + mIdx * 3 // แนวโน้มขาขึ้น 14 → 29 session/เดือน
    // เดือนหลังๆ ตั้งใจย้ายการใช้งานภายใน (non-public) ไปชาร์จช่วง Off-Peak มากขึ้น (สอดคล้องกับ insight ของ LAMI)
    const offpeakBias = 0.5 + mIdx * 0.06
    for (let i = 0; i < count; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
      let day = 1 + Math.floor(csRng() * daysInMonth)
      if (monthsAgo === 0) day = Math.min(day, now.getDate()) // เดือนปัจจุบัน ห้ามเกินวันนี้
      const useType = csPickUseType(csRng)
      let hour
      if (useType === 'public') {
        hour = 8 + Math.floor(csRng() * 12) // ลูกค้าจ่ายเงินมาชาร์จช่วงกลางวัน 08:00–19:59
      } else if (csRng() < offpeakBias) {
        hour = [22, 23, 0, 1, 2, 3, 4, 5][Math.floor(csRng() * 8)] // งานภายใน ย้ายไปชาร์จกลางคืน
      } else {
        hour = 9 + Math.floor(csRng() * 9) // 09:00–17:59
      }
      const minute = Math.floor(csRng() * 60)
      const touPeriod = (hour >= 9 && hour < 22) ? 'peak' : 'offpeak'
      const station = csStations[Math.floor(csRng() * csStations.length)]
      const isFast = station.rate >= 6.8
      const kwh = Math.round((isFast ? 20 + csRng() * 45 : 8 + csRng() * 20) * 10) / 10
      const durationMin = Math.round(kwh / (isFast ? 1.1 : 0.35))
      const vehicle = csVehicles[Math.floor(csRng() * csVehicles.length)]
      const rate = useType === 'public' ? station.rate : 0
      const revenue = useType === 'public' ? Math.round(kwh * rate) : 0
      const cost = Math.round(kwh * (touPeriod === 'peak' ? csRatePeak : csRateOffpeak))
      chargingSessions.push({
        id: `CHG-${mIdx}-${i}`,
        date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day).toISOString().slice(0, 10),
        time: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'),
        stationId: station.id, stationName: station.name,
        vehicle, kwh, durationMin, touPeriod, useType, rate, revenue, cost,
        status: 'done',
      })
    }
  }
  // Session ของ "วันนี้" ยึดตาม TODAY_SESSIONS เดิม — ให้แน่ใจว่าพาเนล "Session วันนี้" มีข้อมูลแสดงเสมอ
  const csTodayStr = now.toISOString().slice(0, 10)
  const csTodaySessions = [
    { time:'08:12', stationId:'CS1', vehicle:'BYD Atto 3',   kwh:32.5, durationMin:28, hour:8,  status:'done' },
    { time:'09:45', stationId:'CS3', vehicle:'MG ZS EV',     kwh:18.2, durationMin:82, hour:9,  status:'done' },
    { time:'10:30', stationId:'CS2', vehicle:'BYD Seal AWD', kwh:55.1, durationMin:66, hour:10, status:'charging' },
    { time:'11:00', stationId:'CS4', vehicle:'BYD Dolphin',  kwh:12.4, durationMin:34, hour:11, status:'charging' },
  ]
  csTodaySessions.forEach((s, i) => {
    const station = csStations.find(x => x.id === s.stationId)
    const touPeriod = (s.hour >= 9 && s.hour < 22) ? 'peak' : 'offpeak'
    chargingSessions.push({
      id: `CHG-today-${i}`,
      date: csTodayStr, time: s.time,
      stationId: station.id, stationName: station.name,
      vehicle: s.vehicle, kwh: s.kwh, durationMin: s.durationMin,
      touPeriod, useType: 'public', rate: station.rate, revenue: Math.round(s.kwh * station.rate),
      cost: Math.round(s.kwh * (touPeriod === 'peak' ? csRatePeak : csRateOffpeak)),
      status: s.status,
    })
  })
  chargingSessions.forEach(s => { if (!demoCol('charging_sessions')[s.id]) demoCol('charging_sessions')[s.id] = s })

}
