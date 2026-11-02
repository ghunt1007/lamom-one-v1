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
