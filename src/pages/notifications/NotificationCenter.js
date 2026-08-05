import { watchDocs, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast, setState } from '../../core/store.js'
import { timeAgo } from '../../utils/format.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const NOTIF_TYPES = {
  lead:       { icon: '🧲', color: 'accent', label: 'Lead ใหม่' },
  sale:       { icon: '💰', color: 'success', label: 'ยอดขาย' },
  booking:    { icon: '📝', color: 'primary', label: 'จองรถ' },
  service:    { icon: '🔧', color: 'warning', label: 'งานซ่อม' },
  insurance:  { icon: '🛡', color: 'accent', label: 'ประกัน' },
  hr:         { icon: '👤', color: 'accent', label: 'HR' },
  system:     { icon: '⚙️', color: 'primary', label: 'ระบบ' },
  finance:    { icon: '💳', color: 'success', label: 'การเงิน' },
  expense:    { icon: '🧾', color: 'warning', label: 'ค่าใช้จ่าย' },
  marketing:  { icon: '🎪', color: 'primary', label: 'แคมเปญ' },
  task:       { icon: '✅', color: 'primary', label: 'งาน' },
  alert:      { icon: '🚨', color: 'danger', label: 'แจ้งเตือน' },
  reminder:   { icon: '⏰', color: 'warning', label: 'เตือนความจำ' },
  stock:      { icon: '📦', color: 'primary', label: 'สต็อก' },
  warning:    { icon: '⚠️', color: 'danger', label: 'คำเตือน' },
}

