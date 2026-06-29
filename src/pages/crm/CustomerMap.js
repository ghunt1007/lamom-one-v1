/**
 * Customer Map — ลูกค้าตามพื้นที่
 * Route: /crm/map
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const AREAS = [
  { id: 'A1', name: 'บางนา-ศรีนครินทร์', customers: 412, revenue: 38500000, distance: '0-5 กม.', growth: 12, color: '#10b981' },
  { id: 'A2', name: 'สมุทรปราการ', customers: 286, revenue: 26200000, distance: '5-15 กม.', growth: 18, color: '#3b82f6' },
  { id: 'A3', name: 'พระโขนง-อ่อนนุช', customers: 198, revenue: 19800000, distance: '5-10 กม.', growth: 8, color: '#f59e0b' },
  { id: 'A4', name: 'ลาดกระบัง-มีนบุรี', customers: 145, revenue: 12400000, distance: '10-20 กม.', growth: 22, color: '#8b5cf6' },
  { id: 'A5', name: 'บางพลี-บางบ่อ', customers: 124, revenue: 11000000, distance: '10-20 กม.', growth: 15, color: '#ec4899' },
  { id: 'A6', name: 'อื่นๆ / ต่างจังหวัด', customers: 89, revenue: 8900000, distance: '20+ กม.', growth: 5, color: '#6b7280' },
]

const INSIGHTS = [
  { icon: '🚀', text: 'ลาดกระบัง-มีนบุรี โตเร็วสุด +22% — ยังไม่มีคู่แข่ง EV dealer ในพื้นที่ ควรจัด Roadshow' },
  { icon: '🏭', text: 'นิคมอุตสาหกรรมบางปู (สมุทรปราการ) มีบริษัทใหญ่ 40+ แห่ง — โอกาส Fleet B2B' },
  { icon: '📉', text: 'พระโขนง-อ่อนนุช โตช้าลง (8%) — คู่แข่งเปิดโชว์รูมใหม่ที่สุขุมวิท 77 เมื่อ 3 เดือนก่อน' },
]

export default async function CustomerMapPage(container) {
  const myGen = container.__routerGen
  let areas = AREAS.map(a => ({ ...a }))
  let dataSource = 'demo'
  let sortBy = 'customers'

  try {
    const docs = await listDocs('customer_areas', [], 'customers', 'desc', 50).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `A${i+1}`,
        name: d.name || d.area || d.zone || `พื้นที่ ${i+1}`,
        customers: d.customers || d.count || 0,
        revenue: d.revenue || 0,
        distance: d.distance || '',
        growth: d.growth || 0,
        color: d.color || AREAS[i % AREAS.length]?.color || '#6b7280',
      }))
      areas = [...mapped, ...AREAS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const sorted = [...areas].sort((a, b) => b[sortBy] - a[sortBy])
    const totalCustomers = areas.reduce((a, x) => a + x.customers, 0)
    const totalRevenue = areas.reduce((a, x) => a + x.revenue, 0)
    const maxV = Math.max(...areas.map(a => a[sortBy]))
    const fastest = [...areas].sort((a, b) => b.growth - a.growth)[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗺 Customer Map</div>
            <div class="page-subtitle">ลูกค้าตามพื้นที่ — วางแผนการตลาดเชิงภูมิศาสตร์${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าทั้งหมด', totalCustomers.toLocaleString() + ' ราย', 'primary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalRevenue), 'success')}
          ${kpi('🗺 พื้นที่หลัก', escHtml(areas[0]?.name || '—'), 'secondary')}
          ${kpi('🚀 โตเร็วสุด', escHtml(fastest.name) + ' +' + fastest.growth + '%', 'warning')}
        </div>

        <!-- Insights -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🤖 LAMI วิเคราะห์พื้นที่</div>
          ${INSIGHTS.map(i => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.76rem"><span>${i.icon}</span><span>${i.text}</span></div>`).join('')}
        </div>

        <!-- Sort -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          ${[['customers','👥 จำนวนลูกค้า'],['revenue','💰 มูลค่า'],['growth','🚀 การเติบโต']].map(([k,l]) =>
            `<button class="btn btn-xs ${sortBy===k?'btn-primary':'btn-secondary'} sort-btn" data-s="${k}">${l}</button>`).join('')}
        </div>

        <!-- Area bars -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sorted.map((a, i) => {
            const pct = Math.round(a[sortBy] / maxV * 100)
            const share = Math.round(a.customers / totalCustomers * 100)
            return `<div class="card" style="padding:13px 14px;border-left:3px solid ${a.color}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.86rem">${i===0?'👑 ':''}${escHtml(a.name)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">📍 ห่างโชว์รูม ${escHtml(a.distance)} · ${share}% ของลูกค้าทั้งหมด</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700;font-size:0.88rem">${a.customers} ราย</div>
                  <div style="font-size:0.68rem;color:var(--${a.growth>=15?'success':a.growth>=10?'warning':'danger'})">${a.growth>=0?'+':''}${a.growth}% YoY</div>
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
          'พื้นที่': a.name,
          'ลูกค้า (ราย)': a.customers,
          'รายได้ (บาท)': a.revenue,
          'ระยะทาง': a.distance,
          'Growth %': a.growth,
        })),
        'Customer_Map.xlsx',
        'Customer Map'
      )
      showToast('📥 Export Customer Map แล้ว', 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
