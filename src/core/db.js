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
    { id:'bk6', bookingNo:'SK2506006', custName:'บิ่ง ชิ้นเทียม', nid:'', phone:'0895556667', address:'', province:'', source:'Walk-in',
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
    { id:'bk8', bookingNo:'SK2505018', custName:'สุภาพร ใจดี', nid:'3100502233445', phone:'0856789012', address:'12/3 หมู่บ้านสุขสันต์', province:'ปทุมธานี', source:'Referral',
      brand:'AION', model:'ES', variant:'2026 Ultra', colorOut:'ฟ้า', colorIn:'น้ำตาล-เบจ', vin:'LAION000000002', motorNo:'M001', batNo:'B001',
      price:899000, cost:867000, down:0, financeCo:'ซื้อสด', financeAmount:0, finStatus:'ซื้อสด', installments:0, interestRate:0, monthly:0, campaign:'ซื้อสด',
      margin:32000, budgetUsed:3000, com70:10000, comFinance:0, marginLeft:29000, totalIncome:39000,
      bookingDate:'2026-05-18', submitDate:'2026-05-18', approveDate:'2026-05-18', signDate:'2026-05-20', cutDate:'2026-05-26', deliveryDate:'2026-05-28', actualDeliveryDate:'2026-05-28',
      salesName:'อรนุช เซลส์ดี', status:'ส่งมอบแล้ว', notes:'', createdAt:'2026-05-18' },
    { id:'bk9', bookingNo:'SK2505017', custName:'ประเสริฐ ทองแท้', nid:'', phone:'0898887776', address:'', province:'นนทบุรี', source:'Walk-in',
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
  const serviceReminders = [
    { id:'RM001', customer:'สมชาย ใจดี', phone:'085-111', plate:'1กข-1234', model:'BYD Seal', type:'mileage', detail:'ครบ 20,000 km', dueDate:srAddDays(5), contacted:false, booked:false },
    { id:'RM002', customer:'มาลี สุขใจ', phone:'086-222', plate:'2ขค-5678', model:'BYD Dolphin', type:'time', detail:'ครบ 12 เดือน', dueDate:srAddDays(2), contacted:true, booked:true },
    { id:'RM003', customer:'ธนพล เที่ยงตรง', phone:'087-333', plate:'3คง-9012', model:'MG ZS EV', type:'warranty', detail:'ประกันหมด 30 วัน', dueDate:srAddDays(30), contacted:false, booked:false },
    { id:'RM004', customer:'อรทัย ตั้งใจ', phone:'088-444', plate:'4งจ-3456', model:'BYD Atto 3', type:'battery', detail:'ตรวจแบตประจำปี', dueDate:srAddDays(-3), contacted:true, booked:false },
    { id:'RM005', customer:'วิรัช เก่งมาก', phone:'089-555', plate:'5จฉ-7890', model:'BYD Han', type:'mileage', detail:'ครบ 40,000 km', dueDate:srAddDays(10), contacted:false, booked:false },
    { id:'RM006', customer:'ชาตรี เข้มแข็ง', phone:'084-666', plate:'6ฉช-1122', model:'MG4', type:'time', detail:'ครบ 6 เดือน', dueDate:srAddDays(14), contacted:false, booked:false },
  ]
  serviceReminders.forEach(r => { if (!demoCol('service_reminders')[r.id]) demoCol('service_reminders')[r.id] = r })

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
  const waitingLoungeQueue = [
    { id:'Q01', customer:'สมชาย ใจดี', plate:'1กข-1234', service:'เช็คระยะ 20,000 km', stage:'working', checkin:wlAddMinutes(45), estMins:90, drinks:2, notified:false },
    { id:'Q02', customer:'มาลี สุขใจ', plate:'2ขค-5678', service:'เปลี่ยนยาง 4 เส้น', stage:'qc', checkin:wlAddMinutes(80), estMins:100, drinks:1, notified:false },
    { id:'Q03', customer:'ธนพล เที่ยงตรง', plate:'3คง-9012', service:'ตรวจแบตเตอรี่', stage:'ready', checkin:wlAddMinutes(60), estMins:45, drinks:1, notified:true },
    { id:'Q04', customer:'อรทัย ตั้งใจ', plate:'4งจ-3456', service:'ติดฟิล์มกรองแสง', stage:'diagnosing', checkin:wlAddMinutes(15), estMins:180, drinks:0, notified:false },
  ]
  waitingLoungeQueue.forEach(q => { if (!demoCol('waiting_lounge_queue')[q.id]) demoCol('waiting_lounge_queue')[q.id] = q })

  // Warranty claims (หน้า /service/warranty-claim)
  const wcAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const warrantyClaims = [
    { id:'WC001', plate:'1กข-1234', model:'BYD Seal', vin:'...3456', issue:'มอเตอร์มีเสียงผิดปกติ', parts:'Motor Assembly', laborHrs:4, partCost:45000, status:'approved', submitted:wcAddDays(-8), warrantyType:'Powertrain 8 ปี' },
    { id:'WC002', plate:'2ขค-5678', model:'BYD Dolphin', vin:'...9012', issue:'จอ infotainment ค้าง', parts:'Head Unit', laborHrs:1.5, partCost:18000, status:'submitted', submitted:wcAddDays(-3), warrantyType:'ทั่วไป 3 ปี' },
    { id:'WC003', plate:'3คง-9012', model:'MG ZS EV', vin:'...7788', issue:'แบตเสื่อมเร็วผิดปกติ (SOH 72%)', parts:'Battery Pack', laborHrs:6, partCost:280000, status:'submitted', submitted:wcAddDays(-1), warrantyType:'Battery 8 ปี/160k km' },
    { id:'WC004', plate:'4งจ-3456', model:'BYD Atto 3', vin:'...5566', issue:'ที่ปัดน้ำฝนไม่ทำงาน', parts:'Wiper Motor', laborHrs:1, partCost:3200, status:'reimbursed', submitted:wcAddDays(-30), warrantyType:'ทั่วไป 3 ปี' },
    { id:'WC005', plate:'5จฉ-7890', model:'BYD Han', vin:'...2233', issue:'ระบบเบรกเตือน error (ลูกค้าใช้ผิดวิธี)', parts:'—', laborHrs:0.5, partCost:0, status:'rejected', submitted:wcAddDays(-15), warrantyType:'ทั่วไป 3 ปี' },
  ]
  warrantyClaims.forEach(c => { if (!demoCol('warranty_claims')[c.id]) demoCol('warranty_claims')[c.id] = c })

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
  const washQueue = [
    { id:'W01', plate:'1กข-1234', model:'BYD Seal', service:'premium', status:'washing', startTime:wqAddMinutes(25), customer:'สมชาย ใจดี', staff:'ทีม A', isFree:false },
    { id:'W02', plate:'2ขค-5678', model:'BYD Dolphin', service:'basic', status:'waiting', startTime:null, customer:'มาลี สุขใจ', staff:null, isFree:true },
    { id:'W03', plate:'3คง-9012', model:'MG ZS EV', service:'detail', status:'washing', startTime:wqAddMinutes(120), customer:'ธนพล เที่ยงตรง', staff:'ทีม B', isFree:false },
    { id:'W04', plate:'4งจ-3456', model:'BYD Atto 3', service:'basic', status:'done', startTime:wqAddMinutes(90), customer:'อรทัย ตั้งใจ', staff:'ทีม A', isFree:true },
    { id:'W05', plate:'5จฉ-7890', model:'BYD Han', service:'coating', status:'waiting', startTime:null, customer:'วิรัช เก่งมาก', staff:null, isFree:false },
  ]
  washQueue.forEach(q => { if (!demoCol('wash_queue')[q.id]) demoCol('wash_queue')[q.id] = q })

  // API Keys (หน้า /settings/api-keys)
  const akAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const apiKeys = [
    { id:'K001', name:'LINE Webhook Integration', prefix:'lmm_live_a1b2', scope:'write', created:akAddDays(-90), lastUsed:akAddDays(0), requests30d:12420, active:true },
    { id:'K002', name:'Mobile App (Production)', prefix:'lmm_live_c3d4', scope:'write', created:akAddDays(-120), lastUsed:akAddDays(0), requests30d:89540, active:true },
    { id:'K003', name:'Accounting Sync (read)', prefix:'lmm_live_e5f6', scope:'read', created:akAddDays(-60), lastUsed:akAddDays(-2), requests30d:3200, active:true },
    { id:'K004', name:'Dev Testing', prefix:'lmm_test_g7h8', scope:'admin', created:akAddDays(-200), lastUsed:akAddDays(-45), requests30d:0, active:false },
  ]
  apiKeys.forEach(k => { if (!demoCol('api_keys')[k.id]) demoCol('api_keys')[k.id] = k })

  // System backups (หน้า /settings/backup)
  const brAddHours = n => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }
  const systemBackups = [
    { id:'BK001', type:'full', status:'success', size:'2.4 GB', duration:'18 นาที', time:brAddHours(1), note:'Auto backup' },
    { id:'BK002', type:'incremental', status:'success', size:'145 MB', duration:'3 นาที', time:brAddHours(13), note:'Auto backup' },
    { id:'BK003', type:'incremental', status:'success', size:'98 MB', duration:'2 นาที', time:brAddHours(25), note:'Auto backup' },
    { id:'BK004', type:'full', status:'failed', size:'—', duration:'—', time:brAddHours(49), note:'Error: disk quota exceeded' },
    { id:'BK005', type:'config', status:'success', size:'12 KB', duration:'< 1 นาที', time:brAddHours(73), note:'Manual — before upgrade' },
  ]
  systemBackups.forEach(b => { if (!demoCol('system_backups')[b.id]) demoCol('system_backups')[b.id] = b })

  // Branches + Company (หน้า /settings/branches)
  const settingsBranches = [
    { id:'B001', name:'สาขาหลัก — กรุงเทพ', code:'BKK-MAIN', address:'123/45 ถ.พระราม 9 เขตห้วยขวาง กทม.', phone:'02-123-4567', email:'bkk@lamomone.com', lat:13.7563, lng:100.5018, brands:['BYD','MG'], status:'active', manager:'สมชาย ใจดี', staff:12, isMain:true },
    { id:'B002', name:'สาขาชลบุรี', code:'CBI-001', address:'88/99 ถ.สุขุมวิท ชลบุรี', phone:'038-789-0123', email:'chon@lamomone.com', lat:13.3611, lng:100.9847, brands:['BYD'], status:'active', manager:'วิชัย เดินดี', staff:6, isMain:false },
    { id:'B003', name:'สาขาเชียงใหม่', code:'CNX-001', address:'99/1 ถ.นิมมานเหมินทร์ เชียงใหม่', phone:'053-456-7890', email:'cnx@lamomone.com', lat:18.7883, lng:98.9853, brands:['MG'], status:'planned', manager:'', staff:0, isMain:false },
  ]
  settingsBranches.forEach(b => { if (!demoCol('branches')[b.id]) demoCol('branches')[b.id] = b })

  const settingsCompanies = [
    { id:'CO001', name:'บริษัท ลามอม จำกัด', taxId:'0105567012345', address:'123/45 ถ.พระราม 9 กทม. 10310', phone:'02-123-4567', email:'info@lamomone.com', logo:null },
  ]
  settingsCompanies.forEach(c => { if (!demoCol('companies')[c.id]) demoCol('companies')[c.id] = c })

  // Digital signage (หน้า /settings/digital-signage)
  const signageSlides = [
    { id:'s001', type:'promo',   title:'BYD Seal AWD', desc:'ดาวน์พิเศษ เพียง 150,000 บาท', price:1699000, bg:'#1565C0', textColor:'#fff', duration:10, active:true  },
    { id:'s002', type:'model',   title:'BYD Atto 3',   desc:'ฟรีชาร์จเจอร์บ้าน 7.4kW มูลค่า 25,000 บาท', price:1099000, bg:'#00897B', textColor:'#fff', duration:8,  active:true  },
    { id:'s003', type:'service', title:'ศูนย์บริการ',   desc:'เช็คระยะฟรี เดือน มิ.ย. นี้ · นัดออนไลน์ได้', price:0, bg:'#FF8F00', textColor:'#fff', duration:7,  active:true  },
    { id:'s004', type:'queue',   title:'คิวบริการวันนี้', desc:'คิว 1-15 กำลังรับรถ · คิว 16-20 รอตรวจ', price:0, bg:'#4A148C', textColor:'#fff', duration:5,  active:false },
  ]
  signageSlides.forEach(s => { if (!demoCol('signage_slides')[s.id]) demoCol('signage_slides')[s.id] = s })

  const signageScreens = [
    { id:'sc01', name:'จอหน้าโชว์รูม', location:'ล็อบบี้', status:'online', currentSlide:'s001', resolution:'1920x1080' },
    { id:'sc02', name:'จอห้องรับรถ', location:'Service Bay', status:'online', currentSlide:'s003', resolution:'1920x1080' },
    { id:'sc03', name:'จอโต๊ะเจรจา', location:'ห้องประชุมลูกค้า', status:'offline', currentSlide:null, resolution:'1280x720' },
  ]
  signageScreens.forEach(s => { if (!demoCol('signage_screens')[s.id]) demoCol('signage_screens')[s.id] = s })

  // Holiday calendar (หน้า /settings/holidays)
  const HOL_YEAR = new Date().getFullYear()
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

  // Integration settings (หน้า /integrations/settings)
  const isNow = Date.now()
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

  // Security policies + sessions (หน้า /settings/security)
  const ssAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
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

  // Fleet quotes (หน้า /b2b/fleet-quote)
  const fqAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const fleetQuotes = [
    { id:'FQ001', company:'บริษัท ABC จำกัด', contact:'คุณประเสริฐ', units:15, model:'BYD Atto 3', unitPrice:1050000, discount:5, status:'negotiate', created:fqAddDays(-10), expiry:fqAddDays(20), note:'ต้องการรถสีขาว 10 คำ เทา 5 คัน' },
    { id:'FQ002', company:'ธนาคารแห่งชาติ', contact:'คุณศักดา', units:30, model:'BYD Dolphin', unitPrice:860000, discount:8, status:'approved', created:fqAddDays(-20), expiry:fqAddDays(10), note:'สัญญา 3 ปี พร้อมบริการซ่อม' },
    { id:'FQ003', company:'โรงพยาบาลกรุงเทพ', contact:'ฝ่ายจัดซื้อ', units:8, model:'BYD Seal AWD', unitPrice:1620000, discount:3, status:'sent', created:fqAddDays(-5), expiry:fqAddDays(25), note:'' },
    { id:'FQ004', company:'SCG Group', contact:'คุณวิชัย', units:50, model:'BYD Atto 3', unitPrice:1020000, discount:10, status:'draft', created:fqAddDays(-2), expiry:fqAddDays(28), note:'ต้องการ charging station ด้วย' },
  ]
  fleetQuotes.forEach(q => { if (!demoCol('fleet_quotes')[q.id]) demoCol('fleet_quotes')[q.id] = q })

  // B2B Partners (หน้า /b2b/partners)
  const ppAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const b2bPartners = [
    { id:'PRT001', name:'บ. Thai EV Leasing', type:'finance', status:'active', contact:'สมหมาย ผู้จัดการ', email:'partner@evlease.co.th', phone:'02-xxx-xxxx', commissionRate:1.5, totalLeads:42, closedDeals:28, revenue:44520000, joinDate:ppAddDays(-180) },
    { id:'PRT002', name:'บ. กรุงเทพประกันภัย', type:'insurance', status:'active', contact:'วิชัย ตัวแทน', email:'ev@bki.co.th', phone:'02-yyy-yyyy', commissionRate:8.0, totalLeads:85, closedDeals:71, revenue:2840000, joinDate:ppAddDays(-365) },
    { id:'PRT003', name:'EV Connect Thailand', type:'ev_infra', status:'active', contact:'ปทิตา CEO', email:'info@evconnect.th', phone:'081-xxx-xxxx', commissionRate:2.0, totalLeads:15, closedDeals:12, revenue:480000, joinDate:ppAddDays(-90) },
    { id:'PRT004', name:'รีวิวเวอร์ YT: TheEVGuruTH', type:'referral', status:'active', contact:'ธนา Youtuber', email:'theevguru@gmail.com', phone:'086-xxx-xxxx', commissionRate:3.0, totalLeads:28, closedDeals:8, revenue:1272000, joinDate:ppAddDays(-60) },
    { id:'PRT005', name:'บ. Fast Charge Plus', type:'ev_infra', status:'pending', contact:'ชัยวัฒน์ COO', email:'biz@fastcharge.th', phone:'089-xxx-xxxx', commissionRate:1.5, totalLeads:0, closedDeals:0, revenue:0, joinDate:ppAddDays(-7) },
  ]
  b2bPartners.forEach(p => { if (!demoCol('b2b_partners')[p.id]) demoCol('b2b_partners')[p.id] = p })

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
  const contractsDemo = [
    { id:'CTR001', title:'สัญญาซื้อขาย BYD Seal AWD', type:'sale', status:'active', party:'วิชัย มีโชค', value:1590000, startDate:ctrAddDays(-30), endDate:ctrAddDays(335), createdBy:'สมชาย เซลส์', signedDate:ctrAddDays(-28), tags:['EV','retail'] },
    { id:'CTR002', title:'สัญญาบำรุงรักษา MG ZS EV Fleet', type:'service', status:'active', party:'บริษัท ABC จำกัด', value:360000, startDate:ctrAddDays(-60), endDate:ctrAddDays(305), createdBy:'วิทยา บริการ', signedDate:ctrAddDays(-55), tags:['fleet','B2B'] },
    { id:'CTR003', title:'NDA กับ BYD Thailand', type:'nda', status:'signed', party:'BYD Thailand Co., Ltd.', value:0, startDate:ctrAddDays(-90), endDate:ctrAddDays(275), createdBy:'ทีมกฎหมาย', signedDate:ctrAddDays(-85), tags:['confidential'] },
    { id:'CTR004', title:'สัญญาซื้อขาย BYD Atto 3', type:'sale', status:'review', party:'อรวรรณ สาวสวย', value:1290000, startDate:ctrAddDays(0), endDate:ctrAddDays(30), createdBy:'ปทิตา เซลส์', signedDate:null, tags:['EV','retail'] },
    { id:'CTR005', title:'สัญญาเช่ารถยนต์ระยะยาว', type:'lease', status:'draft', party:'บริษัท XYZ จำกัด', value:720000, startDate:ctrAddDays(7), endDate:ctrAddDays(372), createdBy:'สมชาย เซลส์', signedDate:null, tags:['fleet','leasing'] },
    { id:'CTR006', title:'สัญญาซัพพลายเออร์ อะไหล่', type:'supplier', status:'active', party:'บ. อะไหล่ไทย จำกัด', value:240000, startDate:ctrAddDays(-180), endDate:ctrAddDays(185), createdBy:'หัวหน้าคลัง', signedDate:ctrAddDays(-175), tags:['parts','supply'] },
  ]
  contractsDemo.forEach(c => { if (!demoCol('contracts')[c.id]) demoCol('contracts')[c.id] = c })

  // Document Templates (หน้า /documents/templates)
  const dtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
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

  // Forms (หน้า /documents/form-builder)
  const formsDemo = [
    { id:'f001', name:'ฟอร์มจองรถ', desc:'ลูกค้าจองรถออนไลน์', fields:['ชื่อ-นามสกุล','เบอร์โทร','รุ่นที่สนใจ','วันนัดหมาย'], submissions:28, active:true },
    { id:'f002', name:'แบบสอบถามความพึงพอใจ', desc:'ประเมินหลังรับรถ', fields:['คะแนนโชว์รูม','คะแนนพนักงาน','คะแนนกระบวนการ','ข้อเสนอแนะ'], submissions:156, active:true },
    { id:'f003', name:'ฟอร์มรับรถเข้าซ่อม', desc:'ลูกค้าแจ้งอาการก่อนเข้าศูนย์', fields:['ทะเบียนรถ','อาการที่พบ','เลขไมล์','วันนัดเข้าซ่อม'], submissions:94, active:false },
  ]
  formsDemo.forEach(f => { if (!demoCol('forms')[f.id]) demoCol('forms')[f.id] = f })

  // Cashier Desk (หน้า /finance/cashier)
  const cdAddMinutes = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
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

  // Custom Vehicle Order — ระบบสั่งแต่งรถ (หน้า /dms/custom-orders)
  const coAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
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

  // Withholding Tax Certificates — ใบ 50 ทวิ (หน้า /finance/withholding-tax)
  const wtAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const withholdingTaxDemo = [
    { id:'WHT001', certNo:'WHT-2026-0001', payeeName:'บริษัท ออโต้ พาร์ท จก.', payeeTaxId:'0105561001234', payeeAddress:'123 ถ.สุขุมวิท กรุงเทพฯ', incomeType:'service', incomeTypeLabel:'ค่าจ้างทำของ/บริการ (มาตรา 40(8))', paymentDate:wtAddDays(-20), amountPaid:45000, taxRate:3, taxWithheld:1350, issuedBy:'สมศรี การเงิน' },
    { id:'WHT002', certNo:'WHT-2026-0002', payeeName:'คุณสมชาย ใจดี', payeeTaxId:'1103700123456', payeeAddress:'88 ถ.พระราม 4 กรุงเทพฯ', incomeType:'rent', incomeTypeLabel:'ค่าเช่าทรัพย์สิน (มาตรา 40(5))', paymentDate:wtAddDays(-15), amountPaid:25000, taxRate:5, taxWithheld:1250, issuedBy:'สมศรี การเงิน' },
    { id:'WHT003', certNo:'WHT-2026-0003', payeeName:'บจก. ไทยทำความสะอาด', payeeTaxId:'0105562009876', payeeAddress:'45 ถ.รัชดาภิเษก กรุงเทพฯ', incomeType:'service', incomeTypeLabel:'ค่าจ้างทำของ/บริการ (มาตรา 40(8))', paymentDate:wtAddDays(-8), amountPaid:24000, taxRate:3, taxWithheld:720, issuedBy:'สมศรี การเงิน' },
    { id:'WHT004', certNo:'WHT-2026-0004', payeeName:'ขนส่งไทยเซ็นทรัล', payeeTaxId:'0105563004567', payeeAddress:'99 ถ.บางนา-ตราด กรุงเทพฯ', incomeType:'transport', incomeTypeLabel:'ค่าขนส่ง', paymentDate:wtAddDays(-3), amountPaid:18000, taxRate:1, taxWithheld:180, issuedBy:'สมศรี การเงิน' },
  ]
  withholdingTaxDemo.forEach(c => { if (!demoCol('withholding_tax_certs')[c.id]) demoCol('withholding_tax_certs')[c.id] = c })

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

  // Team/Department Targets — เป้าหมายทีม/ฝ่าย + KPI (หน้า /hr/targets)
  const ttPeriod = new Date().toISOString().slice(0, 7)
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

  // Employee KPI Evaluations — ประเมินผลงานรายบุคคล (หน้า /hr/employee-kpi)
  const ekAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const employeeEvaluationsDemo = [
    { id:'EK001', staffId:'st2', periodType:'daily', periodValue:new Date().toISOString().slice(0,10), criteriaScores:{quality:85,quantity:80,punctual:95,attitude:90,initiative:75}, overallScore:85, strengths:'ปิดยอดขายได้ตามเป้าทุกวัน', improvements:'ควรติดตามลูกค้าหลังขายให้เร็วขึ้น', reviewer:'ผู้จัดการขาย', createdAt:ekAddDays(-1) },
    { id:'EK002', staffId:'st3', periodType:'weekly', periodValue:(() => { const d = new Date(); const jan1 = new Date(d.getFullYear(),0,1); const days = Math.floor((d-jan1)/86400000); const week = Math.ceil((days+jan1.getDay()+1)/7); return d.getFullYear()+'-W'+String(week).padStart(2,'0') })(), criteriaScores:{quality:70,quantity:65,punctual:80,attitude:75,initiative:60}, overallScore:70, strengths:'ขยัน ตั้งใจ', improvements:'ต้องพัฒนาเทคนิคปิดการขาย', reviewer:'ผู้จัดการขาย', createdAt:ekAddDays(-3) },
    { id:'EK003', staffId:'st4', periodType:'monthly', periodValue:new Date().toISOString().slice(0,7), criteriaScores:{quality:90,quantity:88,punctual:100,attitude:92,initiative:80}, overallScore:90, strengths:'งานซ่อมแม่นยำ รวดเร็ว ลูกค้าพึงพอใจสูง', improvements:'ทักษะ EV Battery ขั้นสูงต้องพัฒนาเพิ่ม', reviewer:'หัวหน้าช่าง', createdAt:ekAddDays(-5) },
    { id:'EK004', staffId:'st5', periodType:'monthly', periodValue:new Date().toISOString().slice(0,7), criteriaScores:{quality:55,quantity:50,punctual:60,attitude:65,initiative:45}, overallScore:55, strengths:'ตั้งใจเรียนรู้งานใหม่', improvements:'ความเร็วในการทำงานและความแม่นยำต้องพัฒนาอีกมาก อยู่ระหว่างทดลองงาน', reviewer:'หัวหน้าช่าง', createdAt:ekAddDays(-5) },
    { id:'EK005', staffId:'st2', periodType:'yearly', periodValue:String(new Date().getFullYear()), criteriaScores:{quality:88,quantity:85,punctual:92,attitude:90,initiative:82}, overallScore:87, strengths:'พนักงานขายดีเด่นประจำปี ยอดขายเกินเป้าต่อเนื่อง', improvements:'พัฒนาทักษะการขายลูกค้าองค์กร (B2B) เพิ่มเติม', reviewer:'ผู้บริหาร', createdAt:ekAddDays(-20) },
  ]
  employeeEvaluationsDemo.forEach(e => { if (!demoCol('employee_evaluations')[e.id]) demoCol('employee_evaluations')[e.id] = e })

  // EV Charging Stations (หน้า /dms/ev-station)
  const evStationsDemo = [
    { id:'EV01', name:'Charger A1 (โชว์รูมหน้า)', type:'DC Fast', power:'60 kW', status:'available', connectors:['CCS2','CHAdeMO'], rate:4, todaySessions:8, todayKwh:240, revenue:960 },
    { id:'EV02', name:'Charger A2 (โชว์รูมหน้า)', type:'DC Fast', power:'60 kW', status:'charging', connectors:['CCS2'], rate:4, todaySessions:6, todayKwh:198, revenue:792 },
    { id:'EV03', name:'Charger B1 (ที่จอดรถ)', type:'AC Level 2', power:'22 kW', status:'available', connectors:['Type2'], rate:4, todaySessions:4, todayKwh:88, revenue:352 },
    { id:'EV04', name:'Charger B2 (ที่จอดรถ)', type:'AC Level 2', power:'22 kW', status:'offline', connectors:['Type2'], rate:4, todaySessions:0, todayKwh:0, revenue:0 },
    { id:'EV05', name:'Charger C1 (บริการ)', type:'DC Fast', power:'120 kW', status:'charging', connectors:['CCS2','GB/T'], rate:0, todaySessions:12, todayKwh:480, revenue:0 },
  ]
  evStationsDemo.forEach(s => { if (!demoCol('ev_charging_stations')[s.id]) demoCol('ev_charging_stations')[s.id] = s })

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
  const billingRunsDemo = [
    { id:'BR001', runNo:'BR-2026-0001', customerName:'วิชัย เดินดี', invoiceIds:['D002'], totalAmount:1282930, submittedDate:brAddDays(-10), dueDate:brAddDays(5), status:'submitted' },
    { id:'BR002', runNo:'BR-2026-0002', customerName:'อนุชา รวยมาก', invoiceIds:['D005'], totalAmount:1122430, submittedDate:brAddDays(-30), dueDate:brAddDays(-15), status:'submitted' },
  ]
  billingRunsDemo.forEach(r => { if (!demoCol('billing_runs')[r.id]) demoCol('billing_runs')[r.id] = r })

  // Receipt Automation (หน้า /finance/receipt-auto)
  const autoReceiptsDemo = [
    { id:'AR001', number:'REC-2026-0541', customer:'สมชาย ใจดี', amount:1290000, type:'purchase', sent:true, channel:'email', date:'2026-06-14', status:'sent' },
    { id:'AR002', number:'REC-2026-0542', customer:'นภา สุขสม', amount:4500, type:'service', sent:true, channel:'line', date:'2026-06-14', status:'sent' },
    { id:'AR003', number:'REC-2026-0543', customer:'วิชัย ศรีดี', amount:8900, type:'service', sent:false, channel:'email', date:'2026-06-15', status:'pending' },
    { id:'AR004', number:'REC-2026-0544', customer:'กาญจนา ทอง', amount:15600, type:'insurance', sent:false, channel:'sms', date:'2026-06-15', status:'failed' },
    { id:'AR005', number:'REC-2026-0545', customer:'ประเสริฐ มั่น', amount:2100, type:'parts', sent:true, channel:'line', date:'2026-06-15', status:'sent' },
  ]
  autoReceiptsDemo.forEach(r => { if (!demoCol('auto_receipts')[r.id]) demoCol('auto_receipts')[r.id] = r })
  const autoSendRulesDemo = [
    { id:'ASR1', name:'รถใหม่ — ส่ง Email', trigger:'purchase', channel:'email', active:true },
    { id:'ASR2', name:'ซ่อม — ส่ง LINE', trigger:'service', channel:'line', active:true },
    { id:'ASR3', name:'ประกัน — ส่ง SMS', trigger:'insurance', channel:'sms', active:true },
    { id:'ASR4', name:'อะไหล่ — ส่ง LINE', trigger:'parts', channel:'line', active:false },
  ]
  autoSendRulesDemo.forEach(r => { if (!demoCol('auto_send_rules')[r.id]) demoCol('auto_send_rules')[r.id] = r })

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

  // Daily Missions (หน้า /gamification/missions)
  const dailyMissionsDemo = [
    { id:'D1', period:'daily', title:'บันทึก Follow-up 3 ราย', xp:50, icon:'📞', done:true, progress:3, target:3 },
    { id:'D2', period:'daily', title:'ส่งใบเสนอราคา 1 ใบ', xp:80, icon:'📄', done:true, progress:1, target:1 },
    { id:'D3', period:'daily', title:'อัปเดต Pipeline 5 ดีล', xp:60, icon:'📋', done:false, progress:3, target:5 },
    { id:'D4', period:'daily', title:'ตอบแชทลูกค้าภายใน 30 นาที', xp:40, icon:'💬', done:false, progress:2, target:3 },
    { id:'D5', period:'daily', title:'บันทึก Voice Note 1 ครั้ง', xp:30, icon:'🎙', done:false, progress:0, target:1 },
    { id:'W1', period:'weekly', title:'ปิดดีล 2 คันขึ้นไป', xp:500, icon:'🏆', done:false, progress:1, target:2 },
    { id:'W2', period:'weekly', title:'รับ NPS ≥ 4.5 จาก 3 ลูกค้า', xp:300, icon:'⭐', done:false, progress:2, target:3 },
    { id:'W3', period:'weekly', title:'เรียน Training ครบ 1 หลักสูตร', xp:200, icon:'📚', done:true, progress:1, target:1 },
    { id:'W4', period:'weekly', title:'ไม่มี Lead หลุด 7 วัน', xp:400, icon:'🎯', done:false, progress:5, target:7 },
  ]
  dailyMissionsDemo.forEach(m => { if (!demoCol('daily_missions')[m.id]) demoCol('daily_missions')[m.id] = m })

  // Webhook Builder (หน้า /integrations/webhooks)
  const webhooksDemo = [
    { id:'wh001', name:'LINE Notify – ยอดขาย', url:'https://notify-api.line.me/api/notify', events:['sale.created','sale.updated'], method:'POST', active:true, lastFired:'2026-06-14T09:32:00', fires:142, fails:0, secret:'sk_ln_xxxx' },
    { id:'wh002', name:'Google Sheets – Lead', url:'https://script.google.com/macros/s/xxxxx/exec', events:['lead.created','lead.converted'], method:'POST', active:true, lastFired:'2026-06-13T17:05:00', fires:67, fails:2, secret:'' },
    { id:'wh003', name:'Slack – บริการแจ้งเตือน', url:'https://hooks.slack.com/services/T00/B00/xxx', events:['service.completed'], method:'POST', active:false, lastFired:'2026-05-30T12:00:00', fires:23, fails:0, secret:'' },
  ]
  webhooksDemo.forEach(w => { if (!demoCol('webhooks')[w.id]) demoCol('webhooks')[w.id] = w })

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

  // Knowledge Base (หน้า /training/knowledge)
  const kbAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const kbArticlesDemo = [
    { id:'KB001', title:'สเปคเต็ม BYD Seal AWD + จุดขายเทียบคู่แข่ง', cat:'product', author:'ผจก.ขาย', views:234, helpful:41, updated:kbAddDays(-10), excerpt:'มอเตอร์คู่ 390kW, 0-100 ใน 3.8 วิ, แบต 82.56 kWh — จุดขายหลักเทียบ Tesla Model 3...' },
    { id:'KB002', title:'วิธีตอบเมื่อลูกค้าถาม "แบตเสื่อมไหม เปลี่ยนแพงไหม"', cat:'sales', author:'วิชัย ยอดขาย', views:189, helpful:38, updated:kbAddDays(-5), excerpt:'ใช้ข้อมูลจริง: รับประกันแบต 8 ปี/160,000 km + SOH เฉลี่ยหลัง 3 ปียังเกิน 88%...' },
    { id:'KB003', title:'SOP ทำงานกับระบบไฟแรงสูง (HV) — บังคับอ่าน', cat:'service', author:'วิทยา ช่างใหญ่', views:156, helpful:52, updated:kbAddDays(-30), excerpt:'ก่อนแตะระบบ HV ทุกครั้ง: ปิดระบบ → ถอด service plug → รอ 10 นาที → วัดไฟยืนยัน 0V...' },
    { id:'KB004', title:'วิธีสร้างใบเสนอราคาใน LAMOM ONE', cat:'system', author:'Admin', views:98, helpful:22, updated:kbAddDays(-15), excerpt:'ไปที่ การขาย → ใบเสนอราคา → เลือกลูกค้า → เลือกรุ่น/สี/ของแถม → ระบบคำนวณให้...' },
    { id:'KB005', title:'ระเบียบการลา + วิธียื่นในระบบ', cat:'policy', author:'HR', views:145, helpful:30, updated:kbAddDays(-60), excerpt:'ลาป่วยแจ้งก่อน 9:00 / ลากิจล่วงหน้า 3 วัน / ลาพักร้อนล่วงหน้า 7 วัน — ยื่นผ่าน HR → ลาพนักงาน...' },
    { id:'KB006', title:'Troubleshooting: ลูกค้าชาร์จไฟไม่เข้า เช็คอะไรบ้าง', cat:'service', author:'สุรชัย มือดี', views:121, helpful:35, updated:kbAddDays(-7), excerpt:'1) เช็คสาย/หัวชาร์จ 2) ดู error code บนจอ 3) ทดสอบกับตู้ชาร์จศูนย์ 4) อ่านค่า OBC...' },
  ]
  kbArticlesDemo.forEach(a => { if (!demoCol('kb_articles')[a.id]) demoCol('kb_articles')[a.id] = a })

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

  // Accessory Shop (หน้า /dms/accessories) — schema matches AccessoryShop.js exactly
  const accessories = [
    { id: 'AC001', name: 'Wallbox Charger 7kW + ติดตั้ง', cat: 'charging', price: 35000, cost: 24000, stock: 6, sold30: 8, popular: true },
    { id: 'AC002', name: 'สายชาร์จพกพา Type 2 (5m)', cat: 'charging', price: 8500, cost: 5200, stock: 12, sold30: 5, popular: false },
    { id: 'AC003', name: 'ฟิล์มกันรอย PPF เต็มคัน', cat: 'protect', price: 45000, cost: 28000, stock: 99, sold30: 4, popular: true },
    { id: 'AC004', name: 'ฟิล์มกรองแสง Ceramic เต็มคัน', cat: 'protect', price: 12000, cost: 6500, stock: 99, sold30: 11, popular: true },
    { id: 'AC005', name: 'พรมปูพื้น 5D เข้ารูป', cat: 'comfort', price: 3500, cost: 1800, stock: 24, sold30: 15, popular: true },
    { id: 'AC006', name: 'กล้องติดรถหน้า-หลัง 4K', cat: 'comfort', price: 6900, cost: 4100, stock: 9, sold30: 7, popular: false },
    { id: 'AC007', name: 'สปอยเลอร์หลัง Carbon', cat: 'exterior', price: 15000, cost: 9000, stock: 3, sold30: 2, popular: false },
    { id: 'AC008', name: 'ล้อแม็กซ์ 19" ชุด 4 วง', cat: 'exterior', price: 48000, cost: 32000, stock: 2, sold30: 1, popular: false },
  ]
  accessories.forEach(a => { if (!demoCol('accessories')[a.id]) demoCol('accessories')[a.id] = a })

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

  // Policy renewals (หน้า /insurance/policy) — แยกจาก insurance_policies (โครงสร้างข้อมูลคนละแบบ ใช้โดยหน้า /insurance)
  const policyRenewals = [
    { id:'POL001', plate:'กก 1234 กทม', customer:'คุณวรพจน์ สุขใจ', model:'BYD Atto 3', insurer:'วิริยะประกัน', type:'ชั้น 1', premium:28000, startDate:'2025-06-15', endDate:'2026-06-15', status:'expiring', sum:1549000 },
    { id:'POL002', plate:'บบ 5678 ชลบุรี', customer:'บริษัท ทรัพย์สิน จก.', model:'MG ZS EV', insurer:'เมืองไทยประกัน', type:'ชั้น 1', premium:32000, startDate:'2025-08-01', endDate:'2026-08-01', status:'active', sum:1099000 },
    { id:'POL003', plate:'คค 9012 นนทบุรี', customer:'คุณนภา ชื่นดี', model:'BYD Seal AWD', insurer:'AXA', type:'ชั้น 1', premium:35000, startDate:'2025-09-20', endDate:'2026-09-20', status:'active', sum:1399000 },
    { id:'POL004', plate:'งง 3456 ปทุม', customer:'คุณสมชาย ดีใจ', model:'BYD Dolphin', insurer:'ทิพยประกัน', type:'ชั้น 2+', premium:15000, startDate:'2025-06-01', endDate:'2026-06-01', status:'expired', sum:899000 },
    { id:'POL005', plate:'จจ 7890 สมุทรปราการ', customer:'คุณพรทิพย์ มั่นคง', model:'MG4 EV', insurer:'กรุงเทพประกัน', type:'ชั้น 1', premium:29000, startDate:'2026-01-15', endDate:'2027-01-15', status:'active', sum:1099000 },
    { id:'POL006', plate:'ฉฉ 2345 ระยอง', customer:'คุณวิชัย สุดยอด', model:'BYD Atto 3', insurer:'ไทยวิวัฒน์', type:'ชั้น 3+', premium:8000, startDate:'2025-12-01', endDate:'2026-12-01', status:'active', sum:1549000 },
  ]
  policyRenewals.forEach(p => { if (!demoCol('policy_renewals')[p.id]) demoCol('policy_renewals')[p.id] = p })

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

  // Reward store (หน้า /gamification/rewards) — ร้านแลกของรางวัลด้วยแต้มพนักงาน
  const gamificationRewards = [
    { id:'RW001', name:'บัตรกำนัล Central 1,000 บาท', cat:'cash', points:1000, stock:10, redeemed30:6, popular:true },
    { id:'RW002', name:'ลาพิเศษ 1 วัน (ไม่หักโควต้า)', cat:'time', points:2000, stock:99, redeemed30:4, popular:true },
    { id:'RW003', name:'หูฟัง Bluetooth', cat:'item', points:1500, stock:5, redeemed30:2, popular:false },
    { id:'RW004', name:'เลือกที่จอดรถ VIP 1 เดือน', cat:'perk', points:800, stock:2, redeemed30:2, popular:true },
    { id:'RW005', name:'บัตรน้ำมัน 500 บาท', cat:'cash', points:500, stock:20, redeemed30:8, popular:true },
    { id:'RW006', name:'Voucher ร้านอาหาร 2 ที่นั่ง', cat:'item', points:1200, stock:6, redeemed30:3, popular:false },
    { id:'RW007', name:'ออกก่อนเวลา 2 ชม. (ศุกร์)', cat:'time', points:600, stock:99, redeemed30:9, popular:true },
    { id:'RW008', name:'มื้อกลางวันกับ MD', cat:'perk', points:3000, stock:1, redeemed30:0, popular:false },
  ]
  gamificationRewards.forEach(r => { if (!demoCol('gamification_rewards')[r.id]) demoCol('gamification_rewards')[r.id] = r })

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

  // Gamification challenges (หน้า /gamification/challenges) — ภารกิจท้าทายทีม
  const now = new Date()
  const addDaysISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
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

  // Marketing campaigns (หน้า /marketing/campaigns)
  const marketingCampaigns = [
    { id:'C001', name:'BYD Seal Launch Sale มิ.ย.', type:'social', status:'active', budget:50000, spent:32000, reach:45200, clicks:1230, leads:87, sales:5, startDate:'2025-06-01', endDate:'2025-06-30', target:'EV Enthusiast 25-45', channels:['Facebook','TikTok'], note:'Boost ทุกวันจันทร์-ศุกร์' },
    { id:'C002', name:'LINE OA Broadcast – ลูกค้าเก่า', type:'line', status:'active', budget:5000, spent:4800, reach:3200, clicks:340, leads:28, sales:2, startDate:'2025-06-05', endDate:'2025-06-30', target:'ลูกค้าเก่าทุกคน', channels:['LINE OA'], note:'' },
    { id:'C003', name:'Mid-Year Sale Google Ads', type:'google', status:'planned', budget:80000, spent:0, reach:0, clicks:0, leads:0, sales:0, startDate:'2025-07-01', endDate:'2025-07-31', target:'Search: EV ราคา', channels:['Google Search','Google Display'], note:'ใช้ keyword EV ราคาถูก' },
    { id:'C004', name:'Motor Expo Thailand', type:'event', status:'ended', budget:200000, spent:185000, reach:12000, clicks:0, leads:245, sales:18, startDate:'2025-05-15', endDate:'2025-05-25', target:'งานแสดงรถ', channels:['Offline'], note:'บูธ B12 ฮอลล์ 3' },
    { id:'C005', name:'Email Newsletter มิ.ย.', type:'email', status:'draft', budget:2000, spent:0, reach:0, clicks:0, leads:0, sales:0, startDate:'2025-06-15', endDate:'2025-06-15', target:'รายชื่อ Email ทั้งหมด', channels:['Email'], note:'' },
  ]
  marketingCampaigns.forEach(c => { if (!demoCol('marketing_campaigns')[c.id]) demoCol('marketing_campaigns')[c.id] = c })

  // Content calendar (หน้า /marketing/content)
  const contentCalendar = [
    { id:'CT001', title:'รีวิว BYD Seal: ขับแล้วเป็นยังไง?', type:'reel', platforms:['facebook','instagram','tiktok'], status:'published', publishDate:addDaysISO(-3), author:'ทีมคอนเทนต์', tags:['review','byd','ev'], views:12400, likes:856, shares:123 },
    { id:'CT002', title:'5 เหตุผลที่ควรเปลี่ยนมาใช้ EV', type:'blog', platforms:['website','facebook'], status:'published', publishDate:addDaysISO(-7), author:'สมชาย Content', tags:['ev','education'], views:3280, likes:142, shares:89 },
    { id:'CT003', title:'โปรโมชันพิเศษเดือนนี้', type:'post', platforms:['facebook','instagram','line'], status:'scheduled', publishDate:addDaysISO(1), author:'ทีมการตลาด', tags:['promotion','sale'], views:0, likes:0, shares:0 },
    { id:'CT004', title:'Behind the Scene: การส่งมอบรถ', type:'story', platforms:['instagram','facebook'], status:'in_progress', publishDate:addDaysISO(3), author:'ทีมคอนเทนต์', tags:['delivery','story'], views:0, likes:0, shares:0 },
    { id:'CT005', title:'Newsletter: ข่าว EV ประจำเดือน', type:'email', platforms:['website'], status:'review', publishDate:addDaysISO(5), author:'สุดา Marketing', tags:['newsletter','monthly'], views:0, likes:0, shares:0 },
    { id:'CT006', title:'TikTok: ชาร์จรถไฟฟ้าแบบไหนคุ้มสุด?', type:'reel', platforms:['tiktok','youtube'], status:'planned', publishDate:addDaysISO(7), author:'ทีมคอนเทนต์', tags:['ev','tips','charging'], views:0, likes:0, shares:0 },
    { id:'CT007', title:'Google Ads: BYD Atto 3 Test Drive', type:'ads', platforms:['website'], status:'published', publishDate:addDaysISO(-14), author:'ปทิตา SEM', tags:['ads','testdrive'], views:28000, likes:0, shares:0 },
  ]
  contentCalendar.forEach(c => { if (!demoCol('content_calendar')[c.id]) demoCol('content_calendar')[c.id] = c })

  // Marketing platform reviews (หน้า /marketing/reviews) — คนละหน้ากับ /quality/satisfaction ด้านล่าง
  const daysAgoISO = n => new Date(Date.now() - n * 86400000).toISOString()
  const marketingReviews = [
    { id:'MR001', author:'สมชาย ใจดี', platform:'google', rating:5, text:'บริการดีมาก พนักงานเป็นมิตร ขอบคุณมากครับ', status:'pending', time:daysAgoISO(1), reply:'' },
    { id:'MR002', author:'มาลี สุขใจ', platform:'facebook', rating:4, text:'ชอบรถมากค่ะ แต่รอนานหน่อย', status:'replied', time:daysAgoISO(2), reply:'ขอบคุณมากค่ะ เราจะปรับปรุงเวลาบริการให้ดีขึ้น' },
    { id:'MR003', author:'ธนพล เที่ยงตรง', platform:'google', rating:3, text:'โชว์รูมสวย แต่ราคาค่อนข้างแพง', status:'pending', time:daysAgoISO(3), reply:'' },
    { id:'MR004', author:'อรทัย ตั้งใจ', platform:'tiktok', rating:5, text:'ประทับใจมากเลยค่ะ เซลส์ใจดีมาก แนะนำเลย!', status:'replied', time:daysAgoISO(4), reply:'ขอบคุณมากๆ เลยค่ะ 🙏' },
    { id:'MR005', author:'ไม่ระบุชื่อ', platform:'google', rating:1, text:'บริการแย่มาก รออยู่นานมากแต่ไม่มีใครสนใจ', status:'flagged', time:daysAgoISO(5), reply:'' },
    { id:'MR006', author:'วิชัย มาดี', platform:'internal', rating:5, text:'ซื้อรถคุ้มมาก battery ดี ขับสนุก ชาร์จง่าย', status:'replied', time:daysAgoISO(7), reply:'ขอบคุณครับ ยินดีดูแลตลอดนะครับ' },
  ]
  marketingReviews.forEach(r => { if (!demoCol('marketing_reviews')[r.id]) demoCol('marketing_reviews')[r.id] = r })

  // Digital showroom (หน้า /marketing/digital-showroom)
  const showroomCars = [
    { id:'DS001', model:'BYD Atto 3', badge:'EV', colors:['#1565c0','#212121','#f5f5f5','#c62828'], views360:true, video:true,  views:4820, leads:142, conv:2.9, featured:true  },
    { id:'DS002', model:'BYD Seal AWD', badge:'EV', colors:['#212121','#b0bec5','#1b5e20'],       views360:true, video:true,  views:3210, leads:98,  conv:3.1, featured:true  },
    { id:'DS003', model:'BYD Dolphin', badge:'EV', colors:['#f5f5f5','#1565c0','#e91e63'],        views360:true, video:false, views:2880, leads:76,  conv:2.6, featured:false },
    { id:'DS004', model:'BYD Han', badge:'EV', colors:['#212121','#1b5e20'],                      views360:false,video:true,  views:1640, leads:44,  conv:2.7, featured:false },
    { id:'DS005', model:'MG ZS EV', badge:'EV', colors:['#f5f5f5','#c62828','#9e9e9e'],           views360:true, video:true,  views:2100, leads:58,  conv:2.8, featured:false },
    { id:'DS006', model:'BYD Atto 3 Pro', badge:'NEW', colors:['#1565c0','#212121','#ffd600'],    views360:true, video:false, views:980,  leads:31,  conv:3.2, featured:true  },
  ]
  showroomCars.forEach(c => { if (!demoCol('digital_showroom')[c.id]) demoCol('digital_showroom')[c.id] = c })

  // Event check-in visitors (หน้า /marketing/event-checkin)
  const minutesAgoISO = n => new Date(Date.now() - n * 60000).toISOString()
  const eventVisitors = [
    { id:'EV001', name:'ประยุทธ์ สนใจ', phone:'081-111', model:'BYD Seal AWD', interest:'hot', staff:'วิชัย', time:minutesAgoISO(10), gift:true, testDrive:true },
    { id:'EV002', name:'สมหญิง ดูรถ', phone:'082-222', model:'BYD Dolphin', interest:'warm', staff:'สุดา', time:minutesAgoISO(35), gift:true, testDrive:false },
    { id:'EV003', name:'อนันต์ ผ่านมา', phone:'', model:'ยังไม่แน่ใจ', interest:'browse', staff:'ธนา', time:minutesAgoISO(50), gift:false, testDrive:false },
    { id:'EV004', name:'กานดา อยากได้', phone:'084-444', model:'BYD Atto 3', interest:'hot', staff:'วิชัย', time:minutesAgoISO(80), gift:true, testDrive:true },
    { id:'EV005', name:'วีระ เปรียบเทียบ', phone:'085-555', model:'MG4', interest:'warm', staff:'สุดา', time:minutesAgoISO(120), gift:true, testDrive:false },
  ]
  eventVisitors.forEach(v => { if (!demoCol('event_visitors')[v.id]) demoCol('event_visitors')[v.id] = v })

  // Marketing events (หน้า /marketing/events)
  const evAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const marketingEvents = [
    { id:'MEV001', title:'BYD Seal AWD Launch Party', type:'launch', status:'done', startDate:'2025-04-20', endDate:'2025-04-20', venue:'โชว์รูม LAMOM สาขาหลัก', budget:150000, spent:142000, attendees:85, leads:12, sales:3, description:'งาน Launch BYD Seal AWD รุ่นใหม่ มีการแสดง Performance ของรถ', tasks:['จัดเตรียมสถานที่ ✅','ติดต่อ Influencer 2 คน ✅','เตรียมอาหารเครื่องดื่ม ✅','นำเสนอราคาและโปรโมชัน ✅'] },
    { id:'MEV002', title:'EV Test Drive Weekend', type:'testdrive', status:'confirmed', startDate:evAddDays(5), endDate:evAddDays(6), venue:'ลานจอดรถ LAMOM ONE BKK', budget:80000, spent:35000, attendees:0, leads:0, sales:0, description:'เปิดโอกาสให้ลูกค้าทดลองขับรถ EV ทุกรุ่น', tasks:['จองพื้นที่ ✅','เตรียมรถสาธิต 5 คัน','ประกาศ Social Media','รับลงทะเบียน'] },
    { id:'MEV003', title:'Motor Expo 2025', type:'expo', status:'planning', startDate:'2025-11-28', endDate:'2025-12-09', venue:'Impact Arena เมืองทองธานี', budget:2000000, spent:500000, attendees:0, leads:0, sales:0, description:'เข้าร่วม Motor Expo 2025 บูธใหญ่ 200 ตร.ม.', tasks:['จองบูธ ✅','ออกแบบบูธ','สั่งซื้อสื่อ','เตรียมทีม 15 คน','วางแผนโปรโมชัน'] },
    { id:'MEV004', title:'VIP Customer Appreciation', type:'vip', status:'confirmed', startDate:evAddDays(20), endDate:evAddDays(20), venue:'โรงแรม Centara Grand', budget:200000, spent:80000, attendees:0, leads:0, sales:0, description:'งานเลี้ยงขอบคุณลูกค้า VIP ประจำปี 2025', tasks:['Book ห้องจัดงาน ✅','เตรียมของที่ระลึก','เชิญลูกค้า 50 ท่าน','เตรียมโปรโมชัน Renewal'] },
    { id:'MEV005', title:'EV Ownership Workshop', type:'workshop', status:'done', startDate:'2025-05-10', endDate:'2025-05-10', venue:'โชว์รูม LAMOM สาขาหลัก', budget:30000, spent:28500, attendees:25, leads:5, sales:1, description:'สอนการดูแลรักษารถ EV การชาร์จที่บ้าน และการใช้งาน', tasks:['เตรียมสไลด์ ✅','จัดเตรียมอาหาร ✅','เชิญวิทยากร ✅','ดำเนินการ ✅'] },
    { id:'MEV006', title:'Social Media Live: BYD กับชีวิตประจำวัน', type:'online', status:'done', startDate:'2025-03-15', endDate:'2025-03-15', venue:'Online / Facebook Live', budget:15000, spent:12000, attendees:320, leads:18, sales:2, description:'Live ขายรถผ่าน Facebook ร่วมกับ Influencer EV', tasks:['ประสาน Influencer ✅','เตรียมสคริปต์ ✅','Live 2 ชั่วโมง ✅','Follow up leads ✅'] },
  ]
  marketingEvents.forEach(e => { if (!demoCol('marketing_events')[e.id]) demoCol('marketing_events')[e.id] = e })

  // Lead generation campaigns (หน้า /marketing/lead-generation)
  const lgAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
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

  // LINE OA broadcasts + auto-replies (หน้า /marketing/line-oa)
  const loAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
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

  // Social Hub posts (หน้า /marketing/social-hub)
  const socialPosts = [
    { id:'P001', content:'🔥 BYD Seal AWD ราคาพิเศษ 1,299,000 บาท\n✅ ดอกเบี้ย 2.79% ผ่อน 20,420 บาท/เดือน\n📞 ติดต่อ: 02-123-4567\n#EV #BYD #LAMOMONE', platforms:['facebook','instagram'], status:'published', scheduledAt:'2025-06-05 09:00', publishedAt:'2025-06-05 09:01', likes:234, comments:18, shares:45, reach:12400, image:null },
    { id:'P002', content:'🎯 ทดลองขับฟรี MG4 X\n📅 10 มิ.ย. 2025 เวลา 10:00-17:00\n📍 โชว์รูม LAMOM ONE สาขาหลัก\n#TestDrive #MG4', platforms:['facebook','line','tiktok'], status:'scheduled', scheduledAt:'2025-06-09 08:00', publishedAt:null, likes:0, comments:0, shares:0, reach:0, image:null },
    { id:'P003', content:'💬 ขอบคุณรีวิวจาก คุณสมชาย ใจดี\n"ประทับใจมาก ทีมงานดูแลดีมาก"\n🚗 BYD Seal AWD\n#CustomerReview', platforms:['facebook','instagram'], status:'draft', scheduledAt:null, publishedAt:null, likes:0, comments:0, shares:0, reach:0, image:null },
    { id:'P004', content:'🥳 ยินดีต้อนรับสู่ครอบครัว EV!\nคุณวิชัย เดินดี รับรถ MG4 X สีดำ 🚗✨\n#NewCarDay #MG4 #LAMOMONE', platforms:['facebook','tiktok'], status:'published', scheduledAt:'2025-06-02 10:00', publishedAt:'2025-06-02 10:01', likes:567, comments:42, shares:88, reach:28900, image:null },
  ]
  socialPosts.forEach(p => { if (!demoCol('social_posts')[p.id]) demoCol('social_posts')[p.id] = p })

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

  const serviceBayQueue = [
    { id:'q1', job:'JC-2410', car:'MG4 · 4กค-1100', service:'เช็คระยะ 20,000', need:'ทั่วไป' },
    { id:'q2', job:'JC-2411', car:'BYD Atto 3 · 5ขข-2200', service:'เปลี่ยนยาง+ตั้งศูนย์', need:'ช่วงล่าง' },
    { id:'q3', job:'JC-2412', car:'BYD Seal · 6กก-3300', service:'อัปเดตซอฟต์แวร์', need:'EV' },
  ]
  serviceBayQueue.forEach(q => { if (!demoCol('service_bay_queue')[q.id]) demoCol('service_bay_queue')[q.id] = q })

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

  // Pickup & Delivery jobs (หน้า /service/pickup)
  const pdAddHours = n => { const d = new Date(); d.setHours(d.getHours() + n); return d.toISOString() }
  const courtesyCarJobs = [
    { id:'PD001', customer:'สมชาย ใจดี', phone:'085-111', plate:'1กข-1234', address:'คอนโด Ideo สุขุมวิท 93', distance:8, type:'both', status:'servicing', driver:'สมบัติ ขับดี', scheduledAt:pdAddHours(-3), service:'เช็คระยะ 20,000 km' },
    { id:'PD002', customer:'มาลี สุขใจ', phone:'086-222', plate:'2ขค-5678', address:'หมู่บ้านพฤกษา บางนา', distance:5, type:'pickup', status:'enroute', driver:'อนันต์ ปลอดภัย', scheduledAt:pdAddHours(0), service:'เปลี่ยนยาง 4 เส้น' },
    { id:'PD003', customer:'ธนพล เที่ยงตรง', phone:'087-333', plate:'3คง-9012', address:'ออฟฟิศ Empire Tower สาทร', distance:15, type:'delivery', status:'scheduled', driver:null, scheduledAt:pdAddHours(4), service:'ซ่อมเสร็จแล้ว — รอส่งคืน' },
    { id:'PD004', customer:'อรทัย ตั้งใจ', phone:'088-444', plate:'4งจ-3456', address:'บ้านเดี่ยว ลาดกระบัง', distance:12, type:'both', status:'completed', driver:'สมบัติ ขับดี', scheduledAt:pdAddHours(-26), service:'ตรวจแบตเตอรี่' },
  ]
  courtesyCarJobs.forEach(j => { if (!demoCol('courtesy_car_jobs')[j.id]) demoCol('courtesy_car_jobs')[j.id] = j })

  // EV Battery health (หน้า /service/ev-battery)
  const evAddDays2 = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const evBatteryVehicles = [
    { id:'V001', plate:'1กข-1234', model:'BYD Seal AWD', year:2023, owner:'สมชาย ใจดี', soh:94, soc:78, cycles:180, capacity:82.56, originalCapacity:87.9, lastCheck:evAddDays2(-30), range:498, nextCheck:evAddDays2(60) },
    { id:'V002', plate:'2ขค-5678', model:'BYD Dolphin', year:2022, owner:'มาลี สุขใจ', soh:87, soc:45, cycles:340, capacity:42.0, originalCapacity:44.9, lastCheck:evAddDays2(-15), range:310, nextCheck:evAddDays2(75) },
    { id:'V003', plate:'3คง-9012', model:'MG ZS EV', year:2021, owner:'ธนพล เที่ยงตรง', soh:74, soc:62, cycles:520, capacity:39.5, originalCapacity:50.3, lastCheck:evAddDays2(-7), range:268, nextCheck:evAddDays2(23) },
    { id:'V004', plate:'4งจ-3456', model:'BYD Atto 3', year:2023, owner:'อรทัย ตั้งใจ', soh:92, soc:91, cycles:90, capacity:58.7, originalCapacity:60.5, lastCheck:evAddDays2(-45), range:412, nextCheck:evAddDays2(15) },
    { id:'V005', plate:'5จฉ-7890', model:'BYD Han', year:2022, owner:'วิรัช เก่งมาก', soh:68, soc:33, cycles:680, capacity:64.6, originalCapacity:85.4, lastCheck:evAddDays2(-90), range:380, nextCheck:evAddDays2(-15) },
  ]
  evBatteryVehicles.forEach(v => { if (!demoCol('ev_battery_vehicles')[v.id]) demoCol('ev_battery_vehicles')[v.id] = v })

  // EV diagnostic scans (หน้า /service/ev-diagnostic)
  const evdAddMins = n => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }
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

  // Loaner car fleet + loans (หน้า /service/loaner)
  const loanerCars = [
    { id:'LC001', plate:'กท-9001 กทม.', model:'Toyota Yaris 2022', color:'ขาว', fuel:'เบนซิน', fuelLevel:80, km:45200, status:'available', note:'' },
    { id:'LC002', plate:'กท-9002 กทม.', model:'Honda City 2023', color:'เงิน', fuel:'เบนซิน', fuelLevel:60, km:32100, status:'loaned', loanedTo:'สมชาย ใจดี', loanDate:'2025-06-07', returnDate:'2025-06-10', note:'คืนด้วยน้ำมันเต็มถัง' },
    { id:'LC003', plate:'กท-9003 กทม.', model:'Isuzu D-Max 2021', color:'เทา', fuel:'ดีเซล', fuelLevel:40, km:68900, status:'service', note:'เช็กระยะตามกำหนด' },
    { id:'LC004', plate:'กท-9004 กทม.', model:'Toyota Yaris 2023', color:'ดำ', fuel:'เบนซิน', fuelLevel:100, km:12000, status:'cleaning', note:'' },
  ]
  loanerCars.forEach(c => { if (!demoCol('loaner_cars')[c.id]) demoCol('loaner_cars')[c.id] = c })

  const loanerLoans = [
    { id:'LL001', carId:'LC002', carPlate:'กท-9002 กทม.', carModel:'Honda City 2023', custName:'สมชาย ใจดี', phone:'0812345678', jobCard:'JOB-2025-001', loanDate:'2025-06-07', returnDate:'2025-06-10', actualReturn:null, fuelOut:60, fuelIn:null, kmOut:32100, kmIn:null, status:'active', deposit:5000 },
    { id:'LL002', carId:'LC001', carPlate:'กท-9001 กทม.', carModel:'Toyota Yaris 2022', custName:'วิชัย เดินดี', phone:'0834567890', jobCard:'JOB-2025-002', loanDate:'2025-06-01', returnDate:'2025-06-05', actualReturn:'2025-06-05', fuelOut:80, fuelIn:75, kmOut:44800, kmIn:45200, status:'returned', deposit:5000 },
  ]
  loanerLoans.forEach(l => { if (!demoCol('loaner_loans')[l.id]) demoCol('loaner_loans')[l.id] = l })

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
  const roadsideCases = [
    { id:'RA001', customer:'สมชาย ใจดี', phone:'085-111', plate:'1กข-1234', model:'BYD Seal', type:'out_of_charge', location:'มอเตอร์เวย์ กม.32 ขาออก', status:'dispatched', reported:raAddMinutes(18), team:'ทีมกู้ภัย A (มีตู้ชาร์จเคลื่อนที่)', eta:15 },
    { id:'RA002', customer:'มาลี สุขใจ', phone:'086-222', plate:'2ขค-5678', model:'BYD Dolphin', type:'flat_tire', location:'ห้าง Mega บางนา ลานจอด B2', status:'onsite', reported:raAddMinutes(45), team:'ทีมกู้ภัย B', eta:0 },
    { id:'RA003', customer:'วิรัช เก่งมาก', phone:'089-555', plate:'5จฉ-7890', model:'BYD Han', type:'battery_dead', location:'บ้านลูกค้า ซ.ลาซาล 24', status:'resolved', reported:raAddMinutes(150), team:'ทีมกู้ภัย A', eta:0 },
    { id:'RA004', customer:'ธนพล เที่ยงตรง', phone:'087-333', plate:'3คง-9012', model:'MG ZS EV', type:'accident', location:'แยกบางนา — ชนท้าย', status:'towing', reported:raAddMinutes(90), team:'รถลาก + ประสานประกัน', eta:20 },
  ]
  roadsideCases.forEach(c => { if (!demoCol('roadside_cases')[c.id]) demoCol('roadside_cases')[c.id] = c })

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

  const addDaysFullISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString() }
  const pdpaDsrRequests = [
    { id:'DSR01', customer:'วิรัช เก่งมาก', type:'ขอสำเนาข้อมูล', status:'pending', received:addDaysFullISO(-2), deadline:addDaysFullISO(28) },
    { id:'DSR02', customer:'ชาตรี เข้มแข็ง', type:'ขอลบข้อมูล', status:'processing', received:addDaysFullISO(-10), deadline:addDaysFullISO(20) },
    { id:'DSR03', customer:'นภา ห่างหาย', type:'ถอนความยินยอมการตลาด', status:'done', received:addDaysFullISO(-40), deadline:addDaysFullISO(-10) },
  ]
  pdpaDsrRequests.forEach(r => { if (!demoCol('pdpa_dsr_requests')[r.id]) demoCol('pdpa_dsr_requests')[r.id] = r })

  // Insurance claims (หน้า /insurance/claims)
  const insuranceClaims = [
    { id:'CLM001', customer:'สมชาย ใจดี', plate:'1กข-1234', model:'BYD Seal', type:'collision', insurer:'วิริยะประกันภัย', status:'repairing', estimate:45000, approved:42000, reported:addDaysISO(-10), note:'ชนท้ายที่แยกอโศก คู่กรณีรับผิด' },
    { id:'CLM002', customer:'มาลี สุขใจ', plate:'2ขค-5678', model:'BYD Dolphin', type:'glass', insurer:'กรุงเทพประกันภัย', status:'completed', estimate:12000, approved:12000, reported:addDaysISO(-25), note:'กระจกหน้าร้าวจากหินกระเด็น' },
    { id:'CLM003', customer:'ธนพล เที่ยงตรง', plate:'3คง-9012', model:'MG ZS EV', type:'object', insurer:'ทิพยประกันภัย', status:'surveying', estimate:28000, approved:0, reported:addDaysISO(-3), note:'เฉี่ยวเสาในลานจอด' },
    { id:'CLM004', customer:'อรทัย ตั้งใจ', plate:'4งจ-3456', model:'BYD Atto 3', type:'flood', insurer:'วิริยะประกันภัย', status:'reported', estimate:0, approved:0, reported:addDaysISO(-1), note:'น้ำท่วมถึงพื้นรถ รอสำรวจ' },
    { id:'CLM005', customer:'วิรัช เก่งมาก', plate:'5จฉ-7890', model:'BYD Han', type:'collision', insurer:'เมืองไทยประกันภัย', status:'rejected', estimate:95000, approved:0, reported:addDaysISO(-30), note:'เมาแล้วขับ — ประกันไม่คุ้มครอง' },
  ]
  insuranceClaims.forEach(c => { if (!demoCol('insurance_claims')[c.id]) demoCol('insurance_claims')[c.id] = c })

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

  // Insurance renewals (หน้า /insurance/renewal) — แยกจาก insurance_policies/policy_renewals (โครงสร้างข้อมูลคนละแบบ)
  const insuranceRenewals = [
    { id:'INS001', customerId:'C001', customerName:'วิชาญ มีโชค', phone:'081-234-5678',
      vehiclePlate:'กก 1234', vehicleModel:'BYD Seal AWD', vehicleYear:2024,
      insurer:'เมืองไทยประกันภัย', policyNo:'MTI-2024-123456', type:'class1',
      premium:28500, coverAmount:1449000, expiryDate:addDaysISO(30),
      startDate:addDaysISO(-335), status:'upcoming', lastRenewedDate:addDaysISO(-335), salesperson:'อรนุช สายใจ',
      notes:'ลูกค้าสนใจต่อกับ insurer เดิม' },
    { id:'INS002', customerId:'C002', customerName:'อรนุช สาวสวย', phone:'082-345-6789',
      vehiclePlate:'ขข 5678', vehicleModel:'MG ZS EV', vehicleYear:2024,
      insurer:'กรุงเทพประกันภัย', policyNo:'BKK-2024-789012', type:'class1',
      premium:22000, coverAmount:1059000, expiryDate:addDaysISO(-5),
      startDate:addDaysISO(-370), status:'expired', lastRenewedDate:addDaysISO(-370), salesperson:'วิชาญ มีโชค',
      notes:'ต้องรีบต่อด่วน' },
    { id:'INS003', customerId:'C003', customerName:'ธีรยุทธ เก่งกาจ', phone:'083-456-7890',
      vehiclePlate:'คค 9012', vehicleModel:'BYD Atto 3', vehicleYear:2024,
      insurer:'วิริยะประกันภัย', policyNo:'VIR-2024-345678', type:'class2plus',
      premium:15800, coverAmount:1099000, expiryDate:addDaysISO(65),
      startDate:addDaysISO(-300), status:'upcoming', lastRenewedDate:addDaysISO(-300), salesperson:'อรนุช สายใจ',
      notes:'' },
    { id:'INS004', customerId:'C004', customerName:'สมใจ รักรถ', phone:'084-567-8901',
      vehiclePlate:'งง 3456', vehicleModel:'BYD Seal SR', vehicleYear:2024,
      insurer:'ทิพยประกันภัย', policyNo:'TIP-2024-567890', type:'class1',
      premium:26000, coverAmount:1199000, expiryDate:addDaysISO(180),
      startDate:addDaysISO(-185), status:'renewed', lastRenewedDate:addDaysISO(-185), salesperson:'อรนุช สายใจ',
      notes:'' },
  ]
  insuranceRenewals.forEach(p => { if (!demoCol('insurance_renewals')[p.id]) demoCol('insurance_renewals')[p.id] = p })

  // NCB policies (หน้า /insurance/ncb)
  const ncbPolicies = [
    { id:'POL-001', customer:'คุณอนันต์ รักดี', plate:'กข-1234', model:'BYD Atto 3', insurer:'กรุงเทพประกันภัย', renewDate:'2026-08-01', ncbYears:3, basePremium:18500, claimed:false },
    { id:'POL-002', customer:'คุณมาลี วงศ์ดี', plate:'1กก-5678', model:'MG ZS EV', insurer:'เมืองไทยประกันภัย', renewDate:'2026-07-15', ncbYears:0, basePremium:14200, claimed:true },
    { id:'POL-003', customer:'คุณวีระ สมบัติ', plate:'2ขข-9999', model:'BYD Seal AWD', insurer:'วิริยะประกันภัย', renewDate:'2026-09-30', ncbYears:5, basePremium:22000, claimed:false },
    { id:'POL-004', customer:'คุณสุดา ใจดี', plate:'3กค-1111', model:'BYD Dolphin', insurer:'อาคเนย์ประกันภัย', renewDate:'2026-06-25', ncbYears:2, basePremium:12800, claimed:false },
  ]
  ncbPolicies.forEach(p => { if (!demoCol('ncb_policies')[p.id]) demoCol('ncb_policies')[p.id] = p })

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
  onboardingStaff.forEach(s => { if (!demoCol('onboarding_staff')[s.id]) demoCol('onboarding_staff')[s.id] = s })

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

  const recruitmentApplicants = [
    { id:'AP001', jobId:'JB001', name:'สมศักดิ์ ใจดี', phone:'081-234-5678', email:'somsak@mail.com', appliedDate:'2026-05-10', status:'interview1', score:78, note:'มีประสบการณ์ขายรถ Honda 2 ปี', resumeUrl:'#' },
    { id:'AP002', jobId:'JB001', name:'สาวิตรี มีทาง', phone:'082-345-6789', email:'sawit@mail.com', appliedDate:'2026-05-12', status:'screening', score:65, note:'จบสาขาการตลาด', resumeUrl:'#' },
    { id:'AP003', jobId:'JB001', name:'อาทิตย์ รักงาน', phone:'083-456-7890', email:'adit@mail.com', appliedDate:'2026-05-15', status:'offer', score:88, note:'ขายรถ Toyota 3 ปี เป้าหมาย top 10%', resumeUrl:'#' },
    { id:'AP004', jobId:'JB002', name:'วรรณา สุขใจ', phone:'084-567-8901', email:'wanna@mail.com', appliedDate:'2026-05-20', status:'new', score:null, note:'', resumeUrl:'#' },
    { id:'AP005', jobId:'JB002', name:'ณัฐพล เก่งกาจ', phone:'085-678-9012', email:'nattapon@mail.com', appliedDate:'2026-05-18', status:'interview1', score:72, note:'มีประสบการณ์ SA Honda 1.5 ปี', resumeUrl:'#' },
    { id:'AP006', jobId:'JB003', name:'ปิยะ โซเชียล', phone:'086-789-0123', email:'piya@mail.com', appliedDate:'2026-04-15', status:'rejected', score:40, note:'ไม่มีประสบการณ์ Paid Ads', resumeUrl:'#' },
  ]
  recruitmentApplicants.forEach(a => { if (!demoCol('recruitment_applicants')[a.id]) demoCol('recruitment_applicants')[a.id] = a })

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

  // Refund requests (หน้า /finance/refund — คำขอคืนเงินทั่วไป นอกเหนือจากคืนเงินจองที่ลิงค์จากใบจอง)
  const refundRequests = [
    { id:'RF001', customer:'สุดา ภักดี', type:'คืนส่วนเกิน', amount:8500, reason:'จ่ายเกิน ค่าซ่อม', status:'pending', date:addDaysISO(-2), approvedBy:'', txDate:'' },
    { id:'RF002', customer:'พิมพ์ สวัสดี', type:'คืนมัดจำป้ายแดง', amount:3000, reason:'คืนป้ายแดงหลังได้ป้ายขาว', status:'approved', date:addDaysISO(-4), approvedBy:'ผู้จัดการ A', txDate:'' },
    { id:'RF003', customer:'สมชาย ใจดี', type:'คืนส่วนเกิน', amount:12000, reason:'คำนวณค่าซ่อมผิด', status:'transferred', date:addDaysISO(-8), approvedBy:'ผู้จัดการ B', txDate:addDaysISO(-6) },
  ]
  refundRequests.forEach(r => { if (!demoCol('refund_requests')[r.id]) demoCol('refund_requests')[r.id] = r })

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
    { id: 'M001', brand: 'BYD', model: 'BYD Dolphin', type: 'EV', basePrice: 699000, promotionPrice: 679000, range: 340, battery: 44.9, power: 70, color: '#8b5cf6', colors: ['ขาว','ฟ้า','เขียว','ส้ม'], active: true, stock: 12 },
    { id: 'M002', brand: 'BYD', model: 'BYD Atto 3', type: 'EV', basePrice: 1099000, promotionPrice: 1069000, range: 420, battery: 60.5, power: 150, color: '#3b82f6', colors: ['ขาว','ดำ','ฟ้า','แดง'], active: true, stock: 8 },
    { id: 'M003', brand: 'BYD', model: 'BYD Seal AWD', type: 'EV', basePrice: 1499000, promotionPrice: null, range: 520, battery: 82.5, power: 390, color: '#10b981', colors: ['ขาว','ดำ','เทา'], active: true, stock: 5 },
    { id: 'M004', brand: 'BYD', model: 'BYD Han EV', type: 'EV', basePrice: 1999000, promotionPrice: null, range: 560, battery: 85.4, power: 380, color: '#f59e0b', colors: ['ดำ','ขาว'], active: true, stock: 2 },
    { id: 'M005', brand: 'MG', model: 'MG ZS EV', type: 'EV', basePrice: 879000, promotionPrice: 849000, range: 350, battery: 50.3, power: 115, color: '#ef4444', colors: ['ขาว','แดง','ดำ','น้ำเงิน'], active: true, stock: 15 },
    { id: 'M006', brand: 'MG', model: 'MG EP', type: 'PHEV', basePrice: 749000, promotionPrice: null, range: 60, battery: 17.0, power: 130, color: '#06b6d4', colors: ['ขาว','ดำ'], active: true, stock: 6 },
    { id: 'M007', brand: 'Neta', model: 'Neta V', type: 'EV', basePrice: 549000, promotionPrice: 529000, range: 280, battery: 38.5, power: 55, color: '#ec4899', colors: ['ขาว','แดง','เขียว'], active: false, stock: 0 },
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

  // Consignment Vehicles (หน้า /dms/consignment) — schema matches ConsignmentVehicle.js exactly
  const consignments = [
    { id: 'CS-001', owner: 'คุณสมศักดิ์', phone: '081-234-5678', model: 'BYD Atto 3 (2023)', plate: 'กข-1122', ask: 850000, floor: 800000, commPct: 5, start: '2026-05-10', status: 'selling' },
    { id: 'CS-002', owner: 'คุณวันดี', phone: '089-555-7788', model: 'MG ZS EV (2022)', plate: '1กก-3344', ask: 620000, floor: 590000, commPct: 5, start: '2026-04-22', status: 'selling' },
    { id: 'CS-003', owner: 'บ.รุ่งเรือง', phone: '02-111-2222', model: 'BYD Seal (2023)', plate: 'ขค-9090', ask: 1450000, floor: 1380000, commPct: 4, start: '2026-03-15', status: 'sold', soldAt: 1420000 },
  ]
  consignments.forEach(c => { if (!demoCol('consignments')[c.id]) demoCol('consignments')[c.id] = c })

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

  // CRM Test Drive records (distinct from DMS test_drives — different schema, own collection)
  const tdrAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
  const testDriveRecords = [
    { id:'TD001', custName:'สมศักดิ์ เจริญสุข', phone:'081-234-5678', vehicle:'BYD Seal AWD (ขาว)', staff:'อรนุช สายใจ', date:tdrAddDays(0), time:'10:00', status:'done', result:'booked', note:'ลูกค้าชอบมาก ขับสนุก จองเลย!', km:0, duration:45 },
    { id:'TD002', custName:'วิภา ดอกไม้', phone:'089-876-5432', vehicle:'MG4 X (แดง)', staff:'วิชาญ มีโชค', date:tdrAddDays(0), time:'14:00', status:'scheduled', result:null, note:'', km:0, duration:30 },
    { id:'TD003', custName:'นายสุรชัย พลศักดิ์', phone:'062-345-6789', vehicle:'DEEPAL S7 (ดำ)', staff:'อรนุช สายใจ', date:tdrAddDays(1), time:'11:00', status:'scheduled', result:null, note:'', km:0, duration:45 },
    { id:'TD004', custName:'ดวงพร สายรุ้ง', phone:'090-111-2222', vehicle:'BYD Atto 3 (เงิน)', staff:'น.ส.ปวีณา', date:tdrAddDays(-2), time:'10:00', status:'done', result:'maybe', note:'ยังลังเล เรื่องราคา', km:12, duration:40 },
    { id:'TD005', custName:'ณัฐวุฒิ หาญกล้า', phone:'083-222-3333', vehicle:'NETA V II (น้ำเงิน)', staff:'วิชาญ มีโชค', date:tdrAddDays(-3), time:'15:00', status:'noshow', result:null, note:'โทรไม่รับ', km:0, duration:0 },
  ]
  testDriveRecords.forEach(t => { if (!demoCol('test_drive_records')[t.id]) demoCol('test_drive_records')[t.id] = t })

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

  // ── DMS: Finance / Compliance ──
  const bankTransactions = [
    { id:'bt1', txDate:'2025-06-25', bank:'กสิกรไทย', account:'xxx-x-xxx01', ref:'BK250625001', type:'deposit', amount:1299000, custName:'ธีรพงศ์ แสงทอง', note:'ค่ารถ BYD Seal', matched:true, bookingRef:'BK-001', createdAt:'2025-06-25' },
    { id:'bt2', txDate:'2025-06-26', bank:'ไทยพาณิชย์', account:'xxx-x-xxx02', ref:'BK250626001', type:'deposit', amount:50000, custName:'สุภาพร ใจดี', note:'มัดจำ BYD Atto 3', matched:false, bookingRef:'', createdAt:'2025-06-26' },
    { id:'bt3', txDate:'2025-06-27', bank:'กรุงเทพ', account:'xxx-x-xxx03', ref:'BK250627001', type:'transfer_in', amount:1099000, custName:'บริษัท ไทยลิสซิ่ง จำกัด', note:'ค่าเช่าซื้อ Atto 3', matched:true, bookingRef:'BK-002', createdAt:'2025-06-27' },
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

  // Walk-ins (Showroom walk-in traffic log)
  const walkIns = [
    { id:'wi1', name:'สมศักดิ์ เที่ยวดี', phone:'0811110001', interestedIn:'BYD Seal', staff:'อรนุช เซลส์ดี', visitTime: new Date(Date.now()-3600000*2).toISOString(), source:'ผ่านมาเอง', notes:'สนใจสีขาว งบ 1.3M', status:'interested' },
    { id:'wi2', name:'กนกวรรณ สวยงาม', phone:'0822220002', interestedIn:'MG4', staff:'วิชัย ขายเก่ง', visitTime: new Date(Date.now()-86400000).toISOString(), source:'Google Maps', notes:'ดูรุ่นที่ต่ำกว่า 1M', status:'cold' },
    { id:'wi3', name:'ประยุทธ์ ทำงานดี', phone:'0833330003', interestedIn:'NETA V II', staff:'อรนุช เซลส์ดี', visitTime: new Date(Date.now()-86400000*2).toISOString(), source:'Facebook Ad', notes:'', status:'testdrive' },
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

  // Referral program
  const refAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
  const referrals = [
    { id: 'REF001', referrer: 'วิชัย มีโชค', referrerPhone: '085-xxx', referee: 'สมหมาย ดีใจ', refereePhone: '088-xxx', model: 'BYD Seal AWD', status: 'paid', reward: 3000, submitDate: refAddDays(-30) },
    { id: 'REF002', referrer: 'สุดา อารมณ์ดี', referrerPhone: '086-xxx', referee: 'มานี สุขใจ', refereePhone: '089-xxx', model: 'BYD Atto 3', status: 'qualified', reward: 3000, submitDate: refAddDays(-15) },
    { id: 'REF003', referrer: 'วิชัย มีโชค', referrerPhone: '085-xxx', referee: 'บุญมา ยิ้มแย้ม', refereePhone: '090-xxx', model: 'MG ZS EV', status: 'qualified', reward: 3000, submitDate: refAddDays(-8) },
    { id: 'REF004', referrer: 'ธนา เก่งกว่า', referrerPhone: '087-xxx', referee: 'ชัย ซื้อรถใหม่', refereePhone: '091-xxx', model: 'BYD Dolphin', status: 'pending', reward: 2500, submitDate: refAddDays(-3) },
    { id: 'REF005', referrer: 'สุดา อารมณ์ดี', referrerPhone: '086-xxx', referee: 'อรวรรณ คิดนาน', refereePhone: '092-xxx', model: 'BYD Seal AWD', status: 'rejected', reward: 0, submitDate: refAddDays(-20) },
  ]
  referrals.forEach(r => { if (!demoCol('referrals')[r.id]) demoCol('referrals')[r.id] = r })

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
    { id:'pc1', type:'out', cat:'refresh', amount:850, desc:'ซื้อกาแฟ-น้ำดื่มสำหรับโชว์รูม', by:'อรนุช เซลส์ดี', time: new Date(Date.now()-3600000*3).toISOString(), receipt:true, status:'approved' },
    { id:'pc2', type:'out', cat:'supplies', amount:1200, desc:'ค่าน้ำยาทำความสะอาดรถ', by:'สมชาย ช่างดี', time: new Date(Date.now()-86400000).toISOString(), receipt:true, status:'approved' },
    { id:'pc3', type:'in', cat:'other', amount:5000, desc:'เติมเงินสดย่อย ประจำสัปดาห์', by:'ทวีศักดิ์ สุขสมบัติเสถียร', time: new Date(Date.now()-86400000*2).toISOString(), receipt:false, status:'approved' },
    { id:'pc4', type:'out', cat:'transport', amount:450, desc:'ค่าน้ำมันรถส่งเอกสาร', by:'วิชัย ขายเก่ง', time: new Date(Date.now()-86400000*3).toISOString(), receipt:true, status:'approved' },
    { id:'pc5', type:'out', cat:'repair', amount:600, desc:'ซ่อมประตูห้องน้ำพนักงาน', by:'มานะ ขยัน', time: new Date(Date.now()-3600000*5).toISOString(), receipt:false, status:'pending' },
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
    { id: 'FL-001', company: 'บ.รุ่งเรือง จำกัด', contact: 'คุณสมชาย', phone: '089-111-2222', units: 5, model: 'BYD Atto 3 Pro', unitPrice: 1299000, discount: 3, status: 'negotiation', delivery: '2026-09-30', sales: 'นิภา', notes: 'ต้องการสีดำทั้งหมด ผ่อนบริษัท 60 งวด' },
    { id: 'FL-002', company: 'โรงพยาบาลสุขใจ', contact: 'คุณวิไล', phone: '02-222-3333', units: 3, model: 'BYD Seal', unitPrice: 1550000, discount: 2.5, status: 'proposal', delivery: '2026-10-15', sales: 'วิชัย', notes: 'รถผู้บริหาร สีขาว' },
    { id: 'FL-003', company: 'บ.สร้างดี จำกัด', contact: 'คุณอนุชา', phone: '081-333-4444', units: 10, model: 'BYD Dolphin', unitPrice: 899000, discount: 5, status: 'won', delivery: '2026-07-01', sales: 'สมชาย', notes: 'แล้วเสร็จ ส่งมอบ Q3' },
    { id: 'FL-004', company: 'หน่วยงานราชการ ก.', contact: 'คุณประเสริฐ', phone: '02-444-5555', units: 8, model: 'BYD Atto 3', unitPrice: 1099000, discount: 4, status: 'prospect', delivery: '', sales: 'มาลี', notes: 'งบประมาณปี 2027 รอกระบวนการจัดซื้อ' },
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
