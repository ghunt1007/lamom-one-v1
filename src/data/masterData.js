/**
 * Master Data — ฐานข้อมูลกลางของข้อมูลอ้างอิงที่ใช้ร่วมกันทุกโมดูล
 * (พนักงานขาย, สาขา, สี, อุปกรณ์เสริม, ธนาคารไฟแนนซ์, บริษัทประกัน, แหล่งที่มา Lead ฯลฯ)
 * เก็บใน Firestore collection เดียว doc เดียว ('master_data'/'default') → sync ข้ามอุปกรณ์จริง
 * (เดิมเก็บใน localStorage เครื่องเดียว ทำให้พนักงาน 2 เครื่องเห็นข้อมูลไม่ตรงกัน)
 *
 * Pattern: cache ในหน่วยความจำ โหลดครั้งเดียวตอน bootstrap (ดู loadMasterData() เรียกจาก main.js)
 * เหมือน vehicleDatabase.js — getter ทั้งหมดยังคง "synchronous" อ่านจาก cache เพื่อไม่กระทบ
 * หน้าที่เรียกใช้แบบ inline อยู่แล้ว (ActionPlan, Bookings, Customers, TestDrive, QuotationBuilder,
 * DeliveryNote, Stock, FinanceApplication, FinanceRateSheets, SalesChannelComparison ฯลฯ)
 * ส่วนฟังก์ชันแก้ไขข้อมูล (addItem/updateItem/removeItem/setList/resetMaster/setSalesChannel)
 * เป็น async — เขียนลง Firestore แล้วอัปเดต cache
 *
 * ใช้งาน: import { getSalesStaff, getAccessories, getBanks } from '../../data/masterData.js'
 */
import { listDocs, createDoc, updateDocData } from '../core/db.js'

const KEY = 'lamom_master_data' // localStorage key เดิม — ใช้ตอน migrate ครั้งแรกเท่านั้น ไม่ลบทิ้งหลังจากนั้น (ไม่มีผลเสีย)

