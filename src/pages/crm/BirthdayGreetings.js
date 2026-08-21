/**
 * Birthday & Anniversary — วันเกิดและวันครบรอบลูกค้า
 * Route: /crm/birthdays
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData, listDocs, createDoc } from '../../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { sendSms } from '../../utils/comms.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function dayInMonth(offsetDays) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays)
  return { day: d.getDate(), month: d.getMonth() + 1, iso: d.toISOString().slice(0,10) }
}

const EVENT_TYPES = {
  birthday:    { label: 'วันเกิด', color: 'warning', icon: '🎂' },
  anniversary: { label: 'ครบรอบซื้อรถ', color: 'primary', icon: '🚗' },
}

const t0 = dayInMonth(0), t1 = dayInMonth(1), t3 = dayInMonth(3), t7 = dayInMonth(7), t14 = dayInMonth(14)

const DEMO_EVENTS = [
  { id: 'E001', customer: 'สมชาย ใจดี', phone: '085-111', type: 'birthday', date: t0.iso, model: 'BYD Seal', sent: false, channel: 'LINE' },
  { id: 'E002', customer: 'มาลี สุขใจ', phone: '086-222', type: 'anniversary', date: t0.iso, model: 'BYD Dolphin', sent: true, channel: 'SMS', note: 'ครบ 1 ปี' },
  { id: 'E003', customer: 'ธนพล เที่ยงตรง', phone: '087-333', type: 'birthday', date: t1.iso, model: 'MG ZS EV', sent: false, channel: 'LINE' },
  { id: 'E004', customer: 'อรทัย ตั้งใจ', phone: '088-444', type: 'anniversary', date: t3.iso, model: 'BYD Atto 3', sent: false, channel: 'SMS', note: 'ครบ 2 ปี' },
  { id: 'E005', customer: 'วิรัช เก่งมาก', phone: '089-555', type: 'birthday', date: t7.iso, model: 'BYD Han', sent: false, channel: 'LINE' },
  { id: 'E006', customer: 'ชาตรี เข้มแข็ง', phone: '084-666', type: 'birthday', date: t14.iso, model: 'MG4', sent: false, channel: 'SMS' },
]

const GREETING_TEMPLATES = {
  birthday: 'สุขสันต์วันเกิดค่ะคุณ[ชื่อ] 🎂 ขอให้มีความสุขมากๆ ตลอดปี — ทีมงาน LAMOM ขอมอบส่วนลดบริการ 10% เป็นของขวัญ ใช้ได้ภายใน 30 วัน',
  anniversary: 'ครบรอบ [ปี] ปีกับ [รุ่นรถ] แล้วนะคะ 🚗 ขอบคุณที่ไว้วางใจ LAMOM — รับสิทธิ์เช็คระยะฟรีในเดือนนี้ค่ะ',
}

export default async function BirthdayGreetingsPage(container) {
  const myGen = container.__routerGen
  let events = DEMO_EVENTS.map(e => ({ ...e }))
  let dataSource = 'demo'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    const delivered = sales.filter(s => s.status === 'ส่งมอบแล้ว' || s.status === 'delivered')
    // แสดงเฉพาะวันครบรอบจากใบจองจริงเมื่อมีจริง — ห้ามเอา DEMO_EVENTS มาปนกับข้อมูลจริง
    // (ระบบยังไม่มีฟิลด์วันเกิดลูกค้า จึงคำนวณได้เฉพาะ "ครบรอบซื้อรถ" จากวันที่ส่งมอบจริงเท่านั้น
    // DEMO_EVENTS ใช้เป็นตัวอย่างก็ต่อเมื่อยังไม่มีใบจองที่ส่งมอบแล้วเลย)
    if (delivered.length) {
      // เช็คว่าครบรอบปีนี้ของลูกค้าคนนี้ ส่งไปแล้วจริงหรือยัง (greeting_sends) — เดิมเป็น sent:false
      // ในหน่วยความจำเฉยๆ รีเฟรชหน้าแล้วหายหมด ไม่รู้เลยว่าส่งไปแล้วหรือยัง
      const sentLog = await listDocs('greeting_sends', companyScopeFilters(), 'sentAt', 'desc', 1000).catch(() => [])
      const sentKey = (name, date) => `${name}|${date}`
      const sentSet = new Set(sentLog.map(l => sentKey(l.customer, l.eventDate)))
      events = delivered.map((s, i) => {
        const delivDate = s.deliveryDate || s.bookingDate || ''
        const yearsAgo = delivDate ? Math.floor((Date.now() - new Date(delivDate).getTime()) / (365.25 * 86400000)) : 1
        const annivDate = delivDate ? (() => {
          const d = new Date(delivDate); d.setFullYear(new Date().getFullYear()); return d.toISOString().slice(0, 10)
        })() : t0.iso
        const customer = s.customerName || s.custName || 'ลูกค้า'
        const already = sentLog.find(l => l.customer === customer && l.eventDate === annivDate)
        return {
          id: `LV${i+1}`, customer,
          phone: s.phone || '', type: 'anniversary', date: annivDate,
          model: s.model || '', sent: sentSet.has(sentKey(customer, annivDate)), channel: already?.channel || 'SMS',
          note: `ครบ ${yearsAgo} ปี`,
        }
      })
      dataSource = 'live'
    }
  } catch {}

  function groupOf(e) {
    if (e.date === t0.iso) return 'today'
    if (e.date <= t7.iso) return 'week'
    return 'later'
  }

  function renderPage() {
    const today = events.filter(e => groupOf(e) === 'today')
    const thisWeek = events.filter(e => groupOf(e) === 'week')
    const later = events.filter(e => groupOf(e) === 'later')
    const unsentToday = today.filter(e => !e.sent).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎂 Birthday & Anniversary</div>
            <div class="page-subtitle">ส่งคำอวยพร — รักษาความสัมพันธ์ลูกค้า${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ครบรอบจากใบจองจริง</span>' : ' <span style="color:var(--warning);font-size:0.75rem">● ตัวอย่างข้อมูล — ยังไม่มีใบจองที่ส่งมอบแล้ว</span>'}</div>
          </div>
          <div class="page-actions">
            ${unsentToday > 0 ? `<button class="btn btn-primary" id="send-all-btn">📤 ส่งทั้งหมดวันนี้ (${unsentToday})</button>` : ''}
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('🎉 วันนี้', today.length + ' ราย', today.length > 0 ? 'warning' : 'secondary')}
          ${kpi('📅 สัปดาห์นี้', thisWeek.length + ' ราย', 'primary')}
          ${kpi('📤 ยังไม่ได้ส่ง (วันนี้)', unsentToday, unsentToday > 0 ? 'danger' : 'success')}
        </div>

        ${section('🎉 วันนี้', today)}
        ${section('📅 ภายใน 7 วัน', thisWeek)}
        ${section('🗓 ถัดไป', later)}
      </div>
    `

    function section(title, list) {
      if (!list.length) return ''
      return `
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin:14px 0 8px">${title}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(e => {
            const et = EVENT_TYPES[e.type]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${et?.color});display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:700;font-size:0.85rem">${et?.icon} ${escHtml(e.customer)}</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">
                  ${et?.label}${e.note ? ' (' + escHtml(e.note) + ')' : ''} · ${formatDate(e.date)} · 🚗 ${escHtml(e.model)} · 📞 ${escHtml(e.phone)}
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                ${e.sent
                  ? `<span class="badge badge-success" style="font-size:0.62rem">✅ ส่งแล้ว (${e.channel})</span>`
                  : `<button class="btn btn-xs btn-primary send-btn" data-id="${e.id}">📤 ส่งคำอวยพร</button>`
                }
              </div>
            </div>`
          }).join('')}
        </div>
      `
    }

    container.querySelectorAll('.send-btn').forEach(b => b.addEventListener('click', () => {
      const e = events.find(x => x.id === b.dataset.id); if (e) openSendModal(e)
    }))
    document.getElementById('send-all-btn')?.addEventListener('click', async () => {
      const targets = events.filter(e => groupOf(e) === 'today' && !e.sent)
      if (dataSource !== 'live') {
        targets.forEach(e => { e.sent = true })
        showToast('📤 ส่งคำอวยพรทั้งหมดแล้ว! (ตัวอย่างข้อมูล)', 'success'); renderPage()
        return
      }
      const withPhone = targets.filter(e => e.phone)
      if (!withPhone.length) { showToast('❗ ไม่มีเบอร์โทรลูกค้ากลุ่มนี้ในระบบ', 'warning'); return }
      let ok = 0
      for (const e of withPhone) {
        const msg = buildGreetingMsg(e)
        try {
          await sendSms([e.phone], msg)
          await createDoc('greeting_sends', { customer: e.customer, phone: e.phone, eventDate: e.date, type: e.type, channel: 'SMS', sentAt: new Date().toISOString(), companyId: myEffectiveCompanyId() })
          e.sent = true; e.channel = 'SMS'; ok++
        } catch { /* ส่งไม่สำเร็จรายนี้ ข้ามไปรายต่อไป */ }
      }
      showToast(ok ? `📤 ส่งคำอวยพรสำเร็จ ${ok}/${withPhone.length} ราย` : '❗ ส่งไม่สำเร็จเลย — ตรวจสอบว่าตั้งค่าผู้ให้บริการ SMS แล้วหรือยัง', ok ? 'success' : 'error')
      renderPage()
    })
  }

  function buildGreetingMsg(e) {
    return GREETING_TEMPLATES[e.type].replace('[ชื่อ]', (e.customer || '').split(' ')[0] || 'คุณลูกค้า').replace('[รุ่นรถ]', e.model || '').replace('[ปี]', e.note?.match(/\d+/)?.[0] || '1')
  }

  function openSendModal(e) {
    const tpl = buildGreetingMsg(e)
    const isLive = dataSource === 'live'
    openModal({
      title: '📤 ส่งคำอวยพร: ' + escHtml(e.customer),
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ช่องทาง</label>
          ${isLive
            ? `<input class="input" value="SMS" disabled><div style="font-size:0.68rem;color:var(--text-muted);margin-top:4px">ส่งเจาะจงถึงลูกค้ารายนี้ได้แค่ SMS เท่านั้น — LINE ในระบบตอนนี้รองรับแค่ broadcast ถึงลูกค้าทั้งหมด ยังส่งเฉพาะรายคนไม่ได้ ถ้าใช้ LINE จะกลายเป็นส่งอวยพรคนนี้ไปให้ลูกค้าทุกคนโดยไม่ตั้งใจ</div>`
            : `<select class="input" id="gr-channel"><option ${e.channel==='LINE'?'selected':''}>LINE</option><option ${e.channel==='SMS'?'selected':''}>SMS</option></select>`}
        </div>
        <div class="input-group"><label class="input-label">ข้อความ</label>
          <textarea class="input" id="gr-msg" rows="4">${escHtml(tpl)}</textarea>
        </div>
        ${isLive && !e.phone ? `<div style="font-size:0.7rem;color:var(--danger)">⚠️ ไม่มีเบอร์โทรลูกค้ารายนี้ในระบบ ส่งไม่ได้</div>` : ''}
      </div>`,
      confirmText: '📤 ส่ง',
      async onConfirm() {
        const msg = document.getElementById('gr-msg')?.value || tpl
        if (!isLive) {
          e.sent = true; e.channel = document.getElementById('gr-channel')?.value || e.channel
          showToast(`✅ ส่งคำอวยพรถึง ${e.customer} ทาง ${e.channel} แล้ว (ตัวอย่างข้อมูล)`, 'success'); renderPage()
          return
        }
        if (!e.phone) { showToast('❗ ไม่มีเบอร์โทรลูกค้ารายนี้', 'error'); return false }
        try {
          await sendSms([e.phone], msg)
          await createDoc('greeting_sends', { customer: e.customer, phone: e.phone, eventDate: e.date, type: e.type, channel: 'SMS', sentAt: new Date().toISOString(), companyId: myEffectiveCompanyId() })
          e.sent = true; e.channel = 'SMS'
          showToast(`✅ ส่งคำอวยพรถึง ${e.customer} ทาง SMS แล้ว`, 'success')
        } catch (err) { showToast('❗ ส่งไม่สำเร็จ — ' + (err.message || 'ตรวจสอบว่าตั้งค่าผู้ให้บริการ SMS แล้วหรือยัง'), 'error'); return false }
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
