import { formatCurrency, toDateStr } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getSalesData, listDocs } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'

// เป้าหมายอ้างอิงมาตรฐานอุตสาหกรรม — หมวดที่ไม่มี ✅ ยังไม่มีข้อมูลจริงเชื่อมในระบบ (Service/HR/Finance/Marketing)
// แสดงเป็น "เป้าหมายอ้างอิง" เท่านั้น ไม่นับรวมใน Overall Score เพื่อไม่ให้ปนกับหมวดที่มีข้อมูลจริง (Sales/CRM)
const COMPANY_KPIS = {
  sales: {
    label: '💰 ยอดขาย', color: 'success', icon: '💰', hasRealData: true,
    kpis: [
      { key: 'revenue', name: 'ยอดขายรถยนต์', unit: 'บาท', target: 120000000, format: 'currency', lowerIsBetter: false },
      { key: 'units', name: 'จำนวนคันที่ขาย', unit: 'คัน', target: 100, format: 'number', lowerIsBetter: false },
      { key: 'margin', name: 'Gross Margin', unit: '%', target: 15, format: 'percent', lowerIsBetter: false },
      { key: 'convRate', name: 'อัตราส่งมอบ (ส่งมอบ/จอง)', unit: '%', target: 80, format: 'percent', lowerIsBetter: false },
      { key: 'avgDeal', name: 'Avg Deal Size', unit: 'บาท', target: 1100000, format: 'currency', lowerIsBetter: false },
    ]
  },
  crm: {
    label: '👥 CRM', color: 'primary', icon: '👥', hasRealData: true,
    kpis: [
      { key: 'newLeads', name: 'Lead จำนวนใหม่', unit: 'ราย', target: 500, format: 'number', lowerIsBetter: false },
      { key: 'leadConv', name: 'Lead → จองแล้วขึ้นไป', unit: '%', target: 20, format: 'percent', lowerIsBetter: false },
    ]
  },
  service: {
    label: '🔧 บริการ', color: 'warning', icon: '🔧', hasRealData: false,
    kpis: [
      { name: 'รายได้ Service', unit: 'บาท', target: 2000000, format: 'currency' },
      { name: 'จำนวนงานซ่อม', unit: 'งาน', target: 300, format: 'number' },
      { name: 'CSAT Score', unit: '/5', target: 4.5, format: 'decimal' },
      { name: 'Rework Rate', unit: '%', target: 3, format: 'percent' },
      { name: 'Bay Utilization', unit: '%', target: 80, format: 'percent' },
    ]
  },
  hr: {
    label: '👤 HR', color: 'accent', icon: '👤', hasRealData: false,
    kpis: [
      { name: 'อัตราการมาทำงาน', unit: '%', target: 95, format: 'percent' },
      { name: 'Turnover Rate', unit: '%', target: 10, format: 'percent' },
      { name: 'Training Hours/Person', unit: 'ชม.', target: 20, format: 'number' },
      { name: 'Avg KPI Score', unit: '%', target: 80, format: 'percent' },
    ]
  },
  finance: {
    label: '💳 การเงิน', color: 'accent', icon: '💳', hasRealData: false,
    kpis: [
      { name: 'Net Profit Margin', unit: '%', target: 8, format: 'percent' },
      { name: 'ROI', unit: '%', target: 15, format: 'percent' },
      { name: 'Cash Flow Net', unit: 'บาท', target: 5000000, format: 'currency' },
      { name: 'DSO (วันเก็บเงิน)', unit: 'วัน', target: 30, format: 'number' },
    ]
  },
  marketing: {
    label: '📣 การตลาด', color: 'danger', icon: '📣', hasRealData: false,
    kpis: [
      { name: 'Marketing ROI', unit: '%', target: 200, format: 'percent' },
      { name: 'CPL (ต้นทุนต่อ Lead)', unit: 'บาท', target: 500, format: 'currency' },
      { name: 'Social Reach', unit: 'คน', target: 50000, format: 'number' },
      { name: 'Campaign CTR', unit: '%', target: 3, format: 'percent' },
    ]
  }
}

function calcScore(kpi) {
  if (kpi.actual == null) return null
  if (kpi.lowerIsBetter) {
    if (kpi.actual <= kpi.target) return 100
    return Math.max(0, Math.round((kpi.target / kpi.actual) * 100))
  }
  return Math.min(150, Math.round((kpi.actual / kpi.target) * 100))
}

