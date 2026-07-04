/**
 * Promotion Engine — กิจกรรมส่งเสริมการขาย
 * Route: /marketing/promotions
 */
import { getSalesData, listDocs, createDoc, updateDocData, softDelete } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { analyzeCampaignAnnouncement } from '../../utils/ai.js'

const BRANDS = ['BYD', 'MG', 'DEEPAL', 'AION', 'NETA', 'OMODA & JAECOO', 'SUZUKI', 'NISSAN', 'อื่นๆ']

const PROMO_TYPES = {
  discount:     { label: 'ส่วนลด', icon: '💰', color: 'success' },
  cashback:     { label: 'Cashback', icon: '💵', color: 'primary' },
  free_acc:     { label: 'ของแถม', icon: '🎁', color: 'warning' },
  free_service: { label: 'บริการฟรี', icon: '🔧', color: 'secondary' },
  trade_in:     { label: 'Trade-In', icon: '🔄', color: 'primary' },
  finance:      { label: 'ดอกเบี้ย 0%', icon: '🏦', color: 'success' },
}

const PROMO_STATUS = {
  active:   { label: 'ใช้งาน', color: 'success' },
  upcoming: { label: 'เร็วๆ นี้', color: 'primary' },
  ended:    { label: 'สิ้นสุดแล้ว', color: 'secondary' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_PROMOS = [
  { id: 'P001', title: 'BYD Dolphin ลดพิเศษ 20,000 บาท', type: 'discount', value: 20000, brand: 'BYD', model: 'Dolphin', startDate: addDays(-30), endDate: addDays(20), status: 'active', used: 28, limit: 50, budget: 1000000, note: 'โปรโมชั่น H2 2025 ช่วงเปิดตัวรุ่นใหม่', _persisted: false },
  { id: 'P002', title: 'MG ZS EV Cashback 30,000 บาท', type: 'cashback', value: 30000, brand: 'MG', model: 'ZS EV', startDate: addDays(-15), endDate: addDays(25), status: 'active', used: 12, limit: 30, budget: 900000, note: 'ร่วมกับ MG Thailand', _persisted: false },
  { id: 'P003', title: 'BYD Atto 3 แถม Wallbox ฟรี', type: 'free_acc', value: 15000, brand: 'BYD', model: 'Atto 3', startDate: addDays(5), endDate: addDays(35), status: 'upcoming', used: 0, limit: 20, budget: 300000, note: 'Wallbox มูลค่า 15,000 บาท', _persisted: false },
  { id: 'P004', title: 'ดอกเบี้ย 0% 60 เดือน ทุกรุ่น', type: 'finance', value: 0, brand: 'BYD', model: 'ทุกรุ่น', startDate: addDays(-90), endDate: addDays(-1), status: 'ended', used: 45, limit: 100, budget: 0, note: 'โปรฯ ร่วมกับธนาคาร Q1', _persisted: false },
  { id: 'P005', title: 'BYD Seal ฟรีค่าบริการ 3 ปี', type: 'free_service', value: 45000, brand: 'BYD', model: 'Seal', startDate: addDays(-10), endDate: addDays(28), status: 'active', used: 5, limit: 15, budget: 675000, note: 'บริการฟรี 3 ปี หรือ 60,000 กม.', _persisted: false },
]

// หาว่าการขายไหนน่าจะมาจากโปรโมชั่นนี้ (ตรง brand+model + ช่วงวันที่)
function matchSalesToPromo(sales, promo) {
  const pm = (promo.model || '').toLowerCase().trim()
  const pb = (promo.brand || '').toLowerCase().trim()
  return sales.filter(s => {
    const sModel = ((s.model || '') + ' ' + (s.brand || '')).toLowerCase()
    const brandMatch = !pb || sModel.includes(pb)
    const modelMatch = pm === 'ทุกรุ่น' || sModel.includes(pm) || pm.split(' ').some(w => w.length > 2 && sModel.includes(w))
    const dateOk = s.date && s.date >= promo.startDate && s.date <= (promo.endDate || '9999')
    return brandMatch && modelMatch && dateOk
  })
}

function monthKey(dateStr) { return (dateStr || '').slice(0, 7) } // YYYY-MM
function monthLabel(ym) {
  const [y, m] = (ym || '').split('-').map(Number)
  if (!y || !m) return ym || '-'
  const th = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return th[m - 1] + ' ' + (y + 543)
}

export default async function PromotionEnginePage(container) {
  const myGen = container.__routerGen
  let promos = DEMO_PROMOS.map(p => ({ ...p }))
  let allSales = []
  let statusFilter = 'all'
  let typeFilter = 'all'
  let brandFilter = 'all'
  let viewMode = 'list' // 'list' | 'bulletin' | 'forecast'
  let compareIds = new Set()
  let loading = true

  // โหลดข้อมูลการขายจริง + โปรโมชั่นจริงจาก Firestore
  try {
    allSales = await getSalesData()
  } catch {}
  try {
    const real = await listDocs('promotions', [], 'startDate', 'desc', 200)
    if (real.length) promos = [...real.map(p => ({ ...p, _persisted: true })), ...promos]
  } catch {}
  if (container.__routerGen !== myGen) return
  loading = false

  // คำนวณ metrics ต่อโปรโมชั่น
  function calcPromoMetrics(p) {
    const matched = matchSalesToPromo(allSales, p)
    const revenueGenerated = matched.reduce((a, s) => a + (s.salePrice || 0), 0)
    const budgetUsed = p.used * (p.value || 0)
    const budgetRemaining = Math.max(0, (p.budget || 0) - budgetUsed)
    const roi = budgetUsed > 0 ? Math.round(revenueGenerated / budgetUsed) : 0
    const costPerSale = p.used > 0 ? Math.round(budgetUsed / p.used) : 0
    return { revenueGenerated, budgetUsed, budgetRemaining, roi, costPerSale, matchedSales: matched }
  }

  function getFiltered() {
    return promos.filter(p =>
      (statusFilter === 'all' || p.status === statusFilter) &&
      (typeFilter === 'all' || p.type === typeFilter) &&
      (brandFilter === 'all' || p.brand === brandFilter)
    )
  }

  function renderPage() {
    const list = getFiltered()
    const activeCount = promos.filter(p => p.status === 'active').length
    const totalBudget = promos.reduce((a, p) => a + (p.budget || 0), 0)
    const totalBudgetUsed = promos.reduce((a, p) => a + calcPromoMetrics(p).budgetUsed, 0)
    const totalRevenue = promos.reduce((a, p) => a + calcPromoMetrics(p).revenueGenerated, 0)
    const overallRoi = totalBudgetUsed > 0 ? Math.round(totalRevenue / totalBudgetUsed) : 0
    const brandsInUse = BRANDS.filter(b => promos.some(p => p.brand === b))

    const viewTabs = [['list', '📋 รายการ'], ['bulletin', '📅 บอร์ดประกาศ'], ['forecast', '📈 คาดการณ์']]

    container.innerHTML =
      '<div class="page-content animate-slide">' +
        '<div class="page-header"><div>' +
          '<div class="page-title">🎪 กิจกรรมส่งเสริมการขาย</div>' +
          '<div class="page-subtitle">จัดการโปรโมชั่น วิเคราะห์ ROI งบประมาณ และคาดการณ์แคมเปญ</div>' +
        '</div><div class="page-actions">' +
          '<button class="btn btn-secondary" id="pe-export">📥 Export</button>' +
          '<button class="btn btn-secondary" id="ai-import-btn">🤖 นำเข้าจากประกาศ AI</button>' +
          '<button class="btn btn-primary" id="add-promo-btn">+ สร้างโปรโมชั่น</button>' +
        '</div></div>' +

        // KPI cards
        '<div class="grid-4 mb-6">' +
          kpi('🎪 Active', activeCount + '/' + promos.length, 'success') +
          kpi('💸 งบแถมใช้ไป', formatCurrency(totalBudgetUsed), 'warning') +
          kpi('💰 Revenue จากโปร', formatCurrency(totalRevenue), 'primary') +
          kpi('📈 ROI รวม', (overallRoi ? overallRoi + 'x' : '-'), overallRoi >= 5 ? 'success' : 'accent') +
        '</div>' +

        // View mode tabs
        '<div style="display:flex;gap:6px;margin-bottom:12px">' +
          viewTabs.map(([k, l]) => '<button class="btn btn-sm vm-btn ' + (viewMode===k?'btn-primary':'btn-secondary') + '" data-v="' + k + '">' + l + '</button>').join('') +
        '</div>' +

        // Filters
        '<div class="card mb-4" style="padding:10px 16px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
            '<button class="btn btn-xs sf-btn ' + (statusFilter==='all'?'btn-primary':'btn-secondary') + '" data-s="all">ทั้งหมด</button>' +
            Object.entries(PROMO_STATUS).map(([k,v]) =>
              '<button class="btn btn-xs sf-btn ' + (statusFilter===k?'btn-'+v.color:'btn-secondary') + '" data-s="' + k + '">' + v.label + '</button>'
            ).join('') +
          '</div>' +
          '<span style="width:1px;height:20px;background:var(--border);margin:0 6px"></span>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
            '<button class="btn btn-xs tf-btn ' + (typeFilter==='all'?'btn-primary':'btn-secondary') + '" data-t="all">ทุกประเภท</button>' +
            Object.entries(PROMO_TYPES).map(([k,v]) =>
              '<button class="btn btn-xs tf-btn ' + (typeFilter===k?'btn-primary':'btn-secondary') + '" data-t="' + k + '">' + v.icon + ' ' + v.label + '</button>'
            ).join('') +
          '</div>' +
          (brandsInUse.length ? '<span style="width:1px;height:20px;background:var(--border);margin:0 6px"></span>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
              '<button class="btn btn-xs bf-btn ' + (brandFilter==='all'?'btn-primary':'btn-secondary') + '" data-b="all">ทุกแบรนด์</button>' +
              brandsInUse.map(b => '<button class="btn btn-xs bf-btn ' + (brandFilter===b?'btn-primary':'btn-secondary') + '" data-b="' + esc(b) + '">' + esc(b) + '</button>').join('') +
            '</div>' : '') +
        '</div>' +

        (compareIds.size > 0 ? '<div class="card mb-4" style="padding:10px 16px;display:flex;align-items:center;gap:10px;background:var(--primary-dim)">' +
          '<span style="font-size:0.8rem;font-weight:700;color:var(--primary)">✅ เลือกเปรียบเทียบ ' + compareIds.size + ' รายการ</span>' +
          '<button class="btn btn-xs btn-primary" id="compare-btn" ' + (compareIds.size < 2 ? 'disabled' : '') + '>⚖️ เปรียบเทียบ</button>' +
          '<button class="btn btn-xs btn-ghost" id="compare-clear">✕ ล้าง</button>' +
        '</div>' : '') +

        '<div id="promo-list">' +
          (viewMode === 'list' ? renderPromoList(list) : viewMode === 'bulletin' ? renderBulletin(list) : renderForecast()) +
        '</div>' +
      '</div>'

    container.querySelector('#add-promo-btn').addEventListener('click', openAddForm)
    container.querySelector('#ai-import-btn').addEventListener('click', openAiImportModal)
    container.querySelector('#pe-export').addEventListener('click', () => {
      exportToExcel(promos.map(p => {
        const m = calcPromoMetrics(p)
        return { ID: p.id, แบรนด์: p.brand, โปรโมชั่น: p.title, ประเภท: PROMO_TYPES[p.type]?.label, รุ่น: p.model, วันเริ่ม: p.startDate, วันสิ้นสุด: p.endDate, สถานะ: PROMO_STATUS[p.status]?.label, ใช้สิทธิ์: p.used, จำกัด: p.limit, มูลค่าต่อคัน: p.value, งบประมาณ: p.budget, งบใช้ไป: m.budgetUsed, Revenue: m.revenueGenerated, ROI: m.roi + 'x' }
      }), 'promotions_' + new Date().toISOString().slice(0,10))
      showToast('📥 Export แล้ว', 'success')
    })
    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.bf-btn').forEach(b => b.addEventListener('click', () => { brandFilter = b.dataset.b; renderPage() }))
    container.querySelectorAll('.vm-btn').forEach(b => b.addEventListener('click', () => { viewMode = b.dataset.v; renderPage() }))
    container.querySelector('#compare-clear')?.addEventListener('click', () => { compareIds.clear(); renderPage() })
    container.querySelector('#compare-btn')?.addEventListener('click', () => openCompareModal([...compareIds].map(id => promos.find(p => p.id === id)).filter(Boolean)))
    container.querySelectorAll('.detail-btn').forEach(b => b.addEventListener('click', () => {
      const p = promos.find(x => x.id === b.dataset.id)
      if (p) openDetail(p)
    }))
    container.querySelectorAll('.cmp-check').forEach(cb => cb.addEventListener('change', (e) => {
      if (e.target.checked) compareIds.add(cb.dataset.id); else compareIds.delete(cb.dataset.id)
      renderPage()
    }))
    container.querySelectorAll('.end-btn').forEach(b => b.addEventListener('click', async () => {
      const p = promos.find(x => x.id === b.dataset.id)
      if (!p) return
      p.status = 'ended'
      if (p._persisted) { try { await updateDocData('promotions', p.id, { status: 'ended' }) } catch {} }
      showToast('❌ ยุติโปรโมชั่น "' + p.title + '" แล้ว', 'warning'); renderPage()
    }))
    container.querySelectorAll('.del-promo-btn').forEach(b => b.addEventListener('click', async () => {
      const p = promos.find(x => x.id === b.dataset.id)
      if (!p) return
      const ok = await confirmDialog({ title: 'ลบโปรโมชั่น', message: 'ลบ "' + p.title + '"?', confirmText: 'ลบ', danger: true })
      if (!ok) return
      if (p._persisted) { try { await softDelete('promotions', p.id) } catch {} }
      promos = promos.filter(x => x.id !== p.id)
      showToast('🗑 ลบโปรโมชั่นแล้ว', 'success'); renderPage()
    }))
  }

  function renderPromoList(list) {
    if (!list.length) return '<div class="empty-state"><div class="empty-state-icon">🎪</div><div>ไม่พบโปรโมชั่น</div></div>'
    return '<div style="display:flex;flex-direction:column;gap:10px">' +
      list.map(p => {
        const pt = PROMO_TYPES[p.type]
        const st = PROMO_STATUS[p.status]
        const usagePct = p.limit > 0 ? Math.min(100, Math.round(p.used / p.limit * 100)) : 0
        const daysLeft = Math.ceil((new Date(p.endDate) - new Date()) / 86400000)
        const m = calcPromoMetrics(p)
        const budgetPct = p.budget > 0 ? Math.min(100, Math.round(m.budgetUsed / p.budget * 100)) : 0

        return '<div class="card" style="padding:14px;border-left:4px solid var(--' + st.color + ')">' +
          '<div style="display:flex;justify-content:space-between;align-items:start;gap:12px">' +
            '<div style="flex:1">' +
              '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">' +
                '<input type="checkbox" class="cmp-check" data-id="' + p.id + '" ' + (compareIds.has(p.id) ? 'checked' : '') + ' title="เลือกเปรียบเทียบ">' +
                '<span style="font-size:1.1rem">' + pt.icon + '</span>' +
                '<div style="font-weight:700;font-size:0.88rem">' + esc(p.title) + '</div>' +
                (p.brand ? '<span class="badge badge-secondary" style="font-size:0.6rem">' + esc(p.brand) + '</span>' : '') +
              '</div>' +
              '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">🚗 ' + esc(p.model) +
                ' · ' + formatDate(p.startDate) + ' — ' + formatDate(p.endDate) +
                (p.status === 'active' && daysLeft > 0 ? ' · <span style="color:var(--warning)">เหลือ ' + daysLeft + ' วัน</span>' : '') +
              '</div>' +
              // Metrics row
              '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:0.78rem;margin-bottom:8px">' +
                '<span>👥 ใช้สิทธิ์ <strong>' + p.used + '</strong>' + (p.limit > 0 ? '/' + p.limit : '') + '</span>' +
                (p.value > 0 ? '<span>💸 FOC <strong>' + formatCurrency(m.budgetUsed) + '</strong></span>' : '') +
                (m.revenueGenerated > 0 ? '<span>💰 Revenue <strong style="color:var(--success)">' + formatCurrency(m.revenueGenerated) + '</strong></span>' : '') +
                (m.roi > 0 ? '<span>📈 ROI <strong style="color:var(--' + (m.roi >= 10 ? 'success' : m.roi >= 5 ? 'warning' : 'danger') + ')">' + m.roi + 'x</strong></span>' : '') +
              '</div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
              '<span class="badge badge-' + st.color + '" style="font-size:0.62rem">' + st.label + '</span>' +
              (p.value > 0 ? '<span style="font-weight:700;color:var(--' + pt.color + ');font-size:0.85rem">' + formatCurrency(p.value) + '/คัน</span>' : '') +
            '</div>' +
          '</div>' +
          // Progress bars
          (p.limit > 0 ? '<div style="margin-bottom:6px">' +
            '<div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-bottom:2px"><span>ใช้สิทธิ์ ' + usagePct + '%</span></div>' +
            '<div style="background:var(--surface-2);border-radius:3px;height:5px"><div style="width:' + usagePct + '%;background:' + (usagePct>=90?'var(--danger)':usagePct>=70?'var(--warning)':'var(--success)') + ';height:5px;border-radius:3px"></div></div>' +
          '</div>' : '') +
          (p.budget > 0 ? '<div style="margin-bottom:8px">' +
            '<div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-bottom:2px"><span>งบแถม ' + formatCurrency(m.budgetUsed) + '/' + formatCurrency(p.budget) + ' (' + budgetPct + '%)</span></div>' +
            '<div style="background:var(--surface-2);border-radius:3px;height:5px"><div style="width:' + budgetPct + '%;background:' + (budgetPct>=90?'var(--danger)':budgetPct>=70?'var(--warning)':'var(--primary)') + ';height:5px;border-radius:3px"></div></div>' +
          '</div>' : '') +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-xs btn-secondary detail-btn" data-id="' + p.id + '">📊 รายละเอียด</button>' +
            (p.status === 'active' ? '<button class="btn btn-xs btn-danger end-btn" data-id="' + p.id + '">ยุติโปร</button>' : '') +
            '<button class="btn btn-xs btn-secondary del-promo-btn" data-id="' + p.id + '" style="color:var(--danger);margin-left:auto" title="ลบ">🗑</button>' +
          '</div>' +
        '</div>'
      }).join('') +
    '</div>'
  }

  function openDetail(p) {
    const pt = PROMO_TYPES[p.type]
    const st = PROMO_STATUS[p.status]
    const m = calcPromoMetrics(p)
    const usagePct = p.limit > 0 ? Math.round(p.used / p.limit * 100) : 0
    const budgetPct = p.budget > 0 ? Math.round(m.budgetUsed / p.budget * 100) : 0

    openModal({
      title: pt.icon + ' ' + p.title,
      size: 'md',
      body:
        '<div style="display:flex;gap:6px;margin-bottom:12px">' +
          '<span class="badge badge-' + st.color + '">' + st.label + '</span>' +
          '<span class="badge badge-secondary">' + pt.label + '</span>' +
        '</div>' +
        row('รุ่นรถ', esc(p.model)) +
        (p.value > 0 ? row('มูลค่า/คัน', formatCurrency(p.value)) : '') +
        row('วันที่', formatDate(p.startDate) + ' — ' + formatDate(p.endDate)) +
        (p.limit > 0 ? row('ใช้สิทธิ์', p.used + '/' + p.limit + ' (' + usagePct + '%)') : '') +
        (p.budget > 0 ? row('งบประมาณ', formatCurrency(p.budget)) : '') +
        (p.note ? row('หมายเหตุ', esc(p.note)) : '') +
        '<div style="margin-top:14px;padding:12px;background:var(--surface-2);border-radius:var(--radius-sm)">' +
          '<div style="font-weight:700;font-size:0.82rem;margin-bottom:10px">📈 ผลลัพธ์และ ROI</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
            miniKpi('💸 FOC ใช้ไป', formatCurrency(m.budgetUsed), 'warning') +
            miniKpi('🏦 งบคงเหลือ', formatCurrency(m.budgetRemaining), 'muted') +
            miniKpi('💰 Revenue', formatCurrency(m.revenueGenerated), 'success') +
            miniKpi('📈 ROI', (m.roi > 0 ? m.roi + 'x' : '-'), m.roi >= 10 ? 'success' : m.roi >= 5 ? 'warning' : 'muted') +
          '</div>' +
          (m.costPerSale > 0 ? '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">ต้นทุน FOC/คัน: <strong>' + formatCurrency(m.costPerSale) + '</strong></div>' : '') +
        '</div>' +
        (m.matchedSales.length > 0 ? '<div style="margin-top:10px;font-size:0.75rem;color:var(--text-muted)">📋 พบ ' + m.matchedSales.length + ' การขายในช่วงโปรโมชั่น</div>' : '')
    })
  }

  function openAddForm(prefill = {}) {
    const { el, close } = openModal({
      title: '+ สร้างโปรโมชั่นใหม่',
      size: 'md',
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อโปรโมชั่น *</label><input class="input" id="pp-title" value="' + esc(prefill.title || '') + '"></div>' +
          '<div class="input-group"><label class="input-label">แบรนด์</label>' +
            '<select class="input" id="pp-brand">' + BRANDS.map(b => '<option ' + (b === prefill.brand ? 'selected' : '') + '>' + esc(b) + '</option>').join('') + '</select>' +
          '</div>' +
          '<div class="input-group"><label class="input-label">ประเภท</label>' +
            '<select class="input" id="pp-type">' + Object.entries(PROMO_TYPES).map(([k,v]) => '<option value="' + k + '" ' + (k === prefill.type ? 'selected' : '') + '>' + v.icon + ' ' + v.label + '</option>').join('') + '</select>' +
          '</div>' +
          '<div class="input-group"><label class="input-label">มูลค่า/คัน (บาท)</label><input type="number" class="input" id="pp-value" value="' + (prefill.value || 0) + '"></div>' +
          '<div class="input-group"><label class="input-label">วันเริ่ม</label><input type="date" class="input" id="pp-start" value="' + (prefill.startDate || addDays(0)) + '"></div>' +
          '<div class="input-group"><label class="input-label">วันสิ้นสุด</label><input type="date" class="input" id="pp-end" value="' + (prefill.endDate || addDays(30)) + '"></div>' +
          '<div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="pp-model" value="' + esc(prefill.model || 'ทุกรุ่น') + '"></div>' +
          '<div class="input-group"><label class="input-label">จำกัดสิทธิ์ (0=ไม่จำกัด)</label><input type="number" class="input" id="pp-limit" value="' + (prefill.limit || 50) + '"></div>' +
          '<div class="input-group" style="grid-column:1/-1"><label class="input-label">งบประมาณ FOC (บาท)</label><input type="number" class="input" id="pp-budget" value="' + (prefill.budget || 0) + '"></div>' +
          '<div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><input class="input" id="pp-note" value="' + esc(prefill.conditions || '') + '"></div>' +
        '</div>',
      footer: '<button class="btn btn-secondary" id="pp-cancel">ยกเลิก</button><button class="btn btn-primary" id="pp-save">💾 บันทึก</button>'
    })

    el.querySelector('#pp-cancel').addEventListener('click', close)
    el.querySelector('#pp-save').addEventListener('click', async () => {
      const title = el.querySelector('#pp-title').value.trim()
      if (!title) { showToast('❗ กรุณากรอกชื่อโปรโมชั่น', 'error'); return }
      const data = {
        title, brand: el.querySelector('#pp-brand').value,
        type: el.querySelector('#pp-type').value,
        value: +el.querySelector('#pp-value').value || 0,
        model: el.querySelector('#pp-model').value || 'ทุกรุ่น',
        startDate: el.querySelector('#pp-start').value,
        endDate: el.querySelector('#pp-end').value,
        status: 'upcoming', used: 0,
        limit: +el.querySelector('#pp-limit').value || 0,
        budget: +el.querySelector('#pp-budget').value || 0,
        note: el.querySelector('#pp-note').value.trim(),
      }
      try {
        const id = await createDoc('promotions', data)
        promos.unshift({ id, ...data, _persisted: true })
      } catch {
        promos.unshift({ id: 'P' + String(promos.length + 1).padStart(3, '0'), ...data, _persisted: false })
      }
      showToast('✅ สร้างโปรโมชั่นแล้ว!', 'success')
      close()
      renderPage()
    })
  }

  // ── บอร์ดประกาศ (Bulletin) — จัดกลุ่มตามแบรนด์ → เดือน ──────────────────────
  function renderBulletin(list) {
    if (!list.length) return '<div class="empty-state"><div class="empty-state-icon">📅</div><div>ไม่พบโปรโมชั่น</div></div>'
    const byBrand = {}
    list.forEach(p => { const b = p.brand || 'อื่นๆ'; (byBrand[b] = byBrand[b] || []).push(p) })

    return Object.entries(byBrand).map(([brand, items]) => {
      const byMonth = {}
      items.forEach(p => { const mk = monthKey(p.startDate); (byMonth[mk] = byMonth[mk] || []).push(p) })
      const months = Object.keys(byMonth).sort().reverse()
      return '<div class="card mb-4" style="padding:14px">' +
        '<div style="font-weight:800;font-size:0.95rem;margin-bottom:10px;display:flex;align-items:center;gap:6px">🏷️ ' + esc(brand) + '<span class="badge badge-secondary" style="font-size:0.6rem">' + items.length + ' แคมเปญ</span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">' +
          months.map(mk => {
            const mItems = byMonth[mk]
            return '<div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px">' +
              '<div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">📆 ' + monthLabel(mk) + '</div>' +
              mItems.map(p => {
                const pt = PROMO_TYPES[p.type]; const st = PROMO_STATUS[p.status]
                return '<div style="padding:6px 8px;background:var(--surface);border-radius:6px;margin-bottom:5px;border-left:2px solid var(--' + st.color + ')">' +
                  '<div style="font-size:0.76rem;font-weight:600">' + pt.icon + ' ' + esc(p.model) + '</div>' +
                  '<div style="font-size:0.66rem;color:var(--text-muted)">' + esc(p.title) + (p.value > 0 ? ' · ' + formatCurrency(p.value) : '') + '</div>' +
                '</div>'
              }).join('') +
            '</div>'
          }).join('') +
        '</div>' +
      '</div>'
    }).join('')
  }

  // ── คาดการณ์ (Forecast) — สถิติย้อนหลัง + แนวโน้มเดือนถัดไป ───────────────────
  function renderForecast() {
    const ended = promos.filter(p => p.status === 'ended' || p.status === 'active')
    if (ended.length < 2) return '<div class="empty-state"><div class="empty-state-icon">📈</div><div>ต้องมีประวัติแคมเปญอย่างน้อย 2 รายการเพื่อคาดการณ์</div></div>'

    // ROI เฉลี่ยต่อประเภท
    const byType = {}
    ended.forEach(p => {
      const m = calcPromoMetrics(p)
      if (m.roi <= 0) return
      const t = p.type
      if (!byType[t]) byType[t] = { roiSum: 0, count: 0, budgetSum: 0 }
      byType[t].roiSum += m.roi; byType[t].count++; byType[t].budgetSum += m.budgetUsed
    })
    const typeStats = Object.entries(byType).map(([t, s]) => ({ type: t, avgRoi: Math.round(s.roiSum / s.count), count: s.count, avgBudget: Math.round(s.budgetSum / s.count) }))
      .sort((a, b) => b.avgRoi - a.avgRoi)

    // แนวโน้มงบประมาณต่อเดือน (3 เดือนล่าสุด)
    const byMonth = {}
    ended.forEach(p => { const mk = monthKey(p.startDate); const m = calcPromoMetrics(p); byMonth[mk] = (byMonth[mk] || 0) + m.budgetUsed })
    const months = Object.keys(byMonth).sort()
    const recentMonths = months.slice(-3)
    const avgMonthlyBudget = recentMonths.length ? Math.round(recentMonths.reduce((a, mk) => a + byMonth[mk], 0) / recentMonths.length) : 0
    const trend = recentMonths.length >= 2 ? (byMonth[recentMonths[recentMonths.length - 1]] - byMonth[recentMonths[0]]) : 0

    const best = typeStats[0]

    return '<div class="card mb-4" style="padding:16px">' +
        '<div style="font-weight:700;font-size:0.88rem;margin-bottom:10px">🏆 ประเภทแคมเปญที่ ROI ดีที่สุด (จากประวัติ)</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">' +
          typeStats.map(s => {
            const pt = PROMO_TYPES[s.type]
            return '<div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:10px;text-align:center">' +
              '<div style="font-size:1.3rem">' + pt.icon + '</div>' +
              '<div style="font-size:0.75rem;font-weight:600;margin:4px 0">' + pt.label + '</div>' +
              '<div style="font-size:1rem;font-weight:800;color:var(--' + (s.avgRoi >= 10 ? 'success' : s.avgRoi >= 5 ? 'warning' : 'danger') + ')">' + s.avgRoi + 'x</div>' +
              '<div style="font-size:0.62rem;color:var(--text-muted)">เฉลี่ยจาก ' + s.count + ' แคมเปญ</div>' +
            '</div>'
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="card mb-4" style="padding:16px">' +
        '<div style="font-weight:700;font-size:0.88rem;margin-bottom:10px">📆 แนวโน้มงบประมาณ (3 เดือนล่าสุด)</div>' +
        '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:0.8rem;margin-bottom:8px">' +
          '<span>💸 เฉลี่ย/เดือน <strong>' + formatCurrency(avgMonthlyBudget) + '</strong></span>' +
          '<span>' + (trend > 0 ? '📈 เพิ่มขึ้น' : trend < 0 ? '📉 ลดลง' : '➖ คงที่') + ' <strong style="color:var(--' + (trend > 0 ? 'warning' : trend < 0 ? 'success' : 'muted') + ')">' + formatCurrency(Math.abs(trend)) + '</strong></span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:flex-end;height:80px">' +
          recentMonths.map(mk => {
            const val = byMonth[mk]
            const maxVal = Math.max(...recentMonths.map(m => byMonth[m]), 1)
            const h = Math.max(8, Math.round(val / maxVal * 70))
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">' +
              '<div style="font-size:0.6rem;color:var(--text-muted)">' + formatCurrency(val) + '</div>' +
              '<div style="width:100%;background:var(--primary);border-radius:4px 4px 0 0;height:' + h + 'px"></div>' +
              '<div style="font-size:0.62rem;color:var(--text-muted)">' + monthLabel(mk) + '</div>' +
            '</div>'
          }).join('') +
        '</div>' +
      '</div>' +
      (best ? '<div class="card" style="padding:16px;background:var(--primary-dim);border:1px solid var(--primary)">' +
        '<div style="font-weight:700;font-size:0.85rem;color:var(--primary);margin-bottom:6px">💡 คำแนะนำสำหรับเดือนถัดไป</div>' +
        '<div style="font-size:0.8rem">แนะนำใช้แคมเปญประเภท <strong>' + PROMO_TYPES[best.type].icon + ' ' + PROMO_TYPES[best.type].label + '</strong> ' +
          'เพราะให้ ROI เฉลี่ยสูงสุด (' + best.avgRoi + 'x จากประวัติ ' + best.count + ' แคมเปญ) ' +
          'งบประมาณที่แนะนำประมาณ <strong>' + formatCurrency(best.avgBudget) + '</strong> ต่อแคมเปญ' +
        '</div>' +
      '</div>' : '') +
      '<p style="font-size:0.68rem;color:var(--text-muted);margin-top:10px">📊 คาดการณ์จากค่าเฉลี่ยสถิติย้อนหลังของแคมเปญจริงในระบบ ไม่ใช่การพยากรณ์ตลาดภายนอก</p>'
  }

  // ── เปรียบเทียบแคมเปญ ────────────────────────────────────────────────────
  function openCompareModal(items) {
    if (items.length < 2) return
    openModal({
      title: '⚖️ เปรียบเทียบแคมเปญ (' + items.length + ' รายการ)',
      size: 'lg',
      body: '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.78rem">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid var(--border)">รายการ</th>' +
          items.map(p => '<th style="text-align:center;padding:6px;border-bottom:1px solid var(--border)">' + esc(p.title) + '</th>').join('') +
        '</tr></thead><tbody>' +
          cmpRow('แบรนด์/รุ่น', items.map(p => esc(p.brand || '-') + ' ' + esc(p.model))) +
          cmpRow('ประเภท', items.map(p => PROMO_TYPES[p.type]?.icon + ' ' + PROMO_TYPES[p.type]?.label)) +
          cmpRow('ช่วงเวลา', items.map(p => formatDate(p.startDate) + ' — ' + formatDate(p.endDate))) +
          cmpRow('มูลค่า/คัน', items.map(p => formatCurrency(p.value))) +
          cmpRow('งบประมาณ', items.map(p => formatCurrency(p.budget))) +
          cmpRow('ใช้สิทธิ์', items.map(p => p.used + (p.limit ? '/' + p.limit : ''))) +
          cmpRow('งบใช้ไป', items.map(p => formatCurrency(calcPromoMetrics(p).budgetUsed))) +
          cmpRow('Revenue', items.map(p => formatCurrency(calcPromoMetrics(p).revenueGenerated))) +
          cmpRow('ROI', items.map(p => { const r = calcPromoMetrics(p).roi; return r > 0 ? '<strong style="color:var(--' + (r >= 10 ? 'success' : r >= 5 ? 'warning' : 'danger') + ')">' + r + 'x</strong>' : '-' })) +
        '</tbody></table></div>'
    })
  }
  function cmpRow(label, values) {
    return '<tr><td style="padding:6px;color:var(--text-muted);border-bottom:1px solid var(--border-subtle)">' + label + '</td>' +
      values.map(v => '<td style="text-align:center;padding:6px;border-bottom:1px solid var(--border-subtle)">' + v + '</td>').join('') + '</tr>'
  }

  // ── นำเข้าจากประกาศ AI (ข้อความ หรือ รูปภาพ/เอกสาร) ──────────────────────────
  function openAiImportModal() {
    const { el, close } = openModal({
      title: '🤖 นำเข้าแคมเปญจากประกาศ AI',
      size: 'md',
      body:
        '<div class="input-group"><label class="input-label">วางข้อความประกาศ (ถ้ามี)</label><textarea class="input" id="ai-text" rows="4" placeholder="วางข้อความประกาศแคมเปญที่นี่..."></textarea></div>' +
        '<div class="input-group"><label class="input-label">หรือแนบรูปภาพ/เอกสาร (ถ้ามี)</label><input class="input" type="file" id="ai-file" accept="image/*,.pdf"></div>' +
        '<span class="input-error" id="ai-err"></span>' +
        '<div id="ai-review" style="display:none;margin-top:12px"></div>',
      footer: '<button class="btn btn-secondary" id="ai-cancel">ยกเลิก</button><button class="btn btn-primary" id="ai-analyze">🤖 วิเคราะห์</button>'
    })
    el.querySelector('#ai-cancel').addEventListener('click', close)
    el.querySelector('#ai-analyze').addEventListener('click', async () => {
      const text = el.querySelector('#ai-text').value.trim()
      const file = el.querySelector('#ai-file').files?.[0]
      if (!text && !file) { el.querySelector('#ai-err').textContent = '⚠️ กรุณาวางข้อความหรือแนบไฟล์อย่างน้อย 1 อย่าง'; return }

      const btn = el.querySelector('#ai-analyze'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลังวิเคราะห์...'
      try {
        let imageBase64 = null, mimeType = 'image/jpeg'
        if (file) { imageBase64 = await fileToBase64(file); mimeType = file.type || 'image/jpeg' }
        const result = await analyzeCampaignAnnouncement({ text, imageBase64, mimeType })
        btn.disabled = false; btn.textContent = '🤖 วิเคราะห์ใหม่'
        if (result.demo) showToast('🤖 Demo mode — ตั้งค่า VITE_GEMINI_API_KEY เพื่อวิเคราะห์จริง', 'info')
        if (!result.rows.length) { el.querySelector('#ai-err').textContent = '⚠️ ไม่พบแคมเปญในเนื้อหาที่วิเคราะห์'; return }
        renderAiReview(el, result.rows)
      } catch (err) {
        btn.disabled = false; btn.textContent = '🤖 วิเคราะห์'
        showToast('❗ วิเคราะห์ไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'), 'error')
      }
    })

    function renderAiReview(el, rows) {
      const box = el.querySelector('#ai-review')
      box.style.display = 'block'
      box.innerHTML = '<div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">✅ พบ ' + rows.length + ' แคมเปญ — ตรวจสอบก่อนนำเข้า</div>' +
        rows.map((r, i) => (
          '<div style="background:var(--surface-2);border-radius:8px;padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;gap:8px">' +
            '<input type="checkbox" class="ai-row-inc" data-i="' + i + '" checked>' +
            '<div style="flex:1;font-size:0.76rem">' +
              '<strong>' + esc(r.brand) + ' ' + esc(r.model) + '</strong> — ' + esc(r.title) + '<br>' +
              '<span style="color:var(--text-muted)">' + (PROMO_TYPES[r.type]?.label || r.type) + ' · ' + formatCurrency(r.value) + ' · ' + (r.startDate || '?') + ' — ' + (r.endDate || '?') + '</span>' +
            '</div>' +
          '</div>'
        )).join('') +
        '<button class="btn btn-primary btn-sm" id="ai-confirm-import" style="width:100%;margin-top:8px">✅ นำเข้าที่เลือก</button>'

      box.querySelector('#ai-confirm-import').addEventListener('click', async () => {
        const toImport = rows.filter((_, i) => box.querySelector('.ai-row-inc[data-i="' + i + '"]')?.checked)
        if (!toImport.length) return showToast('กรุณาเลือกอย่างน้อย 1 รายการ', 'warning')
        const cbtn = box.querySelector('#ai-confirm-import'); cbtn.disabled = true; cbtn.innerHTML = '<span class="spinner spinner-sm"></span>'
        let ok = 0
        for (const r of toImport) {
          const data = {
            title: r.title || (r.brand + ' ' + r.model), brand: r.brand || '', model: r.model || 'ทุกรุ่น',
            type: PROMO_TYPES[r.type] ? r.type : 'discount', value: Number(r.value) || 0,
            startDate: r.startDate || addDays(0), endDate: r.endDate || addDays(30),
            status: 'upcoming', used: 0, limit: Number(r.limit) || 0, budget: Number(r.budget) || 0,
            note: r.conditions || '',
          }
          try {
            const id = await createDoc('promotions', data)
            promos.unshift({ id, ...data, _persisted: true })
            ok++
          } catch { promos.unshift({ id: 'P' + Date.now() + ok, ...data, _persisted: false }); ok++ }
        }
        try {
          await createDoc('notifications', {
            type: 'marketing',
            title: 'นำเข้าแคมเปญใหม่จาก AI',
            body: 'นำเข้า ' + ok + ' แคมเปญจากประกาศ — กรุณาตรวจสอบก่อนเปิดใช้งาน',
            read: false, link: '/marketing/promotions', createdAt: new Date().toISOString(),
          })
          setState('unreadCount', (getState('unreadCount') || 0) + 1)
        } catch {}
        showToast('✅ นำเข้า ' + ok + ' แคมเปญแล้ว', 'success')
        close(); renderPage()
      })
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  renderPage()
}

function kpi(t, v, c) {
  return '<div class="card" style="padding:14px 16px;border-left:3px solid var(--' + c + ')">' +
    '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">' + t + '</div>' +
    '<div style="font-size:1.2rem;font-weight:800;color:var(--' + c + ')">' + v + '</div></div>'
}

function miniKpi(label, value, color) {
  return '<div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--radius-sm)">' +
    '<div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">' + label + '</div>' +
    '<div style="font-weight:700;color:var(--' + color + ');font-size:0.9rem">' + value + '</div></div>'
}

function row(l, v) {
  return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">' + l + '</span><span>' + v + '</span></div>'
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
