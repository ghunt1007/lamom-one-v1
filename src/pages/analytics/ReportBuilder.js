/**
 * Custom Report Builder — สร้าง Report เองแบบ Drag & Drop
 * Route: /analytics/report-builder
 */
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'

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

  function mockRow(i) {
    const vals = ['กิตติ','17 คัน','฿20.4M','13.2%','ปิยะ','16 คัน','฿19.2M','12.8%','สมพงษ์','15 คัน','฿17.9M','11.9%']
    const names = ['กิตติ','ปิยะ','สมพงษ์']
    const row = selectedFields.slice(0,5)
    return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
      row.map((f,j)=>'<td style="padding:8px 10px;font-size:0.76px">' + (j===0?names[i]||'—':vals[i*4+(j-1)]||'—') + '</td>').join('') +
    '</tr>'
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

    const headers = selectedFields.slice(0,5)
    const mockTable = '<table style="width:100%;border-collapse:collapse;font-size:0.76rem"><thead><tr style="border-bottom:2px solid var(--border)">'+headers.map(h=>'<th style="text-align:left;padding:8px 10px;font-weight:600;color:var(--text-muted)">'+h+'</th>').join('')+'</tr></thead><tbody>'+[0,1,2].map(i=>mockRow(i)).join('')+'</tbody></table>'

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
                ${savedReports.map(r => `<button class="btn btn-sm btn-secondary saved-report-btn" data-id="${r.id}" style="text-align:left;justify-content:flex-start">📄 ${r.name}</button>`).join('')}
              </div>
            </div>` : ''}
          </div>
          <div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <input id="report-name" value="${reportName}" style="font-size:0.88rem;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);padding:4px;color:var(--text);width:300px">
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
                <div style="font-size:0.76rem;font-weight:700">📋 ผลลัพธ์${lastRun ? ` (${selectedFields.length} fields)` : ' — ตัวอย่าง'}</div>
                ${lastRun ? `<span style="font-size:0.66rem;color:var(--success)">● Run ล่าสุด: ${lastRun}</span>` : `<span style="font-size:0.66rem;color:var(--text-muted)">กด ▶ Run เพื่อดูผลจริง</span>`}
              </div>
              <div style="overflow-x:auto">${mockTable}</div>
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.field-chip').forEach(c=>c.addEventListener('click',()=>{
      const f = c.dataset.f
      if(selectedFields.includes(f)) selectedFields = selectedFields.filter(x=>x!==f)
      else selectedFields.push(f)
      render()
    }))
    container.querySelectorAll('.chart-btn').forEach(b=>b.addEventListener('click',()=>{chartType=b.dataset.c;render()}))
    container.querySelectorAll('.preset-btn').forEach(b=>b.addEventListener('click',()=>{
      selectedFields = JSON.parse(decodeURIComponent(b.dataset.fields))
      chartType = b.dataset.chart
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
      showToast(`📂 โหลด "${r.name}" แล้ว`, 'success')
      render()
    }))
    document.getElementById('run-btn')?.addEventListener('click',()=>{
      if (isRunning) return
      if (selectedFields.length === 0) { showToast('⚠️ เลือกอย่างน้อย 1 Field', 'warning'); return }
      isRunning = true
      showToast('▶ กำลัง Run Report...', 'success')
      setTimeout(() => {
        lastRun = new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
        isRunning = false
        render()
        showToast('✅ Run Report สำเร็จ — ' + selectedFields.length + ' fields · ' + CHART_TYPES.find(c=>c.key===chartType)?.label||chartType, 'success')
      }, 800)
    })
    document.getElementById('report-name')?.addEventListener('change',(e)=>{ reportName=e.target.value })
  }

  await loadData()
}
