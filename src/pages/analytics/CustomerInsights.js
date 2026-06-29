import { formatCurrency, formatDate } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// Demo data — customer segments and behavior
const AGE_SEGMENTS = [
  { label: '18-25 ปี', count: 42, pct: 14, avgSpend: 890000, color: 'primary' },
  { label: '26-35 ปี', count: 98, pct: 32, avgSpend: 1120000, color: 'success' },
  { label: '36-45 ปี', count: 88, pct: 29, avgSpend: 1380000, color: 'warning' },
  { label: '46-55 ปี', count: 52, pct: 17, avgSpend: 1250000, color: 'secondary' },
  { label: '56+ ปี', count: 24, pct: 8, avgSpend: 980000, color: 'danger' },
]

const BUYER_TYPES = [
  { label: 'First-time EV', count: 172, pct: 56, color: 'primary' },
  { label: 'Upgrade จาก ICE', count: 89, pct: 29, color: 'success' },
  { label: 'เปลี่ยนรุ่น EV', count: 26, pct: 9, color: 'warning' },
  { label: 'Fleet/Corporate', count: 17, pct: 6, color: 'secondary' },
]

const SOURCE_DATA = [
  { label: 'Facebook Ads', count: 112, pct: 36, cost: 280000, cpa: 2500, color: 'primary' },
  { label: 'Walk-in', count: 76, pct: 25, cost: 0, cpa: 0, color: 'success' },
  { label: 'Referral', count: 58, pct: 19, cost: 145000, cpa: 2500, color: 'warning' },
  { label: 'LINE/Social', count: 38, pct: 12, cost: 95000, cpa: 2500, color: 'secondary' },
  { label: 'อื่นๆ', count: 20, pct: 8, cost: 50000, cpa: 2500, color: 'danger' },
]

const MONTHLY_NEW = [28,22,35,30,42,25,0,0,0,0,0,0]
const MONTHLY_RETURNING = [8,6,10,9,12,7,0,0,0,0,0,0]
const MONTHLY_CHURN = [3,4,2,5,3,6,0,0,0,0,0,0]

const TOP_CUSTOMERS = [
  { name: 'บริษัท ABC จำกัด', type: 'Corporate', purchases: 5, totalSpend: 6850000, lastDate: '2025-05-15', tier: 'Platinum' },
  { name: 'วิชาญ มีโชค', type: 'Individual', purchases: 3, totalSpend: 3890000, lastDate: '2025-06-02', tier: 'Gold' },
  { name: 'บริษัท XYZ EV', type: 'Corporate', purchases: 2, totalSpend: 2890000, lastDate: '2025-04-18', tier: 'Gold' },
  { name: 'อรนุช สาวสวย', type: 'Individual', purchases: 2, totalSpend: 2180000, lastDate: '2025-05-25', tier: 'Silver' },
  { name: 'ธีรยุทธ เก่งกาจ', type: 'Individual', purchases: 1, totalSpend: 1449000, lastDate: '2025-06-01', tier: 'Silver' },
]

