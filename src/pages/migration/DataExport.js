/**
 * Data Export — ส่งออกข้อมูลจริง (v1.0.317)
 * Route: /migration/export
 *
 * เดิมทั้งหน้านี้ export ข้อมูลปลอม — ไม่ว่าจะเลือกโมดูลไหน/มีข้อมูลจริงกี่รายการ ไฟล์ที่ดาวน์โหลดออกไป
 * จะมีแค่แถวตัวอย่างปลอม 3 แถวต่อโมดูลเสมอ (DEMO_ROWS เดิม) เลขจำนวนเรคคอร์ด/วันที่ export ล่าสุดที่
 * โชว์ในหน้าก็ hardcode ไว้ ไม่ตรงกับข้อมูลจริงเลย — ถ้าใครใช้ export "การเงิน" ไปตรวจสอบบัญชีจริงจะได้
 * รายการปลอม 3 รายการ ไม่ใช่ข้อมูลจริง
 *
 * แก้ให้ export ข้อมูลจริงจาก collection ที่ตรงที่สุดต่อโมดูล (ตรวจสอบจากหน้าจริงที่ใช้ collection นั้น
 * อยู่แล้วทั่วแอปก่อนเลือก ไม่ได้เดา):
 *   - crm      → customers (หน้าลูกค้าหลักของทั้งระบบ)
 *   - dms      → vehicles (stock รถ ใช้จริงใน DmsDashboard/ColorMatrix/StockValuation ฯลฯ)
 *   - service  → job_cards (Job Card ซ่อม ใช้จริงใน ServiceDashboard/JobCards.js)
 *   - finance  → getSalesData() (ยอดขายจริง เป็นแหล่งข้อมูล "การเงิน" ที่หน้า CashFlow/FinanceDashboard/
 *                Margin/GpFoc ใช้ร่วมกันอยู่แล้วทั่วทั้งโมดูลการเงินจริง ไม่ได้เลือกเอง)
 *   - hr       → staff (ไม่รวมเงินเดือน — ย้ายไปเก็บแยกที่ staff_salaries จำกัดสิทธิ์แล้วตั้งแต่ v1.0.303/
 *                v1.0.304 การ export ทั่วไปนี้ไม่ควรเปิดช่องย้อนกลับไปรั่วเงินเดือนผ่านทางอื่น)
 *   - marketing→ marketing_campaigns (ใช้จริงใน CampaignBuilder.js)
 * "จำนวนเรคคอร์ด" ที่โชว์ในหน้าตอนนี้คือจำนวนจริงที่โหลดมา ไม่ใช่ตัวเลข hardcode แล้ว
 * ตาราง "Export ล่าสุด" เดิมเป็นข้อมูลปลอมนิ่งๆไม่เคยอัปเดต ไม่มี collection จริงรองรับประวัตินี้ ตัดออก
 * ไปเลยตามคำแนะนำ (ไม่ใส่ของปลอมไว้แทน)
 */
import { showToast } from '../../core/store.js'
import { listDocs, getSalesData } from '../../core/db.js'
import { exportToExcel, exportToCSV } from '../../utils/importExport.js'
import { todayBangkok } from '../../utils/format.js'

const EXPORT_MODULES = [
  { id: 'crm', label: 'CRM / ลูกค้า', icon: '👥', col: 'customers' },
  { id: 'dms', label: 'DMS / สต็อก', icon: '🚗', col: 'vehicles' },
  { id: 'service', label: 'บริการ', icon: '🔧', col: 'job_cards' },
  { id: 'finance', label: 'การเงิน', icon: '💰', col: null }, // ใช้ getSalesData() แทน collection เดียว
  { id: 'hr', label: 'HR', icon: '👤', col: 'staff' },
  { id: 'marketing', label: 'การตลาด', icon: '📣', col: 'marketing_campaigns' },
]

const EXPORT_FORMATS = [
  { id: 'csv', label: 'CSV', icon: '📄', desc: 'เปิดใน Excel ได้' },
  { id: 'excel', label: 'Excel (.xlsx)', icon: '📊', desc: 'Excel พร้อมรูปแบบ' },
  { id: 'json', label: 'JSON', icon: '💾', desc: 'สำหรับนักพัฒนา' },
]

// แปลงข้อมูลจริงต่อโมดูลเป็นแถวสำหรับ export — เลือก field ที่มีประโยชน์จริง ไม่รวมข้อมูลอ่อนไหว
// (เช่นเงินเดือนพนักงาน ที่จำกัดสิทธิ์ไว้แยกอยู่แล้ว)
function toRows(moduleId, docs, sales) {
  if (moduleId === 'crm') {
    return docs.map(c => ({ 'ชื่อ': `${c.firstName||''} ${c.lastName||''}`.trim(), 'โทรศัพท์': c.phone||'', 'สถานะ': c.stage||'', 'รถที่สนใจ': c.interestedModel||'' }))
  }
  if (moduleId === 'dms') {
    return docs.map(v => ({ 'VIN': v.vin||'', 'รุ่น': `${v.brand||''} ${v.model||''}`.trim(), 'สี': v.color||'', 'สถานะ': v.status||'', 'ราคา': v.listPrice||v.salePrice||v.cost||0 }))
  }
  if (moduleId === 'service') {
    return docs.map(j => ({ 'เลขงาน': j.jobNo||'', 'ลูกค้า': j.custName||'', 'รถ': `${j.brand||''} ${j.model||''}`.trim(), 'ประเภทงาน': j.type||'', 'สถานะ': j.status||'' }))
  }
  if (moduleId === 'finance') {
    return sales.map(s => ({ 'วันที่': s.bookingDate||'', 'รายการ': `ขายรถ ${s.model||''}`.trim(), 'ลูกค้า': s.custName||'', 'จำนวน (บาท)': s.salePrice||0 }))
  }
  if (moduleId === 'hr') {
    return docs.map(s => ({ 'ชื่อ': `${s.firstName||''} ${s.lastName||''}`.trim(), 'ตำแหน่ง': s.role||'', 'แผนก': s.dept||'' }))
  }
  if (moduleId === 'marketing') {
    return docs.map(c => ({ 'แคมเปญ': c.name||'', 'ประเภท': c.type||'', 'สถานะ': c.status||'', 'งบ (บาท)': c.budget||0, 'ใช้ไป (บาท)': c.spent||0, 'Leads': c.leads||0 }))
  }
  return []
}

