/**
 * Internal Memo — บันทึกข้อความภายใน (MEMO)
 * Route: /hr/memo
 *
 * (v1.0.486) ต่างจาก Announcements.js (ประกาศทั่วไป แจ้งเตือนแบบ feed) ตรงที่นี่คือ "เอกสารบันทึกทางการ"
 * มีเลขที่/เรียน/จาก พิมพ์ออกมาเป็นเอกสาร A4 พร้อมช่องเซ็นได้ — ใช้ collection แยก (internal_memos) ไม่ปนกับ
 * announcements_hr เพราะเป็นเอกสารคนละประเภทกันจริง (feed แจ้งเตือน vs เอกสารทางการที่ต้องอ้างอิงเลขที่ได้)
 */
import { formatDate, timeAgo, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { db } from '../../core/firebase.js'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { printDocument, docHeader, docFooter, esc as pesc } from '../../utils/print.js'

const HANDLER_ROLES = ['hr', 'manager', 'admin', 'owner']

function myName() {
  const me = getState('user') || {}
  return me.displayName || me.email || 'ผู้ใช้ปัจจุบัน'
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// เลขที่บันทึก — วันที่+เลขสุ่ม (แพทเทิร์นเดียวกับ bookingNo/quoteNo ในระบบ ไม่ใช้ counter ต่อเนื่อง กันปัญหา
// สองคนสร้างพร้อมกันแย่งเลขกัน ซึ่งไม่คุ้มความซับซ้อนสำหรับเอกสารภายในที่ไม่ผูกกับกฎหมาย/บัญชีโดยตรง)
function genMemoNo() {
  const beYear = new Date().getFullYear() + 543
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `${seq}/${beYear}`
}

export default async function InternalMemoPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  const me = getState('user') || {}
  const myRole = getState('role') || me.role || 'staff'
  const isHandler = HANDLER_ROLES.includes(myRole)
  const myMemberships = me.companyMemberships || []
  const myCompanyIds = myMemberships.map(m => m.companyId)
  const myDepartments = [...new Set(myMemberships.map(m => m.department).filter(Boolean))]

  let memos = []
  let allUsers = []
  let companiesList = []
  let search = ''
  let loading = true

  function isInScope(m) {
    if (isHandler) return true
    if (!m.scope || m.scope === 'org') return true
    if (m.scope === 'company') return myCompanyIds.includes(m.targetCompanyId)
    if (m.scope === 'department') return myDepartments.includes(m.targetDepartment)
    return true
  }

  async function loadData() {
    loading = true
    try { memos = await listDocs('internal_memos', [], 'time', 'desc', 200) } catch (e) { memos = [] }
    try { allUsers = await listDocs('users', [], 'createdAt', 'desc', 500) } catch (e) { allUsers = [] }
    try { companiesList = await listDocs('org_companies', [], 'name', 'asc', 50) } catch (e) { companiesList = [] }
    memos = memos.filter(isInScope)
    const myUid = getState('user')?.uid || ''
    memos.forEach(m => {
      const uids = m.readByUids || []
      m.readBy = uids.length
      if (myUid && !uids.includes(myUid)) {
        updateDoc(doc(db, 'internal_memos', m.id), { readByUids: arrayUnion(myUid) }).catch(() => {})
        m.readBy += 1
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

  function printMemo(m) {
    const readPct = m.totalStaff ? Math.round(m.readBy / m.totalStaff * 100) : 0
    const html = `<div class="doc">
      ${docHeader('บันทึกข้อความภายใน', m.memoNo, formatDate(m.date || m.time))}
      <table class="kv" style="margin-bottom:10px">
        <tr><td class="lbl">เรียน</td><td class="val">${pesc(m.to || '-')}</td></tr>
        <tr><td class="lbl">จาก</td><td class="val">${pesc(m.from || m.author)}</td></tr>
        <tr><td class="lbl">เรื่อง</td><td class="val">${pesc(m.subject)}</td></tr>
      </table>
      <h3 class="sec">รายละเอียด</h3>
      <div style="white-space:pre-wrap;font-size:12.5px;line-height:1.7;padding:6px 2px">${pesc(m.body)}</div>
      <div class="sign-row">
        <div class="sign-box"><div class="sign-line"></div><div class="sign-cap">(${pesc(m.from || m.author)})<br>ผู้บันทึก</div></div>
        <div class="sign-box"><div class="sign-line"></div><div class="sign-cap">(...........................................)<br>ผู้รับทราบ</div></div>
      </div>
      <div class="note-box" style="margin-top:16px">รับทราบแล้ว ${m.readBy}/${m.totalStaff} คน (${readPct}%)</div>
      ${docFooter()}
    </div>`
    printDocument(html, { title: `บันทึกที่ ${m.memoNo}` })
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = memos
      .filter(m => !search || (m.subject || '').toLowerCase().includes(search.toLowerCase()) || (m.memoNo || '').includes(search))
      .sort((a, b) => (b.time || '').localeCompare(a.time || ''))
    const unreadIssues = memos.filter(m => m.readBy < m.totalStaff)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📄 บันทึกข้อความภายใน (Memo)</div>
            <div class="page-subtitle">เอกสารบันทึกทางการ — มีเลขที่ พิมพ์/เซ็นรับทราบได้</div>
          </div>
          <div class="page-actions">
            ${isHandler ? `<button class="btn btn-primary" id="add-memo-btn">+ บันทึกใหม่</button>` : ''}
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('📄 บันทึกทั้งหมด', memos.length, 'primary')}
          ${kpi('👁 ยังรับทราบไม่ครบ', unreadIssues.length + ' ฉบับ', unreadIssues.length > 0 ? 'danger' : 'success')}
          ${kpi('📅 เดือนนี้', memos.filter(m => (m.time || '').slice(0, 7) === todayBangkok().slice(0, 7)).length, 'secondary')}
        </div>

        <div style="margin-bottom:12px">
          <input class="input" id="memo-search" placeholder="🔍 ค้นหาเรื่อง/เลขที่..." style="max-width:280px" value="${escHtml(search)}">
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(m => {
            const readPct = m.totalStaff ? Math.round(m.readBy / m.totalStaff * 100) : 0
            const scopeLabel = m.scope === 'company' ? '🏢 ' + escHtml(companiesList.find(c=>c.id===m.targetCompanyId)?.name || m.targetCompanyId)
              : m.scope === 'department' ? '🏷 แผนก ' + escHtml(m.targetDepartment) : '🌐 ทั้งองค์กร'
            return `<div class="card" style="padding:14px;border-left:3px solid var(--primary)">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">📄 ${escHtml(m.subject)} <span style="font-size:0.62rem;color:var(--text-muted);font-weight:400">· ${scopeLabel}</span></div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">เลขที่ ${escHtml(m.memoNo)} · เรียน ${escHtml(m.to || '-')} · ✍️ ${escHtml(m.from || m.author)} · ${timeAgo(m.time)}</div>
                </div>
              </div>
              <div style="font-size:0.79rem;color:var(--text-muted);margin-bottom:8px;line-height:1.5;white-space:pre-wrap">${escHtml((m.body || '').slice(0, 200))}${(m.body || '').length > 200 ? '…' : ''}</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:280px">
                  <div style="flex:1;background:var(--surface-2);border-radius:3px;height:6px">
                    <div style="width:${readPct}%;background:var(--${readPct===100?'success':'warning'});height:6px;border-radius:3px"></div>
                  </div>
                  <span style="font-size:0.65rem;color:var(--text-muted)">รับทราบแล้ว ${m.readBy}/${m.totalStaff}</span>
                </div>
                <div style="display:flex;gap:6px">
                  ${m.readBy < m.totalStaff ? `<button class="btn btn-xs btn-warning remind-btn" data-id="${m.id}">🔔 เตือนคนยังไม่รับทราบ</button>` : ''}
                  <button class="btn btn-xs btn-secondary print-btn" data-id="${m.id}">🖨 พิมพ์</button>
                </div>
              </div>
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">ไม่มีบันทึกข้อความ</div></div>` : ''}
        </div>
      </div>
    `

    document.getElementById('memo-search')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    container.querySelectorAll('.print-btn').forEach(b => b.addEventListener('click', () => {
      const m = memos.find(x => x.id === b.dataset.id); if (m) printMemo(m)
    }))
    container.querySelectorAll('.remind-btn').forEach(b => b.addEventListener('click', async () => {
      const m = memos.find(x => x.id === b.dataset.id)
      if (!m) return
      const readSet = new Set(m.readByUids || [])
      const unread = audienceUsers(m.scope, m.targetCompanyId, m.targetDepartment).filter(u => u.uid && !readSet.has(u.uid))
      if (!unread.length) { showToast('ทุกคนในกลุ่มเป้าหมายรับทราบแล้ว', 'success'); return }
      try {
        await Promise.all(unread.map(u => createDoc('notifications', {
          type: 'system', title: `🔔 อย่าลืมรับทราบบันทึก: ${m.subject}`,
          body: `เลขที่ ${m.memoNo}`, userId: u.uid, read: false, link: '/hr/memo', createdAt: new Date().toISOString(),
        })))
        showToast(`🔔 ส่งแจ้งเตือนถึง ${unread.length} คนที่ยังไม่รับทราบแล้ว`, 'success')
      } catch { showToast('ส่งแจ้งเตือนไม่สำเร็จ', 'error') }
    }))
    document.getElementById('add-memo-btn')?.addEventListener('click', () => {
      const knownDepts = [...new Set(allUsers.flatMap(u => (u.companyMemberships || []).map(m => m.department).filter(Boolean)))]
      openModal({
        title: '+ สร้างบันทึกข้อความภายใน',
        size: 'md',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">เรียน *</label><input class="input" id="mm-to" placeholder="เช่น พนักงานทุกท่าน / ฝ่ายขาย"></div>
          <div class="input-group"><label class="input-label">จาก</label><input class="input" id="mm-from" value="${escHtml(myName())}"></div>
          <div class="input-group"><label class="input-label">เรื่อง *</label><input class="input" id="mm-subject"></div>
          <div class="input-group"><label class="input-label">บันทึกถึง *</label>
            <select class="input" id="mm-scope">
              <option value="org">🌐 ทั้งองค์กร (ทุกบริษัท ทุกแผนก)</option>
              <option value="company">🏢 เฉพาะบริษัท</option>
              <option value="department">🏷 เฉพาะแผนก</option>
            </select>
          </div>
          <div class="input-group" id="mm-company-wrap" style="display:none"><label class="input-label">เลือกบริษัท</label>
            <select class="input" id="mm-company">${companiesList.map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="input-group" id="mm-dept-wrap" style="display:none"><label class="input-label">ระบุแผนก</label>
            <input class="input" id="mm-department" list="mm-dept-list" placeholder="เช่น ขาย, บัญชี, HR">
            <datalist id="mm-dept-list">${knownDepts.map(d=>`<option value="${escHtml(d)}">`).join('')}</datalist>
          </div>
          <div class="input-group"><label class="input-label">รายละเอียด *</label><textarea class="input" id="mm-body" rows="5"></textarea></div>
        </div>`,
        confirmText: '📄 บันทึก',
        async onConfirm() {
          const to = document.getElementById('mm-to')?.value?.trim()
          const subject = document.getElementById('mm-subject')?.value?.trim()
          const body = document.getElementById('mm-body')?.value?.trim()
          if (!to || !subject || !body) { showToast('❗ กรอกเรียน/เรื่อง/รายละเอียดให้ครบ', 'error'); return false }
          const from = document.getElementById('mm-from')?.value?.trim() || myName()
          const scope = document.getElementById('mm-scope')?.value || 'org'
          const targetCompanyId = scope === 'company' ? (document.getElementById('mm-company')?.value || null) : null
          const targetDepartment = scope === 'department' ? (document.getElementById('mm-department')?.value?.trim() || null) : null
          if (scope === 'department' && !targetDepartment) { showToast('❗ ระบุแผนกที่ต้องการบันทึกถึง', 'error'); return false }
          const totalStaff = countAudience(scope, targetCompanyId, targetDepartment)
          try {
            await createDoc('internal_memos', {
              memoNo: genMemoNo(), to, from, subject, body,
              date: todayBangkok(), author: myName(), time: new Date().toISOString(),
              readByUids: [], totalStaff, scope, targetCompanyId, targetDepartment,
            })
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
          try {
            await createDoc('notifications', {
              type: 'system', title: `📄 บันทึกข้อความใหม่: ${subject}`,
              body: body.slice(0, 100), read: false, link: '/hr/memo', createdAt: new Date().toISOString(),
            })
            setState('unreadCount', (getState('unreadCount') || 0) + 1)
          } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบบันทึกที่บันทึกไปแล้ว */ }
          showToast(`📄 บันทึกแล้ว — แจ้งเตือนถึง ${totalStaff} คน`, 'success'); await loadData()
        }
      })
      setTimeout(() => {
        document.getElementById('mm-scope')?.addEventListener('change', (e) => {
          document.getElementById('mm-company-wrap').style.display = e.target.value === 'company' ? '' : 'none'
          document.getElementById('mm-dept-wrap').style.display = e.target.value === 'department' ? '' : 'none'
        })
      }, 100)
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
