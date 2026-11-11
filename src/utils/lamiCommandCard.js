// การ์ด "🪄 สั่งงาน" ใต้คำสั่งที่พิมพ์ให้ LAMI — กด ✅ ทำเลย ครั้งเดียวจบ (ใช้ทั้งหน้าแชท LAMI และแผง 🤖)
import { runLamiCommand, commandHref } from './lamiCommands.js'
import { escHtml as esc } from './escape.js'

export function commandIntro(cmds) {
  return cmds.length === 1 ? '🪄 เข้าใจว่าให้ทำแบบนี้ครับ — กด ✅ ทำเลย เพื่อยืนยัน' : '🪄 เจอลูกค้าชื่อคล้ายกันหลายคน — เลือกคนที่ใช่ แล้วกด ✅ ทำเลย'
}

// ทำคำสั่งจริง (ใช้ร่วมกัน: การ์ด ✅ ทำเลย และ Enter ใน Ctrl K) — คืนข้อความผลลัพธ์
export async function executeCommand(cmd) {
  const [db, { myEffectiveCompanyId, companyScopeFilters }, { getState }, { followupWindowFilters }, { todayBangkok }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('../core/store.js'), import('./customerFollowups.js'), import('./format.js')])
  const me = getState('user')?.displayName || ''
  const today = todayBangkok()
  const msg = await runLamiCommand({ ...cmd, today }, { me, db, companyId: myEffectiveCompanyId(), followupFilters: [...companyScopeFilters(), ...followupWindowFilters(today)] })
  // ติดต่อแล้วแต่ยังไม่ได้บอกนัดถัดไป → เปิดฟอร์มนัดต่อที่เดาวันให้แล้ว (ลูกค้า Lead/Prospect เท่านั้น)
  if (cmd.kind === 'log' && !cmd.next) import('./addFollowupModal.js').then(m => m.offerNextFollowup(cmd.customer, cmd.contacted ? cmd.text : cmd.text + ' โทรใหม่พรุ่งนี้', { me })).catch(() => {})
  return msg
}

