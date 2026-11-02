/**
 * Customer Journey — เส้นทางของลูกค้า
 * Route: /analytics/journey
 */
import { formatDate, formatCurrency, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { getSalesData, listDocs, listAllDocs } from '../../core/db.js'
import { realFunnel, repeatBuyers } from '../../utils/realFunnel.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { kpi } from '../../utils/kpiCard.js'

const JOURNEY_STAGES = [
  { id: 'awareness',     label: 'ลูกค้า/Lead', icon: '👁', color: '#8b5cf6', count: 0, dropPct: 0 },
  { id: 'interest',      label: 'สนใจ/จอง', icon: '💡', color: '#3b82f6', count: 0, dropPct: 0 },
  { id: 'consideration', label: 'ลองขับ', icon: '🚗', color: '#06b6d4', count: 0, dropPct: 0 },
  { id: 'intent',        label: 'ใบเสนอราคา', icon: '📄', color: '#10b981', count: 0, dropPct: 0 },
  { id: 'purchase',      label: 'ซื้อ', icon: '🚗', color: '#f59e0b', count: 0, dropPct: 0 },
  { id: 'loyalty',       label: 'ซื้อซ้ำ', icon: '👑', color: '#ef4444', count: 0, dropPct: 0 },
]

const TOUCHPOINTS = {
  'Facebook Ad':    { stage: 'awareness', count: 0, icon: '📘' },
  'Google Search':  { stage: 'awareness', count: 0, icon: '🔍' },
  'Walk-in':        { stage: 'interest', count: 0, icon: '🚶' },
  'LINE Chat':      { stage: 'interest', count: 0, icon: '💬' },
  'Test Drive':     { stage: 'consideration', count: 0, icon: '🚗' },
  'Quote Request':  { stage: 'intent', count: 0, icon: '📄' },
  'Finance Apply':  { stage: 'intent', count: 0, icon: '💳' },
  'Purchase':       { stage: 'purchase', count: 0, icon: '🤝' },
  'Service Visit':  { stage: 'loyalty', count: 0, icon: '🔧' },
  'Referral':       { stage: 'loyalty', count: 0, icon: '👥' },
}

export default async function CustomerJourneyPage(container) {
  const myGen = container.__routerGen
  let stages = JOURNEY_STAGES.map(s => ({ ...s }))
  let dataSource = 'demo'

  try {
    const [sales, leads, testDrives, quotations] = await Promise.all([
      getSalesData().catch(() => []),
      listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
      listDocs('test_drives', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
      listDocs('quotations', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    // (2026-11-02) นับจากข้อมูลจริงเท่านั้น — เลิกเดา "รู้จักแบรนด์ = Lead × 3" และอัตราสมมติอื่นๆ
    const f = Object.fromEntries(realFunnel({ customers: leads, sales, testDrives, quotations }).map(x => [x.key, x.count]))
    const live = leads.filter(l => !l.deleted)
    const hot = live.filter(l => l.temperature === 'hot' || l.stage === 'pp' || l.stage === 'booking' || l.stage === 'delivered').length
    const counts = [f.lead, hot, f.td, f.quote, f.booked, repeatBuyers(sales)]
    counts.forEach((n, i) => { stages[i].count = n })
    // จุดสัมผัส: นับจากที่มาลูกค้าจริง + ขั้นที่บันทึกจริง
    const bySrc = re => live.filter(l => re.test(String(l.source || ''))).length
    const real = { 'Facebook Ad': bySrc(/facebook|fb|เฟส/i), 'Google Search': bySrc(/google|กูเกิล/i), 'Walk-in': bySrc(/walk|หน้าร้าน|โชว์รูม/i), 'LINE Chat': bySrc(/line|ไลน์/i),
      'Test Drive': f.td, 'Quote Request': f.quote, 'Finance Apply': sales.filter(x => x.financeCo).length, 'Purchase': f.booked, 'Service Visit': 0, 'Referral': bySrc(/refer|แนะนำ/i) }
    Object.entries(real).forEach(([k, n]) => { if (TOUCHPOINTS[k]) TOUCHPOINTS[k].count = n })
    if (f.lead) dataSource = 'live'
  } catch {}

  function renderPage() {
    const totalConv = stages[0].count ? Math.round(stages[4].count / stages[0].count * 100 * 10) / 10 : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗺️ Customer Journey</div>
            <div class="page-subtitle">วิเคราะห์เส้นทางลูกค้าตั้งแต่รู้จักจนซื้อ</div>
          </div>
        </div>

        ${dataSource === 'live' ? '<div style="margin-bottom:10px;padding:6px 12px;background:var(--surface-2);border-left:3px solid var(--success);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--success)">● Funnel อิงข้อมูลจริงจากใบจอง/Leads</div>' : ''}
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🧲 ลูกค้า/Lead', stages[0].count.toLocaleString(), 'primary')}
          ${kpi('🚗 ซื้อแล้ว', stages[4].count, 'success')}
          ${kpi('📊 อัตราปิดการขาย', totalConv + '%', totalConv >= 10 ? 'success' : 'warning')}
          ${kpi('👑 ซื้อซ้ำ', stages[5].count, 'secondary')}
        </div>

        <!-- Funnel visualization -->
        <div class="card" style="padding:20px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:16px">🔽 กรวยการขาย</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${stages.map((stage, i) => {
              const barWidth = stages[0].count ? Math.round(stage.count / stages[0].count * 100) : 0
              const nextStage = stages[i + 1]
              const convRate = i > 0 && stages[0].count ? Math.min(100, Math.round(stage.count / stages[0].count * 100)) : null // % ของลูกค้าทั้งหมด
              return `<div>
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="width:100px;font-size:0.8rem;text-align:right;color:var(--text-muted)">${stage.icon} ${stage.label}</div>
                  <div style="flex:1;background:var(--surface-2);border-radius:3px;height:36px;position:relative">
                    <div style="width:${barWidth}%;background:${stage.color};height:36px;border-radius:3px;display:flex;align-items:center;padding-left:10px;min-width:60px">
                      <span style="font-weight:800;font-size:0.85rem;color:white">${stage.count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style="width:80px;text-align:right;font-size:0.75rem">
                    ${convRate !== null ? `<span style="color:${convRate>=60?'var(--success)':convRate>=40?'var(--warning)':'var(--danger)'}">${convRate}% ของลูกค้า</span>` : ''}
                  </div>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Touchpoints & Time analysis -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📍 จุดสัมผัสลูกค้า</div>
            ${Object.entries(TOUCHPOINTS).map(([name, tp]) => {
              const maxCount = Math.max(...Object.values(TOUCHPOINTS).map(x => x.count))
              const pct = maxCount ? Math.round(tp.count / maxCount * 100) : 0
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                  <span>${tp.icon} ${name}</span>
                  <span style="font-weight:700">${tp.count.toLocaleString()}</span>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:5px">
                  <div style="width:${pct}%;background:var(--primary);height:5px;border-radius:3px"></div>
                </div>
              </div>`
            }).join('')}
          </div>

        </div>
      </div>
    `
  }

  renderPage()
}

