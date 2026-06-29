/**
 * Incident Report — รายงานอุบัติการณ์/เหตุการณ์ผิดปกติ
 * Route: /quality/incidents
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const SEVERITY = {
  critical: { label: 'วิกฤต', color: 'danger', icon: '🔴' },
  major:    { label: 'รุนแรง', color: 'warning', icon: '🟠' },
  minor:    { label: 'เล็กน้อย', color: 'primary', icon: '🟡' },
  near_miss:{ label: 'เกือบเกิดเหตุ', color: 'secondary', icon: '⚪' },
}

const INC_STATUS = {
  open:        { label: 'เปิดเคส', color: 'danger', icon: '🆕' },
  investigating:{ label: 'กำลังสอบสวน', color: 'warning', icon: '🔍' },
  action:      { label: 'แก้ไขอยู่', color: 'primary', icon: '🔧' },
  closed:      { label: 'ปิดเคส', color: 'success', icon: '✅' },
}

const INC_CATS = {
  safety:   { label: 'ความปลอดภัย', icon: '⛑' },
  vehicle:  { label: 'ความเสียหายรถ', icon: '🚗' },
  customer: { label: 'ข้อพิพาทลูกค้า', icon: '👥' },
  data:     { label: 'ข้อมูล/PDPA', icon: '🔒' },
  facility: { label: 'อาคาร/อุปกรณ์', icon: '🏢' },
}

const DEMO_INCIDENTS = [
  { id: 'INC001', title: 'รถลูกค้าถูกขีดข่วนระหว่างล้าง', cat: 'vehicle', severity: 'major', status: 'action', reporter: 'หัวหน้าทีมล้างรถ', date: addDays(-2), rootCause: 'อุปกรณ์ล้างเก่า มีเศษทราย', action: 'เปลี่ยนผ้าไมโครไฟเบอร์ใหม่ทั้งชุด + ชดเชยลูกค้า' },
  { id: 'INC002', title: 'ช่างเกือบโดนไฟแรงสูงขณะถอดแบต', cat: 'safety', severity: 'critical', status: 'investigating', reporter: 'วิทยา ช่างใหญ่', date: addDays(-1), rootCause: '', action: '' },
  { id: 'INC003', title: 'ส่งใบเสนอราคาผิดอีเมล (ข้อมูลลูกค้ารั่ว)', cat: 'data', severity: 'major', status: 'closed', reporter: 'Admin', date: addDays(-10), rootCause: 'Autocomplete อีเมลผิด', action: 'แจ้งลูกค้าทั้ง 2 ฝ่าย + เพิ่มขั้นตอน double-check' },
  { id: 'INC004', title: 'ลิฟต์ยกรถเสียงดังผิดปกติ', cat: 'facility', severity: 'minor', status: 'action', reporter: 'มานะ ขยัน', date: addDays(-3), rootCause: 'ขาดการหล่อลื่นตามรอบ', action: 'เรียกช่างซ่อมบำรุง — นัดพรุ่งนี้' },
  { id: 'INC005', title: 'พื้นเปียกหน้าห้องน้ำ ไม่มีป้ายเตือน', cat: 'safety', severity: 'near_miss', status: 'closed', reporter: 'สุดา มาดี', date: addDays(-7), rootCause: 'แม่บ้านลืมวางป้าย', action: 'อบรมซ้ำ + ติดป้ายถาวร' },
]

export default async function IncidentReportPage(container) {
  let incidents = DEMO_INCIDENTS.map(i => ({ ...i }))
  let sevFilter = 'all'

  function renderPage() {
    const list = incidents.filter(i => sevFilter === 'all' || i.severity === sevFilter)
    const open = incidents.filter(i => i.status !== 'closed').length
    const critical = incidents.filter(i => i.severity === 'critical' && i.status !== 'closed').length
    const closedThisMonth = incidents.filter(i => i.status === 'closed').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚨 Incident Report</div>
            <div class="page-subtitle">รายงานอุบัติการณ์ — บันทึก สอบสวน แก้ไข ป้องกัน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="report-btn">+ รายงานเหตุการณ์</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🆕 เคสเปิดอยู่', open, open > 0 ? 'warning' : 'success')}
          ${kpi('🔴 วิกฤตค้าง', critical, critical > 0 ? 'danger' : 'success')}
          ${kpi('✅ ปิดแล้ว', closedThisMonth, 'success')}
          ${kpi('📋 ทั้งหมด', incidents.length, 'secondary')}
        </div>

        ${critical > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🔴 <strong>มีเหตุวิกฤตค้างอยู่ ${critical} เคส</strong> — ผู้จัดการต้องสอบสวนภายใน 24 ชม.
          </div>
        ` : ''}

        <!-- Severity filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${sevFilter==='all'?'btn-primary':'btn-secondary'} sv-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(SEVERITY).map(([k,v]) => `<button class="btn btn-xs ${sevFilter===k?'btn-'+v.color:'btn-secondary'} sv-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(i => {
            const sv = SEVERITY[i.severity]
            const st = INC_STATUS[i.status]
            const ic = INC_CATS[i.cat]
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${sv?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${sv?.icon} ${escHtml(i.title)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${ic?.icon} ${ic?.label} · รายงานโดย ${escHtml(i.reporter)} · ${timeAgo(i.date)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${sv?.color}" style="font-size:0.6rem">${sv?.label}</span>
                  <span class="badge badge-${st?.color}" style="font-size:0.6rem">${st?.icon} ${st?.label}</span>
                </div>
              </div>
              ${i.rootCause ? `<div style="font-size:0.73rem;margin-bottom:3px"><strong>สาเหตุ:</strong> <span style="color:var(--text-muted)">${escHtml(i.rootCause)}</span></div>` : ''}
              ${i.action ? `<div style="font-size:0.73rem;margin-bottom:6px"><strong>การแก้ไข:</strong> <span style="color:var(--text-muted)">${escHtml(i.action)}</span></div>` : ''}
              <div style="display:flex;gap:6px">
                ${i.status === 'open' ? `<button class="btn btn-xs btn-warning investigate-btn" data-id="${i.id}">🔍 เริ่มสอบสวน</button>` : ''}
                ${i.status === 'investigating' ? `<button class="btn btn-xs btn-primary rca-btn" data-id="${i.id}">📋 บันทึกสาเหตุ + แผนแก้</button>` : ''}
                ${i.status === 'action' ? `<button class="btn btn-xs btn-success close-btn" data-id="${i.id}">✅ ปิดเคส</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sv-btn').forEach(b => b.addEventListener('click', () => { sevFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.investigate-btn').forEach(b => b.addEventListener('click', () => {
      const i = incidents.find(x => x.id === b.dataset.id); if (i) { i.status = 'investigating'; renderPage() }
    }))
    container.querySelectorAll('.rca-btn').forEach(b => b.addEventListener('click', () => {
      const i = incidents.find(x => x.id === b.dataset.id)
      if (i) openModal({
        title: '📋 Root Cause + แผนแก้ไข',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">สาเหตุที่แท้จริง *</label><input class="input" id="inc-cause"></div>
          <div class="input-group"><label class="input-label">แผนแก้ไข/ป้องกัน *</label><input class="input" id="inc-action"></div>
        </div>`,
        onConfirm() {
          const cause = document.getElementById('inc-cause')?.value?.trim()
          const action = document.getElementById('inc-action')?.value?.trim()
          if (!cause || !action) { showToast('❗ กรอกให้ครบ', 'error'); return }
          i.rootCause = cause; i.action = action; i.status = 'action'
          showToast('📋 บันทึกแล้ว — เริ่มแก้ไข', 'success'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.close-btn').forEach(b => b.addEventListener('click', () => {
      const i = incidents.find(x => x.id === b.dataset.id); if (i) { i.status = 'closed'; showToast('✅ ปิดเคสแล้ว', 'success'); renderPage() }
    }))
    document.getElementById('report-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ รายงานเหตุการณ์',
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">เหตุการณ์ *</label><input class="input" id="inc-title"></div>
          <div class="input-group"><label class="input-label">หมวด</label>
            <select class="input" id="inc-cat">${Object.entries(INC_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ความรุนแรง</label>
            <select class="input" id="inc-sev">${Object.entries(SEVERITY).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ผู้รายงาน</label><input class="input" id="inc-reporter"></div>
        </div>`,
        onConfirm() {
          const title = document.getElementById('inc-title')?.value?.trim()
          if (!title) { showToast('❗ กรุณากรอกเหตุการณ์', 'error'); return }
          incidents.unshift({ id:`INC${String(incidents.length+1).padStart(3,'0')}`, title, cat:document.getElementById('inc-cat')?.value||'safety', severity:document.getElementById('inc-sev')?.value||'minor', status:'open', reporter:document.getElementById('inc-reporter')?.value||'—', date:new Date().toISOString(), rootCause:'', action:'' })
          showToast('🚨 บันทึกเหตุการณ์แล้ว', 'warning'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
