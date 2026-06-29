import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatCurrency, initials, fullName, timeAgo } from '../../utils/format.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STAGES = [
  { key:'new',        label:'🆕 ใหม่',         color:'primary', bg:'var(--primary-dim)' },
  { key:'contacted',  label:'📞 ติดต่อแล้ว',   color:'primary', bg:'var(--primary-dim)' },
  { key:'interested', label:'💡 สนใจ',          color:'warning', bg:'var(--warning-dim)' },
  { key:'qualified',  label:'⭐ Qualified',     color:'accent',  bg:'var(--accent-dim)' },
  { key:'booking',    label:'📝 จอง',           color:'success', bg:'var(--success-dim)' },
]

const DEMO_LEADS = [
  { id:'ld1', firstName:'ธีรพงศ์', lastName:'แสงทอง', status:'new', interestedModel:'BYD Atto 3', budget:1200000, createdAt: new Date(Date.now()-3600000*2).toISOString() },
  { id:'ld2', firstName:'อรนุช', lastName:'พรหมมา', status:'contacted', interestedModel:'MG4', budget:900000, createdAt: new Date(Date.now()-86400000).toISOString() },
  { id:'ld3', firstName:'กิตติพงษ์', lastName:'วรรณศิลป์', status:'interested', interestedModel:'DEEPAL S7', budget:1500000, createdAt: new Date(Date.now()-86400000*2).toISOString() },
  { id:'ld4', firstName:'พิมพ์ชนก', lastName:'ทองสุข', status:'qualified', interestedModel:'BYD Seal', budget:1300000, createdAt: new Date(Date.now()-86400000*3).toISOString() },
  { id:'ld6', firstName:'สุภาพร', lastName:'ใจดี', status:'new', interestedModel:'NETA V', budget:800000, createdAt: new Date(Date.now()-3600000*5).toISOString() },
]

