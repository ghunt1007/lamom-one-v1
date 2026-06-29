/**
 * Data Export — ส่งออกข้อมูล
 * Route: /migration/export
 */
import { showToast } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { exportToExcel, exportToCSV } from '../../utils/importExport.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const EXPORT_MODULES = [
  { id: 'crm', label: 'CRM / ลูกค้า', icon: '👥', records: 1842, lastExport: addDays(-7) },
  { id: 'dms', label: 'DMS / สต็อก', icon: '🚗', records: 234, lastExport: addDays(-3) },
  { id: 'service', label: 'บริการ', icon: '🔧', records: 4521, lastExport: addDays(-14) },
  { id: 'finance', label: 'การเงิน', icon: '💰', records: 892, lastExport: addDays(-1) },
  { id: 'hr', label: 'HR', icon: '👤', records: 16, lastExport: addDays(-30) },
  { id: 'marketing', label: 'การตลาด', icon: '📣', records: 357, lastExport: addDays(-5) },
]

const EXPORT_FORMATS = [
  { id: 'csv', label: 'CSV', icon: '📄', desc: 'เปิดใน Excel ได้' },
  { id: 'excel', label: 'Excel (.xlsx)', icon: '📊', desc: 'Excel พร้อมรูปแบบ' },
  { id: 'json', label: 'JSON', icon: '💾', desc: 'สำหรับนักพัฒนา' },
  { id: 'pdf', label: 'PDF Report', icon: '📋', desc: 'รายงานพิมพ์ได้' },
]

const RECENT_EXPORTS = [
  { module: 'CRM', format: 'Excel', records: 1842, size: '2.4 MB', user: 'Admin', time: addDays(-1) },
  { module: 'Finance', format: 'CSV', records: 892, size: '450 KB', user: 'ผู้จัดการ', time: addDays(-2) },
  { module: 'Service', format: 'PDF', records: 250, size: '8.1 MB', user: 'Admin', time: addDays(-5) },
]

