import { formatCurrency } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

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

const BRANDS = ['BYD', 'MG', 'DEEPAL', 'Neta', 'อื่นๆ']

const DEMO_LOST_DEALS = [
  { id:'LD001', custName:'มานะ ลองดู', phone:'0811111111', interestedIn:'BYD Seal AWD', budget:1200000, lostReason:'price', lostTo:'Tesla Model 3', lostDate:'2025-05-15', salesperson:'วิชาญ มีโชค', stage:'negotiating', note:'ลูกค้าบอกว่า Tesla ราคาใกล้เคียงแต่ feature ดีกว่า' },
  { id:'LD002', custName:'สวรรค์ ฝันอยาก', phone:'0822222222', interestedIn:'MG4 X', budget:1000000, lostReason:'finance', lostTo:null, lostDate:'2025-05-20', salesperson:'อรนุช สายใจ', stage:'booking', note:'ไฟแนนซ์ไม่ผ่าน รายได้ไม่ถึงเกณฑ์' },
  { id:'LD003', custName:'ธรรมนูญ เที่ยว', phone:'0833333333', interestedIn:'BYD Atto3', budget:900000, lostReason:'timing', lostTo:null, lostDate:'2025-05-25', salesperson:'วิชาญ มีโชค', stage:'leads', note:'บอกว่าจะรอดูรุ่นใหม่ปลายปี' },
  { id:'LD004', custName:'ปาณิสรา งดงาม', phone:'0844444444', interestedIn:'DEEPAL S07', budget:1100000, lostReason:'competitor', lostTo:'BYD Seal', lostDate:'2025-06-01', salesperson:'อรนุช สายใจ', stage:'testdrive', note:'ลูกค้าทดลองขับแล้วชอบ BYD มากกว่า' },
  { id:'LD005', custName:'กฤษณะ หล่อมาก', phone:'0855555555', interestedIn:'MG ZS EV', budget:800000, lostReason:'price', lostTo:'BYD Seagull', lostDate:'2025-06-03', salesperson:'วิชาญ มีโชค', stage:'negotiating', note:'งบไม่พอ ต้องการราคาต่ำกว่านี้' },
  { id:'LD006', custName:'อรทัย ดีงาม', phone:'0866666666', interestedIn:'BYD Seal AWD', budget:1300000, lostReason:'service', lostTo:'Toyota', lostDate:'2025-06-05', salesperson:'อรนุช สายใจ', stage:'negotiating', note:'ไม่พอใจที่รอนานมาก เซลส์ไม่ติดต่อกลับ' },
  { id:'LD007', custName:'บรรพต ฝากไว้', phone:'0877777777', interestedIn:'MG4 X', budget:1100000, lostReason:'model', lostTo:null, lostDate:'2025-06-07', salesperson:'วิชาญ มีโชค', stage:'leads', note:'ต้องการรุ่น AWD แต่ยังไม่มีในไทย' },
]

