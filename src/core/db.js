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
