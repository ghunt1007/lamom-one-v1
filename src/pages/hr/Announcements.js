/**
 * Announcements — ประกาศภายในบริษัท
 * Route: /hr/announcements
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const ANN_TYPES = {
  urgent:  { label: 'ด่วน', color: 'danger', icon: '🚨' },
  policy:  { label: 'นโยบาย', color: 'warning', icon: '📜' },
  event:   { label: 'กิจกรรม', color: 'success', icon: '🎉' },
  general: { label: 'ทั่วไป', color: 'primary', icon: '📢' },
}

const DEMO_ANNOUNCEMENTS = [
  { id: 'AN001', title: 'ปิดระบบ LAMOM ONE อัปเกรด คืนวันเสาร์ 23:00–01:00', type: 'urgent', author: 'Admin', time: addDays(-1), pinned: true, readBy: 12, totalStaff: 16, body: 'ระบบจะใช้งานไม่ได้ชั่วคราว กรุณาบันทึกงานค้างก่อนเวลา' },
  { id: 'AN002', title: 'งานเลี้ยงกลางปี ศุกร์ 26 มิ.ย. 18:00 — ร้านครัวริมน้ำ', type: 'event', author: 'HR', time: addDays(-3), pinned: true, readBy: 15, totalStaff: 16, body: 'ลงชื่อร่วมงานที่ HR ภายในพุธนี้ มีรถรับ-ส่งจากโชว์รูม' },
  { id: 'AN003', title: 'ปรับระเบียบเบิกค่าน้ำมัน — ใช้แอปบันทึกแทนกระดาษ', type: 'policy', author: 'การเงิน', time: addDays(-7), pinned: false, readBy: 11, totalStaff: 16, body: 'เริ่ม 1 ก.ค. เบิกผ่าน LAMOM ONE → Expense Claims เท่านั้น แนบรูปใบเสร็จในแอป' },
  { id: 'AN004', title: 'ยินดีต้อนรับพนักงานใหม่ — ปิยะ (เซลส์) และ วรรณา (ช่าง)', type: 'general', author: 'HR', time: addDays(-10), pinned: false, readBy: 16, totalStaff: 16, body: 'ฝากดูแลน้องใหม่ทั้ง 2 ท่านด้วยครับ' },
  { id: 'AN005', title: 'BYD ปรับราคา Atto 3 มีผล 1 ก.ค. — รอประกาศราคาใหม่', type: 'urgent', author: 'ผจก.ขาย', time: addDays(-2), pinned: false, readBy: 9, totalStaff: 16, body: 'ระหว่างนี้ห้ามยืนยันราคากับลูกค้าที่จองหลัง 1 ก.ค. จนกว่าจะมีประกาศ' },
]

export default async function AnnouncementsPage(container) {
  let anns = DEMO_ANNOUNCEMENTS.map(a => ({ ...a }))
  let typeFilter = 'all'

  function renderPage() {
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
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.pin-btn').forEach(b => b.addEventListener('click', () => {
      const a = anns.find(x => x.id === b.dataset.id); if (a) { a.pinned = !a.pinned; renderPage() }
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
        onConfirm() {
          const title = document.getElementById('an-title')?.value?.trim()
          const body = document.getElementById('an-body')?.value?.trim()
          if (!title || !body) { showToast('❗ กรอกหัวข้อและเนื้อหา', 'error'); return }
          anns.unshift({ id:`AN${String(anns.length+1).padStart(3,'0')}`, title, type:document.getElementById('an-type')?.value||'general', author:'คุณ (Demo)', time:new Date().toISOString(), pinned:document.getElementById('an-pin')?.checked||false, readBy:0, totalStaff:16, body })
          showToast('📢 ประกาศแล้ว — แจ้งเตือนทุกคนทาง LINE + ระบบ', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
