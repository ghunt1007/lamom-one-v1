/**
 * Promotion Engine — กิจกรรมส่งเสริมการขาย
 * Route: /marketing/promotions
 */
import { getSalesData } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

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
  { id: 'P001', title: 'BYD Dolphin ลดพิเศษ 20,000 บาท', type: 'discount', value: 20000, model: 'BYD Dolphin', startDate: addDays(-30), endDate: addDays(20), status: 'active', used: 28, limit: 50, budget: 1000000, note: 'โปรโมชั่น H2 2025 ช่วงเปิดตัวรุ่นใหม่' },
  { id: 'P002', title: 'MG ZS EV Cashback 30,000 บาท', type: 'cashback', value: 30000, model: 'MG ZS EV', startDate: addDays(-15), endDate: addDays(25), status: 'active', used: 12, limit: 30, budget: 900000, note: 'ร่วมกับ MG Thailand' },
  { id: 'P003', title: 'BYD Atto 3 แถม Wallbox ฟรี', type: 'free_acc', value: 15000, model: 'BYD Atto 3', startDate: addDays(5), endDate: addDays(35), status: 'upcoming', used: 0, limit: 20, budget: 300000, note: 'Wallbox มูลค่า 15,000 บาท' },
  { id: 'P004', title: 'ดอกเบี้ย 0% 60 เดือน ทุกรุ่น', type: 'finance', value: 0, model: 'ทุกรุ่น', startDate: addDays(-90), endDate: addDays(-1), status: 'ended', used: 45, limit: 100, budget: 0, note: 'โปรฯ ร่วมกับธนาคาร Q1' },
  { id: 'P005', title: 'BYD Seal ฟรีค่าบริการ 3 ปี', type: 'free_service', value: 45000, model: 'BYD Seal', startDate: addDays(-10), endDate: addDays(28), status: 'active', used: 5, limit: 15, budget: 675000, note: 'บริการฟรี 3 ปี หรือ 60,000 กม.' },
]

// หาว่าการขายไหนน่าจะมาจากโปรโมชั่นนี้ (ตรง model + ช่วงวันที่)
function matchSalesToPromo(sales, promo) {
  const pm = (promo.model || '').toLowerCase().trim()
  return sales.filter(s => {
    const sModel = ((s.model || '') + ' ' + (s.brand || '')).toLowerCase()
    const modelMatch = pm === 'ทุกรุ่น' || sModel.includes(pm) || pm.split(' ').some(w => w.length > 2 && sModel.includes(w))
    const dateOk = s.date && s.date >= promo.startDate && s.date <= (promo.endDate || '9999')
    return modelMatch && dateOk
  })
}