function scoreLabel(s) {
  if (s == null) return { label: 'ไม่มีข้อมูลจริง', color: 'secondary' }
  if (s >= 110) return { label: 'เกินเป้า ⭐', color: 'success' }
  if (s >= 90) return { label: 'บรรลุเป้า ✓', color: 'success' }
  if (s >= 70) return { label: 'ใกล้เป้า', color: 'warning' }
  return { label: 'ต่ำกว่าเป้า', color: 'danger' }
}

function fmtVal(kpi, val) {
  if (val == null) return '—'
  if (kpi.format === 'currency') return formatCurrency(val)
  if (kpi.format === 'percent') return val + '%'
  if (kpi.format === 'decimal') return val.toFixed(1)
  return val.toLocaleString()
}

function quarterRange(period) {
  if (period.startsWith('ทั้งปี')) return [1, 12]
  const q = parseInt((period.match(/Q(\d)/) || [])[1] || '1', 10)
  return [(q - 1) * 3 + 1, q * 3]
}

export default async function CompanyKpiPage(container) {
  const myGen = container.__routerGen
  const YEAR = new Date().getFullYear()
  const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'ทั้งปี'].map(p => `${p} ${YEAR}`)
  const currentQ = Math.floor(new Date().getMonth() / 3) + 1
  let period = `Q${currentQ} ${YEAR}`
  let catFilter = 'all'
  let sales = []
  let customers = []

  try {
    const [s, c] = await Promise.all([getSalesData().catch(() => []), listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => [])])
    if (container.__routerGen !== myGen) return
    sales = s
    // softDelete() ไม่ลบเอกสารจริง แค่ตั้ง deleted:true — กรองออกกันลูกค้าที่ลบไปแล้วปนอยู่ใน KPI
    customers = c.filter(x => !x.deleted)
  } catch {}

  function inRange(dateStr) {
    if (!dateStr) return false
    const [from, to] = quarterRange(period)
    if (dateStr.slice(0, 4) !== String(YEAR)) return false
    const mo = parseInt(dateStr.slice(5, 7), 10)
    return mo >= from && mo <= to
  }

  function computeSalesKpis() {
    const periodSales = sales.filter(s => inRange(s.date))
    const totalRev = periodSales.reduce((a, s) => a + (s.salePrice || 0), 0)
    const totalUnits = periodSales.length
    const avgDeal = totalUnits ? Math.round(totalRev / totalUnits) : null
    const marginsArr = periodSales.filter(s => s.margin > 0)
    const marginPct = totalRev > 0
      ? Math.round(marginsArr.reduce((a, s) => a + (s.margin || 0), 0) / totalRev * 1000) / 10
      : null
    const delivered = periodSales.filter(s => s.delivered).length
    const convRate = totalUnits > 0 ? Math.round(delivered / totalUnits * 1000) / 10 : null
    return { revenue: totalRev || null, units: totalUnits || null, margin: marginPct, convRate, avgDeal }
  }

  function computeCrmKpis() {
    // เดิมใช้ c.createdAt ตรงๆ — createDoc() เขียน createdAt เป็น Firestore serverTimestamp() เสมอ (object
    // ไม่ใช่ string) การเรียก .slice() ตรงๆ จึงพังทั้งหน้าทันทีที่มีลูกค้าจริงสักคน (บั๊กคลาสเดียวกับที่เจอ
    // ใน ErrorLog.js v1.0.404) ใช้ stageChangedAt แทน (string ISO เสมอ ตั้งตอนสร้างทุกครั้งใน Customers.js)
    // ซึ่งยังแม่นยำกว่าด้วย เพราะลูกค้าที่นำเข้าจากไฟล์เก่าจะมี createdAt เป็น "วันนำเข้า" ล้วนๆ ไม่ใช่วันที่
    // เป็นลูกค้าจริงในอดีต ทำให้ KPI รายไตรมาสเพี้ยนถ้าอิง createdAt
    const periodCustomers = customers.filter(c => inRange(toDateStr(c.stageChangedAt || c.createdAt)))
    const newLeads = periodCustomers.length
    const progressed = periodCustomers.filter(c => c.stage === 'booking' || c.stage === 'delivered').length
    const leadConv = newLeads > 0 ? Math.round(progressed / newLeads * 1000) / 10 : null
    return { newLeads: newLeads || null, leadConv }
  }

  function buildKpis() {
    const salesActuals = computeSalesKpis()
    const crmActuals = computeCrmKpis()
    const result = {}
    Object.entries(COMPANY_KPIS).forEach(([cat, info]) => {
      const actuals = cat === 'sales' ? salesActuals : cat === 'crm' ? crmActuals : {}
      result[cat] = { ...info, kpis: info.kpis.map(k => ({ ...k, actual: info.hasRealData ? (actuals[k.key] ?? null) : null })) }
    })
    return result
  }

  function overallScore(kpiData) {
    const realKpis = Object.values(kpiData).filter(c => c.hasRealData).flatMap(c => c.kpis)
    const scored = realKpis.map(calcScore).filter(s => s != null)
    if (!scored.length) return null
    return Math.round(scored.reduce((a, s) => a + s, 0) / scored.length)
  }

  function catScore(cat, kpiData) {
    if (!kpiData[cat].hasRealData) return null
    const scored = kpiData[cat].kpis.map(calcScore).filter(s => s != null)
    if (!scored.length) return null
    return Math.round(scored.reduce((a, s) => a + s, 0) / scored.length)
  }

  function renderPage() {
    const kpiData = buildKpis()
    const overall = overallScore(kpiData)
    const sl = scoreLabel(overall)
    const cats = catFilter === 'all' ? Object.entries(kpiData) : Object.entries(kpiData).filter(([k]) => k === catFilter)
    const realCatCount = Object.values(kpiData).filter(c => c.hasRealData).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Company KPI Dashboard</div>
            <div class="page-subtitle">ภาพรวม KPI ระดับองค์กร — ${realCatCount} จาก ${Object.keys(kpiData).length} หมวดเชื่อมข้อมูลจริงแล้ว (ยอดขาย/CRM) ที่เหลือเป็นเป้าหมายอ้างอิง</div>
          </div>
          <div class="page-actions">
            <select class="input" id="period-sel" style="width:140px">
              ${PERIODS.map(p => `<option value="${p}" ${period===p?'selected':''}>${p}</option>`).join('')}
            </select>
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
          </div>
        </div>

        <!-- Overall Score -->
        <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;margin-bottom:20px;align-items:start">
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Overall Score</div>
            <div style="font-size:3.5rem;font-weight:900;color:${overall==null?'var(--text-muted)':overall>=90?'var(--success)':overall>=70?'var(--warning)':'var(--danger)'};line-height:1">${overall ?? '—'}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${overall==null ? 'ยังไม่มีข้อมูลจริงในช่วงนี้' : '/100 (เฉพาะหมวดข้อมูลจริง)'}</div>
            <div style="margin:10px 0">
              <span class="badge badge-${sl.color} badge-lg">${sl.label}</span>
            </div>
            <div style="position:relative;width:100px;height:100px;margin:10px auto">
              <svg viewBox="0 0 100 100" style="transform:rotate(-90deg);width:100px;height:100px">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface-2)" stroke-width="8"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="${overall==null?'var(--surface-2)':overall>=90?'var(--success)':overall>=70?'var(--warning)':'var(--danger)'}" stroke-width="8"
                  stroke-dasharray="${Math.round((overall||0) * 2.513)} 251.3"
                  stroke-linecap="round"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:900;color:${overall==null?'var(--text-muted)':overall>=90?'var(--success)':overall>=70?'var(--warning)':'var(--danger)'}">${overall!=null ? overall+'%' : '—'}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted)">ช่วง: ${period}</div>
          </div>

          <!-- Category scores -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            ${Object.entries(kpiData).map(([cat, info]) => {
              const score = catScore(cat, kpiData)
              const sl2 = scoreLabel(score)
              return `<div class="card" style="padding:12px;cursor:pointer${catFilter===cat?';border-color:var(--primary)':''}" onclick="document.getElementById('cat-btn-${cat}').click()">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span style="font-size:1rem">${info.icon}</span>
                  <span class="badge badge-${sl2.color}" style="font-size:0.62rem">${score!=null ? score+'%' : 'อ้างอิง'}</span>
                </div>
                <div style="font-size:0.8rem;font-weight:700;margin-bottom:4px">${info.label}</div>
                <div style="height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${Math.min(100,score||0)}%;background:var(--${info.color});border-radius:3px"></div>
                </div>
                <div style="font-size:0.68rem;color:var(--text-muted);margin-top:4px">${info.kpis.length} ตัวชี้วัด${info.hasRealData ? '' : ' (เป้าหมายอ้างอิง)'}</div>
                <button id="cat-btn-${cat}" class="cat-btn" data-c="${cat}" style="display:none"></button>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Filter row -->
        <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
          <button class="btn btn-sm ${catFilter==='all'?'btn-primary':'btn-secondary'} cat-btn" data-c="all">ทุกแผนก</button>
          ${Object.entries(kpiData).map(([k,v]) => `<button class="btn btn-sm ${catFilter===k?'btn-primary':'btn-secondary'} cat-btn" data-c="${k}">${v.icon} ${v.label.replace(/[💰🔧👥👤💳📣]/g,'').trim()}</button>`).join('')}
        </div>

        <!-- KPI detail tables -->
        ${cats.map(([cat, info]) => {
          const score = catScore(cat, kpiData)
          return `<div style="margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:1.1rem">${info.icon}</span>
              <span style="font-weight:800;font-size:0.92rem">${info.label}</span>
              <span class="badge badge-${scoreLabel(score).color}">${score!=null ? score+'% • '+scoreLabel(score).label : 'เป้าหมายอ้างอิง — ยังไม่เชื่อมข้อมูลจริง'}</span>
            </div>
            <div class="card" style="padding:0;overflow:hidden">
              <div class="table-wrap"><table class="table">
                <thead><tr><th>ตัวชี้วัด</th><th class="text-right">เป้าหมาย</th><th class="text-right">${info.hasRealData ? 'ผลจริง' : 'อ้างอิง (ยังไม่มีข้อมูลจริง)'}</th><th class="text-right">% บรรลุ</th><th>แนวโน้ม</th><th>สถานะ</th></tr></thead>
                <tbody>
                  ${info.kpis.map(k => {
                    const kScore = calcScore(k)
                    const kSl = scoreLabel(kScore)
                    const diff = k.actual != null ? k.actual - k.target : null
                    const isGood = diff == null ? null : (k.lowerIsBetter ? diff <= 0 : diff >= 0)
                    const arrow = isGood == null ? '—' : (isGood ? '↑' : '↓')
                    const arrowColor = isGood == null ? 'var(--text-muted)' : (isGood ? 'var(--success)' : 'var(--danger)')
                    return `<tr>
                      <td>
                        <div style="font-weight:600;font-size:0.85rem">${k.name}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted)">${k.unit}</div>
                      </td>
                      <td class="text-right" style="font-size:0.83rem">${fmtVal(k, k.target)}</td>
                      <td class="text-right" style="font-size:0.88rem;font-weight:700;color:${isGood==null?'var(--text-muted)':isGood?'var(--success)':'var(--danger)'}">${fmtVal(k, k.actual)}</td>
                      <td class="text-right">
                        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
                          <div style="width:60px;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${Math.min(100,kScore||0)}%;background:var(--${kSl.color});border-radius:3px"></div>
                          </div>
                          <span style="font-size:0.82rem;font-weight:700;color:var(--${kSl.color})">${kScore!=null ? kScore+'%' : '—'}</span>
                        </div>
                      </td>
                      <td style="font-size:1rem;color:${arrowColor}">${arrow}</td>
                      <td><span class="badge badge-${kSl.color}" style="font-size:0.68rem">${kSl.label}</span></td>
                    </tr>`
                  }).join('')}
                </tbody>
              </table></div>
            </div>
          </div>`
        }).join('')}
      </div>
    `

    document.getElementById('period-sel')?.addEventListener('change', e => { period = e.target.value; renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const rows = []
      Object.entries(kpiData).forEach(([cat, info]) => {
        info.kpis.forEach(k => {
          const kScore = calcScore(k)
          rows.push({ แผนก: info.label, KPI: k.name, หน่วย: k.unit, เป้าหมาย: k.target, [info.hasRealData ? 'ผลจริง' : 'อ้างอิง']: k.actual ?? '-', '%บรรลุ': kScore!=null ? kScore+'%' : '-', สถานะ: scoreLabel(kScore).label })
        })
      })
      exportToExcel(rows, `company_kpi_${period.replace(/\s+/g,'_')}`)
      showToast('📥 Export แล้ว!', 'success')
    })
    document.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
  }

  renderPage()
}
