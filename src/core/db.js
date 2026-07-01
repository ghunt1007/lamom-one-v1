// Firestore helpers — thin wrapper with offline demo support
import { db } from './firebase.js'
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { getState } from './store.js'

// ── Input sanitization — strip stored XSS before Firestore writes ──
function deepSanitize(v) {
  if (typeof v === 'string') return v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/\bon\w+\s*=/gi, '')
  if (Array.isArray(v)) return v.map(deepSanitize)
  if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, w]) => [k, deepSanitize(w)]))
  return v
}

// ── Demo store (in-memory when no Firebase) ─────────────────
// Pinned to window so all Vite module instances share the same object across HMR reloads
const demoStore = window.__lamomDemoStore || (window.__lamomDemoStore = {})

function isDemoMode() {
  const user = getState('user')
  return user?.uid === 'demo-user'
}

function demoCol(col) {
  if (!demoStore[col]) demoStore[col] = {}
  return demoStore[col]
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── CRUD ────────────────────────────────────────────────────

export async function createDoc(colName, data) {
  const clean = deepSanitize(data)
  const payload = { ...clean, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  if (isDemoMode()) {
    const id = genId()
    demoCol(colName)[id] = { id, ...payload }
    return id
  }
  const ref = await addDoc(collection(db, colName), { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export async function readDoc(colName, id) {
  if (isDemoMode()) return demoCol(colName)[id] || null
  const snap = await getDoc(doc(db, colName, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function updateDocData(colName, id, data) {
  const clean = deepSanitize(data)
  const payload = { ...clean, updatedAt: new Date().toISOString() }
  if (isDemoMode()) {
    const col = demoCol(colName)
    col[id] = { ...(col[id] || {}), ...payload }
    return
  }
  await updateDoc(doc(db, colName, id), { ...clean, updatedAt: serverTimestamp() })
}

export async function softDelete(colName, id) {
  return updateDocData(colName, id, { deleted: true, deletedAt: new Date().toISOString() })
}

export async function listDocs(colName, filters = [], sortBy = 'createdAt', sortDir = 'desc', maxDocs = 100) {
  if (isDemoMode()) {
    let rows = Object.values(demoCol(colName)).filter(r => !r.deleted)
    filters.forEach(([field, op, val]) => {
      rows = rows.filter(r => {
        if (op === '==') return r[field] === val
        if (op === '!=') return r[field] !== val
        if (op === 'in') return Array.isArray(val) && val.includes(r[field])
        if (op === '>=') return r[field] >= val
        if (op === '<=') return r[field] <= val
        return true
      })
    })
    rows.sort((a, b) => {
      const av = a[sortBy] || '', bv = b[sortBy] || ''
      return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1)
    })
    return rows.slice(0, maxDocs)
  }
  let q = collection(db, colName)
  const constraints = [...filters.map(([f, op, v]) => where(f, op, v)), orderBy(sortBy, sortDir), limit(maxDocs)]
  q = query(q, ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Demo seed data
export function seedDemoData() {
  if (!isDemoMode()) return

  // Customers
  const customers = [
    { id:'c1', firstName:'สมชาย', lastName:'มีทรัพย์', phone:'0812345678', lineId:'@somchai', email:'somchai@email.com', status:'hot', assignedTo:'sales1', source:'facebook', tags:['VIP'], interestedModel:'BYD Seal', createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'c2', firstName:'สมหญิง', lastName:'ดีมาก', phone:'0898765432', lineId:'@somying', email:'', status:'warm', assignedTo:'sales1', source:'walk-in', tags:[], interestedModel:'MG4', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'c3', firstName:'มานี', lastName:'รักดี', phone:'0811111111', lineId:'', email:'manee@gmail.com', status:'cold', assignedTo:'sales2', source:'line', tags:[], interestedModel:'NETA V', createdAt: new Date(Date.now()-86400000*10).toISOString() },
    { id:'c4', firstName:'วิชัย', lastName:'สุขใจ', phone:'0822222222', lineId:'@wichai', email:'', status:'vip', assignedTo:'sales1', source:'referral', tags:['VIP','ลูกค้าประจำ'], interestedModel:'BYD Atto 3', createdAt: new Date(Date.now()-86400000*30).toISOString() },
    { id:'c5', firstName:'นภา', lastName:'ฟ้าใส', phone:'0833333333', lineId:'', email:'', status:'lost', assignedTo:'sales2', source:'tiktok', tags:[], interestedModel:'DEEPAL S7', createdAt: new Date(Date.now()-86400000*15).toISOString() },
    { id:'c6', firstName:'ธีรพงศ์', lastName:'แสงทอง', phone:'0844444444', lineId:'@theer', email:'theer@email.com', status:'hot', assignedTo:'sales1', source:'website', tags:[], interestedModel:'BYD Seal AWD', createdAt: new Date(Date.now()-86400000).toISOString() },
  ]
  customers.forEach(c => { if (!demoCol('customers')[c.id]) demoCol('customers')[c.id] = c })

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

  // Vehicles
  const vehicles = [
    { id:'v1', brand:'BYD', model:'Seal', variant:'AWD', color:'ขาว Pearl', vin:'LGXCE4C10PA000001', year:2025, price:1299000, cost:1150000, status:'available', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-03-01', notes:'' },
    { id:'v2', brand:'BYD', model:'Atto 3', variant:'Extended Range', color:'น้ำเงิน', vin:'LGXCE4C10PA000002', year:2025, price:1099000, cost:970000, status:'reserved', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-02-15', notes:'จอง-วิชัย สุขใจ' },
    { id:'v3', brand:'MG', model:'MG4', variant:'X-Power', color:'แดง Dragon', vin:'SDUZZZEF5PA000003', year:2025, price:949000, cost:840000, status:'available', mileage:0, location:'โชว์รูมหลัก', arrivedAt:'2025-03-10', notes:'' },
    { id:'v4', brand:'DEEPAL', model:'S7', variant:'Pro', color:'ดำ Obsidian', vin:'LZEZ1EBA0PA000004', year:2025, price:1479000, cost:1320000, status:'pdi', mileage:0, location:'ห้อง PDI', arrivedAt:'2025-04-01', notes:'PDI เสร็จ 5 เม.ย.' },
    { id:'v5', brand:'NETA', model:'V II', variant:'Pro 400', color:'ขาว', vin:'LNBSCCAD0PA000005', year:2025, price:769000, cost:680000, status:'available', mileage:0, location:'โชว์รูมสาขา 2', arrivedAt:'2025-03-20', notes:'' },
    { id:'v6', brand:'BYD', model:'Seal', variant:'RWD', color:'เทา Ink', vin:'LGXCE4C10PA000006', year:2025, price:1199000, cost:1060000, status:'demo', mileage:3520, location:'โชว์รูมหลัก', arrivedAt:'2025-01-10', notes:'รถทดลองขับ' },
  ]
  vehicles.forEach(v => { if (!demoCol('vehicles')[v.id]) demoCol('vehicles')[v.id] = v })

  // Leads
  const leads = [
    { id:'ld1', firstName:'ธีรพงศ์', lastName:'แสงทอง', phone:'0812340001', status:'new', interestedModel:'BYD Atto 3', budget:1200000, source:'facebook', createdAt: new Date(Date.now()-3600000*2).toISOString() },
    { id:'ld2', firstName:'อรนุช', lastName:'พรหมมา', phone:'0812340002', status:'contacted', interestedModel:'MG4', budget:900000, source:'line', createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'ld3', firstName:'กิตติพงษ์', lastName:'วรรณศิลป์', phone:'0812340003', status:'interested', interestedModel:'DEEPAL S7', budget:1500000, source:'website', createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'ld4', firstName:'พิมพ์ชนก', lastName:'ทองสุข', phone:'0812340004', status:'qualified', interestedModel:'BYD Seal', budget:1300000, source:'referral', createdAt: new Date(Date.now()-86400000*3).toISOString() },
    { id:'ld5', firstName:'สมบัติ', lastName:'ยิ่งใหญ่', phone:'0812340005', status:'booking', interestedModel:'BYD Seal AWD', budget:1299000, source:'walk-in', createdAt: new Date(Date.now()-86400000*4).toISOString() },
    { id:'ld6', firstName:'สุภาพร', lastName:'ใจดี', phone:'0812340006', status:'new', interestedModel:'NETA V', budget:800000, source:'tiktok', createdAt: new Date(Date.now()-3600000*5).toISOString() },
    { id:'ld7', firstName:'ปิยะ', lastName:'มานะชัย', phone:'0812340007', status:'lost', interestedModel:'MG4', budget:850000, source:'facebook', lostReason:'ราคาสูงเกินไป', createdAt: new Date(Date.now()-86400000*7).toISOString() },
  ]
  leads.forEach(l => { if (!demoCol('leads')[l.id]) demoCol('leads')[l.id] = l })

  // Bookings (โครง V8 — แหล่งขายกลาง: feed ไปยัง Margin/Finance/Commission)
  const bookings = [
    { id:'bk1', bookingNo:'SK2506001', custName:'ธีรพงศ์ แสงทอง', nid:'1234567890123', phone:'0812345678', address:'88 ถ.สุขุมวิท', province:'กรุงเทพฯ', source:'Walk-in',
      brand:'BYD', model:'Seal', variant:'AWD Performance', colorOut:'ขาว Pearl', colorIn:'ดำ', vin:'LGXCE4C10PA000001', motorNo:'', batNo:'',
      price:1299000, cost:1150000, down:200000, financeCo:'BAY', financeAmount:1099000, finStatus:'ผ่าน', installments:60, interestRate:2.25, monthly:19800, campaign:'ดอกเบี้ยปกติ',
      margin:25000, budgetUsed:5000, com70:8000, comFinance:6000, marginLeft:20000, totalIncome:34000,
      bookingDate:'2025-06-01', submitDate:'2025-06-01', approveDate:'2025-06-03', signDate:'2025-06-05', cutDate:'2025-06-18', deliveryDate:'2025-06-20', actualDeliveryDate:'',
      salesName:'อรนุช เซลส์ดี', status:'รอส่งมอบ', notes:'', createdAt:'2025-06-01' },
    { id:'bk2', bookingNo:'SK2506002', custName:'กิตติพงษ์ วรรณศิลป์', nid:'1209800112233', phone:'0876543210', address:'', province:'นนทบุรี', source:'Facebook',
      brand:'Deepal', model:'S07 (2026)', variant:'New Standard', colorOut:'ดำ', colorIn:'Rose-White', vin:'', motorNo:'', batNo:'',
      price:1099000, cost:1010000, down:150000, financeCo:'TTB', financeAmount:949000, finStatus:'รอผล', installments:72, interestRate:2.49, monthly:15200, campaign:'ดอกเบี้ยพิเศษ',
      margin:18000, budgetUsed:8000, com70:6000, comFinance:5000, marginLeft:10000, totalIncome:21000,
      bookingDate:'2025-06-05', submitDate:'2025-06-06', approveDate:'', signDate:'', cutDate:'', deliveryDate:'2025-07-01', actualDeliveryDate:'',
      salesName:'วิชัย ขายเก่ง', status:'รอผลไฟแนนซ์', notes:'รอเอกสารเพิ่ม', createdAt:'2025-06-05' },
    { id:'bk3', bookingNo:'SK2505018', custName:'สุภาพร ใจดี', nid:'3100502233445', phone:'0856789012', address:'12/3 หมู่บ้านสุขสันต์', province:'ปทุมธานี', source:'Referral',
      brand:'GWM', model:'ORA Good Cat', variant:'2026 Ultra', colorOut:'ฟ้า', colorIn:'น้ำตาล-เบจ', vin:'LZ0000000000001', motorNo:'M001', batNo:'B001',
      price:899000, cost:867000, down:0, financeCo:'ซื้อสด', financeAmount:0, finStatus:'ซื้อสด', installments:0, interestRate:0, monthly:0, campaign:'ซื้อสด',
      margin:32000, budgetUsed:3000, com70:10000, comFinance:0, marginLeft:29000, totalIncome:39000,
      bookingDate:'2025-05-18', submitDate:'2025-05-18', approveDate:'2025-05-18', signDate:'2025-05-20', cutDate:'2025-05-26', deliveryDate:'2025-05-28', actualDeliveryDate:'2025-05-28',
      salesName:'อรนุช เซลส์ดี', status:'ส่งมอบแล้ว', notes:'', createdAt:'2025-05-18' },
  ]
  bookings.forEach(b => { if (!demoCol('bookings')[b.id]) demoCol('bookings')[b.id] = b })

  // Vehicle Orders
  const orders = [
    { id:'ord1', orderNo:'ORD-2025-001', brand:'BYD', model:'Seal', variant:'AWD', color:'ขาว Pearl', qty:3, unitCost:1150000, status:'shipped', expectedDate:'2025-04-20', supplier:'BYD Auto Thailand', notes:'ETA พอร์ตแหลมฉบัง', createdAt:'2025-03-01' },
    { id:'ord2', orderNo:'ORD-2025-002', brand:'MG', model:'MG4', variant:'X', color:'แดง', qty:2, unitCost:840000, status:'confirmed', expectedDate:'2025-05-10', supplier:'SAIC-MG Thailand', notes:'', createdAt:'2025-03-15' },
    { id:'ord3', orderNo:'ORD-2025-003', brand:'NETA', model:'V II', variant:'400', color:'ขาว', qty:5, unitCost:680000, status:'production', expectedDate:'2025-06-01', supplier:'NETA Thailand', notes:'', createdAt:'2025-04-01' },
  ]
  orders.forEach(o => { if (!demoCol('vehicle_orders')[o.id]) demoCol('vehicle_orders')[o.id] = o })

  // PDI
  const pdis = [
    { id:'pdi1', vehicleId:'v4', brand:'DEEPAL', model:'S7', color:'ดำ', vin:'LZEZ1EBA0PA000004', techName:'สมชาย รักงาน', status:'inprogress', startDate:'2025-04-02', checks:{}, defects:[], notes:'' },
    { id:'pdi2', vehicleId:'v1', brand:'BYD', model:'Seal', color:'ขาว Pearl', vin:'LGXCE4C10PA000001', techName:'วิชัย ช่างดี', status:'passed', startDate:'2025-03-05', endDate:'2025-03-05', checks:{}, defects:[], notes:'ผ่านทุกรายการ' },
  ]
  pdis.forEach(p => { if (!demoCol('pdi')[p.id]) demoCol('pdi')[p.id] = p })

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

  // Staff
  const staff = [
    { id:'st1', firstName:'ทวีศักดิ์', lastName:'สุขสมบัติเสถียร', nickname:'เจ้าของ', role:'owner', dept:'ผู้บริหาร', phone:'0812345678', email:'owner@lamom.com', startDate:'2020-01-01', salary:0, status:'active' },
    { id:'st2', firstName:'อรนุช', lastName:'เซลส์ดี', nickname:'นุ้ย', role:'sales', dept:'ฝ่ายขาย', phone:'0823456789', email:'nun@lamom.com', startDate:'2022-03-01', salary:25000, status:'active' },
    { id:'st3', firstName:'วิชัย', lastName:'ขายเก่ง', nickname:'วิ', role:'sales', dept:'ฝ่ายขาย', phone:'0834567890', email:'wichai@lamom.com', startDate:'2023-06-01', salary:22000, status:'active' },
    { id:'st4', firstName:'สมชาย', lastName:'ช่างดี', nickname:'ชาย', role:'service', dept:'ฝ่ายบริการ', phone:'0845678901', email:'somchai@lamom.com', startDate:'2021-09-01', salary:20000, status:'active' },
    { id:'st5', firstName:'วิชัย', lastName:'ช่างเก่ง', nickname:'เก่ง', role:'service', dept:'ฝ่ายบริการ', phone:'0856789012', email:'wichai2@lamom.com', startDate:'2022-12-01', salary:18000, status:'probation' },
  ]
  staff.forEach(s => { if (!demoCol('staff')[s.id]) demoCol('staff')[s.id] = s })

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

  // Tasks
  const tasks = [
    { id:'t1', title:'โทรติดตาม สมชาย มีทรัพย์', desc:'ลูกค้า hot นัดทดลองขับ BYD Seal', assignedTo:'sales1', priority:'high', status:'todo', dueDate: new Date(Date.now()+86400000).toISOString().slice(0,10), createdAt: new Date(Date.now()-3600000).toISOString() },
    { id:'t2', title:'ส่งใบเสนอราคา DEEPAL S7 ให้ กิตติพงษ์', desc:'ราคา + ออปชั่น + ไฟแนนซ์', assignedTo:'sales2', priority:'high', status:'inprogress', dueDate: new Date(Date.now()).toISOString().slice(0,10), createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'t3', title:'อัพเดตสต็อกรถหลัง PDI DEEPAL S7', desc:'ย้ายสถานะจาก PDI → พร้อมขาย', assignedTo:'tech1', priority:'medium', status:'done', dueDate: new Date(Date.now()-86400000).toISOString().slice(0,10), createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'t4', title:'ต่ออายุประกัน — วิชัย สุขใจ', desc:'กรมธรรม์ INS-2024-045 หมดอายุแล้ว', assignedTo:'sales1', priority:'urgent', status:'todo', dueDate: new Date(Date.now()).toISOString().slice(0,10), createdAt: new Date(Date.now()-7200000).toISOString() },
    { id:'t5', title:'เตรียมเอกสารส่งมอบรถ BK-2025-002', desc:'สัญญา + คู่มือ + ประกัน + ป้ายทะเบียน', assignedTo:'sales2', priority:'medium', status:'todo', dueDate: new Date(Date.now()+86400000*3).toISOString().slice(0,10), createdAt: new Date(Date.now()-3600000*6).toISOString() },
  ]
  tasks.forEach(t => { if (!demoCol('tasks')[t.id]) demoCol('tasks')[t.id] = t })

  // CRM extras
  const actionPlans = [
    { id:'ap1', title:'โทรหาลูกค้า Hot ทุกเช้า', type:'call', customer:'สมชาย มีทรัพย์', priority:'high', dueDate: new Date(Date.now()+86400000).toISOString().slice(0,10), status:'pending', assignedTo:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-3600000).toISOString() },
    { id:'ap2', title:'นัดทดลองขับ BYD Seal AWD', type:'testdrive', customer:'ธีรพงศ์ แสงทอง', priority:'high', dueDate: new Date(Date.now()).toISOString().slice(0,10), status:'inprogress', assignedTo:'วิชัย ขายเก่ง', createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'ap3', title:'เสนอราคา DEEPAL S7 Pro', type:'quote', customer:'กิตติพงษ์ วรรณศิลป์', priority:'medium', dueDate: new Date(Date.now()+86400000*2).toISOString().slice(0,10), status:'done', assignedTo:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'ap4', title:'ติดตามผลไฟแนนซ์ TTB', type:'finance', customer:'กิตติพงษ์ วรรณศิลป์', priority:'urgent', dueDate: new Date(Date.now()).toISOString().slice(0,10), status:'pending', assignedTo:'วิชัย ขายเก่ง', createdAt: new Date(Date.now()-7200000).toISOString() },
  ]
  actionPlans.forEach(a => { if (!demoCol('action_plans')[a.id]) demoCol('action_plans')[a.id] = a })

  const complaints = [
    { id:'cp1', ticketNo:'CMP-001', customer:'สมชาย มีทรัพย์', phone:'0812345678', type:'service', subject:'งานซ่อมล่าช้ากว่าที่นัดไว้', status:'open', priority:'high', assignedTo:'สมชาย ช่างดี', createdAt: new Date(Date.now()-86400000*2).toISOString(), notes:'ลูกค้าไม่พอใจที่รอรถนาน 3 วัน' },
    { id:'cp2', ticketNo:'CMP-002', customer:'อรนุช พรหมมา', phone:'0898765432', type:'product', subject:'แอร์ไม่เย็น หลังซ่อมครั้งก่อน', status:'investigating', priority:'medium', assignedTo:'วิชัย ช่างเก่ง', createdAt: new Date(Date.now()-86400000*5).toISOString(), notes:'ส่งช่างไปตรวจที่บ้านแล้ว' },
    { id:'cp3', ticketNo:'CMP-003', customer:'วิชัย สุขใจ', phone:'0822222222', type:'sales', subject:'ราคารถไม่ตรงกับที่ตกลงไว้', status:'resolved', priority:'high', assignedTo:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-86400000*10).toISOString(), notes:'คืนเงินส่วนต่างแล้ว' },
  ]
  complaints.forEach(c => { if (!demoCol('complaints')[c.id]) demoCol('complaints')[c.id] = c })

  const csat = [
    { id:'cs1', bookingId:'bk3', customer:'สุภาพร ใจดี', model:'GWM ORA Good Cat', salesName:'อรนุช เซลส์ดี', score:5, nps:9, comment:'บริการดีมาก เซลส์ให้ข้อมูลครบถ้วน', category:'sales', createdAt: new Date(Date.now()-86400000*3).toISOString() },
    { id:'cs2', jobId:'j1', customer:'วิชัย สุขใจ', model:'BYD Seal', serviceType:'service', score:4, nps:8, comment:'งานเสร็จตามเวลา สะอาด', category:'service', createdAt: new Date(Date.now()-86400000*7).toISOString() },
  ]
  csat.forEach(c => { if (!demoCol('csat')[c.id]) demoCol('csat')[c.id] = c })

  const customerNotes = [
    { id:'cn1', customerId:'c1', note:'ลูกค้าชอบสีขาว มีงบ 1.3 ล้าน ต้องการผ่อน 72 งวด', createdBy:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'cn2', customerId:'c1', note:'โทรยืนยันนัด Test Drive วันศุกร์ 10:00', createdBy:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-3600000*6).toISOString() },
    { id:'cn3', customerId:'c4', note:'VIP — เคยซื้อรถมาแล้ว 3 คัน ให้ส่วนลดพิเศษได้', createdBy:'วิชัย ขายเก่ง', createdAt: new Date(Date.now()-86400000*5).toISOString() },
  ]
  customerNotes.forEach(n => { if (!demoCol('customer_notes')[n.id]) demoCol('customer_notes')[n.id] = n })

  const deals = [
    { id:'dl1', custName:'สมชาย มีทรัพย์', model:'BYD Seal AWD', price:1299000, stage:'negotiation', probability:70, nextStep:'รอผลไฟแนนซ์ BAY', salesName:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-86400000*3).toISOString() },
    { id:'dl2', custName:'กิตติพงษ์ วรรณศิลป์', model:'DEEPAL S7 Pro', price:1479000, stage:'proposal', probability:50, nextStep:'ส่งใบเสนอราคา', salesName:'วิชัย ขายเก่ง', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'dl3', custName:'สุภาพร ใจดี', model:'GWM ORA Good Cat', price:899000, stage:'closed_won', probability:100, nextStep:'ส่งมอบแล้ว', salesName:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-86400000*12).toISOString() },
  ]
  deals.forEach(d => { if (!demoCol('deals')[d.id]) demoCol('deals')[d.id] = d })

  // Service extras
  const serviceAppts = [
    { id:'sa1', custName:'วิชัย สุขใจ', phone:'0822222222', brand:'BYD', model:'Seal', plate:'กข-1234', type:'maintenance', date: new Date(Date.now()+86400000).toISOString().slice(0,10), time:'09:00', bay:'เบย์ 1', techName:'สมชาย ช่างดี', status:'confirmed', notes:'เปลี่ยนน้ำมัน + ตรวจ 10k', createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'sa2', custName:'อรนุช พรหมมา', phone:'0898765432', brand:'MG', model:'MG4', plate:'คง-5678', type:'warranty', date: new Date(Date.now()+86400000*2).toISOString().slice(0,10), time:'13:00', bay:'เบย์ 2', techName:'วิชัย ช่างเก่ง', status:'pending', notes:'ตรวจสอบ AC', createdAt: new Date(Date.now()-3600000*3).toISOString() },
    { id:'sa3', custName:'กิตติพงษ์ วรรณศิลป์', phone:'0876543210', brand:'NETA', model:'V II', plate:'งจ-9012', type:'repair', date: new Date(Date.now()).toISOString().slice(0,10), time:'10:30', bay:'เบย์ 3', techName:'สมชาย ช่างดี', status:'inprogress', notes:'เปลี่ยนยาง + firmware', createdAt: new Date(Date.now()-86400000*2).toISOString() },
  ]
  serviceAppts.forEach(a => { if (!demoCol('service_appointments')[a.id]) demoCol('service_appointments')[a.id] = a })

  const accessories = [
    { id:'acc1', name:'ฟิล์มกรองแสง 3M Crystalline', sku:'ACC-3M-001', category:'ฟิล์ม', price:18000, cost:10000, stock:5, unit:'ชุด', brand:'3M', createdAt:'2025-01-10' },
    { id:'acc2', name:'พรมรถ BYD Seal OEM', sku:'ACC-BYD-002', category:'ตกแต่งภายใน', price:3500, cost:1800, stock:12, unit:'ชุด', brand:'BYD', createdAt:'2025-01-15' },
    { id:'acc3', name:'กล้องถอยหลัง 360° HD', sku:'ACC-CAM-003', category:'อิเล็กทรอนิกส์', price:8500, cost:4200, stock:8, unit:'ชุด', brand:'Generic', createdAt:'2025-02-01' },
    { id:'acc4', name:'ถาดรองท้ายรถ All-Weather', sku:'ACC-TWY-004', category:'ตกแต่งภายใน', price:2200, cost:900, stock:20, unit:'ชิ้น', brand:'WeatherTech', createdAt:'2025-02-10' },
  ]
  accessories.forEach(a => { if (!demoCol('accessories')[a.id]) demoCol('accessories')[a.id] = a })

  const demoFleet = [
    { id:'df1', brand:'BYD', model:'Seal RWD', vin:'LGXCE4C10PA000006', plate:'กข-0001', color:'เทา Ink', year:2025, mileage:3520, status:'available', condition:'good', lastService:'2025-05-01', notes:'รถทดลองขับหลัก', createdAt:'2025-01-10' },
    { id:'df2', brand:'MG', model:'MG4 X', vin:'SDUZZZEF5PA000020', plate:'กข-0002', color:'แดง', year:2025, mileage:5200, status:'in_use', condition:'good', lastService:'2025-04-15', notes:'ให้ลูกค้า VIP ยืม', createdAt:'2025-01-15' },
    { id:'df3', brand:'DEEPAL', model:'S7', vin:'LZEZ1EBA0PA000030', plate:'กข-0003', color:'ขาว', year:2025, mileage:8900, status:'maintenance', condition:'fair', lastService:'2025-03-01', notes:'ส่งซ่อม — ยางสึก', createdAt:'2025-02-01' },
  ]
  demoFleet.forEach(d => { if (!demoCol('demo_fleet')[d.id]) demoCol('demo_fleet')[d.id] = d })

  const keys = [
    { id:'k1', vehicleId:'v1', vin:'LGXCE4C10PA000001', brand:'BYD', model:'Seal', plate:'(ยังไม่จด)', keySet:1, spare:1, status:'in_stock', location:'ตู้กุญแจ A1', handedTo:'', createdAt:'2025-03-01' },
    { id:'k2', vehicleId:'v2', vin:'LGXCE4C10PA000002', brand:'BYD', model:'Atto 3', plate:'', keySet:1, spare:1, status:'with_sales', location:'', handedTo:'อรนุช เซลส์ดี', createdAt:'2025-02-15' },
    { id:'k3', vehicleId:'v6', vin:'LGXCE4C10PA000006', brand:'BYD', model:'Seal Demo', plate:'กข-0001', keySet:1, spare:1, status:'in_stock', location:'ตู้กุญแจ A2', handedTo:'', createdAt:'2025-01-10' },
  ]
  keys.forEach(k => { if (!demoCol('keys')[k.id]) demoCol('keys')[k.id] = k })

  // Finance extras
  const assets = [
    { id:'ast1', name:'ลิฟต์ยกรถ', code:'AST-001', category:'เครื่องมือ', cost:280000, currentValue:196000, depreciation:20, purchaseDate:'2022-01-15', location:'ศูนย์บริการ', status:'active', notes:'', createdAt:'2022-01-15' },
    { id:'ast2', name:'คอมพิวเตอร์ Showroom x5', code:'AST-002', category:'IT', cost:150000, currentValue:90000, depreciation:25, purchaseDate:'2022-06-01', location:'โชว์รูม', status:'active', notes:'', createdAt:'2022-06-01' },
    { id:'ast3', name:'รถตู้บริษัท Toyota Hiace', code:'AST-003', category:'ยานพาหนะ', cost:1200000, currentValue:840000, depreciation:15, purchaseDate:'2021-03-01', location:'ที่จอดรถ', status:'active', notes:'TH-2021-001', createdAt:'2021-03-01' },
  ]
  assets.forEach(a => { if (!demoCol('assets')[a.id]) demoCol('assets')[a.id] = a })

  const deposits = [
    { id:'dep1', bookingId:'bk1', customer:'ธีรพงศ์ แสงทอง', model:'BYD Seal AWD', amount:50000, method:'โอน', refNo:'REF-001', status:'held', date:'2025-06-01', booking:'BK-0001', notes:'มัดจำจอง BYD Seal AWD', createdAt:'2025-06-01' },
    { id:'dep2', bookingId:'bk2', customer:'กิตติพงษ์ วรรณศิลป์', model:'DEEPAL S07', amount:30000, method:'โอน', refNo:'REF-002', status:'applied', date:'2025-06-05', booking:'BK-0002', notes:'มัดจำจอง DEEPAL S07', createdAt:'2025-06-05' },
  ]
  deposits.forEach(d => { if (!demoCol('deposits')[d.id]) demoCol('deposits')[d.id] = d })

  const expenseApprovals = [
    { id:'ea1', title:'ค่าน้ำมันเดินทางพบลูกค้า', amount:1500, category:'เดินทาง', submittedBy:'อรนุช เซลส์ดี', date:'2025-06-01', status:'approved', approvedBy:'ทวีศักดิ์ สุขสมบัติเสถียร', receipt:true, notes:'', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'ea2', title:'ค่าอาหารจัดเลี้ยงลูกค้า VIP', amount:3200, category:'การตลาด', submittedBy:'วิชัย ขายเก่ง', date:'2025-06-10', status:'pending', approvedBy:'', receipt:true, notes:'รอผู้จัดการอนุมัติ', createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'ea3', title:'ค่าของขวัญส่งมอบรถ', amount:800, category:'ลูกค้าสัมพันธ์', submittedBy:'อรนุช เซลส์ดี', date:'2025-05-28', status:'approved', approvedBy:'ทวีศักดิ์ สุขสมบัติเสถียร', receipt:true, notes:'', createdAt: new Date(Date.now()-86400000*15).toISOString() },
  ]
  expenseApprovals.forEach(e => { if (!demoCol('expense_approvals')[e.id]) demoCol('expense_approvals')[e.id] = e })

  const commissionRules = [
    { id:'cr1', name:'ค่าคอม Car — Standard', type:'car', base:0, tiers:[{min:0,max:999999,pct:1.5},{min:1000000,max:9999999,pct:2.0}], active:true, createdAt:'2025-01-01' },
    { id:'cr2', name:'ค่าคอม Finance — per deal', type:'finance', base:3000, tiers:[], flat:3000, pct:0, active:true, createdAt:'2025-01-01' },
    { id:'cr3', name:'ค่าคอม Insurance', type:'insurance', base:0, tiers:[], flat:0, pct:20, active:true, createdAt:'2025-01-01' },
    { id:'cr4', name:'ค่าคอม Accessory', type:'accessory', base:0, tiers:[], flat:0, pct:5, active:true, createdAt:'2025-01-01' },
  ]
  commissionRules.forEach(r => { if (!demoCol('commission_rules')[r.id]) demoCol('commission_rules')[r.id] = r })

  const debts = [
    { id:'debt1', custName:'นภา ฟ้าใส', phone:'0833333333', amount:50000, reason:'ค่างวดรถค้างชำระ', dueDate:'2025-05-01', status:'overdue', lastContact:'2025-06-01', notes:'โทร 3 ครั้งแล้ว ไม่รับ', createdAt:'2025-05-01' },
    { id:'debt2', custName:'สมบัติ ยิ่งใหญ่', phone:'0812340005', amount:15000, reason:'ค่าซ่อมบำรุง', dueDate:'2025-06-15', status:'pending', lastContact:'', notes:'', createdAt:'2025-06-10' },
  ]
  debts.forEach(d => { if (!demoCol('debts')[d.id]) demoCol('debts')[d.id] = d })

  // HR extras
  const leaveRequests = [
    { id:'lr1', staffId:'st2', staffName:'อรนุช เซลส์ดี', type:'annual', startDate:'2025-07-01', endDate:'2025-07-03', days:3, reason:'พักผ่อนประจำปี', status:'approved', approvedBy:'ทวีศักดิ์ สุขสมบัติเสถียร', createdAt: new Date(Date.now()-86400000*10).toISOString() },
    { id:'lr2', staffId:'st4', staffName:'สมชาย ช่างดี', type:'sick', startDate: new Date().toISOString().slice(0,10), endDate: new Date().toISOString().slice(0,10), days:1, reason:'ไม่สบาย มีใบรับรองแพทย์', status:'pending', approvedBy:'', createdAt: new Date(Date.now()-3600000*2).toISOString() },
    { id:'lr3', staffId:'st3', staffName:'วิชัย ขายเก่ง', type:'personal', startDate:'2025-06-20', endDate:'2025-06-20', days:1, reason:'ธุระส่วนตัว', status:'approved', approvedBy:'ทวีศักดิ์ สุขสมบัติเสถียร', createdAt: new Date(Date.now()-86400000*20).toISOString() },
  ]
  leaveRequests.forEach(l => { if (!demoCol('leave_requests')[l.id]) demoCol('leave_requests')[l.id] = l })

  // Comms extras
  const callLogs = [
    { id:'cl1', customerId:'c1', custName:'สมชาย มีทรัพย์', phone:'0812345678', type:'outbound', duration:'3:42', result:'interested', notes:'ลูกค้าสนใจ BYD Seal ขาว — นัดวันศุกร์', createdBy:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-3600000*3).toISOString() },
    { id:'cl2', customerId:'c2', custName:'สมหญิง ดีมาก', phone:'0898765432', type:'inbound', duration:'1:15', result:'callback', notes:'โทรมาถามเรื่อง MG4 — ขอเวลาคิด', createdBy:'วิชัย ขายเก่ง', createdAt: new Date(Date.now()-86400000).toISOString() },
    { id:'cl3', customerId:'c4', custName:'วิชัย สุขใจ', phone:'0822222222', type:'outbound', duration:'5:20', result:'booked', notes:'นัดส่งมอบรถ BYD Atto 3', createdBy:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-86400000*2).toISOString() },
  ]
  callLogs.forEach(c => { if (!demoCol('call_logs')[c.id]) demoCol('call_logs')[c.id] = c })

  const chatTemplates = [
    { id:'ct1', title:'ทักทายลูกค้าใหม่', category:'ทักทาย', text:'สวัสดีครับ/ค่ะ ยินดีต้อนรับสู่ LAMOM AUTO ผมชื่อ{{name}} มีอะไรให้ช่วยได้บ้างครับ?', usage:127, active:true, createdAt:'2025-01-01' },
    { id:'ct2', title:'แจ้งราคาและโปรโมชั่น', category:'ขาย', text:'ขอบคุณที่สนใจรถรุ่น{{model}} ราคาปัจจุบัน {{price}} บาท พร้อมโปรพิเศษดอกเบี้ย 0% 12 เดือน ต้องการข้อมูลเพิ่มเติมครับ?', usage:89, active:true, createdAt:'2025-01-15' },
    { id:'ct3', title:'นัด Test Drive', category:'บริการ', text:'ขอบคุณครับ! ยืนยันนัด Test Drive {{model}} วันที่ {{date}} เวลา {{time}} ที่โชว์รูมของเราครับ 🚗', usage:45, active:true, createdAt:'2025-02-01' },
    { id:'ct4', title:'แจ้งรถพร้อมส่งมอบ', category:'ส่งมอบ', text:'ข่าวดีครับ! รถ {{model}} ของคุณ{{customer}} พร้อมส่งมอบแล้วครับ 🎉 นัดรับวันไหนสะดวกครับ?', usage:32, active:true, createdAt:'2025-02-15' },
  ]
  chatTemplates.forEach(t => { if (!demoCol('chat_templates')[t.id]) demoCol('chat_templates')[t.id] = t })

  const escalationRules = [
    { id:'er1', name:'Lead ไม่มีการติดต่อ 3 วัน', dept:'ฝ่ายขาย', level1:'หัวหน้าทีมขาย', level2:'ผู้จัดการโชว์รูม', channel:'LINE', triggerHours:72, active:true, createdAt:'2025-01-01' },
    { id:'er2', name:'Complaint ไม่ได้รับการแก้ไขใน 24 ชม.', dept:'ทุกฝ่าย', level1:'หัวหน้าฝ่ายบริการ', level2:'เจ้าของ', channel:'LINE+Email', triggerHours:24, active:true, createdAt:'2025-01-01' },
    { id:'er3', name:'PDI ล่าช้าเกิน 2 วัน', dept:'บริการ', level1:'หัวหน้าช่าง', level2:'ผู้จัดการโชว์รูม', channel:'LINE', triggerHours:48, active:true, createdAt:'2025-01-15' },
  ]
  escalationRules.forEach(r => { if (!demoCol('escalation_rules')[r.id]) demoCol('escalation_rules')[r.id] = r })

  const meetingMinutes = [
    { id:'mm1', title:'ประชุมทีมขายประจำสัปดาห์', date:'2025-06-23', time:'09:00', dept:'ขาย', attendees:['ทวีศักดิ์','อรนุช','วิชัย'], agenda:['ทบทวนยอดขาย','แผนสัปดาห์หน้า'], minutes:'เพิ่มเป้า Test Drive 20% + ดันโปรโมชั่น EV', actions:[{ task:'ส่งใบเสนอราคา DEEPAL', owner:'วิชัย', due:'2025-06-28', done:true }], status:'completed', createdAt: new Date(Date.now()-86400000*6).toISOString() },
    { id:'mm2', title:'ประชุมฝ่ายบริการ — คุณภาพงานซ่อม', date:'2025-06-26', time:'14:00', dept:'บริการ', attendees:['ทวีศักดิ์','สมชาย','วิชัยช่าง'], agenda:['ลด TAT','ลูกค้า Complaint'], minutes:'ตั้ง SLA งานซ่อม 1 วัน ยกเว้นอะไหล่นำเข้า', actions:[{ task:'ทำ checklist ประจำวัน', owner:'สมชาย', due:'2025-06-30', done:false }], status:'completed', createdAt: new Date(Date.now()-86400000*3).toISOString() },
  ]
  meetingMinutes.forEach(m => { if (!demoCol('meeting_minutes')[m.id]) demoCol('meeting_minutes')[m.id] = m })

  // B2B extras
  const fleetAccounts = [
    { id:'fa1', company:'บริษัท ไทยอุตสาหกรรม จำกัด', industry:'การผลิต', contact:'คุณสมศักดิ์ วงศ์มา', phone:'0812300001', email:'fleet@thai-industry.com', vehicles:[], notes:'ลูกค้าองค์กร fleet 10+ คัน/ปี', salesperson:'อรนุช เซลส์ดี', status:'active', totalPurchase:12000000, createdAt: new Date(Date.now()-86400000*90).toISOString() },
    { id:'fa2', company:'ห้างหุ้นส่วน จำกัด โลจิสติกส์ไทย', industry:'โลจิสติกส์', contact:'คุณพิชัย ใจดี', phone:'0823400002', email:'logisthai@email.com', vehicles:[], notes:'ต้องการรถ Van/SUV เพื่อส่งของ', salesperson:'วิชัย ขายเก่ง', status:'prospect', totalPurchase:0, createdAt: new Date(Date.now()-86400000*30).toISOString() },
  ]
  fleetAccounts.forEach(f => { if (!demoCol('fleet_accounts')[f.id]) demoCol('fleet_accounts')[f.id] = f })

  const fleetVehicles = [
    { id:'fv1', plate:'กข-1111', model:'BYD Seal AWD', driver:'สมชาย ขับดี', company:'บริษัท ไทยอุตสาหกรรม', status:'moving', lat:13.756, lng:100.502, location:'สุขุมวิท 25', speed:45, fuel:80, trip:'รับ VIP — สนามบิน', createdAt:'2025-01-01' },
    { id:'fv2', plate:'กข-2222', model:'BYD Atto 3', driver:'วิชัย คนขับ', company:'บริษัท ไทยอุตสาหกรรม', status:'parked', lat:13.721, lng:100.523, location:'บางนา', speed:0, fuel:45, trip:'จอดส่งสินค้า', createdAt:'2025-01-01' },
    { id:'fv3', plate:'กข-3333', model:'DEEPAL S7', driver:'อรนุช คนขับ', company:'บริษัท ไทยอุตสาหกรรม', status:'charging', lat:13.744, lng:100.532, location:'EV Station CPN', speed:0, fuel:20, trip:'ชาร์จไฟ — รอ 45 นาที', createdAt:'2025-01-01' },
  ]
  fleetVehicles.forEach(v => { if (!demoCol('fleet_vehicles')[v.id]) demoCol('fleet_vehicles')[v.id] = v })

  const corporateQuotes = [
    { id:'cq1', quoteNo:'CQ-001', company:'บริษัท ไทยอุตสาหกรรม', contact:'คุณสมศักดิ์', model:'BYD Seal AWD x 5', qty:5, unitPrice:1299000, totalPrice:6495000, discount:5, status:'sent', validUntil:'2025-07-31', salesperson:'อรนุช เซลส์ดี', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'cq2', quoteNo:'CQ-002', company:'โลจิสติกส์ไทย', contact:'คุณพิชัย', model:'BYD Atto 3 x 3', qty:3, unitPrice:1099000, totalPrice:3297000, discount:3, status:'draft', validUntil:'2025-08-15', salesperson:'วิชัย ขายเก่ง', createdAt: new Date(Date.now()-86400000*2).toISOString() },
  ]
  corporateQuotes.forEach(q => { if (!demoCol('corporate_quotes')[q.id]) demoCol('corporate_quotes')[q.id] = q })

  const leasingContracts = [
    { id:'lc1', company:'ห้างหุ้นส่วน เดลิเวอรี่ไทย', model:'BYD Atto 3', vin:'LGXCE4C10PA000010', plate:'กข-4444', monthlyFee:25000, term:36, startDate:'2025-01-01', endDate:'2027-12-31', mileageLimit:3000, contact:'คุณนิธิ', status:'active', createdAt:'2025-01-01' },
    { id:'lc2', company:'บริษัท ท่องเที่ยวสยาม', model:'BYD Seal AWD', vin:'LGXCE4C10PA000011', plate:'กข-5555', monthlyFee:35000, term:24, startDate:'2025-03-01', endDate:'2027-02-28', mileageLimit:2500, contact:'คุณวรรณ', status:'active', createdAt:'2025-03-01' },
  ]
  leasingContracts.forEach(l => { if (!demoCol('leasing_contracts')[l.id]) demoCol('leasing_contracts')[l.id] = l })

  const govBids = [
    { id:'gb1', project:'จัดซื้อรถยนต์ไฟฟ้า 10 คัน — กรมขนส่งทางบก', org:'กรมขนส่งทางบก', budget:12000000, deadline:'2025-08-01', status:'submitted', bidAmount:11500000, note:'ยื่นประมูลแล้ว รอผล', createdAt: new Date(Date.now()-86400000*15).toISOString() },
    { id:'gb2', project:'รถยนต์ราชการ 5 คัน — สำนักงานเทศบาล', org:'เทศบาลนครเชียงใหม่', budget:5000000, deadline:'2025-09-15', status:'preparing', bidAmount:0, note:'เตรียมเอกสาร TOR', createdAt: new Date(Date.now()-86400000*5).toISOString() },
  ]
  govBids.forEach(g => { if (!demoCol('gov_bids')[g.id]) demoCol('gov_bids')[g.id] = g })

  const partnerCommissions = [
    { id:'pc1', partner:'บริษัท นายหน้าอีวี จำกัด', type:'broker', deal:'BYD Seal AWD — ธีรพงศ์ แสงทอง', dealValue:1299000, commPct:1.5, amount:19485, status:'paid', paidAt:'2025-07-01', createdAt:'2025-06-20' },
    { id:'pc2', partner:'คุณสุรชัย นายหน้าอิสระ', type:'agent', deal:'GWM ORA — สุภาพร ใจดี', dealValue:899000, commPct:1.0, amount:8990, status:'pending', paidAt:'', createdAt:'2025-06-05' },
  ]
  partnerCommissions.forEach(p => { if (!demoCol('partner_commissions')[p.id]) demoCol('partner_commissions')[p.id] = p })

  // ── DMS: Vehicles & Inventory ──
  const vehicleModels = [
    { id:'vm1', brand:'BYD', model:'Seal', variant:'AWD Premium', year:2025, price:1299000, cost:1150000, color:'พอร์เซลิน ไวท์', stock:3, status:'active', imgUrl:'', createdAt:'2025-01-01' },
    { id:'vm2', brand:'BYD', model:'Atto 3', variant:'Extended Range', year:2025, price:1099000, cost:980000, color:'สีน้ำเงิน', stock:5, status:'active', imgUrl:'', createdAt:'2025-01-01' },
    { id:'vm3', brand:'BYD', model:'Dolphin', variant:'Premium', year:2025, price:799000, cost:700000, color:'หลายสี', stock:8, status:'active', imgUrl:'', createdAt:'2025-01-01' },
    { id:'vm4', brand:'DEEPAL', model:'S7', variant:'AWD', year:2025, price:1199000, cost:1050000, color:'ขาว/ดำ', stock:2, status:'active', imgUrl:'', createdAt:'2025-02-01' },
    { id:'vm5', brand:'GWM', model:'ORA Good Cat', variant:'GT', year:2025, price:899000, cost:790000, color:'หลายสี', stock:4, status:'active', imgUrl:'', createdAt:'2025-01-15' },
  ]
  vehicleModels.forEach(v => { if (!demoCol('vehicle_models')[v.id]) demoCol('vehicle_models')[v.id] = v })

  // stock = alias collection used by QrVehicle / VehicleAging pages (mirrors vehicles)
  const stockItems = [
    { id:'st1', vin:'LGXCE4C10PA000001', brand:'BYD', model:'Seal AWD', color:'ขาว', year:2025, plate:'', status:'in_stock', location:'โชว์รูม A1', daysInStock:45, price:1299000, cost:1150000, receivedAt:'2025-05-15' },
    { id:'st2', vin:'LGXCE4C10PA000002', brand:'BYD', model:'Atto 3', color:'น้ำเงิน', year:2025, plate:'', status:'reserved', location:'โชว์รูม B2', daysInStock:30, price:1099000, cost:980000, receivedAt:'2025-05-30' },
    { id:'st3', vin:'LGXCE4C10PA000003', brand:'BYD', model:'Dolphin', color:'ชมพู', year:2025, plate:'', status:'in_stock', location:'คลัง C3', daysInStock:12, price:799000, cost:700000, receivedAt:'2025-06-17' },
    { id:'st4', vin:'LGXCE4C10PA000004', brand:'DEEPAL', model:'S7', color:'ขาว', year:2025, plate:'', status:'sold', location:'', daysInStock:60, price:1199000, cost:1050000, receivedAt:'2025-04-30' },
  ]
  stockItems.forEach(s => { if (!demoCol('stock')[s.id]) demoCol('stock')[s.id] = s })

  const reservations = [
    { id:'res1', reserveNo:'RSV-001', vehicleId:'st1', vin:'LGXCE4C10PA000001', model:'BYD Seal AWD', custName:'ธีรพงศ์ แสงทอง', phone:'0891234567', salesName:'อรนุช เซลส์ดี', deposit:10000, status:'active', reservedAt: new Date(Date.now()-86400000*3).toISOString(), expiresAt: new Date(Date.now()+86400000*4).toISOString() },
    { id:'res2', reserveNo:'RSV-002', vehicleId:'st2', vin:'LGXCE4C10PA000002', model:'BYD Atto 3', custName:'สุภาพร ใจดี', phone:'0812345678', salesName:'วิชัย ขายเก่ง', deposit:5000, status:'active', reservedAt: new Date(Date.now()-86400000*1).toISOString(), expiresAt: new Date(Date.now()+86400000*6).toISOString() },
  ]
  reservations.forEach(r => { if (!demoCol('reservations')[r.id]) demoCol('reservations')[r.id] = r })

  const vehicleReservations = reservations  // alias used by VehicleReservation.js
  vehicleReservations.forEach(r => { if (!demoCol('vehicle_reservations')[r.id]) demoCol('vehicle_reservations')[r.id] = r })

  const consignments = [
    { id:'con1', consignNo:'CSG-001', ownerName:'นายสมชาย รักรถ', phone:'0834567890', brand:'Toyota', model:'Camry', year:2022, vin:'JT2BF3EK7C0123456', color:'ขาว', plate:'กก-1234 กทม.', km:45000, askPrice:750000, agentPrice:700000, commission:25000, status:'selling', note:'สภาพดีมาก ไม่เคยชน', createdAt: new Date(Date.now()-86400000*20).toISOString() },
    { id:'con2', consignNo:'CSG-002', ownerName:'นางสาวจิราวรรณ ดีใจ', phone:'0876543210', brand:'Honda', model:'Accord', year:2021, vin:'1HGCR2F34GA123456', color:'เงิน', plate:'ขข-5678 กทม.', km:62000, askPrice:600000, agentPrice:560000, commission:20000, status:'sold', note:'ขายได้แล้ว', createdAt: new Date(Date.now()-86400000*45).toISOString() },
  ]
  consignments.forEach(c => { if (!demoCol('consignments')[c.id]) demoCol('consignments')[c.id] = c })

  const tradeIns = [
    { id:'ti1', tradeNo:'TI-001', custName:'ธีรพงศ์ แสงทอง', brand:'Honda', model:'City', year:2020, vin:'MRHFB1650LY123456', plate:'คค-1111 กทม.', km:55000, condition:'ดี', appraisedValue:350000, acceptedValue:340000, status:'accepted', bookingRef:'BK-001', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'ti2', tradeNo:'TI-002', custName:'สมศักดิ์ วงศ์มา', brand:'Toyota', model:'Yaris', year:2019, vin:'MHR50BEB5JA123456', plate:'งง-2222 กทม.', km:70000, condition:'พอใช้', appraisedValue:250000, acceptedValue:230000, status:'pending', bookingRef:'', createdAt: new Date(Date.now()-86400000*2).toISOString() },
  ]
  tradeIns.forEach(t => { if (!demoCol('trade_ins')[t.id]) demoCol('trade_ins')[t.id] = t })

  const usedCars = [
    { id:'uc1', vin:'JT2BF3EK7C0123456', brand:'Toyota', model:'Camry', year:2022, color:'ขาว', plate:'กก-1234 กทม.', km:45000, buyPrice:700000, sellPrice:780000, status:'for_sale', source:'consignment', consignId:'con1', note:'', createdAt: new Date(Date.now()-86400000*20).toISOString() },
    { id:'uc2', vin:'MRHFB1650LY123456', brand:'Honda', model:'City', year:2020, color:'เงิน', plate:'คค-1111 กทม.', km:55000, buyPrice:340000, sellPrice:390000, status:'for_sale', source:'trade_in', tradeId:'ti1', note:'', createdAt: new Date(Date.now()-86400000*5).toISOString() },
  ]
  usedCars.forEach(u => { if (!demoCol('used_cars')[u.id]) demoCol('used_cars')[u.id] = u })

  const testDrives = [
    { id:'td1', tdNo:'TD-001', custName:'นพดล สุขใส', phone:'0812223333', email:'noppadol@email.com', model:'BYD Seal AWD', vehicleId:'st1', date:'2025-06-28', time:'10:00', duration:60, route:'ถนนราชพฤกษ์ กลับ', salesName:'อรนุช เซลส์ดี', status:'completed', feedback:'ชอบมาก เร็วดี เงียบ', interest:'high', createdAt: new Date(Date.now()-86400000*1).toISOString() },
    { id:'td2', tdNo:'TD-002', custName:'สุภาพร ใจดี', phone:'0823334444', email:'supaporn@email.com', model:'BYD Atto 3', vehicleId:'st2', date:'2025-06-30', time:'14:00', duration:45, route:'ถนนพหลโยธิน', salesName:'วิชัย ขายเก่ง', status:'scheduled', feedback:'', interest:'medium', createdAt: new Date(Date.now()).toISOString() },
  ]
  testDrives.forEach(t => { if (!demoCol('test_drives')[t.id]) demoCol('test_drives')[t.id] = t })

  const testDriveCerts = [
    { id:'tdc1', certNo:'TDC-2025-001', custName:'นพดล สุขใส', idCard:'1234567890123', model:'BYD Seal AWD', vin:'LGXCE4C10PA000001', plate:'ทดสอบ', date:'2025-06-28', salesName:'อรนุช เซลส์ดี', issuedAt:'2025-06-28T10:00:00', status:'issued' },
  ]
  testDriveCerts.forEach(c => { if (!demoCol('test_drive_certs')[c.id]) demoCol('test_drive_certs')[c.id] = c })

  const vehicleTransfers = [
    { id:'vt1', transferNo:'VT-001', fromBranch:'สาขาหลัก', toBranch:'สาขาเชียงใหม่', vin:'LGXCE4C10PA000003', model:'BYD Dolphin', color:'ชมพู', requestedBy:'วิชัย ขายเก่ง', approvedBy:'ผู้จัดการ', status:'in_transit', requestedAt: new Date(Date.now()-86400000*2).toISOString(), estimatedArrival: new Date(Date.now()+86400000*1).toISOString() },
  ]
  vehicleTransfers.forEach(v => { if (!demoCol('vehicle_transfers')[v.id]) demoCol('vehicle_transfers')[v.id] = v })

  const vehicleReceiving = [
    { id:'vr1', receiveNo:'RCV-001', vin:'LGXCE4C10PA000001', model:'BYD Seal AWD', color:'ขาว', deliveryDate:'2025-05-15', supplier:'BYD Thailand', invoiceNo:'INV-2025-001', invoiceValue:1150000, receivedBy:'ผู้จัดการคลัง', condition:'ปกติ', photos:[], note:'', createdAt:'2025-05-15' },
    { id:'vr2', receiveNo:'RCV-002', vin:'LGXCE4C10PA000002', model:'BYD Atto 3', color:'น้ำเงิน', deliveryDate:'2025-05-30', supplier:'BYD Thailand', invoiceNo:'INV-2025-002', invoiceValue:980000, receivedBy:'ผู้จัดการคลัง', condition:'ปกติ', photos:[], note:'', createdAt:'2025-05-30' },
  ]
  vehicleReceiving.forEach(v => { if (!demoCol('vehicle_receiving')[v.id]) demoCol('vehicle_receiving')[v.id] = v })

  const stockAudit = [
    { id:'sa1', auditNo:'AUD-001', date:'2025-06-01', auditor:'ผู้จัดการคลัง', totalStock:12, counted:12, discrepancies:0, status:'completed', notes:'ตรวจนับครบทุกคัน', createdAt:'2025-06-01' },
  ]
  stockAudit.forEach(s => { if (!demoCol('stock_audit')[s.id]) demoCol('stock_audit')[s.id] = s })

  const suppliers = [
    { id:'sup1', name:'BYD Thailand Co., Ltd.', type:'manufacturer', contact:'Mr. Li Wei', phone:'028890001', email:'sales@byd.co.th', address:'เขตพระโขนง กทม.', paymentTerms:'30 วัน', leadTime:14, status:'active', rating:5, createdAt:'2025-01-01' },
    { id:'sup2', name:'อีวี อุปกรณ์ไทย จำกัด', type:'accessories', contact:'คุณสุชาติ แก้วมณี', phone:'0821234567', email:'ev-parts@thai.com', address:'บางนา กทม.', paymentTerms:'15 วัน', leadTime:7, status:'active', rating:4, createdAt:'2025-02-01' },
    { id:'sup3', name:'สยาม อีวี ชาร์จเจอร์', type:'equipment', contact:'คุณปิยะ ช่างไฟ', phone:'0834567890', email:'charger@siamev.com', address:'ลาดพร้าว กทม.', paymentTerms:'45 วัน', leadTime:21, status:'active', rating:4, createdAt:'2025-03-01' },
  ]
  suppliers.forEach(s => { if (!demoCol('suppliers')[s.id]) demoCol('suppliers')[s.id] = s })

  // ── DMS: Finance / Compliance ──
  const bankTransactions = [
    { id:'bt1', txDate:'2025-06-25', bank:'กสิกรไทย', account:'xxx-x-xxx01', ref:'BK250625001', type:'deposit', amount:1299000, custName:'ธีรพงศ์ แสงทอง', note:'ค่ารถ BYD Seal', matched:true, bookingRef:'BK-001', createdAt:'2025-06-25' },
    { id:'bt2', txDate:'2025-06-26', bank:'ไทยพาณิชย์', account:'xxx-x-xxx02', ref:'BK250626001', type:'deposit', amount:50000, custName:'สุภาพร ใจดี', note:'มัดจำ BYD Atto 3', matched:false, bookingRef:'', createdAt:'2025-06-26' },
    { id:'bt3', txDate:'2025-06-27', bank:'กรุงเทพ', account:'xxx-x-xxx03', ref:'BK250627001', type:'transfer_in', amount:1099000, custName:'บริษัท ไทยลิสซิ่ง จำกัด', note:'ค่าเช่าซื้อ Atto 3', matched:true, bookingRef:'BK-002', createdAt:'2025-06-27' },
  ]
  bankTransactions.forEach(b => { if (!demoCol('bank_transactions')[b.id]) demoCol('bank_transactions')[b.id] = b })

  const plateTracking = [
    { id:'pt1', bookingRef:'BK-001', custName:'ธีรพงศ์ แสงทอง', vin:'LGXCE4C10PA000001', model:'BYD Seal AWD', submittedAt:'2025-06-20', status:'processing', estimatedPlate:'2025-07-10', plate:'', note:'ยื่นจดทะเบียนแล้ว', createdAt:'2025-06-20' },
    { id:'pt2', bookingRef:'BK-002', custName:'สุภาพร ใจดี', vin:'LGXCE4C10PA000002', model:'BYD Atto 3', submittedAt:'2025-06-15', status:'ready', estimatedPlate:'2025-07-01', plate:'กจ-9999 กทม.', note:'ป้ายออกแล้ว รอมอบ', createdAt:'2025-06-15' },
  ]
  plateTracking.forEach(p => { if (!demoCol('plate_tracking')[p.id]) demoCol('plate_tracking')[p.id] = p })

  const floorPlan = [
    { id:'fp1', bank:'กรุงไทย', facilityLimit:20000000, used:14000000, available:6000000, interestRate:5.5, vehicles:['st1','st2'], dueDate:'2025-09-30', status:'active', createdAt:'2025-01-01' },
  ]
  floorPlan.forEach(f => { if (!demoCol('floor_plan')[f.id]) demoCol('floor_plan')[f.id] = f })

  const modelConfigs = [
    { id:'mc1', brand:'BYD', model:'Seal', variant:'AWD Premium', year:2025, basePrice:1299000, accessories:['ฟิล์มกันรอย','ยางอะไหล่'], warranty:'4 ปี 100,000 กม.', batteryWarranty:'8 ปี', range:580, power:360, torque:640, weight:2150, note:'', createdAt:'2025-01-01' },
    { id:'mc2', brand:'BYD', model:'Atto 3', variant:'Extended Range', year:2025, basePrice:1099000, accessories:['ฟิล์มกันรอย'], warranty:'4 ปี 100,000 กม.', batteryWarranty:'8 ปี', range:480, power:150, torque:310, weight:1750, note:'', createdAt:'2025-01-01' },
  ]
  modelConfigs.forEach(m => { if (!demoCol('model_configs')[m.id]) demoCol('model_configs')[m.id] = m })

  const specialEditions = [
    { id:'se1', name:'BYD Seal Limited Edition 2025', model:'Seal', variant:'AWD Premium SE', description:'Edition พิเศษ ตกแต่งภายนอกสีพิเศษ + ชุดแต่งครบ', limitedQty:50, price:1399000, status:'available', launchDate:'2025-07-01', createdAt:'2025-06-01' },
  ]
  specialEditions.forEach(s => { if (!demoCol('special_editions')[s.id]) demoCol('special_editions')[s.id] = s })

  const licenses = [
    { id:'lic1', type:'dealer', licenseNo:'DLR-2025-001', issuedBy:'กรมการขนส่งทางบก', issuedDate:'2025-01-01', expireDate:'2025-12-31', status:'active', renewalReminder:30, note:'', createdAt:'2025-01-01' },
    { id:'lic2', type:'finance', licenseNo:'FIN-2025-001', issuedBy:'ธนาคารแห่งประเทศไทย', issuedDate:'2025-01-01', expireDate:'2026-01-01', status:'active', renewalReminder:60, note:'ใบอนุญาตประกอบธุรกิจสินเชื่อ', createdAt:'2025-01-01' },
  ]
  licenses.forEach(l => { if (!demoCol('licenses')[l.id]) demoCol('licenses')[l.id] = l })

  const govDocs = [
    { id:'gd1', docType:'ใบอนุญาตค้าปลีกรถยนต์', docNo:'GD-2025-001', issuedBy:'กรมพัฒนาธุรกิจการค้า', issuedDate:'2025-01-01', expireDate:'2026-01-01', status:'valid', filePath:'', note:'', createdAt:'2025-01-01' },
    { id:'gd2', docType:'หนังสือรับรองบริษัท', docNo:'GD-2025-002', issuedBy:'กระทรวงพาณิชย์', issuedDate:'2025-01-01', expireDate:'2025-12-31', status:'valid', filePath:'', note:'', createdAt:'2025-01-01' },
  ]
  govDocs.forEach(g => { if (!demoCol('gov_docs')[g.id]) demoCol('gov_docs')[g.id] = g })

  const homologations = [
    { id:'hom1', brand:'BYD', model:'Seal', year:2025, docNo:'HOM-2025-001', authority:'กรมขนส่งทางบก', status:'approved', approvedDate:'2024-11-01', expireDate:'2027-10-31', note:'ผ่านมาตรฐาน มอก.', createdAt:'2025-01-01' },
    { id:'hom2', brand:'BYD', model:'Atto 3', year:2025, docNo:'HOM-2025-002', authority:'กรมขนส่งทางบก', status:'approved', approvedDate:'2024-10-01', expireDate:'2027-09-30', note:'ผ่านมาตรฐาน มอก.', createdAt:'2025-01-01' },
  ]
  homologations.forEach(h => { if (!demoCol('homologations')[h.id]) demoCol('homologations')[h.id] = h })

  // ── Comms ──
  const commMessages = [
    { id:'cm1', threadId:'t1', from:'0891234567', to:'line:lamom_official', channel:'line', direction:'inbound', body:'สนใจ BYD Seal ราคาเท่าไหร่คะ', readAt:'', custId:'c1', custName:'ธีรพงศ์ แสงทอง', assignedTo:'อรนุช เซลส์ดี', status:'replied', createdAt: new Date(Date.now()-86400000*1).toISOString() },
    { id:'cm2', threadId:'t2', from:'fb:user_2345', to:'page:lamom', channel:'facebook', direction:'inbound', body:'มีสีดำไหมครับ BYD Dolphin', readAt:'', custId:'', custName:'นายสมหมาย', assignedTo:'วิชัย ขายเก่ง', status:'unread', createdAt: new Date(Date.now()-3600000).toISOString() },
    { id:'cm3', threadId:'t3', from:'ig:user_333', to:'ig:lamom_ev', channel:'instagram', direction:'inbound', body:'test drive ได้ที่ไหนคะ?', readAt:'', custId:'', custName:'น้องอิ๊ก', assignedTo:'', status:'unread', createdAt: new Date(Date.now()-1800000).toISOString() },
  ]
  commMessages.forEach(m => { if (!demoCol('comm_messages')[m.id]) demoCol('comm_messages')[m.id] = m })

  const broadcasts = [
    { id:'brd1', title:'โปรโมชั่นต้อนรับปีใหม่ 2568', channel:'line', segment:'all', message:'🎉 LAMOM ONE ขอส่งความสุข! โปรโมชั่นพิเศษ BYD ลดสูงสุด 50,000 บาท สั่งจองภายในเดือนนี้', sentTo:1250, opened:890, clicked:234, status:'sent', sentAt:'2025-01-01T09:00:00', createdAt:'2024-12-28' },
    { id:'brd2', title:'แจ้งเตือนบริการครบ 6 เดือน', channel:'sms', segment:'owners', message:'LAMOM: รถของท่านครบ 6 เดือนแล้ว นัดเช็คสภาพฟรี โทร 02-xxx-xxxx', sentTo:450, opened:0, clicked:0, status:'sent', sentAt:'2025-06-01T10:00:00', createdAt:'2025-05-28' },
    { id:'brd3', title:'โปรโมชั่นกลางปี 2568', channel:'line', segment:'leads', message:'⚡ Flash Sale BYD Dolphin เริ่มต้น 799,000 บาท ดาวน์ 0% 36 เดือน จองด่วน!', sentTo:0, opened:0, clicked:0, status:'scheduled', scheduledAt:'2025-07-01T08:00:00', createdAt: new Date(Date.now()).toISOString() },
  ]
  broadcasts.forEach(b => { if (!demoCol('broadcasts')[b.id]) demoCol('broadcasts')[b.id] = b })

  const smsCampaigns = [
    { id:'sms1', name:'แคมเปญแจ้งบริการ Q2', message:'LAMOM: รถของคุณถึงเวลาบริการแล้ว นัดหมายได้ที่ 02-xxx-xxxx หรือ Reply SMS นี้', segment:'owners_6mo', sentCount:320, deliveredCount:315, status:'completed', sentAt:'2025-04-01', createdAt:'2025-03-28' },
    { id:'sms2', name:'โปร Test Drive June', message:'LAMOM: ลองขับ BYD Seal ฟรีวันนี้ โทร 02-xxx-xxxx', segment:'warm_leads', sentCount:180, deliveredCount:175, status:'completed', sentAt:'2025-06-05', createdAt:'2025-06-03' },
  ]
  smsCampaigns.forEach(s => { if (!demoCol('sms_campaigns')[s.id]) demoCol('sms_campaigns')[s.id] = s })

  const customerAreas = [
    { id:'ca1', province:'กรุงเทพมหานคร', district:'พระโขนง', customerCount:45, leadCount:12, bookingCount:8, coords:{ lat:13.703, lng:100.601 }, topModel:'BYD Seal' },
    { id:'ca2', province:'กรุงเทพมหานคร', district:'บางนา', customerCount:38, leadCount:9, bookingCount:5, coords:{ lat:13.674, lng:100.607 }, topModel:'BYD Atto 3' },
    { id:'ca3', province:'นนทบุรี', district:'เมือง', customerCount:22, leadCount:7, bookingCount:3, coords:{ lat:13.856, lng:100.519 }, topModel:'BYD Dolphin' },
    { id:'ca4', province:'ปทุมธานี', district:'ลำลูกกา', customerCount:18, leadCount:5, bookingCount:2, coords:{ lat:13.960, lng:100.760 }, topModel:'DEEPAL S7' },
  ]
  customerAreas.forEach(c => { if (!demoCol('customer_areas')[c.id]) demoCol('customer_areas')[c.id] = c })

  // ── CRM Extras ──
  const priceNegotiations = [
    { id:'pn1', customer:'สมชาย ใจดี', model:'BYD Atto 3', listPrice:1199900, offerPrice:1150000, discount:49900, discPct:4.2, status:'approved', sales:'อรนุช เซลส์ดี', date: new Date(Date.now()-86400000*2).toISOString().slice(0,10), approver:'ผจก. วิชัย', createdAt: new Date(Date.now()-86400000*2).toISOString() },
    { id:'pn2', customer:'นภา สุขสม', model:'BYD Seal AWD', listPrice:1999900, offerPrice:1900000, discount:99900, discPct:5.0, status:'pending', sales:'วิชัย ขายเก่ง', date: new Date(Date.now()-86400000*1).toISOString().slice(0,10), approver:'', createdAt: new Date(Date.now()-86400000*1).toISOString() },
    { id:'pn3', customer:'วิชัย ศรีดี', model:'BYD Dolphin', listPrice:799900, offerPrice:770000, discount:29900, discPct:3.7, status:'rejected', sales:'อรนุช เซลส์ดี', date: new Date(Date.now()-86400000*3).toISOString().slice(0,10), approver:'ผจก. วิชัย', createdAt: new Date(Date.now()-86400000*3).toISOString() },
  ]
  priceNegotiations.forEach(p => { if (!demoCol('price_negotiations')[p.id]) demoCol('price_negotiations')[p.id] = p })

  const voiceNotes = [
    { id:'vn1', customer:'คุณอนันต์ รักดี', duration:'3:42', date: new Date(Date.now()-86400000*1).toISOString(), summary:'ลูกค้าสนใจ BYD Atto 3 สีฟ้า เงินดาวน์ได้ 30% ผ่อน 60 งวด ต้องการ Test Drive เสาร์นี้', followUps:['นัด Test Drive เสาร์นี้','เตรียมใบเสนอราคา 3 รุ่น'], sentiment:'hot', tags:['test-drive','atto3'], createdAt: new Date(Date.now()-86400000*1).toISOString() },
    { id:'vn2', customer:'คุณมาลี วงศ์ดี', duration:'1:55', date: new Date(Date.now()-86400000*2).toISOString(), summary:'ลูกค้าโทรถามราคา BYD Dolphin ยังไม่ตัดสินใจ รอคุยกับสามี', followUps:['โทรติดตาม 7 วัน'], sentiment:'warm', tags:['dolphin'], createdAt: new Date(Date.now()-86400000*2).toISOString() },
  ]
  voiceNotes.forEach(v => { if (!demoCol('voice_notes')[v.id]) demoCol('voice_notes')[v.id] = v })

  // ── HR Extras ──
  const surveys = [
    { id:'sv1', staffId:'s1', staffName:'อรนุช เซลส์ดี', mood:5, category:'งาน', comment:'ชอบงาน ทีมดี', date: new Date().toISOString().slice(0,10), anonymous:false, createdAt: new Date().toISOString() },
    { id:'sv2', staffId:'s2', staffName:'วิชัย ขายเก่ง', mood:3, category:'สภาพแวดล้อม', comment:'เครียดช่วงปลายเดือน', date: new Date().toISOString().slice(0,10), anonymous:false, createdAt: new Date().toISOString() },
  ]
  surveys.forEach(s => { if (!demoCol('surveys')[s.id]) demoCol('surveys')[s.id] = s })

  const welfare = [
    { id:'wf1', type:'ประกันสุขภาพ', provider:'AIA', coverage:500000, premium:12000, enrolledCount:12, status:'active', renewalDate:'2026-12-31', createdAt:'2026-01-01' },
    { id:'wf2', type:'ประกันอุบัติเหตุ', provider:'กรุงเทพประกัน', coverage:1000000, premium:3600, enrolledCount:15, status:'active', renewalDate:'2026-12-31', createdAt:'2026-01-01' },
  ]
  welfare.forEach(w => { if (!demoCol('welfare')[w.id]) demoCol('welfare')[w.id] = w })

  // ── Finance Extras ──
  const vendorPayments = [
    { id:'vp1', vendor:'BYD Thailand', type:'stock', amount:5750000, dueDate:'2026-07-15', status:'pending', invoiceNo:'INV-2026-001', note:'สต็อกรถ 5 คัน', createdAt: new Date(Date.now()-86400000*5).toISOString() },
    { id:'vp2', vendor:'สยาม อีวี ชาร์จเจอร์', type:'equipment', amount:180000, dueDate:'2026-07-01', status:'paid', invoiceNo:'INV-2026-002', note:'ติดตั้ง Charger 2 จุด', createdAt: new Date(Date.now()-86400000*10).toISOString() },
  ]
  vendorPayments.forEach(v => { if (!demoCol('vendor_payments')[v.id]) demoCol('vendor_payments')[v.id] = v })

  const receipts = [
    { id:'rc1', receiptNo:'RC-2026-001', custName:'ธีรพงศ์ แสงทอง', amount:1299000, type:'ค่ารถ BYD Seal', paymentMethod:'โอนธนาคาร', bookingRef:'BK-001', issuedAt: new Date(Date.now()-86400000*3).toISOString(), createdAt: new Date(Date.now()-86400000*3).toISOString() },
    { id:'rc2', receiptNo:'RC-2026-002', custName:'สุภาพร ใจดี', amount:50000, type:'มัดจำ BYD Atto 3', paymentMethod:'บัตรเครดิต', bookingRef:'BK-002', issuedAt: new Date(Date.now()-86400000*1).toISOString(), createdAt: new Date(Date.now()-86400000*1).toISOString() },
  ]
  receipts.forEach(r => { if (!demoCol('receipts')[r.id]) demoCol('receipts')[r.id] = r })

  // ── Marketing Extras ──
  const landingPages = [
    { id:'lp1', name:'BYD Seal Launch 2025', url:'/campaign/byd-seal', status:'active', views:1250, leads:45, conversions:8, createdAt:'2025-06-01' },
    { id:'lp2', name:'โปรกลางปี BYD', url:'/campaign/mid-year', status:'active', views:890, leads:32, conversions:5, createdAt:'2025-06-15' },
  ]
  landingPages.forEach(l => { if (!demoCol('landing_pages')[l.id]) demoCol('landing_pages')[l.id] = l })

  const utmLinks = [
    { id:'utm1', name:'Facebook BYD Seal', source:'facebook', medium:'social', campaign:'byd-seal-launch', clicks:342, leads:28, cost:5000, cpl:178, createdAt:'2025-06-01' },
    { id:'utm2', name:'Google BYD Atto', source:'google', medium:'cpc', campaign:'byd-atto-search', clicks:520, leads:42, cost:8000, cpl:190, createdAt:'2025-06-01' },
  ]
  utmLinks.forEach(u => { if (!demoCol('utm_links')[u.id]) demoCol('utm_links')[u.id] = u })

  // Walk-ins (Showroom walk-in traffic log)
  const walkIns = [
    { id:'wi1', name:'สมศักดิ์ เที่ยวดี', phone:'0811110001', interestedIn:'BYD Seal', staff:'อรนุช เซลส์ดี', visitTime: new Date(Date.now()-3600000*2).toISOString(), source:'ผ่านมาเอง', notes:'สนใจสีขาว งบ 1.3M', status:'interested' },
    { id:'wi2', name:'กนกวรรณ สวยงาม', phone:'0822220002', interestedIn:'MG4', staff:'วิชัย ขายเก่ง', visitTime: new Date(Date.now()-86400000).toISOString(), source:'Google Maps', notes:'ดูรุ่นที่ต่ำกว่า 1M', status:'cold' },
    { id:'wi3', name:'ประยุทธ์ ทำงานดี', phone:'0833330003', interestedIn:'NETA V II', staff:'อรนุช เซลส์ดี', visitTime: new Date(Date.now()-86400000*2).toISOString(), source:'Facebook Ad', notes:'', status:'testdrive' },
  ]
  walkIns.forEach(w => { if (!demoCol('walk_ins')[w.id]) demoCol('walk_ins')[w.id] = w })

  // Showroom appointments
  const appointments = [
    { id:'apt1', custName:'ธีรพงศ์ แสงทอง', phone:'0812340001', purpose:'ทดลองขับ', interestedIn:'BYD Seal AWD', salesperson:'อรนุช เซลส์ดี', date: new Date(Date.now()+86400000).toISOString().slice(0,10), time:'10:00', status:'confirmed', source:'LINE', notes:'' },
    { id:'apt2', custName:'อรนุช พรหมมา', phone:'0812340002', purpose:'ดูรถ', interestedIn:'MG4', salesperson:'วิชัย ขายเก่ง', date: new Date(Date.now()+86400000*2).toISOString().slice(0,10), time:'14:00', status:'scheduled', source:'โทรศัพท์', notes:'มากับสามี' },
    { id:'apt3', custName:'สมบัติ ยิ่งใหญ่', phone:'0812340005', purpose:'เซ็นสัญญา', interestedIn:'BYD Seal AWD', salesperson:'อรนุช เซลส์ดี', date: new Date(Date.now()).toISOString().slice(0,10), time:'11:00', status:'arrived', source:'Referral', notes:'' },
  ]
  appointments.forEach(a => { if (!demoCol('appointments')[a.id]) demoCol('appointments')[a.id] = a })

  // Referral program
  const referrals = [
    { id:'ref1', referrer:'ธีรพงศ์ แสงทอง', referee:'สมชาย มีทรัพย์', phone:'0812340003', model:'BYD Seal', submitDate: new Date(Date.now()-86400000*5).toISOString().slice(0,10), status:'converted', reward:5000, salesName:'อรนุช เซลส์ดี' },
    { id:'ref2', referrer:'วิชัย สุขใจ', referee:'กนกวรรณ สวยงาม', phone:'0822220002', model:'MG4', submitDate: new Date(Date.now()-86400000*2).toISOString().slice(0,10), status:'pending', reward:0, salesName:'วิชัย ขายเก่ง' },
    { id:'ref3', referrer:'สุภาพร ใจดี', referee:'ประยุทธ์ ทำงานดี', phone:'0833330003', model:'NETA V II', submitDate: new Date(Date.now()-86400000).toISOString().slice(0,10), status:'test_drive', reward:0, salesName:'อรนุช เซลส์ดี' },
  ]
  referrals.forEach(r => { if (!demoCol('referrals')[r.id]) demoCol('referrals')[r.id] = r })

  // Referrers (QR referral agents)
  const referrers = [
    { id:'rfr1', name:'ธีรพงศ์ แสงทอง', phone:'0812345678', code:'REF-TS001', qrUrl:'', sales:1, commission:5000, totalReferrals:3, lastReferral: new Date(Date.now()-86400000*5).toISOString().slice(0,10) },
    { id:'rfr2', name:'วิชัย สุขใจ', phone:'0822222222', code:'REF-WS002', qrUrl:'', sales:0, commission:0, totalReferrals:1, lastReferral: new Date(Date.now()-86400000*2).toISOString().slice(0,10) },
  ]
  referrers.forEach(r => { if (!demoCol('referrers')[r.id]) demoCol('referrers')[r.id] = r })

  // Quotations
  const quotations = [
    { id:'qt1', quoteNo:'QT-2025-001', customerName:'สมชาย มีทรัพย์', phone:'0812345678', vehicleLabel:'BYD Seal AWD Performance', color:'ขาว Pearl', price:1299000, down:200000, financeCo:'BAY', monthly:19800, status:'sent', createdDate:'2025-06-01', salesName:'อรนุช เซลส์ดี' },
    { id:'qt2', quoteNo:'QT-2025-002', customerName:'กิตติพงษ์ วรรณศิลป์', phone:'0876543210', vehicleLabel:'DEEPAL S07 New Standard', color:'ดำ', price:1099000, down:150000, financeCo:'TTB', monthly:15200, status:'accepted', createdDate:'2025-06-03', salesName:'วิชัย ขายเก่ง' },
    { id:'qt3', quoteNo:'QT-2025-003', customerName:'พิมพ์ชนก ทองสุข', phone:'0812340004', vehicleLabel:'BYD Seal RWD', color:'เทา Ink', price:1199000, down:180000, financeCo:'KBANK', monthly:17500, status:'draft', createdDate:'2025-06-08', salesName:'อรนุช เซลส์ดี' },
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
    { id:'ph1', brand:'BYD', model:'Seal', variant:'AWD Performance', date:'2025-01-01', price:1349000, prevPrice:1399000, changeType:'reduce', notes:'ปรับราคาต้นปี' },
    { id:'ph2', brand:'BYD', model:'Seal', variant:'AWD Performance', date:'2025-04-01', price:1299000, prevPrice:1349000, changeType:'reduce', notes:'โปรโมชั่น Q2' },
    { id:'ph3', brand:'MG', model:'MG4', variant:'X-Power', date:'2025-02-01', price:949000, prevPrice:989000, changeType:'reduce', notes:'ลดราคาแข่งตลาด' },
    { id:'ph4', brand:'NETA', model:'V II', variant:'Pro 400', date:'2025-03-15', price:769000, prevPrice:799000, changeType:'reduce', notes:'กระตุ้นยอดขาย Q1' },
  ]
  priceHistory.forEach(p => { if (!demoCol('price_history')[p.id]) demoCol('price_history')[p.id] = p })

  // Model year changeovers
  const modelYearChangeovers = [
    { id:'myc1', model:'BYD Seal', year:'2026', effectiveDate:'2025-09-01', changes:'เพิ่มระบบ ADAS Level 2+ / อัพเดต OTA V3.0 / เปลี่ยนสีใหม่ 2 สี', status:'upcoming' },
    { id:'myc2', model:'MG4', year:'2026', effectiveDate:'2025-10-01', changes:'รุ่น Trophy ใหม่ 435 HP / แบตเตอรี่ 77 kWh / รีดีไซน์กระจังหน้า', status:'upcoming' },
    { id:'myc3', model:'NETA V II', year:'2025', effectiveDate:'2025-01-15', changes:'เพิ่มรุ่น Pro 400km / ปรับราคา / สีใหม่ Sunrise Orange', status:'active' },
  ]
  modelYearChangeovers.forEach(m => { if (!demoCol('model_year_changeovers')[m.id]) demoCol('model_year_changeovers')[m.id] = m })

  // Parts inventory (for analytics)
  const partsInventory = [
    { id:'pi1', sku:'BYD-SEAL-BF001', name:'น้ำมันเบรก DOT4 BYD Original', brand:'BYD', category:'น้ำมันและของเหลว', qty:24, minQty:5, unitCost:280, unitPrice:450, turnover:8.2, lastSold:'2025-06-10' },
    { id:'pi2', sku:'BYD-SEAL-BP002', name:'ผ้าเบรกหน้า BYD Seal', brand:'BYD', category:'ระบบเบรก', qty:8, minQty:2, unitCost:1800, unitPrice:3200, turnover:3.1, lastSold:'2025-05-28' },
    { id:'pi3', sku:'MG-MG4-TY001', name:'ยางหน้า Michelin 235/45R18', brand:'Michelin', category:'ยางและล้อ', qty:12, minQty:4, unitCost:3200, unitPrice:4800, turnover:5.4, lastSold:'2025-06-05' },
    { id:'pi4', sku:'NETA-V-AC001', name:'คอมเพรสเซอร์แอร์ NETA V II', brand:'NETA', category:'ระบบไฟฟ้า', qty:2, minQty:1, unitCost:12000, unitPrice:18500, turnover:1.8, lastSold:'2025-04-20' },
    { id:'pi5', sku:'UNI-FL001', name:'น้ำหล่อเย็น EV Coolant', brand:'Universal', category:'น้ำมันและของเหลว', qty:3, minQty:10, unitCost:450, unitPrice:700, turnover:0.9, lastSold:'2025-03-15' },
  ]
  partsInventory.forEach(p => { if (!demoCol('parts_inventory')[p.id]) demoCol('parts_inventory')[p.id] = p })

  // Petty cash
  const pettyCash = [
    { id:'pc1', type:'out', cat:'refresh', amount:850, desc:'ซื้อกาแฟ-น้ำดื่มสำหรับโชว์รูม', by:'อรนุช เซลส์ดี', time: new Date(Date.now()-3600000*3).toISOString(), receipt:true },
    { id:'pc2', type:'out', cat:'supplies', amount:1200, desc:'ค่าน้ำยาทำความสะอาดรถ', by:'สมชาย ช่างดี', time: new Date(Date.now()-86400000).toISOString(), receipt:true },
    { id:'pc3', type:'in', cat:'other', amount:5000, desc:'เติมเงินสดย่อย ประจำสัปดาห์', by:'ทวีศักดิ์ สุขสมบัติเสถียร', time: new Date(Date.now()-86400000*2).toISOString(), receipt:false },
    { id:'pc4', type:'out', cat:'transport', amount:450, desc:'ค่าน้ำมันรถส่งเอกสาร', by:'วิชัย ขายเก่ง', time: new Date(Date.now()-86400000*3).toISOString(), receipt:true },
  ]
  pettyCash.forEach(p => { if (!demoCol('petty_cash')[p.id]) demoCol('petty_cash')[p.id] = p })

  // Finance banks (for loan calculator)
  const financeBanks = [
    { id:'fb1', name:'กรุงเทพ (BAY)', minRate:1.99, maxRate:3.49, minDown:10, maxTenure:84, logo:'BAY', popular:true },
    { id:'fb2', name:'ไทยพาณิชย์ (SCB)', minRate:2.09, maxRate:3.59, minDown:10, maxTenure:84, logo:'SCB', popular:true },
    { id:'fb3', name:'กสิกรไทย (KBANK)', minRate:2.19, maxRate:3.79, minDown:15, maxTenure:72, logo:'KBANK', popular:true },
    { id:'fb4', name:'ทหารไทยธนชาต (TTB)', minRate:2.29, maxRate:3.99, minDown:10, maxTenure:84, logo:'TTB', popular:false },
    { id:'fb5', name:'ออมสิน (GSB)', minRate:1.89, maxRate:2.99, minDown:20, maxTenure:72, logo:'GSB', popular:false },
  ]
  financeBanks.forEach(b => { if (!demoCol('finance_banks')[b.id]) demoCol('finance_banks')[b.id] = b })

  // Monthly close items
  const monthlyCloseItems = [
    { id:'mc1', category:'รายได้', name:'ยอดขายรถ', amount:3297000, responsible:'อรนุช เซลส์ดี', status:'confirmed', date:'2025-06-30' },
    { id:'mc2', category:'รายได้', name:'ค่าบริการศูนย์', amount:48500, responsible:'สมชาย ช่างดี', status:'confirmed', date:'2025-06-30' },
    { id:'mc3', category:'รายได้', name:'ค่าคอมมิชชั่นประกัน', amount:22000, responsible:'วิชัย ขายเก่ง', status:'pending', date:'2025-06-30' },
    { id:'mc4', category:'ค่าใช้จ่าย', name:'เงินเดือนพนักงาน', amount:121000, responsible:'ทวีศักดิ์ สุขสมบัติเสถียร', status:'confirmed', date:'2025-06-30' },
    { id:'mc5', category:'ค่าใช้จ่าย', name:'ค่าเช่าโชว์รูม', amount:85000, responsible:'ทวีศักดิ์ สุขสมบัติเสถียร', status:'confirmed', date:'2025-06-30' },
  ]
  monthlyCloseItems.forEach(m => { if (!demoCol('monthly_close_items')[m.id]) demoCol('monthly_close_items')[m.id] = m })

  // VAT invoices
  const vatInvoices = [
    { id:'vi1', date:'2025-06-20', invoiceNo:'INV-2025-001', buyer:'ธีรพงศ์ แสงทอง', amount:1299000, vatAmount:90930, type:'sale', status:'issued' },
    { id:'vi2', date:'2025-05-28', invoiceNo:'INV-2025-002', buyer:'สุภาพร ใจดี', amount:899000, vatAmount:62930, type:'sale', status:'issued' },
    { id:'vi3', date:'2025-06-10', invoiceNo:'TAX-2025-001', buyer:'วิชัย สุขใจ', amount:15200, vatAmount:1064, type:'service', status:'issued' },
    { id:'vi4', date:'2025-06-15', invoiceNo:'INV-2025-003', buyer:'สมชาย ช่างดี (Purchase)', amount:48000, vatAmount:3360, type:'purchase', status:'issued' },
  ]
  vatInvoices.forEach(v => { if (!demoCol('vat_invoices')[v.id]) demoCol('vat_invoices')[v.id] = v })

  // Purchase orders
  const purchaseOrders = [
    { id:'po1', poNo:'PO-2025-001', title:'สั่งซื้ออะไหล่ BYD Seal', supplier:'BYD Auto Thailand', requestDate:'2025-06-01', status:'approved', amount:48000, items:[{name:'ผ้าเบรกหน้า',qty:4,unitPrice:3200},{name:'น้ำมันเบรก',qty:10,unitPrice:450}], approvedBy:'ทวีศักดิ์ สุขสมบัติเสถียร' },
    { id:'po2', poNo:'PO-2025-002', title:'สั่งซื้ออุปกรณ์ทำความสะอาด', supplier:'บริษัท ซัพพลายโปร จำกัด', requestDate:'2025-06-10', status:'pending', amount:12500, items:[{name:'น้ำยาล้างรถ',qty:20,unitPrice:350},{name:'ผ้าไมโครไฟเบอร์',qty:50,unitPrice:85}], approvedBy:'' },
    { id:'po3', poNo:'PO-2025-003', title:'ยาง Michelin สต็อก', supplier:'Michelin Thailand', requestDate:'2025-05-20', status:'received', amount:128000, items:[{name:'ยาง 235/45R18',qty:40,unitPrice:3200}], approvedBy:'ทวีศักดิ์ สุขสมบัติเสถียร' },
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

  // Fleet deals (Fleet & Corporate)
  const fleetDeals = [
    { id:'fd1', company:'บริษัท ไทยพัฒนา จำกัด', contact:'คุณสมศักดิ์ ผู้จัดการ', phone:'0211112222', sales:'อรนุช เซลส์ดี', model:'BYD Seal AWD x5', qty:5, amount:6495000, status:'negotiation', delivery:'2025-08-01', notes:'ต้องการสีเดียวกันทุกคัน' },
    { id:'fd2', company:'ราชการ — กรมทางหลวง', contact:'คุณวิชัย ข้าราชการ', phone:'0222223333', sales:'วิชัย ขายเก่ง', model:'MG4 X-Power x3', qty:3, amount:2847000, status:'won', delivery:'2025-05-15', notes:'ผ่านการประมูลแล้ว' },
  ]
  fleetDeals.forEach(f => { if (!demoCol('fleet_deals')[f.id]) demoCol('fleet_deals')[f.id] = f })
}

// ── แหล่งข้อมูลการขายกลาง: แปลงจาก "ใบจอง" (bookings) → รูปแบบ sales ──────────────
// ทุกหน้าการเงิน/กำไร/คอมมิชชั่น เรียกใช้ตัวนี้ → ตัวเลขตรงกับใบจองเสมอ
export async function getSalesData() {
  let bookings = []
  try { bookings = await listDocs('bookings', [], 'createdAt', 'desc', 1000) } catch (e) {}
  return bookings
    .filter(b => b.status !== 'ถอนจอง')
    .map(b => ({
      id: b.id, bookingNo: b.bookingNo,
      date: b.actualDeliveryDate || b.cutDate || b.bookingDate || (b.createdAt || '').slice(0, 10),
      custName: b.custName, brand: b.brand, model: ((b.model || '') + ' ' + (b.variant || '')).trim(), plate: b.vin || '',
      salePrice: b.price || 0, cost: b.cost || 0, financeAmount: b.financeAmount || 0,
      finance: b.comFinance || 0, insurance: 0, accessory: 0, discount: 0,
      margin: b.margin || 0, marginLeft: b.marginLeft || 0, totalIncome: b.totalIncome || 0,
      com70: b.com70 || 0, comFinance: b.comFinance || 0, budgetUsed: b.budgetUsed || 0,
      financeCo: b.financeCo || '', salesName: b.salesName || '', status: b.status || '',
      delivered: b.status === 'ส่งมอบแล้ว',
      createdAt: b.createdAt,
    }))
}

// คอมมิชชั่นกลาง: สรุปจากใบจองที่ส่งมอบแล้ว แยกตามเซลส์/เดือน
export async function getCommissionData() {
  const sales = await getSalesData()
  const byKey = {}
  sales.filter(s => s.delivered).forEach(s => {
    const month = (s.date || '').slice(0, 7)
    const key = s.salesName + '|' + month
    if (!byKey[key]) byKey[key] = { id: key, salesName: s.salesName, month, carsSold: 0, salePriceTotal: 0, financeTotal: 0, insuranceTotal: 0, accessoryTotal: 0, com70Total: 0, comFinanceTotal: 0, incomeTotal: 0, status: 'pending' }
    const c = byKey[key]
    c.carsSold++; c.salePriceTotal += s.salePrice; c.financeTotal += s.financeAmount
    c.com70Total += s.com70; c.comFinanceTotal += s.comFinance; c.incomeTotal += s.totalIncome
  })
  return Object.values(byKey)
}

export { demoStore, isDemoMode }
