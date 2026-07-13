// Demo seed data — training module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  
  const now = new Date()

  const addDaysISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

  // Knowledge Base (หน้า /training/knowledge)
  const kbAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

  // Product Knowledge DB (หน้า /training/product-knowledge)
  const productKnowledgeDemo = [
    { id:'PK001', brand:'BYD', model:'Atto 3', badge:'EV', year:2024, mastered:78, staffTotal:12,
      specs:{ battery:'60.5 kWh', range:'420 km', power:'204 hp', torque:'310 Nm', charge:'50 kW DC', price:'1,199,900' },
      selling:['ระบบ Blade Battery ปลอดภัยสูง','ระบบ NFC เปิด-ปิดรถ','หน้าจอหมุน 15.6 นิ้ว','การันตีแบต 8 ปี / 160,000 กม.'],
      competitors:[{name:'MG ZS EV',pro:'ราคาถูกกว่า',con:'พิสัยน้อยกว่า'},{name:'Tesla Model Y',pro:'Software ดีกว่า',con:'ราคาแพงกว่ามาก'}] },
    { id:'PK002', brand:'BYD', model:'Seal AWD', badge:'EV', year:2024, mastered:65, staffTotal:12,
      specs:{ battery:'82.5 kWh', range:'520 km', power:'530 hp', torque:'670 Nm', charge:'150 kW DC', price:'1,999,900' },
      selling:['All-Wheel Drive ขับ 4 ล้อ','0-100 ใน 3.8 วินาที','Cell-to-Body เทคโนโลยีใหม่','Suspension อัจฉริยะ'],
      competitors:[{name:'Tesla Model 3',pro:'แบรนด์แข็งแกร่ง',con:'ราคาเท่ากันแต่ขนาดเล็กกว่า'},{name:'BMW i4',pro:'Premium มากกว่า',con:'ราคาแพงกว่า 30%'}] },
    { id:'PK003', brand:'BYD', model:'Dolphin', badge:'EV', year:2024, mastered:82, staffTotal:12,
      specs:{ battery:'44.9 kWh', range:'340 km', power:'95 hp', torque:'180 Nm', charge:'40 kW DC', price:'799,900' },
      selling:['ราคาเริ่มต้นต่ำสุด','เหมาะสำหรับในเมือง','ขนาดกระทัดรัด','ค่าบำรุงรักษาต่ำ'],
      competitors:[{name:'Ora Good Cat',pro:'ราคาใกล้เคียง',con:'พิสัยน้อยกว่า'},{name:'Neta V',pro:'ราคาถูกกว่า',con:'แบรนด์ไม่แข็งแกร่ง'}] },
    { id:'PK004', brand:'BYD', model:'Han', badge:'EV', year:2024, mastered:54, staffTotal:12,
      specs:{ battery:'100 kWh', range:'605 km', power:'517 hp', torque:'700 Nm', charge:'120 kW DC', price:'2,599,900' },
      selling:['Luxury EV Sedan','พิสัยไกลที่สุดในไลน์อัพ','หน้าจอ 15.6 นิ้ว','ระบบเสียง 12 ลำโพง Dynaudio'],
      competitors:[{name:'Tesla Model S',pro:'Software OTA ดีกว่า',con:'ราคาแพงกว่ามาก'},{name:'Mercedes EQS',pro:'Premium มากกว่า',con:'ราคา 3 เท่า'}] },
    { id:'PK005', brand:'MG', model:'ZS EV', badge:'EV', year:2024, mastered:71, staffTotal:12,
      specs:{ battery:'50.3 kWh', range:'357 km', power:'177 hp', torque:'280 Nm', charge:'76 kW DC', price:'999,900' },
      selling:['ราคา/คุณสมบัติดี','ประกัน 5 ปี','MG iSmart Connected','ฟรีชาร์จที่ MG Super Charge'],
      competitors:[{name:'BYD Atto 3',pro:'Blade Battery ปลอดภัยกว่า',con:'ราคาแพงกว่า'},{name:'Neta S',pro:'ทันสมัยกว่า',con:'บริการหลังขายน้อยกว่า'}] },
    { id:'PK006', brand:'BYD', model:'Atto 3 Pro', badge:'NEW', year:2025, mastered:42, staffTotal:12,
      specs:{ battery:'60.5 kWh', range:'460 km', power:'204 hp', torque:'310 Nm', charge:'80 kW DC', price:'1,299,900' },
      selling:['รุ่นอัพเกรด Pro','ชาร์จเร็วขึ้น','พิสัยเพิ่มขึ้น 40 กม.','ฟีเจอร์ ADAS เพิ่มขึ้น'],
      competitors:[{name:'Atto 3 (เดิม)',pro:'ราคาถูกกว่า',con:'ฟีเจอร์น้อยกว่า'},{name:'MG 4',pro:'Design ทันสมัยกว่า',con:'พิสัยน้อยกว่า'}] },
  ]
  productKnowledgeDemo.forEach(p => { if (!demoCol('product_knowledge')[p.id]) demoCol('product_knowledge')[p.id] = p })


  // Training courses (หน้า /training/courses)
  const trainingCourses = [
    { id:'C001', title:'BYD EV Technology Deep Dive', type:'product', instructor:'BYD Thailand',
      duration:'8 ชั่วโมง', format:'Classroom', maxEnroll:20,
      startDate:addDaysISO(7), endDate:addDaysISO(7), passScore:80,
      enrolled:[
        { name:'อรนุช สายใจ', dept:'ฝ่ายขาย', score:null, status:'enrolled' },
        { name:'วิชาญ มีโชค', dept:'ฝ่ายขาย', score:null, status:'enrolled' },
      ],
      description:'เรียนรู้เทคโนโลยี BYD Blade Battery, EV Powertrain, OTA Update' },
    { id:'C002', title:'Sales Technique & Negotiation', type:'sales', instructor:'อ.ธีรศักดิ์',
      duration:'6 ชั่วโมง', format:'Workshop', maxEnroll:15,
      startDate:addDaysISO(-7), endDate:addDaysISO(-7), passScore:75,
      enrolled:[
        { name:'อรนุช สายใจ', dept:'ฝ่ายขาย', score:88, status:'completed' },
        { name:'วิชาญ มีโชค', dept:'ฝ่ายขาย', score:72, status:'failed' },
        { name:'สมใจ รักรถ', dept:'ฝ่ายขาย', score:91, status:'completed' },
      ],
      description:'เทคนิคปิดการขาย การต่อรอง การจัดการ Objection' },
    { id:'C003', title:'EV Battery Diagnostics', type:'service', instructor:'ทีมช่าง BYD',
      duration:'16 ชั่วโมง', format:'Hands-on Lab', maxEnroll:8,
      startDate:addDaysISO(14), endDate:addDaysISO(15), passScore:85,
      enrolled:[
        { name:'วิชาญ ช่างซ่อม', dept:'ศูนย์บริการ', score:null, status:'enrolled' },
        { name:'วิทยา ช่างไฟ', dept:'ศูนย์บริการ', score:null, status:'enrolled' },
      ],
      description:'วิเคราะห์ปัญหาแบตเตอรี่ EV, ใช้ BYD Diagnostic Tool' },
    { id:'C004', title:'PDPA สำหรับธุรกิจรถยนต์', type:'compliance', instructor:'ที่ปรึกษากฎหมาย',
      duration:'3 ชั่วโมง', format:'Online', maxEnroll:50,
      startDate:addDaysISO(-14), endDate:addDaysISO(-14), passScore:70,
      enrolled:[
        { name:'ทุกคน', dept:'All', score:85, status:'completed' },
      ],
      description:'กฎหมาย PDPA, การจัดเก็บข้อมูลลูกค้า, สิทธิ์ข้อมูลส่วนบุคคล' },
  ]
  trainingCourses.forEach(c => { if (!demoCol('training_courses')[c.id]) demoCol('training_courses')[c.id] = c })


  // Staff certifications (หน้า /training/certification)
  const staffCertifications = [
    { id:'sc1', staffId:'S001', staff:'วิชัย ยอดขาย', certId:'C001', issueDate:addDaysISO(-180), expDate:addDaysISO(185), score:92, status:'active' },
    { id:'sc2', staffId:'S001', staff:'วิชัย ยอดขาย', certId:'C003', issueDate:addDaysISO(-90), expDate:addDaysISO(450), score:88, status:'active' },
    { id:'sc3', staffId:'S002', staff:'สุดา มาดี', certId:'C001', issueDate:addDaysISO(-400), expDate:addDaysISO(-35), score:95, status:'expired' },
    { id:'sc4', staffId:'S002', staff:'สุดา มาดี', certId:'C002', issueDate:addDaysISO(-60), expDate:addDaysISO(660), score:90, status:'active' },
    { id:'sc5', staffId:'S003', staff:'ธนา เก่ง', certId:'C003', issueDate:null, expDate:null, score:null, status:'pending' },
    { id:'sc6', staffId:'S004', staff:'วิทยา ช่าง', certId:'C002', issueDate:addDaysISO(-100), expDate:addDaysISO(620), score:85, status:'active' },
  ]
  staffCertifications.forEach(c => { if (!demoCol('staff_certifications')[c.id]) demoCol('staff_certifications')[c.id] = c })


  // Quiz results (หน้า /training/quiz)
  const quizResultsDemo = [
    { id:'qr1', staffName:'วิชัย ยอดขาย', quizTitle:'ความรู้พื้นฐาน EV', score:4, total:4, percent:100, passed:true, passedAt:addDaysISO(-3) },
    { id:'qr2', staffName:'สุดา มาดี', quizTitle:'เทคนิคการขาย', score:2, total:3, percent:67, passed:false, passedAt:addDaysISO(-6) },
    { id:'qr3', staffName:'วิทยา ช่างใหญ่', quizTitle:'SOP บริการหลังการขาย', score:3, total:3, percent:100, passed:true, passedAt:addDaysISO(-10) },
    { id:'qr4', staffName:'ธนา เก่ง', quizTitle:'ความรู้พื้นฐาน EV', score:3, total:4, percent:75, passed:true, passedAt:addDaysISO(-1) },
  ]
  quizResultsDemo.forEach(r => { if (!demoCol('quiz_results')[r.id]) demoCol('quiz_results')[r.id] = r })

}
