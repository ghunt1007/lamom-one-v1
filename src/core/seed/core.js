// Demo seed data — core module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  
  const ssWeekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d })()

  const now = new Date()

  const addDaysISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  
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

  
  const ttPeriod = new Date().toISOString().slice(0, 7)

  
  const isNow = Date.now()

  
  const HOL_YEAR = new Date().getFullYear()

  const srAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const wlAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
  const wcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const wqAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
  const akAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const brAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }
  const ssAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
  const fqAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const ppAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const ctrAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const dtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const cdAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
  const coAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const wtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const ekAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const brAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const kbAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const daysAgoISO = n => new Date(Date.now() - n * 86400000).toISOString()
  const minutesAgoISO = n => new Date(Date.now() - n * 60000).toISOString()
  const evAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const lgAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const loAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const csAddMins = n => { const d = new Date(); d.setMinutes(d.getMinutes() + n); return d.toISOString() }
  const pdAddHours = n => { const d = new Date(); d.setHours(d.getHours() + n); return d.toISOString() }
  const evAddDays2 = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const evdAddMins = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
  const poAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const rcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const raAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
  const amAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const tdrAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const fuAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const wbAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const bmAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const wiAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }
  const refAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const qtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const shAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Communication logs
  const logs = [
    { id:'l1', customerId:'c1', type:'call', note:'โทรติดตาม สนใจรุ่น BYD Seal สีขาว นัดทดลองขับวันศุกร์', createdBy:'sales1', createdAt: new Date(Date.now()-3600000*2).toISOString() },
    { id:'l2', customerId:'c1', type:'line', note:'ส่งโบรชัวร์ BYD Seal ให้แล้ว ลูกค้าตอบรับดี', createdBy:'sales1', createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'l3', customerId:'c2', type:'visit', note:'เข้ามาโชว์รูม ทดลองขับ MG4 แล้ว ชอบมาก รอเรื่องไฟแนนซ์', createdBy:'sales1', createdAt: new Date(Date.now()-3600000*5).toISOString() },
  ]
  logs.forEach(l => { if (!demoCol('comm_logs')[l.id]) demoCol('comm_logs')[l.id] = l })


  // Notifications
  const notifs = [
    { id:'n1', type:'lead', title:'Lead ใหม่จาก Facebook', body:'สมชาย มีทรัพย์ สนใจ BYD Seal', read:false, createdAt: new Date(Date.now()-3600000).toISOString() },
    { id:'n2', type:'reminder', title:'ติดตาม Lead', body:'สมหญิง ดีมาก ยังไม่ได้โทรติดตาม 3 วันแล้ว', read:false, createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'n3', type:'system', title:'ยินดีต้อนรับสู่ LAMOM ONE V1', body:'ระบบพร้อมใช้งาน! 🎉', read:true, createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'n4', type:'stock', title:'สต็อกรถใหม่ถึงแล้ว', body:'BYD Seal AWD สีขาว — รอ PDI', read:false, createdAt: new Date(Date.now()-3600000*4).toISOString() },
  ]
  notifs.forEach(n => { if (!demoCol('notifications')[n.id]) demoCol('notifications')[n.id] = n })


  // Tasks
  const tasks = [
    { id:'t1', title:'โทรติดตาม สมชาย มีทรัพย์', desc:'ลูกค้า hot นัดทดลองขับ BYD Seal', assignedTo:'sales1', priority:'high', status:'todo', dueDate: new Date(Date.now()+86400000).toISOString().slice(0,10), createdAt: new Date(Date.now()-3600000).toISOString() },
    { id:'t2', title:'ส่งใบเสนอราคา DEEPAL S7 ให้ กิตติพงษ์', desc:'ราคา + ออปชั่น + ไฟแนนซ์', assignedTo:'sales2', priority:'high', status:'inprogress', dueDate: new Date(Date.now()).toISOString().slice(0,10), createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'t3', title:'อัพเดตสต็อกรถหลัง PDI DEEPAL S7', desc:'ย้ายสถานะจาก PDI → พร้อมขาย', assignedTo:'tech1', priority:'medium', status:'done', dueDate: new Date(Date.now()-86400000).toISOString().slice(0,10), createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'t4', title:'ต่ออายุประกัน — วิชัย สุขใจ', desc:'กรมธรรม์ INS-2024-045 หมดอายุแล้ว', assignedTo:'sales1', priority:'urgent', status:'todo', dueDate: new Date(Date.now()).toISOString().slice(0,10), createdAt: new Date(Date.now()-7200000).toISOString() },
    { id:'t5', title:'เตรียมเอกสารส่งมอบรถ BK-2025-002', desc:'สัญญา + คู่มือ + ประกัน + ป้ายทะเบียน', assignedTo:'sales2', priority:'medium', status:'todo', dueDate: new Date(Date.now()+86400000*3).toISOString().slice(0,10), createdAt: new Date(Date.now()-3600000*6).toISOString() },
  ]
  tasks.forEach(t => { if (!demoCol('tasks')[t.id]) demoCol('tasks')[t.id] = t })


  const cpAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const complaints = [
    { id:'CP001', custName:'สมชาย ใจดี', phone:'0812345678', vehicle:'BYD Seal AWD กข-1234', category:'product', priority:'high', subject:'เครื่องยนต์สั่นผิดปกติ', detail:'หลังจากซื้อรถได้ 2 อาทิตย์ มีเสียงสั่นที่พวงมาลัยตอนความเร็ว 80+ กม./ชม.', status:'investigating', openDate:cpAddDays(-6), closedDate:null, assignedTo:'ธีรยุทธ เก่งกาจ', response:'กำลังตรวจสอบ wheel balance', createdAt:cpAddDays(-6) },
    { id:'CP002', custName:'วิชัย เดินดี', phone:'0834567890', vehicle:'MG4 X คง-5678', category:'service', priority:'medium', subject:'ซ่อมซ้ำปัญหาเดิม', detail:'เข้าซ่อม A/C ครั้งที่ 2 ปัญหาเดิมยังมีอยู่', status:'open', openDate:cpAddDays(-3), closedDate:null, assignedTo:'', response:'', createdAt:cpAddDays(-3) },
    { id:'CP003', custName:'ประภา สวยงาม', phone:'0845678901', vehicle:'BYD Atto3 งจ-9012', category:'sales', priority:'low', subject:'เซลส์ไม่ติดต่อกลับ', detail:'นัดทดลองขับแล้วแต่เซลส์ไม่โทรกลับ 3 วัน', status:'resolved', openDate:cpAddDays(-10), closedDate:cpAddDays(-8), assignedTo:'ผู้จัดการ', response:'ขอโทษและส่งทีมขายพร้อม offer พิเศษ', createdAt:cpAddDays(-10) },
    { id:'CP004', custName:'อนุชา รวยมาก', phone:'0856789012', vehicle:'MG ZS EV ชด-7890', category:'billing', priority:'critical', subject:'ถูกเก็บเงินเกิน', detail:'ใบแจ้งหนี้ระบุยอด 1,200,000 แต่ตกลงกันไว้ 1,049,000', status:'escalated', openDate:cpAddDays(-4), closedDate:null, assignedTo:'ผู้จัดการ', response:'กำลังตรวจสอบกับฝ่ายการเงิน', createdAt:cpAddDays(-4) },
  ]
  complaints.forEach(c => { if (!demoCol('complaints')[c.id]) demoCol('complaints')[c.id] = c })


  const csAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const csat = [
    { id:'CS001', customer:'สมชาย ใจดี',  model:'BYD Atto 3', date:csAddDays(-1), csat:5, nps:9, comment:'บริการดีมาก ช่างอธิบายละเอียด', surveyed:false, createdAt:csAddDays(-1) },
    { id:'CS002', customer:'นภา สุขใจ',   model:'MG ZS EV',   date:csAddDays(-2), csat:4, nps:7, comment:'รอนานนิดหน่อย แต่งานเรียบร้อย', surveyed:false, createdAt:csAddDays(-2) },
    { id:'CS003', customer:'วิชัย ดีมาก', model:'BYD Seal',   date:csAddDays(-2), csat:2, nps:3, comment:'อะไหล่ไม่มีต้องรอนาน 3 วัน', surveyed:false, createdAt:csAddDays(-2) },
    { id:'CS004', customer:'มาลี รุ่งเรือง',model:'BYD Han',   date:csAddDays(-3), csat:5, nps:10,comment:'ประทับใจมากครับ จะแนะนำเพื่อน', surveyed:false, createdAt:csAddDays(-3) },
    { id:'CS005', customer:'อรุณ วิชิต',  model:'BYD Dolphin',date:csAddDays(-4), csat:3, nps:6, comment:'', surveyed:false, createdAt:csAddDays(-4) },
  ]
  csat.forEach(c => { if (!demoCol('csat')[c.id]) demoCol('csat')[c.id] = c })


  const cnAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const customerNotes = [
    { id: 'N001', customer: 'สมชาย ใจดี', type: 'call', text: 'โทรสอบถามโปรเดือนนี้ — สนใจ BYD Seal สีดำ บอกว่าจะมาดูเสาร์นี้', staff: 'วิชัย ยอดขาย', time: cnAddHours(2), pinned: true },
    { id: 'N002', customer: 'สมชาย ใจดี', type: 'internal', text: 'ลูกค้าเคยขอส่วนลดเกิน floor — ระวังตอนต่อรอง ให้เน้นของแถมแทน', staff: 'ผจก.ขาย', time: cnAddHours(26), pinned: true },
    { id: 'N003', customer: 'มาลี สุขใจ', type: 'visit', text: 'มารับรถหลังเช็คระยะ พอใจมาก ฝากถามเรื่อง Wallbox สำหรับบ้าน', staff: 'วิทยา ช่างใหญ่', time: cnAddHours(5), pinned: false },
    { id: 'N004', customer: 'ธนพล เที่ยงตรง', type: 'chat', text: 'ทัก LINE ถามค่างวดไฟแนนซ์ 48 vs 60 เดือน — ส่งตารางเทียบให้แล้ว', staff: 'สุดา มาดี', time: cnAddHours(8), pinned: false },
    { id: 'N005', customer: 'อรทัย ตั้งใจ', type: 'email', text: 'ส่งใบเสนอราคา MG4 + อุปกรณ์เสริมตามที่ขอ', staff: 'ธนา เก่ง', time: cnAddHours(30), pinned: false },
    { id: 'N006', customer: 'มาลี สุขใจ', type: 'internal', text: 'ลูกค้า VIP — ซื้อ 2 คันแล้ว แนะนำเพื่อนมาอีก 1 ดูแลพิเศษ', staff: 'ผจก.ขาย', time: cnAddHours(100), pinned: true },
  ]
  customerNotes.forEach(n => { if (!demoCol('customer_notes')[n.id]) demoCol('customer_notes')[n.id] = n })


  const deals = [
    { id:'DC001', customer:'คุณวรพจน์ แก้วมณี', model:'BYD Atto 3 Extended', price:1199900, stage:'ไฟแนนซ์', winPct:78, salesperson:'กิตติ', days:12,
      advice:['ลูกค้าสนใจแต่ยังลังเล เรื่องค่างวด — เสนอดาวน์เพิ่มขึ้นเพื่อลดงวด','ส่ง LINE video รีวิวจากลูกค้าจริงที่ใช้รุ่นนี้อยู่','นัดทดลองขับอีกครั้ง เน้นโหมด EV เปรียบกับรถเก่า'],
      objections:['ค่างวดสูงไป','กลัวแบตเสื่อม'],
      competitors:['MG ZS EV','Neta V'] },
    { id:'DC002', customer:'บริษัท ทรัพย์สมบูรณ์ จก.', model:'BYD Seal AWD x3', price:5399700, stage:'เจรจา', winPct:55, salesperson:'ปิยะ', days:8,
      advice:['ดีลฝูงรถ — ขอนัดประชุม MD ให้ได้ภายในสัปดาห์นี้','เสนอแพ็กเกจ service ฟรี 3 ปีเป็น sweetener','คำนวณ TCO เทียบรถน้ำมันให้เห็นประหยัดชัดเจน'],
      objections:['ต้องการ 3 สีต่างกัน','งบอนุมัติช้า'],
      competitors:['Tesla Model 3','Volvo EX30'] },
    { id:'DC003', customer:'คุณนภา รุ่งเรือง', model:'BYD Dolphin Boost', price:799900, stage:'จอง', winPct:92, salesperson:'สมพงษ์', days:3,
      advice:['ใกล้ปิดดีลแล้ว — รีบยืนยันวันส่งมอบ','ส่งใบจองให้เซ็น ไม่ให้เปลี่ยนใจ','แนะนำอุปกรณ์เสริมก่อนส่งมอบ'],
      objections:[],
      competitors:[] },
    { id:'DC004', customer:'คุณเกรียงไกร สมศักดิ์', model:'MG ZS EV Luxury Plus', price:999900, stage:'สนใจ', winPct:35, salesperson:'กิตติ', days:21,
      advice:['Win rate ต่ำ — ระบุเหตุผลที่ยังไม่ตัดสินใจ','ลองเสนอ Test Drive ที่บ้านลูกค้า','ตรวจสอบว่าคู่แข่งเสนออะไรอยู่'],
      objections:['ยังเปรียบเทียบอยู่','รอรุ่นใหม่'],
      competitors:['Honda e:N1','BYD Atto 3'] },
    { id:'DC005', customer:'คุณพรทิพย์ วงษ์ทอง', model:'BYD Han EV', price:1899900, stage:'เจรจา', winPct:61, salesperson:'ปิยะ', days:6,
      advice:['ลูกค้า VIP — ให้ผู้จัดการโทรหาโดยตรงสัปดาห์นี้','เสนอ Priority Delivery ก่อนใคร','ให้สิทธิ์ Club Membership พิเศษ'],
      objections:['ราคายังสูง','อยากได้ของแถม'],
      competitors:['BMW iX3','Mercedes EQB'] },
  ]
  deals.forEach(d => { if (!demoCol('deals')[d.id]) demoCol('deals')[d.id] = d })


  const serviceReminders = [
    { id:'RM001', customer:'สมชาย ใจดี', phone:'085-111', plate:'1กข-1234', model:'BYD Seal', type:'mileage', detail:'ครบ 20,000 km', dueDate:srAddDays(5), contacted:false, booked:false },
    { id:'RM002', customer:'มาลี สุขใจ', phone:'086-222', plate:'2ขค-5678', model:'BYD Dolphin', type:'time', detail:'ครบ 12 เดือน', dueDate:srAddDays(2), contacted:true, booked:true },
    { id:'RM003', customer:'ธนพล เที่ยงตรง', phone:'087-333', plate:'3คง-9012', model:'MG ZS EV', type:'warranty', detail:'ประกันหมด 30 วัน', dueDate:srAddDays(30), contacted:false, booked:false },
    { id:'RM004', customer:'อรทัย ตั้งใจ', phone:'088-444', plate:'4งจ-3456', model:'BYD Atto 3', type:'battery', detail:'ตรวจแบตประจำปี', dueDate:srAddDays(-3), contacted:true, booked:false },
    { id:'RM005', customer:'วิรัช เก่งมาก', phone:'089-555', plate:'5จฉ-7890', model:'BYD Han', type:'mileage', detail:'ครบ 40,000 km', dueDate:srAddDays(10), contacted:false, booked:false },
    { id:'RM006', customer:'ชาตรี เข้มแข็ง', phone:'084-666', plate:'6ฉช-1122', model:'MG4', type:'time', detail:'ครบ 6 เดือน', dueDate:srAddDays(14), contacted:false, booked:false },
  ]
  serviceReminders.forEach(r => { if (!demoCol('service_reminders')[r.id]) demoCol('service_reminders')[r.id] = r })


  const waitingLoungeQueue = [
    { id:'Q01', customer:'สมชาย ใจดี', plate:'1กข-1234', service:'เช็คระยะ 20,000 km', stage:'working', checkin:wlAddMinutes(45), estMins:90, drinks:2, notified:false },
    { id:'Q02', customer:'มาลี สุขใจ', plate:'2ขค-5678', service:'เปลี่ยนยาง 4 เส้น', stage:'qc', checkin:wlAddMinutes(80), estMins:100, drinks:1, notified:false },
    { id:'Q03', customer:'ธนพล เที่ยงตรง', plate:'3คง-9012', service:'ตรวจแบตเตอรี่', stage:'ready', checkin:wlAddMinutes(60), estMins:45, drinks:1, notified:true },
    { id:'Q04', customer:'อรทัย ตั้งใจ', plate:'4งจ-3456', service:'ติดฟิล์มกรองแสง', stage:'diagnosing', checkin:wlAddMinutes(15), estMins:180, drinks:0, notified:false },
  ]
  waitingLoungeQueue.forEach(q => { if (!demoCol('waiting_lounge_queue')[q.id]) demoCol('waiting_lounge_queue')[q.id] = q })


  const warrantyClaims = [
    { id:'WC001', plate:'1กข-1234', model:'BYD Seal', vin:'...3456', issue:'มอเตอร์มีเสียงผิดปกติ', parts:'Motor Assembly', laborHrs:4, partCost:45000, status:'approved', submitted:wcAddDays(-8), warrantyType:'Powertrain 8 ปี' },
    { id:'WC002', plate:'2ขค-5678', model:'BYD Dolphin', vin:'...9012', issue:'จอ infotainment ค้าง', parts:'Head Unit', laborHrs:1.5, partCost:18000, status:'submitted', submitted:wcAddDays(-3), warrantyType:'ทั่วไป 3 ปี' },
    { id:'WC003', plate:'3คง-9012', model:'MG ZS EV', vin:'...7788', issue:'แบตเสื่อมเร็วผิดปกติ (SOH 72%)', parts:'Battery Pack', laborHrs:6, partCost:280000, status:'submitted', submitted:wcAddDays(-1), warrantyType:'Battery 8 ปี/160k km' },
    { id:'WC004', plate:'4งจ-3456', model:'BYD Atto 3', vin:'...5566', issue:'ที่ปัดน้ำฝนไม่ทำงาน', parts:'Wiper Motor', laborHrs:1, partCost:3200, status:'reimbursed', submitted:wcAddDays(-30), warrantyType:'ทั่วไป 3 ปี' },
    { id:'WC005', plate:'5จฉ-7890', model:'BYD Han', vin:'...2233', issue:'ระบบเบรกเตือน error (ลูกค้าใช้ผิดวิธี)', parts:'—', laborHrs:0.5, partCost:0, status:'rejected', submitted:wcAddDays(-15), warrantyType:'ทั่วไป 3 ปี' },
  ]
  warrantyClaims.forEach(c => { if (!demoCol('warranty_claims')[c.id]) demoCol('warranty_claims')[c.id] = c })


  const washQueue = [
    { id:'W01', plate:'1กข-1234', model:'BYD Seal', service:'premium', status:'washing', startTime:wqAddMinutes(25), customer:'สมชาย ใจดี', staff:'ทีม A', isFree:false },
    { id:'W02', plate:'2ขค-5678', model:'BYD Dolphin', service:'basic', status:'waiting', startTime:null, customer:'มาลี สุขใจ', staff:null, isFree:true },
    { id:'W03', plate:'3คง-9012', model:'MG ZS EV', service:'detail', status:'washing', startTime:wqAddMinutes(120), customer:'ธนพล เที่ยงตรง', staff:'ทีม B', isFree:false },
    { id:'W04', plate:'4งจ-3456', model:'BYD Atto 3', service:'basic', status:'done', startTime:wqAddMinutes(90), customer:'อรทัย ตั้งใจ', staff:'ทีม A', isFree:true },
    { id:'W05', plate:'5จฉ-7890', model:'BYD Han', service:'coating', status:'waiting', startTime:null, customer:'วิรัช เก่งมาก', staff:null, isFree:false },
  ]
  washQueue.forEach(q => { if (!demoCol('wash_queue')[q.id]) demoCol('wash_queue')[q.id] = q })


  const apiKeys = [
    { id:'K001', name:'LINE Webhook Integration', prefix:'lmm_live_a1b2', scope:'write', created:akAddDays(-90), lastUsed:akAddDays(0), requests30d:12420, active:true },
    { id:'K002', name:'Mobile App (Production)', prefix:'lmm_live_c3d4', scope:'write', created:akAddDays(-120), lastUsed:akAddDays(0), requests30d:89540, active:true },
    { id:'K003', name:'Accounting Sync (read)', prefix:'lmm_live_e5f6', scope:'read', created:akAddDays(-60), lastUsed:akAddDays(-2), requests30d:3200, active:true },
    { id:'K004', name:'Dev Testing', prefix:'lmm_test_g7h8', scope:'admin', created:akAddDays(-200), lastUsed:akAddDays(-45), requests30d:0, active:false },
  ]
  apiKeys.forEach(k => { if (!demoCol('api_keys')[k.id]) demoCol('api_keys')[k.id] = k })


  const systemBackups = [
    { id:'BK001', type:'full', status:'success', size:'2.4 GB', duration:'18 นาที', time:brAddHours(1), note:'Auto backup' },
    { id:'BK002', type:'incremental', status:'success', size:'145 MB', duration:'3 นาที', time:brAddHours(13), note:'Auto backup' },
    { id:'BK003', type:'incremental', status:'success', size:'98 MB', duration:'2 นาที', time:brAddHours(25), note:'Auto backup' },
    { id:'BK004', type:'full', status:'failed', size:'—', duration:'—', time:brAddHours(49), note:'Error: disk quota exceeded' },
    { id:'BK005', type:'config', status:'success', size:'12 KB', duration:'< 1 นาที', time:brAddHours(73), note:'Manual — before upgrade' },
  ]
  systemBackups.forEach(b => { if (!demoCol('system_backups')[b.id]) demoCol('system_backups')[b.id] = b })


  const settingsCompanies = [
    { id:'CO001', name:'บริษัท ลามอม จำกัด', taxId:'0105567012345', address:'123/45 ถ.พระราม 9 กทม. 10310', phone:'02-123-4567', email:'info@lamomone.com', logo:null },
  ]
  settingsCompanies.forEach(c => { if (!demoCol('companies')[c.id]) demoCol('companies')[c.id] = c })


  const signageScreens = [
    { id:'sc01', name:'จอหน้าโชว์รูม', location:'ล็อบบี้', status:'online', currentSlide:'s001', resolution:'1920x1080' },
    { id:'sc02', name:'จอห้องรับรถ', location:'Service Bay', status:'online', currentSlide:'s003', resolution:'1920x1080' },
    { id:'sc03', name:'จอโต๊ะเจรจา', location:'ห้องประชุมลูกค้า', status:'offline', currentSlide:null, resolution:'1280x720' },
  ]
  signageScreens.forEach(s => { if (!demoCol('signage_screens')[s.id]) demoCol('signage_screens')[s.id] = s })


  const holidays = [
    { id:'H01', name:'วันขึ้นปีใหม่', date:`${HOL_YEAR}-01-01`, type:'national', showroomOpen:false },
    { id:'H02', name:'วันมาฆบูชา', date:`${HOL_YEAR}-03-03`, type:'national', showroomOpen:true },
    { id:'H03', name:'วันจักรี', date:`${HOL_YEAR}-04-06`, type:'national', showroomOpen:true },
    { id:'H04', name:'สงกรานต์', date:`${HOL_YEAR}-04-13`, type:'national', showroomOpen:false },
    { id:'H05', name:'สงกรานต์', date:`${HOL_YEAR}-04-14`, type:'national', showroomOpen:false },
    { id:'H06', name:'สงกรานต์', date:`${HOL_YEAR}-04-15`, type:'national', showroomOpen:false },
    { id:'H07', name:'วันแรงงาน', date:`${HOL_YEAR}-05-01`, type:'national', showroomOpen:true },
    { id:'H08', name:'วันวิสาขบูชา', date:`${HOL_YEAR}-05-31`, type:'national', showroomOpen:true },
    { id:'H09', name:'งานเลี้ยงประจำปีบริษัท', date:`${HOL_YEAR}-12-25`, type:'company', showroomOpen:false },
    { id:'H10', name:'วันสิ้นปี', date:`${HOL_YEAR}-12-31`, type:'national', showroomOpen:false },
    { id:'H11', name:'Motor Show (ทีมขายออกบูธ)', date:`${HOL_YEAR}-06-25`, type:'special', showroomOpen:true },
    { id:'H12', name:'อบรมประจำปีทั้งบริษัท', date:`${HOL_YEAR}-07-15`, type:'company', showroomOpen:false },
  ]
  holidays.forEach(h => { if (!demoCol('holidays')[h.id]) demoCol('holidays')[h.id] = h })


  const systemIntegrations = [
    { id:'INT001', name:'LINE Official Account', cat:'messaging', icon:'💬', status:'connected', desc:'รับส่งข้อความ LINE ลูกค้า', lastSync:new Date(isNow-600000).toISOString(), webhookUrl:'https://api.lamom.one/webhook/line', config:{ channelId:'xxxxx', secretKey:'****' } },
    { id:'INT002', name:'Facebook Messenger', cat:'messaging', icon:'📘', status:'connected', desc:'ตอบ Chat Facebook Page', lastSync:new Date(isNow-1800000).toISOString(), webhookUrl:'https://api.lamom.one/webhook/fb', config:{ pageId:'xxxxx', token:'****' } },
    { id:'INT003', name:'SCB Easy Payment', cat:'payment', icon:'💳', status:'connected', desc:'รับชำระผ่าน SCB Easy', lastSync:new Date(isNow-3600000).toISOString(), webhookUrl:'', config:{ merchantId:'xxxxx', apiKey:'****' } },
    { id:'INT004', name:'KBank Payment Gateway', cat:'payment', icon:'💰', status:'disconnected', desc:'รับชำระผ่าน KBank', lastSync:null, webhookUrl:'', config:{} },
    { id:'INT005', name:'QuickBooks', cat:'accounting', icon:'📊', status:'error', desc:'ส่งข้อมูลบัญชีอัตโนมัติ', lastSync:new Date(isNow-86400000).toISOString(), webhookUrl:'', config:{ companyId:'xxxxx', token:'****' } },
    { id:'INT006', name:'OpenAI GPT-4', cat:'ai', icon:'🤖', status:'connected', desc:'AI สำหรับ LAMI Brain', lastSync:new Date(isNow-300000).toISOString(), webhookUrl:'', config:{ apiKey:'****', model:'gpt-4o' } },
    { id:'INT007', name:'Google Analytics 4', cat:'ai', icon:'📈', status:'connected', desc:'วิเคราะห์ traffic เว็บไซต์', lastSync:new Date(isNow-7200000).toISOString(), webhookUrl:'', config:{ measurementId:'G-xxxxx' } },
    { id:'INT008', name:'Salesforce CRM', cat:'crm', icon:'☁️', status:'disconnected', desc:'Sync ข้อมูล Lead กับ Salesforce', lastSync:null, webhookUrl:'', config:{} },
    { id:'INT009', name:'BYD Dealer Portal', cat:'logistics', icon:'🚗', status:'connected', desc:'ดึงข้อมูลสั่งรถและสต็อก', lastSync:new Date(isNow-14400000).toISOString(), webhookUrl:'', config:{ dealerCode:'BYD-TH-001' } },
    { id:'INT010', name:'SendGrid Email', cat:'messaging', icon:'📧', status:'connected', desc:'ส่ง Email อัตโนมัติ', lastSync:new Date(isNow-900000).toISOString(), webhookUrl:'', config:{ apiKey:'****', fromEmail:'noreply@lamom.one' } },
  ]
  systemIntegrations.forEach(i => { if (!demoCol('system_integrations')[i.id]) demoCol('system_integrations')[i.id] = i })


  const securityPolicies = [
    { id:'P1', name:'บังคับ 2FA สำหรับ Admin/Manager', enabled:true, critical:true },
    { id:'P2', name:'บังคับ 2FA สำหรับพนักงานทุกคน', enabled:false, critical:false },
    { id:'P3', name:'รหัสผ่านขั้นต่ำ 10 ตัว + ตัวเลข + อักขระพิเศษ', enabled:true, critical:true },
    { id:'P4', name:'บังคับเปลี่ยนรหัสทุก 90 วัน', enabled:false, critical:false },
    { id:'P5', name:'Auto-logout เมื่อไม่ใช้งาน 30 นาที', enabled:true, critical:false },
    { id:'P6', name:'จำกัด login จาก IP ในไทยเท่านั้น', enabled:true, critical:false },
    { id:'P7', name:'แจ้งเตือน Owner เมื่อมี login จากอุปกรณ์ใหม่', enabled:true, critical:true },
    { id:'P8', name:'ห้าม export ข้อมูลลูกค้าโดยไม่มีการอนุมัติ', enabled:true, critical:true },
  ]
  securityPolicies.forEach(p => { if (!demoCol('security_policies')[p.id]) demoCol('security_policies')[p.id] = p })


  const securitySessions = [
    { id:'S1', user:'ทวีศักดิ์ (Owner)', device:'Windows — Chrome', ip:'49.228.x.x (กรุงเทพ)', lastActive:ssAddMinutes(0), current:true },
    { id:'S2', user:'สมศรี การเงิน', device:'Windows — Edge', ip:'49.228.x.x (กรุงเทพ)', lastActive:ssAddMinutes(8), current:false },
    { id:'S3', user:'วิชัย ยอดขาย', device:'iPhone — Safari', ip:'184.22.x.x (มือถือ)', lastActive:ssAddMinutes(25), current:false },
    { id:'S4', user:'วิชัย ยอดขาย', device:'Android — Chrome', ip:'27.55.x.x (มือถือ)', lastActive:ssAddMinutes(2880), current:false },
  ]
  securitySessions.forEach(s => { if (!demoCol('security_sessions')[s.id]) demoCol('security_sessions')[s.id] = s })


  const fleetQuotes = [
    { id:'FQ001', company:'บริษัท ABC จำกัด', contact:'คุณประเสริฐ', units:15, model:'BYD Atto 3', unitPrice:1050000, discount:5, status:'negotiate', created:fqAddDays(-10), expiry:fqAddDays(20), note:'ต้องการรถสีขาว 10 คำ เทา 5 คัน' },
    { id:'FQ002', company:'ธนาคารแห่งชาติ', contact:'คุณศักดา', units:30, model:'BYD Dolphin', unitPrice:860000, discount:8, status:'approved', created:fqAddDays(-20), expiry:fqAddDays(10), note:'สัญญา 3 ปี พร้อมบริการซ่อม' },
    { id:'FQ003', company:'โรงพยาบาลกรุงเทพ', contact:'ฝ่ายจัดซื้อ', units:8, model:'BYD Seal AWD', unitPrice:1620000, discount:3, status:'sent', created:fqAddDays(-5), expiry:fqAddDays(25), note:'' },
    { id:'FQ004', company:'SCG Group', contact:'คุณวิชัย', units:50, model:'BYD Atto 3', unitPrice:1020000, discount:10, status:'draft', created:fqAddDays(-2), expiry:fqAddDays(28), note:'ต้องการ charging station ด้วย' },
  ]
  fleetQuotes.forEach(q => { if (!demoCol('fleet_quotes')[q.id]) demoCol('fleet_quotes')[q.id] = q })


  const b2bPartners = [
    { id:'PRT001', name:'บ. Thai EV Leasing', type:'finance', status:'active', contact:'สมหมาย ผู้จัดการ', email:'partner@evlease.co.th', phone:'02-xxx-xxxx', commissionRate:1.5, totalLeads:42, closedDeals:28, revenue:44520000, joinDate:ppAddDays(-180) },
    { id:'PRT002', name:'บ. กรุงเทพประกันภัย', type:'insurance', status:'active', contact:'วิชัย ตัวแทน', email:'ev@bki.co.th', phone:'02-yyy-yyyy', commissionRate:8.0, totalLeads:85, closedDeals:71, revenue:2840000, joinDate:ppAddDays(-365) },
    { id:'PRT003', name:'EV Connect Thailand', type:'ev_infra', status:'active', contact:'ปทิตา CEO', email:'info@evconnect.th', phone:'081-xxx-xxxx', commissionRate:2.0, totalLeads:15, closedDeals:12, revenue:480000, joinDate:ppAddDays(-90) },
    { id:'PRT004', name:'รีวิวเวอร์ YT: TheEVGuruTH', type:'referral', status:'active', contact:'ธนา Youtuber', email:'theevguru@gmail.com', phone:'086-xxx-xxxx', commissionRate:3.0, totalLeads:28, closedDeals:8, revenue:1272000, joinDate:ppAddDays(-60) },
    { id:'PRT005', name:'บ. Fast Charge Plus', type:'ev_infra', status:'pending', contact:'ชัยวัฒน์ COO', email:'biz@fastcharge.th', phone:'089-xxx-xxxx', commissionRate:1.5, totalLeads:0, closedDeals:0, revenue:0, joinDate:ppAddDays(-7) },
  ]
  b2bPartners.forEach(p => { if (!demoCol('b2b_partners')[p.id]) demoCol('b2b_partners')[p.id] = p })


  const contractsDemo = [
    { id:'CTR001', title:'สัญญาซื้อขาย BYD Seal AWD', type:'sale', status:'active', party:'วิชัย มีโชค', value:1590000, startDate:ctrAddDays(-30), endDate:ctrAddDays(335), createdBy:'สมชาย เซลส์', signedDate:ctrAddDays(-28), tags:['EV','retail'] },
    { id:'CTR002', title:'สัญญาบำรุงรักษา MG ZS EV Fleet', type:'service', status:'active', party:'บริษัท ABC จำกัด', value:360000, startDate:ctrAddDays(-60), endDate:ctrAddDays(305), createdBy:'วิทยา บริการ', signedDate:ctrAddDays(-55), tags:['fleet','B2B'] },
    { id:'CTR003', title:'NDA กับ BYD Thailand', type:'nda', status:'signed', party:'BYD Thailand Co., Ltd.', value:0, startDate:ctrAddDays(-90), endDate:ctrAddDays(275), createdBy:'ทีมกฎหมาย', signedDate:ctrAddDays(-85), tags:['confidential'] },
    { id:'CTR004', title:'สัญญาซื้อขาย BYD Atto 3', type:'sale', status:'review', party:'อรวรรณ สาวสวย', value:1290000, startDate:ctrAddDays(0), endDate:ctrAddDays(30), createdBy:'ปทิตา เซลส์', signedDate:null, tags:['EV','retail'] },
    { id:'CTR005', title:'สัญญาเช่ารถยนต์ระยะยาว', type:'lease', status:'draft', party:'บริษัท XYZ จำกัด', value:720000, startDate:ctrAddDays(7), endDate:ctrAddDays(372), createdBy:'สมชาย เซลส์', signedDate:null, tags:['fleet','leasing'] },
    { id:'CTR006', title:'สัญญาซัพพลายเออร์ อะไหล่', type:'supplier', status:'active', party:'บ. อะไหล่ไทย จำกัด', value:240000, startDate:ctrAddDays(-180), endDate:ctrAddDays(185), createdBy:'หัวหน้าคลัง', signedDate:ctrAddDays(-175), tags:['parts','supply'] },
  ]
  contractsDemo.forEach(c => { if (!demoCol('contracts')[c.id]) demoCol('contracts')[c.id] = c })


  const documentTemplatesDemo = [
    { id:'TPL001', name:'ใบเสนอราคา (Quotation)', cat:'sales', usage:245, lastUsed:dtAddDays(-1), fields:['ชื่อลูกค้า','รุ่นรถ','ราคา','ส่วนลด','ของแถม'], active:true },
    { id:'TPL002', name:'สัญญาจองรถ', cat:'sales', usage:128, lastUsed:dtAddDays(-2), fields:['ชื่อลูกค้า','รุ่นรถ','สี','มัดจำ','วันส่งมอบ'], active:true },
    { id:'TPL003', name:'ใบส่งมอบรถ (Delivery Note)', cat:'sales', usage:96, lastUsed:dtAddDays(-3), fields:['ชื่อลูกค้า','VIN','ทะเบียน','เลขไมล์','อุปกรณ์'], active:true },
    { id:'TPL004', name:'ใบแจ้งซ่อม (Job Card)', cat:'service', usage:412, lastUsed:dtAddDays(0), fields:['ทะเบียน','อาการ','ช่าง','ประเมินราคา'], active:true },
    { id:'TPL005', name:'ใบกำกับภาษี / ใบเสร็จ', cat:'finance', usage:587, lastUsed:dtAddDays(0), fields:['เลขที่','ลูกค้า','รายการ','VAT','รวม'], active:true },
    { id:'TPL006', name:'สัญญาจ้างงาน', cat:'hr', usage:8, lastUsed:dtAddDays(-30), fields:['ชื่อพนักงาน','ตำแหน่ง','เงินเดือน','วันเริ่มงาน'], active:true },
    { id:'TPL007', name:'หนังสือมอบอำนาจ', cat:'legal', usage:23, lastUsed:dtAddDays(-14), fields:['ผู้มอบ','ผู้รับมอบ','เรื่อง','วันที่'], active:true },
    { id:'TPL008', name:'แบบฟอร์มเทิร์นรถเก่า', cat:'sales', usage:4, lastUsed:dtAddDays(-60), fields:['ทะเบียนเดิม','ราคาประเมิน','สภาพรถ'], active:false },
  ]
  documentTemplatesDemo.forEach(t => { if (!demoCol('document_templates')[t.id]) demoCol('document_templates')[t.id] = t })


  const cashierPaymentsDemo = [
    { id:'PM001', customer:'สมชาย ใจดี', ref:'IV2406-042', desc:'ค่าเช็คระยะ 20,000 km', amount:3745, method:'transfer', time:cdAddMinutes(15), cashier:'สมศรี การเงิน' },
    { id:'PM002', customer:'มาลี สุขใจ', ref:'IV2406-041', desc:'ค่าอะไหล่ + ฟิล์ม', amount:13375, method:'card', time:cdAddMinutes(95), cashier:'สมศรี การเงิน' },
    { id:'PM003', customer:'อรทัย ตั้งใจ', ref:'BK2406-008', desc:'มัดจำจองรถ MG4', amount:10000, method:'transfer', time:cdAddMinutes(180), cashier:'สมศรี การเงิน' },
    { id:'PM004', customer:'วิรัช เก่งมาก', ref:'IV2406-040', desc:'ค่าล้าง + Detailing', amount:2675, method:'cash', time:cdAddMinutes(260), cashier:'สมศรี การเงิน' },
  ]
  cashierPaymentsDemo.forEach(p => { if (!demoCol('cashier_payments')[p.id]) demoCol('cashier_payments')[p.id] = p })

  const cashierPendingBillsDemo = [
    { id:'IV2406-043', customer:'ธนพล เที่ยงตรง', desc:'ค่าซ่อมเบรก (Job J002)', amount:9095 },
    { id:'IV2406-044', customer:'ชาตรี เข้มแข็ง', desc:'ค่าอะไหล่ใบปัดน้ำฝน', amount:696 },
  ]
  cashierPendingBillsDemo.forEach(b => { if (!demoCol('cashier_pending_bills')[b.id]) demoCol('cashier_pending_bills')[b.id] = b })


  const coAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const customOrdersDemo = [
    { id:'CO001', orderNo:'CO-2026-001', customerName:'ประเสริฐ วงศ์ทอง', phone:'081-234-5678', vehicleModel:'BYD Atto 3', plate:'', vin:'LC0C4CFF1P0012345', salesName:'สมชาย เซลส์',
      items:[{name:'ฟิล์มกรองแสง 3M Crystalline', qty:1, unitPrice:18000},{name:'กล้องถอยหลัง 360°', qty:1, unitPrice:8500}],
      discount:2000, discountNote:'โปรโมชั่นลูกค้าใหม่', freebies:[{name:'พรมยางกันลื่น', qty:1}],
      status:'new', routedDepts:[], history:[{ts:coAddHours(2), action:'สร้างคำสั่งแต่งรถ', note:''}] },
    { id:'CO002', orderNo:'CO-2026-002', customerName:'มาลี ศรีสุข', phone:'089-111-2222', vehicleModel:'BYD Seal AWD', plate:'', vin:'LC0C4CFF1P0054321', salesName:'วิชัย ยอดขาย',
      items:[{name:'ชุดแต่งสปอยเลอร์', qty:1, unitPrice:12000},{name:'ล้อแม็กลาย Sport 19"', qty:4, unitPrice:6500}],
      discount:0, discountNote:'', freebies:[],
      status:'routed', routedDepts:['warehouse','accounting'],
      history:[{ts:coAddHours(30), action:'สร้างคำสั่งแต่งรถ', note:''},{ts:coAddHours(28), action:'ส่งต่อแผนก: คลังอะไหล่/อุปกรณ์', note:''},{ts:coAddHours(27), action:'ส่งต่อแผนก: บัญชี-การเงิน', note:''}] },
    { id:'CO003', orderNo:'CO-2026-003', customerName:'ธนพล เที่ยงตรง', phone:'062-333-4444', vehicleModel:'MG4 Electric', plate:'กท 1234', vin:'LSJW1425XN0098765', salesName:'ปทิตา เซลส์',
      items:[{name:'เคลือบแก้วตัวถัง Nano Ceramic', qty:1, unitPrice:15000}],
      discount:0, discountNote:'', freebies:[{name:'น้ำยาล้างรถ', qty:2}],
      status:'po_issued', routedDepts:['warehouse','accounting','service'],
      poNo:'PO-202607-003', supplier:'ร้านเซรามิคโค้ทติ้ง โปร', supplierContact:'คุณสมบัติ 089-777-8888', poIssuedDate:coAddDays(-3),
      history:[{ts:coAddHours(72), action:'สร้างคำสั่งแต่งรถ', note:''},{ts:coAddHours(60), action:'ส่งต่อแผนก: คลังอะไหล่/อุปกรณ์', note:''},{ts:coAddHours(50), action:'ออก PO ส่งซัพพลายเออร์', note:'ร้านเซรามิคโค้ทติ้ง โปร'}] },
    { id:'CO004', orderNo:'CO-2026-004', customerName:'อรวรรณ สาวสวย', phone:'095-555-6666', vehicleModel:'BYD Dolphin', plate:'', vin:'LC0C4CFF1P0011223', salesName:'สมชาย เซลส์',
      items:[{name:'ระบบเสียง Subwoofer + แอมป์', qty:1, unitPrice:22000},{name:'ฟิล์มกันรอยกันชน', qty:1, unitPrice:4500}],
      discount:1500, discountNote:'', freebies:[],
      status:'installing', routedDepts:['warehouse','accounting','service','salesAdmin'],
      poNo:'PO-202606-004', supplier:'บ. ซาวด์โปร ออดิโอ', supplierContact:'คุณกิตติ 081-999-0000', poIssuedDate:coAddDays(-6), installDate:coAddDays(-1),
      history:[{ts:coAddHours(150), action:'สร้างคำสั่งแต่งรถ', note:''},{ts:coAddHours(140), action:'ออก PO ส่งซัพพลายเออร์', note:'บ. ซาวด์โปร ออดิโอ'},{ts:coAddHours(48), action:'กำหนดวันติดตั้ง', note:''},{ts:coAddHours(20), action:'อัปเดตสถานะติดตั้ง: กำลังติดตั้ง', note:''}] },
    { id:'CO005', orderNo:'CO-2026-005', customerName:'ชัยวัฒน์ มั่งมี', phone:'086-777-1111', vehicleModel:'BYD Han', plate:'ขข 5678', vin:'LC0C4CFF1P0099887', salesName:'วิชัย ยอดขาย',
      items:[{name:'ชุดไฟ LED Daytime Running Light', qty:1, unitPrice:9500}],
      discount:0, discountNote:'', freebies:[],
      status:'issue_found', routedDepts:['warehouse','accounting','service'],
      poNo:'PO-202606-005', supplier:'ร้าน LED Custom Design', supplierContact:'คุณอนันต์ 084-222-3333', poIssuedDate:coAddDays(-8), installDate:coAddDays(-2),
      defectNotes:'ไฟ LED ข้างซ้ายกะพริบผิดปกติ ต้องเปลี่ยนชุดใหม่จากซัพพลายเออร์',
      history:[{ts:coAddHours(200), action:'สร้างคำสั่งแต่งรถ', note:''},{ts:coAddHours(190), action:'ออก PO ส่งซัพพลายเออร์', note:'ร้าน LED Custom Design'},{ts:coAddHours(60), action:'กำหนดวันติดตั้ง', note:''},{ts:coAddHours(10), action:'อัปเดตสถานะติดตั้ง: พบปัญหา', note:'ไฟ LED ข้างซ้ายกะพริบผิดปกติ'}] },
    { id:'CO006', orderNo:'CO-2026-006', customerName:'นภา สุขสม', phone:'091-444-5555', vehicleModel:'BYD Atto 3 Pro', plate:'', vin:'LC0C4CFF1P0077665', salesName:'ปทิตา เซลส์',
      items:[{name:'ฟิล์มกรองแสง Ceramic Pro', qty:1, unitPrice:16000},{name:'พรมยาง 6 ชิ้น All-Weather', qty:1, unitPrice:2800}],
      discount:0, discountNote:'', freebies:[],
      status:'ready', routedDepts:['warehouse','accounting','service','salesAdmin'],
      poNo:'PO-202606-006', supplier:'บริษัท ออโต้ พาร์ท จก.', supplierContact:'คุณสมศักดิ์ 089-111-2233', poIssuedDate:coAddDays(-10), installDate:coAddDays(-4), readyAt:coAddHours(6),
      history:[{ts:coAddHours(250), action:'สร้างคำสั่งแต่งรถ', note:''},{ts:coAddHours(230), action:'ออก PO ส่งซัพพลายเออร์', note:'บริษัท ออโต้ พาร์ท จก.'},{ts:coAddHours(100), action:'กำหนดวันติดตั้ง', note:''},{ts:coAddHours(30), action:'อัปเดตสถานะติดตั้ง: ตรวจสอบคุณภาพ', note:''},{ts:coAddHours(6), action:'ยืนยันพร้อมส่งมอบ', note:''}] },
  ]
  customOrdersDemo.forEach(o => { if (!demoCol('custom_orders')[o.id]) demoCol('custom_orders')[o.id] = o })


  const withholdingTaxDemo = [
    { id:'WHT001', certNo:'WHT-2026-0001', payeeName:'บริษัท ออโต้ พาร์ท จก.', payeeTaxId:'0105561001234', payeeAddress:'123 ถ.สุขุมวิท กรุงเทพฯ', incomeType:'service', incomeTypeLabel:'ค่าจ้างทำของ/บริการ (มาตรา 40(8))', paymentDate:wtAddDays(-20), amountPaid:45000, taxRate:3, taxWithheld:1350, issuedBy:'สมศรี การเงิน' },
    { id:'WHT002', certNo:'WHT-2026-0002', payeeName:'คุณสมชาย ใจดี', payeeTaxId:'1103700123456', payeeAddress:'88 ถ.พระราม 4 กรุงเทพฯ', incomeType:'rent', incomeTypeLabel:'ค่าเช่าทรัพย์สิน (มาตรา 40(5))', paymentDate:wtAddDays(-15), amountPaid:25000, taxRate:5, taxWithheld:1250, issuedBy:'สมศรี การเงิน' },
    { id:'WHT003', certNo:'WHT-2026-0003', payeeName:'บจก. ไทยทำความสะอาด', payeeTaxId:'0105562009876', payeeAddress:'45 ถ.รัชดาภิเษก กรุงเทพฯ', incomeType:'service', incomeTypeLabel:'ค่าจ้างทำของ/บริการ (มาตรา 40(8))', paymentDate:wtAddDays(-8), amountPaid:24000, taxRate:3, taxWithheld:720, issuedBy:'สมศรี การเงิน' },
    { id:'WHT004', certNo:'WHT-2026-0004', payeeName:'ขนส่งไทยเซ็นทรัล', payeeTaxId:'0105563004567', payeeAddress:'99 ถ.บางนา-ตราด กรุงเทพฯ', incomeType:'transport', incomeTypeLabel:'ค่าขนส่ง', paymentDate:wtAddDays(-3), amountPaid:18000, taxRate:1, taxWithheld:180, issuedBy:'สมศรี การเงิน' },
  ]
  withholdingTaxDemo.forEach(c => { if (!demoCol('withholding_tax_certs')[c.id]) demoCol('withholding_tax_certs')[c.id] = c })


  const teamTargetsDemo = [
    { id:'TT001', department:'ฝ่ายขาย', team:'ทีม A', metric:'units', period:ttPeriod, target:20, actual:18 },
    { id:'TT002', department:'ฝ่ายขาย', team:'ทีม B', metric:'units', period:ttPeriod, target:18, actual:12 },
    { id:'TT003', department:'ฝ่ายขาย', team:'', metric:'revenue', period:ttPeriod, target:45000000, actual:38500000 },
    { id:'TT004', department:'ฝ่ายบริการ', team:'', metric:'service', period:ttPeriod, target:350, actual:312 },
    { id:'TT005', department:'ฝ่ายบริการ', team:'', metric:'csat', period:ttPeriod, target:90, actual:94 },
    { id:'TT006', department:'ฝ่ายการเงิน', team:'', metric:'other', period:ttPeriod, target:100, actual:96 },
    { id:'TT007', department:'ฝ่าย HR', team:'', metric:'leads', period:ttPeriod, target:12, actual:5 },
  ]
  teamTargetsDemo.forEach(t => { if (!demoCol('team_targets')[t.id]) demoCol('team_targets')[t.id] = t })


  const employeeEvaluationsDemo = [
    { id:'EK001', staffId:'st2', periodType:'daily', periodValue:new Date().toISOString().slice(0,10), criteriaScores:{quality:85,quantity:80,punctual:95,attitude:90,initiative:75}, overallScore:85, strengths:'ปิดยอดขายได้ตามเป้าทุกวัน', improvements:'ควรติดตามลูกค้าหลังขายให้เร็วขึ้น', reviewer:'ผู้จัดการขาย', createdAt:ekAddDays(-1) },
    { id:'EK002', staffId:'st3', periodType:'weekly', periodValue:(() => { const d = new Date(); const jan1 = new Date(d.getFullYear(),0,1); const days = Math.floor((d-jan1)/86400000); const week = Math.ceil((days+jan1.getDay()+1)/7); return d.getFullYear()+'-W'+String(week).padStart(2,'0') })(), criteriaScores:{quality:70,quantity:65,punctual:80,attitude:75,initiative:60}, overallScore:70, strengths:'ขยัน ตั้งใจ', improvements:'ต้องพัฒนาเทคนิคปิดการขาย', reviewer:'ผู้จัดการขาย', createdAt:ekAddDays(-3) },
    { id:'EK003', staffId:'st4', periodType:'monthly', periodValue:new Date().toISOString().slice(0,7), criteriaScores:{quality:90,quantity:88,punctual:100,attitude:92,initiative:80}, overallScore:90, strengths:'งานซ่อมแม่นยำ รวดเร็ว ลูกค้าพึงพอใจสูง', improvements:'ทักษะ EV Battery ขั้นสูงต้องพัฒนาเพิ่ม', reviewer:'หัวหน้าช่าง', createdAt:ekAddDays(-5) },
    { id:'EK004', staffId:'st5', periodType:'monthly', periodValue:new Date().toISOString().slice(0,7), criteriaScores:{quality:55,quantity:50,punctual:60,attitude:65,initiative:45}, overallScore:55, strengths:'ตั้งใจเรียนรู้งานใหม่', improvements:'ความเร็วในการทำงานและความแม่นยำต้องพัฒนาอีกมาก อยู่ระหว่างทดลองงาน', reviewer:'หัวหน้าช่าง', createdAt:ekAddDays(-5) },
    { id:'EK005', staffId:'st2', periodType:'yearly', periodValue:String(new Date().getFullYear()), criteriaScores:{quality:88,quantity:85,punctual:92,attitude:90,initiative:82}, overallScore:87, strengths:'พนักงานขายดีเด่นประจำปี ยอดขายเกินเป้าต่อเนื่อง', improvements:'พัฒนาทักษะการขายลูกค้าองค์กร (B2B) เพิ่มเติม', reviewer:'ผู้บริหาร', createdAt:ekAddDays(-20) },
  ]
  employeeEvaluationsDemo.forEach(e => { if (!demoCol('employee_evaluations')[e.id]) demoCol('employee_evaluations')[e.id] = e })


  const billingRunsDemo = [
    { id:'BR001', runNo:'BR-2026-0001', customerName:'วิชัย เดินดี', invoiceIds:['D002'], totalAmount:1282930, submittedDate:brAddDays(-10), dueDate:brAddDays(5), status:'submitted' },
    { id:'BR002', runNo:'BR-2026-0002', customerName:'อนุชา รวยมาก', invoiceIds:['D005'], totalAmount:1122430, submittedDate:brAddDays(-30), dueDate:brAddDays(-15), status:'submitted' },
  ]
  billingRunsDemo.forEach(r => { if (!demoCol('billing_runs')[r.id]) demoCol('billing_runs')[r.id] = r })


  const autoSendRulesDemo = [
    { id:'ASR1', name:'รถใหม่ — ส่ง Email', trigger:'purchase', channel:'email', active:true },
    { id:'ASR2', name:'ซ่อม — ส่ง LINE', trigger:'service', channel:'line', active:true },
    { id:'ASR3', name:'ประกัน — ส่ง SMS', trigger:'insurance', channel:'sms', active:true },
    { id:'ASR4', name:'อะไหล่ — ส่ง LINE', trigger:'parts', channel:'line', active:false },
  ]
  autoSendRulesDemo.forEach(r => { if (!demoCol('auto_send_rules')[r.id]) demoCol('auto_send_rules')[r.id] = r })


  const kbArticlesDemo = [
    { id:'KB001', title:'สเปคเต็ม BYD Seal AWD + จุดขายเทียบคู่แข่ง', cat:'product', author:'ผจก.ขาย', views:234, helpful:41, updated:kbAddDays(-10), excerpt:'มอเตอร์คู่ 390kW, 0-100 ใน 3.8 วิ, แบต 82.56 kWh — จุดขายหลักเทียบ Tesla Model 3...' },
    { id:'KB002', title:'วิธีตอบเมื่อลูกค้าถาม "แบตเสื่อมไหม เปลี่ยนแพงไหม"', cat:'sales', author:'วิชัย ยอดขาย', views:189, helpful:38, updated:kbAddDays(-5), excerpt:'ใช้ข้อมูลจริง: รับประกันแบต 8 ปี/160,000 km + SOH เฉลี่ยหลัง 3 ปียังเกิน 88%...' },
    { id:'KB003', title:'SOP ทำงานกับระบบไฟแรงสูง (HV) — บังคับอ่าน', cat:'service', author:'วิทยา ช่างใหญ่', views:156, helpful:52, updated:kbAddDays(-30), excerpt:'ก่อนแตะระบบ HV ทุกครั้ง: ปิดระบบ → ถอด service plug → รอ 10 นาที → วัดไฟยืนยัน 0V...' },
    { id:'KB004', title:'วิธีสร้างใบเสนอราคาใน LAMOM ONE', cat:'system', author:'Admin', views:98, helpful:22, updated:kbAddDays(-15), excerpt:'ไปที่ การขาย → ใบเสนอราคา → เลือกลูกค้า → เลือกรุ่น/สี/ของแถม → ระบบคำนวณให้...' },
    { id:'KB005', title:'ระเบียบการลา + วิธียื่นในระบบ', cat:'policy', author:'HR', views:145, helpful:30, updated:kbAddDays(-60), excerpt:'ลาป่วยแจ้งก่อน 9:00 / ลากิจล่วงหน้า 3 วัน / ลาพักร้อนล่วงหน้า 7 วัน — ยื่นผ่าน HR → ลาพนักงาน...' },
    { id:'KB006', title:'Troubleshooting: ลูกค้าชาร์จไฟไม่เข้า เช็คอะไรบ้าง', cat:'service', author:'สุรชัย มือดี', views:121, helpful:35, updated:kbAddDays(-7), excerpt:'1) เช็คสาย/หัวชาร์จ 2) ดู error code บนจอ 3) ทดสอบกับตู้ชาร์จศูนย์ 4) อ่านค่า OBC...' },
  ]
  kbArticlesDemo.forEach(a => { if (!demoCol('kb_articles')[a.id]) demoCol('kb_articles')[a.id] = a })


  const staffPointsSeed = [
    { id:'sp1', name:'วิชัย ยอดขาย', points:3450 },
    { id:'sp2', name:'สุดา มาดี', points:2890 },
    { id:'sp3', name:'วิทยา ช่างใหญ่', points:2640 },
    { id:'sp4', name:'ธนา เก่ง', points:1820 },
    { id:'sp5', name:'มานะ ขยัน', points:1100 },
  ]
  staffPointsSeed.forEach(s => { if (!demoCol('staff_points')[s.id]) demoCol('staff_points')[s.id] = s })


  const rewardRedemptions = [
    { id:'rr1', staff:'สุดา มาดี', reward:'บัตรน้ำมัน 500 บาท', points:500, createdAt: new Date(Date.now()-3600000*5).toISOString() },
    { id:'rr2', staff:'วิชัย ยอดขาย', reward:'ลาพิเศษ 1 วัน', points:2000, createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'rr3', staff:'มานะ ขยัน', reward:'ออกก่อนเวลา 2 ชม.', points:600, createdAt: new Date(Date.now()-86400000*3).toISOString() },
  ]
  rewardRedemptions.forEach(r => { if (!demoCol('reward_redemptions')[r.id]) demoCol('reward_redemptions')[r.id] = r })



  const gamificationChallenges = [
    { id:'CH001', name:'ปิด 5 ดีลภายในสัปดาห์', type:'sales', reward:'🏆 โบนัส 5,000 บาท', target:5, participants:[
      { name:'วิชัย ยอดขาย', progress:4 }, { name:'สุดา มาดี', progress:3 }, { name:'ธนา เก่ง', progress:2 },
    ], endDate:addDaysISO(3), status:'active' },
    { id:'CH002', name:'Test Drive 10 ครั้งในเดือนนี้', type:'lead', reward:'🎖 Badge "Test Drive Master" + 2,000 บาท', target:10, participants:[
      { name:'วิชัย ยอดขาย', progress:8 }, { name:'ธนา เก่ง', progress:10 }, { name:'สุดา มาดี', progress:6 },
    ], endDate:addDaysISO(12), status:'active' },
    { id:'CH003', name:'CSAT 4.8+ ทั้งสัปดาห์ (ทีมบริการ)', type:'service', reward:'🍕 เลี้ยงอาหารทีม', target:1, participants:[
      { name:'ทีมบริการ', progress:1 },
    ], endDate:addDaysISO(-1), status:'completed' },
    { id:'CH004', name:'แข่งระหว่างสาขา — ยอดขายรวมสูงสุด', type:'team', reward:'🏆 ถ้วยรางวัล + ทริปทีม', target:30, participants:[
      { name:'สาขาบางนา', progress:22 }, { name:'สาขารามอินทรา', progress:18 },
    ], endDate:addDaysISO(20), status:'active' },
  ]
  gamificationChallenges.forEach(c => { if (!demoCol('gamification_challenges')[c.id]) demoCol('gamification_challenges')[c.id] = c })


  const marketingReviews = [
    { id:'MR001', author:'สมชาย ใจดี', platform:'google', rating:5, text:'บริการดีมาก พนักงานเป็นมิตร ขอบคุณมากครับ', status:'pending', time:daysAgoISO(1), reply:'' },
    { id:'MR002', author:'มาลี สุขใจ', platform:'facebook', rating:4, text:'ชอบรถมากค่ะ แต่รอนานหน่อย', status:'replied', time:daysAgoISO(2), reply:'ขอบคุณมากค่ะ เราจะปรับปรุงเวลาบริการให้ดีขึ้น' },
    { id:'MR003', author:'ธนพล เที่ยงตรง', platform:'google', rating:3, text:'โชว์รูมสวย แต่ราคาค่อนข้างแพง', status:'pending', time:daysAgoISO(3), reply:'' },
    { id:'MR004', author:'อรทัย ตั้งใจ', platform:'tiktok', rating:5, text:'ประทับใจมากเลยค่ะ เซลส์ใจดีมาก แนะนำเลย!', status:'replied', time:daysAgoISO(4), reply:'ขอบคุณมากๆ เลยค่ะ 🙏' },
    { id:'MR005', author:'ไม่ระบุชื่อ', platform:'google', rating:1, text:'บริการแย่มาก รออยู่นานมากแต่ไม่มีใครสนใจ', status:'flagged', time:daysAgoISO(5), reply:'' },
    { id:'MR006', author:'วิชัย มาดี', platform:'internal', rating:5, text:'ซื้อรถคุ้มมาก battery ดี ขับสนุก ชาร์จง่าย', status:'replied', time:daysAgoISO(7), reply:'ขอบคุณครับ ยินดีดูแลตลอดนะครับ' },
  ]
  marketingReviews.forEach(r => { if (!demoCol('marketing_reviews')[r.id]) demoCol('marketing_reviews')[r.id] = r })


  const eventVisitors = [
    { id:'EV001', name:'ประยุทธ์ สนใจ', phone:'081-111', model:'BYD Seal AWD', interest:'hot', staff:'วิชัย', time:minutesAgoISO(10), gift:true, testDrive:true },
    { id:'EV002', name:'สมหญิง ดูรถ', phone:'082-222', model:'BYD Dolphin', interest:'warm', staff:'สุดา', time:minutesAgoISO(35), gift:true, testDrive:false },
    { id:'EV003', name:'อนันต์ ผ่านมา', phone:'', model:'ยังไม่แน่ใจ', interest:'browse', staff:'ธนา', time:minutesAgoISO(50), gift:false, testDrive:false },
    { id:'EV004', name:'กานดา อยากได้', phone:'084-444', model:'BYD Atto 3', interest:'hot', staff:'วิชัย', time:minutesAgoISO(80), gift:true, testDrive:true },
    { id:'EV005', name:'วีระ เปรียบเทียบ', phone:'085-555', model:'MG4', interest:'warm', staff:'สุดา', time:minutesAgoISO(120), gift:true, testDrive:false },
  ]
  eventVisitors.forEach(v => { if (!demoCol('event_visitors')[v.id]) demoCol('event_visitors')[v.id] = v })


  const marketingEvents = [
    { id:'MEV001', title:'BYD Seal AWD Launch Party', type:'launch', status:'done', startDate:'2025-04-20', endDate:'2025-04-20', venue:'โชว์รูม LAMOM สาขาหลัก', budget:150000, spent:142000, attendees:85, leads:12, sales:3, description:'งาน Launch BYD Seal AWD รุ่นใหม่ มีการแสดง Performance ของรถ', tasks:['จัดเตรียมสถานที่ ✅','ติดต่อ Influencer 2 คน ✅','เตรียมอาหารเครื่องดื่ม ✅','นำเสนอราคาและโปรโมชัน ✅'] },
    { id:'MEV002', title:'EV Test Drive Weekend', type:'testdrive', status:'confirmed', startDate:evAddDays(5), endDate:evAddDays(6), venue:'ลานจอดรถ LAMOM ONE BKK', budget:80000, spent:35000, attendees:0, leads:0, sales:0, description:'เปิดโอกาสให้ลูกค้าทดลองขับรถ EV ทุกรุ่น', tasks:['จองพื้นที่ ✅','เตรียมรถสาธิต 5 คัน','ประกาศ Social Media','รับลงทะเบียน'] },
    { id:'MEV003', title:'Motor Expo 2025', type:'expo', status:'planning', startDate:'2025-11-28', endDate:'2025-12-09', venue:'Impact Arena เมืองทองธานี', budget:2000000, spent:500000, attendees:0, leads:0, sales:0, description:'เข้าร่วม Motor Expo 2025 บูธใหญ่ 200 ตร.ม.', tasks:['จองบูธ ✅','ออกแบบบูธ','สั่งซื้อสื่อ','เตรียมทีม 15 คน','วางแผนโปรโมชัน'] },
    { id:'MEV004', title:'VIP Customer Appreciation', type:'vip', status:'confirmed', startDate:evAddDays(20), endDate:evAddDays(20), venue:'โรงแรม Centara Grand', budget:200000, spent:80000, attendees:0, leads:0, sales:0, description:'งานเลี้ยงขอบคุณลูกค้า VIP ประจำปี 2025', tasks:['Book ห้องจัดงาน ✅','เตรียมของที่ระลึก','เชิญลูกค้า 50 ท่าน','เตรียมโปรโมชัน Renewal'] },
    { id:'MEV005', title:'EV Ownership Workshop', type:'workshop', status:'done', startDate:'2025-05-10', endDate:'2025-05-10', venue:'โชว์รูม LAMOM สาขาหลัก', budget:30000, spent:28500, attendees:25, leads:5, sales:1, description:'สอนการดูแลรักษารถ EV การชาร์จที่บ้าน และการใช้งาน', tasks:['เตรียมสไลด์ ✅','จัดเตรียมอาหาร ✅','เชิญวิทยากร ✅','ดำเนินการ ✅'] },
    { id:'MEV006', title:'Social Media Live: BYD กับชีวิตประจำวัน', type:'online', status:'done', startDate:'2025-03-15', endDate:'2025-03-15', venue:'Online / Facebook Live', budget:15000, spent:12000, attendees:320, leads:18, sales:2, description:'Live ขายรถผ่าน Facebook ร่วมกับ Influencer EV', tasks:['ประสาน Influencer ✅','เตรียมสคริปต์ ✅','Live 2 ชั่วโมง ✅','Follow up leads ✅'] },
  ]
  marketingEvents.forEach(e => { if (!demoCol('marketing_events')[e.id]) demoCol('marketing_events')[e.id] = e })


  const leadGenCampaigns = [
    { id:'LG001', name:'BYD Seal Summer 2025', channel:'facebook', status:'active',
      budget:50000, spent:38500, impressions:285000, clicks:4200, leads:89, qualified:34, closed:8,
      cpc:9.2, cpl:432, cpa:4800, startDate:lgAddDays(-30), endDate:lgAddDays(15),
      targetModel:'BYD Seal', audience:'อายุ 28-45 มีรถ' },
    { id:'LG002', name:'EV Test Drive June', channel:'line', status:'active',
      budget:20000, spent:14200, impressions:45000, clicks:1850, leads:42, qualified:18, closed:5,
      cpc:7.7, cpl:338, cpa:2840, startDate:lgAddDays(-14), endDate:lgAddDays(16),
      targetModel:'ทุกรุ่น', audience:'ผู้ติดตาม LINE OA' },
    { id:'LG003', name:'Google Search EV', channel:'google', status:'active',
      budget:35000, spent:29800, impressions:62000, clicks:2100, leads:38, qualified:22, closed:6,
      cpc:14.2, cpl:784, cpa:4967, startDate:lgAddDays(-21), endDate:lgAddDays(9),
      targetModel:'ทุกรุ่น', audience:'ค้นหา EV Car' },
    { id:'LG004', name:'Motor Expo 2024', channel:'event', status:'ended',
      budget:120000, spent:115000, impressions:0, clicks:0, leads:215, qualified:88, closed:24,
      cpc:0, cpl:535, cpa:4792, startDate:lgAddDays(-180), endDate:lgAddDays(-150),
      targetModel:'ทุกรุ่น', audience:'ผู้เข้าชมงาน' },
  ]
  leadGenCampaigns.forEach(c => { if (!demoCol('lead_gen_campaigns')[c.id]) demoCol('lead_gen_campaigns')[c.id] = c })


  const lineOaBroadcasts = [
    { id:'LB001', name:'โปรเดือนมิ.ย. — BYD Dolphin ลด 50K', type:'rich', sent:4500, opened:2890, clicked:645, status:'sent', time:loAddDays(-5) },
    { id:'LB002', name:'คูปองส่วนลดบริการ 20%', type:'coupon', sent:4480, opened:3120, clicked:890, status:'sent', time:loAddDays(-12) },
    { id:'LB003', name:'เชิญงาน Open House เสาร์นี้', type:'broadcast', sent:0, opened:0, clicked:0, status:'scheduled', time:loAddDays(2) },
  ]
  lineOaBroadcasts.forEach(b => { if (!demoCol('line_oa_broadcasts')[b.id]) demoCol('line_oa_broadcasts')[b.id] = b })


  const lineOaAutoReplies = [
    { id:'AR01', keyword:'ราคา, เท่าไหร่, กี่บาท', reply:'ดูราคาทุกรุ่นได้ที่ lamom.one/price หรือพิมพ์ชื่อรุ่นที่สนใจได้เลยค่ะ 😊', active:true, triggers30d:234 },
    { id:'AR02', keyword:'ทดลองขับ, test drive', reply:'นัดทดลองขับฟรี! แจ้งวัน-เวลาที่สะดวก หรือโทร 02-xxx-xxxx ค่ะ 🚗', active:true, triggers30d:156 },
    { id:'AR03', keyword:'เช็คระยะ, นัดซ่อม, ศูนย์', reply:'นัดเช็คระยะ: แจ้งทะเบียนรถ + วันที่สะดวกได้เลยค่ะ มีบริการรับ-ส่งฟรี 10 กม. 🔧', active:true, triggers30d:189 },
    { id:'AR04', keyword:'ที่อยู่, แผนที่, พิกัด', reply:'โชว์รูม LAMOM: ถนนบางนา-ตราด กม.5 เปิดทุกวัน 8:30-18:00 📍 maps.app/lamom', active:true, triggers30d:98 },
    { id:'AR05', keyword:'ผ่อน, ไฟแนนซ์, ดาวน์', reply:'คำนวณค่างวดเบื้องต้น: แจ้งรุ่น + เงินดาวน์ที่ต้องการ เดี๋ยวทีมงานคำนวณให้ค่ะ 🏦', active:false, triggers30d:0 },
  ]
  lineOaAutoReplies.forEach(a => { if (!demoCol('line_oa_auto_replies')[a.id]) demoCol('line_oa_auto_replies')[a.id] = a })


  const serviceBayQueue = [
    { id:'q1', job:'JC-2410', car:'MG4 · 4กค-1100', service:'เช็คระยะ 20,000', need:'ทั่วไป' },
    { id:'q2', job:'JC-2411', car:'BYD Atto 3 · 5ขข-2200', service:'เปลี่ยนยาง+ตั้งศูนย์', need:'ช่วงล่าง' },
    { id:'q3', job:'JC-2412', car:'BYD Seal · 6กก-3300', service:'อัปเดตซอฟต์แวร์', need:'EV' },
  ]
  serviceBayQueue.forEach(q => { if (!demoCol('service_bay_queue')[q.id]) demoCol('service_bay_queue')[q.id] = q })


  const csSubMins = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  const chargingStations = [
    { id:'CS01', name:'Charger A1', type:'dc_150', status:'in_use', power:150, soc:62, vehicle:'BYD Seal AWD · 1กข-1234', startTime:csSubMins(45), estFinish:csAddMins(25), energy:28.5 },
    { id:'CS02', name:'Charger A2', type:'dc_150', status:'available', power:150, soc:0, vehicle:null, startTime:null, estFinish:null, energy:0 },
    { id:'CS03', name:'Charger B1', type:'dc_50', status:'reserved', power:50, soc:0, vehicle:'BYD Atto 3 · 2ขค-5678', startTime:null, estFinish:csAddMins(15), energy:0 },
    { id:'CS04', name:'Charger B2', type:'dc_50', status:'in_use', power:50, soc:78, vehicle:'MG ZS EV · 3คง-9012', startTime:csSubMins(80), estFinish:csAddMins(10), energy:42.1 },
    { id:'CS05', name:'Charger C1', type:'ac_22', status:'available', power:22, soc:0, vehicle:null, startTime:null, estFinish:null, energy:0 },
    { id:'CS06', name:'Charger C2', type:'ac_22', status:'offline', power:22, soc:0, vehicle:null, startTime:null, estFinish:null, energy:0 },
    { id:'CS07', name:'Charger D1', type:'ac_7', status:'maintenance', power:7, soc:0, vehicle:null, startTime:null, estFinish:null, energy:0 },
    { id:'CS08', name:'Charger D2', type:'ac_7', status:'available', power:7, soc:0, vehicle:null, startTime:null, estFinish:null, energy:0 },
  ]
  chargingStations.forEach(c => { if (!demoCol('charging_stations')[c.id]) demoCol('charging_stations')[c.id] = c })


  const courtesyCarJobs = [
    { id:'PD001', customer:'สมชาย ใจดี', phone:'085-111', plate:'1กข-1234', address:'คอนโด Ideo สุขุมวิท 93', distance:8, type:'both', status:'servicing', driver:'สมบัติ ขับดี', scheduledAt:pdAddHours(-3), service:'เช็คระยะ 20,000 km' },
    { id:'PD002', customer:'มาลี สุขใจ', phone:'086-222', plate:'2ขค-5678', address:'หมู่บ้านพฤกษา บางนา', distance:5, type:'pickup', status:'enroute', driver:'อนันต์ ปลอดภัย', scheduledAt:pdAddHours(0), service:'เปลี่ยนยาง 4 เส้น' },
    { id:'PD003', customer:'ธนพล เที่ยงตรง', phone:'087-333', plate:'3คง-9012', address:'ออฟฟิศ Empire Tower สาทร', distance:15, type:'delivery', status:'scheduled', driver:null, scheduledAt:pdAddHours(4), service:'ซ่อมเสร็จแล้ว — รอส่งคืน' },
    { id:'PD004', customer:'อรทัย ตั้งใจ', phone:'088-444', plate:'4งจ-3456', address:'บ้านเดี่ยว ลาดกระบัง', distance:12, type:'both', status:'completed', driver:'สมบัติ ขับดี', scheduledAt:pdAddHours(-26), service:'ตรวจแบตเตอรี่' },
  ]
  courtesyCarJobs.forEach(j => { if (!demoCol('courtesy_car_jobs')[j.id]) demoCol('courtesy_car_jobs')[j.id] = j })


  const evBatteryVehicles = [
    { id:'V001', plate:'1กข-1234', model:'BYD Seal AWD', year:2023, owner:'สมชาย ใจดี', soh:94, soc:78, cycles:180, capacity:82.56, originalCapacity:87.9, lastCheck:evAddDays2(-30), range:498, nextCheck:evAddDays2(60) },
    { id:'V002', plate:'2ขค-5678', model:'BYD Dolphin', year:2022, owner:'มาลี สุขใจ', soh:87, soc:45, cycles:340, capacity:42.0, originalCapacity:44.9, lastCheck:evAddDays2(-15), range:310, nextCheck:evAddDays2(75) },
    { id:'V003', plate:'3คง-9012', model:'MG ZS EV', year:2021, owner:'ธนพล เที่ยงตรง', soh:74, soc:62, cycles:520, capacity:39.5, originalCapacity:50.3, lastCheck:evAddDays2(-7), range:268, nextCheck:evAddDays2(23) },
    { id:'V004', plate:'4งจ-3456', model:'BYD Atto 3', year:2023, owner:'อรทัย ตั้งใจ', soh:92, soc:91, cycles:90, capacity:58.7, originalCapacity:60.5, lastCheck:evAddDays2(-45), range:412, nextCheck:evAddDays2(15) },
    { id:'V005', plate:'5จฉ-7890', model:'BYD Han', year:2022, owner:'วิรัช เก่งมาก', soh:68, soc:33, cycles:680, capacity:64.6, originalCapacity:85.4, lastCheck:evAddDays2(-90), range:380, nextCheck:evAddDays2(-15) },
  ]
  evBatteryVehicles.forEach(v => { if (!demoCol('ev_battery_vehicles')[v.id]) demoCol('ev_battery_vehicles')[v.id] = v })


  const evDiagnosticScans = [
    { id:'EV001', vehiclePlate:'กก 1234', vehicleModel:'BYD Seal AWD', vin:'LBWAB2EB7PD001002',
      mileage:12500, customerId:'C001', customerName:'วิชาญ มีโชค', technicianName:'วิทยา ช่างไฟ',
      scanDate:evdAddMins(30), status:'normal', faultCodes:[],
      data:{ battSOC:78, battSOH:97, cellMinV:3.26, cellMaxV:3.28, battTemp:28, range:425, odometer:12500, chargeCount:48, dcFastCount:8, motorTemp:42, motorEfficiency:96 },
      notes:'แบตอยู่ในสภาพดีมาก' },
    { id:'EV002', vehiclePlate:'ขข 5678', vehicleModel:'MG ZS EV', vin:'LSJWSRAR7NE001008',
      mileage:31200, customerId:'C002', customerName:'อรนุช สาวสวย', technicianName:'วิทยา ช่างไฟ',
      scanDate:evdAddMins(120), status:'warning', faultCodes:['P0A80','P0562'],
      data:{ battSOC:65, battSOH:88, cellMinV:3.18, cellMaxV:3.31, battTemp:35, range:320, odometer:31200, chargeCount:142, dcFastCount:45, motorTemp:55, motorEfficiency:91 },
      notes:'SOH ต่ำลง — ควรตรวจเช็ก DC fast charge' },
    { id:'EV003', vehiclePlate:'คค 9012', vehicleModel:'BYD Atto 3', vin:'LBWAB2EB7PD001003',
      mileage:3100, customerId:'C003', customerName:'ธีรยุทธ เก่งกาจ', technicianName:'สมชาย ช่างฝีมือ',
      scanDate:evdAddMins(60), status:'critical', faultCodes:['P1A0D'],
      data:{ battSOC:55, battSOH:99, cellMinV:3.22, cellMaxV:3.24, battTemp:29, range:380, odometer:3100, chargeCount:12, dcFastCount:2, motorTemp:38, motorEfficiency:97 },
      notes:'OBC fault — ชาร์จไม่ได้ AC ต้องซ่อม' },
  ]
  evDiagnosticScans.forEach(s => { if (!demoCol('ev_diagnostic_scans')[s.id]) demoCol('ev_diagnostic_scans')[s.id] = s })


  const loanerLoans = [
    { id:'LL001', carId:'LC002', carPlate:'กท-9002 กทม.', carModel:'Honda City 2023', custName:'สมชาย ใจดี', phone:'0812345678', jobCard:'JOB-2025-001', loanDate:'2025-06-07', returnDate:'2025-06-10', actualReturn:null, fuelOut:60, fuelIn:null, kmOut:32100, kmIn:null, status:'active', deposit:5000 },
    { id:'LL002', carId:'LC001', carPlate:'กท-9001 กทม.', carModel:'Toyota Yaris 2022', custName:'วิชัย เดินดี', phone:'0834567890', jobCard:'JOB-2025-002', loanDate:'2025-06-01', returnDate:'2025-06-05', actualReturn:'2025-06-05', fuelOut:80, fuelIn:75, kmOut:44800, kmIn:45200, status:'returned', deposit:5000 },
  ]
  loanerLoans.forEach(l => { if (!demoCol('loaner_loans')[l.id]) demoCol('loaner_loans')[l.id] = l })


  const partsOrders = [
    { id:'PO001', supplier:'BYD Parts Thailand', status:'received',
      createdDate:poAddDays(-14), orderDate:poAddDays(-12), expectedDate:poAddDays(-5), receivedDate:poAddDays(-3),
      total:87500, notes:'สต็อกอะไหล่ประจำเดือน', createdBy:'วิชาญ ช่างซ่อม',
      items:[
        { partNo:'BYD-BR-001', name:'ผ้าเบรกหน้า BYD Seal', cat:'brake', qty:10, unit:'ชุด', unitCost:2800, received:10 },
        { partNo:'BYD-FL-002', name:'กรองน้ำมันเครื่อง', cat:'filter', qty:20, unit:'ชิ้น', unitCost:450, received:20 },
        { partNo:'BYD-EV-003', name:'น้ำยาระบายความร้อน EV', cat:'ev', qty:15, unit:'ลิตร', unitCost:380, received:15 },
      ] },
    { id:'PO002', supplier:'MG Parts Center', status:'ordered',
      createdDate:poAddDays(-3), orderDate:poAddDays(-2), expectedDate:poAddDays(5), receivedDate:null,
      total:34200, notes:'', createdBy:'วิชาญ ช่างซ่อม',
      items:[
        { partNo:'MG-BR-001', name:'ผ้าเบรกหลัง MG ZS EV', cat:'brake', qty:6, unit:'ชุด', unitCost:2100, received:0 },
        { partNo:'MG-FL-003', name:'กรองอากาศ MG ZS', cat:'filter', qty:8, unit:'ชิ้น', unitCost:890, received:0 },
        { partNo:'MG-TY-001', name:'ยาง Michelin 215/50R17', cat:'tyre', qty:4, unit:'เส้น', unitCost:3200, received:0 },
      ] },
    { id:'PO003', supplier:'EV Supply Co.', status:'pending',
      createdDate:poAddDays(-1), orderDate:null, expectedDate:poAddDays(10), receivedDate:null,
      total:62000, notes:'เร่งด่วน — อะไหล่ EV', createdBy:'นิภา คลังสินค้า',
      items:[
        { partNo:'EV-CH-001', name:'OBC Charger Module', cat:'ev', qty:2, unit:'ชิ้น', unitCost:18500, received:0 },
        { partNo:'EV-CA-002', name:'สาย CAN Bus', cat:'ev', qty:5, unit:'เส้น', unitCost:1200, received:0 },
        { partNo:'EV-SE-003', name:'Temp Sensor Battery', cat:'ev', qty:10, unit:'ชิ้น', unitCost:2300, received:0 },
      ] },
  ]
  partsOrders.forEach(o => { if (!demoCol('parts_orders')[o.id]) demoCol('parts_orders')[o.id] = o })


  const recallCampaigns = [
    { id:'RC001', title:'BYD Seal: Software Update v3.2.1 (BMS Fix)', brand:'BYD', model:'Seal AWD',
      recallNo:'BYD-TH-2025-001', status:'in_progress', severity:'high',
      issueDate:rcAddDays(-30), deadline:rcAddDays(90), fixDescription:'อัพเดต Firmware BMS แก้ปัญหาการชาร์จในอุณหภูมิสูง',
      totalVehicles:18, fixed:12, pending:6, declined:0, laborHours:0.5, partsCost:0 },
    { id:'RC002', title:'MG ZS EV: เปลี่ยนสายไฟ On-Board Charger', brand:'MG', model:'ZS EV',
      recallNo:'MGT-2025-EV-002', status:'open', severity:'critical',
      issueDate:rcAddDays(-14), deadline:rcAddDays(60), fixDescription:'เปลี่ยนชุดสายไฟ OBC ป้องกันความร้อนสูงเกิน',
      totalVehicles:8, fixed:0, pending:8, declined:0, laborHours:2, partsCost:4500 },
    { id:'RC003', title:'BYD Atto 3: Airbag Module Replacement', brand:'BYD', model:'Atto 3',
      recallNo:'BYD-TH-2024-012', status:'completed', severity:'critical',
      issueDate:rcAddDays(-180), deadline:rcAddDays(-10), fixDescription:'เปลี่ยน Airbag Module ทั้งหมด',
      totalVehicles:15, fixed:14, pending:0, declined:1, laborHours:3, partsCost:12000 },
  ]
  recallCampaigns.forEach(r => { if (!demoCol('recall_campaigns')[r.id]) demoCol('recall_campaigns')[r.id] = r })


  const recallCampaignVehicles = [
    { id:'RCV1', vin:'LBWAB2EB7PD001001', plate:'กก 1234', owner:'วิชัย มีโชค', phone:'085-xxx', recallId:'RC001', vStatus:'fixed', appointDate:rcAddDays(-5) },
    { id:'RCV2', vin:'LBWAB2EB7PD001002', plate:'กก 5678', owner:'สุดา ขยัน', phone:'086-xxx', recallId:'RC001', vStatus:'scheduled', appointDate:rcAddDays(3) },
    { id:'RCV3', vin:'LBWAB2EB7PD001003', plate:'กก 9012', owner:'ธนา เก่ง', phone:'087-xxx', recallId:'RC001', vStatus:'contacted', appointDate:null },
    { id:'RCV4', vin:'LSJWSRAR7NE001001', plate:'ขข 1234', owner:'อรวรรณ ดี', phone:'088-xxx', recallId:'RC002', vStatus:'pending_contact', appointDate:null },
    { id:'RCV5', vin:'LSJWSRAR7NE001002', plate:'ขข 5678', owner:'ปทิตา สาวสวย', phone:'089-xxx', recallId:'RC002', vStatus:'pending_contact', appointDate:null },
  ]
  recallCampaignVehicles.forEach(v => { if (!demoCol('recall_campaign_vehicles')[v.id]) demoCol('recall_campaign_vehicles')[v.id] = v })


  const roadsideCases = [
    { id:'RA001', customer:'สมชาย ใจดี', phone:'085-111', plate:'1กข-1234', model:'BYD Seal', type:'out_of_charge', location:'มอเตอร์เวย์ กม.32 ขาออก', status:'dispatched', reported:raAddMinutes(18), team:'ทีมกู้ภัย A (มีตู้ชาร์จเคลื่อนที่)', eta:15 },
    { id:'RA002', customer:'มาลี สุขใจ', phone:'086-222', plate:'2ขค-5678', model:'BYD Dolphin', type:'flat_tire', location:'ห้าง Mega บางนา ลานจอด B2', status:'onsite', reported:raAddMinutes(45), team:'ทีมกู้ภัย B', eta:0 },
    { id:'RA003', customer:'วิรัช เก่งมาก', phone:'089-555', plate:'5จฉ-7890', model:'BYD Han', type:'battery_dead', location:'บ้านลูกค้า ซ.ลาซาล 24', status:'resolved', reported:raAddMinutes(150), team:'ทีมกู้ภัย A', eta:0 },
    { id:'RA004', customer:'ธนพล เที่ยงตรง', phone:'087-333', plate:'3คง-9012', model:'MG ZS EV', type:'accident', location:'แยกบางนา — ชนท้าย', status:'towing', reported:raAddMinutes(90), team:'รถลาก + ประสานประกัน', eta:20 },
  ]
  roadsideCases.forEach(c => { if (!demoCol('roadside_cases')[c.id]) demoCol('roadside_cases')[c.id] = c })


  const addDaysFullISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString() }

  const pdpaDsrRequests = [
    { id:'DSR01', customer:'วิรัช เก่งมาก', type:'ขอสำเนาข้อมูล', status:'pending', received:addDaysFullISO(-2), deadline:addDaysFullISO(28) },
    { id:'DSR02', customer:'ชาตรี เข้มแข็ง', type:'ขอลบข้อมูล', status:'processing', received:addDaysFullISO(-10), deadline:addDaysFullISO(20) },
    { id:'DSR03', customer:'นภา ห่างหาย', type:'ถอนความยินยอมการตลาด', status:'done', received:addDaysFullISO(-40), deadline:addDaysFullISO(-10) },
  ]
  pdpaDsrRequests.forEach(r => { if (!demoCol('pdpa_dsr_requests')[r.id]) demoCol('pdpa_dsr_requests')[r.id] = r })


  onboardingStaff.forEach(s => { if (!demoCol('onboarding_staff')[s.id]) demoCol('onboarding_staff')[s.id] = s })


  const recruitmentApplicants = [
    { id:'AP001', jobId:'JB001', name:'สมศักดิ์ ใจดี', phone:'081-234-5678', email:'somsak@mail.com', appliedDate:'2026-05-10', status:'interview1', score:78, note:'มีประสบการณ์ขายรถ Honda 2 ปี', resumeUrl:'#' },
    { id:'AP002', jobId:'JB001', name:'สาวิตรี มีทาง', phone:'082-345-6789', email:'sawit@mail.com', appliedDate:'2026-05-12', status:'screening', score:65, note:'จบสาขาการตลาด', resumeUrl:'#' },
    { id:'AP003', jobId:'JB001', name:'อาทิตย์ รักงาน', phone:'083-456-7890', email:'adit@mail.com', appliedDate:'2026-05-15', status:'offer', score:88, note:'ขายรถ Toyota 3 ปี เป้าหมาย top 10%', resumeUrl:'#' },
    { id:'AP004', jobId:'JB002', name:'วรรณา สุขใจ', phone:'084-567-8901', email:'wanna@mail.com', appliedDate:'2026-05-20', status:'new', score:null, note:'', resumeUrl:'#' },
    { id:'AP005', jobId:'JB002', name:'ณัฐพล เก่งกาจ', phone:'085-678-9012', email:'nattapon@mail.com', appliedDate:'2026-05-18', status:'interview1', score:72, note:'มีประสบการณ์ SA Honda 1.5 ปี', resumeUrl:'#' },
    { id:'AP006', jobId:'JB003', name:'ปิยะ โซเชียล', phone:'086-789-0123', email:'piya@mail.com', appliedDate:'2026-04-15', status:'rejected', score:40, note:'ไม่มีประสบการณ์ Paid Ads', resumeUrl:'#' },
  ]
  recruitmentApplicants.forEach(a => { if (!demoCol('recruitment_applicants')[a.id]) demoCol('recruitment_applicants')[a.id] = a })


  const fleetAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const demoFleet = [
    { id: 'DM01', model: 'BYD Dolphin', plate: 'ทด-001', soc: 85, mileage: 8420, status: 'available', tdCount30: 18, lastClean: fleetAddDays(-1), insuranceExp: fleetAddDays(120), note: '' },
    { id: 'DM02', model: 'BYD Atto 3', plate: 'ทด-002', soc: 42, mileage: 12150, status: 'charging', tdCount30: 24, lastClean: fleetAddDays(0), insuranceExp: fleetAddDays(85), note: '' },
    { id: 'DM03', model: 'BYD Seal AWD', plate: 'ทด-003', soc: 91, mileage: 6890, status: 'in_use', tdCount30: 31, lastClean: fleetAddDays(-2), insuranceExp: fleetAddDays(200), note: 'ลูกค้า: ประพันธ์ มั่งมี · เซลส์: วิชัย · ออก 14:20' },
    { id: 'DM04', model: 'MG4 Electric', plate: 'ทด-004', soc: 12, mileage: 15600, status: 'maintenance', tdCount30: 9, lastClean: fleetAddDays(-5), insuranceExp: fleetAddDays(25), note: 'ยางหน้าซ้ายรั่ว — รออะไหล่' },
    { id: 'DM05', model: 'BYD Han', plate: 'ทด-005', soc: 78, mileage: 4200, status: 'available', tdCount30: 12, lastClean: fleetAddDays(0), insuranceExp: fleetAddDays(310), note: '' },
  ]
  demoFleet.forEach(d => { if (!demoCol('demo_fleet')[d.id]) demoCol('demo_fleet')[d.id] = d })


  const kyAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const keys = [
    { id: 'K-A01', slot: 'A01', vehicle: 'BYD Dolphin (สต็อก)', vin: '...1122', status: 'in_cabinet', holder: null, since: kyAddHours(20), purpose: null },
    { id: 'K-A02', slot: 'A02', vehicle: 'BYD Atto 3 (สต็อก)', vin: '...3344', status: 'checked_out', holder: 'วิชัย ยอดขาย', since: kyAddHours(1), purpose: 'พาลูกค้าดูรถ' },
    { id: 'K-A03', slot: 'A03', vehicle: 'BYD Seal AWD (สต็อก)', vin: '...5566', status: 'in_cabinet', holder: null, since: kyAddHours(5), purpose: null },
    { id: 'K-B01', slot: 'B01', vehicle: 'รถ Demo ทด-001', vin: '...7788', status: 'checked_out', holder: 'ธนา เก่ง', since: kyAddHours(3), purpose: 'Test Drive ลูกค้า' },
    { id: 'K-B02', slot: 'B02', vehicle: 'รถ Demo ทด-003', vin: '...9900', status: 'checked_out', holder: 'สมบัติ ขับดี', since: kyAddHours(26), purpose: 'รับ-ส่งเอกสารขนส่ง' },
    { id: 'K-C01', slot: 'C01', vehicle: 'รถลูกค้า 1กข-1234 (ซ่อม)', vin: '...3456', status: 'in_cabinet', holder: null, since: kyAddHours(2), purpose: null },
    { id: 'K-C02', slot: 'C02', vehicle: 'รถลูกค้า 2ขค-5678 (ซ่อม)', vin: '...9012', status: 'missing', holder: 'มานะ ขยัน (ล่าสุด)', since: kyAddHours(50), purpose: 'ย้ายรถเข้า Bay' },
  ]
  keys.forEach(k => { if (!demoCol('keys')[k.id]) demoCol('keys')[k.id] = k })


  const assets = [
    { id:'AST001', name:'EV Charger DC Fast 50kW หน้าโชว์รูม', cat:'charger', cost:450000, depMethod:'sl', usefulLife:10, purchaseDate:amAddDays(-365), location:'สาขากรุงเทพ', status:'active', condition:'good', lastMaint:amAddDays(-30) },
    { id:'AST002', name:'รถทดสอบ BYD Seal AWD', cat:'vehicle', cost:1590000, depMethod:'sl', usefulLife:5, purchaseDate:amAddDays(-180), location:'สาขากรุงเทพ', status:'active', condition:'good', lastMaint:amAddDays(-60) },
    { id:'AST003', name:'ลิฟต์ยกรถ 4 ตัน', cat:'equipment', cost:280000, depMethod:'sl', usefulLife:15, purchaseDate:amAddDays(-730), location:'ศูนย์บริการ', status:'active', condition:'fair', lastMaint:amAddDays(-90) },
    { id:'AST004', name:'Server & Network Infrastructure', cat:'it', cost:180000, depMethod:'db', usefulLife:5, purchaseDate:amAddDays(-540), location:'สาขากรุงเทพ', status:'active', condition:'good', lastMaint:amAddDays(-45) },
    { id:'AST005', name:'โซฟาและเฟอร์นิเจอร์ Showroom', cat:'furniture', cost:320000, depMethod:'sl', usefulLife:10, purchaseDate:amAddDays(-730), location:'สาขากรุงเทพ', status:'active', condition:'fair', lastMaint:null },
    { id:'AST006', name:'EV Charger AC 7kW x 5 ที่', cat:'charger', cost:175000, depMethod:'sl', usefulLife:8, purchaseDate:amAddDays(-270), location:'สาขาเชียงใหม่', status:'active', condition:'good', lastMaint:amAddDays(-15) },
  ]
  assets.forEach(a => { if (!demoCol('assets')[a.id]) demoCol('assets')[a.id] = a })


  const deposits = [
    { id:'DP-2401', customer:'คุณอนันต์', model:'BYD Atto 3', amount:20000, method:'โอน', date:'2026-06-02', status:'held', booking:'BK-1180' },
    { id:'DP-2402', customer:'คุณมาลี', model:'BYD Seal AWD', amount:50000, method:'บัตรเครดิต', date:'2026-06-05', status:'held', booking:'BK-1185' },
    { id:'DP-2403', customer:'คุณวีระ', model:'MG4 Electric', amount:10000, method:'เงินสด', date:'2026-05-20', status:'applied', booking:'BK-1170' },
    { id:'DP-2404', customer:'คุณสุดา', model:'BYD Dolphin', amount:15000, method:'โอน', date:'2026-05-12', status:'refunded', booking:'BK-1165' },
  ]
  deposits.forEach(d => { if (!demoCol('deposits')[d.id]) demoCol('deposits')[d.id] = d })


  const eaAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const expenseApprovals = [
    { id:'EXP001', title:'ค่าเดินทาง — BYD Training Bangkok', cat:'travel', amount:4800, status:'pending', submittedBy:'วิชัย ยอดขาย', dept:'ฝ่ายขาย', submitDate:eaAddHours(6), approvedBy:null, receipt:true, notes:'อบรมผลิตภัณฑ์ BYD 2025' },
    { id:'EXP002', title:'ค่าอาหารลูกค้า — Business Lunch', cat:'meal', amount:2200, status:'pending', submittedBy:'สุดา มาดี', dept:'ฝ่ายขาย', submitDate:eaAddHours(12), approvedBy:null, receipt:true, notes:'นัดลูกค้า B2B' },
    { id:'EXP003', title:'ซื้อหมึกพริ้นเตอร์ + กระดาษ A4', cat:'supplies', amount:1850, status:'approved', submittedBy:'มานี HR', dept:'HR', submitDate:eaAddHours(48), approvedBy:'สมชาย ผู้จัดการ', receipt:true, notes:'' },
    { id:'EXP004', title:'ค่าโฆษณา Facebook Ads เดือนนี้', cat:'marketing', amount:15000, status:'approved', submittedBy:'ปทิตา Marketing', dept:'การตลาด', submitDate:eaAddHours(72), approvedBy:'สมชาย ผู้จัดการ', receipt:false, notes:'Campaign BYD Atto3' },
    { id:'EXP005', title:'ซ่อมแอร์ศูนย์บริการ', cat:'repair', amount:8500, status:'pending', submittedBy:'วิทยา ช่าง', dept:'บริการ', submitDate:eaAddHours(3), approvedBy:null, receipt:true, notes:'แอร์ตัวที่ 2 คอมเพรสเซอร์เสีย' },
    { id:'EXP006', title:'ค่าเดินทางงาน Motor Expo', cat:'travel', amount:3600, status:'rejected', submittedBy:'ธนา เก่ง', dept:'ฝ่ายขาย', submitDate:eaAddHours(120), approvedBy:'สมชาย ผู้จัดการ', receipt:true, notes:'เกินวงเงิน Budget' },
  ]
  expenseApprovals.forEach(e => { if (!demoCol('expense_approvals')[e.id]) demoCol('expense_approvals')[e.id] = e })


  const commissionRules = [
    { id:'cr1', name:'ค่าคอม Car — Standard', type:'car', base:0, tiers:[{min:0,max:999999,pct:1.5},{min:1000000,max:9999999,pct:2.0}], active:true, createdAt:'2025-01-01' },
    { id:'cr2', name:'ค่าคอม Finance — per deal', type:'finance', base:3000, tiers:[], flat:3000, pct:0, active:true, createdAt:'2025-01-01' },
    { id:'cr3', name:'ค่าคอม Insurance', type:'insurance', base:0, tiers:[], flat:0, pct:20, active:true, createdAt:'2025-01-01' },
    { id:'cr4', name:'ค่าคอม Accessory', type:'accessory', base:0, tiers:[], flat:0, pct:5, active:true, createdAt:'2025-01-01' },
  ]
  commissionRules.forEach(r => { if (!demoCol('commission_rules')[r.id]) demoCol('commission_rules')[r.id] = r })


  const dcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const debts = [
    { id:'DB001', customer:'บริษัท ABC จำกัด', type:'B2B Fleet', amount:450000, dueDate:dcAddDays(-45), status:'overdue60', lastContact:dcAddDays(-5), contacts:3, note:'สัญญาว่าจะจ่ายสิ้นเดือน' },
    { id:'DB002', customer:'สมชาย ใจดี', type:'ค่าซ่อม', amount:28500, dueDate:dcAddDays(-12), status:'overdue30', lastContact:dcAddDays(-2), contacts:1, note:'' },
    { id:'DB003', customer:'ร้านเช่ารถ XYZ', type:'B2B Service', amount:86000, dueDate:dcAddDays(-70), status:'overdue90', lastContact:dcAddDays(-1), contacts:6, note:'เริ่มกระบวนการทางกฎหมาย?' },
    { id:'DB004', customer:'มาลี สุขใจ', type:'ค่าอะไหล่', amount:12400, dueDate:dcAddDays(10), status:'current', lastContact:null, contacts:0, note:'' },
    { id:'DB005', customer:'ธนพล เที่ยงตรง', type:'ค่าซ่อม', amount:8900, dueDate:dcAddDays(-8), status:'overdue30', lastContact:dcAddDays(-3), contacts:2, note:'ขอผ่อน 2 งวด' },
    { id:'DB006', customer:'โรงแรมสยาม', type:'B2B Fleet', amount:156000, dueDate:dcAddDays(-20), status:'paid', lastContact:dcAddDays(-1), contacts:2, note:'จ่ายครบแล้ว' },
  ]
  debts.forEach(d => { if (!demoCol('debts')[d.id]) demoCol('debts')[d.id] = d })


  const dsAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const debtSettlements = [
    { id:'DBT001', customer:'บ. ABC Transport จำกัด', type:'b2b', creditLimit:5000000, used:3200000, invoices:4, oldest:dsAddDays(-45), status:'overdue_30', contact:'สมหมาย ทรัพย์', phone:'086-xxx-xxxx', notes:'ขอผ่อนผันเนื่องจากสภาพคล่อง' },
    { id:'DBT002', customer:'วิชัย มีโชค', type:'retail', creditLimit:500000, used:120000, invoices:1, oldest:dsAddDays(-8), status:'overdue_7', contact:'วิชัย มีโชค', phone:'085-xxx-xxxx', notes:'' },
    { id:'DBT003', customer:'บ. XYZ Logistics', type:'b2b', creditLimit:3000000, used:2800000, invoices:6, oldest:dsAddDays(-70), status:'bad_debt', contact:'ปทิตา เจ้าของ', phone:'082-xxx-xxxx', notes:'ส่งหนังสือเตือนครั้งที่ 3 แล้ว' },
    { id:'DBT004', customer:'สุดา อารมณ์ดี', type:'retail', creditLimit:300000, used:90000, invoices:1, oldest:dsAddDays(-3), status:'overdue_7', contact:'สุดา อารมณ์ดี', phone:'083-xxx-xxxx', notes:'' },
    { id:'DBT005', customer:'หน่วยงาน ก. ราชการ', type:'gov', creditLimit:10000000, used:4500000, invoices:3, oldest:dsAddDays(-25), status:'overdue_30', contact:'จนท.การเงิน', phone:'02-xxx-xxxx', notes:'กระบวนการจัดซื้อภาครัฐ ใช้เวลาปกติ' },
  ]
  debtSettlements.forEach(d => { if (!demoCol('debt_settlements')[d.id]) demoCol('debt_settlements')[d.id] = d })


  // Comms extras
  const clAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  const callLogs = [
    { id:'C001', type:'inbound', topic:'sales', caller:'สมหญิง รักรถ', phone:'081-234-5678', duration:420, staff:'สุดา มาดี', time: clAddMinutes(15), note:'ถามโปร Dolphin — นัดเข้ามาดูพรุ่งนี้ 14:00', followUp:true, followed:false },
    { id:'C002', type:'missed', topic:'other', caller:'ไม่ทราบ', phone:'02-987-6543', duration:0, staff:null, time: clAddMinutes(35), note:'', followUp:true, followed:false },
    { id:'C003', type:'outbound', topic:'service', caller:'สมชาย ใจดี', phone:'085-111-2222', duration:180, staff:'วิทยา ช่างใหญ่', time: clAddMinutes(60), note:'แจ้งรถซ่อมเสร็จแล้ว นัดรับพรุ่งนี้', followUp:false, followed:false },
    { id:'C004', type:'inbound', topic:'complaint', caller:'ประยุทธ ไม่พอใจ', phone:'089-333-4444', duration:660, staff:'ผจก.บริการ', time: clAddMinutes(120), note:'ไม่พอใจรอนาน — ผจก.รับเรื่องแล้ว เปิดเคสร้องเรียน', followUp:true, followed:true },
    { id:'C005', type:'inbound', topic:'finance', caller:'มาลี สุขใจ', phone:'086-222-3333', duration:240, staff:'สมศรี การเงิน', time: clAddMinutes(200), note:'ถามยอดค้างค่าอะไหล่ — แจ้งยอดแล้ว จะโอนพรุ่งนี้', followUp:false, followed:false },
    { id:'C006', type:'outbound', topic:'sales', caller:'ประพันธ์ มั่งมี', phone:'081-111-9999', duration:540, staff:'วิชัย ยอดขาย', time: clAddMinutes(300), note:'Follow-up หลัง Test Drive — ขอคิดถึงศุกร์นี้', followUp:true, followed:false },
  ]
  callLogs.forEach(c => { if (!demoCol('call_logs')[c.id]) demoCol('call_logs')[c.id] = c })


  const chatTemplates = [
    { id:'CT001', cat:'greeting', title:'ทักทายลูกค้าใหม่', text:'สวัสดีค่ะ ยินดีต้อนรับสู่ LAMOM 🙏 สนใจรถรุ่นไหนเป็นพิเศษไหมคะ หรือให้แนะนำรุ่นที่เหมาะกับการใช้งานของคุณลูกค้าดีคะ?', usage:342 },
    { id:'CT002', cat:'greeting', title:'ตอบนอกเวลาทำการ', text:'ขอบคุณที่ติดต่อ LAMOM ค่ะ ขณะนี้นอกเวลาทำการ (เปิด 8:30-18:00 ทุกวัน) ทีมงานจะรีบติดต่อกลับทันทีในเวลาทำการนะคะ 🙏', usage:156 },
    { id:'CT003', cat:'product', title:'แนะนำ BYD Dolphin', text:'BYD Dolphin 🐬 เริ่มต้น 899,000 บาท วิ่งไกล 410 km/ชาร์จ แบต Blade Battery ปลอดภัยสูง รับประกันแบต 8 ปี สนใจนัดทดลองขับไหมคะ?', usage:218 },
    { id:'CT004', cat:'price', title:'ขอใบเสนอราคา', text:'ยินดีค่ะ 😊 รบกวนขอข้อมูลเพื่อทำใบเสนอราคา: 1) รุ่น/สีที่สนใจ 2) ชื่อ-นามสกุล 3) เบอร์โทร — เดี๋ยวทีมงานส่งใบเสนอราคาพร้อมโปรล่าสุดให้เลยค่ะ', usage:187 },
    { id:'CT005', cat:'booking', title:'นัด Test Drive', text:'นัดทดลองขับได้เลยค่ะ 🚗 สะดวกวันไหน-กี่โมงคะ? (เปิดทุกวัน 8:30-18:00) ใช้แค่ใบขับขี่ใบเดียว ใช้เวลาประมาณ 30 นาทีค่ะ', usage:264 },
    { id:'CT006', cat:'after', title:'นัดเช็คระยะ', text:'แจ้งนัดเช็คระยะค่ะ 🔧 รบกวนแจ้ง: 1) ทะเบียนรถ 2) เลขไมล์ปัจจุบัน 3) วันเวลาที่สะดวก — มีบริการรถรับ-ส่งฟรีในรัศมี 10 กม. ค่ะ', usage:143 },
    { id:'CT007', cat:'after', title:'ติดตามความพอใจหลังซ่อม', text:'สอบถามความพอใจค่ะ 😊 หลังจากรับรถไปแล้ว ทุกอย่างเรียบร้อยดีไหมคะ? หากมีปัญหาใดๆ แจ้งได้เลยนะคะ ยินดีดูแลค่ะ 🙏', usage:98 },
  ]
  chatTemplates.forEach(t => { if (!demoCol('chat_templates')[t.id]) demoCol('chat_templates')[t.id] = t })


  const escalationRules = [
    { id:'ESC001', name:'Job Card เกิน SLA', dept:'บริการ', triggerHours:4, level1:'หัวหน้าช่าง', level2:'ผู้จัดการบริการ', channel:'LINE', active:true, triggered:3 },
    { id:'ESC002', name:'Lead ไม่ติดต่อ 24 ชม.', dept:'ขาย', triggerHours:24, level1:'Supervisor ขาย', level2:'ผู้จัดการโชว์รูม', channel:'LINE+Email', active:true, triggered:7 },
    { id:'ESC003', name:'ร้องเรียนไม่แก้ใน 48 ชม.', dept:'CRM', triggerHours:48, level1:'ผู้จัดการ CRM', level2:'เจ้าของ', channel:'LINE+SMS', active:true, triggered:1 },
    { id:'ESC004', name:'ไฟแนนซ์รอเอกสาร > 3 วัน', dept:'การเงิน', triggerHours:72, level1:'ผู้จัดการการเงิน', level2:'ผู้จัดการโชว์รูม', channel:'Email', active:true, triggered:2 },
    { id:'ESC005', name:'อะไหล่หมดสต็อก', dept:'อะไหล่', triggerHours:1, level1:'ผู้จัดการอะไหล่', level2:'ผู้อำนวยการ', channel:'LINE', active:false, triggered:0 },
    { id:'ESC006', name:'KPI ต่ำกว่า 70% ต้นเดือน', dept:'ขาย', triggerHours:168, level1:'Supervisor ขาย', level2:'ผู้จัดการโชว์รูม', channel:'Email', active:true, triggered:4 },
  ]
  escalationRules.forEach(r => { if (!demoCol('escalation_rules')[r.id]) demoCol('escalation_rules')[r.id] = r })


  const meetingMinutes = [
    { id:'M001', title:'ประชุมรายสัปดาห์ทีมขาย', date:'2026-06-13', time:'09:00', dept:'ขาย',
      attendees:['ทวีศักดิ์','กิตติ','ปิยะ','สมพงษ์'],
      agenda:['ทบทวนยอดขายสัปดาห์ที่แล้ว','วางแผนโปรโมชั่นใหม่','ติดตาม Pipeline'],
      minutes:'ยอดขายสัปดาห์ที่แล้ว 12 คัน ต่ำกว่าเป้า 3 คัน ต้องเร่ง Follow-up ลูกค้าที่ทดลองขับ',
      actions:[
        { task:'ติดต่อลูกค้า Test Drive ทุกราย', owner:'กิตติ', due:'2026-06-15', done:false },
        { task:'อัปเดตราคาโปรโมชั่น Q3', owner:'ปิยะ', due:'2026-06-17', done:true },
      ],
      status:'completed' },
    { id:'M002', title:'ประชุมบอร์ดบริหาร Q2 Review', date:'2026-06-10', time:'14:00', dept:'บริหาร',
      attendees:['ทวีศักดิ์','ผู้จัดการทั่วไป','CFO','หัวหน้าฝ่ายขาย'],
      agenda:['สรุป P&L Q2','แผนการตลาด H2','HR Update'],
      minutes:'Q2 กำไรสุทธิ ฿4.2M ต่ำกว่าเป้า 8% สาเหตุหลักจากต้นทุนค่าแรงเพิ่มขึ้น',
      actions:[
        { task:'จัดทำแผนลดต้นทุน Q3', owner:'CFO', due:'2026-06-20', done:false },
        { task:'เพิ่มทีม Outbound 2 คน', owner:'หัวหน้าฝ่ายขาย', due:'2026-06-30', done:false },
      ],
      status:'completed' },
    { id:'M003', title:'Stand-up รายวันทีม Service', date:'2026-06-15', time:'08:00', dept:'บริการ',
      attendees:['หัวหน้าช่าง','ช่างเพ็ชร','ช่างแดน','ช่างโอ'],
      agenda:['สถานะงานประจำวัน','งานเร่งด่วน','ปัญหาอะไหล่'],
      minutes:'งานค้างอยู่ 8 ใบ มีอะไหล่ 2 ชิ้นที่ยังรอจากซัพพลายเออร์',
      actions:[
        { task:'ติดตามอะไหล่จาก LAMOM Parts', owner:'ช่างเพ็ชร', due:'2026-06-15', done:false },
      ],
      status:'in_progress' },
    { id:'M004', title:'ประชุมทีม Marketing ประจำเดือน', date:'2026-06-20', time:'10:00', dept:'การตลาด',
      attendees:['หัวหน้าการตลาด','ทีม Digital','ทีม Event'],
      agenda:['Campaign H2 2569','Event Motor Expo','Budget Review'],
      minutes:'',
      actions:[],
      status:'upcoming' },
  ]
  meetingMinutes.forEach(m => { if (!demoCol('meeting_minutes')[m.id]) demoCol('meeting_minutes')[m.id] = m })


  // B2B extras
  const fmAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const fleetAccounts = [
    {
      id:'fa1', company:'บริษัท ไทยอุตสาหกรรม จำกัด', industry:'การผลิต',
      contact:'คุณสมศักดิ์ วงศ์มา', phone:'0812300001', email:'fleet@thai-industry.com',
      status:'active', fleetSize:12, evCount:5, targetFleet:20,
      totalRevenue:12000000, lastOrderDate: fmAddDays(-45),
      vehicles:[
        { model:'BYD Seal AWD', qty:3, unitPrice:1449000 },
        { model:'BYD Atto 3', qty:2, unitPrice:1099000 },
      ],
      discount:3, creditTerms:30, salesperson:'อรนุช เซลส์ดี',
      notes:'ลูกค้าองค์กร fleet 10+ คัน/ปี ต้องการเพิ่มกองรถ Q3 2025',
    },
    {
      id:'fa2', company:'ห้างหุ้นส่วน จำกัด โลจิสติกส์ไทย', industry:'โลจิสติกส์และขนส่ง',
      contact:'คุณพิชัย ใจดี', phone:'0823400002', email:'logisthai@email.com',
      status:'prospect', fleetSize:0, evCount:0, targetFleet:15,
      totalRevenue:0, lastOrderDate:null,
      vehicles:[],
      discount:2, creditTerms:45, salesperson:'วิชัย ขายเก่ง',
      notes:'ต้องการรถ Van/SUV เพื่อส่งของ',
    },
  ]
  fleetAccounts.forEach(f => { if (!demoCol('fleet_accounts')[f.id]) demoCol('fleet_accounts')[f.id] = f })


  const fleetVehicles = [
    { id:'fv1', plate:'กข-1234', model:'BYD Atto 3', driver:'สมชาย ก.', status:'moving', speed:62, soc:74, lat:13.756, lng:100.502, location:'ถ.สุขุมวิท ซ.22', lastUpdate:'11:42', odometer:18500, trip:'ส่งเอกสาร ลาดพร้าว' },
    { id:'fv2', plate:'กข-5678', model:'BYD Seal AWD', driver:'นภา ม.', status:'parked', speed:0, soc:42, lat:13.729, lng:100.523, location:'ลานจอด CentralWorld', lastUpdate:'11:38', odometer:32000, trip:'ประชุมลูกค้า Fleet' },
    { id:'fv3', plate:'กก-0001', model:'MG ZS EV', driver:'มาลี จ.', status:'idle', speed:0, soc:88, lat:13.740, lng:100.560, location:'สำนักงาน LAMOM ONE', lastUpdate:'11:45', odometer:5200, trip:'รอผู้ขับ' },
  ]
  fleetVehicles.forEach(v => { if (!demoCol('fleet_vehicles')[v.id]) demoCol('fleet_vehicles')[v.id] = v })


  const fleetAlerts = [
    { id:'default', soc:'20%', speed:'120 km/h', geofence:'10 km', idle:'2 ชม' },
  ]
  fleetAlerts.forEach(a => { if (!demoCol('fleet_alerts')[a.id]) demoCol('fleet_alerts')[a.id] = a })


  const cqAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const cqAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const corporateQuotes = [
    { id:'CQ001', company: 'บริษัท ABC จำกัด', contact: 'คุณสมชาย ใหญ่โต', model: 'BYD Atto 3', qty: 10, unitPrice: 1050000, discount: 5, status: 'reviewed', createDate: cqAddHours(72), validUntil: cqAddDays(30) },
    { id:'CQ002', company: 'XYZ Corporation', contact: 'คุณมานี บริษัท', model: 'BYD Dolphin', qty: 20, unitPrice: 669000, discount: 8, status: 'won', createDate: cqAddHours(168), validUntil: cqAddDays(-5) },
    { id:'CQ003', company: 'DEF Holdings', contact: 'คุณชัย ผู้บริหาร', model: 'MG ZS EV', qty: 5, unitPrice: 840000, discount: 3, status: 'draft', createDate: cqAddHours(24), validUntil: cqAddDays(45) },
    { id:'CQ004', company: 'GHI Group', contact: 'คุณวิภา ผจก.', model: 'BYD Seal AWD', qty: 3, unitPrice: 1450000, discount: 2, status: 'sent', createDate: cqAddHours(48), validUntil: cqAddDays(21) },
    { id:'CQ005', company: 'JKL Logistics', contact: 'คุณธนา Fleet Manager', model: 'BYD Atto 3', qty: 15, unitPrice: 1040000, discount: 6, status: 'lost', createDate: cqAddHours(240), validUntil: cqAddDays(-10) },
  ]
  corporateQuotes.forEach(q => { if (!demoCol('corporate_quotes')[q.id]) demoCol('corporate_quotes')[q.id] = q })


  const leasingContracts = [
    { id:'lc1', company:'ห้างหุ้นส่วน เดลิเวอรี่ไทย', model:'BYD Atto 3', qty:1, monthlyRate:25000, term:36, startDate:'2025-01-01', endDate:'2027-12-31', paid:6, status:'active', contact:'คุณนิธิ 081-234-5000' },
    { id:'lc2', company:'บริษัท ท่องเที่ยวสยาม', model:'BYD Seal AWD', qty:1, monthlyRate:35000, term:24, startDate:'2025-03-01', endDate:'2027-02-28', paid:4, status:'active', contact:'คุณวรรณ 081-234-5001' },
  ]
  leasingContracts.forEach(l => { if (!demoCol('leasing_contracts')[l.id]) demoCol('leasing_contracts')[l.id] = l })


  const gbAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const govBids = [
    { id:'gb1', project:'จัดซื้อรถยนต์ไฟฟ้า 10 คัน — กรมขนส่งทางบก', budget:12000000, deadline: gbAddDays(20), status:'submitted', docs:[true,true,true,true,true,true], ourBid:11500000, note:'ยื่นประมูลแล้ว รอผล' },
    { id:'gb2', project:'รถยนต์ราชการ 5 คัน — สำนักงานเทศบาล', budget:5000000, deadline: gbAddDays(65), status:'preparing', docs:[true,true,true,false,false,false], ourBid:0, note:'เตรียมเอกสาร TOR' },
  ]
  govBids.forEach(g => { if (!demoCol('gov_bids')[g.id]) demoCol('gov_bids')[g.id] = g })


  const pcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const partnerCommissions = [
    { id:'pc1', partner:'บริษัท นายหน้าอีวี จำกัด', type:'broker', deal:'BYD Seal AWD — ธีรพงศ์ แสงทอง', dealValue:1299000, rate:1.5, status:'paid', date: pcAddDays(-11) },
    { id:'pc2', partner:'คุณสุรชัย นายหน้าอิสระ', type:'broker', deal:'GWM ORA — สุภาพร ใจดี', dealValue:899000, rate:1.0, status:'pending', date: pcAddDays(-26) },
  ]
  partnerCommissions.forEach(p => { if (!demoCol('partner_commissions')[p.id]) demoCol('partner_commissions')[p.id] = p })


  const rlAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const reservations = [
    { id:'SV001', vin:'LBV5A2B10P0001111', model:'BYD Atto 3',   color:'Arctic Blue',  year:'2026', price:1099000, status:'reserved', customer:'สมชาย ใจดี',   agent:'พนักงาน A', lockedAt:rlAddDays(-2), expiry:rlAddDays(5), deposit:50000 },
    { id:'SV002', vin:'LBV5A2B10P0002222', model:'BYD Seal AWD', color:'Cosmos Black', year:'2026', price:1699000, status:'reserved', customer:'นภา สุขใจ',    agent:'พนักงาน B', lockedAt:rlAddDays(-1), expiry:rlAddDays(6), deposit:100000},
    { id:'SV003', vin:'LBV5A2B10P0003333', model:'BYD Han',      color:'Jade Green',   year:'2026', price:2099000, status:'available',customer:'',              agent:'',           lockedAt:'',           expiry:'',            deposit:0    },
    { id:'SV004', vin:'LBV5A2B10P0004444', model:'BYD Dolphin',  color:'Snow White',   year:'2026', price:899000,  status:'locked',   customer:'วิชัย ดีมาก',  agent:'พนักงาน A', lockedAt:rlAddDays(0), expiry:rlAddDays(3), deposit:30000},
    { id:'SV005', vin:'LBV5A2B10P0005555', model:'MG ZS EV',     color:'Pearl White',  year:'2026', price:799000,  status:'available',customer:'',              agent:'',           lockedAt:'',           expiry:'',            deposit:0    },
    { id:'SV006', vin:'LBV5A2B10P0006666', model:'BYD Atto 3',   color:'Ski White',    year:'2026', price:1099000, status:'sold',     customer:'มาลี รุ่งเรือง',agent:'พนักงาน C', lockedAt:rlAddDays(-4), expiry:'',            deposit:0    },
    { id:'SV007', vin:'LBV5A2B10P0007777', model:'BYD Seal AWD', color:'Aurora Silver',year:'2026', price:1699000, status:'available',customer:'',              agent:'',           lockedAt:'',           expiry:'',            deposit:0    },
  ]
  reservations.forEach(r => { if (!demoCol('reservations')[r.id]) demoCol('reservations')[r.id] = r })


  const vrAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const vrAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const vehicleReservations = [
    { id: 'RES001', customer: 'สมชาย ใจดี', phone: '085-111', model: 'BYD Atto 3', color: 'น้ำเงิน', deposit: 10000, staff: 'วิชัย ยอดขาย', status: 'deposit', created: vrAddHours(2), expiry: vrAddDays(14), stockId: 'STK-0042' },
    { id: 'RES002', customer: 'มาลี สุขใจ', phone: '086-222', model: 'BYD Dolphin', color: 'ขาว', deposit: 5000, staff: 'สุดา มาดี', status: 'confirmed', created: vrAddHours(24), expiry: vrAddDays(7), stockId: 'STK-0031' },
    { id: 'RES003', customer: 'ธนพล เที่ยงตรง', phone: '087-333', model: 'BYD Seal AWD', color: 'ดำ', deposit: 0, staff: 'ธนา เก่ง', status: 'active', created: vrAddHours(48), expiry: vrAddDays(10), stockId: null },
    { id: 'RES004', customer: 'อรทัย ตั้งใจ', phone: '088-444', model: 'MG ZS EV', color: 'แดง', deposit: 10000, staff: 'วิชัย ยอดขาย', status: 'expired', created: vrAddHours(240), expiry: vrAddDays(-2), stockId: 'STK-0015' },
  ]
  vehicleReservations.forEach(r => { if (!demoCol('vehicle_reservations')[r.id]) demoCol('vehicle_reservations')[r.id] = r })


  const tiAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const tradeIns = [
    { id: 'TI001', customer: 'สมชาย ใจดี', oldCar: 'Toyota Camry 2018', plate: '1กข-1111', mileage: 85000, grade: 'B', marketPrice: 650000, offerPrice: 598000, status: 'accepted', newCar: 'BYD Seal AWD', date: tiAddDays(-5) },
    { id: 'TI002', customer: 'มาลี สุขใจ', oldCar: 'Honda City 2020', plate: '2ขค-2222', mileage: 42000, grade: 'A', marketPrice: 420000, offerPrice: 420000, status: 'received', newCar: 'BYD Dolphin', date: tiAddDays(-12) },
    { id: 'TI003', customer: 'ธนพล เที่ยงตรง', oldCar: 'Mazda 2 2017', plate: '3คง-3333', mileage: 120000, grade: 'C', marketPrice: 280000, offerPrice: 229600, status: 'offered', newCar: 'MG4 Electric', date: tiAddDays(-2) },
    { id: 'TI004', customer: 'อรทัย ตั้งใจ', oldCar: 'Nissan Almera 2019', plate: '4งจ-4444', mileage: 65000, grade: 'B', marketPrice: 310000, offerPrice: 285200, status: 'appraisal', newCar: 'BYD Atto 3', date: tiAddDays(0) },
    { id: 'TI005', customer: 'วิรัช เก่งมาก', oldCar: 'Toyota Vios 2015', plate: '5จฉ-5555', mileage: 180000, grade: 'D', marketPrice: 180000, offerPrice: 126000, status: 'declined', newCar: '—', date: tiAddDays(-20) },
  ]
  tradeIns.forEach(t => { if (!demoCol('trade_ins')[t.id]) demoCol('trade_ins')[t.id] = t })


  const usedCars = [
    { id:'UC001', plate:'กก-1234 กทม.',  brand:'Toyota', model:'Camry',       year:2022, km:28000, appraisal:750000, asking:820000, sold:0,      status:'for_sale',   date:'2026-05-20', buyer:''          },
    { id:'UC002', plate:'ขข-5678 นทบ.',  brand:'Honda',  model:'City',        year:2021, km:45000, appraisal:430000, asking:489000, sold:489000, status:'sold',       date:'2026-06-01', buyer:'สมชาย ใจดี' },
    { id:'UC003', plate:'คค-9012 กทม.',  brand:'Mazda',  model:'CX-5',        year:2023, km:15000, appraisal:920000, asking:980000, sold:0,      status:'inspection', date:'2026-06-12', buyer:''          },
    { id:'UC004', plate:'งง-3456 สมทบ.', brand:'BYD',    model:'Atto 3 2024', year:2024, km:8000,  appraisal:880000, asking:950000, sold:0,      status:'for_sale',   date:'2026-06-10', buyer:''          },
    { id:'UC005', plate:'จจ-7890 กทม.',  brand:'Honda',  model:'HR-V',        year:2022, km:32000, appraisal:610000, asking:660000, sold:0,      status:'reserved',   date:'2026-06-13', buyer:'นภา สุขใจ' },
  ]
  usedCars.forEach(u => { if (!demoCol('used_cars')[u.id]) demoCol('used_cars')[u.id] = u })


  const tdAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  const testDrives = [
    { id: 'TD001', customerName: 'วิชัย มีโชค', phone: '085-xxx', model: 'BYD Seal AWD', date: tdAddDays(0), time: '10:00', staff: 'วิชัย ยอดขาย', status: 'confirmed', notes: 'สนใจจริงจัง' },
    { id: 'TD002', customerName: 'สุดา อารมณ์ดี', phone: '086-xxx', model: 'BYD Atto 3', date: tdAddDays(0), time: '14:00', staff: 'สุดา มาดี', status: 'scheduled', notes: '' },
    { id: 'TD003', customerName: 'ธนา เก่งกว่า', phone: '087-xxx', model: 'MG ZS EV', date: tdAddDays(1), time: '11:00', staff: 'ธนา เก่ง', status: 'scheduled', notes: 'มากับครอบครัว' },
    { id: 'TD004', customerName: 'อรวรรณ ขยัน', phone: '088-xxx', model: 'BYD Dolphin', date: tdAddDays(1), time: '15:00', staff: 'ปทิตา ที่ปรึกษา', status: 'confirmed', notes: '' },
    { id: 'TD005', customerName: 'ปทิตา สาวสวย', phone: '089-xxx', model: 'BYD Seal AWD', date: tdAddDays(-1), time: '13:00', staff: 'วิชัย ยอดขาย', status: 'done', notes: 'สนใจซื้อ — ส่ง quote แล้ว' },
    { id: 'TD006', customerName: 'ชัยวัฒน์ ลูกค้า', phone: '090-xxx', model: 'MG ZS EV', date: tdAddDays(-1), time: '16:00', staff: 'สุดา มาดี', status: 'no_show', notes: '' },
  ]
  testDrives.forEach(t => { if (!demoCol('test_drives')[t.id]) demoCol('test_drives')[t.id] = t })


  const testDriveRecords = [
    { id:'TD001', custName:'สมศักดิ์ เจริญสุข', phone:'081-234-5678', vehicle:'BYD Seal AWD (ขาว)', staff:'อรนุช สายใจ', date:tdrAddDays(0), time:'10:00', status:'done', result:'booked', note:'ลูกค้าชอบมาก ขับสนุก จองเลย!', km:0, duration:45 },
    { id:'TD002', custName:'วิภา ดอกไม้', phone:'089-876-5432', vehicle:'MG4 X (แดง)', staff:'วิชาญ มีโชค', date:tdrAddDays(0), time:'14:00', status:'scheduled', result:null, note:'', km:0, duration:30 },
    { id:'TD003', custName:'นายสุรชัย พลศักดิ์', phone:'062-345-6789', vehicle:'DEEPAL S7 (ดำ)', staff:'อรนุช สายใจ', date:tdrAddDays(1), time:'11:00', status:'scheduled', result:null, note:'', km:0, duration:45 },
    { id:'TD004', custName:'ดวงพร สายรุ้ง', phone:'090-111-2222', vehicle:'BYD Atto 3 (เงิน)', staff:'น.ส.ปวีณา', date:tdrAddDays(-2), time:'10:00', status:'done', result:'maybe', note:'ยังลังเล เรื่องราคา', km:12, duration:40 },
    { id:'TD005', custName:'ณัฐวุฒิ หาญกล้า', phone:'083-222-3333', vehicle:'NETA V II (น้ำเงิน)', staff:'วิชาญ มีโชค', date:tdrAddDays(-3), time:'15:00', status:'noshow', result:null, note:'โทรไม่รับ', km:0, duration:0 },
  ]
  testDriveRecords.forEach(t => { if (!demoCol('test_drive_records')[t.id]) demoCol('test_drive_records')[t.id] = t })


  const followups = [
    { id: 'FU001', customerId: 'C001', customerName: 'วิชาญ มีโชค', phone: '081-234-5678', vehicleModel: 'BYD Seal AWD', salesperson: 'อรนุช สายใจ', type: 'call', purpose: 'หลังส่งมอบรถ', dueDate: fuAddDays(-1), status: 'pending', note: 'ส่งมอบรถเมื่อ 7 วันก่อน ถามความพอใจ', result: '' },
    { id: 'FU002', customerId: 'C002', customerName: 'อรนุช สาวสวย', phone: '082-345-6789', vehicleModel: 'MG ZS EV', salesperson: 'วิชาญ มีโชค', type: 'line', purpose: 'แจ้งบริการถึงกำหนด', dueDate: fuAddDays(2), status: 'pending', note: 'ครบ 10,000 กม. ต้องทำ First Service', result: '' },
    { id: 'FU003', customerId: 'C003', customerName: 'ธีรยุทธ เก่งกาจ', phone: '083-456-7890', vehicleModel: 'Neta V', salesperson: 'วิชาญ มีโชค', type: 'call', purpose: 'เสนอต่ออายุประกัน', dueDate: fuAddDays(5), status: 'pending', note: 'ประกันหมดอีก 30 วัน เสนอแพ็คเกจต่ออายุ', result: '' },
    { id: 'FU004', customerId: 'C004', customerName: 'สมหญิง รักรถ', phone: '084-567-8901', vehicleModel: 'ORA Good Cat', salesperson: 'อรนุช สายใจ', type: 'call', purpose: 'ตรวจสอบความพึงพอใจ', dueDate: fuAddDays(-5), status: 'done', note: '', result: 'ลูกค้าพอใจมาก ให้ระดับ 5/5 บอกต่อให้เพื่อน' },
    { id: 'FU005', customerId: 'C005', customerName: 'มานะ กล้าหาญ', phone: '085-678-9012', vehicleModel: 'BYD Atto 3', salesperson: 'วิชาญ มีโชค', type: 'sms', purpose: 'วันเกิด/เทศกาล', dueDate: fuAddDays(0), status: 'pending', note: 'วันนี้วันเกิดลูกค้า ส่งของขวัญ', result: '' },
    { id: 'FU006', customerId: 'C006', customerName: 'สาวิตรี มีเงิน', phone: '086-789-0123', vehicleModel: 'BYD Seal Standard', salesperson: 'อรนุช สายใจ', type: 'visit', purpose: 'แนะนำรุ่นใหม่', dueDate: fuAddDays(10), status: 'pending', note: 'ลูกค้าสนใจ BYD Tang EV รุ่นใหม่', result: '' },
    { id: 'FU007', customerId: 'C007', customerName: 'ประยุทธ์ มั่นใจ', phone: '087-890-1234', vehicleModel: 'MG ZS EV', salesperson: 'วิชาญ มีโชค', type: 'call', purpose: 'ทั่วไป', dueDate: fuAddDays(-10), status: 'skipped', note: '', result: 'โทรไม่ติด 3 ครั้ง' },
  ]
  followups.forEach(f => { if (!demoCol('followups')[f.id]) demoCol('followups')[f.id] = f })


  const winbackTargets = [
    { id: 'WB001', customer: 'ชาตรี เข้มแข็ง', phone: '084-666', lastVisit: wbAddDays(-380), reason: 'service', value: 45000, status: 'contacted', offer: 'ส่วนลดบริการ 20% + ตรวจฟรี 30 รายการ', attempts: 2 },
    { id: 'WB002', customer: 'นภา ห่างหาย', phone: '083-777', lastVisit: wbAddDays(-420), reason: 'distance', value: 38000, status: 'interested', offer: 'บริการรถรับ-ส่งฟรี + ส่วนลด 15%', attempts: 3 },
    { id: 'WB003', customer: 'พิชัย จากไป', phone: '082-888', lastVisit: wbAddDays(-300), reason: 'price', value: 62000, status: 'target', offer: '', attempts: 0 },
    { id: 'WB004', customer: 'รัตนา คืนมา', phone: '081-999', lastVisit: wbAddDays(-350), reason: 'unknown', value: 28000, status: 'returned', offer: 'แพ็กเกจเช็คระยะ 50% ครั้งแรก', attempts: 2 },
    { id: 'WB005', customer: 'สมพงษ์ ลาก่อน', phone: '080-000', lastVisit: wbAddDays(-500), reason: 'sold_car', value: 15000, status: 'lost', offer: 'ส่วนลดรถใหม่ 30,000 บาท', attempts: 4 },
    { id: 'WB006', customer: 'อัมพร เงียบไป', phone: '089-123', lastVisit: wbAddDays(-310), reason: 'unknown', value: 52000, status: 'target', offer: '', attempts: 0 },
  ]
  winbackTargets.forEach(w => { if (!demoCol('winback_targets')[w.id]) demoCol('winback_targets')[w.id] = w })


  const carbonCredits = [
    { id: 'CC001', project: 'ป่าโกงกางเขาใหญ่', tons: 50, cost: 25000, cert: 'VCS-2025-0812' },
    { id: 'CC002', project: 'Solar Farm สุพรรณบุรี', tons: 30, cost: 18000, cert: 'GS-2025-0341' },
  ]
  carbonCredits.forEach(c => { if (!demoCol('carbon_credits')[c.id]) demoCol('carbon_credits')[c.id] = c })


  const tdcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const testDriveCerts = [
    { id:'TDC001', customer:'สมชาย ใจดี',    phone:'081-111-2222', model:'BYD Atto 3',  plate:'กข-1234 (ทดสอบ)', date:tdcAddDays(0),  time:'10:30', km:45.2, staff:'พนักงาน A', fuel:'100%', damage:'ไม่มี', signed:true  },
    { id:'TDC002', customer:'นภา สุขใจ',      phone:'089-333-4444', model:'BYD Seal AWD',plate:'คง-5678 (ทดสอบ)', date:tdcAddDays(0),  time:'13:00', km:38.7, staff:'พนักงาน B', fuel:'95%',  damage:'ไม่มี', signed:true  },
    { id:'TDC003', customer:'วิชัย ดีมาก',    phone:'076-555-6666', model:'BYD Han',     plate:'จฉ-9012 (ทดสอบ)', date:tdcAddDays(-1), time:'11:15', km:52.1, staff:'พนักงาน A', fuel:'90%',  damage:'ไม่มี', signed:true  },
    { id:'TDC004', customer:'มาลี รุ่งเรือง', phone:'095-777-8888', model:'MG ZS EV',    plate:'ชซ-3456 (ทดสอบ)', date:tdcAddDays(-1), time:'14:30', km:41.0, staff:'พนักงาน C', fuel:'98%',  damage:'ไม่มี', signed:false },
    { id:'TDC005', customer:'อรุณ วิชิต',     phone:'081-999-0000', model:'BYD Dolphin', plate:'ฌญ-7890 (ทดสอบ)', date:tdcAddDays(-2), time:'09:45', km:29.5, staff:'พนักงาน B', fuel:'100%', damage:'ไม่มี', signed:true  },
  ]
  testDriveCerts.forEach(c => { if (!demoCol('test_drive_certs')[c.id]) demoCol('test_drive_certs')[c.id] = c })


  const vtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  const vehicleTransfers = [
    { id: 'TRF001', vehiclePlate: 'กก 1234', vehicleModel: 'BYD Seal AWD', color: 'Pearl White', vin: 'LBWAB2EB7PD001', fromBranch: 'สาขากรุงเทพ', toBranch: 'สาขาเชียงใหม่', requestedBy: 'สมชาย ผู้จัดการ', approvedBy: 'วิชัย MD', status: 'in_transit', requestDate: vtAddDays(-3), transferDate: vtAddDays(-1), eta: vtAddDays(1), reason: 'ลูกค้าต้องการเร่งด่วน', trackingNo: 'TH1234567890' },
    { id: 'TRF002', vehiclePlate: 'ขข 5678', vehicleModel: 'MG ZS EV', color: 'Galaxy Black', vin: 'LSJWSRAR7NE002', fromBranch: 'สาขาภูเก็ต', toBranch: 'สาขากรุงเทพ', requestedBy: 'อรวรรณ สาขาภูเก็ต', approvedBy: null, status: 'pending', requestDate: vtAddDays(-1), transferDate: null, eta: null, reason: 'สต็อกส่วนเกิน', trackingNo: null },
    { id: 'TRF003', vehiclePlate: 'คค 9012', vehicleModel: 'BYD Atto 3', color: 'Surf Blue', vin: 'LBWAB2EB7PD003', fromBranch: 'สาขากรุงเทพ', toBranch: 'สาขาพัทยา', requestedBy: 'ปทิตา พัทยา', approvedBy: 'สมชาย ผู้จัดการ', status: 'completed', requestDate: vtAddDays(-14), transferDate: vtAddDays(-12), eta: vtAddDays(-10), reason: 'ลูกค้าจองที่พัทยา', trackingNo: 'TH9876543210' },
  ]
  vehicleTransfers.forEach(v => { if (!demoCol('vehicle_transfers')[v.id]) demoCol('vehicle_transfers')[v.id] = v })


  const rvAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  const vehicleReceiving = [
    { id: 'RV001', orderId: 'VO001', brand: 'BYD', model: 'Seal AWD', variant: 'AWD Performance',
      color: 'Cosmos Black', year: 2024, vin: 'LBWAB2EB7PD001009', cost: 1280000,
      supplier: 'BYD Thailand', status: 'arrived', eta: rvAddDays(-2), arrivedDate: rvAddDays(-2),
      stockedDate: null, pdiStatus: 'pending', branch: 'สาขาหลัก',
      checklist: { exterior: false, interior: false, mechanical: false, documents: false, keys: false } },
    { id: 'RV002', orderId: 'VO001', brand: 'BYD', model: 'Seal SR', variant: 'Standard Range',
      color: 'Aurora White', year: 2024, vin: 'LBWAB2EB7PD001010', cost: 1080000,
      supplier: 'BYD Thailand', status: 'stocked', eta: rvAddDays(-7), arrivedDate: rvAddDays(-7),
      stockedDate: rvAddDays(-6), pdiStatus: 'passed', branch: 'สาขาหลัก',
      checklist: { exterior: true, interior: true, mechanical: true, documents: true, keys: true } },
    { id: 'RV003', orderId: 'VO002', brand: 'MG', model: 'ZS EV', variant: 'Grand Luxury',
      color: 'Starry Silver', year: 2024, vin: 'LSJWSRAR7NE001012', cost: 935000,
      supplier: 'SAIC-MG Thailand', status: 'transit', eta: rvAddDays(3), arrivedDate: null,
      stockedDate: null, pdiStatus: 'pending', branch: 'สาขาหลัก',
      checklist: { exterior: false, interior: false, mechanical: false, documents: false, keys: false } },
    { id: 'RV004', orderId: 'VO003', brand: 'Neta', model: 'V', variant: 'Standard',
      color: 'Lemon Yellow', year: 2024, vin: 'LNA2B4EV9NE001001', cost: 550000,
      supplier: 'Neta Auto Thailand', status: 'inspecting', eta: rvAddDays(-1), arrivedDate: rvAddDays(-1),
      stockedDate: null, pdiStatus: 'in_progress', branch: 'สาขาหลัก',
      checklist: { exterior: true, interior: true, mechanical: false, documents: false, keys: false } },
  ]
  vehicleReceiving.forEach(v => { if (!demoCol('vehicle_receiving')[v.id]) demoCol('vehicle_receiving')[v.id] = v })


  const stockAudit = [
    { id: 'SA01', model: 'BYD Dolphin สีน้ำเงิน', vin: '...1122', systemLoc: 'โชว์รูม', foundLoc: null, checked: false },
    { id: 'SA02', model: 'BYD Atto 3 สีขาว', vin: '...3344', systemLoc: 'โชว์รูม', foundLoc: null, checked: false },
    { id: 'SA03', model: 'BYD Seal AWD สีดำ', vin: '...5566', systemLoc: 'ลานหลัง A', foundLoc: null, checked: false },
    { id: 'SA04', model: 'MG4 Electric สีแดง', vin: '...7788', systemLoc: 'ลานหลัง A', foundLoc: null, checked: false },
    { id: 'SA05', model: 'BYD Han สีขาว', vin: '...9900', systemLoc: 'ลานหลัง B', foundLoc: null, checked: false },
    { id: 'SA06', model: 'BYD Dolphin สีเทา', vin: '...2233', systemLoc: 'ลานหลัง B', foundLoc: null, checked: false },
    { id: 'SA07', model: 'BYD Atto 3 Pro สีเงิน', vin: '...4455', systemLoc: 'ศูนย์บริการ', foundLoc: null, checked: false },
  ]
  stockAudit.forEach(s => { if (!demoCol('stock_audit')[s.id]) demoCol('stock_audit')[s.id] = s })


  const suppliers = [
    { id: 'S001', name: 'บริษัท อะไหล่ยนต์ ไทย จำกัด', shortName: 'ATJ', category: 'parts',
      contact: 'คุณสมชาย ใจดี', phone: '02-234-5678', email: 'somchai@atj.co.th', address: 'กรุงเทพฯ',
      taxId: '1234567890123', paymentTerms: 30, creditLimit: 500000, status: 'active',
      rating: 4.5, totalPO: 45, totalAmount: 1850000, notes: '' },
    { id: 'S002', name: 'บริษัท ยางไทย กู๊ดเยียร์ จำกัด', shortName: 'TGY', category: 'tires',
      contact: 'คุณวิไล รักงาน', phone: '02-345-6789', email: 'wilai@tgy.co.th', address: 'นนทบุรี',
      taxId: '2345678901234', paymentTerms: 45, creditLimit: 300000, status: 'active',
      rating: 4.2, totalPO: 28, totalAmount: 720000, notes: '' },
    { id: 'S003', name: 'บริษัท น้ำมัน และ ไขข้อ จำกัด', shortName: 'NOI', category: 'lubricant',
      contact: 'คุณประยุทธ์ ขยัน', phone: '02-456-7890', email: 'prayuth@noi.co.th', address: 'สมุทรปราการ',
      taxId: '3456789012345', paymentTerms: 30, creditLimit: 200000, status: 'active',
      rating: 3.8, totalPO: 60, totalAmount: 420000, notes: 'ส่งทุกวันจันทร์' },
    { id: 'S004', name: 'บริษัท แบตเตอรี่ EV ยุคใหม่ จำกัด', shortName: 'BEV', category: 'battery',
      contact: 'คุณสุภาพร ฉลาด', phone: '02-567-8901', email: 'supaporn@bev.co.th', address: 'บางนา',
      taxId: '4567890123456', paymentTerms: 60, creditLimit: 1000000, status: 'active',
      rating: 4.8, totalPO: 12, totalAmount: 3200000, notes: 'เฉพาะรถ EV' },
    { id: 'S005', name: 'ห้างหุ้นส่วน อุปกรณ์เก่า', shortName: 'OLD', category: 'other',
      contact: 'คุณมาลี เก่า', phone: '02-678-9012', email: '', address: 'ลาดพร้าว',
      taxId: '5678901234567', paymentTerms: 15, creditLimit: 50000, status: 'blacklist',
      rating: 1.5, totalPO: 3, totalAmount: 28000, notes: 'ของไม่ได้คุณภาพ สินค้าไม่ตรงปก' },
  ]
  suppliers.forEach(s => { if (!demoCol('suppliers')[s.id]) demoCol('suppliers')[s.id] = s })


  const supplierPOs = [
    { id: 'PO001', supplierId: 'S001', supplierName: 'บริษัท อะไหล่ยนต์ ไทย จำกัด', date: '2025-06-01', expectedDate: '2025-06-08', status: 'received', items: [{ name: 'ผ้าเบรก BYD Seal (คู่หน้า)', qty: 10, unit: 'ชุด', price: 1200 }, { name: 'กรองอากาศ BYD', qty: 20, unit: 'ชิ้น', price: 350 }], total: 19000, notes: 'รับของครบ' },
    { id: 'PO002', supplierId: 'S002', supplierName: 'บริษัท ยางไทย กู๊ดเยียร์ จำกัด', date: '2025-06-05', expectedDate: '2025-06-12', status: 'confirmed', items: [{ name: 'ยาง 205/55R16', qty: 16, unit: 'เส้น', price: 2800 }], total: 44800, notes: '' },
    { id: 'PO003', supplierId: 'S003', supplierName: 'บริษัท น้ำมัน และ ไขข้อ จำกัด', date: '2025-06-08', expectedDate: '2025-06-09', status: 'pending', items: [{ name: 'น้ำมันเครื่อง 5W-30 (4L)', qty: 30, unit: 'ขวด', price: 450 }], total: 13500, notes: 'ด่วน' },
  ]
  supplierPOs.forEach(p => { if (!demoCol('supplier_pos')[p.id]) demoCol('supplier_pos')[p.id] = p })


  const bankTransactions = [
    { id:'BT001', date:bmAddDays(-1), desc:'TRF จาก สมชาย ใจดี', amount:1299000, matched:'IV001', type:'in' },
    { id:'BT002', date:bmAddDays(-1), desc:'TRF จาก มาลี สุขใจ', amount:28500, matched:'IV002', type:'in' },
    { id:'BT003', date:bmAddDays(-2), desc:'เงินโอนเข้า ไม่ระบุชื่อ', amount:12400, matched:null, type:'in' },
    { id:'BT004', date:bmAddDays(-2), desc:'จ่าย BYD Auto Thailand', amount:-8990000, matched:'PO001', type:'out' },
    { id:'BT005', date:bmAddDays(-3), desc:'จ่ายเงินเดือน (Batch)', amount:-680000, matched:'PAY-06', type:'out' },
    { id:'BT006', date:bmAddDays(-3), desc:'ค่าธรรมเนียมธนาคาร', amount:-350, matched:null, type:'out' },
    { id:'BT007', date:bmAddDays(-4), desc:'TRF เข้า 086-xxx-1122', amount:8900, matched:null, type:'in' },
  ]
  bankTransactions.forEach(b => { if (!demoCol('bank_transactions')[b.id]) demoCol('bank_transactions')[b.id] = b })


  const plateAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const plateTracking = [
    { id: 'RG001', customer: 'สมชาย ใจดี', model: 'BYD Seal AWD', vin: '...3456', redPlate: 'ก-0042', deliveredDate: plateAddDays(-25), status: 'approved', newPlate: '9กข 1122', note: 'รอนัดติดป้าย' },
    { id: 'RG002', customer: 'มาลี สุขใจ', model: 'BYD Dolphin', vin: '...9012', redPlate: 'ก-0043', deliveredDate: plateAddDays(-40), status: 'plated', newPlate: '8ขค 3344', note: '' },
    { id: 'RG003', customer: 'อรทัย ตั้งใจ', model: 'MG ZS EV', vin: '...7788', redPlate: 'ก-0044', deliveredDate: plateAddDays(-10), status: 'submitted', newPlate: null, note: 'ยื่นเอกสารแล้ว รอขนส่งออกเลข' },
    { id: 'RG004', customer: 'วิรัช เก่งมาก', model: 'BYD Han', vin: '...2233', redPlate: 'ก-0045', deliveredDate: plateAddDays(-3), status: 'red_plate', newPlate: null, note: 'รอเล่มจากไฟแนนซ์' },
    { id: 'RG005', customer: 'ชาตรี เข้มแข็ง', model: 'BYD Atto 3', vin: '...5566', redPlate: 'ก-0041', deliveredDate: plateAddDays(-50), status: 'red_plate', newPlate: null, note: '⚠️ ใช้ป้ายแดงนานเกิน — เร่งดำเนินการ' },
  ]
  plateTracking.forEach(p => { if (!demoCol('plate_tracking')[p.id]) demoCol('plate_tracking')[p.id] = p })


  const fpAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const floorPlan = [
    { id: 'FP001', model: 'BYD Seal AWD', vin: '...5566', principal: 1450000, drawDate: fpAddDays(-95), status: 'active', sold: false },
    { id: 'FP002', model: 'BYD Dolphin', vin: '...1122', principal: 760000, drawDate: fpAddDays(-30), status: 'active', sold: false },
    { id: 'FP003', model: 'BYD Atto 3', vin: '...3344', principal: 930000, drawDate: fpAddDays(-60), status: 'active', sold: false },
    { id: 'FP004', model: 'BYD Han', vin: '...9900', principal: 1780000, drawDate: fpAddDays(-130), status: 'active', sold: false },
    { id: 'FP005', model: 'MG4 Electric', vin: '...7788', principal: 800000, drawDate: fpAddDays(-15), status: 'active', sold: false },
    { id: 'FP006', model: 'BYD Dolphin (ขายแล้ว)', vin: '...4455', principal: 760000, drawDate: fpAddDays(-50), status: 'paid', sold: true },
  ]
  floorPlan.forEach(f => { if (!demoCol('floor_plan')[f.id]) demoCol('floor_plan')[f.id] = f })


  const modelConfigs = [
    {
      id:'MC001', brand:'BYD', model:'Atto 3', variants:[
        { name:'Standard Range', battery:'49.92 kWh', range:'345 km', price:1099900, active:false },
        { name:'Extended Range', battery:'60.48 kWh', range:'420 km', price:1199900, active:true  },
      ],
      options:['NFC Key Card','Solar Roof','Premium Sound System (Dynaudio)','Wireless Charger'],
      colors:['Arctic Blue','Cosmos Black','Ski White','Flame Red'],
    },
    {
      id:'MC002', brand:'BYD', model:'Seal AWD', variants:[
        { name:'Dynamic AWD',   battery:'82.56 kWh', range:'520 km', price:1799900, active:false },
        { name:'Performance',   battery:'82.56 kWh', range:'510 km', price:1999900, active:true  },
      ],
      options:['Carbon Fiber Trim','ADAS Pro Pack','Head-Up Display','Air Suspension'],
      colors:['Cosmos Black','Aurora Silver','Jade Green'],
    },
    {
      id:'MC003', brand:'BYD', model:'Dolphin', variants:[
        { name:'Standard',  battery:'44.9 kWh', range:'340 km', price:699900,  active:false },
        { name:'Boost',     battery:'44.9 kWh', range:'340 km', price:799900,  active:true  },
      ],
      options:['Apple CarPlay','Android Auto','Dash Cam','EV Charger Cable Type 2'],
      colors:['Pearl White','Ocean Blue','Sakura Pink'],
    },
    {
      id:'MC004', brand:'MG', model:'ZS EV', variants:[
        { name:'Luxury',       battery:'50.3 kWh', range:'357 km', price:899900,  active:false },
        { name:'Luxury Plus',  battery:'50.3 kWh', range:'357 km', price:999900,  active:true  },
      ],
      options:['MG iSmart App','360 Camera','Panoramic Sunroof','Premium Leather'],
      colors:['Pearl White','Passion Red','Sterling Grey'],
    },
  ]
  modelConfigs.forEach(m => { if (!demoCol('model_configs')[m.id]) demoCol('model_configs')[m.id] = m })


  const specialEditions = [
    {
      id: 'SE-001', name: 'BYD Seal Performance Edition', model: 'BYD Seal', totalAlloc: 3, arrived: 2,
      price: 1899000, color: 'Midnight Black', launch: '2026-07-01',
      units: [
        { no: 1, vin: 'SEAL-PE-001', status: 'reserved', customer: 'คุณอนันต์', date: '2026-06-10' },
        { no: 2, vin: 'SEAL-PE-002', status: 'available', customer: '', date: '' },
        { no: 3, vin: '', status: 'incoming', customer: '', date: '', eta: '2026-06-20' },
      ]
    },
    {
      id: 'SE-002', name: 'BYD Han Dynasty Edition', model: 'BYD Han', totalAlloc: 2, arrived: 2,
      price: 2299000, color: 'Dynasty Red', launch: '2026-05-15',
      units: [
        { no: 1, vin: 'HAN-DY-001', status: 'delivered', customer: 'คุณมาลี', date: '2026-06-01' },
        { no: 2, vin: 'HAN-DY-002', status: 'reserved', customer: 'คุณวีระ', date: '2026-06-08' },
      ]
    },
    {
      id: 'SE-003', name: 'MG4 XPOWER Limited', model: 'MG4 Electric', totalAlloc: 5, arrived: 0,
      price: 1299000, color: 'Storm Grey', launch: '2026-08-15',
      units: Array.from({ length: 5 }, (_, i) => ({ no: i + 1, vin: '', status: 'incoming', customer: '', date: '', eta: '2026-08-10' }))
    },
  ]
  specialEditions.forEach(s => { if (!demoCol('special_editions')[s.id]) demoCol('special_editions')[s.id] = s })


  const licenses = [
    { id: 'LIC-001', name: 'ใบอนุญาตตัวแทนจำหน่ายรถยนต์', issuer: 'กรมการขนส่งทางบก', no: 'ขย.65-001234', issue: '2023-07-01', expiry: '2026-06-30', renewDays: 60, status: 'expiring', dept: 'บริหาร' },
    { id: 'LIC-002', name: 'ใบอนุญาตประกอบธุรกิจนายหน้าประกันวินาศภัย', issuer: 'คปภ.', no: 'NJ-2023-789012', issue: '2023-04-01', expiry: '2026-09-30', renewDays: 90, status: 'ok', dept: 'ประกัน' },
    { id: 'LIC-003', name: 'ใบอนุญาตประกอบธุรกิจสินเชื่อ (พรบ.)', issuer: 'ธปท.', no: 'FIN-2022-456', issue: '2022-01-15', expiry: '2026-07-15', renewDays: 60, status: 'expiring', dept: 'การเงิน' },
    { id: 'LIC-004', name: 'ใบอนุญาตซ่อมบำรุงรถยนต์ไฟฟ้า (EV)', issuer: 'กพร.', no: 'EV-CERT-2024-001', issue: '2024-03-01', expiry: '2027-02-28', renewDays: 90, status: 'ok', dept: 'บริการ' },
    { id: 'LIC-005', name: 'ป้ายทะเบียนประมูล (Dealer Plate)', issuer: 'กรมการขนส่งทางบก', no: 'DP-99-1234', issue: '2025-01-01', expiry: '2026-12-31', renewDays: 30, status: 'ok', dept: 'โชว์รูม' },
    { id: 'LIC-006', name: 'ใบรับรองมาตรฐาน ISO 9001', issuer: 'สมอ.', no: 'ISO-9001-2024-TH', issue: '2024-06-01', expiry: '2027-05-31', renewDays: 180, status: 'ok', dept: 'คุณภาพ' },
  ]
  licenses.forEach(l => { if (!demoCol('licenses')[l.id]) demoCol('licenses')[l.id] = l })


  const govDocs = [
    { id:'GD001', type:'โอนกรรมสิทธิ์', customer:'คุณวรพจน์ แก้วมณี', vin:'LVVDBCAE1PD123456', status:'กำลังดำเนินการ', dueDate:'2026-06-20', officer:'ฝ่ายทะเบียน', note:'ยื่นกรมขนส่งสาขาบึงกุ่ม' },
    { id:'GD002', type:'ภาษีป้าย', customer:'บริษัท ทรัพย์สมบูรณ์', vin:'LVVDBCAE1PD234567', status:'รอดำเนินการ', dueDate:'2026-07-01', officer:'ฝ่ายทะเบียน', note:'ต่อภาษีประจำปี 2569' },
    { id:'GD003', type:'ตรวจสภาพ (ตรอ.)', customer:'คุณนภา รุ่งเรือง', vin:'LVVDBCAE1PD345678', status:'เสร็จสิ้น', dueDate:'2026-06-15', officer:'ช่างตรวจ', note:'ผ่านเรียบร้อย' },
    { id:'GD004', type:'หนังสือมอบอำนาจ', customer:'คุณพรทิพย์ วงษ์ทอง', vin:'LVVDBCAE1PD456789', status:'รอดำเนินการ', dueDate:'2026-06-25', officer:'Admin', note:'รอลายเซ็นเจ้าของ' },
    { id:'GD005', type:'ทะเบียนรถใหม่', customer:'คุณเกรียงไกร สมศักดิ์', vin:'LVVDBCAE1PD567890', status:'กำลังดำเนินการ', dueDate:'2026-06-22', officer:'ฝ่ายทะเบียน', note:'ยื่นขอหมายเลขทะเบียนแล้ว' },
    { id:'GD006', type:'ประกันภัย', customer:'คุณสมชาย ดีมาก', vin:'LVVDBCAE1PD678901', status:'เสร็จสิ้น', dueDate:'2026-06-10', officer:'ฝ่ายประกัน', note:'คุ้มครองเริ่ม 2026-06-10' },
  ]
  govDocs.forEach(g => { if (!demoCol('gov_docs')[g.id]) demoCol('gov_docs')[g.id] = g })


  const homologations = [
    { id:'HM001', model:'BYD Atto 3', vin_prefix:'LGXC4', standard:'มอก.2718 / ECE R100', category:'Battery Safety', status:'valid', issueDate:'2024-06-01', expDate:'2029-06-01', certNo:'TISI-2024-00412', agency:'สมอ.', note:'แบตฯ Blade LFP ผ่านทุกรายการ' },
    { id:'HM002', model:'BYD Atto 3', vin_prefix:'LGXC4', standard:'ECE R94 / R95', category:'Crash Test', status:'valid', issueDate:'2024-06-01', expDate:'2029-06-01', certNo:'ECE-R94-2024-0872', agency:'TUV SUD', note:'Frontal & Side Impact' },
    { id:'HM003', model:'BYD Seal AWD', vin_prefix:'LGXC5', standard:'มอก.2718 / ECE R100', category:'Battery Safety', status:'valid', issueDate:'2024-09-15', expDate:'2029-09-15', certNo:'TISI-2024-00631', agency:'สมอ.', note:'' },
    { id:'HM004', model:'BYD Seal AWD', vin_prefix:'LGXC5', standard:'ECE R48', category:'Lighting', status:'valid', issueDate:'2024-09-15', expDate:'2029-09-15', certNo:'ECE-R48-2024-0991', agency:'TUV Rheinland', note:'DRL + Matrix LED' },
    { id:'HM005', model:'MG ZS EV', vin_prefix:'LSGBC', standard:'มอก.2718 / ECE R100', category:'Battery Safety', status:'expiring', issueDate:'2021-01-10', expDate:'2026-07-10', certNo:'TISI-2021-00109', agency:'สมอ.', note:'ต้องต่ออายุภายใน 30 วัน' },
    { id:'HM006', model:'MG ZS EV', vin_prefix:'LSGBC', standard:'ECE R12', category:'Steering', status:'valid', issueDate:'2021-01-10', expDate:'2026-01-10', certNo:'ECE-R12-2021-0223', agency:'Bureau Veritas', note:'' },
    { id:'HM007', model:'BYD Han', vin_prefix:'LGXC7', standard:'ECE R100 Amend.3', category:'Battery Safety', status:'valid', issueDate:'2025-02-20', expDate:'2030-02-20', certNo:'TISI-2025-00041', agency:'สมอ.', note:'รุ่นใหม่ล่าสุด' },
  ]
  homologations.forEach(h => { if (!demoCol('homologations')[h.id]) demoCol('homologations')[h.id] = h })


  // ── Comms ──
  const ciAddMins = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  const commMessages = [
    { id:'M001', channel:'line',     sender:'วิชัย มีโชค',     avatar:'👨', subject:'สอบถามราคา BYD Seal',       preview:'ขอโบรชัวร์และราคา BYD Seal AWD ด้วยครับ', time: ciAddMins(5),   status:'unread', tags:['lead', 'pricing'] },
    { id:'M002', channel:'facebook', sender:'สุดา อารมณ์ดี',   avatar:'👩', subject:'ถามเรื่องโปรโมชัน',         preview:'มีโปรโมชันดาวน์ 0% ไหมคะ', time: ciAddMins(12),  status:'unread', tags:['promotion'] },
    { id:'M003', channel:'email',    sender:'ธนา เก่งกว่า',    avatar:'👨', subject:'ขอใบเสนอราคา MG ZS EV',    preview:'ต้องการใบเสนอราคา MG ZS EV สำหรับองค์กร 5 คัน', time: ciAddMins(30),  status:'pending', tags:['b2b', 'quote'] },
    { id:'M004', channel:'line',     sender:'อรวรรณ ขยัน',     avatar:'👩', subject:'นัดทดลองขับ',               preview:'อยากนัดทดลองขับ BYD Atto 3 วันเสาร์นี้ได้ไหมคะ', time: ciAddMins(45),  status:'replied', tags:['test-drive'] },
    { id:'M005', channel:'internal', sender:'สมชาย ผู้จัดการ', avatar:'👤', subject:'ประชุมทีมขาย 14:00',        preview:'ขอให้ทุกคนเตรียมรายงานยอดขายมาด้วย', time: ciAddMins(60),  status:'read', tags:['meeting'] },
    { id:'M006', channel:'sms',      sender:'+66891234567',     avatar:'📱', subject:'แจ้งเตือนต่ออายุประกัน',  preview:'ประกันรถของท่านจะหมดอายุใน 7 วัน กรุณาต่ออายุ', time: ciAddMins(90),  status:'read', tags:['insurance'] },
    { id:'M007', channel:'facebook', sender:'ปทิตา สาวสวย',    avatar:'👩', subject:'สอบถามการผ่อนชำระ',        preview:'ดอกเบี้ยไฟแนนซ์คิดยังไงครับ มีดาวน์ขั้นต่ำเท่าไร', time: ciAddMins(120), status:'unread', tags:['finance'] },
    { id:'M008', channel:'line',     sender:'ชัยวัฒน์ ลูกค้า', avatar:'👨', subject:'ร้องเรียนงานซ่อม',         preview:'ส่งรถมาซ่อมแล้ว 3 วัน ยังไม่เสร็จ ทำไมนานมาก', time: ciAddMins(180), status:'pending', tags:['complaint', 'urgent'] },
  ]
  commMessages.forEach(m => { if (!demoCol('comm_messages')[m.id]) demoCol('comm_messages')[m.id] = m })


  const bcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  const bcAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const broadcasts = [
    { id:'BC001', title:'โปรโมชันพิเศษ BYD Seal — ดาวน์ 0%', channel:'line', status:'sent', target:'prospects', recipients:342, delivered:338, opened:156, clicked:42, sentAt: bcAddHours(48), scheduledAt: null, message:'สวัสดีค่ะ! LAMOM EV มีโปรโมชันพิเศษ BYD Seal สุดคุ้ม ดาวน์ 0% ฟรีประกันชั้น 1 ปีแรก สนใจติดต่อ 02-xxx-xxxx' },
    { id:'BC002', title:'แจ้งเตือนต่ออายุประกัน', channel:'sms', status:'sent', target:'expiring', recipients:28, delivered:27, opened:27, clicked:18, sentAt: bcAddHours(24), scheduledAt: null, message:'เรียนคุณลูกค้า ประกันรถของท่านจะหมดอายุใน 7 วัน กรุณาต่ออายุได้ที่ 02-xxx-xxxx' },
    { id:'BC003', title:'นัดเช็คระยะ 10,000 กม.', channel:'line', status:'scheduled', target:'service_due', recipients:45, delivered:0, opened:0, clicked:0, sentAt: null, scheduledAt: bcAddDays(1) + 'T09:00:00', message:'ถึงเวลาเช็คระยะ 10,000 กม. แล้วครับ! นัดเข้ามาที่ศูนย์บริการได้เลยครับ' },
    { id:'BC004', title:'Happy New Year 2025', channel:'email', status:'sent', target:'all', recipients:1250, delivered:1198, opened:445, clicked:87, sentAt: bcAddHours(720), scheduledAt: null, message:'สวัสดีปีใหม่ 2025 จาก LAMOM EV ขอบคุณที่ไว้วางใจเราตลอดมา' },
    { id:'BC005', title:'Flash Sale — อุปกรณ์ EV ลด 20%', channel:'push', status:'draft', target:'owners', recipients:0, delivered:0, opened:0, clicked:0, sentAt: null, scheduledAt: null, message:'Flash Sale! อุปกรณ์เสริม EV ลด 20% วันนี้เท่านั้น!' },
  ]
  broadcasts.forEach(b => { if (!demoCol('broadcasts')[b.id]) demoCol('broadcasts')[b.id] = b })


  const smsAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

  const smsCampaigns = [
    { id:'SMS001', name:'แจ้งโปรโมชั่นเดือนมิ.ย.', recipients:542, sent:542, failed:8, status:'sent', cost:542, time: smsAddDays(-5), message:'LAMOM: โปรพิเศษเดือนนี้! ซื้อ BYD Dolphin รับส่วนลด 50,000 บาท สอบถาม 02-xxx-xxxx' },
    { id:'SMS002', name:'แจ้งเช็คระยะตามนัด', recipients:87, sent:85, failed:2, status:'sent', cost:87, time: smsAddDays(-3), message:'LAMOM: รถของคุณถึงกำหนดเช็คระยะ กรุณานัดหมายได้ที่ 02-xxx-xxxx' },
    { id:'SMS003', name:'Welcome ลูกค้าใหม่ (สัปดาห์นี้)', recipients:12, sent:0, failed:0, status:'scheduled', cost:0, time: smsAddDays(1), message:'ยินดีต้อนรับสู่ครอบครัว LAMOM! หากมีคำถามติดต่อ 02-xxx-xxxx' },
    { id:'SMS004', name:'Win-back ลูกค้า at risk', recipients:32, sent:0, failed:0, status:'draft', cost:0, time: null, message:'LAMOM: เราคิดถึงคุณ! มาเยี่ยมชมโปรแกรมใหม่ได้ที่โชว์รูม รับส่วนลดพิเศษสำหรับลูกค้าเก่า' },
  ]
  smsCampaigns.forEach(s => { if (!demoCol('sms_campaigns')[s.id]) demoCol('sms_campaigns')[s.id] = s })


  const customerAreas = [
    { id:'ca1', province:'กรุงเทพมหานคร', district:'พระโขนง', customerCount:45, leadCount:12, bookingCount:8, coords:{ lat:13.703, lng:100.601 }, topModel:'BYD Seal' },
    { id:'ca2', province:'กรุงเทพมหานคร', district:'บางนา', customerCount:38, leadCount:9, bookingCount:5, coords:{ lat:13.674, lng:100.607 }, topModel:'BYD Atto 3' },
    { id:'ca3', province:'นนทบุรี', district:'เมือง', customerCount:22, leadCount:7, bookingCount:3, coords:{ lat:13.856, lng:100.519 }, topModel:'BYD Dolphin' },
    { id:'ca4', province:'ปทุมธานี', district:'ลำลูกกา', customerCount:18, leadCount:5, bookingCount:2, coords:{ lat:13.960, lng:100.760 }, topModel:'DEEPAL S7' },
  ]
  customerAreas.forEach(c => { if (!demoCol('customer_areas')[c.id]) demoCol('customer_areas')[c.id] = c })


  const voiceNotes = [
    { id: 'VN-001', customer: 'คุณอนันต์ รักดี', duration: '3:42', date: new Date(Date.now()-86400000*1).toISOString(), summary: 'ลูกค้าสนใจ BYD Atto 3 สีฟ้า เงินดาวน์ได้ 30% ผ่อน 60 งวด ต้องการ Test Drive เสาร์นี้', followUps: ['นัด Test Drive เสาร์นี้', 'เตรียมใบเสนอราคา 3 รุ่น'], sentiment: 'hot', tags: ['test-drive','atto3'] },
    { id: 'VN-002', customer: 'คุณมาลี วงศ์ดี', duration: '1:55', date: new Date(Date.now()-86400000*2).toISOString(), summary: 'ลูกค้าโทรถามราคา BYD Dolphin ยังไม่ได้ตัดสินใจ รอคุยกับสามี บอกจะโทรกลับสัปดาห์หน้า', followUps: ['โทรติดตาม 7 วัน'], sentiment: 'warm', tags: ['dolphin'] },
    { id: 'VN-003', customer: 'บ.รุ่งเรือง (คุณสมชาย)', duration: '8:10', date: new Date(Date.now()-86400000*3).toISOString(), summary: 'Fleet deal 5 คัน BYD Atto 3 Pro ต้องการราคาพิเศษ ส่งมอบได้ภายใน Q3 เงื่อนไขผ่อนบริษัท ต้องการ quotation ภายใน 2 วัน', followUps: ['ส่ง Fleet Quotation ภายใน 2 วัน', 'ประสาน Finance เรื่องสัญญาลีสซิ่ง'], sentiment: 'hot', tags: ['fleet','atto3-pro'] },
  ]
  voiceNotes.forEach(v => { if (!demoCol('voice_notes')[v.id]) demoCol('voice_notes')[v.id] = v })


  const welfare = [
    { id:'wf1', type:'ประกันสุขภาพ', provider:'AIA', coverage:500000, premium:12000, enrolledCount:12, status:'active', renewalDate:'2026-12-31', createdAt:'2026-01-01' },
    { id:'wf2', type:'ประกันอุบัติเหตุ', provider:'กรุงเทพประกัน', coverage:1000000, premium:3600, enrolledCount:15, status:'active', renewalDate:'2026-12-31', createdAt:'2026-01-01' },
  ]
  welfare.forEach(w => { if (!demoCol('welfare')[w.id]) demoCol('welfare')[w.id] = w })


  const receipts = [
    { id:'rc1', receiptNo:'RC-2026-001', custName:'ธีรพงศ์ แสงทอง', amount:1299000, type:'ค่ารถ BYD Seal', paymentMethod:'โอนธนาคาร', bookingRef:'BK-001', issuedAt: new Date(Date.now()-86400000*3).toISOString(), createdAt: new Date(Date.now()-86400000*3).toISOString() },
    { id:'rc2', receiptNo:'RC-2026-002', custName:'สุภาพร ใจดี', amount:50000, type:'มัดจำ BYD Atto 3', paymentMethod:'บัตรเครดิต', bookingRef:'BK-002', issuedAt: new Date(Date.now()-86400000*1).toISOString(), createdAt: new Date(Date.now()-86400000*1).toISOString() },
  ]
  receipts.forEach(r => { if (!demoCol('receipts')[r.id]) demoCol('receipts')[r.id] = r })


  // ── Marketing Extras ──
  const landingPages = [
    { id:'lp1', title:'BYD Atto 3 โปรพิเศษ มิ.ย.',  campaign:'BYD June',    visits:1240, leads:87,  conv:7.0, status:'active', created:'2026-06-01' },
    { id:'lp2', title:'BYD Seal AWD Launch Event',   campaign:'Seal Launch', visits:890,  leads:62,  conv:7.0, status:'active', created:'2026-05-15' },
    { id:'lp3', title:'ทดลองขับ BYD Dolphin ฟรี',    campaign:'Test Drive',  visits:2100, leads:145, conv:6.9, status:'active', created:'2026-05-01' },
    { id:'lp4', title:'มอเตอร์โชว์ 2026',             campaign:'Motor Show',  visits:5600, leads:312, conv:5.6, status:'ended',  created:'2026-03-20' },
    { id:'lp5', title:'โปรต้นปี 2569',                campaign:'New Year',    visits:3200, leads:198, conv:6.2, status:'ended',  created:'2026-01-01' },
  ]
  landingPages.forEach(l => { if (!demoCol('landing_pages')[l.id]) demoCol('landing_pages')[l.id] = l })


  const utmLinks = [
    { id:'utm1', name:'Facebook June Promo', url:'https://lamom.one/atto3',  source:'facebook', medium:'paid',   campaign:'june_promo',  clicks:1240, leads:87,  conv:7.0, created:'2026-06-01' },
    { id:'utm2', name:'Google Search BYD',   url:'https://lamom.one/byd',    source:'google',   medium:'cpc',    campaign:'byd_search',  clicks:890,  leads:54,  conv:6.1, created:'2026-05-15' },
    { id:'utm3', name:'LINE Official June',  url:'https://lamom.one/line',   source:'line',     medium:'social', campaign:'line_june',   clicks:2100, leads:89,  conv:4.2, created:'2026-06-01' },
    { id:'utm4', name:'TikTok Viral Clip',   url:'https://lamom.one/tiktok', source:'tiktok',   medium:'video',  campaign:'viral_q2',    clicks:5600, leads:145, conv:2.6, created:'2026-05-20' },
    { id:'utm5', name:'Email Newsletter',    url:'https://lamom.one/email',  source:'email',    medium:'email',  campaign:'newsletter',  clicks:320,  leads:38,  conv:11.9,created:'2026-06-10' },
  ]
  utmLinks.forEach(u => { if (!demoCol('utm_links')[u.id]) demoCol('utm_links')[u.id] = u })


  const walkIns = [
    { id: 'W001', name: 'สมชาย ใจดี', phone: '085-xxx', interestedIn: 'BYD Atto 3', interest: 'hot', staff: 'วิชัย ยอดขาย', outcome: 'test_drive', visitTime: wiAddHours(1), notes: 'มาแล้ว 2 ครั้ง สนใจมาก' },
    { id: 'W002', name: 'มาลี สุขใจ', phone: '086-xxx', interestedIn: 'BYD Dolphin', interest: 'warm', staff: 'สุดา มาดี', outcome: 'quotation', visitTime: wiAddHours(2), notes: '' },
    { id: 'W003', name: 'ธนพล เที่ยงตรง', phone: '087-xxx', interestedIn: 'ยังไม่แน่ใจ', interest: 'browse', staff: 'ธนา เก่ง', outcome: 'leave', visitTime: wiAddHours(3), notes: 'สนใจ EV ทั่วไป' },
    { id: 'W004', name: 'อรทัย ตั้งใจ', phone: '088-xxx', interestedIn: 'MG ZS EV', interest: 'hot', staff: 'วิชัย ยอดขาย', outcome: 'book', visitTime: wiAddHours(4), notes: 'วางมัดจำ 10,000 บาทแล้ว' },
    { id: 'W005', name: 'ชัยชนะ ดีเสมอ', phone: '089-xxx', interestedIn: 'BYD Seal AWD', interest: 'warm', staff: 'สุดา มาดี', outcome: 'follow_up', visitTime: wiAddHours(6), notes: 'นัดอีกครั้งพรุ่งนี้' },
  ]
  walkIns.forEach(w => { if (!demoCol('walk_ins')[w.id]) demoCol('walk_ins')[w.id] = w })


  // Showroom appointments
  const apAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const appointments = [
    { id:'SRA001', custName:'สมหมาย หมายดี', phone:'0811111111', email:'', purpose:'ทดลองขับ', interestedIn:'BYD Seal AWD', date:apAddDays(0), time:'10:00', salesperson:'วิชาญ มีโชค', status:'confirmed', note:'ลูกค้า LINE ถาม EV สีขาว', source:'LINE OA', budget:1300000 },
    { id:'SRA002', custName:'มานี มีศรี', phone:'0822222222', email:'manee@email.com', purpose:'ดูรถ / สอบถาม', interestedIn:'MG4 X', date:apAddDays(0), time:'14:00', salesperson:'อรนุช สายใจ', status:'arrived', note:'', source:'Facebook', budget:1000000 },
    { id:'SRA003', custName:'วันดี อยู่เย็น', phone:'0833333333', email:'', purpose:'รับใบเสนอราคา', interestedIn:'BYD Atto3', date:apAddDays(1), time:'09:30', salesperson:'วิชาญ มีโชค', status:'scheduled', note:'ต้องการ 2 ใบเสนอราคา เปรียบเทียบ 2 รุ่น', source:'Walk-in', budget:900000 },
    { id:'SRA004', custName:'ประเสริฐ ดีเสมอ', phone:'0844444444', email:'', purpose:'ปิดดีล / เซ็นสัญญา', interestedIn:'BYD Seal AWD', date:apAddDays(1), time:'13:00', salesperson:'อรนุช สายใจ', status:'scheduled', note:'ตกลงราคาแล้ว มาเซ็น', source:'Referral', budget:1299000 },
    { id:'SRA005', custName:'สุรีย์ แสนดี', phone:'0855555555', email:'', purpose:'รับรถ (Delivery)', interestedIn:'MG ZS EV', date:apAddDays(2), time:'10:00', salesperson:'วิชาญ มีโชค', status:'scheduled', note:'เตรียม Delivery Kit + ถ่ายรูป', source:'Sale Team', budget:1049000 },
  ]
  appointments.forEach(a => { if (!demoCol('appointments')[a.id]) demoCol('appointments')[a.id] = a })


  const referrals = [
    { id: 'REF001', referrer: 'วิชัย มีโชค', referrerPhone: '085-xxx', referee: 'สมหมาย ดีใจ', refereePhone: '088-xxx', model: 'BYD Seal AWD', status: 'paid', reward: 3000, submitDate: refAddDays(-30) },
    { id: 'REF002', referrer: 'สุดา อารมณ์ดี', referrerPhone: '086-xxx', referee: 'มานี สุขใจ', refereePhone: '089-xxx', model: 'BYD Atto 3', status: 'qualified', reward: 3000, submitDate: refAddDays(-15) },
    { id: 'REF003', referrer: 'วิชัย มีโชค', referrerPhone: '085-xxx', referee: 'บุญมา ยิ้มแย้ม', refereePhone: '090-xxx', model: 'MG ZS EV', status: 'qualified', reward: 3000, submitDate: refAddDays(-8) },
    { id: 'REF004', referrer: 'ธนา เก่งกว่า', referrerPhone: '087-xxx', referee: 'ชัย ซื้อรถใหม่', refereePhone: '091-xxx', model: 'BYD Dolphin', status: 'pending', reward: 2500, submitDate: refAddDays(-3) },
    { id: 'REF005', referrer: 'สุดา อารมณ์ดี', referrerPhone: '086-xxx', referee: 'อรวรรณ คิดนาน', refereePhone: '092-xxx', model: 'BYD Seal AWD', status: 'rejected', reward: 0, submitDate: refAddDays(-20) },
  ]
  referrals.forEach(r => { if (!demoCol('referrals')[r.id]) demoCol('referrals')[r.id] = r })


  const quotations = [
    {
      id: 'QT001', customerName: 'วิชาญ มีโชค', phone: '081-234-5678',
      vehicleLabel: 'BYD Seal AWD Performance', basePrice: 1449000,
      color: 'Cosmos Black', downPayment: 290000, term: 60, rate: 2.75,
      accessories: ['A001', 'A003', 'A004'],
      discount: 20000, tradeIn: 0, finalPrice: 1429000, monthlyPayment: 22500,
      status: 'accepted', createdDate: qtAddDays(-14), validUntil: qtAddDays(16), salesperson: 'อรนุช สายใจ',
      notes: 'ลูกค้าตัดสินใจซื้อ'
    },
    {
      id: 'QT002', customerName: 'ประยุทธ ดีใจ', phone: '085-678-9012',
      vehicleLabel: 'BYD Seal Standard Range', basePrice: 1199000,
      color: 'Sky Blue', downPayment: 200000, term: 60, rate: 2.99,
      accessories: ['A001', 'A007'],
      discount: 10000, tradeIn: 150000, finalPrice: 1039000, monthlyPayment: 16800,
      status: 'sent', createdDate: qtAddDays(-3), validUntil: qtAddDays(27), salesperson: 'อรนุช สายใจ',
      notes: 'รอลูกค้าตัดสินใจ'
    },
    {
      id: 'QT003', customerName: 'มาลี สุขสันต์', phone: '086-789-0123',
      vehicleLabel: 'MG ZS EV Grand Luxury', basePrice: 1059000,
      color: 'Pearl White', downPayment: 150000, term: 72, rate: 3.15,
      accessories: ['A001', 'A003'],
      discount: 0, tradeIn: 0, finalPrice: 1059000, monthlyPayment: 17200,
      status: 'draft', createdDate: qtAddDays(-1), validUntil: qtAddDays(29), salesperson: 'วิชาญ มีโชค',
      notes: ''
    },
  ]
  quotations.forEach(q => { if (!demoCol('quotations')[q.id]) demoCol('quotations')[q.id] = q })


  // Car photos
  const carPhotos = [
    { id:'cp1', model:'BYD Seal AWD', vin:'LGXCE4C10PA000001', color:'ขาว Pearl', photoCount:12, lastShoot:'2025-03-02', status:'complete', photographer:'ทีม Digital' },
    { id:'cp2', model:'MG4 X-Power', vin:'SDUZZZEF5PA000003', color:'แดง Dragon', photoCount:8, lastShoot:'2025-03-12', status:'complete', photographer:'ทีม Digital' },
    { id:'cp3', model:'DEEPAL S7 Pro', vin:'LZEZ1EBA0PA000004', color:'ดำ Obsidian', photoCount:0, lastShoot:'', status:'pending', photographer:'' },
  ]
  carPhotos.forEach(c => { if (!demoCol('car_photos')[c.id]) demoCol('car_photos')[c.id] = c })


  // Price history
  const priceHistory = [
    { id:'PH001', model:'BYD Atto 3', date:'2026-06-01', oldPrice:1129000, newPrice:1099000, change:-30000, reason:'โปรโมชั่น Mid-Year', by:'Manager', approved:true },
    { id:'PH002', model:'BYD Seal AWD', date:'2026-05-15', oldPrice:1749000, newPrice:1699000, change:-50000, reason:'ลดราคาเพื่อแข่ง Tesla Model 3', by:'Director', approved:true },
    { id:'PH003', model:'BYD Han', date:'2026-05-01', oldPrice:2199000, newPrice:2099000, change:-100000, reason:'เปิดตัวรุ่น 2026 ใหม่', by:'Director', approved:true },
    { id:'PH004', model:'BYD Dolphin', date:'2026-04-10', oldPrice:849000, newPrice:899000, change:50000, reason:'ต้นทุนแบตฯ เพิ่ม MY2026', by:'Manager', approved:true },
    { id:'PH005', model:'MG ZS EV', date:'2026-04-01', oldPrice:829000, newPrice:799000, change:-30000, reason:'ยกระดับการแข่งขัน Atto 3', by:'Manager', approved:true },
    { id:'PH006', model:'BYD Atto 3', date:'2026-03-01', oldPrice:1149000, newPrice:1129000, change:-20000, reason:'Q1 Sales Drive', by:'Manager', approved:true },
    { id:'PH007', model:'BYD Seal AWD', date:'2026-02-14', oldPrice:1799000, newPrice:1749000, change:-50000, reason:'Valentine Campaign', by:'Manager', approved:true },
  ]
  priceHistory.forEach(p => { if (!demoCol('price_history')[p.id]) demoCol('price_history')[p.id] = p })


  // Model year changeovers
  const modelYearChangeovers = [
    { id:'myc1', model:'BYD Atto 3', oldYear:2024, newYear:2025, announcedDate:'2026-06-01', effectiveDate:'2026-08-01', oldStockLeft:3, oldPrice:1099000, newPrice:1149000, changes:['ระบบเสียง ซอฟต์แวร์ใหม่', 'สี Jade Green เพิ่ม', 'แบตฯ เพิ่ม 5 km range'], status:'announced' },
    { id:'myc2', model:'BYD Dolphin', oldYear:2023, newYear:2024, announcedDate:'2026-04-10', effectiveDate:'2026-06-01', oldStockLeft:0, oldPrice:899000, newPrice:899000, changes:['ปรับแต่ง Firmware OTA', 'เพิ่ม Warranty 1 ปี'], status:'active' },
    { id:'myc3', model:'MG4 Electric', oldYear:2024, newYear:2025, announcedDate:'2026-07-01', effectiveDate:'2026-09-01', oldStockLeft:5, oldPrice:949000, newPrice:979000, changes:['Power เพิ่ม 15kW', 'จอ 12.3" ใหม่', 'ระบบ AR HUD'], status:'upcoming' },
  ]
  modelYearChangeovers.forEach(m => { if (!demoCol('model_year_changeovers')[m.id]) demoCol('model_year_changeovers')[m.id] = m })


  // Petty cash
  const pettyCash = [
    { id:'pc1', type:'out', cat:'refresh', amount:850, desc:'ซื้อกาแฟ-น้ำดื่มสำหรับโชว์รูม', by:'อรนุช เซลส์ดี', time: new Date(Date.now()-3600000*3).toISOString(), receipt:true, status:'approved' },
    { id:'pc2', type:'out', cat:'supplies', amount:1200, desc:'ค่าน้ำยาทำความสะอาดรถ', by:'สมชาย ช่างดี', time: new Date(Date.now()-86400000).toISOString(), receipt:true, status:'approved' },
    { id:'pc3', type:'in', cat:'other', amount:5000, desc:'เติมเงินสดย่อย ประจำสัปดาห์', by:'ทวีศักดิ์ สุขสมบัติเสถียร', time: new Date(Date.now()-86400000*2).toISOString(), receipt:false, status:'approved' },
    { id:'pc4', type:'out', cat:'transport', amount:450, desc:'ค่าน้ำมันรถส่งเอกสาร', by:'วิชัย ขายเก่ง', time: new Date(Date.now()-86400000*3).toISOString(), receipt:true, status:'approved' },
    { id:'pc5', type:'out', cat:'repair', amount:600, desc:'ซ่อมประตูห้องน้ำพนักงาน', by:'มานะ ขยัน', time: new Date(Date.now()-3600000*5).toISOString(), receipt:false, status:'pending' },
  ]
  pettyCash.forEach(p => { if (!demoCol('petty_cash')[p.id]) demoCol('petty_cash')[p.id] = p })


  // Monthly close items
  const mcPeriod = new Date().toISOString().slice(0, 7)

  const monthlyCloseItems = [
    { id:'mc1', period:mcPeriod, category:'รายรับ', name:'รายรับขายรถ', amount:12987000, responsible:'การเงิน', status:'done' },
    { id:'mc2', period:mcPeriod, category:'รายรับ', name:'รายรับบริการ', amount:524000, responsible:'บริการ', status:'done' },
    { id:'mc3', period:mcPeriod, category:'รายรับ', name:'รายรับประกัน', amount:187000, responsible:'ประกัน', status:'done' },
    { id:'mc4', period:mcPeriod, category:'ต้นทุน', name:'ต้นทุนรถ (COGS)', amount:-10389600, responsible:'การเงิน', status:'done' },
    { id:'mc5', period:mcPeriod, category:'ต้นทุน', name:'ต้นทุนอะไหล่', amount:-198000, responsible:'บริการ', status:'done' },
    { id:'mc6', period:mcPeriod, category:'ค่าใช้จ่าย', name:'เงินเดือนพนักงาน', amount:-680000, responsible:'HR', status:'pending' },
    { id:'mc7', period:mcPeriod, category:'ค่าใช้จ่าย', name:'ค่าเช่า + สาธารณูปโภค', amount:-120000, responsible:'การเงิน', status:'done' },
    { id:'mc8', period:mcPeriod, category:'ค่าใช้จ่าย', name:'ค่าการตลาด', amount:-85000, responsible:'การตลาด', status:'pending' },
    { id:'mc9', period:mcPeriod, category:'ค่าใช้จ่าย', name:'ค่า Commission', amount:-259740, responsible:'การเงิน', status:'pending' },
    { id:'mc10', period:mcPeriod, category:'ปรับปรุง', name:'ค่าเสื่อมราคา', amount:-45000, responsible:'การเงิน', status:'review' },
    { id:'mc11', period:mcPeriod, category:'ปรับปรุง', name:'ปรับมูลค่าสต็อก', amount:-12000, responsible:'DMS', status:'review' },
  ]
  monthlyCloseItems.forEach(m => { if (!demoCol('monthly_close_items')[m.id]) demoCol('monthly_close_items')[m.id] = m })


  // Purchase orders
  const pordAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  const pordAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  const purchaseOrders = [
    { id:'PO001', title:'สั่งรถ BYD Atto 3 จำนวน 5 คัน', cat:'vehicle', supplier:'BYD Thailand', amount:5495000, status:'approved', requestDate:pordAddHours(48), approvedBy:'สมชาย ผจก.', expectedDate:pordAddDays(14) },
    { id:'PO002', title:'อะไหล่ชุดเบรก MG 20 ชุด', cat:'parts', supplier:'MG Parts Thailand', amount:85000, status:'received', requestDate:pordAddHours(120), approvedBy:'สมชาย ผจก.', expectedDate:pordAddDays(-3) },
    { id:'PO003', title:'น้ำมันเครื่อง Shell 5W-30 x 50 ถัง', cat:'supplies', supplier:'Shell Thailand', amount:48500, status:'pending', requestDate:pordAddHours(8), approvedBy:null, expectedDate:pordAddDays(7) },
    { id:'PO004', title:'สั่งรถ BYD Dolphin 3 คัน', cat:'vehicle', supplier:'BYD Thailand', amount:2097000, status:'ordered', requestDate:pordAddHours(72), approvedBy:'สมชาย ผจก.', expectedDate:pordAddDays(21) },
    { id:'PO005', title:'ซ่อม Lift ช่าง 2 ตัว', cat:'service', supplier:'TA Tech', amount:32000, status:'draft', requestDate:pordAddHours(2), approvedBy:null, expectedDate:pordAddDays(5) },
  ]
  purchaseOrders.forEach(p => { if (!demoCol('purchase_orders')[p.id]) demoCol('purchase_orders')[p.id] = p })


  // Documents (Document Studio)
  const documents = [
    { id:'doc1', title:'ใบจองรถ SK2506001 — ธีรพงศ์ แสงทอง', type:'booking', status:'final', createdAt:'2025-06-01', createdBy:'อรนุช เซลส์ดี', size:1 },
    { id:'doc2', title:'สัญญาจะซื้อจะขาย BYD Seal AWD', type:'contract', status:'signed', createdAt:'2025-06-05', createdBy:'อรนุช เซลส์ดี', size:3 },
    { id:'doc3', title:'ใบส่งมอบรถ GWM ORA Good Cat', type:'delivery', status:'final', createdAt:'2025-05-28', createdBy:'อรนุช เซลส์ดี', size:2 },
    { id:'doc4', title:'ใบเสนอราคา DEEPAL S7 Pro', type:'quotation', status:'draft', createdAt:'2025-06-08', createdBy:'วิชัย ขายเก่ง', size:1 },
  ]
  documents.forEach(d => { if (!demoCol('documents')[d.id]) demoCol('documents')[d.id] = d })


  const ssStaffDefaults = [
    { id:'ST001', dept:'sales' }, { id:'ST002', dept:'sales' }, { id:'ST003', dept:'service' },
    { id:'ST004', dept:'service' }, { id:'ST005', dept:'admin' }, { id:'ST006', dept:'service' },
  ]

  const shiftSchedules = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(ssWeekStart); d.setDate(ssWeekStart.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const dow = d.getDay()
    ssStaffDefaults.forEach(s => {
      let shift = 'day'
      if (dow === 0) shift = 'off'
      else if (dow === 6 && s.dept === 'admin') shift = 'off'
      else if (dow !== 6 && s.dept === 'service') shift = 'morning'
      shiftSchedules.push({ id:`SS-${dateStr}-${s.id}`, staffId:s.id, date:dateStr, shift })
    })
  }
  shiftSchedules.forEach(s => { if (!demoCol('shift_schedules')[s.id]) demoCol('shift_schedules')[s.id] = s })


  const serviceHistoryRecords = [
    { id:'SH001', vehicleId:'VH001', customerName:'วิชาญ มีโชค', phone:'081-234-5678',
      brand:'BYD', model:'Seal AWD', plate:'กก 1234', vin:'LBWAB2EB7PD001002', mileage:12500,
      type:'periodic', technicianName:'สมชาย ช่างฝีมือ', date:shAddDays(-30), completedDate:shAddDays(-30),
      status:'delivered', laborCost:1800, partsCost:3200, totalCost:5000, nextServiceDate:shAddDays(150), nextServiceMileage:22500,
      services:['เปลี่ยนน้ำมันเครื่อง', 'เปลี่ยนกรองอากาศ', 'ตรวจระบบเบรก', 'ตรวจระดับน้ำยาระบายความร้อน EV'],
      notes:'รถอยู่ในสภาพดี ยางหน้าเริ่มสึก แนะนำเปลี่ยนใน 5000 กม.' },
    { id:'SH002', vehicleId:'VH002', customerName:'อรนุช สาวสวย', phone:'082-345-6789',
      brand:'MG', model:'ZS EV', plate:'ขข 5678', vin:'LSJWSRAR7NE001008', mileage:8200,
      type:'repair', technicianName:'วิทยา ช่างไฟ', date:shAddDays(-7), completedDate:shAddDays(-5),
      status:'delivered', laborCost:2500, partsCost:1200, totalCost:3700, nextServiceDate:shAddDays(120), nextServiceMileage:18200,
      services:['ซ่อมระบบ AC ไม่เย็น', 'เติมน้ำยา AC', 'ตรวจสอบ Compressor'],
      notes:'น้ำยา AC รั่วที่ข้อต่อ ซ่อมและเติมน้ำยาใหม่แล้ว' },
    { id:'SH003', vehicleId:'VH003', customerName:'ธีรยุทธ เก่งกาจ', phone:'083-456-7890',
      brand:'BYD', model:'Atto 3', plate:'คค 9012', vin:'LBWAB2EB7PD001003', mileage:3100,
      type:'warranty', technicianName:'สมชาย ช่างฝีมือ', date:shAddDays(-2), completedDate:null,
      status:'in_progress', laborCost:0, partsCost:0, totalCost:0, nextServiceDate:null, nextServiceMileage:null,
      services:['ตรวจสอบเสียงดังจากช่วงล่าง', 'ตรวจสอบระบบ OTA'],
      notes:'รอผลตรวจ — อาจต้องรออะไหล่' },
    { id:'SH004', vehicleId:'VH004', customerName:'สมใจ รักรถ', phone:'084-567-8901',
      brand:'BYD', model:'Seal SR', plate:'งง 3456', vin:'LBWAB2EB7PD001004', mileage:5800,
      type:'periodic', technicianName:'วิทยา ช่างไฟ', date:shAddDays(2), completedDate:null,
      status:'pending', laborCost:1200, partsCost:900, totalCost:2100, nextServiceDate:null, nextServiceMileage:null,
      services:['ตรวจตามระยะ 6,000 กม.'],
      notes:'' },
  ]
  serviceHistoryRecords.forEach(r => { if (!demoCol('service_history_records')[r.id]) demoCol('service_history_records')[r.id] = r })

}