// multi = คำสั่งกลุ่ม (หลายคน): มีปุ่ม "✅ ทำทั้งหมด" · ทำทีละใบได้โดยไม่ปิดใบอื่น · onDone เรียกครั้งเดียวตอนครบทุกใบ
export function mountCommandCard(slot, cmds, { onDone, multi = false } = {}) {
  if (!slot || !cmds?.length) return
  // ปุ่มทำทั้งหมดอยู่ท้ายรายการ (แผง/แชทเลื่อนลงล่างสุดเอง จึงเห็นทันที)
  slot.innerHTML = `<div class="lami-cmds">${cmds.map((c, i) => `
    <div class="lami-cmd" data-i="${i}">
      <div class="lami-cmd-t"><b>${esc(c.label)}</b>${c.desc ? `<small>${esc(c.desc)}</small>` : ''}</div>
      <button type="button" class="btn btn-primary btn-sm lami-cmd-go" data-i="${i}">${c.kind === 'tel' ? '📞 โทรเลย' : c.kind === 'td' ? '🚗 เปิดฟอร์ม' : c.kind === 'lead' ? '➕ เปิดฟอร์ม' : c.kind === 'book' ? '📝 เปิดฟอร์มจอง' : c.kind === 'open' ? '👤 เปิด' : c.kind === 'bk' ? '📝 เปิดใบจอง' : c.kind === 'stage' ? '📝 อัปเดตใบจอง' : '✅ ทำเลย'}</button>
    </div>`).join('')}</div>${multi && cmds.length > 1 ? `<div class="lami-cmds-all"><button type="button" class="btn btn-primary lami-cmd-all">✅ ทำทั้งหมด ${cmds.length} คน</button></div>` : ''}`
  const done = new Set()
  // บันทึกใบที่ i (คำสั่งที่บันทึกได้ทันที) — คืน true ถ้าสำเร็จ
  async function save(i, { quiet = false } = {}) {
    const btn = slot.querySelector(`.lami-cmd-go[data-i="${i}"]`), cmd = cmds[i]
    if (!btn || !cmd || done.has(i)) return false
    btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก…'
    try {
      const msg = await executeCommand(cmd)
      done.add(i)
      btn.closest('.lami-cmd').classList.add('done')
      btn.outerHTML = '<span class="lami-cmd-ok">✓ เรียบร้อย</span>'
      if (!multi) {
        slot.querySelectorAll('.lami-cmd-go').forEach(b => { b.disabled = true })
        const { showToast } = await import('../core/store.js'); showToast(msg, 'success')
        onDone?.(msg, cmd)
      } else if (!quiet) {
        const { showToast } = await import('../core/store.js'); showToast(msg, 'success')
      }
      if (multi && done.size === cmds.length) { slot.querySelector('.lami-cmds-all')?.remove(); onDone?.(`✅ ทำครบ ${cmds.length} รายการแล้ว`, cmd) }
      return true
    } catch (e) {
      btn.disabled = false; btn.textContent = '✅ ทำเลย'
      if (!quiet) import('../core/store.js').then(m => m.showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'))
      return false
    }
  }
  slot.querySelector('.lami-cmd-all')?.addEventListener('click', async e => {
    const all = e.currentTarget
    all.disabled = true; all.textContent = '⏳ กำลังบันทึก…'
    let ok = 0, fail = 0
    for (let i = 0; i < cmds.length; i++) { if (done.has(i)) continue; (await save(i, { quiet: true })) ? ok++ : fail++ }
    const { showToast } = await import('../core/store.js')
    showToast(`✅ บันทึกแล้ว ${ok} รายการ${fail ? ` · ไม่สำเร็จ ${fail} (กดทำเลยทีละใบได้)` : ''}`, fail ? 'warning' : 'success')
    if (fail && all.isConnected) { all.disabled = false; all.textContent = `✅ ทำที่เหลือ ${cmds.length - done.size} คน` }
  })
  slot.querySelectorAll('.lami-cmd-go').forEach(btn => btn.addEventListener('click', async () => {
    const cmd = cmds[+btn.dataset.i]
    if (!cmd) return
    if (cmd.kind === 'tel') {
      import('./callLogger.js').then(m => m.armCallLog?.(cmd.customer)).catch(() => {})
      location.href = 'tel:' + cmd.phone; return
    }
    const href = commandHref(cmd)
    if (href) {
      const [{ navigate }, panel] = await Promise.all([import('../core/router.js'), import('./lamiPanel.js')])
      panel.closeLamiPanel?.()
      navigate(href); return
    }
    if (cmd.kind === 'lead') {
      const { openQuickLead } = await import('./quickLead.js')
      openQuickLead({ pasteText: cmd.text, name: cmd.name }); return
    }
    if (cmd.kind === 'td') {
      const { openTestDriveForm } = await import('./testDriveForm.js')
      openTestDriveForm(cmd.customer, { hint: cmd.hint || '' }); return
    }
    await save(+btn.dataset.i)
  }))
}

// (v1.0.1039) คำสั่งกลุ่ม "นัดลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง" → null ถ้าไม่ใช่ · คืน { cmds, intro }
export async function loadBulkCommands(q, customersPromise) {
  const bulk = await import('./bulkCommands.js')
  const { todayBangkok } = await import('./format.js')
  const today = todayBangkok()
  const spec = bulk.parseBulkSpec(q, today)
  if (!spec) return null
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js')])
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  const res = bulk.bulkTargets({ customers, followups, today, spec })
  return { cmds: bulk.bulkCommands(res.list, spec), intro: bulk.bulkIntro(spec, res) }
}

// (v1.0.1045) ถามหารายชื่อ "ลูกค้า hot มีใครบ้าง" → null ถ้าไม่ใช่ · คืน { cmds, intro, next }
export async function loadListCommands(q, customersPromise) {
  const lq = await import('./listQuestions.js')
  const spec = lq.parseListSpec(q)
  if (!spec) return null
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js')])
  const today = todayBangkok()
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  const res = lq.listTargets({ customers, followups, today, spec })
  return { cmds: lq.listCommands(res.list), intro: lq.listIntro(spec, res), next: lq.listFollowUp(spec, res) }
}

// (v1.0.1046) ถามหาใบจอง "ใครรอไฟแนนซ์ / ใครยังไม่นัดส่งมอบ / ใบจองไหนค้างนานสุด" → null ถ้าไม่ใช่ · คืน { cmds, intro }
// เห็นเฉพาะใบจองของลูกค้าที่ผู้ใช้มองเห็น (สิทธิ์เดียวกับรายชื่อลูกค้า)
export async function loadBookingListCommands(q, customersPromise) {
  const bq = await import('./bookingQuestions.js')
  const spec = bq.parseBookingListSpec(q)
  if (!spec) return null
  const [{ listAllDocs }, { companyScopeFilters }, { todayBangkok }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('./format.js')])
  const [customers, bookings] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
  ])
  const res = bq.bookingTargets({ customers, bookings, today: todayBangkok(), spec })
  return { cmds: bq.bookingListCommands(res.list), intro: bq.bookingListIntro(spec, res) }
}

