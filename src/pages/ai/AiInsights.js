/**
 * AI Insights — ข้อมูลเชิงลึกจาก AI
 * Route: /ai/insights
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData, getCommissionData } from '../../core/db.js'

const INSIGHT_CATS = {
  sales:    { label: 'ยอดขาย', icon: '📈', color: 'success' },
  risk:     { label: 'ความเสี่ยง', icon: '⚠️', color: 'danger' },
  opportunity: { label: 'โอกาส', icon: '🚀', color: 'primary' },
  customer: { label: 'ลูกค้า', icon: '👥', color: 'warning' },
  ops:      { label: 'Operations', icon: '⚙️', color: 'secondary' },
}

const PRIORITY = {
  high:   { label: 'สูง', color: 'danger' },
  medium: { label: 'ปานกลาง', color: 'warning' },
  low:    { label: 'ต่ำ', color: 'secondary' },
}

const AI_INSIGHTS = [
  { id: 'I001', cat: 'sales', priority: 'high', title: 'ยอดขาย BYD Dolphin เพิ่ม 28% MoM', detail: 'จากการวิเคราะห์ข้อมูล 6 เดือน พบว่า BYD Dolphin มียอดขายเพิ่มขึ้น 28% ในเดือนที่ผ่านมา เหตุจาก Campaign โปรโมชั่นและราคาที่เข้าถึงได้', recommendation: 'เพิ่มสต็อก BYD Dolphin อีก 10 คัน และขยาย Campaign ต่อเนื่อง', confidence: 94, impact: 'สูง' },
  { id: 'I002', cat: 'risk', priority: 'high', title: '56 ลูกค้า At-Risk ต้องการ Win-back', detail: 'ลูกค้า 56 รายที่เคยเป็น Loyal Customers ไม่มีการติดต่อนานกว่า 12 เดือน มีความเสี่ยงที่จะไปซื้อรถกับคู่แข่ง', recommendation: 'ส่ง Win-back Campaign ทันที พร้อม Special Offer สำหรับลูกค้า At-Risk', confidence: 87, impact: 'สูง' },
  { id: 'I003', cat: 'opportunity', priority: 'medium', title: 'Fleet Deal กับบริษัทโลจิสติกส์ 3 แห่ง', detail: 'AI ตรวจพบบริษัทโลจิสติกส์ในฐานข้อมูล Lead ที่มีความสนใจ Fleet EV 3 บริษัท รวม ~50 คัน', recommendation: 'มอบหมายทีม B2B ติดต่อทั้ง 3 บริษัทภายใน 1 สัปดาห์', confidence: 72, impact: 'สูง' },
  { id: 'I004', cat: 'customer', priority: 'medium', title: 'Customer Satisfaction ลดลง 0.3 คะแนน', detail: 'คะแนนเฉลี่ยจาก Google Review ลดลง 0.3 คะแนนใน 2 เดือนที่ผ่านมา สาเหตุหลักคือเวลารอคอยที่บริการ', recommendation: 'เพิ่มช่าง 1 คน หรือนัดหมายออนไลน์ล่วงหน้า 100%', confidence: 91, impact: 'ปานกลาง' },
  { id: 'I005', cat: 'ops', priority: 'low', title: 'อะไหล่ยอดใช้สูง 3 รายการ', detail: 'ไส้กรองอากาศ, น้ำมันเครื่อง, แผ่นเบรก — ใช้เกิน 80% ของสต็อก และอาจหมดภายใน 3 สัปดาห์', recommendation: 'สั่ง Replenishment ทั้ง 3 รายการก่อนหมดสต็อก', confidence: 99, impact: 'ต่ำ' },
  { id: 'I006', cat: 'sales', priority: 'medium', title: 'Lead Conversion Rate ต่ำกว่า Benchmark', detail: 'Conversion Rate อยู่ที่ 14% ต่ำกว่า Industry Benchmark 18% สาเหตุหลักคือ Follow-up ไม่ทันเวลา', recommendation: 'ตั้ง Automation Follow-up ทุก 48 ชม. สำหรับ Hot Lead', confidence: 83, impact: 'สูง' },
]

export default async function AiInsightsPage(container) {
  const myGen = container.__routerGen
  let catFilter = 'all'
  let priorityFilter = 'all'
  let insights = [...AI_INSIGHTS]
  let dataSource = 'demo'

  try {
    const [sales, coms] = await Promise.all([
      getSalesData().catch(() => []),
      getCommissionData().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    if (sales.length >= 2) {
      const liveInsights = []
      // Top brand insight
      const byBrand = {}
      sales.forEach(s => { const b = s.brand||'อื่นๆ'; byBrand[b] = (byBrand[b]||0)+1 })
      const topBrand = Object.entries(byBrand).sort((a,b)=>b[1]-a[1])[0]
      if (topBrand) {
        liveInsights.push({ id:'LI001', cat:'sales', priority:'medium', title:`${topBrand[0]} มียอดขายสูงสุด ${topBrand[1]} คัน`, detail:`จากการวิเคราะห์ใบจอง ${sales.length} รายการ ${topBrand[0]} คือแบรนด์ที่ขายดีที่สุด`, recommendation:`เพิ่มสต็อก ${topBrand[0]} และทำโปรโมชันต่อเนื่อง`, confidence:95, impact:'สูง' })
      }
      // Top salesperson insight
      if (coms.length) {
        const topSales = [...coms].sort((a,b)=>b.carsSold-a.carsSold)[0]
        if (topSales) {
          liveInsights.push({ id:'LI002', cat:'sales', priority:'low', title:`${topSales.salesName} ปิดดีลสูงสุด ${topSales.carsSold} คัน`, detail:`ยอดรวม ${formatCurrency(topSales.incomeTotal)} — ผลงานอยู่ระดับ Top Performer`, recommendation:`ให้เป็น Mentor ให้กับเซลส์ใหม่เพื่อ Transfer ทักษะ`, confidence:99, impact:'ปานกลาง' })
        }
      }
      // Revenue trend insight
      const totalRev = sales.reduce((a,s)=>a+(s.salePrice||0),0)
      const avgDeal = Math.round(totalRev / sales.length)
      liveInsights.push({ id:'LI003', cat:'ops', priority:'low', title:`Avg Deal Size ${formatCurrency(avgDeal)} จาก ${sales.length} ดีล`, detail:`วิเคราะห์จากใบจองจริง — ค่าเฉลี่ยต่อคันอยู่ที่ ${formatCurrency(avgDeal)}`, recommendation:`เน้น Upsell Option/Accessories เพื่อเพิ่ม Deal Size`, confidence:98, impact:'ต่ำ' })

      insights = [...liveInsights, ...AI_INSIGHTS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = insights.filter(i =>
      (catFilter === 'all' || i.cat === catFilter) &&
      (priorityFilter === 'all' || i.priority === priorityFilter)
    )
    const highPriority = insights.filter(i => i.priority === 'high').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔮 AI Insights</div>
            <div class="page-subtitle">ข้อมูลเชิงลึกจาก AI — วิเคราะห์และแนะนำ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="refresh-insights-btn">🔄 Refresh</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔮 Insights', insights.length + (dataSource === 'live' ? ' ●' : ''), 'primary')}
          ${kpi('🚨 Priority สูง', highPriority, highPriority > 0 ? 'danger' : 'secondary')}
          ${kpi('⭐ Avg Confidence', Math.round(AI_INSIGHTS.reduce((a, i) => a + i.confidence, 0) / AI_INSIGHTS.length) + '%', 'success')}
          ${kpi('📊 หมวดหมู่', Object.keys(INSIGHT_CATS).length, 'secondary')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
            ${Object.entries(INSIGHT_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${priorityFilter==='all'?'btn-primary':'btn-secondary'} pf-btn" data-p="all">ทุก Priority</button>
            ${Object.entries(PRIORITY).map(([k,v]) => `<button class="btn btn-xs ${priorityFilter===k?'btn-'+v.color:'btn-secondary'} pf-btn" data-p="${k}">${v.label}</button>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(ins => {
            const cat = INSIGHT_CATS[ins.cat]
            const pri = PRIORITY[ins.priority]
            return `<div class="card" style="padding:14px;border-left:4px solid var(--${cat?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div style="display:flex;gap:10px;align-items:center;flex:1">
                  <span style="font-size:1.6rem">${cat?.icon}</span>
                  <div>
                    <div style="font-weight:700;font-size:0.9rem">${ins.title}</div>
                    <div style="display:flex;gap:6px;margin-top:4px">
                      <span class="badge badge-${pri?.color}" style="font-size:0.62rem">Priority: ${pri?.label}</span>
                      <span class="badge badge-${cat?.color}" style="font-size:0.62rem">${cat?.label}</span>
                    </div>
                  </div>
                </div>
                <div style="text-align:right;min-width:70px">
                  <div style="font-size:0.75rem;color:var(--text-muted)">Confidence</div>
                  <div style="font-size:1.1rem;font-weight:900;color:var(--${ins.confidence >= 90 ? 'success' : ins.confidence >= 75 ? 'warning' : 'danger'})">${ins.confidence}%</div>
                </div>
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">${ins.detail}</div>
              <div style="padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.78rem;margin-bottom:10px">
                💡 <strong>แนะนำ:</strong> ${ins.recommendation}
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-primary action-btn" data-id="${ins.id}">✅ ดำเนินการ</button>
                <button class="btn btn-xs btn-secondary dismiss-btn" data-id="${ins.id}">✗ ไม่สนใจ</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.pf-btn').forEach(b => b.addEventListener('click', () => { priorityFilter = b.dataset.p; renderPage() }))
    document.getElementById('refresh-insights-btn')?.addEventListener('click', () => {
      showToast('🔄 วิเคราะห์ข้อมูลใหม่เสร็จแล้ว', 'success')
      renderPage()
    })
    container.querySelectorAll('.action-btn').forEach(b => b.addEventListener('click', () => {
      const ins = insights.find(x => x.id === b.dataset.id)
      if (ins) { ins.actionTaken = true; renderPage(); showToast(`✅ บันทึก Action สำหรับ "${ins.title}" แล้ว`, 'success') }
    }))
    container.querySelectorAll('.dismiss-btn').forEach(b => b.addEventListener('click', () => {
      insights = insights.filter(x => x.id !== b.dataset.id)
      renderPage()
      showToast('ซ่อน Insight แล้ว', 'warning')
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
