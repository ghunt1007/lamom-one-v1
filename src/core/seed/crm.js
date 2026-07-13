// Demo seed data — crm module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  const now = new Date()

  // Customers — unified collection (formerly split into `customers` + `leads`).
  // stage: 'lead' (no phone/lineId yet) → 'pp' (got phone/LINE) → 'booking' (real bookingId linked below)
  // → 'delivered' (linked booking status = ส่งมอบแล้ว). isLost/lostReason is an overlay flag, not a stage.
  const customers = [
    // booking — linked to real seeded bookings below (bk1, bk6)
    { id:'cu1', firstName:'ธีรพงศ์', lastName:'แสงทอง', phone:'0812345678', lineId:'@theer', email:'theer@email.com', interestedModel:'DEEPAL S07', budget:1299000, source:'facebook', stage:'booking', stageChangedAt:'2026-06-20', temperature:'hot', vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'อรนุช เซลส์ดี', bookingId:'bk1', notes:'ทักเพจสอบถามตอนแรก ตอนนี้จองแล้วรอส่งมอบ', tags:[], createdAt: new Date(Date.now()-86400000*20).toISOString() },
    { id:'cu2', firstName:'บิ่ง', lastName:'ชิ้นเทียม', phone:'0895556667', lineId:'', email:'', interestedModel:'DEEPAL Q05 Ultra AWD', budget:1099000, source:'walk-in', stage:'booking', stageChangedAt:'2026-06-27', temperature:'warm', vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'ใบเฟิน', bookingId:'bk6', notes:'รอรถเข้าไม่เกิน 3 วัน', tags:[], createdAt: new Date(Date.now()-86400000*8).toISOString() },
    // delivered — linked to real seeded bookings below (bk8, bk9)
    { id:'cu3', firstName:'สุภาพร', lastName:'ใจดี', phone:'0856789012', lineId:'@supaporn', email:'', interestedModel:'AION ES 2026 Ultra', budget:899000, source:'referral', stage:'delivered', stageChangedAt:'2026-05-28', temperature:null, vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'อรนุช เซลส์ดี', bookingId:'bk8', notes:'ส่งมอบแล้ว 28 พ.ค. — ควรโทรเช็คความพึงพอใจ', tags:[], createdAt: new Date(Date.now()-86400000*50).toISOString() },
    { id:'cu4', firstName:'ประเสริฐ', lastName:'ทองแท้', phone:'0898887776', lineId:'', email:'', interestedModel:'OMODA 5 EV', budget:769000, source:'walk-in', stage:'delivered', stageChangedAt:'2026-05-25', temperature:null, vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'ปวีณา สายขาย', bookingId:'bk9', notes:'ส่งมอบแล้ว 25 พ.ค.', tags:[], createdAt: new Date(Date.now()-86400000*55).toISOString() },
    // pp (prospect) — got phone/LINE, not booked yet
    { id:'cu5', firstName:'กิตติพงษ์', lastName:'วรรณศิลป์', phone:'0823456789', lineId:'@kitti', email:'', interestedModel:'DEEPAL S7', budget:1500000, source:'tiktok', stage:'pp', stageChangedAt: new Date(Date.now()-86400000*2).toISOString(), temperature:'warm', vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'sales2', bookingId:null, notes:'ดูคลิป TikTok แล้วสนใจมาก ได้เบอร์แล้วแต่ยังไม่จอง', tags:[], createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'cu6', firstName:'พิมพ์ชนก', lastName:'ทองสุข', phone:'0834567890', lineId:'', email:'', interestedModel:'BYD Seal', budget:1300000, source:'walk-in', stage:'pp', stageChangedAt: new Date(Date.now()-86400000*3).toISOString(), temperature:'hot', vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'sales1', bookingId:null, notes:'เข้ามาโชว์รูมเอง ทดลองขับแล้วชอบมาก', tags:[], createdAt: new Date(Date.now()-86400000*3).toISOString() },
    { id:'cu7', firstName:'มานี', lastName:'รักดี', phone:'0811111111', lineId:'', email:'manee@gmail.com', interestedModel:'NETA V', budget:0, source:'line', stage:'pp', stageChangedAt: new Date(Date.now()-86400000*10).toISOString(), temperature:'cold', vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'sales2', bookingId:null, notes:'', tags:[], createdAt: new Date(Date.now()-86400000*10).toISOString() },
    { id:'cu8', firstName:'วิชัย', lastName:'สุขใจ', phone:'0822222222', lineId:'@wichai', email:'', interestedModel:'BYD Atto 3', budget:0, source:'referral', stage:'pp', stageChangedAt: new Date(Date.now()-86400000*30).toISOString(), temperature:'warm', vip:true, isLost:false, lostReason:'', lostAt:null, assignedTo:'sales1', bookingId:null, notes:'ลูกค้าประจำ ซื้อซ้ำหลายครั้ง', tags:['VIP','ลูกค้าประจำ'], createdAt: new Date(Date.now()-86400000*30).toISOString() },
    // pp + isLost — lost-deal overlay on an already-contacted customer
    { id:'cu9', firstName:'วรพจน์', lastName:'ศรีสมบัติ', phone:'0845678901', lineId:'@worapot', email:'', interestedModel:'NETA V', budget:700000, source:'referral', stage:'pp', stageChangedAt: new Date(Date.now()-86400000*7).toISOString(), temperature:'cold', vip:false, isLost:true, lostReason:'ราคาแพงกว่าคู่แข่ง', lostAt: new Date(Date.now()-86400000*7).toISOString(), assignedTo:'sales2', bookingId:null, notes:'เลือกไปซื้อที่อื่น ราคาถูกกว่า 5,000 บาท', tags:[], createdAt: new Date(Date.now()-86400000*7).toISOString() },
    { id:'cu13', firstName:'ปิยะ', lastName:'มานะชัย', phone:'0812340007', lineId:'', email:'', interestedModel:'MG4', budget:850000, source:'facebook', stage:'pp', stageChangedAt: new Date(Date.now()-86400000*7).toISOString(), temperature:'cold', vip:false, isLost:true, lostReason:'ราคาสูงเกินไป', lostAt: new Date(Date.now()-86400000*7).toISOString(), assignedTo:'sales1', bookingId:null, notes:'', tags:[], createdAt: new Date(Date.now()-86400000*7).toISOString() },
    { id:'cu14', firstName:'นภา', lastName:'ฟ้าใส', phone:'0833333333', lineId:'', email:'', interestedModel:'DEEPAL S7', budget:0, source:'tiktok', stage:'pp', stageChangedAt: new Date(Date.now()-86400000*15).toISOString(), temperature:'cold', vip:false, isLost:true, lostReason:'เงียบหายไป ไม่ตอบกลับ', lostAt: new Date(Date.now()-86400000*15).toISOString(), assignedTo:'sales2', bookingId:null, notes:'', tags:[], createdAt: new Date(Date.now()-86400000*15).toISOString() },
    // lead — first contact via page/LINE, no phone/LINE ID captured yet
    { id:'cu10', firstName:'ปิยะดา', lastName:'รักเรียน', phone:'', lineId:'', email:'', interestedModel:'BYD Atto 3', budget:0, source:'facebook', stage:'lead', stageChangedAt: new Date(Date.now()-3600000*3).toISOString(), temperature:null, vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'', bookingId:null, notes:'ทักเพจถามราคา Atto3 ยังไม่ได้เบอร์ติดต่อ', tags:[], createdAt: new Date(Date.now()-3600000*3).toISOString() },
    { id:'cu11', firstName:'ณัฐพล', lastName:'วงศ์สุข', phone:'', lineId:'', email:'', interestedModel:'MG4', budget:0, source:'line', stage:'lead', stageChangedAt: new Date(Date.now()-3600000*8).toISOString(), temperature:null, vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'', bookingId:null, notes:'ทักไลน์ถามราคา MG4', tags:[], createdAt: new Date(Date.now()-3600000*8).toISOString() },
    { id:'cu12', firstName:'อรนุช', lastName:'พรหมมา', phone:'', lineId:'', email:'', interestedModel:'MG4', budget:900000, source:'line', stage:'lead', stageChangedAt: new Date(Date.now()-86400000).toISOString(), temperature:null, vip:false, isLost:false, lostReason:'', lostAt:null, assignedTo:'', bookingId:null, notes:'ทักไลน์ถามราคา ยังไม่ได้เบอร์', tags:[], createdAt: new Date(Date.now()-86400000).toISOString() },
  ]
  customers.forEach(c => { if (!demoCol('customers')[c.id]) demoCol('customers')[c.id] = c })


  // Bookings (โครง V8 — แหล่งขายกลาง: feed ไปยัง Margin/Finance/Commission)
  const bookings = [
    { id:'bk1', bookingNo:'SK2506001', custName:'ธีรพงศ์ แสงทอง', customerId:'cu1', nid:'1234567890123', phone:'0812345678', address:'88 ถ.สุขุมวิท', province:'กรุงเทพฯ', source:'Walk-in',
      brand:'DEEPAL', model:'S07', variant:'New Standard', colorOut:'ขาว Pearl', colorIn:'ดำ', vin:'LGXCE4C10PA000001', motorNo:'', batNo:'',
      price:1299000, cost:1150000, down:200000, financeCo:'BAY', financeAmount:1099000, finStatus:'ผ่าน', installments:60, interestRate:2.25, monthly:19800, campaign:'ดอกเบี้ยปกติ',
      margin:25000, budgetUsed:5000, com70:8000, comFinance:6000, marginLeft:20000, totalIncome:34000,
      bookingDate:'2026-06-20', submitDate:'2026-06-20', approveDate:'2026-06-22', signDate:'2026-06-24', cutDate:'', deliveryDate: new Date(Date.now()+86400000*2).toISOString().slice(0,10), actualDeliveryDate:'',
      salesName:'อรนุช เซลส์ดี', status:'รอส่งมอบ', notes:'', createdAt:'2026-06-20' },
    { id:'bk2', bookingNo:'SK2506002', custName:'กิตติพงษ์ วรรณศิลป์', nid:'1209800112233', phone:'0876543210', address:'', province:'นนทบุรี', source:'Facebook',
      brand:'DEEPAL', model:'Q05 Ultra', variant:'AWD', colorOut:'เงิน', colorIn:'Rose-White', vin:'', motorNo:'', batNo:'',
      price:1099000, cost:1010000, down:150000, financeCo:'TTB', financeAmount:949000, finStatus:'รอผล', installments:72, interestRate:2.49, monthly:15200, campaign:'ดอกเบี้ยพิเศษ',
      margin:18000, budgetUsed:8000, com70:6000, comFinance:5000, marginLeft:10000, totalIncome:21000,
      bookingDate:'2026-06-29', submitDate:'2026-06-30', approveDate:'', signDate:'', cutDate:'', deliveryDate:'2026-07-15', actualDeliveryDate:'',
      salesName:'วิชัย ขายเก่ง', status:'รอผลไฟแนนซ์', notes:'รอเอกสารเพิ่ม', createdAt:'2026-06-29' },
    { id:'bk3', bookingNo:'SK2506003', custName:'วราภรณ์ หิรัญ', nid:'3100502233445', phone:'0856789012', address:'12/3 หมู่บ้านสุขสันต์', province:'ปทุมธานี', source:'Referral',
      brand:'DEEPAL', model:'S05 REEV MAX', variant:'Ultra', colorOut:'ขาว', colorIn:'น้ำตาล-เบจ', vin:'LZ0000000000001', motorNo:'M001', batNo:'B001',
      price:899000, cost:800000, down:0, financeCo:'', financeAmount:0, finStatus:'', installments:0, interestRate:0, monthly:0, campaign:'',
      margin:0, budgetUsed:0, com70:0, comFinance:0, marginLeft:0, totalIncome:0,
      bookingDate:'2026-06-28', submitDate:'', approveDate:'', signDate:'', cutDate:'', deliveryDate:'', actualDeliveryDate:'',
      salesName:'ใบเฟิน', status:'ยอดจองคงค้าง', notes:'', createdAt:'2026-06-28' },
    { id:'bk4', bookingNo:'SK2506004', custName:'ปนัดดา ดุลมา', nid:'', phone:'0899123456', address:'', province:'', source:'Walk-in',
      brand:'DEEPAL', model:'S05 BEV Max', variant:'Standard', colorOut:'เทา', colorIn:'', vin:'', motorNo:'', batNo:'',
      price:849000, cost:770000, down:100000, financeCo:'BAY', financeAmount:749000, finStatus:'รอผล', installments:60, interestRate:2.5, monthly:13200, campaign:'',
      margin:22000, budgetUsed:4000, com70:7000, comFinance:5000, marginLeft:18000, totalIncome:30000,
      bookingDate:'2026-06-28', submitDate:'2026-06-28', approveDate:'', signDate:'', cutDate:'', deliveryDate:'2026-07-20', actualDeliveryDate:'',
      salesName:'ใบเฟิน', status:'รอผลไฟแนนซ์', notes:'', createdAt:'2026-06-28' },
    { id:'bk5', bookingNo:'SK2506005', custName:'พาหุยุทธ สังข์สาลี', nid:'', phone:'0891112223', address:'', province:'', source:'Facebook',
      brand:'DEEPAL', model:'S05 REEV MAX', variant:'Ultra', colorOut:'เงิน', colorIn:'', vin:'', motorNo:'', batNo:'',
      price:899000, cost:800000, down:150000, financeCo:'TTB', financeAmount:749000, finStatus:'รอผล', installments:72, interestRate:2.6, monthly:11800, campaign:'',
      margin:24000, budgetUsed:4000, com70:7500, comFinance:5000, marginLeft:20000, totalIncome:32500,
      bookingDate:'2026-06-28', submitDate:'2026-06-28', approveDate:'', signDate:'', cutDate:'', deliveryDate:'2026-07-18', actualDeliveryDate:'',
      salesName:'ใบเฟิน', status:'รอผลไฟแนนซ์', notes:'', createdAt:'2026-06-28' },
    { id:'bk6', bookingNo:'SK2506006', custName:'บิ่ง ชิ้นเทียม', customerId:'cu2', nid:'', phone:'0895556667', address:'', province:'', source:'Walk-in',
      brand:'DEEPAL', model:'Q05 Ultra', variant:'AWD', colorOut:'เงิน', colorIn:'', vin:'', motorNo:'', batNo:'',
      price:1099000, cost:1010000, down:0, financeCo:'', financeAmount:0, finStatus:'ผ่าน', installments:60, interestRate:2.49, monthly:0, campaign:'',
      margin:0, budgetUsed:0, com70:0, comFinance:0, marginLeft:0, totalIncome:0,
      bookingDate:'2026-06-27', submitDate:'2026-06-27', approveDate:'2026-06-29', signDate:'', cutDate: new Date(Date.now()+86400000).toISOString().slice(0,10), deliveryDate: new Date(Date.now()+86400000*3).toISOString().slice(0,10), actualDeliveryDate:'',
      salesName:'ใบเฟิน', status:'รอรถ', notes:'', createdAt:'2026-06-27' },
    { id:'bk7', bookingNo:'SK2506007', custName:'สมชาย ยิ่งใหญ่', nid:'', phone:'0812223334', address:'', province:'ชลบุรี', source:'Referral',
      brand:'AION', model:'Y Plus', variant:'', colorOut:'ขาว', colorIn:'', vin:'LAION000000001', motorNo:'', batNo:'',
      price:1069000, cost:970000, down:100000, financeCo:'SCB', financeAmount:969000, finStatus:'ผ่าน', installments:60, interestRate:2.3, monthly:17200, campaign:'',
      margin:20000, budgetUsed:3000, com70:7000, comFinance:5000, marginLeft:17000, totalIncome:29000,
      bookingDate:'2026-06-10', submitDate:'2026-06-10', approveDate:'2026-06-14', signDate:'2026-06-16', cutDate:'2026-06-24', deliveryDate:'2026-06-30', actualDeliveryDate:'',
      salesName:'วิชัย ขายเก่ง', status:'ตัดตัวเลขรอส่งมอบ', notes:'', createdAt:'2026-06-10' },
    { id:'bk8', bookingNo:'SK2505018', custName:'สุภาพร ใจดี', customerId:'cu3', nid:'3100502233445', phone:'0856789012', address:'12/3 หมู่บ้านสุขสันต์', province:'ปทุมธานี', source:'Referral',
      brand:'AION', model:'ES', variant:'2026 Ultra', colorOut:'ฟ้า', colorIn:'น้ำตาล-เบจ', vin:'LAION000000002', motorNo:'M001', batNo:'B001',
      price:899000, cost:867000, down:0, financeCo:'ซื้อสด', financeAmount:0, finStatus:'ซื้อสด', installments:0, interestRate:0, monthly:0, campaign:'ซื้อสด',
      margin:32000, budgetUsed:3000, com70:10000, comFinance:0, marginLeft:29000, totalIncome:39000,
      bookingDate:'2026-05-18', submitDate:'2026-05-18', approveDate:'2026-05-18', signDate:'2026-05-20', cutDate:'2026-05-26', deliveryDate:'2026-05-28', actualDeliveryDate:'2026-05-28',
      salesName:'อรนุช เซลส์ดี', status:'ส่งมอบแล้ว', notes:'', createdAt:'2026-05-18' },
    { id:'bk9', bookingNo:'SK2505017', custName:'ประเสริฐ ทองแท้', customerId:'cu4', nid:'', phone:'0898887776', address:'', province:'นนทบุรี', source:'Walk-in',
      brand:'OMODA & JAECOO', model:'Omoda 5', variant:'EV', colorOut:'ดำ', colorIn:'', vin:'LOMODA0000001', motorNo:'', batNo:'',
      price:769000, cost:700000, down:100000, financeCo:'BAY', financeAmount:669000, finStatus:'ผ่าน', installments:60, interestRate:2.4, monthly:12100, campaign:'',
      margin:16000, budgetUsed:3000, com70:6000, comFinance:4000, marginLeft:13000, totalIncome:23000,
      bookingDate:'2026-05-10', submitDate:'2026-05-10', approveDate:'2026-05-12', signDate:'2026-05-14', cutDate:'2026-05-20', deliveryDate:'2026-05-25', actualDeliveryDate:'2026-05-25',
      salesName:'ปวีณา สายขาย', status:'ส่งมอบแล้ว', notes:'', createdAt:'2026-05-10' },
    { id:'bk10', bookingNo:'SK2505016', custName:'อนุสรา แก้วมณี', nid:'', phone:'0887776665', address:'', province:'กรุงเทพฯ', source:'Line',
      brand:'SUZUKI', model:'Swift', variant:'GLX', colorOut:'แดง', colorIn:'', vin:'LSUZUKI000001', motorNo:'', batNo:'',
      price:579000, cost:520000, down:50000, financeCo:'TISCO', financeAmount:529000, finStatus:'ผ่าน', installments:60, interestRate:2.1, monthly:9500, campaign:'',
      margin:12000, budgetUsed:2000, com70:5000, comFinance:3000, marginLeft:10000, totalIncome:18000,
      bookingDate:'2026-04-22', submitDate:'2026-04-22', approveDate:'2026-04-24', signDate:'2026-04-26', cutDate:'2026-05-01', deliveryDate:'2026-05-05', actualDeliveryDate:'2026-05-05',
      salesName:'ธนกร โชคดี', status:'ส่งมอบแล้ว', notes:'', createdAt:'2026-04-22' },
    { id:'bk11', bookingNo:'SK2505015', custName:'ชัยวัฒน์ พงษ์ไพร', nid:'', phone:'0876665554', address:'', province:'ปทุมธานี', source:'Walk-in',
      brand:'NISSAN', model:'Almera', variant:'Sportech', colorOut:'ขาว', colorIn:'', vin:'LNISSAN000001', motorNo:'', batNo:'',
      price:649000, cost:590000, down:50000, financeCo:'KBANK', financeAmount:599000, finStatus:'ผ่าน', installments:60, interestRate:2.2, monthly:10600, campaign:'',
      margin:13000, budgetUsed:2000, com70:5000, comFinance:3000, marginLeft:11000, totalIncome:19000,
      bookingDate:'2026-04-15', submitDate:'2026-04-15', approveDate:'2026-04-17', signDate:'2026-04-19', cutDate:'2026-04-25', deliveryDate:'2026-04-30', actualDeliveryDate:'2026-04-30',
      salesName:'สุดารัตน์ ใจบุญ', status:'ส่งมอบแล้ว', notes:'', createdAt:'2026-04-15' },
    { id:'bk12', bookingNo:'SK2504010', custName:'ทัศนีย์ บุญมาก', nid:'', phone:'0865554443', address:'', province:'', source:'Facebook',
      brand:'DEEPAL', model:'S07', variant:'New Standard', colorOut:'ดำ', colorIn:'', vin:'', motorNo:'', batNo:'',
      price:1299000, cost:1150000, down:0, financeCo:'', financeAmount:0, finStatus:'', installments:0, interestRate:0, monthly:0, campaign:'',
      margin:0, budgetUsed:0, com70:0, comFinance:0, marginLeft:0, totalIncome:0,
      bookingDate:'2026-03-20', submitDate:'', approveDate:'', signDate:'', cutDate:'', deliveryDate:'', actualDeliveryDate:'',
      salesName:'อรนุช เซลส์ดี', status:'ถอนจอง', notes:'ลูกค้าเปลี่ยนใจ', createdAt:'2026-03-20',
      cancelDate:'2026-03-22', cancelReason:'ลูกค้าเปลี่ยนใจ ได้รถจากที่อื่น', refundAmount:0, refundStatus:'ไม่ต้องคืน' },
    { id:'bk13', bookingNo:'SK2506008', custName:'กัลยา ศรีสมบูรณ์', nid:'', phone:'0854443332', address:'', province:'ชลบุรี', source:'Walk-in',
      brand:'DEEPAL', model:'S07', variant:'New Standard', colorOut:'ขาว', colorIn:'', vin:'', motorNo:'', batNo:'',
      price:1299000, cost:1150000, down:0, financeCo:'', financeAmount:0, finStatus:'', installments:0, interestRate:0, monthly:0, campaign:'',
      margin:0, budgetUsed:0, com70:0, comFinance:0, marginLeft:0, totalIncome:0,
      bookingDate:'2026-06-25', submitDate:'', approveDate:'', signDate:'', cutDate:'', deliveryDate:'', actualDeliveryDate:'',
      salesName:'วิชัย ขายเก่ง', status:'จัดไฟแนนซ์ก่อนจอง', notes:'รอผลไฟแนนซ์ก่อนวางเงินจอง', createdAt:'2026-06-25' },
    { id:'bk14', bookingNo:'SK2506009', custName:'รุ่งนภา ทองสุข', nid:'', phone:'0843332221', address:'', province:'', source:'Line',
      brand:'AION', model:'Y Plus', variant:'', colorOut:'ดำ', colorIn:'', vin:'', motorNo:'', batNo:'',
      price:1069000, cost:970000, down:0, financeCo:'', financeAmount:0, finStatus:'', installments:0, interestRate:0, monthly:0, campaign:'',
      margin:0, budgetUsed:0, com70:0, comFinance:0, marginLeft:0, totalIncome:0,
      bookingDate:'2026-06-30', submitDate:'', approveDate:'', signDate:'', cutDate:'', deliveryDate: new Date(Date.now()-86400000).toISOString().slice(0,10), actualDeliveryDate:'',
      salesName:'ปวีณา สายขาย', status:'รอรถ', notes:'', createdAt:'2026-06-30' },
    { id:'bk15', bookingNo:'SK2506010', custName:'ไพโรจน์ วงศ์แก้ว', nid:'', phone:'0832221110', address:'', province:'นนทบุรี', source:'Walk-in',
      brand:'OMODA & JAECOO', model:'Jaecoo J7', variant:'', colorOut:'เทา', colorIn:'', vin:'', motorNo:'', batNo:'',
      price:989000, cost:900000, down:100000, financeCo:'KKP', financeAmount:889000, finStatus:'รอผล', installments:60, interestRate:2.4, monthly:15900, campaign:'',
      margin:18000, budgetUsed:3000, com70:6000, comFinance:4000, marginLeft:15000, totalIncome:25000,
      bookingDate:'2026-06-30', submitDate:'2026-06-30', approveDate:'', signDate:'', cutDate:'', deliveryDate:'2026-08-01', actualDeliveryDate:'',
      salesName:'ธนกร โชคดี', status:'รอผลไฟแนนซ์', notes:'', createdAt:'2026-06-30' },
    { id:'bk16', bookingNo:'SK2506011', custName:'มนัสพงษ์ แซ่มซ้อย', nid:'', phone:'0821110009', address:'', province:'', source:'Walk-in',
      brand:'DEEPAL', model:'Q05 Ultra', variant:'AWD', colorOut:'เงิน', colorIn:'', vin:'', motorNo:'', batNo:'',
      price:1099000, cost:1010000, down:0, financeCo:'', financeAmount:0, finStatus:'', installments:0, interestRate:0, monthly:0, campaign:'',
      margin:0, budgetUsed:0, com70:0, comFinance:0, marginLeft:0, totalIncome:0,
      bookingDate:'2026-06-29', submitDate:'', approveDate:'', signDate:'', cutDate:'', deliveryDate:'', actualDeliveryDate:'',
      salesName:'ใบเฟิน', status:'รอผลไฟแนนซ์', notes:'', createdAt:'2026-06-29' },
  ]
  bookings.forEach(b => { if (!demoCol('bookings')[b.id]) demoCol('bookings')[b.id] = b })


  // CRM extras
  const actionPlans = [
    { id:'ap1', title:'โทรหาลูกค้า Hot ทุกเช้า', type:'call', customer:'สมชาย มีทรัพย์', priority:'high', dueDate: new Date(Date.now()+86400000).toISOString().slice(0,10), status:'pending', assignedTo:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-3600000).toISOString() },
    { id:'ap2', title:'นัดทดลองขับ BYD Seal AWD', type:'testdrive', customer:'ธีรพงศ์ แสงทอง', priority:'high', dueDate: new Date(Date.now()).toISOString().slice(0,10), status:'inprogress', assignedTo:'วิชัย ขายเก่ง', createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'ap3', title:'เสนอราคา DEEPAL S7 Pro', type:'quote', customer:'กิตติพงษ์ วรรณศิลป์', priority:'medium', dueDate: new Date(Date.now()+86400000*2).toISOString().slice(0,10), status:'done', assignedTo:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'ap4', title:'ติดตามผลไฟแนนซ์ TTB', type:'finance', customer:'กิตติพงษ์ วรรณศิลป์', priority:'urgent', dueDate: new Date(Date.now()).toISOString().slice(0,10), status:'pending', assignedTo:'วิชัย ขายเก่ง', createdAt: new Date(Date.now()-7200000).toISOString() },
  ]
  actionPlans.forEach(a => { if (!demoCol('action_plans')[a.id]) demoCol('action_plans')[a.id] = a })


  // CRM Test Drive records (distinct from DMS test_drives — different schema, own collection)
  const tdrAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // After-Sales Follow-ups (some are manually added, some materialize from delivered bookings)
  const fuAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Win-Back campaign targets (churned customers)
  const wbAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // ── CRM Extras ──
  const priceNegotiations = [
    { id:'pn1', customer:'สมชาย ใจดี', model:'BYD Atto 3', listPrice:1199900, offerPrice:1150000, discount:49900, discPct:4.2, status:'approved', sales:'อรนุช เซลส์ดี', date: new Date(Date.now()-86400000*2).toISOString().slice(0,10), approver:'ผจก. วิชัย', createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'pn2', customer:'นภา สุขสม', model:'BYD Seal AWD', listPrice:1999900, offerPrice:1900000, discount:99900, discPct:5.0, status:'pending', sales:'วิชัย ขายเก่ง', date: new Date(Date.now()-86400000*1).toISOString().slice(0,10), approver:'', createdAt: new Date(Date.now()-86400000*1).toISOString() },
    { id:'pn3', customer:'วิชัย ศรีดี', model:'BYD Dolphin', listPrice:799900, offerPrice:770000, discount:29900, discPct:3.7, status:'rejected', sales:'อรนุช เซลส์ดี', date: new Date(Date.now()-86400000*3).toISOString().slice(0,10), approver:'ผจก. วิชัย', createdAt: new Date(Date.now()-86400000*3).toISOString() },
  ]
  priceNegotiations.forEach(p => { if (!demoCol('price_negotiations')[p.id]) demoCol('price_negotiations')[p.id] = p })


  // Walk-ins (Showroom walk-in traffic log)
  const wiAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  // Referral program
  const refAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

  // Referrers (QR referral agents)
  const referrers = [
    { id:'RF001', name:'นภา มีสุข', phone:'081-234-5678', code:'NAPA001', qrUrl:'lamom.app/ref/NAPA001', clicks:28, leads:8, sales:3, commission:15000, paid:10000, createdAt:'2026-01-15' },
    { id:'RF002', name:'สมชาย วิเศษ', phone:'089-876-5432', code:'SOMC002', qrUrl:'lamom.app/ref/SOMC002', clicks:45, leads:12, sales:5, commission:25000, paid:25000, createdAt:'2026-01-20' },
    { id:'RF003', name:'มาลี จันทร์ดี', phone:'076-111-2222', code:'MALI003', qrUrl:'lamom.app/ref/MALI003', clicks:12, leads:3, sales:1, commission:5000, paid:0, createdAt:'2026-03-01' },
    { id:'RF004', name:'วิชัย รุ่งเรือง', phone:'095-555-6666', code:'WICH004', qrUrl:'lamom.app/ref/WICH004', clicks:8, leads:2, sales:0, commission:0, paid:0, createdAt:'2026-05-10' },
  ]
  referrers.forEach(r => { if (!demoCol('referrers')[r.id]) demoCol('referrers')[r.id] = r })


  // Quotations
  const qtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // VAT invoices
  const vatInvoices = [
    { id:'vi1', date:'2025-06-20', invoiceNo:'INV-2025-001', buyer:'ธีรพงศ์ แสงทอง', amount:1299000, vatAmount:90930, type:'sale', status:'issued' },
    { id:'vi2', date:'2025-05-28', invoiceNo:'INV-2025-002', buyer:'สุภาพร ใจดี', amount:899000, vatAmount:62930, type:'sale', status:'issued' },
    { id:'vi3', date:'2025-06-10', invoiceNo:'TAX-2025-001', buyer:'วิชัย สุขใจ', amount:15200, vatAmount:1064, type:'service', status:'issued' },
    { id:'vi4', date:'2025-06-15', invoiceNo:'INV-2025-003', buyer:'สมชาย ช่างดี (Purchase)', amount:48000, vatAmount:3360, type:'purchase', status:'issued' },
  ]
  vatInvoices.forEach(v => { if (!demoCol('vat_invoices')[v.id]) demoCol('vat_invoices')[v.id] = v })


  // Fleet deals (Fleet & Corporate)
  const fleetDeals = [
    { id: 'FL-001', company: 'บ.รุ่งเรือง จำกัด', contact: 'คุณสมชาย', phone: '089-111-2222', units: 5, model: 'BYD Atto 3 Pro', unitPrice: 1299000, discount: 3, status: 'negotiation', delivery: '2026-09-30', sales: 'นิภา', notes: 'ต้องการสีดำทั้งหมด ผ่อนบริษัท 60 งวด' },
    { id: 'FL-002', company: 'โรงพยาบาลสุขใจ', contact: 'คุณวิไล', phone: '02-222-3333', units: 3, model: 'BYD Seal', unitPrice: 1550000, discount: 2.5, status: 'proposal', delivery: '2026-10-15', sales: 'วิชัย', notes: 'รถผู้บริหาร สีขาว' },
    { id: 'FL-003', company: 'บ.สร้างดี จำกัด', contact: 'คุณอนุชา', phone: '081-333-4444', units: 10, model: 'BYD Dolphin', unitPrice: 899000, discount: 5, status: 'won', delivery: '2026-07-01', sales: 'สมชาย', notes: 'แล้วเสร็จ ส่งมอบ Q3' },
    { id: 'FL-004', company: 'หน่วยงานราชการ ก.', contact: 'คุณประเสริฐ', phone: '02-444-5555', units: 8, model: 'BYD Atto 3', unitPrice: 1099000, discount: 4, status: 'prospect', delivery: '', sales: 'มาลี', notes: 'งบประมาณปี 2027 รอกระบวนการจัดซื้อ' },
  ]
  fleetDeals.forEach(f => { if (!demoCol('fleet_deals')[f.id]) demoCol('fleet_deals')[f.id] = f })

}
