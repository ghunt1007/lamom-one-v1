import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { navigate } from '../../core/router.js'
import { pickVehicle } from '../../utils/vehiclePicker.js'
import { getSalesStaff, getColors, getFinanceCompanies, getFinanceStatus, getCampaigns, getBookingStatus, getLeadSources } from '../../data/masterData.js'
import { printBooking, printCancellation } from '../../utils/bookingDocs.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── แบรนด์หลักที่ตัวแทนขาย (ตาม LAMOM V8 — S.K. Bangbuathong) ──────────────
const BRANDS = ['DEEPAL', 'AION', 'OMODA & JAECOO', 'SUZUKI', 'NISSAN']
const BRAND_COLORS = { DEEPAL: '#5b9bff', AION: '#10b981', 'OMODA & JAECOO': '#f59e0b', SUZUKI: '#ef4444', NISSAN: '#8b5cf6' }
const BRAND_ICONS = { DEEPAL: '🔵', AION: '🟢', 'OMODA & JAECOO': '🟡', SUZUKI: '🔴', NISSAN: '🟣' }

function detectBrand(brand, model) {
  const b = (brand || '').toLowerCase()
  if (b.includes('deepal')) return 'DEEPAL'
  if (b.includes('aion')) return 'AION'
  if (b.includes('omoda') || b.includes('jaecoo')) return 'OMODA & JAECOO'
  if (b.includes('suzuki')) return 'SUZUKI'
  if (b.includes('nissan')) return 'NISSAN'
  const m = (model || '').toUpperCase()
  if (/LUMIN|S05|S07|E07|L07|HUNTER|Q05|DEEPAL/.test(m)) return 'DEEPAL'
  if (/AION|HYPTEC|HYPERTEC/.test(m)) return 'AION'
  if (/OMODA|JAECOO/.test(m)) return 'OMODA & JAECOO'
  if (/SWIFT|CIAZ|ERTIGA|XL7|FRONX|CARRY/.test(m)) return 'SUZUKI'
  if (/ALMERA|KICKS|X-TRAIL|XTRAIL|TERRA|NAVARA/.test(m)) return 'NISSAN'
  return brand || ''
}
function brandBadge(brand) {
  if (!brand) return ''
  const c = BRAND_COLORS[brand] || 'var(--text-muted)'
  const ic = BRAND_ICONS[brand] || '🏷️'
  return `<span style="display:inline-flex;align-items:center;gap:3px;background:${c}22;color:${c};border:1px solid ${c}44;border-radius:10px;padding:1px 7px;font-size:0.62rem;font-weight:700;white-space:nowrap">${ic} ${escHtml(brand)}</span>`
}

// ── สถานะใบจอง (pipeline แบบ LAMOM V8) ─────────────────────────────────────
const STATUS_COLORS = {
  'ส่งมอบแล้ว': '#10b981', 'ถอนจอง': '#ef4444', 'ยกเลิก': '#ef4444', 'รอส่งมอบ': '#f59e0b',
  'ตัดตัวเลขรอส่งมอบ': '#06b6d4', 'รอผลไฟแนนซ์': '#3b82f6', 'รอรถ': '#8b5cf6',
  'ยอดจองคงค้าง': '#6b7280', 'จัดไฟแนนซ์ก่อนจอง': '#f97316',
}
function statusBadge(status) {
  const c = STATUS_COLORS[status] || '#6b7280'
  return `<span style="font-size:0.68rem;font-weight:700;padding:2px 9px;border-radius:10px;background:${c}22;color:${c};border:1px solid ${c}55;white-space:nowrap">${escHtml(status || '—')}</span>`
}
const TERMINAL_STATUSES = ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ', 'ถอนจอง', 'ยกเลิก']
const ACTIVE_PIPELINE = ['ยอดจองคงค้าง', 'จัดไฟแนนซ์ก่อนจอง', 'รอผลไฟแนนซ์', 'รอรถ', 'รอส่งมอบ']

const DEMO_BOOKINGS = [
  { id: 'bk1', bookingNo: 'SK2506001', custName: 'ธีรพงศ์ แสงทอง', phone: '0812345678', province: 'กรุงเทพฯ', source: 'Walk-in',
    brand: 'DEEPAL', model: 'S07', variant: 'New Standard', colorOut: 'ขาว Pearl', colorIn: 'ดำ',
    price: 1299000, cost: 1150000, down: 200000, financeCo: 'BAY', financeAmount: 1099000, finStatus: 'ผ่าน', installments: 60, interestRate: 2.25, monthly: 19800,
    margin: 25000, budgetUsed: 5000, com70: 8000, comFinance: 6000, marginLeft: 20000, totalIncome: 34000,
    bookingDate: '2026-06-20', deliveryDate: '2026-07-01', actualDeliveryDate: '',
    salesName: 'อรนุช เซลส์ดี', status: 'รอส่งมอบ', notes: '', createdAt: '2026-06-20' },
]

function calcMonthly(financeAmount, installments, ratePerYear) {
  if (!financeAmount || !installments) return 0
  const years = installments / 12
  const total = financeAmount * (1 + (ratePerYear / 100) * years)
  return Math.round(total / installments)
}