export default async function CustomerInsightsPage(container) {
  const myGen = container.__routerGen
  let tab = 'overview'

  let liveSourceData = null
  let liveTopBuyers = null
  let liveTotalSales = 0
  const COLORS = ['primary','success','warning','secondary','danger']

  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return

    if (sales.length) {
      liveTotalSales = sales.length

      const bySource = {}
      sales.forEach(s => {
        const src = s.leadSource || 'อื่นๆ'
        if (!bySource[src]) bySource[src] = { label: src, count: 0, revenue: 0 }
        bySource[src].count++
        bySource[src].revenue += s.salePrice || 0
      })
      liveSourceData = Object.values(bySource).sort((a, b) => b.count - a.count).map((s, i) => ({
        ...s, pct: Math.round(s.count / liveTotalSales * 100), color: COLORS[i % COLORS.length], cost: 0, cpa: 0
      }))

      const byCustomer = {}
      sales.forEach(s => {
        const name = s.custName || 'ไม่ระบุ'
        if (!byCustomer[name]) byCustomer[name] = { name, purchases: 0, totalSpend: 0, lastDate: '' }
        byCustomer[name].purchases++
        byCustomer[name].totalSpend += s.salePrice || 0
        if ((s.date || '') > byCustomer[name].lastDate) byCustomer[name].lastDate = s.date || ''
      })
      liveTopBuyers = Object.values(byCustomer).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10).map(c => ({
        ...c, type: 'Individual', tier: c.totalSpend >= 3000000 ? 'Platinum' : c.totalSpend >= 1500000 ? 'Gold' : 'Silver'
      }))
    }
  } catch {}

  function renderPage() {
    const totalCustomers = liveTotalSales || AGE_SEGMENTS.reduce((a, s) => a + s.count, 0)
    const avgLTV = Math.round(AGE_SEGMENTS.reduce((a, s) => a + s.count * s.avgSpend, 0) / AGE_SEGMENTS.reduce((a, s) => a + s.count, 0))
    const newThisMonth = MONTHLY_NEW[5]
    const retentionRate = Math.round(((AGE_SEGMENTS.reduce((a,s)=>a+s.count,0) - MONTHLY_CHURN.reduce((a,v)=>a+v,0)) / AGE_SEGMENTS.reduce((a,s)=>a+s.count,0)) * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧠 Customer Insights</div>
            <div class="page-subtitle">วิเคราะห์พฤติกรรมและ Segment ลูกค้า</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
          </div>
        </div>

        ${liveTotalSales ? `<div style="margin-bottom:10px;padding:7px 12px;background:var(--surface-2);border-left:3px solid var(--success);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--success)">● ข้อมูลจริง: ${liveTotalSales} ธุรกรรมจากใบจอง</div>` : ''}
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าทั้งหมด', totalCustomers + (liveTotalSales ? '' : ' (Demo)'), 'primary')}
          ${kpi('✨ ใหม่เดือนนี้', newThisMonth, 'success')}
          ${kpi('💰 Avg LTV', formatCurrency(avgLTV), 'warning')}
          ${kpi('🔄 Retention', retentionRate + '%', retentionRate >= 90 ? 'success' : 'warning')}
        </div>

        <div class="tab-nav" style="margin-bottom:14px">
          ${[['overview','📊 Overview'],['segments','👥 Segments'],['sources','🔍 Sources'],['top','🏆 Top Customers']].map(([t,l]) => `<button class="tab-btn ${tab===t?'active':''}" data-tab="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'overview' ? renderOverview() : tab === 'segments' ? renderSegments() : tab === 'sources' ? renderSources() : renderTop()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel((liveTopBuyers || TOP_CUSTOMERS).map(c => ({ ชื่อ: c.name, ประเภท: c.type, ซื้อ: c.purchases, มูลค่ารวม: c.totalSpend, Tier: c.tier })), 'customer_insights')
      showToast('📥 Export แล้ว!', 'success')
    })
  }

  function renderOverview() {
    const maxNew = Math.max(...MONTHLY_NEW.filter(v => v > 0))
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <!-- Monthly trend -->
        <div class="card" style="padding:14px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📈 ลูกค้าใหม่ vs กลับมา (H1 2025)</div>
          <div style="display:flex;align-items:flex-end;gap:3px;height:100px;border-bottom:1px solid var(--border);padding-bottom:4px;margin-bottom:6px">
            ${MONTHLY_NEW.slice(0,6).map((v, i) => {
              const returning = MONTHLY_RETURNING[i]
              const newH = Math.round(v / maxNew * 100)
              const retH = Math.round(returning / maxNew * 100)
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="display:flex;width:100%;gap:1px;align-items:flex-end">
                  <div style="flex:1;height:${newH}px;background:var(--primary);border-radius:2px 2px 0 0;opacity:0.85"></div>
                  <div style="flex:1;height:${retH}px;background:var(--success);border-radius:2px 2px 0 0;opacity:0.7"></div>
                </div>
              </div>`
            }).join('')}
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">
            ${MONTHLY_NEW.slice(0,6).map((_,i) => `<div style="flex:1;text-align:center;font-size:0.62rem;color:var(--text-muted)">${MONTHS[i]}</div>`).join('')}
          </div>
          <div style="display:flex;gap:12px;font-size:0.75rem;margin-top:6px">
            <span style="color:var(--primary)">■ ลูกค้าใหม่</span>
            <span style="color:var(--success)">■ กลับมาซื้อ</span>
          </div>
        </div>

        <!-- Buyer type donut-style -->
        <div class="card" style="padding:14px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">🚗 ประเภทผู้ซื้อ</div>
          ${BUYER_TYPES.map(b => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px">
                <span>${b.label}</span><span style="font-weight:700;color:var(--${b.color})">${b.count} (${b.pct}%)</span>
              </div>
              <div style="background:var(--surface-2);border-radius:4px;height:8px">
                <div style="width:${b.pct}%;background:var(--${b.color});height:8px;border-radius:4px"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Churn trend -->
        <div class="card" style="padding:14px;grid-column:1/-1">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📉 Churn Analysis</div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">
            ${MONTHLY_CHURN.slice(0,6).map((v, i) => `
              <div style="text-align:center;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <div style="font-size:0.78rem;color:var(--text-muted)">${MONTHS[i]}</div>
                <div style="font-size:1.1rem;font-weight:800;color:${v<=3?'var(--success)':v<=5?'var(--warning)':'var(--danger)'}">${v}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">คน</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `
  }

  function renderSegments() {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card" style="padding:14px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">👤 กลุ่มอายุ</div>
          ${AGE_SEGMENTS.map(s => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px">
                <span>${s.label}</span>
                <span style="font-weight:700">${s.count} คน (${s.pct}%)</span>
              </div>
              <div style="background:var(--surface-2);border-radius:4px;height:8px;position:relative">
                <div style="width:${s.pct}%;background:var(--${s.color});height:8px;border-radius:4px"></div>
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);text-align:right">Avg LTV: ${formatCurrency(s.avgSpend)}</div>
            </div>
          `).join('')}
        </div>
        <div class="card" style="padding:14px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">🏆 Loyalty Tier Distribution</div>
          ${[['Platinum',15,'danger',2500000],['Gold',42,'warning',1200000],['Silver',98,'secondary',800000],['Bronze',149,'secondary',400000]].map(([t,n,c,ltv]) => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="badge badge-${c}">${t}</span>
                <span style="font-size:0.82rem">${n} คน</span>
              </div>
              <span style="font-size:0.8rem;color:var(--text-muted)">Avg LTV: ${formatCurrency(ltv)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function renderSources() {
    const srcData = liveSourceData || SOURCE_DATA
    const totalLeads = srcData.reduce((a, s) => a + s.count, 0)
    return `
      <div class="card" style="padding:14px">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:4px">🔍 แหล่งที่มาของลูกค้า (Lead Source)</div>
        ${liveSourceData ? '<div style="font-size:0.72rem;color:var(--success);margin-bottom:10px">● ข้อมูลจริงจากใบจอง</div>' : '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">Demo</div>'}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:16px">
          ${srcData.map(s => `
            <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);border-left:3px solid var(--${s.color})">
              <div style="font-weight:700;font-size:0.88rem;margin-bottom:2px">${s.label}</div>
              <div style="font-size:1.2rem;font-weight:800;color:var(--${s.color})">${s.count}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">${s.pct}% ของทั้งหมด</div>
              ${s.cost > 0 ? `<div style="font-size:0.72rem;color:var(--text-muted)">ค่าใช้จ่าย: ${formatCurrency(s.cost)}</div>` : '<div style="font-size:0.72rem;color:var(--success)">ไม่มีค่าใช้จ่าย ✓</div>'}
            </div>
          `).join('')}
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>แหล่งที่มา</th><th class="text-right">Leads</th><th class="text-right">สัดส่วน</th><th class="text-right">ค่าใช้จ่าย</th><th class="text-right">CPA</th></tr></thead>
            <tbody>
              ${srcData.map(s => `<tr>
                <td><span class="badge badge-${s.color}">${s.label}</span></td>
                <td class="text-right">${s.count}</td>
                <td class="text-right">${s.pct}%</td>
                <td class="text-right">${s.cost ? formatCurrency(s.cost) : '-'}</td>
                <td class="text-right">${s.cpa ? formatCurrency(s.cpa) : 'ฟรี'}</td>
              </tr>`).join('')}
              <tr style="background:var(--surface-2)">
                <td style="font-weight:800">รวม</td>
                <td class="text-right" style="font-weight:800">${totalLeads}</td>
                <td class="text-right">100%</td>
                <td class="text-right" style="font-weight:800">${formatCurrency(srcData.reduce((a,s)=>a+s.cost,0))}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  function renderTop() {
    const topList = liveTopBuyers || TOP_CUSTOMERS
    return `
      ${liveTopBuyers ? '<div style="margin-bottom:8px;font-size:0.78rem;color:var(--success)">● ข้อมูลจริงจากใบจอง</div>' : '<div style="margin-bottom:8px;font-size:0.78rem;color:var(--text-muted)">Demo</div>'}
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>#</th><th>ชื่อลูกค้า</th><th>ประเภท</th><th class="text-right">จำนวนซื้อ</th><th class="text-right">มูลค่ารวม</th><th>Tier</th><th>ล่าสุด</th></tr></thead>
          <tbody>
            ${topList.map((c, i) => {
              const tc = c.tier === 'Platinum' ? 'danger' : c.tier === 'Gold' ? 'warning' : 'secondary'
              return `<tr>
                <td style="font-weight:800;font-size:0.85rem">${i+1}</td>
                <td style="font-weight:600;font-size:0.85rem">${c.name}</td>
                <td><span class="badge badge-${c.type === 'Corporate' ? 'primary' : 'secondary'}">${c.type}</span></td>
                <td class="text-right">${c.purchases} ครั้ง</td>
                <td class="text-right" style="font-weight:700;color:var(--success)">${formatCurrency(c.totalSpend)}</td>
                <td><span class="badge badge-${tc}">${c.tier}</span></td>
                <td style="font-size:0.82rem">${formatDate(c.lastDate)}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