// (v1.0.1048) ถามถึงลูกค้าคนเดียว "สมชายถึงไหนแล้ว / สรุปมานี" → null ถ้าไม่ใช่ · คืน { text, cmds, customer, chips }
export async function loadCustomerBrief(q, customersPromise) {
  const cb = await import('./customerBrief.js')
  const customers = await (customersPromise || visibleCustomersForCommands())
  const c = cb.briefTarget(q, customers)
  if (!c) return null
  const [{ listDocs, readDoc }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }, { quickChips }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js'), import('./lamiCommands.js')])
  const today = todayBangkok()
  const [followups, booking] = await Promise.all([
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
    c.bookingId ? readDoc('bookings', c.bookingId).catch(() => null) : null,
  ])
  return { text: cb.customerBrief({ customer: c, followups, booking: booking && !booking.deleted ? booking : null, today }), cmds: cb.briefCommands(c), customer: c, chips: quickChips(c).filter(x => !/\s$/.test(x)) }
}

// (v1.0.1049) "วันนี้มีอะไรบ้าง / สรุปวันนี้" → null ถ้าไม่ใช่ · คืน { text, next: [ประโยคถามต่อ] }
export async function loadTodayBrief(q, customersPromise) {
  const tb = await import('./todayBrief.js')
  if (!tb.isTodayQuestion(q)) return null
  const [{ listDocs, listAllDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok, addDaysBangkok, dmy }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js')])
  const today = todayBangkok()
  const [customers, followups, bookings] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
  ])
  const st = tb.todayStats({ customers, followups, bookings, today, tomorrow: addDaysBangkok(1) })
  return { text: tb.todayBriefText(st, dmy(today)), next: tb.todayFollowUps(st) }
}

// (v1.0.1059) "พรุ่งนี้มีอะไรบ้าง / สัปดาห์นี้มีอะไรบ้าง" → null ถ้าไม่ใช่ · คืน { text, next, go }
export async function loadAheadBrief(q, customersPromise) {
  const ab = await import('./aheadBrief.js')
  const spec = ab.parseAheadSpec(q)
  if (!spec) return null
  const [{ listDocs, listAllDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js')])
  const today = todayBangkok()
  const [customers, followups, bookings] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
  ])
  const st = ab.aheadStats({ customers, followups, bookings, today, mode: spec.mode })
  return { text: ab.aheadBriefText(st), next: ab.aheadFollowUps(st), go: { path: '/calendar', label: '🗓️ เปิดปฏิทินงาน' } }
}

// (v1.0.1051) "ยอดเดือนนี้เป็นไง / ถึงเป้าหรือยัง / ใครขายดีสุด" → null ถ้าไม่ใช่ · คืน { text, next }
// นับเฉพาะใบจองของเซลส์ที่ผู้ใช้มองเห็น (ตัวเอง + ลูกทีม · แอดมิน/เจ้าของ = ทั้งโชว์รูม)
export async function loadMonthBrief(q) {
  const mb = await import('./monthBrief.js')
  if (!mb.isMonthQuestion(q)) return null
  const [{ listAllDocs, readDoc }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord, normName }, { todayBangkok }, { SALES_TARGETS_COLLECTION }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js'), import('./format.js'), import('./salesTargets.js')])
  const today = todayBangkok()
  const [all, vis, tdoc] = await Promise.all([
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
    getVisibilityScope().catch(() => null),
    readDoc(SALES_TARGETS_COLLECTION, today.slice(0, 7)).catch(() => null),
  ])
  if (!vis) return null
  const whole = !!(vis.unrestricted || vis.companyOnly)
  const bookings = all.filter(b => !b.deleted && scopeIncludesRecord(vis, b.salesName, b))
  const target = Object.entries(tdoc?.targets || {}).reduce((s, [n, v]) => s + (whole || vis.names?.has(normName(n)) ? Number(v) || 0 : 0), 0)
  const st = mb.monthStats({ bookings, today, target })
  return { text: mb.monthBriefText(st, { scope: whole ? 'ทั้งโชว์รูม' : vis.hasSubordinates ? 'คุณและทีม' : 'ของคุณ' }), next: mb.monthFollowUps(st) }
}

