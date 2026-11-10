// ปฏิทินงานรวม (v1.0.965) — Route: /calendar
// รวมทุกอย่างที่มี "วันที่ต้องทำ" ในแอปไว้ในปฏิทินเดียว: นัดลูกค้า · ทดลองขับ · ตามลูกค้า · ส่งมอบรถ · ตรวจรถก่อนส่งมอบ ·
// ไฟแนนซ์ (ส่งเคส/ตามผล/เซ็นสัญญา/หาใหม่) · นัดเข้าศูนย์ · งาน · นัดหมายอื่นๆ — กดรายการเพื่อจดโน้ต/บันทึกการติดตาม/นัดต่อ
// ข้อมูลอ่านสด (watchDocs) ไม่สร้างข้อมูลซ้ำ ยกเว้น "นัดหมายอื่นๆ" ที่เพิ่มเองในหน้านี้ (calendar_events)
import './calendar.css'
import { watchDocs, createDoc, updateDocData, softDelete, readDoc } from '../../core/db.js'
import { showToast, getState, on } from '../../core/store.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord, normName } from '../../core/hierarchy.js'
import { formatDate, todayBangkok, daysFromToday } from '../../utils/format.js'
import { followupWindowFilters } from '../../utils/customerFollowups.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { navigate } from '../../core/router.js'
import { escHtml } from '../../utils/escape.js'
import { offerNextFollowup } from '../../utils/addFollowupModal.js'
import { touchCustomerContact } from '../../utils/customerContact.js'
import { KINDS, KIND_ORDER, buildWorkItems, groupByDate, summarize, addDaysYmd } from '../../utils/workCalendar.js'
import { dmy as fmtDMY, hm as fmtHM } from '../../utils/format.js'

const EVENT_TYPES = {
  customer: '🤝 นัดลูกค้า',
  call:     '📞 นัดโทร/ติดตาม',
  meeting:  '👥 ประชุม',
  reminder: '⏰ แจ้งเตือน',
  deadline: '🎯 เดดไลน์',
  training: '🎓 อบรม',
  other:    '📌 อื่นๆ',
}
const MONTH_NAMES = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const DOW_NAMES = ['อา','จ','อ','พ','พฤ','ศ','ส']
const DOW_FULL = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
const LIST_DAYS = 14
const OVERDUE_SHOW = 4

const pad2 = n => String(n).padStart(2, '0')
const ymdOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
const dowOf = ymd => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10))).getUTCDay()

function dayLabel(ymd, today) {
  const n = daysFromToday(ymd, today)
  const base = `${DOW_FULL[dowOf(ymd)]} ${fmtDMY(ymd)}`
  return n === 0 ? `วันนี้ · ${base}` : n === 1 ? `พรุ่งนี้ · ${base}` : n === -1 ? `เมื่อวาน · ${base}` : base
}

