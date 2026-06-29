import { navigate } from '../../core/router.js'
import { getSalesData } from '../../core/db.js'
import { formatCurrency } from '../../utils/format.js'

const QUICK_LINKS = [
  { icon:'🎯', label:'Campaigns', sub:'สร้างและจัดการแคมเปญ', path:'/marketing/campaigns', color:'primary' },
  { icon:'📱', label:'Social Hub', sub:'Facebook, TikTok, IG', path:'/marketing/social', color:'accent' },
  { icon:'🎪', label:'Events', sub:'งานอีเวนต์และมอเตอร์โชว์', path:'/marketing/events', color:'warning' },
  { icon:'📊', label:'Marketing ROI', sub:'วัดผลตอบแทน', path:'/marketing/roi', color:'success' },
  { icon:'📅', label:'Content Calendar', sub:'ปฏิทินคอนเทนต์', path:'/marketing/content', color:'primary' },
  { icon:'🧲', label:'Lead Generation', sub:'แหล่ง Lead ใหม่', path:'/marketing/leads', color:'accent' },
  { icon:'🎪', label:'Promotions', sub:'โปรโมชันและส่วนลด', path:'/marketing/promotions', color:'warning' },
  { icon:'⭐', label:'Reviews', sub:'รีวิวและ Rating', path:'/marketing/reviews', color:'success' },
  { icon:'💚', label:'LINE OA', sub:'ส่งข้อความ Line', path:'/marketing/line-oa', color:'success' },
  { icon:'🌐', label:'Digital Showroom', sub:'โชว์รูมออนไลน์', path:'/marketing/digital-showroom', color:'primary' },
  { icon:'🔗', label:'UTM Tracker', sub:'ติดตาม Link', path:'/marketing/utm-tracker', color:'accent' },
  { icon:'✨', label:'AI Content', sub:'สร้างคอนเทนต์ด้วย AI', path:'/marketing/ai-content', color:'warning' },
]

const CAMPAIGNS = [
  { name:'April EV Festival', channel:'Facebook', budget:50000, leads:23, conversions:4, status:'active', roi:180 },
  { name:'BYD Seal Launch', channel:'TikTok', budget:30000, leads:45, conversions:7, status:'completed', roi:320 },
  { name:'Trade-In Promotion', channel:'LINE OA', budget:20000, leads:18, conversions:3, status:'active', roi:150 },
  { name:'DEEPAL S7 Teaser', channel:'YouTube', budget:40000, leads:61, conversions:5, status:'active', roi:210 },
]

