// (v1.0.541) เติมข้อมูลสมมติลง Firebase Emulator (local เท่านั้น) สำหรับทดสอบทุกหน้าแบบมีข้อมูล
// ใช้ผ่าน `npm run dev:emulator` — ไม่แตะฐานข้อมูลจริงเด็ดขาด (ปฏิเสธการทำงานถ้าไม่มี FIRESTORE_EMULATOR_HOST)
// ชื่อ/เบอร์/VIN ทั้งหมดเป็นข้อมูลสมมติ
const FS = process.env.FIRESTORE_EMULATOR_HOST
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-lamom'
if (!FS) { console.error('emulator-seed: FIRESTORE_EMULATOR_HOST not set — refusing to run outside the emulator'); process.exit(1) }

export const TEST_LOGIN = { email: 'ghunt1007@gmail.com', password: 'emulator-only-test-1234' } // บัญชีบน emulator เท่านั้น
const BASE = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

function enc(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, w]) => [k, enc(w)])) } }
  return { stringValue: String(v) }
}
async function put(col, id, data) {
  const r = await fetch(`${BASE}/${col}/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: enc(data).mapValue.fields }) })
  if (!r.ok) throw new Error(`${col}/${id}: ${r.status} ${await r.text()}`)
}

let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const pick = a => a[Math.floor(rnd() * a.length)]
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const day = n => { const d = new Date(Date.UTC(2026, 9, 21)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const ts = n => new Date(day(n) + 'T03:00:00.000Z')

const FIRST = ['สมชาย', 'สมหญิง', 'ทดสอบ', 'ตัวอย่าง', 'มานี', 'มานะ', 'ปิติ', 'ชูใจ', 'วีระ', 'ดวงใจ']
const LAST = ['ใจดี', 'รักไทย', 'ทดลอง', 'สมมติ', 'มีสุข', 'ศรีสุข', 'บุญมา', 'แสงทอง']
const MODELS = [['DEEPAL', 'S07', 1399000], ['DEEPAL', 'LUMIN', 499000], ['DEEPAL', 'S05', 999000], ['AION', 'AION V', 899000], ['OMODA & JAECOO', 'JAECOO 6', 1099000]]
const STATUSES = ['ยอดจองคงค้าง', 'รอผลไฟแนนซ์', 'รอรถ', 'รอส่งมอบ', 'ส่งมอบแล้ว', 'ส่งมอบแล้ว', 'ส่งมอบแล้ว', 'ถอนจอง']
const SALES = ['เซลส์ หนึ่ง', 'เซลส์ สอง', 'เซลส์ สาม']
const COMPANIES = [['co-deepal', 'DEEPAL ทดสอบ', 'DEEPAL'], ['co-aion', 'AION ทดสอบ', 'AION'], ['co-omoda', 'OMODA & JAECOO ทดสอบ', 'OMODA & JAECOO']]
const coFor = brand => COMPANIES.find(c => c[2] === brand)[0]

async function main() {
  // บัญชีทดสอบบน auth emulator
  const su = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...TEST_LOGIN, returnSecureToken: true }),
  }).then(r => r.json())
  const uid = su.localId
  if (!uid) throw new Error('auth emulator signUp failed: ' + JSON.stringify(su))
  await put('users', uid, { uid, email: TEST_LOGIN.email, displayName: 'เจ้าของ ทดสอบ', role: 'owner', active: true, createdAt: ts(-300) })

  for (const [id, name, brand] of COMPANIES) await put('org_companies', id, { name, brand, createdAt: ts(-400) })

  const staffNames = [...SALES, 'ช่าง หนึ่ง', 'ช่าง สอง', 'บัญชี หนึ่ง', 'ผู้จัดการ ทดสอบ', 'HR ทดสอบ']
  const depts = ['ขาย', 'ขาย', 'ขาย', 'บริการ', 'บริการ', 'บัญชี', 'บริหาร', 'HR']
  for (let i = 0; i < staffNames.length; i++) {
    const [fn, ln] = staffNames[i].split(' ')
    await put('staff', 'st' + i, { firstName: fn, lastName: ln, nickname: fn, role: i < 3 ? 'sales' : i < 5 ? 'service' : 'staff', position: depts[i] === 'ขาย' ? 'Sales Consultant' : 'Staff',
      dept: depts[i], status: 'active', phone: '08000000' + String(i).padStart(2, '0'), email: `staff${i}@example.test`, startDate: day(-500 + i * 20),
      companyId: COMPANIES[i % 3][0], companyIds: [COMPANIES[i % 3][0]], salary: 15000 + i * 2000, createdAt: ts(-500 + i) })
  }

  const customers = []
  for (let i = 0; i < 30; i++) {
    const [brand, model, price] = pick(MODELS)
    const c = { firstName: pick(FIRST), lastName: pick(LAST), phone: '0890000' + String(i).padStart(3, '0'), lineId: '', email: '', interestedModel: model, budget: price,
      source: pick(['Walk-in', 'Facebook', 'LINE', 'บูธ']), temperature: pick(['hot', 'warm', 'cold']), assignedTo: pick(SALES), vip: i % 9 === 0, notes: '',
      stage: pick(['lead', 'pp', 'booking', 'delivered']), stageChangedAt: day(-int(1, 200)) + 'T00:00:00.000Z', isLost: false, companyId: coFor(brand), createdAt: ts(-int(1, 300)) }
    customers.push(c)
    await put('customers', 'cu' + i, c)
  }

  for (let i = 0; i < 40; i++) {
    const ci = i % 30, c = customers[ci]
    const [brand, model, price] = MODELS.find(m => m[1] === c.interestedModel)
    const status = pick(STATUSES)
    const bd = -int(1, 280)
    const down = Math.round(price * pick([0.1, 0.2, 0.3]))
    const margin = int(5, 40) * 1000, budgetUsed = int(0, 20) * 1000
    await put('bookings', 'bk' + i, {
      bookingNo: 'SKT' + String(2600 + i), status, custName: `${c.firstName} ${c.lastName}`, phone: c.phone, customerId: 'cu' + ci, address: 'ที่อยู่สมมติ', source: c.source,
      brand, model, variant: '', colorOut: pick(['ขาว', 'ดำ', 'เทา']), colorIn: 'ดำ', vin: status === 'ส่งมอบแล้ว' ? 'TESTVIN' + String(10000 + i) : '',
      price, cost: price - margin, down, bookingDeposit: 5000, financeCo: pick(['KBANK', 'BAY', 'SCB', '']), financeAmount: price - down, finStatus: pick(['ผ่าน', 'รอผล', '']),
      installments: 60, interestRate: 2.49, monthly: Math.round((price - down) * 1.12 / 60), campaign: 'ดอกเบี้ยปกติ', margin, budgetUsed, marginLeft: margin - budgetUsed,
      com70: 3000, comFinance: 2000, insuranceAmount: 0, accessoryAmount: 0, totalIncome: margin - budgetUsed + 5000, rightsOnly: false,
      bookingDate: day(bd), approveDate: day(bd + 5), deliveryDate: day(bd + 20), cutDate: status === 'ส่งมอบแล้ว' ? day(bd + 18) : '',
      actualDeliveryDate: status === 'ส่งมอบแล้ว' ? day(bd + 20) : '', salesName: pick(SALES), notes: '', cancelReason: status === 'ถอนจอง' ? 'price' : '',
      companyId: coFor(brand), createdAt: ts(bd),
    })
  }

  for (let i = 0; i < 20; i++) {
    const [brand, model, price] = pick(MODELS)
    await put('vehicles', 'vh' + i, { vin: 'STOCKVIN' + String(20000 + i), brand, model, variant: '', color: pick(['ขาว', 'ดำ', 'เทา']), year: 2026, price, cost: Math.round(price * 0.9),
      status: pick(['available', 'available', 'reserved', 'sold', 'in_transit']), location: 'โชว์รูม', mileage: int(0, 30), arrivedAt: day(-int(1, 150)), companyId: coFor(brand), createdAt: ts(-int(1, 150)) })
  }

  for (let i = 0; i < 15; i++) {
    const [brand, model] = pick(MODELS)
    await put('job_cards', 'jc' + i, { jobNo: 'JC' + String(5000 + i), custName: `${pick(FIRST)} ${pick(LAST)}`, phone: '0870000' + String(i).padStart(3, '0'), brand, model,
      plate: 'ทดสอบ ' + (1000 + i), vin: 'TESTVIN' + String(10000 + i), mileage: int(1000, 40000), type: pick(['เช็คระยะ', 'ซ่อมทั่วไป', 'เคลม']), status: pick(['pending', 'in_progress', 'done', 'delivered']),
      techName: pick(['ช่าง หนึ่ง', 'ช่าง สอง']), bay: 'B' + int(1, 4), labor: int(5, 30) * 100, parts: [{ name: 'กรองอากาศ', qty: 1, price: 450 }], companyId: coFor(brand), createdAt: ts(-int(0, 90)) })
  }

  for (let i = 0; i < 12; i++) {
    await put('parts', 'pt' + i, { partNo: 'P-' + (100 + i), name: pick(['กรองอากาศ', 'ผ้าเบรก', 'ใบปัดน้ำฝน', 'น้ำยาแอร์', 'ยางรถ']) + ' ' + i, brand: 'DEEPAL', qty: int(0, 40), minQty: 5,
      unitCost: int(2, 30) * 100, unitPrice: int(3, 40) * 100, unit: 'ชิ้น', location: 'ชั้น A', companyId: 'co-deepal', createdAt: ts(-int(1, 200)) })
  }

  for (let i = 0; i < 8; i++) {
    await put('test_drives', 'td' + i, { customerName: `${pick(FIRST)} ${pick(LAST)}`, phone: '0860000' + String(i).padStart(3, '0'), model: pick(MODELS)[1], date: day(int(-10, 10)),
      time: pick(['10:00', '13:00', '15:00']), staff: pick(SALES), status: pick(['scheduled', 'done', 'no_show']), result: pick(['interested', 'maybe', '']), companyId: 'co-deepal', createdAt: ts(-int(0, 30)) })
  }

  for (let i = 0; i < 6; i++) {
    await put('expense_claims', 'ec' + i, { staff: pick(staffNames), dept: 'ขาย', cat: pick(['ค่าน้ำมัน', 'ค่าเดินทาง']), amount: int(2, 30) * 100, date: day(-int(1, 60)),
      status: pick(['pending', 'approved', 'paid']), companyId: 'co-deepal', createdAt: ts(-int(1, 60)) })
    await put('petty_cash', 'pc' + i, { type: pick(['in', 'out']), cat: 'ทั่วไป', desc: 'รายการทดสอบ ' + i, amount: int(1, 20) * 100, by: pick(staffNames), time: day(-int(1, 60)) + 'T10:00:00',
      status: 'approved', companyId: 'co-deepal', createdAt: ts(-int(1, 60)) })
    await put('complaints', 'cp' + i, { custName: `${pick(FIRST)} ${pick(LAST)}`, phone: '0850000' + String(i).padStart(3, '0'), topic: 'เรื่องทดสอบ ' + i, detail: 'รายละเอียดทดสอบ',
      priority: pick(['high', 'medium', 'low']), status: pick(['open', 'in_progress', 'closed']), openDate: day(-int(1, 40)), companyId: 'co-deepal', createdAt: ts(-int(1, 40)) })
    await put('tasks', 'tk' + i, { title: 'งานทดสอบ ' + i, assignee: pick(staffNames), dueDate: day(int(-5, 10)), status: pick(['todo', 'inprogress', 'done']), priority: 'medium',
      companyId: 'co-deepal', createdAt: ts(-int(1, 20)) })
    await put('leave_requests', 'lv' + i, { staff: pick(staffNames), type: pick(['ลาป่วย', 'ลากิจ', 'ลาพักร้อน']), from: day(int(-20, 10)), to: day(int(-19, 11)), days: int(1, 3),
      status: pick(['pending', 'approved']), companyId: 'co-deepal', createdAt: ts(-int(1, 30)) })
  }
  console.log(`emulator-seed: done (login ${TEST_LOGIN.email} / ${TEST_LOGIN.password})`)
}

main().catch(e => { console.error(e); process.exit(1) })
