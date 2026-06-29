/**
 * Charging Cost — ต้นทุนค่าไฟชาร์จ
 * Route: /finance/charging-cost
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

const RATE_PEAK = 5.8   // บาท/หน่วย On-Peak
const RATE_OFFPEAK = 2.6 // บาท/หน่วย Off-Peak (TOU)

const MONTHLY_USAGE = [
  { month: 'ม.ค.', peak: 820, offpeak: 1450 },
  { month: 'ก.พ.', peak: 760, offpeak: 1380 },
  { month: 'มี.ค.', peak: 890, offpeak: 1520 },
  { month: 'เม.ย.', peak: 940, offpeak: 1610 },
  { month: 'พ.ค.', peak: 870, offpeak: 1690 },
  { month: 'มิ.ย.', peak: 650, offpeak: 1840 },
]

const BY_USE = [
  { use: 'รถ Demo / Test Drive', kwh: 980, pct: 39 },
  { use: 'ชาร์จฟรีให้ลูกค้า (มารับบริการ)', kwh: 720, pct: 29 },
  { use: 'รถบริษัท (รับ-ส่ง)', kwh: 480, pct: 19 },
  { use: 'เตรียมรถส่งมอบ (ชาร์จ 100%)', kwh: 310, pct: 13 },
]

export default async function ChargingCostPage(container) {
  function renderPage() {
    const last = MONTHLY_USAGE[MONTHLY_USAGE.length - 1]
    const lastCost = last.peak * RATE_PEAK + last.offpeak * RATE_OFFPEAK
    const prev = MONTHLY_USAGE[MONTHLY_USAGE.length - 2]
    const prevCost = prev.peak * RATE_PEAK + prev.offpeak * RATE_OFFPEAK
    const chg = Math.round((lastCost - prevCost) / prevCost * 100)
    const totalKwh = last.peak + last.offpeak
    const offpeakPct = Math.round(last.offpeak / totalKwh * 100)
    const maxCost = Math.max(...MONTHLY_USAGE.map(m => m.peak * RATE_PEAK + m.offpeak * RATE_OFFPEAK))
    // saving potential: move all peak to offpeak
    const potentialSaving = Math.round(last.peak * (RATE_PEAK - RATE_OFFPEAK))

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
          ${kpi('💰 ค่าไฟ', formatCurrency(Math.round(lastCost)) + ' (' + (chg>0?'+':'') + chg + '%)', chg <= 0 ? 'success' : 'warning')}
          ${kpi('🌙 ชาร์จ Off-Peak', offpeakPct + '%', offpeakPct >= 70 ? 'success' : 'warning')}
          ${kpi('💡 ประหยัดได้อีก', formatCurrency(potentialSaving) + '/เดือน', 'secondary')}
        </div>

        <div style="padding:10px 14px;background:var(--surface-2);border-left:3px solid var(--primary);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.78rem">
          🤖 <strong>LAMI:</strong> เดือนนี้ย้ายไปชาร์จกลางคืนมากขึ้น (Off-Peak ${offpeakPct}%) ค่าไฟลด ${Math.abs(chg)}% — ถ้าย้าย Peak ที่เหลือ ${last.peak} หน่วยไปกลางคืนทั้งหมด จะประหยัดเพิ่ม ${formatCurrency(potentialSaving)}/เดือน
        </div>

        <!-- Monthly cost chart -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 ค่าไฟรายเดือน (Peak ส้ม / Off-Peak เขียว)</div>
          <div style="display:flex;gap:8px;align-items:flex-end;height:110px">
            ${MONTHLY_USAGE.map((m, i) => {
              const pCost = m.peak * RATE_PEAK
              const opCost = m.offpeak * RATE_OFFPEAK
              const totalH = Math.round((pCost + opCost) / maxCost * 90)
              const pH = Math.round(pCost / (pCost + opCost) * totalH)
              const isLast = i === MONTHLY_USAGE.length - 1
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="font-size:0.6rem;color:var(--${isLast?'primary':'text-muted'})">${formatCurrency(Math.round(pCost+opCost))}</div>
                <div style="width:100%;display:flex;flex-direction:column;border-radius:3px 3px 0 0;overflow:hidden;height:${totalH}px">
                  <div style="background:#f59e0b;height:${pH}px" title="Peak ${formatCurrency(Math.round(pCost))}"></div>
                  <div style="background:#10b981;flex:1" title="Off-Peak ${formatCurrency(Math.round(opCost))}"></div>
                </div>
                <div style="font-size:0.6rem;color:var(--text-muted)">${m.month}</div>
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
          <p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px">💡 "ชาร์จฟรีให้ลูกค้า" คือต้นทุนการตลาด ≈ ${formatCurrency(Math.round(720 * RATE_OFFPEAK))}/เดือน — ถูกกว่าแจกของแถมและลูกค้าชอบมาก</p>
        </div>
      </div>
    `

    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        MONTHLY_USAGE.map(m => ({
          'เดือน': m.month,
          'Peak (kWh)': m.peak,
          'Off-Peak (kWh)': m.offpeak,
          'ค่า Peak (บาท)': Math.round(m.peak * RATE_PEAK),
          'ค่า Off-Peak (บาท)': Math.round(m.offpeak * RATE_OFFPEAK),
          'รวม (บาท)': Math.round(m.peak * RATE_PEAK + m.offpeak * RATE_OFFPEAK),
        })),
        'Charging_Cost_Report.xlsx',
        'Charging Cost'
      )
      showToast('📥 Export รายงานค่าไฟแล้ว', 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
