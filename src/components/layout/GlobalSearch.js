// Global Search (Ctrl+K) — ค้นหาทุกอย่างในระบบเหมือน LAMOM V8
// พิมพ์ครั้งเดียว → ค้นข้อมูลข้ามทุก collection + เมนู แล้วกด Enter เพื่อเปิด
import { listDocs, seedDemoData } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { formatCurrency } from '../../utils/format.js'

// แต่ละ collection: วิธีดึงข้อความค้นหา + แสดงผล + ปลายทางเมื่อคลิก
const SOURCES = [
  { col: 'bookings', icon: '📝', group: 'ใบจอง', route: '/crm/bookings',
    text: b => [b.bookingNo, b.custName, b.brand, b.model, b.variant, b.vin, b.phone, b.salesName].join(' '),
    title: b => (b.bookingNo || '') + ' · ' + (b.custName || ''),
    sub: b => [b.brand, b.model, b.variant].filter(Boolean).join(' ') + ' · ' + (b.status || '') + ' · ' + formatCurrency(b.price) },
  { col: 'customers', icon: '👤', group: 'ลูกค้า', route: '/crm/customers',
    text: c => [c.firstName, c.lastName, c.phone, c.email, c.lineId, c.interestedModel].join(' '),
    title: c => [c.firstName, c.lastName].filter(Boolean).join(' '),
    sub: c => (c.phone || '') + (c.interestedModel ? ' · สนใจ ' + c.interestedModel : '') },
  { col: 'vehicles', icon: '🚗', group: 'สต็อกรถ', route: '/dms/stock',
    text: v => [v.brand, v.model, v.variant, v.color, v.vin, v.status, v.location].join(' '),
    title: v => [v.brand, v.model, v.variant].filter(Boolean).join(' '),
    sub: v => (v.color || '') + ' · ' + (v.vin || '') + ' · ' + (v.status || '') },
  { col: 'staff', icon: '🧑‍💼', group: 'พนักงาน', route: '/hr/staff',
    text: s => [s.firstName, s.lastName, s.nickname, s.dept, s.role, s.phone, s.email].join(' '),
    title: s => [s.firstName, s.lastName].filter(Boolean).join(' ') + (s.nickname ? ' (' + s.nickname + ')' : ''),
    sub: s => (s.dept || '') + ' · ' + (s.role || '') },
  { col: 'job_cards', icon: '🔧', group: 'Job Card', route: '/service/jobs',
    text: j => [j.jobNo, j.custName, j.brand, j.model, j.plate, j.vin, j.desc, j.techName, j.status].join(' '),
    title: j => (j.jobNo || '') + ' · ' + (j.custName || ''),
    sub: j => [j.brand, j.model].filter(Boolean).join(' ') + ' · ' + (j.plate || '') + ' · ' + (j.status || '') },
  { col: 'parts', icon: '⚙️', group: 'อะไหล่', route: '/service/parts',
    text: p => [p.sku, p.name, p.brand, p.category, p.location].join(' '),
    title: p => (p.name || ''),
    sub: p => (p.sku || '') + ' · คงเหลือ ' + (p.qty || 0) + ' ' + (p.unit || '') },
  { col: 'insurance_policies', icon: '🛡️', group: 'ประกันภัย', route: '/insurance',
    text: p => [p.policyNo, p.custName, p.brand, p.model, p.plate, p.insurer, p.type].join(' '),
    title: p => (p.policyNo || '') + ' · ' + (p.custName || ''),
    sub: p => (p.insurer || '') + ' · ' + (p.type || '') + ' · ' + (p.status || '') },
  { col: 'tasks', icon: '✅', group: 'งาน', route: '/tasks',
    text: t => [t.title, t.desc, t.priority, t.status].join(' '),
    title: t => (t.title || ''),
    sub: t => (t.status || '') + ' · ' + (t.priority || '') },
]

