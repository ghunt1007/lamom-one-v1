// Unified Customer Workspace — merges the old Customers.js + Leads.js into one page/collection.
// Route: /crm/customers (also aliased from /crm/leads — see router.js)
// Collection: `customers` — single source of truth, stage-based pipeline (lead → pp → booking → delivered)
import { listDocs, createDoc, updateDocData, softDelete, readDoc, seedDemoData } from '../../core/db.js'
import { showToast, getState } from '../../core/store.js'
import { formatDate, timeAgo, formatPhone, formatCurrency, initials, fullName } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel, openImportModal } from '../../utils/importExport.js'
import { SmartSheet } from '../../components/SmartSheet.js'
import { navigate } from '../../core/router.js'
import { getSalesStaff } from '../../data/masterData.js'
import {
  getFollowUpRecommendation, getBookingDiagnosis, isModelInStock,
  deriveInitialStage, shouldAutoPromoteToPP,
} from '../../core/customerInsights.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STAGE = {
  lead:      { label: '🧲 Lead',        short: 'Lead',       badge: 'accent',  color: '#06B6D4' },
  pp:        { label: '📇 Prospect',    short: 'Prospect',   badge: 'primary', color: '#5B9BFF' },
  booking:   { label: '📝 จองแล้ว',     short: 'จองแล้ว',    badge: 'warning', color: '#F59E0B' },
  delivered: { label: '✅ ส่งมอบแล้ว',  short: 'ส่งมอบแล้ว', badge: 'success', color: '#10B981' },
}
const STAGE_ORDER = ['lead', 'pp', 'booking', 'delivered']

const TEMP = {
  hot:  { label: '🔴 Hot',  badge: 'danger' },
  warm: { label: '🟡 Warm', badge: 'warning' },
  cold: { label: '🔵 Cold', badge: 'accent' },
}

const SOURCE = {
  facebook: '📘 Facebook', line: '💚 LINE', tiktok: '🎵 TikTok', 'walk-in': '🚶 Walk-in',
  referral: '🤝 Referral', google: '🔍 Google', website: '🌐 Website', phone: '📱 โทรเข้า', other: '📌 อื่นๆ',
}

const URGENCY = {
  high:   { label: '🔥 ด่วน',    badge: 'danger' },
  medium: { label: '⏱ ปานกลาง', badge: 'warning' },
  low:    { label: '· ปกติ',    badge: 'secondary' },
}

const LOG_ICONS = { call: '📞', line: '💚', email: '📧', visit: '🚶', note: '📝' }
const LOG_LABELS = { call: 'โทรศัพท์', line: 'LINE', visit: 'เข้าโชว์รูม', email: 'Email', note: 'Note' }
const NOTE_TYPE_ICONS = { call: '📞', visit: '🤝', chat: '💬', email: '📧', internal: '📌' }
const NOTE_TYPE_LABELS = { call: 'โทรศัพท์', visit: 'เข้าพบ', chat: 'แชท/LINE', email: 'อีเมล', internal: 'บันทึกภายใน' }

