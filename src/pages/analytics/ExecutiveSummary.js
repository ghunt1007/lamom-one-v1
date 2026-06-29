/**
 * Executive Summary — สรุปผู้บริหารหน้าเดียว
 * Route: /analytics/executive
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { openModal } from '../../utils/modal.js'
import { getSalesData, getCommissionData } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

const SUMMARY = {
  month: 'มิถุนายน 2569',
  sales: { actual: 41, target: 39, revenue: 51960000, lastMonth: 38 },
  service: { jobs: 118, revenue: 472000, csat: 4.7 },
  finance: { grossProfit: 6235000, netProfit: 1990000, margin: 14.6, cashflow: 8200000, ar: 585800 },
  people: { headcount: 16, attendance: 96, topSales: 'วิชัย ยอดขาย (9 คัน)', topTech: 'วิทยา ช่างใหญ่ (Eff 94%)' },
}

const HIGHLIGHTS = [
  { icon: '🎉', type: 'success', text: 'ยอดขายเกินเป้า 5% (41/39 คัน) — เดือนที่ 3 ติดต่อกัน' },
  { icon: '⭐', type: 'success', text: 'CSAT แตะ 4.7 สูงสุดในรอบ 6 เดือน' },
  { icon: '🤝', type: 'success', text: 'Referral จาก VIP เพิ่ม 6 ราย มูลค่าศักยภาพ ฿7.2M' },
]

const CONCERNS = [
  { icon: '📦', type: 'danger', text: 'สต็อก BYD Seal และ Han ต่ำกว่าเป้า — เสี่ยงเสียโอกาสขาย ฿8M+', action: 'สั่งรถเพิ่มภายในสัปดาห์นี้' },
  { icon: '💳', type: 'warning', text: 'หนี้ค้าง 60+ วัน ฿86,000 (ร้านเช่ารถ XYZ)', action: 'ผู้จัดการติดตามเอง / พิจารณาแนวทางกฎหมาย' },
  { icon: '🔧', type: 'warning', text: 'Bay ด่วนใช้งาน 91% ใกล้เต็ม ขณะ Bay EV ว่าง 36%', action: 'จัดโปรตรวจแบตฟรีดึงงานเข้า Bay EV' },
]

const DECISIONS_NEEDED = [
  { title: 'อนุมัติสั่งรถ Q3', detail: 'BYD Seal 4 คัน + Han 3 คัน ≈ ฿13.1M', deadline: 'ศุกร์นี้' },
  { title: 'ปรับราคาตาม BYD ประกาศใหม่', detail: 'Atto 3 มีผล 1 ก.ค. — ต้องเคาะราคาขายใหม่', deadline: '30 มิ.ย.' },
  { title: 'ต่อสัญญาประกันรถ Demo', detail: 'ทด-004 หมดอายุใน 25 วัน', deadline: 'สัปดาห์หน้า' },
]

export default async function ExecutiveSummaryPage(container) {
  const myGen = container.__routerGen
  let summary = JSON.parse(JSON.stringify(SUMMARY))
  let dataSource = 'demo'

  try {
    const [sales, coms] = await Promise.all([
      getSalesData().catch(() => []),
      getCommissionData().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
      const lastMonth = (() => { const d = new Date(now); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })()
      const currSales = sales.filter(s => (s.bookingDate||'').startsWith(thisMonth))
      const prevSales = sales.filter(s => (s.bookingDate||'').startsWith(lastMonth))
      const totalRevenue = currSales.reduce((a, s) => a + (s.salePrice || 0), 0)
      const grossProfit = Math.round(totalRevenue * 0.12)
      const topSales = coms.length ? [...coms].sort((a,b)=>b.carsSold-a.carsSold)[0] : null
      const thaiMonths = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
      summary.month = `${thaiMonths[now.getMonth()+1]} ${now.getFullYear()+543}`
      summary.sales.actual = currSales.length
      summary.sales.revenue = totalRevenue
      summary.sales.lastMonth = prevSales.length
      summary.finance.grossProfit = grossProfit
      summary.finance.cashflow = totalRevenue
      if (topSales) summary.people.topSales = `${topSales.salesName} (${topSales.carsSold} คัน)`
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const s = summary
    const salesPct = Math.round(s.sales.actual / s.sales.target * 100)
    const growth = Math.round((s.sales.actual - s.sales.lastMonth) / s.sales.lastMonth * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Executive Summary</div>
            <div class="page-subtitle">สรุปผู้บริหารหน้าเดียว — ${s.month}${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="share-btn">📤 ส่งให้เจ้าของ</button>
            <button class="btn btn-primary" id="pdf-btn">📄 Export PDF</button>
          </div>
        </div>

        <!-- Big numbers -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚗 ยอดขาย', s.sales.actual + ' คัน (' + salesPct + '% เป้า)', 'success')}
          ${kpi('💰 รายได้รวม', formatCurrency(s.sales.revenue + s.service.revenue), 'primary')}
          ${kpi('📊 กำไรสุทธิ', formatCurrency(s.finance.netProfit) + ' (' + s.finance.margin + '%)', 'success')}
          ${kpi('📈 MoM Growth', (growth>0?'+':'') + growth + '%', growth >= 0 ? 'success' : 'danger')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <!-- Highlights -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--success);margin-bottom:10px">✅ จุดเด่นเดือนนี้</div>
            ${HIGHLIGHTS.map(h => `
              <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
                <span>${h.icon}</span><span>${h.text}</span>
              </div>
            `).join('')}
          </div>

          <!-- Concerns -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--danger);margin-bottom:10px">⚠️ จุดที่ต้องจับตา</div>
            ${CONCERNS.map(c => `
              <div style="padding:6px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;gap:8px;font-size:0.78rem"><span>${c.icon}</span><span>${c.text}</span></div>
                <div style="font-size:0.7rem;color:var(--primary);padding-left:24px">→ ${c.action}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Decisions needed -->
        <div class="card" style="padding:14px;margin-bottom:14px;border-left:3px solid var(--warning)">
          <div style="font-size:0.8rem;font-weight:700;color:var(--warning);margin-bottom:10px">🖊 รอเจ้าของตัดสินใจ (${DECISIONS_NEEDED.length} เรื่อง)</div>
          ${DECISIONS_NEEDED.map((d, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
              <div>
                <div style="font-weight:600;font-size:0.82rem">${i+1}. ${d.title}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">${d.detail}</div>
              </div>
              <span class="badge badge-warning" style="font-size:0.62rem;white-space:nowrap">⏰ ${d.deadline}</span>
            </div>
          `).join('')}
        </div>

        <!-- Department snapshot -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          <div class="card" style="padding:12px 14px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🔧 ศูนย์บริการ</div>
            ${row('งาน', s.service.jobs + ' งาน')}
            ${row('รายได้', formatCurrency(s.service.revenue))}
            ${row('CSAT', '⭐ ' + s.service.csat)}
          </div>
          <div class="card" style="padding:12px 14px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">💰 การเงิน</div>
            ${row('Gross Profit', formatCurrency(s.finance.grossProfit))}
            ${row('Cash Flow', formatCurrency(s.finance.cashflow))}
            ${row('AR ค้าง', formatCurrency(s.finance.ar))}
          </div>
          <div class="card" style="padding:12px 14px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">👥 ทีมงาน</div>
            ${row('พนักงาน', s.people.headcount + ' คน (เข้างาน ' + s.people.attendance + '%)')}
            ${row('🏆 Top Sales', s.people.topSales)}
            ${row('🏆 Top Tech', s.people.topTech)}
          </div>
        </div>
      </div>
    `

    document.getElementById('pdf-btn')?.addEventListener('click', () => {
      const s = summary
      exportToExcel([
        { 'หัวข้อ': 'เดือน', 'ข้อมูล': s.month },
        { 'หัวข้อ': 'ยอดขาย (คัน)', 'ข้อมูล': s.sales.actual },
        { 'หัวข้อ': 'เป้าหมาย (คัน)', 'ข้อมูล': s.sales.target },
        { 'หัวข้อ': 'รายได้ยอดขาย (บาท)', 'ข้อมูล': s.sales.revenue },
        { 'หัวข้อ': 'งานบริการ (รายการ)', 'ข้อมูล': s.service.jobs },
        { 'หัวข้อ': 'รายได้บริการ (บาท)', 'ข้อมูล': s.service.revenue },
        { 'หัวข้อ': 'CSAT', 'ข้อมูล': s.service.csat },
        { 'หัวข้อ': 'Gross Profit (บาท)', 'ข้อมูล': s.finance.grossProfit },
        { 'หัวข้อ': 'Net Profit (บาท)', 'ข้อมูล': s.finance.netProfit },
        { 'หัวข้อ': 'Net Margin %', 'ข้อมูล': s.finance.margin },
        { 'หัวข้อ': 'Cashflow (บาท)', 'ข้อมูล': s.finance.cashflow },
        { 'หัวข้อ': 'Top Sales', 'ข้อมูล': s.people.topSales },
        { 'หัวข้อ': 'Top Tech', 'ข้อมูล': s.people.topTech },
      ], `Executive_Summary_${s.month.replace(' ', '_')}.xlsx`, 'Summary')
      showToast('📥 Export Executive Summary แล้ว', 'success')
    })
    document.getElementById('share-btn')?.addEventListener('click', () => {
      const text = `📊 LAMOM ONE — Executive Summary ${s.month}\n\n🚗 ยอดขาย: ${s.sales.actual}/${s.sales.target} คัน (${Math.round(s.sales.actual/s.sales.target*100)}%)\n💰 รายได้: ${formatCurrency(s.sales.revenue)}\n🔧 งานบริการ: ${s.service.jobs} งาน CSAT ⭐${s.service.csat}\n📈 Gross Profit: ${formatCurrency(s.finance.grossProfit)} (${s.finance.margin}%)\n👑 Top Sales: ${s.people.topSales}`
      const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent('https://lamom.app/executive')}&text=${encodeURIComponent(text)}`
      openModal({
        title: '📤 แชร์ Executive Summary',
        size: 'sm',
        body: `
          <div style="font-size:0.78rem">
            <div style="background:var(--surface-2);border-radius:8px;padding:10px;white-space:pre-line;font-size:0.72rem;margin-bottom:12px;color:var(--text-muted)">${text}</div>
            <div style="display:flex;gap:8px;justify-content:center">
              <button class="btn" id="exec-share-line" style="background:#06C755;color:#fff;border-color:#06C755">💚 แชร์ LINE</button>
              <button class="btn btn-secondary" id="exec-copy-text">📋 Copy Text</button>
            </div>
          </div>
        `
      })
      document.getElementById('exec-share-line')?.addEventListener('click', () => {
        window.open(lineUrl, '_blank', 'noopener,noreferrer')
        showToast('เปิด LINE Share แล้ว', 'success')
      })
      document.getElementById('exec-copy-text')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(text).then(() => showToast('📋 Copy ข้อความสรุปแล้ว', 'success'))
          .catch(() => showToast('📋 Copy ไม่ได้ — ลอง Select + Copy เอง', 'warning'))
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;font-size:0.73rem;padding:3px 0"><span style="color:var(--text-muted)">${l}</span><span style="font-weight:600">${v}</span></div>` }
