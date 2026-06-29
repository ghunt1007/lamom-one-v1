/**
 * SMS Marketing — ส่ง SMS หาลูกค้า
 * Route: /comms/sms
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const SMS_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary', icon: '📝' },
  scheduled: { label: 'กำหนดส่ง', color: 'primary', icon: '⏰' },
  sending:   { label: 'กำลังส่ง', color: 'warning', icon: '🔄' },
  sent:      { label: 'ส่งแล้ว', color: 'success', icon: '✅' },
  failed:    { label: 'ล้มเหลว', color: 'danger', icon: '❌' },
}

const DEMO_CAMPAIGNS = [
  { id: 'SMS001', name: 'แจ้งโปรโมชั่นเดือนมิ.ย.', recipients: 542, sent: 542, failed: 8, status: 'sent', cost: 542, time: addDays(-5), message: 'LAMOM: โปรพิเศษเดือนนี้! ซื้อ BYD Dolphin รับส่วนลด 50,000 บาท สอบถาม 02-xxx-xxxx' },
  { id: 'SMS002', name: 'แจ้งเช็คระยะตามนัด', recipients: 87, sent: 85, failed: 2, status: 'sent', cost: 87, time: addDays(-3), message: 'LAMOM: รถของคุณถึงกำหนดเช็คระยะ กรุณานัดหมายได้ที่ 02-xxx-xxxx' },
  { id: 'SMS003', name: 'Welcome ลูกค้าใหม่ (สัปดาห์นี้)', recipients: 12, sent: 0, failed: 0, status: 'scheduled', cost: 0, time: addDays(1), message: 'ยินดีต้อนรับสู่ครอบครัว LAMOM! หากมีคำถามติดต่อ 02-xxx-xxxx' },
  { id: 'SMS004', name: 'Win-back ลูกค้า at risk', recipients: 32, sent: 0, failed: 0, status: 'draft', cost: 0, time: null, message: 'LAMOM: เราคิดถึงคุณ! มาเยี่ยมชมโปรแกรมใหม่ได้ที่โชว์รูม รับส่วนลดพิเศษสำหรับลูกค้าเก่า' },
]

const SMS_TEMPLATES = [
  'LAMOM: [ชื่อ] รถของคุณครบ [กำหนด] กรุณานัดเช็คระยะ 02-xxx-xxxx',
  'LAMOM: โปรโมชั่น [เดือน]! [รุ่น] ราคาพิเศษ [ราคา] บาท สอบถาม 02-xxx-xxxx',
  'ยินดีต้อนรับสู่ LAMOM! ขอบคุณที่ไว้วางใจเรา ติดต่อ 02-xxx-xxxx ได้เลย',
  'LAMOM: ประกันรถของคุณใกล้หมดอายุ ([วันหมด]) ต่ออายุได้ที่ 02-xxx-xxxx',
]

export default async function SMSMarketingPage(container) {
  const myGen = container.__routerGen
  let campaigns = DEMO_CAMPAIGNS.map(c => ({ ...c }))
  let dataSource = 'demo'
  let credits = 1500

  try {
    const docs = await listDocs('sms_campaigns', [], 'time', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `SMS${i+1}`,
        name: d.name || d.campaignName || 'แคมเปญ',
        recipients: d.recipients || 0,
        sent: d.sent || 0,
        failed: d.failed || 0,
        status: d.status || 'draft',
        cost: d.cost || 0,
        time: d.time || d.createdAt || null,
        message: d.message || '',
      }))
      campaigns = [...mapped, ...DEMO_CAMPAIGNS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const totalSent = campaigns.reduce((a, c) => a + c.sent, 0)
    const active = campaigns.filter(c => c.status === 'scheduled').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📱 SMS Marketing</div>
            <div class="page-subtitle">ส่ง SMS — แจ้งเตือน โปรโมชั่น ติดตาม${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
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
            const deliveryRate = c.recipients > 0 ? Math.round(c.sent / c.recipients * 100) : 0
            return `<div class="card" style="padding:13px 14px">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(c.name)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">👥 ${c.recipients} ราย ${c.time ? '· ' + timeAgo(c.time) : ''}</div>
                </div>
                <span class="badge badge-${ss?.color}" style="font-size:0.63rem">${ss?.icon} ${ss?.label}</span>
              </div>
              <div style="font-size:0.78rem;font-style:italic;color:var(--text-muted);margin-bottom:8px;padding:6px 8px;background:var(--surface-2);border-radius:var(--radius-sm)">"${escHtml(c.message)}"</div>
              ${c.status === 'sent' ? `
                <div style="display:flex;gap:12px;font-size:0.73rem;margin-bottom:6px">
                  <span>✅ ส่งสำเร็จ: <strong>${c.sent}</strong></span>
                  <span>❌ ล้มเหลว: <strong>${c.failed}</strong></span>
                  <span>📊 Delivery: <strong>${deliveryRate}%</strong></span>
                </div>
              ` : ''}
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

    container.querySelectorAll('.send-now-btn').forEach(b => b.addEventListener('click', () => {
      const c = campaigns.find(x => x.id === b.dataset.id)
      if (c && credits >= c.recipients) {
        c.status = 'sent'; c.sent = c.recipients - Math.floor(Math.random()*5); c.time = new Date().toISOString()
        credits -= c.recipients; showToast('📱 ส่ง SMS แล้ว!','success'); renderPage()
      } else showToast('❗ เครดิตไม่พอ','error')
    }))
    container.querySelectorAll('.cancel-schedule-btn').forEach(b => b.addEventListener('click', () => {
      const c = campaigns.find(x => x.id === b.dataset.id); if(c){c.status='draft'; renderPage()}
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
            <option>ลูกค้าทั้งหมด (1,842 ราย)</option>
            <option>ลูกค้า Active (654 ราย)</option>
            <option>ลูกค้า At Risk (87 ราย)</option>
            <option>ใกล้หมดประกัน (134 ราย)</option>
          </select>
        </div>
      </div>`,
      onConfirm() {
        const name = document.getElementById('sms-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ','error'); return }
        const msg = document.getElementById('sms-msg')?.value || ''
        const target = document.getElementById('sms-target')?.value || ''
        const recip = parseInt(target.match(/\d+/)?.[0]) || 50
        campaigns.unshift({ id:`SMS${String(campaigns.length+1).padStart(3,'0')}`, name, recipients: recip, sent:0, failed:0, status:'draft', cost:0, time:null, message:msg })
        showToast('✅ สร้าง Campaign แล้ว','success'); renderPage()
      }
    })
    setTimeout(() => {
      const msgEl = document.getElementById('sms-msg')
      const counter = document.getElementById('sms-counter')
      msgEl?.addEventListener('input', () => { if(counter) counter.textContent = `${msgEl.value.length}/160` })
      document.getElementById('sms-tpl')?.addEventListener('change', e => { if(e.target.value && msgEl) msgEl.value = e.target.value })
    }, 100)
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
