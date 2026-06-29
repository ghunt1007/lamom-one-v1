/**
 * Broadcast — ส่งข้อความหาลูกค้าจำนวนมาก
 * Route: /comms/broadcast
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

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

const TARGET_SEGS = {
  all:        'ลูกค้าทั้งหมด',
  prospects:  'ผู้สนใจ (Lead)',
  owners:     'เจ้าของรถ',
  expiring:   'ประกันหมดอายุใน 30 วัน',
  service_due:'ถึงเวลาบำรุงรักษา',
  inactive:   'ไม่ซื้อ > 6 เดือน',
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const DEMO_BROADCASTS = [
  {
    id: 'BC001', title: 'โปรโมชันพิเศษ BYD Seal — ดาวน์ 0%', channel: 'line',
    status: 'sent', target: 'prospects', recipients: 342, delivered: 338, opened: 156, clicked: 42,
    sentAt: addHours(48), scheduledAt: null, message: 'สวัสดีค่ะ! LAMOM EV มีโปรโมชันพิเศษ BYD Seal สุดคุ้ม ดาวน์ 0% ฟรีประกันชั้น 1 ปีแรก สนใจติดต่อ 02-xxx-xxxx'
  },
  {
    id: 'BC002', title: 'แจ้งเตือนต่ออายุประกัน', channel: 'sms',
    status: 'sent', target: 'expiring', recipients: 28, delivered: 27, opened: 27, clicked: 18,
    sentAt: addHours(24), scheduledAt: null, message: 'เรียนคุณลูกค้า ประกันรถของท่านจะหมดอายุใน 7 วัน กรุณาต่ออายุได้ที่ 02-xxx-xxxx'
  },
  {
    id: 'BC003', title: 'นัดเช็คระยะ 10,000 กม.', channel: 'line',
    status: 'scheduled', target: 'service_due', recipients: 45, delivered: 0, opened: 0, clicked: 0,
    sentAt: null, scheduledAt: addDays(1) + 'T09:00:00', message: 'ถึงเวลาเช็คระยะ 10,000 กม. แล้วครับ! นัดเข้ามาที่ศูนย์บริการได้เลยครับ'
  },
  {
    id: 'BC004', title: 'Happy New Year 2025', channel: 'email',
    status: 'sent', target: 'all', recipients: 1250, delivered: 1198, opened: 445, clicked: 87,
    sentAt: addHours(720), scheduledAt: null, message: 'สวัสดีปีใหม่ 2025 จาก LAMOM EV ขอบคุณที่ไว้วางใจเราตลอดมา'
  },
  {
    id: 'BC005', title: 'Flash Sale — อุปกรณ์ EV ลด 20%', channel: 'push',
    status: 'draft', target: 'owners', recipients: 0, delivered: 0, opened: 0, clicked: 0,
    sentAt: null, scheduledAt: null, message: 'Flash Sale! อุปกรณ์เสริม EV ลด 20% วันนี้เท่านั้น!'
  },
]

export default async function BroadcastPage(container) {
  const myGen = container.__routerGen
  let broadcasts = DEMO_BROADCASTS.map(b => ({ ...b }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('broadcasts', [], 'sentAt', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `BC${i+1}`,
        title: d.title || d.name || 'Broadcast',
        channel: d.channel || 'line',
        status: d.status || 'sent',
        target: d.target || 'all',
        recipients: d.recipients || 0,
        delivered: d.delivered || 0,
        opened: d.opened || 0,
        clicked: d.clicked || 0,
        sentAt: d.sentAt || d.createdAt || null,
        scheduledAt: d.scheduledAt || null,
        message: d.message || '',
      }))
      broadcasts = [...mapped, ...DEMO_BROADCASTS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const sent = broadcasts.filter(b => b.status === 'sent').length
    const totalReach = broadcasts.filter(b => b.status === 'sent').reduce((a, b) => a + b.delivered, 0)
    const avgOpen = (() => {
      const sentList = broadcasts.filter(b => b.status === 'sent' && b.delivered > 0)
      if (!sentList.length) return 0
      return Math.round(sentList.reduce((a, b) => a + (b.opened / b.delivered * 100), 0) / sentList.length)
    })()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📢 Broadcast</div>
            <div class="page-subtitle">ส่งข้อความหาลูกค้าจำนวนมาก — LINE, SMS, Email, Push${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="create-bc-btn">+ สร้าง Broadcast</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📨 Broadcast ทั้งหมด', broadcasts.length, 'primary')}
          ${kpi('✅ ส่งแล้ว', sent, 'success')}
          ${kpi('👥 Reach รวม', totalReach.toLocaleString(), 'primary')}
          ${kpi('📊 Open Rate เฉลี่ย', avgOpen + '%', avgOpen >= 30 ? 'success' : 'warning')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${broadcasts.map(b => {
            const ch = CHANNELS[b.channel]
            const st = BCAST_STATUS[b.status]
            const openRate = b.delivered > 0 ? Math.round(b.opened / b.delivered * 100) : 0
            const clickRate = b.opened > 0 ? Math.round(b.clicked / b.opened * 100) : 0
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

              ${b.status === 'sent' ? `
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
                  ${miniStat('📤 ส่ง', b.recipients.toLocaleString())}
                  ${miniStat('✅ ถึงมือ', b.delivered.toLocaleString())}
                  ${miniStat('👁 เปิดอ่าน', openRate + '%')}
                  ${miniStat('🖱 คลิก', clickRate + '%')}
                </div>
                <!-- Open rate bar -->
                <div style="margin-bottom:6px">
                  <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:2px">
                    <span style="color:var(--text-muted)">Open Rate</span>
                    <span style="font-weight:700;color:${openRate>=30?'var(--success)':openRate>=15?'var(--warning)':'var(--danger)'}">${openRate}%</span>
                  </div>
                  <div style="background:var(--surface-2);border-radius:3px;height:5px">
                    <div style="width:${Math.min(openRate,100)}%;background:${openRate>=30?'var(--success)':openRate>=15?'var(--warning)':'var(--danger)'};height:5px;border-radius:3px"></div>
                  </div>
                </div>
              ` : `<div style="padding:8px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">${escHtml(b.message)}</div>`}

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
    container.querySelectorAll('.send-bc-btn').forEach(b => b.addEventListener('click', () => {
      const bc = broadcasts.find(x => x.id === b.dataset.id)
      if (bc) {
        bc.status = 'sent'; bc.sentAt = new Date().toISOString()
        bc.recipients = Math.floor(Math.random() * 200) + 50
        bc.delivered = Math.floor(bc.recipients * 0.97)
        bc.opened = Math.floor(bc.delivered * 0.3)
        bc.clicked = Math.floor(bc.opened * 0.25)
        showToast('📤 ส่ง Broadcast แล้ว!', 'success'); renderPage()
      }
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
        ${bc.recipients > 0 ? row('จำนวนผู้รับ', bc.recipients.toLocaleString() + ' คน') : ''}
        ${bc.delivered > 0 ? row('ส่งถึง', bc.delivered.toLocaleString() + ' คน') : ''}
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
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ข้อความ *</label>
            <textarea class="input" id="bc-msg" rows="5" placeholder="พิมพ์ข้อความ (LINE: 500 ตัวอักษร, SMS: 160 ตัวอักษร)"></textarea>
          </div>
        </div>
      `,
      onConfirm() {
        const title = document.getElementById('bc-title')?.value?.trim()
        const msg = document.getElementById('bc-msg')?.value?.trim()
        if (!title || !msg) { showToast('❗ กรุณากรอกชื่อและข้อความ', 'error'); return }
        broadcasts.unshift({
          id: `BC${String(broadcasts.length+1).padStart(3,'0')}`, title,
          channel: document.getElementById('bc-channel')?.value||'line', status: 'draft',
          target: document.getElementById('bc-target')?.value||'all',
          recipients: 0, delivered: 0, opened: 0, clicked: 0,
          sentAt: null, scheduledAt: null, message: msg
        })
        showToast('✅ สร้าง Broadcast แล้ว!', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function miniStat(l, v) { return `<div style="text-align:center;padding:8px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.68rem;color:var(--text-muted)">${l}</div><div style="font-size:0.9rem;font-weight:700">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
