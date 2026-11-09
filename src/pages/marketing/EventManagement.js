// (v1.0.972) ตารางออกบูธ / กิจกรรม / มอเตอร์โชว์ / Motor Expo / อีเวนต์ — Route: /marketing/events
// วางแผนงาน (วัน เวลา สถานที่ ทีมที่ไป รุ่นที่เอาไป งบ เป้า Lead/ใบจอง) → ขึ้นปฏิทินงานอัตโนมัติ (วันละ 1 รายการ)
// วัดผลจากข้อมูลจริง: ลูกค้าที่เพิ่มผ่าน "➕ Lead" ระหว่างงานติดป้ายงานให้เอง → นับ Lead / ทดลองขับ / ใบจอง / ส่งมอบ
// ต้นทุนต่อ Lead และต่อใบจอง · ROI จากราคาในใบจองจริง (เดิมนับยอดขายทั้งโชว์รูมช่วงวันงานเป็นของงาน = เกินจริง)
import './events.css'
import { watchDocs, listDocs, createDoc, updateDocData, softDelete } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { escHtml as esc } from '../../utils/escape.js'
import { getSalesStaff } from '../../data/masterData.js'
import { openQuickLead } from '../../utils/quickLead.js'
import { navigate } from '../../core/router.js'
import { copyText } from '../../utils/copyText.js'
import {
  EVENT_TYPES, EVENT_TYPE_ORDER, EVENT_STATUS, typeOf, autoStatus, eventMetrics, normalizeEvent, eventDays,
  normalizeShifts, autoRoster, shiftCounts, defaultChecklist, normalizeChecklist, prepProgress, eventBreakdown, eventSummaryText,
  eventQuietLeads,
} from '../../utils/marketingEvents.js'

const COL = 'marketing_events'
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const d2 = ymd => (ymd ? `${+ymd.slice(8)} ${TH_M[+ymd.slice(5, 7) - 1]}` : '')
const dateRange = e => (!e.startDate ? 'ยังไม่ระบุวัน' : e.endDate && e.endDate !== e.startDate ? `${d2(e.startDate)} – ${d2(e.endDate)} ${+e.endDate.slice(0, 4) + 543}` : `${d2(e.startDate)} ${+e.startDate.slice(0, 4) + 543}`)
const money = n => (n ? formatCurrency(Math.round(n)) : '—')
const TABS = { upcoming: 'กำลังจะมา', ongoing: 'กำลังจัด', done: 'จบแล้ว', all: 'ทั้งหมด' }

