import { formatCurrency, formatDate } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'
import { getSalesData, getCommissionData } from '../../core/db.js'

const REPORT_CATEGORIES = {
  sales:    { label: '💰 ยอดขาย', icon: '💰', color: 'success' },
  service:  { label: '🔧 บริการ', icon: '🔧', color: 'warning' },
  crm:      { label: '👥 CRM', icon: '👥', color: 'primary' },
  hr:       { label: '👤 HR', icon: '👤', color: 'accent' },
  finance:  { label: '💳 การเงิน', icon: '💳', color: 'accent' },
  marketing:{ label: '📣 การตลาด', icon: '📣', color: 'danger' },
}

const REPORT_TEMPLATES = [
  { id:'R001', cat:'sales', name:'รายงานยอดขายรายเดือน', desc:'สรุปยอดขาย จำนวนคัน กำไร Commission แต่ละเดือน', fields:['เดือน','จำนวนคัน','ยอดขาย','ต้นทุน','กำไรรวม','Margin%'] },
  { id:'R002', cat:'sales', name:'รายงาน Salesperson Performance', desc:'เปรียบเทียบผลงานเซลส์แต่ละคน', fields:['เซลส์','จำนวนคัน','ยอดขาย','Commission','Conversion Rate'] },
  { id:'R003', cat:'crm', name:'รายงาน Lead Conversion', desc:'Lead → Booking → Sale funnel', fields:['Lead','Pipeline','Booking','ปิดการขาย','อัตราแปลง%'] },
  { id:'R004', cat:'service', name:'รายงานงานซ่อมประจำเดือน', desc:'จำนวนงาน รายได้ Rework Rate', fields:['เดือน','จำนวนงาน','รายได้','Rework%','CSAT'] },
  { id:'R005', cat:'finance', name:'รายงานกระแสเงินสด', desc:'Cash In / Out ประจำเดือน', fields:['เดือน','รายรับ','รายจ่าย','Net Cash','ยอดคงเหลือ'] },
  { id:'R006', cat:'hr', name:'รายงานการมาทำงาน', desc:'สรุปการมา-ขาด-สาย ของพนักงาน', fields:['พนักงาน','มา','ขาด','สาย','อัตรา%'] },
  { id:'R007', cat:'marketing', name:'รายงาน Campaign ROI', desc:'ประสิทธิภาพแต่ละแคมเปญ', fields:['แคมเปญ','งบ','ใช้ไป','Leads','Sales','ROI%'] },
  { id:'R008', cat:'sales', name:'รายงาน Lost Deal', desc:'วิเคราะห์ดีลที่เสียไป', fields:['วันที่','ลูกค้า','รุ่น','สาเหตุ','มูลค่า'] },
]