export default async function CalendarPage(container) {
  const myGen = container.__routerGen
  const today = todayBangkok()
  let viewYear = +today.slice(0, 4)
  let viewMonth = +today.slice(5, 7) - 1
  let listStart = today
  let selected = today
  let view = lsGet('wc-view', '') || (window.innerWidth < 760 ? 'list' : 'month')
  let who = lsGet('wc-who', 'all')
  let off = new Set(String(lsGet('wc-off', '')).split(',').filter(k => KINDS[k]))
  let showAllOverdue = false
  // มือถือ: ย่อกล่องงานค้างไว้เหลือแถบเดียว ไม่ให้ดันปฏิทินลงไปไกล — แตะเพื่อเปิด
  let lateOpen = window.innerWidth >= 760

  const data = { appointments: [], testDrives: [], followups: [], bookings: [], serviceAppts: [], tasks: [], events: [], marketingEvents: [] }
  // (v1.0.970) โน้ต/บันทึกการติดตาม ผูกกับ "เรื่อง" (it.ref เช่น bookings:<id>, customers:<id>) — ใหม่สุดก่อน
  let notes = []
  let notesByRef = new Map()
  const NOTE_TYPES = { note: '📝 โน้ต', call: '📞 โทรแล้ว', line: '💬 ส่ง LINE แล้ว', meet: '🤝 พบลูกค้าแล้ว', wait: '⏳ รอลูกค้าตอบ' }
  let scope = null
  let items = []

  container.innerHTML = `
    <div class="page-content animate-slide wc">
      <div class="page-header">
        <div>
          <div class="page-title">📅 ปฏิทินงาน</div>
          <div class="page-subtitle">นัดลูกค้า · ส่งมอบ · ตรวจรถ · ไฟแนนซ์ · ตามลูกค้า · งาน — รวมไว้ที่เดียว กดรายการเพื่อจดโน้ต บันทึกการติดตาม หรือนัดต่อ</div>
        </div>
        <div class="page-actions"><button class="btn btn-primary" id="wc-add">➕ เพิ่มนัดหมาย</button></div>
      </div>
      <div class="wc-sum" id="wc-sum"></div>
      <div class="wc-bar">
        <div class="wc-nav">
          <button class="btn btn-secondary btn-sm" id="wc-prev" aria-label="ก่อนหน้า">‹</button>
          <div class="wc-label" id="wc-label"></div>
          <button class="btn btn-secondary btn-sm" id="wc-next" aria-label="ถัดไป">›</button>
          <button class="btn btn-ghost btn-sm" id="wc-today">วันนี้</button>
        </div>
        <div class="wc-tools">
          <select class="input wc-who" id="wc-who" aria-label="ของใคร" hidden></select>
          <div class="wc-views" role="tablist">
            <button type="button" data-view="month">📅 เดือน</button>
            <button type="button" data-view="list">📋 รายการ</button>
          </div>
        </div>
      </div>
      <div class="wc-chips chip-scroll" id="wc-chips"></div>
      <div id="wc-overdue"></div>
      <div id="wc-body"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>
    </div>`

  const $ = s => container.querySelector(s)
  const alive = () => container.__routerGen === myGen && container.isConnected

  // ── ดึงข้อมูลสด ──
  let unsubs = []
  function startWatch() {
    unsubs.forEach(u => u()); unsubs = []
    const cs = companyScopeFilters()
    const w = (col, filters, sort, dir, n, key) => unsubs.push(watchDocs(col, filters, sort, dir, n, rows => {
      if (!alive()) { stop(); return }
      data[key] = rows; schedule()
    }))
    w('bookings', cs, 'createdAt', 'desc', 3000, 'bookings')
    w('appointments', cs, 'date', 'desc', 1000, 'appointments')
    w('test_drives', cs, 'date', 'desc', 1000, 'testDrives')
    w('followups', [...cs, ...followupWindowFilters(today)], 'dueDate', 'asc', 3000, 'followups')
    w('service_appointments', cs, 'date', 'desc', 1000, 'serviceAppts')
    w('tasks', cs, 'dueDate', 'desc', 1000, 'tasks')
    w('calendar_events', [], 'date', 'desc', 1000, 'events')
    w('marketing_events', [], 'startDate', 'desc', 300, 'marketingEvents')
    unsubs.push(watchDocs('work_notes', cs, 'at', 'desc', 3000, rows => {
      if (!alive()) { stop(); return }
      notes = rows.filter(n => !n.deleted)
      notesByRef = new Map()
      notes.forEach(n => { if (!notesByRef.has(n.ref)) notesByRef.set(n.ref, []); notesByRef.get(n.ref).push(n) })
      schedule()
      refreshSheet()
    }))
  }
  const offCompany = on('activeCompanyFilter', startWatch)
  function stop() { unsubs.forEach(u => u()); unsubs = []; offCompany() }

  let raf = 0
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (alive()) rebuild() }) }

  function rebuild() {
    items = buildWorkItems(data, today).filter(it => it.shared || scopeIncludesRecord(scope, it.owner, it.rec))
    render()
  }

  // ── ตัวกรอง ──
  function owners() {
    const m = new Map()
    items.forEach(it => { const k = normName(it.owner); if (k && !m.has(k)) m.set(k, it.owner.trim()) })
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'th'))
  }
  const passWho = it => who === 'all' || !it.owner || normName(it.owner) === who
  const shown = () => items.filter(it => !off.has(it.kind) && passWho(it))

  function range() {
    if (view === 'list') return [listStart, addDaysYmd(listStart, LIST_DAYS - 1)]
    return [ymdOf(viewYear, viewMonth, 1), ymdOf(viewYear, viewMonth, new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate())]
  }

  const shortDT = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${fmtDMY(d)} ${fmtHM(d)}` }
  function lastNoteLine(it) {
    const ns = notesByRef.get(it.ref)
    if (!ns?.length) return ''
    const n = ns[0]
    return `<div class="wc-note">${escHtml(NOTE_TYPES[n.type] || '📝')} ${escHtml(n.text || '')} <span>· ${escHtml(shortDT(n.at))}${ns.length > 1 ? ` · บันทึก ${ns.length}` : ''}</span></div>`
  }

  // ── วาด ──
  function itemRow(it, { showDate = false } = {}) {
    const k = KINDS[it.kind]
    const evType = it.kind === 'event' && EVENT_TYPES[it.rec?.type]
    const kLabel = evType ? evType.replace(/^\S+\s/, '') : k.label
    const late = it.overdue ? -daysFromToday(it.date, today) : 0
    const meta = [showDate ? `<b>${late ? `เลย ${late} วัน` : formatDate(it.date)}</b>` : '', kLabel, it.sub ? escHtml(it.sub) : '', it.owner ? '👤 ' + escHtml(it.owner) : '']
      .filter(Boolean).join(' · ')
    const tel = String(it.phone || '').replace(/[^\d+]/g, '')
    return `<div class="wc-item k-${it.kind}${it.done ? ' is-done' : ''}${it.overdue ? ' is-late' : ''}" data-key="${escHtml(it.key)}" role="button" tabindex="0">
      <span class="wc-ico" aria-hidden="true">${it.done ? '✓' : evType ? evType.split(' ')[0] : k.icon}</span>
      <div class="wc-main">
        <div class="wc-t">${it.time ? `<span class="wc-time">${escHtml(it.time)}</span>` : ''}${escHtml(it.title)}${it.tag ? `<span class="wc-tag">${escHtml(it.tag)}</span>` : ''}</div>
        <div class="wc-s">${meta}</div>
        ${lastNoteLine(it)}
      </div>
      ${it.canCheck ? `<button type="button" class="wc-check${it.done ? ' on' : ''}" aria-label="${it.done ? 'ยกเลิกว่าทำแล้ว' : 'ทำแล้ว'}" title="${it.done ? 'กดอีกครั้งเพื่อยกเลิก' : 'กดเมื่อทำแล้ว'}">✓</button>` : ''}
      ${tel.length >= 9 && !it.done ? `<a class="wc-call" href="tel:${escHtml(tel)}" aria-label="โทร" title="โทร ${escHtml(it.phone)}">📞</a>` : ''}
      <span class="wc-go" aria-hidden="true">›</span>
    </div>`
  }

  function render() {
    const list = shown()
    const [from, to] = range()
    const s = summarize(list, today)

    $('#wc-sum').innerHTML = `
      <button type="button" class="wc-tile" data-jump="today"><span>วันนี้</span><b>${s.today}</b></button>
      <button type="button" class="wc-tile" data-jump="week"><span>7 วันหน้า</span><b>${s.week}</b></button>
      <button type="button" class="wc-tile${s.overdue ? ' is-late' : ''}" data-jump="late"><span>⚠️ ค้าง</span><b>${s.overdue}</b></button>`

    $('#wc-label').textContent = view === 'list'
      ? `${fmtDMY(from)} – ${fmtDMY(to)}`
      : `${MONTH_NAMES[viewMonth]} ${viewYear + 543}`
    container.querySelectorAll('.wc-views [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === view))

    // ของใคร — โชว์เมื่อเห็นงานมากกว่า 1 คน
    const ow = owners()
    const sel = $('#wc-who')
    if (who !== 'all' && !ow.some(([k]) => k === who)) who = 'all'
    sel.hidden = ow.length < 2
    sel.innerHTML = `<option value="all">👥 ทุกคน</option>` + ow.map(([k, n]) => `<option value="${escHtml(k)}"${k === who ? ' selected' : ''}>👤 ${escHtml(n)}</option>`).join('')

    // ชิปประเภท (นับเฉพาะช่วงที่ดูอยู่ ไม่รวมที่เสร็จแล้ว) — ซ่อนประเภทที่ไม่มีข้อมูลเลย
    const inRangeAll = items.filter(it => passWho(it) && it.date >= from && it.date <= to && !it.done)
    const present = new Set(items.map(it => it.kind))
    $('#wc-chips').innerHTML = KIND_ORDER.filter(k => present.has(k) || off.has(k)).map(k => {
      const n = inRangeAll.filter(it => it.kind === k).length
      return `<button type="button" class="wc-chip k-${k}${off.has(k) ? '' : ' on'}" data-kind="${k}" aria-pressed="${!off.has(k)}">${KINDS[k].icon} ${KINDS[k].label}<b>${n}</b></button>`
    }).join('')

    // งานค้าง/เลยกำหนด
    const late = list.filter(it => it.overdue).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    $('#wc-overdue').innerHTML = late.length ? `
      <div class="card wc-late">
        <button type="button" class="wc-late-h" id="wc-late-toggle" aria-expanded="${lateOpen}">⚠️ เลยกำหนด / ค้างอยู่ ${late.length} รายการ <span>${lateOpen ? '— กดรายการเพื่อจัดการ' : '— แตะเพื่อดู'}</span><i>${lateOpen ? '▴' : '▾'}</i></button>
        ${lateOpen ? (showAllOverdue ? late : late.slice(0, OVERDUE_SHOW)).map(it => itemRow(it, { showDate: true })).join('') : ''}
        ${lateOpen && late.length > OVERDUE_SHOW ? `<button type="button" class="btn btn-ghost btn-sm wc-more" id="wc-late-more">${showAllOverdue ? 'ย่อ' : `ดูทั้งหมด (+${late.length - OVERDUE_SHOW})`}</button>` : ''}
      </div>` : ''

    const byDate = groupByDate(list)
    $('#wc-body').innerHTML = view === 'list' ? listView(byDate, from) : monthView(byDate)
  }

  function listView(byDate, from) {
    const days = []
    for (let i = 0; i < LIST_DAYS; i++) { const d = addDaysYmd(from, i); if (byDate[d]?.length) days.push(d) }
    if (!days.length) return `<div class="empty-state wc-empty"><div class="empty-icon">🗓️</div><div class="empty-title">ไม่มีงานในช่วงนี้</div><div class="empty-desc">กด › เพื่อดูช่วงถัดไป หรือ ➕ เพิ่มนัดหมาย</div></div>`
    return days.map(d => `
      <section class="wc-day${d === today ? ' is-today' : ''}">
        <div class="wc-day-h"><span>${dayLabel(d, today)}</span><b>${byDate[d].length}</b><button type="button" class="wc-add-day" data-add="${d}" aria-label="เพิ่มนัดหมายวันนี้">＋</button></div>
        <div class="card wc-day-list">${byDate[d].map(it => itemRow(it)).join('')}</div>
      </section>`).join('')
  }

  function monthView(byDate) {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay()
    const dim = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate()
    if (!selected.startsWith(`${viewYear}-${pad2(viewMonth + 1)}`)) selected = ymdOf(viewYear, viewMonth, 1)
    const cells = []
    for (let i = 0; i < first; i++) cells.push('<div class="wc-cell is-out"></div>')
    for (let d = 1; d <= dim; d++) {
      const key = ymdOf(viewYear, viewMonth, d)
      const its = byDate[key] || []
      const open = its.filter(it => !it.done)
      const cls = ['wc-cell', key === today ? 'is-today' : '', key === selected ? 'is-sel' : '', its.some(it => it.overdue) ? 'has-late' : '', its.length ? '' : 'is-empty'].filter(Boolean).join(' ')
      cells.push(`<button type="button" class="${cls}" data-date="${key}" aria-label="${d} ${MONTH_NAMES[viewMonth]} ${its.length} รายการ">
        <span class="wc-dn">${d}</span>
        <span class="wc-pills">${its.slice(0, 3).map(it => `<span class="wc-pill k-${it.kind}${it.done ? ' is-done' : ''}">${it.tag ? '✂️' : KINDS[it.kind].icon} ${escHtml(it.title)}</span>`).join('')}${its.length > 3 ? `<span class="wc-pill-more">+${its.length - 3}</span>` : ''}</span>
        <span class="wc-dots">${its.slice(0, 5).map(it => `<i class="k-${it.kind}${it.done ? ' is-done' : ''}"></i>`).join('')}</span>
        ${open.length ? `<span class="wc-n">${open.length}</span>` : ''}
      </button>`)
    }
    while (cells.length % 7) cells.push('<div class="wc-cell is-out"></div>')
    const dayItems = byDate[selected] || []
    return `
      <div class="card wc-month">
        <div class="wc-dow">${DOW_NAMES.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="wc-grid">${cells.join('')}</div>
      </div>
      <section class="wc-day${selected === today ? ' is-today' : ''}">
        <div class="wc-day-h"><span>${dayLabel(selected, today)}</span><b>${dayItems.length}</b><button type="button" class="wc-add-day" data-add="${selected}" aria-label="เพิ่มนัดหมายวันนี้">＋</button></div>
        <div class="card wc-day-list">${dayItems.length ? dayItems.map(it => itemRow(it)).join('') : '<div class="wc-none">ไม่มีงานวันนี้ — กด ＋ เพื่อเพิ่มนัดหมาย</div>'}</div>
      </section>`
  }

  // ── การกด ──
  function openItem(key) {
    const it = items.find(x => x.key === key)
    if (it) openSheet(it)
  }

  // ── แผ่นรายละเอียดรายการ: บันทึกการติดตาม/โน้ต · ✓ ทำแล้ว · โทร · นัดต่อ · เปิดหน้าเต็ม ──
  const NAV_LABEL = p => p.startsWith('/crm/bookings') ? '📄 เปิดใบจอง' : p.startsWith('/crm/customers') ? '👤 เปิดแฟ้มลูกค้า'
    : p === '/crm/predelivery' ? '🔍 ไปหน้าตรวจรถ' : p === '/crm/showroom' ? '🤝 ไปหน้านัดโชว์รูม' : p === '/crm/followup' ? '📞 ไปหน้าติดตาม'
    : p === '/crm/testdrive' ? '🚙 ไปหน้าทดลองขับ' : p === '/service/appointment' ? '🔧 ไปหน้านัดเข้าศูนย์' : p === '/tasks' ? '✅ ไปหน้างาน' : p.startsWith('/marketing/events') ? '🎪 เปิดงานนี้ (ผลงาน/ทีม)' : '↗ เปิดหน้า'
  let sheet = null // { key, el, close }
  function refreshSheet() {
    if (!sheet || !sheet.el.isConnected) { sheet = null; return }
    const it = items.find(x => x.key === sheet.key)
    const box = sheet.el.querySelector('#ws-log')
    if (it && box) box.innerHTML = logHtml(it)
  }
  function logHtml(it) {
    const ns = notesByRef.get(it.ref) || []
    const extra = it.kind === 'followup' && it.rec.result ? `<div class="ws-n"><b>✅ ผลการติดตาม</b> ${escHtml(it.rec.result)}</div>` : ''
    if (!ns.length && !extra) return '<div class="ws-empty">ยังไม่มีบันทึก — พิมพ์ด้านบนแล้วกดบันทึก</div>'
    return extra + ns.map(n => `<div class="ws-n"><b>${escHtml(NOTE_TYPES[n.type] || '📝 โน้ต')}</b> ${escHtml(n.text || '')}
      <span>${escHtml(shortDT(n.at))}${n.by ? ' · ' + escHtml(n.by) : ''}${n.itemTitle && n.itemTitle !== it.title ? ' · ' + escHtml(n.itemTitle) : ''}</span></div>`).join('')
  }
  function openSheet(it) {
    const k = KINDS[it.kind]
    const tel = String(it.phone || '').replace(/[^\d+]/g, '')
    const when = `${dayLabel(it.date, today)}${it.time ? ' · ' + it.time : ''}`
    const { el, close } = openModal({
      title: `${k.icon} ${escHtml(it.title)}`, size: 'md',
      body: `
        <div class="ws">
          <div class="ws-meta">
            <div><b>${escHtml(when)}</b>${it.overdue ? ' <span class="badge badge-danger">เลยกำหนด</span>' : ''}${it.done ? ' <span class="badge badge-success">ทำแล้ว</span>' : ''}${it.tag ? ` <span class="wc-tag">${escHtml(it.tag)}</span>` : ''}</div>
            <div>${escHtml(k.label)}${it.sub ? ' · ' + escHtml(it.sub) : ''}</div>
            ${it.owner ? `<div>👤 ${escHtml(it.owner)}</div>` : ''}
          </div>
          <div class="ws-acts">
            ${it.canCheck ? `<button type="button" class="btn btn-sm ${it.done ? 'btn-secondary' : 'btn-success'}" id="ws-done">${it.done ? '↩️ ยกเลิกว่าทำแล้ว' : '✓ ทำแล้ว'}</button>` : ''}
            ${tel.length >= 9 ? `<a class="btn btn-sm btn-secondary" href="tel:${escHtml(tel)}">📞 โทร ${escHtml(it.phone)}</a>` : ''}
            <button type="button" class="btn btn-sm btn-secondary" id="ws-next">📅 นัดต่อ</button>
            ${it.kind === 'event' ? '<button type="button" class="btn btn-sm btn-secondary" id="ws-edit">✏️ แก้ไขนัด</button>' : ''}
            ${it.nav ? `<button type="button" class="btn btn-sm btn-secondary" id="ws-go">${NAV_LABEL(it.nav)} ›</button>` : ''}
          </div>
          <div class="ws-h">บันทึกการติดตาม / โน้ต</div>
          <div class="wc-quick" id="ws-types">${Object.entries(NOTE_TYPES).map(([t, l], i) => `<button type="button" class="wc-q${i === 0 ? ' on' : ''}" data-t="${t}">${l}</button>`).join('')}</div>
          <textarea class="input" id="ws-text" rows="2" placeholder="เช่น ลูกค้าขอเลื่อนส่งมอบเป็นเสาร์หน้า / รอเอกสารเงินเดือน"></textarea>
          <div class="ws-save"><button type="button" class="btn btn-primary btn-sm" id="ws-save">💾 บันทึก</button></div>
          <div class="ws-log" id="ws-log">${logHtml(it)}</div>
        </div>`,
      footer: '<button class="btn btn-secondary" id="ws-close">ปิด</button>',
    })
    sheet = { key: it.key, el, close }
    let type = 'note'
    el.querySelectorAll('#ws-types .wc-q').forEach(b => b.addEventListener('click', () => {
      type = b.dataset.t
      el.querySelectorAll('#ws-types .wc-q').forEach(x => x.classList.toggle('on', x === b))
      el.querySelector('#ws-text').focus()
    }))
    el.querySelector('#ws-close').addEventListener('click', close)
    el.querySelector('#ws-go')?.addEventListener('click', () => { close(); navigate(it.nav) })
    el.querySelector('#ws-edit')?.addEventListener('click', () => { close(); openEventForm(it.rec) })
    el.querySelector('#ws-done')?.addEventListener('click', () => { close(); checkItem(it.key) })
    el.querySelector('#ws-next').addEventListener('click', () => { close(); openEventForm(null, addDaysYmd(today, 1), linkFor(it)) })
    el.querySelector('#ws-save').addEventListener('click', async () => {
      const ta = el.querySelector('#ws-text')
      const text = ta.value.trim()
      if (!text && type === 'note') { showToast('พิมพ์ข้อความก่อนบันทึก', 'warning'); ta.focus(); return }
      const btn = el.querySelector('#ws-save'); btn.disabled = true
      const user = getState('user')
      const n = { ref: it.ref, itemKey: it.key, itemTitle: it.title, kind: it.kind, type, text, at: new Date().toISOString(),
        by: user?.displayName || user?.email || '', companyId: myEffectiveCompanyId() || null }
      try {
        const id = await createDoc('work_notes', n)
        // ขึ้นทันที ไม่ต้องรอข้อมูลสดรอบถัดไป
        if (!notes.some(x => x.id === id)) { notes.unshift({ id, ...n }); (notesByRef.get(n.ref) || notesByRef.set(n.ref, []).get(n.ref)).unshift({ id, ...n }) }
        ta.value = ''; refreshSheet(); render()
        showToast('บันทึกแล้ว', 'success')
        // โทร/LINE/พบลูกค้า = ติดต่อลูกค้าแล้ว (หลุดจากรายการ "ไม่ได้ติดตาม")
        const cid = it.ref.startsWith('customers:') ? it.ref.slice(10) : it.rec.customerId
        if (cid && ['call', 'line', 'meet'].includes(type)) touchCustomerContact(cid)
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
      btn.disabled = false
    })
  }
  // ข้อมูลตั้งต้นของ "นัดต่อ" จากรายการเดิม (ชื่อลูกค้า เบอร์ และผูกกับใบจอง/ลูกค้าเดิม เพื่อเห็นประวัติร่วมกัน)
  function linkFor(it) {
    const [refCol, refId] = it.ref.split(':')
    const r = it.rec || {}
    const cust = r.custName || r.customerName || [r.firstName, r.lastName].filter(Boolean).join(' ') || ''
    return { refCol, refId, custName: cust, phone: it.phone || '', title: cust ? `ตาม ${cust}` : `ต่อ: ${it.title}`, type: cust ? 'call' : 'other', assignee: it.owner || '' }
  }

  // ── กด ✓ ทำแล้ว ──
  // ตามลูกค้า: ถามผลการติดต่อ (เหมือนหน้างานของฉันวันนี้) แล้วเสนอนัดครั้งต่อไป · ติดต่อไม่ได้ → เลื่อนเป็นพรุ่งนี้
  // นัด/ทดลองขับ/เข้าศูนย์/งาน/นัดหมาย: กดครั้งเดียวเป็น "ทำแล้ว" กดซ้ำเพื่อยกเลิก
  const SIMPLE_DONE = {
    appt:      ['appointments', 'status', 'done', 'scheduled'],
    testdrive: ['test_drives', 'status', 'done', 'scheduled'],
    service:   ['service_appointments', 'status', 'done', 'scheduled'],
    task:      ['tasks', 'status', 'done', 'todo'],
    event:     ['calendar_events', 'done', true, false],
  }
  async function checkItem(key) {
    const it = items.find(x => x.key === key)
    if (!it?.canCheck) return
    if (it.kind === 'followup') { it.done ? reopenFollowup(it) : finishFollowup(it); return }
    const [col, field, doneVal, undoVal] = SIMPLE_DONE[it.kind]
    const val = it.done ? undoVal : doneVal
    // ขึ้นผลทันที (ไม่ต้องรอเซิร์ฟเวอร์) แล้วค่อยบันทึก — ถ้าไม่สำเร็จคืนค่าเดิม
    const before = it.rec[field]
    it.rec[field] = val; rebuild()
    try {
      await updateDocData(col, it.rec.id, { [field]: val })
      showToast(it.done ? 'ยกเลิกแล้ว' : 'บันทึกว่าทำแล้ว', 'success')
    } catch { it.rec[field] = before; rebuild(); showToast('บันทึกไม่สำเร็จ', 'error') }
  }

  async function reopenFollowup(it) {
    if (!await confirmDialog({ title: 'ยกเลิกว่าติดตามแล้ว?', message: `${it.title} จะกลับไปเป็นงานที่ต้องทำ`, confirmText: 'ยกเลิก ✓' })) return
    try { await updateDocData('followups', it.rec.id, { status: 'pending' }); it.rec.status = 'pending'; rebuild() }
    catch { showToast('บันทึกไม่สำเร็จ', 'error') }
  }

  function finishFollowup(it) {
    const f = it.rec
    const tomorrow = addDaysYmd(today, 1)
    const quick = ['โทรแล้ว สนใจ', 'โทรแล้ว ยังไม่สะดวก', 'ส่ง LINE แล้ว', 'นัดเข้าโชว์รูม', 'ไม่สนใจแล้ว']
    const { el, close } = openModal({
      title: `✅ ${escHtml(it.title)}`, size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">ผลการติดต่อ</label>
          <div class="wc-quick">${quick.map(q => `<button type="button" class="wc-q" data-q="${escHtml(q)}">${escHtml(q)}</button>`).join('')}</div>
          <textarea class="input" id="wc-fu-result" rows="2" placeholder="พิมพ์เพิ่มได้ เช่น นัดทดลองขับเสาร์นี้"></textarea>
        </div>`,
      footer: `<button class="btn btn-ghost" id="wc-fu-miss" style="margin-right:auto">📵 ติดต่อไม่ได้ · เลื่อนพรุ่งนี้</button><button class="btn btn-primary" id="wc-fu-ok">✅ ติดต่อแล้ว</button>`,
    })
    const ta = el.querySelector('#wc-fu-result')
    el.querySelectorAll('.wc-q').forEach(b => b.addEventListener('click', () => { ta.value = b.dataset.q; ta.focus() }))
    el.querySelector('#wc-fu-miss').addEventListener('click', async () => {
      try {
        const note = [f.note, `ติดต่อไม่ได้ ${today.slice(8)}/${today.slice(5, 7)}`].filter(Boolean).join(' · ')
        await updateDocData('followups', f.id, { dueDate: tomorrow, note })
        f.dueDate = tomorrow; f.note = note; close(); rebuild()
        showToast('เลื่อนไปพรุ่งนี้แล้ว', 'success')
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    el.querySelector('#wc-fu-ok').addEventListener('click', async () => {
      const result = ta.value.trim()
      if (!result) { showToast('❗ เลือกหรือพิมพ์ผลการติดต่อก่อน', 'warning'); ta.focus(); return }
      try {
        await updateDocData('followups', f.id, { status: 'done', result })
        f.status = 'done'; f.result = result; close(); rebuild()
        showToast('บันทึกผลแล้ว', 'success')
        touchCustomerContact(f.customerId)
        // เสนอนัดครั้งถัดไปจากผลที่พิมพ์ (ใช้ตัวเดียวกับหน้างานของฉันวันนี้)
        const c = f.customerId ? await readDoc('customers', f.customerId).catch(() => null) : null
        if (c) offerNextFollowup({ id: f.customerId, ...c }, result, {
          me: getState('user')?.displayName || '',
          hasPending: data.followups.some(x => x.customerId === f.customerId && x.status === 'pending' && !x.deleted && x.id !== f.id),
          onSaved: () => {},
        })
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    setTimeout(() => ta.focus(), 50)
  }

  container.addEventListener('click', e => {
    if (e.target.closest('.wc-call')) return // โทรออกตรงๆ ไม่เปิดหน้า
    const chk = e.target.closest('.wc-check')
    if (chk) { checkItem(chk.closest('.wc-item')?.dataset.key); return }
    const row = e.target.closest('.wc-item')
    if (row) { openItem(row.dataset.key); return }
    const add = e.target.closest('[data-add]')
    if (add) { openEventForm(null, add.dataset.add); return }
    const cell = e.target.closest('.wc-cell[data-date]')
    if (cell) { selected = cell.dataset.date; render(); container.querySelector('.wc-day')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return }
    const chip = e.target.closest('.wc-chip')
    if (chip) {
      const k = chip.dataset.kind
      off.has(k) ? off.delete(k) : off.add(k)
      lsSet('wc-off', [...off].join(',')); render(); return
    }
    const v = e.target.closest('.wc-views [data-view]')
    if (v) { view = v.dataset.view; lsSet('wc-view', view); render(); return }
    const j = e.target.closest('[data-jump]')
    if (j) {
      if (j.dataset.jump === 'late') { lateOpen = true; render(); $('#wc-overdue .wc-late')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return }
      goToday(j.dataset.jump === 'week' ? 'list' : view); return
    }
    if (e.target.closest('#wc-late-toggle')) { lateOpen = !lateOpen; render(); return }
    if (e.target.closest('#wc-late-more')) { showAllOverdue = !showAllOverdue; render(); return }
    if (e.target.closest('#wc-prev')) return shift(-1)
    if (e.target.closest('#wc-next')) return shift(1)
    if (e.target.closest('#wc-today')) return goToday(view)
    if (e.target.closest('#wc-add')) return openEventForm(null, view === 'month' ? selected : today)
  })
  container.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('wc-item')) { e.preventDefault(); openItem(e.target.dataset.key) }
  })
  $('#wc-who').addEventListener('change', e => { who = e.target.value; lsSet('wc-who', who); render() })

  function shift(n) {
    if (view === 'list') listStart = addDaysYmd(listStart, n * LIST_DAYS)
    else { viewMonth += n; if (viewMonth < 0) { viewMonth = 11; viewYear-- } if (viewMonth > 11) { viewMonth = 0; viewYear++ } }
    render()
  }
  function goToday(v) {
    view = v; lsSet('wc-view', view)
    listStart = today; selected = today
    viewYear = +today.slice(0, 4); viewMonth = +today.slice(5, 7) - 1
    render()
  }

  // ── นัดหมายที่เพิ่มเอง (calendar_events) ──
  function openEventForm(existing, defaultDate, link = null) {
    const isEdit = !!existing
    const user = getState('user')
    const pre = existing || link || {}
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขนัดหมาย' : '➕ นัดหมายใหม่', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="ef-title" value="${escHtml(pre.title || '')}" placeholder="เช่น นัดคุณสมชายดูรถ, ประชุมทีมขาย"><span class="input-error" id="ef-title-e"></span></div>
          <div class="input-group"><label class="input-label">รายละเอียด</label><textarea class="input" id="ef-desc" rows="2">${escHtml(existing?.description || '')}</textarea></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อลูกค้า</label><input class="input" id="ef-cust" value="${escHtml(pre.custName || '')}" placeholder="ไม่บังคับ"></div>
            <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="ef-phone" type="tel" inputmode="tel" value="${escHtml(pre.phone || '')}" placeholder="ไม่บังคับ"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันที่ *</label><input class="input" type="date" id="ef-date" value="${escHtml(existing?.date || defaultDate || today)}"></div>
            <div class="input-group"><label class="input-label">เวลา</label><input class="input" type="time" id="ef-time" value="${escHtml(existing?.time || '')}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ประเภท</label>
              <select class="input" id="ef-type">${Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}" ${(pre.type || 'customer') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            </div>
            <div class="input-group"><label class="input-label">ผู้รับผิดชอบ</label><input class="input" id="ef-assignee" value="${escHtml(pre.assignee ?? (user?.displayName || ''))}"></div>
          </div>
          ${link && !isEdit ? `<div style="font-size:0.74rem;color:var(--text-muted)">🔗 ผูกกับรายการเดิม — โน้ตและบันทึกการติดตามจะเห็นร่วมกัน</div>` : ''}
        </div>`,
      footer: `${isEdit ? '<button class="btn btn-ghost" id="efd" style="color:var(--danger);margin-right:auto">🗑 ลบ</button>' : ''}<button class="btn btn-secondary" id="efc">ยกเลิก</button><button class="btn btn-primary" id="efs">💾 บันทึก</button>`,
    })
    el.querySelector('#efc').addEventListener('click', close)
    el.querySelector('#efd')?.addEventListener('click', async () => {
      if (!await confirmDialog({ title: 'ลบนัดหมาย', message: `ลบ "${existing.title || ''}"?`, confirmText: 'ลบ', danger: true })) return
      try {
        await softDelete('calendar_events', existing.id)
        data.events = data.events.filter(x => x.id !== existing.id)
        showToast('ลบแล้ว', 'success'); close(); rebuild()
      } catch { showToast('ลบไม่สำเร็จ', 'error') }
    })
    el.querySelector('#efs').addEventListener('click', async () => {
      const title = el.querySelector('#ef-title').value.trim()
      if (!title) { el.querySelector('#ef-title-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#efs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const rec = {
        title,
        description: el.querySelector('#ef-desc').value.trim(),
        date: el.querySelector('#ef-date').value || today,
        time: el.querySelector('#ef-time').value || '',
        type: el.querySelector('#ef-type').value,
        assignee: el.querySelector('#ef-assignee').value.trim(),
        custName: el.querySelector('#ef-cust').value.trim(),
        phone: el.querySelector('#ef-phone').value.trim(),
        ...(existing ? {} : link ? { refCol: link.refCol, refId: link.refId } : {}),
        createdBy: existing?.createdBy || user?.displayName || user?.uid || 'unknown',
      }
      try {
        if (isEdit) await updateDocData('calendar_events', existing.id, rec)
        else await createDoc('calendar_events', rec)
        showToast(isEdit ? 'แก้ไขแล้ว' : 'เพิ่มนัดหมายแล้ว', 'success')
        close()
        selected = rec.date
      } catch { showToast('บันทึกไม่สำเร็จ', 'error'); btn.disabled = false; btn.textContent = '💾 บันทึก' }
    })
    setTimeout(() => el.querySelector('#ef-title')?.focus(), 50)
  }

  try { scope = await getVisibilityScope() } catch { scope = null }
  if (!alive()) return
  startWatch()

  return function cleanupCalendar() { stop(); if (raf) cancelAnimationFrame(raf) }
}
