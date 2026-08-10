/**
 * Daily Report — รายงานประจำวัน
 * Route: /analytics/daily
 */
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData, listDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DEFAULT_TARGET = 10000000

function dateStr(d) { return d.toISOString().slice(0, 10) }
// เดิม todayStr() ใช้ dateStr(new Date()) ซึ่งคืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่เวลา
// ไทยยังไม่ถึง 07:00 น. — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok() แล้วบวก/ลบวันด้วย UTC methods เสมอ (ไม่ผูก
// กับ timezone ของเครื่อง/เบราว์เซอร์ผู้ใช้)
function addDays(base, n) { const d = new Date(base); d.setUTCDate(d.getUTCDate() + n); return dateStr(d) }
function todayStr() {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  return dateStr(new Date(Date.UTC(y, m - 1, d)))
}

// รายเป้าต่อเดือนที่โหลดจาก Firestore 'sales_budgets' ครั้งเดียวตอนเปิดหน้า (เดิมอ่านจาก localStorage
// key ผูกปีตายตัว 'lamom_sales_budget_2025' เดียวกับหน้า Sales Budget/Target vs Actual — คนละเครื่องเห็นเป้าคนละชุด)
let _monthlyTargets = null

function getMonthTarget(month) {
  if (!_monthlyTargets) return DEFAULT_TARGET
  const idx = parseInt(month.slice(5, 7)) - 1
  return _monthlyTargets[idx] || DEFAULT_TARGET
}

function buildWeek(sales, endDate) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(endDate)
    d.setUTCDate(d.getUTCDate() - (6 - i))
    const ds = dateStr(d)
    const day = sales.filter(s => (s.date || s.bookingDate || s.deliveryDate || '').slice(0, 10) === ds)
    return { date: ds, units: day.length, revenue: day.reduce((a, s) => a + (s.salePrice || 0), 0) }
  })
}

function buildDemoWeek(endDate) {
  return [2, 4, 1, 3, 5, 2, 3].map((u, i) => {
    const d = new Date(endDate); d.setUTCDate(d.getUTCDate() - (6 - i))
    return { date: dateStr(d), units: u, revenue: u * 1299000 }
  })
}

function buildTop(sales, date) {
  const day = sales.filter(s => (s.date || s.bookingDate || s.deliveryDate || '').slice(0, 10) === date)
  const by = {}
  day.forEach(s => {
    const n = s.salesperson || s.salesName || 'ไม่ระบุ'
    if (!by[n]) by[n] = { name: n, units: 0, revenue: 0 }
    by[n].units++; by[n].revenue += s.salePrice || 0
  })
  return Object.values(by).sort((a, b) => b.revenue - a.revenue).slice(0, 3)
}

function buildAlerts(dayUnits, dayTarget, monthRevenue, monthTarget) {
  const alerts = []
  const pct = Math.round(monthRevenue / monthTarget * 100)
  if (dayUnits < dayTarget)
    alerts.push({ type: 'warning', msg: `ยอดขายวันนี้ ${dayUnits}/${dayTarget} คัน — ต้องการอีก ${dayTarget - dayUnits} คันถึงเป้า` })
  else
    alerts.push({ type: 'success', msg: `ยอดขายวันนี้ ${dayUnits} คัน ✅ ถึงเป้าแล้ว` })
  if (monthRevenue > 0)
    alerts.push({ type: pct >= 80 ? 'success' : 'info', msg: `ยอดสะสมเดือนนี้ ${formatCurrency(monthRevenue)} (${pct}% ของเป้า ${formatCurrency(monthTarget)})` })
  return alerts
}

