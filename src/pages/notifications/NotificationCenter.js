import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
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
  task:       { icon: '✅', color: 'primary', label: 'งาน' },
  alert:      { icon: '🚨', color: 'danger', label: 'แจ้งเตือน' },
}

const DEMO_NOTIFS = [
  { id:'N001', type:'lead', title:'Lead ใหม่จาก Facebook', body:'คุณ สมหมาย หมายดี สนใจ BYD Seal AWD', read:false, createdAt: new Date(Date.now()-300000).toISOString(), link:'/crm/leads' },
  { id:'N002', type:'booking', title:'จองรถใหม่', body:'คุณ สมศักดิ์ เจริญสุข จอง BYD Seal AWD มัดจำ ฿50,000', read:false, createdAt: new Date(Date.now()-900000).toISOString(), link:'/crm/bookings' },
  { id:'N003', type:'service', title:'งานซ่อมเสร็จแล้ว', body:'Job JOB-2025-002 เสร็จสมบูรณ์ รอแจ้งลูกค้ารับรถ', read:false, createdAt: new Date(Date.now()-1800000).toISOString(), link:'/service/jobs' },
  { id:'N004', type:'alert', title:'อะไหล่ใกล้หมด!', body:'Filter น้ำมัน MG4 เหลือ 3 ชิ้น ต่ำกว่า Minimum Stock', read:false, createdAt: new Date(Date.now()-3600000).toISOString(), link:'/service/parts' },
  { id:'N005', type:'insurance', title:'ประกันหมดอายุใน 30 วัน', body:'กรมธรรม์ INS-2024-001 ของคุณ สมชาย หมดอายุ 09/07/2025', read:true, createdAt: new Date(Date.now()-7200000).toISOString(), link:'/insurance' },
  { id:'N006', type:'hr', title:'คำขอลาใหม่', body:'ธีรยุทธ เก่งกาจ ขอลากิจ 15 มิ.ย. 2025 — รออนุมัติ', read:true, createdAt: new Date(Date.now()-14400000).toISOString(), link:'/hr/leave' },
  { id:'N007', type:'finance', title:'Commission พร้อมจ่าย', body:'อรนุช สายใจ Commission ฿85,000 รอดำเนินการ', read:true, createdAt: new Date(Date.now()-86400000).toISOString(), link:'/finance/commission' },
  { id:'N008', type:'sale', title:'ปิดดีลสำเร็จ! 🎉', body:'วิชาญ มีโชค ปิดดีล MG4 X ฿1,199,000 — ยอดเยี่ยม!', read:true, createdAt: new Date(Date.now()-172800000).toISOString(), link:'/finance/margin' },
  { id:'N009', type:'system', title:'LAMOM ONE อัพเดตแล้ว', body:'ระบบอัพเดตเป็น v1.0.5 — Performance ดีขึ้น 30%', read:true, createdAt: new Date(Date.now()-259200000).toISOString(), link:'/' },
  { id:'N010', type:'task', title:'Task ใกล้ครบกำหนด', body:'ส่ง Report ประจำเดือน — ครบกำหนด 30 มิ.ย. 2025', read:false, createdAt: new Date(Date.now()-43200000).toISOString(), link:'/tasks' },
]

export default async function NotificationCenterPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  // Try load from db, fallback to demo
  let notifs = []
  try {
    notifs = await listDocs('notifications', [], 'createdAt', 'desc', 100)
    if (!notifs.length) notifs = [...DEMO_NOTIFS]
  } catch {
    notifs = [...DEMO_NOTIFS]
  }

  if (container.__routerGen !== myGen) return

  let filterType = 'all'
  let showUnread = false

  function getFiltered() {
    let list = showUnread ? notifs.filter(n => !n.read) : notifs
    if (filterType !== 'all') list = list.filter(n => n.type === filterType)
    return list
  }

  function markRead(id) {
    const n = notifs.find(x => x.id === id)
    if (n) n.read = true
    updateDocData('notifications', id, { read: true }).catch(() => {})
  }

  function markAllRead() {
    notifs.forEach(n => n.read = true)
    notifs.forEach(n => updateDocData('notifications', n.id, { read: true }).catch(() => {}))
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
              const nt = NOTIF_TYPES[t]
              return `<button class="btn btn-sm ${filterType===t?'btn-primary':'btn-secondary'} nf-type-btn" data-t="${t}">${nt?.icon} ${nt?.label||t}</button>`
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

  renderPage()
}
