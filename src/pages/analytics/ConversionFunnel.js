/**
 * Conversion Funnel — กรวยการขาย
 * Route: /analytics/funnel
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData, listDocs, listAllDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { realFunnel, stepRate } from '../../utils/realFunnel.js'
import { isCancelled } from '../../utils/bookingStatus.js'
import { escHtml } from '../../utils/escape.js'

export default async function ConversionFunnelPage(container) {
  const myGen = container.__routerGen
  let stages = realFunnel()
  let dataSource = 'demo'

  let bySource = []
  let dropReasons = []
  try {
    const [sales, customers, testDrives, quotations, bookings] = await Promise.all([
      getSalesData().catch(() => []),
      listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
      listDocs('test_drives', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
      listDocs('quotations', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
      listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    // (2026-11-02) นับจากข้อมูลจริงเท่านั้น (utils/realFunnel.js) — เลิกเดาขั้นที่ไม่มีข้อมูลด้วยอัตราสมมติ
    stages = realFunnel({ customers, sales, testDrives, quotations })
    if (stages[0].count) dataSource = 'live'
    // แยกตามที่มา: ลูกค้าแต่ละแหล่ง → จองกี่ราย
    const src = {}
    customers.filter(c => !c.deleted).forEach(c => {
      const k = c.source || 'ไม่ระบุ'
      src[k] = src[k] || { source: k, leads: 0, closed: 0 }
      src[k].leads++
      if (c.bookingId || c.stage === 'booking' || c.stage === 'delivered') src[k].closed++
    })
    bySource = Object.values(src).sort((x, y) => y.leads - x.leads).slice(0, 8)
    // สาเหตุที่หลุด: เหตุผลจริงจากลูกค้าที่ปิดเป็นแพ้ + ใบจองที่ถอน
    const why = {}
    customers.filter(c => !c.deleted && c.isLost).forEach(c => { const k = c.lostReason || 'ไม่ระบุ'; why[k] = (why[k] || 0) + 1 })
    bookings.filter(b => !b.deleted && isCancelled(b)).forEach(b => { const k = b.cancelReason || 'ถอนจอง (ไม่ระบุเหตุผล)'; why[k] = (why[k] || 0) + 1 })
    const totalWhy = Object.values(why).reduce((x, y) => x + y, 0)
    dropReasons = Object.entries(why).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([reason, n]) => ({ from: n + ' ราย', reason, pct: Math.round(n / totalWhy * 100) }))
  } catch {}

  function renderPage() {
    // เดิมไม่กัน maxCount = 0 (ไม่มี Lead เลยในช่วงที่ดู) ทำให้หารด้วยศูนย์แล้วโชว์ NaN%/Infinity% ให้ผู้ใช้เห็น
    const maxCount = stages[0].count || 1
    const overall = Math.round(stages[stages.length-1].count / maxCount * 1000) / 10
    // Find biggest drop (idx starts at 1 — stage 0 has no "previous" to compare against,
    // and stages[worstDrop.idx-1] below would be undefined if this stayed at 0)
    // (2026-11-02) นับเฉพาะคู่ขั้นที่มีข้อมูลทั้งสองฝั่ง (ขั้นที่ยังไม่ได้บันทึก = 0 ไม่ใช่ "รั่ว")
    let worstDrop = { idx: 0, rate: 100 }
    stages.forEach((s, i) => {
      if (i > 0 && s.count > 0 && stages[i-1].count > 0) {
        const rate = stepRate(s.count, stages[i-1].count)
        if (rate < worstDrop.rate) worstDrop = { idx: i, rate }
      }
    })

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔻 Conversion Funnel</div>
            <div class="page-subtitle">กรวยการขาย — ลูกค้าถึงส่งมอบ (ทั้งหมด)${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● Funnel จากข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 ส่งออก</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('🧲 Lead ทั้งหมด', stages[0].count, 'primary')}
          ${kpi('🏁 ปิดได้', stages[stages.length-1].count + ' ดีล', 'success')}
          ${kpi('📊 ปิดการขายรวม', overall + '%', overall >= 8 ? 'success' : 'warning')}
        </div>

        ${worstDrop.idx ? `<div style="padding:10px 14px;background:var(--surface-2);border-left:3px solid var(--warning);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.78rem">
          🤖 <strong>จุดรั่วใหญ่สุด:</strong> "${stages[worstDrop.idx-1].stage} → ${stages[worstDrop.idx].stage}" เหลือแค่ ${worstDrop.rate}% — ดูสาเหตุด้านล่าง
        </div>` : ''}

        <!-- Funnel -->
        <div class="card" style="padding:18px;margin-bottom:14px">
          ${stages.map((s, i) => {
            const widthPct = Math.round(s.count / maxCount * 100)
            const stepPct = i > 0 ? stepRate(s.count, stages[0].count) : 100 // % ของลูกค้าทั้งหมด
            const isWorst = i === worstDrop.idx
            return `<div style="margin-bottom:6px">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:130px;font-size:0.74rem;text-align:right">${s.icon} ${s.stage}</div>
                <div style="flex:1;display:flex;justify-content:center">
                  <div style="width:${widthPct}%;background:${s.color};border-radius:4px;height:30px;display:flex;align-items:center;justify-content:center;min-width:60px;transition:width .3s">
                    <span style="font-size:0.74rem;font-weight:800;color:white">${s.count}</span>
                  </div>
                </div>
                <div style="width:80px;font-size:0.7rem;color:var(--${isWorst?'danger':'text-muted'});font-weight:${isWorst?700:400}">
                  ${i > 0 ? stepPct + '% ของลูกค้า' + (isWorst ? ' ⚠️' : '') : ''}
                </div>
              </div>
            </div>`
          }).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:14px">
          <!-- By source -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 จองได้ แยกตามที่มาลูกค้า</div>
            ${bySource.length ? '' : '<div style="font-size:0.78rem;color:var(--text-muted)">ยังไม่มีข้อมูลที่มาลูกค้า</div>'}
            ${bySource.map(s => {
              const conv = s.leads ? Math.round(s.closed / s.leads * 1000) / 10 : 0
              return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
                <span>${escHtml(s.source)}</span>
                <div style="text-align:right">
                  <span style="color:var(--text-muted)">${s.closed}/${s.leads}</span>
                  <strong style="color:var(--${conv>=10?'success':conv>=5?'warning':'danger'});margin-left:8px">${conv}%</strong>
                </div>
              </div>`
            }).join('')}
          </div>

          <!-- Drop reasons -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">💔 สาเหตุที่หลุด / ถอนจอง</div>
            ${dropReasons.length ? '' : '<div style="font-size:0.78rem;color:var(--text-muted)">ยังไม่มีลูกค้าที่หลุด/ถอนจอง</div>'}
            ${dropReasons.map(d => `
              <div style="padding:7px 0;border-bottom:1px solid var(--border)">
                <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(d.from)}</div>
                <div style="display:flex;justify-content:space-between;font-size:0.78rem">
                  <span>${escHtml(d.reason)}</span>
                  <strong style="color:var(--danger)">${d.pct}%</strong>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `

    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        stages.map((s, i) => ({
          'ขั้นตอน': s.stage,
          'จำนวน (ราย)': s.count,
          'อัตรา %': i > 0 ? Math.round(s.count / (stages[0].count || 1) * 100) : 100,
          'Drop จากขั้นก่อน %': i > 0 ? Math.round((stages[i - 1].count - s.count) / (stages[i - 1].count || 1) * 100) : 0,
        })),
        'Conversion_Funnel.xlsx',
        'Funnel'
      )
      showToast('📥 Export Funnel Report แล้ว', 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
