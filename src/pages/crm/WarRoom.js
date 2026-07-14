/**
 * Sales War Room — ศูนย์บัญชาการขาย
 * Route: /crm/warroom
 *
 * Unifies 4 pages users previously had to click between (Pipeline, Conversion Funnel,
 * Win/Loss Analysis, Customer Journey) into one tabbed view with a top summary strip,
 * so a sales manager gets the full sales-strategy picture without page-hopping.
 *
 * This page does NOT modify or import internals from Pipeline.js / ConversionFunnel.js /
 * CustomerJourney.js / LostDealAnalysis.js — none of them export reusable functions, so
 * fresh focused queries are written here against the same collections they use
 * (`customers`, `bookings` via getSalesData()).
 */
import { formatCurrency } from '../../utils/format.js'
import { getSalesData, listDocs, seedDemoData } from '../../core/db.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Pipeline (condensed kanban) ─────────────────────────────────────────────
const PIPE_STAGES = [
  { key: 'lead',      label: '🧲 Lead',       color: 'accent' },
  { key: 'pp',        label: '📇 Prospect',   color: 'primary' },
  { key: 'booking',   label: '📝 จองแล้ว',    color: 'warning' },
  { key: 'delivered', label: '✅ ส่งมอบแล้ว', color: 'success' },
]

// ── Conversion Funnel (demo baseline, overridden by live data like ConversionFunnel.js) ──
const FUNNEL_STAGES = [
  { stage: 'Lead เข้ามา', count: 420, icon: '🧲', color: '#3b82f6' },
  { stage: 'ติดต่อสำเร็จ', count: 312, icon: '📞', color: '#06b6d4' },
  { stage: 'เข้าโชว์รูม', count: 186, icon: '🏪', color: '#10b981' },
  { stage: 'Test Drive', count: 124, icon: '🚗', color: '#f59e0b' },
  { stage: 'รับใบเสนอราคา', count: 95, icon: '📄', color: '#f97316' },
  { stage: 'จอง', count: 52, icon: '📝', color: '#ef4444' },
  { stage: 'ปิดการขาย', count: 41, icon: '🏁', color: '#8b5cf6' },
]

// ── Customer Journey (demo baseline, overridden by live data like CustomerJourney.js) ──
const JOURNEY_STAGES = [
  { id: 'awareness',     label: 'รู้จัก', icon: '👁', color: '#8b5cf6', count: 2840 },
  { id: 'interest',      label: 'สนใจ', icon: '💡', color: '#3b82f6', count: 1080 },
  { id: 'consideration', label: 'พิจารณา', icon: '🤔', color: '#06b6d4', count: 495 },
  { id: 'intent',        label: 'ตัดสินใจ', icon: '🎯', color: '#10b981', count: 298 },
  { id: 'purchase',      label: 'ซื้อ', icon: '🚗', color: '#f59e0b', count: 232 },
  { id: 'loyalty',       label: 'ลูกค้าประจำ', icon: '👑', color: '#ef4444', count: 89 },
]

// ── Win/Loss reasons ─────────────────────────────────────────────────────────
const LOST_REASONS = {
  price:       { label: '💸 ราคาแพงเกินไป', color: 'danger' },
  competitor:  { label: '🏁 ไปซื้อคู่แข่ง', color: 'warning' },
  model:       { label: '🚗 ไม่มีรุ่นที่ต้องการ', color: 'primary' },
  finance:     { label: '💳 ไฟแนนซ์ไม่ผ่าน', color: 'accent' },
  timing:      { label: '⏰ ยังไม่พร้อมซื้อ', color: 'primary' },
  service:     { label: '🔧 ไม่พอใจบริการ', color: 'danger' },
  location:    { label: '📍 ไกลเกินไป', color: 'accent' },
  changed_mind:{ label: '🤔 เปลี่ยนใจ', color: 'primary' },
  no_contact:  { label: '📵 ติดต่อไม่ได้', color: 'warning' },
  other:       { label: '📋 อื่นๆ', color: 'primary' },
}

