/**
 * Custom Report Builder — สร้าง Report เองแบบ Drag & Drop
 * Route: /analytics/report-builder
 */
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, getSalesData } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { companyScopeFilters } from '../../core/companyScope.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const SALARY_VIEW_ROLES = ['owner', 'admin', 'manager', 'hr']
const STAGE_LABEL = { lead: '🧲 Lead', pp: '📇 Prospect', booking: '📝 จองแล้ว', delivered: '✅ ส่งมอบแล้ว' }
const ROLE_LABEL = { owner:'เจ้าของ', admin:'แอดมิน', manager:'ผู้จัดการ', sales:'เซลส์', service:'ช่าง/บริการ', staff:'พนักงาน' }
const NA = 'N/A (ไม่มีข้อมูลจริงในระบบ)'

const FIELD_GROUPS = [
  { group:'CRM', fields:['ชื่อลูกค้า','รุ่นที่สนใจ','สถานะดีล','วันที่ติดต่อ','พนักงานขาย','แหล่งที่มา Lead'] },
  { group:'ยอดขาย', fields:['ยอดขาย (คัน)','รายได้','กำไร Gross','Margin %','ค่าคอม','ส่วนลด'] },
  { group:'บริการ', fields:['จำนวนงาน','ชั่วโมงซ่อม','อะไหล่ที่ใช้','ค่าแรง','NPS Score'] },
  { group:'HR', fields:['พนักงาน','แผนก','ตำแหน่ง','KPI','เงินเดือน','วันลา'] },
]

const PRESETS = [
  { name:'Sales Performance รายเดือน', fields:['พนักงานขาย','ยอดขาย (คัน)','รายได้','กำไร Gross','Margin %'], chart:'bar' },
  { name:'Lead Funnel Analysis', fields:['แหล่งที่มา Lead','สถานะดีล','พนักงานขาย','ยอดขาย (คัน)'], chart:'funnel' },
  { name:'Service KPI รายช่าง', fields:['พนักงาน','จำนวนงาน','ชั่วโมงซ่อม','NPS Score'], chart:'table' },
  { name:'P&L รายรุ่น', fields:['รุ่นที่สนใจ','ยอดขาย (คัน)','รายได้','กำไร Gross','Margin %'], chart:'bar' },
]

const CHART_TYPES = [
  { key:'bar', icon:'📊', label:'Bar Chart' },
  { key:'line', icon:'📈', label:'Line Chart' },
  { key:'pie', icon:'🥧', label:'Pie Chart' },
  { key:'table', icon:'📋', label:'Table' },
  { key:'funnel', icon:'🔻', label:'Funnel' },
]