export default async function MarketingDashboard(container) {
  const myGen = container.__routerGen

  container.innerHTML = `<div class="page-content animate-slide">
    ${[...Array(3)].map(() => `<div class="skeleton" style="height:60px;border-radius:8px;margin-bottom:10px"></div>`).join('')}
  </div>`

  let actualSales = []
  let sourceBreakdown = {}
  try {
    actualSales = await getSalesData()
    if (container.__routerGen !== myGen) return
    actualSales.forEach(s => {
      const src = s.leadSource || s.source || s.channel || 'อื่นๆ'
      if (!sourceBreakdown[src]) sourceBreakdown[src] = { count: 0, value: 0 }
      sourceBreakdown[src].count++
      sourceBreakdown[src].value += s.salePrice || 0
    })
  } catch {}

  if (container.__routerGen !== myGen) return

  const actualDelivered = actualSales.filter(s => s.delivered).length
  const actualTotal = actualSales.length
  const totalLeads  = CAMPAIGNS.reduce((s, c) => s + c.leads, 0)
  const totalBudget = CAMPAIGNS.reduce((s, c) => s + c.budget, 0)
  const avgROI      = Math.round(CAMPAIGNS.reduce((s, c) => s + c.roi, 0) / CAMPAIGNS.length)

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">📣 Marketing Dashboard</div>
          <div class="page-subtitle">Campaigns และ Lead Generation</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" data-nav="/marketing/campaigns">➕ Campaign ใหม่</button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kCard('📢', 'Campaigns Active', CAMPAIGNS.filter(c => c.status === 'active').length + ' แคมเปญ', 'primary')}
        ${kCard('🧲', 'Leads รวม', totalLeads + ' คน', 'accent')}
        ${kCard('✅', 'ยอดจองจริง', actualTotal + ' ราย', 'success')}
        ${kCard('📈', 'ROI เฉลี่ย', avgROI + '%', 'warning')}
      </div>

      <!-- Quick links -->
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">เมนูหลัก การตลาด</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px;margin-bottom:24px">
        ${QUICK_LINKS.map(q => `
          <div class="card card-lift" data-nav="${q.path}" style="padding:15px 16px;cursor:pointer;border-top:3px solid var(--${q.color})">
            <div style="font-size:1.6rem;margin-bottom:6px">${q.icon}</div>
            <div style="font-weight:700;font-size:0.86rem">${q.label}</div>
            <div style="font-size:0.71rem;color:var(--text-muted)">${q.sub}</div>
          </div>
        `).join('')}
      </div>

      <!-- Sales Funnel -->
      <div class="card" style="padding:16px 20px;margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:14px;font-size:0.88rem">🔻 Sales Funnel</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[
            { label:'Impressions', val:45200, color:'primary', pct:100 },
            { label:'Clicks / Reach', val:8640, color:'accent', pct:19 },
            { label:'Leads', val:totalLeads, color:'warning', pct:Math.round(totalLeads / 45200 * 100) },
            { label:'Qualified', val:18, color:'warning', pct:Math.round(18 / 45200 * 100) },
            { label:'ยอดจอง (จริง)', val:actualTotal, color:'success', pct:Math.round(actualTotal / 45200 * 100 || 0), real:true },
            { label:'ส่งมอบแล้ว (จริง)', val:actualDelivered, color:'success', pct:Math.round(actualDelivered / 45200 * 100 || 0), real:true },
          ].map(f => `
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:150px;font-size:0.8rem;color:var(--text-muted)">${f.label}${f.real ? ' <span style="font-size:0.65rem;color:var(--success)">●live</span>' : ''}</div>
              <div style="flex:1;height:18px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${f.pct}%;background:var(--${f.color});border-radius:4px;opacity:${f.real ? '0.85' : '1'}"></div>
              </div>
              <div style="width:68px;text-align:right;font-weight:700;font-size:0.82rem;color:var(--${f.color})">${f.val.toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Lead Source from real bookings -->
      ${Object.keys(sourceBreakdown).length ? `
      <div class="card" style="padding:14px 18px;margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:10px;font-size:0.88rem">🔗 ที่มา Leads (จากใบจองจริง)</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${Object.entries(sourceBreakdown).sort((a, b) => b[1].count - a[1].count).map(([src, d]) => `
            <div style="padding:7px 12px;background:var(--surface-2);border-radius:var(--radius-md);font-size:0.8rem">
              <span style="font-weight:700">${src}</span>
              <span style="color:var(--success);margin-left:8px">${d.count} ราย</span>
              <span style="color:var(--text-muted);margin-left:4px;font-size:0.72rem">${formatCurrency(d.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- Campaign table -->
      <div class="card">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:0.88rem">📊 Campaign ทั้งหมด</div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Campaign</th><th>ช่องทาง</th><th>งบ</th><th>Leads</th><th>Conversion</th><th>ROI</th><th>สถานะ</th>
            </tr></thead>
            <tbody>
              ${CAMPAIGNS.map(c => `
                <tr>
                  <td style="font-weight:600">${c.name}</td>
                  <td><span class="badge badge-primary" style="font-size:0.72rem">${c.channel}</span></td>
                  <td style="color:var(--text-muted)">฿${c.budget.toLocaleString()}</td>
                  <td style="text-align:center;font-weight:700;color:var(--accent)">${c.leads}</td>
                  <td style="text-align:center;font-weight:700;color:var(--success)">${c.conversions}</td>
                  <td style="font-weight:700;color:${c.roi >= 200 ? 'var(--success)' : c.roi >= 100 ? 'var(--warning)' : 'var(--danger)'}">+${c.roi}%</td>
                  <td><span class="badge badge-${c.status === 'active' ? 'success' : 'primary'}" style="font-size:0.72rem">${c.status === 'active' ? '✅ กำลังรัน' : '🏁 สิ้นสุด'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `

  container.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) navigate(nav.dataset.nav)
  })
}

function kCard(icon, label, value, color) {
  return `<div class="kpi-card" style="border-left:3px solid var(--${color})">
    <div class="kpi-title">${icon} ${label}</div>
    <div class="kpi-value" style="color:var(--${color})">${value}</div>
  </div>`
}