export default async function CustomersPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let customers = []
  let filtered = []
  let search = ''
  let stageFilter = 'all'
  let lostOnly = false

  async function loadData() {
    try { customers = await listDocs('customers', [], 'createdAt', 'desc', 400) } catch { customers = [] }
    applyFilter()
  }

  function quickUrgency(c) {
    try { return getFollowUpRecommendation(c, []).urgency } catch { return 'low' }
  }

  function applyFilter() {
    filtered = customers.filter(c => {
      const name = fullName(c).toLowerCase()
      const matchSearch = !search || name.includes(search) ||
        (c.phone || '').includes(search) || (c.lineId || '').toLowerCase().includes(search) ||
        (c.interestedModel || '').toLowerCase().includes(search)
      const matchStage = stageFilter === 'all' || c.stage === stageFilter
      const matchLost = !lostOnly || c.isLost
      return matchSearch && matchStage && matchLost
    })
    const rank = { high: 0, medium: 1, low: 2 }
    filtered.sort((a, b) => {
      if (!!a.isLost !== !!b.isLost) return a.isLost ? 1 : -1
      const ua = rank[quickUrgency(a)], ub = rank[quickUrgency(b)]
      if (ua !== ub) return ua - ub
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })
    renderStats()
    renderTable()
  }

  function renderStats() {
    STAGE_ORDER.forEach(k => {
      const el = document.getElementById(`stat-${k}`)
      if (el) el.textContent = customers.filter(c => c.stage === k && !c.isLost).length
    })
    const lostEl = document.getElementById('stat-lost')
    if (lostEl) lostEl.textContent = customers.filter(c => c.isLost).length
    const countEl = document.getElementById('cust-count')
    if (countEl) countEl.textContent = `${filtered.length} / ${customers.length} รายการ`
  }

  function renderTable() {
    const tbody = document.getElementById('cust-tbody')
    if (!tbody) return
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">ไม่พบลูกค้า</div><div class="empty-desc">${search ? 'ลองเปลี่ยนคำค้นหา' : 'เริ่มเพิ่มลูกค้าคนแรก'}</div></div></td></tr>`
      return
    }
    tbody.innerHTML = filtered.map(c => {
      const st = STAGE[c.stage] || { label: c.stage, badge: 'secondary' }
      const urgency = URGENCY[quickUrgency(c)]
      return `
      <tr class="cust-row ${c.isLost ? 'is-lost' : ''}" data-id="${c.id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar avatar-md" style="background:${avatarColor(c)};color:#fff">${escHtml(initials(c.firstName, c.lastName))}</div>
            <div>
              <div style="font-weight:600;color:var(--text)">${escHtml(fullName(c))}${c.vip ? ' <span title="VIP">⭐</span>' : ''}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(c.email || '')}</div>
            </div>
          </div>
        </td>
        <td>${formatPhone(c.phone) || '<span style="color:var(--text-muted)">-</span>'}${c.lineId ? `<div style="font-size:0.7rem;color:var(--text-muted)">💚 ${escHtml(c.lineId)}</div>` : ''}</td>
        <td>
          <span class="badge badge-${st.badge}">${st.label}</span>
          ${c.isLost ? `<div style="margin-top:3px"><span class="badge badge-secondary" style="font-size:0.62rem">⬛ เสียดีล</span></div>` : ''}
        </td>
        <td>${c.temperature ? `<span class="badge badge-${TEMP[c.temperature]?.badge}" style="font-size:0.68rem">${TEMP[c.temperature]?.label}</span>` : '<span style="color:var(--text-muted)">-</span>'}</td>
        <td style="color:var(--text-2)">${escHtml(c.interestedModel || '-')}</td>
        <td style="color:var(--text-3);font-size:0.8rem">${SOURCE[c.source] || escHtml(c.source) || '-'}</td>
        <td>${!c.isLost ? `<span class="badge badge-${urgency.badge}" style="font-size:0.65rem">${urgency.label}</span>` : ''}</td>
        <td style="color:var(--text-muted);font-size:0.8rem">${timeAgo(c.createdAt)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${c.id}" title="แก้ไข">✏️</button>
            <button class="btn btn-ghost btn-sm del-btn" data-id="${c.id}" title="ลบ" style="color:var(--danger)">🗑</button>
          </div>
        </td>
      </tr>
    `}).join('')

    tbody.querySelectorAll('.cust-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.edit-btn,.del-btn')) return
        const c = filtered.find(x => x.id === row.dataset.id)
        if (c) openDetail(c)
      })
    })
    tbody.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const c = customers.find(x => x.id === btn.dataset.id)
        if (c) openForm(c)
      })
    )
    tbody.querySelectorAll('.del-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        const c = customers.find(x => x.id === btn.dataset.id)
        const ok = await confirmDialog({ title: 'ลบลูกค้า', message: `ต้องการลบ "${fullName(c)}"? (กู้คืนได้ใน 30 วัน)`, confirmText: 'ลบ', danger: true })
        if (!ok) return
        try {
          await softDelete('customers', c.id)
          showToast(`ลบ ${fullName(c)} แล้ว`, 'success')
          await loadData()
        } catch { showToast('เกิดข้อผิดพลาด', 'error') }
      })
    )
  }

  // ── Detail Workspace — everything about this customer, one place, no page-hopping ──
  async function openDetail(c) {
    const { el, close } = openModal({
      title: `👤 ${fullName(c)}`,
      size: 'xl',
      body: `
        <div class="grid-2" style="gap:24px;align-items:flex-start">
          <div style="display:flex;flex-direction:column;gap:18px">
            <div>
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
                <div class="avatar avatar-xl" style="background:${avatarColor(c)};color:#fff;font-size:1.4rem">${escHtml(initials(c.firstName, c.lastName))}</div>
                <div>
                  <div style="font-size:1.2rem;font-weight:700">${escHtml(fullName(c))}${c.vip ? ' ⭐' : ''}</div>
                  <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                    <span class="badge badge-${STAGE[c.stage]?.badge || 'secondary'}">${STAGE[c.stage]?.label || escHtml(c.stage)}</span>
                    ${c.temperature ? `<span class="badge badge-${TEMP[c.temperature]?.badge}">${TEMP[c.temperature]?.label}</span>` : ''}
                    ${c.isLost ? `<span class="badge badge-secondary">⬛ เสียดีล</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${detail('📱 โทร', formatPhone(c.phone) || '-')}
                ${detail('💚 LINE', escHtml(c.lineId || '-'))}
                ${detail('📧 Email', escHtml(c.email || '-'))}
                ${detail('🚗 สนใจ', escHtml(c.interestedModel || '-'))}
                ${detail('💰 งบประมาณ', c.budget ? formatCurrency(c.budget) : '-')}
                ${detail('📌 ที่มา', SOURCE[c.source] || escHtml(c.source) || '-')}
                ${detail('👤 ผู้ดูแล', escHtml(c.assignedTo || '-'))}
                ${detail('📅 เพิ่มเมื่อ', formatDate(c.createdAt))}
                ${c.isLost ? detail('❌ เหตุผลเสียดีล', escHtml(c.lostReason || '-')) : ''}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">
                <button class="btn btn-secondary btn-sm" id="wk-edit-btn">✏️ แก้ไขข้อมูล</button>
                ${c.stage === 'lead' && (c.phone || c.lineId) ? `<button class="btn btn-primary btn-sm" id="wk-promote-btn">📇 มาร์คเป็น Prospect</button>` : ''}
                ${!c.isLost ? `<button class="btn btn-ghost btn-sm" id="wk-lost-btn" style="color:var(--danger)">⬛ มาร์คเสียดีล</button>` : `<button class="btn btn-ghost btn-sm" id="wk-unlost-btn">↩️ ยกเลิกเสียดีล</button>`}
              </div>
            </div>

            <div id="wk-followup-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🧭 คำแนะนำการติดตาม</div>
              <div class="skeleton" style="height:56px;border-radius:10px"></div>
            </div>

            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-weight:600;font-size:0.85rem">📝 ไทม์ไลน์การติดต่อ</span>
                <button class="btn btn-secondary btn-xs" id="add-comm-btn">➕ บันทึกการติดต่อ</button>
              </div>
              <div id="wk-timeline" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto">
                <div class="skeleton" style="height:48px;border-radius:10px"></div>
                <div class="skeleton" style="height:48px;border-radius:10px"></div>
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:18px">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" id="wk-quote-btn">🧾 สร้างใบเสนอราคา</button>
              ${!c.bookingId && !c.isLost && c.stage !== 'lead' ? `<button class="btn btn-primary btn-sm" id="wk-booking-btn">📝 สร้างใบจอง</button>` : ''}
            </div>

            <div id="wk-booking-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🚗 ใบจองที่เชื่อมโยง</div>
              ${c.bookingId ? `<div class="skeleton" style="height:90px;border-radius:10px"></div>` : `<div class="empty-state" style="padding:16px"><div class="empty-icon" style="font-size:1.4rem">📋</div><div class="empty-title" style="font-size:0.82rem">ยังไม่มีใบจอง</div></div>`}
            </div>

            <div id="wk-quote-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🧾 ใบเสนอราคาที่เกี่ยวข้อง</div>
              <div class="skeleton" style="height:40px;border-radius:10px"></div>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
        <button class="btn btn-danger" id="wk-delete-btn">🗑️ ลบลูกค้า</button>
      `,
    })

    el.querySelector('#wk-edit-btn')?.addEventListener('click', () => {
      close(); openForm(c, { onSaved: updated => openDetail(updated) })
    })
    el.querySelector('#wk-promote-btn')?.addEventListener('click', async () => {
      try {
        const patch = { stage: 'pp', stageChangedAt: new Date().toISOString() }
        await updateDocData('customers', c.id, patch)
        Object.assign(c, patch)
        showToast('🎉 อัปเกรดเป็น Prospect อัตโนมัติ (ได้เบอร์ติดต่อ/LINE แล้ว)', 'success')
        close(); await loadData(); openDetail(c)
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
    el.querySelector('#wk-lost-btn')?.addEventListener('click', () => openLostModal(c, () => { close(); loadData().then(() => openDetail(c)) }))
    el.querySelector('#wk-unlost-btn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ยกเลิกสถานะเสียดีล', message: `นำ "${fullName(c)}" กลับมาเป็นลูกค้าที่ยังติดตามอยู่?`, confirmText: 'ยกเลิกเสียดีล' })
      if (!ok) return
      try {
        const patch = { isLost: false, lostReason: '', lostAt: null }
        await updateDocData('customers', c.id, patch)
        Object.assign(c, patch)
        showToast('↩️ ยกเลิกสถานะเสียดีลแล้ว', 'success')
        close(); await loadData(); openDetail(c)
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
    el.querySelector('#wk-delete-btn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบลูกค้า', message: `ต้องการลบ "${fullName(c)}"? (กู้คืนได้ใน 30 วัน)`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('customers', c.id)
        showToast(`ลบ ${fullName(c)} แล้ว`, 'success')
        close(); await loadData()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
    el.querySelector('#add-comm-btn')?.addEventListener('click', () => openCommForm(c, () => refreshTimeline(c)))
    el.querySelector('#wk-quote-btn')?.addEventListener('click', () => {
      sessionStorage.setItem('lamom_quote_prefill', JSON.stringify({
        customerId: c.id, customerName: fullName(c), phone: c.phone || '', email: c.email || '',
        lineId: c.lineId || '', interestedModel: c.interestedModel || '',
      }))
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
      navigate('/crm/quotation')
    })
    el.querySelector('#wk-booking-btn')?.addEventListener('click', () => openCreateBookingModal(c, updated => { close(); loadData().then(() => openDetail(updated)) }))

    refreshTimeline(c)
    refreshFollowup(c)
    refreshBookingPanel(c)
    refreshQuotePanel(c)
  }

  async function refreshTimeline(c) {
    const el = document.getElementById('wk-timeline')
    if (!el) return
    let logs = [], notes = []
    try { logs = await listDocs('comm_logs', [['customerId', '==', c.id]], 'createdAt', 'desc', 30) } catch {}
    try { notes = await listDocs('customer_notes', [], 'time', 'desc', 300) } catch {}
    notes = notes.filter(n => n.customer === fullName(c))
    const merged = [
      ...logs.map(l => ({ ts: l.createdAt, icon: LOG_ICONS[l.type] || '📌', label: LOG_LABELS[l.type] || l.type, text: l.note || '' })),
      ...notes.map(n => ({ ts: n.time, icon: NOTE_TYPE_ICONS[n.type] || '📌', label: NOTE_TYPE_LABELS[n.type] || n.type, text: n.text || '', pinned: n.pinned })),
    ].sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0))
    if (!document.getElementById('wk-timeline')) return
    if (!merged.length) { el.innerHTML = `<div class="empty-state" style="padding:12px"><div class="empty-icon" style="font-size:1.5rem">📝</div><div class="empty-title" style="font-size:0.85rem">ยังไม่มีบันทึก</div></div>`; return }
    el.innerHTML = merged.map(m => `
      <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px 12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span>${m.icon}</span>
          <span style="font-weight:600;font-size:0.78rem">${escHtml(m.label)}</span>
          ${m.pinned ? '<span style="font-size:0.7rem">📌</span>' : ''}
          <span style="margin-left:auto;font-size:0.72rem;color:var(--text-muted)">${timeAgo(m.ts)}</span>
        </div>
        <div style="font-size:0.825rem;color:var(--text-2)">${escHtml(m.text)}</div>
      </div>
    `).join('')
  }

  async function refreshFollowup(c) {
    const el = document.getElementById('wk-followup-panel')
    if (!el) return
    let commLogs = []
    try { commLogs = await listDocs('comm_logs', [['customerId', '==', c.id]], 'createdAt', 'desc', 30) } catch {}
    let stockAvailable = null
    let overBudget = false
    try {
      const vehicles = await listDocs('vehicles', [], 'arrivedAt', 'desc', 500)
      if (c.interestedModel) {
        stockAvailable = isModelInStock(c.interestedModel, vehicles)
        const needle = c.interestedModel.toLowerCase()
        const match = vehicles.find(v => `${v.brand || ''} ${v.model || ''} ${v.variant || ''}`.toLowerCase().includes(needle))
        if (c.budget && match?.price) overBudget = c.budget < match.price * 0.9
      }
    } catch {}
    const rec = getFollowUpRecommendation(c, commLogs, { stockAvailable, overBudget })
    const u = URGENCY[rec.urgency] || URGENCY.low
    if (!document.getElementById('wk-followup-panel')) return
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🧭 คำแนะนำการติดตาม</div>
      <div class="card" style="padding:12px 14px;border-left:3px solid var(--${u.badge})">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span class="badge badge-${u.badge}" style="font-size:0.68rem">${u.label}</span>
          ${rec.diagnosedProblem ? `<span style="font-size:0.72rem;color:var(--text-muted)">🔎 ${escHtml(rec.diagnosedProblem)}</span>` : ''}
        </div>
        <div style="font-size:0.82rem;color:var(--text-2);line-height:1.5">${escHtml(rec.recommendation)}</div>
      </div>
    `
  }

  async function refreshBookingPanel(c) {
    const el = document.getElementById('wk-booking-panel')
    if (!el) return
    if (!c.bookingId) {
      el.innerHTML = `<div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🚗 ใบจองที่เชื่อมโยง</div><div class="empty-state" style="padding:16px"><div class="empty-icon" style="font-size:1.4rem">📋</div><div class="empty-title" style="font-size:0.82rem">ยังไม่มีใบจอง</div></div>`
      return
    }
    let booking = null
    try { booking = await readDoc('bookings', c.bookingId) } catch {}
    if (!document.getElementById('wk-booking-panel')) return
    if (!booking) {
      el.innerHTML = `<div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🚗 ใบจองที่เชื่อมโยง</div><div style="font-size:0.8rem;color:var(--text-muted)">⚠️ ไม่พบใบจอง (อาจถูกลบ)</div>`
      return
    }
    const diag = getBookingDiagnosis(booking)
    const blockerBadge = diag.blockerType === 'none' ? 'success' : diag.blockerType === 'finance_rejected' ? 'danger' : 'warning'
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🚗 ใบจองที่เชื่อมโยง</div>
      <div class="card" style="padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;font-size:0.85rem;color:var(--primary)">${escHtml(booking.bookingNo || '')}</span>
          <span style="font-size:0.78rem;font-weight:700;color:var(--accent)">${formatCurrency(booking.price || 0)}</span>
        </div>
        ${detail('รุ่นรถ', escHtml(`${booking.brand || ''} ${booking.model || ''} ${booking.variant || ''}`.trim() || '-'))}
        ${detail('สถานะ', escHtml(booking.status || '-'))}
        ${detail('ไฟแนนซ์', escHtml(booking.finStatus || '-'))}
        ${detail('นัดส่งมอบ', formatDate(booking.deliveryDate))}
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span class="badge badge-${blockerBadge}" style="font-size:0.66rem">${escHtml(diag.message)}</span>
          </div>
          ${diag.suggestedAction && diag.suggestedAction !== '-' ? `<div style="font-size:0.78rem;color:var(--text-2)">💡 ${escHtml(diag.suggestedAction)}</div>` : ''}
          ${c.stage === 'delivered' ? `<div style="margin-top:6px;display:flex;gap:6px"><button class="btn btn-ghost btn-xs" id="wk-followup-link">📞 Follow-up</button><button class="btn btn-ghost btn-xs" id="wk-winback-link">💝 Win-Back</button></div>` : ''}
        </div>
        <button class="btn btn-secondary btn-sm" id="wk-view-booking" style="margin-top:10px;width:100%;justify-content:center">🔗 ดูรายการใบจองทั้งหมด</button>
      </div>
    `
    document.getElementById('wk-view-booking')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); navigate('/crm/bookings') })
    document.getElementById('wk-followup-link')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); navigate('/crm/followup') })
    document.getElementById('wk-winback-link')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); navigate('/crm/winback') })
  }

  async function refreshQuotePanel(c) {
    const el = document.getElementById('wk-quote-panel')
    if (!el) return
    let quotes = []
    try { quotes = await listDocs('quotations', [['customerId', '==', c.id]], 'createdAt', 'desc', 20) } catch { quotes = [] }
    if (!document.getElementById('wk-quote-panel')) return
    if (!quotes.length) {
      el.innerHTML = `<div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🧾 ใบเสนอราคาที่เกี่ยวข้อง</div><div style="font-size:0.8rem;color:var(--text-muted)">ยังไม่มีใบเสนอราคา</div>`
      return
    }
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🧾 ใบเสนอราคาที่เกี่ยวข้อง</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${quotes.map(q => `
          <div class="card" style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:0.8rem;font-weight:600">${escHtml(q.quoteNo || q.id)}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(q.model || q.interestedModel || '-')}</div>
            </div>
            <div style="font-size:0.78rem;font-weight:700;color:var(--accent)">${q.price ? formatCurrency(q.price) : ''}</div>
          </div>
        `).join('')}
      </div>
    `
  }

  function openLostModal(c, onDone) {
    const { el, close } = openModal({
      title: `⬛ มาร์คเสียดีล — ${escHtml(fullName(c))}`, size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">เหตุผลที่เสียดีล <span class="required">*</span></label>
          <textarea class="input" id="lost-reason" rows="3" placeholder="ราคา / คู่แข่ง / ไฟแนนซ์ไม่ผ่าน / เปลี่ยนใจ..."></textarea>
          <span class="input-error" id="lost-reason-e"></span>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="lm-c">ยกเลิก</button><button class="btn btn-danger" id="lm-s">⬛ ยืนยันเสียดีล</button>`,
    })
    el.querySelector('#lm-c').addEventListener('click', close)
    el.querySelector('#lm-s').addEventListener('click', async () => {
      const reason = el.querySelector('#lost-reason').value.trim()
      if (!reason) { el.querySelector('#lost-reason-e').textContent = 'กรุณาระบุเหตุผล'; return }
      try {
        const patch = { isLost: true, lostReason: reason, lostAt: new Date().toISOString() }
        await updateDocData('customers', c.id, patch)
        Object.assign(c, patch)
        close(); showToast('⬛ มาร์คเป็นเสียดีลแล้ว', 'warning')
        onDone?.()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
  }

  function openCreateBookingModal(c, onDone) {
    const { el, close } = openModal({
      title: `📝 สร้างใบจอง — ${escHtml(fullName(c))}`, size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">รุ่นรถ</label>
            <input class="input" id="cb-model" value="${escHtml(c.interestedModel || '')}" placeholder="เช่น BYD Seal AWD" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคาขาย (บาท)</label>
            <input class="input" id="cb-price" type="number" value="${c.budget || ''}" placeholder="0" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">เงินจอง (บาท) *</label>
            <input class="input" id="cb-down" type="number" placeholder="5000" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">พนักงานขาย</label>
            <select class="input" id="cb-sales" style="width:100%;margin-top:4px">${getSalesStaff().map(s => `<option ${s === c.assignedTo ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}</select></div>
          <span class="input-error" id="cb-err"></span>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="cb-c">ยกเลิก</button><button class="btn btn-primary" id="cb-s">📝 สร้างใบจอง</button>`,
    })
    el.querySelector('#cb-c').addEventListener('click', close)
    el.querySelector('#cb-s').addEventListener('click', async () => {
      const model = el.querySelector('#cb-model').value.trim()
      const price = Number(el.querySelector('#cb-price').value) || 0
      const down = Number(el.querySelector('#cb-down').value) || 0
      const salesName = el.querySelector('#cb-sales').value
      if (!model) { el.querySelector('#cb-err').textContent = '⚠️ กรุณาระบุรุ่นรถ'; return }
      if (!down) { el.querySelector('#cb-err').textContent = '⚠️ กรุณาระบุเงินจอง'; return }
      const btn = el.querySelector('#cb-s'); btn.disabled = true
      try {
        const bookingNo = 'SK' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + String(Math.floor(Math.random() * 900) + 100)
        const bookingData = {
          bookingNo, custName: fullName(c), phone: c.phone || '', customerId: c.id,
          model, price, cost: 0, down, financeAmount: Math.max(price - down, 0), finStatus: '',
          salesName, source: c.source || '', status: 'ยอดจองคงค้าง',
          margin: 0, budgetUsed: 0, com70: 0, comFinance: 0, marginLeft: 0, totalIncome: 0,
          bookingDate: new Date().toISOString().slice(0, 10), notes: `สร้างจาก Customer Workspace (${fullName(c)})`,
        }
        const bookingId = await createDoc('bookings', bookingData)
        const stageChangedAt = new Date().toISOString()
        await updateDocData('customers', c.id, { stage: 'booking', stageChangedAt, bookingId })
        Object.assign(c, { stage: 'booking', stageChangedAt, bookingId })
        close()
        showToast(`📝 สร้างใบจอง ${bookingNo} แล้ว — อัปเดตสถานะลูกค้าเป็น "จองแล้ว"`, 'success')
        onDone?.(c)
      } catch { btn.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openCommForm(c, onSaved) {
    const { el, close } = openModal({
      title: '📝 บันทึกการติดต่อ', size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="input-group">
            <label class="input-label">ประเภท</label>
            <select class="input" id="log-type">
              ${Object.entries(LOG_ICONS).map(([k, v]) => `<option value="${k}">${v} ${LOG_LABELS[k]}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">รายละเอียด <span class="required">*</span></label>
            <textarea class="input" id="log-note" rows="3" placeholder="บันทึกสิ่งที่คุย..."></textarea>
            <span class="input-error" id="log-err"></span>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="lc">ยกเลิก</button><button class="btn btn-primary" id="ls">💾 บันทึก</button>`,
    })
    el.querySelector('#lc').addEventListener('click', close)
    el.querySelector('#ls').addEventListener('click', async () => {
      const note = document.getElementById('log-note').value.trim()
      if (!note) { document.getElementById('log-err').textContent = 'กรุณาระบุรายละเอียด'; return }
      try {
        const me = getState('user') || {}
        await createDoc('comm_logs', { customerId: c.id, type: document.getElementById('log-type').value, note, createdBy: me.displayName || me.email || me.uid || '' })
        close(); showToast('บันทึกแล้ว', 'success')
        onSaved?.()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
  }

  function openForm(existing = null, { onSaved } = {}) {
    const isEdit = !!existing
    const { el, close } = openModal({
      title: isEdit ? `✏️ แก้ไข ${fullName(existing)}` : '➕ เพิ่มลูกค้าใหม่', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อ <span class="required">*</span></label><input class="input" id="ff" value="${escHtml(existing?.firstName || '')}" placeholder="ชื่อ"><span class="input-error" id="ff-e"></span></div>
            <div class="input-group"><label class="input-label">นามสกุล <span class="required">*</span></label><input class="input" id="fl" value="${escHtml(existing?.lastName || '')}" placeholder="นามสกุล"><span class="input-error" id="fl-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="fp" value="${escHtml(existing?.phone || '')}" placeholder="0812345678"></div>
            <div class="input-group"><label class="input-label">LINE ID</label><input class="input" id="fl2" value="${escHtml(existing?.lineId || '')}" placeholder="@lineid"></div>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:-8px">💡 ถ้ายังไม่มีทั้งเบอร์โทรและ LINE ID ระบบจะเก็บเป็นสถานะ "Lead" — เมื่อกรอกอย่างใดอย่างหนึ่งจะขึ้นเป็น "Prospect" อัตโนมัติ</div>
          <div class="input-group"><label class="input-label">Email</label><input class="input" id="fe" type="email" value="${escHtml(existing?.email || '')}" placeholder="email@example.com"></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">รถที่สนใจ</label><input class="input" id="fm" value="${escHtml(existing?.interestedModel || '')}" placeholder="เช่น BYD Seal"></div>
            <div class="input-group"><label class="input-label">งบประมาณ (บาท)</label><input class="input" type="number" id="fb" value="${existing?.budget || ''}" placeholder="1000000"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ที่มา</label><select class="input" id="fso">${Object.entries(SOURCE).map(([k, v]) => `<option value="${k}" ${existing?.source === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="input-group"><label class="input-label">อุณหภูมิ</label><select class="input" id="ft"><option value="">-</option>${Object.entries(TEMP).map(([k, v]) => `<option value="${k}" ${existing?.temperature === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ผู้ดูแล</label><select class="input" id="fa"><option value="">-</option>${getSalesStaff().map(s => `<option ${existing?.assignedTo === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}</select></div>
            <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;margin-top:22px;cursor:pointer"><input type="checkbox" id="fvip" ${existing?.vip ? 'checked' : ''}> ⭐ ลูกค้า VIP</label>
          </div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><textarea class="input" id="fn" rows="2" placeholder="บันทึกข้อมูลเพิ่มเติม...">${escHtml(existing?.notes || '')}</textarea></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="fc">ยกเลิก</button><button class="btn btn-primary" id="fok">💾 ${isEdit ? 'บันทึก' : 'เพิ่ม'}</button>`,
    })
    el.querySelector('#fc').addEventListener('click', close)
    el.querySelector('#fok').addEventListener('click', async () => {
      const first = document.getElementById('ff').value.trim()
      const last = document.getElementById('fl').value.trim()
      let ok = true
      if (!first) { document.getElementById('ff-e').textContent = 'กรุณาระบุชื่อ'; ok = false }
      if (!last) { document.getElementById('fl-e').textContent = 'กรุณาระบุนามสกุล'; ok = false }
      if (!ok) return
      const btn = el.querySelector('#fok'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const fields = {
        firstName: first, lastName: last,
        phone: document.getElementById('fp').value.trim(),
        lineId: document.getElementById('fl2').value.trim(),
        email: document.getElementById('fe').value.trim(),
        interestedModel: document.getElementById('fm').value.trim(),
        budget: Number(document.getElementById('fb').value) || 0,
        source: document.getElementById('fso').value,
        temperature: document.getElementById('ft').value || null,
        assignedTo: document.getElementById('fa').value || '',
        vip: document.getElementById('fvip').checked,
        notes: document.getElementById('fn').value.trim(),
      }
      try {
        if (isEdit) {
          const promote = shouldAutoPromoteToPP(existing, fields)
          const patch = { ...fields }
          if (promote) { patch.stage = 'pp'; patch.stageChangedAt = new Date().toISOString() }
          await updateDocData('customers', existing.id, patch)
          Object.assign(existing, patch)
          close()
          if (promote) showToast('🎉 อัปเกรดเป็น Prospect อัตโนมัติ (ได้เบอร์ติดต่อ/LINE แล้ว)', 'success')
          else showToast(`แก้ไข ${first} ${last} แล้ว`, 'success')
          await loadData()
          onSaved?.(existing)
        } else {
          const stage = deriveInitialStage(fields)
          const payload = { ...fields, stage, stageChangedAt: new Date().toISOString(), isLost: false, lostReason: '', lostAt: null, bookingId: null, tags: [] }
          const id = await createDoc('customers', payload)
          const created = { ...payload, id }
          customers.unshift(created)
          close()
          showToast(`เพิ่ม ${first} ${last} แล้ว (${STAGE[stage]?.short})`, 'success')
          applyFilter()
          onSaved?.(created)
        }
      } catch { btn.disabled = false; btn.textContent = 'บันทึก'; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  // ── Page HTML ─────────────────────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div><div class="page-title">👥 ลูกค้า</div><div class="page-subtitle" id="cust-count">กำลังโหลด...</div></div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="pipeline-link-btn">📋 Pipeline View</button>
          <button class="btn btn-ghost btn-sm" id="sheet-view-btn" title="Spreadsheet View">📊 Sheet</button>
          <button class="btn btn-ghost btn-sm" id="import-cust-btn">📤 Import</button>
          <button class="btn btn-secondary btn-sm" id="export-cust-btn">📥 Export</button>
          <button class="btn btn-primary" id="add-cust-btn">➕ เพิ่มลูกค้า</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px">
        ${STAGE_ORDER.map(k => `
          <div class="card stat-pill" data-s="${k}" style="padding:10px 12px;text-align:center;cursor:pointer">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">${STAGE[k].label}</div>
            <div id="stat-${k}" style="font-size:1.5rem;font-weight:800;color:var(--${STAGE[k].badge})">0</div>
          </div>
        `).join('')}
        <div class="card stat-pill" data-s="__lost" style="padding:10px 12px;text-align:center;cursor:pointer">
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">⬛ เสียดีล</div>
          <div id="stat-lost" style="font-size:1.5rem;font-weight:800;color:var(--text-muted)">0</div>
        </div>
      </div>

      <div class="card mb-4" style="padding:14px 20px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="position:relative;flex:1;min-width:200px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="cust-search" placeholder="ค้นหาชื่อ เบอร์โทร LINE รถที่สนใจ..." style="padding-left:32px">
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${['all', ...STAGE_ORDER].map(s => `
              <button class="btn btn-sm sf ${s === 'all' ? 'btn-primary' : 'btn-secondary'}" data-s="${s}">
                ${s === 'all' ? 'ทั้งหมด' : (STAGE[s]?.short || s)}
              </button>
            `).join('')}
            <button class="btn btn-sm btn-secondary sf-lost" id="lost-toggle">⬛ เสียดีลเท่านั้น</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>ลูกค้า</th><th>ติดต่อ</th><th>สถานะ</th><th>อุณหภูมิ</th><th>รถที่สนใจ</th><th>ที่มา</th><th>ความเร่งด่วน</th><th>เพิ่มเมื่อ</th><th></th>
          </tr></thead>
          <tbody id="cust-tbody">
            ${[...Array(5)].map(() => `<tr>${[...Array(9)].map(() => `<td><div class="skeleton" style="height:16px;border-radius:4px"></div></td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div id="sheet-view-wrap" style="display:none"></div>
    </div>
  `

  if (!document.getElementById('cust-style')) {
    const s = document.createElement('style')
    s.id = 'cust-style'
    s.textContent = `.cust-row{cursor:pointer}.cust-row:hover td{background:var(--surface-2)}.cust-row.is-lost{opacity:0.55}.ss-active{background:var(--primary-dim)!important}`
    document.head.appendChild(s)
  }

  // Sheet / Table toggle
  let sheetMode = false
  let sheet = null
  const SHEET_COLS = [
    { key: 'firstName', label: 'ชื่อ', width: 100, required: true },
    { key: 'lastName', label: 'นามสกุล', width: 110, required: true },
    { key: 'phone', label: 'โทรศัพท์', width: 120 },
    { key: 'lineId', label: 'LINE ID', width: 100 },
    { key: 'email', label: 'Email', width: 150 },
    { key: 'interestedModel', label: 'รถที่สนใจ', width: 130 },
    { key: 'stage', label: 'สถานะ', width: 100, type: 'select', options: STAGE_ORDER.map(v => ({ value: v, label: STAGE[v].short })) },
    { key: 'temperature', label: 'อุณหภูมิ', width: 90, type: 'select', options: [{ value: '', label: '-' }, ...Object.entries(TEMP).map(([v, s]) => ({ value: v, label: s.label.replace(/[🔴🟡🔵]\s*/, '') }))] },
    { key: 'vip', label: 'VIP', width: 60, type: 'boolean' },
    { key: 'isLost', label: 'เสียดีล', width: 70, type: 'boolean' },
    { key: 'source', label: 'ที่มา', width: 100, type: 'select', options: Object.entries(SOURCE).map(([v, l]) => ({ value: v, label: l.replace(/[📘💚🎵🚶🤝🔍🌐📱📌]\s*/, '') })) },
  ]

  document.getElementById('sheet-view-btn').addEventListener('click', () => {
    sheetMode = !sheetMode
    const tableWrap = container.querySelector('.table-wrap')
    const sheetWrap = document.getElementById('sheet-view-wrap')
    const btn = document.getElementById('sheet-view-btn')
    const addBtn = document.getElementById('add-cust-btn')
    if (sheetMode) {
      tableWrap.style.display = 'none'
      sheetWrap.style.display = ''
      btn.textContent = '📋 Table'; btn.className = 'btn btn-primary btn-sm'
      addBtn.style.display = 'none'
      sheet = new SmartSheet(sheetWrap, {
        columns: SHEET_COLS,
        rows: customers,
        onSave: async (row) => {
          try {
            if (row.id) await updateDocData('customers', row.id, row)
            else {
              if (!row.stage) row.stage = deriveInitialStage(row)
              row.stageChangedAt = new Date().toISOString()
              const id = await createDoc('customers', row); row.id = id
            }
            showToast('บันทึกแล้ว', 'success')
            await loadData(); sheet.setRows(customers)
          } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
        },
        onDelete: async (row) => {
          if (row.id) await softDelete('customers', row.id).catch(() => {})
        },
      })
    } else {
      tableWrap.style.display = ''
      sheetWrap.style.display = 'none'
      btn.textContent = '📊 Sheet'; btn.className = 'btn btn-ghost btn-sm'
      addBtn.style.display = ''
      sheet = null
      renderTable()
    }
  })

  document.getElementById('add-cust-btn').addEventListener('click', () => openForm())
  document.getElementById('pipeline-link-btn').addEventListener('click', () => navigate('/crm/pipeline'))

  document.getElementById('export-cust-btn').addEventListener('click', () => {
    if (!customers.length) { showToast('ไม่มีข้อมูลสำหรับ Export', 'warning'); return }
    const rows = customers.map(c => ({
      'ชื่อ': c.firstName || '', 'นามสกุล': c.lastName || '',
      'โทรศัพท์': c.phone || '', 'LINE ID': c.lineId || '', 'Email': c.email || '',
      'รถที่สนใจ': c.interestedModel || '', 'งบประมาณ': c.budget || '',
      'สถานะ': STAGE[c.stage]?.short || c.stage || '', 'อุณหภูมิ': c.temperature || '',
      'VIP': c.vip ? 'ใช่' : '', 'เสียดีล': c.isLost ? 'ใช่' : '',
      'ที่มา': c.source || '', 'แท็ก': (c.tags || []).join(', '),
      'วันที่เพิ่ม': formatDate(c.createdAt),
    }))
    exportToExcel(rows, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`, 'ลูกค้า')
    showToast(`Export ${rows.length} รายการแล้ว`, 'success')
  })

  const IMPORT_COLS = ['ชื่อ', 'นามสกุล', 'โทรศัพท์', 'LINE ID', 'Email', 'รถที่สนใจ', 'ที่มา']
  document.getElementById('import-cust-btn').addEventListener('click', () => {
    openImportModal({
      title: 'นำเข้าข้อมูลลูกค้า',
      columns: IMPORT_COLS,
      onImport: async (rows) => {
        let added = 0
        for (const row of rows) {
          const first = row['ชื่อ']?.trim()
          const last = row['นามสกุล']?.trim()
          if (!first && !last) continue
          const fields = {
            firstName: first || '', lastName: last || '',
            phone: row['โทรศัพท์'] || '', lineId: row['LINE ID'] || '',
            email: row['Email'] || '', interestedModel: row['รถที่สนใจ'] || '',
            source: row['ที่มา'] || 'other', tags: [],
          }
          await createDoc('customers', {
            ...fields, stage: deriveInitialStage(fields), stageChangedAt: new Date().toISOString(),
            isLost: false, lostReason: '', lostAt: null, bookingId: null,
          }).catch(() => {})
          added++
        }
        showToast(`นำเข้า ${added} รายการสำเร็จ`, 'success')
        await loadData()
      },
    })
  })
  document.getElementById('cust-search').addEventListener('input', e => { search = e.target.value.trim().toLowerCase(); applyFilter() })
  document.querySelectorAll('.sf').forEach(btn => btn.addEventListener('click', () => {
    stageFilter = btn.dataset.s
    document.querySelectorAll('.sf').forEach(b => b.className = `btn btn-sm sf ${b.dataset.s === stageFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))
  document.querySelectorAll('.stat-pill').forEach(card => card.addEventListener('click', () => {
    if (card.dataset.s === '__lost') { lostOnly = !lostOnly; card.style.outline = lostOnly ? '2px solid var(--danger)' : ''; applyFilter(); return }
    stageFilter = card.dataset.s
    document.querySelectorAll('.sf').forEach(b => b.className = `btn btn-sm sf ${b.dataset.s === stageFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))
  document.getElementById('lost-toggle').addEventListener('click', () => {
    lostOnly = !lostOnly
    document.getElementById('lost-toggle').className = `btn btn-sm sf-lost ${lostOnly ? 'btn-danger' : 'btn-secondary'}`
    applyFilter()
  })

  if (container.__routerGen !== myGen) return
  await loadData()
}

function avatarColor(c) {
  if (c.isLost) return '#6B7280'
  if (c.vip) return '#8B5CF6'
  return { hot: '#EF4444', warm: '#F59E0B', cold: '#06B6D4' }[c.temperature] || { lead: '#06B6D4', pp: '#5B9BFF', booking: '#F59E0B', delivered: '#10B981' }[c.stage] || '#6B7280'
}
function detail(label, value) {
  return `<div style="display:flex;gap:8px;font-size:0.875rem"><span style="color:var(--text-muted);min-width:100px">${label}</span><span style="color:var(--text-2)">${value}</span></div>`
}