export default async function EventManagementPage(container) {
  const myGen = container.__routerGen
  const today = todayBangkok()
  let events = []
  let ref = { customers: [], bookings: [], testDrives: [] }
  let tab = 'upcoming'
  let tabPicked = false
  let typeFilter = 'all'
  let loaded = false
  const openId = new URLSearchParams(location.search).get('id')

  container.innerHTML = `
    <div class="page-content animate-slide ev">
      <div class="page-header">
        <div>
          <div class="page-title">🎪 ตารางออกบูธ & อีเวนต์</div>
          <div class="page-subtitle">ออกบูธ · มอเตอร์โชว์ · Motor Expo · กิจกรรม — วางแผน ขึ้นปฏิทินงานให้เอง และวัดผลจาก Lead/ใบจองจริง</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="ev-export">📥 ส่งออก</button>
          <button class="btn btn-primary" id="ev-add">＋ เพิ่มงาน</button>
        </div>
      </div>
      <div class="ev-sum" id="ev-sum"></div>
      <div class="ev-tabs" id="ev-tabs" role="tablist"></div>
      <div class="ev-chips chip-scroll" id="ev-chips"></div>
      <div id="ev-list"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>
    </div>`
  const $ = s => container.querySelector(s)
  const alive = () => container.__routerGen === myGen && container.isConnected

  watchDocs(COL, [], 'startDate', 'desc', 500, rows => {
    if (!alive()) return
    events = rows.filter(r => !r.deleted)
    // (v1.0.1007) มีงานที่กำลังจัดอยู่ → เปิดแท็บ "กำลังจัด" ให้เลย (เดิมเปิด "กำลังจะมา" ที่ว่าง ต้องกดหาเอง)
    if (!tabPicked && !loaded && events.some(e => autoStatus(e, today) === 'ongoing')) tab = 'ongoing'
    loaded = true
    render()
    if (openId && !render.opened) { const e = events.find(x => x.id === openId); if (e) { render.opened = true; openDetail(e) } }
  })
  // ข้อมูลวัดผล (โหลดครั้งเดียว ไม่ต้องสด)
  Promise.all([
    listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
    listDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
    listDocs('test_drives', companyScopeFilters(), 'date', 'desc', 1000).catch(() => []),
  ]).then(([customers, bookings, testDrives]) => {
    ref = { customers: customers.filter(c => c.eventId), bookings, testDrives }
    if (alive() && loaded) render()
  })

  const statusOf = e => autoStatus(e, today)
  const metricsOf = e => eventMetrics(e, ref)
  const inTab = e => {
    const s = statusOf(e)
    if (tab === 'all') return true
    if (tab === 'upcoming') return s === 'planning' || s === 'confirmed'
    if (tab === 'ongoing') return s === 'ongoing'
    return s === 'done'
  }

  function render() {
    const year = today.slice(0, 4)
    const thisYear = events.filter(e => String(e.startDate || '').startsWith(year) && statusOf(e) !== 'cancelled')
    const ms = thisYear.map(metricsOf)
    const leads = ms.reduce((a, m) => a + m.leads, 0)
    const bks = ms.reduce((a, m) => a + m.bookings, 0)
    const cost = ms.reduce((a, m) => a + m.cost, 0)
    const next30 = events.filter(e => { const s = statusOf(e); return (s === 'planning' || s === 'confirmed' || s === 'ongoing') && e.startDate <= addDays(today, 30) }).length
    $('#ev-sum').innerHTML = `
      <div class="ev-tile"><span>งานใน 30 วันนี้</span><b>${next30}</b></div>
      <div class="ev-tile"><span>Lead จากงาน ปี ${+year + 543}</span><b>${leads}</b></div>
      <div class="ev-tile"><span>ใบจองจากงาน</span><b>${bks}</b><small>${leads ? `ปิดได้ ${Math.round(bks / leads * 100)}%` : ''}</small></div>
      <div class="ev-tile"><span>ต้นทุนต่อใบจอง</span><b>${bks && cost ? money(cost / bks) : '—'}</b><small>${cost ? 'ใช้ไป ' + money(cost) : ''}</small></div>`
    const counts = Object.fromEntries(Object.keys(TABS).map(t => { const save = tab; tab = t; const n = events.filter(inTab).length; tab = save; return [t, n] }))
    $('#ev-tabs').innerHTML = Object.entries(TABS).map(([k, l]) => `<button type="button" class="${k === tab ? 'on' : ''}" data-tab="${k}">${l} <b>${counts[k]}</b></button>`).join('')
    const present = new Set(events.map(e => e.type))
    $('#ev-chips').innerHTML = `<button type="button" class="ev-chip${typeFilter === 'all' ? ' on' : ''}" data-type="all">ทุกประเภท</button>` +
      EVENT_TYPE_ORDER.filter(t => present.has(t) || t === typeFilter).map(t => `<button type="button" class="ev-chip${typeFilter === t ? ' on' : ''}" data-type="${t}">${EVENT_TYPES[t].icon} ${EVENT_TYPES[t].label}</button>`).join('')
    if (!loaded) return
    const list = events.filter(inTab).filter(e => typeFilter === 'all' || e.type === typeFilter)
      .sort((a, b) => tab === 'done' || tab === 'all' ? String(b.startDate).localeCompare(String(a.startDate)) : String(a.startDate).localeCompare(String(b.startDate)))
    $('#ev-list').innerHTML = list.length ? `<div class="ev-cards">${list.map(card).join('')}</div>` : `
      <div class="empty-state"><div class="empty-icon">🎪</div><div class="empty-title">ยังไม่มีงาน${tab === 'all' ? '' : TABS[tab]}</div>
      <div class="empty-desc">เพิ่มงานออกบูธ/มอเตอร์โชว์/กิจกรรม แล้วงานจะขึ้นในปฏิทินงานของทุกคน · ระหว่างงาน กด “➕ Lead” ลูกค้าจะติดป้ายงานนี้ให้เอง</div>
      <button class="btn btn-primary" data-add>＋ เพิ่มงาน</button></div>`
  }

  function bar(pct, label) {
    if (pct == null) return ''
    const w = Math.max(0, Math.min(100, pct))
    return `<div class="ev-bar" title="${esc(label)}"><i style="width:${w}%" class="${pct >= 100 ? 'ok' : pct >= 60 ? 'mid' : ''}"></i></div>`
  }

  function card(e) {
    const t = typeOf(e.type)
    const s = statusOf(e)
    const m = metricsOf(e)
    const days = eventDays(e).length
    const showResult = s === 'ongoing' || s === 'done' || m.leads || m.bookings
    return `<div class="ev-card s-${s}" data-open="${esc(e.id)}" role="button" tabindex="0">
      <div class="ev-card-top"><span class="ev-type">${t.icon} ${t.label}</span><span class="badge badge-${EVENT_STATUS[s].color}">${EVENT_STATUS[s].label}</span></div>
      <div class="ev-title">${esc(e.title || t.label)}</div>
      <div class="ev-meta">📅 ${esc(dateRange(e))}${days > 1 ? ` (${days} วัน)` : ''}${e.startTime ? ` · ⏰ ${esc(e.startTime)}${e.endTime ? '–' + esc(e.endTime) : ''}` : ''}</div>
      ${e.venue ? `<div class="ev-meta">📍 ${esc(e.venue)}</div>` : ''}
      ${e.staff?.length ? `<div class="ev-meta">👥 ${esc(e.staff.join(', '))}</div>` : ''}
      ${(() => { const today_ = (e.shifts || {})[today]; const pp = prepProgress(e.checklist); return (today_?.length && s === 'ongoing' ? `<div class="ev-meta">🗓 เวรวันนี้: ${esc(today_.join(', '))}</div>` : '') + (pp.total && s !== 'done' ? `<div class="ev-meta">✅ เตรียมงาน ${pp.done}/${pp.total}</div>` : '') })()}
      ${showResult ? `<div class="ev-kpis">
        <div><span>Lead</span><b>${m.leads}${e.targetLeads ? `<small>/${e.targetLeads}</small>` : ''}</b>${bar(m.leadTargetPct, 'Lead เทียบเป้า')}</div>
        <div><span>ทดลองขับ</span><b>${m.testDrives}</b></div>
        <div><span>ใบจอง</span><b>${m.bookings}${e.targetBookings ? `<small>/${e.targetBookings}</small>` : ''}</b>${bar(m.bookingTargetPct, 'ใบจองเทียบเป้า')}</div>
        <div><span>ต่อใบจอง</span><b class="ev-sm">${money(m.costPerBooking)}</b></div>
      </div>` : `<div class="ev-meta">🎯 เป้า ${e.targetLeads || '—'} Lead · ${e.targetBookings || '—'} ใบจอง · งบ ${money(e.budget)}</div>`}
      <div class="ev-acts">
        ${s === 'ongoing' ? `<button class="btn btn-primary btn-sm" data-lead="${esc(e.id)}">➕ Lead จากงานนี้</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-edit="${esc(e.id)}">✏️ แก้</button>
      </div>
    </div>`
  }

  // ── รายละเอียด / ผลงาน ──
  function openDetail(e) {
    const t = typeOf(e.type)
    const m = metricsOf(e)
    // (v1.0.998) หลังงาน: Lead ที่ยังเป็น Lead/Prospect แต่เงียบเกิน 7 วัน ขึ้นก่อนพร้อมป้าย ให้ตามต่อทันก่อนหลุด
    const qm = eventQuietLeads(e, ref.customers, today), quiet = c => qm.get(c.id), needs = c => qm.has(c.id)
    const leads = ref.customers.filter(c => c.eventId === e.id && !c.deleted).sort((a, b) => needs(b) - needs(a))
    const nNeed = leads.filter(needs).length
    const first = c => esc(String(c.firstName || c.name || 'ลูกค้า').split(/\s+/)[0])
    const STAGE = { lead: 'Lead', pp: 'Prospect', booking: 'จองแล้ว', delivered: 'ส่งมอบแล้ว' }
    const { el, close } = openModal({
      title: `${t.icon} ${esc(e.title || t.label)}`,
      size: 'lg',
      body: `<div class="ev-detail">
        <div class="ev-meta">📅 ${esc(dateRange(e))}${e.startTime ? ` · ⏰ ${esc(e.startTime)}${e.endTime ? '–' + esc(e.endTime) : ''}` : ''}${e.venue ? ` · 📍 ${esc(e.venue)}` : ''}</div>
        ${e.staff?.length ? `<div class="ev-meta">👥 ทีมที่ไป: ${esc(e.staff.join(', '))}</div>` : ''}
        ${e.models ? `<div class="ev-meta">🚗 รถที่เอาไป: ${esc(e.models)}</div>` : ''}
        ${e.description ? `<div class="ev-note">${esc(e.description)}</div>` : ''}
        <div class="ev-funnel">
          ${m.attendees ? `<div><b>${m.attendees}</b><span>ผู้เข้าชม</span></div><i>${m.attendeeToLead != null ? m.attendeeToLead + '%' : ''}</i>` : ''}
          <div><b>${m.leads}</b><span>Lead${e.targetLeads ? ` (เป้า ${e.targetLeads})` : ''}</span></div><i>→</i>
          <div><b>${m.testDrives}</b><span>ทดลองขับ</span></div><i>→</i>
          <div><b>${m.bookings}</b><span>ใบจอง${e.targetBookings ? ` (เป้า ${e.targetBookings})` : ''}</span></div><i>→</i>
          <div><b>${m.delivered}</b><span>ส่งมอบ</span></div>
        </div>
        <div class="ev-grid">
          <div><span>งบที่ตั้ง</span><b>${money(e.budget)}</b></div>
          <div><span>ใช้จริง</span><b>${money(e.spent)}${m.budgetPct != null ? ` <small>(${m.budgetPct}%)</small>` : ''}</b></div>
          <div><span>ต้นทุนต่อ Lead</span><b>${money(m.costPerLead)}</b></div>
          <div><span>ต้นทุนต่อใบจอง</span><b>${money(m.costPerBooking)}</b></div>
          <div><span>Lead → ใบจอง</span><b>${m.leadToBooking != null ? m.leadToBooking + '%' : '—'}</b></div>
          <div><span>ยอดจองรวม (ROI)</span><b>${money(m.revenue)}${m.roi ? ` <small>(${m.roi}x)</small>` : ''}</b></div>
        </div>
        ${(() => {
          // (v1.0.992) ใครเก็บ Lead ได้เท่าไหร่ · วันไหนคนเยอะ — ใช้จัดเวรงานหน้า
          const br = eventBreakdown(e, ref)
          if (!br.byStaff.length) return ''
          const maxS = Math.max(...br.byStaff.map(r => r.leads)), maxD = Math.max(...br.byDay.map(d => d.leads), 1)
          return `<div class="ev-h">ผลงานรายคน${br.byDay.length > 1 ? ' & รายวัน' : ''}</div>
            <div class="ev-bars">${br.byStaff.slice(0, 12).map(r => `<div class="ev-pbar"><span>${esc(r.name)}</span><i style="width:${Math.max(4, r.leads / maxS * 100)}%"></i><b>${r.leads}${r.booked ? ` <small>จอง ${r.booked}</small>` : ''}</b></div>`).join('')}</div>
            ${br.byDay.length > 1 ? `<div class="ev-days">${br.byDay.map(d => `<div><i style="height:${Math.max(6, d.leads / maxD * 65)}%"></i><b>${d.leads}</b><span>${esc(dayLabel(d.day))}</span></div>`).join('')}</div>` : ''}`
        })()}
        ${m.leads > m.leadsInSystem ? `<div class="ev-meta">* รวม Lead ที่กรอกเพิ่มเอง ${m.leads - m.leadsInSystem} ราย (ไม่ได้บันทึกเป็นลูกค้าในระบบ)</div>` : ''}
        <div class="ev-h">ลูกค้าจากงานนี้ (${leads.length})${nNeed ? ` <button type="button" class="ev-need" id="evd-quiet" title="เปิดรายชื่อที่เงียบในหน้าลูกค้า">🔕 ต้องตามต่อ ${nNeed} ราย ›</button>` : ''}</div>
        ${leads.length ? `<div class="ev-leads">${leads.slice(0, 60).map(c => `<button type="button" class="ev-lead" data-cust="${esc(c.id)}"><b>${first(c)}</b><span>${esc(STAGE[c.stage] || c.stage || '')}${c.interestedModel ? ' · ' + esc(c.interestedModel) : ''}${c.assignedTo ? ' · ' + esc(c.assignedTo) : ''}</span>${needs(c) ? `<em class="ev-quiet">🔕 เงียบ ${quiet(c)} วัน</em>` : ''}</button>`).join('')}</div>`
          : '<div class="ev-meta">ยังไม่มีลูกค้าที่ติดป้ายงานนี้ — ระหว่างงานกด “➕ Lead” ที่แถบบน (ปุ่มงานนี้จะถูกเลือกไว้ให้)</div>'}
        <div id="evd-roster"></div>
        <div id="evd-prep"></div>
        ${e.lessons ? `<div class="ev-h">สิ่งที่ได้เรียนรู้</div><div class="ev-note">${esc(e.lessons)}</div>` : ''}
      </div>`,
      footer: `<button class="btn btn-ghost" id="evd-del">🗑 ลบ</button><button class="btn btn-secondary" id="evd-sum" title="สรุปผลงานสั้นๆ ไม่มีเบอร์ลูกค้า วางในกลุ่ม LINE ได้เลย">📋 สรุปผล</button><button class="btn btn-secondary" id="evd-edit">✏️ แก้ / ใส่ผล</button>${autoStatus(e, today) === 'ongoing' ? '<button class="btn btn-primary" id="evd-lead">➕ Lead จากงานนี้</button>' : ''}`,
    })
    bindPrep(el, e)
    el.querySelector('#evd-edit').addEventListener('click', () => { close(); openForm(e) })
    el.querySelector('#evd-quiet')?.addEventListener('click', () => { close(); navigate(`/crm/customers?event=${encodeURIComponent(e.id)}&eventName=${encodeURIComponent(e.title || '')}&fu=quiet`) })
    el.querySelector('#evd-sum').addEventListener('click', () => copyText(eventSummaryText(e, m, eventBreakdown(e, ref), dayLabel, qm.size), '📋 คัดลอกสรุปผลงานแล้ว วางในกลุ่ม LINE ได้เลย'))
    el.querySelector('#evd-lead')?.addEventListener('click', () => { close(); openQuickLead() })
    el.querySelector('#evd-del').addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'ลบงานนี้?', message: `“${e.title}” จะหายจากตารางและปฏิทิน (ลูกค้าที่ติดป้ายงานยังอยู่ครบ)`, confirmText: '🗑 ลบ', danger: true }))) return
      try { await softDelete(COL, e.id); showToast('ลบแล้ว', 'success'); close() } catch { showToast('ลบไม่สำเร็จ', 'error') }
    })
    el.querySelectorAll('[data-cust]').forEach(b => b.addEventListener('click', () => { close(); navigate('/crm/customers?id=' + b.dataset.cust) }))
  }

  // ── (v1.0.987) เวรบูธรายวัน + เช็กลิสต์เตรียมงาน (แก้ได้จากหน้ารายละเอียดเลย ไม่ต้องเปิดฟอร์ม) ──
  const WD = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
  const MO = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const dayLabel = d => { const x = new Date(d + 'T00:00:00Z'); return `${WD[x.getUTCDay()]} ${x.getUTCDate()} ${MO[x.getUTCMonth()]}` }
  function bindPrep(el, e) {
    const days = eventDays(e)
    let shifts = normalizeShifts(e.shifts, days)
    let list = normalizeChecklist(e.checklist)
    const pool = () => [...new Set([...(e.staff || []), ...Object.values(shifts).flat()])].length ? [...new Set([...(e.staff || []), ...Object.values(shifts).flat()])] : getSalesStaff()
    const save = async patch => { try { await updateDocData(COL, e.id, patch); Object.assign(e, patch) } catch { showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error') } }
    const rosterBox = el.querySelector('#evd-roster')
    const prepBox = el.querySelector('#evd-prep')
    function drawRoster() {
      if (!days.length) { rosterBox.innerHTML = ''; return }
      const counts = shiftCounts(shifts)
      const per = Math.min(3, Math.max(1, Math.round((pool().length || 2) / 2)))
      rosterBox.innerHTML = `<div class="ev-h ev-h-row"><span>🗓 เวรบูธรายวัน</span><span class="ev-h-acts">
          <select class="input ev-per" id="evr-per" aria-label="คนต่อวัน">${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${n === per ? ' selected' : ''}>${n} คน/วัน</option>`).join('')}</select>
          <button type="button" class="btn btn-secondary btn-xs" id="evr-auto">🔀 จัดเวรให้</button>
          ${counts.length ? '<button type="button" class="btn btn-ghost btn-xs" id="evr-copy">📋 คัดลอก</button>' : ''}</span></div>
        <div class="ev-roster">${days.map(d => `<button type="button" class="ev-shift${d === today ? ' is-today' : ''}" data-day="${d}"><b>${dayLabel(d)}</b><span>${(shifts[d] || []).length ? esc(shifts[d].join(', ')) : '<i>แตะเพื่อเลือกคน</i>'}</span></button>`).join('')}</div>
        ${counts.length ? `<div class="ev-meta">รวม: ${counts.map(([n, c]) => `${esc(n)} ${c} วัน`).join(' · ')}</div>` : `<div class="ev-meta">ยังไม่ได้จัดเวร — กด “🔀 จัดเวรให้” ระบบแบ่งให้ทุกคนได้วันเท่าๆกัน (เสาร์-อาทิตย์เพิ่ม 1 คน) แล้วแก้รายวันได้</div>`}`
    }
    function drawPrep() {
      const pp = prepProgress(list)
      prepBox.innerHTML = `<div class="ev-h ev-h-row"><span>✅ เตรียมงาน${pp.total ? ` ${pp.done}/${pp.total}` : ''}</span></div>
        ${list.length ? `<div class="ev-check">${list.map((x, i) => `<label class="ev-ck${x.done ? ' on' : ''}"><input type="checkbox" data-ck="${i}"${x.done ? ' checked' : ''}><span>${esc(x.t)}</span><button type="button" class="ev-ck-rm" data-rm="${i}" aria-label="ลบ">✕</button></label>`).join('')}</div>
          <div class="ev-ck-add"><input class="input" id="evc-new" placeholder="เพิ่มรายการ เช่น เต็นท์ 3x3"><button type="button" class="btn btn-secondary btn-xs" id="evc-add">＋ เพิ่ม</button></div>`
        : `<button type="button" class="btn btn-secondary btn-sm" id="evc-make">📝 สร้างเช็กลิสต์${typeOf(e.type).label}</button>`}`
    }
    drawRoster(); drawPrep()
    rosterBox.addEventListener('click', async ev => {
      if (ev.target.closest('#evr-auto')) {
        if (Object.keys(shifts).length && !(await confirmDialog({ title: 'จัดเวรใหม่ทั้งหมด?', message: 'เวรที่จัดไว้จะถูกแทนที่', confirmText: '🔀 จัดใหม่' }))) return
        const people = pool()
        if (!people.length) { showToast('ใส่ "ทีมที่ไป" ในงานนี้ก่อน (กด ✏️ แก้)', 'error'); return }
        shifts = autoRoster(days, people, +rosterBox.querySelector('#evr-per').value || 2)
        await save({ shifts }); drawRoster(); showToast('🔀 จัดเวรแล้ว แตะวันไหนเพื่อแก้ได้', 'success'); return
      }
      if (ev.target.closest('#evr-copy')) {
        const txt = [`🗓 เวร ${e.title}${e.venue ? ' @ ' + e.venue : ''}`, ...days.map(d => `${dayLabel(d)}: ${(shifts[d] || []).join(', ') || '-'}`)].join('\n')
        copyText(txt, '📋 คัดลอกตารางเวรแล้ว วางในกลุ่ม LINE ได้เลย'); return
      }
      const b = ev.target.closest('[data-day]'); if (!b) return
      const d = b.dataset.day
      const people = pool(); const cur = new Set(shifts[d] || [])
      const m = openModal({ title: `🗓 เวร ${dayLabel(d)}`, size: 'sm',
        body: `<div class="ev-pickday">${people.map(n => `<label class="ev-ck${cur.has(n) ? ' on' : ''}"><input type="checkbox" value="${esc(n)}"${cur.has(n) ? ' checked' : ''}><span>${esc(n)}</span></label>`).join('') || '<div class="ev-meta">ยังไม่มีรายชื่อทีม</div>'}</div>`,
        footer: '<button class="btn btn-secondary" id="evp-c">ยกเลิก</button><button class="btn btn-primary" id="evp-s">💾 บันทึก</button>' })
      m.el.querySelector('#evp-c').addEventListener('click', m.close)
      m.el.querySelector('#evp-s').addEventListener('click', async () => {
        const pick = [...m.el.querySelectorAll('input:checked')].map(x => x.value)
        if (pick.length) shifts[d] = pick; else delete shifts[d]
        await save({ shifts }); m.close(); drawRoster()
      })
    })
    prepBox.addEventListener('click', async ev => {
      if (ev.target.closest('#evc-make')) { list = defaultChecklist(e.type); await save({ checklist: list }); drawPrep(); return }
      if (ev.target.closest('#evc-add')) { const i = prepBox.querySelector('#evc-new'); const t = i.value.trim(); if (!t) return; list.push({ t, done: false }); await save({ checklist: list }); drawPrep(); prepBox.querySelector('#evc-new')?.focus(); return }
      const rm = ev.target.closest('[data-rm]')
      if (rm) { ev.preventDefault(); list.splice(+rm.dataset.rm, 1); await save({ checklist: list }); drawPrep() }
    })
    prepBox.addEventListener('change', async ev => {
      const c = ev.target.closest('[data-ck]'); if (!c) return
      list[+c.dataset.ck].done = c.checked; await save({ checklist: list }); drawPrep()
    })
    prepBox.addEventListener('keydown', ev => { if (ev.target.id === 'evc-new' && ev.key === 'Enter') { ev.preventDefault(); prepBox.querySelector('#evc-add').click() } })
  }

  // ── ฟอร์ม ──
  function openForm(e) {
    const v = e ? normalizeEvent(e) : normalizeEvent({ type: typeFilter !== 'all' ? typeFilter : 'booth', startDate: today, endDate: today })
    const staff = getSalesStaff()
    const s = autoStatus(e || v, today)
    const { el, close } = openModal({
      title: e ? `✏️ แก้ — ${e.title}` : '＋ เพิ่มงานออกบูธ / อีเวนต์',
      size: 'lg',
      body: `<div class="ev-form">
        <div class="input-group ev-full"><label class="input-label">ชื่องาน *</label><input class="input" id="ef-title" value="${esc(v.title)}" placeholder="เช่น ออกบูธ Central Westgate"></div>
        <div class="input-group"><label class="input-label">ประเภท</label><select class="input" id="ef-type">${EVENT_TYPE_ORDER.map(k => `<option value="${k}"${k === v.type ? ' selected' : ''}>${EVENT_TYPES[k].icon} ${EVENT_TYPES[k].label}</option>`).join('')}</select></div>
        <div class="input-group"><label class="input-label">สถานะ</label><select class="input" id="ef-status">
          <option value="planning"${v.status === 'planning' ? ' selected' : ''}>วางแผน</option>
          <option value="confirmed"${v.status === 'confirmed' ? ' selected' : ''}>ยืนยันแล้ว</option>
          <option value="cancelled"${v.status === 'cancelled' ? ' selected' : ''}>ยกเลิก</option></select>
          <span class="input-hint">กำลังจัด/จบแล้ว เปลี่ยนให้เองตามวันที่${e ? ` (ตอนนี้: ${EVENT_STATUS[s].label})` : ''}</span></div>
        <div class="input-group"><label class="input-label">วันเริ่ม *</label><input type="date" class="input" id="ef-start" value="${esc(v.startDate)}"></div>
        <div class="input-group"><label class="input-label">วันสุดท้าย</label><input type="date" class="input" id="ef-end" value="${esc(v.endDate)}"></div>
        <div class="input-group"><label class="input-label">เวลาเริ่ม</label><input type="time" class="input" id="ef-st" value="${esc(v.startTime)}"></div>
        <div class="input-group"><label class="input-label">เวลาเลิก</label><input type="time" class="input" id="ef-et" value="${esc(v.endTime)}"></div>
        <div class="input-group ev-full"><label class="input-label">สถานที่</label><input class="input" id="ef-venue" value="${esc(v.venue)}" placeholder="เช่น ห้างเซ็นทรัล เวสต์เกต ชั้น 1"></div>
        <div class="input-group ev-full"><label class="input-label">ทีมที่ไป (คั่นด้วย ,)</label><input class="input" id="ef-staff" list="ef-staff-dl" value="${esc(v.staff.join(', '))}"><datalist id="ef-staff-dl">${staff.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
          ${staff.length ? `<div class="ev-pick">${staff.slice(0, 20).map(n => `<button type="button" class="ev-chip" data-staff="${esc(n)}">＋ ${esc(n)}</button>`).join('')}</div>` : ''}</div>
        <div class="input-group ev-full"><label class="input-label">รถที่เอาไปโชว์ / ทดลองขับ</label><input class="input" id="ef-models" value="${esc(v.models)}" placeholder="เช่น S07 ขาว, S05 เทา"></div>
        <div class="input-group"><label class="input-label">งบประมาณ (บาท)</label><input type="number" class="input" id="ef-budget" value="${v.budget || ''}"></div>
        <div class="input-group"><label class="input-label">ใช้จริง (บาท)</label><input type="number" class="input" id="ef-spent" value="${v.spent || ''}"></div>
        <div class="input-group"><label class="input-label">เป้า Lead</label><input type="number" class="input" id="ef-tl" value="${v.targetLeads || ''}"></div>
        <div class="input-group"><label class="input-label">เป้าใบจอง</label><input type="number" class="input" id="ef-tb" value="${v.targetBookings || ''}"></div>
        <div class="input-group"><label class="input-label">ผู้เข้าชมบูธ (คน)</label><input type="number" class="input" id="ef-att" value="${v.attendees || ''}"></div>
        <div class="input-group"><label class="input-label">Lead ที่ไม่ได้บันทึกในระบบ</label><input type="number" class="input" id="ef-xl" value="${v.extraLeads || ''}"><span class="input-hint">Lead ที่บันทึกผ่าน ➕ Lead นับให้เองแล้ว</span></div>
        <div class="input-group"><label class="input-label">ใบจองจากงานที่ไม่ได้ผูกในระบบ</label><input type="number" class="input" id="ef-xb" value="${v.extraBookings || ''}"><span class="input-hint">ใบจองของลูกค้าที่ติดป้ายงานนับให้เองแล้ว</span></div>
        <div class="input-group ev-full"><label class="input-label">รายละเอียด / สิ่งที่ต้องเตรียม</label><textarea class="input" id="ef-desc" rows="3">${esc(v.description)}</textarea></div>
        <div class="input-group ev-full"><label class="input-label">สรุปหลังงาน: ได้ผลดี/ควรปรับอะไร</label><textarea class="input" id="ef-less" rows="2">${esc(v.lessons)}</textarea></div>
      </div>`,
      footer: '<button class="btn btn-secondary" id="ef-cancel">ยกเลิก</button><button class="btn btn-primary" id="ef-save">💾 บันทึก</button>',
    })
    const q = s => el.querySelector(s)
    q('#ef-start').addEventListener('change', () => { if (!q('#ef-end').value || q('#ef-end').value < q('#ef-start').value) q('#ef-end').value = q('#ef-start').value })
    el.querySelectorAll('[data-staff]').forEach(b => b.addEventListener('click', () => {
      const cur = q('#ef-staff').value.split(',').map(x => x.trim()).filter(Boolean)
      if (!cur.includes(b.dataset.staff)) cur.push(b.dataset.staff)
      q('#ef-staff').value = cur.join(', ')
    }))
    q('#ef-cancel').addEventListener('click', close)
    q('#ef-save').addEventListener('click', async () => {
      const data = normalizeEvent({
        title: q('#ef-title').value, type: q('#ef-type').value, status: q('#ef-status').value,
        startDate: q('#ef-start').value, endDate: q('#ef-end').value, startTime: q('#ef-st').value, endTime: q('#ef-et').value,
        venue: q('#ef-venue').value, staff: q('#ef-staff').value, models: q('#ef-models').value,
        budget: q('#ef-budget').value, spent: q('#ef-spent').value, targetLeads: q('#ef-tl').value, targetBookings: q('#ef-tb').value,
        attendees: q('#ef-att').value, extraLeads: q('#ef-xl').value, extraBookings: q('#ef-xb').value, description: q('#ef-desc').value, lessons: q('#ef-less').value,
      })
      if (!data.title) { showToast('❗ กรุณากรอกชื่องาน', 'error'); return }
      if (!data.startDate) { showToast('❗ กรุณาเลือกวันเริ่ม', 'error'); return }
      const btn = q('#ef-save'); btn.disabled = true
      try {
        if (e) await updateDocData(COL, e.id, data)
        else await createDoc(COL, { ...data, companyId: myEffectiveCompanyId() || null })
        showToast('✅ บันทึกแล้ว · ขึ้นในปฏิทินงานแล้ว', 'success')
        close()
      } catch { btn.disabled = false; showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error') }
    })
  }

  // ── เหตุการณ์ ──
  $('#ev-add').addEventListener('click', () => openForm(null))
  $('#ev-tabs').addEventListener('click', ev => { const b = ev.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; tabPicked = true; render() } })
  $('#ev-chips').addEventListener('click', ev => { const b = ev.target.closest('[data-type]'); if (b) { typeFilter = b.dataset.type; render() } })
  $('#ev-list').addEventListener('click', ev => {
    if (ev.target.closest('[data-add]')) return openForm(null)
    const lead = ev.target.closest('[data-lead]'); if (lead) return openQuickLead()
    const ed = ev.target.closest('[data-edit]'); if (ed) { const e = events.find(x => x.id === ed.dataset.edit); if (e) openForm(e); return }
    const op = ev.target.closest('[data-open]'); if (op) { const e = events.find(x => x.id === op.dataset.open); if (e) openDetail(e) }
  })
  $('#ev-list').addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('[data-open]')) ev.target.click() })
  $('#ev-export').addEventListener('click', () => {
    exportToExcel(events.map(e => {
      const m = metricsOf(e)
      return { งาน: e.title, ประเภท: typeOf(e.type).label, วันเริ่ม: e.startDate, วันสุดท้าย: e.endDate, สถานที่: e.venue, ทีม: (e.staff || []).join(', '), สถานะ: EVENT_STATUS[statusOf(e)].label,
        งบ: e.budget || 0, ใช้จริง: e.spent || 0, ผู้เข้าชม: m.attendees, Lead: m.leads, เป้าLead: e.targetLeads || 0, ทดลองขับ: m.testDrives, ใบจอง: m.bookings, เป้าใบจอง: e.targetBookings || 0,
        ส่งมอบ: m.delivered, ต้นทุนต่อLead: m.costPerLead || '', ต้นทุนต่อใบจอง: m.costPerBooking || '' }
    }), 'events')
    showToast('📥 ส่งออกแล้ว', 'success')
  })

  render()
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
