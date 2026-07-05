/**
 * Audit Schedule — ตารางตรวจสอบคุณภาพ
 * Route: /quality/audit-schedule
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const AUDIT_TYPES = {
  internal:   { label: 'Internal Audit', color: 'primary', icon: '🏠' },
  external:   { label: 'External Audit', color: 'warning', icon: '🏛' },
  safety:     { label: 'Safety Check', color: 'danger', icon: '⛑' },
  process:    { label: 'Process Review', color: 'secondary', icon: '🔄' },
  financial:  { label: 'Financial Audit', color: 'success', icon: '💰' },
}

const AUDIT_STATUS = {
  scheduled:  { label: 'กำหนดไว้', color: 'secondary', icon: '📅' },
  in_progress:{ label: 'กำลังดำเนินการ', color: 'warning', icon: '🔄' },
  completed:  { label: 'เสร็จแล้ว', color: 'success', icon: '✅' },
  overdue:    { label: 'เกินกำหนด', color: 'danger', icon: '❗' },
  cancelled:  { label: 'ยกเลิก', color: 'secondary', icon: '❌' },
}

export default async function AuditSchedulePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let audits = []
  let typeFilter = 'all'
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { audits = await listDocs('quality_audits', [], 'scheduledDate', 'asc', 300) } catch (e) { audits = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = audits.filter(a =>
      (typeFilter === 'all' || a.type === typeFilter) &&
      (statusFilter === 'all' || a.status === statusFilter)
    )
    const completed = audits.filter(a => a.status === 'completed').length
    const overdue = audits.filter(a => a.status === 'overdue').length
    const upcoming = audits.filter(a => a.status === 'scheduled').length
    const avgScore = audits.filter(a => a.score).reduce((a, x) => a + x.score, 0) / (audits.filter(a => a.score).length || 1)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔍 Audit Schedule</div>
            <div class="page-subtitle">ตารางตรวจสอบคุณภาพ — ทุกแผนก</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-audit-btn">+ สร้าง Audit</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('✅ เสร็จแล้ว', completed, 'success')}
          ${kpi('❗ เกินกำหนด', overdue, overdue > 0 ? 'danger' : 'secondary')}
          ${kpi('📅 กำหนดไว้', upcoming, 'primary')}
          ${kpi('⭐ คะแนนเฉลี่ย', Math.round(avgScore) + '/100', avgScore >= 85 ? 'success' : 'warning')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทุกประเภท</button>
            ${Object.entries(AUDIT_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px">
            ${Object.entries(AUDIT_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- Audit list -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(a => {
            const at = AUDIT_TYPES[a.type]
            const as = AUDIT_STATUS[a.status]
            const isOverdue = a.status === 'overdue'
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${at?.color})${isOverdue?';background:var(--danger)08':''}">
              <div style="display:flex;justify-content:space-between;align-items:start">
                <div style="flex:1">
                  <div style="font-weight:700;font-size:0.87rem">${a.name}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">
                    👤 ${a.auditor} · 📍 ${a.area} · 📅 ${formatDate(a.scheduledDate)}
                  </div>
                  ${a.completedDate ? `<div style="font-size:0.72rem;color:var(--success)">✅ เสร็จ: ${formatDate(a.completedDate)}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${at?.color}" style="font-size:0.6rem">${at?.icon} ${at?.label}</span>
                  <span class="badge badge-${as?.color}" style="font-size:0.6rem">${as?.icon} ${as?.label}</span>
                  ${a.score !== null ? `<span style="font-size:0.8rem;font-weight:700;color:var(--${a.score>=85?'success':'warning'})">${a.score}/100</span>` : ''}
                </div>
              </div>
              ${a.findings > 0 ? `<div style="margin-top:6px;font-size:0.72rem;color:var(--warning)">⚠️ พบ ${a.findings} ข้อสังเกต</div>` : ''}
              <div style="display:flex;gap:6px;margin-top:8px">
                ${a.status === 'scheduled' ? `<button class="btn btn-xs btn-warning start-btn" data-id="${a.id}">▶️ เริ่ม</button>` : ''}
                ${a.status === 'in_progress' ? `<button class="btn btn-xs btn-success complete-btn" data-id="${a.id}">✅ เสร็จ</button>` : ''}
                ${a.status === 'overdue' ? `<button class="btn btn-xs btn-danger reschedule-btn" data-id="${a.id}">📅 เลื่อน</button>` : ''}
              </div>
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">ไม่มี Audit</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s === statusFilter ? 'all' : b.dataset.s; renderPage() }))
    container.querySelectorAll('.start-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('quality_audits', b.dataset.id, { status: 'in_progress' })
      showToast('🔄 เริ่มตรวจสอบแล้ว', 'warning'); await loadData()
    }))
    container.querySelectorAll('.complete-btn').forEach(b => b.addEventListener('click', () => {
      const a = audits.find(x => x.id === b.dataset.id)
      if (a) openCompleteForm(a)
    }))
    container.querySelectorAll('.reschedule-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('quality_audits', b.dataset.id, { scheduledDate: addDays(7), status: 'scheduled' })
      showToast('📅 เลื่อนกำหนดแล้ว', 'primary'); await loadData()
    }))
    document.getElementById('add-audit-btn')?.addEventListener('click', openAddForm)
  }

  function openCompleteForm(a) {
    openModal({
      title: '✅ บันทึกผลตรวจ — ' + a.name,
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">คะแนน (0-100) *</label><input class="input" type="number" id="cp-score" min="0" max="100" value="85"></div>
        <div class="input-group"><label class="input-label">จำนวนข้อสังเกต (findings)</label><input class="input" type="number" id="cp-findings" min="0" value="0"></div>
      </div>`,
      async onConfirm() {
        const score = +document.getElementById('cp-score')?.value
        const findings = +document.getElementById('cp-findings')?.value || 0
        if (isNaN(score) || score < 0 || score > 100) { showToast('❗ คะแนนต้อง 0-100', 'error'); return false }
        await updateDocData('quality_audits', a.id, { status: 'completed', completedDate: addDays(0), score, findings })
        showToast('✅ ปิด Audit แล้ว', 'success'); await loadData()
      }
    })
  }

  function openAddForm() {
    openModal({
      title: '+ สร้าง Audit ใหม่',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อ Audit *</label><input class="input" id="au-name"></div>
        <div class="input-group"><label class="input-label">ประเภท</label>
          <select class="input" id="au-type">${Object.entries(AUDIT_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">วันที่กำหนด</label><input class="input" type="date" id="au-date" value="${addDays(7)}"></div>
        <div class="input-group"><label class="input-label">ผู้ตรวจสอบ</label><input class="input" id="au-auditor"></div>
        <div class="input-group"><label class="input-label">พื้นที่/แผนก</label><input class="input" id="au-area"></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('au-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        await createDoc('quality_audits', {
          name, type: document.getElementById('au-type')?.value || 'internal', status: 'scheduled',
          auditor: document.getElementById('au-auditor')?.value || '—',
          area: document.getElementById('au-area')?.value || '—',
          scheduledDate: document.getElementById('au-date')?.value || addDays(7),
          completedDate: null, findings: 0, score: null,
        })
        showToast('✅ สร้าง Audit แล้ว', 'success'); await loadData()
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