const DEMO_LOST_DEALS = [
  { id:'LD001', custName:'มานะ ลองดู', interestedIn:'BYD Seal AWD', budget:1200000, lostReason:'price', lostTo:'Tesla Model 3' },
  { id:'LD002', custName:'สวรรค์ ฝันอยาก', interestedIn:'MG4 X', budget:1000000, lostReason:'finance', lostTo:null },
  { id:'LD003', custName:'ธรรมนูญ เที่ยว', interestedIn:'BYD Atto3', budget:900000, lostReason:'timing', lostTo:null },
  { id:'LD004', custName:'ปาณิสรา งดงาม', interestedIn:'DEEPAL S07', budget:1100000, lostReason:'competitor', lostTo:'BYD Seal' },
  { id:'LD005', custName:'กฤษณะ หล่อมาก', interestedIn:'MG ZS EV', budget:800000, lostReason:'price', lostTo:'BYD Seagull' },
  { id:'LD006', custName:'อรทัย ดีงาม', interestedIn:'BYD Seal AWD', budget:1300000, lostReason:'service', lostTo:'Toyota' },
  { id:'LD007', custName:'บรรพต ฝากไว้', interestedIn:'MG4 X', budget:1100000, lostReason:'model', lostTo:null },
]

export default async function WarRoomPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let tab = 'pipeline'
  let customers = []
  let bookings = []
  let sales = []
  let funnelStages = [...FUNNEL_STAGES].map(s => ({ ...s }))
  let journeyStages = JOURNEY_STAGES.map(s => ({ ...s }))
  let lostDeals = DEMO_LOST_DEALS.map(d => ({ ...d }))

  // ── Load everything up front so the summary strip + all 4 tabs are ready instantly ──
  try {
    const [customersRes, bookingsRes, salesRes] = await Promise.all([
      listDocs('customers', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('bookings', [], 'createdAt', 'desc', 500).catch(() => []),
      getSalesData().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    customers = customersRes
    bookings = bookingsRes
    sales = salesRes

    const purchased = sales.length
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

    // Conversion funnel — same monotonic-clamp approach as ConversionFunnel.js
    if (purchased >= 1) {
      const allLeads = Math.max(customers.length, purchased) || Math.max(purchased * 8, 10)
      const contacted = clamp(Math.round(allLeads * 0.74), purchased, allLeads)
      const showroom = clamp(Math.round(allLeads * 0.44), purchased, contacted)
      const testDriven = clamp(customers.filter(l => l.testDrive || l.testDriveDate).length || Math.round(allLeads * 0.30), purchased, showroom)
      const quoted = clamp(customers.filter(l => l.quoteSent || l.quoteDate).length || Math.round(purchased * 2.3), purchased, testDriven)
      const reserved = clamp(Math.round(purchased * 1.27), purchased, quoted)
      funnelStages[0].count = allLeads
      funnelStages[1].count = contacted
      funnelStages[2].count = showroom
      funnelStages[3].count = testDriven
      funnelStages[4].count = quoted
      funnelStages[5].count = reserved
      funnelStages[6].count = purchased
    }

    // Customer journey — same approach as CustomerJourney.js
    if (purchased >= 1) {
      const allLeads = Math.max(customers.length, purchased) || Math.max(purchased * 4, 10)
      const hotLeads = clamp(customers.filter(l => l.temperature === 'hot' || l.stage === 'pp').length || Math.round(allLeads * 0.46), purchased, allLeads)
      const quotes = clamp(customers.filter(l => l.quoteSent || l.quoteDate).length || Math.round(purchased * 1.5), purchased, hotLeads)
      const loyal = Math.min(Math.round(purchased * 0.38), purchased)
      journeyStages[0].count = Math.max(allLeads * 3, purchased * 12)
      journeyStages[1].count = allLeads
      journeyStages[2].count = hotLeads
      journeyStages[3].count = quotes
      journeyStages[4].count = purchased
      journeyStages[5].count = loyal
    }

    // Win/Loss — same source blending as LostDealAnalysis.js
    const fromBookings = bookings
      .filter(b => b.status === 'ถอนจอง')
      .map(b => ({
        id: b.bookingNo || b.id,
        custName: b.custName || '',
        interestedIn: [b.brand, b.model].filter(Boolean).join(' '),
        budget: b.price || 0,
        lostReason: b.cancelReason || 'other',
        lostTo: b.cancelLostTo || null,
      }))
    const fromLeads = customers
      .filter(l => l.isLost === true)
      .map(l => ({
        id: l.id,
        custName: [l.firstName, l.lastName].filter(Boolean).join(' ') || l.custName || l.name || '',
        interestedIn: l.interestedModel || [l.brand, l.model].filter(Boolean).join(' ') || l.interest || '',
        budget: l.budget || 0,
        lostReason: l.lostReason || 'other',
        lostTo: l.lostTo || null,
      }))
    const live = [...fromBookings, ...fromLeads]
    if (live.length) lostDeals = [...live, ...DEMO_LOST_DEALS.map(d => ({ ...d }))]
  } catch {}

  // ── Derived numbers for the top summary strip ──────────────────────────────
  function computeSummary() {
    const activeCustomers = customers.filter(c => !c.isLost)
    const pipelineValue = activeCustomers.reduce((s, c) => s + (c.budget || 0), 0)

    const overallConv = Math.round(funnelStages[funnelStages.length - 1].count / funnelStages[0].count * 1000) / 10

    let worstDrop = { idx: 1, rate: 100 }
    funnelStages.forEach((s, i) => {
      if (i > 0) {
        const rate = Math.round(s.count / funnelStages[i - 1].count * 100)
        if (rate < worstDrop.rate) worstDrop = { idx: i, rate }
      }
    })
    const worstDropLabel = `${funnelStages[worstDrop.idx - 1].stage} → ${funnelStages[worstDrop.idx].stage}`

    const byReason = {}
    lostDeals.forEach(d => { byReason[d.lostReason] = (byReason[d.lostReason] || 0) + 1 })
    const topReasonEntry = Object.entries(byReason).sort(([, a], [, b]) => b - a)[0]
    const topReasonLabel = topReasonEntry ? (LOST_REASONS[topReasonEntry[0]]?.label || topReasonEntry[0]) : '-'

    return { pipelineValue, overallConv, worstDrop, worstDropLabel, topReasonLabel }
  }

  // ── Renderers ────────────────────────────────────────────────────────────
  function renderSummaryStrip() {
    const s = computeSummary()
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
        ${kpi('💰 มูลค่า Pipeline รวม', formatCurrency(s.pipelineValue), 'primary')}
        ${kpi('📊 Conversion รวม', s.overallConv + '%', s.overallConv >= 8 ? 'success' : 'warning')}
        ${kpi('⚠️ จุดรั่วใหญ่สุด', s.worstDropLabel, 'danger')}
        ${kpi('❌ เหตุผลเสียดีลหลัก', s.topReasonLabel.replace(/^[^\s]+ /, ''), 'warning')}
      </div>
    `
  }

  function renderPipelineTab() {
    const active = customers.filter(c => !c.isLost)
    return `
      <div style="display:flex;gap:12px;overflow-x:auto;align-items:flex-start;padding-bottom:8px">
        ${PIPE_STAGES.map(stage => {
          const cards = active.filter(c => c.stage === stage.key)
          const stageValue = cards.reduce((s, c) => s + (c.budget || 0), 0)
          return `
            <div style="min-width:210px;flex:1;max-width:260px;background:var(--surface-2);border-radius:var(--radius-lg);padding:12px 14px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-weight:700;font-size:0.85rem;color:var(--${stage.color})">${stage.label}</span>
                <span class="badge badge-${stage.color}">${cards.length}</span>
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">${formatCurrency(stageValue)}</div>
              <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto">
                ${cards.slice(0, 8).map(c => `
                  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 10px;border-left:3px solid var(--${stage.color})">
                    <div style="font-weight:600;font-size:0.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml([c.firstName, c.lastName].filter(Boolean).join(' ') || c.custName || '-')}${c.vip ? ' ⭐' : ''}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${escHtml(c.interestedModel || '-')}</div>
                    <div style="font-size:0.74rem;font-weight:600;color:var(--accent)">${c.budget ? '฿' + Number(c.budget).toLocaleString() : '-'}</div>
                  </div>
                `).join('')}
                ${!cards.length ? `<div style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:12px;text-align:center;color:var(--text-muted);font-size:0.74rem">ไม่มีรายการ</div>` : ''}
                ${cards.length > 8 ? `<div style="text-align:center;font-size:0.72rem;color:var(--text-muted)">+${cards.length - 8} รายการอื่น</div>` : ''}
              </div>
            </div>
          `
        }).join('')}
      </div>
      <div style="text-align:right;margin-top:10px">
        <button class="btn btn-secondary btn-sm" id="wr-open-pipeline">↗ เปิดหน้า Pipeline เต็มรูปแบบ</button>
      </div>
    `
  }

  function renderFunnelTab() {
    const maxCount = funnelStages[0].count
    const s = computeSummary()
    return `
      <div class="card" style="padding:18px;margin-bottom:14px">
        ${funnelStages.map((st, i) => {
          const widthPct = Math.round(st.count / maxCount * 100)
          const stepRate = i > 0 ? Math.round(st.count / funnelStages[i - 1].count * 100) : 100
          const isWorst = i === s.worstDrop.idx
          return `<div style="margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:130px;font-size:0.74rem;text-align:right">${st.icon} ${st.stage}</div>
              <div style="flex:1;display:flex;justify-content:center">
                <div style="width:${widthPct}%;background:${st.color};border-radius:4px;height:30px;display:flex;align-items:center;justify-content:center;min-width:60px;transition:width .3s">
                  <span style="font-size:0.74rem;font-weight:800;color:white">${st.count}</span>
                </div>
              </div>
              <div style="width:90px;font-size:0.7rem;color:var(--${isWorst ? 'danger' : 'text-muted'});font-weight:${isWorst ? 700 : 400}">
                ${i > 0 ? '↓ ' + stepRate + '%' + (isWorst ? ' ⚠️' : '') : ''}
              </div>
            </div>
          </div>`
        }).join('')}
      </div>
      <div style="text-align:right">
        <button class="btn btn-secondary btn-sm" id="wr-open-funnel">↗ เปิดหน้า Conversion Funnel เต็มรูปแบบ</button>
      </div>
    `
  }

  function renderJourneyTab() {
    return `
      <div class="card" style="padding:20px;margin-bottom:14px">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${journeyStages.map((stage, i) => {
            const barWidth = Math.round(stage.count / journeyStages[0].count * 100)
            const nextStage = journeyStages[i + 1]
            const convRate = nextStage ? Math.round(nextStage.count / stage.count * 100) : null
            return `<div>
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:100px;font-size:0.8rem;text-align:right;color:var(--text-muted)">${stage.icon} ${stage.label}</div>
                <div style="flex:1;background:var(--surface-2);border-radius:3px;height:32px;position:relative">
                  <div style="width:${barWidth}%;background:${stage.color};height:32px;border-radius:3px;display:flex;align-items:center;padding-left:10px;min-width:60px">
                    <span style="font-weight:800;font-size:0.82rem;color:white">${stage.count.toLocaleString()}</span>
                  </div>
                </div>
                <div style="width:80px;text-align:right;font-size:0.75rem">
                  ${convRate !== null ? `<span style="color:${convRate >= 60 ? 'var(--success)' : convRate >= 40 ? 'var(--warning)' : 'var(--danger)'}">↓ ${convRate}%</span>` : ''}
                </div>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
      <div style="text-align:right">
        <button class="btn btn-secondary btn-sm" id="wr-open-journey">↗ เปิดหน้า Customer Journey เต็มรูปแบบ</button>
      </div>
    `
  }

  function renderWinLossTab() {
    const totalLost = lostDeals.reduce((a, d) => a + d.budget, 0)
    const byReason = {}
    const byCompetitor = {}
    lostDeals.forEach(d => {
      byReason[d.lostReason] = (byReason[d.lostReason] || 0) + 1
      if (d.lostTo) byCompetitor[d.lostTo] = (byCompetitor[d.lostTo] || 0) + 1
    })
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px">
        ${kpi('💸 มูลค่าดีลที่เสีย', formatCurrency(totalLost), 'danger')}
        ${kpi('📋 จำนวนดีลที่เสีย', lostDeals.length + ' ดีล', 'warning')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">📊 สาเหตุที่เสียดีล</div>
          ${Object.entries(byReason).sort(([, a], [, b]) => b - a).map(([k, count]) => {
            const r = LOST_REASONS[k]; const pct = Math.round(count / lostDeals.length * 100)
            return `<div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                <span>${r?.label || k}</span><span style="font-weight:700">${count} (${pct}%)</span>
              </div>
              <div style="height:6px;background:var(--surface-3);border-radius:99px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--${r?.color || 'secondary'});border-radius:99px"></div>
              </div>
            </div>`
          }).join('') || '<div style="color:var(--text-muted);font-size:0.83rem">ไม่มีข้อมูล</div>'}
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">🏁 คู่แข่งที่ชนะ</div>
          ${Object.entries(byCompetitor).sort(([, a], [, b]) => b - a).length ? Object.entries(byCompetitor).sort(([, a], [, b]) => b - a).map(([comp, count]) => {
            const pct = Math.round(count / lostDeals.length * 100)
            return `<div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                <span>🚗 ${escHtml(comp)}</span><span style="font-weight:700">${count} ดีล</span>
              </div>
              <div style="height:6px;background:var(--surface-3);border-radius:99px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--danger);border-radius:99px"></div>
              </div>
            </div>`
          }).join('') : '<div style="color:var(--text-muted);font-size:0.83rem">ยังไม่มีข้อมูลคู่แข่ง</div>'}
        </div>
      </div>
      <div style="text-align:right;margin-top:10px">
        <button class="btn btn-secondary btn-sm" id="wr-open-lostdeal">↗ เปิดหน้า Win/Loss Analysis เต็มรูปแบบ</button>
      </div>
    `
  }

  const TABS = [
    { key: 'pipeline', label: '📋 Pipeline', render: renderPipelineTab },
    { key: 'funnel',   label: '🔻 Conversion Funnel', render: renderFunnelTab },
    { key: 'winloss',  label: '📉 Win/Loss', render: renderWinLossTab },
    { key: 'journey',  label: '🗺️ Customer Journey', render: renderJourneyTab },
  ]

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Sales War Room</div>
            <div class="page-subtitle">ศูนย์บัญชาการขาย — Pipeline, Funnel, Win/Loss, Journey ในหน้าเดียว</div>
          </div>
        </div>

        ${renderSummaryStrip()}

        <div class="tab-nav" style="margin-bottom:14px">
          ${TABS.map(t => `<button class="tab-btn ${tab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
        </div>

        <div id="wr-tab-content">
          ${TABS.find(t => t.key === tab).render()}
        </div>
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderPage() }))
    document.getElementById('wr-open-pipeline')?.addEventListener('click', () => navigate('/crm/pipeline'))
    document.getElementById('wr-open-funnel')?.addEventListener('click', () => navigate('/analytics/funnel'))
    document.getElementById('wr-open-journey')?.addEventListener('click', () => navigate('/analytics/journey'))
    document.getElementById('wr-open-lostdeal')?.addEventListener('click', () => navigate('/crm/lostdeals'))
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
