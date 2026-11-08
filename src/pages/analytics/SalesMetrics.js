// (v1.0.973) ตัวชี้วัดการขายครบชุดในหน้าเดียว — Route: /analytics/sales-metrics
// Target/Quota · Forecast · GP · GMV · RevShare · KPI · Pipeline · Conversion · AOV · Sales Cycle · B2B/B2C/B2G ·
// Cross-sell · Up-sell · CRM · Lead · Prospect · Churn · LTV — ทุกตัวมาจากข้อมูลจริง (utils/salesMetrics.js)
// แตะ ⓘ อ่านความหมาย · "ดูละเอียด" ไปหน้าที่มีอยู่แล้วของเรื่องนั้น (ไม่สร้างหน้าซ้ำ)
import './salesMetrics.css'
import { listDocs } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord } from '../../core/hierarchy.js'
import { todayBangkok, formatCurrency } from '../../utils/format.js'
import { escHtml as esc } from '../../utils/escape.js'
import { navigate } from '../../core/router.js'
import { loadSalesBudget } from '../../utils/salesBudget.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { computeSalesMetrics, METRIC_INFO, normName } from '../../utils/salesMetrics.js'

const PERIODS = { month: 'เดือนนี้', prev: 'เดือนก่อน', quarter: 'ไตรมาสนี้', year: 'ปีนี้' }
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
const baht = n => (n == null ? '—' : formatCurrency(Math.round(n)))
const short = n => {
  if (n == null) return '—'
  const a = Math.abs(n)
  return a >= 1e6 ? '฿' + (n / 1e6).toFixed(a >= 1e8 ? 0 : 2).replace(/\.?0+$/, '') + ' ล้าน' : a >= 1e4 ? '฿' + Math.round(n / 1e3).toLocaleString('en-US') + 'K' : baht(n)
}
const pct = v => (v == null ? '—' : v + '%')

