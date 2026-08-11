/**
 * Monthly Campaign Goals — เป้าหมาย/เงื่อนไขแคมเปญประจำเดือน
 * Route: /marketing/monthly-goals
 * รวมภาพรวมแคมเปญจากมอเตอร์ (promotions, ดูจริงที่ /marketing/promotions) และแคมเปญของบริษัทเอง
 * (marketing_campaigns, ดูจริงที่ /marketing/campaigns) ของเดือนที่เลือก พร้อมตั้งเป้าหมาย/เงื่อนไขเดือนนั้นได้
 * — ไม่แก้/ไม่เขียนซ้ำข้อมูลของ 2 หน้าเดิม แค่ query มาแสดงรวมเป็นภาพรวมประจำเดือน
 */
import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, getSalesData } from '../../core/db.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TH_MONTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
function monthLabel(ym) {
  const [y, m] = (ym || '').split('-').map(Number)
  if (!y || !m) return ym || '-'
  return TH_MONTH[m - 1] + ' ' + (y + 543)
}
function shiftMonth(ym, delta) {
  const d = new Date(ym + '-01')
  d.setMonth(d.getMonth() + delta)
  return d.toISOString().slice(0, 7)
}
function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { start: `${ym}-01`, end: `${ym}-${String(lastDay).padStart(2, '0')}` }
}
// โปร/แคมเปญ "Active ในเดือนนี้" = ช่วงวันที่ของมันซ้อนกับเดือนที่เลือกอย่างน้อย 1 วัน
// (ไม่ใช่ต้องเริ่ม/จบในเดือนนี้พอดี — แคมเปญยาวข้ามเดือนก็ต้องนับด้วย)
function overlapsMonth(startDate, endDate, ym) {
  const { start, end } = monthRange(ym)
  const s = startDate || '0000-01-01'
  const e = endDate || '9999-12-31'
  return s <= end && e >= start
}

