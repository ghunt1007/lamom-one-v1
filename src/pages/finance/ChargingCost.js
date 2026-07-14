/**
 * Charging Cost — ต้นทุนค่าไฟชาร์จ
 * Route: /finance/charging-cost
 * ข้อมูลจริงจาก collection ร่วม `charging_sessions` (ดูสคีมาใน core/seed/finance.js)
 * — หน้านี้รวม kWh ของทุก session (ทั้งลูกค้าจ่ายเงินและใช้งานภายใน) เป็นมุมมองต้นทุนไฟฟ้า TOU
 * ส่วนมุมมองรายได้ (เฉพาะ session ที่ลูกค้าจ่ายเงิน) อยู่ที่หน้า Charging Revenue (/finance/charging-revenue)
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, seedDemoData } from '../../core/db.js'

const RATE_PEAK = 5.8   // บาท/หน่วย On-Peak
const RATE_OFFPEAK = 2.6 // บาท/หน่วย Off-Peak (TOU)
const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const USE_LABELS = {
  public:        'ลูกค้าขับเข้ามาชาร์จ (จ่ายเงิน)',
  test_drive:    'รถ Demo / Test Drive',
  free_customer: 'ชาร์จฟรีให้ลูกค้า (มารับบริการ)',
  company_car:   'รถบริษัท (รับ-ส่ง)',
  delivery_prep: 'เตรียมรถส่งมอบ (ชาร์จ 100%)',
}

function last6Months() {
  const arr = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    arr.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: MONTH_LABELS[d.getMonth()] })
  }
  return arr
}

export default async function ChargingCostPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let sessions = []
  let loading = true

  async function loadData() {
    loading = true
    if (container.__routerGen === myGen) renderLoading()
    try { sessions = await listDocs('charging_sessions', [], 'date', 'desc', 1000) } catch (e) { sessions = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderLoading() {
    container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
  }

  function renderPage() {
    const months = last6Months()
    const MONTHLY_USAGE = months.map(mo => {
      const rows = sessions.filter(s => (s.date || '').slice(0, 7) === mo.key)
      const peak = Math.round(rows.filter(s => s.touPeriod === 'peak').reduce((s, x) => s + (x.kwh || 0), 0))
      const offpeak = Math.round(rows.filter(s => s.touPeriod === 'offpeak').reduce((s, x) => s + (x.kwh || 0), 0))
      return { month: mo.month || mo.label, key: mo.key, peak, offpeak }
    })

    if (!sessions.length) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">ยังไม่มีข้อมูล Session ชาร์จ</div><div style="color:var(--text-muted);font-size:0.8rem;margin-top:6px">เพิ่ม session ได้ที่หน้า Charging Revenue</div></div></div>`
      return
    }

    const last = MONTHLY_USAGE[MONTHLY_USAGE.length - 1]
    const lastCost = last.peak * RATE_PEAK + last.offpeak * RATE_OFFPEAK
    const prev = MONTHLY_USAGE[MONTHLY_USAGE.length - 2] || { peak: 0, offpeak: 0 }
    const prevCost = prev.peak * RATE_PEAK + prev.offpeak * RATE_OFFPEAK
    const chg = prevCost ? Math.round((lastCost - prevCost) / prevCost * 100) : 0
    const totalKwh = last.peak + last.offpeak || 1
    const offpeakPct = Math.round(last.offpeak / totalKwh * 100)
    const maxCost = Math.max(1, ...MONTHLY_USAGE.map(mo => mo.peak * RATE_PEAK + mo.offpeak * RATE_OFFPEAK))
    // saving potential: move all peak to offpeak
    const potentialSaving = Math.round(last.peak * (RATE_PEAK - RATE_OFFPEAK))

    const curMonthKey = months[months.length - 1].key
    const curRows = sessions.filter(s => (s.date || '').slice(0, 7) === curMonthKey)
    const totalKwhThisMonth = curRows.reduce((s, x) => s + (x.kwh || 0), 0) || 1
    const BY_USE = Object.keys(USE_LABELS).map(key => {
      const kwh = Math.round(curRows.filter(s => s.useType === key).reduce((s, x) => s + (x.kwh || 0), 0))
      return { use: USE_LABELS[key], kwh, pct: Math.round(kwh / totalKwhThisMonth * 100) }
    }).filter(u => u.kwh > 0)
    const freeCustomerKwh = curRows.filter(s => s.useType === 'free_customer').reduce((s, x) => s + (x.kwh || 0), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ Charging Cost</div>
            <div class="page-subtitle">ต้นทุนค่าไฟชาร์จ — มิเตอร์ TOU (Peak ${RATE_PEAK} / Off-Peak ${RATE_OFFPEAK} บาท/หน่วย)</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⚡ ใช้ไฟเดือนนี้', totalKwh.toLocaleString() + ' หน่วย', 'primary')}
          ${kpi('💰 ค่าไฟ', formatCurrency(Math.round(lastCost)) + ' (' + (chg > 0 ? '+' : '') + chg + '%)', chg <= 0 ? 'success' : 'warning')}
          ${kpi('🌙 ชาร์จ Off-Peak', offpeakPct + '%', offpeakPct >= 70 ? 'success' : 'warning')}
          ${kpi('💡 ประหยัดได้อีก', formatCurrency(potentialSaving) + '/เดือน', 'secondary')}
        </div>

        <div style="padding:10px 14px;background:var(--surface-2);border-left:3px solid var(--primary);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.78rem">
          🤖 <strong>LAMI:</strong> เดือนนี้ย้ายไปชาร์จกลางคืนมากขึ้น (Off-Peak ${offpeakPct}%) ค่าไฟ${chg <= 0 ? 'ลด' : 'เพิ่ม'} ${Math.abs(chg)}% — ถ้าย้าย Peak ที่เหลือ ${last.peak} หน่วยไปกลางคืนทั้งหมด จะประหยัดเพิ่ม ${formatCurrency(potentialSaving)}/เดือน
        </div>

        <!-- Monthly cost chart -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 ค่าไฟรายเดือน (Peak ส้ม / Off-Peak เขียว)</div>
          <div style="display:flex;gap:8px;align-items:flex-end;height:110px">
            ${MONTHLY_USAGE.map((mo, i) => {
              const pCost = mo.peak * RATE_PEAK
              const opCost = mo.offpeak * RATE_OFFPEAK
              const totalH = Math.round((pCost + opCost) / maxCost * 90)
              const pH = (pCost + opCost) ? Math.round(pCost / (pCost + opCost) * totalH) : 0
              const isLast = i === MONTHLY_USAGE.length - 1
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="font-size:0.6rem;color:var(--${isLast ? 'primary' : 'text-muted'})">${formatCurrency(Math.round(pCost + opCost))}</div>
                <div style="width:100%;display:flex;flex-direction:column;border-radius:3px 3px 0 0;overflow:hidden;height:${totalH}px">
                  <div style="background:#f59e0b;height:${pH}px" title="Peak ${formatCurrency(Math.round(pCost))}"></div>
                  <div style="background:#10b981;flex:1" title="Off-Peak ${formatCurrency(Math.round(opCost))}"></div>
                </div>
                <div style="font-size:0.6rem;color:var(--text-muted)">${mo.month}</div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- By use -->
        <div class="card" style="padding:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔌 แยกตามการใช้งาน (เดือนนี้)</div>
          ${BY_USE.map(u => `
            <div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
                <span>${u.use}</span>
                <span style="color:var(--text-muted)">${u.kwh} หน่วย (${u.pct}%)</span>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:9px">
                <div style="width:${u.pct}%;background:var(--primary);height:9px;border-radius:3px"></div>
              </div>
            </div>
          `).join('')}
          ${!BY_USE.length ? '<div style="text-align:center;padding:10px;color:var(--text-muted);font-size:0.72rem">ยังไม่มีข้อมูลเดือนนี้</div>' : ''}
          <p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px">💡 "ชาร์จฟรีให้ลูกค้า" คือต้นทุนการตลาด ≈ ${formatCurrency(Math.round(freeCustomerKwh * RATE_OFFPEAK))}/เดือน — ถูกกว่าแจกของแถมและลูกค้าชอบมาก</p>
        </div>
      </div>
    `

    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        MONTHLY_USAGE.map(mo => ({
          'เดือน': mo.month,
          'Peak (kWh)': mo.peak,
          'Off-Peak (kWh)': mo.offpeak,
          'ค่า Peak (บาท)': Math.round(mo.peak * RATE_PEAK),
          'ค่า Off-Peak (บาท)': Math.round(mo.offpeak * RATE_OFFPEAK),
          'รวม (บาท)': Math.round(mo.peak * RATE_PEAK + mo.offpeak * RATE_OFFPEAK),
        })),
        'Charging_Cost_Report.xlsx',
        'Charging Cost'
      )
      showToast('📥 Export รายงานค่าไฟแล้ว', 'success')
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