export default async function SalesMetricsPage(container) {
  const myGen = container.__routerGen
  const today = todayBangkok()
  let period = PERIODS[lsGet('sm-period', '')] ? lsGet('sm-period', 'month') : 'month'
  let who = ''
  let src = null
  let names = []

  container.innerHTML = `
    <div class="page-content animate-slide sm">
      <div class="page-header">
        <div>
          <div class="page-title">📐 ตัวชี้วัดการขาย</div>
          <div class="page-subtitle">เป้า · คาดการณ์ · GP · GMV · Pipeline · อัตราปิด · AOV · วงจรขาย · B2B/B2C/B2G · ขายพ่วง/อัปเซล · ลูกค้าหาย · LTV — จากข้อมูลจริงทั้งหมด แตะ ⓘ เพื่ออ่านความหมาย</div>
        </div>
        <div class="page-actions"><button class="btn btn-secondary" id="sm-ask">✨ ให้ LAMI สรุป</button></div>
      </div>
      <div class="sm-bar">
        <div class="sm-seg" role="tablist">${Object.entries(PERIODS).map(([k, l]) => `<button type="button" data-p="${k}">${l}</button>`).join('')}</div>
        <select class="input sm-who" id="sm-who" aria-label="ของใคร" hidden></select>
      </div>
      <div id="sm-body"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังรวบรวมตัวเลข...</div></div></div>
    </div>`
  const $ = s => container.querySelector(s)
  const alive = () => container.__routerGen === myGen && container.isConnected

  const cs = companyScopeFilters()
  const [scope, bookings, customers, testDrives, quotations, jobCards, budget] = await Promise.all([
    getVisibilityScope().catch(() => null),
    listDocs('bookings', cs, 'createdAt', 'desc', 3000).catch(() => []),
    listDocs('customers', cs, 'createdAt', 'desc', 3000).catch(() => []),
    listDocs('test_drives', cs, 'date', 'desc', 1500).catch(() => []),
    listDocs('quotations', cs, 'createdAt', 'desc', 1500).catch(() => []),
    listDocs('job_cards', cs, 'createdAt', 'desc', 3000).catch(() => []),
    loadSalesBudget(+today.slice(0, 4)),
  ])
  if (!alive()) return
  const vis = (owner, rec) => scopeIncludesRecord(scope, owner, rec)
  src = {
    bookings: bookings.filter(b => vis(b.salesName, b)),
    customers: customers.filter(c => vis(c.assignedTo, c)),
    testDrives: testDrives.filter(x => vis(x.staff, x)),
    quotations: quotations.filter(q => vis(q.salesName || q.salesperson, q)),
    jobCards, budget, vehicles: getVehicles(),
  }
  const nm = new Map()
  src.bookings.forEach(b => { const k = normName(b.salesName); if (k && !nm.has(k)) nm.set(k, String(b.salesName).trim()) })
  src.customers.forEach(c => { const k = normName(c.assignedTo); if (k && !nm.has(k)) nm.set(k, String(c.assignedTo).trim()) })
  names = [...nm.entries()].sort((a, b) => a[1].localeCompare(b[1], 'th'))
  const sel = $('#sm-who')
  sel.hidden = names.length < 2
  sel.innerHTML = '<option value="">👥 ทั้งทีม</option>' + names.map(([k, n]) => `<option value="${esc(k)}">👤 ${esc(n)}</option>`).join('')

  function info(key) {
    const [en, th, desc] = METRIC_INFO[key]
    return `<button type="button" class="sm-i" data-info="${key}" aria-label="ความหมาย ${esc(en)}">ⓘ</button><div class="sm-desc" data-desc="${key}" hidden><b>${esc(en)} (${esc(th)})</b> ${esc(desc)}</div>`
  }
  function head(key) { const [en, th] = METRIC_INFO[key]; return `<div class="sm-th"><span><b>${esc(en)}</b> ${esc(th)}</span>${info(key)}</div>` }
  const link = (path, label = 'ดูละเอียด') => `<button type="button" class="sm-link" data-nav="${path}">${label} ›</button>`
  const bar = (p, cls = '') => p == null ? '' : `<div class="sm-prog ${cls}"><i style="width:${Math.max(2, Math.min(100, p))}%" class="${p >= 100 ? 'ok' : p >= 70 ? 'mid' : ''}"></i></div>`

  function render() {
    container.querySelectorAll('.sm-seg [data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === period))
    const m = computeSalesMetrics(src, { today, period, who })
    const p = m.pipeline
    const pTotal = p.lead + p.prospect + p.booking + p.delivered || 1
    const mixTotal = m.mix.B2B.n + m.mix.B2C.n + m.mix.B2G.n
    const empty = !src.bookings.length && !src.customers.length
    $('#sm-body').innerHTML = empty ? `<div class="empty-state"><div class="empty-icon">📐</div><div class="empty-title">ยังไม่มีใบจองหรือลูกค้าในระบบ</div><div class="empty-desc">พอมีข้อมูลจากหน้าลูกค้า/จองรถ ตัวชี้วัดจะขึ้นเองทั้งหมด</div></div>` : `
      <div class="sm-sec"><div class="sm-sh">🎯 เป้า & คาดการณ์</div><div class="sm-grid">
        <div class="sm-card">${head('target')}
          ${m.target.units || m.target.revenue ? `
            <div class="sm-v">${m.units.booked}<small> / ${m.target.units ?? '—'} คัน</small></div>${bar(m.target.unitsPct)}
            <div class="sm-s">ยอดจอง ${short(m.gmv)} จากเป้า ${short(m.target.revenue)} (${pct(m.target.revenuePct)})</div>`
            : `<div class="sm-v sm-muted">${who ? 'เป้ารายคนยังไม่มี' : 'ยังไม่ได้ตั้งเป้า'}</div><div class="sm-s">${who ? 'ดูเป้ารวมได้ที่ “ทั้งทีม”' : 'ตั้งเป้ารายเดือนครั้งเดียว ใช้ได้ทั้งปี'}</div>`}
          ${link('/finance/sales-budget', who ? 'หน้าเป้ายอดขาย' : 'ตั้ง/แก้เป้า')}</div>
        <div class="sm-card">${head('forecast')}
          ${m.forecast ? `<div class="sm-v">${m.forecast.units}<small> คัน · ${short(m.forecast.revenue)}</small></div>
            <div class="sm-s">ผ่านไป ${m.forecast.daysPassed}/${m.forecast.daysInMonth} วัน · จังหวะตอนนี้ ~${m.forecast.pace} คัน · ดีลที่คุยอยู่คิดเป็น ~${m.forecast.pipelineUnits} คัน</div>
            ${m.target.units ? bar(Math.round(m.forecast.units / m.target.units * 100)) + `<div class="sm-s">${m.forecast.units >= m.target.units ? '✅ คาดว่าถึงเป้า' : `⚠️ คาดว่าขาดเป้า ${m.target.units - m.forecast.units} คัน`}</div>` : ''}`
            : '<div class="sm-v sm-muted">ดูได้เฉพาะ “เดือนนี้”</div>'}
          ${link('/analytics/forecast')}</div>
      </div></div>

      <div class="sm-sec"><div class="sm-sh">💰 ยอดขาย & กำไร</div><div class="sm-grid">
        <div class="sm-card">${head('gmv')}<div class="sm-v">${short(m.gmv)}</div><div class="sm-s">${m.units.booked} ใบจอง${m.units.cancelled ? ` · ถอนจอง ${m.units.cancelled}` : ''}</div></div>
        <div class="sm-card">${head('aov')}<div class="sm-v">${short(m.aov)}</div><div class="sm-s">ต่อใบจองในช่วงนี้</div></div>
        <div class="sm-card">${head('gp')}<div class="sm-v">${pct(m.grossProfit.pct)}<small> ${short(m.grossProfit.value)}</small></div>
          <div class="sm-s">จากรถส่งมอบ/ตัดตัวเลข ${m.grossProfit.units} คัน${m.grossProfit.estimated ? ` · ${m.grossProfit.estimated} คันยังไม่กรอกต้นทุน ใช้ประมาณ 82%` : ''}</div>${link('/finance/margin')}</div>
        <div class="sm-card">${head('revshare')}<div class="sm-v">${short(m.revShare.total)}</div><div class="sm-s">คอมไฟแนนซ์ ${short(m.revShare.finance)}${m.revShare.insurance ? ` · คอมประกัน ${short(m.revShare.insurance)}` : ''}${m.revShare.perUnit ? ` · เฉลี่ย ${short(m.revShare.perUnit)}/คัน` : ''}</div></div>
      </div></div>

      <div class="sm-sec"><div class="sm-sh">📋 ไปป์ไลน์ & การปิดการขาย</div>
        <div class="sm-card sm-wide">${head('pipeline')}
          <div class="sm-pipe">${[['Lead', p.lead, 'l'], ['Prospect', p.prospect, 'p'], ['จองแล้ว รอส่ง', p.booking, 'b'], ['ส่งมอบ (ช่วงนี้)', p.delivered, 'd']].map(([l, n, c]) => `<div class="sm-pipe-s s-${c}" style="flex:${Math.max(n / pTotal, 0.08)}"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
          <div class="sm-s">เสียดีลสะสม ${p.lost} ราย</div>${link('/crm/pipeline')}</div>
        <div class="sm-grid">
          <div class="sm-card">${head('conversion')}<div class="sm-v">${pct(m.conversion.pct)}</div><div class="sm-s">ลูกค้าใหม่ ${m.conversion.leads} ราย จองแล้ว ${m.conversion.won}${m.conversion.cancelPct ? ` · ถอนจอง ${m.conversion.cancelPct}%` : ''}</div></div>
          <div class="sm-card">${head('cycle')}<div class="sm-v">${m.salesCycle.avg ?? '—'}<small> วัน</small></div><div class="sm-s">${m.salesCycle.n ? `ค่ากลาง ${m.salesCycle.median} วัน · จาก ${m.salesCycle.n} ใบจองที่ผูกลูกค้า` : 'ใบจองยังไม่ได้ผูกกับลูกค้าในระบบ'}</div></div>
          <div class="sm-card">${head('lead')}<div class="sm-v">${m.lead.total}</div><div class="sm-s">ใหม่ในช่วงนี้ ${m.lead.new} ราย</div>${link('/crm/customers', 'ไปหน้าลูกค้า')}</div>
          <div class="sm-card">${head('prospect')}<div class="sm-v">${m.prospect.total}</div><div class="sm-s">🔥 สนใจมาก ${m.prospect.hot} ราย</div></div>
        </div></div>

      <div class="sm-sec"><div class="sm-sh">🧭 ประเภทผู้ซื้อ & กลยุทธ์ขาย</div><div class="sm-grid">
        <div class="sm-card">${head('mix')}
          ${mixTotal ? `<div class="sm-mix">${['B2C', 'B2B', 'B2G'].filter(k => m.mix[k].n).map(k => `<i class="m-${k}" style="flex:${m.mix[k].n}" title="${k} ${m.mix[k].n}"></i>`).join('')}</div>
          <div class="sm-s">${['B2C', 'B2B', 'B2G'].map(k => `<span class="sm-dot m-${k}"></span>${k} ${m.mix[k].n} คัน (${Math.round(m.mix[k].n / mixTotal * 100)}%) ${short(m.mix[k].value)}`).join('<br>')}</div>` : '<div class="sm-v sm-muted">—</div>'}
          ${link('/crm/fleet', 'ลูกค้าองค์กร')}</div>
        <div class="sm-card">${head('cross')}<div class="sm-v">${pct(m.crossSell.pct)}</div><div class="sm-s">${m.crossSell.n} ใบจองขายพ่วงประกัน/อุปกรณ์${m.crossSell.value ? ` · ${short(m.crossSell.value)}` : ''}</div></div>
        <div class="sm-card">${head('up')}<div class="sm-v">${pct(m.upSell.pct)}</div><div class="sm-s">${m.upSell.checked ? `${m.upSell.n} จาก ${m.upSell.checked} คันที่เทียบราคารุ่นเริ่มต้นได้` : 'ยังเทียบราคารุ่นเริ่มต้นไม่ได้'}</div></div>
      </div></div>

      <div class="sm-sec"><div class="sm-sh">👥 ลูกค้า</div><div class="sm-grid">
        <div class="sm-card">${head('crm')}<div class="sm-v">${m.crm.total.toLocaleString('en-US')}</div><div class="sm-s">มีเบอร์/LINE ${m.crm.contactable} · คุยใน 30 วัน ${m.crm.touched30} (${pct(m.crm.touchedPct)})</div></div>
        <div class="sm-card">${head('churn')}<div class="sm-v">${m.churn.noServiceData ? '<span class="sm-muted">—</span>' : pct(m.churn.pct)}</div><div class="sm-s">${m.churn.noServiceData ? 'ยังไม่มีข้อมูลงานศูนย์บริการ' : `${m.churn.lost} จาก ${m.churn.cohort} คันที่รับรถ 6–24 เดือนก่อน ไม่กลับมาเข้าศูนย์ 12 เดือน`}</div>${link('/crm/churn')}</div>
        <div class="sm-card">${head('ltv')}<div class="sm-v">${short(m.ltv.avg)}</div><div class="sm-s">${m.ltv.buyers} ลูกค้าที่ซื้อแล้ว${m.ltv.repeat ? ` · ซื้อซ้ำ ${m.ltv.repeat} คัน` : ''}${m.ltv.serviceRevenue ? ` · งานศูนย์ ${short(m.ltv.serviceRevenue)}` : ''}</div>${link('/crm/clv')}</div>
      </div></div>

      <div class="sm-sec"><div class="sm-sh">🏅 ${esc(METRIC_INFO.kpi[0])} รายเซลส์ — ${esc(PERIODS[period])} ${info('kpi')}</div>
        ${m.kpi.length ? `<div class="sm-kpi">${m.kpi.slice(0, 30).map((k, i) => `<div class="sm-kpi-r">
          <div class="sm-kpi-n"><span>${i + 1}</span>${esc(k.name)}</div>
          <div class="sm-kpi-c"><b>${k.leads}</b><small>Lead ใหม่</small></div>
          <div class="sm-kpi-c"><b>${k.testDrives}</b><small>ทดลองขับ</small></div>
          <div class="sm-kpi-c"><b>${k.quotes}</b><small>ใบเสนอ</small></div>
          <div class="sm-kpi-c"><b>${k.bookings}</b><small>จอง</small></div>
          <div class="sm-kpi-c"><b>${k.delivered}</b><small>ส่งมอบ</small></div>
          <div class="sm-kpi-c"><b>${k.closeRate == null ? '—' : k.closeRate + '%'}</b><small>ปิดได้</small></div>
        </div>`).join('')}</div>` : '<div class="sm-s">ยังไม่มีกิจกรรมในช่วงนี้</div>'}
      </div>`
  }

  // ── เหตุการณ์ ──
  container.querySelector('.sm-seg').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { period = b.dataset.p; lsSet('sm-period', period); render() } })
  sel.addEventListener('change', () => { who = sel.value; render() })
  $('#sm-body').addEventListener('click', e => {
    const i = e.target.closest('[data-info]')
    if (i) { const d = container.querySelector(`[data-desc="${i.dataset.info}"]`); if (d) d.hidden = !d.hidden; return }
    const n = e.target.closest('[data-nav]'); if (n) navigate(n.dataset.nav)
  })
  container.querySelector('.sm').addEventListener('click', e => {
    if (e.target.closest('#sm-body')) return
    const i = e.target.closest('[data-info]')
    if (i) { const d = container.querySelector(`[data-desc="${i.dataset.info}"]`); if (d) d.hidden = !d.hidden }
  })
  $('#sm-ask').addEventListener('click', () => {
    const m = computeSalesMetrics(src, { today, period, who })
    const q = `สรุปตัวชี้วัดการขาย${PERIODS[period]}${who ? ' ของ ' + (names.find(x => x[0] === who)?.[1] || '') : ''} ให้หน่อย: จอง ${m.units.booked} คัน เป้า ${m.target.units ?? '-'} คัน, GMV ${Math.round(m.gmv)}, AOV ${m.aov ?? '-'}, GP ${m.grossProfit.pct ?? '-'}%, อัตราปิด ${m.conversion.pct ?? '-'}%, วงจรขาย ${m.salesCycle.avg ?? '-'} วัน, Lead ${m.lead.total} Prospect ${m.prospect.total}, ขายพ่วง ${m.crossSell.pct ?? '-'}%, อัปเซล ${m.upSell.pct ?? '-'}%, ลูกค้าหาย ${m.churn.pct ?? '-'}% — จุดไหนดี จุดไหนต้องแก้ และควรทำอะไร 3 ข้อสัปดาห์นี้`
    navigate('/ai/ask?q=' + encodeURIComponent(q))
  })
  render()
}
