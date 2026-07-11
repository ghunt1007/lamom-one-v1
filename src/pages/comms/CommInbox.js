/**
 * Comm Inbox — กล่องข้อความและการสื่อสาร
 * Route: /comms/inbox
 */
import { timeAgo, initials } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CHANNELS = {
  line:     { label: 'LINE', color: '#06b6d4', icon: '💬' },
  facebook: { label: 'Facebook', color: '#3b82f6', icon: '📘' },
  email:    { label: 'Email', color: 'secondary', icon: '📧' },
  internal: { label: 'ภายใน', color: 'secondary', icon: '🏢' },
  sms:      { label: 'SMS', color: 'warning', icon: '📱' },
}

const MSG_STATUS = {
  unread:   { label: 'ยังไม่อ่าน', color: 'primary' },
  read:     { label: 'อ่านแล้ว', color: 'secondary' },
  replied:  { label: 'ตอบแล้ว', color: 'success' },
  pending:  { label: 'รอดำเนินการ', color: 'warning' },
  archived: { label: 'เก็บแล้ว', color: 'secondary' },
}

export default async function CommInboxPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let messages = []
  let loading = true
  let activeChannel = 'all'
  let activeStatus = 'all'
  let selectedId = null
  let search = ''

  async function loadData() {
    loading = true
    try { messages = await listDocs('comm_messages', [], 'time', 'desc', 200) } catch (e) { messages = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function filtered() {
    return messages.filter(m => {
      if (activeChannel !== 'all' && m.channel !== activeChannel) return false
      if (activeStatus !== 'all' && m.status !== activeStatus) return false
      if (search && !m.sender.toLowerCase().includes(search.toLowerCase()) && !m.subject.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const selected = selectedId ? messages.find(m => m.id === selectedId) || null : null
    const list = filtered()
    const unread = messages.filter(m => m.status === 'unread').length
    const pending = messages.filter(m => m.status === 'pending').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💬 Comm Inbox</div>
            <div class="page-subtitle">กล่องข้อความรวม — LINE, Facebook, Email, SMS</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="compose-btn">✏️ เขียนข้อความ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📬 ข้อความทั้งหมด', messages.length, 'primary')}
          ${kpi('🔵 ยังไม่อ่าน', unread, unread > 0 ? 'primary' : 'secondary')}
          ${kpi('⏳ รอดำเนินการ', pending, pending > 0 ? 'warning' : 'secondary')}
          ${kpi('✅ ตอบแล้ว', messages.filter(m=>m.status==='replied').length, 'success')}
        </div>

        <!-- Two-panel layout -->
        <div style="display:grid;grid-template-columns:340px 1fr;gap:12px;min-height:500px">
          <!-- Left panel: message list -->
          <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
            <!-- Channel tabs -->
            <div style="padding:10px;border-bottom:1px solid var(--border);display:flex;gap:4px;flex-wrap:wrap">
              <button class="btn btn-xs ${activeChannel==='all'?'btn-primary':'btn-secondary'} ch-btn" data-ch="all">ทั้งหมด ${unread>0?`<span style="background:var(--primary);border-radius:10px;padding:0 5px;font-size:0.65rem">${unread}</span>`:''}</button>
              ${Object.entries(CHANNELS).map(([k,v]) => `<button class="btn btn-xs ${activeChannel===k?'btn-primary':'btn-secondary'} ch-btn" data-ch="${k}">${v.icon}</button>`).join('')}
            </div>
            <!-- Search -->
            <div style="padding:8px 10px;border-bottom:1px solid var(--border)">
              <input class="input" id="msg-search" placeholder="🔍 ค้นหา..." style="font-size:0.82rem" value="${escHtml(search)}">
            </div>
            <!-- Messages list -->
            <div style="flex:1;overflow-y:auto">
              ${list.map(m => {
                const ch = CHANNELS[m.channel]
                const isSelected = selected?.id === m.id
                const isUnread = m.status === 'unread'
                return `<div class="msg-item" data-id="${m.id}" style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;background:${isSelected?'var(--surface-2)':'transparent'};${isUnread?'border-left:3px solid var(--primary)':'border-left:3px solid transparent'}">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="font-size:1.1rem">${escHtml(m.avatar)}</div>
                      <div style="font-weight:${isUnread?'700':'500'};font-size:0.83rem">${escHtml(m.sender)}</div>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${timeAgo(m.time)}</div>
                  </div>
                  <div style="font-size:0.78rem;font-weight:600;margin-bottom:2px">${escHtml(m.subject)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(m.preview)}</div>
                  <div style="display:flex;gap:4px;margin-top:4px">
                    <span style="font-size:0.65rem;color:${ch?.color}">${ch?.icon} ${ch?.label}</span>
                    ${m.tags.includes('urgent') ? '<span style="font-size:0.65rem;color:var(--danger)">🚨 เร่งด่วน</span>' : ''}
                  </div>
                </div>`
              }).join('')}
              ${!list.length ? '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.85rem">ไม่มีข้อความ</div>' : ''}
            </div>
          </div>

          <!-- Right panel: message detail -->
          <div class="card" style="padding:16px;display:flex;flex-direction:column">
            ${selected ? renderMsgDetail(selected) : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted)"><div style="font-size:3rem;margin-bottom:12px">💬</div><div>เลือกข้อความเพื่อดูรายละเอียด</div></div>`}
          </div>
        </div>
      </div>
    `

    document.getElementById('compose-btn')?.addEventListener('click', openCompose)
    document.getElementById('msg-search')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    container.querySelectorAll('.ch-btn').forEach(b => b.addEventListener('click', () => { activeChannel = b.dataset.ch; renderPage() }))
    container.querySelectorAll('.msg-item').forEach(el => el.addEventListener('click', async () => {
      const m = messages.find(x => x.id === el.dataset.id)
      if (!m) return
      selectedId = m.id
      if (m.status === 'unread') {
        try { await updateDocData('comm_messages', m.id, { status: 'read' }) } catch (e) {}
        await loadData()
      } else {
        renderPage()
      }
    }))

    if (selected) {
      document.getElementById('reply-btn')?.addEventListener('click', () => openReply(selected))
      document.getElementById('archive-btn')?.addEventListener('click', async () => {
        try {
          await updateDocData('comm_messages', selected.id, { status: 'archived' })
          showToast('📦 เก็บข้อความแล้ว', 'success')
          selectedId = null
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    }
  }

  function renderMsgDetail(m) {
    const ch = CHANNELS[m.channel]
    const st = MSG_STATUS[m.status]
    return `
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-weight:800;font-size:1rem">${escHtml(m.subject)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${escHtml(m.sender)} · ${ch?.icon} ${ch?.label} · ${timeAgo(m.time)}</div>
        </div>
        <span class="badge badge-${st?.color}">${st?.label}</span>
      </div>
      <div style="padding:16px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.87rem;flex:1;margin-bottom:12px">
        ${escHtml(m.preview)}<br><br>
        <span style="color:var(--text-muted);font-size:0.78rem">— ส่งโดย ${escHtml(m.sender)}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="reply-btn" style="flex:1">↩️ ตอบกลับ</button>
        <button class="btn btn-secondary" id="archive-btn">📦 เก็บ</button>
      </div>
    `
  }

  function openReply(m) {
    openModal({
      title: '↩️ ตอบกลับ: ' + escHtml(m.subject),
      size: 'md',
      body: `
        <div style="margin-bottom:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted)">${escHtml(m.preview)}</div>
        <div class="input-group"><label class="input-label">ข้อความตอบกลับ *</label>
          <textarea class="input" id="reply-text" rows="5" placeholder="พิมพ์ข้อความ..."></textarea>
        </div>
      `,
      async onConfirm() {
        const txt = document.getElementById('reply-text')?.value?.trim()
        if (!txt) { showToast('❗ กรุณาพิมพ์ข้อความ', 'error'); return false }
        try {
          await updateDocData('comm_messages', m.id, { status: 'replied' })
          showToast(`✅ ตอบกลับ ${m.sender} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openCompose() {
    openModal({
      title: '✏️ เขียนข้อความใหม่',
      size: 'md',
      body: `
        <div style="display:grid;gap:12px">
          <div class="input-group"><label class="input-label">ช่องทาง</label>
            <select class="input" id="comp-ch">${Object.entries(CHANNELS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ผู้รับ</label><input class="input" id="comp-to" placeholder="ชื่อหรือเบอร์โทร"></div>
          <div class="input-group"><label class="input-label">หัวข้อ</label><input class="input" id="comp-subj" placeholder="หัวข้อข้อความ"></div>
          <div class="input-group"><label class="input-label">ข้อความ</label><textarea class="input" id="comp-body" rows="5" placeholder="พิมพ์ข้อความ..."></textarea></div>
        </div>
      `,
      async onConfirm() {
        const to = document.getElementById('comp-to')?.value?.trim()
        if (!to) { showToast('❗ กรุณากรอกผู้รับ', 'error'); return false }
        try {
          await createDoc('comm_messages', {
            channel: document.getElementById('comp-ch')?.value||'internal',
            sender: to, avatar: '👤',
            subject: document.getElementById('comp-subj')?.value||'(ไม่มีหัวข้อ)',
            preview: document.getElementById('comp-body')?.value||'',
            time: new Date().toISOString(), status: 'read', tags: ['outbound']
          })
          showToast('✅ ส่งข้อความแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
