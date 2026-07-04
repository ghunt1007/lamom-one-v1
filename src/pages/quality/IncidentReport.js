/**
 * Incident Report — รายงานอุบัติการณ์/เหตุการณ์ผิดปกติ
 * Route: /quality/incidents
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

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

export default async function IncidentReportPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let incidents = []
  let sevFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { incidents = await listDocs('quality_incidents', [], 'date', 'desc', 300) } catch (e) { incidents = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
          ${!list.length ? `<div class="empty-state"><div class="empty-icon">🚨</div><div class="empty-title">ไม่มีรายงานเหตุการณ์</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.sv-btn').forEach(b => b.addEventListener('click', () => { sevFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.investigate-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('quality_incidents', b.dataset.id, { status: 'investigating' })
      await loadData()
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
        async onConfirm() {
          const cause = document.getElementById('inc-cause')?.value?.trim()
          const action = document.getElementById('inc-action')?.value?.trim()
          if (!cause || !action) { showToast('❗ กรอกให้ครบ', 'error'); return false }
          await updateDocData('quality_incidents', i.id, { rootCause: cause, action, status: 'action' })
          showToast('📋 บันทึกแล้ว — เริ่มแก้ไข', 'success'); await loadData()
        }
      })
    }))
    container.querySelectorAll('.close-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('quality_incidents', b.dataset.id, { status: 'closed' })
      showToast('✅ ปิดเคสแล้ว', 'success'); await loadData()
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
        async onConfirm() {
          const title = document.getElementById('inc-title')?.value?.trim()
          if (!title) { showToast('❗ กรุณากรอกเหตุการณ์', 'error'); return false }
          await createDoc('quality_incidents', {
            title, cat: document.getElementById('inc-cat')?.value||'safety',
            severity: document.getElementById('inc-sev')?.value||'minor', status: 'open',
            reporter: document.getElementById('inc-reporter')?.value||'—',
            date: new Date().toISOString(), rootCause: '', action: '',
          })
          showToast('🚨 บันทึกเหตุการณ์แล้ว', 'warning'); await loadData()
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
