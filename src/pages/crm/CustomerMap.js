/**
 * Customer Map — ลูกค้าตามพื้นที่
 * Route: /crm/map
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listAllDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280', '#06b6d4', '#ef4444']

// (v1.0.333) เดิมพยายาม "ใช้ข้อมูลจริง" จาก collection customer_areas แต่ไม่มีหน้าไหนในระบบเขียนข้อมูลเข้า
// ไปเลยแม้แต่รายการเดียว — เงื่อนไขจึงเป็นจริงไม่ได้ตลอดกาล ยังโชว์แผนที่/insight ปลอม 6 พื้นที่แต่งขึ้น
// (บางนา-ศรีนครินทร์ ฯลฯ) เสมอ และถ้ามีข้อมูลจริงก็ยังผสมของปลอมเข้าไปอยู่ดี (เหมือนบัคที่แก้ในหลายหน้า
// ก่อนหน้านี้) แก้ให้จัดกลุ่มลูกค้าจริงตาม "จังหวัด" จากข้อมูลใบจองจริง (bookings.province — field จริงที่มี
// อยู่แล้วในฟอร์มใบจอง) คำนวณ Growth YoY จากจำนวนใบจองจริงปีนี้เทียบปีก่อนจริง ตัด "ห่างโชว์รูม X กม." กับ
// insight ปลอม 3 ข้อออก (ไม่มีข้อมูลระยะทาง/competitive intelligence จริงให้ใช้เลย ไม่ควรแต่งขึ้นมา)

export default async function CustomerMapPage(container) {
  const myGen = container.__routerGen
  let areas = []
  let sortBy = 'customers'
  let loading = true

  async function loadData() {
    loading = true
    let bookings = []
    try { bookings = await listAllDocs('bookings', [], 'createdAt', 'desc') } catch {}
    if (container.__routerGen !== myGen) return

    const real = bookings.filter(b => !b.deleted && b.status !== 'ถอนจอง')
    const thisYear = new Date().getFullYear()
    const grouped = {}
    real.forEach(b => {
      const province = (b.province || '').trim() || 'ไม่ระบุจังหวัด'
      if (!grouped[province]) grouped[province] = { customers: 0, revenue: 0, thisYearCount: 0, lastYearCount: 0 }
      const g = grouped[province]
      g.customers++
      g.revenue += b.price || 0
      const y = new Date(b.createdAt || b.bookingDate || 0).getFullYear()
      if (y === thisYear) g.thisYearCount++
      else if (y === thisYear - 1) g.lastYearCount++
    })
    areas = Object.entries(grouped).map(([name, g], i) => ({
      name,
      customers: g.customers,
      revenue: g.revenue,
      growth: g.lastYearCount > 0 ? Math.round((g.thisYearCount - g.lastYearCount) / g.lastYearCount * 100) : null,
      color: PALETTE[i % PALETTE.length],
    })).sort((a, b) => b.customers - a.customers)

    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    if (!areas.length) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">🗺</div><div class="empty-title">ยังไม่มีข้อมูลใบจอง</div></div></div>`
      return
    }
    const sorted = [...areas].sort((a, b) => (b[sortBy] ?? -1) - (a[sortBy] ?? -1))
    const totalCustomers = areas.reduce((a, x) => a + x.customers, 0)
    const totalRevenue = areas.reduce((a, x) => a + x.revenue, 0)
    const maxV = Math.max(...areas.map(a => a[sortBy] ?? 0), 1)
    const growable = areas.filter(a => a.growth != null)
    const fastest = growable.length ? [...growable].sort((a, b) => b.growth - a.growth)[0] : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗺 Customer Map</div>
            <div class="page-subtitle">ลูกค้าตามจังหวัด (จากใบจองจริง) — วางแผนการตลาดเชิงภูมิศาสตร์ <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span></div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าทั้งหมด', totalCustomers.toLocaleString() + ' ราย', 'primary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalRevenue), 'success')}
          ${kpi('🗺 พื้นที่หลัก', escHtml(sorted[0]?.name || '—'), 'secondary')}
          ${kpi('🚀 โตเร็วสุด (YoY)', fastest ? escHtml(fastest.name) + ' +' + fastest.growth + '%' : '— ยังไม่มีข้อมูลเทียบปีก่อน', 'warning')}
        </div>

        <!-- Sort -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          ${[['customers','👥 จำนวนลูกค้า'],['revenue','💰 มูลค่า'],['growth','🚀 การเติบโต']].map(([k,l]) =>
            `<button class="btn btn-xs ${sortBy===k?'btn-primary':'btn-secondary'} sort-btn" data-s="${k}">${l}</button>`).join('')}
        </div>

        <!-- Area bars -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sorted.map((a, i) => {
            const pct = Math.round((a[sortBy] ?? 0) / maxV * 100)
            const share = Math.round(a.customers / totalCustomers * 100)
            return `<div class="card" style="padding:13px 14px;border-left:3px solid ${a.color}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.86rem">${i===0?'👑 ':''}${escHtml(a.name)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${share}% ของลูกค้าทั้งหมด</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700;font-size:0.88rem">${a.customers} ราย</div>
                  <div style="font-size:0.68rem;color:var(--${a.growth==null?'text-muted':a.growth>=15?'success':a.growth>=0?'warning':'danger'})">${a.growth==null?'ไม่มีข้อมูลปีก่อน':(a.growth>=0?'+':'')+a.growth+'% YoY'}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="flex:1;background:var(--surface-2);border-radius:4px;height:12px">
                  <div style="width:${pct}%;background:${a.color};height:12px;border-radius:4px;transition:width .3s"></div>
                </div>
                <span style="font-size:0.7rem;color:var(--text-muted);width:90px;text-align:right">${formatCurrency(a.revenue)}</span>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sort-btn').forEach(b => b.addEventListener('click', () => { sortBy = b.dataset.s; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        areas.map(a => ({
          'จังหวัด': a.name,
          'ลูกค้า (ราย)': a.customers,
          'รายได้ (บาท)': a.revenue,
          'Growth % YoY': a.growth == null ? '-' : a.growth,
        })),
        'Customer_Map.xlsx',
        'Customer Map'
      )
      showToast('📥 Export Customer Map แล้ว', 'success')
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