export default async function NotificationCenterPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let notifs = []
  let filterType = 'all'
  let showUnread = false
  // การกด "✕ ปิด" เป็นการซ่อนแค่ฝั่งเรา ไม่ได้เขียนลง Firestore — ต้องจำไว้กันไม่ให้ live snapshot ดึงกลับมาอีก
  const dismissedIds = new Set()

  container.innerHTML = `<div class="page-content animate-slide">${[...Array(3)].map(() => `<div class="skeleton" style="height:64px;border-radius:var(--radius-md);margin-bottom:8px"></div>`).join('')}</div>`

  // Real-time: แจ้งเตือนใหม่ขึ้นทันทีโดยไม่ต้องรีเฟรชหน้า
  // เดิม fallback ไปแสดงแจ้งเตือนสมมติ 10 รายการ (lead/booking/ลาปลอม) เมื่อ collection จริงว่างเปล่า โดย
  // unreadCount ของ Topbar ก็คำนวณจากข้อมูลปลอมนี้ด้วย — ตกค้างมาจากก่อนตัด demo mode ออกทั้งระบบ (2026-07-23)
  // ตัดออก ให้ collection ว่างจริงแสดง empty state ตามจริง และ unreadCount = 0 จริงเมื่อไม่มีแจ้งเตือนจริง
  const unsubNotifs = watchDocs('notifications', [], 'createdAt', 'desc', 100, rows => {
    if (container.__routerGen !== myGen) { unsubNotifs(); return }
    notifs = rows.filter(n => !dismissedIds.has(n.id))
    setState('unreadCount', notifs.filter(n => !n.read).length)
    renderPage()
  })

  function getFiltered() {
    let list = showUnread ? notifs.filter(n => !n.read) : notifs
    if (filterType !== 'all') list = list.filter(n => n.type === filterType)
    return list
  }

  function markRead(id) {
    const n = notifs.find(x => x.id === id)
    if (n) n.read = true
    updateDocData('notifications', id, { read: true }).catch(() => {})
    setState('unreadCount', notifs.filter(n => !n.read).length)
  }

  function markAllRead() {
    notifs.forEach(n => n.read = true)
    notifs.forEach(n => updateDocData('notifications', n.id, { read: true }).catch(() => {}))
    setState('unreadCount', 0)
    showToast('✅ อ่านทั้งหมดแล้ว', 'success')
    renderPage()
  }

  function renderPage() {
    const unreadCount = notifs.filter(n => !n.read).length
    const filtered = getFiltered()
    const types = [...new Set(notifs.map(n => n.type))]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔔 Notification Center</div>
            <div class="page-subtitle">การแจ้งเตือนทั้งหมด</div>
          </div>
          <div class="page-actions">
            ${unreadCount > 0 ? `<span class="badge badge-danger">${unreadCount} ใหม่</span>` : ''}
            ${unreadCount > 0 ? `<button class="btn btn-secondary btn-sm" id="mark-all">✅ อ่านทั้งหมด</button>` : ''}
          </div>
        </div>

        <!-- Filter bar -->
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm ${filterType==='all'?'btn-primary':'btn-secondary'} nf-type-btn" data-t="all">ทั้งหมด</button>
            ${types.map(t => {
              const nt = NOTIF_TYPES[t] || NOTIF_TYPES.system
              return `<button class="btn btn-sm ${filterType===t?'btn-primary':'btn-secondary'} nf-type-btn" data-t="${t}">${nt.icon} ${nt.label}</button>`
            }).join('')}
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.83rem;cursor:pointer;margin-left:auto">
            <input type="checkbox" id="unread-only" ${showUnread?'checked':''} style="width:16px;height:16px">
            ยังไม่อ่านเท่านั้น (${unreadCount})
          </label>
        </div>

        <!-- Notifications list -->
        <div style="display:flex;flex-direction:column;gap:8px" id="notif-list">
          ${filtered.length ? filtered.map(n => renderNotifCard(n)).join('') : `
            <div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">ไม่มีการแจ้งเตือน</div></div>
          `}
        </div>
      </div>
    `

    document.getElementById('mark-all')?.addEventListener('click', markAllRead)
    document.getElementById('unread-only')?.addEventListener('change', e => { showUnread = e.target.checked; renderPage() })
    document.querySelectorAll('.nf-type-btn').forEach(b => b.addEventListener('click', () => { filterType = b.dataset.t; renderPage() }))

    document.querySelectorAll('.notif-card').forEach(card => {
      card.addEventListener('click', () => {
        const n = notifs.find(x => x.id === card.dataset.id)
        if (!n) return
        if (!n.read) { markRead(n.id); card.style.background = 'var(--surface)'; card.querySelector('.unread-dot')?.remove() }
        if (n.link) navigate(n.link)
      })
    })

    document.querySelectorAll('.notif-dismiss').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const id = btn.dataset.id
        dismissedIds.add(id)
        notifs = notifs.filter(n => n.id !== id)
        renderPage()
      })
    })
  }

  function renderNotifCard(n) {
    const nt = NOTIF_TYPES[n.type] || NOTIF_TYPES.system
    return `
      <div class="notif-card" data-id="${n.id}" style="
        display:flex;align-items:flex-start;gap:12px;padding:14px 16px;
        background:${n.read ? 'var(--surface)' : 'var(--primary-dim)'};
        border:1px solid ${n.read ? 'var(--border)' : 'var(--primary)'};
        border-radius:var(--radius-md);cursor:pointer;transition:background 0.15s;
      " onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='${n.read?'var(--surface)':'var(--primary-dim)'}'">
        <!-- Icon -->
        <div style="width:38px;height:38px;border-radius:50%;background:var(--${nt.color}-dim);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">
          ${nt.icon}
        </div>
        <!-- Content -->
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:flex-start;gap:8px">
            <div style="flex:1">
              <div style="font-weight:${n.read?'400':'700'};font-size:0.88rem;margin-bottom:2px">${escHtml(n.title)}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.4">${escHtml(n.body)}</div>
            </div>
            ${!n.read ? '<div class="unread-dot" style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:4px"></div>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
            <span class="badge badge-${nt.color}" style="font-size:0.65rem">${nt.label}</span>
            <span style="font-size:0.72rem;color:var(--text-muted)">${timeAgo(n.createdAt)}</span>
            ${n.link ? `<span style="font-size:0.72rem;color:var(--primary)">→ เปิดดู</span>` : ''}
          </div>
        </div>
        <!-- Dismiss -->
        <button class="btn btn-ghost btn-sm notif-dismiss" data-id="${n.id}" style="flex-shrink:0;opacity:0.4" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">✕</button>
      </div>
    `
  }

  return function cleanupNotifications() { unsubNotifs() }
}