const DEFAULTS = {
  salesStaff: ['อรนุช เซลส์ดี', 'วิชัย ขายเก่ง', 'ปวีณา สายขาย', 'ธนกร โชคดี', 'สุดารัตน์ ใจบุญ'],
  branches: ['โชว์รูมหลัก (สำนักงานใหญ่)', 'สาขา 2', 'สาขา 3', 'ศูนย์บริการ'],
  colors: ['ขาว Pearl', 'ดำ', 'เทา', 'เงิน', 'น้ำเงิน', 'แดง', 'เขียว', 'ส้ม', 'ฟ้า'],
  // price = ราคาเริ่มต้น (fallback); priceByVehicle = ราคาที่ต่างกันตามรุ่น/ยี่ห้อรถ (ไม่ระบุ = ใช้ price เริ่มต้น)
  // เช่น รถคันใหญ่ (Alphard, Land Cruiser) พื้นที่ตัวถังเยอะกว่า → ค่าฟิล์มกันรอยแพงกว่า
  accessories: [
    { id: 'A001', name: 'ฟิล์มกันรอย Full Body', price: 18000, priceByVehicle: { TY007: 35000, TY008: 33000, TY009: 42000 } },
    { id: 'A002', name: 'พรมรถยนต์ Premium', price: 4500, priceByVehicle: {} },
    { id: 'A003', name: 'Wall Charger 7kW (ติดตั้ง)', price: 8500, priceByVehicle: {} },
    { id: 'A004', name: 'แผ่นยางรองเท้า OEM', price: 2800, priceByVehicle: {} },
    { id: 'A005', name: 'Car Charger Type 2', price: 1200, priceByVehicle: {} },
    { id: 'A006', name: 'กล้องหน้า-หลัง', price: 5500, priceByVehicle: {} },
    { id: 'A007', name: 'ฟิล์มกรองแสง 4 ประตู', price: 7800, priceByVehicle: {} },
    { id: 'A008', name: 'ชุดเคลือบแก้ว Ceramic Coating', price: 15000, priceByVehicle: { TY007: 28000, TY009: 32000 } },
  ],
  banks: ['ธนาคารกรุงศรี (Krungsri Auto)', 'ธนาคารทิสโก้ (TISCO)', 'ttb (ธนชาต)', 'SCB ไทยพาณิชย์', 'KBank Leasing', 'กรุงไทย (KTB)', 'เกียรตินาคินภัทร (KKP)', 'BAY Auto'],
  financeCompanies: ['BAY', 'TTB', 'KBANK', 'TISCO', 'SCB', 'ICBC', 'ORIX', 'KKP', 'นิสสันลีสซิ่ง', 'ซื้อสด'],
  financeStatus: ['รอผล', 'รอเซ็นสัญญา', 'ผ่าน', 'ไม่ผ่าน', 'ซื้อสด', 'รอส่ง'],
  campaigns: ['ดอกเบี้ยปกติ', 'ดอกเบี้ยพิเศษ', 'ฟรีดาวน์', 'ซื้อสด'],
  bookingStatus: ['จัดไฟแนนซ์ก่อนจอง', 'ยอดจองคงค้าง', 'รอผลไฟแนนซ์', 'รอรถ', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ', 'ส่งมอบแล้ว', 'ถอนจอง'],
  insurers: ['เมืองไทยประกันภัย', 'วิริยะประกันภัย', 'กรุงเทพประกันภัย', 'ทิพยประกันภัย', 'สินมั่นคงประกันภัย', 'อาคเนย์ประกันภัย', 'MSIG', 'AXA'],
  insuranceTypes: ['ชั้น 1', 'ชั้น 2+', 'ชั้น 2', 'ชั้น 3+', 'ชั้น 3', 'พ.ร.บ.'],
  leadSources: ['facebook', 'line', 'walk-in', 'website', 'referral', 'tiktok', 'google', 'event'],
  // ช่องทางขายของพนักงานแต่ละคน — 'showroom' (หน้าร้าน) หรือ 'online' (ออนไลน์ ไม่รับหน้าร้าน)
  // เก็บเป็น map ชื่อ→ช่องทาง แยกจาก salesStaff list เพื่อไม่กระทบหน้าอื่นที่ใช้ getSalesStaff() แบบ array ชื่อเดิม
  salesStaffChannel: {},
  // (v1.0.438, ปรับปรุง v1.0.447) รายชื่อตำแหน่งงานมาตรฐาน — เดิมช่อง "ตำแหน่ง" ในหน้า User Management เป็น
  // ช่องพิมพ์เองล้วน (ไม่มี dropdown มาตรฐาน) ทำให้พิมพ์ไม่ตรงกันได้ (เช่น "เซลส์"/"Sales"/"พนักงานขาย" ปนกัน)
  // v1.0.438 เริ่มด้วยชุดตำแหน่งทั่วไปของธุรกิจโชว์รูม/ศูนย์บริการรถยนต์ EV แบบเดา (รอข้อมูลจริง) — v1.0.447
  // แทนที่ด้วยโครงสร้างตำแหน่งจริงของกลุ่มบริษัท เอส.เค. (3 บริษัทในเครือ: เอส.เค.ออโต้ กรุ๊ป/DEEPAL,
  // เอส.เค.ออโต้ไลฟ์/AION, เอส.เค.อีวี บางบัวทอง/OMODA&JAECOO) ตามที่เจ้าของระบบให้รายละเอียดจริงมา — เจ้าของ
  // ระบบยังแก้ไข/เพิ่ม/ลบเองได้ทุกเมื่อที่หน้า Settings > Master Data (ใช้ MASTER_LISTS ด้านล่างเหมือน list
  // อื่นๆทุกจุด ไม่ใช่ hardcode ตายตัว) — หมายเหตุ: master_data doc มีอยู่แล้วใน Firestore production ตั้งแต่
  // v1.0.438 ค่า DEFAULTS นี้จึงเป็นแค่ค่าเริ่มต้นสำหรับติดตั้งใหม่/รีเซ็ตเท่านั้น ไม่ทับของเดิมที่มีอยู่แล้ว
  // อัตโนมัติ ต้องอัปเดตจริงผ่านหน้า Settings > Master Data (หรือให้ระบบช่วยกรอกให้ผ่านฟอร์มจริงถ้าล็อกอินอยู่)
  positions: [
    'กรรมการผู้จัดการ/เจ้าของ', 'ผู้ช่วยเจ้าของกิจการ',
    // ฝ่ายขายหน้าร้าน (แยกทีมตามแบรนด์ — DEEPAL/AION/OMODA&JAECOO)
    'ผู้จัดการทีมขายหน้าร้าน', 'พนักงานขายหน้าร้าน',
    // ฝ่ายขายออนไลน์ (ดูแลทุกบริษัทรวมกัน)
    'ผู้จัดการฝ่ายขายออนไลน์', 'ผู้จัดการทีมขายออนไลน์', 'พนักงานขายออนไลน์',
    // ฝ่ายเซอร์วิส (ผู้จัดการฝ่ายคุมรวมทุกแบรนด์ ทีมงานแยกตามแบรนด์)
    'ผู้จัดการฝ่ายเซอร์วิส', 'ผู้จัดการ SA', 'เจ้าหน้าที่ลูกค้าสัมพันธ์', 'เจ้าหน้าที่ BP และประกันภัย', 'หัวหน้าช่าง', 'ช่างเทคนิค',
    // แผนกแยกตามแบรนด์
    'เจ้าหน้าที่ธุรการ', 'เจ้าหน้าที่สต็อกรถ', 'เจ้าหน้าที่บัญชี',
    // แผนกกลาง ดูแลทุกบริษัทในเครือ
    'หัวหน้าฝ่ายบัญชี', 'เจ้าหน้าที่บุคคล (HR)', 'ผู้จัดการฝ่ายบุคคล (HR)',
    'เจ้าหน้าที่ PDI และแต่งรถ', 'เจ้าหน้าที่ทะเบียนและประกันภัยรถใหม่', 'เจ้าหน้าที่ตรวจสอบ',
    'เจ้าหน้าที่การตลาด', 'ผู้จัดการฝ่ายการตลาด', 'นักออกแบบกราฟฟิก',
    // เผื่อไว้ทั่วไป
    'เจ้าหน้าที่การเงิน', 'เจ้าหน้าที่สินเชื่อ/ไฟแนนซ์รถ', 'เจ้าหน้าที่อะไหล่', 'หัวหน้าคลังอะไหล่',
    'พนักงานต้อนรับ', 'รปภ.', 'แม่บ้าน', 'ผู้จัดการสาขา', 'ผู้จัดการทั่วไป',
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// Firestore-backed cache — โหลดครั้งเดียวตอน bootstrap (main.js) ก่อนหน้าไหนอ่านข้อมูล
// ต้อง await loadMasterData() ให้เสร็จก่อน — ดู vehicleDatabase.js สำหรับ pattern เดียวกัน
// ═══════════════════════════════════════════════════════════════════════════
let _cache = Object.assign({}, DEFAULTS)
let _docId = null
let _loaded = false

export async function loadMasterData() {
  try {
    const docs = await listDocs('master_data', [], 'createdAt', 'asc', 10)
    if (docs.length > 0) {
      const d = docs[0]
      _docId = d.id
      _cache = Object.assign({}, DEFAULTS, d)
    } else {
      // First run ของระบบ — ยังไม่มี doc ใน Firestore
      // Migration: ถ้ามีข้อมูลเดิมใน localStorage (ที่ผู้ใช้เคยแก้ไขไว้ก่อนย้ายมา Firestore) ให้ใช้เป็น seed
      // แทนที่จะทิ้งไปเฉยๆ ไม่ลบ localStorage key เดิมทิ้ง (ไม่มีผลเสีย เผื่อ debug ย้อนหลัง)
      let seed = Object.assign({}, DEFAULTS)
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) seed = Object.assign({}, DEFAULTS, JSON.parse(raw))
      } catch (e) { /* localStorage เสีย/parse พัง — ใช้ DEFAULTS */ }
      _docId = await createDoc('master_data', seed)
      _cache = seed
    }
    _loaded = true
  } catch (e) {
    // โหลดพัง (offline/permission ฯลฯ) — ใช้ DEFAULTS ต่อไปเพื่อไม่ให้แอปค้าง, _loaded ยัง mark true
    // (retry จะเกิดเองตอนมี mutation เพราะ ensureDocId() จะเรียก loadMasterData() ใหม่ถ้ายังไม่มี _docId)
    _loaded = true
  }
}
export function isMasterDataLoaded() { return _loaded }

async function ensureDocId() {
  if (!_docId) await loadMasterData()
}

// เขียน field เดียวลง Firestore doc + sync cache ในหน่วยความจำ
async function writeField(name, value) {
  await ensureDocId()
  _cache[name] = value
  if (_docId) await updateDocData('master_data', _docId, { [name]: value })
}

// ── Generic CRUD (ใช้กับทุก list) ──────────────────────────────────────────────
export function getList(name) { return _cache[name] || [] }
export async function setList(name, arr) { await writeField(name, arr) }
export async function addItem(name, item) {
  const arr = (_cache[name] || []).concat([item])
  await writeField(name, arr)
}
export async function updateItem(name, index, item) {
  const arr = (_cache[name] || []).slice()
  if (arr[index] === undefined) return
  arr[index] = item
  await writeField(name, arr)
}
export async function removeItem(name, index) {
  const arr = (_cache[name] || []).filter((_, i) => i !== index)
  await writeField(name, arr)
}
export async function resetMaster() {
  await ensureDocId()
  const fresh = Object.assign({}, DEFAULTS)
  _cache = fresh
  if (_docId) await updateDocData('master_data', _docId, fresh)
}
export const MASTER_LISTS = [
  { key: 'salesStaff', label: 'พนักงานขาย', type: 'string' },
  { key: 'branches', label: 'สาขา/โชว์รูม', type: 'string' },
  { key: 'colors', label: 'สีรถ', type: 'string' },
  { key: 'accessories', label: 'อุปกรณ์เสริม', type: 'priced' },
  { key: 'banks', label: 'ธนาคาร/ไฟแนนซ์', type: 'string' },
  { key: 'financeCompanies', label: 'บริษัทไฟแนนซ์ (จอง)', type: 'string' },
  { key: 'campaigns', label: 'แคมเปญ', type: 'string' },
  { key: 'insurers', label: 'บริษัทประกันภัย', type: 'string' },
  { key: 'insuranceTypes', label: 'ประเภทประกัน', type: 'string' },
  { key: 'leadSources', label: 'แหล่งที่มา Lead', type: 'string' },
  { key: 'positions', label: 'ตำแหน่งงาน', type: 'string' },
]

// ── Convenience getters (synchronous — อ่านจาก cache) ──────────────────────────
export const getSalesStaff = () => getList('salesStaff')
export const getBranches = () => getList('branches')
export const getColors = () => getList('colors')
export const getAccessories = () => getList('accessories')
export const getBanks = () => getList('banks')
export const getFinanceCompanies = () => getList('financeCompanies')
export const getFinanceStatus = () => getList('financeStatus')
export const getCampaigns = () => getList('campaigns')
export const getBookingStatus = () => getList('bookingStatus')
export const getInsurers = () => getList('insurers')
export const getInsuranceTypes = () => getList('insuranceTypes')
export const getLeadSources = () => getList('leadSources')
export const getPositions = () => getList('positions')

// ── ช่องทางขาย (หน้าร้าน/ออนไลน์) ต่อพนักงาน ────────────────────────────────────
export function getSalesChannel(name) {
  return (_cache.salesStaffChannel || {})[name] || 'showroom'
}
export async function setSalesChannel(name, channel) {
  const map = Object.assign({}, _cache.salesStaffChannel || {})
  map[name] = channel
  await writeField('salesStaffChannel', map)
}
export function getSalesStaffByChannel(channel) {
  return getSalesStaff().filter(name => getSalesChannel(name) === channel)
}
