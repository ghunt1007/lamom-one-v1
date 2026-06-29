/**
 * Master Data — ฐานข้อมูลกลางของข้อมูลอ้างอิงที่ใช้ร่วมกันทุกโมดูล
 * (พนักงานขาย, สาขา, สี, อุปกรณ์เสริม, ธนาคารไฟแนนซ์, บริษัทประกัน, แหล่งที่มา Lead ฯลฯ)
 * แก้ไข/เพิ่ม/ลบ ได้ + เก็บถาวรใน localStorage → ทุกหน้าดึงชุดเดียวกัน
 * ใช้งาน: import { getSalesStaff, getAccessories, getBanks } from '../../data/masterData.js'
 */
const KEY = 'lamom_master_data'

const DEFAULTS = {
  salesStaff: ['อรนุช เซลส์ดี', 'วิชัย ขายเก่ง', 'ปวีณา สายขาย', 'ธนกร โชคดี', 'สุดารัตน์ ใจบุญ'],
  branches: ['โชว์รูมหลัก (สำนักงานใหญ่)', 'สาขา 2', 'สาขา 3', 'ศูนย์บริการ'],
  colors: ['ขาว Pearl', 'ดำ', 'เทา', 'เงิน', 'น้ำเงิน', 'แดง', 'เขียว', 'ส้ม', 'ฟ้า'],
  accessories: [
    { id: 'A001', name: 'ฟิล์มกันรอย Full Body', price: 18000 },
    { id: 'A002', name: 'พรมรถยนต์ Premium', price: 4500 },
    { id: 'A003', name: 'Wall Charger 7kW (ติดตั้ง)', price: 8500 },
    { id: 'A004', name: 'แผ่นยางรองเท้า OEM', price: 2800 },
    { id: 'A005', name: 'Car Charger Type 2', price: 1200 },
    { id: 'A006', name: 'กล้องหน้า-หลัง', price: 5500 },
    { id: 'A007', name: 'ฟิล์มกรองแสง 4 ประตู', price: 7800 },
    { id: 'A008', name: 'ชุดเคลือบแก้ว Ceramic Coating', price: 15000 },
  ],
  banks: ['ธนาคารกรุงศรี (Krungsri Auto)', 'ธนาคารทิสโก้ (TISCO)', 'ttb (ธนชาต)', 'SCB ไทยพาณิชย์', 'KBank Leasing', 'กรุงไทย (KTB)', 'เกียรตินาคินภัทร (KKP)', 'BAY Auto'],
  financeCompanies: ['BAY', 'TTB', 'KBANK', 'TISCO', 'SCB', 'ICBC', 'ORIX', 'KKP', 'นิสสันลีสซิ่ง', 'ซื้อสด'],
  financeStatus: ['รอผล', 'รอเซ็นสัญญา', 'ผ่าน', 'ไม่ผ่าน', 'ซื้อสด', 'รอส่ง'],
  campaigns: ['ดอกเบี้ยปกติ', 'ดอกเบี้ยพิเศษ', 'ฟรีดาวน์', 'ซื้อสด'],
  bookingStatus: ['รอผลไฟแนนซ์', 'รอรถ', 'รอส่งมอบ', 'ส่งมอบแล้ว', 'ยอดจองคงค้าง', 'ถอนจอง'],
  insurers: ['เมืองไทยประกันภัย', 'วิริยะประกันภัย', 'กรุงเทพประกันภัย', 'ทิพยประกันภัย', 'สินมั่นคงประกันภัย', 'อาคเนย์ประกันภัย', 'MSIG', 'AXA'],
  insuranceTypes: ['ชั้น 1', 'ชั้น 2+', 'ชั้น 2', 'ชั้น 3+', 'ชั้น 3', 'พ.ร.บ.'],
  leadSources: ['facebook', 'line', 'walk-in', 'website', 'referral', 'tiktok', 'google', 'event'],
}

function load() {
  try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')) } catch (e) { return Object.assign({}, DEFAULTS) }
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {} }

// ── Generic CRUD (ใช้กับทุก list) ──────────────────────────────────────────────
export function getList(name) { return load()[name] || [] }
export function setList(name, arr) { const d = load(); d[name] = arr; save(d) }
export function addItem(name, item) { const d = load(); d[name] = (d[name] || []).concat([item]); save(d) }
export function updateItem(name, index, item) { const d = load(); if (d[name] && d[name][index] !== undefined) { d[name][index] = item; save(d) } }
export function removeItem(name, index) { const d = load(); if (d[name]) { d[name] = d[name].filter((_, i) => i !== index); save(d) } }
export function resetMaster() { localStorage.removeItem(KEY) }
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
]

// ── Convenience getters ────────────────────────────────────────────────────────
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
