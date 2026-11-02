// หน้าที่ใช้ข้อมูลชุดเดียวกัน (collection เดียวกัน) แต่เดิมแยกเป็นเมนูคนละอัน เช่น "ยื่นไฟแนนซ์" กับ "Finance Tracker"
// รวมเป็นเมนูเดียว (เมนูแรกของแต่ละกลุ่ม) แล้วโชว์แท็บสลับมุมมองใต้หัวหน้าแทน — ทุกหน้ายังเปิดได้ตามลิงก์เดิม
// และค้นเจอใน Ctrl+K เหมือนเดิม แค่ไม่รกแถบเมนูซ้าย
export const LINKED_VIEWS = [
  [{ path: '/crm/testdrive', label: '📋 รายการ/ผล' }, { path: '/dms/testdrive-schedule', label: '🗓 ตารางเวลา' }],
  [{ path: '/finance/application', label: '🏦 ยื่นไฟแนนซ์' }, { path: '/finance/tracker', label: '📋 ติดตามขั้นตอน' }],
  [{ path: '/service/recall', label: '🔔 แคมเปญเรียกคืน' }, { path: '/service/recall-tracker', label: '🚗 รถที่ต้องเรียกคืน' }],
  [{ path: '/service/warranty', label: '🛡 การรับประกัน' }, { path: '/service/warranty-claim', label: '📋 เคลมประกัน' }, { path: '/service/warranty-expiry', label: '⏳ ใกล้หมดประกัน' }],
  [{ path: '/finance/payroll', label: '💳 เงินเดือน' }, { path: '/finance/payroll-detail', label: '🧾 สลิปรายคน' }],
  [{ path: '/finance/commission', label: '🏆 ค่าคอม' }, { path: '/finance/commission-rules', label: '⚙️ กฎค่าคอม' }],
  // (2026-11-02) หน้า AI 7 หน้า รวมเป็นเมนูเดียว "ถาม LAMI" — สลับมุมมองด้วยแท็บ
  [{ path: '/ai/ask', label: '💬 ถาม LAMI' }, { path: '/ai/lami', label: '🧠 สมอง LAMI' }, { path: '/ai/insights', label: '🔮 ข้อสังเกต' },
    { path: '/ai/sales-coach', label: '🎯 โค้ชการขาย' }, { path: '/ai/lead-scoring', label: '📈 คะแนน Lead' },
    { path: '/ai/upsell', label: '➕ ขายเพิ่ม' }, { path: '/ai/pricing', label: '💲 แนะนำราคา' }],
  [{ path: '/marketing/leads', label: '🧲 แคมเปญหา Lead' }, { path: '/marketing/lead-sources', label: '📊 แหล่งที่มา Lead' }],
  // (2026-11-02) หมวดวิเคราะห์ข้อมูล 25 เมนู → 7 เมนู (เรื่องเดียวกันอยู่หน้าเดียว สลับด้วยแท็บ)
  [{ path: '/analytics', label: '📈 ภาพรวม' }, { path: '/analytics/executive', label: '📋 สรุปผู้บริหาร' }, { path: '/analytics/daily', label: '📅 รายวัน' },
    { path: '/analytics/kpi', label: '🎯 KPI' }, { path: '/analytics/monthly', label: '📈 รายเดือน' }, { path: '/analytics/seasonal', label: '🗓 ตามฤดูกาล' }, { path: '/analytics/forecast', label: '🔮 พยากรณ์' }],
  [{ path: '/analytics/by-model', label: '🚗 ตามรุ่น' }, { path: '/analytics/funnel', label: '🔻 อัตราปิดการขาย' }, { path: '/analytics/sales-channel', label: '⚖️ หน้าร้าน vs ออนไลน์' },
    { path: '/analytics/branches', label: '🏢 เทียบสาขา' }, { path: '/analytics/market-share', label: '📊 ส่วนแบ่งตลาด' }],
  [{ path: '/analytics/profit', label: '📈 กำไรรวม' }, { path: '/analytics/model-profit', label: '🚗 กำไรตามรุ่น' }],
  [{ path: '/analytics/customers', label: '🧠 วิเคราะห์ลูกค้า' }, { path: '/analytics/journey', label: '🗺️ เส้นทางลูกค้า' }],
  [{ path: '/analytics/operations', label: '⚙️ ภาพรวม' }, { path: '/analytics/dept-ops', label: '🏭 รายแผนก' }, { path: '/analytics/service', label: '🔧 งานบริการ' },
    { path: '/analytics/parts', label: '🔩 อะไหล่' }, { path: '/analytics/stock', label: '📦 สต็อก' }],
  [{ path: '/analytics/reports', label: '📊 ศูนย์รายงาน' }, { path: '/analytics/report-builder', label: '🔧 สร้างรายงานเอง' }],
  [{ path: '/analytics/ev-adoption', label: '🔋 การใช้รถ EV' }, { path: '/analytics/carbon', label: '🌿 คาร์บอน' }],
  // (2026-11-02) หมวดการเงิน 41 เมนู → 12 เมนู
  [{ path: '/finance/margin', label: '🚗 กำไรต่อคัน' }, { path: '/finance/gp-foc', label: '🎁 กำไรขั้นต้น & ของแถม' }, { path: '/finance/sales-budget', label: '💼 งบขาย & งบแถม' },
    { path: '/finance/target-actual', label: '🎯 เป้า vs จริง' }, { path: '/finance/goals', label: '🏁 เป้าหมาย' }, { path: '/finance/breakeven', label: '⚖️ จุดคุ้มทุน' }],
  [{ path: '/finance/pl', label: '📊 กำไรขาดทุน' }, { path: '/finance/cashflow', label: '💧 กระแสเงินสด' }, { path: '/finance/budget', label: '🗂 งบประมาณ' }, { path: '/finance/monthly-close', label: '📅 ปิดงบรายเดือน' }],
  [{ path: '/finance/tax', label: '🧾 ภาษี' }, { path: '/finance/vat', label: '🧾 VAT' }, { path: '/finance/withholding-tax', label: '📄 หัก ณ ที่จ่าย' }, { path: '/finance/compliance-calendar', label: '📅 ปฏิทินยื่นภาษี' }],
  [{ path: '/finance/invoice', label: '🧾 ใบแจ้งหนี้' }, { path: '/finance/billing-run', label: '📬 วางบิล' }, { path: '/finance/receipt-auto', label: '🧾 ใบเสร็จ' },
    { path: '/finance/payment', label: '💳 รับชำระออนไลน์' }, { path: '/finance/installment', label: '📆 ผ่อนชำระ' }, { path: '/finance/debt', label: '📌 ติดตามหนี้' }, { path: '/finance/credit', label: '🛑 เครดิต' }],
  [{ path: '/finance/deposit', label: '💵 มัดจำ' }, { path: '/finance/refund', label: '↩️ คืนเงิน' }, { path: '/finance/cashier', label: '🏧 แคชเชียร์' }],
  [{ path: '/finance/expenses', label: '✅ อนุมัติค่าใช้จ่าย' }, { path: '/finance/po', label: '🛒 ใบสั่งซื้อ' }, { path: '/finance/vendor', label: '🏪 ผู้ขาย' },
    { path: '/finance/petty-cash', label: '👛 เงินสดย่อย' }, { path: '/finance/energy', label: '⚡ ค่าไฟ' }, { path: '/finance/assets', label: '🏢 ทรัพย์สิน' }],
  [{ path: '/finance/bank-partners', label: '🏦 ธนาคารคู่ค้า' }, { path: '/finance/rate-sheets', label: '📈 ดอกเบี้ย' }, { path: '/finance/loan-calc', label: '🧮 คำนวณค่างวด' },
    { path: '/finance/bank-recon', label: '🔁 กระทบยอด' }, { path: '/finance/multi-currency', label: '💱 หลายสกุลเงิน' }],
  [{ path: '/finance/charging-cost', label: '🔌 ต้นทุนค่าชาร์จ' }, { path: '/finance/charging-revenue', label: '💰 รายได้ค่าชาร์จ' }],
  // (2026-11-02) หมวดโชว์รูม 39 → 13 เมนู · หมวดการขาย 38 → 15 เมนู
  [{ path: '/dms/stock', label: '🚙 สต็อก' }, { path: '/dms/aging', label: '⏳ ค้างสต็อก' }, { path: '/dms/stockvalue', label: '💰 มูลค่า' }, { path: '/dms/receiving', label: '📥 รับรถเข้า' }, { path: '/dms/transfer', label: '🔁 โอนรถ' }, { path: '/dms/reservation', label: '📌 จองตัวรถ' }, { path: '/dms/reserve-lock', label: '🔒 ล็อกรถจอง' }, { path: '/dms/stock-audit', label: '📋 ตรวจนับ' }, { path: '/dms/floorplan', label: '🏦 สินเชื่อสต็อก' }, { path: '/dms/consignment', label: '🤝 ฝากขาย' }],
  [{ path: '/dms/orders', label: '📦 สั่งรถใหม่' }, { path: '/dms/suppliers', label: '🏭 ผู้จำหน่าย' }],
  [{ path: '/dms/delivery', label: '🚗 ใบส่งมอบ' }, { path: '/dms/delivery-calendar', label: '📅 ปฏิทินส่งมอบ' }, { path: '/dms/plates', label: '🪪 ป้ายทะเบียน' }, { path: '/dms/gov-docs', label: '📄 เอกสารราชการ' }],
  [{ path: '/dms/pricelist', label: '💲 ราคารถ' }, { path: '/dms/price-history', label: '📈 ประวัติราคา' }, { path: '/dms/compare', label: '⚖️ เปรียบเทียบ' }, { path: '/dms/color-matrix', label: '🎨 สีรถ' }, { path: '/dms/model-config', label: '⚙️ ตั้งค่ารุ่น' }, { path: '/dms/model-year', label: '📅 ปีรุ่น' }, { path: '/dms/special-edition', label: '⭐ รุ่นพิเศษ' }, { path: '/dms/vehicle-db', label: '🗄 ฐานข้อมูลรุ่น' }, { path: '/dms/homologation', label: '✅ รับรองแบบ' }],
  [{ path: '/dms/vin-lookup', label: '🔎 ค้นหา VIN' }, { path: '/dms/photos', label: '📷 รูปรถ' }, { path: '/dms/qr-vehicle', label: '🔳 QR ประจำรถ' }, { path: '/dms/keys', label: '🔑 กุญแจ' }],
  [{ path: '/dms/demo-fleet', label: '🚘 รถทดลองขับ/โชว์' }, { path: '/dms/td-cert', label: '📜 ใบรับรองทดลองขับ' }],
  [{ path: '/dms/tradein', label: '🔄 รถเทิร์น' }, { path: '/dms/used-car', label: '🚙 รถมือสอง' }],
  [{ path: '/dms/accessories', label: '🛍 ร้านของแต่ง' }, { path: '/dms/custom-orders', label: '🎨 สั่งแต่งรถ' }],
  [{ path: '/crm/customers', label: '👤 ลูกค้า' }, { path: '/crm/segments', label: '🧩 แบ่งกลุ่ม' }, { path: '/crm/vip', label: '⭐ VIP' }, { path: '/crm/fleet', label: '🏢 องค์กร/ฟลีต' }, { path: '/crm/lifecycle', label: '🔄 วงจรชีวิต' }, { path: '/crm/clv', label: '💎 มูลค่าลูกค้า' }, { path: '/crm/churn', label: '⚠️ ทำนายลูกค้าหาย' }, { path: '/crm/notes', label: '📝 บันทึก' }, { path: '/crm/voice-crm', label: '🎙 พูดบันทึก' }, { path: '/crm/map', label: '🗺 แผนที่' }, { path: '/crm/duplicates', label: '👥 ลูกค้าซ้ำ' }],
  [{ path: '/crm/pipeline', label: '📈 Pipeline' }, { path: '/crm/lostdeals', label: '💔 ดีลที่หลุด' }, { path: '/crm/deal-coach', label: '🤖 โค้ชปิดดีล' }],
  [{ path: '/crm/followup', label: '📞 ติดตาม' }, { path: '/crm/showroom', label: '🏬 นัดเข้าโชว์รูม' }, { path: '/crm/walkin', label: '🚶 เดินเข้าโชว์รูม' }, { path: '/crm/birthdays', label: '🎂 วันเกิด' }, { path: '/crm/winback', label: '🔙 ดึงลูกค้ากลับ' }],
  [{ path: '/crm/quotation', label: '🧾 ใบเสนอราคา' }, { path: '/crm/quote-compare', label: '⚖️ เทียบใบเสนอราคา' }, { path: '/crm/price-negotiation', label: '🤝 ต่อรองราคา' }],
  [{ path: '/crm/loyalty', label: '🎁 แต้มสะสม' }, { path: '/crm/loyalty-tiers', label: '🏅 ระดับสมาชิก' }, { path: '/crm/referral', label: '🤝 แนะนำลูกค้า' }, { path: '/crm/referral-qr', label: '🔳 QR แนะนำเพื่อน' }],
  [{ path: '/crm/feedback', label: '💬 ความเห็น' }, { path: '/crm/csat', label: '😊 CSAT' }, { path: '/crm/complaints', label: '📣 ร้องเรียน' }],
  // (2026-11-02) หมวดบริการ 30 → 10 · HR 29 → 10 · ระบบ 30 → 14 เมนู
  [{ path: '/service/jobs', label: '🔧 ใบสั่งซ่อม' }, { path: '/service/estimate', label: '🧮 ประเมินค่าซ่อม' }, { path: '/service/inspection', label: '🔍 ตรวจสภาพ' }, { path: '/service/history', label: '📜 ประวัติซ่อม' }, { path: '/service/quick-lane', label: '⚡ ช่องด่วน' }, { path: '/service/bp', label: '🎨 ซ่อมสี/ตัวถัง' }, { path: '/service/bay', label: '🅿️ ช่องซ่อม' }],
  [{ path: '/service/parts', label: '⚙️ อะไหล่' }, { path: '/service/parts-order', label: '🛒 สั่งอะไหล่' }, { path: '/service/parts-rma', label: '↩️ คืนอะไหล่' }],
  [{ path: '/service/appointment', label: '📅 นัดเข้าศูนย์' }, { path: '/service/reminders', label: '🔔 เตือนเข้าศูนย์' }, { path: '/service/maintenance-schedule', label: '🗓 ตารางเช็คระยะ' }, { path: '/service/reschedule-ai', label: '🤖 เลื่อนนัดอัตโนมัติ' }, { path: '/service/pickup', label: '🚐 รับ-ส่งรถ' }, { path: '/service/surveyor', label: '🧑‍💼 เซอร์เวเยอร์' }],
  [{ path: '/service/technicians', label: '👷 ตารางช่าง' }, { path: '/service/tech-kpi', label: '🎯 KPI ช่าง' }],
  [{ path: '/service/ev-diagnostic', label: '🔋 ตรวจระบบ EV' }, { path: '/service/ev-battery', label: '💚 สุขภาพแบต' }, { path: '/service/ev-range', label: '🗺 ระยะทาง EV' }, { path: '/service/charging', label: '🔌 จุดชาร์จ' }],
  [{ path: '/service/loaner', label: '🚗 รถสำรอง' }, { path: '/service/lounge', label: '☕ ห้องรับรอง' }, { path: '/service/wash', label: '🧽 ล้าง/เคลือบ' }, { path: '/service/roadside', label: '🆘 ช่วยเหลือฉุกเฉิน' }],
  [{ path: '/hr/attendance', label: '⏰ ลงเวลา' }, { path: '/hr/leave', label: '🌴 ลา' }, { path: '/hr/shift', label: '🗓 กะ/ตารางงาน' }, { path: '/hr/overtime', label: '⏱ โอที' }],
  [{ path: '/hr/kpi', label: '🎯 KPI' }, { path: '/hr/targets', label: '🏁 เป้าทีม' }, { path: '/hr/employee-kpi', label: '📋 KPI รายคน' }, { path: '/hr/performance', label: '📈 ผลงาน' }, { path: '/hr/performance-review', label: '📝 ประเมินผล' }, { path: '/hr/skills', label: '🧠 ทักษะ' }],
  [{ path: '/hr/recruitment', label: '📢 รับสมัคร' }, { path: '/hr/onboarding', label: '👋 พนักงานใหม่' }, { path: '/hr/offboarding', label: '🚪 ลาออก' }, { path: '/hr/succession', label: '🪜 สืบทอดตำแหน่ง' }],
  [{ path: '/hr/expense', label: '🧾 เบิกค่าใช้จ่าย' }, { path: '/hr/expense-ocr', label: '📷 สแกนใบเสร็จ' }, { path: '/hr/loans', label: '💳 เงินกู้พนักงาน' }],
  [{ path: '/hr/salary-scale', label: '💰 โครงสร้างเงินเดือน' }, { path: '/hr/bonus-pool', label: '🎁 กองโบนัส' }, { path: '/hr/welfare', label: '🏥 สวัสดิการ' }],
  [{ path: '/hr/announcements', label: '📣 ประกาศ' }, { path: '/hr/memo', label: '📝 บันทึกข้อความ' }, { path: '/hr/meetings', label: '👥 ประชุม' }, { path: '/hr/mood-survey', label: '😊 สำรวจความรู้สึก' }],
  [{ path: '/hr/disciplinary', label: '⚖️ วินัย' }, { path: '/hr/grievances', label: '📮 ร้องเรียนภายใน' }],
  [{ path: '/settings/notifications', label: '🔔 แจ้งเตือน' }, { path: '/settings/daily-report', label: '📨 รายงานส่ง LINE' }],
  [{ path: '/settings/org-companies', label: '🏢 บริษัทในเครือ' }, { path: '/settings/branches', label: '🏬 สาขา' }, { path: '/settings/master-data', label: '🗂 ข้อมูลหลัก' }, { path: '/settings/whitelabel', label: '🎨 แบรนด์/โลโก้' }, { path: '/settings/holidays', label: '📅 วันหยุด' }],
  [{ path: '/settings/users-manage', label: '👥 ผู้ใช้' }, { path: '/settings/security', label: '🔒 ความปลอดภัย' }, { path: '/settings/sms-otp', label: '📱 ยืนยัน 2 ชั้น' }, { path: '/settings/api-keys', label: '🔑 คีย์ API' }],
  [{ path: '/settings/backup', label: '💾 สำรอง/กู้คืน' }, { path: '/settings/data-retention', label: '🗃 ระยะเก็บข้อมูล' }, { path: '/settings/company-data-cleanup', label: '🧹 เติมข้อมูลย้อนหลัง' }],
  [{ path: '/settings/health', label: '🩺 สถานะระบบ' }, { path: '/settings/errors', label: '⚠️ ข้อผิดพลาด' }, { path: '/settings/audit', label: '📜 ประวัติการใช้งาน' }],
  [{ path: '/integrations', label: '🔗 เชื่อมต่อ' }, { path: '/integrations/settings', label: '⚙️ ตั้งค่า' }, { path: '/integrations/webhooks', label: '🪝 Webhook' }],
  [{ path: '/migration', label: '📥 ย้ายข้อมูล' }, { path: '/migration/mapping', label: '🔀 จับคู่ข้อมูล' }, { path: '/migration/export', label: '📤 ส่งออก' }],
]

