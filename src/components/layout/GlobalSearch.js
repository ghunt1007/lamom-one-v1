// Global Search (Ctrl+K) — ค้นหาทุกอย่างในระบบเหมือน LAMOM V8
// พิมพ์ครั้งเดียว → ค้นข้อมูลข้ามทุก collection + เมนู แล้วกด Enter เพื่อเปิด
import { listDocs, seedDemoData } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { formatCurrency } from '../../utils/format.js'
import { getState } from '../../core/store.js'
import { t as tr } from '../../i18n/index.js'
// (v1.0.354) t เป็นชื่อ parameter ของ SOURCES/tasks item ในไฟล์นี้อยู่แล้ว (เช่น t => t.title) เปลี่ยนชื่อ
// import เป็น tr กันชนกับ t local variable ในหลายจุดของไฟล์นี้

// แต่ละ collection: วิธีดึงข้อความค้นหา + แสดงผล + ปลายทางเมื่อคลิก (groupKey อ้าง i18n key แปลชื่อกลุ่ม)
const SOURCES = [
  { col: 'bookings', icon: '📝', groupKey: 'grpBookings', route: '/crm/bookings',
    text: b => [b.bookingNo, b.custName, b.brand, b.model, b.variant, b.vin, b.phone, b.salesName].join(' '),
    title: b => (b.bookingNo || '') + ' · ' + (b.custName || ''),
    sub: b => [b.brand, b.model, b.variant].filter(Boolean).join(' ') + ' · ' + (b.status || '') + ' · ' + formatCurrency(b.price) },
  { col: 'customers', icon: '👤', groupKey: 'grpCustomers', route: '/crm/customers',
    text: c => [c.firstName, c.lastName, c.phone, c.email, c.lineId, c.interestedModel].join(' '),
    title: c => [c.firstName, c.lastName].filter(Boolean).join(' '),
    sub: c => (c.phone || '') + (c.interestedModel ? ' · สนใจ ' + c.interestedModel : '') },
  { col: 'vehicles', icon: '🚗', groupKey: 'grpStock', route: '/dms/stock',
    text: v => [v.brand, v.model, v.variant, v.color, v.vin, v.status, v.location].join(' '),
    title: v => [v.brand, v.model, v.variant].filter(Boolean).join(' '),
    sub: v => (v.color || '') + ' · ' + (v.vin || '') + ' · ' + (v.status || '') },
  { col: 'staff', icon: '🧑‍💼', groupKey: 'grpStaff', route: '/hr/staff',
    text: s => [s.firstName, s.lastName, s.nickname, s.dept, s.role, s.phone, s.email].join(' '),
    title: s => [s.firstName, s.lastName].filter(Boolean).join(' ') + (s.nickname ? ' (' + s.nickname + ')' : ''),
    sub: s => (s.dept || '') + ' · ' + (s.role || '') },
  { col: 'job_cards', icon: '🔧', group: 'Job Card', route: '/service/jobs',
    text: j => [j.jobNo, j.custName, j.brand, j.model, j.plate, j.vin, j.desc, j.techName, j.status].join(' '),
    title: j => (j.jobNo || '') + ' · ' + (j.custName || ''),
    sub: j => [j.brand, j.model].filter(Boolean).join(' ') + ' · ' + (j.plate || '') + ' · ' + (j.status || '') },
  { col: 'parts', icon: '⚙️', groupKey: 'grpParts', route: '/service/parts',
    text: p => [p.sku, p.name, p.brand, p.category, p.location].join(' '),
    title: p => (p.name || ''),
    sub: p => (p.sku || '') + ' · คงเหลือ ' + (p.qty || 0) + ' ' + (p.unit || '') },
  { col: 'insurance_policies', icon: '🛡️', groupKey: 'grpInsurance', route: '/insurance',
    text: p => [p.policyNo, p.custName, p.brand, p.model, p.plate, p.insurer, p.type].join(' '),
    title: p => (p.policyNo || '') + ' · ' + (p.custName || ''),
    sub: p => (p.insurer || '') + ' · ' + (p.type || '') + ' · ' + (p.status || '') },
  { col: 'tasks', icon: '✅', groupKey: 'grpTasks', route: '/tasks',
    text: t => [t.title, t.desc, t.priority, t.status].join(' '),
    title: t => (t.title || ''),
    sub: t => (t.status || '') + ' · ' + (t.priority || '') },
]
function srcGroup(src) { return src.groupKey ? tr(src.groupKey) : src.group }

