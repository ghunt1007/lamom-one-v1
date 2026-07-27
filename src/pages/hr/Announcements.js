/**
 * Announcements — ประกาศภายในบริษัท
 * Route: /hr/announcements
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { db } from '../../core/firebase.js'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'

const HANDLER_ROLES = ['hr', 'manager', 'admin', 'owner']

function myName() {
  const me = getState('user') || {}
  return me.displayName || me.email || 'ผู้ใช้ปัจจุบัน'
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const ANN_TYPES = {
  urgent:  { label: 'ด่วน', color: 'danger', icon: '🚨' },
  policy:  { label: 'นโยบาย', color: 'warning', icon: '📜' },
  event:   { label: 'กิจกรรม', color: 'success', icon: '🎉' },
  general: { label: 'ทั่วไป', color: 'primary', icon: '📢' },
}

export default async function AnnouncementsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  const me = getState('user') || {}
  const myRole = getState('role') || me.role || 'staff'
  const isHandler = HANDLER_ROLES.includes(myRole)
  const myMemberships = me.companyMemberships || []
  const myCompanyIds = myMemberships.map(m => m.companyId)
  const myDepartments = [...new Set(myMemberships.map(m => m.department).filter(Boolean))]

  let anns = []
  let allUsers = []
  let companiesList = []
  let typeFilter = 'all'
  let loading = true

  function isInScope(a) {
    if (isHandler) return true // ผู้มีอำนาจเห็นทุกประกาศเสมอ ไม่ว่าจะเจาะกลุ่มไว้แบบไหน
    if (!a.scope || a.scope === 'org') return true
    if (a.scope === 'company') return myCompanyIds.includes(a.targetCompanyId)
    if (a.scope === 'department') return myDepartments.includes(a.targetDepartment)
    return true
  }

  async function loadData() {
    loading = true
    try { anns = await listDocs('announcements_hr', [], 'time', 'desc', 200) } catch (e) { anns = [] }
    try { allUsers = await listDocs('users', [], 'createdAt', 'desc', 500) } catch (e) { allUsers = [] }
    try { companiesList = await listDocs('org_companies', [], 'name', 'asc', 50) } catch (e) { companiesList = [] }
    anns = anns.filter(isInScope)
    // readBy เดิมตั้ง 0 ไว้ตอนสร้างแล้วไม่มีจุดไหนเพิ่มค่าเลยตลอดกาล ("อ่านแล้ว 0/X" ค้างตลอดไป) —
    // แก้ให้นับจริงจาก readByUids (ผู้ใช้ที่เปิดหน้านี้แล้วเห็นประกาศ = อ่านแล้ว) ใช้ arrayUnion กันแย่งเขียนทับกัน
    const myUid = getState('user')?.uid || ''
    anns.forEach(a => {
      const uids = a.readByUids || []
      a.readBy = uids.length
      if (myUid && !uids.includes(myUid)) {
        updateDoc(doc(db, 'announcements_hr', a.id), { readByUids: arrayUnion(myUid) }).catch(() => {})
        a.readBy += 1 // อัปเดตทันทีในหน่วยความจำ ไม่ต้องรอ round-trip
      }
    })
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function audienceUsers(scope, targetCompanyId, targetDepartment) {
    const activeUsers = allUsers.filter(u => u.active !== false && u.role !== 'pending')
    if (scope === 'company') return activeUsers.filter(u => (u.companyMemberships || []).some(m => m.companyId === targetCompanyId))
    if (scope === 'department') return activeUsers.filter(u => (u.companyMemberships || []).some(m => m.department === targetDepartment))
    return activeUsers
  }
  function countAudience(scope, targetCompanyId, targetDepartment) {
    return audienceUsers(scope, targetCompanyId, targetDepartment).length
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
            ${isHandler ? `<button class="btn btn-primary" id="add-ann-btn">+ ประกาศใหม่</button>` : ''}
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
            const scopeLabel = a.scope === 'company' ? '🏢 ' + escHtml(companiesList.find(c=>c.id===a.targetCompanyId)?.name || a.targetCompanyId)
              : a.scope === 'department' ? '🏷 แผนก ' + escHtml(a.targetDepartment) : '🌐 ทั้งองค์กร'
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${at?.color})${a.pinned?';background:var(--warning)06':''}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${a.pinned?'📌 ':''}${escHtml(a.title)} <span style="font-size:0.62rem;color:var(--text-muted);font-weight:400">· ${scopeLabel}</span></div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">✍️ ${escHtml(a.author)} · ${timeAgo(a.time)}</div>
                </div>
                <span class="badge badge-${at?.color}" style="font-size:0.62rem">${at?.icon} ${at?.label}</span>
              </div>
              <div style="font-size:0.79rem;color:var(--text-muted);margin-bottom:8px;line-height:1.5">${escHtml(a.body)}</div>
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
    container.querySelectorAll('.remind-btn').forEach(b => b.addEventListener('click', async () => {
      const a = anns.find(x => x.id === b.dataset.id)
      if (!a) return
      // เดิมกดแล้วขึ้น toast อ้างว่า "ส่งแจ้งเตือนแล้ว" ทั้งที่ไม่เคยสร้าง notification จริงให้ใครเลย
      // แก้ให้สร้าง notification จริงเจาะเฉพาะคนที่ยังไม่อ่าน (เช็คจาก readByUids จริง)
      const readSet = new Set(a.readByUids || [])
      const unread = audienceUsers(a.scope, a.targetCompanyId, a.targetDepartment).filter(u => u.uid && !readSet.has(u.uid))
      if (!unread.length) { showToast('ทุกคนในกลุ่มเป้าหมายอ่านแล้ว', 'success'); return }
      try {
        await Promise.all(unread.map(u => createDoc('notifications', {
          type: 'system', title: `🔔 อย่าลืมอ่านประกาศ: ${a.title}`,
          body: (a.body || '').slice(0, 100), userId: u.uid, read: false, link: '/hr/announcements', createdAt: new Date().toISOString(),
        })))
        showToast(`🔔 ส่งแจ้งเตือนถึง ${unread.length} คนที่ยังไม่อ่านแล้ว`, 'success')
      } catch { showToast('ส่งแจ้งเตือนไม่สำเร็จ', 'error') }
    }))
    document.getElementById('add-ann-btn')?.addEventListener('click', () => {
      const knownDepts = [...new Set(allUsers.flatMap(u => (u.companyMemberships || []).map(m => m.department).filter(Boolean)))]
      openModal({
        title: '+ สร้างประกาศ',
        size: 'md',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="an-title"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="an-type">${Object.entries(ANN_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ประกาศถึง *</label>
            <select class="input" id="an-scope">
              <option value="org">🌐 ทั้งองค์กร (ทุกบริษัท ทุกแผนก)</option>
              <option value="company">🏢 เฉพาะบริษัท</option>
              <option value="department">🏷 เฉพาะแผนก</option>
            </select>
          </div>
          <div class="input-group" id="an-company-wrap" style="display:none"><label class="input-label">เลือกบริษัท</label>
            <select class="input" id="an-company">${companiesList.map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="input-group" id="an-dept-wrap" style="display:none"><label class="input-label">ระบุแผนก</label>
            <input class="input" id="an-department" list="an-dept-list" placeholder="เช่น ขาย, บัญชี, HR">
            <datalist id="an-dept-list">${knownDepts.map(d=>`<option value="${escHtml(d)}">`).join('')}</datalist>
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
          const scope = document.getElementById('an-scope')?.value || 'org'
          const targetCompanyId = scope === 'company' ? (document.getElementById('an-company')?.value || null) : null
          const targetDepartment = scope === 'department' ? (document.getElementById('an-department')?.value?.trim() || null) : null
          if (scope === 'department' && !targetDepartment) { showToast('❗ ระบุแผนกที่ต้องการประกาศถึง', 'error'); return false }
          const totalStaff = countAudience(scope, targetCompanyId, targetDepartment)
          await createDoc('announcements_hr', {
            title, type, author: myName(), time: new Date().toISOString(),
            pinned: document.getElementById('an-pin')?.checked || false, readByUids: [], totalStaff, body,
            scope, targetCompanyId, targetDepartment,
          })
          try {
            await createDoc('notifications', {
              type: 'system', title: `📢 ประกาศใหม่: ${title}`,
              body: body.slice(0, 100), read: false, link: '/hr/announcements', createdAt: new Date().toISOString(),
            })
            setState('unreadCount', (getState('unreadCount') || 0) + 1)
          } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบประกาศที่บันทึกไปแล้ว */ }
          showToast(`📢 ประกาศแล้ว — แจ้งเตือนถึง ${totalStaff} คน`, 'success'); await loadData()
        }
      })
      setTimeout(() => {
        document.getElementById('an-scope')?.addEventListener('change', (e) => {
          document.getElementById('an-company-wrap').style.display = e.target.value === 'company' ? '' : 'none'
          document.getElementById('an-dept-wrap').style.display = e.target.value === 'department' ? '' : 'none'
        })
      }, 100)
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
