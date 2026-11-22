/**
 * Event Check-in — เช็คอินงานอีเวนต์ + เก็บ Lead
 * Route: /marketing/event-checkin
 * (v1.0.1317) เดิมชื่องาน/บูธ/เป้า 150 คน/รายชื่อเซลส์ เป็นค่าสมมติตายตัว ('Motor Show บางนา 2569', 'วิชัย/สุดา/ธนา')
 * ตอนนี้ดึงงานจริงจากตารางออกบูธ (/marketing/events) — งานที่กำลังจัดวันนี้ (หรือเพิ่งจบเมื่อวาน) เป้าจาก "เป้า Lead" ของงาน
 * เซลส์จากเวรบูธวันนี้/ทีมที่ไป/รายชื่อเซลส์จริง ผู้เยี่ยมชมผูก eventId · มีปุ่ม ➕ ลีด เพิ่มเป็นลูกค้าติดป้ายงานในครั้งเดียว
 */
import { modelOptionsHtml } from '../../utils/modelOptions.js'
import { timeAgo, todayBangkok } from '../../utils/format.js'
import { dmy } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'
import { escHtml as esc } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'
import { getSalesStaff } from '../../data/masterData.js'
import { eventsForLeadTag, typeOf, checkinStaff, visitorsOf } from '../../utils/marketingEvents.js'
import { openQuickLead } from '../../utils/quickLead.js'
import { navigate } from '../../core/router.js'

const INTEREST = {
  hot:    { label: 'Hot 🔥', color: 'danger' },
  warm:   { label: 'Warm ☀️', color: 'warning' },
  browse: { label: 'เดินดู 👀', color: 'secondary' },
}