export default async function MonthlyCampaignGoalsPage(container) {
  const myGen = container.__routerGen

  let selectedMonth = todayBangkok().slice(0, 7)
  let goal = null
  let promos = []
  let campaigns = []
  let sales = []
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [goals, promoDocs, campDocs, s] = await Promise.all([
        listDocs('monthly_campaign_goals', [['month', '==', selectedMonth]], 'createdAt', 'desc', 1),
        listDocs('promotions', [], 'startDate', 'desc', 200),
        listDocs('marketing_campaigns', [], 'startDate', 'desc', 200),
        getSalesData(),
      ])
      goal = goals.filter(g => !g.deleted)[0] || null
      promos = promoDocs.filter(p => !p.deleted && overlapsMonth(p.startDate, p.endDate, selectedMonth))
      campaigns = campDocs.filter(c => !c.deleted && overlapsMonth(c.startDate, c.endDate, selectedMonth))
      sales = s
    } catch (e) { goal = null; promos = []; campaigns = []; sales = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function monthSales() {
    return sales.filter(s => (s.date || '').slice(0, 7) === selectedMonth)
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const ms = monthSales()
    const actualUnits = ms.length
    const actualRevenue = ms.reduce((a, s) => a + (s.salePrice || 0), 0)
    const unitsTarget = goal?.salesTarget || 0
    const revenueTarget = goal?.revenueTarget || 0
    const unitsPct = unitsTarget > 0 ? Math.round(actualUnits / unitsTarget * 100) : 0
    const revenuePct = revenueTarget > 0 ? Math.round(actualRevenue / revenueTarget * 100) : 0
    const pctColor = pct => pct >= 100 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 เป้าหมาย/เงื่อนไขแคมเปญประจำเดือน</div>
            <div class="page-subtitle">ภาพรวมแคมเปญจากมอเตอร์ + ของบริษัทเอง พร้อมเป้าหมายเดือนที่เลือก</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="prev-month-btn">◀ เดือนก่อน</button>
            <button class="btn btn-secondary btn-xs" id="curr-month-btn">เดือนนี้</button>
            <button class="btn btn-secondary btn-xs" id="next-month-btn">เดือนถัดไป ▶</button>
            <button class="btn btn-primary" id="set-goal-btn">${goal ? '✏️ แก้ไขเป้าหมาย' : '+ ตั้งเป้าหมายเดือนนี้'}</button>
          </div>
        </div>

        <div style="font-size:0.9rem;font-weight:700;margin-bottom:12px">📅 ${monthLabel(selectedMonth)}</div>

        <div class="grid-2" style="gap:14px;margin-bottom:16px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px">🚗 ยอดขาย (คัน)</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
              <span style="font-size:1.4rem;font-weight:900">${actualUnits}</span>
              <span style="font-size:0.8rem;color:var(--text-muted)">เป้า ${unitsTarget || '-'} คัน</span>
            </div>
            ${unitsTarget > 0 ? `<div style="background:var(--surface-2);border-radius:4px;height:8px">
              <div style="width:${Math.min(unitsPct,100)}%;background:${pctColor(unitsPct)};height:8px;border-radius:4px"></div>
            </div><div style="font-size:0.72rem;color:${pctColor(unitsPct)};font-weight:700;margin-top:4px">${unitsPct}%</div>` : ''}
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px">💰 รายได้</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
              <span style="font-size:1.4rem;font-weight:900">${formatCurrency(actualRevenue)}</span>
              <span style="font-size:0.8rem;color:var(--text-muted)">เป้า ${revenueTarget ? formatCurrency(revenueTarget) : '-'}</span>
            </div>
            ${revenueTarget > 0 ? `<div style="background:var(--surface-2);border-radius:4px;height:8px">
              <div style="width:${Math.min(revenuePct,100)}%;background:${pctColor(revenuePct)};height:8px;border-radius:4px"></div>
            </div><div style="font-size:0.72rem;color:${pctColor(revenuePct)};font-weight:700;margin-top:4px">${revenuePct}%</div>` : ''}
          </div>
        </div>

        <div class="card" style="padding:14px 16px;margin-bottom:20px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:6px">📋 เงื่อนไข/รายละเอียดเป้าหมายเดือนนี้</div>
          <div style="font-size:0.85rem;color:var(--text-2);white-space:pre-wrap">${goal?.conditions ? escHtml(goal.conditions) : '<span style="color:var(--text-muted)">ยังไม่มีการตั้งเงื่อนไขไว้</span>'}</div>
        </div>

        <div class="grid-2" style="gap:16px">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
              <span style="font-weight:700;font-size:0.88rem">🏭 แคมเปญจากมอเตอร์ (${promos.length})</span>
              <button class="btn btn-ghost btn-xs" id="view-promos-btn">ดูทั้งหมด →</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${promos.length ? promos.map(p => `
                <div class="card" style="padding:10px 14px">
                  <div style="font-weight:600;font-size:0.82rem">${escHtml(p.title || '-')}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(p.brand || '')} ${escHtml(p.model || '')} · ${escHtml(p.startDate || '')} → ${escHtml(p.endDate || '')}</div>
                </div>
              `).join('') : `<div class="empty-state" style="padding:20px"><div class="empty-title" style="font-size:0.82rem">ไม่มีแคมเปญจากมอเตอร์ในเดือนนี้</div></div>`}
            </div>
          </div>
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
              <span style="font-weight:700;font-size:0.88rem">🏢 แคมเปญของบริษัท (${campaigns.length})</span>
              <button class="btn btn-ghost btn-xs" id="view-campaigns-btn">ดูทั้งหมด →</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${campaigns.length ? campaigns.map(c => `
                <div class="card" style="padding:10px 14px">
                  <div style="font-weight:600;font-size:0.82rem">${escHtml(c.name || '-')}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(c.startDate || '')} → ${escHtml(c.endDate || '')}</div>
                </div>
              `).join('') : `<div class="empty-state" style="padding:20px"><div class="empty-title" style="font-size:0.82rem">ไม่มีแคมเปญของบริษัทในเดือนนี้</div></div>`}
            </div>
          </div>
        </div>
      </div>
    `

    document.getElementById('prev-month-btn')?.addEventListener('click', () => { selectedMonth = shiftMonth(selectedMonth, -1); loadData() })
    document.getElementById('next-month-btn')?.addEventListener('click', () => { selectedMonth = shiftMonth(selectedMonth, 1); loadData() })
    document.getElementById('curr-month-btn')?.addEventListener('click', () => { selectedMonth = todayBangkok().slice(0, 7); loadData() })
    document.getElementById('set-goal-btn')?.addEventListener('click', openGoalForm)
    document.getElementById('view-promos-btn')?.addEventListener('click', () => navigate('/marketing/promotions'))
    document.getElementById('view-campaigns-btn')?.addEventListener('click', () => navigate('/marketing/campaigns'))
  }

  function openGoalForm() {
    openModal({
      title: (goal ? '✏️ แก้ไขเป้าหมาย' : '+ ตั้งเป้าหมาย') + ' — ' + escHtml(monthLabel(selectedMonth)),
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="grid-2" style="gap:10px">
            <div class="input-group"><label class="input-label">เป้าหมายยอดขาย (คัน)</label><input class="input" type="number" id="mg-units" min="0" value="${goal?.salesTarget || ''}"></div>
            <div class="input-group"><label class="input-label">เป้าหมายรายได้ (บาท)</label><input class="input" type="number" id="mg-revenue" min="0" value="${goal?.revenueTarget || ''}"></div>
          </div>
          <div class="input-group"><label class="input-label">เงื่อนไข/รายละเอียดเป้าหมายเดือนนี้</label>
            <textarea class="input" id="mg-conditions" rows="4" placeholder="เช่น เงื่อนไขรับโบนัสพิเศษ เกณฑ์การจัดสรรงบแถม ฯลฯ">${escHtml(goal?.conditions || '')}</textarea>
          </div>
        </div>
      `,
      confirmText: '💾 บันทึก',
      async onConfirm() {
        const salesTarget = Number(document.getElementById('mg-units')?.value) || 0
        const revenueTarget = Number(document.getElementById('mg-revenue')?.value) || 0
        const conditions = document.getElementById('mg-conditions')?.value.trim() || ''
        try {
          if (goal) {
            await updateDocData('monthly_campaign_goals', goal.id, { salesTarget, revenueTarget, conditions })
          } else {
            await createDoc('monthly_campaign_goals', { month: selectedMonth, salesTarget, revenueTarget, conditions })
          }
          showToast('✅ บันทึกเป้าหมายแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      },
    })
  }

  await loadData()
}
