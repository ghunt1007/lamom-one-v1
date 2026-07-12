// Demo seed data — settings module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  // API Keys (หน้า /settings/api-keys)
  const akAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

  // System backups (หน้า /settings/backup)
  const brAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

  // Branches + Company (หน้า /settings/branches)
  const settingsBranches = [
    { id:'B001', name:'สาขาหลัก — กรุงเทพ', code:'BKK-MAIN', address:'123/45 ถ.พระราม 9 เขตห้วยขวาง กทม.', phone:'02-123-4567', email:'bkk@lamomone.com', lat:13.7563, lng:100.5018, brands:['BYD','MG'], status:'active', manager:'สมชาย ใจดี', staff:12, isMain:true },
    { id:'B002', name:'สาขาชลบุรี', code:'CBI-001', address:'88/99 ถ.สุขุมวิท ชลบุรี', phone:'038-789-0123', email:'chon@lamomone.com', lat:13.3611, lng:100.9847, brands:['BYD'], status:'active', manager:'วิชัย เดินดี', staff:6, isMain:false },
    { id:'B003', name:'สาขาเชียงใหม่', code:'CNX-001', address:'99/1 ถ.นิมมานเหมินทร์ เชียงใหม่', phone:'053-456-7890', email:'cnx@lamomone.com', lat:18.7883, lng:98.9853, brands:['MG'], status:'planned', manager:'', staff:0, isMain:false },
  ]
  settingsBranches.forEach(b => { if (!demoCol('branches')[b.id]) demoCol('branches')[b.id] = b })


  // Digital signage (หน้า /settings/digital-signage)
  const signageSlides = [
    { id:'s001', type:'promo',   title:'BYD Seal AWD', desc:'ดาวน์พิเศษ เพียง 150,000 บาท', price:1699000, bg:'#1565C0', textColor:'#fff', duration:10, active:true  },
    { id:'s002', type:'model',   title:'BYD Atto 3',   desc:'ฟรีชาร์จเจอร์บ้าน 7.4kW มูลค่า 25,000 บาท', price:1099000, bg:'#00897B', textColor:'#fff', duration:8,  active:true  },
    { id:'s003', type:'service', title:'ศูนย์บริการ',   desc:'เช็คระยะฟรี เดือน มิ.ย. นี้ · นัดออนไลน์ได้', price:0, bg:'#FF8F00', textColor:'#fff', duration:7,  active:true  },
    { id:'s004', type:'queue',   title:'คิวบริการวันนี้', desc:'คิว 1-15 กำลังรับรถ · คิว 16-20 รอตรวจ', price:0, bg:'#4A148C', textColor:'#fff', duration:5,  active:false },
  ]
  signageSlides.forEach(s => { if (!demoCol('signage_slides')[s.id]) demoCol('signage_slides')[s.id] = s })


  // Holiday calendar (หน้า /settings/holidays)
  const HOL_YEAR = new Date().getFullYear()

  // Security policies + sessions (หน้า /settings/security)
  const ssAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

  // Settings > Users demo list (หน้า /settings/users)
  const settingsUsersDemo = [
    { id:'owner-001', email:'owner@lamom.co.th', displayName:'ทวีศักดิ์ สุขสมบัติเสถียร', role:'owner', status:'active', lastLogin:'2025-06-09', branch:'สาขาหลัก' },
    { id:'demo-user', email:'demo@lamom.co.th', displayName:'Demo User', role:'admin', status:'active', lastLogin:'2025-06-09', branch:'สาขาหลัก' },
    { id:'sales-001', email:'nun@lamom.co.th', displayName:'อรนุช เซลส์ดี', role:'sales', status:'active', lastLogin:'2025-06-08', branch:'สาขาหลัก' },
    { id:'sales-002', email:'wichai@lamom.co.th', displayName:'วิชัย ขายเก่ง', role:'sales', status:'active', lastLogin:'2025-06-07', branch:'สาขาหลัก' },
    { id:'sales-003', email:'pim@lamom.co.th', displayName:'พิมพ์ ใจดี', role:'sales', status:'active', lastLogin:'2025-06-06', branch:'สาขาชลบุรี' },
    { id:'mgr-001', email:'manager@lamom.co.th', displayName:'สมศักดิ์ ผู้จัดการ', role:'manager', status:'active', lastLogin:'2025-06-09', branch:'สาขาหลัก' },
    { id:'tech-001', email:'somchai@lamom.co.th', displayName:'สมชาย ช่างดี', role:'service', status:'active', lastLogin:'2025-06-09', branch:'สาขาหลัก' },
    { id:'tech-002', email:'wut@lamom.co.th', displayName:'วุฒิ เทคนิค', role:'service', status:'active', lastLogin:'2025-06-05', branch:'สาขาชลบุรี' },
    { id:'staff-001', email:'nok@lamom.co.th', displayName:'นก สำนักงาน', role:'staff', status:'inactive', lastLogin:'2025-05-20', branch:'สาขาหลัก' },
  ]
  settingsUsersDemo.forEach(u => { if (!demoCol('settings_users_demo')[u.id]) demoCol('settings_users_demo')[u.id] = u })


  // Roles — สิทธิ์การเข้าถึงแต่ละโมดูลตาม Role (หน้า /settings/roles)
  // Role set matches firestore.rules exactly (owner/admin/manager/sales/service/finance/hr/staff) — write-locked to owner in prod
  const rolePermissionsDemo = [
    { id:'owner',   roleName:'🏆 เจ้าของ',       modules:['*'] },
    { id:'admin',   roleName:'🔑 แอดมิน',        modules:['*'] },
    { id:'manager', roleName:'🎯 ผู้จัดการ',     modules:['sales','dms','service','finance','insurance','marketing','hr','documents','ai','comms','quality','b2b'] },
    { id:'sales',   roleName:'💼 เซลส์',         modules:['sales','dms','documents','marketing','comms','ai'] },
    { id:'service', roleName:'🔧 ช่าง/บริการ',    modules:['dms','service','quality','ai'] },
    { id:'finance', roleName:'💰 การเงิน',       modules:['finance','documents','ai'] },
    { id:'hr',      roleName:'👨‍💼 HR',          modules:['hr','documents','ai'] },
    { id:'staff',   roleName:'👤 พนักงาน',       modules:['ai'] },
  ]
  rolePermissionsDemo.forEach(r => { if (!demoCol('roles')[r.id]) demoCol('roles')[r.id] = r })

}