export default async function PromotionEnginePage(container) {
  const myGen = container.__routerGen
  let promos = DEMO_PROMOS.map(p => ({ ...p }))
  let allSales = []
  let statusFilter = 'all'
  let typeFilter = 'all'
  let loading = true

  // โหลดข้อมูลการขายจริง
  try {
    allSales = await getSalesData()
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
      (typeFilter === 'all' || p.type === typeFilter)
    )
  }

  function renderPage() {
    const list = getFiltered()
    const activeCount = promos.filter(p => p.status === 'active').length
    const totalBudget = promos.reduce((a, p) => a + (p.budget || 0), 0)
    const totalBudgetUsed = promos.reduce((a, p) => a + calcPromoMetrics(p).budgetUsed, 0)
    const totalRevenue = promos.reduce((a, p) => a + calcPromoMetrics(p).revenueGenerated, 0)
    const overallRoi = totalBudgetUsed > 0 ? Math.round(totalRevenue / totalBudgetUsed) : 0

    container.innerHTML =
      '<div class="page-content animate-slide">' +
        '<div class="page-header"><div>' +
          '<div class="page-title">🎪 กิจกรรมส่งเสริมการขาย</div>' +
          '<div class="page-subtitle">จัดการโปรโมชั่น วิเคราะห์ ROI และงบประมาณ</div>' +
        '</div><div class="page-actions">' +
          '<button class="btn btn-secondary" id="pe-export">📥 Export</button>' +
          '<button class="btn btn-primary" id="add-promo-btn">+ สร้างโปรโมชั่น</button>' +
        '</div></div>' +

        // KPI cards
        '<div class="grid-4 mb-6">' +
          kpi('🎪 Active', activeCount + '/' + promos.length, 'success') +
          kpi('💸 งบแถมใช้ไป', formatCurrency(totalBudgetUsed), 'warning') +
          kpi('💰 Revenue จากโปร', formatCurrency(totalRevenue), 'primary') +
          kpi('📈 ROI รวม', (overallRoi ? overallRoi + 'x' : '-'), overallRoi >= 5 ? 'success' : 'accent') +
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
        '</div>' +

        '<div id="promo-list">' + renderPromoList(list) + '</div>' +
      '</div>'

    container.querySelector('#add-promo-btn').addEventListener('click', openAddForm)
    container.querySelector('#pe-export').addEventListener('click', () => {
      exportToExcel(promos.map(p => {
        const m = calcPromoMetrics(p)
        return { ID: p.id, โปรโมชั่น: p.title, ประเภท: PROMO_TYPES[p.type]?.label, รุ่น: p.model, วันเริ่ม: p.startDate, วันสิ้นสุด: p.endDate, สถานะ: PROMO_STATUS[p.status]?.label, ใช้สิทธิ์: p.used, จำกัด: p.limit, มูลค่าต่อคัน: p.value, งบประมาณ: p.budget, งบใช้ไป: m.budgetUsed, Revenue: m.revenueGenerated, ROI: m.roi + 'x' }
      }), 'promotions_' + new Date().toISOString().slice(0,10))
      showToast('📥 Export แล้ว', 'success')
    })
    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.detail-btn').forEach(b => b.addEventListener('click', () => {
      const p = promos.find(x => x.id === b.dataset.id)
      if (p) openDetail(p)
    }))
    container.querySelectorAll('.end-btn').forEach(b => b.addEventListener('click', () => {
      const p = promos.find(x => x.id === b.dataset.id)
      if (p) { p.status = 'ended'; showToast('❌ ยุติโปรโมชั่น "' + p.title + '" แล้ว', 'warning'); renderPage() }
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
                '<span style="font-size:1.1rem">' + pt.icon + '</span>' +
                '<div style="font-weight:700;font-size:0.88rem">' + esc(p.title) + '</div>' +
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

  function openAddForm() {
    const { el, close } = openModal({
      title: '+ สร้างโปรโมชั่นใหม่',
      size: 'md',
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อโปรโมชั่น *</label><input class="input" id="pp-title"></div>' +
          '<div class="input-group"><label class="input-label">ประเภท</label>' +
            '<select class="input" id="pp-type">' + Object.entries(PROMO_TYPES).map(([k,v]) => '<option value="' + k + '">' + v.icon + ' ' + v.label + '</option>').join('') + '</select>' +
          '</div>' +
          '<div class="input-group"><label class="input-label">มูลค่า/คัน (บาท)</label><input type="number" class="input" id="pp-value" value="0"></div>' +
          '<div class="input-group"><label class="input-label">วันเริ่ม</label><input type="date" class="input" id="pp-start" value="' + addDays(0) + '"></div>' +
          '<div class="input-group"><label class="input-label">วันสิ้นสุด</label><input type="date" class="input" id="pp-end" value="' + addDays(30) + '"></div>' +
          '<div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="pp-model" value="ทุกรุ่น"></div>' +
          '<div class="input-group"><label class="input-label">จำกัดสิทธิ์ (0=ไม่จำกัด)</label><input type="number" class="input" id="pp-limit" value="50"></div>' +
          '<div class="input-group" style="grid-column:1/-1"><label class="input-label">งบประมาณ FOC (บาท)</label><input type="number" class="input" id="pp-budget" value="0"></div>' +
          '<div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><input class="input" id="pp-note"></div>' +
        '</div>',
      footer: '<button class="btn btn-secondary" id="pp-cancel">ยกเลิก</button><button class="btn btn-primary" id="pp-save">💾 บันทึก</button>'
    })

    el.querySelector('#pp-cancel').addEventListener('click', close)
    el.querySelector('#pp-save').addEventListener('click', () => {
      const title = el.querySelector('#pp-title').value.trim()
      if (!title) { showToast('❗ กรุณากรอกชื่อโปรโมชั่น', 'error'); return }
      promos.unshift({
        id: 'P' + String(promos.length + 1).padStart(3, '0'), title,
        type: el.querySelector('#pp-type').value,
        value: +el.querySelector('#pp-value').value || 0,
        model: el.querySelector('#pp-model').value || 'ทุกรุ่น',
        startDate: el.querySelector('#pp-start').value,
        endDate: el.querySelector('#pp-end').value,
        status: 'upcoming', used: 0,
        limit: +el.querySelector('#pp-limit').value || 0,
        budget: +el.querySelector('#pp-budget').value || 0,
        note: el.querySelector('#pp-note').value.trim(),
      })
      showToast('✅ สร้างโปรโมชั่นแล้ว!', 'success')
      close()
      renderPage()
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