export default async function DailyReportPage(container) {
  const myGen = container.__routerGen
  let viewDate = todayStr()
  let allSales = []
  let dataSource = 'demo'
  // (v1.0.xxx) เดิม Walk-In/Test Drive/นัดหมาย และตาราง "งานบริการวันนี้" (DEMO_SERVICE) เป็นตัวเลข/ข้อมูล
  // hardcode ตายตัวแม้หน้านี้จะขึ้น badge "● Live" — คอลเลกชันจริงมีอยู่แล้ว (job_cards ใช้ที่ JobCards.js,
  // walk_ins ใช้ที่ WalkIn.js, test_drive_records ใช้ที่ TestDrive.js, appointments ใช้ที่ ShowroomAppointment.js)
  // จึงดึงมาใช้จริงทั้งหมดแทน ไม่มี fallback ข้อมูลปลอมอีกต่อไปสำหรับส่วนนี้
  let allJobs = []
  let allWalkIns = []
  let allTestDrives = []
  let allAppointments = []

  container.innerHTML = `<div class="page-content animate-slide"><div style="text-align:center;padding:48px;color:var(--text-muted);font-size:0.85rem">⏳ กำลังโหลดข้อมูล...</div></div>`

  try {
    const [sales, budgetDocs, jobs, walkins, testdrives, appts] = await Promise.all([
      getSalesData().catch(() => []),
      listDocs('sales_budgets', [['year', '==', new Date().getFullYear()]], 'createdAt', 'asc', 1).catch(() => []),
      listDocs('job_cards', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('walk_ins', [], 'visitTime', 'desc', 500).catch(() => []),
      listDocs('test_drive_records', [], 'date', 'desc', 500).catch(() => []),
      listDocs('appointments', [], 'date', 'desc', 500).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 1) { allSales = sales; dataSource = 'live' }
    if (budgetDocs.length > 0) _monthlyTargets = budgetDocs[0].targets || null
    allJobs = jobs
    allWalkIns = walkins
    allTestDrives = testdrives
    allAppointments = appts
  } catch {}

  function renderPage() {
    if (container.__routerGen !== myGen) return

    const month = viewDate.slice(0, 7)
    const monthTarget = getMonthTarget(month)

    const weekData = dataSource === 'live' ? buildWeek(allSales, viewDate) : buildDemoWeek(viewDate)

    const daySales = dataSource === 'live'
      ? allSales.filter(s => (s.date || s.bookingDate || s.deliveryDate || '').slice(0, 10) === viewDate)
      : []
    const dayUnits = dataSource === 'live' ? daySales.length : 3
    const dayRevenue = dataSource === 'live' ? daySales.reduce((a, s) => a + (s.salePrice || 0), 0) : 3897000
    const dayTarget = 5

    const monthSales = dataSource === 'live'
      ? allSales.filter(s => (s.date || s.bookingDate || s.deliveryDate || '').slice(0, 7) === month)
      : []
    const monthRevenue = dataSource === 'live' ? monthSales.reduce((a, s) => a + (s.salePrice || 0), 0) : 39000000
    const monthPct = Math.min(100, Math.round(monthRevenue / monthTarget * 100))
    const monthUnits = dataSource === 'live' ? monthSales.length : 30

    const topPerformers = dataSource === 'live'
      ? buildTop(allSales, viewDate)
      : [{ name: 'วิชัย ยอดขาย', units: 2, revenue: 2598000 }, { name: 'สุดา มาดี', units: 1, revenue: 1299000 }]

    const alerts = dataSource === 'live'
      ? buildAlerts(dayUnits, dayTarget, monthRevenue, monthTarget)
      : [
        { type: 'warning', msg: 'ยอดขายต่ำกว่าเป้า 40% — ต้องการ 2 คันเพิ่มเพื่อถึงเป้าวันนี้' },
        { type: 'info', msg: 'มีนัด Service 3 คันในช่วงบ่าย' },
        { type: 'success', msg: 'สุดา มาดี ปิดดีลได้ 1 คัน มูลค่า ฿1.3M' },
      ]

    const maxRev = Math.max(...weekData.map(d => d.revenue), 1)
    const salePct = Math.round(dayUnits / dayTarget * 100)

    const dayJobs = allJobs.filter(j => (j.createdAt || '').slice(0, 10) === viewDate)
    const dayWalkIns = allWalkIns.filter(w => (w.visitTime || '').slice(0, 10) === viewDate)
    const dayTestDrives = allTestDrives.filter(t => (t.date || '').slice(0, 10) === viewDate)
    const dayAppointments = allAppointments.filter(a => (a.date || '').slice(0, 10) === viewDate)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Daily Report</div>
            <div class="page-subtitle">รายงานประจำวัน — ${formatDate(viewDate)}${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● Live</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="prev-day-btn">◀ เมื่อวาน</button>
            <button class="btn btn-secondary btn-xs" id="today-btn">วันนี้</button>
            <button class="btn btn-primary" id="export-btn">📤 Export PDF</button>
          </div>
        </div>

        <!-- Alerts -->
        ${alerts.map(a => `
          <div style="padding:9px 14px;background:var(--surface-2);border-left:3px solid var(--${a.type === 'warning' ? 'warning' : a.type === 'success' ? 'success' : 'primary'});border-radius:var(--radius-sm);margin-bottom:8px;font-size:0.8rem">
            ${a.type === 'warning' ? '⚠️' : a.type === 'success' ? '✅' : 'ℹ️'} ${a.msg}
          </div>`).join('')}

        <!-- Monthly bar -->
        <div class="card" style="padding:12px 16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted)">📅 ยอดสะสมเดือน ${month} (${monthUnits} คัน)</div>
            <div style="font-size:0.8rem;font-weight:800;color:var(--${monthPct >= 80 ? 'success' : monthPct >= 50 ? 'warning' : 'danger'})">${monthPct}%</div>
          </div>
          <div style="background:var(--surface-2);border-radius:4px;height:8px;margin-bottom:6px">
            <div style="background:var(--${monthPct >= 80 ? 'success' : monthPct >= 50 ? 'warning' : 'danger'});width:${monthPct}%;height:8px;border-radius:4px;transition:width 0.5s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.71rem;color:var(--text-muted)">
            <span>${formatCurrency(monthRevenue)}</span>
            <span>เป้า ${formatCurrency(monthTarget)}</span>
          </div>
        </div>

        <!-- KPI row -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚗 ขายได้', dayUnits + '/' + dayTarget + ' คัน', salePct >= 80 ? 'success' : salePct >= 50 ? 'warning' : 'danger')}
          ${kpi('💰 รายได้วันนี้', formatCurrency(dayRevenue), 'primary')}
          ${kpi('🚶 Walk-In', dayWalkIns.length + ' คน', 'secondary')}
          ${kpi('📅 คันเดือนนี้', monthUnits + ' คัน', 'accent')}
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
          <!-- Weekly bar chart -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 รายได้ 7 วัน</div>
            <div style="display:flex;gap:6px;align-items:flex-end;height:90px">
              ${weekData.map(d => {
                const pct = d.revenue / maxRev * 100
                const isView = d.date === viewDate
                return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                  <div style="font-size:0.57rem;color:${isView ? 'var(--primary)' : 'var(--text-muted)'};font-weight:${isView ? '700' : '400'}">${d.units > 0 ? d.units + '.' : ''}</div>
                  <div style="width:100%;background:${isView ? 'var(--primary)' : 'var(--surface-2)'};border-radius:3px 3px 0 0;height:${Math.max(4, pct / 100 * 72)}px;border:1px solid ${isView ? 'var(--primary)' : 'var(--border)'};cursor:default" title="${formatCurrency(d.revenue)}"></div>
                  <div style="font-size:0.57rem;color:${isView ? 'var(--primary)' : 'var(--text-muted)'}${isView ? ';font-weight:700' : ''}">${d.date.slice(8)}</div>
                </div>`
              }).join('')}
            </div>
          </div>

          <!-- Stats panel -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 สถิติวัน</div>
            ${row('ยอดขาย', dayUnits + ' คัน')}
            ${row('รายได้', formatCurrency(dayRevenue))}
            ${row('Avg Deal', dayUnits > 0 ? formatCurrency(Math.round(dayRevenue / dayUnits)) : '—')}
            ${row('Test Drive', dayTestDrives.length + ' คัน')}
            ${row('นัดหมาย', dayAppointments.length + ' รายการ')}
            ${row('Service', dayJobs.length + ' งาน')}
          </div>
        </div>

        <!-- Top performers -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🏆 ผลงานวันนี้</div>
          ${topPerformers.length
            ? topPerformers.map((t, i) => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;gap:8px;align-items:center">
                  <span style="font-size:1.1rem">${['🥇','🥈','🥉'][i] || '·'}</span>
                  <span style="font-size:0.85rem;font-weight:600">${escHtml(t.name)}</span>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700;font-size:0.85rem;color:var(--success)">${formatCurrency(t.revenue)}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${t.units} คัน</div>
                </div>
              </div>`).join('')
            : `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.8rem">ยังไม่มีการขายวันนี้</div>`
          }
        </div>

        <!-- Service jobs -->
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">🔧 งานบริการวันนี้</div>
          <table style="width:100%;border-collapse:collapse">
            <tbody>
              ${dayJobs.length ? dayJobs.map(j => {
                const isDone = ['done', 'delivered'].includes(j.status)
                return `
                <tr style="border-bottom:1px solid var(--border);font-size:0.82rem">
                  <td style="padding:8px 14px">${escHtml(j.plate || '-')}</td>
                  <td style="padding:8px 10px;color:var(--text-muted)">${escHtml(`${j.brand || ''} ${j.model || ''}`.trim() || '-')}</td>
                  <td style="padding:8px 10px">${escHtml(j.desc || '-')}</td>
                  <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--success)">${formatCurrency(j.labor || 0)}</td>
                  <td style="padding:8px 14px;text-align:right">
                    <span class="badge badge-${isDone ? 'success' : 'warning'}" style="font-size:0.6rem">${isDone ? 'เสร็จ' : 'กำลังซ่อม'}</span>
                  </td>
                </tr>`
              }).join('') : `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.8rem">ไม่มีงานบริการวันนี้</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        weekData.map(d => ({
          'วันที่': d.date,
          'ยอดขาย (คัน)': d.units,
          'รายได้ (บาท)': d.revenue,
        })),
        `Daily_Report_${viewDate}.xlsx`,
        'Daily'
      )
      showToast(`📥 Export Daily Report ${viewDate} แล้ว`, 'success')
    })
    document.getElementById('prev-day-btn')?.addEventListener('click', () => { viewDate = addDays(viewDate, -1); renderPage() })
    document.getElementById('today-btn')?.addEventListener('click', () => { viewDate = todayStr(); renderPage() })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
