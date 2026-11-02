import { formatCurrency, formatDate } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { escHtml } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'


// (v1.0.945) เอาข้อมูลตัวอย่างออกทั้งหมด (กลุ่มอายุ/ประเภทผู้ซื้อ/ลูกค้าใหม่-หาย/CPA 2,500 บาท) — แท็บพวกนั้นถูกซ่อนไว้แล้ว
// แต่โค้ดยังค้างอยู่ และหน้าที่มาลูกค้ายังโชว์ "Demo" กับ CPA สมมติเมื่อยังไม่มีใบจอง

export default async function CustomerInsightsPage(container) {
  const myGen = container.__routerGen
  // (2026-11-02) แท็บ Overview/Segments เป็นข้อมูลตัวอย่างล้วน (อายุ/ประเภทผู้ซื้อ/ลูกค้าหาย) ไม่มีข้อมูลจริงรองรับ → ซ่อนไว้
  let tab = 'sources'

  let liveSourceData = null
  let liveTopBuyers = null
  let liveTotalSales = 0
  let liveDistinctCustomers = 0
  const COLORS = ['primary','success','warning','secondary','danger']

  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return

    if (sales.length) {
      liveTotalSales = sales.length

      const bySource = {}
      sales.forEach(s => {
        const src = String(s.source || '').trim() || 'ไม่ระบุช่องทาง'
        if (!bySource[src]) bySource[src] = { label: src, count: 0, revenue: 0 }
        bySource[src].count++
        bySource[src].revenue += s.salePrice || 0
      })
      liveSourceData = Object.values(bySource).sort((a, b) => b.count - a.count).map((s, i) => ({
        ...s, pct: Math.round(s.count / liveTotalSales * 100), color: COLORS[i % COLORS.length]
      }))

      const byCustomer = {}
      sales.forEach(s => {
        const name = s.custName || 'ไม่ระบุ'
        if (!byCustomer[name]) byCustomer[name] = { name, purchases: 0, totalSpend: 0, lastDate: '' }
        byCustomer[name].purchases++
        byCustomer[name].totalSpend += s.salePrice || 0
        if ((s.date || '') > byCustomer[name].lastDate) byCustomer[name].lastDate = s.date || ''
      })
      // "👥 ลูกค้าทั้งหมด" ควรนับจำนวนลูกค้าจริง (distinct) ไม่ใช่จำนวนธุรกรรม (liveTotalSales) — byCustomer
      // ด้านล่างนี้คำนวณอยู่แล้ว ใช้จำนวน key ของมันแทน
      liveDistinctCustomers = Object.keys(byCustomer).length
      liveTopBuyers = Object.values(byCustomer).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10).map(c => ({
        ...c, type: 'Individual', tier: c.totalSpend >= 3000000 ? 'Platinum' : c.totalSpend >= 1500000 ? 'Gold' : 'Silver'
      }))
    }
  } catch {}

  function renderPage() {
    const totalCustomers = liveDistinctCustomers
    const totalRevenue = (liveSourceData || []).reduce((a, x) => a + x.revenue, 0)
    const avgLTV = totalCustomers ? Math.round(totalRevenue / totalCustomers) : 0
    const repeat = liveDistinctCustomers ? Math.round((liveTotalSales - liveDistinctCustomers) / liveDistinctCustomers * 100) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧠 ข้อมูลเชิงลึกลูกค้า</div>
            <div class="page-subtitle">ที่มาของลูกค้าและลูกค้าที่ซื้อมากสุด จากใบจองจริง</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 ส่งออก</button>
          </div>
        </div>

        ${liveTotalSales ? `<div style="margin-bottom:10px;padding:7px 12px;background:var(--surface-2);border-left:3px solid var(--success);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--success)">● ข้อมูลจริง: ${liveTotalSales} ธุรกรรมจากใบจอง</div>` : ''}
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าทั้งหมด', totalCustomers, 'primary')}
          ${kpi('🧾 ใบจอง', liveTotalSales, 'success')}
          ${kpi('💰 มูลค่าเฉลี่ย/ลูกค้า', formatCurrency(avgLTV), 'warning')}
          ${kpi('🔄 ซื้อซ้ำ', repeat + '%', 'secondary')}
        </div>

        <div class="tab-nav" style="margin-bottom:14px">
          ${[['sources','🔍 ที่มาลูกค้า'],['top','🏆 ลูกค้าซื้อมากสุด']].map(([t,l]) => `<button class="tab-btn ${tab===t?'active':''}" data-tab="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'sources' ? renderSources() : renderTop()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel((liveTopBuyers || []).map(c => ({ ชื่อ: c.name, ประเภท: c.type, ซื้อ: c.purchases, มูลค่ารวม: c.totalSpend, Tier: c.tier })), 'customer_insights')
      showToast('📥 ส่งออกแล้ว', 'success')
    })
  }

  function renderSources() {
    const srcData = liveSourceData || []
    if (!srcData.length) return '<div class="card" style="padding:28px;text-align:center;color:var(--text-muted);font-size:0.85rem">ยังไม่มีใบจอง</div>'
    const total = srcData.reduce((a, s) => a + s.count, 0)
    return `
      <div class="card" style="padding:14px">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">🔍 ลูกค้ามาจากช่องทางไหน</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
          ${srcData.map(s => `
            <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);border-left:3px solid var(--${s.color});min-width:0">
              <div style="font-weight:700;font-size:0.85rem;margin-bottom:2px;overflow-wrap:anywhere">${escHtml(s.label)}</div>
              <div style="font-size:1.2rem;font-weight:800;color:var(--${s.color})">${s.count} คัน</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">${s.pct}% · ${formatCurrency(s.revenue)}</div>
            </div>
          `).join('')}
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>ช่องทาง</th><th class="text-right">ใบจอง</th><th class="text-right">สัดส่วน</th><th class="text-right">ยอดขาย</th></tr></thead>
          <tbody>
            ${srcData.map(s => `<tr>
              <td><span class="badge badge-${s.color}">${escHtml(s.label)}</span></td>
              <td class="text-right">${s.count}</td>
              <td class="text-right">${s.pct}%</td>
              <td class="text-right">${formatCurrency(s.revenue)}</td>
            </tr>`).join('')}
            <tr style="background:var(--surface-2)">
              <td style="font-weight:800">รวม</td>
              <td class="text-right" style="font-weight:800">${total}</td>
              <td class="text-right">100%</td>
              <td class="text-right" style="font-weight:800">${formatCurrency(srcData.reduce((a, s) => a + s.revenue, 0))}</td>
            </tr>
          </tbody>
        </table></div>
      </div>
    `
  }

  function renderTop() {
    const topList = liveTopBuyers || []
    if (!topList.length) return '<div class="card" style="padding:28px;text-align:center;color:var(--text-muted);font-size:0.85rem">ยังไม่มีใบจอง</div>'
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table class="table">
          <thead><tr><th>#</th><th>ชื่อลูกค้า</th><th>ประเภท</th><th class="text-right">จำนวนซื้อ</th><th class="text-right">มูลค่ารวม</th><th>ระดับ</th><th>ล่าสุด</th></tr></thead>
          <tbody>
            ${topList.map((c, i) => {
              const tc = c.tier === 'Platinum' ? 'danger' : c.tier === 'Gold' ? 'warning' : 'secondary'
              return `<tr>
                <td style="font-weight:800;font-size:0.85rem">${i+1}</td>
                <td style="font-weight:600;font-size:0.85rem">${escHtml(c.name)}</td>
                <td><span class="badge badge-${c.type === 'Corporate' ? 'primary' : 'secondary'}">${c.type}</span></td>
                <td class="text-right">${c.purchases} ครั้ง</td>
                <td class="text-right" style="font-weight:700;color:var(--success)">${formatCurrency(c.totalSpend)}</td>
                <td><span class="badge badge-${tc}">${c.tier}</span></td>
                <td style="font-size:0.82rem">${formatDate(c.lastDate)}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table></div>
      </div>
    `
  }

  renderPage()
}