// Demo data for each report
const REPORT_DATA = {
  R001: [
    { เดือน:'ม.ค.', จำนวนคัน:8, ยอดขาย:9200000, ต้นทุน:7800000, กำไรรวม:1400000, 'Margin%':'15.2%' },
    { เดือน:'ก.พ.', จำนวนคัน:6, ยอดขาย:6800000, ต้นทุน:5900000, กำไรรวม:900000, 'Margin%':'13.2%' },
    { เดือน:'มี.ค.', จำนวนคัน:11, ยอดขาย:13100000, ต้นทุน:11000000, กำไรรวม:2100000, 'Margin%':'16.0%' },
    { เดือน:'เม.ย.', จำนวนคัน:9, ยอดขาย:10200000, ต้นทุน:8600000, กำไรรวม:1600000, 'Margin%':'15.7%' },
    { เดือน:'พ.ค.', จำนวนคัน:13, ยอดขาย:15400000, ต้นทุน:12800000, กำไรรวม:2600000, 'Margin%':'16.9%' },
    { เดือน:'มิ.ย.', จำนวนคัน:7, ยอดขาย:8300000, ต้นทุน:7000000, กำไรรวม:1300000, 'Margin%':'15.7%' },
  ],
  R002: [
    { เซลส์:'วิชาญ มีโชค', จำนวนคัน:28, ยอดขาย:32000000, Commission:320000, 'Conversion Rate':'32%' },
    { เซลส์:'อรนุช สายใจ', จำนวนคัน:26, ยอดขาย:29500000, Commission:295000, 'Conversion Rate':'28%' },
  ],
  R003: [
    { Lead:180, Pipeline:95, Booking:54, ปิดการขาย:54, 'อัตราแปลง%':'30%' },
  ],
  R004: [
    { เดือน:'มิ.ย.', จำนวนงาน:42, รายได้:324000, 'Rework%':'2.4%', CSAT:'4.6' },
  ],
  R005: [
    { เดือน:'มิ.ย.', รายรับ:2558000, รายจ่าย:1334250, 'Net Cash':1223750, ยอดคงเหลือ:2073750 },
  ],
  R006: [
    { พนักงาน:'วิชาญ มีโชค', มา:22, ขาด:0, สาย:1, 'อัตรา%':'95%' },
    { พนักงาน:'อรนุช สายใจ', มา:21, ขาด:1, สาย:2, 'อัตรา%':'91%' },
    { พนักงาน:'ธีรยุทธ เก่งกาจ', มา:22, ขาด:0, สาย:0, 'อัตรา%':'100%' },
  ],
  R007: [
    { แคมเปญ:'BYD Seal Launch', งบ:50000, ใช้ไป:32000, Leads:87, Sales:5, 'ROI%':'212%' },
    { แคมเปญ:'Motor Expo', งบ:200000, ใช้ไป:185000, Leads:245, Sales:18, 'ROI%':'95%' },
  ],
  R008: [
    { วันที่:'2025-06-05', ลูกค้า:'มานะ ลองดู', รุ่น:'BYD Seal AWD', สาเหตุ:'ราคาแพงเกิน', มูลค่า:1200000 },
    { วันที่:'2025-06-07', ลูกค้า:'อนุชา รวยมาก', รุ่น:'MG ZS EV', สาเหตุ:'ราคาแพงเกิน', มูลค่า:800000 },
  ],
}