export default async function ReportBuilderPage(container) {
  const myGen = container.__routerGen
  let selectedFields = ['พนักงานขาย','ยอดขาย (คัน)','รายได้','Margin %']
  let chartType = 'bar'
  let reportName = 'My Custom Report'
  let lastRun = null
  let isRunning = false
  let currentReportId = null
  let savedReports = []
  let loading = true
  let reportRows = null // ผลลัพธ์จริงหลังกด Run — null = ยังไม่ Run

  const myRole = getState('role') || getState('user')?.role || 'staff'
  const canViewSalary = SALARY_VIEW_ROLES.includes(myRole)

  async function loadData() {
    loading = true
    try { savedReports = await listDocs('custom_reports', [], 'savedAt', 'desc', 100) } catch (e) { savedReports = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function fieldChip(f, selected) {
    return '<span class="field-chip'+(selected?' chip-selected':'')+'" data-f="'+f+'" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:4px 10px;border-radius:8px;cursor:pointer;margin:3px;background:'+(selected?'var(--primary)':'var(--surface-2)')+';color:'+(selected?'#fff':'var(--text)')+';border:1px solid '+(selected?'var(--primary)':'var(--border)')+'">' +
      f + (selected?'<span style="font-size:0.8rem;margin-left:2px">×</span>':'') +
    '</span>'
  }

  // (v1.0.329) เดิม "Run Report" โชว์ตารางปลอมชุดเดียวกันเสมอ (กิตติ/ปิยะ/สมพงษ์ + ตัวเลขตายตัว) ไม่สนใจ
  // เลยว่าเลือก field อะไรไว้ (แค่ใส่ field name ไปเป็น header แต่ค่าในตารางเป็นเลขปลอมชุดเดิมทุกครั้ง) —
  // แก้ให้คำนวณจากข้อมูลจริงตาม field ที่เลือกจริง โดยยึดกลุ่ม field ที่เลือกมากที่สุดเป็น "หน่วยของแถว"
  // (ลูกค้าจริงสำหรับกลุ่ม CRM, พนักงานขายจริงสำหรับกลุ่มยอดขาย, ช่างจริงสำหรับกลุ่มบริการ, พนักงานจริง
  // สำหรับกลุ่ม HR) field ที่ไม่มีข้อมูลจริงในระบบเลย (NPS Score, KPI, ชั่วโมงซ่อม) โชว่ N/A ตรงไปตรงมา
  // ไม่ใช่เลขแต่งขึ้น และ field ข้ามกลุ่มที่คำนวณรวมกับหน่วยแถวไม่ได้จะโชว์ "—"
  function fieldGroupOf(f) { return FIELD_GROUPS.find(g => g.fields.includes(f))?.group }

  async function computeRealRows(fields) {
    const counts = {}
    fields.forEach(f => { const g = fieldGroupOf(f); if (g) counts[g] = (counts[g] || 0) + 1 })
    const primaryGroup = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || 'ยอดขาย'
    const others = fields.filter(f => fieldGroupOf(f) !== primaryGroup)

    let entities = []
    if (primaryGroup === 'CRM') {
      const customers = await listDocs('customers', [], 'createdAt', 'desc', 300)
      entities = customers.filter(c => !c.deleted).map(c => ({ key: c.id, get: (f) => {
        if (f === 'ชื่อลูกค้า') return `${c.firstName||''} ${c.lastName||''}`.trim() || '-'
        if (f === 'รุ่นที่สนใจ') return c.interestedModel || '-'
        if (f === 'สถานะดีล') return STAGE_LABEL[c.stage] || c.stage || '-'
        if (f === 'วันที่ติดต่อ') return formatDate(c.stageChangedAt || c.createdAt)
        if (f === 'พนักงานขาย') return c.assignedTo || '-'
        if (f === 'แหล่งที่มา Lead') return c.source || '-'
        return null
      }}))
    } else if (primaryGroup === 'ยอดขาย') {
      const sales = await getSalesData()
      const bySales = {}
      sales.forEach(s => { const k = s.salesName || 'ไม่ระบุ'; (bySales[k] = bySales[k] || []).push(s) })
      entities = Object.entries(bySales).map(([name, list]) => ({ key: name, get: (f) => {
        const rev = list.reduce((a,s) => a + (s.salePrice||0), 0)
        const margin = list.reduce((a,s) => a + (s.margin||0), 0)
        if (f === 'พนักงานขาย') return name
        if (f === 'ยอดขาย (คัน)') return list.length + ' คัน'
        if (f === 'รายได้') return formatCurrency(rev)
        if (f === 'กำไร Gross') return formatCurrency(margin)
        if (f === 'Margin %') return rev > 0 ? Math.round(margin/rev*100) + '%' : '-'
        if (f === 'ค่าคอม') return formatCurrency(list.reduce((a,s) => a + (s.com70||0) + (s.comFinance||0), 0))
        if (f === 'ส่วนลด') return formatCurrency(list.reduce((a,s) => a + (s.discount||0), 0))
        return null
      }}))
    } else if (primaryGroup === 'บริการ') {
      const jobs = await listDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 500)
      const byTech = {}
      jobs.filter(j => !j.deleted).forEach(j => { const k = j.techName || 'ไม่ระบุ'; (byTech[k] = byTech[k] || []).push(j) })
      entities = Object.entries(byTech).map(([name, list]) => ({ key: name, get: (f) => {
        if (f === 'พนักงาน') return name
        if (f === 'จำนวนงาน') return list.length + ' งาน'
        if (f === 'ชั่วโมงซ่อม') return NA
        if (f === 'อะไหล่ที่ใช้') return list.reduce((a,j) => a + (j.parts?.length||0), 0) + ' รายการ'
        if (f === 'ค่าแรง') return formatCurrency(list.reduce((a,j) => a + (j.labor||0), 0))
        if (f === 'NPS Score') return NA
        return null
      }}))
    } else if (primaryGroup === 'HR') {
      const staff = await listDocs('staff', [], 'firstName', 'asc', 500)
      let leaves = []
      try { leaves = await listDocs('leave_requests', [], 'createdAt', 'desc', 500) } catch {}
      entities = staff.filter(s => !s.deleted).map(s => ({ key: s.id, get: (f) => {
        const name = `${s.firstName||''} ${s.lastName||''}`.trim() || '-'
        if (f === 'พนักงาน') return name
        if (f === 'แผนก') return s.dept || '-'
        if (f === 'ตำแหน่ง') return ROLE_LABEL[s.role] || s.role || '-'
        if (f === 'KPI') return NA
        if (f === 'เงินเดือน') return canViewSalary ? formatCurrency(s.salary || 0) : '🔒 ไม่มีสิทธิ์ดู'
        if (f === 'วันลา') return leaves.filter(l => l.staff === name && l.status === 'approved').reduce((a,l) => a + (l.days||0), 0) + ' วัน'
        return null
      }}))
    }

    const rows = entities.map(e => {
      const row = {}
      fields.forEach(f => { row[f] = others.includes(f) ? '—' : (e.get(f) ?? '-') })
      return row
    })
    return { primaryGroup, others, rows }
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const presetBtns = PRESETS.map(p=>'<button class="btn btn-sm btn-secondary preset-btn" data-name="'+p.name+'" data-fields="'+encodeURIComponent(JSON.stringify(p.fields))+'" data-chart="'+p.chart+'">'+p.name+'</button>').join('')
    const chartBtns = CHART_TYPES.map(c=>'<button class="btn btn-sm '+(chartType===c.key?'btn-primary':'btn-secondary')+' chart-btn" data-c="'+c.key+'">'+c.icon+' '+c.label+'</button>').join('')
    const allFields = FIELD_GROUPS.flatMap(g=>g.fields)
    const fieldPicker = FIELD_GROUPS.map(g=>'<div style="margin-bottom:10px"><div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">'+g.group+'</div><div>'+g.fields.map(f=>fieldChip(f,selectedFields.includes(f))).join('')+'</div></div>').join('')

    const headers = selectedFields.slice(0,6)
    const resultTable = reportRows && reportRows.rows.length
      ? '<table style="width:100%;border-collapse:collapse;font-size:0.76rem"><thead><tr style="border-bottom:2px solid var(--border)">'+headers.map(h=>'<th style="text-align:left;padding:8px 10px;font-weight:600;color:var(--text-muted)">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
        reportRows.rows.slice(0,50).map(row => '<tr style="border-bottom:1px solid var(--border-subtle)">'+headers.map(h=>'<td style="padding:8px 10px;font-size:0.76rem">'+esc(row[h] ?? '-')+'</td>').join('')+'</tr>').join('')+
      '</tbody></table>'
      : ''

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔧 Custom Report Builder</div>
            <div class="page-subtitle">สร้าง Report แบบ Drag & Drop ตามต้องการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="save-btn">💾 บันทึก</button>
            <button class="btn btn-primary" id="run-btn">▶ Run Report</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:300px 1fr;gap:14px">
          <div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">📋 Preset Templates</div>
              <div style="display:flex;flex-direction:column;gap:6px">${presetBtns}</div>
            </div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">📊 Chart Type</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">${chartBtns}</div>
            </div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">📌 เลือก Fields (${selectedFields.length})</div>
              ${fieldPicker}
            </div>
            ${savedReports.length > 0 ? `<div class="card" style="padding:14px">
              <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">📁 Report ที่บันทึกไว้ (${savedReports.length})</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${savedReports.map(r => `<button class="btn btn-sm btn-secondary saved-report-btn" data-id="${r.id}" style="text-align:left;justify-content:flex-start">📄 ${esc(r.name)}</button>`).join('')}
              </div>
            </div>` : ''}
          </div>
          <div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <input id="report-name" value="${esc(reportName)}" style="font-size:0.88rem;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);padding:4px;color:var(--text);width:300px">
                <span style="font-size:0.7rem;color:var(--text-muted)">${selectedFields.length} fields · ${CHART_TYPES.find(c=>c.key===chartType)?.icon||'📊'} ${CHART_TYPES.find(c=>c.key===chartType)?.label||chartType}</span>
              </div>
              <div style="background:var(--surface-2);border-radius:8px;padding:16px;min-height:200px;display:flex;align-items:center;justify-content:center;margin-bottom:14px">
                <div style="text-align:center;color:var(--text-muted)">
                  <div style="font-size:2.5rem">${CHART_TYPES.find(c=>c.key===chartType)?.icon||'📊'}</div>
                  <div style="font-size:0.8rem;margin-top:6px">${CHART_TYPES.find(c=>c.key===chartType)?.label||chartType} Preview</div>
                  <div style="font-size:0.68rem;margin-top:4px">${selectedFields.length} fields selected</div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="font-size:0.76rem;font-weight:700">📋 ผลลัพธ์${lastRun ? ` (${reportRows?.rows.length||0} แถว จากข้อมูลจริง)` : ''}</div>
                ${lastRun ? `<span style="font-size:0.66rem;color:var(--success)">● Run ล่าสุด: ${lastRun}</span>` : `<span style="font-size:0.66rem;color:var(--text-muted)">กด ▶ Run เพื่อดูผลจริง</span>`}
              </div>
              ${!lastRun ? `<div class="empty-state" style="padding:24px"><div class="empty-icon">📋</div><div class="empty-title">ยังไม่ได้ Run Report</div></div>`
                : reportRows?.rows.length ? `
                  ${reportRows.others.length ? `<div style="font-size:0.68rem;color:var(--warning);margin-bottom:6px">⚠️ field: ${reportRows.others.map(esc).join(', ')} อยู่คนละหมวดกับหน่วยของแถว (${esc(reportRows.primaryGroup)}) จึงคำนวณรวมไม่ได้ แนะนำเลือก field จากหมวดเดียวกัน</div>` : ''}
                  <div style="overflow-x:auto">${resultTable}</div>
                ` : `<div class="empty-state" style="padding:24px"><div class="empty-icon">📭</div><div class="empty-title">ไม่พบข้อมูลจริงสำหรับ field ที่เลือก</div></div>`}
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.field-chip').forEach(c=>c.addEventListener('click',()=>{
      const f = c.dataset.f
      if(selectedFields.includes(f)) selectedFields = selectedFields.filter(x=>x!==f)
      else selectedFields.push(f)
      lastRun = null; reportRows = null
      render()
    }))
    container.querySelectorAll('.chart-btn').forEach(b=>b.addEventListener('click',()=>{chartType=b.dataset.c;render()}))
    container.querySelectorAll('.preset-btn').forEach(b=>b.addEventListener('click',()=>{
      selectedFields = JSON.parse(decodeURIComponent(b.dataset.fields))
      chartType = b.dataset.chart
      lastRun = null; reportRows = null
      render()
    }))
    document.getElementById('save-btn')?.addEventListener('click', async ()=>{
      if (selectedFields.length === 0) { showToast('⚠️ เลือก Field อย่างน้อย 1 อย่าง', 'warning'); return }
      try {
        const entry = { name: reportName, fields: [...selectedFields], chart: chartType, savedAt: new Date().toISOString() }
        const existing = currentReportId ? savedReports.find(r => r.id === currentReportId) : savedReports.find(r => r.name === reportName)
        if (existing) { await updateDocData('custom_reports', existing.id, entry); currentReportId = existing.id }
        else { currentReportId = await createDoc('custom_reports', entry) }
        showToast(`💾 บันทึก "${reportName}" (${selectedFields.length} fields · ${CHART_TYPES.find(c=>c.key===chartType)?.label}) แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    container.querySelectorAll('.saved-report-btn').forEach(b=>b.addEventListener('click',()=>{
      const r = savedReports.find(x => x.id === b.dataset.id)
      if (!r) return
      currentReportId = r.id
      reportName = r.name
      selectedFields = [...r.fields]
      chartType = r.chart
      lastRun = null
      reportRows = null
      showToast(`📂 โหลด "${r.name}" แล้ว`, 'success')
      render()
    }))
    document.getElementById('run-btn')?.addEventListener('click', async ()=>{
      if (isRunning) return
      if (selectedFields.length === 0) { showToast('⚠️ เลือกอย่างน้อย 1 Field', 'warning'); return }
      isRunning = true
      const btn = document.getElementById('run-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลัง Run...'
      try {
        reportRows = await computeRealRows(selectedFields)
        lastRun = new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
        showToast(`✅ Run Report สำเร็จ — พบ ${reportRows.rows.length} แถวจากข้อมูลจริง`, 'success')
      } catch { showToast('❗ Run Report ไม่สำเร็จ', 'error') }
      isRunning = false
      render()
    })
    document.getElementById('report-name')?.addEventListener('change',(e)=>{ reportName=e.target.value })
  }

  await loadData()
}