export default async function EventCheckinPage(container) {
  const myGen = container.__routerGen
  const today = todayBangkok()

  let visitors = []
  let events = []
  let selId = ''
  let loading = true

  async function loadData() {
    loading = true
    const [v, evs] = await Promise.all([
      listDocs('event_visitors', [], 'time', 'desc', 2000).then(r => r.reverse()).catch(() => []),
      listDocs('marketing_events', [], 'startDate', 'desc', 60).catch(() => []),
    ])
    visitors = v
    events = eventsForLeadTag(evs, today)
    if (!events.some(e => e.id === selId)) selId = events[0]?.id || ''
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const ev = events.find(e => e.id === selId) || null
    const list = visitorsOf(visitors, ev?.id)
    const total = list.length
    const hot = list.filter(v => v.interest === 'hot').length
    const withPhone = list.filter(v => v.phone).length
    const tdCount = list.filter(v => v.testDrive).length
    const target = Number(ev?.targetLeads) || 0
    const targetPct = target ? Math.round(total / target * 100) : 0
    const when = ev ? (ev.endDate && ev.endDate !== ev.startDate ? `${dmy(ev.startDate)} – ${dmy(ev.endDate)}` : dmy(ev.startDate)) : ''

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div style="min-width:0">
            <div class="page-title">🎪 เช็กอินงานอีเวนต์</div>
            <div class="page-subtitle">${ev ? `${typeOf(ev.type).icon} ${esc(ev.title || typeOf(ev.type).label)}${ev.venue ? ' — ' + esc(ev.venue) : ''} · ${when}` : 'ไม่มีงานที่กำลังจัดวันนี้'}</div>
          </div>
          <div class="page-actions" style="flex-wrap:wrap">
            ${events.length > 1 ? `<select class="input" id="ec-ev" style="max-width:220px">${events.map(e => `<option value="${esc(e.id)}"${e.id === selId ? ' selected' : ''}>${esc(e.title || typeOf(e.type).label)}</option>`).join('')}</select>` : ''}
            ${ev ? `<button class="btn btn-primary" id="checkin-btn">+ ลงทะเบียนผู้เยี่ยมชม</button>` : `<button class="btn btn-primary" id="go-events">📅 ไปตารางออกบูธ</button>`}
          </div>
        </div>

        ${ev ? '' : `<div class="card" style="padding:14px;margin-bottom:16px;font-size:0.8rem;line-height:1.6">ยังไม่มีงานออกบูธ/อีเวนต์ที่จัดอยู่วันนี้ (หรือจบเมื่อวาน) — เพิ่มงานที่หน้า <b>ตารางออกบูธ</b> ก่อน แล้วหน้านี้จะเลือกงานนั้นให้เอง ผู้เยี่ยมชมที่ลงทะเบียนจะนับเป็นของงานนั้น${list.length ? '<br>รายการด้านล่างคือผู้เยี่ยมชมเก่าที่ยังไม่ได้ผูกกับงานไหน' : ''}</div>`}

        <div class="kpi-grid" style="margin-bottom:16px">
          ${kpi('🎪 ผู้เยี่ยมชม', target ? `${total}/${target} (${targetPct}%)` : String(total), target && targetPct >= 50 ? 'success' : 'primary')}
          ${kpi('🔥 ลีดร้อน', hot, hot > 0 ? 'danger' : 'secondary')}
          ${kpi('📞 ได้เบอร์ติดต่อ', withPhone + (total ? ` (${Math.round(withPhone / total * 100)}%)` : ''), 'warning')}
          ${kpi('🚗 จอง Test Drive', tdCount, 'success')}
        </div>

        ${ev && target ? `<div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:4px">
            <span style="color:var(--text-muted)">เป้า Lead ทั้งงาน</span><span>${total}/${target}</span>
          </div>
          <div style="background:var(--surface-2);border-radius:4px;height:10px">
            <div style="width:${Math.min(100, targetPct)}%;background:var(--primary);height:10px;border-radius:4px"></div>
          </div>
        </div>` : ''}

        ${list.length ? `<div style="display:flex;flex-direction:column;gap:8px">
          ${[...list].reverse().map(v => {
            const it = INTEREST[v.interest] || INTEREST.browse
            return `<div class="card" style="padding:11px 14px;border-left:3px solid var(--${it.color});display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="min-width:0;flex:1 1 200px">
                <div style="font-weight:700;font-size:0.84rem;overflow-wrap:anywhere">${esc(v.name)} ${v.phone ? `<span style="font-size:0.7rem;color:var(--text-muted)">📞 ${esc(v.phone)}</span>` : '<span style="font-size:0.68rem;color:var(--danger)">ไม่มีเบอร์</span>'}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);overflow-wrap:anywhere">🚗 ${esc(v.model || '-')} · 👤 ${esc(v.staff || '-')} · ${timeAgo(v.time)}${v.gift ? ' · 🎁' : ''}${v.testDrive ? ' · 🚗 TD' : ''}</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span class="badge badge-${it.color}" style="font-size:0.65rem">${it.label}</span>
                ${v.customerId ? `<span class="badge badge-success" style="font-size:0.65rem">✓ เป็นลีดแล้ว</span>` : ev && v.phone ? `<button class="btn btn-secondary btn-xs" data-lead="${esc(v.id)}" title="เพิ่มเป็นลูกค้าลีด ติดป้ายงานนี้">➕ ลีด</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>` : (ev ? `<div class="empty-state"><div class="empty-icon">🎪</div><div class="empty-title">ยังไม่มีผู้เยี่ยมชมงานนี้</div></div>` : '')}
      </div>
    `

    container.querySelector('#go-events')?.addEventListener('click', () => navigate('/marketing/events'))
    container.querySelector('#ec-ev')?.addEventListener('change', e => { selId = e.target.value; renderPage() })
    container.querySelectorAll('[data-lead]').forEach(b => b.addEventListener('click', () => {
      const v = list.find(x => x.id === b.dataset.lead); if (!v) return
      openQuickLead({
        name: v.name || '', contact: v.phone || '', model: v.model && v.model !== '—' && v.model !== 'ยังไม่แน่ใจ' ? v.model : '', eventId: ev?.id || '',
        onSaved: async c => {
          v.customerId = c.id
          if (container.__routerGen === myGen) renderPage()
          try { await updateDocData('event_visitors', v.id, { customerId: c.id }) } catch {}
        },
      })
    }))

    container.querySelector('#checkin-btn')?.addEventListener('click', () => {
      const me = getState('user')?.displayName || ''
      const staff = checkinStaff(ev, today, getSalesStaff(), me)
      openModal({
        title: '🎪 ลงทะเบียนผู้เยี่ยมชมบูธ',
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
          <div class="input-group"><label class="input-label">ชื่อ *</label><input class="input" id="ec-name" autofocus></div>
          <div class="input-group"><label class="input-label">เบอร์โทร (สำคัญ!)</label><input class="input" id="ec-phone" type="tel"></div>
          <div class="input-group"><label class="input-label">รุ่นที่สนใจ</label>
            <select class="input" id="ec-model">${modelOptionsHtml('', { extra: ['ยังไม่แน่ใจ'] })}</select>
          </div>
          <div class="input-group"><label class="input-label">ระดับความสนใจ</label>
            <select class="input" id="ec-interest">${Object.entries(INTEREST).map(([k, x]) => `<option value="${esc(k)}">${x.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เซลส์ที่คุย</label>
            ${staff.list.length
              ? `<select class="input" id="ec-staff">${staff.list.map(s => `<option value="${esc(s)}"${s === staff.def ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>`
              : `<input class="input" id="ec-staff" value="${esc(me)}">`}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;justify-content:flex-end">
            <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer"><input type="checkbox" id="ec-gift" checked style="accent-color:var(--primary)"> 🎁 รับของที่ระลึก</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer"><input type="checkbox" id="ec-td" style="accent-color:var(--primary)"> 🚗 จอง Test Drive ที่โชว์รูม</label>
          </div>
        </div>`,
        confirmText: '✅ ลงทะเบียน',
        async onConfirm() {
          const val = id => document.getElementById(id)?.value || ''
          const name = val('ec-name').trim()
          if (!name) { showToast('❗ กรอกชื่อ', 'error'); return false }
          try {
            await createDoc('event_visitors', {
              name, phone: val('ec-phone').trim(), model: val('ec-model') || '—', interest: val('ec-interest') || 'browse', staff: val('ec-staff').trim() || '—',
              time: new Date().toISOString(), gift: document.getElementById('ec-gift')?.checked || false, testDrive: document.getElementById('ec-td')?.checked || false,
              eventId: ev.id, eventName: ev.title || '',
            })
            showToast('✅ ลงทะเบียนแล้ว', 'success')
            await loadData()
          } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
        },
      })
    })
  }

  await loadData()
}