// (v1.0.1058) "ค่าคอมเดือนนี้เท่าไหร่ / รายได้เดือนก่อน" → null ถ้าไม่ใช่ · คืน { text, next, go } · ขอบเขตเดียวกับหน้ารายได้รายเซลส์
export async function loadIncomeBrief(q) {
  const ib = await import('./incomeBrief.js')
  if (!ib.isIncomeQuestion(q)) return null
  const [{ listAllDocs }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord }, { todayBangkok }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js'), import('./format.js')])
  const [all, vis] = await Promise.all([
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
    getVisibilityScope().catch(() => null),
  ])
  if (!vis) return null
  const whole = !!(vis.unrestricted || vis.companyOnly)
  const st = ib.incomeStats({ bookings: all.filter(b => !b.deleted && scopeIncludesRecord(vis, b.salesName, b)), today: todayBangkok(), prev: ib.wantsPrevMonth(q) })
  return { text: ib.incomeBriefText(st, { scope: whole ? 'ทั้งโชว์รูม' : vis.hasSubordinates ? 'คุณและทีม' : 'ของคุณ' }), next: ib.incomeFollowUps(st), go: { path: '/crm/sales-income', label: '💰 เปิดหน้ารายได้รายเซลส์' } }
}

// (v1.0.1053) "S07 สีขาวมีไหม / มีรถอะไรพร้อมขาย / รถค้างสต็อกนานมีคันไหน" → null ถ้าไม่ใช่ · คืน { text, next, go }
export async function loadStockAnswer(q) {
  const sq = await import('./stockQuestions.js')
  if (!sq.maybeStockQuestion(q)) return null
  const [{ listDocs }, { companyScopeFilters }, { todayBangkok }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('./format.js')])
  const vehicles = await listDocs('vehicles', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => [])
  const spec = sq.parseStockSpec(q, vehicles)
  if (!spec) return null
  const res = sq.stockAnswer({ vehicles, spec, today: todayBangkok() })
  return { text: res.text, next: res.next, copy: res.copy, go: { path: '/dms/stock' + (res.query ? '?q=' + encodeURIComponent(res.query) : ''), label: '🚙 เปิดหน้าสต็อก' } }
}

// (v1.0.1054) "S07 ดาวน์ 20% ผ่อน 60 งวดเท่าไหร่ / ผ่อน AION V เดือนละเท่าไหร่" → null ถ้าไม่ใช่ · คืน { text, next, go }
export async function loadPayAnswer(q) {
  const pq = await import('./payQuestions.js')
  if (!pq.maybePayQuestion(q)) return null
  const { getVehicles } = await import('../data/vehicleDatabase.js')
  const spec = pq.parsePaySpec(q, getVehicles())
  if (!spec) return null
  return { text: pq.payAnswer(spec), copy: pq.payCustomerText(spec), next: pq.payFollowUps(spec), go: { path: '/finance/loan-calc?' + pq.loanCalcQuery(spec), label: '🧮 เทียบไฟแนนซ์ด้วยเงื่อนไขนี้' } }
}

// (v1.0.1056) "ทีมวันนี้เป็นไง / ใครมีนัดค้างเยอะสุด" → null ถ้าไม่ใช่ · คืน { text, next, go }
export async function loadTeamBrief(q, customersPromise) {
  const tm = await import('./teamBrief.js')
  if (!tm.isTeamQuestion(q)) return null
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok, dmy }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js')])
  const today = todayBangkok()
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  const st = tm.teamStats({ customers, followups, today })
  return { text: tm.teamBriefText(st, dmy(today)), next: tm.teamFollowUps(st), go: { path: '/crm/followup', label: '📞 เปิดหน้าติดตามลูกค้า' } }
}

// (v1.0.1035) "วันนี้ควรโทรหาใคร" → รายชื่อพร้อมปุ่มโทร (ลูกค้าที่ผู้ใช้เห็นเท่านั้น)
export async function loadCallListCommands(customersPromise) {
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }, { callList, callListCommands }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js'), import('./callList.js')])
  const today = todayBangkok()
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  return callListCommands(callList({ customers, followups, today }))
}
export function callListIntro(cmds) {
  return cmds.length ? `📞 วันนี้ควรโทร ${cmds.length} คนนี้ก่อน (เรียงจากเร่งด่วนที่สุด) — กดโทรได้เลย วางสายแล้วระบบถามผลให้บันทึก` : '🎉 วันนี้ไม่มีนัดค้างหรือลูกค้า Hot/Warm ที่เงียบนาน — ลองดูลูกค้าใหม่ในหน้า Lead'
}

// ลูกค้าที่ผู้ใช้คนนี้มองเห็น (ตามสิทธิ์เดียวกับหน้าแชท) — ใช้จับชื่อในคำสั่ง
export async function visibleCustomersForCommands() {
  const [{ listDocs }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js')])
  const [rows, vis] = await Promise.all([
    listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
    getVisibilityScope().catch(() => null),
  ])
  return rows.filter(c => !c.deleted && !!vis && (vis.unrestricted || vis.companyOnly || scopeIncludesRecord(vis, c.assignedTo, c)))
}