// ดัชนีเมนู/หน้า สำหรับ jump ไปหน้าโดยตรง — [label(ไทย, ใช้ค้นหาเสมอ), route, icon, labelEn, labelZh]
const PAGES = [
  ['Dashboard ภาพรวม', '/', '📊', 'Dashboard Overview', '仪表盘总览'],
  ['ใบจองรถ', '/crm/bookings', '📝', 'Bookings', '订车'],
  ['ลูกค้า', '/crm/customers', '👤', 'Customers', '客户'],
  ['Lead', '/crm/leads', '🎯', 'Lead', '潜在客户'],
  ['Pipeline ขาย', '/crm/pipeline', '📈', 'Sales Pipeline', '销售流程'],
  ['ทดลองขับ', '/crm/testdrive', '🚗', 'Test Drive', '试驾'],
  ['สต็อกรถ', '/dms/stock', '🚙', 'Stock', '库存'],
  ['สั่งรถใหม่', '/dms/orders', '📦', 'New Vehicle Orders', '新车订购'],
  ['PDI ตรวจรถ', '/dms/pdi', '🔍', 'PDI Inspection', 'PDI检查'],
  ['Job Card บริการ', '/service/jobs', '🔧', 'Service Job Card', '服务工单'],
  ['อะไหล่', '/service/parts', '⚙️', 'Parts', '配件'],
  ['กำไร Margin', '/finance/margin', '💰', 'Margin', '利润率'],
  ['คอมมิชชั่น', '/finance/commission', '💵', 'Commission', '提成'],
  ['กฎคอมมิชชั่น', '/finance/commission-rules', '📐', 'Commission Rules', '提成规则'],
  ['งบประมาณ', '/finance/budget', '🧮', 'Budget', '预算'],
  ['เงินเดือน Payroll', '/finance/payroll', '🧾', 'Payroll', '工资单'],
  ['สลิปเงินเดือน', '/finance/payroll-detail', '🧾', 'Payslip', '工资单明细'],
  ['เป้า vs จริง', '/finance/target-actual', '🎯', 'Target vs Actual', '目标 vs 实际'],
  ['กำไรขาดทุน P&L', '/finance/pl', '📑', 'P&L', '损益表'],
  ['โปรโมชั่นส่งเสริมการขาย', '/marketing/promotions', '🎁', 'Promotions', '促销活动'],
  ['อีเว้นท์', '/marketing/events', '🎪', 'Events', '活动'],
  ['Action Plan ขาย', '/finance/target-actual', '🗂️', 'Sales Action Plan', '销售行动计划'],
  ['พยากรณ์ยอดขาย', '/analytics/forecast', '🔮', 'Sales Forecast', '销售预测'],
  ['พนักงาน', '/hr/staff', '🧑‍💼', 'Staff', '员工'],
  ['ตรวจรถก่อนส่งมอบ', '/service/inspection', '✅', 'Pre-Delivery Inspection', '交车前检查'],
  ['ใบส่งมอบรถ', '/dms/delivery', '🚚', 'Delivery Note', '交车单'],
  ['ประกันภัย', '/insurance', '🛡️', 'Insurance', '保险'],
  ['งาน Tasks', '/tasks', '✅', 'Tasks', '任务'],
  ['เอกสาร', '/documents', '📄', 'Documents', '文档'],
  ['ตั้งค่า', '/settings', '⚙️', 'Settings', '设置'],
  ['Master Data', '/settings/master-data', '🗃️', 'Master Data', '主数据'],
]
// ค้นหาเทียบกับ label ภาษาไทยเสมอ (source of truth) แต่แสดงผลตามภาษาที่เลือกไว้
function pageLabel(p) {
  const lang = getState('language') || 'th'
  return (lang === 'en' ? p[3] : lang === 'zh' ? p[4] : null) || p[0]
}

function norm(s) { return String(s || '').toLowerCase() }

let resultsCache = []
let activeIdx = 0

