/**
 * Broadcast — ส่งข้อความหาลูกค้าจำนวนมาก
 * Route: /comms/broadcast
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { TARGET_SEGMENTS, getSegmentMembers, getSegmentCount, reachableMembers } from '../../core/segments.js'
import { sendSms, sendEmail, sendLineBroadcast, sendPush } from '../../utils/comms.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const BCAST_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary' },
  scheduled: { label: 'กำหนดเวลา', color: 'warning' },
  sending:   { label: 'กำลังส่ง', color: 'primary' },
  sent:      { label: 'ส่งแล้ว', color: 'success' },
  failed:    { label: 'ล้มเหลว', color: 'danger' },
}

const CHANNELS = {
  line:     { label: 'LINE Broadcast', icon: '💬', color: 'success' },
  sms:      { label: 'SMS', icon: '📱', color: 'warning' },
  email:    { label: 'Email', icon: '📧', color: 'primary' },
  push:     { label: 'Push Notification', icon: '🔔', color: 'secondary' },
}

const TARGET_SEGS = TARGET_SEGMENTS

export default async function BroadcastPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let broadcasts = []
  let loading = true

  async function loadData() {
    loading = true
    try { broadcasts = await listDocs('broadcasts', [], 'sentAt', 'desc', 200) } catch (e) { broadcasts = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const sent = broadcasts.filter(b => b.status === 'sent').length
    const totalSuccess = broadcasts.filter(b => b.status === 'sent' && b.sent != null).reduce((a, b) => a + b.sent, 0)
    const totalFailed = broadcasts.filter(b => b.status === 'sent' && b.failed != null).reduce((a, b) => a + (b.failed || 0), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📢 Broadcast</div>
            <div class="page-subtitle">ส่งข้อความหาลูกค้าจำนวนมาก — LINE, SMS, Email, Push</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="create-bc-btn">+ สร้าง Broadcast</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📨 Broadcast ทั้งหมด', broadcasts.length, 'primary')}
          ${kpi('✅ ส่งแล้ว', sent, 'success')}
          ${kpi('👥 ส่งสำเร็จรวม', totalSuccess.toLocaleString(), 'primary')}
          ${kpi('❌ ล้มเหลวรวม', totalFailed.toLocaleString(), totalFailed > 0 ? 'danger' : 'secondary')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${broadcasts.map(b => {
            const ch = CHANNELS[b.channel]
            const st = BCAST_STATUS[b.status]
            return `<div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                <div style="display:flex;gap:10px;align-items:flex-start">
                  <div style="font-size:1.5rem">${ch?.icon}</div>
                  <div>
                    <div style="font-weight:700;font-size:0.88rem">${escHtml(b.title)}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
                      ${ch?.label} · ${TARGET_SEGS[b.target] || escHtml(b.target)}
                      ${b.sentAt ? ' · ส่งเมื่อ ' + timeAgo(b.sentAt) : ''}
                      ${b.scheduledAt ? ' · กำหนดส่ง ' + formatDate(b.scheduledAt) : ''}
                    </div>
                  </div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <span class="badge badge-${st?.color}">${st?.label}</span>
                </div>
              </div>

              ${b.status === 'sent' ? (b.sent == null ? `
                <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">📊 ยังไม่รองรับการติดตามผลส่งจริง (ไม่ได้เชื่อมต่อผู้ให้บริการ)</div>
              ` : `
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px">
                  ${miniStat('🎯 เป้าหมาย', b.recipients != null ? b.recipients.toLocaleString() : '—')}
                  ${miniStat('✅ สำเร็จ', b.sent.toLocaleString())}
                  ${miniStat('❌ ล้มเหลว', (b.failed || 0).toLocaleString())}
                </div>
                <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:10px">👁 เปิดอ่าน/🖱 คลิก — ยังไม่รองรับ (ต้องต่อ Webhook ติดตามผลเพิ่มเติม)</div>
              `) : `<div style="padding:8px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">${escHtml(b.message)}</div>`}

              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-secondary view-bc-btn" data-id="${b.id}">ดูรายละเอียด</button>
                ${b.status === 'draft' ? `<button class="btn btn-xs btn-primary send-bc-btn" data-id="${b.id}">📤 ส่งทันที</button>` : ''}
                ${b.status === 'draft' ? `<button class="btn btn-xs btn-secondary sched-bc-btn" data-id="${b.id}">⏰ กำหนดเวลา</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    document.getElementById('create-bc-btn')?.addEventListener('click', openCreateForm)
    container.querySelectorAll('.view-bc-btn').forEach(b => b.addEventListener('click', () => {
      const bc = broadcasts.find(x => x.id === b.dataset.id); if (bc) openDetail(bc)
    }))
    container.querySelectorAll('.send-bc-btn').forEach(b => b.addEventListener('click', async () => {
      const bc = broadcasts.find(x => x.id === b.dataset.id)
      if (!bc) return
      b.disabled = true
      try {
        let result, recipients

        if (bc.channel === 'line') {
          if (bc.target !== 'all') {
            showToast('❗ LINE รองรับส่งแบบ "ลูกค้าทั้งหมด" เท่านั้นตอนนี้ — ระบบยังไม่ได้เก็บ LINE userId รายบุคคลของลูกค้า (เก็บแค่ LINE ID ที่กรอกเอง ใช้ยิงเฉพาะกลุ่มไม่ได้)', 'error')
            return
          }
          result = await sendLineBroadcast(bc.message)
          recipients = null // Broadcast API ของ LINE ส่งถึงเพื่อน OA ทั้งหมด ฝั่งเราไม่ทราบจำนวนผู้รับจริง
        } else {
          const members = await getSegmentMembers(bc.target)
          const reachable = reachableMembers(members, bc.channel)
          if (!reachable.length) {
            showToast(bc.channel === 'push'
              ? '❗ ยังไม่มีลูกค้าลงทะเบียนรับ Push Notification ในระบบ (ต้องสร้างระบบเก็บ Push token ก่อน)'
              : '❗ ไม่มีผู้รับที่ส่งได้จริงในกลุ่มนี้สำหรับช่องทางนี้ (ไม่มีข้อมูลติดต่อ)', 'error')
            return
          }
          if (bc.channel === 'sms') result = await sendSms(reachable.map(m => m.phone), bc.message)
          else if (bc.channel === 'email') result = await sendEmail(reachable.map(m => m.email), bc.subject || bc.title, bc.message)
          else if (bc.channel === 'push') result = await sendPush(reachable.map(m => m.fcmToken), bc.title || bc.title, bc.message)
          recipients = reachable.length
        }

        if (result.configured === false) {
          showToast('❗ ' + result.error, 'error')
          return
        }

        await updateDocData('broadcasts', bc.id, {
          status: 'sent', sentAt: new Date().toISOString(),
          recipients, sent: result.sent ?? null, failed: result.failed ?? null,
          delivered: null, opened: null, clicked: null,
        })
        showToast(`📤 ส่งจริงแล้ว — สำเร็จ ${result.sent ?? '-'} / ล้มเหลว ${result.failed ?? 0}`, 'success')
        await loadData()
      } catch (e) { showToast('ส่งไม่สำเร็จ: ' + e.message, 'error') }
      finally { b.disabled = false }
    }))
  }

  function openDetail(bc) {
    const ch = CHANNELS[bc.channel]
    const st = BCAST_STATUS[bc.status]
    openModal({
      title: '📢 ' + escHtml(bc.id) + ' — ' + escHtml(bc.title),
      size: 'md',
      body: `
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <span class="badge badge-${ch?.color}">${ch?.icon} ${ch?.label}</span>
          <span class="badge badge-${st?.color}">${st?.label}</span>
        </div>
        ${row('กลุ่มเป้าหมาย', TARGET_SEGS[bc.target] || escHtml(bc.target))}
        ${bc.sentAt ? row('วันที่ส่ง', timeAgo(bc.sentAt)) : ''}
        ${bc.scheduledAt ? row('กำหนดส่ง', formatDate(bc.scheduledAt)) : ''}
        ${bc.recipients > 0 ? row('จำนวนเป้าหมาย', bc.recipients.toLocaleString() + ' คน') : ''}
        ${bc.sent != null ? row('ส่งสำเร็จ', bc.sent.toLocaleString() + ' คน') : ''}
        ${bc.failed != null ? row('ล้มเหลว', bc.failed.toLocaleString() + ' คน') : ''}
        ${bc.status === 'sent' && bc.sent == null ? row('การติดตามผล', 'ยังไม่เชื่อมต่อผู้ให้บริการส่งข้อความจริง') : ''}
        <div style="margin-top:12px;padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.85rem">${escHtml(bc.message)}</div>
      `
    })
  }

  function openCreateForm() {
    openModal({
      title: '+ สร้าง Broadcast ใหม่',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อแคมเปญ *</label><input class="input" id="bc-title" placeholder="ชื่อ Broadcast..."></div>
          <div class="input-group"><label class="input-label">ช่องทาง</label>
            <select class="input" id="bc-channel">${Object.entries(CHANNELS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">กลุ่มเป้าหมาย</label>
            <select class="input" id="bc-target">${Object.entries(TARGET_SEGS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
          </div>
          <div class="input-group" id="bc-subject-group" style="grid-column:1/-1;display:none"><label class="input-label">หัวข้อ Email *</label><input class="input" id="bc-subject" placeholder="หัวข้ออีเมล..."></div>
          <div style="grid-column:1/-1;font-size:0.75rem;color:var(--text-muted)" id="bc-reach-hint">กำลังคำนวณจำนวนผู้รับจริง...</div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ข้อความ *</label>
            <textarea class="input" id="bc-msg" rows="5" placeholder="พิมพ์ข้อความ (LINE: 500 ตัวอักษร, SMS: 160 ตัวอักษร)"></textarea>
          </div>
        </div>
      `,
      async onConfirm() {
        const title = document.getElementById('bc-title')?.value?.trim()
        const msg = document.getElementById('bc-msg')?.value?.trim()
        const channel = document.getElementById('bc-channel')?.value || 'line'
        const subject = document.getElementById('bc-subject')?.value?.trim() || ''
        if (!title || !msg) { showToast('❗ กรุณากรอกชื่อและข้อความ', 'error'); return false }
        if (channel === 'email' && !subject) { showToast('❗ กรุณากรอกหัวข้อ Email', 'error'); return false }
        try {
          await createDoc('broadcasts', {
            title, channel, status: 'draft',
            target: document.getElementById('bc-target')?.value || 'all',
            subject,
            recipients: null, sent: null, failed: null, delivered: null, opened: null, clicked: null,
            sentAt: null, scheduledAt: null, message: msg
          })
          showToast('✅ สร้าง Broadcast แล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })

    const channelEl = document.getElementById('bc-channel')
    const targetEl = document.getElementById('bc-target')
    const subjectGroup = document.getElementById('bc-subject-group')
    const hintEl = document.getElementById('bc-reach-hint')

    async function updateHint() {
      const channel = channelEl?.value || 'line'
      const target = targetEl?.value || 'all'
      subjectGroup.style.display = channel === 'email' ? '' : 'none'
      if (channel === 'line') {
        hintEl.textContent = target === 'all'
          ? '💬 LINE Broadcast ส่งถึงเพื่อน OA ทั้งหมด (ไม่จำกัดตามกลุ่มเป้าหมายที่เลือก)'
          : '⚠️ LINE ยังรองรับส่งแบบ "ลูกค้าทั้งหมด" เท่านั้น (ยังไม่มีการเก็บ LINE userId รายบุคคล)'
        return
      }
      hintEl.textContent = 'กำลังคำนวณจำนวนผู้รับจริง...'
      const count = await getSegmentCount(target, channel)
      hintEl.textContent = `📊 ส่งได้จริง ${count.toLocaleString()} ราย (มีข้อมูลติดต่อช่องทางนี้)`
    }
    channelEl?.addEventListener('change', updateHint)
    targetEl?.addEventListener('change', updateHint)
    updateHint()
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function miniStat(l, v) { return `<div style="text-align:center;padding:8px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.68rem;color:var(--text-muted)">${l}</div><div style="font-size:0.9rem;font-weight:700">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