export default async function PipelinePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let leads = []
  let dragging = null

  async function loadData() {
    try { leads = await listDocs('leads', [], 'createdAt', 'desc', 500) } catch {}
    const active = leads.filter(l => l.status !== 'lost')
    if (!active.length) DEMO_LEADS.forEach(l => leads.push({ ...l }))
    renderBoard()
  }

  function renderBoard() {
    const board = document.getElementById('pipeline-board')
    if (!board) return

    // Update stats
    const totalBudget = leads.filter(l => l.status !== 'lost').reduce((s, l) => s + (l.budget || 0), 0)
    const el = document.getElementById('pipeline-total')
    if (el) el.textContent = `💰 มูลค่าดีลรวม: ${formatCurrency(totalBudget)}`

    board.innerHTML = STAGES.map(stage => {
      const cards = leads.filter(l => l.status === stage.key)
      const stageValue = cards.reduce((s, l) => s + (l.budget || 0), 0)
      return `
        <div class="pipeline-col" data-stage="${stage.key}" style="
          min-width:220px; flex:1; max-width:260px;
          background:var(--surface-2); border-radius:var(--radius-lg);
          display:flex; flex-direction:column; max-height:calc(100vh - 240px);
        ">
          <!-- Column Header -->
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);flex-shrink:0">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span style="font-weight:700;font-size:0.875rem;color:var(--${stage.color})">${stage.label}</span>
              <span class="badge badge-${stage.color}">${cards.length}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${formatCurrency(stageValue)}</div>
          </div>
          <!-- Cards Drop Zone -->
          <div class="pipeline-drop" data-stage="${stage.key}" style="
            flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px;
            min-height:80px;
          ">
            ${cards.map(l => cardHTML(l, stage)).join('')}
            ${!cards.length ? `<div class="drop-placeholder" style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:16px;text-align:center;color:var(--text-muted);font-size:0.78rem">ลาก Lead มาวางที่นี่</div>` : ''}
          </div>
        </div>
      `
    }).join('')

    bindDragDrop()
    bindCardEvents()
  }

  function cardHTML(l, stage) {
    return `
      <div class="pipeline-card" draggable="true" data-id="${l.id}"
        style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);
               padding:10px 12px;cursor:grab;transition:all 150ms;border-left:3px solid var(--${stage.color})">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div class="avatar avatar-sm" style="background:var(--${stage.color}-dim);color:var(--${stage.color});font-size:0.75rem;flex-shrink:0">${escHtml(initials(l.firstName, l.lastName))}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:0.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(fullName(l))}</div>
          </div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">🚗 ${escHtml(l.interestedModel || '-')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:0.78rem;font-weight:600;color:var(--accent)">${l.budget ? '฿' + Number(l.budget).toLocaleString() : '-'}</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${timeAgo(l.createdAt)}</span>
        </div>
      </div>
    `
  }

  function bindDragDrop() {
    document.querySelectorAll('.pipeline-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        dragging = card.dataset.id
        card.style.opacity = '0.4'
        e.dataTransfer.effectAllowed = 'move'
      })
      card.addEventListener('dragend', () => {
        card.style.opacity = '1'
        dragging = null
        document.querySelectorAll('.pipeline-drop').forEach(z => z.style.background = '')
      })
    })

    document.querySelectorAll('.pipeline-drop').forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        zone.style.background = 'var(--primary-dim)'
      })
      zone.addEventListener('dragleave', () => { zone.style.background = '' })
      zone.addEventListener('drop', async e => {
        e.preventDefault()
        zone.style.background = ''
        if (!dragging) return
        const newStage = zone.dataset.stage
        const lead = leads.find(l => l.id === dragging)
        if (!lead || lead.status === newStage) return
        const oldStage = lead.status
        lead.status = newStage
        renderBoard()
        try {
          await updateDocData('leads', lead.id, { status: newStage })
          showToast(`✅ ย้าย ${fullName(lead)} → ${STAGES.find(s => s.key === newStage)?.label}`, 'success')
        } catch {
          lead.status = oldStage
          renderBoard()
          showToast('บันทึกไม่สำเร็จ', 'error')
        }
      })
    })
  }

  function bindCardEvents() {
    document.querySelectorAll('.pipeline-card').forEach(card => {
      card.addEventListener('click', () => {
        const l = leads.find(x => x.id === card.dataset.id)
        if (l) showLeadQuick(l)
      })
    })
  }

  function showLeadQuick(l) {
    const stage = STAGES.find(s => s.key === l.status)
    const nextStage = STAGES[STAGES.findIndex(s => s.key === l.status) + 1]

    // Quick popup (not full modal)
    const existing = document.getElementById('lead-quick-popup')
    if (existing) existing.remove()

    const popup = document.createElement('div')
    popup.id = 'lead-quick-popup'
    popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:400;
      background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);
      padding:20px;width:300px;box-shadow:0 12px 48px rgba(0,0,0,0.5);animation:slideDown 150ms ease`
    popup.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div>
          <div style="font-weight:700;font-size:1rem">${escHtml(fullName(l))}</div>
          <span class="badge badge-${stage?.color||'secondary'}" style="margin-top:4px">${stage?.label||escHtml(l.status)}</span>
        </div>
        <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem" id="qp-close">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:0.83rem;margin-bottom:14px">
        <div>🚗 ${escHtml(l.interestedModel || '-')}</div>
        <div>💰 ${l.budget ? '฿' + Number(l.budget).toLocaleString() : '-'}</div>
        <div>📱 ${escHtml(l.phone || '-')}</div>
      </div>
      <div style="display:flex;gap:8px">
        ${nextStage ? `<button class="btn btn-primary btn-sm" id="qp-next" style="flex:1;justify-content:center">→ ${nextStage.label}</button>` : ''}
        <button class="btn btn-secondary btn-sm" id="qp-detail" style="flex:1;justify-content:center">ดูรายละเอียด</button>
      </div>
    `
    document.body.appendChild(popup)
    popup.querySelector('#qp-close').addEventListener('click', () => popup.remove())
    popup.querySelector('#qp-detail').addEventListener('click', () => { popup.remove(); navigate('/crm/leads') })
    popup.querySelector('#qp-next')?.addEventListener('click', async () => {
      if (!nextStage) return
      try {
        l.status = nextStage.key
        await updateDocData('leads', l.id, { status: nextStage.key })
        showToast(`✅ เลื่อนเป็น ${nextStage.label}`, 'success')
        popup.remove(); renderBoard()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    })
    setTimeout(() => document.addEventListener('click', function h(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', h) }
    }), 100)
  }

  container.innerHTML = `
    <div class="page-content animate-slide" style="display:flex;flex-direction:column;height:calc(100vh - 56px);overflow:hidden">
      <div class="page-header" style="flex-shrink:0">
        <div>
          <div class="page-title">📋 Sales Pipeline</div>
          <div class="page-subtitle" id="pipeline-total">กำลังโหลด...</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="pl-list-btn">📋 List View</button>
          <button class="btn btn-primary" id="pl-add-btn">➕ เพิ่ม Lead</button>
        </div>
      </div>

      <!-- Board -->
      <div id="pipeline-board" style="display:flex;gap:12px;overflow-x:auto;flex:1;padding-bottom:16px;align-items:flex-start">
        ${STAGES.map(() => `<div class="skeleton" style="min-width:220px;height:300px;border-radius:var(--radius-lg)"></div>`).join('')}
      </div>
    </div>
  `

  if (!document.getElementById('pipeline-style')) {
    const s = document.createElement('style')
    s.id = 'pipeline-style'
    s.textContent = `
      .pipeline-card:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.3); }
      .pipeline-card:active { cursor:grabbing; }
      .pipeline-board-wrap::-webkit-scrollbar { height:6px; }
    `
    document.head.appendChild(s)
  }

  document.getElementById('pl-list-btn').addEventListener('click', () => navigate('/crm/leads'))
  document.getElementById('pl-add-btn').addEventListener('click', () => navigate('/crm/leads'))

  if (container.__routerGen === myGen) await loadData()
}
