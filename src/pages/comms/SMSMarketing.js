/**
 * SMS Marketing — ส่ง SMS หาลูกค้า
 * Route: /comms/sms
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { TARGET_SEGMENTS, getSegmentMembers, getSegmentCount, reachableMembers } from '../../core/segments.js'
import { sendSms } from '../../utils/comms.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SMS_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary', icon: '📝' },
  scheduled: { label: 'กำหนดส่ง', color: 'primary', icon: '⏰' },
  sending:   { label: 'กำลังส่ง', color: 'warning', icon: '🔄' },
  sent:      { label: 'ส่งแล้ว', color: 'success', icon: '✅' },
  failed:    { label: 'ล้มเหลว', color: 'danger', icon: '❌' },
}

const SMS_TEMPLATES = [
  'LAMOM: [ชื่อ] รถของคุณครบ [กำหนด] กรุณานัดเช็คระยะ 02-xxx-xxxx',
  'LAMOM: โปรโมชั่น [เดือน]! [รุ่น] ราคาพิเศษ [ราคา] บาท สอบถาม 02-xxx-xxxx',
  'ยินดีต้อนรับสู่ LAMOM! ขอบคุณที่ไว้วางใจเรา ติดต่อ 02-xxx-xxxx ได้เลย',
  'LAMOM: ประกันรถของคุณใกล้หมดอายุ ([วันหมด]) ต่ออายุได้ที่ 02-xxx-xxxx',
]

export default async function SMSMarketingPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let campaigns = []
  let loading = true
  let credits = 1500

  async function loadData() {
    loading = true
    try { campaigns = await listDocs('sms_campaigns', [], 'time', 'desc', 200) } catch (e) { campaigns = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const totalSent = campaigns.reduce((a, c) => a + (c.sent || 0), 0)
    const active = campaigns.filter(c => c.status === 'scheduled').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📱 SMS Marketing</div>
            <div class="page-subtitle">ส่ง SMS — แจ้งเตือน โปรโมชั่น ติดตาม</div>
          </div>
          <div class="page-actions">
            <div style="font-size:0.78rem;color:var(--text-muted);padding:6px 10px;background:var(--surface-2);border-radius:var(--radius-sm)">📊 เครดิตคงเหลือ: <strong>${credits.toLocaleString()}</strong></div>
            <button class="btn btn-primary" id="create-btn">+ สร้าง Campaign</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📱 ส่งแล้วทั้งหมด', totalSent.toLocaleString() + ' ข้อความ', 'primary')}
          ${kpi('⏰ กำหนดส่ง', active + ' รายการ', 'warning')}
          ${kpi('📊 Campaigns', campaigns.length, 'secondary')}
          ${kpi('💳 เครดิต', credits.toLocaleString(), credits < 200 ? 'danger' : 'success')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${campaigns.map(c => {
            const ss = SMS_STATUS[c.status]
            const deliveryRate = c.recipients > 0 && c.sent != null ? Math.round(c.sent / c.recipients * 100) : null
            return `<div class="card" style="padding:13px 14px">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(c.name)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">👥 ${TARGET_SEGMENTS[c.target] || (c.recipients + ' ราย')} ${c.time ? '· ' + timeAgo(c.time) : ''}</div>
                </div>
                <span class="badge badge-${ss?.color}" style="font-size:0.63rem">${ss?.icon} ${ss?.label}</span>
              </div>
              <div style="font-size:0.78rem;font-style:italic;color:var(--text-muted);margin-bottom:8px;padding:6px 8px;background:var(--surface-2);border-radius:var(--radius-sm)">"${escHtml(c.message)}"</div>
              ${c.status === 'sent' ? (c.sent == null ? `
                <div style="font-size:0.73rem;color:var(--text-muted);margin-bottom:6px">📊 ยังไม่รองรับการติดตามผลส่งจริง (ไม่ได้เชื่อมต่อผู้ให้บริการ)</div>
              ` : `
                <div style="display:flex;gap:12px;font-size:0.73rem;margin-bottom:6px">
                  <span>🎯 เป้าหมาย: <strong>${c.recipients}</strong></span>
                  <span>✅ ส่งสำเร็จ: <strong>${c.sent}</strong></span>
                  <span>❌ ล้มเหลว: <strong>${c.failed || 0}</strong></span>
                  ${deliveryRate != null ? `<span>📊 อัตราสำเร็จ: <strong>${deliveryRate}%</strong></span>` : ''}
                </div>
              `) : ''}
              <div style="display:flex;gap:6px">
                ${c.status === 'draft' ? `<button class="btn btn-xs btn-primary send-now-btn" data-id="${c.id}">📱 ส่งทันที</button>` : ''}
                ${c.status === 'scheduled' ? `<button class="btn btn-xs btn-warning cancel-schedule-btn" data-id="${c.id}">🚫 ยกเลิก</button>` : ''}
                <button class="btn btn-xs btn-secondary copy-btn" data-id="${c.id}">📋 ทำซ้ำ</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.send-now-btn').forEach(b => b.addEventListener('click', async () => {
      const c = campaigns.find(x => x.id === b.dataset.id)
      if (!c) return
      const members = await getSegmentMembers(c.target || 'all')
      const reachable = reachableMembers(members, 'sms')
      if (!reachable.length) { showToast('❗ ไม่มีผู้รับที่มีเบอร์โทรจริงในกลุ่มนี้', 'error'); return }
      if (credits < reachable.length) { showToast('❗ เครดิตไม่พอ', 'error'); return }

      const ok = await confirmDialog({
        title: '📱 ยืนยันส่ง SMS',
        message: `จะส่ง SMS จริงทันทีถึง <strong>${reachable.length.toLocaleString()} ราย</strong> ในกลุ่ม "${TARGET_SEGMENTS[c.target] || c.target}" (ใช้เครดิต ${reachable.length} ข้อความ) การส่งนี้ไม่สามารถยกเลิกได้ ยืนยันส่งหรือไม่?`,
        confirmText: '📱 ส่งจริง',
        danger: true,
      })
      if (!ok) return

      b.disabled = true
      try {
        const result = await sendSms(reachable.map(m => m.phone), c.message)
        if (result.configured === false) { showToast('❗ ' + result.error, 'error'); return }

        await updateDocData('sms_campaigns', c.id, {
          status: 'sent', recipients: reachable.length, sent: result.sent, failed: result.failed, time: new Date().toISOString(),
        })
        credits -= result.sent
        showToast(`📱 ส่งจริงแล้ว — สำเร็จ ${result.sent} / ล้มเหลว ${result.failed}`, 'success')
        await loadData()
      } catch (e) { showToast('ส่งไม่สำเร็จ: ' + e.message, 'error') }
      finally { b.disabled = false }
    }))
    container.querySelectorAll('.cancel-schedule-btn').forEach(b => b.addEventListener('click', async () => {
      const c = campaigns.find(x => x.id === b.dataset.id)
      if (!c) return
      try {
        await updateDocData('sms_campaigns', c.id, { status: 'draft' })
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', async () => {
      const c = campaigns.find(x => x.id === b.dataset.id)
      if (!c) return
      try {
        await createDoc('sms_campaigns', { name: c.name + ' (ทำซ้ำ)', target: c.target, recipients: c.recipients, sent: null, failed: null, status: 'draft', time: null, message: c.message })
        showToast('📋 ทำซ้ำ Campaign แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('create-btn')?.addEventListener('click', openCreateForm)
  }

  function openCreateForm() {
    openModal({
      title: '+ สร้าง SMS Campaign',
      size: 'md',
      body: `<div style="display:grid;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อ Campaign *</label><input class="input" id="sms-name"></div>
        <div class="input-group"><label class="input-label">ข้อความ (ไม่เกิน 160 ตัวอักษร)</label>
          <textarea class="input" id="sms-msg" rows="3" maxlength="160" placeholder="LAMOM: ข้อความ..."></textarea>
          <div id="sms-counter" style="font-size:0.68rem;color:var(--text-muted);text-align:right">0/160</div>
        </div>
        <div class="input-group"><label class="input-label">Template</label>
          <select class="input" id="sms-tpl">
            <option value="">— เลือก Template —</option>
            ${SMS_TEMPLATES.map((t,i) => `<option value="${t}">Template ${i+1}</option>`).join('')}
          </select>
        </div>
        <div class="input-group"><label class="input-label">กลุ่มเป้าหมาย</label>
          <select class="input" id="sms-target">
            ${Object.entries(TARGET_SEGMENTS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
          <div id="sms-reach-hint" style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">กำลังคำนวณจำนวนผู้รับจริง...</div>
        </div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('sms-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ','error'); return false }
        const msg = document.getElementById('sms-msg')?.value || ''
        const target = document.getElementById('sms-target')?.value || 'all'
        try {
          const recip = await getSegmentCount(target, 'sms')
          await createDoc('sms_campaigns', { name, target, recipients: recip, sent: null, failed: null, status: 'draft', time: null, message: msg })
          showToast('✅ สร้าง Campaign แล้ว','success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      const msgEl = document.getElementById('sms-msg')
      const counter = document.getElementById('sms-counter')
      const targetEl = document.getElementById('sms-target')
      const hintEl = document.getElementById('sms-reach-hint')
      msgEl?.addEventListener('input', () => { if(counter) counter.textContent = `${msgEl.value.length}/160` })
      document.getElementById('sms-tpl')?.addEventListener('change', e => { if(e.target.value && msgEl) msgEl.value = e.target.value })
      async function updateHint() {
        hintEl.textContent = 'กำลังคำนวณจำนวนผู้รับจริง...'
        const count = await getSegmentCount(targetEl.value, 'sms')
        hintEl.textContent = `📊 มีเบอร์โทรจริงในกลุ่มนี้ ${count.toLocaleString()} ราย`
      }
      targetEl?.addEventListener('change', updateHint)
      updateHint()
    }, 100)
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