export default async function ReportCenterPage(container) {
  const myGen = container.__routerGen
  let catFilter = 'all'
  let activeReport = null
  let dateFrom = '2025-01-01'
  let dateTo = new Date().toISOString().slice(0, 10)

  // Live report data — start with demo, overlay real data when available
  const reportData = JSON.parse(JSON.stringify(REPORT_DATA))
  let liveR001 = false, liveR002 = false

  try {
    const [sales, coms] = await Promise.all([
      getSalesData().catch(() => []),
      getCommissionData().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

    if (sales.length >= 2) {
      const byMonth = {}
      sales.forEach(s => {
        const mo = parseInt((s.date || '').slice(5, 7)) - 1
        if (isNaN(mo) || mo < 0 || mo > 11) return
        if (!byMonth[mo]) byMonth[mo] = { เดือน: MONTHS_TH[mo], จำนวนคัน: 0, ยอดขาย: 0, ต้นทุน: 0, กำไรรวม: 0 }
        byMonth[mo].จำนวนคัน++
        byMonth[mo].ยอดขาย += s.salePrice || 0
        byMonth[mo].ต้นทุน += Math.round((s.salePrice || 0) * 0.82)
      })
      const r001 = Object.keys(byMonth).sort((a, b) => +a - +b).map(k => {
        const m = byMonth[k]
        m.กำไรรวม = m.ยอดขาย - m.ต้นทุน
        m['Margin%'] = m.ยอดขาย ? (m.กำไรรวม / m.ยอดขาย * 100).toFixed(1) + '%' : '0%'
        return m
      })
      if (r001.length) { reportData.R001 = r001; liveR001 = true }
    }

    if (coms.length) {
      const byName = {}
      coms.forEach(c => {
        if (!c.salesName) return
        if (!byName[c.salesName]) byName[c.salesName] = { เซลส์: c.salesName, จำนวนคัน: 0, ยอดขาย: 0, Commission: 0, 'Conversion Rate': '-' }
        byName[c.salesName].จำนวนคัน += c.carsSold || 0
        byName[c.salesName].ยอดขาย += c.incomeTotal || 0
        byName[c.salesName].Commission += c.commissionTotal || Math.round((c.incomeTotal || 0) * 0.01)
      })
      const r002 = Object.values(byName).sort((a, b) => b.จำนวนคัน - a.จำนวนคัน)
      if (r002.length) { reportData.R002 = r002; liveR002 = true }
    }
  } catch {}

  function getFiltered() {
    if (catFilter === 'all') return REPORT_TEMPLATES
    return REPORT_TEMPLATES.filter(r => r.cat === catFilter)
  }

  function renderPage() {
    const filtered = getFiltered()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Report Center</div>
            <div class="page-subtitle">สร้างและ Export รายงาน</div>
          </div>
          <div class="page-actions">
            ${activeReport ? `<button class="btn btn-secondary" id="back-btn">← กลับ</button><button class="btn btn-primary" id="export-report-btn">📥 Export Excel</button>` : ''}
          </div>
        </div>

        ${activeReport ? renderReportView() : renderReportList(filtered)}
      </div>
    `

    document.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    document.querySelectorAll('.open-report-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeReport = REPORT_TEMPLATES.find(r => r.id === btn.dataset.id); renderPage() })
    })
    document.getElementById('back-btn')?.addEventListener('click', () => { activeReport = null; renderPage() })
    document.getElementById('export-report-btn')?.addEventListener('click', () => {
      const data = reportData[activeReport.id] || []
      if (!data.length) return showToast('❗ ไม่มีข้อมูล', 'warning')
      exportToExcel(data, activeReport.name)
      showToast('📥 Export แล้ว!', 'success')
    })
    document.getElementById('date-from')?.addEventListener('change', e => { dateFrom = e.target.value; renderPage() })
    document.getElementById('date-to')?.addEventListener('change', e => { dateTo = e.target.value; renderPage() })
  }

  function renderReportList(filtered) {
    return `
      <!-- Category filter -->
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">
        <button class="btn btn-sm ${catFilter==='all'?'btn-primary':'btn-secondary'} cat-btn" data-c="all">ทั้งหมด</button>
        ${Object.entries(REPORT_CATEGORIES).map(([k,v]) => `<button class="btn btn-sm ${catFilter===k?'btn-primary':'btn-secondary'} cat-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
      </div>

      <!-- Report cards grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${filtered.map(r => {
          const cat = REPORT_CATEGORIES[r.cat]
          return `<div class="card" style="padding:16px">
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
              <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:var(--${cat.color}-dim);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${cat.icon}</div>
              <div>
                <div style="font-weight:700;font-size:0.88rem">${r.name}</div>
                <span class="badge badge-${cat.color}" style="font-size:0.62rem">${cat.label}</span>
              </div>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;line-height:1.4">${r.desc}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">Fields: ${r.fields.join(' · ')}</div>
            <button class="btn btn-sm btn-primary open-report-btn" data-id="${r.id}" style="width:100%">📊 ดูรายงาน</button>
          </div>`
        }).join('')}
      </div>
    `
  }

  function renderReportView() {
    const r = activeReport
    const cat = REPORT_CATEGORIES[r.cat]
    const data = reportData[r.id] || []
    const isLive = (r.id === 'R001' && liveR001) || (r.id === 'R002' && liveR002)

    return `
      <div>
        <!-- Report header -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md)">
          <div style="font-size:1.5rem">${cat.icon}</div>
          <div>
            <div style="font-weight:700;font-size:1rem">${r.name}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${r.desc}
              ${isLive ? ' <span style="color:var(--success);font-size:0.7rem">● ข้อมูลจริง</span>' : ''}
            </div>
          </div>
          <!-- Date range -->
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
            <input type="date" class="input" id="date-from" value="${dateFrom}" style="width:140px">
            <span style="font-size:0.82rem;color:var(--text-muted)">ถึง</span>
            <input type="date" class="input" id="date-to" value="${dateTo}" style="width:140px">
          </div>
        </div>

        <!-- Summary KPIs (based on data) -->
        ${data.length > 0 ? renderReportKpis(r, data, isLive) : ''}

        <!-- Data table -->
        <div class="card" style="padding:0;overflow:hidden;overflow-x:auto">
          <table class="table">
            <thead>
              <tr>${r.fields.map(f => `<th>${f}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${data.map(row => `<tr>${r.fields.map(f => {
                const val = row[f]
                const isNum = typeof val === 'number' && val > 999
                return `<td class="${isNum?'text-right':''}" style="font-size:0.83rem">${isNum ? formatCurrency(val) : (val ?? '-')}</td>`
              }).join('')}</tr>`).join('')}
              ${!data.length ? `<tr><td colspan="${r.fields.length}" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <!-- Bar chart (simple HTML) -->
        ${data.length > 0 ? renderSimpleChart(r, data) : ''}
      </div>
    `
  }

  function renderReportKpis(r, data, isLive) {
    if (r.id === 'R001') {
      const totSales = data.reduce((a, d) => a + (d.ยอดขาย || 0), 0)
      const totUnits = data.reduce((a, d) => a + (d.จำนวนคัน || 0), 0)
      const totProfit = data.reduce((a, d) => a + (d.กำไรรวม || 0), 0)
      const avgMargin = totSales ? (totProfit / totSales * 100).toFixed(1) : '0.0'
      return `<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
        ${kpi('🚗 รวมคัน', totUnits + (isLive ? ' ●' : ''), 'primary')}
        ${kpi('💰 ยอดขายรวม', formatCurrency(totSales), 'success')}
        ${kpi('📊 กำไรรวม', formatCurrency(totProfit), 'success')}
        ${kpi('📈 Avg Margin', avgMargin + '%', 'primary')}
      </div>`
    }
    if (r.id === 'R002') {
      const totUnits = data.reduce((a, d) => a + (d.จำนวนคัน || 0), 0)
      const totSales = data.reduce((a, d) => a + (d.ยอดขาย || 0), 0)
      const totCom = data.reduce((a, d) => a + (d.Commission || 0), 0)
      return `<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
        ${kpi('🚗 รวมคัน', totUnits + (isLive ? ' ●' : ''), 'primary')}
        ${kpi('💰 ยอดขายรวม', formatCurrency(totSales), 'success')}
        ${kpi('🎯 Commission รวม', formatCurrency(totCom), 'warning')}
      </div>`
    }
    return ''
  }

  function renderSimpleChart(r, data) {
    if (!['R001'].includes(r.id)) return ''
    const maxVal = Math.max(...data.map(d => d.ยอดขาย || 0))
    return `
      <div class="card" style="padding:16px;margin-top:12px">
        <div style="font-weight:700;margin-bottom:12px">📊 Bar Chart — ยอดขายรายเดือน</div>
        <div style="display:flex;align-items:flex-end;gap:6px;height:120px;border-bottom:1px solid var(--border);padding-bottom:8px">
          ${data.map(d => {
            const h = Math.max(4, Math.round((d.ยอดขาย||0) / maxVal * 100))
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
              <div style="font-size:0.58rem;color:var(--text-muted)">${((d.ยอดขาย||0)/1000000).toFixed(1)}M</div>
              <div style="width:100%;height:${h}px;background:var(--primary);border-radius:3px 3px 0 0;opacity:0.8"></div>
            </div>`
          }).join('')}
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          ${data.map(d => `<div style="flex:1;text-align:center;font-size:0.65rem;color:var(--text-muted)">${d.เดือน||''}</div>`).join('')}
        </div>
      </div>
    `
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