const clean = p => String(p || '').split('?')[0].replace(/\/+$/, '') || '/'

export function viewGroupFor(path) {
  const p = clean(path)
  return LINKED_VIEWS.find(g => g.some(v => v.path === p)) || null
}

// เมนูรองที่ถูกรวมเข้ากับเมนูหลักแล้ว — ซ่อนจากแถบเมนูซ้าย
export function isMergedPath(path) {
  const g = viewGroupFor(path)
  return !!g && g[0].path !== clean(path)
}

export function viewTabsHtml(path, canOpen = () => true) {
  const p = clean(path)
  const g = viewGroupFor(p)
  const views = g ? g.filter(v => v.path === p || canOpen(v.path)) : []
  if (views.length < 2) return ''
  return views.map(v => `<button type="button" class="view-tab${v.path === p ? ' active' : ''}" data-view="${v.path}"${v.path === p ? ' aria-current="page"' : ''}>${v.label}</button>`).join('')
}

let started = false
export function initViewTabs({ navigate, canOpen = () => true } = {}) {
  if (started || typeof MutationObserver === 'undefined') return
  started = true
  const ensure = () => {
    const main = document.getElementById('main-content')
    if (!main) return
    const html = viewTabsHtml(window.location.pathname, canOpen)
    const bar = main.querySelector('.view-tabs')
    if (!html) { bar?.remove(); return }
    if (bar && bar.dataset.for === window.location.pathname) return
    bar?.remove()
    const header = main.querySelector('.page-header')
    if (!header) return
    const div = document.createElement('div')
    div.className = 'view-tabs' + ((html.match(/data-view=/g) || []).length > 3 ? ' many' : '')
    div.setAttribute('role', 'tablist')
    div.dataset.for = window.location.pathname
    div.innerHTML = html
    div.addEventListener('click', e => {
      const b = e.target.closest('[data-view]')
      if (b && !b.classList.contains('active')) navigate?.(b.dataset.view)
    })
    header.insertAdjacentElement('afterend', div)
  }
  let t = null
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(ensure, 60) })
    .observe(document.body, { childList: true, subtree: true })
}