export function openGlobalSearch() {
  const existing = document.getElementById('gsearch-overlay')
  if (existing) { existing.querySelector('#gsearch-input')?.focus(); return }

  seedDemoData()

  const div = document.createElement('div')
  div.id = 'gsearch-overlay'
  div.className = 'modal-overlay'
  div.style.cssText = 'align-items:flex-start;padding-top:8vh'
  div.innerHTML =
    '<div class="modal" style="max-width:640px;width:92%;overflow:hidden">' +
      '<div style="padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)">' +
        '<span style="font-size:1.1rem">🔍</span>' +
        '<input type="text" id="gsearch-input" placeholder="' + escAttr(tr('searchAllPlaceholder')) + '" ' +
          'style="border:none;background:transparent;font-size:1rem;flex:1;outline:none;color:var(--text);font-family:var(--font-main)" autocomplete="off">' +
        '<span class="topbar-search-kbd" style="cursor:pointer" id="gsearch-esc">Esc</span>' +
      '</div>' +
      '<div id="gsearch-results" style="max-height:62vh;overflow:auto;padding:6px"></div>' +
      '<div style="padding:6px 14px;border-top:1px solid var(--border);font-size:0.7rem;color:var(--text-muted);display:flex;gap:14px">' +
        '<span>' + tr('moveHint') + '</span><span>' + tr('openHint') + '</span><span>' + tr('closeHint') + '</span>' +
      '</div>' +
    '</div>'

  div.addEventListener('click', e => { if (e.target === div) close() })
  document.body.appendChild(div)

  const input = div.querySelector('#gsearch-input')
  const resBox = div.querySelector('#gsearch-results')
  div.querySelector('#gsearch-esc').addEventListener('click', close)

  function close() { div.remove() }

  let timer = null
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => doSearch(input.value), 120) })
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    if (e.key === 'Enter') { e.preventDefault(); openActive() }
  })

  async function doSearch(qRaw) {
    const q = norm(qRaw).trim()
    if (!q) { renderEmpty(); return }

    const terms = q.split(/\s+/)
    const matchAll = txt => { const t = norm(txt); return terms.every(term => t.includes(term)) }

    const results = []

    // หน้า/เมนู — ค้นหาเทียบกับชื่อภาษาไทย (source of truth) เสมอ แต่แสดงผลตามภาษาที่เลือกไว้
    PAGES.forEach(p => {
      const [label, route, icon] = p
      if (matchAll(label)) results.push({ type: 'page', icon, group: tr('grpMenu'), title: pageLabel(p), sub: route, route })
    })

    // ข้อมูลในแต่ละ collection — ดึงขนานกันทุก collection พร้อมกัน
    const fetched = await Promise.all(
      SOURCES.map(src => listDocs(src.col, [], 'createdAt', 'desc', 500).catch(() => []))
    )
    SOURCES.forEach((src, i) => {
      fetched[i].forEach(r => {
        if (matchAll(src.text(r))) {
          results.push({ type: 'data', icon: src.icon, group: srcGroup(src), title: src.title(r) || tr('noName'), sub: src.sub(r), route: src.route })
        }
      })
    })

    resultsCache = results.slice(0, 60)
    activeIdx = 0
    renderResults(qRaw)
  }

  function renderEmpty() {
    resultsCache = []
    resBox.innerHTML =
      '<div style="padding:4px"><div style="font-size:0.7rem;color:var(--text-muted);padding:6px 10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">' + tr('goToPage') + '</div>' +
      PAGES.slice(0, 10).map((p, i) => rowHtml({ icon: p[2], title: pageLabel(p), sub: p[1], group: tr('grpMenu') }, i)).join('') +
      '</div>'
    resultsCache = PAGES.slice(0, 10).map(p => ({ type: 'page', icon: p[2], title: pageLabel(p), sub: p[1], route: p[1] }))
    activeIdx = 0
    bindRows()
  }

  function renderResults(q) {
    if (!resultsCache.length) {
      resBox.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem">🔍</div><div style="margin-top:8px">' + escAttr(tr('noResultsFor')) + ' "' + escAttr(q) + '"</div></div>'
      return
    }
    // จัดกลุ่มตาม group
    const groups = {}
    resultsCache.forEach((r, i) => { (groups[r.group] = groups[r.group] || []).push({ r, i }) })
    resBox.innerHTML = Object.keys(groups).map(g =>
      '<div style="font-size:0.7rem;color:var(--text-muted);padding:8px 10px 4px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">' + g + ' (' + groups[g].length + ')</div>' +
      groups[g].map(({ r, i }) => rowHtml(r, i)).join('')
    ).join('')
    bindRows()
  }

  function rowHtml(r, i) {
    return '<div class="gsearch-row" data-idx="' + i + '" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer">' +
      '<span style="font-size:1.1rem;width:22px;text-align:center;flex-shrink:0">' + r.icon + '</span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.875rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(r.title) + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(r.sub || '') + '</div>' +
      '</div></div>'
  }

  function bindRows() {
    resBox.querySelectorAll('.gsearch-row').forEach(row => {
      const idx = Number(row.dataset.idx)
      row.addEventListener('mouseenter', () => { activeIdx = idx; highlight() })
      row.addEventListener('click', () => { activeIdx = idx; openActive() })
    })
    highlight()
  }

  function highlight() {
    resBox.querySelectorAll('.gsearch-row').forEach(row => {
      const on = Number(row.dataset.idx) === activeIdx
      row.style.background = on ? 'var(--surface-2)' : 'transparent'
      if (on) row.scrollIntoView({ block: 'nearest' })
    })
  }

  function move(d) {
    if (!resultsCache.length) return
    activeIdx = (activeIdx + d + resultsCache.length) % resultsCache.length
    highlight()
  }

  function openActive() {
    const r = resultsCache[activeIdx]
    if (!r) return
    close()
    navigate(r.route)
  }

  renderEmpty()
  setTimeout(() => input.focus(), 50)
}

function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function escAttr(s) { return escHtml(s) }
