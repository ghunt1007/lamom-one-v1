// Demo seed data — quality module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  const now = new Date()
  const addDaysISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // Legal Reference — คลังกฎหมายยานยนต์ + แรงงาน (หน้า /quality/legal-reference)
  const legalRefDemo = [
    { id:'LR001', title:'การจดทะเบียนและการโอนกรรมสิทธิ์รถยนต์', lawName:'พ.ร.บ.รถยนต์ พ.ศ. 2522', category:'vehicle_reg', domain:'automotive',
      summary:'กำหนดหลักเกณฑ์การจดทะเบียนรถใหม่ การต่ออายุทะเบียน (ต่อภาษีประจำปี) และการโอนกรรมสิทธิ์รถยนต์ที่จำหน่ายให้ลูกค้า ผู้จำหน่ายต้องดำเนินการให้ถูกต้องก่อนส่งมอบรถ',
      keyPoints:['ตรวจสอบเลขตัวถัง/เลขเครื่องยนต์ให้ตรงกับเอกสารก่อนจดทะเบียน','แจ้งโอนกรรมสิทธิ์ภายใน 15 วันหลังส่งมอบ','ต่อภาษีประจำปีล่วงหน้าไม่เกิน 90 วันก่อนวันครบกำหนด'],
      penalty:'ปรับไม่เกิน 2,000 บาท กรณีแจ้งโอนล่าช้า และรถที่ไม่ต่อทะเบียนเกิน 3 ปีอาจถูกระงับทะเบียน' },
    { id:'LR002', title:'มาตรฐานความปลอดภัยและการควบคุมน้ำหนักบรรทุก', lawName:'พ.ร.บ.การขนส่งทางบก พ.ศ. 2522', category:'transport', domain:'automotive',
      summary:'ควบคุมมาตรฐานรถที่ใช้ในการขนส่ง (รถกระบะดัดแปลง รถบรรทุก) รวมถึงใบอนุญาตประกอบการขนส่งสำหรับกิจการที่มีรถรับส่งลูกค้า/ขนส่งอะไหล่',
      keyPoints:['รถยนต์ดัดแปลงเพื่อจำหน่ายต้องผ่านการตรวจสภาพก่อนจดทะเบียน','กิจการที่มีรถรับส่งลูกค้าประจำต้องขอใบอนุญาตประกอบการขนส่ง'],
      penalty:'ปรับไม่เกิน 50,000 บาท กรณีประกอบการขนส่งโดยไม่ได้รับอนุญาต' },
    { id:'LR003', title:'สัญญาเช่าซื้อรถยนต์และการคุ้มครองผู้บริโภค', lawName:'พ.ร.บ.คุ้มครองผู้บริโภค พ.ศ. 2522 (ฉบับแก้ไข ธุรกิจเช่าซื้อรถยนต์เป็นธุรกิจควบคุมสัญญา)', category:'consumer', domain:'automotive',
      summary:'สัญญาเช่าซื้อรถยนต์เป็น "ธุรกิจควบคุมสัญญา" ต้องใช้แบบสัญญาตามที่ สคบ. กำหนด ห้ามมีข้อสัญญาที่ไม่เป็นธรรมต่อผู้บริโภค เช่น การคิดดอกเบี้ยผิดนัดเกินอัตราที่กฎหมายกำหนด',
      keyPoints:['ต้องแจ้งราคาสินค้า ดอกเบี้ยที่แท้จริง (Effective Rate) อย่างชัดเจนก่อนทำสัญญา','ห้ามยึดรถคืนโดยไม่แจ้งเตือนล่วงหน้าตามขั้นตอนที่กฎหมายกำหนด','ลูกค้ามีสิทธิ์ปิดบัญชีก่อนกำหนดและได้รับส่วนลดดอกเบี้ยตามสัดส่วน'],
      penalty:'สัญญาที่ขัดต่อประกาศ สคบ. เป็นโมฆะเฉพาะส่วน และอาจถูกสั่งปรับทางปกครอง' },
    { id:'LR004', title:'ภาษีสรรพสามิตรถยนต์และการคำนวณราคาขายปลีก', lawName:'พ.ร.บ.ภาษีสรรพสามิต พ.ศ. 2560', category:'tax_excise', domain:'automotive',
      summary:'กำหนดอัตราภาษีสรรพสามิตตามประเภทรถและปริมาณการปล่อย CO2 ซึ่งกระทบต่อราคาขายปลีกที่ต้องแจ้งราคาป้ายกับกรมสรรพสามิต',
      keyPoints:['ตรวจสอบอัตราภาษีสรรพสามิตของแต่ละรุ่น/ปีก่อนตั้งราคาขาย','รถ EV มีอัตราภาษีสรรพสามิตพิเศษตามเงื่อนไขมาตรการส่งเสริม EV','ต้องแจ้งราคาขายปลีกแนะนำต่อกรมสรรพสามิตก่อนวางจำหน่าย'],
      penalty:'แจ้งราคาไม่ถูกต้องอาจถูกประเมินภาษีย้อนหลังพร้อมเงินเพิ่ม' },
    { id:'LR005', title:'พ.ร.บ.คุ้มครองผู้ประสบภัยจากรถ (ประกันภาคบังคับ)', lawName:'พ.ร.บ.คุ้มครองผู้ประสบภัยจากรถ พ.ศ. 2535', category:'insurance', domain:'automotive',
      summary:'รถทุกคันต้องทำประกันภาคบังคับ (พ.ร.บ.) ก่อนจดทะเบียนและต่อทะเบียนทุกปี ผู้จำหน่ายรถควรดำเนินการให้ลูกค้าครบก่อนส่งมอบ',
      keyPoints:['ต้องมี พ.ร.บ. ที่ยังไม่หมดอายุก่อนดำเนินการจดทะเบียน/ต่อภาษี','ความคุ้มครองเบื้องต้นจ่ายให้ผู้บาดเจ็บโดยไม่ต้องรอพิสูจน์ความรับผิด'],
      penalty:'ปรับไม่เกิน 10,000 บาท หากขับรถที่ไม่มี พ.ร.บ.' },
    { id:'LR006', title:'มาตรฐานไอเสียและการตรวจสภาพรถก่อนจำหน่าย', lawName:'พ.ร.บ.ส่งเสริมและรักษาคุณภาพสิ่งแวดล้อมแห่งชาติ พ.ศ. 2535', category:'environment', domain:'automotive',
      summary:'กำหนดมาตรฐานไอเสีย (เช่น Euro 5) สำหรับรถที่นำเข้า/ประกอบในประเทศ ตัวแทนจำหน่ายต้องมั่นใจว่ารถที่ขายผ่านมาตรฐานตามประกาศ',
      keyPoints:['ตรวจสอบใบรับรองมาตรฐานไอเสียจากผู้ผลิต/ผู้นำเข้าก่อนรับรถเข้าสต็อก','รถที่ใช้แล้วเปลี่ยนมือต้องผ่านการตรวจสภาพ (ตรอ.) ตามอายุที่กำหนด'],
      penalty:'รถที่ไม่ผ่านมาตรฐานไม่สามารถจดทะเบียนได้' },
    { id:'LR007', title:'การประกอบธุรกิจตัวแทน/นายหน้าจำหน่ายรถยนต์', lawName:'ประมวลกฎหมายแพ่งและพาณิชย์ (ตัวแทน/นายหน้า) และ พ.ร.บ.ขายตรงและตลาดแบบตรง พ.ศ. 2545', category:'dealer_biz', domain:'automotive',
      summary:'ความสัมพันธ์ระหว่างดีลเลอร์กับผู้ผลิต/ผู้นำเข้าในฐานะตัวแทนจำหน่าย รวมถึงข้อกำหนดเรื่องค่าคอมมิชชั่นและความรับผิดต่อผู้บริโภค',
      keyPoints:['สัญญาตัวแทนจำหน่ายควรระบุขอบเขตอำนาจและความรับผิดชอบให้ชัดเจน','พนักงานขายที่รับค่าคอมมิชชั่นต้องมีหลักฐานการคำนวณที่ตรวจสอบได้'],
      penalty:'ข้อพิพาทเรื่องค่าคอมมิชชั่นที่ไม่มีเอกสารชัดเจนอาจนำไปสู่คดีแรงงาน/แพ่ง' },
    { id:'LR008', title:'ชั่วโมงทำงาน วันหยุด วันลา และการจ่ายค่าล่วงเวลา', lawName:'พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541', category:'labor_protect', domain:'labor',
      summary:'กำหนดชั่วโมงทำงานไม่เกิน 8 ชม./วัน หรือ 48 ชม./สัปดาห์ วันหยุดประจำสัปดาห์อย่างน้อย 1 วัน วันลาป่วย ลากิจ ลาพักร้อน และอัตราค่าล่วงเวลา/ค่าทำงานวันหยุด',
      keyPoints:['ค่าล่วงเวลาวันทำงานปกติ 1.5 เท่า / วันหยุด 3 เท่าของค่าจ้างปกติ','ลาป่วยได้รับค่าจ้างไม่เกิน 30 วัน/ปี','ต้องจ่ายค่าชดเชยตามอายุงานเมื่อเลิกจ้างโดยไม่มีความผิด (สูงสุด 400 วัน สำหรับอายุงาน 20 ปีขึ้นไป)'],
      penalty:'นายจ้างที่ฝ่าฝืนมีโทษจำคุกไม่เกิน 6 เดือน หรือปรับไม่เกิน 100,000 บาท หรือทั้งจำทั้งปรับ' },
    { id:'LR009', title:'การขึ้นทะเบียนและนำส่งเงินสมทบประกันสังคม', lawName:'พ.ร.บ.ประกันสังคม พ.ศ. 2533', category:'social_sec', domain:'labor',
      summary:'นายจ้างต้องขึ้นทะเบียนลูกจ้างเป็นผู้ประกันตนภายใน 30 วันนับแต่วันเริ่มงาน และนำส่งเงินสมทบทุกเดือนภายในวันที่ 15 ของเดือนถัดไป',
      keyPoints:['อัตราเงินสมทบฝ่ายละ 5% ของค่าจ้าง (ฐานสูงสุด 15,000 บาท/เดือน)','แจ้งลูกจ้างออกภายใน 15 วันหลังพ้นสภาพการเป็นลูกจ้าง'],
      penalty:'นำส่งล่าช้าต้องจ่ายเงินเพิ่ม 2% ต่อเดือนของเงินสมทบที่ค้าง' },
    { id:'LR010', title:'การแจ้งและจ่ายเงินทดแทนกรณีประสบอันตรายจากการทำงาน', lawName:'พ.ร.บ.เงินทดแทน พ.ศ. 2537', category:'compensation', domain:'labor',
      summary:'ช่างซ่อมและพนักงานในศูนย์บริการมีความเสี่ยงจากการทำงาน นายจ้างต้องขึ้นทะเบียนกองทุนเงินทดแทนและแจ้งการประสบอันตรายภายในเวลาที่กำหนด',
      keyPoints:['แจ้งการประสบอันตรายต่อสำนักงานประกันสังคมภายใน 15 วัน','นายจ้างจ่ายเงินสมทบกองทุนเงินทดแทนฝ่ายเดียวตามอัตราความเสี่ยงของกิจการ'],
      penalty:'ไม่แจ้งภายในกำหนดอาจถูกปรับ และนายจ้างต้องรับผิดชอบค่ารักษาพยาบาลเองหากยังไม่ได้ขึ้นทะเบียน' },
    { id:'LR011', title:'ความปลอดภัยในการทำงานกับระบบไฟฟ้าแรงสูง (EV) และสารเคมี', lawName:'พ.ร.บ.ความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน พ.ศ. 2554', category:'safety_health', domain:'labor',
      summary:'ศูนย์บริการที่ซ่อมรถ EV ต้องจัดให้มีมาตรการความปลอดภัยเฉพาะสำหรับงานไฟฟ้าแรงสูง (HV) และการจัดเก็บสารเคมี/แบตเตอรี่ตามมาตรฐาน',
      keyPoints:['ต้องจัดอบรมความปลอดภัยเฉพาะทางสำหรับช่างที่ทำงานกับระบบ HV','จัดให้มีอุปกรณ์ป้องกันส่วนบุคคล (PPE) และป้ายเตือนอันตรายไฟฟ้าแรงสูง','จัดให้มีเจ้าหน้าที่ความปลอดภัย (จป.) ตามขนาดกิจการ'],
      penalty:'ปรับไม่เกิน 200,000 บาท กรณีไม่จัดมาตรการความปลอดภัยตามที่กฎหมายกำหนด' },
    { id:'LR012', title:'ข้อบังคับการทำงานและการเลิกจ้างที่เป็นธรรม', lawName:'พ.ร.บ.แรงงานสัมพันธ์ พ.ศ. 2518', category:'labor_relation', domain:'labor',
      summary:'สถานประกอบการที่มีลูกจ้างตั้งแต่ 10 คนขึ้นไปต้องจัดทำข้อบังคับการทำงานเป็นลายลักษณ์อักษร และการเลิกจ้างต้องมีเหตุผลอันสมควรเพื่อไม่ให้เป็นการเลิกจ้างที่ไม่เป็นธรรม',
      keyPoints:['ข้อบังคับการทำงานต้องประกาศให้ลูกจ้างทราบและส่งสำเนาให้กรมสวัสดิการฯ','การเลิกจ้างต้องแจ้งล่วงหน้าตามรอบการจ่ายค่าจ้าง หรือจ่ายค่าจ้างแทนการบอกกล่าวล่วงหน้า'],
      penalty:'การเลิกจ้างที่ไม่เป็นธรรมอาจถูกศาลแรงงานสั่งให้รับกลับเข้าทำงานหรือจ่ายค่าเสียหาย' },
  ]
  legalRefDemo.forEach(l => { if (!demoCol('legal_references')[l.id]) demoCol('legal_references')[l.id] = l })


  // Equipment Maintenance (หน้า /quality/maintenance)
  const maintenanceEquipmentDemo = [
    { id:'EQ001', name:'Lift A', category:'service', lastService:'2026-04-10', nextService:'2026-07-10', cycle:90, status:'ok', technician:'ช่าง วิชัย' },
    { id:'EQ002', name:'Lift B', category:'service', lastService:'2026-05-01', nextService:'2026-08-01', cycle:90, status:'ok', technician:'ช่าง วิชัย' },
    { id:'EQ003', name:'Compressor', category:'service', lastService:'2026-03-15', nextService:'2026-06-15', cycle:90, status:'overdue', technician:'ช่าง สมพงษ์' },
    { id:'EQ004', name:'Air Conditioner', category:'office', lastService:'2026-04-20', nextService:'2026-07-20', cycle:90, status:'due_soon', technician:'บริษัทภายนอก' },
    { id:'EQ005', name:'CCTV System', category:'office', lastService:'2026-01-10', nextService:'2026-07-10', cycle:180, status:'due_soon', technician:'บริษัทภายนอก' },
    { id:'EQ006', name:'EV Charger DC', category:'service', lastService:'2026-06-01', nextService:'2026-09-01', cycle:90, status:'ok', technician:'ช่าง สมพงษ์' },
  ]
  maintenanceEquipmentDemo.forEach(e => { if (!demoCol('maintenance_equipment')[e.id]) demoCol('maintenance_equipment')[e.id] = e })


  // Quality incidents (หน้า /quality/incidents)
  const qualityIncidents = [
    { id:'INC001', title:'รถลูกค้าถูกขีดข่วนระหว่างล้าง', cat:'vehicle', severity:'major', status:'action', reporter:'หัวหน้าทีมล้างรถ', date:new Date(Date.now()-86400000*2).toISOString(), rootCause:'อุปกรณ์ล้างเก่า มีเศษทราย', action:'เปลี่ยนผ้าไมโครไฟเบอร์ใหม่ทั้งชุด + ชดเชยลูกค้า' },
    { id:'INC002', title:'ช่างเกือบโดนไฟแรงสูงขณะถอดแบต', cat:'safety', severity:'critical', status:'investigating', reporter:'วิทยา ช่างใหญ่', date:new Date(Date.now()-86400000).toISOString(), rootCause:'', action:'' },
    { id:'INC003', title:'ส่งใบเสนอราคาผิดอีเมล (ข้อมูลลูกค้ารั่ว)', cat:'data', severity:'major', status:'closed', reporter:'Admin', date:new Date(Date.now()-86400000*10).toISOString(), rootCause:'Autocomplete อีเมลผิด', action:'แจ้งลูกค้าทั้ง 2 ฝ่าย + เพิ่มขั้นตอน double-check' },
    { id:'INC004', title:'ลิฟต์ยกรถเสียงดังผิดปกติ', cat:'facility', severity:'minor', status:'action', reporter:'มานะ ขยัน', date:new Date(Date.now()-86400000*3).toISOString(), rootCause:'ขาดการหล่อลื่นตามรอบ', action:'เรียกช่างซ่อมบำรุง — นัดพรุ่งนี้' },
    { id:'INC005', title:'พื้นเปียกหน้าห้องน้ำ ไม่มีป้ายเตือน', cat:'safety', severity:'near_miss', status:'closed', reporter:'สุดา มาดี', date:new Date(Date.now()-86400000*7).toISOString(), rootCause:'แม่บ้านลืมวางป้าย', action:'อบรมซ้ำ + ติดป้ายถาวร' },
  ]
  qualityIncidents.forEach(i => { if (!demoCol('quality_incidents')[i.id]) demoCol('quality_incidents')[i.id] = i })


  // Quality audits (หน้า /quality/audit-schedule)
  const qualityAudits = [
    { id:'A001', name:'ตรวจ SOP ฝ่ายขาย', type:'process', status:'in_progress', auditor:'ผู้จัดการ QA', area:'ฝ่ายขาย', scheduledDate:addDaysISO(-2), completedDate:null, findings:3, score:null },
    { id:'A002', name:'Safety Check ศูนย์บริการ', type:'safety', status:'scheduled', auditor:'เจ้าหน้าที่ความปลอดภัย', area:'บริการ', scheduledDate:addDaysISO(3), completedDate:null, findings:0, score:null },
    { id:'A003', name:'Financial Audit Q2', type:'financial', status:'completed', auditor:'บริษัทตรวจสอบบัญชี', area:'การเงิน', scheduledDate:addDaysISO(-30), completedDate:addDaysISO(-28), findings:2, score:87 },
    { id:'A004', name:'ตรวจ ISO 9001 ประจำปี', type:'external', status:'scheduled', auditor:'TÜV Rheinland', area:'ทุกแผนก', scheduledDate:addDaysISO(14), completedDate:null, findings:0, score:null },
    { id:'A005', name:'Internal Audit HR', type:'internal', status:'overdue', auditor:'ผู้จัดการ HR', area:'HR', scheduledDate:addDaysISO(-7), completedDate:null, findings:0, score:null },
    { id:'A006', name:'ตรวจขั้นตอน PDI', type:'process', status:'completed', auditor:'หัวหน้าทีม DMS', area:'DMS', scheduledDate:addDaysISO(-14), completedDate:addDaysISO(-13), findings:1, score:92 },
  ]
  qualityAudits.forEach(a => { if (!demoCol('quality_audits')[a.id]) demoCol('quality_audits')[a.id] = a })


  // Compliance checklist (หน้า /quality/compliance)
  const complianceChecklist = [
    { id:'C001', title:'การเก็บข้อมูลส่วนบุคคลมีใบยินยอม', cat:'pdpa', status:'pass', lastCheck:addDaysISO(-7), nextCheck:addDaysISO(358), owner:'ฝ่าย IT', notes:'', criticality:'high' },
    { id:'C002', title:'ระบบมีนโยบาย Privacy Policy เป็นปัจจุบัน', cat:'pdpa', status:'partial', lastCheck:addDaysISO(-14), nextCheck:addDaysISO(351), owner:'ฝ่ายกฎหมาย', notes:'ต้องอัพเดตส่วน Data Retention Policy', criticality:'high' },
    { id:'C003', title:'สัญญาจ้างพนักงานครบทุกคน', cat:'labor', status:'pass', lastCheck:addDaysISO(-30), nextCheck:addDaysISO(335), owner:'HR', notes:'', criticality:'high' },
    { id:'C004', title:'ยื่น ภพ.30 ตรงเวลาทุกเดือน', cat:'tax', status:'pass', lastCheck:addDaysISO(-5), nextCheck:addDaysISO(25), owner:'การเงิน', notes:'', criticality:'high' },
    { id:'C005', title:'ใบอนุญาตขายรถยนต์ยังไม่หมดอายุ', cat:'dealer', status:'pass', lastCheck:addDaysISO(-60), nextCheck:addDaysISO(305), owner:'ผู้บริหาร', notes:'', criticality:'critical' },
    { id:'C006', title:'ถังดับเพลิงครบและอยู่ในกำหนด', cat:'safety', status:'fail', lastCheck:addDaysISO(-90), nextCheck:addDaysISO(-30), owner:'แม่บ้าน', notes:'ถังดับเพลิง 2 ถังหมดอายุ — ต้องเปลี่ยน', criticality:'high' },
    { id:'C007', title:'รายงาน EV Battery Disposal ตามกฎ', cat:'ev_reg', status:'partial', lastCheck:addDaysISO(-45), nextCheck:addDaysISO(320), owner:'ฝ่ายบริการ', notes:'มีแบตที่ยังไม่ได้ส่ง Recycle 2 ลูก', criticality:'medium' },
    { id:'C008', title:'งบการเงินผ่านการตรวจสอบ', cat:'finance', status:'pass', lastCheck:addDaysISO(-180), nextCheck:addDaysISO(185), owner:'ผู้สอบบัญชี', notes:'', criticality:'high' },
  ]
  complianceChecklist.forEach(c => { if (!demoCol('compliance_checklist')[c.id]) demoCol('compliance_checklist')[c.id] = c })


  // PDPA consents + DSR requests (หน้า /quality/pdpa)
  const pdpaConsents = [
    { id:'PD001', customer:'สมชาย ใจดี', phone:'085-111', consents:{ marketing:true, analytics:true, third_party:true, service:true }, updatedAt:new Date(Date.now()-86400000*30).toISOString(), channel:'เซ็นเอกสาร' },
    { id:'PD002', customer:'มาลี สุขใจ', phone:'086-222', consents:{ marketing:true, analytics:false, third_party:false, service:true }, updatedAt:new Date(Date.now()-86400000*60).toISOString(), channel:'LINE' },
    { id:'PD003', customer:'ธนพล เที่ยงตรง', phone:'087-333', consents:{ marketing:false, analytics:false, third_party:false, service:true }, updatedAt:new Date(Date.now()-86400000*10).toISOString(), channel:'เว็บไซต์' },
    { id:'PD004', customer:'อรทัย ตั้งใจ', phone:'088-444', consents:{ marketing:true, analytics:true, third_party:false, service:true }, updatedAt:new Date(Date.now()-86400000*90).toISOString(), channel:'เซ็นเอกสาร' },
  ]
  pdpaConsents.forEach(c => { if (!demoCol('pdpa_consents')[c.id]) demoCol('pdpa_consents')[c.id] = c })


  // Customer reviews (หน้า /quality/satisfaction)
  const customerReviews = [
    { id:'R001', customer:'วิชัย มีโชค', model:'BYD Seal AWD', score:5, comment:'บริการดีมาก เซลส์อธิบายละเอียด คุ้มค่า!', channel:'Google', date:new Date(Date.now()-86400000*2).toISOString(), replied:false, tags:['บริการขาย','ความรู้เซลส์'] },
    { id:'R002', customer:'สุดา อารมณ์ดี', model:'BYD Atto 3', score:4, comment:'โดยรวมดี แต่รอนานไปหน่อย', channel:'Facebook', date:new Date(Date.now()-86400000*5).toISOString(), replied:true, tags:['บริการขาย','เวลารอคอย'] },
    { id:'R003', customer:'ธนา ลูกค้าใหม่', model:'MG ZS EV', score:3, comment:'ศูนย์บริการรอนาน 3 ชั่วโมง ไม่ค่อยพอใจ', channel:'LINE OA', date:new Date(Date.now()-86400000*8).toISOString(), replied:false, tags:['บริการหลังขาย','เวลารอคอย'] },
    { id:'R004', customer:'มานี ดีใจ', model:'BYD Dolphin', score:5, comment:'ประทับใจมากๆ คุ้มค่า แนะนำเพื่อนมาแน่นอน', channel:'Google', date:new Date(Date.now()-86400000*10).toISOString(), replied:true, tags:['ราคา/คุณภาพ','บริการขาย'] },
    { id:'R005', customer:'ชัย ไม่ค่อยพอใจ', model:'MG EP', score:2, comment:'ซ่อมแล้วยังมีปัญหาเดิม ต้องกลับมาซ่อมซ้ำ', channel:'รีวิวหน้าร้าน', date:new Date(Date.now()-86400000*12).toISOString(), replied:false, tags:['บริการหลังขาย'] },
  ]
  customerReviews.forEach(r => { if (!demoCol('customer_reviews')[r.id]) demoCol('customer_reviews')[r.id] = r })


  // 5S audit areas (หน้า /quality/5s)
  const fiveSAreas = [
    { id:'A1', name:'โชว์รูม', owner:'ทีมขาย', scores:{ s1:5, s2:4, s3:5, s4:4, s5:4 }, lastAudit:addDaysISO(-3), photos:4 },
    { id:'A2', name:'ศูนย์บริการ (Bay 1-4)', owner:'ทีมช่าง', scores:{ s1:4, s2:3, s3:3, s4:3, s5:4 }, lastAudit:addDaysISO(-3), photos:6 },
    { id:'A3', name:'คลังอะไหล่', owner:'ฝ่ายอะไหล่', scores:{ s1:3, s2:3, s3:4, s4:3, s5:3 }, lastAudit:addDaysISO(-10), photos:3 },
    { id:'A4', name:'ห้องรับรองลูกค้า', owner:'แอดมิน', scores:{ s1:5, s2:5, s3:5, s4:5, s5:4 }, lastAudit:addDaysISO(-3), photos:2 },
    { id:'A5', name:'ออฟฟิศหลังบ้าน', owner:'ทุกฝ่าย', scores:{ s1:2, s2:3, s3:3, s4:2, s5:3 }, lastAudit:addDaysISO(-17), photos:0 },
  ]
  fiveSAreas.forEach(a => { if (!demoCol('five_s_areas')[a.id]) demoCol('five_s_areas')[a.id] = a })


  // SOP documents (หน้า /quality/sop)
  const sopDocuments = [
    { id:'SOP001', title:'ขั้นตอนการรับลูกค้าเข้าโชว์รูม', category:'sales', version:'1.2',
      status:'approved', owner:'ผู้จัดการขาย', updatedDate:addDaysISO(-30), reviewDate:addDaysISO(335),
      steps:['ต้อนรับลูกค้าด้วยรอยยิ้มภายใน 30 วินาที','เชิญนั่งพักและเสนอเครื่องดื่ม','ถามความต้องการและงบประมาณ','นำเสนอรุ่นที่เหมาะสม','เสนอทดลองขับ'],
      tags:['customer', 'showroom', 'greeting'] },
    { id:'SOP002', title:'ขั้นตอน PDI (Pre-Delivery Inspection)', category:'delivery', version:'2.0',
      status:'approved', owner:'หัวหน้าช่าง', updatedDate:addDaysISO(-14), reviewDate:addDaysISO(351),
      steps:['ตรวจสอบสภาพภายนอก - ขีดข่วน รอยเว้า','ตรวจภายใน - เบาะ แผงหน้าปัด','ตรวจระบบ EV - แบต ชาร์จ','ตรวจเอกสาร - สมุดคู่มือ ใบจดทะเบียน','ทดสอบการขับขี่ 5 กม.','บันทึกผลใน Checklist'],
      tags:['pdi', 'delivery', 'quality'] },
    { id:'SOP003', title:'นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)', category:'pdpa', version:'1.0',
      status:'approved', owner:'ฝ่ายกฎหมาย', updatedDate:addDaysISO(-90), reviewDate:addDaysISO(275),
      steps:['ขอความยินยอมก่อนเก็บข้อมูล','ใช้ข้อมูลตามวัตถุประสงค์ที่แจ้ง','ไม่เปิดเผยข้อมูลโดยไม่ได้รับอนุญาต','ลูกค้ามีสิทธิ์ขอลบข้อมูล','เก็บรักษาข้อมูลอย่างปลอดภัย'],
      tags:['pdpa', 'privacy', 'legal'] },
    { id:'SOP004', title:'ขั้นตอนการรับ Job Card และการซ่อม', category:'service', version:'1.5',
      status:'review', owner:'หัวหน้าช่าง', updatedDate:addDaysISO(-3), reviewDate:addDaysISO(362),
      steps:['รับรถจากลูกค้า ตรวจสอบสภาพเบื้องต้น','เปิด Job Card ในระบบ','วิเคราะห์ปัญหาและประเมินค่าใช้จ่าย','แจ้งลูกค้าก่อนดำเนินการ','ดำเนินการซ่อม','ตรวจงานหลังซ่อม','ส่งคืนรถลูกค้า'],
      tags:['service', 'jobcard', 'repair'] },
  ]
  sopDocuments.forEach(s => { if (!demoCol('sop_documents')[s.id]) demoCol('sop_documents')[s.id] = s })

}
