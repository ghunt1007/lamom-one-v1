// tableTools — เพิ่มการ "จัดเรียง + กรอง" แบบ Excel ให้ตาราง <table> ทุกตัวอัตโนมัติทั้งระบบ
// ใช้ MutationObserver ตรวจจับตารางที่เพิ่งถูก render แล้วเสริมให้เลย (ไม่ต้องแก้ทุกหน้า)
// ข้ามตารางที่ใส่ data-no-enhance="1" หรือไม่มี thead/tbody หรือแถวน้อยเกินไป

const TH_MON = { 'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12 }

function thaiDateKey(s) {
  const m = String(s).trim().match(/^(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})$/)
  if (!m) return null
  const mon = TH_MON[m[2]]
  if (!mon) return null
  return Number(m[3]) * 10000 + mon * 100 + Number(m[1])
}

function numKey(s) {
  const cleaned = String(s).replace(/[฿,%\s]/g, '').replace(/[^\d.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

function sortKey(text) {
  const d = thaiDateKey(text)
  if (d != null) return { n: d }
  const n = numKey(text)
  if (n != null) return { n }
  return { s: String(text).trim().toLowerCase() }
}

function cellText(tr, ci) {
  const c = tr.children[ci]
  return c ? c.textContent : ''
}

let styleInjected = false
function injectStyle() {
  if (styleInjected) return
  styleInjected = true
  const st = document.createElement('style')
  st.textContent =
    '.tt-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}' +
    '.tt-search{position:relative;display:flex;align-items:center}' +
    '.tt-search input{padding:4px 8px 4px 26px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:0.78rem;width:200px;font-family:var(--font-main)}' +
    '.tt-search span{position:absolute;left:8px;color:var(--text-muted);font-size:0.78rem;pointer-events:none}' +
    '.tt-btn{font-size:0.74rem;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer;font-family:var(--font-main)}' +
    '.tt-btn.on{background:var(--primary);color:#fff;border-color:var(--primary)}' +
    '.tt-info{font-size:0.72rem;color:var(--warning)}' +
    '.tt-th-sortable{cursor:pointer;user-select:none}' +
    '.tt-arrow{color:var(--primary);margin-left:3px;font-size:0.85em}' +
    '.tt-filter-row input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:4px;font-size:0.7rem;padding:2px 5px;background:var(--surface);color:var(--text);font-family:var(--font-main)}'
  document.head.appendChild(st)
}

export function enhanceTable(table) {
  if (!table || table.dataset.ttEnhanced || table.dataset.noEnhance === '1') return
  if (table.id === 'ss-table') return  // SmartSheet มี sort/filter ของตัวเองแล้ว
  const thead = table.querySelector(':scope > thead')
  const tbody = table.querySelector(':scope > tbody')
  if (!thead || !tbody) return
  const headerRows = [...thead.querySelectorAll(':scope > tr')]
  const headerRow = headerRows[headerRows.length - 1]
  if (!headerRow) return
  const ths = [...headerRow.children]
  const bodyRows = [...tbody.querySelectorAll(':scope > tr')]
  if (ths.length < 2 || bodyRows.length < 2) return  // เล็กเกินไป ไม่ต้องเสริม

  injectStyle()
  table.dataset.ttEnhanced = '1'

  // เก็บลำดับเดิมไว้ (สำหรับ reset dir=0)
  bodyRows.forEach((tr, i) => { tr.dataset.ttIdx = i })

  const state = { ci: -1, dir: 0, q: '', colFilters: {}, showFilter: false }

  // ── หัวคอลัมน์ = ปุ่มจัดเรียง ──
  ths.forEach((th, ci) => {
    if (th.dataset.noSort === '1') return
    th.classList.add('tt-th-sortable')
    if (!th.title) th.title = 'คลิกเพื่อจัดเรียง'
    const arrow = document.createElement('span')
    arrow.className = 'tt-arrow'
    arrow.dataset.ci = ci
    th.appendChild(arrow)
    th.addEventListener('click', ev => {
      if (ev.target.closest('input')) return
      if (state.ci !== ci) { state.ci = ci; state.dir = 1 }
      else state.dir = state.dir === 1 ? -1 : state.dir === -1 ? 0 : 1
      applySort(); updateArrows()
    })
  })

  function updateArrows() {
    thead.querySelectorAll('.tt-arrow').forEach(a => {
      a.textContent = (Number(a.dataset.ci) === state.ci) ? (state.dir === 1 ? '▲' : state.dir === -1 ? '▼' : '') : ''
    })
  }

  function applySort() {
    const rows = [...tbody.querySelectorAll(':scope > tr')]
    if (state.dir === 0) {
      rows.sort((a, b) => Number(a.dataset.ttIdx) - Number(b.dataset.ttIdx))
    } else {
      rows.sort((a, b) => {
        const ka = sortKey(cellText(a, state.ci)), kb = sortKey(cellText(b, state.ci))
        let r
        if (ka.n != null && kb.n != null) r = ka.n - kb.n
        else if (ka.n != null) r = -1
        else if (kb.n != null) r = 1
        else r = (ka.s < kb.s ? -1 : ka.s > kb.s ? 1 : 0)
        return r * state.dir
      })
    }
    rows.forEach(r => tbody.appendChild(r))
  }

  // ── แถวกรองต่อคอลัมน์ (ซ่อนไว้ก่อน) ──
  const filterRow = document.createElement('tr')
  filterRow.className = 'tt-filter-row'
  filterRow.style.display = 'none'
  ths.forEach((th, ci) => {
    const fth = document.createElement('th')
    fth.style.cssText = 'padding:2px 3px;background:var(--surface-2)'
    if (th.dataset.noFilter !== '1') {
      const inp = document.createElement('input')
      inp.placeholder = 'กรอง...'
      inp.dataset.ci = ci
      inp.addEventListener('click', e => e.stopPropagation())
      inp.addEventListener('input', () => { state.colFilters[ci] = inp.value.trim().toLowerCase(); applyFilter() })
      fth.appendChild(inp)
    }
    filterRow.appendChild(fth)
  })
  thead.appendChild(filterRow)

  function applyFilter() {
    const q = state.q
    const cf = Object.entries(state.colFilters).filter(([, v]) => v)
    let shown = 0
    const rows = [...tbody.querySelectorAll(':scope > tr')]
    rows.forEach(tr => {
      const txt = tr.textContent.toLowerCase()
      let ok = !q || txt.includes(q)
      if (ok && cf.length) ok = cf.every(([ci, v]) => cellText(tr, Number(ci)).toLowerCase().includes(v))
      tr.style.display = ok ? '' : 'none'
      if (ok) shown++
    })
    if (info) info.textContent = (shown !== rows.length) ? ('แสดง ' + shown + '/' + rows.length) : ''
  }

  // ── แถบเครื่องมือ (ค้นหา + ปุ่มกรอง) วางก่อนตาราง ──
  const toolbar = document.createElement('div')
  toolbar.className = 'tt-toolbar'
  toolbar.innerHTML =
    '<div class="tt-search"><span>🔍</span><input type="text" placeholder="ค้นหาในตาราง..."></div>' +
    '<button class="tt-btn" type="button">🔽 ตัวกรองคอลัมน์</button>' +
    '<span class="tt-info"></span>'
  const searchInput = toolbar.querySelector('input')
  const filterBtn = toolbar.querySelector('.tt-btn')
  const info = toolbar.querySelector('.tt-info')

  searchInput.addEventListener('input', () => { state.q = searchInput.value.trim().toLowerCase(); applyFilter() })
  filterBtn.addEventListener('click', () => {
    state.showFilter = !state.showFilter
    filterRow.style.display = state.showFilter ? '' : 'none'
    filterBtn.classList.toggle('on', state.showFilter)
    if (!state.showFilter) {
      state.colFilters = {}
      filterRow.querySelectorAll('input').forEach(i => i.value = '')
      applyFilter()
    }
  })

  // วาง toolbar เหนือตาราง (รองรับทั้งใน .table-wrap และ table เดี่ยว)
  const host = table.parentElement
  if (host) host.insertBefore(toolbar, table)
}

// เสริมตารางที่มีอยู่แล้วทั้งหมดในโหนด
function enhanceAllIn(root) {
  if (!root) return
  const tables = root.matches?.('table') ? [root] : [...(root.querySelectorAll?.('table') || [])]
  tables.forEach(t => {
    if (t.closest('#__lamom_print_frame')) return
    try { enhanceTable(t) } catch (e) {}
  })
}

let observer = null
export function initAutoTableTools() {
  // เสริมของที่มีอยู่ตอนนี้
  enhanceAllIn(document.body)
  if (observer) return
  let pending = false
  const pendingNodes = []
  observer = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes && m.addedNodes.forEach(n => { if (n.nodeType === 1) pendingNodes.push(n) }))
    if (pending) return
    pending = true
    requestAnimationFrame(() => {
      pending = false
      pendingNodes.splice(0).forEach(n => enhanceAllIn(n))
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
