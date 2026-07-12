// Demo seed data — documents module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  // Checklists (หน้า /documents/checklist)
  const checklistsDemo = [
    { id:'CL001', name:'PDI Checklist (BYD)', category:'DMS', usedCount:42, lastUsed:'2026-06-14', items:['ตรวจสอบรอยขีดข่วนภายนอก','ตรวจระบบไฟทั้งหมด','ทดสอบ AC','ชาร์จแบตเตอรี่ครบ','ตรวจ Software Version','ทดสอบ ADAS Systems','ทดสอบ Drive Mode','ตั้งค่า HomeLink','ผูก VIN ในระบบ'], progress:[] },
    { id:'CL002', name:'Delivery Checklist', category:'DMS', usedCount:38, lastUsed:'2026-06-15', items:['เตรียมเอกสารครบ (สัญญา ใบส่งมอบ ทะเบียน)','ชี้แจงฟีเจอร์รถให้ลูกค้า','Demo App/Connectivity','แจก Accessory Kit','ถ่ายรูปส่งมอบ','ลายเซ็นดิจิทัล'], progress:[] },
    { id:'CL003', name:'Service Job Card', category:'บริการ', usedCount:156, lastUsed:'2026-06-15', items:['รับรถ ตรวจสภาพรอบคัน','เช็คระดับน้ำมัน/Coolant','อ่าน Fault Codes','ดำเนินการซ่อมตามใบงาน','ทดสอบหลังซ่อม','ล้างรถ/ดูแลความสะอาด','แจ้งลูกค้ารถพร้อม'], progress:[] },
    { id:'CL004', name:'5S สำนักงาน', category:'คุณภาพ', usedCount:8, lastUsed:'2026-06-08', items:['Sort: คัดแยกของที่ไม่จำเป็น','Set: จัดวางให้เป็นระเบียบ','Shine: ทำความสะอาด','Standardize: กำหนดมาตรฐาน','Sustain: รักษาและปรับปรุงอย่างต่อเนื่อง'], progress:[] },
    { id:'CL005', name:'Safety Inspection Workshop', category:'คุณภาพ', usedCount:4, lastUsed:'2026-06-01', items:['ตรวจลิฟต์ยกรถ','ตรวจระบบดับเพลิง','ตรวจอุปกรณ์ป้องกันส่วนบุคคล (PPE)','ตรวจระบบไฟฟ้า','ตรวจทางหนีไฟ'], progress:[] },
  ]
  checklistsDemo.forEach(c => { if (!demoCol('checklists')[c.id]) demoCol('checklists')[c.id] = c })


  // Contracts (หน้า /documents/contracts)
  const ctrAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Document Templates (หน้า /documents/templates)
  const dtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

  // Forms (หน้า /documents/form-builder)
  const formsDemo = [
    { id:'f001', name:'ฟอร์มจองรถ', desc:'ลูกค้าจองรถออนไลน์', fields:['ชื่อ-นามสกุล','เบอร์โทร','รุ่นที่สนใจ','วันนัดหมาย'], submissions:28, active:true },
    { id:'f002', name:'แบบสอบถามความพึงพอใจ', desc:'ประเมินหลังรับรถ', fields:['คะแนนโชว์รูม','คะแนนพนักงาน','คะแนนกระบวนการ','ข้อเสนอแนะ'], submissions:156, active:true },
    { id:'f003', name:'ฟอร์มรับรถเข้าซ่อม', desc:'ลูกค้าแจ้งอาการก่อนเข้าศูนย์', fields:['ทะเบียนรถ','อาการที่พบ','เลขไมล์','วันนัดเข้าซ่อม'], submissions:94, active:false },
  ]
  formsDemo.forEach(f => { if (!demoCol('forms')[f.id]) demoCol('forms')[f.id] = f })

}