export default async function DataExportPage(container) {
  let selected = new Set()
  let format = 'excel'

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📤 Data Export</div>
            <div class="page-subtitle">ส่งออกข้อมูลจากทุกโมดูล</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <!-- Module selection -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📦 เลือกโมดูล</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${EXPORT_MODULES.map(m => `
                <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);cursor:pointer;border:1px solid ${selected.has(m.id)?'var(--primary)':'transparent'}">
                  <input type="checkbox" class="mod-check" data-id="${m.id}" ${selected.has(m.id)?'checked':''} style="accent-color:var(--primary)">
                  <span style="font-size:1rem">${m.icon}</span>
                  <div style="flex:1">
                    <div style="font-size:0.82rem;font-weight:600">${m.label}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${m.records.toLocaleString()} รายการ · Export ล่าสุด ${formatDate(m.lastExport)}</div>
                  </div>
                </label>
              `).join('')}
              <div style="display:flex;gap:6px;margin-top:4px">
                <button class="btn btn-xs btn-secondary" id="select-all-btn">เลือกทั้งหมด</button>
                <button class="btn btn-xs btn-secondary" id="clear-btn">ล้าง</button>
              </div>
            </div>
          </div>

          <!-- Format + settings -->
          <div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📁 รูปแบบไฟล์</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                ${EXPORT_FORMATS.map(f => `
                  <label style="display:flex;flex-direction:column;gap:3px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);cursor:pointer;border:2px solid ${format===f.id?'var(--primary)':'transparent'}">
                    <div style="display:flex;align-items:center;gap:6px">
                      <input type="radio" name="fmt" value="${f.id}" ${format===f.id?'checked':''} class="fmt-radio" style="accent-color:var(--primary)">
                      <span>${f.icon}</span><strong style="font-size:0.8rem">${f.label}</strong>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text-muted);padding-left:18px">${f.desc}</div>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Date range -->
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📅 ช่วงวันที่</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div class="input-group"><label class="input-label">ตั้งแต่</label><input class="input" type="date" id="date-from" value="${addDays(-30).slice(0,10)}"></div>
                <div class="input-group"><label class="input-label">ถึง</label><input class="input" type="date" id="date-to" value="${addDays(0).slice(0,10)}"></div>
              </div>
            </div>

            <button class="btn btn-primary" id="export-btn" style="width:100%" ${selected.size===0?'disabled':''}>
              📤 Export ${selected.size > 0 ? '(' + selected.size + ' โมดูล)' : ''}
            </button>
          </div>
        </div>

        <!-- Recent exports -->
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📋 Export ล่าสุด</div>
          <table style="width:100%;border-collapse:collapse">
            <tbody>
              ${RECENT_EXPORTS.map(e => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px;font-weight:600">${e.module}</td>
                  <td style="padding:8px 10px"><span class="badge badge-secondary" style="font-size:0.6rem">${e.format}</span></td>
                  <td style="padding:8px 10px;color:var(--text-muted)">${e.records.toLocaleString()} รายการ</td>
                  <td style="padding:8px 10px;color:var(--text-muted)">${e.size}</td>
                  <td style="padding:8px 10px;color:var(--text-muted)">${e.user}</td>
                  <td style="padding:8px 10px;color:var(--text-muted)">${formatDate(e.time)}</td>
                  <td style="padding:8px 14px;text-align:right"><button class="btn btn-xs btn-secondary">⬇️ ดาวน์โหลด</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.mod-check').forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id); renderPage()
    }))
    container.querySelectorAll('.fmt-radio').forEach(r => r.addEventListener('change', () => { format = r.value; renderPage() }))
    document.getElementById('select-all-btn')?.addEventListener('click', () => { EXPORT_MODULES.forEach(m => selected.add(m.id)); renderPage() })
    document.getElementById('clear-btn')?.addEventListener('click', () => { selected.clear(); renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      if (selected.size === 0) return
      const DEMO_ROWS = {
        crm:     [{ 'ชื่อ':'สมชาย ใจดี','โทรศัพท์':'085-111-2222','สถานะ':'ลูกค้า','รุ่นที่ซื้อ':'BYD Seal' },{ 'ชื่อ':'มาลี สุขใจ','โทรศัพท์':'086-333-4444','สถานะ':'Prospect','รุ่นที่ซื้อ':'BYD Dolphin' },{ 'ชื่อ':'วิรัช เก่งมาก','โทรศัพท์':'087-555-6666','สถานะ':'ลูกค้า','รุ่นที่ซื้อ':'BYD Atto 3' }],
        dms:     [{ 'VIN':'LJD5JXXS5PA000001','รุ่น':'BYD Seal AWD','สี':'เทา','สถานะ':'ในสต็อก','ราคา':1699000 },{ 'VIN':'LJD5JXXS5PA000002','รุ่น':'BYD Dolphin','สี':'ขาว','สถานะ':'จอง','ราคา':899000 },{ 'VIN':'LJD5JXXS5PA000003','รุ่น':'BYD Atto 3','สี':'แดง','สถานะ':'ในสต็อก','ราคา':1099000 }],
        service: [{ 'เลขงาน':'WO-2026-001','ลูกค้า':'สมชาย ใจดี','รุ่น':'BYD Seal','ประเภทงาน':'เช็คระยะ 20,000','สถานะ':'เสร็จแล้ว' },{ 'เลขงาน':'WO-2026-002','ลูกค้า':'อรทัย ตั้งใจ','รุ่น':'BYD Atto 3','ประเภทงาน':'ซ่อมทั่วไป','สถานะ':'กำลังทำ' },{ 'เลขงาน':'WO-2026-003','ลูกค้า':'ธนพล เที่ยงตรง','รุ่น':'MG ZS EV','ประเภทงาน':'ตรวจประกัน','สถานะ':'รอคิว' }],
        finance: [{ 'วันที่':'2026-06-01','รายการ':'ขายรถ BYD Seal','ประเภท':'รายรับ','จำนวน (บาท)':1699000 },{ 'วันที่':'2026-06-02','รายการ':'บริการเช็คระยะ','ประเภท':'รายรับ','จำนวน (บาท)':4500 },{ 'วันที่':'2026-06-03','รายการ':'ค่าอะไหล่','ประเภท':'รายจ่าย','จำนวน (บาท)':28000 }],
        hr:      [{ 'ชื่อ':'ทีมขาย 1','ตำแหน่ง':'Sales Executive','แผนก':'ขาย','เงินเดือน':35000 },{ 'ชื่อ':'ช่างซ่อม 1','ตำแหน่ง':'Service Technician','แผนก':'บริการ','เงินเดือน':28000 },{ 'ชื่อ':'ผู้จัดการ','ตำแหน่ง':'Branch Manager','แผนก':'บริหาร','เงินเดือน':75000 }],
        marketing:[{ 'แคมเปญ':'Mid-Year Sale','แพลตฟอร์ม':'Facebook','Leads':64,'ยอดใช้ (บาท)':15000 },{ 'แคมเปญ':'EV Test Drive','แพลตฟอร์ม':'LINE OA','Leads':31,'ยอดใช้ (บาท)':0 },{ 'แคมเปญ':'BYD Dolphin Launch','แพลตฟอร์ม':'TikTok','Leads':57,'ยอดใช้ (บาท)':8500 }],
      }
      const allRows = []
      ;[...selected].forEach(id => {
        const mod = EXPORT_MODULES.find(m => m.id === id)
        ;(DEMO_ROWS[id] || []).forEach(row => allRows.push({ 'โมดูล': mod?.label || id, ...row }))
      })
      const mods = [...selected].map(id => EXPORT_MODULES.find(m => m.id === id)?.label).join(', ')
      const filename = `LAMOM_Export_${new Date().toISOString().slice(0,10)}`
      if (format === 'excel') {
        exportToExcel(allRows, filename + '.xlsx', 'Export')
        showToast(`📥 Export ${mods} → Excel สำเร็จ`, 'success')
      } else if (format === 'csv') {
        exportToCSV(allRows, filename + '.csv')
        showToast(`📥 Export ${mods} → CSV สำเร็จ`, 'success')
      } else if (format === 'json') {
        const blob = new Blob([JSON.stringify(allRows, null, 2)], { type: 'application/json' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.json'; a.click()
        URL.revokeObjectURL(a.href)
        showToast(`📥 Export ${mods} → JSON สำเร็จ`, 'success')
      } else {
        showToast('📋 PDF Export: ใช้ Ctrl+P เพื่อพิมพ์เป็น PDF', 'warning')
      }
    })
  }

  renderPage()
}