export default async function DataExportPage(container) {
  const myGen = container.__routerGen
  let selected = new Set()
  let format = 'excel'
  let counts = {}
  let loading = true

  async function loadCounts() {
    loading = true
    for (const m of EXPORT_MODULES) {
      try {
        if (m.id === 'finance') { counts[m.id] = (await getSalesData().catch(() => [])).length }
        else { counts[m.id] = (await listDocs(m.col, [], 'createdAt', 'desc', 2000).catch(() => [])).length }
      } catch { counts[m.id] = 0 }
    }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📤 Data Export</div>
            <div class="page-subtitle">ส่งออกข้อมูลจริงจากระบบ — จำนวนเรคคอร์ดคือของจริง ไม่ใช่ตัวเลขจำลอง</div>
          </div>
        </div>

        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">เลือกข้อมูลที่จะ Export</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
            ${EXPORT_MODULES.map(m => `
              <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface-2);border-radius:8px;cursor:pointer">
                <input type="checkbox" class="mod-check" data-id="${m.id}" ${selected.has(m.id)?'checked':''}>
                <span>${m.icon} ${m.label}</span>
                <span style="margin-left:auto;font-size:0.72rem;color:var(--text-muted)">${(counts[m.id]||0).toLocaleString()} รายการ</span>
              </label>
            `).join('')}
          </div>
          <div style="display:flex;gap:6px;margin-bottom:14px">
            <button class="btn btn-secondary btn-sm" id="select-all-btn">เลือกทั้งหมด</button>
            <button class="btn btn-secondary btn-sm" id="clear-btn">ล้าง</button>
          </div>
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">รูปแบบไฟล์</div>
          <div style="display:flex;gap:8px;margin-bottom:14px">
            ${EXPORT_FORMATS.map(f => `
              <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--surface-2);border-radius:8px;cursor:pointer;font-size:0.82rem">
                <input type="radio" name="fmt" class="fmt-radio" value="${f.id}" ${format===f.id?'checked':''}> ${f.icon} ${f.label}
              </label>
            `).join('')}
          </div>
          <button class="btn btn-primary" id="export-btn" style="width:100%" ${selected.size===0?'disabled':''}>📥 Export (${[...selected].reduce((a,id)=>a+(counts[id]||0),0).toLocaleString()} รายการ)</button>
        </div>
      </div>
    `

    container.querySelectorAll('.mod-check').forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id); renderPage()
    }))
    container.querySelectorAll('.fmt-radio').forEach(r => r.addEventListener('change', () => { format = r.value; renderPage() }))
    document.getElementById('select-all-btn')?.addEventListener('click', () => { EXPORT_MODULES.forEach(m => selected.add(m.id)); renderPage() })
    document.getElementById('clear-btn')?.addEventListener('click', () => { selected.clear(); renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', runExport)
  }

  async function runExport() {
    if (selected.size === 0) return
    const btn = document.getElementById('export-btn')
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลังดึงข้อมูล...' }
    try {
      let sales = null
      const allRows = []
      for (const id of selected) {
        const mod = EXPORT_MODULES.find(m => m.id === id)
        if (!mod) continue
        let docs = []
        if (id === 'finance') { sales = sales || await getSalesData().catch(() => []); docs = sales }
        else { docs = await listDocs(mod.col, [], 'createdAt', 'desc', 2000).catch(() => []) }
        toRows(id, docs, sales || []).forEach(row => allRows.push({ 'โมดูล': mod.label, ...row }))
      }
      const mods = [...selected].map(id => EXPORT_MODULES.find(m => m.id === id)?.label).join(', ')
      const filename = `LAMOM_Export_${todayBangkok()}`
      if (format === 'excel') {
        exportToExcel(allRows, filename + '.xlsx', 'Export')
        showToast(`📥 Export ${mods} → Excel สำเร็จ (${allRows.length.toLocaleString()} รายการ)`, 'success')
      } else if (format === 'csv') {
        exportToCSV(allRows, filename + '.csv')
        showToast(`📥 Export ${mods} → CSV สำเร็จ (${allRows.length.toLocaleString()} รายการ)`, 'success')
      } else {
        const blob = new Blob([JSON.stringify(allRows, null, 2)], { type: 'application/json' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.json'; a.click()
        URL.revokeObjectURL(a.href)
        showToast(`📥 Export ${mods} → JSON สำเร็จ (${allRows.length.toLocaleString()} รายการ)`, 'success')
      }
    } catch (e) {
      showToast('Export ไม่สำเร็จ: ' + (e.message || ''), 'error')
    }
    if (btn) { btn.disabled = false }
    renderPage()
  }

  await loadCounts()
}
