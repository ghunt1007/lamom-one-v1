/**
 * Announcements — ประกาศภายในบริษัท
 * Route: /hr/announcements
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const ANN_TYPES = {
  urgent:  { label: 'ด่วน', color: 'danger', icon: '🚨' },
  policy:  { label: 'นโยบาย', color: 'warning', icon: '📜' },
  event:   { label: 'กิจกรรม', color: 'success', icon: '🎉' },
  general: { label: 'ทั่วไป', color: 'primary', icon: '📢' },
}

export default async function AnnouncementsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let anns = []
  let typeFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { anns = await listDocs('announcements_hr', [], 'time', 'desc', 200) } catch (e) { anns = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = anns
      .filter(a => typeFilter === 'all' || a.type === typeFilter)
      .sort((a, b) => (b.pinned - a.pinned) || b.time.localeCompare(a.time))
    const unreadIssues = anns.filter(a => a.readBy < a.totalStaff)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📢 Announcements</div>
            <div class="page-subtitle">ประกาศภายใน — ทุกคนต้องอ่าน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-ann-btn">+ ประกาศใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('📢 ประกาศ active', anns.length, 'primary')}
          ${kpi('📌 ปักหมุด', anns.filter(a=>a.pinned).length, 'warning')}
          ${kpi('👁 ยังอ่านไม่ครบ', unreadIssues.length + ' เรื่อง', unreadIssues.length > 0 ? 'danger' : 'success')}
        </div>

        <!-- Type filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(ANN_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(a => {
            const at = ANN_TYPES[a.type]
            const readPct = Math.round(a.readBy / a.totalStaff * 100)
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${at?.color})${a.pinned?';background:var(--warning)06':''}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${a.pinned?'📌 ':''}${a.title}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">✍️ ${a.author} · ${timeAgo(a.time)}</div>
                </div>
                <span class="badge badge-${at?.color}" style="font-size:0.62rem">${at?.icon} ${at?.label}</span>
              </div>
              <div style="font-size:0.79rem;color:var(--text-muted);margin-bottom:8px;line-height:1.5">${a.body}</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:280px">
                  <div style="flex:1;background:var(--surface-2);border-radius:3px;height:6px">
                    <div style="width:${readPct}%;background:var(--${readPct===100?'success':'warning'});height:6px;border-radius:3px"></div>
                  </div>
                  <span style="font-size:0.65rem;color:var(--text-muted)">อ่านแล้ว ${a.readBy}/${a.totalStaff}</span>
                </div>
                <div style="display:flex;gap:6px">
                  ${a.readBy < a.totalStaff ? `<button class="btn btn-xs btn-warning remind-btn" data-id="${a.id}">🔔 เตือนคนยังไม่อ่าน</button>` : ''}
                  <button class="btn btn-xs btn-secondary pin-btn" data-id="${a.id}">${a.pinned?'เลิกปัก':'📌 ปัก'}</button>
                </div>
              </div>
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-icon">📢</div><div class="empty-title">ไม่มีประกาศ</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.pin-btn').forEach(b => b.addEventListener('click', async () => {
      const a = anns.find(x => x.id === b.dataset.id)
      if (!a) return
      await updateDocData('announcements_hr', a.id, { pinned: !a.pinned })
      await loadData()
    }))
    container.querySelectorAll('.remind-btn').forEach(b => b.addEventListener('click', () => {
      const a = anns.find(x => x.id === b.dataset.id)
      if (a) showToast(`🔔 ส่งแจ้งเตือนถึง ${a.totalStaff - a.readBy} คนที่ยังไม่อ่านแล้ว`, 'warning')
    }))
    document.getElementById('add-ann-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ สร้างประกาศ',
        size: 'md',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="an-title"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="an-type">${Object.entries(ANN_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เนื้อหา *</label><textarea class="input" id="an-body" rows="3"></textarea></div>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer">
            <input type="checkbox" id="an-pin" style="accent-color:var(--primary)"> 📌 ปักหมุด
          </label>
        </div>`,
        confirmText: '📢 ประกาศ',
        async onConfirm() {
          const title = document.getElementById('an-title')?.value?.trim()
          const body = document.getElementById('an-body')?.value?.trim()
          if (!title || !body) { showToast('❗ กรอกหัวข้อและเนื้อหา', 'error'); return false }
          const type = document.getElementById('an-type')?.value || 'general'
          await createDoc('announcements_hr', {
            title, type, author: 'คุณ (Demo)', time: new Date().toISOString(),
            pinned: document.getElementById('an-pin')?.checked || false, readBy: 0, totalStaff: 16, body,
          })
          try {
            await createDoc('notifications', {
              type: 'system', title: `📢 ประกาศใหม่: ${title}`,
              body: body.slice(0, 100), read: false, link: '/hr/announcements', createdAt: new Date().toISOString(),
            })
            setState('unreadCount', (getState('unreadCount') || 0) + 1)
          } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบประกาศที่บันทึกไปแล้ว */ }
          showToast('📢 ประกาศแล้ว — แจ้งเตือนทุกคนในระบบ', 'success'); await loadData()
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