export default async function LostDealAnalysisPage(container) {
  const myGen = container.__routerGen
  let deals = DEMO_LOST_DEALS.map(d => ({ ...d }))
  let reasonFilter = 'all'
  let salespersonFilter = 'all'
  let dateRange = '30' // days

  // Load real lost deals: 'ถอนจอง' bookings + 'lost' leads
  try {
    const [bookings, leads] = await Promise.all([
      listDocs('bookings', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('customers', [], 'createdAt', 'desc', 500).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    const fromBookings = bookings
      .filter(b => b.status === 'ถอนจอง')
      .map(b => ({
        id: b.bookingNo || b.id,
        custName: b.custName || '',
        phone: b.custPhone || '',
        interestedIn: [b.brand, b.model].filter(Boolean).join(' '),
        budget: b.price || 0,
        lostReason: b.cancelReason || 'other',
        lostTo: b.cancelLostTo || null,
        lostDate: (b.updatedAt || b.createdAt || '').slice(0, 10),
        salesperson: b.salesName || '',
        stage: 'booking',
        note: b.cancelNote || b.notes || '',
        _source: 'booking',
      }))

    const fromLeads = leads
      .filter(l => l.isLost === true)
      .map(l => ({
        id: l.id,
        custName: [l.firstName, l.lastName].filter(Boolean).join(' ') || l.custName || l.name || '',
        phone: l.phone || '',
        interestedIn: l.interestedModel || [l.brand, l.model].filter(Boolean).join(' ') || l.interest || '',
        budget: l.budget || 0,
        lostReason: l.lostReason || 'other',
        lostTo: l.lostTo || null,
        lostDate: (l.lostAt || l.updatedAt || l.createdAt || '').slice(0, 10),
        salesperson: l.assignedTo || l.salesName || '',
        stage: l.stage || 'lead',
        note: l.lostReason || l.notes || '',
        _source: 'lead',
      }))

    const live = [...fromBookings, ...fromLeads]
    if (live.length) deals = [...live, ...DEMO_LOST_DEALS.map(d => ({ ...d }))]
  } catch {}

  function getFiltered() {
    let list = deals
    if (reasonFilter !== 'all') list = list.filter(d => d.lostReason === reasonFilter)
    if (salespersonFilter !== 'all') list = list.filter(d => d.salesperson === salespersonFilter)
    if (dateRange !== 'all') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - +dateRange)
      list = list.filter(d => new Date(d.lostDate) >= cutoff)
    }
    return list
  }

  function getAnalytics(list) {
    const totalLost = list.reduce((a, d) => a + d.budget, 0)
    const byReason = {}
    const bySales = {}
    const byCompetitor = {}
    list.forEach(d => {
      byReason[d.lostReason] = (byReason[d.lostReason] || 0) + 1
      bySales[d.salesperson] = (bySales[d.salesperson] || 0) + 1
      if (d.lostTo) byCompetitor[d.lostTo] = (byCompetitor[d.lostTo] || 0) + 1
    })
    return { totalLost, byReason, bySales, byCompetitor, count: list.length }
  }

  function renderPage() {
    const filtered = getFiltered()
    const analytics = getAnalytics(filtered)
    const allSalespeople = [...new Set(deals.map(d => d.salesperson))]
    const topReason = Object.entries(analytics.byReason).sort(([,a],[,b])=>b-a)[0]
    const topCompetitor = Object.entries(analytics.byCompetitor).sort(([,a],[,b])=>b-a)[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📉 Lost Deal Analysis</div>
            <div class="page-subtitle">วิเคราะห์สาเหตุที่เสียดีล</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="ld-export">📥 Export</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('💸 มูลค่าดีลที่เสีย', formatCurrency(analytics.totalLost), 'danger')}
          ${kpi('📋 จำนวนดีล', analytics.count + ' ดีล', 'warning')}
          ${topReason ? kpi('❌ เหตุผลหลัก', LOST_REASONS[topReason[0]]?.label.replace(/^[^\s]+ /,'') || topReason[0], 'danger') : kpi('❌ เหตุผลหลัก', '-', 'secondary')}
          ${topCompetitor ? kpi('🏁 คู่แข่งหลัก', escHtml(topCompetitor[0]), 'warning') : kpi('🏁 คู่แข่งหลัก', '-', 'secondary')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
          <select class="input" id="date-range-sel" style="width:140px">
            <option value="7">7 วันล่าสุด</option>
            <option value="30" selected>30 วันล่าสุด</option>
            <option value="90">90 วันล่าสุด</option>
            <option value="all">ทั้งหมด</option>
          </select>
          <select class="input" id="sales-sel" style="width:160px">
            <option value="all">ทุกเซลส์</option>
            ${allSalespeople.map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('')}
          </select>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-sm ${reasonFilter==='all'?'btn-primary':'btn-secondary'} rf-btn" data-r="all">ทั้งหมด</button>
            ${Object.entries(LOST_REASONS).slice(0,5).map(([k,v]) => `<button class="btn btn-sm ${reasonFilter===k?'btn-primary':'btn-secondary'} rf-btn" data-r="${k}">${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- Charts + Table -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <!-- Reason breakdown -->
          <div class="card" style="padding:16px">
            <div style="font-weight:700;margin-bottom:12px">📊 สาเหตุที่เสียดีล</div>
            ${Object.entries(analytics.byReason).sort(([,a],[,b])=>b-a).map(([k, count]) => {
              const r = LOST_REASONS[k]; const pct = Math.round(count / analytics.count * 100)
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                  <span>${r?.label||k}</span><span style="font-weight:700">${count} (${pct}%)</span>
                </div>
                <div style="height:6px;background:var(--surface-3);border-radius:99px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:var(--${r?.color||'secondary'});border-radius:99px"></div>
                </div>
              </div>`
            }).join('') || '<div style="color:var(--text-muted);font-size:0.83rem">ไม่มีข้อมูล</div>'}
          </div>

          <!-- Competitor breakdown -->
          <div class="card" style="padding:16px">
            <div style="font-weight:700;margin-bottom:12px">🏁 คู่แข่งที่ชนะ</div>
            ${Object.entries(analytics.byCompetitor).sort(([,a],[,b])=>b-a).length ? Object.entries(analytics.byCompetitor).sort(([,a],[,b])=>b-a).map(([comp, count]) => {
              const pct = Math.round(count / analytics.count * 100)
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                  <span>🚗 ${escHtml(comp)}</span><span style="font-weight:700">${count} ดีล</span>
                </div>
                <div style="height:6px;background:var(--surface-3);border-radius:99px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:var(--danger);border-radius:99px"></div>
                </div>
              </div>`
            }).join('') : '<div style="color:var(--text-muted);font-size:0.83rem">ยังไม่มีข้อมูลคู่แข่ง</div>'}

            <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
              <div style="font-weight:700;font-size:0.82rem;margin-bottom:8px">📊 ดีลตาม Salesperson</div>
              ${Object.entries(analytics.bySales).sort(([,a],[,b])=>b-a).map(([name, count]) => `
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:3px 0">
                  <span>${escHtml(name)}</span><span class="badge badge-warning">${count} ดีล</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Deal List -->
        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>ลูกค้า</th><th>สนใจรุ่น</th><th>งบ</th><th>เซลส์</th><th>สาเหตุ</th><th>ไปซื้อที่ไหน</th><th>วันที่เสีย</th></tr></thead>
            <tbody>
              ${filtered.map(d => {
                const r = LOST_REASONS[d.lostReason]
                return `<tr style="cursor:pointer" class="ld-row" data-id="${d.id}">
                  <td>
                    <div style="font-weight:600;font-size:0.85rem">${escHtml(d.custName)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(d.phone)}</div>
                  </td>
                  <td style="font-size:0.83rem">${escHtml(d.interestedIn)}</td>
                  <td style="font-weight:700;font-size:0.83rem">${formatCurrency(d.budget)}</td>
                  <td style="font-size:0.8rem">${escHtml(d.salesperson)}</td>
                  <td><span class="badge badge-${r?.color||'secondary'}" style="font-size:0.67rem">${r?.label||escHtml(d.lostReason)}</span></td>
                  <td style="font-size:0.8rem">${escHtml(d.lostTo || '—')}</td>
                  <td style="font-size:0.78rem;color:var(--text-muted)">${escHtml(d.lostDate)}</td>
                </tr>`
              }).join('')}
              ${!filtered.length ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่มีข้อมูล</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <!-- Insights box -->
        <div style="margin-top:16px;background:var(--primary-dim);border:1px solid var(--primary);border-radius:var(--radius-md);padding:14px 16px">
          <div style="font-weight:700;color:var(--primary);margin-bottom:8px">💡 Insights & Recommendations</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:0.83rem">
            ${topReason?.[0] === 'price' ? '<div>🎯 เสียดีลเพราะราคาเยอะ — พิจารณา Special Price Package หรือ Bundle Offer ให้มีความน่าสนใจมากขึ้น</div>' : ''}
            ${topReason?.[0] === 'competitor' ? '<div>🏁 แพ้คู่แข่งบ่อย — ควรทำ Competitive Analysis และเตรียม Counter-offer ที่ชัดเจน</div>' : ''}
            ${topReason?.[0] === 'service' ? '<div>⚠️ เสียดีลเพราะบริการ — ต้องปรับปรุงด้านการติดตาม Follow-up และ Response Time ของทีมขาย</div>' : ''}
            ${topReason?.[0] === 'finance' ? '<div>💳 ไฟแนนซ์เป็นปัญหาหลัก — ควรมีตัวเลือกธนาคารหลายแห่งและ Balloon Payment ช่วย</div>' : ''}
            ${analytics.count > 5 ? `<div>📊 มีดีลเสีย ${analytics.count} รายในช่วงนี้ มูลค่ารวม ${formatCurrency(analytics.totalLost)} — ควรประชุมทีมขายเพื่อวางแผนป้องกัน</div>` : ''}
          </div>
        </div>
      </div>
    `

    document.getElementById('date-range-sel')?.addEventListener('change', e => { dateRange = e.target.value; renderPage() })
    document.getElementById('sales-sel')?.addEventListener('change', e => { salespersonFilter = e.target.value; renderPage() })
    document.querySelectorAll('.rf-btn').forEach(b => b.addEventListener('click', () => { reasonFilter = b.dataset.r; renderPage() }))
    document.getElementById('ld-export')?.addEventListener('click', () => exportToExcel(filtered.map(d => ({ วันที่:d.lostDate, ลูกค้า:d.custName, รุ่น:d.interestedIn, งบ:d.budget, เซลส์:d.salesperson, สาเหตุ:LOST_REASONS[d.lostReason]?.label||d.lostReason, คู่แข่ง:d.lostTo||'', หมายเหตุ:d.note })), 'LostDeals'))
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
