import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatCurrency, initials, fullName, timeAgo } from '../../utils/format.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Kanban over the unified `customers` collection (stage-based pipeline).
// Only lead ⇄ pp is a valid drag target here — booking/delivered require the real actions
// (create a booking / mark it delivered) that live in the Customer Workspace & Bookings page.
const STAGES = [
  { key: 'lead',      label: '🧲 Lead',       color: 'accent',  bg: 'var(--accent-dim)',  droppable: true },
  { key: 'pp',        label: '📇 Prospect',   color: 'primary', bg: 'var(--primary-dim)', droppable: true },
  { key: 'booking',   label: '📝 จองแล้ว',    color: 'warning', bg: 'var(--warning-dim)', droppable: false },
  { key: 'delivered', label: '✅ ส่งมอบแล้ว', color: 'success', bg: 'var(--success-dim)', droppable: false },
]

export default async function PipelinePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let customers = []
  let dragging = null

  async function loadData() {
    try { customers = await listDocs('customers', [], 'createdAt', 'desc', 500) } catch { customers = [] }
    renderBoard()
  }

  function renderBoard() {
    const board = document.getElementById('pipeline-board')
    if (!board) return

    const active = customers.filter(c => !c.isLost)
    const totalBudget = active.reduce((s, c) => s + (c.budget || 0), 0)
    const el = document.getElementById('pipeline-total')
    if (el) el.textContent = `💰 มูลค่ารวม (งบประมาณลูกค้า): ${formatCurrency(totalBudget)}`

    board.innerHTML = STAGES.map(stage => {
      const cards = active.filter(c => c.stage === stage.key)
      const stageValue = cards.reduce((s, c) => s + (c.budget || 0), 0)
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
            <div style="font-size:0.72rem;color:var(--text-muted)">${formatCurrency(stageValue)}${!stage.droppable ? ' · อ่านอย่างเดียว' : ''}</div>
          </div>
          <!-- Cards Drop Zone -->
          <div class="pipeline-drop" data-stage="${stage.key}" data-droppable="${stage.droppable}" style="
            flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px;
            min-height:80px;
          ">
            ${cards.map(c => cardHTML(c, stage)).join('')}
            ${!cards.length ? `<div class="drop-placeholder" style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:16px;text-align:center;color:var(--text-muted);font-size:0.78rem">${stage.droppable ? 'ลากลูกค้ามาวางที่นี่' : 'ไม่มีรายการ'}</div>` : ''}
          </div>
        </div>
      `
    }).join('')

    bindDragDrop()
    bindCardEvents()
  }

  function cardHTML(c, stage) {
    return `
      <div class="pipeline-card" draggable="${stage.droppable}" data-id="${c.id}"
        style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);
               padding:10px 12px;cursor:${stage.droppable ? 'grab' : 'pointer'};transition:all 150ms;border-left:3px solid var(--${stage.color})">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div class="avatar avatar-sm" style="background:var(--${stage.color}-dim);color:var(--${stage.color});font-size:0.75rem;flex-shrink:0">${escHtml(initials(c.firstName, c.lastName))}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:0.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(fullName(c))}${c.vip ? ' ⭐' : ''}</div>
          </div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">🚗 ${escHtml(c.interestedModel || '-')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:0.78rem;font-weight:600;color:var(--accent)">${c.budget ? '฿' + Number(c.budget).toLocaleString() : '-'}</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${timeAgo(c.createdAt)}</span>
        </div>
      </div>
    `
  }

  function bindDragDrop() {
    document.querySelectorAll('.pipeline-card[draggable="true"]').forEach(card => {
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
        if (zone.dataset.droppable !== 'true') return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        zone.style.background = 'var(--primary-dim)'
      })
      zone.addEventListener('dragleave', () => { zone.style.background = '' })
      zone.addEventListener('drop', async e => {
        e.preventDefault()
        zone.style.background = ''
        if (!dragging) return
        if (zone.dataset.droppable !== 'true') {
          showToast('📝 การเปลี่ยนเป็น "จองแล้ว/ส่งมอบแล้ว" ต้องทำผ่านหน้าลูกค้า (สร้างใบจอง) หรือหน้าจองรถ (ปรับสถานะส่งมอบ)', 'warning')
          return
        }
        const newStage = zone.dataset.stage
        const c = customers.find(x => x.id === dragging)
        if (!c || c.stage === newStage) return
        const oldStage = c.stage
        c.stage = newStage
        renderBoard()
        try {
          await updateDocData('customers', c.id, { stage: newStage, stageChangedAt: new Date().toISOString() })
          showToast(`✅ ย้าย ${fullName(c)} → ${STAGES.find(s => s.key === newStage)?.label}`, 'success')
        } catch {
          c.stage = oldStage
          renderBoard()
          showToast('บันทึกไม่สำเร็จ', 'error')
        }
      })
    })
  }

  function bindCardEvents() {
    document.querySelectorAll('.pipeline-card').forEach(card => {
      card.addEventListener('click', () => {
        const c = customers.find(x => x.id === card.dataset.id)
        if (c) showCustomerQuick(c)
      })
    })
  }

  function showCustomerQuick(c) {
    const stage = STAGES.find(s => s.key === c.stage)
    const nextStage = stage?.droppable ? STAGES[STAGES.findIndex(s => s.key === c.stage) + 1] : null

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
          <div style="font-weight:700;font-size:1rem">${escHtml(fullName(c))}</div>
          <span class="badge badge-${stage?.color || 'secondary'}" style="margin-top:4px">${stage?.label || escHtml(c.stage)}</span>
        </div>
        <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem" id="qp-close">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:0.83rem;margin-bottom:14px">
        <div>🚗 ${escHtml(c.interestedModel || '-')}</div>
        <div>💰 ${c.budget ? '฿' + Number(c.budget).toLocaleString() : '-'}</div>
        <div>📱 ${escHtml(c.phone || '-')}</div>
      </div>
      <div style="display:flex;gap:8px">
        ${nextStage ? `<button class="btn btn-primary btn-sm" id="qp-next" style="flex:1;justify-content:center">→ ${nextStage.label}</button>` : ''}
        <button class="btn btn-secondary btn-sm" id="qp-detail" style="flex:1;justify-content:center">ดูรายละเอียด</button>
      </div>
    `
    document.body.appendChild(popup)
    popup.querySelector('#qp-close').addEventListener('click', () => popup.remove())
    popup.querySelector('#qp-detail').addEventListener('click', () => { popup.remove(); navigate('/crm/customers') })
    popup.querySelector('#qp-next')?.addEventListener('click', async () => {
      if (!nextStage) return
      try {
        c.stage = nextStage.key
        await updateDocData('customers', c.id, { stage: nextStage.key, stageChangedAt: new Date().toISOString() })
        showToast(`✅ เลื่อนเป็น ${nextStage.label}`, 'success')
        popup.remove(); renderBoard()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
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
          <button class="btn btn-primary" id="pl-add-btn">➕ เพิ่มลูกค้า</button>
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

  document.getElementById('pl-list-btn').addEventListener('click', () => navigate('/crm/customers'))
  document.getElementById('pl-add-btn').addEventListener('click', () => navigate('/crm/customers'))

  if (container.__routerGen === myGen) await loadData()
}
