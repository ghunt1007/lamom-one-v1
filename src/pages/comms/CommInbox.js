/**
 * Comm Inbox — กล่องข้อความและการสื่อสาร
 * Route: /comms/inbox
 */
import { timeAgo, initials } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { watchDocs, listAllDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { suggestCustomerReply, isAiEnabled } from '../../utils/ai.js'
import { sendSms, sendEmail } from '../../utils/comms.js'
import { isProgramOwner } from '../../core/hierarchy.js'

// (v1.0.349) เดิมโหลดข้อความด้วย listDocs() ครั้งเดียวตอนเปิดหน้า ไม่ใช่ real-time จริง (ต้องกดรีเฟรชเอง
// ถึงจะเห็นข้อความใหม่) และปุ่ม "ตอบกลับ"/"เขียนข้อความ" ไม่เคยส่งออกจริงเลยไม่ว่าช่องทางไหน (แค่ตั้งค่า
// status/เขียน Firestore แล้วอ้างว่า "ส่งแล้ว") — แก้ให้ใช้ watchDocs() ฟัง real-time จริง และส่งจริงผ่าน
// sendSms/sendEmail (utils/comms.js) เมื่อมีเบอร์โทร/อีเมลผู้รับจริง — LINE Messaging API ที่ระบบนี้เชื่อม
// ไว้เป็นแบบ Broadcast อย่างเดียว (ไม่มีการเก็บ LINE userId ต่อลูกค้า) และ Facebook/ภายใน ไม่มี integration
// เชื่อมจริงเลย จึงบอกตรงไปตรงมาว่ายังส่งอัตโนมัติไม่ได้สำหรับช่องทางเหล่านี้ ไม่ใช่อ้างว่าส่งแล้วเหมือนเดิม

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
  const canMigrate = isProgramOwner()
  let legacyCount = 0
  let migrating = false

  // (v1.0.484) เอกสารเก่าที่เคยปนอยู่ใน comm_messages (ก่อนแยก collection) ยังไม่ถูกย้ายมา — เพิ่มปุ่มย้าย
  // แบบเดียวกับเครื่องมือ backfill อื่นในระบบ (owner-only, คัดลอกไม่ลบทิ้ง) ระบุด้วยเงื่อนไขเดียวกับที่ filter
  // กันข้อมูล CommHub ปนมาอยู่แล้ว (มี field time + channel ตรงกับ CHANNELS)
  function isInboxLike(d) { return !!d.time && !!CHANNELS[d.channel] }
  async function checkLegacy() {
    try {
      const legacy = await listAllDocs('comm_messages', [], 'createdAt', 'desc', 500)
      legacyCount = legacy.filter(d => isInboxLike(d) && !d._migratedToInbox).length
    } catch { legacyCount = 0 }
    if (container.__routerGen === myGen) renderPage()
  }
  async function runMigration() {
    migrating = true
    renderPage()
    let migrated = 0, errors = 0
    try {
      const legacy = await listAllDocs('comm_messages', [], 'createdAt', 'desc', 500)
      for (const doc of legacy.filter(d => isInboxLike(d) && !d._migratedToInbox)) {
        try {
          await createDoc('comm_inbox_messages', doc)
          await updateDocData('comm_messages', doc.id, { _migratedToInbox: true })
          migrated++
        } catch { errors++ }
      }
    } catch { showToast('อ่านข้อมูลเก่าไม่สำเร็จ', 'error') }
    migrating = false
    showToast(`✅ ย้ายข้อมูลเก่าแล้ว ${migrated} รายการ${errors ? ` (พลาด ${errors} รายการ)` : ''}`, errors ? 'warning' : 'success')
    legacyCount = 0
    renderPage()
  }
  if (canMigrate) checkLegacy()

  // (v1.0.484) แยก collection ออกจาก comm_messages (ที่ CommHub.js แชทภายในทีมใช้อยู่) เป็น
  // comm_inbox_messages ของตัวเอง — เดิมสองหน้านี้ใช้ collection เดียวกันแต่ field shape คนละแบบ (คนละ
  // วัตถุประสงค์กันจริง: แชทภายในทีม vs ข้อความจากลูกค้า) กันไว้แค่ด้วย orderBy('time')/filter(CHANNELS[...])
  // ซึ่งเป็นการป้องกันที่เผลอได้ถ้าโครงสร้างเปลี่ยนในอนาคต ตอนนี้แยกจริงแล้ว ไม่ต้องพึ่ง orderBy กันข้อมูลปนกันอีก
  const unsub = watchDocs('comm_inbox_messages', [], 'time', 'desc', 200, rows => {
    if (container.__routerGen !== myGen) { unsub(); return }
    messages = rows.filter(m => CHANNELS[m.channel])
    loading = false
    renderPage()
  })

  function filtered() {
    return messages.filter(m => {
      if (activeChannel !== 'all' && m.channel !== activeChannel) return false
      if (activeStatus !== 'all' && m.status !== activeStatus) return false
      if (search && !(m.sender||'').toLowerCase().includes(search.toLowerCase()) && !(m.subject||'').toLowerCase().includes(search.toLowerCase())) return false
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

        ${canMigrate && legacyCount > 0 ? `<div class="card" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--warning);font-size:0.78rem;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <span>🔧 พบข้อความเก่า ${legacyCount} รายการที่ยังปนอยู่ใน collection เดิม (comm_messages) — ข้อความเก่าจะยังอยู่ครบ แค่คัดลอกมารวม ไม่ลบทิ้ง</span>
          <button class="btn btn-warning btn-sm" id="migrate-legacy-btn" ${migrating ? 'disabled' : ''}>${migrating ? '⏳ กำลังย้าย...' : '🔧 ย้ายข้อความเก่ามารวม'}</button>
        </div>` : ''}

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
                    ${(m.tags||[]).includes('urgent') ? '<span style="font-size:0.65rem;color:var(--danger)">🚨 เร่งด่วน</span>' : ''}
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
    document.getElementById('migrate-legacy-btn')?.addEventListener('click', runMigration)
    document.getElementById('msg-search')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    container.querySelectorAll('.ch-btn').forEach(b => b.addEventListener('click', () => { activeChannel = b.dataset.ch; renderPage() }))
    container.querySelectorAll('.msg-item').forEach(el => el.addEventListener('click', async () => {
      const m = messages.find(x => x.id === el.dataset.id)
      if (!m) return
      selectedId = m.id
      if (m.status === 'unread') {
        try { await updateDocData('comm_inbox_messages', m.id, { status: 'read' }) } catch (e) {}
      }
      renderPage()
    }))

    if (selected) {
      document.getElementById('reply-btn')?.addEventListener('click', () => openReply(selected))
      document.getElementById('archive-btn')?.addEventListener('click', async () => {
        try {
          await updateDocData('comm_inbox_messages', selected.id, { status: 'archived' })
          showToast('📦 เก็บข้อความแล้ว', 'success')
          selectedId = null
          renderPage()
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error') }
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
    const { el } = openModal({
      title: '↩️ ตอบกลับ: ' + escHtml(m.subject),
      size: 'md',
      body: `
        <div style="margin-bottom:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted)">${escHtml(m.preview)}</div>
        <div class="input-group"><label class="input-label">ข้อความตอบกลับ *</label>
          <textarea class="input" id="reply-text" rows="5" placeholder="พิมพ์ข้อความ..."></textarea>
        </div>
        ${isAiEnabled() ? `<button type="button" class="btn btn-secondary btn-sm" id="reply-ai-btn">🤖 ช่วยร่างคำตอบ</button>` : ''}
      `,
      async onConfirm() {
        const txt = document.getElementById('reply-text')?.value?.trim()
        if (!txt) { showToast('❗ กรุณาพิมพ์ข้อความ', 'error'); return false }
        // (v1.0.349) ส่งจริงได้เฉพาะ SMS/Email ที่มีเบอร์โทร/อีเมลผู้รับบันทึกไว้จริงเท่านั้น (LINE เชื่อมแบบ
        // Broadcast อย่างเดียว ไม่มี userId ต่อลูกค้าให้ DM ได้ Facebook/ภายใน ไม่มี integration เชื่อมจริงเลย)
        let sentReal = false
        let sendErr = ''
        try {
          if (m.channel === 'sms' && m.phone) { await sendSms([m.phone], txt); sentReal = true }
          else if (m.channel === 'email' && m.email) { await sendEmail([m.email], 'Re: ' + m.subject, txt); sentReal = true }
        } catch (e) { sendErr = e.message }
        if (sendErr) { showToast('❌ ส่งไม่สำเร็จ: ' + sendErr, 'error'); return false }
        try {
          await updateDocData('comm_inbox_messages', m.id, { status: 'replied' })
          showToast(sentReal
            ? `✅ ส่ง${CHANNELS[m.channel]?.label}ถึง ${m.sender} แล้ว`
            : `📝 บันทึกคำตอบแล้ว — ยังไม่มีช่องทางส่งอัตโนมัติสำหรับ${CHANNELS[m.channel]?.label || m.channel} กรุณาส่งให้ ${m.sender} ด้วยตนเอง`,
            'success')
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error') }
      }
    })
    el.querySelector('#reply-ai-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget
      btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        const draft = await suggestCustomerReply(m.preview, { channel: CHANNELS[m.channel]?.label, sender: m.sender })
        if (draft) el.querySelector('#reply-text').value = draft
        else showToast('AI ร่างคำตอบไม่สำเร็จ', 'error')
      } catch { showToast('AI ร่างคำตอบไม่สำเร็จ', 'error') }
      finally { btn.disabled = false; btn.innerHTML = '🤖 ช่วยร่างคำตอบ' }
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
          <div class="input-group"><label class="input-label">ผู้รับ (ชื่อ)</label><input class="input" id="comp-to" placeholder="ชื่อผู้รับ"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร (สำหรับ SMS)</label><input class="input" id="comp-phone" placeholder="08x-xxx-xxxx"></div>
          <div class="input-group"><label class="input-label">อีเมล (สำหรับ Email)</label><input class="input" id="comp-email" placeholder="name@email.com"></div>
          <div class="input-group"><label class="input-label">หัวข้อ</label><input class="input" id="comp-subj" placeholder="หัวข้อข้อความ"></div>
          <div class="input-group"><label class="input-label">ข้อความ</label><textarea class="input" id="comp-body" rows="5" placeholder="พิมพ์ข้อความ..."></textarea></div>
        </div>
      `,
      async onConfirm() {
        const to = document.getElementById('comp-to')?.value?.trim()
        if (!to) { showToast('❗ กรุณากรอกผู้รับ', 'error'); return false }
        const channel = document.getElementById('comp-ch')?.value || 'internal'
        const phone = document.getElementById('comp-phone')?.value?.trim() || ''
        const email = document.getElementById('comp-email')?.value?.trim() || ''
        const subject = document.getElementById('comp-subj')?.value || '(ไม่มีหัวข้อ)'
        const body = document.getElementById('comp-body')?.value || ''
        // (v1.0.349) ส่งจริงได้เฉพาะ SMS/Email ที่กรอกเบอร์โทร/อีเมลไว้เท่านั้น ช่องทางอื่นบันทึกเป็นบันทึก
        // ภายในเท่านั้น ไม่อ้างว่าส่งออกจริงเหมือนเดิม
        let sentReal = false
        let sendErr = ''
        try {
          if (channel === 'sms' && phone) { await sendSms([phone], body); sentReal = true }
          else if (channel === 'email' && email) { await sendEmail([email], subject, body); sentReal = true }
        } catch (e) { sendErr = e.message }
        if (sendErr) { showToast('❌ ส่งไม่สำเร็จ: ' + sendErr, 'error'); return false }
        try {
          await createDoc('comm_inbox_messages', {
            channel, sender: to, avatar: '👤', phone, email,
            subject, preview: body,
            time: new Date().toISOString(), status: 'read', tags: ['outbound']
          })
          showToast(sentReal ? `✅ ส่ง${CHANNELS[channel]?.label}ถึง ${to} แล้ว!` : `📝 บันทึกข้อความแล้ว — ยังไม่มีช่องทางส่งอัตโนมัติสำหรับ${CHANNELS[channel]?.label || channel}`, 'success')
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error') }
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
