// งานของฉันวันนี้ — Route: /crm/my-day
// เปิดมาเจอทันทีว่าวันนี้ต้องโทรใคร/ทำอะไร (เกณฑ์เดียวกับข้อความเตือน 9 โมงเช้า ดู utils/myDay.js) และกดทำได้จากหน้านี้เลย
// เซลส์เห็นเฉพาะงานตัวเอง/ลูกทีม (getVisibilityScope) — เจ้าของ/ผู้จัดการเลือกดูรายคนได้
import { listAllDocs, listDocs, updateDocData, readDoc } from '../../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord, normName } from '../../core/hierarchy.js'
import { showToast, getState } from '../../core/store.js'
import { formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { navigate } from '../../core/router.js'
import { askDeliveryIncome } from '../../utils/deliveryIncome.js'
import { QUICK_SOURCES } from '../../utils/quickLead.js'
import { SALES_TARGETS_COLLECTION, targetFor, goalProgress } from '../../utils/salesTargets.js'
import { DELIVERED_STATUSES } from '../../utils/deliveryIncome.js'
import { staffChoices, findStaffCompany, assignCustomer } from '../../utils/leadAssign.js'
import { bangkokDate, buildMyDay, STALE_LEAD_DAYS, STUCK_BOOKING_DAYS, UPCOMING_DELIVERY_DAYS, FINANCE_WAIT_DAYS } from '../../utils/myDay.js'
import { followupWindowFilters } from '../../utils/customerFollowups.js'
import { openAddFollowup } from '../../utils/addFollowupModal.js'

const UNASSIGNED = '(ยังไม่มีผู้ดูแล)'
function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
const SOURCE_LABEL = Object.fromEntries(QUICK_SOURCES)
const tel = p => String(p || '').replace(/[^\d+]/g, '')

export default async function MyDayPage(container) {
  const myGen = container.__routerGen
  const me = getState('user') || {}
  let data = { customers: [], followups: [], bookings: [] }
  let seller = 'all'
  let targets = {}
  let staff = []

  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
  const scope = await getVisibilityScope()
  const canPick = !!(scope.unrestricted || scope.companyOnly || scope.hasSubordinates)

  async function load() {
    const f = companyScopeFilters()
    const [customers, followups, bookings, testDrives] = await Promise.all([
      listAllDocs('customers', f, 'createdAt', 'desc').catch(() => null),
      listDocs('followups', [...f, ...followupWindowFilters(todayBangkok())], 'dueDate', 'asc', 2000).catch(() => null),
      listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => null),
      listDocs('test_drives', f, 'date', 'desc', 200).catch(() => []),
    ])
    if (!customers || !followups || !bookings) showToast('โหลดข้อมูลบางส่วนไม่สำเร็จ', 'warning')
    data = { customers: customers || [], followups: followups || [], bookings: bookings || [], testDrives: testDrives || [] }
    try { targets = (await readDoc(SALES_TARGETS_COLLECTION, todayBangkok().slice(0, 7)))?.targets || {} } catch { targets = {} }
    try { staff = staffChoices(await listDocs('staff', companyScopeFilters(), 'firstName', 'asc', 1000)) } catch { staff = [] }
  }
  await load()
  if (container.__routerGen !== myGen) return

  const mine = (name, rec) => {
    if (!scopeIncludesRecord(scope, name, rec)) return false
    if (seller === 'all') return true
    if (seller === UNASSIGNED) return !String(name || '').trim()
    return normName(name) === normName(seller)
  }
  const sellerNames = () => {
    const s = new Set()
    data.customers.forEach(c => !c.deleted && s.add((c.assignedTo || '').trim() || UNASSIGNED))
    data.bookings.forEach(b => !b.deleted && b.salesName && s.add(b.salesName.trim()))
    data.followups.forEach(f => !f.deleted && f.salesperson && s.add(f.salesperson.trim()))
    return [...s].filter(n => n === UNASSIGNED || scopeIncludesRecord(scope, n, {})).sort((a, b) => a.localeCompare(b, 'th'))
  }

  function section(icon, title, hint, items, row, color = 'primary') {
    return `<div class="card" style="padding:0;margin-bottom:14px;overflow:hidden">
      <div style="padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">
        <span style="font-size:1.1rem">${icon}</span><b>${title}</b>
        <span class="badge badge-${items.length ? color : 'secondary'}">${items.length}</span>
        <span style="margin-left:auto;font-size:0.7rem;color:var(--text-muted)">${hint}</span>
      </div>
      ${items.length ? items.slice(0, 50).map(row).join('') + (items.length > 50 ? `<div style="padding:8px 16px;font-size:0.75rem;color:var(--text-muted)">…และอีก ${items.length - 50} รายการ</div>` : '')
        : `<div style="padding:14px 16px;font-size:0.8rem;color:var(--text-muted)">✅ ไม่มีงานค้าง</div>`}
    </div>`
  }
  const line = (main, sub, actions) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <div style="flex:1;min-width:180px"><div style="font-weight:600;font-size:0.86rem">${main}</div><div style="font-size:0.72rem;color:var(--text-muted)">${sub}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div></div>`
  const callBtn = phone => tel(phone) ? `<a class="btn btn-secondary btn-xs" href="tel:${escHtml(tel(phone))}">📞 โทร</a>` : ''
  const takeBtns = c => String(c.assignedTo || '').trim() ? '' : `${me.displayName ? `<button class="btn btn-primary btn-xs md-take" data-id="${escHtml(c.id)}">🙋 รับดูแล</button>` : ''}${canPick && staff.length ? `<button class="btn btn-secondary btn-xs md-give" data-id="${escHtml(c.id)}">👉 มอบให้</button>` : ''}`
  const ownerTag = n => seller === 'all' && canPick ? ` · 👤 ${escHtml((n || '').trim() || UNASSIGNED)}` : ''

  // เป้าส่งมอบเดือนนี้ของคนที่เลือก (ตัวเอง ถ้าดูทุกคน) — ตั้งเป้าได้ที่หน้ารายได้รายเซลส์
  function goalCard(today) {
    const who = seller !== 'all' && seller !== UNASSIGNED ? seller : me.displayName
    const t = targetFor(targets, who)
    if (!t) return ''
    const month = today.slice(0, 7)
    const done = data.bookings.filter(b => !b.deleted && DELIVERED_STATUSES.includes(b.status) && (b.cutDate || b.actualDeliveryDate || '').startsWith(month) && normName(b.salesName) === normName(who)).length
    const g = goalProgress(done, t)
    const [y, m, dd] = today.split('-').map(Number)
    const daysLeft = new Date(Date.UTC(y, m, 0)).getUTCDate() - dd
    return `<div class="card" style="padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="font-size:1.6rem">🎯</div>
      <div style="flex:1;min-width:200px">
        <div style="font-weight:800">เป้าส่งมอบเดือนนี้${who !== me.displayName ? ` · ${escHtml(who)}` : ''}: <span style="color:var(--${g.color})">${done}/${t} คัน (${g.pct}%)</span></div>
        <div style="height:8px;background:var(--surface-2);border-radius:4px;margin:6px 0"><div style="height:100%;width:${Math.min(100, g.pct)}%;background:var(--${g.color});border-radius:4px"></div></div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${g.left ? `เหลืออีก ${g.left} คัน ใน ${daysLeft} วัน` : 'ถึงเป้าแล้ว เยี่ยมมาก! 🎉'}</div>
      </div></div>`
  }

  function render() {
    const today = todayBangkok()
    const d = buildMyDay(data, { today, mine })
    const hello = me.displayName ? `สวัสดีครับคุณ${escHtml(me.displayName)}` : 'สวัสดีครับ'
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div><div class="page-title">☀️ งานของฉันวันนี้</div><div class="page-subtitle">${hello} · ${formatDate(today)} · ${d.total ? `มีงานค้าง ${d.total} รายการ` : 'ไม่มีงานค้าง 🎉'}</div></div>
          <div class="page-actions">
            ${canPick ? `<select class="input" id="md-seller" style="width:auto"><option value="all">ทุกคน</option>${sellerNames().map(n => `<option value="${escHtml(n)}" ${n === seller ? 'selected' : ''}>${escHtml(n)}</option>`).join('')}</select>` : ''}
            <button class="btn btn-secondary btn-sm" id="md-reload">🔄 รีเฟรช</button>
          </div>
        </div>

        ${goalCard(today)}
        ${section('📞', 'Follow-up วันนี้/เลยกำหนด', 'กด ✅ เมื่อติดต่อแล้ว', d.followups, f => line(
          `${escHtml(f.customerName || 'ลูกค้า')}${f.late > 0 ? ` <span class="badge badge-danger" style="font-size:0.62rem">เลย ${f.late} วัน</span>` : ''}`,
          `${escHtml(f.purpose || '')}${f.vehicleModel ? ` · ${escHtml(f.vehicleModel)}` : ''}${ownerTag(f.salesperson)}`,
          `${callBtn(f.phone)}<button class="btn btn-success btn-xs md-fu" data-id="${escHtml(f.id)}">✅ ทำแล้ว</button>`), 'danger')}

        ${d.testDrives.length ? section('🚙', 'นัดทดลองขับวันนี้', 'บันทึกผลที่หน้า Test Drive แล้วระบบนัดโทรตามให้', d.testDrives, t => line(
          `${escHtml(t.time || '')} · ${escHtml(t.customerName || 'ลูกค้า')}`,
          `${escHtml(t.model || '')}${ownerTag(t.staff)}`,
          `${callBtn(t.phone)}<button class="btn btn-secondary btn-xs md-td">Test Drive</button>`), 'primary') : ''}

        ${section('🧲', 'Lead ใหม่วันนี้', 'โทรหาภายในวันนี้ โอกาสปิดสูงสุด', d.newLeads, c => line(
          `${escHtml(c.name)}${c.interestedModel ? ` · ${escHtml(c.interestedModel)}` : ''}`,
          `${escHtml(SOURCE_LABEL[c.source] || c.source || '')}${c.phone ? ` · ${escHtml(c.phone)}` : c.lineId ? ` · ${escHtml(c.lineId)}` : ''}${ownerTag(c.assignedTo)}`,
          `${callBtn(c.phone)}${takeBtns(c)}${bangkokDate(c.lastContactAt) === today ? '<span class="badge badge-success" style="font-size:0.62rem">ติดต่อแล้ว</span>' : `<button class="btn btn-success btn-xs md-touch" data-id="${escHtml(c.id)}">✅ ติดต่อแล้ว</button>`}<button class="btn btn-secondary btn-xs md-plan" data-id="${escHtml(c.id)}">📅 นัด</button><button class="btn btn-secondary btn-xs md-open" data-id="${escHtml(c.id)}">เปิด</button>`), 'success')}

        ${section('⏰', `Lead ไม่ได้ติดตามเกิน ${STALE_LEAD_DAYS} วัน`, 'กด "ติดตามแล้ว" เพื่อบันทึกว่าคุยแล้ววันนี้', d.stale, c => line(
          `${escHtml(c.name)}${c.interestedModel ? ` · ${escHtml(c.interestedModel)}` : ''} <span class="badge badge-warning" style="font-size:0.62rem">${c.days} วัน</span>`,
          `${c.phone ? escHtml(c.phone) : c.lineId ? escHtml(c.lineId) : 'ไม่มีเบอร์'}${ownerTag(c.assignedTo)}`,
          `${callBtn(c.phone)}${takeBtns(c)}<button class="btn btn-success btn-xs md-touch" data-id="${escHtml(c.id)}">✅ ติดตามแล้ว</button><button class="btn btn-secondary btn-xs md-plan" data-id="${escHtml(c.id)}">📅 นัด</button><button class="btn btn-secondary btn-xs md-open" data-id="${escHtml(c.id)}">เปิด</button>`), 'warning')}

        ${section('🚗', `นัดส่งมอบ ${UPCOMING_DELIVERY_DAYS} วันข้างหน้า`, 'เตรียมรถ/เอกสารให้พร้อม', d.deliveries, b => line(
          `${escHtml(b.custName || 'ลูกค้า')} · ${escHtml([b.brand, b.model].filter(Boolean).join(' ') || '—')}`,
          `${formatDate(b.deliveryDate)}${b.deliveryTime ? ' ' + escHtml(b.deliveryTime) : ''} · ${b.inDays === 0 ? '<b style="color:var(--danger)">วันนี้</b>' : b.inDays === 1 ? 'พรุ่งนี้' : `อีก ${b.inDays} วัน`} · ${escHtml(b.status || '')}${ownerTag(b.salesName)}`,
          `${callBtn(b.phone || b.custPhone)}<button class="btn btn-secondary btn-xs md-bk">ใบจอง</button>`))}

        ${d.finance.length ? section('🏦', `ไฟแนนซ์รอผลเกิน ${FINANCE_WAIT_DAYS} วัน / ไม่ผ่าน`, 'ตามผลกับไฟแนนซ์ หรือหาไฟแนนซ์ใหม่ให้ลูกค้า', d.finance, b => line(
          `${escHtml(b.custName || 'ลูกค้า')} · ${escHtml([b.brand, b.model].filter(Boolean).join(' ') || '—')} ${b.rejected ? '<span class="badge badge-danger" style="font-size:0.62rem">ไม่ผ่าน</span>' : `<span class="badge badge-warning" style="font-size:0.62rem">รอ ${b.days} วัน</span>`}`,
          `${escHtml(b.financeCo || 'ไม่ระบุไฟแนนซ์')}${ownerTag(b.salesName)}`,
          `${callBtn(b.phone || b.custPhone)}<button class="btn btn-secondary btn-xs md-bk">ใบจอง</button>`), 'warning') : ''}

        ${section('💰', 'ส่งมอบแล้วยังไม่กรอกรายได้ (เดือนนี้)', 'รายงานรายได้จะไม่ครบถ้าไม่กรอก', d.income, b => line(
          `${escHtml(b.custName || 'ลูกค้า')} · ${escHtml([b.brand, b.model].filter(Boolean).join(' ') || '—')}`,
          `ส่งมอบ ${formatDate(b.cutDate || b.actualDeliveryDate)}${ownerTag(b.salesName)}`,
          `<button class="btn btn-warning btn-xs md-inc" data-id="${escHtml(b.id)}">💰 กรอกรายได้</button>`), 'danger')}

        ${section('⏳', `ใบจองค้างเกิน ${STUCK_BOOKING_DAYS} วัน`, 'ตามไฟแนนซ์/รถ/เอกสาร', d.stuck, b => line(
          `${escHtml(b.custName || 'ลูกค้า')} · ${escHtml([b.brand, b.model].filter(Boolean).join(' ') || '—')} <span class="badge badge-warning" style="font-size:0.62rem">${b.days} วัน</span>`,
          `${escHtml(b.status || '—')} · จอง ${formatDate(b.bookingDate)}${ownerTag(b.salesName)}`,
          `${callBtn(b.phone || b.custPhone)}<button class="btn btn-secondary btn-xs md-bk">ใบจอง</button>`), 'warning')}
      </div>`

    const $$ = sel => container.querySelectorAll(sel)
    container.querySelector('#md-seller')?.addEventListener('change', e => { seller = e.target.value; render() })
    container.querySelector('#md-reload').addEventListener('click', async () => { await load(); render() })
    $$('.md-open').forEach(b => b.addEventListener('click', () => navigate(`/crm/customers?id=${encodeURIComponent(b.dataset.id)}`)))
    $$('.md-bk').forEach(b => b.addEventListener('click', () => navigate('/crm/bookings')))
    $$('.md-td').forEach(b => b.addEventListener('click', () => navigate('/crm/testdrive')))
    $$('.md-plan').forEach(b => b.addEventListener('click', () => {
      const c = data.customers.find(x => x.id === b.dataset.id)
      if (c) openAddFollowup(c, { me: me.displayName || '', onSaved: f => { data.followups.push(f); render() } })
    }))
    $$('.md-touch').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true
      try {
        await updateDocData('customers', b.dataset.id, { lastContactAt: new Date().toISOString() })
        const c = data.customers.find(x => x.id === b.dataset.id)
        if (c) { c.updatedAt = new Date().toISOString(); c.lastContactAt = c.updatedAt }
        showToast('✅ บันทึกการติดตามแล้ว', 'success'); render()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error'); b.disabled = false }
    }))
    const giveTo = async (c, name) => {
      const n = await assignCustomer(c, name, findStaffCompany(staff, name) || (name === me.displayName ? myEffectiveCompanyId() : null), data.followups)
      if (n) await load() // โหลดนัดติดตามที่เพิ่งสร้างให้ขึ้นในหน้านี้
      return n
    }
    $$('.md-take').forEach(b => b.addEventListener('click', async () => {
      const c = data.customers.find(x => x.id === b.dataset.id)
      if (!c) return
      b.disabled = true
      try {
        const n = await giveTo(c, me.displayName)
        showToast(`🙋 รับดูแลลูกค้ารายนี้แล้ว${n ? ` · นัดติดตาม ${n} ครั้ง` : ''}`, 'success'); render()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error'); b.disabled = false }
    }))
    $$('.md-give').forEach(b => b.addEventListener('click', () => {
      const c = data.customers.find(x => x.id === b.dataset.id)
      if (!c) return
      openModal({
        title: `👉 มอบ ${escHtml([c.firstName, c.lastName].filter(Boolean).join(' ') || 'ลูกค้า')} ให้เซลส์`, size: 'sm',
        body: `<div class="input-group"><label class="input-label">เลือกเซลส์</label><select class="input" id="md-give-name">${staff.map(x => `<option value="${escHtml(x.name)}">${escHtml(x.name)}${x.nickname ? ` (${escHtml(x.nickname)})` : ''}</option>`).join('')}</select></div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:8px">ระบบจะนัดติดตามวันที่ 1, 3, 7 ให้เซลส์คนนั้นด้วย (ถ้ายังไม่มีนัด)</div>`,
        async onConfirm() {
          const name = document.getElementById('md-give-name')?.value
          if (!name) return false
          try {
            const n = await giveTo(c, name)
            showToast(`👉 มอบให้ ${name} แล้ว${n ? ` · นัดติดตาม ${n} ครั้ง` : ''}`, 'success'); render()
          } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        },
      })
    }))
    $$('.md-inc').forEach(btn => btn.addEventListener('click', async () => {
      const b = data.bookings.find(x => x.id === btn.dataset.id)
      if (b && await askDeliveryIncome(b)) { showToast('💰 บันทึกรายได้แล้ว', 'success'); render() }
    }))
    $$('.md-fu').forEach(btn => btn.addEventListener('click', () => {
      const f = data.followups.find(x => x.id === btn.dataset.id)
      if (!f) return
      openModal({
        title: `✅ ติดต่อ ${escHtml(f.customerName || 'ลูกค้า')} แล้ว`, size: 'sm',
        body: `<div class="input-group"><label class="input-label">ผลการติดต่อ *</label><textarea class="input" id="md-fu-result" rows="3" placeholder="เช่น สนใจ นัดทดลองขับเสาร์นี้"></textarea></div>`,
        async onConfirm() {
          const result = document.getElementById('md-fu-result')?.value?.trim()
          if (!result) { showToast('❗ กรุณากรอกผลการติดต่อ', 'error'); return false }
          try {
            await updateDocData('followups', f.id, { status: 'done', result })
            f.status = 'done'; f.result = result
            showToast('✅ บันทึกผล Follow-up แล้ว', 'success'); render()
          } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        },
      })
      setTimeout(() => document.getElementById('md-fu-result')?.focus(), 50)
    }))
  }
  render()
}
