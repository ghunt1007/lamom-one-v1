import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'
import { timeAgo } from '../../utils/format.js'
import { setState } from '../../core/store.js'
import { navigate } from '../../core/router.js'

const NOTIF_ICONS = { lead: '🧲', reminder: '⏰', system: '⚙️', finance: '💰', service: '🔧', warning: '⚠️' }

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function openNotifPanel(anchorEl) {
  const existing = document.getElementById('notif-panel')
  if (existing) { existing.remove(); return }

  seedDemoData()
  const notifs = await listDocs('notifications', [], 'createdAt', 'desc', 20)
  const unread = notifs.filter(n => !n.read)
  setState('unreadCount', unread.length)

  const panel = document.createElement('div')
  panel.id = 'notif-panel'
  panel.style.cssText = `
    position:fixed; top:60px; right:12px; z-index:500;
    width:340px; max-height:480px;
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--radius-xl); overflow:hidden;
    box-shadow:0 8px 40px rgba(0,0,0,0.5);
    animation:slideDown 150ms ease;
    display:flex; flex-direction:column;
  `
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="font-weight:700;font-size:0.95rem">🔔 การแจ้งเตือน</div>
      <div style="display:flex;gap:8px;align-items:center">
        ${unread.length ? `<span class="badge badge-danger">${unread.length} ใหม่</span>` : ''}
        <button class="btn btn-ghost btn-sm" id="mark-all-read" style="font-size:0.75rem">อ่านทั้งหมด</button>
      </div>
    </div>
    <div style="overflow-y:auto;flex:1">
      ${notifs.length ? notifs.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}"
          style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 150ms;
                 ${!n.read ? 'background:var(--primary-dim)' : ''}">
          <div style="font-size:1.3rem;flex-shrink:0">${NOTIF_ICONS[n.type] || '🔔'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:${n.read?'400':'600'};color:var(--text)">${escHtml(n.title)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${escHtml(n.body)}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">${timeAgo(n.createdAt)}</div>
          </div>
          ${!n.read ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:4px"></div>' : ''}
        </div>
      `).join('') : `
        <div class="empty-state" style="padding:32px">
          <div class="empty-icon">🔔</div>
          <div class="empty-title">ไม่มีการแจ้งเตือน</div>
        </div>
      `}
    </div>
  `

  document.body.appendChild(panel)

  // Mark all read
  panel.querySelector('#mark-all-read')?.addEventListener('click', async () => {
    await Promise.all(unread.map(n => updateDocData('notifications', n.id, { read: true })))
    panel.querySelectorAll('.unread').forEach(el => {
      el.style.background = ''
      el.classList.remove('unread')
      el.querySelector('[style*="border-radius:50%"]')?.remove()
    })
    panel.querySelector('.badge-danger')?.remove()
    setState('unreadCount', 0)
  })

  // Mark single read on click
  panel.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-2)' })
    item.addEventListener('mouseleave', () => { item.style.background = item.classList.contains('unread') ? 'var(--primary-dim)' : '' })
    item.addEventListener('click', async () => {
      if (item.classList.contains('unread')) {
        await updateDocData('notifications', item.dataset.id, { read: true })
        item.style.background = ''
        item.classList.remove('unread')
        item.querySelector('[style*="border-radius:50%"]')?.remove()
        setState('unreadCount', Math.max(0, panel.querySelectorAll('.unread').length))
      }
      panel.remove()
      const n = notifs.find(x => x.id === item.dataset.id)
      if (n?.link) navigate(n.link)
    })
  })

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!panel.contains(e.target) && e.target.id !== 'notif-btn') {
        panel.remove()
        document.removeEventListener('click', handler)
      }
    })
  }, 100)
}