export default async function BookingsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let bookings = []
  let statusFilter = ''
  let brandFilter = ''
  let sellerFilter = ''
  let search = ''
  let dateFrom = ''
  let dateTo = ''
  const selectedIds = new Set()

  async function loadData() {
    try { bookings = await listDocs('bookings', [], 'createdAt', 'desc', 500) } catch (e) {}
    if (!bookings.length) bookings = DEMO_BOOKINGS.map(b => ({ ...b }))
    if (container.__routerGen === myGen) render()
  }

  function matchesFilters(b, { ignoreStatus = false } = {}) {
    if (dateFrom && (b.bookingDate || '') < dateFrom) return false
    if (dateTo && (b.bookingDate || '') > dateTo) return false
    if (sellerFilter && b.salesName !== sellerFilter) return false
    if (brandFilter && detectBrand(b.brand, b.model) !== brandFilter) return false
    if (!ignoreStatus && statusFilter && b.status !== statusFilter) return false
    if (search) {
      const hay = [b.bookingNo, b.custName, b.brand, b.model, b.salesName, b.phone, b.nid].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  }
  function getFiltered() {
    return bookings.filter(b => matchesFilters(b)).sort((a, b) => (b.bookingDate || '').localeCompare(a.bookingDate || ''))
  }
  function getStatusCounts() {
    const counts = {}
    bookings.filter(b => matchesFilters(b, { ignoreStatus: true })).forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1 })
    return counts
  }

  function dayDiff(dateStr) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
    return Math.round((d - today) / 86400000)
  }
  function isUrgent(b) {
    if (TERMINAL_STATUSES.includes(b.status) || !b.deliveryDate) return false
    return dayDiff(b.deliveryDate) <= 3
  }
  function rowStyle(b) {
    if (TERMINAL_STATUSES.includes(b.status) || !b.deliveryDate) return ''
    const diff = dayDiff(b.deliveryDate)
    if (diff < 0) return 'background:rgba(239,68,68,.07);border-left:3px solid rgba(239,68,68,.65);'
    if (diff <= 3) return 'background:rgba(245,158,11,.07);border-left:3px solid rgba(245,158,11,.65);'
    return ''
  }
  function deliveryCell(b) {
    if (!b.deliveryDate) return '<span style="color:var(--text-muted);opacity:.5">—</span>'
    if (b.status === 'ส่งมอบแล้ว') return `<span style="color:var(--success)">${formatDate(b.deliveryDate)}</span>`
    const diff = dayDiff(b.deliveryDate)
    const clr = diff < 0 ? 'var(--danger)' : diff <= 3 ? 'var(--warning)' : 'var(--success)'
    const lbl = diff < 0 ? `เลย ${Math.abs(diff)}วัน` : diff === 0 ? 'วันนี้!' : `${diff}วัน`
    return `${formatDate(b.deliveryDate)}<div style="font-size:0.62rem;font-weight:700;color:${clr}">📅 ${lbl}</div>`
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    const filtered = getFiltered()
    const statusCounts = getStatusCounts()
    const statusTotal = Object.values(statusCounts).reduce((s, n) => s + n, 0)
    const activeAll = bookings.filter(b => ACTIVE_PIPELINE.includes(b.status))
    const pipelineVal = activeAll.reduce((s, b) => s + (b.price || 0), 0)
    const curMonth = new Date().toISOString().slice(0, 7)
    const delMonth = bookings.filter(b => TERMINAL_STATUSES.slice(0, 2).includes(b.status) && (b.cutDate || b.deliveryDate || '').startsWith(curMonth)).length
    const urgentCount = bookings.filter(isUrgent).length
    const deliveredAll = bookings.filter(b => b.status === 'ส่งมอบแล้ว')
    const activeNonTerminal = bookings.filter(b => !['ถอนจอง', 'ยกเลิก', 'ส่งมอบแล้ว'].includes(b.status))

    const statusActs = ['ทั้งหมด'].concat(getBookingStatus())
    const stChips = `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <span style="font-size:0.68rem;font-weight:600;color:var(--text-muted);white-space:nowrap;margin-right:2px">📊 สถานะ:</span>
      ${statusActs.map(s => {
        const isAll = s === 'ทั้งหมด'
        const isActive = isAll ? (statusFilter === '') : statusFilter === s
        const c = isAll ? 'var(--primary)' : (STATUS_COLORS[s] || '#6b7280')
        const cnt = isAll ? statusTotal : (statusCounts[s] || 0)
        return `<span class="bk-status-chip" data-s="${escHtml(isAll ? '' : s)}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;cursor:pointer;font-size:0.68rem;font-weight:${isActive ? 700 : 500};border:1.5px solid ${isActive ? c : c + '55'};background:${isActive ? c + '18' : 'transparent'};color:${isActive ? c : 'var(--text-2)'};white-space:nowrap">
          ${isAll ? '' : `<span style="width:6px;height:6px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span>`}${escHtml(s)}<span style="opacity:.7">(${cnt})</span>${isActive && !isAll ? '<span style="opacity:.55">×</span>' : ''}
        </span>`
      }).join('')}
    </div>`

    const statsBar = `<div style="display:flex;gap:16px;flex-wrap:wrap;padding:6px 12px;background:var(--surface-2);border-radius:8px;margin-bottom:10px;font-size:0.68rem;color:var(--text-2)">
      <span>📋 ทั้งหมด <b style="color:var(--text-primary)">${bookings.length}</b></span>
      <span>🔄 Active <b style="color:var(--warning)">${activeAll.length}</b></span>
      ${pipelineVal > 0 ? `<span>💰 Pipeline <b style="color:var(--success)">${formatCurrency(pipelineVal / 1000000)}M</b></span>` : ''}
      <span>🚗 ส่งมอบเดือนนี้ <b style="color:var(--success)">${delMonth}</b></span>
      ${urgentCount > 0 ? `<span>🔥 ด่วน <b style="color:var(--danger)">${urgentCount}</b></span>` : ''}
    </div>`

    const brandsWithBookings = BRANDS.filter(br => bookings.some(b => detectBrand(b.brand, b.model) === br))
    const brandKpi = brandsWithBookings.map(br => {
      const c = BRAND_COLORS[br]
      const ic = BRAND_ICONS[br]
      const del = deliveredAll.filter(b => detectBrand(b.brand, b.model) === br).length
      const act = activeNonTerminal.filter(b => detectBrand(b.brand, b.model) === br).length
      const isActive = brandFilter === br
      return `<div class="bk-brand-card" data-br="${escHtml(isActive ? '' : br)}" style="display:flex;flex-direction:column;align-items:center;min-width:90px;padding:8px 12px;border-radius:10px;cursor:pointer;background:${isActive ? c + '22' : 'var(--surface-2)'};border:1.5px solid ${isActive ? c : 'var(--border)'};transition:all .2s">
        <div style="font-size:0.62rem;font-weight:800;color:${c};margin-bottom:2px">${ic} ${escHtml(br)}</div>
        <div style="font-size:1rem;font-weight:900;color:${c}">${del}</div>
        <div style="font-size:0.58rem;color:var(--text-muted)">ส่ง · <span style="color:var(--warning)">${act}</span> active</div>
      </div>`
    }).join('')

    const bulkBar = selectedIds.size ? `<div class="card" style="padding:8px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;background:var(--primary-dim)">
      <span style="font-size:0.78rem;font-weight:700;color:var(--primary)">✅ เลือก ${selectedIds.size} รายการ</span>
      <button class="btn btn-secondary btn-xs" id="bk-bulk-export">📥 Export ที่เลือก</button>
      <button class="btn btn-ghost btn-xs" id="bk-bulk-clear">✕ ยกเลิกการเลือก</button>
    </div>` : ''

    const sellerOpts = `<option value="">ทุกเซลล์</option>` + getSalesStaff().map(s => `<option value="${escHtml(s)}" ${s === sellerFilter ? 'selected' : ''}>${escHtml(s)}</option>`).join('')
    const brandOpts = `<option value="">🏷️ ทุกแบรนด์</option>` + BRANDS.map(br => `<option value="${escHtml(br)}" ${br === brandFilter ? 'selected' : ''}>${BRAND_ICONS[br]} ${escHtml(br)}</option>`).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">ยอดจอง / ยอดขาย${urgentCount > 0 && window._bkUrgentOnly ? ' <span style="font-size:0.7rem;background:rgba(239,68,68,.15);color:var(--danger);border:1px solid rgba(239,68,68,.4);border-radius:6px;padding:1px 7px;vertical-align:middle;font-weight:700">🔥 เฉพาะด่วน</span>' : ''}</div>
            <div class="page-subtitle">แสดง ${filtered.length} / ${bookings.length} รายการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="bk-wizard-btn">✨ จองใหม่ (Wizard)</button>
          </div>
        </div>

        <div class="card mb-4" style="padding:10px 14px">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <select class="input" id="bk-f-seller" style="width:auto;font-size:0.76rem">${sellerOpts}</select>
            <select class="input" id="bk-f-brand" style="width:auto;font-size:0.76rem">${brandOpts}</select>
            <div style="position:relative;flex:1;min-width:180px">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.78rem">🔍</span>
              <input class="input" id="bk-search" placeholder="ค้นหาชื่อ/รุ่น/เลขจอง..." value="${escHtml(search)}" style="padding-left:30px;font-size:0.78rem">
            </div>
            <input type="date" class="input" id="bk-date-from" value="${dateFrom}" style="width:auto;font-size:0.76rem">
            <span style="font-size:0.7rem;color:var(--text-muted)">ถึง</span>
            <input type="date" class="input" id="bk-date-to" value="${dateTo}" style="width:auto;font-size:0.76rem">
            <button class="btn btn-secondary btn-xs" id="bk-refresh">🔄 รีเฟรช</button>
            <button class="btn btn-secondary btn-xs" id="bk-eod">📊 สรุปวัน</button>
            <button class="btn btn-secondary btn-xs" id="bk-export">📥 Export</button>
            <button class="btn btn-primary btn-sm" id="bk-add-btn">+ บันทึกจอง</button>
          </div>
        </div>

        ${stChips}
        ${statsBar}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:0 2px">${brandKpi}</div>
        ${bulkBar}
        <div id="bk-content"></div>
      </div>`

    renderTable(filtered)

    document.getElementById('bk-wizard-btn').addEventListener('click', () => openWizard())
    document.getElementById('bk-add-btn').addEventListener('click', () => openForm())
    document.getElementById('bk-search').addEventListener('input', ev => { search = ev.target.value.trim().toLowerCase(); render() })
    document.getElementById('bk-f-seller').addEventListener('change', ev => { sellerFilter = ev.target.value; render() })
    document.getElementById('bk-f-brand').addEventListener('change', ev => { brandFilter = ev.target.value; render() })
    document.getElementById('bk-date-from').addEventListener('change', ev => { dateFrom = ev.target.value; render() })
    document.getElementById('bk-date-to').addEventListener('change', ev => { dateTo = ev.target.value; render() })
    document.getElementById('bk-refresh').addEventListener('click', () => loadData())
    document.getElementById('bk-eod').addEventListener('click', () => openEodSummary())
    document.getElementById('bk-export').addEventListener('click', () => exportRows(filtered, 'bookings'))
    document.getElementById('bk-bulk-export')?.addEventListener('click', () => exportRows(bookings.filter(b => selectedIds.has(b.id)), 'bookings-selected'))
    document.getElementById('bk-bulk-clear')?.addEventListener('click', () => { selectedIds.clear(); render() })
    container.querySelectorAll('.bk-status-chip').forEach(chip => chip.addEventListener('click', () => { statusFilter = chip.dataset.s; render() }))
    container.querySelectorAll('.bk-brand-card').forEach(card => card.addEventListener('click', () => { brandFilter = card.dataset.br; render() }))
  }

  function exportRows(rows, fileTag) {
    exportToExcel(rows.map(b => ({
      เลขที่จอง: b.bookingNo, สถานะ: b.status, เซลส์: b.salesName, วันจอง: formatDate(b.bookingDate),
      กำหนดส่งมอบ: formatDate(b.deliveryDate), วันตัดตัวเลข: formatDate(b.cutDate), ส่งมอบจริง: formatDate(b.actualDeliveryDate),
      ลูกค้า: b.custName, เบอร์: b.phone, แบรนด์: detectBrand(b.brand, b.model), รุ่น: b.model + ' ' + (b.variant || ''),
      สีนอก: b.colorOut, สีใน: b.colorIn, แหล่งที่มา: b.source, ราคา: b.price, ไฟแนนซ์: b.financeCo, ยอดจัด: b.financeAmount,
      ค่างวด: b.monthly, ต้นทุน: b.cost, กำไรขั้นต้น: b.margin, รายได้รวม: b.totalIncome, หมายเหตุ: b.notes,
    })), fileTag + '-' + new Date().toISOString().slice(0, 10) + '.xlsx', 'ใบจอง')
    showToast('📥 Export แล้ว', 'success')
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  function renderTable(filtered) {
    const wrap = document.getElementById('bk-content')
    if (!wrap) return
    if (!filtered.length) { wrap.innerHTML = '<div class="empty-state" style="padding:48px"><div class="empty-icon">📋</div><div class="empty-title">ไม่มีรายการจอง</div><div class="empty-desc">กด "+ บันทึกจอง" หรือ "✨ จองใหม่ (Wizard)" เพื่อเพิ่มรายการใหม่</div></div>'; return }
    const allSelected = filtered.length > 0 && filtered.every(b => selectedIds.has(b.id))
    wrap.innerHTML = `<div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap"><table>
        <thead><tr>
          <th style="width:28px"><input type="checkbox" id="bk-select-all" ${allSelected ? 'checked' : ''}></th>
          <th>เลขจอง</th><th>สถานะ</th><th>เซลล์</th><th>วันที่จอง</th><th>กำหนดส่งมอบ</th>
          <th>วันที่ตัดตัวเลข</th><th>ส่งมอบจริง</th><th>ชื่อลูกค้า</th><th>รุ่นรถ</th>
          <th>สีภายนอก</th><th>สีภายใน</th><th>แหล่งที่มา</th><th></th>
        </tr></thead>
        <tbody>${filtered.map(b => tableRow(b)).join('')}</tbody>
      </table></div>
    </div>`

    document.getElementById('bk-select-all').addEventListener('change', ev => {
      filtered.forEach(b => { if (ev.target.checked) selectedIds.add(b.id); else selectedIds.delete(b.id) })
      render()
    })
    wrap.querySelectorAll('.bk-row-check').forEach(cb => cb.addEventListener('click', e => e.stopPropagation()))
    wrap.querySelectorAll('.bk-row-check').forEach(cb => cb.addEventListener('change', ev => {
      if (ev.target.checked) selectedIds.add(ev.target.dataset.id); else selectedIds.delete(ev.target.dataset.id)
      render()
    }))
    wrap.querySelectorAll('.bk-row').forEach(row => row.addEventListener('click', e => {
      if (e.target.closest('.bk-status-cell') || e.target.closest('input') || e.target.closest('.edit-bk') || e.target.closest('.print-bk') || e.target.closest('.copy-bk')) return
      openDetail(bookings.find(b => b.id === row.dataset.id))
    }))
    wrap.querySelectorAll('.bk-status-cell').forEach(cell => cell.addEventListener('click', e => openQuickStatus(cell.dataset.id, e)))
    wrap.querySelectorAll('.edit-bk').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openForm(bookings.find(b => b.id === btn.dataset.id)) }))
    wrap.querySelectorAll('.print-bk').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); printBooking(bookings.find(b => b.id === btn.dataset.id)) }))
    wrap.querySelectorAll('.copy-bk').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); copySummary(bookings.find(b => b.id === btn.dataset.id)) }))
  }

  function tableRow(b) {
    const br = detectBrand(b.brand, b.model)
    return `<tr class="bk-row" data-id="${b.id}" style="${rowStyle(b)}cursor:pointer">
      <td><input type="checkbox" class="bk-row-check" data-id="${b.id}" ${selectedIds.has(b.id) ? 'checked' : ''}></td>
      <td><span style="font-weight:700;color:var(--primary);font-size:0.76rem">${escHtml(b.bookingNo)}</span></td>
      <td class="bk-status-cell" data-id="${b.id}" style="cursor:pointer">${statusBadge(b.status)}<span style="font-size:0.6rem;opacity:.4;margin-left:2px">▼</span></td>
      <td><span class="badge badge-primary" style="font-size:0.66rem">${escHtml(b.salesName || '')}</span></td>
      <td style="font-size:0.72rem;white-space:nowrap">${formatDate(b.bookingDate)}</td>
      <td style="font-size:0.72rem;white-space:nowrap">${deliveryCell(b)}</td>
      <td style="font-size:0.72rem;white-space:nowrap">${b.cutDate ? `<span style="color:var(--warning);font-weight:600">${formatDate(b.cutDate)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="font-size:0.72rem;white-space:nowrap">${b.actualDeliveryDate ? `<span style="color:var(--success);font-weight:600">${formatDate(b.actualDeliveryDate)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="font-weight:600;font-size:0.8rem">${escHtml(b.custName || '—')}</td>
      <td style="font-size:0.78rem">${br ? brandBadge(br) + '<br>' : ''}${escHtml(b.model || '—')}</td>
      <td style="font-size:0.76rem">${b.colorOut ? escHtml(b.colorOut) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="font-size:0.76rem">${b.colorIn ? escHtml(b.colorIn) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="font-size:0.76rem">${b.source ? escHtml(b.source) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-xs edit-bk" data-id="${b.id}" title="แก้ไข">✏️</button>
        <button class="btn btn-ghost btn-xs print-bk" data-id="${b.id}" title="พิมพ์ใบจอง">🖨</button>
        <button class="btn btn-ghost btn-xs copy-bk" data-id="${b.id}" title="คัดลอกสรุป">📋</button>
      </td>
    </tr>`
  }

  // ── Quick status-change popover ──────────────────────────────────────────
  function openQuickStatus(bookingId, evt) {
    evt.stopPropagation()
    document.getElementById('bk-qk-pop')?.remove()
    const b = bookings.find(x => x.id === bookingId)
    if (!b) return
    const rect = evt.currentTarget.getBoundingClientRect()
    const pop = document.createElement('div')
    pop.id = 'bk-qk-pop'
    pop.style.cssText = 'position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);padding:6px;min-width:190px'
    let top = rect.bottom + 6
    if (top + 340 > window.innerHeight) top = Math.max(8, rect.top - 340)
    pop.style.top = top + 'px'
    pop.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px'
    pop.innerHTML = '<div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);padding:4px 8px 6px;letter-spacing:.5px;text-transform:uppercase">เปลี่ยนสถานะ</div>' +
      getBookingStatus().map(s => {
        const isCur = s === b.status
        const c = STATUS_COLORS[s] || '#6b7280'
        return `<div class="bk-qk-opt" data-s="${escHtml(s)}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;gap:8px;${isCur ? 'background:var(--surface-2);font-weight:700' : ''}">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0"></span>${escHtml(s)}${isCur ? '<span style="margin-left:auto;opacity:.6;font-size:0.7rem">✓</span>' : ''}
        </div>`
      }).join('')
    document.body.appendChild(pop)
    pop.querySelectorAll('.bk-qk-opt').forEach(opt => opt.addEventListener('click', async () => {
      const newStatus = opt.dataset.s
      pop.remove()
      if (newStatus === b.status) return
      try {
        await updateDocData('bookings', b.id, { status: newStatus, updatedAt: new Date().toISOString() })
        b.status = newStatus
        showToast(`✅ อัปเดตเป็น "${newStatus}" แล้ว`, 'success')
        render()
      } catch { showToast('อัปเดตไม่สำเร็จ', 'error') }
    }))
    setTimeout(() => {
      function onDocClick(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', onDocClick) } }
      document.addEventListener('click', onDocClick)
    }, 30)
  }

  function copySummary(b) {
    if (!b) return
    const lines = [
      `📋 สรุปการจอง #${b.bookingNo}`,
      `👤 ลูกค้า: ${b.custName || '—'}`,
      `🚗 รุ่น: ${(detectBrand(b.brand, b.model) ? detectBrand(b.brand, b.model) + ' ' : '') + (b.model || '—')}`,
      `💼 เซลส์: ${b.salesName || '—'}`,
      `📅 วันที่จอง: ${formatDate(b.bookingDate) || '—'}`,
      `📦 กำหนดส่ง: ${formatDate(b.deliveryDate) || '—'}`,
      `💰 ราคา: ${b.price ? formatCurrency(b.price) : '—'}`,
      `📊 สถานะ: ${b.status || '—'}`,
      b.notes ? `📝 หมายเหตุ: ${b.notes}` : '',
    ].filter(Boolean).join('\n')
    navigator.clipboard?.writeText(lines).then(() => showToast('📋 คัดลอกสรุปการจองแล้ว!', 'success')).catch(() => showToast('คัดลอกไม่สำเร็จ', 'error'))
  }

  // ── EOD summary (สรุปยอดประจำวัน) ────────────────────────────────────────
  function openEodSummary() {
    const todayStr = new Date().toISOString().slice(0, 10)
    const now = new Date()
    const thM = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const dateStr = `${now.getDate()} ${thM[now.getMonth()]} ${now.getFullYear() + 543}`
    const newToday = bookings.filter(b => (b.bookingDate || '') === todayStr)
    const delToday = bookings.filter(b => (b.actualDeliveryDate || '').slice(0, 10) === todayStr)
    const active = bookings.filter(b => !TERMINAL_STATUSES.includes(b.status))
    const bySt = {}
    active.forEach(b => { bySt[b.status] = (bySt[b.status] || 0) + 1 })
    const curMonth = todayStr.slice(0, 7)
    const monthBks = bookings.filter(b => (b.bookingDate || '').slice(0, 7) === curMonth)
    const monthDel = bookings.filter(b => (b.actualDeliveryDate || '').slice(0, 7) === curMonth)
    const urgent = bookings.filter(isUrgent)
    const lines = []
    lines.push('📊 สรุปยอดประจำวัน')
    lines.push('📅 ' + dateStr)
    lines.push('───────────────────')
    if (delToday.length) {
      lines.push(`✅ ส่งมอบวันนี้: ${delToday.length} คัน`)
      delToday.forEach(b => lines.push(`   • ${b.custName || b.bookingNo} — ${b.model || '—'} (${b.salesName || '—'})`))
      lines.push('')
    }
    if (newToday.length) {
      lines.push(`📝 จองใหม่วันนี้: ${newToday.length} คัน`)
      newToday.forEach(b => lines.push(`   • ${b.custName || b.bookingNo} — ${b.model || '—'} (${b.salesName || '—'})`))
      lines.push('')
    }
    lines.push(`📌 รายการ Active: ${active.length} คัน`)
    ACTIVE_PIPELINE.concat(['ตัดตัวเลขรอส่งมอบ']).forEach(s => { if (bySt[s]) lines.push(`   • ${s}: ${bySt[s]} คัน`) })
    lines.push('')
    if (urgent.length) {
      lines.push(`🔥 ด่วน ≤3 วัน: ${urgent.length} คัน`)
      urgent.forEach(b => {
        const diff = dayDiff(b.deliveryDate)
        const lbl = diff < 0 ? `เลย ${Math.abs(diff)}วัน` : diff === 0 ? 'วันนี้!' : `อีก ${diff} วัน`
        lines.push(`   🚨 ${b.custName || b.bookingNo} — ${b.model || ''} (${lbl})`)
      })
      lines.push('')
    }
    lines.push(`📦 เดือนนี้: จอง ${monthBks.length} · ส่งมอบ ${monthDel.length} คัน`)
    lines.push('───────────────────')
    lines.push('💙 LAMOM ONE')
    const msg = lines.join('\n')

    const { el } = openModal({
      title: '📊 สรุปยอดประจำวัน', size: 'sm',
      body: `<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.78rem;background:var(--surface-2);padding:12px;border-radius:8px;line-height:1.6;margin:0">${escHtml(msg)}</pre>`,
      footer: '<button class="btn btn-secondary" id="eod-close">ปิด</button><button class="btn btn-primary" id="eod-copy">📋 คัดลอก</button>',
    })
    el.querySelector('#eod-close').addEventListener('click', () => el.remove())
    el.querySelector('#eod-copy').addEventListener('click', () => {
      navigator.clipboard?.writeText(msg).then(() => showToast('📋 คัดลอกสรุปแล้ว!', 'success')).catch(() => showToast('คัดลอกไม่สำเร็จ', 'error'))
    })
  }

  // ── Booking Wizard (4 ขั้นตอน) ────────────────────────────────────────────
  function openWizard() {
    let step = 1
    const w = { custName: '', phone: '', salesName: getSalesStaff()[0] || '', brand: '', model: '', variant: '', price: 0, discount: 0, accessories: 0, down: 0, installments: 60, interestRate: 2.99 }
    const bkNo = 'SK' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + String(Math.floor(Math.random() * 900) + 100)
    const stepLabels = ['ข้อมูลลูกค้า', 'ราคา & รุ่น', 'ไฟแนนซ์', 'ยืนยัน']

    function total() { return (Number(w.price) || 0) - (Number(w.discount) || 0) + (Number(w.accessories) || 0) }
    function commission() { return Math.round(total() * 0.03) }
    function monthly() {
      const t = total()
      if (t <= w.down) return 0
      return Math.round((t - w.down) * (1 + (w.interestRate / 100) * (w.installments / 12)) / w.installments)
    }

    function stepsHtml() {
      return `<div style="display:flex;margin-bottom:14px;border-radius:8px;overflow:hidden">${stepLabels.map((l, i) => {
        const done = i + 1 < step, active = i + 1 === step
        const bg = done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--surface-2)'
        const tc = done || active ? '#fff' : 'var(--text-muted)'
        return `<div style="flex:1;text-align:center;padding:7px 4px;background:${bg};color:${tc};font-size:0.64rem;font-weight:700">${i + 1}. ${l}</div>`
      }).join('')}</div>`
    }

    function bodyHtml() {
      if (step === 1) {
        return `<div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="wz-cust" value="${escHtml(w.custName)}" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="wz-phone" value="${escHtml(w.phone)}" placeholder="0XX-XXX-XXXX"></div>
          <div class="input-group"><label class="input-label">พนักงานขาย</label><select class="input" id="wz-sales">${getSalesStaff().map(s => `<option ${s === w.salesName ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}</select></div>`
      }
      if (step === 2) {
        return `<button type="button" class="btn btn-secondary btn-sm" id="wz-pick" style="margin-bottom:10px">🚘 เลือกรถจาก Catalog</button>
          <div style="font-size:0.8rem;margin-bottom:8px">${w.model ? `<b>${escHtml(w.brand)} ${escHtml(w.model)}</b> ${escHtml(w.variant || '')}` : '<span style="color:var(--text-muted)">ยังไม่ได้เลือกรถ</span>'}</div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ราคาขาย (บาท)</label><input class="input" type="number" id="wz-price" value="${w.price}"></div>
            <div class="input-group"><label class="input-label">ส่วนลด (บาท)</label><input class="input" type="number" id="wz-disc" value="${w.discount}"></div>
          </div>
          <div class="input-group"><label class="input-label">อุปกรณ์เสริม (บาท)</label><input class="input" type="number" id="wz-acc" value="${w.accessories}"></div>
          <div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-top:6px;font-size:0.8rem">ยอดสุทธิ: <b style="color:var(--accent)">${formatCurrency(total())}</b> · ค่าคอมประมาณ (3%): <b style="color:var(--success)">${formatCurrency(commission())}</b></div>`
      }
      if (step === 3) {
        return `<div class="grid-2">
            <div class="input-group"><label class="input-label">เงินดาวน์ (บาท)</label><input class="input" type="number" id="wz-down" value="${w.down}"></div>
            <div class="input-group"><label class="input-label">ระยะผ่อน</label><select class="input" id="wz-install">${[24, 36, 48, 60, 72, 84].map(m => `<option value="${m}" ${m === w.installments ? 'selected' : ''}>${m} เดือน</option>`).join('')}</select></div>
          </div>
          <div class="input-group"><label class="input-label">ดอกเบี้ย (%/ปี)</label><input class="input" type="number" step="0.01" id="wz-rate" value="${w.interestRate}"></div>
          <div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-top:8px">
            <div style="font-size:0.7rem;color:var(--text-muted)">ยอดจัดไฟแนนซ์: ${formatCurrency(Math.max(total() - w.down, 0))}</div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--accent);margin-top:4px">ผ่อนเดือนละ ${formatCurrency(monthly())}</div>
          </div>`
      }
      const rows = [['ลูกค้า', w.custName], ['เบอร์', w.phone], ['พนักงานขาย', w.salesName], ['รุ่นรถ', `${w.brand} ${w.model} ${w.variant || ''}`.trim()],
        ['ราคาขาย', formatCurrency(w.price)], ['ส่วนลด', formatCurrency(w.discount)], ['อุปกรณ์เสริม', formatCurrency(w.accessories)],
        ['ยอดสุทธิ', formatCurrency(total())], ['เงินดาวน์', formatCurrency(w.down)], ['ผ่อน', w.installments + ' เดือน'], ['ค่างวด/เดือน', formatCurrency(monthly())]]
      return `<div style="background:var(--surface-2);border-radius:10px;padding:12px">${rows.map(r => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border-subtle);font-size:0.78rem"><span style="color:var(--text-muted)">${r[0]}</span><b>${escHtml(String(r[1] || '-'))}</b></div>`).join('')}</div>`
    }

    function footerHtml() {
      return (step > 1 ? '<button class="btn btn-secondary" id="wz-back">← ย้อนกลับ</button>' : '') +
        (step < 4 ? '<button class="btn btn-primary" id="wz-next">ถัดไป →</button>' : '<button class="btn btn-primary" id="wz-save">✅ บันทึกการจอง</button>')
    }

    const m = openModal({ title: `🧙 Booking Wizard — ขั้นที่ ${step}/4`, size: 'md', body: stepsHtml() + bodyHtml(), footer: footerHtml() })

    function rerender() {
      m.el.querySelector('.modal-title').textContent = `🧙 Booking Wizard — ขั้นที่ ${step}/4`
      m.el.querySelector('.modal-body').innerHTML = stepsHtml() + bodyHtml()
      m.el.querySelector('.modal-footer').innerHTML = footerHtml()
      bind()
    }
    function readStep() {
      const g = id => m.el.querySelector('#' + id)
      if (step === 1) { w.custName = g('wz-cust')?.value.trim() || ''; w.phone = g('wz-phone')?.value.trim() || ''; w.salesName = g('wz-sales')?.value || w.salesName }
      else if (step === 2) { w.price = Number(g('wz-price')?.value) || 0; w.discount = Number(g('wz-disc')?.value) || 0; w.accessories = Number(g('wz-acc')?.value) || 0 }
      else if (step === 3) { w.down = Number(g('wz-down')?.value) || 0; w.installments = Number(g('wz-install')?.value) || 60; w.interestRate = Number(g('wz-rate')?.value) || 0 }
    }
    function bind() {
      m.el.querySelector('#wz-pick')?.addEventListener('click', () => pickVehicle(v => {
        w.brand = v.brand; w.model = v.model; w.variant = v.variant
        if (!w.price) w.price = v.price || 0
        rerender()
      }))
      m.el.querySelector('#wz-next')?.addEventListener('click', () => {
        readStep()
        if (step === 1 && !w.custName) { showToast('กรุณาใส่ชื่อลูกค้า', 'error'); return }
        if (step === 2 && !w.model) { showToast('กรุณาเลือกรุ่นรถ', 'error'); return }
        step++; rerender()
      })
      m.el.querySelector('#wz-back')?.addEventListener('click', () => { readStep(); step--; rerender() })
      m.el.querySelector('#wz-save')?.addEventListener('click', async () => {
        const t = total()
        const data = {
          bookingNo: bkNo, custName: w.custName, phone: w.phone, salesName: w.salesName,
          brand: w.brand, model: w.model, variant: w.variant,
          price: w.price, down: w.down, financeAmount: Math.max(t - w.down, 0), installments: w.installments, interestRate: w.interestRate, monthly: monthly(),
          margin: 0, budgetUsed: 0, com70: commission(), comFinance: 0, marginLeft: 0, totalIncome: commission(),
          bookingDate: new Date().toISOString().slice(0, 10), status: 'ยอดจองคงค้าง', notes: '',
          createdAt: new Date().toISOString(),
        }
        const btn = m.el.querySelector('#wz-save')
        btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
        try {
          const id = await createDoc('bookings', data)
          bookings.unshift({ ...data, id })
          m.close()
          showToast(`✅ สร้างใบจอง ${bkNo} สำเร็จ!`, 'success')
          render()
        } catch { btn.disabled = false; btn.textContent = '✅ บันทึกการจอง'; showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    }
    bind()
  }

  // ── รายละเอียดใบจอง (แบบเต็ม) ─────────────────────────────────────────────
  function openDetail(b) {
    if (!b) return
    const isCash = b.finStatus === 'ซื้อสด'
    const sec = (t) => '<div style="font-weight:700;font-size:0.74rem;color:var(--primary);margin:10px 0 4px">' + t + '</div>'
    openModal({
      title: '📝 ใบจอง ' + escHtml(b.bookingNo), size: 'lg',
      body: '<div style="font-size:0.82rem">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          statusBadge(b.status) +
          '<span style="font-size:1.25rem;font-weight:800;color:var(--accent)">' + formatCurrency(b.price) + '</span>' +
        '</div>' +
        sec('👤 ลูกค้า') +
        dRow('ชื่อ', b.custName) + dRow('เลขบัตร ปชช.', b.nid || '-') + dRow('โทร', b.phone || '-') + dRow('ที่อยู่', (b.address || '-') + ' ' + (b.province || '')) + dRow('แหล่งที่มา', b.source || '-') +
        sec('🚗 รถ') +
        dRow('รุ่น', (detectBrand(b.brand, b.model) || b.brand || '') + ' ' + b.model + ' ' + (b.variant || '')) + dRow('สีนอก / ใน', (b.colorOut || '-') + ' / ' + (b.colorIn || '-')) + dRow('เลขตัวถัง (VIN)', b.vin || '-') + dRow('เลขมอเตอร์', b.motorNo || '-') + dRow('เลขแบต', b.batNo || '-') +
        sec('💰 การเงิน / ไฟแนนซ์') +
        dRow('ราคารถ', formatCurrency(b.price)) + dRow('เงินดาวน์', formatCurrency(b.down)) +
        (isCash ? dRow('การชำระ', 'ซื้อเงินสด') :
          dRow('ไฟแนนซ์', (b.financeCo || '-') + ' · ' + (b.finStatus || '')) + dRow('ยอดจัด', formatCurrency(b.financeAmount)) + dRow('งวด / ดอกเบี้ย', (b.installments || 0) + ' งวด · ' + (b.interestRate || 0) + '%') + dRow('ค่างวด/เดือน', formatCurrency(b.monthly))) +
        dRow('แคมเปญ', b.campaign || '-') +
        sec('💵 กำไร / คอมมิชชั่น') +
        dRow('ต้นทุนรถ', formatCurrency(b.cost)) + dRow('กำไรขั้นต้น (Margin)', formatCurrency(b.margin)) + dRow('งบการตลาดที่ใช้', formatCurrency(b.budgetUsed)) +
        '<div style="display:flex;gap:6px;padding:2px 0"><span style="color:var(--text-muted);min-width:110px;flex-shrink:0;font-size:0.82rem">กำไรคงเหลือ</span><span style="font-weight:700;color:var(--success);font-size:0.82rem">' + formatCurrency(b.marginLeft != null ? b.marginLeft : (b.margin || 0) - (b.budgetUsed || 0)) + '</span></div>' +
        dRow('คอมเซลส์', formatCurrency(b.com70)) + dRow('คอมไฟแนนซ์', formatCurrency(b.comFinance)) +
        '<div style="display:flex;gap:6px;padding:2px 0"><span style="color:var(--text-muted);min-width:110px;flex-shrink:0;font-size:0.82rem">💰 รายได้รวม</span><span style="font-weight:800;color:var(--accent);font-size:0.92rem">' + formatCurrency(b.totalIncome != null ? b.totalIncome : ((b.margin || 0) - (b.budgetUsed || 0)) + (b.com70 || 0) + (b.comFinance || 0)) + '</span></div>' +
        sec('📅 ไทม์ไลน์') +
        dRow('วันจอง', formatDate(b.bookingDate)) + dRow('ยื่นไฟแนนซ์', formatDate(b.submitDate)) + dRow('อนุมัติ', formatDate(b.approveDate)) + dRow('เซ็นสัญญา', formatDate(b.signDate)) + dRow('วันตัดรถ', formatDate(b.cutDate)) + dRow('นัดส่งมอบ', formatDate(b.deliveryDate)) + dRow('ส่งมอบจริง', formatDate(b.actualDeliveryDate)) +
        dRow('เซลส์', b.salesName || '-') +
        (b.notes ? '<div style="background:var(--surface-2);padding:10px;border-radius:8px;font-size:0.82rem;margin-top:8px">📝 ' + escHtml(b.notes) + '</div>' : '') +
      '</div>',
      footer: '<button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">ปิด</button>' +
              '<button class="btn btn-secondary" id="bk-edit2">✏️ แก้ไข</button>' +
              '<button class="btn btn-secondary" id="bk-print">🖨 พิมพ์ใบจอง</button>' +
              (b.status === 'ถอนจอง'
                ? '<button class="btn btn-danger" id="bk-print-cancel">🖨 พิมพ์ใบถอนจอง</button>'
                : '<button class="btn btn-primary" id="bk-to-doc">📄 สร้างเอกสาร</button>')
    })
    document.getElementById('bk-edit2')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); openForm(b) })
    document.getElementById('bk-print')?.addEventListener('click', () => printBooking(b))
    document.getElementById('bk-print-cancel')?.addEventListener('click', () => printCancellation(b))
    document.getElementById('bk-to-doc')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); navigate('/documents') })
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const e = existing || {}
    const bkNo = e.bookingNo || ('SK' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + String(Math.floor(Math.random() * 900) + 100))
    const inp = (id, label, val, type) => '<div class="input-group"><label class="input-label">' + label + '</label><input class="input" id="' + id + '" ' + (type ? 'type="' + type + '"' : '') + ' value="' + (val == null ? '' : String(val).replace(/"/g, '&quot;')) + '"></div>'
    const selOf = (id, label, list, val) => '<div class="input-group"><label class="input-label">' + label + '</label><select class="input" id="' + id + '">' + list.map(o => '<option ' + (o === val ? 'selected' : '') + '>' + o + '</option>').join('') + '</select></div>'
    const datalist = (id, label, list, val) => '<div class="input-group"><label class="input-label">' + label + '</label><input class="input" id="' + id + '" list="' + id + '-l" value="' + (val || '') + '"><datalist id="' + id + '-l">' + list.map(o => '<option value="' + o + '">').join('') + '</datalist></div>'
    const sec = (t) => '<div style="font-weight:700;font-size:0.78rem;color:var(--primary);margin:6px 0 2px;border-bottom:1px solid var(--border-subtle);padding-bottom:3px">' + t + '</div>'

    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขใบจอง ' + escHtml(bkNo) : '➕ ใบจองใหม่', size: 'lg',
      body: '<div style="display:flex;flex-direction:column;gap:8px;max-height:66vh;overflow:auto;padding-right:4px">' +
        sec('👤 ข้อมูลลูกค้า') +
        '<div class="grid-2">' + inp('bf-cust', 'ชื่อลูกค้า *', e.custName) + inp('bf-nid', 'เลขบัตรประชาชน', e.nid) + '</div>' +
        '<div class="grid-2">' + inp('bf-phone', 'โทรศัพท์', e.phone) + datalist('bf-source', 'แหล่งที่มา', getLeadSources(), e.source) + '</div>' +
        '<div class="grid-2">' + inp('bf-address', 'ที่อยู่', e.address) + inp('bf-province', 'จังหวัด', e.province) + '</div>' +
        sec('🚗 ข้อมูลรถ') +
        '<button type="button" class="btn btn-secondary btn-sm" id="bf-pick" style="align-self:flex-start">🚘 เลือกรถจาก Catalog</button>' +
        '<div class="grid-2">' + inp('bf-brand', 'ยี่ห้อ', e.brand) + inp('bf-model', 'รุ่น', e.model) + '</div>' +
        '<div class="grid-2">' + inp('bf-variant', 'รุ่นย่อย', e.variant) + inp('bf-price', 'ราคารถ (บาท)', e.price, 'number') + '</div>' +
        '<div class="grid-2">' + datalist('bf-colorout', 'สีภายนอก', getColors(), e.colorOut) + datalist('bf-colorin', 'สีภายใน', getColors(), e.colorIn) + '</div>' +
        '<div class="grid-2">' + inp('bf-vin', 'เลขตัวถัง (VIN)', e.vin) + inp('bf-motor', 'เลขมอเตอร์', e.motorNo) + '</div>' +
        inp('bf-bat', 'เลขแบตเตอรี่', e.batNo) +
        sec('💰 การเงิน / ไฟแนนซ์') +
        '<div class="grid-2">' + selOf('bf-finco', 'บริษัทไฟแนนซ์', getFinanceCompanies(), e.financeCo) + selOf('bf-finstatus', 'สถานะไฟแนนซ์', getFinanceStatus(), e.finStatus) + '</div>' +
        '<div class="grid-2">' + inp('bf-down', 'เงินดาวน์', e.down, 'number') + inp('bf-finamount', 'ยอดจัดไฟแนนซ์', e.financeAmount, 'number') + '</div>' +
        '<div class="grid-2">' + inp('bf-install', 'จำนวนงวด', e.installments, 'number') + inp('bf-rate', 'ดอกเบี้ย (%/ปี)', e.interestRate, 'number') + '</div>' +
        '<div class="grid-2">' + selOf('bf-campaign', 'แคมเปญ', getCampaigns(), e.campaign) + inp('bf-cost', 'ต้นทุนรถ (บาท)', e.cost, 'number') + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted)">💡 ค่างวด/เดือน คำนวณอัตโนมัติจาก ยอดจัด × งวด × ดอกเบี้ย</div>' +
        sec('💵 กำไร / คอมมิชชั่น (แบบ V8)') +
        '<div class="grid-2">' + inp('bf-margin', 'กำไรขั้นต้น Margin (บาท)', e.margin, 'number') + inp('bf-budget', 'งบการตลาดที่ใช้ (บาท)', e.budgetUsed, 'number') + '</div>' +
        '<div class="grid-2">' + inp('bf-com70', 'คอมเซลส์ (บาท)', e.com70, 'number') + inp('bf-comfin', 'คอมไฟแนนซ์ (บาท)', e.comFinance, 'number') + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted)">💡 กำไรคงเหลือ = Margin − งบการตลาด · รายได้รวม = กำไรคงเหลือ + คอมเซลส์ + คอมไฟแนนซ์ (คำนวณอัตโนมัติ)</div>' +
        sec('📅 ไทม์ไลน์') +
        '<div class="grid-2">' + inp('bf-bdate', 'วันจอง', e.bookingDate || new Date().toISOString().slice(0, 10), 'date') + inp('bf-submit', 'วันยื่นไฟแนนซ์', e.submitDate, 'date') + '</div>' +
        '<div class="grid-2">' + inp('bf-approve', 'วันอนุมัติ', e.approveDate, 'date') + inp('bf-sign', 'วันเซ็นสัญญา', e.signDate, 'date') + '</div>' +
        '<div class="grid-2">' + inp('bf-cut', 'วันตัดรถ', e.cutDate, 'date') + inp('bf-delivery', 'วันนัดส่งมอบ', e.deliveryDate, 'date') + '</div>' +
        inp('bf-actual', 'วันส่งมอบจริง', e.actualDeliveryDate, 'date') +
        sec('📌 สรุป') +
        '<div class="grid-2">' + selOf('bf-sales', 'เซลส์', getSalesStaff(), e.salesName) + selOf('bf-status', 'สถานะใบจอง', getBookingStatus(), e.status || 'ยอดจองคงค้าง') + '</div>' +
        inp('bf-notes', 'หมายเหตุ', e.notes) +
        '<span class="input-error" id="bf-cust-e"></span>' +
      '</div>',
      footer: '<button class="btn btn-secondary" id="bfc">ยกเลิก</button><button class="btn btn-primary" id="bfs">💾 บันทึก</button>'
    })

    el.querySelector('#bf-pick')?.addEventListener('click', () => pickVehicle(v => {
      el.querySelector('#bf-brand').value = v.brand
      el.querySelector('#bf-model').value = v.model
      el.querySelector('#bf-variant').value = v.variant
      if (!el.querySelector('#bf-price').value) el.querySelector('#bf-price').value = v.price || ''
    }))
    el.querySelector('#bfc').addEventListener('click', close)
    el.querySelector('#bfs').addEventListener('click', async () => {
      const cust = el.querySelector('#bf-cust').value.trim()
      if (!cust) { el.querySelector('#bf-cust-e').textContent = '⚠️ กรุณาระบุชื่อลูกค้า'; return }
      const g = id => el.querySelector('#' + id)
      const num = id => Number(g(id).value) || 0
      const financeAmount = num('bf-finamount'), installments = num('bf-install'), rate = num('bf-rate')
      const data = {
        bookingNo: bkNo,
        custName: cust, nid: g('bf-nid').value.trim(), phone: g('bf-phone').value.trim(), address: g('bf-address').value.trim(), province: g('bf-province').value.trim(), source: g('bf-source').value.trim(),
        brand: g('bf-brand').value.trim(), model: g('bf-model').value.trim(), variant: g('bf-variant').value.trim(),
        colorOut: g('bf-colorout').value.trim(), colorIn: g('bf-colorin').value.trim(), vin: g('bf-vin').value.trim(), motorNo: g('bf-motor').value.trim(), batNo: g('bf-bat').value.trim(),
        price: num('bf-price'), cost: num('bf-cost'), down: num('bf-down'), financeCo: g('bf-finco').value, financeAmount, finStatus: g('bf-finstatus').value,
        installments, interestRate: rate, monthly: calcMonthly(financeAmount, installments, rate), campaign: g('bf-campaign').value,
        margin: num('bf-margin'), budgetUsed: num('bf-budget'), com70: num('bf-com70'), comFinance: num('bf-comfin'),
        marginLeft: num('bf-margin') - num('bf-budget'),
        totalIncome: (num('bf-margin') - num('bf-budget')) + num('bf-com70') + num('bf-comfin'),
        bookingDate: g('bf-bdate').value, submitDate: g('bf-submit').value, approveDate: g('bf-approve').value, signDate: g('bf-sign').value, cutDate: g('bf-cut').value, deliveryDate: g('bf-delivery').value, actualDeliveryDate: g('bf-actual').value,
        salesName: g('bf-sales').value, status: g('bf-status').value, notes: g('bf-notes').value.trim(),
        createdAt: existing?.createdAt || new Date().toISOString(),
      }
      const btn = g('bfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        if (isEdit) { await updateDocData('bookings', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('bookings', data); bookings.unshift({ ...data, id }) }
        showToast(isEdit ? '✏️ แก้ไขใบจองแล้ว' : '✅ สร้างใบจองแล้ว', 'success')
        close(); render()
      } catch { btn.disabled = false; btn.textContent = 'บันทึก'; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  container.innerHTML = '<div class="page-content animate-slide">' + [...Array(3)].map(() => '<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>').join('') + '</div>'
  if (container.__routerGen === myGen) await loadData()
}

function dRow(label, value) {
  return '<div style="font-size:0.82rem;display:flex;gap:6px;padding:2px 0"><span style="color:var(--text-muted);min-width:110px;flex-shrink:0">' + label + '</span><span style="color:var(--text-2)">' + escHtml(String(value ?? '')) + '</span></div>'
}
