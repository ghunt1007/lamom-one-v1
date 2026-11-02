// (2026-11-02) ข้อมูลชุดเอกสารขายรถ (ตามแบบฟอร์มจริงของโชว์รูม DEEPAL บางบัวทอง)
// เก็บใน bookings.sale — ใช้ร่วมกันทุกแบบฟอร์ม: Job Order, สัญญาซื้อขาย, แนบท้ายสัญญา, แจ้งค่าใช้จ่าย,
// ใบส่งมอบ, แจ้งจดทะเบียน, ใบค่าคอม, ใบขอยกเลิกจอง — กรอกครั้งเดียว ทุกแผ่นตรงกัน
// ไฟล์นี้เป็นตรรกะล้วน (ไม่แตะ Firestore/DOM) เพื่อเทสได้

// รายการมาตรฐานในตาราง Job Order (เรียงตามแบบฟอร์มจริง)
export const DEFAULT_ITEMS = ['ประกันภัยชั้น 1', 'พรบ', 'ค่าจดทะเบียน', 'ล้างรถ', 'กรอบป้าย', 'ช่อดอกไม้', 'พรม']
export const JOB_ORDER_ROWS = 16

// ใบส่งมอบรถยนต์ — รายการตรวจสอบตามแบบฟอร์มจริง
export const DELIVERY_CHECKS = [
  ['ภายนอก', 'ตรวจสอบลักษณะของยานพาหนะเพื่อหาสิ่งสกปรก เช่น มูลนก และทำความสะอาดทันที'],
  ['ประตูรถ', 'เปิดและปิดประตูรถแต่ละบานด้วยตนเองสองครั้งในแต่ละครั้ง'],
  ['ใบปัดน้ำฝน', 'ยกก้านปัดน้ำฝนตั้งตรงและมีฝาครอบป้องกัน'],
  ['ตกแต่งภายใน', 'ตรวจสอบรูปลักษณ์ของส่วนประกอบภายในว่าสีซีดจางหรือเสื่อมสภาพหรือไม่'],
  ['แชสซี', 'ตรวจสอบว่ามีสัญญาณน้ำมันรั่วบนพื้นบริเวณที่จอดรถหรือไม่'],
  ['แบตเตอรี่แรงดันต่ำ', 'ตรวจสอบว่าขั้วลบของแบตเตอรี่ถูกตัดการเชื่อมต่อหรือไม่ และแบตเตอรี่ชาร์จเต็มแล้วหรือไม่'],
  ['การสตาร์ทรถ', 'เชื่อมต่อขั้วลบของแบตเตอรี่และตรวจสอบว่าฟังก์ชันสตาร์ทของรถเป็นปกติหรือไม่'],
  ['ยาง', 'ตรวจสอบว่าแรงดันลมยางเป็นปกติหรือไม่'],
  ['แบตเตอรี่แรงดันสูง', 'SOC ..........%,   แรงดันเซลล์สูงสุด......V,   แรงดันเซลล์ต่ำสุด .......V'],
  ['อุปกรณ์ เพิ่มเติม', '1. สายชาร์จฉุกเฉิน'],
]

// รุ่นที่มีช่องติ๊กในใบคำขอยกเลิกการสั่งจอง
export const WITHDRAW_MODELS = ['DEEPAL L07', 'DEEPAL S07', 'CHANGAN LUMIN']

const num = v => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0 }

export function isCashBooking(b) {
  return b?.finStatus === 'ซื้อสด' || b?.financeCo === 'ซื้อสด' || (!b?.financeCo && !num(b?.financeAmount))
}

// ข้อมูลเอกสารขายของใบจอง (ค่าเริ่มต้นสำหรับใบที่ยังไม่เคยกรอก)
export function saleOf(b) {
  const s = b?.sale || {}
  const items = Array.isArray(s.items) && s.items.length ? s.items : DEFAULT_ITEMS.map(name => ({ name }))
  return {
    carNo: s.carNo || '', year: s.year || '',
    addr: { houseNo: '', moo: '', soi: '', road: '', subdistrict: '', district: '', province: b?.province || '', ...(s.addr || {}) },
    phoneHome: s.phoneHome || '',
    items: items.map(it => ({ name: it.name || '', detail: it.detail || '', cost: it.cost ?? '', giftValue: it.giftValue ?? '', salePrice: it.salePrice ?? '', campaign: !!it.campaign })),
    cashBack: s.cashBack ?? '', discount: s.discount ?? '', activityDiscount: s.activityDiscount ?? '',
    redPlateDeposit: s.redPlateDeposit ?? '', regFee: s.regFee ?? '', deliveryFee: s.deliveryFee ?? '',
    giftBudget: s.giftBudget ?? '', accessoryCommission: s.accessoryCommission ?? '',
    insuranceText: s.insuranceText || '', regOption: s.regOption || 'now', regOther: s.regOther || '',
    insuranceConsent: !!s.insuranceConsent, note: s.note || '',
  }
}

// ตัวเลขทั้งชุด — ทุกแบบฟอร์มใช้ชุดเดียวกัน ยอดจึงตรงกันทุกแผ่น
export function saleTotals(b, s = saleOf(b)) {
  const price = num(b?.price)
  const cash = isCashBooking(b)
  const down = cash ? price : num(b?.down)
  const carPrice = price - num(s.cashBack)
  const itemsSale = s.items.reduce((t, it) => t + num(it.salePrice), 0)
  const giftUsed = s.items.reduce((t, it) => t + num(it.giftValue), 0)
  const gross = (cash ? carPrice : down) + num(s.regFee) + num(s.redPlateDeposit) + num(s.deliveryFee) + itemsSale
  const discounts = num(s.discount) + num(s.activityDiscount)
  const deposit = num(b?.bookingDeposit)
  const balance = gross - discounts - deposit
  const giftBudget = num(s.giftBudget)
  const giftLeft = giftBudget - giftUsed
  const financeCommission = num(b?.comFinance)
  return {
    price, cash, down, downPct: price && !cash ? Math.round((down / price) * 1000) / 10 : 0,
    carPrice, itemsSale, giftUsed, gross, discounts, deposit, balance,
    giftBudget, giftLeft, financeCommission, netCommission: giftLeft + financeCommission + num(s.accessoryCommission),
    financeAmount: cash ? 0 : num(b?.financeAmount) || Math.max(0, price - down),
  }
}

// ที่อยู่แบบบรรทัดเดียว (ใช้ในช่องที่อยู่ติดต่อ)
export function addrLine(s) {
  const a = s.addr || {}
  return [a.houseNo && `${a.houseNo}`, a.moo && `หมู่ ${a.moo}`, a.soi && a.soi !== '-' && `ซอย ${a.soi}`, a.road && a.road !== '-' && `ถนน ${a.road}`,
    a.subdistrict && `ต.${a.subdistrict}`, a.district && `อ.${a.district}`, a.province && `จ.${a.province}`].filter(Boolean).join(' ')
}

// วันที่ไทยแยกส่วน (สำหรับช่อง วันที่ / เดือน / พ.ศ.)
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
export function thaiDateParts(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return { d: '', m: '', y: '', short: '', long: '' }
  const y = Number(m[1]) + 543, mo = Number(m[2]), d = Number(m[3])
  return { d: String(d), m: TH_MONTHS[mo - 1], y: String(y), short: `${d}/${mo}/${y}`, long: `${d} ${TH_MONTHS[mo - 1]} ${y}` }
}
