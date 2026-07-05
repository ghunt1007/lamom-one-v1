/**
 * Compliance Check — ตรวจสอบการปฏิบัติตามกฎ
 * Route: /quality/compliance
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const COMPLIANCE_CATS = {
  pdpa:     { label: 'PDPA', color: 'danger', icon: '🛡' },
  labor:    { label: 'แรงงาน', color: 'warning', icon: '👥' },
  tax:      { label: 'ภาษี', color: 'primary', icon: '🧾' },
  safety:   { label: 'ความปลอดภัย', color: 'danger', icon: '⛑' },
  ev_reg:   { label: 'EV Regulation', color: 'success', icon: '⚡' },
  finance:  { label: 'การเงิน', color: 'secondary', icon: '💰' },
  dealer:   { label: 'ดีลเลอร์', color: 'secondary', icon: '🏪' },
}

const CHECK_STATUS = {
  pass:    { label: 'ผ่าน', color: 'success', icon: '✅' },
  fail:    { label: 'ไม่ผ่าน', color: 'danger', icon: '❌' },
  partial: { label: 'บางส่วน', color: 'warning', icon: '⚠️' },
  na:      { label: 'N/A', color: 'secondary', icon: '—' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function ComplianceCheckPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let items = []
  let catFilter = 'all'
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { items = await listDocs('compliance_checklist', [], 'nextCheck', 'asc', 200) } catch (e) { items = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = items.filter(c => {
      if (catFilter !== 'all' && c.cat !== catFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      return true
    })
    const passed = items.filter(c => c.status === 'pass').length
    const failed = items.filter(c => c.status === 'fail').length
    const partial = items.filter(c => c.status === 'partial').length
    const score = items.length ? Math.round((passed + partial * 0.5) / items.length * 100) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">✅ Compliance Check</div>
            <div class="page-subtitle">ตรวจสอบการปฏิบัติตามกฎหมายและมาตรฐาน</div>
          </div>
        </div>

        <!-- Compliance Score -->
        <div class="card" style="padding:20px;margin-bottom:16px;display:flex;align-items:center;gap:24px">
          <div style="text-align:center;min-width:100px">
            <div style="font-size:2.5rem;font-weight:900;color:${score>=80?'var(--success)':score>=60?'var(--warning)':'var(--danger)'}">${score}%</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">Compliance Score</div>
          </div>
          <div style="flex:1">
            <div style="background:var(--surface-2);border-radius:6px;height:14px;margin-bottom:8px">
              <div style="width:${score}%;background:${score>=80?'var(--success)':score>=60?'var(--warning)':'var(--danger)'};height:14px;border-radius:6px;transition:width 0.5s"></div>
            </div>
            <div style="display:flex;gap:16px;font-size:0.8rem">
              <span style="color:var(--success)">✅ ผ่าน ${passed} รายการ</span>
              <span style="color:var(--warning)">⚠️ บางส่วน ${partial} รายการ</span>
              <span style="color:var(--danger)">❌ ไม่ผ่าน ${failed} รายการ</span>
            </div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
          ${kpi('📋 รายการทั้งหมด', items.length, 'primary')}
          ${kpi('✅ ผ่าน', passed, 'success')}
          ${kpi('⚠️ บางส่วน', partial, partial > 0 ? 'warning' : 'secondary')}
          ${kpi('❌ ไม่ผ่าน', failed, failed > 0 ? 'danger' : 'secondary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
          ${Object.entries(COMPLIANCE_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
          <div style="margin-left:auto;display:flex;gap:4px">
            ${Object.entries(CHECK_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(c => {
            const cat = COMPLIANCE_CATS[c.cat]
            const st = CHECK_STATUS[c.status]
            const isOverdue = new Date(c.nextCheck) < new Date()
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${st?.color})">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                <div style="display:flex;gap:12px;align-items:center;flex:1">
                  <div style="font-size:1.2rem">${st?.icon}</div>
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:0.87rem">${c.title}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">
                      ${cat?.icon} ${cat?.label} · รับผิดชอบ: ${c.owner}
                      · ตรวจถัดไป: <span style="color:${isOverdue?'var(--danger)':'inherit'}">${formatDate(c.nextCheck)}${isOverdue?' (เลยกำหนด!)':''}</span>
                    </div>
                    ${c.notes ? `<div style="font-size:0.75rem;color:var(--warning);margin-top:3px">⚠️ ${escHtml(c.notes)}</div>` : ''}
                  </div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <span class="badge badge-${c.criticality==='critical'?'danger':c.criticality==='high'?'warning':'secondary'}" style="font-size:0.62rem">${c.criticality}</span>
                  <button class="btn btn-xs btn-secondary update-btn" data-id="${c.id}">แก้ไข</button>
                </div>
              </div>
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">ไม่มีรายการ</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.update-btn').forEach(b => b.addEventListener('click', () => {
      const c = items.find(x => x.id === b.dataset.id); if (c) openUpdateModal(c)
    }))
  }

  function openUpdateModal(c) {
    const cat = COMPLIANCE_CATS[c.cat]
    openModal({
      title: `✅ อัพเดต: ${c.id}`,
      size: 'md',
      body: `
        <div style="font-weight:600;margin-bottom:8px">${c.title}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">${cat?.icon} ${cat?.label}</div>
        <div class="input-group"><label class="input-label">สถานะ</label>
          <select class="input" id="cu-status">
            ${Object.entries(CHECK_STATUS).filter(([k])=>k!=='na').map(([k,v])=>`<option value="${k}" ${c.status===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label>
          <textarea class="input" id="cu-notes" rows="3">${escHtml(c.notes || '')}</textarea>
        </div>
        <div class="input-group"><label class="input-label">ตรวจถัดไป</label>
          <input type="date" class="input" id="cu-next" value="${c.nextCheck}">
        </div>
      `,
      async onConfirm() {
        const status = document.getElementById('cu-status')?.value || c.status
        const notes = document.getElementById('cu-notes')?.value || ''
        const nextCheck = document.getElementById('cu-next')?.value || c.nextCheck
        await updateDocData('compliance_checklist', c.id, { status, notes, nextCheck, lastCheck: addDays(0) })
        showToast('✅ อัพเดตแล้ว!', 'success'); await loadData()
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
