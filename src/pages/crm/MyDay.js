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
import { bangkokDate, buildMyDay, topPriorities, teamToday, leadWait, STALE_LEAD_DAYS, STUCK_BOOKING_DAYS, UPCOMING_DELIVERY_DAYS, FINANCE_WAIT_DAYS } from '../../utils/myDay.js'
import { followupWindowFilters } from '../../utils/customerFollowups.js'
import { openAddFollowup, offerNextFollowup } from '../../utils/addFollowupModal.js'
import { touchCustomerContact } from '../../utils/customerContact.js'
import { armCallLog } from '../../utils/callLogger.js'
import { lineNameKey } from '../../utils/lineRegistration.js'
import { buildBatchNudgePrompt, parseBatchNudgeReply } from '../../utils/salesAi.js'
import { revisitMessage } from '../../utils/bookingNotify.js'
import { classifyLostReason } from '../../utils/lostReason.js'

const NUDGE_MAX = 8

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
  let lineRegistered = true
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
    // ลงทะเบียนรับงานทาง LINE แล้วหรือยัง (ทัก LINE OA พิมพ์ "ลงทะเบียน ชื่อ") — โหลดไม่ได้ = ไม่แสดงคำแนะนำ
    try {
      const regs = await listDocs('line_sales_targets', [], 'registeredAt', 'desc', 500)
      lineRegistered = !me.displayName || regs.some(r => lineNameKey(r.name) === lineNameKey(me.displayName)) // เทียบแบบเดียวกับ worker
    } catch { lineRegistered = true }
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

  let cleared = [] // หัวข้อที่ไม่มีงานค้าง — ย่อรวมไว้บรรทัดเดียวท้ายหน้าแทนการ์ดว่างๆ ยาวทั้งหน้า
  function section(icon, title, hint, items, row, color = 'primary') {
    if (!items.length) { cleared.push(`${icon} ${title}`); return '' }
    return `<div class="card" style="padding:0;margin-bottom:14px;overflow:hidden">
      <div style="padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">
        <span style="font-size:1.1rem">${icon}</span><b>${title}</b>
        <span class="badge badge-${items.length ? color : 'secondary'}">${items.length}</span>
        <span style="margin-left:auto;font-size:0.7rem;color:var(--text-muted)">${hint}</span>
      </div>
      ${items.slice(0, 50).map(row).join('') + (items.length > 50 ? `<div style="padding:8px 16px;font-size:0.75rem;color:var(--text-muted)">…และอีก ${items.length - 50} รายการ</div>` : '')}
    </div>`
  }
  const line = (main, sub, actions) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <div style="flex:1;min-width:180px"><div style="font-weight:600;font-size:0.86rem">${main}</div><div style="font-size:0.72rem;color:var(--text-muted)">${sub}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div></div>`
  // cid = รหัสลูกค้า → กลับมาที่แอปหลังวางสาย ระบบถามผลการโทรให้บันทึก (utils/callLogger.js)
  const callBtn = (phone, cid = '') => tel(phone) ? `<a class="btn btn-secondary btn-xs${cid ? ' md-call' : ''}" data-cid="${escHtml(cid)}" href="tel:${escHtml(tel(phone))}">📞 โทร</a>` : ''
  const takeBtns = c => String(c.assignedTo || '').trim() ? '' : `${me.displayName ? `<button class="btn btn-primary btn-xs md-take" data-id="${escHtml(c.id)}">🙋 รับดูแล</button>` : ''}${canPick && staff.length ? `<button class="btn btn-secondary btn-xs md-give" data-id="${escHtml(c.id)}">👉 มอบให้</button>` : ''}`
  // ⏱ Lead ใหม่รอมานานแค่ไหน (ยังไม่ได้ติดต่อ) — เขียว < 15 นาที, เหลือง < 1 ชม., แดง ชั่วโมงขึ้นไป
  const waitTag = c => { const w = leadWait(c); return w ? ` <span class="badge badge-${{ ok: 'success', warn: 'warning', late: 'danger' }[w.level]}" style="font-size:0.62rem">⏱ ${w.label}</span>` : '' }
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

  // "ทำ 3 อย่างนี้ก่อน" — เปิดหน้ามาเห็นทันทีว่าควรเริ่มจากอะไร (จัดลำดับด้วย topPriorities ใน utils/myDay.js)
  function focusCard(d) {
    const top = topPriorities(d, 3)
    if (!top.length) return ''
    return `<div class="card" style="padding:0;margin-bottom:14px;overflow:hidden;border:1px solid color-mix(in srgb, var(--primary) 35%, transparent)">
      <div style="padding:14px 16px;background:linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent), transparent);display:flex;align-items:center;gap:10px">
        <span style="font-size:1.4rem">🎯</span>
        <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:1rem">ทำ ${top.length} อย่างนี้ก่อน</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">ระบบเลือกจากงานทั้งหมด ${d.total} รายการ ตามโอกาสปิดการขายและความเร่งด่วน</div></div>
      </div>
      ${top.map((t, i) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--border);flex-wrap:wrap">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">${i + 1}</div>
        <div style="flex:1;min-width:180px"><div style="font-weight:700;font-size:0.88rem">${t.icon} ${escHtml(t.title)}</div><div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(t.why)}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${callBtn(t.phone, t.customerId)}${/^(new|stl):/.test(t.key) ? `<button class="btn btn-success btn-xs md-touch" data-id="${escHtml(t.customerId)}" title="คุยกับลูกค้าแล้ว — ระบบจะเลือกงานถัดไปให้">✅ เสร็จ</button>` : ''}${t.key.startsWith('hot:') ? `<button class="btn btn-secondary btn-xs md-plan" data-id="${escHtml(t.customerId)}">📅 นัด</button>` : ''}${t.customerId ? `<button class="btn btn-secondary btn-xs md-ai" data-id="${escHtml(t.customerId)}" title="ให้ AI คิดว่าควรพูดอะไร และร่างข้อความ LINE ให้">🤖 AI ช่วย</button><button class="btn btn-primary btn-xs md-open" data-id="${escHtml(t.customerId)}">เปิดลูกค้า</button>` : t.key.startsWith('inc:') ? `<button class="btn btn-warning btn-xs md-inc" data-id="${escHtml(t.bookingId)}">💰 กรอกรายได้</button>` : t.key.startsWith('uns:') ? '<button class="btn btn-primary btn-xs md-cal">📅 ปฏิทินส่งมอบ</button>' : '<button class="btn btn-secondary btn-xs md-bk">ใบจอง</button>'}</div>
      </div>`).join('')}
    </div>`
  }

  // ทีมวันนี้ — เฉพาะหัวหน้า/เจ้าของตอนดู "ทุกคน" กดชื่อเพื่อดูงานของคนนั้น
  function teamCard(today) {
    if (!canPick || seller !== 'all') return ''
    const rows = teamToday(data, { today, names: sellerNames().filter(n => n !== UNASSIGNED), same: (a, b) => normName(a) === normName(b), allowed: (n, rec) => scopeIncludesRecord(scope, n, rec) })
    if (rows.length < 2) return ''
    const max = Math.max(...rows.map(r => r.total + r.newUntouched), 1)
    return `<div class="card" style="padding:0;margin-bottom:14px;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px"><span style="font-size:1.1rem">👥</span><b>ทีมวันนี้</b>
        <span style="margin-left:auto;font-size:0.7rem;color:var(--text-muted)">กดชื่อเพื่อดูงานของคนนั้น</span></div>
      ${rows.map(r => `<div class="md-who" data-name="${escHtml(r.name)}" style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--border);cursor:pointer;flex-wrap:wrap">
        <div style="width:130px;font-weight:600;font-size:0.84rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.name)}</div>
        <div style="flex:1;min-width:90px;height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.round((r.total + r.newUntouched) / max * 100)}%;background:var(--warning)"></div></div>
        <div style="font-size:0.74rem;color:var(--text-muted);white-space:nowrap">📋 ค้าง <b style="color:var(--text)">${r.total}</b>${r.newUntouched ? ` · 🧲 Lead ใหม่ยังไม่โทร <b style="color:var(--danger)">${r.newUntouched}</b>` : ''} · 💪 ติดต่อแล้ว <b style="color:var(--success)">${r.contacted}</b></div>
      </div>`).join('')}
    </div>`
  }

  let lastDay = { stale: [], revisit: [] }
  // AI ร่างข้อความ LINE ทักลูกค้าที่เงียบหลายคนพร้อมกัน — เซลส์อ่าน/แก้ แล้วคัดลอกไปส่งเอง (ไม่ส่งอัตโนมัติ)
  async function openNudgeDrafts(list) {
    if (!list.length) return
    const ai = await import('../../utils/ai.js')
    if (!ai.isAiEnabled()) { showToast('ต้องล็อกอินด้วยบัญชีจริงเพื่อใช้ AI', 'warning'); return }
    const { el, close } = openModal({
      title: `✨ ข้อความทักลูกค้า ${list.length} คน`, size: 'md',
      body: `<div id="nd-body" style="padding:20px;text-align:center;color:var(--text-muted)"><span class="spinner spinner-sm"></span> AI กำลังร่างข้อความ...</div>`,
      footer: `<button class="btn btn-secondary" id="nd-close">ปิด</button>`,
    })
    el.querySelector('#nd-close').addEventListener('click', close)
    let drafts = []
    try { drafts = parseBatchNudgeReply(await ai.askJsonPrompt(buildBatchNudgePrompt(list), 4000), list.length) } catch {}
    const body = el.querySelector('#nd-body')
    if (!body) return
    if (!drafts.length) { body.innerHTML = '<div style="color:var(--danger)">AI ร่างไม่สำเร็จ ลองใหม่อีกครั้ง</div>'; return }
    body.style.cssText = 'display:flex;flex-direction:column;gap:10px;text-align:left'
    body.innerHTML = '<div style="font-size:0.74rem;color:var(--text-muted)">อ่าน/แก้ได้ก่อนส่ง · กด 📋 แล้ววางในแชท LINE ของลูกค้า · ส่งแล้วกด ✅</div>' + drafts.map(({ i, msg }) => {
      const c = list[i - 1]
      return `<div class="card" style="padding:10px 12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
          <b style="font-size:0.85rem">${escHtml(c.name)}</b><span style="font-size:0.7rem;color:var(--text-muted)">${escHtml(c.interestedModel || '')} · เงียบ ${c.days} วัน</span>
        </div>
        <textarea class="input nd-msg" data-i="${i}" rows="3" style="width:100%;font-size:0.84rem">${escHtml(msg)}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px">
          <button class="btn btn-secondary btn-xs nd-copy" data-i="${i}">📋 คัดลอก</button>
          <button class="btn btn-success btn-xs nd-sent" data-i="${i}">✅ ส่งแล้ว</button>
        </div>
      </div>`
    }).join('')
    body.querySelectorAll('.nd-copy').forEach(b => b.addEventListener('click', async () => {
      const t = body.querySelector(`.nd-msg[data-i="${b.dataset.i}"]`)?.value || ''
      try { await navigator.clipboard.writeText(t); showToast('📋 คัดลอกแล้ว วางใน LINE ได้เลย', 'success') } catch { showToast('คัดลอกไม่สำเร็จ — กดค้างที่ข้อความแล้วคัดลอกเอง', 'warning') }
    }))
    body.querySelectorAll('.nd-sent').forEach(b => b.addEventListener('click', async () => {
      const c = list[Number(b.dataset.i) - 1]
      b.disabled = true
      if (await touchCustomerContact(c.id)) {
        const cc = data.customers.find(x => x.id === c.id)
        if (cc) { cc.updatedAt = new Date().toISOString(); cc.lastContactAt = cc.updatedAt }
        b.textContent = '✔ บันทึกแล้ว'
        render()
      } else { b.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function render() {
    const today = todayBangkok()
    const d = buildMyDay(data, { today, mine })
    lastDay = d
    cleared = []
    // ความคืบหน้าวันนี้ = ลูกค้าที่ติดต่อแล้ว เทียบกับ (ติดต่อแล้ว + งานค้าง)
    const doneToday = d.contactedToday || 0
    const pct = doneToday + d.total ? Math.round(doneToday / (doneToday + d.total) * 100) : 100
    const stat = (icon, label, value, color) => `<div style="flex:1;min-width:72px;padding:8px 10px;border-radius:12px;background:var(--surface-2)">
      <div style="font-size:0.68rem;color:var(--text-muted);line-height:1.25">${icon} ${label}</div><div style="font-size:1.35rem;font-weight:800;color:var(--${color})">${value}</div></div>`
    const hello = me.displayName ? `สวัสดีครับคุณ${escHtml(me.displayName)}` : 'สวัสดีครับ'
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div><div class="page-title">☀️ งานของฉันวันนี้</div><div class="page-subtitle">${hello} · ${formatDate(today)} · ${d.total ? `มีงานค้าง ${d.total} รายการ` : 'ไม่มีงานค้าง 🎉'}${d.tomorrow ? ` · พรุ่งนี้มีนัด ${d.tomorrow} ราย` : ''}${d.contactedToday ? ` · วันนี้ติดต่อแล้ว ${d.contactedToday} ราย 💪` : ''}</div></div>
          <div class="page-actions">
            ${canPick ? `<select class="input" id="md-seller" style="width:auto"><option value="all">ทุกคน</option>${sellerNames().map(n => `<option value="${escHtml(n)}" ${n === seller ? 'selected' : ''}>${escHtml(n)}</option>`).join('')}</select>` : ''}
            <button class="btn btn-secondary btn-sm" id="md-reload">🔄 รีเฟรช</button>
          </div>
        </div>

        ${lineRegistered ? `<div style="font-size:0.72rem;color:var(--text-muted);margin:-6px 0 10px">💬 คำสั่งใน LINE OA: <code>งาน</code> · <code>พรุ่งนี้</code> · <code>ยอด</code> · <code>หา เบอร์</code> · <code>โทรแล้ว เบอร์</code> · <code>นัด เบอร์ พรุ่งนี้</code> · <code>เสียดีล เบอร์ เหตุผล</code></div>` : `<div class="card mb-4" style="padding:10px 16px;font-size:0.8rem;color:var(--text-2);border-left:3px solid var(--success)">
          📲 รับงานค้างทาง LINE ทุก 9 โมงเช้า: ทัก LINE OA ของบริษัท แล้วพิมพ์ <code>ลงทะเบียน ${escHtml(me.displayName)}</code> · หลังจากนั้นพิมพ์ <code>งาน</code> เพื่อดูงานได้ทุกเวลา, <code>โทรแล้ว เบอร์</code> บันทึกการติดต่อ, <code>นัด เบอร์ พรุ่งนี้</code> นัดติดตาม</div>`}
        <div class="card" style="padding:12px;margin-bottom:14px;display:flex;gap:8px;align-items:center">
          <div title="ความคืบหน้าวันนี้" style="width:58px;height:58px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:conic-gradient(var(--success) ${pct * 3.6}deg, var(--surface-2) 0)">
            <div style="width:44px;height:44px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem">${pct}%</div></div>
          ${stat('📋', 'งานค้าง', d.total, d.total ? 'warning' : 'success')}
          ${stat('💪', 'ติดต่อแล้ว', doneToday, 'success')}
          ${stat('📅', 'นัดพรุ่งนี้', d.tomorrow || 0, 'primary')}
        </div>
        ${focusCard(d)}
        ${teamCard(today)}
        ${goalCard(today)}
        ${section('📞', 'Follow-up วันนี้/เลยกำหนด', 'กด ✅ เมื่อติดต่อแล้ว', d.followups, f => line(
          `${escHtml(f.customerName || 'ลูกค้า')}${f.late > 0 ? ` <span class="badge badge-danger" style="font-size:0.62rem">เลย ${f.late} วัน</span>` : ''}`,
          `${escHtml(f.purpose || '')}${f.vehicleModel ? ` · ${escHtml(f.vehicleModel)}` : ''}${ownerTag(f.salesperson)}`,
          `${callBtn(f.phone, f.customerId)}<button class="btn btn-success btn-xs md-fu" data-id="${escHtml(f.id)}">✅ ทำแล้ว</button>`), 'danger')}

        ${d.testDrives.length ? section('🚙', 'นัดทดลองขับวันนี้', 'บันทึกผลที่หน้า Test Drive แล้วระบบนัดโทรตามให้', d.testDrives, t => line(
          `${escHtml(t.time || '')} · ${escHtml(t.customerName || 'ลูกค้า')}`,
          `${escHtml(t.model || '')}${ownerTag(t.staff)}`,
          `${callBtn(t.phone)}<button class="btn btn-secondary btn-xs md-td">Test Drive</button>`), 'primary') : ''}

        ${section('🧲', 'Lead ใหม่วันนี้', 'โทรหาภายในวันนี้ โอกาสปิดสูงสุด', d.newLeads, c => line(
          `${escHtml(c.name)}${c.interestedModel ? ` · ${escHtml(c.interestedModel)}` : ''}${waitTag(c)}`,
          `${escHtml(SOURCE_LABEL[c.source] || c.source || '')}${c.phone ? ` · ${escHtml(c.phone)}` : c.lineId ? ` · ${escHtml(c.lineId)}` : ''}${ownerTag(c.assignedTo)}`,
          `${callBtn(c.phone, c.id)}${takeBtns(c)}${bangkokDate(c.lastContactAt) === today ? '<span class="badge badge-success" style="font-size:0.62rem">ติดต่อแล้ว</span>' : `<button class="btn btn-success btn-xs md-touch" data-id="${escHtml(c.id)}">✅ ติดต่อแล้ว</button>`}<button class="btn btn-secondary btn-xs md-plan" data-id="${escHtml(c.id)}">📅 นัด</button><button class="btn btn-secondary btn-xs md-open" data-id="${escHtml(c.id)}">เปิด</button>`), 'success')}

        ${d.hotNoPlan.length ? section('🔴', 'ลูกค้า Hot ที่ยังไม่มีนัดติดตาม', 'โอกาสปิดสูง — นัดครั้งถัดไปไว้เลย', d.hotNoPlan, c => line(
          `${escHtml(c.name)}${c.interestedModel ? ` · ${escHtml(c.interestedModel)}` : ''}`,
          `${c.phone ? escHtml(c.phone) : c.lineId ? escHtml(c.lineId) : 'ไม่มีเบอร์'}${ownerTag(c.assignedTo)}`,
          `${callBtn(c.phone, c.id)}<button class="btn btn-primary btn-xs md-plan" data-id="${escHtml(c.id)}">📅 นัด</button><button class="btn btn-secondary btn-xs md-open" data-id="${escHtml(c.id)}">เปิด</button>`), 'danger') : ''}

        ${d.stale.length ? `<div style="display:flex;justify-content:flex-end;margin:-4px 0 8px"><button class="btn btn-primary btn-sm md-ai-nudge" style="background:linear-gradient(135deg,#8B5CF6,#3B82F6);border:none">✨ ให้ AI ร่างข้อความ LINE ทัก ${Math.min(NUDGE_MAX, d.stale.length)} คนที่เงียบ</button></div>` : ''}
        ${section('⏰', `Lead ไม่ได้ติดตามเกิน ${STALE_LEAD_DAYS} วัน`, 'กด "ติดตามแล้ว" เพื่อบันทึกว่าคุยแล้ววันนี้', d.stale, c => line(
          `${c.temperature === 'hot' ? '🔴 ' : ''}${escHtml(c.name)}${c.interestedModel ? ` · ${escHtml(c.interestedModel)}` : ''} <span class="badge badge-warning" style="font-size:0.62rem">${c.days} วัน</span>`,
          `${c.phone ? escHtml(c.phone) : c.lineId ? escHtml(c.lineId) : 'ไม่มีเบอร์'}${ownerTag(c.assignedTo)}`,
          `${callBtn(c.phone, c.id)}${takeBtns(c)}<button class="btn btn-success btn-xs md-touch" data-id="${escHtml(c.id)}">✅ ติดตามแล้ว</button><button class="btn btn-secondary btn-xs md-plan" data-id="${escHtml(c.id)}">📅 นัด</button><button class="btn btn-secondary btn-xs md-open" data-id="${escHtml(c.id)}">เปิด</button>`), 'warning')}

        ${d.revisit.length ? section('🔄', 'ลองติดต่อใหม่ (เสียดีลไปแล้ว 30 วัน+)', 'เหตุผลเดิมอาจเปลี่ยนแล้ว เช่น ไฟแนนซ์/ยังไม่พร้อม', d.revisit, c => line(
          `${escHtml(c.name)}${c.interestedModel ? ` · ${escHtml(c.interestedModel)}` : ''} <span class="badge badge-secondary" style="font-size:0.62rem">${c.days} วัน</span>`,
          `เหตุผล: ${escHtml(c.lostReason || '-')}${c.phone ? ` · ${escHtml(c.phone)}` : ''}${ownerTag(c.assignedTo)}`,
          `${callBtn(c.phone, c.id)}<button class="btn btn-secondary btn-xs md-revisit" data-id="${escHtml(c.id)}" title="ข้อความทักกลับตามเหตุผลที่เสียดีล">💬 ข้อความ</button><button class="btn btn-success btn-xs md-touch" data-id="${escHtml(c.id)}">✅ ติดต่อแล้ว</button><button class="btn btn-secondary btn-xs md-open" data-id="${escHtml(c.id)}">เปิด</button>`), 'primary') : ''}

        ${d.unscheduled.length ? section('📆', 'รถพร้อมส่งแต่ยังไม่ได้นัดวันส่งมอบ', 'โทรนัดลูกค้า แล้วลงวันในปฏิทินส่งมอบ', d.unscheduled, b => line(
          `${escHtml(b.custName || 'ลูกค้า')} · ${escHtml([b.brand, b.model].filter(Boolean).join(' ') || '—')}`,
          `${escHtml(b.status || '')}${b.missed ? ` · <b style="color:var(--danger)">เลยวันนัด ${formatDate(b.deliveryDate)}</b>` : ' · ยังไม่มีวันนัด'}${ownerTag(b.salesName)}`,
          `${callBtn(b.phone || b.custPhone)}<button class="btn btn-primary btn-xs md-cal">📅 ปฏิทินส่งมอบ</button>`), 'warning') : ''}

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
        ${cleared.length ? `<div style="font-size:0.75rem;color:var(--text-muted);padding:4px 2px 12px">✅ เคลียร์แล้ว ไม่มีงานค้าง: ${cleared.map(escHtml).join(' · ')}</div>` : ''}
      </div>`

    const $$ = sel => container.querySelectorAll(sel)
    container.querySelector('#md-seller')?.addEventListener('change', e => { seller = e.target.value; render() })
    container.querySelector('#md-reload').addEventListener('click', async () => { await load(); render() })
    $$('.md-open').forEach(b => b.addEventListener('click', () => navigate(`/crm/customers?id=${encodeURIComponent(b.dataset.id)}`)))
    $$('.md-call').forEach(a => a.addEventListener('click', () => {
      const c = data.customers.find(x => x.id === a.dataset.cid)
      if (c) armCallLog(c, {
        hasPending: () => data.followups.some(x => x.customerId === c.id && x.status === 'pending' && !x.deleted),
        onSaved: nf => { if (nf?.id && nf.dueDate) data.followups.push(nf); render() },
      })
    }))
    $$('.md-who').forEach(b => b.addEventListener('click', () => { seller = b.dataset.name; render(); window.scrollTo({ top: 0, behavior: 'smooth' }) }))
    $$('.md-ai').forEach(b => b.addEventListener('click', () => navigate(`/crm/customers?id=${encodeURIComponent(b.dataset.id)}&ai=1`)))
    $$('.md-bk').forEach(b => b.addEventListener('click', () => navigate('/crm/bookings')))
    $$('.md-cal').forEach(b => b.addEventListener('click', () => navigate('/dms/delivery-calendar')))
    $$('.md-td').forEach(b => b.addEventListener('click', () => navigate('/crm/testdrive')))
    $$('.md-plan').forEach(b => b.addEventListener('click', () => {
      const c = data.customers.find(x => x.id === b.dataset.id)
      if (c) openAddFollowup(c, { me: me.displayName || '', onSaved: f => { data.followups.push(f); render() } })
    }))
    $$('.md-revisit').forEach(b => b.addEventListener('click', () => {
      const c = (lastDay.revisit || []).find(x => x.id === b.dataset.id)
      if (!c) return
      const { el, close } = openModal({
        title: `💬 ทักกลับ ${escHtml(c.name)}`, size: 'sm',
        body: `<div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:6px">เหตุผลเดิม: ${escHtml(c.lostReason || '-')} · แก้ข้อความได้ก่อนคัดลอก</div><textarea class="input" id="rv-msg" data-no-mic rows="4" style="width:100%;font-size:16px">${escHtml(revisitMessage(c, classifyLostReason(c.lostReason)))}</textarea>`,
        footer: `<button class="btn btn-secondary" id="rv-close">ปิด</button><button class="btn btn-primary" id="rv-copy">📋 คัดลอกไปส่ง</button>`,
      })
      el.querySelector('#rv-close').addEventListener('click', close)
      el.querySelector('#rv-copy').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(el.querySelector('#rv-msg').value); showToast('📋 คัดลอกแล้ว ส่งแล้วกด ✅ ติดต่อแล้ว', 'success'); close() } catch { showToast('คัดลอกไม่สำเร็จ — กดค้างที่ข้อความแล้วคัดลอกเอง', 'warning') }
      })
    }))
    $$('.md-ai-nudge').forEach(b => b.addEventListener('click', () => openNudgeDrafts(lastDay.stale.slice(0, NUDGE_MAX))))
    $$('.md-touch').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true
      try {
        if (!(await touchCustomerContact(b.dataset.id))) throw new Error('touch failed')
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
            touchCustomerContact(f.customerId)
            const fc = data.customers.find(x => x.id === f.customerId)
            if (fc) fc.lastContactAt = new Date().toISOString()
            f.status = 'done'; f.result = result
            showToast('✅ บันทึกผล Follow-up แล้ว', 'success'); render()
            offerNextFollowup(fc, result, {
              me: me.displayName || '',
              hasPending: data.followups.some(x => x.customerId === f.customerId && x.status === 'pending' && !x.deleted),
              onSaved: nf => { data.followups.push(nf); render() },
            })
          } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        },
      })
      setTimeout(() => document.getElementById('md-fu-result')?.focus(), 50)
    }))
  }
  render()
}