// ดัชนีเมนู/หน้า สำหรับ jump ไปหน้าโดยตรง
const PAGES = [
  ['Dashboard ภาพรวม', '/', '📊'], ['ใบจองรถ', '/crm/bookings', '📝'], ['ลูกค้า', '/crm/customers', '👤'],
  ['Lead', '/crm/leads', '🎯'], ['Pipeline ขาย', '/crm/pipeline', '📈'], ['ทดลองขับ', '/crm/testdrive', '🚗'],
  ['สต็อกรถ', '/dms/stock', '🚙'], ['สั่งรถใหม่', '/dms/orders', '📦'], ['PDI ตรวจรถ', '/dms/pdi', '🔍'],
  ['Job Card บริการ', '/service/jobs', '🔧'], ['อะไหล่', '/service/parts', '⚙️'],
  ['กำไร Margin', '/finance/margin', '💰'], ['คอมมิชชั่น', '/finance/commission', '💵'],
  ['กฎคอมมิชชั่น', '/finance/commission-rules', '📐'], ['งบประมาณ', '/finance/budget', '🧮'],
  ['เงินเดือน Payroll', '/finance/payroll', '🧾'], ['สลิปเงินเดือน', '/finance/payroll-detail', '🧾'],
  ['เป้า vs จริง', '/finance/target-actual', '🎯'], ['กำไรขาดทุน P&L', '/finance/pl', '📑'],
  ['โปรโมชั่นส่งเสริมการขาย', '/marketing/promotions', '🎁'], ['อีเว้นท์', '/marketing/events', '🎪'],
  ['Action Plan ขาย', '/finance/target-actual', '🗂️'], ['พยากรณ์ยอดขาย', '/analytics/forecast', '🔮'],
  ['พนักงาน', '/hr/staff', '🧑‍💼'], ['ตรวจรถก่อนส่งมอบ', '/service/inspection', '✅'],
  ['ใบส่งมอบรถ', '/dms/delivery', '🚚'], ['ประกันภัย', '/insurance', '🛡️'], ['งาน Tasks', '/tasks', '✅'],
  ['เอกสาร', '/documents', '📄'], ['ตั้งค่า', '/settings', '⚙️'], ['Master Data', '/settings/master-data', '🗃️'],
]

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
        '<input type="text" id="gsearch-input" placeholder="ค้นหาลูกค้า · ใบจอง · รถ · อะไหล่ · พนักงาน · เมนู..." ' +
          'style="border:none;background:transparent;font-size:1rem;flex:1;outline:none;color:var(--text);font-family:var(--font-main)" autocomplete="off">' +
        '<span class="topbar-search-kbd" style="cursor:pointer" id="gsearch-esc">Esc</span>' +
      '</div>' +
      '<div id="gsearch-results" style="max-height:62vh;overflow:auto;padding:6px"></div>' +
      '<div style="padding:6px 14px;border-top:1px solid var(--border);font-size:0.7rem;color:var(--text-muted);display:flex;gap:14px">' +
        '<span>↑↓ เลื่อน</span><span>↵ เปิด</span><span>Esc ปิด</span>' +
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

    // หน้า/เมนู
    PAGES.forEach(([label, route, icon]) => {
      if (matchAll(label)) results.push({ type: 'page', icon, group: 'เมนู', title: label, sub: route, route })
    })

    // ข้อมูลในแต่ละ collection — ดึงขนานกันทุก collection พร้อมกัน
    const fetched = await Promise.all(
      SOURCES.map(src => listDocs(src.col, [], 'createdAt', 'desc', 500).catch(() => []))
    )
    SOURCES.forEach((src, i) => {
      fetched[i].forEach(r => {
        if (matchAll(src.text(r))) {
          results.push({ type: 'data', icon: src.icon, group: src.group, title: src.title(r) || '(ไม่มีชื่อ)', sub: src.sub(r), route: src.route })
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
      '<div style="padding:4px"><div style="font-size:0.7rem;color:var(--text-muted);padding:6px 10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">ไปที่หน้า</div>' +
      PAGES.slice(0, 10).map((p, i) => rowHtml({ icon: p[2], title: p[0], sub: p[1], group: 'เมนู' }, i)).join('') +
      '</div>'
    resultsCache = PAGES.slice(0, 10).map(p => ({ type: 'page', icon: p[2], title: p[0], sub: p[1], route: p[1] }))
    activeIdx = 0
    bindRows()
  }

  function renderResults(q) {
    if (!resultsCache.length) {
      resBox.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem">🔍</div><div style="margin-top:8px">ไม่พบ "' + escAttr(q) + '"</div></div>'
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
